import {chromium} from 'playwright';import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const output=await mkdtemp(join(tmpdir(),'seoul-render-performance-'));
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=metal']});
try {
 const p=await browser.newPage({viewport:{width:1000,height:760},deviceScaleFactor:2}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8747/?city=seoul');await p.waitForFunction(()=>window.poiLabels?.stats.loaded&&!document.querySelector('#load'),null,{timeout:150000});
 const result=await p.evaluate(async()=>{
  city.qualityStart=Infinity;city.placeCamera(126.985,37.53,10500,.9,0);city.controls.update();
  const chunks=[];for(const g of [city.groups.buildings,city.groups.trees])g.traverse(o=>{if(o.isInstancedMesh)chunks.push(o);});
  const buildings=city.groups.buildings.children.reduce((n,o)=>n+o.count,0);
  const {captureMapCanvas}=await import('/map-export.js');
  // Compare exact rendered pixels with culling on and off, preserving draw order.
  city.renderer.info.autoReset=false;city.renderer.info.reset();
  const imageA=captureMapCanvas(city);const trianglesA=city.renderer.info.render.triangles;
  chunks.forEach(o=>o.frustumCulled=false);city.renderer.info.reset();
  const imageB=captureMapCanvas(city);const trianglesB=city.renderer.info.render.triangles;
  const a=imageA.getContext('2d').getImageData(0,0,imageA.width,imageA.height).data,b=imageB.getContext('2d').getImageData(0,0,imageB.width,imageB.height).data;
  let different=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>6)different++;
  chunks.forEach(o=>o.frustumCulled=true);city.renderer.info.autoReset=true;
  city.setRenderPixelRatio(1);city.qualityPixelRatio=1;const saved=captureMapCanvas(city);
  const capture={width:saved.width,height:saved.height,restoredRatio:city.renderer.getPixelRatio(),expectedWidth:Math.floor(innerWidth*city.restPixelRatio)};
  const kind=city.surfaceCover.kindAt(city.lonToX(126.972),city.latToY(37.500));
  return {buildings,originalCount:city.groups.buildings.count,batches:chunks.length,trianglesA,trianglesB,differentFraction:different/(imageA.width*imageA.height),capture,cemeteryKind:kind};
 });
 assert.equal(result.buildings,result.originalCount);assert(result.trianglesA<result.trianglesB*.8);assert(result.differentFraction<.001,'Culling must preserve visible pixels');assert.equal(result.capture.width,result.capture.expectedWidth);assert.equal(result.capture.restoredRatio,1);assert.equal(result.cemeteryKind,0);
 await p.evaluate(()=>city.placeCamera(126.972,37.501,3200,.9,0));await p.waitForTimeout(700);await p.screenshot({path:join(output,'national-cemetery.png')});assert.deepEqual(errors,[]);console.log({pass:true,...result,output});
}finally{await browser.close();}
