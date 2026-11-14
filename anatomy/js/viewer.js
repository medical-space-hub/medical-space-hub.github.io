import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

function normalize(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
function colorFromHex(hex){return new THREE.Color(hex||'#b4bbc6');}
function ext(name){return String(name||'').split('/').pop();}

export class AnatomyRenderer{
  constructor(container,{onSelect,onProgress,onMeshCount}={}){
    this.container=container;
    this.onSelect=onSelect||(()=>{});
    this.onProgress=onProgress||(()=>{});
    this.onMeshCount=onMeshCount||(()=>{});
    this.scene=new THREE.Scene();
    this.root=new THREE.Group();this.scene.add(this.root);
    this.camera=new THREE.PerspectiveCamera(42,1,.003,200000);
    this.camera.position.set(0,1.3,6);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(1.8,window.devicePixelRatio||1));
    this.renderer.setClearColor(0xffffff,0);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.25;
    this.renderer.localClippingEnabled=true;
    this.renderer.domElement.setAttribute('aria-label','Interactive 3D anatomy');
    container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.07;
    this.controls.minDistance=.02;this.controls.maxDistance=40000;
    this.controls.screenSpacePanning=true;
    this.scene.add(new THREE.HemisphereLight('#fbfdff','#77849b',2.3));
    const key=new THREE.DirectionalLight('#ffffff',3.6);key.position.set(8,13,11);this.scene.add(key);
    const fill=new THREE.DirectionalLight('#bedaff',1.6);fill.position.set(-9,4,-8);this.scene.add(fill);
    const rim=new THREE.DirectionalLight('#ffe8d1',.75);rim.position.set(1,-8,4);this.scene.add(rim);
    this.gltf=new GLTFLoader();
    this.draco=new DRACOLoader();
    this.draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/draco/');
    this.gltf.setDRACOLoader(this.draco);
    this.loaded=new Map();this.visible=new Map();this.allMeshes=[];this.allRecords=new Map();this.hidden=new Set();
    this.selected=null;this.isolated=null;this.opacity=1;this.explode=0;this.clipAxis='x';this.clipPercent=50;this.cut=false;
    this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();this.clippingPlane=new THREE.Plane();
    this.geometrySize=1;this.baselineCenter=new THREE.Vector3();
    this._pointerStart=null;
    this.renderer.domElement.addEventListener('pointerdown',e=>{this._pointerStart={x:e.clientX,y:e.clientY};});
    this.renderer.domElement.addEventListener('pointerup',e=>this._pick(e));
    this._resizeObserver=new ResizeObserver(()=>this.resize());this._resizeObserver.observe(container);
    this._running=true;
    this._animate=()=>{if(!this._running)return;requestAnimationFrame(this._animate);if(!document.hidden){this.controls.update();this.renderer.render(this.scene,this.camera);}};
    this._animate();this.resize();
  }
  resize(){const rect=this.container.getBoundingClientRect();const w=Math.max(1,rect.width),h=Math.max(1,rect.height);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  _systemMaterial(system){
    const mat=new THREE.MeshPhysicalMaterial({color:colorFromHex(system.color),roughness:.76,metalness:.02,side:THREE.DoubleSide,transparent:this.opacity<1,opacity:this.opacity,depthWrite:this.opacity>.92,flatShading:false});
    if(this.cut)mat.clippingPlanes=[this.clippingPlane];return mat;
  }
  _normal(node){return normalize(node);}
  _matchRecord(obj,index){
    for(let node=obj;node&&node!==this.root;node=node.parent){
      const raw=[node.name,node.userData?.name,node.userData?.originalName,node.userData?.organ_id,node.userData?.organId];
      for(const name of raw){const record=index.get(this._normal(name));if(record)return record;}
    }
    return null;
  }
  _buildRecordIndex(records){
    const index=new Map();
    for(const rec of records||[]){
      for(const s of [rec.node,rec.organ_id,rec.name_en,rec.ta2_latin]){
        if(s)index.set(this._normal(s),rec);
      }
    }
    return index;
  }
  async _fetchGLB(url,onProgress){
    // No geometry is synthesized. The loader is allowed to fail visibly.
    return new Promise((resolve,reject)=>{
      let done=false;
      const timer=setTimeout(()=>{if(!done){done=true;reject(new Error('Timed out fetching '+ext(url)));}},65000);
      this.gltf.load(url,result=>{if(!done){done=true;clearTimeout(timer);resolve(result);}},ev=>{
        if(!done&&ev.total>0)onProgress(Math.round(100*ev.loaded/ev.total));
      },error=>{if(!done){done=true;clearTimeout(timer);reject(error instanceof Error?error:new Error(String(error)));}});
    });
  }
  async loadSystem(system,sex,records,sources){
    const filename=system[sex];if(!filename)throw new Error('No verified '+sex+' model for '+system.name+'.');
    if(this.loaded.has(system.id)){this.setSystemVisible(system.id,true);return this.loaded.get(system.id);}
    let lastError,asset;
    for(const url of sources){
      try{asset=await this._fetchGLB(url,pct=>this.onProgress(system.id,pct));break;}
      catch(error){lastError=error;console.warn('GLB source failed:',url,error?.message||error);}
    }
    if(!asset)throw new Error('Cannot retrieve '+filename+': '+String(lastError?.message||lastError||'network error'));
    if(!asset.scene)throw new Error('GLB contains no 3D scene: '+filename);
    const object=asset.scene;object.userData._systemId=system.id;
    const recordIndex=this._buildRecordIndex(records);
    const list=[];
    object.traverse(node=>{
      if(!node.isMesh||!node.geometry)return;
      const mesh=node;
      mesh.material=this._systemMaterial(system);
      mesh.userData._systemId=system.id;
      mesh.userData._record=this._matchRecord(mesh,recordIndex);
      mesh.userData._sourceName=mesh.name||'';
      mesh.userData._originalPosition=mesh.position.clone();
      mesh.userData._baseColor=mesh.material.color.clone();
      mesh.userData._hidden=false;
      list.push(mesh);
    });
    if(list.length===0)throw new Error('Model does not contain selectable polygon meshes: '+filename);
    this.root.add(object);
    this.loaded.set(system.id,{object,meshes:list,records,system,filename});
    this.visible.set(system.id,true);
    this.allMeshes.push(...list);
    this.allRecords.set(system.id,records);
    this._prepareExplosion();
    this.setOpacity(this.opacity);this.setClipping(this.cut,this.clipAxis,this.clipPercent);
    this.fitView();this.onMeshCount(this.allMeshes.length);
    return this.loaded.get(system.id);
  }
  _prepareExplosion(){
    const box=new THREE.Box3().setFromObject(this.root);const center=box.getCenter(new THREE.Vector3());
    this.baselineCenter.copy(center);
    this.geometrySize=Math.max(.005,box.getSize(new THREE.Vector3()).length());
    let n=0;
    for(const mesh of this.allMeshes){
      if(mesh.userData._direction)continue;
      const mbox=new THREE.Box3().setFromObject(mesh);const wcenter=mbox.getCenter(new THREE.Vector3());
      const delta=wcenter.sub(center);
      if(delta.lengthSq()<1e-10){const p=n*2.39996;delta.set(Math.cos(p),Math.sin(p*1.6),Math.sin(p));}
      delta.normalize();
      const rot=new THREE.Quaternion();mesh.parent.getWorldQuaternion(rot);
      mesh.userData._direction=delta.applyQuaternion(rot.invert());n++;
    }
  }
  hasLoaded(systemId){return this.loaded.has(systemId);}
  getLoadedSystems(){return [...this.loaded.keys()];}
  getPickable(){return this.allMeshes.filter(m=>m.visible&&m.userData._record).map(m=>({mesh:m,record:m.userData._record}));}
  _pick(event){
    if(!this._pointerStart||event.button!==0)return;
    const delta=Math.hypot(event.clientX-this._pointerStart.x,event.clientY-this._pointerStart.y);this._pointerStart=null;
    if(delta>7)return;
    const box=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX-box.left)/Math.max(1,box.width)*2-1,-((event.clientY-box.top)/Math.max(1,box.height)*2-1));
    this.raycaster.setFromCamera(this.pointer,this.camera);
    const meshes=this.allMeshes.filter(m=>m.visible);
    const hit=this.raycaster.intersectObjects(meshes,false)[0];
    if(hit?.object){const mesh=hit.object;this.selectMesh(mesh);this.onSelect(mesh.userData._record,mesh.userData._sourceName,mesh);}else this.onSelect(null,null,null);
  }
  selectMesh(mesh){
    if(this.selected&&this.selected!==mesh)this._paint(this.selected,false);
    this.selected=mesh;if(mesh){this._paint(mesh,true);this.onMeshCount(this.allMeshes.length);}
  }
  selectRecord(record){
    if(!record)return false;
    const norm=this._normal(record.node||record.organ_id||record.name_en);
    const mesh=this.allMeshes.find(m=>m.userData._record?.organ_id===record.organ_id)
      ||this.allMeshes.find(m=>this._normal(m.name)===norm);
    if(mesh){this.setSystemVisible(mesh.userData._systemId,true);this.selectMesh(mesh);this.focusMesh(mesh);return true;}
    return false;
  }
  _paint(mesh,on){
    if(!mesh?.material)return;
    if(on){mesh.material.emissive=new THREE.Color('#2467f6');mesh.material.emissiveIntensity=.55;}
    else{mesh.material.emissive=new THREE.Color('#000000');mesh.material.emissiveIntensity=0;}
  }
  clearSelection(){if(this.selected)this._paint(this.selected,false);this.selected=null;}
  _refreshVisible(){
    for(const mesh of this.allMeshes){
      const key=mesh.userData._systemId;
      const inSystem=this.visible.get(key)!==false;
      const same=this.isolated?this.isolated===mesh:true;
      mesh.visible=inSystem&&!mesh.userData._hidden&&same;
    }
  }
  setSystemVisible(id,value){this.visible.set(id,Boolean(value));this._refreshVisible();}
  hideSelected(){if(!this.selected)return false;this.selected.userData._hidden=true;this._refreshVisible();return true;}
  isolateSelected(){if(!this.selected)return false;this.isolated=this.selected;this._refreshVisible();this.fitView();return true;}
  showAll(){this.isolated=null;for(const mesh of this.allMeshes)mesh.userData._hidden=false;for(const id of this.loaded.keys())this.visible.set(id,true);this._refreshVisible();this.setExplode(0);return true;}
  setOpacity(value){this.opacity=clamp(Number(value)||100,20,100)/100;for(const mesh of this.allMeshes){const m=mesh.material;m.opacity=this.opacity;m.transparent=this.opacity<1;m.depthWrite=this.opacity>=.92;m.needsUpdate=true;}}
  setClipping(enabled,axis='x',percent=50){
    this.cut=Boolean(enabled);this.clipAxis=['x','y','z'].includes(axis)?axis:'x';this.clipPercent=clamp(Number(percent)||50,0,100);
    const b=new THREE.Box3().setFromObject(this.root);const normal=new THREE.Vector3(this.clipAxis==='x'?1:0,this.clipAxis==='y'?1:0,this.clipAxis==='z'?1:0);
    const planePoint=new THREE.Vector3();planePoint[this.clipAxis]=b.min[this.clipAxis]+(b.max[this.clipAxis]-b.min[this.clipAxis])*this.clipPercent/100;
    this.clippingPlane.setFromNormalAndCoplanarPoint(normal,planePoint);
    for(const mesh of this.allMeshes){mesh.material.clippingPlanes=this.cut?[this.clippingPlane]:[];mesh.material.needsUpdate=true;}
  }
  setExplode(percent){
    this.explode=clamp(Number(percent)||0,0,100)/100;
    const radius=this.geometrySize*.085*this.explode;
    for(const mesh of this.allMeshes){const base=mesh.userData._originalPosition,dir=mesh.userData._direction;if(base&&dir)mesh.position.copy(base).addScaledVector(dir,radius);}
  }
  fitView(){
    if(!this.loaded.size)return;
    const box=new THREE.Box3();box.makeEmpty();
    for(const {meshes} of this.loaded.values())for(const mesh of meshes){if(mesh.visible)box.expandByObject(mesh);}
    if(box.isEmpty())return;
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const radius=Math.max(.01,size.length());
    const dist=radius*1.16;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(.22,.1,1).normalize().multiplyScalar(dist));
    this.camera.near=Math.max(.0001,dist/600);this.camera.far=Math.max(100,dist*180);this.camera.updateProjectionMatrix();
    this.controls.minDistance=dist*.03;this.controls.maxDistance=dist*8;
    this.controls.update();
  }
  focusMesh(mesh){if(!mesh)return;const box=new THREE.Box3().setFromObject(mesh);if(box.isEmpty())return;const c=box.getCenter(new THREE.Vector3()),size=Math.max(.003,box.getSize(new THREE.Vector3()).length());const dist=Math.max(size*1.5,this.geometrySize*.045);this.controls.target.copy(c);this.camera.position.copy(c).add(new THREE.Vector3(.25,.12,1).normalize().multiplyScalar(dist));this.controls.update();}
  setView(which){const c=this.controls.target.clone();const dist=Math.max(.02,this.camera.position.distanceTo(c));const dir=which==='posterior'?new THREE.Vector3(0,0,-1):which==='lateral'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1);this.camera.position.copy(c).addScaledVector(dir,dist);this.controls.update();}
  snapshot(){this.renderer.render(this.scene,this.camera);const a=document.createElement('a');a.download='medstudy-anatomy-'+Date.now()+'.png';a.href=this.renderer.domElement.toDataURL('image/png');document.body.append(a);a.click();a.remove();}
  clear(){
    this.clearSelection();for(const {object} of this.loaded.values()){object.traverse(node=>{if(node.isMesh){node.geometry?.dispose();node.material?.dispose();}});this.root.remove(object);}
    this.loaded.clear();this.visible.clear();this.allMeshes=[];this.allRecords.clear();this.hidden.clear();this.isolated=null;
    this.onMeshCount(0);
  }
}
