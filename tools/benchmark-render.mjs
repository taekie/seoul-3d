import {chromium} from 'playwright';
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
 await page.goto('http://127.0.0.1:8747/?city=seoul');await page.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:150000});
 await page.evaluate(()=>city.placeCamera(126.985,37.53,10500,.9,0));
 console.log(await page.evaluate(async()=>{
  city.qualityStart=Infinity;
  const original=poiLabels.update.bind(poiLabels),render=city.focus.render.bind(city.focus),ratio=city.renderer.getPixelRatio();
  let labelTime=0,labelCalls=0;poiLabels.update=(...args)=>{const t=performance.now();original(...args);labelTime+=performance.now()-t;labelCalls++;};
  const results=[];
  for(const mode of ['baseline','no-labels','no-new-landmarks','no-blur','ratio-1.25']){
   poiLabels.setEnabled(mode!=='no-labels');
   city.groups.landmarks.children.forEach((g,i)=>g.visible=mode!=='no-new-landmarks'||i<13);
   city.focus.render=mode==='no-blur'?()=>city.renderer.render(city.scene,city.camera):render;
   const r=mode==='ratio-1.25'?1.25:ratio;city.renderer.setPixelRatio(r);city.focus.composer.setPixelRatio(r);
   await new Promise(r=>setTimeout(r,800));labelTime=0;labelCalls=0;
   const frames=[],start=performance.now();let last=start;
   await new Promise(resolve=>{const tick=now=>{frames.push(now-last);last=now;if(now-start<4500)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);});
   const sorted=frames.slice(1).sort((a,b)=>a-b);
   results.push({mode,fps:+(frames.length*1000/(last-start)).toFixed(1),medianMs:sorted[Math.floor(sorted.length/2)],labelMs:+(labelTime/labelCalls).toFixed(2),triangles:city.renderer.info.render.triangles,drawCalls:city.renderer.info.render.calls});
  }
  return {viewport:[innerWidth,innerHeight],ratio,results};
 }));
}finally{await browser.close();}
