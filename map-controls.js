import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// OrbitControls 0.185.1 (pinned in index.html) shares damping between rotation
// and pan. Consume its accumulated pan before the normal update so translation
// is immediate, while its spherical rotation delta keeps the usual damping.
export class MapControls extends OrbitControls {
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
    return super.update(deltaTime);
  }
}
