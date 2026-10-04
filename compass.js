import * as THREE from 'three';

export function mountCompass(city, button, onReset) {
  const needle=button.querySelector('.compass-needle');
  const labels=[...button.querySelectorAll('[data-direction]')];
  let lastAngle;
  button.addEventListener('click',()=>{
    onReset();
    city.anim=null;
    // Consume residual rotation damping before starting the north-up turn.
    const damping=city.controls.enableDamping;
    city.controls.enableDamping=false;city.controls.update();city.controls.enableDamping=damping;
    const target=city.controls.target.clone();
    const radius=city.camera.position.distanceTo(target),phi=city.controls.getPolarAngle();
    const theta=city.controls.getAzimuthalAngle();
    const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:550;
    const start=performance.now();
    const turn=now=>{
      const t=duration?Math.min(1,(now-start)/duration):1;
      const eased=t*t*(3-2*t);
      city.camera.position.setFromSphericalCoords(radius,phi,theta*(1-eased)).add(target);
      city.controls.target.copy(target);
      if(t===1)city.anim=null;
    };
    if(duration)city.anim=turn;else {turn(start);city.controls.update();}
  });
  return ()=>{
    const angle=THREE.MathUtils.radToDeg(city.controls.getAzimuthalAngle());
    if(lastAngle!==undefined&&Math.abs(lastAngle-angle)<.05)return;
    lastAngle=angle;
    needle.style.transform=`rotate(${angle}deg)`;
    for(const label of labels){
      const rotation=angle+Number(label.dataset.direction);
      label.style.transform=`translate(-50%,-50%) rotate(${rotation}deg) translateY(-27px) rotate(${-rotation}deg)`;
    }
    button.dataset.bearing=angle.toFixed(2);
  };
}
