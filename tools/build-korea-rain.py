"""Build KMA weekly rainfall for a selected year. Requires numpy/Pillow; key stays outside repo.
AWS objective analysis, directly requested at 2 km in WGS84 LCC, D3 map.
Each following-day 00:00 KST rn_day snapshot is the preceding calendar day's
accumulated rain (the counter resets after midnight). Never sum 5-minute running totals.
"""
import argparse, concurrent.futures, datetime as dt, json, math, os, re, subprocess, tempfile, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(tempfile.gettempdir())/'korea-rain-build';CACHE.mkdir(exist_ok=True)
ENDPOINT='https://apihub.kma.go.kr/api/typ01/cgi-bin/aws/nph-aws_min_obj'
NX=NY=341;GRID=2;SX=154;SY=580;NODATA=65535
# WGS84 ellipsoidal Lambert conformal conic, matching KMA station grid coordinates.
E=math.sqrt(1-(1-1/298.257223563)**2);A=6378.137
P1,P2,P0=np.radians([30,60,38])
def tt(p):return np.tan(np.pi/4-p/2)/((1-E*np.sin(p))/(1+E*np.sin(p)))**(E/2)
def mm(p):return np.cos(p)/np.sqrt(1-E*E*np.sin(p)**2)
N=math.log(mm(P1)/mm(P2))/math.log(tt(P1)/tt(P2));F=mm(P1)/(N*tt(P1)**N);R0=A*F*tt(P0)**N
def project(lon,lat):
 rho=A*F*tt(np.radians(lat))**N;theta=N*np.radians(np.asarray(lon)-126)
 return (rho*np.sin(theta)+SX)/GRID,(R0-rho*np.cos(theta)+SY)/GRID

def credential():
 key=os.environ.get('KMA_API_KEY') or os.environ.get('kma_api')
 if key:return key
 p=Path.home()/'.env'
 if p.exists():
  for line in p.read_text().splitlines():
   if '=' in line and line.split('=',1)[0].strip().removeprefix('export ') in ('kma_api','KMA_API_KEY'):
    return line.split('=',1)[1].strip().strip('\"\'')
 raise RuntimeError('Set kma_api in ~/.env or KMA_API_KEY in the environment.')

def parse_grid(raw):
 text=raw.decode('cp949',errors='replace')
 match=re.match(r'NX\s*=\s*(\d+), NY\s*=\s*(\d+), STN#\s*=\s*(\d+)',text)
 if not match:raise ValueError('KMA returned no grid (check API subscription, quota or service status).')
 if tuple(map(int,match.group(1,2)))!=(NX,NY):raise ValueError('Unexpected grid dimensions')
 body=' '.join(l for l in text.splitlines()[1:] if not l.startswith('!'))
 values=np.fromstring(body.replace(',',' '),sep=' ')
 if len(values)!=NX*NY or not np.isfinite(values).all():raise ValueError('Truncated or invalid grid')
 return values.reshape(NY,NX).astype(np.float32),int(match.group(3))

def daily(day,key):
 path=CACHE/(day.isoformat()+'.npz')
 if path.exists():
  with np.load(path) as d:return day,d['rain'],int(d['stations'])
 from urllib.parse import urlencode
 for attempt in range(4):
  # KMA accepts both representations of midnight; verified identical wet-day grids.
  tm=(day+dt.timedelta(days=1)).strftime('%Y%m%d0000') if attempt%2==0 else day.strftime('%Y%m%d2400')
  params=dict(obs='rn_day',tm=tm,obj='mq',map='D3',grid=2,stn=int(attempt>=2),authKey=key)
  url=ENDPOINT+'?'+urlencode(params)
  # Pass the credential on stdin, never in argv, logs, browser code or output metadata.
  config='url = "'+url+'"\nsilent\nshow-error\nmax-time = 60\n'
  r=subprocess.run(['curl','--config','-'],input=config.encode(),capture_output=True)
  try:
   if r.returncode:raise ValueError('KMA request did not complete')
   rain,stations=parse_grid(r.stdout)
   if stations<100:raise ValueError('Too few source stations')
   np.savez_compressed(path,rain=rain,stations=stations)
   return day,rain,stations
  except ValueError:
   if attempt==3:raise RuntimeError(f'Could not collect {day}; completed days remain cached.') from None
   time.sleep(2*(attempt+1))

def south_mask():
 p=Path(tempfile.gettempdir())/'korea-atlas-build'/'countries.json'
 if not p.exists():
  p=CACHE/'countries.json'
  if not p.exists():subprocess.run(['curl','-fsSL','https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson','-o',str(p)],check=True)
 countries=json.loads(p.read_text());mask=Image.new('L',(NX,NY));draw=ImageDraw.Draw(mask)
 feature=next(f for f in countries['features'] if f['properties']['ADMIN']=='South Korea')
 polygons=feature['geometry']['coordinates']
 if feature['geometry']['type']=='Polygon':polygons=[polygons]
 for polygon in polygons:
  for i,ring in enumerate(polygon):
   draw.polygon([tuple(map(float,project(lon,lat))) for lon,lat in ring],fill=255 if i==0 else 0)
 return np.asarray(mask)>0

def build(year=2025,workers=3,end=None):
 first=dt.date(year,1,1)
 today=dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
 last=min(dt.date(year,12,31),today-dt.timedelta(days=1),end or dt.date(year,12,31))
 if last<first:raise ValueError("No complete days available for this year")
 days=[first+dt.timedelta(days=i) for i in range((last-first).days+1)]
 mask=south_mask();key=credential();records={};failed=[]
 with concurrent.futures.ThreadPoolExecutor(workers) as pool:
  futures={pool.submit(daily,d,key):d for d in days}
  for i,future in enumerate(concurrent.futures.as_completed(futures),1):
   try:
    day,rain,stations=future.result();records[day]=(rain,stations)
   except RuntimeError:
    failed.append(futures[future]);print(f'No valid grid: {futures[future]}',flush=True)
   if i%15==0 or i==len(days):print(f'Collected {i}/{len(days)} days',flush=True)
 if failed:raise RuntimeError(f'Missing {len(failed)} days: '+', '.join(map(str,sorted(failed))))
 # Monday-Sunday weeks clipped to this calendar year. Short boundary weeks are labelled.
 groups={}
 for day in days:groups.setdefault(day-dt.timedelta(days=day.weekday()),[]).append(day)
 indices=np.flatnonzero(mask).astype('<u4');frames=[];weeks=[]
 for week,dates in groups.items():
  stack=np.stack([records[d][0] for d in dates]);valid=stack>=0
  complete=valid.all(axis=0)&mask
  total=np.where(valid,stack,0).sum(axis=0)
  encoded=np.full(mask.shape,NODATA,dtype='<u2')
  if np.any(total[complete]*10>=NODATA):raise ValueError('Weekly rainfall exceeds uint16 range')
  encoded[complete]=np.rint(total[complete]*10).astype('<u2')
  frame=encoded.ravel()[indices];frames.append(frame)
  vals=total[complete]
  weeks.append(dict(start=dates[0].isoformat(),end=dates[-1].isoformat(),days=len(dates),maxMm=round(float(vals.max()),1) if len(vals) else None,meanMm=round(float(vals.mean()),1) if len(vals) else None,validCells=int(complete.sum()),missingCells=int(mask.sum()-complete.sum())))
 packed=np.stack(frames).astype('<u2');packed.tofile(ROOT/f'data/korea.rain.{year}.bin');indices.tofile(ROOT/'data/korea.rain.cells.bin')
 meta=dict(year=year,through=last.isoformat(),unit='mm/week',scale=.1,nodata=NODATA,cellCount=len(indices),frameCount=len(weeks),weeks=weeks,grid=dict(width=NX,height=NY,spacingKm=GRID,originXKm=SX,originYKm=SY,order='rows south to north, columns west to east',projection='+proj=lcc +lat_1=30 +lat_2=60 +lat_0=38 +lon_0=126 +ellps=WGS84 +units=km'),source=dict(name='기상청 AWS 객관분석',url='https://apihub.kma.go.kr/apiList.do?seqApi=2&seqApiSub=248',endpoint=ENDPOINT,obs='rn_day',map='D3',method='mq',timeZone='Asia/Seoul',dailySample='next calendar day 00:00 KST (equivalent day-end 24:00 accepted on retry)',stationCountRange=[min(s for a,s in records.values()),max(s for a,s in records.values())],landMask='Natural Earth 1:10m South Korea; cell centres approximated by raster mask'),aggregation='sum of complete daily accumulations; any missing day makes that cell-week missing; no temporal interpolation')
 (ROOT/('data/korea.rain.json' if year==2025 else f'data/korea.rain.{year}.json')).write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':'))+'\n')
 print(json.dumps(dict(cells=len(indices),frames=len(weeks),valueBytes=packed.nbytes,indexBytes=indices.nbytes,maxMm=max(w['maxMm'] for w in weeks)),ensure_ascii=False),flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--workers',type=int,default=3);parser.add_argument('--year',type=int,default=2025);parser.add_argument('--end',type=dt.date.fromisoformat);args=parser.parse_args()
 build(year=args.year,workers=args.workers,end=args.end)
