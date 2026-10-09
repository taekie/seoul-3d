"""Official subway line badges + OSM large apartment labels, without credentials.
Usage: python3 tools/build-seoul-label-details.py
Downloads stay in the OS temporary directory; the app loads only the final JSON.
"""
import concurrent.futures, datetime, json, math, pathlib, re, subprocess, tempfile
import xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parent.parent
CACHE=pathlib.Path(tempfile.gettempdir())/'seoul-label-sources';CACHE.mkdir(exist_ok=True)
def download(url,path):
    if not path.exists():
        r=subprocess.run(['curl','--fail','-L','-sS','--retry','2','--max-time','75',url],capture_output=True,check=True)
        path.write_bytes(r.stdout)
    return path.read_text()
url='https://www.seoulmetro.co.kr/kr/getLineData.do'
s=download(url,CACHE/'metro-lines.js');s=s[s.index('{'):].strip().rstrip(';')
s=re.sub(r'/\*.*?\*/','',s,flags=re.S);s=re.sub(r'(?m)^\s*//.*$','',s);s=re.sub(r',\s*([}\]])',r'\1',s)
lines=json.loads(s);base=json.loads((ROOT/'data/seoul.pois.json').read_text())['pois'];by_name={}
for line in lines.values():
    name=line['attr']['data-label'];color=line['attr']['data-color']
    if name=='한강버스':continue
    label=name.replace('호선','') if re.fullmatch('[1-9]호선',name) else {'경의·중앙선':'경의중앙','우이신설경전철':'우이신설','수인분당선':'수인분당','공항철도':'공항','신분당선':'신분당','김포골드라인':'김포','의정부경전철':'의정부'}.get(name,name)
    for p in line['stations']:
        station=p.get('station-nm','').strip()
        if not station:continue
        station=re.sub(r'\s*\(.*','',station)
        if not station.endswith('역'):station+='역'
        badges=by_name.setdefault(station,[])
        if not any(b['name']==name for b in badges):badges.append(dict(label=label,name=name,color=color))
pois=[]
for p in base:
    if p['category']=='station' and p['name'] in by_name:
        pois.append({**p,'lines':sorted(by_name[p['name']],key=lambda l:(not l['label'].isdigit(),int(l['label']) if l['label'].isdigit() else l['label']))})
# Retrieval boxes only; final coordinates and areas come from actual OSM polygons.
centers=[(127.10,37.51),(127.09,37.514),(127.109,37.518),(127.14,37.523),(127.105,37.495),(127.053,37.492),(127.003,37.506),(126.993,37.515),(127.024,37.528),(126.885,37.53),(127.077,37.651),(127.074,37.63),(126.913,37.554),(127.031,37.55),(127.064,37.565),(127.047,37.551),(127.152,37.555),(126.926,37.52)]
def get_box(center):
    x,y=center;path=CACHE/f'osm-{x}-{y}.xml'
    return ET.fromstring(download(f'https://api.openstreetmap.org/api/0.6/map?bbox={x-.009},{y-.008},{x+.009},{y+.008}',path))
nodes={};ways={};relations={}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for root in pool.map(get_box,centers):
        for p in root:
            if p.tag=='node':nodes[p.get('id')]=(float(p.get('lon')),float(p.get('lat')))
            elif p.tag=='way':ways[p.get('id')]=p
            elif p.tag=='relation':relations[p.get('id')]=p
apartments=[]
for p in list(ways.values())+list(relations.values()):
    t={a.get('k'):a.get('v') for a in p.findall('tag')};name=t.get('name:ko',t.get('name',''))
    if t.get('landuse')!='residential' or not name:continue
    if t.get('residential')!='apartments' and not re.search('아파트|단지|래미안|자이|힐스테이트|리센츠|엘스|파크리오|헬리오|포레온|트리지움|아이파크|푸르지오|롯데캐슬|e편한|아크로',name):continue
    rings=[p] if p.tag=='way' else [ways[m.get('ref')] for m in p.findall('member') if m.get('type')=='way' and m.get('role')=='outer' and m.get('ref') in ways]
    polygons=[]
    for ring in rings:
        refs=[n.get('ref') for n in ring.findall('nd')]
        if refs and refs[0]==refs[-1] and all(r in nodes for r in refs):polygons.append([nodes[r] for r in refs])
    if not polygons:continue
    points=[pt for ring in polygons for pt in ring];ox,oy=points[0];area=0
    for ring in polygons:
        area+=abs(sum((a[0]-ox)*(b[1]-oy)-(b[0]-ox)*(a[1]-oy) for a,b in zip(ring,ring[1:])))*111320**2*math.cos(math.radians(oy))/2
    households=int(t['flats']) if t.get('flats','').isdigit() else None
    if area<50000 or (households is not None and households<1000):continue
    lon=(min(p[0] for p in points)+max(p[0] for p in points))/2;lat=(min(p[1] for p in points)+max(p[1] for p in points))/2
    if any(q['name']==name and math.hypot((q['lon']-lon)*88000,(q['lat']-lat)*111320)<1000 for q in apartments):continue
    apartments.append(dict(id=f"osm-apartment:{p.tag}:{p.get('id')}",name=name,category='apartment',lon=round(lon,6),lat=round(lat,6),tier=2,footprintM2=round(area),sourceUrl=f"https://www.openstreetmap.org/{p.tag}/{p.get('id')}"))
# Prefer an overall complex label when both overall and numbered sub-complexes exist.
canonical=lambda name: re.sub(r'[\s·]|아파트','',name)
whole={canonical(p['name']) for p in apartments if not re.search(r'\d+단지$',canonical(p['name']))}
apartments=[p for p in apartments if not (re.search(r'\d+단지$',canonical(p['name'])) and re.sub(r'\d+단지$','',canonical(p['name'])) in whole)]
if not pois or not apartments:raise RuntimeError('Empty data; refusing to overwrite')
out=dict(source='서울교통공사 사이버스테이션 노선 정보 / © OpenStreetMap contributors',sourceUrl='https://www.seoulmetro.co.kr/kr/cyberStation.do',apartmentLicense='ODbL',checkedAt=datetime.date.today().isoformat(),apartmentCriteria='주요 주거지역에서 이름과 닫힌 아파트 단지 경계가 확인되며 면적 50,000m² 이상인 곳. 알려진 세대수가 1,000 미만이면 제외. 전체 단지 목록은 아님.',pois=pois+apartments)
(ROOT/'data/seoul.label-details.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(dict(stations=len(pois),apartments=len(apartments)))
