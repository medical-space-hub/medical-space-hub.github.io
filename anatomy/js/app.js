/* MedStudy Anatomy v22: open anatomical meshes with a transparent per-structure knowledge system. */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const strip=s=>String(s||'').trim();
const safe=s=>String(s||'').trim().slice(0,15000);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const VIS_KEYS={skeletal:'Skeletal',articular:'Skeletal',muscular:'Muscular',nervous:'Nervous',cardiovascular:'Cardiovascular',lymphatic:'Lymphatic',respiratory:'Respiratory',digestive:'Digestive',renal:'Urinary',endocrine:'Endocrine',reproductive:'Reproductive',integumentary:'Integumentary'};
const SYSTEM_ABBR={skeletal:'SK',articular:'JT',muscular:'MS',nervous:'NS',cardiovascular:'CV',lymphatic:'LY',respiratory:'RS',digestive:'GI',renal:'UR',endocrine:'EN',reproductive:'RP',integumentary:'IN',visceral:'VS',regional:'RG'};
const systemOrder=['Body structure','Circulation','Neural & special senses','Internal organs','Additional reference'];
const state={sources:null,systems:[],sex:'male',system:null,manifests:{},manifestFailures:{},records:[],cards:[],ownerCards:{},cmsContent:{},cmsOwner:false,cloudModels:[],visibility:{},renderer:null,engineFailure:'',selected:null,selectedMesh:null,quiz:false,quizTarget:null,quizCorrect:0,quizAttempts:0,clip:false,loadToken:0,loadedSex:'male',localCardKey:'msh.anatomy.owner-cards.v22',toastTimeout:null};
function toast(msg){const t=$('toast');t.textContent=String(msg);t.classList.add('on');clearTimeout(state.toastTimeout);state.toastTimeout=setTimeout(()=>t.classList.remove('on'),3200);}
function setLoading(title,detail='',pct=9){$('stagePlaceholder').hidden=true;$('errorStatus').hidden=true;$('loadStatus').hidden=false;$('loadTitle').textContent=title;$('loadDetail').textContent=detail;$('loadBar').style.width=Math.max(3,Math.min(100,pct))+'%';}
function stopLoading(){$('loadStatus').hidden=true;}
function showError(message){stopLoading();$('stagePlaceholder').hidden=true;$('errorStatus').hidden=false;$('errorText').textContent=message;}
function sysVisible(s){return state.cmsOwner||state.visibility?.systems?.[VIS_KEYS[s.id]||s.name]!==false;}
function currentSystems(){return state.systems.filter(s=>Boolean(s[state.sex])&&sysVisible(s));}
function systemById(id){return state.systems.find(s=>s.id===id);}
function currentManifest(){return state.manifests[state.sex];}
function manifestRecords(){return Array.isArray(currentManifest()?.organs)?currentManifest().organs:[];}
function sourceRecordsFor(system){return manifestRecords().filter(r=>r.mesh_file===system[state.sex]||r.system===system.id);}
function uniqueRecords(){const records=new Map();for(const r of state.records)records.set(String(r.organ_id),r);return [...records.values()];}
function contentKey(record){return norm(record?.name_en||record?.name||record?.organ_id);}
function matchEditorial(record){const key=contentKey(record);return state.cards.find(c=>norm(c.name)===key||norm(c.id)===norm(record?.organ_id))||null;}
function mergedCard(record){
  const original=matchEditorial(record)||{},stored=state.ownerCards[record?.organ_id]||state.ownerCards[contentKey(record)]||{};
  const host=state.cmsContent[original.id]||{};
  return {...original,...host,...stored};
}
function pathFor(record){return [record?.path].flat().filter(Boolean).join(' / ');}
function allFields(card){return card.fields&&typeof card.fields==='object'?card.fields:{};}
function indexStatus(){const n=manifestRecords().length;const hasGeom=state.renderer?.allMeshes?.length||0;return `${n.toLocaleString()} indexed structures / ${hasGeom.toLocaleString()} loaded meshes`;}
function updateFooter(){$('footerStat').textContent=indexStatus();$('coverageText').textContent=indexStatus();$('datasetBadge').textContent=(state.sex==='male'?'Male reference · Z-Anatomy':'Female reference · HRA partial anatomy') + (state.renderer?.loaded.size?` · ${state.renderer.loaded.size} systems`:'');}
function openLeft(){closeRight();$('leftRail').classList.add('open');$('mobileScrim').hidden=false;}
function closeLeft(){$('leftRail').classList.remove('open');if(!$('rightRail').classList.contains('open'))$('mobileScrim').hidden=true;}
function openRight(){closeLeft();if(matchMedia('(max-width:940px)').matches){$('rightRail').classList.add('open');$('mobileScrim').hidden=false;}}
function closeRight(){$('rightRail').classList.remove('open');if(!$('leftRail').classList.contains('open'))$('mobileScrim').hidden=true;}
function updateHeader(){const sys=systemById(state.system);$('currentSystemTitle').innerHTML='Anatomical Systems <span>/</span> '+esc(sys?.name||'Complete Catalog');$('stageHeading').textContent=sys?.name||'Explore the human body';$('stageCaption').textContent=sys?`Browse actual ${state.sex} reference geometry, choose a structure, and study its knowledge card.`:'Select a system to load actual, named anatomical meshes.';}
function renderSystems(){
  let html='';
  for(const group of systemOrder){const systems=state.systems.filter(s=>s.group===group&&sysVisible(s));if(!systems.length)continue;
    html+=`<div class="system-section-head">${esc(group.toUpperCase())}</div>`;
    for(const s of systems){const available=Boolean(s[state.sex]);const loaded=state.renderer?.hasLoaded(s.id);
      const count=manifestRecords().filter(r=>r.system===s.id).length;
      const sub=available?(count?`${count.toLocaleString()} indexed structures`:'Available model'):'Not available for this reference';
      html+=`<button class="system-item ${state.system===s.id?'active':''}" data-system="${esc(s.id)}" title="${esc(sub)}" aria-pressed="${state.system===s.id}"><span class="system-icon">${esc(SYSTEM_ABBR[s.id]||'3D')}</span><span class="system-name"><strong>${esc(s.name)}</strong><small>${esc(sub)}</small></span><i class="system-state ${!available?'missing':loaded?'loaded':''}"></i></button>`;
    }
  }
  if(state.cloudModels.length){
    html+='<div class="system-section-head">PUBLISHED OWNER MODELS</div>';
    for(const row of state.cloudModels){const id='owner-'+row.id;
      html+=`<button class="system-item" data-cloud-id="${esc(row.id)}"><span class="system-icon">GLB</span><span class="system-name"><strong>${esc(row.title_en||'Published structure')}</strong><small>Verified account-published GLB</small></span><i class="system-state ${state.renderer?.hasLoaded(id)?'loaded':''}"></i></button>`;
    }
  }
  $('systemList').innerHTML=html;
  $('systemList').querySelectorAll('button[data-system]').forEach(b=>b.addEventListener('click',()=>{closeLeft();chooseSystem(b.dataset.system);}));
  $('systemList').querySelectorAll('[data-cloud-id]').forEach(b=>b.addEventListener('click',()=>{closeLeft();loadOwnerModel(b.dataset.cloudId);}));
  $('systemCount').textContent=`${currentSystems().length}/${state.systems.length}`;
  updateFooter();
}
async function fetchJSON(url,timeoutMs=14000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const response=await fetch(url,{signal:controller.signal,cache:'default'});if(!response.ok)throw new Error(response.status+' '+url);return await response.json();}
  finally{clearTimeout(timer);}
}
async function localJSON(path,failValue){try{return await fetchJSON(path,7000);}catch(e){return failValue;}}
async function ensureManifest(sex){
  if(state.manifests[sex])return state.manifests[sex];
  if(state.manifestFailures[sex]&&Date.now()-state.manifestFailures[sex]<10000)throw Error('Reference manifest was not reachable. Retry in a moment.');
  const filename=state.sources?.sexes?.[sex]?.manifest;if(!filename)throw Error('Missing manifest configuration');
  let last;
  const urls=['./models/'+filename,state.sources.base_url+filename,state.sources.raw_url+filename];
  for(const url of urls){
    try{
      const data=await fetchJSON(url,url.includes('/models/')?2000:18000);
      if(!Array.isArray(data.organs)||data.organs.length<20)throw Error('Manifest has no valid anatomical structures');
      state.manifests[sex]=data;
      if(state.sex===sex){state.records=data.organs;renderSystems();}
      return data;
    }catch(error){last=error;console.warn('Anatomy manifest failed',url,error?.message);}
  }
  state.manifestFailures[sex]=Date.now();throw Error('Could not load '+sex+' anatomical index: '+(last?.message||'No network'));
}
function remoteAssetUrls(filename){return ['./models/'+filename,state.sources.base_url+filename,state.sources.raw_url+filename];}
async function ensureRenderer(){
  if(state.renderer)return state.renderer;
  if(state.engineFailure)throw Error(state.engineFailure);
  try{
    const module=await import('./viewer.js');
    const instance=new module.AnatomyRenderer($('viewerCanvas'),{
      onSelect:(record,name,mesh)=>on3DSelected(record,name,mesh),
      onProgress:(id,pct)=>{if(!$('loadStatus').hidden){$('loadBar').style.width=pct+'%';$('loadDetail').textContent=systemById(id)?.name+` · ${pct}%`; }},
      onMeshCount:()=>updateFooter()
    });
    state.renderer=instance;return instance;
  }catch(e){state.engineFailure='WebGL/Three.js cannot start: '+(e?.message||String(e));throw Error(state.engineFailure);}
}
async function ensureSystemLoaded(sys){
  const sex=state.sex,token=++state.loadToken;
  const system=systemById(sys);
  if(!system)throw Error('Unknown anatomical system: '+sys);
  if(!system[sex]){toast(`${system.name} has no validated ${sex} GLB in the current dataset.`);return false;}
  if(state.renderer?.hasLoaded(sys))return true;
  setLoading('Loading '+system.name,sex==='female'?'Female HRA reference geometry':'Male Z-Anatomy reference geometry',8);
  try{
    const manifest=await ensureManifest(sex);
    if(token!==state.loadToken||sex!==state.sex)return false;
    const renderer=await ensureRenderer();
    const records=manifest.organs.filter(r=>r.mesh_file===system[sex]||r.system===sys);
    await renderer.loadSystem(system,sex,records,remoteAssetUrls(system[sex]));
    if(token!==state.loadToken||sex!==state.sex)return false;
    stopLoading();$('stagePlaceholder').hidden=true;$('errorStatus').hidden=true;
    renderSystems();updateFooter();return true;
  }catch(error){if(token===state.loadToken){showError(error?.message||String(error));}return false;}
}
async function loadOwnerModel(id){
  const row=state.cloudModels.find(x=>String(x.id)===String(id));
  if(!row)return;
  const customId='owner-'+row.id;
  const title=safe(row.title_en||'Owner-provided anatomy model');
  const doc={id:customId,name:title,color:'#bba79a',[state.sex]:row.model_url};
  state.system=null;updateHeader();setLoading('Loading '+title,'Verified published GLB from MedStudy Storage');
  try{
    const renderer=await ensureRenderer();
    const record={organ_id:customId,name_en:title,system:'Owner supplied',mesh_file:row.model_url,path:[],userSource:true};
    await renderer.loadSystem(doc,state.sex,[record],[row.model_url]);
    stopLoading();renderSystems();renderDetail(record);state.selected=record;
    toast('Owner-published anatomical asset loaded. Confirm clinical provenance before teaching.');
  }catch(error){showError('Owner model could not be loaded: '+String(error?.message||error));}
}
async function chooseSystem(sys){
  state.system=sys;state.quiz=false;renderQuiz();updateHeader();renderSystems();
  const s=systemById(sys);if(s&&!sysVisible(s)){showError('This system has been hidden by the platform owner.');return;}if(!s?.[state.sex]){showError(`The ${s?.name||'selected system'} is not included in the verified ${state.sex} atlas. A male mesh is not substituted for missing female anatomy.`);return;}
  await ensureSystemLoaded(sys);
}
async function setSex(sex){
  if(sex!=='male'&&sex!=='female')return;
  if(state.sex!==sex){state.sex=sex;state.loadToken++;state.renderer?.clear();state.selected=null;state.selectedMesh=null;state.records=[];state.system=null;state.quiz=false;renderQuiz();$('errorStatus').hidden=true;$('stagePlaceholder').hidden=false;stopLoading();resetDetail();}
  for(const b of document.querySelectorAll('[data-sex]')){b.classList.toggle('active',b.dataset.sex===sex);b.setAttribute('aria-pressed',String(b.dataset.sex===sex));}
  updateHeader();renderSystems();updateFooter();
  try{await ensureManifest(sex);renderSystems();}catch(e){toast(e.message);}
}
function resetDetail(){$('detailBody').innerHTML='<div class="empty-detail"><div class="detail-symbol">+</div><h3>Select an anatomical structure</h3><p>Click a mesh or search by name. Every indexed structure has a name, a dataset reference, and an anatomical classification; expanded clinical fields appear only when verified content exists.</p></div>';$('hideBtn').disabled=true;$('isolateBtn').disabled=true;$('focusBtn').disabled=true;}
function buildRecordForUnindexed(name,mesh){return {organ_id:'unindexed:'+norm(name),name_en:name||'Unnamed polygon mesh',ta2_latin:'',system:mesh?.userData?._systemId||state.system||'Unclassified',mesh_file:state.renderer?.loaded?.get(mesh?.userData?._systemId)?.filename||'',path:[],unindexed:true};}
function on3DSelected(record,name,mesh){
  if(state.quiz){gradeQuiz(record,mesh);return;}
  if(!mesh){return;}
  state.selected=record||buildRecordForUnindexed(name,mesh);state.selectedMesh=mesh;
  renderDetail(state.selected);openRight();
}
function renderDetail(record){
  if(!record)return resetDetail();
  state.selected=record;
  const card=mergedCard(record),d=strip(card.overview||''),rel=strip(card.relations||''),fun=strip(card.function||''),clin=strip(card.clinical||'');
  const system=systemById(record.system);
  const path=pathFor(record);
  const sections=[];
  if(d)sections.push(['Overview',d]);
  if(rel)sections.push(['Anatomical relations',rel]);
  if(fun)sections.push(['Function',fun]);
  if(clin)sections.push(['Clinical correlation',clin]);
  for(const [k,v] of Object.entries(allFields(card)))if(v)sections.push([k,v]);
  const complete=sections.length>0;
  const blocks=sections.map(([k,v])=>`<div class="detail-block"><h3>${esc(k)}</h3><p>${esc(v)}</p></div>`).join('');
  const source=record.userSource?'Owner-supplied external GLB: independent source verification required':state.sex==='female'?'NIH HuBMAP HRA · Visible Human Female':'BodyParts3D / Z-Anatomy';
  $('detailBody').innerHTML=`<div class="selected-detail"><span class="eyebrow">${esc((system?.name||record.system||'Anatomy').toUpperCase())}</span><h2>${esc(record.name_en||record.name||record.organ_id)}</h2>${record.ta2_latin?`<p class="latin">${esc(record.ta2_latin)}</p>`:''}<div class="tagline"><span>${esc(state.sex.toUpperCase())}</span><span>${esc(record.system||'Unclassified')}</span>${complete?'<span>EDITORIAL CONTENT</span>':'<span>INDEXED STRUCTURE</span>'}</div><div class="detail-block"><h3>Source anatomy / hierarchy</h3><p>${esc(path||'Hierarchy not provided by this dataset.')}</p></div>${blocks}${!complete?'<div class="detail-block warning"><h3>Clinical text not yet reviewed</h3><p>This source provides a genuine named mesh and atlas classification but does not supply a verified overview, function, vascular supply or clinical significance for this exact structure. No medical claims have been invented.</p></div>':''}<div class="detail-block"><h3>Original model source</h3><p>${esc(source)}</p></div><p class="id-row">Structure ID: ${esc(record.organ_id)}<br>Model: ${esc(record.mesh_file||'Index only')}<br>Mesh node: ${esc(record.node||'No verified identifier')}</p><div class="detail-buttons"><button id="focusFromDetails">Focus 3D</button><button id="isolateFromDetails">Isolate structure</button>${state.cmsOwner||window.self===window.top?'<button id="editSelectedCard">Edit card</button>':''}</div></div>`;
  $('focusFromDetails')?.addEventListener('click',()=>{if(state.selectedMesh)state.renderer?.focusMesh(state.selectedMesh);else focusRecord(record);closeRight();});
  $('isolateFromDetails')?.addEventListener('click',()=>{if(state.selectedMesh){state.renderer?.isolateSelected();closeRight();}else focusRecord(record);});
  $('editSelectedCard')?.addEventListener('click',openEditor);
  const haveMesh=Boolean(state.selectedMesh);for(const id of ['hideBtn','isolateBtn','focusBtn'])$(id).disabled=!haveMesh;
}
async function focusRecord(record){
  if(!record)return;
  const sys=record.system;if(sys!==state.system){state.system=sys;renderSystems();updateHeader();}
  const ok=await ensureSystemLoaded(sys);
  if(!ok)return;
  const selected=state.renderer?.selectRecord(record);
  if(!selected){toast('The source index names this structure but did not match a standalone selectable mesh.');state.selectedMesh=null;}else{state.selectedMesh=state.renderer.selected;}
  renderDetail(record);openRight();
}
function searchItems(q){
  const search=norm(q);if(search.length<2)return[];
  const records=uniqueRecords();
  return records.filter(r=>sysVisible(systemById(r.system)||{id:r.system,name:r.system})&&(state.cmsOwner||state.visibility?.structures?.[r.organ_id]!==false)).filter(r=>[r.name_en,r.organ_id,r.ta2_latin,pathFor(r)].some(k=>norm(k).includes(search))).slice(0,55);
}
function renderSearch(){
  const query=$('structureSearch').value;
  const results=$('searchResults');
  if(norm(query).length<2){results.hidden=true;results.innerHTML='';return;}
  const matches=searchItems(query);
  results.hidden=false;
  results.innerHTML=matches.length?matches.map((r,i)=>`<button class="search-result" data-result="${i}"><b>${esc(r.name_en||r.organ_id)}</b><small>${esc(r.system||'Anatomy')} · ${esc(pathFor(r)||r.ta2_latin||'Reference structure')}</small></button>`).join(''):'<div class="search-empty">No indexed structures match. Try another name or check the selected reference sex.</div>';
  results.querySelectorAll('[data-result]').forEach(b=>b.addEventListener('click',()=>{$('structureSearch').value=matches[Number(b.dataset.result)].name_en;results.hidden=true;closeLeft();state.selectedMesh=null;renderDetail(matches[Number(b.dataset.result)]);focusRecord(matches[Number(b.dataset.result)]);}));
}
function setOpacity(value){$('opacityValue').textContent=value+'%';state.renderer?.setOpacity(value);}
function setExplosion(value){$('explodeValue').textContent=value+'%';state.renderer?.setExplode(value);}
function updateClip(){state.renderer?.setClipping(state.clip,$('clipAxis').value,$('clipSlider').value);$('cutBtn').classList.toggle('active',state.clip);$('cutOptions').hidden=!state.clip;}
async function loadAll(){const list=currentSystems();if(!list.length)return;toast('Loading '+list.length+' authentic system models on demand. This may use significant data.');let count=0;for(const s of list){const result=await ensureSystemLoaded(s.id);if(result)count++;else{if(state.engineFailure)break;}}state.system=null;updateHeader();renderSystems();if(count){state.renderer?.fitView();toast(`${count} systems loaded. All models are original source geometry.`);}}
function quizPool(){return state.renderer?.getPickable().filter(x=>x.record?.name_en)||[];}
function renderQuiz(){const b=$('quizBanner');b.hidden=!state.quiz;$('quizBtn').classList.toggle('active',state.quiz);if(state.quiz){$('quizScore').textContent=`${state.quizCorrect} correct / ${state.quizAttempts} attempts`;}}
function newQuiz(){const items=quizPool();if(items.length<2){toast('Load a system with at least two indexed selectable meshes for the identification quiz.');return;}state.quiz=true;state.selected=null;state.selectedMesh=null;state.renderer?.clearSelection();const item=items[Math.floor(Math.random()*items.length)];state.quizTarget=item.record;$('quizPrompt').textContent='Find: '+item.record.name_en;renderQuiz();closeRight();}
function gradeQuiz(record,mesh){if(!state.quiz||!state.quizTarget)return;state.quizAttempts++;const match=record?.organ_id===state.quizTarget.organ_id;if(match){state.quizCorrect++;toast('Correct: '+state.quizTarget.name_en);state.renderer?.selectMesh(mesh);setTimeout(newQuiz,550);}else{toast(`Not yet. You selected ${record?.name_en||'an unnamed mesh'}. Try again.`);}renderQuiz();}
function stopQuiz(){state.quiz=false;state.quizTarget=null;renderQuiz();toast('Identification quiz ended.');}
function downloadJSON(name,json){const blob=new Blob([JSON.stringify(json,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
function openEditor(){if(!state.selected){toast('Select a structure first.');return;}if(!state.cmsOwner&&window.self!==window.top){toast('Owner permission required for the reference editor.');return;}const rec=state.selected;const card=mergedCard(rec);$('editCardName').value=rec.name_en||rec.name||rec.organ_id;$('editCardOverview').value=strip(card.overview||'');$('editorNote').textContent='Changes will be stored locally until exported. No cloud publication is claimed.';$('cardModal').hidden=false;}
function saveEditor(){const rec=state.selected;if(!rec)return;state.ownerCards[rec.organ_id]={overview:$('editCardOverview').value.trim().slice(0,6000)};try{localStorage.setItem(state.localCardKey,JSON.stringify(state.ownerCards));}catch(e){toast('Local storage unavailable; export the JSON.');}$('cardModal').hidden=true;renderDetail(rec);toast('Saved locally. Export JSON and publish it into anatomy/data/owner_cards.json to share with learners.');}
async function importCards(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>3e6)throw Error('JSON is larger than 3 MB');const raw=JSON.parse(await file.text());if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Expected a JSON object');state.ownerCards={...state.ownerCards,...raw};localStorage.setItem(state.localCardKey,JSON.stringify(state.ownerCards));$('editorNote').textContent='Imported '+Object.keys(raw).length+' locally saved entries.';if(state.selected)renderDetail(state.selected);}catch(e){toast('Invalid card file: '+e.message);}}
function rootConfiguration(){if(window.parent!==window){window.parent.postMessage({type:'MSH_ANATOMY_READY'},location.origin);}}
function announceExit(){if(window.parent!==window)window.parent.postMessage({type:'MSH_ANATOMY_EXIT'},location.origin);else location.href='../index.html';}
function wireEvents(){
  $('backToHub').addEventListener('click',announceExit);
  for(const b of document.querySelectorAll('[data-sex]'))b.addEventListener('click',()=>setSex(b.dataset.sex));
  $('startExplore').addEventListener('click',()=>chooseSystem('skeletal'));
  $('structureSearch').addEventListener('input',renderSearch);
  $('retryBtn').addEventListener('click',()=>{state.engineFailure='';state.manifestFailures={};state.system&&chooseSystem(state.system);});
  $('allSystemsBtn').addEventListener('click',loadAll);
  $('resetViewBtn').addEventListener('click',()=>state.renderer?.fitView());
  $('showAllBtn').addEventListener('click',()=>{state.renderer?.showAll();state.renderer?.fitView();$('toggleSystemBtn').textContent='Hide system';$('explodeSlider').value=0;setExplosion(0);});
  $('toggleSystemBtn').addEventListener('click',()=>{
    if(!state.system||!state.renderer?.hasLoaded(state.system)){toast('Choose and load a system first.');return;}
    const shown=state.renderer.visible.get(state.system)!==false;
    state.renderer.setSystemVisible(state.system,!shown);
    $('toggleSystemBtn').textContent=shown?'Show system':'Hide system';
  });
  $('isolateBtn').addEventListener('click',()=>state.renderer?.isolateSelected());
  $('hideBtn').addEventListener('click',()=>{state.renderer?.hideSelected();toast('Structure hidden. Use Show all to restore.');});
  $('focusBtn').addEventListener('click',()=>state.renderer?.focusMesh(state.selectedMesh));
  $('frontBtn').addEventListener('click',()=>state.renderer?.setView('anterior'));
  $('sideBtn').addEventListener('click',()=>state.renderer?.setView('lateral'));
  $('backBtn').addEventListener('click',()=>state.renderer?.setView('posterior'));
  $('opacitySlider').addEventListener('input',e=>setOpacity(e.target.value));
  $('explodeSlider').addEventListener('input',e=>setExplosion(e.target.value));
  $('cutBtn').addEventListener('click',()=>{state.clip=!state.clip;updateClip();});
  $('clipAxis').addEventListener('change',updateClip);$('clipSlider').addEventListener('input',updateClip);
  $('snapshotBtn').addEventListener('click',()=>{try{state.renderer?.snapshot();}catch(e){toast('Screenshot unavailable: '+e.message);}});
  $('quizBtn').addEventListener('click',()=>state.quiz?stopQuiz():newQuiz());$('nextQuizBtn').addEventListener('click',newQuiz);$('stopQuizBtn').addEventListener('click',stopQuiz);
  $('helpBtn').addEventListener('click',()=>{$('helpModal').hidden=false;});
  $('closeHelp').addEventListener('click',()=>{$('helpModal').hidden=true;});
  $('helpOkay').addEventListener('click',()=>{$('helpModal').hidden=true;});
  $('mobileMenuBtn').addEventListener('click',openLeft);$('mobileCloseDetails').addEventListener('click',closeRight);$('mobileScrim').addEventListener('click',()=>{closeLeft();closeRight();});
  $('addCardBtn').addEventListener('click',openEditor);$('closeCardModal').addEventListener('click',()=>{$('cardModal').hidden=true;});
  $('saveCardBtn').addEventListener('click',saveEditor);$('exportCardsBtn').addEventListener('click',()=>downloadJSON('owner_cards.json',state.ownerCards));$('importCards').addEventListener('change',importCards);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeRight();closeLeft();$('helpModal').hidden=true;$('cardModal').hidden=true;}if(e.key==='/'&&!e.target.closest('input,textarea')){e.preventDefault();openLeft();$('structureSearch').focus();}});
  window.addEventListener('message',ev=>{if(ev.source!==window.parent||ev.origin!==location.origin||!ev.data||typeof ev.data!=='object')return;
    if(ev.data.type==='MSH_ANATOMY_CONFIG'){
      state.cmsOwner=ev.data.owner===true;
      state.visibility=ev.data.visibility&&typeof ev.data.visibility==='object'?ev.data.visibility:{};
      state.cmsContent=ev.data.content&&typeof ev.data.content==='object'?ev.data.content:{};
      state.cloudModels=Array.isArray(ev.data.models)?ev.data.models.filter(x=>x&&/^[a-f0-9-]{32,36}$/i.test(String(x.id))&&/^https:\/\//.test(String(x.model_url||''))&&/\.glb(?:$|\?)/i.test(String(x.model_url||''))).slice(0,150):[];
      renderSystems();
      $('addCardBtn').hidden=!state.cmsOwner;
      if(state.selected)renderDetail(state.selected);
    }
    if(ev.data.type==='MSH_ANATOMY_PAUSE'){/* Keep the study viewport mounted without reloading heavy geometry. */}
  });
}
async function init(){
  wireEvents();
  try{const [sources,cards,owner]=await Promise.all([localJSON('./data/sources.json',null),localJSON('./data/editorial_cards.json',[]),localJSON('./data/owner_cards.json',{})]);
    if(!sources?.systems?.length)throw Error('Missing data/sources.json. Upload the anatomy folder alongside index.html.');
    state.sources=sources;state.systems=sources.systems;state.cards=Array.isArray(cards)?cards:[];
    state.ownerCards=owner&&typeof owner==='object'&&!Array.isArray(owner)?owner:{};
    try{const local=JSON.parse(localStorage.getItem(state.localCardKey)||'{}');state.ownerCards={...state.ownerCards,...local};}catch{}
    renderSystems();updateHeader();rootConfiguration();
    ensureManifest(state.sex).then(()=>renderSystems()).catch(e=>{console.warn(e);$('coverageText').textContent='3D index requires network or downloaded model files';});
    if(new URLSearchParams(location.search).get('system'))chooseSystem(new URLSearchParams(location.search).get('system'));
  }catch(e){showError(e?.message||String(e));}
}
init();
