"""WorldPop Global2 2025 UN-adjusted KOR/PRK counts -> 0.05° density cells.
Requires numpy/Pillow. Source pixels are assigned by centre; all valid counts
are conserved. Density denominator is the full geographic bin (including water),
not just inhabited/land pixels. NoData pixels contribute no population.
"""
import json, math, subprocess, tempfile
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
CACHE=Path(tempfile.gettempdir())/'seoul-population'; CACHE.mkdir(exist_ok=True)
BASE='https://worldpop-public-data.soton.ac.uk/GIS/Population/Global_2015_2030/R2025A/2025/'
STEP=.05
bins={}; totals={}; sources=[]
for country in ['kor','prk']:
 url=f'{BASE}{country.upper()}/v1/1km_ua/constrained/{country}_pop_2025_CN_1km_R2025A_UA_v1.tif';sources.append(url)
 path=CACHE/f'{country}_2025_R2025A_UA_v1.tif'
 if not path.exists(): subprocess.run(['curl','-fLsS','--retry','3',url,'-o',str(path)],check=True)
 im=Image.open(path); a=np.array(im,dtype=np.float64)
 dx,dy,_=im.tag_v2[33550]; west,north=im.tag_v2[33922][3:5]
 rows,cols=np.where(np.isfinite(a)&(a>=0)); values=a[rows,cols];totals[country]=float(values.sum())
 xs=np.floor((west+(cols+.5)*dx)/STEP).astype(int)
 ys=np.floor((north-(rows+.5)*dy)/STEP).astype(int)
 for x,y,n in zip(xs,ys,values):bins[(int(x),int(y))]=bins.get((int(x),int(y)),0)+float(n)
cells=[]
for (x,y),count in sorted(bins.items()):
 if count<=0: continue
 area=6371.0088**2*math.radians(STEP)*(math.sin(math.radians((y+1)*STEP))-math.sin(math.radians(y*STEP)))
 cells.append([round((x+.5)*STEP,5),round((y+.5)*STEP,5),round(count/area,3)])
meta=dict(year=2025,source='WorldPop Global2 R2025A v1, constrained, UN-adjusted',sources=sources,license='https://creativecommons.org/licenses/by/4.0/',stepDegrees=STEP,unit='people/km²',densityArea='full spherical grid-cell area, including water',aggregation='source-pixel centre assigned to 0.05-degree bin; counts summed',countryPopulation=totals,heightScale='linear',columns=['longitude','latitude','density'])
assert abs(sum(bins.values())-sum(totals.values()))<.01
out=ROOT/'data/korea.population.json';out.write_text(json.dumps(dict(meta=meta,cells=cells),separators=(',',':'))+'\n')
print(len(cells),'cells;',out.stat().st_size,'bytes;',totals,'max density',max(c[2] for c in cells))
