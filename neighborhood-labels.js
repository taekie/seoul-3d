import * as THREE from 'three';

const CATEGORIES={park:['공원','#4d9966'],university:['대학','#8d72b0'],station:['역','#4a93be'],culture:['문화시설','#c48256'],market:['시장','#bb765e'],mountain:['산·봉우리','#749365'],sight:['명소','#609a91'],beach:['해변·해수욕장','#45aaba'],hotel:['호텔','#a487bd'],department_store:['백화점','#cc8d69']};
const RANGE={1:7800,2:4600,3:2600};
const SEOUL_MOUNTAINS=/^(북한산|관악산|도봉산|아차산|인왕산|청계산|수락산|불암산|북악산|삼성산|남산)/;
Object.assign(CATEGORIES,{school:['학교','#728fc2'],supermarket:['마트','#b58a4d'],convenience:['편의점','#bd9461'],pharmacy:['약국','#6aa38c'],cafe:['카페','#ae826a'],restaurant:['음식점','#c58a70'],shop:['가게','#ad8caa'],neighborhood:['동네·주거단지','#739e94']});
const overlaps=(a,b)=>a.left<b.right+6&&a.right>b.left-6&&a.top<b.bottom+5&&a.bottom>b.top-5;
const normalName=name=>name.replace(/[\s·.]/g,'').toLowerCase();

export class NeighborhoodLabels {
  constructor(city,host,onSelect) {
    this.city=city;this.host=host;this.onSelect=onSelect;
    this.enabled=true;this.selected=null;this.grid=new Map();this.nodes=new Map();this.visible=new Set();this.nextLayout=0;
    this.projected=new THREE.Vector3();this.size=2000;
    this.measure=document.createElement('canvas').getContext('2d');this.measure.font='600 12px system-ui';
    this.landmarks=city.labelAnchors.map(a=>({id:'landmark:'+a.lm.id,name:a.lm.name,category:'landmark',tier:0,pos:a.pos.clone(),lm:a.lm}));
    this.stats={loaded:false,available:0,visible:0};
  }
  async load() {
    if (this.city.overview) { this.stats.loaded=true; return []; }
    try {
      const response=await fetch(`data/${this.city.cityId}.pois.json`);
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const data=await response.json();let places=[];
      if(this.city.cityId==='seoul'){
        try{const r=await fetch('data/seoul.places.json');if(!r.ok)throw new Error(`HTTP ${r.status}`);places=(await r.json()).pois;}
        catch(error){console.warn('District names unavailable:',error.message);}
      }
      this.setData([...data.pois,...places]);this.stats.loaded=true;return data.pois;
    } catch(error) {
      // The map and existing landmark labels remain usable without the optional layer.
      this.stats.error=String(error.message);
      document.querySelector('#tools [data-a=labels]').title='주변 장소를 불러오지 못했습니다. 새로고침하면 다시 시도합니다.';
      console.warn('Neighbourhood POIs unavailable:',error.message);
    }
  }
  setData(pois) {
    this.grid.clear();let count=0;
    const known=new Set(this.landmarks.flatMap(p=>[p.name,p.lm.en||p.name,...(p.lm.aliases||[])].map(normalName)));
    for(const p of pois) {
      if(!CATEGORIES[p.category]||!Number.isFinite(p.lon)||!Number.isFinite(p.lat)||known.has(normalName(p.name)))continue;
      const x=this.city.lonToX(p.lon),z=-this.city.latToY(p.lat);
      const entry={...p,pos:new THREE.Vector3(x,this.city.terrain.at(x,-z)*3+65,z)};
      if(this.city.cityId==='seoul'&&p.category==='mountain')entry.majorMountain=p.name.match(SEOUL_MOUNTAINS)?.[1];
      const key=Math.floor(x/this.size)+','+Math.floor(z/this.size);
      if(!this.grid.has(key))this.grid.set(key,[]);this.grid.get(key).push(entry);count++;
    }
    this.stats.available=count;this.nextLayout=0;
  }
  select(id) {this.selected=id;this.nextLayout=0;}
  setEnabled(enabled) {
    this.enabled=enabled;this.nextLayout=0;
    if(!enabled){this.visible.clear();for(const {el} of this.nodes.values()){el.style.opacity='0';el.style.pointerEvents='none';el.setAttribute('aria-hidden','true');el.tabIndex=-1;}this.stats.visible=0;}
  }
  candidates(distance) {
    if(this.city.overview){
      const population=this.city.population;
      if(population?.enabled)return [...this.landmarks.filter(p=>p.lm.kind==='city'),...population.regionalLabels(distance)];
      return this.landmarks.filter(p=>p.id===this.selected||distance<=(p.lm.showBelow??4000000));
    }
    const center=this.city.controls.target,near=distance<9000,seoul=this.city.cityId==='seoul';
    const all=this.landmarks.filter(p=>!near||Math.hypot(p.pos.x-center.x,p.pos.z-center.z)<Math.max(2500,distance*1.8));
    if(!near&&!seoul)return all;
    const radius=Math.min(seoul?45000:7000,Math.max(1600,distance*(seoul?1.2:.85)+700));
    for(let x=Math.floor((center.x-radius)/this.size);x<=Math.floor((center.x+radius)/this.size);x++)
      for(let z=Math.floor((center.z-radius)/this.size);z<=Math.floor((center.z+radius)/this.size);z++)
        for(const p of this.grid.get(x+','+z)||[]){
          let limit=RANGE[p.tier]??2600;
          if(seoul){
            if(p.placeClass==='borough'){if(distance<7500&&p.id!==this.selected)continue;limit=60000;}
            else if(p.placeClass)limit=14500;
            else if(p.majorMountain)limit=Infinity;
            else if(p.category==='park'&&p.tier===1)limit=18000;
            else if(p.category==='university'&&p.tier===1)limit=12000;
          }
          if(distance>limit*(this.visible.has(p.id)?1.12:1))continue;
          if(Math.hypot(p.pos.x-center.x,p.pos.z-center.z)>radius)continue;
          all.push(p);
        }
    if(seoul&&distance>=9000){
      // One representative per mountain; show the mountain name rather than every summit.
      const peaks=new Map();
      for(const p of all){if(!p.majorMountain)continue;const old=peaks.get(p.majorMountain);
        if(!old||p.pos.y>old.pos.y)peaks.set(p.majorMountain,p);
      }
      return all.filter(p=>!p.majorMountain||peaks.get(p.majorMountain)===p||p.id===this.selected);
    }
    return all;
  }
  screen(p,unshifted=false) {
    const v=this.projected.copy(p.pos).project(this.city.camera);
    if(v.z< -1||v.z>1||Math.abs(v.x)>1||Math.abs(v.y)>1)return null;
    const [dx,dy]=unshifted?[0,0]:(p.labelOffset||[0,0]);
    const x=(v.x*.5+.5)*innerWidth+dx,y=(-v.y*.5+.5)*innerHeight-14+dy;
    const width=Math.min(230,this.measure.measureText(p.labelName||p.name).width+(this.city.overview?40:p.category==='landmark'?24:39));
    return {x,y,left:x-width/2,right:x+width/2,top:y-(this.city.overview?23:27),bottom:y+(this.city.overview?2:14)};
  }
  node(p) {
    if(this.nodes.has(p.id)){const node=this.nodes.get(p.id);node.p=p;node.el.lastElementChild.textContent=(p.labelName||p.name)+(p.lm?.detailCity?' ↗':'');return node;}
    const el=document.createElement('button');el.type='button';el.className='label map-label'+(p.category==='landmark'?'':' poi-label');
    el.dataset.poiId=p.id;el.dataset.category=p.category;
    if(this.city.overview){
      el.dataset.category=p.lm.kind;
      el.classList.add('geography-label');
      if(p.lm.kind!=='city'){
        const icon=document.createElement('span');icon.textContent=p.lm.kind==='river'?'≈':'△';icon.setAttribute('aria-hidden','true');el.append(icon);
      }
    }
    if(p.category!=='landmark'){
      const dot=document.createElement('span');dot.className='poi-dot';dot.style.background=CATEGORIES[p.category][1];dot.setAttribute('aria-hidden','true');el.append(dot);
      el.title=CATEGORIES[p.category][0]+' · '+p.name;
    }
    const text=document.createElement('span');text.textContent=(p.labelName||p.name)+(p.lm?.detailCity?' ↗':'');el.append(text);
    if(p.lm?.detailCity)el.title=p.name+' 상세 미니어처 지도 열기';
    el.addEventListener('click',()=>{this.select(p.id);this.onSelect(p);});
    this.host.append(el);const node={el,p,lastSeen:0};this.nodes.set(p.id,node);return node;
  }
  update(now=performance.now()) {
    if(!this.enabled)return;
    // Theme rebuilds can recreate landmark anchors.
    const population=this.city.population;
    if(this.populationEnabled!==Boolean(population?.enabled)){
      this.populationEnabled=Boolean(population?.enabled);this.nextLayout=0;
    }
    this.landmarks.forEach((p,i)=>p.pos.copy(population?.labelPosition(p.lm)||this.city.labelAnchors[i].pos));
    const distance=this.city.camera.position.distanceTo(this.city.controls.target);
    if(now>=this.nextLayout) {
      this.nextLayout=now+120;
      const obstacles=[...document.querySelectorAll('#title,#panel,#place,#tools,#topbar,#time,#info-btn,#hint,#compass,#motion-controls,#motion-panel,#population-key,#rain-panel,#rail-panel,#crop-key')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').map(el=>el.getBoundingClientRect());
      const candidates=[];
      for(const p of this.candidates(distance)){
        p.labelName=distance>=9000&&p.majorMountain?p.majorMountain:p.name;
        if(!this.city.overview&&p.category==='landmark'&&this.city.camera.position.distanceTo(p.pos)>46000*this.city.scale)continue;
        const rect=this.screen(p,true);if(!rect||rect.left<8||rect.right>innerWidth-8||rect.top<8||rect.bottom>innerHeight-25)continue;
        const priority=p.id===this.selected?2000:distance>=9000&&p.majorMountain?1400:p.category==='landmark'?1000+(p.lm?.priority||0)*10:p.placeClass?500+(p.placeClass==='borough'?30:0):(4-p.tier)*30;
        const score=priority-Math.hypot(rect.x-innerWidth/2,rect.y-innerHeight/2)/innerWidth*20+(this.visible.has(p.id)?5:0);
        candidates.push({p,rect,score});
      }
      if(population?.enabled&&distance<900000){
        const density=p=>p.populationDensity??population.labelDensities.get(p.lm?.id)??0;
        const maxDensity=Math.max(1,...candidates.map(({p})=>density(p)));
        for(const item of candidates)if(item.p.id!==this.selected){
          // Rank inside this viewport: a modest provincial peak can lead when zoomed locally.
          item.score=1000+400*Math.log1p(density(item.p))/Math.log1p(maxDensity)
            -Math.hypot(item.rect.x-innerWidth/2,item.rect.y-innerHeight/2)/innerWidth*20
            +(this.visible.has(item.p.id)?5:0);
        }
      }
      candidates.sort((a,b)=>b.score-a.score||a.p.id.localeCompare(b.p.id));
      const placed=[],chosen=new Set(),budget=this.city.overview?(innerWidth<860?12:24):(innerWidth<860?(this.city.cityId==='seoul'?13:9):(this.city.cityId==='seoul'?26:20));
      const place=({p,rect})=>{
        if(chosen.has(p.id)||chosen.size>=budget)return false;
        const offsets=this.city.overview?[[0,0],[-45,0],[45,0],[0,-30],[-35,-25],[35,-25]]:[[0,0],[-28,-18],[28,-18],[0,-34]];
        for(const [dx,dy] of offsets){
          const r={x:rect.x+dx,y:rect.y+dy,left:rect.left+dx,right:rect.right+dx,top:rect.top+dy,bottom:rect.bottom+dy};
          if(r.left<8||r.right>innerWidth-8||r.top<8||r.bottom>innerHeight-25||placed.some(o=>overlaps(r,o))||obstacles.some(o=>overlaps(r,o)))continue;
          p.labelOffset=[dx,dy];placed.push(r);chosen.add(p.id);
          const node=this.node(p);node.lastSeen=now;
          node.el.style.setProperty('--leader-length',Math.hypot(dx,14-dy)+'px');
          node.el.style.setProperty('--leader-angle',Math.atan2(dx,14-dy)+'rad');
          return true;
        }
        return false;
      };
      if(this.city.overview){
        // Reserve room for all three kinds instead of allowing cities to hide geography.
        const selected=candidates.find(({p})=>p.id===this.selected);if(selected)place(selected);
        for(const kind of ['city','river','mountain']){
          let count=0;for(const candidate of candidates){if(candidate.p.lm.kind===kind&&place(candidate)&&++count>=3)break;}
        }
      }
      for(const candidate of candidates){
        place(candidate);
        if(chosen.size>=budget)break;
      }
      this.visible=chosen;this.stats.visible=[...chosen].filter(id=>!id.startsWith('landmark:')).length;
      for(const [id,node] of this.nodes){
        const visible=chosen.has(id);node.el.style.opacity=visible?'1':'0';node.el.style.pointerEvents=visible?'auto':'none';node.el.setAttribute('aria-hidden',String(!visible));node.el.tabIndex=visible?0:-1;
        node.el.classList.toggle('selected',id===this.selected);
        if(!visible&&now-node.lastSeen>1200){node.el.remove();this.nodes.delete(id);}
      }
    }
    // Reproject the small selected set every frame, including during fast dragging.
    for(const id of this.visible){const node=this.nodes.get(id),rect=this.screen(node.p);if(!rect){node.el.style.opacity='0';continue;}node.el.style.left=rect.x+'px';node.el.style.top=rect.y+'px';}
  }
}
export const poiCategoryName=category=>CATEGORIES[category]?.[0]||'랜드마크';
