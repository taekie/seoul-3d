import * as THREE from 'three';

// Terrain-conforming cropland fraction. Independent of the population denominator.
export class CroplandLayer {
 constructor(city){this.city=city;this.enabled=false;this.data=null;this.values=null;this.pending=null;}
 async load(){
  if(this.data)return;if(this.pending)return this.pending;
  this.pending=(async()=>{
   const [metaResponse,mapResponse]=await Promise.all([fetch('data/korea.cropland.json'),fetch('data/korea.cropland.png')]);
   if(!metaResponse.ok||!mapResponse.ok)throw new Error('농경지 자료를 불러오지 못했습니다.');
   const data=await metaResponse.json();const bitmap=await createImageBitmap(await mapResponse.blob());
   try{
    if(data.year!==2021||bitmap.width!==data.texture.width||bitmap.height!==data.texture.height)throw new Error('농경지 자료 크기가 맞지 않습니다.');
    const canvas=new OffscreenCanvas(bitmap.width,bitmap.height),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);
    const rgba=ctx.getImageData(0,0,bitmap.width,bitmap.height).data,values=new Uint8Array(bitmap.width*bitmap.height);
    for(let i=0;i<values.length;i++){values[i]=rgba[i*4];if(values[i]>100&&values[i]!==255)throw new Error('농경지 비율 값이 잘못되었습니다.');}
    this.data=data;this.values=values;this.rebuild();
   }finally{bitmap.close();}
  })();
  try{await this.pending;}finally{this.pending=null;}
 }
 setEnabled(enabled){this.enabled=enabled;if(this.city.groups.cropland)this.city.groups.cropland.visible=enabled;this.onChange?.();}
 rebuild(){
  if(!this.data)return;
  const city=this.city,{width,height}=this.data.texture,canvas=new OffscreenCanvas(width,height),ctx=canvas.getContext('2d'),pixels=ctx.createImageData(width,height);
  const color=city.themeName==='night'?[168,154,57]:[226,212,76];
  this.values.forEach((value,i)=>{if(value===255||value===0)return;const j=i*4;pixels.data[j]=color[0];pixels.data[j+1]=color[1];pixels.data[j+2]=color[2];pixels.data[j+3]=Math.round((value/100)**.65*230);});
  ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
  const ground=city.groups.terrain,geometry=ground.geometry.clone();geometry.deleteAttribute('color');
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  material.addEventListener('dispose',()=>texture.dispose());
  const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(ground.position);mesh.visible=this.enabled;mesh.userData.terrainDraped=true;
  city.groups.cropland=mesh;city.scene.add(mesh);
 }
}
