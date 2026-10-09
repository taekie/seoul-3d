import * as THREE from 'three';

// Retain every instance, but submit only spatial batches intersecting the view.
export function spatialInstances(source, cellSize=3500) {
  const cells=new Map(),array=source.instanceMatrix.array;
  for(let i=0;i<source.count;i++){
    const key=Math.floor(array[i*16+12]/cellSize)+','+Math.floor(array[i*16+14]/cellSize);
    if(!cells.has(key))cells.set(key,[]);cells.get(key).push(i);
  }
  const group=new THREE.Group();
  group.count=source.count;
  // Preserve instance lookup for geometry inspection and existing callers.
  group.getMatrixAt=(i,matrix)=>source.getMatrixAt(i,matrix);
  group.getColorAt=(i,color)=>source.getColorAt(i,color);
  for(const indices of cells.values()){
    const mesh=new THREE.InstancedMesh(source.geometry,source.material,indices.length);
    if(source.instanceColor)mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(indices.length*3),3);
    indices.forEach((i,k)=>{
      mesh.instanceMatrix.array.set(array.subarray(i*16,i*16+16),k*16);
      if(source.instanceColor)mesh.instanceColor.array.set(source.instanceColor.array.subarray(i*3,i*3+3),k*3);
    });
    mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
    mesh.computeBoundingSphere();mesh.computeBoundingBox();
    group.add(mesh);
  }
  return group;
}
