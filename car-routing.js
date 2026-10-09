import * as THREE from 'three';
import {Line2} from 'three/addons/lines/Line2.js';
import {LineGeometry} from 'three/addons/lines/LineGeometry.js';
import {LineMaterial} from 'three/addons/lines/LineMaterial.js';
import {HEIGHT_EXAGGERATION,waterAt} from './miniature.js';
const ENDPOINT='https://routing.openstreetmap.de/routed-car/route/v1/driving/';

export function mountCarRouting(city,labels,onOpen) {
  if(city.cityId!=='seoul')return null;
  const button=document.createElement('button');button.id='route-toggle';button.type='button';button.setAttribute('aria-expanded','false');
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8"/></svg>길찾기';
  document.getElementById('tools').append(button);
  const panel=document.createElement('section');panel.id='route-panel';panel.className='card';panel.hidden=true;panel.setAttribute('aria-label','자동차 길찾기');
  panel.innerHTML=`<div class="route-heading"><h2>자동차 길찾기</h2><button type="button" id="route-close" aria-label="길찾기 닫기">×</button></div>
    <form id="route-form">
      <label for="route-origin">출발지</label><div class="route-input"><input id="route-origin" list="route-places" placeholder="장소 이름 입력" autocomplete="off" required><button type="button" data-pick="origin">지도 선택</button></div>
      <label for="route-destination">목적지</label><div class="route-input"><input id="route-destination" list="route-places" placeholder="장소 이름 입력" autocomplete="off" required><button type="button" data-pick="destination">지도 선택</button></div>
      <datalist id="route-places"></datalist>
      <div class="route-actions"><button type="button" id="route-swap" aria-label="출발지와 목적지 바꾸기">⇅ 바꾸기</button><button type="submit" id="route-search">경로 찾기</button></div>
    </form>
    <p id="route-status" role="status" aria-live="polite">장소 이름을 입력하거나 지도에서 두 지점을 선택하세요.</p>
    <div id="route-result" hidden><strong id="route-summary"></strong><button type="button" id="route-fit">경로 전체 보기</button></div>
    <button type="button" id="route-clear">선택·경로 지우기</button>
    <p class="route-note">예상 시간은 실시간 교통체증을 반영하지 않습니다.</p>
    <p class="route-source">경로: <a href="https://project-osrm.org/" target="_blank" rel="noopener">OSRM</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener">지도 수정</a></p>`;
  document.body.append(panel);
  const $=id=>panel.querySelector('#route-'+id),inputs={origin:$('origin'),destination:$('destination')};
  const state={origin:null,destination:null,active:null,busy:false,route:null};
  let places=new Map(),requestId=0,controller=null,lastRequest=-Infinity;
  const root=new THREE.Group();root.name='car-routing';city.scene.add(root);
  const status=text=>$('status').textContent=text;
  function disposeChildren(){for(const object of [...root.children]){object.traverse(o=>{o.geometry?.dispose();if(o.material)[].concat(o.material).forEach(m=>{m.map?.dispose();m.dispose();});});root.remove(object);}}
  function sizePins(){
    const height=2*Math.tan(THREE.MathUtils.degToRad(city.camera.fov/2))*54/city.renderer.domElement.getBoundingClientRect().height;
    for(const pin of root.children.filter(o=>o.isSprite))pin.scale.set(height*.8,height,1);
  }
  labels.routePinBounds=()=>{
    if(!root.visible)return [];
    const rect=city.renderer.domElement.getBoundingClientRect();
    return root.children.filter(o=>o.isSprite).flatMap(pin=>{
      const p=pin.position.clone().project(city.camera);if(p.z<-1||p.z>1)return [];
      const x=rect.left+(p.x+1)*rect.width/2,y=rect.top+(1-p.y)*rect.height/2;
      return [{left:x-24,right:x+24,top:y-54,bottom:y+4}];
    });
  };
  function makePin(slot,color){
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=200;
    const ctx=canvas.getContext('2d'),label=slot==='origin'?'출발':'도착';
    ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.strokeStyle='#ffffff';ctx.lineWidth=5;
    ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;
    ctx.beginPath();ctx.moveTo(80,190);ctx.bezierCurveTo(68,161,17,108,17,74);ctx.bezierCurveTo(17,-8,143,-8,143,74);ctx.bezierCurveTo(143,108,92,161,80,190);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowColor='transparent';ctx.fillStyle='#ffffff';ctx.font='bold 36px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,80,72);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const pin=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,sizeAttenuation:false,depthTest:false,depthWrite:false}));
    pin.center.set(.5,.05);pin.renderOrder=101;pin.userData={slot,label};return pin;
  }
  function world(lon,lat,lift=15){const x=city.lonToX(lon),north=city.latToY(lat),water=waterAt(city,x,north);return new THREE.Vector3(x,Math.max(city.terrain.at(x,north)*HEIGHT_EXAGGERATION+9,water===null?-Infinity:water+38)+lift,-north);}
  function draw(){
    disposeChildren();
    if(state.route){
      const positions=[],coordinates=state.route.geometry.coordinates;
      for(let i=0;i<coordinates.length;i++){
        const [lon,lat]=coordinates[i];
        if(i){const previous=coordinates[i-1],length=Math.hypot((lon-previous[0])*88000,(lat-previous[1])*111320),steps=Math.max(1,Math.ceil(length/45));for(let j=1;j<steps;j++)positions.push(...world(previous[0]+(lon-previous[0])*j/steps,previous[1]+(lat-previous[1])*j/steps).toArray());}
        positions.push(...world(lon,lat).toArray());
      }
      const geometry=new LineGeometry();geometry.setPositions(positions);
      const material=new LineMaterial({color:0xe97136,linewidth:6,depthTest:false,depthWrite:false});
      const line=new Line2(geometry,material);line.renderOrder=100;line.computeLineDistances();root.add(line);
    }
    for(const [slot,color] of [['origin',0x328c69],['destination',0xd95347]]){
      const p=state[slot];if(!p)continue;
      const marker=makePin(slot,color);marker.position.copy(world(p.lon,p.lat,5));root.add(marker);
    }
    sizePins();
    labels.nextLayout=0;
  }
  function cancel(){requestId++;controller?.abort();controller=null;state.busy=false;$('search').disabled=false;}
  function invalidate(){cancel();state.route=null;$('result').hidden=true;draw();}
  function pick(slot){state.active=slot;panel.querySelectorAll('[data-pick]').forEach(b=>b.classList.toggle('on',b.dataset.pick===slot));status(`${slot==='origin'?'출발지':'목적지'}를 지도 또는 이름표에서 선택하세요. 드래그는 지도를 이동합니다.`);}
  function setPoint(slot,p){invalidate();state[slot]={name:p.name,lon:p.lon,lat:p.lat};inputs[slot].value=p.name;draw();if(slot==='origin'&&!state.destination)pick('destination');else{state.active=null;panel.querySelectorAll('[data-pick]').forEach(b=>b.classList.remove('on'));status('경로 찾기를 눌러 자동차 경로를 확인하세요.');}}
  function refreshPlaces(){
    places=new Map();const all=[...city.landmarks,...[...labels.grid.values()].flat()];
    for(const p of all)if(!places.has(p.name)&&Number.isFinite(p.lon)&&Number.isFinite(p.lat))places.set(p.name,p);
    const list=$('places');list.replaceChildren();for(const name of places.keys()){const option=document.createElement('option');option.value=name;list.append(option);}
  }
  function fit(){
    if(!state.route)return;const box=new THREE.Box3();for(const [lon,lat] of state.route.geometry.coordinates)box.expandByPoint(world(lon,lat));
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),meta=city.data.meta;
    const lon=meta.center[0]+center.x/meta.kx*360,lat=toLat(-center.z);
    const span=Math.max(size.z,size.x/city.camera.aspect),distance=Math.max(1800,span/(2*Math.tan(THREE.MathUtils.degToRad(city.camera.fov/2)))*1.65);
    city.flyTo(lon,lat,Math.min(city.controls.maxDistance,distance),.95,0);
  }
  function toLat(north){const meta=city.data.meta,m=Math.log(Math.tan(Math.PI/4+meta.center[1]*Math.PI/360));return Math.atan(Math.exp(m+north/meta.kx*2*Math.PI))*360/Math.PI-90;}
  async function search(){
    refreshPlaces();
    for(const slot of ['origin','destination']){
      const name=inputs[slot].value.trim();if(state[slot]?.name===name)continue;
      const p=places.get(name);if(!p){status('목록에서 장소를 고르거나 지도 선택을 이용하세요.');inputs[slot].focus();return;}state[slot]={name:p.name,lon:p.lon,lat:p.lat};
    }
    if(Math.hypot((state.origin.lon-state.destination.lon)*88000,(state.origin.lat-state.destination.lat)*111320)<10){status('출발지와 목적지를 서로 다른 지점으로 선택하세요.');return;}
    const wait=1100-(performance.now()-lastRequest);if(wait>0){status('잠시 후 다시 경로 찾기를 눌러주세요.');return;}
    invalidate();state.busy=true;$('search').disabled=true;status('자동차 경로를 찾는 중…');
    const id=++requestId;controller=new AbortController();const abort=controller;const timer=setTimeout(()=>abort.abort(),20000);
    lastRequest=performance.now();
    try {
      const points=[state.origin,state.destination].map(p=>`${p.lon.toFixed(7)},${p.lat.toFixed(7)}`).join(';');
      const response=await fetch(ENDPOINT+points+'?overview=full&geometries=geojson&steps=false',{signal:abort.signal});
      if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(id!==requestId)return;
      const route=data.routes?.[0];if(data.code!=='Ok'||!route?.geometry?.coordinates?.length||!Number.isFinite(route.distance)||!Number.isFinite(route.duration))throw Error('NoRoute');
      state.route=route;draw();$('summary').textContent=`${(route.distance/1000).toFixed(1)} km · 약 ${Math.max(1,Math.round(route.duration/60))}분`;$('result').hidden=false;status('자동차 경로입니다. 실제 도로 상황에 따라 달라질 수 있습니다.');state.active=null;fit();
    }catch(error){if(id===requestId)status(error.name==='AbortError'?'응답이 늦어 중단했습니다. 다시 시도해 주세요.':error.message==='NoRoute'?'자동차 경로가 없습니다. 가까운 도로 쪽으로 지점을 바꿔주세요.':'경로 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');}
    finally{clearTimeout(timer);if(id===requestId){state.busy=false;$('search').disabled=false;controller=null;}}
  }
  function close(){panel.hidden=true;root.visible=false;state.active=null;cancel();button.classList.remove('on');button.setAttribute('aria-expanded','false');labels.nextLayout=0;}
  button.onclick=()=>{if(!panel.hidden){close();return;}onOpen();panel.hidden=false;root.visible=true;button.classList.add('on');button.setAttribute('aria-expanded','true');refreshPlaces();if(!state.origin)pick('origin');else if(!state.destination)pick('destination');else{state.active=null;panel.querySelectorAll('[data-pick]').forEach(b=>b.classList.remove('on'));status(state.route?'자동차 경로입니다. 실제 도로 상황에 따라 달라질 수 있습니다.':'경로 찾기를 눌러 자동차 경로를 확인하세요.');}labels.nextLayout=0;};
  $('close').onclick=close;$('form').onsubmit=e=>{e.preventDefault();search();};$('fit').onclick=fit;
  $('clear').onclick=()=>{invalidate();state.origin=state.destination=null;inputs.origin.value=inputs.destination.value='';draw();pick('origin');};
  $('swap').onclick=()=>{invalidate();[state.origin,state.destination]=[state.destination,state.origin];[inputs.origin.value,inputs.destination.value]=[inputs.destination.value,inputs.origin.value];draw();status('출발지와 목적지를 바꿨습니다. 경로 찾기를 눌러주세요.');};
  panel.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>pick(b.dataset.pick));
  for(const [slot,input] of Object.entries(inputs)){input.addEventListener('input',()=>{invalidate();state[slot]=null;draw();});input.addEventListener('change',()=>{const p=places.get(input.value.trim());if(p)setPoint(slot,p);});}
  const canvas=city.renderer.domElement;let down=null;const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)down={x:e.clientX,y:e.clientY,id:e.pointerId};});
  canvas.addEventListener('pointerup',e=>{
    const start=down;down=null;if(panel.hidden||!state.active||!start||start.id!==e.pointerId||Math.hypot(start.x-e.clientX,start.y-e.clientY)>7)return;
    const rect=canvas.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);ray.setFromCamera(mouse,city.camera);
    const hit=ray.intersectObject(city.groups.terrain)[0];if(!hit){status('지도 위 지점을 선택해 주세요.');return;}
    const lon=city.data.meta.center[0]+hit.point.x/city.data.meta.kx*360,lat=toLat(-hit.point.z);setPoint(state.active,{name:`지도 지점 (${lat.toFixed(4)}, ${lon.toFixed(4)})`,lon,lat});
  });
  canvas.addEventListener('pointercancel',()=>{down=null;});
  window.addEventListener('resize',sizePins);
  document.querySelectorAll('#time button').forEach(b=>b.addEventListener('click',draw));
  return {state,root,search,selectPOI(p){if(panel.hidden||!state.active)return false;setPoint(state.active,p.lm||p);return true;}};
}
