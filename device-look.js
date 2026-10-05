import * as THREE from 'three';

const radians=THREE.MathUtils.degToRad;
const clamp=THREE.MathUtils.clamp;
const screenAngle=()=>radians(screen.orientation?.angle??window.orientation??0);
const deadzone=value=>Math.sign(value)*Math.max(0,Math.abs(value)-radians(1));

export class DeviceLook {
  constructor(city,{button,moveButton,panel,status,recenter,onEnable}) {
    Object.assign(this,{city,button,moveButton,panel,status,recenter,onEnable});
    this.enabled=false;this.pending=false;this.token=0;this.latest=null;this.baseline=null;
    this.q=new THREE.Quaternion();this.relative=new THREE.Quaternion();this.euler=new THREE.Euler();
    this.screenRotation=new THREE.Quaternion();this.zAxis=new THREE.Vector3(0,0,1);
    this.phoneToCamera=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    this.forward=new THREE.Vector3();this.yaw=0;this.pitch=0;
    this.onOrientation=e=>{
      if(!this.enabled||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
      this.tilt={beta:e.beta,gamma:e.gamma};
      this.euler.set(radians(e.beta),radians(Number.isFinite(e.alpha)?e.alpha:0),-radians(e.gamma),'YXZ');
      this.q.setFromEuler(this.euler).multiply(this.phoneToCamera)
        .multiply(this.screenRotation.setFromAxisAngle(this.zAxis,-screenAngle()));
      this.latest=this.q.clone();this.lastReading=performance.now();
      clearTimeout(this.sensorTimeout);
      if(!this.baseline)this.calibrate();
    };
    this.onScreenChange=()=>this.stop();
    for(const [control,mode] of [[this.button,'look'],[this.moveButton,'move']]){
      control.addEventListener('pointerdown',e=>{
        if(this.holdMode)return;
        e.preventDefault();e.stopPropagation();control.setPointerCapture(e.pointerId);
        this.holdMode=mode;this.toggle();
      });
      for(const event of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(event,()=>{if(this.holdMode===mode)this.stop();});
      control.addEventListener('contextmenu',e=>e.preventDefault());
      control.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat&&!this.holdMode){this.holdMode=mode;this.toggle();}}});
      control.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)&&this.holdMode===mode)this.stop();});
      control.addEventListener('blur',()=>{if(this.holdMode===mode)this.stop();});
    }
    window.addEventListener('blur',()=>{if(this.enabled)this.stop();});
    this.recenter.addEventListener('click',()=>this.calibrate());
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&(this.enabled||this.pending))this.stop('기울여 보기가 꺼졌습니다. 다시 켜서 계속 볼 수 있어요.');});
  }
  beginMove() {
    if(!this.enabled||!this.latest)return;
    this.city.anim=null;this.calibrate();this.moving=true;
    this.moveButton.classList.add('on');this.moveButton.setAttribute('aria-pressed','true');
  }
  releaseMove() {
    this.movePointer=undefined;
    if(!this.moving)return;
    this.moving=false;this.moveButton.classList.remove('on');this.moveButton.setAttribute('aria-pressed','false');
    this.calibrate();this.city.sensorMoving=false;
  }
  message(text) {this.panel.hidden=true;this.status.textContent=text;this.button.title=text;this.button.setAttribute('aria-label',text);}
  async toggle() {
    if(this.enabled||this.pending){this.stop();return;}
    if(!window.isSecureContext){this.stop('아이폰 센서는 HTTPS 주소에서 사용할 수 있어요. HTTPS로 접속해 주세요.');return;}
    const api=window.DeviceOrientationEvent;
    if(!api){this.stop('이 브라우저에서는 기울기 센서를 사용할 수 없어요. 아이폰 Safari에서 열어 주세요.');return;}
    const token=++this.token;this.pending=true;this.button.setAttribute('aria-busy','true');
    this.message('휴대폰을 편하게 들고 센서 접근을 허용해 주세요.');
    try{
      // Must remain in the button's user-activation call chain on iOS.
      const permission=typeof api.requestPermission==='function'?await api.requestPermission():'granted';
      if(token!==this.token)return;
      if(permission!=='granted'){this.stop('센서 접근이 허용되지 않았어요. Safari의 웹사이트 설정에서 동작·방향 접근을 확인해 주세요.');return;}
      this.pending=false;this.button.removeAttribute('aria-busy');this.enabled=true;
      this.onEnable();this.city.anim=null;
      this.moving=this.holdMode==='move';
      const active=this.moving?this.moveButton:this.button;
      active.classList.add('on');active.setAttribute('aria-pressed','true');
      this.savedTouches={...this.city.controls.touches};
      Object.assign(this.city.controls.touches,{ONE:THREE.TOUCH.PAN,TWO:THREE.TOUCH.DOLLY_PAN});
      this.latest=null;this.baseline=null;this.needsRebase=false;this.lastFrame=performance.now();
      window.addEventListener('deviceorientation',this.onOrientation);
      window.addEventListener('orientationchange',this.onScreenChange);
      screen.orientation?.addEventListener('change',this.onScreenChange);
      this.message('센서를 기다리는 중… 휴대폰을 조금 기울여 보세요.');this.watchSensor();
    }catch{
      if(token===this.token)this.stop('센서에 접근하지 못했어요. 아이폰 Safari에서 HTTPS 주소로 다시 열어 주세요.');
    }
  }
  watchSensor() {
    clearTimeout(this.sensorTimeout);
    this.sensorTimeout=setTimeout(()=>this.stop('기울기 센서 신호가 없어요. 센서를 지원하는 휴대폰에서 다시 시도해 주세요.'),6000);
  }
  calibrate() {
    if(!this.enabled||!this.latest)return;
    this.baseline=this.latest.clone().invert();
    this.baseTilt=this.tilt?{...this.tilt}:null;
    this.baseTheta=this.city.controls.getAzimuthalAngle();this.basePhi=this.city.controls.getPolarAngle();
    this.yaw=0;this.pitch=0;this.needsRebase=false;this.recenter.hidden=false;
    this.message('기울여 둘러보기 · 손가락으로 이동·확대');
  }
  stop(message) {
    ++this.token;clearTimeout(this.sensorTimeout);
    window.removeEventListener('deviceorientation',this.onOrientation);
    window.removeEventListener('orientationchange',this.onScreenChange);
    screen.orientation?.removeEventListener('change',this.onScreenChange);
    if(this.savedTouches)Object.assign(this.city.controls.touches,this.savedTouches);
    this.releaseMove();this.holdMode=null;this.savedTouches=null;this.enabled=false;this.pending=false;this.baseline=null;this.latest=null;
    this.city.sensorMoving=false;for(const control of [this.button,this.moveButton]){control.classList.remove('on');control.setAttribute('aria-pressed','false');}
    this.button.removeAttribute('aria-busy');this.recenter.hidden=true;
    if(message)this.message(message);else this.panel.hidden=true;
  }
  update(now) {
    if(!this.enabled||!this.baseline||!this.latest){this.city.sensorMoving=false;return;}
    if(now-this.lastReading>6000){this.stop('센서 신호가 멈췄어요. 기울여 보기를 다시 켜 주세요.');return;}
    // Touch navigation, flights and north-up turns have priority. Rebase when done.
    if(this.city.interacting||this.city.anim){this.needsRebase=true;this.city.sensorMoving=false;this.lastFrame=now;return;}
    if(this.needsRebase){
      // Let rotation/zoom damping finish before treating this as the new view.
      if(now<this.city.interactionUntil+180)return;
      this.calibrate();
    }
    this.relative.copy(this.baseline).multiply(this.latest);
    this.forward.set(0,0,-1).applyQuaternion(this.relative);
    let yaw=clamp(deadzone(Math.atan2(-this.forward.x,-this.forward.z))*1.2,-radians(30),radians(30));
    let pitch=clamp(deadzone(Math.asin(clamp(this.forward.y,-1,1))),-radians(18),radians(18));
    if(this.moving&&this.baseTilt&&this.tilt){
      // Navigation uses the physical screen axes, not camera heading (alpha).
      // Rotate device beta/gamma into screen coordinates before assigning actions.
      const wrap=degrees=>radians(((degrees+540)%360)-180);
      const beta=wrap(this.tilt.beta-this.baseTilt.beta),gamma=wrap(this.tilt.gamma-this.baseTilt.gamma);
      const angle=screenAngle(),c=Math.cos(angle),s=Math.sin(angle);
      yaw=clamp(deadzone(gamma*c+beta*s)*1.2,-radians(30),radians(30));
      pitch=clamp(deadzone(beta*c-gamma*s),-radians(18),radians(18));
    }
    const dt=Math.min(.1,Math.max(0,(now-this.lastFrame)/1000));this.lastFrame=now;
    const blend=1-Math.exp(-dt/.12),oldYaw=this.yaw,oldPitch=this.pitch;
    this.yaw+=(yaw-this.yaw)*blend;this.pitch+=(pitch-this.pitch)*blend;
    this.city.sensorMoving=Math.abs(this.yaw-oldYaw)+Math.abs(this.pitch-oldPitch)>.0002;
    const controls=this.city.controls,radius=this.city.camera.position.distanceTo(controls.target);
    if(this.moving){
      // Camera-relative movement and exponential zoom remain consistent at every map scale.
      const right=new THREE.Vector3().setFromMatrixColumn(this.city.camera.matrix,0);right.y=0;right.normalize();
      const shift=right.multiplyScalar(this.yaw*radius*dt*1.5);
      controls.target.add(shift);this.city.camera.position.add(shift);
      const nextRadius=clamp(radius*Math.exp(this.pitch*dt*2),controls.minDistance,controls.maxDistance);
      this.city.camera.position.sub(controls.target).multiplyScalar(nextRadius/radius).add(controls.target);
      this.city.sensorMoving=shift.lengthSq()>.001||Math.abs(nextRadius-radius)>.001;
      controls.update();return;
    }
    // Lowering the phone toward horizontal raises the view toward a bird's-eye angle.
    const phi=clamp(this.basePhi+this.pitch,Math.max(.15,controls.minPolarAngle),controls.maxPolarAngle);
    this.city.camera.position.setFromSphericalCoords(radius,phi,this.baseTheta+this.yaw).add(controls.target);
    controls.update();
  }
}
