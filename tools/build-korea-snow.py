"""Winter 2025-26 KMA 2 km snow: daily 09:00 KST samples, weekly mean/max.
The API table's sd_24hr yields zero stations; its attached codebook specifies
sd_24h = snow depth minus depth 24 hours earlier, NOT total new snowfall.
"""
import importlib.util,datetime as dt,concurrent.futures,json,subprocess,tempfile,time,argparse
from pathlib import Path
from urllib.parse import urlencode
import numpy as np
spec=importlib.util.spec_from_file_location('rain',Path(__file__).with_name('build-korea-rain.py'))
rain=importlib.util.module_from_spec(spec);spec.loader.exec_module(rain)
CACHE=Path(tempfile.gettempdir())/'korea-snow-build';CACHE.mkdir(exist_ok=True)
FIRST,LAST=dt.date(2025,11,1),dt.date(2026,3,31)
def fetch(day,obs,key):
 path=CACHE/f'{obs}-{day}.npz'
 if path.exists():
  with np.load(path) as d:return d['values'],int(d['stations'])
 for attempt in range(4):
  params=dict(obs=obs,tm=day.strftime('%Y%m%d0900'),obj='mq',map='D3',grid=2,stn=attempt%2,authKey=key)
  config='url="'+rain.ENDPOINT+'?'+urlencode(params)+'"\nsilent\nmax-time=50\n'
  response=subprocess.run(['curl','--config','-'],input=config.encode(),capture_output=True)
  try:
   if response.returncode:raise ValueError('Request incomplete')
   values,stations=rain.parse_grid(response.stdout)
   if stations<100:raise ValueError('No credible station coverage')
   np.savez_compressed(path,values=values,stations=stations)
   return values,stations
  except ValueError:
   if attempt==3:raise RuntimeError(f'No valid grid: {obs} {day}') from None
   time.sleep(2)
def build(end=LAST,cache_only=False):
 if not FIRST<=end<=LAST:raise ValueError("End date must be within the winter season")
 days=[FIRST+dt.timedelta(days=i) for i in range((end-FIRST).days+1)]
 key=rain.credential();records={};failed=[]
 if cache_only and any(not (CACHE/f'{o}-{d}.npz').exists() for d in days for o in ['sd_tot','sd_24h']):raise RuntimeError("Requested cache-only period has gaps")
 with concurrent.futures.ThreadPoolExecutor(3) as pool:
  tasks={pool.submit(fetch,d,o,key):(d,o) for d in days for o in ['sd_tot','sd_24h']}
  for i,f in enumerate(concurrent.futures.as_completed(tasks),1):
   try:records[tasks[f]]=f.result()
   except RuntimeError:failed.append(tasks[f]);print('Missing',tasks[f],flush=True)
   if i%20==0 or i==len(tasks):print(f'Collected {i}/{len(tasks)} snow grids',flush=True)
 if failed:raise RuntimeError(f'{len(failed)} grids missing; completed samples remain cached')
 groups={}
 for day in days:groups.setdefault(day-dt.timedelta(days=day.weekday()),[]).append(day)
 cells=np.fromfile(rain.ROOT/'data/korea.rain.cells.bin',dtype='<u4')
 template=json.loads((rain.ROOT/'data/korea.rain.json').read_text())
 for mode,obs in [('mean','sd_tot'),('max','sd_24h')]:
  frames=[];weeks=[]
  for dates in groups.values():
   a=np.stack([records[(d,obs)][0].ravel()[cells] for d in dates])
   # -99.90 is the server's missing sentinel; negative MQ overshoot for depth
   # and negative 24h changes (melting/settling) are zero in these positive metrics.
   valid=(~np.isclose(a,-99.9))&(a>-900);complete=valid.all(axis=0)
   positive=np.maximum(a,0)
   values=positive.mean(axis=0) if mode=='mean' else positive.max(axis=0)
   packed=np.full(len(cells),65535,dtype='<u2')
   if np.any(values[complete]*10>=65535):raise ValueError('Snow exceeds encoding range')
   packed[complete]=np.rint(values[complete]*10).astype('<u2');frames.append(packed)
   v=values[complete]
   weeks.append(dict(start=str(dates[0]),end=str(dates[-1]),days=len(dates),meanCm=round(float(v.mean()),2) if len(v) else None,maxCm=round(float(v.max()),2) if len(v) else None,validCells=int(complete.sum()),missingCells=int((~complete).sum())))
  meta=dict(season='2025–26',year=2025,requestedThrough=str(LAST),through=str(end),complete=end==LAST,mode=mode,unit='cm',scale=.1,nodata=65535,cellCount=len(cells),frameCount=len(weeks),weeks=weeks,grid=template['grid'],source=dict(name='기상청 AWS 객관분석',url=template['source']['url'],codebook='https://apihub.kma.go.kr/getAttachFile.do?fileName=sfc_obs_list.pdf',endpoint=rain.ENDPOINT,obs=obs,method='mq',sampleTime='09:00 KST daily',stationCountRange=[min(records[(d,obs)][1] for d in days),max(records[(d,obs)][1] for d in days)]),aggregation='mean of daily 09:00 snow depth samples' if mode=='mean' else 'maximum of daily 09:00 positive 24h snow-depth changes; not continuous-time maximum or accumulated new snowfall',processing='missing sentinel preserved; any missing day makes cell-week missing; negative interpolated depth/change clipped to zero')
  base=rain.ROOT/f'data/korea.snow.2025-26.{mode}'
  base.with_suffix(base.suffix+'.bin').write_bytes(np.stack(frames).astype('<u2').tobytes())
  base.with_suffix(base.suffix+'.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':'))+'\n')
  print(mode,'weeks',len(weeks),'max cm',max(w['maxCm'] for w in weeks),flush=True)
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--end',type=dt.date.fromisoformat,default=LAST);parser.add_argument('--cache-only',action='store_true');args=parser.parse_args();build(args.end,args.cache_only)
