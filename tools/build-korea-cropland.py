"""ESA WorldCover 2021 class 40 -> 0.005° cropland fraction, clipped to KOR/PRK.
Requires rasterio, numpy, Pillow. Native 10m pixels are counted (no categorical
COG overviews). Source downloads/aggregates stay in the OS temporary cache.
"""
import concurrent.futures, json, math, subprocess, tempfile
from pathlib import Path
import numpy as np
import rasterio
from rasterio.windows import Window
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(tempfile.gettempdir())/'korea-cropland';CACHE.mkdir(exist_ok=True)
SOURCE='https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/'
meta=json.loads((ROOT/'data/korea.json').read_text())['meta']
w,s,e,n=meta['bbox'];STEP=.005;W=round((e-w)/STEP);H=round((n-s)/STEP)
country_file=Path(tempfile.gettempdir())/'korea-atlas-build/countries.json'
if not country_file.exists():
 country_file=CACHE/'countries.json'
 if not country_file.exists():subprocess.run(['curl','-fLsS','--retry','3','https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson','-o',str(country_file)],check=True)
mask=Image.new('L',(W,H));draw=ImageDraw.Draw(mask)
for f in json.loads(country_file.read_text())['features']:
 if f['properties']['ADM0_A3'] not in ['KOR','PRK']:continue
 polys=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
 for poly in polys:
  for i,ring in enumerate(poly):draw.polygon([((lon-w)/STEP,(n-lat)/STEP) for lon,lat,*_ in ring],fill=255 if i==0 else 0)
land=np.asarray(mask)>0
# Tile jobs retain only the rectangular bounds needed by the country mask.
jobs=[]
for lat in range(33,43,3):
 for lon in range(123,133,3):
  gx0=max(0,round((lon-w)/STEP));gx1=min(W,round((lon+3-w)/STEP));gy0=max(0,round((n-lat-3)/STEP));gy1=min(H,round((n-lat)/STEP))
  if gx0>=gx1 or gy0>=gy1:continue
  yy,xx=np.where(land[gy0:gy1,gx0:gx1]);
  if not len(xx):continue
  a,b=gx0+int(xx.min()),gx0+int(xx.max())+1;c,d=gy0+int(yy.min()),gy0+int(yy.max())+1
  jobs.append((lon,lat,a,b,c,d))
def process(job):
 lon,lat,a,b,c,d=job;tile=f'N{lat:02d}E{lon:03d}';name=f'ESA_WorldCover_10m_2021_v200_{tile}_Map.tif';url=SOURCE+name
 agg=CACHE/f'{tile}-{a}-{b}-{c}-{d}.npz'
 if agg.exists():out=np.load(agg);return job,out['fraction'],url
 path=CACHE/name
 if not path.exists():
  print(f'Download {tile}',flush=True);subprocess.run(['curl','-fLsS','--retry','3','--max-time','240',url,'-o',str(path)+'.tmp'],check=True);Path(str(path)+'.tmp').rename(path)
 with rasterio.open(path) as src:
  factor=round(STEP/src.res[0]);assert factor==60 and src.width==36000
  x0=round((w+a*STEP-lon)/src.res[0]);y0=round(((lat+3)-(n-c*STEP))/src.res[1]);cols=b-a;rows=d-c
  fractions=np.full((rows,cols),255,dtype=np.uint8)
  for start in range(0,rows,10):
   count=min(10,rows-start)
   # Native-sized window forces full-resolution decoding, avoiding mode/nearest overviews.
   raw=src.read(1,window=Window(x0,y0+start*factor,cols*factor,count*factor))
   assert raw.shape==(count*factor,cols*factor)
   crop=(raw==40).reshape(count,factor,cols,factor).sum(axis=(1,3),dtype=np.uint32)
   valid=(raw!=0).reshape(count,factor,cols,factor).sum(axis=(1,3),dtype=np.uint32)
   good=valid==factor*factor
   part=np.rint(crop/(factor*factor)*100).astype(np.uint8);part[~good]=255;fractions[start:start+count]=part
  np.savez_compressed(agg,fraction=fractions)
 print(f'Aggregated {tile} ({path.stat().st_size/1e6:.1f} MB source)',flush=True)
 return job,fractions,url
out=np.full((H,W),255,dtype=np.uint8);sources=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for job,part,url in pool.map(process,jobs):
  lon,lat,a,b,c,d=job;out[c:d,a:b]=part;sources.append(url)
out[~land]=255
assert np.sum((out<=100)&land)>land.sum()*.99,'Missing coverage in country mask'
assert np.sum((out>0)&(out<=100))>1000
# Match the relief's Mercator plane; nearest resampling preserves percent values.
tw=1536;th=round(tw*(meta['grid']['maxY']-meta['grid']['minY'])/(meta['grid']['maxX']-meta['grid']['minX']))
merc=lambda lat:math.asinh(math.tan(math.radians(lat)))
ys=np.linspace(merc(n),merc(s),th,endpoint=False)+(merc(s)-merc(n))/(2*th)
lats=np.degrees(np.arctan(np.sinh(ys)));ri=np.clip(((n-lats)/STEP).astype(int),0,H-1);ci=np.clip(((np.arange(tw)+.5)/tw*W).astype(int),0,W-1)
texture=out[ri[:,None],ci[None,:]]
# Coarse relief coastline is authoritative for rendering; erase samples on its ocean vertices.
terrain=np.fromfile(ROOT/'data/korea.terrain.bin',dtype='<i2').reshape(meta['grid']['height'],meta['grid']['width'])
ty=np.clip(np.rint((np.arange(th)+.5)/th*(terrain.shape[0]-1)).astype(int),0,terrain.shape[0]-1);tx=np.clip(np.rint((np.arange(tw)+.5)/tw*(terrain.shape[1]-1)).astype(int),0,terrain.shape[1]-1)
texture[terrain[ty[:,None],tx[None,:]]<0]=255
Image.fromarray(texture).save(ROOT/'data/korea.cropland.png',optimize=True)
info={'year':2021,'source':'ESA WorldCover 2021 v200','sourceURL':'https://esa-worldcover.org/en/data-access','doi':'https://doi.org/10.5281/zenodo.7254221','license':'https://creativecommons.org/licenses/by/4.0/','attribution':'© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium','sources':sources,'class':40,'classDefinition':'Annual herbaceous cropland; woody perennial crops and greenhouses are not included','nativeResolution':'10 m','stepDegrees':STEP,'unit':'percent of full geographic cell area classified as cropland','aggregation':'Count class 40 native pixels in each 60×60 block; divide by 3600; round percent. Cells with any NoData remain NoData. No COG overviews used.','projection':'Mercator texture aligned to korea.json bbox; nearest resampled from 0.005 degree fraction grid','bounds':meta['bbox'],'texture':{'width':tw,'height':th,'nodata':255},'countryMask':'Natural Earth 1:10m KOR/PRK, clipped further to overview relief coastline','displayCaveat':'Coarse regional comparison, not parcel boundaries or an urban development suitability map','validCells':int((out<=100).sum())}
(ROOT/'data/korea.cropland.json').write_text(json.dumps(info,ensure_ascii=False,indent=2)+'\n')
print(f'DONE {len(jobs)} tiles; texture {(ROOT/"data/korea.cropland.png").stat().st_size:,} bytes; valid cells {info["validCells"]}',flush=True)
