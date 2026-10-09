import * as THREE from 'three';
import {clay} from './miniature.js';
const ORDER=[1,3,4,0,2,6],KEYS={0:'grass',1:'wood',2:'golf',3:'farm',4:'site',6:'rock'};
// Rasterise full polygon rings once. A shared terrain mesh, not boundary-only triangles,
// carries this texture, so forests cannot bridge valleys and bury the trees beneath them.
export function prepareSurfaceCover(city){
 const t=city.terrain,W=2048,H=Math.max(1,Math.round(W*(t.maxY-t.minY)/(t.maxX-t.minX)));
 const canvas=new OffscreenCanvas(W,H),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const sx=W/(t.maxX-t.minX),sy=H/(t.maxY-t.minY);
 const passes=[...ORDER.map(kind=>city.data.greens.filter(p=>p.t===kind&&!p.override)),city.data.greens.filter(p=>p.override)];
 for(const polygons of passes){
  for(const poly of polygons){
   ctx.fillStyle=`rgb(${(poly.t+1)*24},0,0)`;
   ctx.beginPath();for(const ring of [poly.r,...(poly.holes||[])]){
    ring.forEach((value,i)=>{if(i%2)return;const x=(value-t.minX)*sx,y=(t.maxY-ring[i+1])*sy;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});ctx.closePath();
   }ctx.fill('evenodd');
  }
 }
 const pixels=ctx.getImageData(0,0,W,H).data,types=new Uint8Array(W*H),alpha=new Uint8Array(W*H);
 for(let i=0;i<types.length;i++){types[i]=Math.round(pixels[i*4]/24);alpha[i]=pixels[i*4+3];}
 return {W,H,types,alpha,kindAt(x,y){const i=Math.floor((x-t.minX)*sx),j=Math.floor((t.maxY-y)*sy);return i<0||i>=W||j<0||j>=H||alpha[j*W+i]<128?-1:types[j*W+i]-1;}};
}
export function buildSurfaceCover(city){
 const cover=city.surfaceCover??=prepareSurfaceCover(city),{W,H,types,alpha}=cover;
 const canvas=new OffscreenCanvas(W,H),ctx=canvas.getContext('2d'),image=ctx.createImageData(W,H);
 const palette={};for(const kind of ORDER){const color=new THREE.Color(city.theme.cover[KEYS[kind]]||'#a9aaa3').convertLinearToSRGB();palette[kind+1]=[color.r*255,color.g*255,color.b*255];}
 for(let i=0;i<types.length;i++){const color=palette[types[i]];if(!color)continue;const j=i*4;image.data[j]=color[0];image.data[j+1]=color[1];image.data[j+2]=color[2];image.data[j+3]=alpha[i];}
 ctx.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,city.renderer.capabilities.getMaxAnisotropy());
 const ground=city.groups.terrain,geometry=ground.geometry.clone();geometry.deleteAttribute('color');
 const material=clay({map:texture,alphaTest:.5,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(ground.position);mesh.receiveShadow=true;mesh.userData.terrainDraped=true;
 // City.clearGroups disposes materials but textures must also be released on each theme rebuild.
 material.addEventListener('dispose',()=>texture.dispose());return mesh;
}
