/* MedStudy Anatomy Atlas v30 — open-source source meshes only.
 * The viewer never synthesizes human anatomy or substitutes male meshes for female ones.
 * Renderer UI is independent of the anatomy source manifest and educational cards.
 */
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';

const keyOf = v => String(v??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clamp = (v,a,b) => Math.min(b,Math.max(a,v));
const fileName = url => String(url||'').split('?')[0].split('/').pop();
const palette = {
  skeletal:'#e7d9c4',articular:'#a1c8d2',muscular:'#bb7270',nervous:'#efc77d',
  cardiovascular:'#d96c73',lymphatic:'#89c7ac',respiratory:'#c9a1b8',
  digestive:'#bc977b',renal:'#b89bcf',endocrine:'#e5bc8b',
  reproductive:'#c8a2ba',integumentary:'#d6af9d',visceral:'#ad8b90',regional:'#9fb4d0'
};
function medicalColor(system,record,mesh){
  const s=keyOf(system.id),name=(record?.name_en||mesh?.name||'').toLowerCase();
  if(/cardiovascular|visceral|regional/.test(s)){
    if(/vein|vena|venous|sinus venos|vena cava|atrium/.test(name))return '#7a9bdf';
    if(/artery|arterial|aorta|aortic|coronar/.test(name))return '#d9656c';
    if(/heart|ventricle|myocard/.test(name))return '#b85c6c';
  }
  if(/respiratory/.test(s)){
    if(/bronch|trachea|larynx/.test(name))return '#e2c5ac';
    if(/lung|pulmon/.test(name))return '#d29eaf';
  }
  if(/digestive/.test(s)){
    if(/liver|hepatic/.test(name))return '#9e5b63';
    if(/gall|biliar/.test(name))return '#9aae7c';
  }
  return system.color||palette[s]||'#b6b5bf';
}

export class AnatomyRenderer {
  constructor(container,{onSelect,onProgress,onMeshCount,onHover}={}){
    this.container=container;
    this.onSelect=onSelect||(()=>{});
    this.onProgress=onProgress||(()=>{});
    this.onMeshCount=onMeshCount||(()=>{});
    this.onHover=onHover||(()=>{});
    this.scene=new THREE.Scene();
    this.root=new THREE.Group();this.scene.add(this.root);
    this.camera=new THREE.PerspectiveCamera(36,1,.001,100000);
    this.camera.position.set(0,0,5);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.42;
    this.renderer.setPixelRatio(Math.min(1.75,window.devicePixelRatio||1));
    this.renderer.setClearColor(0x07152b,0);
    this.renderer.localClippingEnabled=true;
    this.renderer.domElement.setAttribute('aria-label','Selectable 3D anatomical structures');
    this.renderer.domElement.style.touchAction='none';
    container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);
    this.controls.enableDamping=true;this.controls.dampingFactor=.09;
    this.controls.enablePan=true;this.controls.screenSpacePanning=true;
    this.controls.minDistance=.001;this.controls.maxDistance=100000;
    this.scene.add(new THREE.HemisphereLight(0xeef6ff,0x253b65,1.65));
    const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(6,12,8);this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xaac8ff,1.35);fill.position.set(-9,2,-7);this.scene.add(fill);
    const rim=new THREE.DirectionalLight(0xffddbb,.6);rim.position.set(2,-6,5);this.scene.add(rim);
    this.gltf=new GLTFLoader();this.draco=new DRACOLoader();
    this.draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/libs/draco/');
    this.gltf.setDRACOLoader(this.draco);
    this.materialCache=new Map();this.loaded=new Map();this.visible=new Map();this._generation=0;
    this.allMeshes=[];this.allRecords=new Map();this.meshByRecord=new Map();
    this.selected=null;this.selectedGroup=[];this.isolatedId=null;
    this.opacity=1;this.explode=0;this.cut=false;this.clipAxis='x';this.clipPercent=50;
    this.clippingPlane=new THREE.Plane();this.raycaster=new THREE.Raycaster();this.pointer=new THREE.Vector2();
    this.geometrySize=1;this._start=null;this._lastPick=null;this._hoverTimer=0;
    this.renderer.domElement.addEventListener('pointerdown',e=>{this._start={x:e.clientX,y:e.clientY};});
    this.renderer.domElement.addEventListener('pointerup',e=>this._pick(e));
    this.renderer.domElement.addEventListener('pointermove',e=>this._hover(e));
    this.renderer.domElement.addEventListener('pointerleave',()=>this.onHover(null));
    this._resizeObserver=new ResizeObserver(()=>this.resize());this._resizeObserver.observe(container);
    this._running=true;
    const loop=()=>{if(!this._running)return;requestAnimationFrame(loop);if(!document.hidden){this.controls.update();this.renderer.render(this.scene,this.camera);}};
    loop();this.resize();
  }
  resize(){const r=this.container.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);}
  _material(hex){
    const color=new THREE.Color(hex);
    const k=color.getHexString();
    if(!this.materialCache.has(k))this.materialCache.set(k,new THREE.MeshStandardMaterial({color,roughness:.77,metalness:0,side:THREE.DoubleSide}));
    return this.materialCache.get(k);
  }
  _recordIndex(records){
    const m=new Map();
    for(const r of records||[]){
      for(const k of [r.node,r.organ_id,r.name_en,r.ta2_latin]){
        if(!k)continue;
        const key=keyOf(k);if(!m.has(key))m.set(key,r);
      }
    }
    return m;
  }
  _matchRecord(mesh,index){
    for(let item=mesh;item&&item!==this.root;item=item.parent){
      for(const k of [item.userData?.organ_id,item.userData?.organId,item.userData?.id,item.userData?.originalName,item.name]){
        if(!k)continue;
        const raw=keyOf(k),record=index.get(raw);if(record)return record;
        // Blender may append .001 to duplicate node names. Only strip explicit suffixes.
        const base=String(k).replace(/\.\d{3,4}$/,'');
        if(base!==k&&index.has(keyOf(base)))return index.get(keyOf(base));
      }
    }
    return null;
  }
  async _fetchGLB(url,onProgress){
    return new Promise((resolve,reject)=>{
      let finished=false;
      const timeout=setTimeout(()=>{if(!finished){finished=true;reject(new Error('Timed out: '+fileName(url)));}},70000);
      this.gltf.load(url,result=>{if(!finished){finished=true;clearTimeout(timeout);resolve(result);}},ev=>{
        if(!finished&&ev.total>0)onProgress(clamp(Math.round(100*ev.loaded/ev.total),0,99));
      },e=>{if(!finished){finished=true;clearTimeout(timeout);reject(e instanceof Error?e:new Error(String(e)));}});
    });
  }
  async loadSystem(system,sex,records,sources){
    const generation=this._generation;
    const filename=system[sex];if(!filename)throw new Error('No matching '+sex+' mesh for '+system.name);
    if(this.loaded.has(system.id))return this.loaded.get(system.id);
    let last,asset;
    for(const url of sources){
      try{asset=await this._fetchGLB(url,p=>this.onProgress(system.id,p));break;}
      catch(e){last=e;console.warn('Anatomy asset failed:',url,e.message);}
    }
    if(generation!==this._generation)throw new Error('Outdated model request was cancelled');
    if(!asset?.scene)throw new Error('Unable to load '+fileName(filename)+'. '+String(last?.message||'Asset unavailable'));
    const object=asset.scene,index=this._recordIndex(records),meshes=[];
    object.traverse(node=>{
      if(!node.isMesh||!node.geometry)return;
      const rec=this._matchRecord(node,index);
      node.userData._record=rec;node.userData._systemId=system.id;
      node.userData._sourceName=node.name||'';
      node.userData._hidden=false;node.userData._originalPosition=node.position.clone();
      node.userData._baseMaterial=this._material(medicalColor(system,rec,node));
      node.material=node.userData._baseMaterial;
      meshes.push(node);
    });
    if(!meshes.length)throw new Error('The asset has no individually selectable polygon meshes: '+filename);
    this.root.add(object);
    this.loaded.set(system.id,{object,meshes,records,system,filename});this.visible.set(system.id,true);
    this.allMeshes.push(...meshes);this.allRecords.set(system.id,records);
    for(const m of meshes){
      const rec=m.userData._record;
      if(rec){const key=String(rec.organ_id);if(!this.meshByRecord.has(key))this.meshByRecord.set(key,[]);this.meshByRecord.get(key).push(m);}
    }
    this._prepareExplosion();this.setOpacity(this.opacity);this.setClipping(this.cut,this.clipAxis,this.clipPercent);
    this._refreshVisible();this.onMeshCount(this.allMeshes.length);
    return this.loaded.get(system.id);
  }
  _prepareExplosion(){
    const bb=new THREE.Box3().setFromObject(this.root);if(bb.isEmpty())return;
    const center=bb.getCenter(new THREE.Vector3());this.geometrySize=Math.max(.01,bb.getSize(new THREE.Vector3()).length());
    let n=0;
    for(const mesh of this.allMeshes){
      if(mesh.userData._direction)continue;
      const b=new THREE.Box3().setFromObject(mesh),v=b.getCenter(new THREE.Vector3()).sub(center);
      if(v.lengthSq()<1e-10){const p=n*2.39996;v.set(Math.cos(p),Math.sin(p*1.6),Math.sin(p));}
      v.normalize();const rot=new THREE.Quaternion();mesh.parent.getWorldQuaternion(rot);
      mesh.userData._direction=v.applyQuaternion(rot.invert());n++;
    }
  }
  hasLoaded(id){return this.loaded.has(id);}
  getLoadedSystems(){return [...this.loaded.keys()];}
  getSystemMeshCount(id){return this.loaded.get(id)?.meshes.length||0;}
  getRecordMeshes(record){return record?.organ_id!=null?(this.meshByRecord.get(String(record.organ_id))||[]):[];}
  hasRecord(record){return this.getRecordMeshes(record).length>0;}
  getPickable(){return this.allMeshes.filter(m=>m.visible&&m.userData._record).map(m=>({mesh:m,record:m.userData._record}));}
  _hits(event){
    const b=this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX-b.left)/Math.max(1,b.width)*2-1,-((event.clientY-b.top)/Math.max(1,b.height)*2-1));
    this.raycaster.setFromCamera(this.pointer,this.camera);
    return this.raycaster.intersectObjects(this.allMeshes.filter(m=>m.visible),false);
  }
  _pick(event){
    if(!this._start||event.button!==0)return;
    const dist=Math.hypot(event.clientX-this._start.x,event.clientY-this._start.y);this._start=null;
    if(dist>8)return;
    const hits=this._hits(event);if(!hits.length){this.onSelect(null,null,null);return;}
    let i=0;
    if(event.shiftKey&&this._lastPick&&Math.hypot(this._lastPick.x-event.clientX,this._lastPick.y-event.clientY)<22)i=(this._lastPick.index+1)%hits.length;
    const mesh=hits[i].object;this._lastPick={x:event.clientX,y:event.clientY,index:i};
    this.selectMesh(mesh);this.onSelect(mesh.userData._record,mesh.userData._sourceName,mesh);
  }
  _hover(e){
    if(e.buttons||performance.now()-this._hoverTimer<110)return;
    this._hoverTimer=performance.now();const hit=this._hits(e)[0]?.object;
    this.onHover(hit?{record:hit.userData._record,name:hit.userData._sourceName}:null);
  }
  _paint(mesh,on){
    if(!mesh)return;
    if(on){
      if(!mesh.userData._selectionMat){
        const mat=mesh.userData._baseMaterial.clone();mat.emissive=new THREE.Color('#4daeff');mat.emissiveIntensity=.52;
        mat.color.copy(mesh.userData._baseMaterial.color).lerp(new THREE.Color('#def5ff'),.25);
        mesh.userData._selectionMat=mat;
      }
      mesh.material=mesh.userData._selectionMat;
    }else mesh.material=mesh.userData._baseMaterial;
  }
  selectMesh(mesh){
    for(const old of this.selectedGroup)this._paint(old,false);
    this.selected=mesh||null;
    this.selectedGroup=mesh?(mesh.userData._record?this.getRecordMeshes(mesh.userData._record):[mesh]):[];
    for(const m of this.selectedGroup)this._paint(m,true);
    this._refreshVisible();
    return !!mesh;
  }
  selectRecord(record){
    const meshes=this.getRecordMeshes(record);
    if(!meshes.length)return false;
    const mesh=meshes[0];this.setSystemVisible(mesh.userData._systemId,true);this.selectMesh(mesh);this.focusMesh(mesh);return true;
  }
  clearSelection(){for(const m of this.selectedGroup)this._paint(m,false);this.selected=null;this.selectedGroup=[];}
  _refreshVisible(){
    for(const m of this.allMeshes){
      const id=m.userData._record?.organ_id;
      const same=this.isolatedId==null||(id!=null?String(id)===this.isolatedId:this.selected===m);
      m.visible=this.visible.get(m.userData._systemId)!==false&&!m.userData._hidden&&same;
    }
  }
  setRecordVisible(record,value){
    const meshes=this.getRecordMeshes(record);if(!meshes.length)return false;
    for(const m of meshes)m.userData._hidden=!value;
    if(value)this.visible.set(meshes[0].userData._systemId,true);
    if(value)this.isolatedId=null;
    this._refreshVisible();return true;
  }
  isRecordVisible(record){const meshes=this.getRecordMeshes(record);return meshes.some(m=>m.visible);}
  setSystemVisible(id,value){this.visible.set(id,!!value);if(value&&this.isolatedId!=null)this.isolatedId=null;this._refreshVisible();}
  showOnlySystem(id){
    this.isolatedId=null;this.clearSelection();
    for(const k of this.loaded.keys())this.visible.set(k,k===id);
    this._refreshVisible();this.fitView();
  }
  restoreCurrent(id){
    this.isolatedId=null;
    for(const m of this.allMeshes)if(m.userData._systemId===id)m.userData._hidden=false;
    if(id)this.visible.set(id,true);
    this._refreshVisible();this.setExplode(0);return true;
  }
  hideSelected(){if(!this.selected)return false;for(const m of this.selectedGroup)m.userData._hidden=true;this._refreshVisible();return true;}
  isolateSelected(){if(!this.selected)return false;
    this.isolatedId=this.selected.userData._record?.organ_id!=null?String(this.selected.userData._record.organ_id):'__unnamed__';
    this._refreshVisible();this.fitView();return true;
  }
  showAll(){this.isolatedId=null;for(const m of this.allMeshes)m.userData._hidden=false;for(const k of this.loaded.keys())this.visible.set(k,true);this._refreshVisible();this.setExplode(0);return true;}
  setOpacity(p){this.opacity=clamp(Number(p)||100,15,100)/100;
    for(const mat of [...this.materialCache.values(),...this.allMeshes.map(m=>m.userData._selectionMat).filter(Boolean)]){
      mat.opacity=this.opacity;mat.transparent=this.opacity<1;mat.depthWrite=this.opacity>.95;mat.needsUpdate=true;
    }
  }
  setClipping(enabled,axis='x',percent=50){
    this.cut=!!enabled;this.clipAxis=['x','y','z'].includes(axis)?axis:'x';this.clipPercent=clamp(Number(percent)||50,0,100);
    const box=new THREE.Box3().setFromObject(this.root);if(box.isEmpty())return;
    const n=new THREE.Vector3(this.clipAxis==='x'?1:0,this.clipAxis==='y'?1:0,this.clipAxis==='z'?1:0),p=new THREE.Vector3();
    p[this.clipAxis]=box.min[this.clipAxis]+(box.max[this.clipAxis]-box.min[this.clipAxis])*this.clipPercent/100;
    this.clippingPlane.setFromNormalAndCoplanarPoint(n,p);
    for(const mat of [...this.materialCache.values(),...this.allMeshes.map(m=>m.userData._selectionMat).filter(Boolean)]){
      mat.clippingPlanes=this.cut?[this.clippingPlane]:[];mat.needsUpdate=true;
    }
  }
  setExplode(percent){
    this.explode=clamp(Number(percent)||0,0,100)/100;
    const radius=this.geometrySize*.07*this.explode;
    for(const m of this.allMeshes){const base=m.userData._originalPosition,dir=m.userData._direction;if(base&&dir)m.position.copy(base).addScaledVector(dir,radius);}
  }
  _bounds(meshes){const b=new THREE.Box3();b.makeEmpty();for(const m of meshes)if(m.visible)b.expandByObject(m);return b;}
  _goTo(box,fit=true){
    if(box.isEmpty())return;
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const fov=this.camera.fov*Math.PI/180;
    const vertical=size.y/Math.max(.1,2*Math.tan(fov/2));
    const horizontal=size.x/Math.max(.1,2*Math.tan(fov/2)*this.camera.aspect);
    const radius=Math.max(size.length(),.001);
    const distance=Math.max(vertical,horizontal,radius*.28)*1.37 + size.z*.54;
    this.controls.target.copy(center);
    const vec=fit?new THREE.Vector3(.16,.08,1).normalize():this.camera.position.clone().sub(this.controls.target).normalize();
    this.camera.position.copy(center).addScaledVector(vec,Math.max(distance,radius*.3));
    this.camera.near=Math.max(.00001,distance/3000);this.camera.far=Math.max(100,distance*900);
    this.camera.updateProjectionMatrix();this.controls.minDistance=Math.max(.0001,distance*.025);this.controls.maxDistance=distance*14;this.controls.update();
  }
  fitView(){this._goTo(this._bounds(this.allMeshes),true);}
  focusMesh(mesh){if(!mesh)return;this._goTo(this._bounds(mesh.userData._record?this.getRecordMeshes(mesh.userData._record):[mesh]),true);}
  setView(which){
    const c=this.controls.target.clone(),dist=Math.max(.001,this.camera.position.distanceTo(c));
    const direction=which==='posterior'?new THREE.Vector3(0,0,-1):which==='lateral'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1);
    this.camera.position.copy(c).addScaledVector(direction,dist);this.controls.update();
  }
  snapshot(){this.renderer.render(this.scene,this.camera);const a=document.createElement('a');a.download='MedStudy_Anatomy_'+Date.now()+'.png';a.href=this.renderer.domElement.toDataURL('image/png');document.body.append(a);a.click();a.remove();}
  clear(){
    this._generation++;
    this.clearSelection();
    for(const m of this.allMeshes){m.userData._selectionMat?.dispose();}
    for(const {object} of this.loaded.values()){object.traverse(node=>{if(node.isMesh)node.geometry?.dispose();});this.root.remove(object);}
    this.loaded.clear();this.visible.clear();this.allMeshes=[];this.allRecords.clear();this.meshByRecord.clear();
    this.isolatedId=null;this.onMeshCount(0);this.onHover(null);
  }
  dispose(){this._running=false;this._resizeObserver?.disconnect();this.clear();for(const m of this.materialCache.values())m.dispose();this.materialCache.clear();this.draco.dispose();this.controls.dispose();this.renderer.dispose();}
}
