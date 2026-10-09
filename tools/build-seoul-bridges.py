"""Build one label per Han River bridge from named OSM bridge spans."""
import concurrent.futures, datetime, json, math, pathlib, subprocess, tempfile
import xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parent.parent
CACHE=pathlib.Path(tempfile.gettempdir())/'seoul-bridge-sources';CACHE.mkdir(exist_ok=True)
NAMES=set('행주대교 방화대교 마곡철교 가양대교 월드컵대교 성산대교 양화대교 당산철교 서강대교 마포대교 원효대교 한강철교 한강대교 동작대교 반포대교 잠수교 한남대교 동호대교 성수대교 영동대교 청담대교 잠실대교 잠실철교 올림픽대교 천호대교 광진교 구리암사대교 강동대교 고덕토평대교'.split())
CENTERS=[(126.824,37.597),(126.856,37.575),(126.884,37.563),(126.911,37.545),(126.939,37.529),(126.975,37.519),(127.006,37.527),(127.039,37.536),(127.076,37.527),(127.108,37.533),(127.13,37.55),(127.15,37.57),(127.169,37.576),(127.19,37.581)]
def read(center):
 x,y=center;p=CACHE/f'{x}-{y}.xml'
 if not p.exists():
  root=ET.Element('osm')
  # Small retrieval boxes avoid OSM API response limits in dense Seoul districts.
  for dx in [-.009,.009]:
   for dy in [-.007,.007]:
    cx,cy=x+dx,y+dy;q=CACHE/f'{cx:.6f}-{cy:.6f}-small.xml'
    if not q.exists():
     url=f'https://www.openstreetmap.org/api/0.6/map?bbox={cx-.009:.6f},{cy-.007:.6f},{cx+.009:.6f},{cy+.007:.6f}'
     r=subprocess.run(['curl','--fail','-L','-sS','--retry','1','--max-time','60',url],capture_output=True,check=True);q.write_bytes(r.stdout)
    root.extend(ET.parse(q).getroot())
  ET.ElementTree(root).write(p,encoding='utf-8')
 return ET.parse(p).getroot()
ways={}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for root in pool.map(read,CENTERS):
  nodes={n.attrib['id']:(float(n.attrib['lon']),float(n.attrib['lat'])) for n in root.findall('node')}
  for w in root.findall('way'):
   tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')};name=tags.get('bridge:name:ko',tags.get('bridge:name',tags.get('name:ko',tags.get('name','')))).split(' (')[0]
   if name=='마곡대교':name='마곡철교'
   if name.startswith('한강철교'):name='한강철교'
   if name not in NAMES or (tags.get('bridge','no')=='no' and tags.get('man_made')!='bridge'):continue
   pts=[nodes[n.attrib['ref']] for n in w.findall('nd') if n.attrib['ref'] in nodes]
   ways[w.attrib['id']]=(name,pts)
acc={}
for wid,(name,pts) in ways.items():
 if name=='잠수교':name='반포대교'
 a=acc.setdefault(name,dict(x=0,y=0,length=0,ways=[]));a['ways'].append(wid)
 for p,q in zip(pts,pts[1:]):
  length=math.hypot((p[0]-q[0])*88000,(p[1]-q[1])*111320)
  a['x']+=(p[0]+q[0])/2*length;a['y']+=(p[1]+q[1])/2*length;a['length']+=length
pois=[]
for name,a in acc.items():
 if not a['length']:continue
 lon=a['x']/a['length'];lat=a['y']/a['length']
 if not (126.74<lon<127.2 and 37.41<lat<37.7):continue
 pois.append(dict(id='han-bridge:'+name,name='반포대교·잠수교' if name=='반포대교' else name,category='bridge',tier=1,lon=round(lon,7),lat=round(lat,7),osmWays=a['ways']))
pois.sort(key=lambda p:p['lon'])
result=dict(source='© OpenStreetMap contributors / 서울시 한강상 교량 현황',sourceUrl='https://news.seoul.go.kr/safe/archives/29950',license='ODbL',checkedAt=str(datetime.date.today()),pois=pois)
(ROOT/'data/seoul.bridges.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(len(pois),[p['name'] for p in pois]);print('Not found:',sorted(NAMES-set(acc)-{'잠수교'}))
