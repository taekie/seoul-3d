import { MOUSE } from 'three';

export function installPanGesture(city,canvas) {
  const controls=city.controls;
  let holdTimer,idleTimer,pointer=null;
  city.spacePan=false;city.longPressPan=false;
  const active=()=>city.spacePan||city.longPressPan;
  const cancelHold=()=>{clearTimeout(holdTimer);holdTimer=null;};
  const refresh=()=>{
    controls.mouseButtons.LEFT=active()?MOUSE.PAN:MOUSE.ROTATE;
    canvas.style.cursor=active()?(pointer?'grabbing':'grab'):'';
    canvas.dataset.navigationMode=city.longPressPan?'pan':'rotate';
  };
  const armIdle=()=>{
    clearTimeout(idleTimer);
    idleTimer=setTimeout(()=>{
      city.longPressPan=false;
      if(pointer&&!city.spacePan)controls.setMouseGesture(false,pointer);
      refresh();
    },3000);
  };
  const reset=()=>{
    cancelHold();clearTimeout(idleTimer);pointer=null;
    city.spacePan=false;city.longPressPan=false;refresh();
  };
  addEventListener('keydown',event=>{
    if(event.code!=='Space'||event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
    event.preventDefault();cancelHold();city.spacePan=true;
    if(pointer)controls.setMouseGesture(true,pointer);
    refresh();
  });
  addEventListener('keyup',event=>{
    if(event.code!=='Space')return;
    city.spacePan=false;
    if(pointer)controls.setMouseGesture(active(),pointer);
    refresh();
  });
  canvas.addEventListener('pointerdown',event=>{
    cancelHold();
    if(event.pointerType==='touch'||event.button!==0)return;
    pointer={pointerId:event.pointerId,clientX:event.clientX,clientY:event.clientY};
    if(active())controls.setMouseGesture(true,pointer);
    refresh();
    if(active()||event.shiftKey||event.ctrlKey||event.metaKey)return;
    const origin={x:event.clientX,y:event.clientY};pointer.origin=origin;
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(!pointer||Math.hypot(pointer.clientX-origin.x,pointer.clientY-origin.y)>6)return;
      city.longPressPan=true;controls.setMouseGesture(true,pointer);armIdle();refresh();
    },1000);
  });
  document.addEventListener('pointermove',event=>{
    if(city.longPressPan&&event.target===canvas&&(event.buttons&2)&&(event.movementX||event.movementY))armIdle();
    if(!pointer||event.pointerId!==pointer.pointerId)return;
    const moved=event.clientX!==pointer.clientX||event.clientY!==pointer.clientY;
    pointer.clientX=event.clientX;pointer.clientY=event.clientY;
    if(pointer.origin&&Math.hypot(event.clientX-pointer.origin.x,event.clientY-pointer.origin.y)>6)cancelHold();
    if(city.longPressPan&&moved&&(event.buttons&1))armIdle();
  },true);
  document.addEventListener('pointerup',event=>{
    if(city.longPressPan&&event.target===canvas&&event.button===2)armIdle();
    if(!pointer||event.pointerId!==pointer.pointerId)return;
    cancelHold();pointer=null;
    if(city.longPressPan)armIdle();refresh();
  });
  canvas.addEventListener('pointercancel',reset);
  addEventListener('blur',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  refresh();
}
