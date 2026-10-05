import { TOUCH } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// OrbitControls 0.185.1 (pinned in index.html) shares damping between rotation
// and pan. Consume its accumulated pan before the normal update so translation
// is immediate, while its spherical rotation delta keeps the usual damping.
export class MapControls extends OrbitControls {
  constructor(camera,canvas) {
    super(camera,canvas);
    this.touches.ONE=TOUCH.PAN;
    this.touches.TWO=TOUCH.DOLLY_ROTATE;
  }
  _handleTouchStartPan(event) {
    super._handleTouchStartPan(event);
    // Synthetic start after lifting one of two fingers is not a new tap.
    if(event.pointerType!=='touch')return;
    const now=performance.now(),last=this._lastTap;
    this._quickZoom=Boolean(last&&now-last.time<350&&Math.hypot(event.pageX-last.x,event.pageY-last.y)<24);
    this._tap={x:event.pageX,y:event.pageY,time:now,moved:false};
    this._lastTap=null;this._quickZoomY=event.pageY;
  }
  _handleTouchMovePan(event) {
    if(this._tap&&Math.hypot(event.pageX-this._tap.x,event.pageY-this._tap.y)>6)this._tap.moved=true;
    if(!this._quickZoom)return super._handleTouchMovePan(event);
    if(this.enableZoom)this._dollyOut(Math.exp((event.pageY-this._quickZoomY)*.006*this.zoomSpeed));
    this._quickZoomY=event.pageY;
  }
  _removePointer(event) {
    if(this._pointers.length===1&&this._tap){
      const tap=this._tap;
      if(event.type!=='pointercancel'&&!tap.moved){
        if(this._quickZoom&&this.enableZoom){this._dollyOut(1.6);this.update();}
        else if(performance.now()-tap.time<250)this._lastTap={...tap,time:performance.now()};
      }
    }
    this._tap=null;this._quickZoom=false;
    if(event.type==='pointercancel')this._lastTap=null;
    super._removePointer(event);
  }
  _touchPair() {
    const [a,b]=this._pointers.map(id=>this._pointerPositions[id]);
    if(!a||!b)return null;
    return {y:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  _handleTouchStartDollyRotate() {
    this._tap=null;this._lastTap=null;this._quickZoom=false;
    this._mapTouchPair=this._touchPair();
    this._sphericalDelta.set(0,0,0);
  }
  _handleTouchStartDollyPan() { this._handleTouchStartDollyRotate(); }
  _handleTouchMoveDollyRotate() {
    const next=this._touchPair(),previous=this._mapTouchPair;
    if(!next||!previous)return;
    this._mapTouchPair=next;
    if(this.enableRotate){
      const angle=Math.atan2(Math.sin(next.angle-previous.angle),Math.cos(next.angle-previous.angle));
      // Twist follows the fingers; vertical two-finger drag changes pitch only.
      this._rotateLeft(-angle);
      this._rotateUp(2*Math.PI*(next.y-previous.y)*this.rotateSpeed/this.domElement.clientHeight);
    }
    if(this.enableZoom&&previous.distance>4&&next.distance>4){
      this._dollyOut(Math.pow(next.distance/previous.distance,this.zoomSpeed));
    }
  }
  _handleTouchMoveDollyPan() { this._handleTouchMoveDollyRotate(); }

  // Switch the held gesture; state values follow pinned OrbitControls 0.185.1.
  setMouseGesture(pan, event) {
    if(pan)this._handleMouseDownPan(event);else this._handleMouseDownRotate(event);
    this._sphericalDelta.set(0,0,0);
    this.state=pan?2:0;
  }
  update(deltaTime) {
    const pan = this._panOffset;
    if (this.enableDamping && pan && pan.lengthSq() > 0) {
      this.target.add(pan);
      this.object.position.add(pan);
      pan.set(0, 0, 0);
    }
    // Touch tracks fingers directly, without residual rotation after release.
    const damping=this.enableDamping;
    if(this.state>=3&&this._pointers?.length)this.enableDamping=false;
    const changed=super.update(deltaTime);
    this.enableDamping=damping;
    return changed;
  }
}
