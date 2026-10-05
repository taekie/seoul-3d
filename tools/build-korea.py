"""Build a self-contained, coarse Korean peninsula relief. Requires Pillow and numpy.
Sources: Natural Earth 1:10m (public domain), AWS/Mapzen Terrarium DEM z8.
Downloads are cached outside the repository; no browser-time DEM tile downloads.
"""
import concurrent.futures, json, math, subprocess, tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(tempfile.gettempdir())/'korea-atlas-build'; CACHE.mkdir(exist_ok=True)
BASE='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
SOURCES={
 'countries':BASE+'ne_10m_admin_0_countries.geojson',
 'rivers':BASE+'ne_10m_rivers_lake_centerlines.geojson',
 'places':BASE+'ne_10m_populated_places_simple.geojson',
 'elevation':'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
}
def get(url,name):
 path=CACHE/name
 if not path.exists():
  subprocess.run(['curl','-fsSL','--retry','3','--max-time','60',url,'-o',str(path)+'.tmp'],check=True)
  Path(str(path)+'.tmp').rename(path)
 return path

def tx(lon): return (lon+180)/360

def ty(lat): return (1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2

bbox=[124.0,32.7,132.1,43.1]; center=[127.7,38.0]; kx=40075016.686*math.cos(math.radians(center[1]))
x0,x1=tx(bbox[0]),tx(bbox[2]); y0,y1=ty(bbox[3]),ty(bbox[1]); W=769; H=round((y1-y0)/(x1-x0)*(W-1))+1
Z=8; N=2**Z
ix0,ix1=math.floor(x0*N),math.floor(x1*N); iy0,iy1=math.floor(y0*N),math.floor(y1*N)

def tile(job):
 x,y=job
 path=get(SOURCES['elevation'].format(z=Z,x=x,y=y),f'dem-{Z}-{x}-{y}.png')
 a=np.asarray(Image.open(path).convert('RGB'),dtype=np.float32)
 return x,y,a[:,:,0]*256+a[:,:,1]+a[:,:,2]/256-32768

mosaic=np.zeros(((iy1-iy0+1)*256,(ix1-ix0+1)*256),dtype=np.float32)
jobs=[(x,y) for x in range(ix0,ix1+1) for y in range(iy0,iy1+1)]
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
 for i,(x,y,a) in enumerate(pool.map(tile,jobs)):
  mosaic[(y-iy0)*256:(y-iy0+1)*256,(x-ix0)*256:(x-ix0+1)*256]=a
  print(f'DEM {i+1}/{len(jobs)}',flush=True)
# Sample exactly at mesh vertices; both geographic endpoints are retained.
xs=np.linspace((x0*N-ix0)*256,(x1*N-ix0)*256,W)
ys=np.linspace((y0*N-iy0)*256,(y1*N-iy0)*256,H)
xx,yy=np.meshgrid(xs,ys); ix=np.floor(xx).astype(int); iy=np.floor(yy).astype(int); fx=xx-ix; fy=yy-iy
heights=(mosaic[iy,ix]*(1-fx)+mosaic[iy,ix+1]*fx)*(1-fy)+(mosaic[iy+1,ix]*(1-fx)+mosaic[iy+1,ix+1]*fx)*fy

countries=json.loads(get(SOURCES['countries'],'countries.json').read_text())
mask=Image.new('L',(W,H));draw=ImageDraw.Draw(mask)
for f in countries['features']:
 if f['properties']['ADM0_A3'] not in ['KOR','PRK']:continue
 polygons=f['geometry']['coordinates'] if f['geometry']['type']=='MultiPolygon' else [f['geometry']['coordinates']]
 for polygon in polygons:
  for i,ring in enumerate(polygon):
   pts=[((tx(lon)-x0)/(x1-x0)*(W-1),(ty(lat)-y0)/(y1-y0)*(H-1)) for lon,lat,*_ in ring]
   draw.polygon(pts,fill=255 if i==0 else 0)
land=np.asarray(mask)>0
# Preserve low coastal plains; ocean vertices are hidden underneath the water plane.
heights=np.where(land,np.maximum(4,heights),-500).round().astype('<i2')
(ROOT/'data/korea.terrain.bin').write_bytes(heights.tobytes())

river_names={'Han':'한강','Namhan':'남한강','Nakdong':'낙동강','Yalu':'압록강','Tumen':'두만강'}
rivers=[]
for f in json.loads(get(SOURCES['rivers'],'rivers.json').read_text())['features']:
 name=f['properties'].get('name_en') or f['properties'].get('name')
 if name not in river_names:continue
 lines=f['geometry']['coordinates'] if f['geometry']['type']=='MultiLineString' else [f['geometry']['coordinates']]
 for line in lines:
  if not any(bbox[0]<=a<=bbox[2] and bbox[1]<=b<=bbox[3] for a,b,*_ in line):continue
  rivers.append({'name':river_names[name],'points':[[round(a,5),round(b,5)] for a,b,*_ in line]})

names={'Seoul':'서울','Busan':'부산','Jeju':'제주','Pyongyang':'평양','Daejeon':'대전','Gwangju':'광주','Daegu':'대구','Gangneung':'강릉','Mokpo':'목포','Wonsan':'원산','Hamhung':'함흥','Chongjin':'청진','Sinuiju':'신의주','Kaesong':'개성','Hyeson':'혜산','Incheon':'인천','Jeonju':'전주','Pohang':'포항'}
places=[]
for f in json.loads(get(SOURCES['places'],'places.json').read_text())['features']:
 p=f['properties']; name=p.get('name')
 if p.get('adm0name') not in ['South Korea','North Korea'] or name not in names:continue
 lon,lat=f['geometry']['coordinates']
 places.append({'id':name.lower(),'name':names[name],'en':name.upper(),'lon':lon,'lat':lat,'kind':'city','priority':3 if name in ['Seoul','Busan','Jeju','Pyongyang','Chongjin'] else 1,'desc':'주변 산과 해안선을 둘러보세요.','cam':[210000,.95],**({'detailCity':name.lower(),'desc':'이름을 누르면 상세 미니어처 지도로 이동합니다.'} if name in ['Seoul','Jeju'] else {})})
places.sort(key=lambda p:(-p['priority'], -p['lat']))
meta={'center':center,'bbox':bbox,'kx':kx,'grid':{'width':W,'height':H,'minX':(x0-tx(center[0]))*kx,'maxX':(x1-tx(center[0]))*kx,'minY':-(y1-ty(center[1]))*kx,'maxY':-(y0-ty(center[1]))*kx},'relief':8,'demZoom':Z,'sea':True}
out={'meta':meta,'places':places,'rivers':rivers,'sources':SOURCES,'note':'Natural Earth의 남북한 육지 범위를 합친 개괄 모형. 작은 섬·해안선·하천은 축척에 따라 생략되며 경계 표시는 하지 않습니다.'}
(ROOT/'data/korea.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Built {W}×{H}, {len(places)} places, {len(rivers)} river lines; {heights.nbytes/1024:.0f} KiB DEM')
