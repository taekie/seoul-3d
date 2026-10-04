import * as THREE from 'three';

const radians=THREE.MathUtils.degToRad;
const clamp=THREE.MathUtils.clamp;
const screenAngle=()=>radians(screen.orientation?.angle??window.orientation??0);
const deadzone=value=>Math.sign(value)*Math.max(0,Math.abs(value)-radians(1));

export class DeviceLook {
  constructor(city,{button,panel,status,recenter,onEnable}) {
    Object.assign(this,{city,button,panel,status,recenter,onEnable});
    this.enabled=false;this.pending=false;this.token=0;this.latest=null;this.baseline=null;
    this.q=new THREE.Quaternion();this.relative=new THREE.Quaternion();this.euler=new THREE.Euler();
    this.screenRotation=new THREE.Quaternion();this.zAxis=new THREE.Vector3(0,0,1);
    this.phoneToCamera=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    this.forward=new THREE.Vector3();this.yaw=0;this.pitch=0;
    this.onOrientation=e=>{
      if(!this.enabled||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;
      this.euler.set(radians(e.beta),radians(Number.isFinite(e.alpha)?e.alpha:0),-radians(e.gamma),'YXZ');
      this.q.setFromEuler(this.euler).multiply(this.phoneToCamera)
        .multiply(this.screenRotation.setFromAxisAngle(this.zAxis,-screenAngle()));
      this.latest=this.q.clone();this.lastReading=performance.now();
      clearTimeout(this.sensorTimeout);
      if(!this.baseline)this.calibrate();
    };
    this.onScreenChange=()=>{if(this.enabled){this.baseline=null;this.latest=null;this.watchSensor();}};
    this.recenter.addEventListener('click',()=>this.calibrate());
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&(this.enabled||this.pending))this.stop('기울여 보기가 꺼졌습니다. 다시 켜서 계속 볼 수 있어요.');});
  }
  message(text) {this.panel.hidden=false;this.status.textContent=text;}
  async toggle() {
    if(this.enabled||this.pending){this.stop();return;}
    if(!window.isSecureContext){this.message('아이폰 센서는 HTTPS 주소에서 사용할 수 있어요. HTTPS로 접속해 주세요.');return;}
    const api=window.DeviceOrientationEvent;
    if(!api){this.message('이 브라우저에서는 기울기 센서를 사용할 수 없어요. 아이폰 Safari에서 열어 주세요.');return;}
    const token=++this.token;this.pending=true;this.button.setAttribute('aria-busy','true');
    this.message('휴대폰을 편하게 들고 센서 접근을 허용해 주세요.');
    try{
      // Must remain in the button's user-activation call chain on iOS.
      const permission=typeof api.requestPermission==='function'?await api.requestPermission():'granted';
      if(token!==this.token)return;
      if(permission!=='granted'){this.stop('센서 접근이 허용되지 않았어요. Safari의 웹사이트 설정에서 동작·방향 접근을 확인해 주세요.');return;}
      this.pending=false;this.button.removeAttribute('aria-busy');this.enabled=true;
      this.onEnable();this.city.anim=null;
      this.button.classList.add('on');this.button.setAttribute('aria-pressed','true');
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
    this.savedTouches=null;this.enabled=false;this.pending=false;this.baseline=null;this.latest=null;
    this.city.sensorMoving=false;this.button.classList.remove('on');this.button.setAttribute('aria-pressed','false');
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
    const yaw=clamp(deadzone(Math.atan2(-this.forward.x,-this.forward.z))*1.2,-radians(30),radians(30));
    const pitch=clamp(deadzone(Math.asin(clamp(this.forward.y,-1,1))),-radians(18),radians(18));
    const dt=Math.min(.1,Math.max(0,(now-this.lastFrame)/1000));this.lastFrame=now;
    const blend=1-Math.exp(-dt/.12),oldYaw=this.yaw,oldPitch=this.pitch;
    this.yaw+=(yaw-this.yaw)*blend;this.pitch+=(pitch-this.pitch)*blend;
    this.city.sensorMoving=Math.abs(this.yaw-oldYaw)+Math.abs(this.pitch-oldPitch)>.0002;
    const controls=this.city.controls,radius=this.city.camera.position.distanceTo(controls.target);
    const phi=clamp(this.basePhi-this.pitch,Math.max(.15,controls.minPolarAngle),controls.maxPolarAngle);
    this.city.camera.position.setFromSphericalCoords(radius,phi,this.baseTheta+this.yaw).add(controls.target);
    controls.update();
  }
}
