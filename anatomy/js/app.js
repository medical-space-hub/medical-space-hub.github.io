/* MedStudy Anatomy v30: accessible structure explorer + authentic source-linked anatomy atlas. */
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const strip=s=>String(s||'').trim();
const safe=s=>String(s||'').trim().slice(0,15000);
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const VIS_KEYS={skeletal:'Skeletal',articular:'Skeletal',muscular:'Muscular',nervous:'Nervous',cardiovascular:'Cardiovascular',lymphatic:'Lymphatic',respiratory:'Respiratory',digestive:'Digestive',renal:'Urinary',endocrine:'Endocrine',reproductive:'Reproductive',integumentary:'Integumentary'};
const SYSTEM_GUIDES={
  skeletal:'Bones form the structural framework of the body, protect internal organs and provide lever arms for muscles.',
  articular:'Joints, supporting ligaments and related connective tissues contribute to stability and controlled movement.',
  muscular:'Skeletal muscles generate movement, maintain posture and contribute to heat production.',
  nervous:'The nervous system includes central and peripheral neural structures involved in sensory processing, integration and motor control.',
  cardiovascular:'The heart and vessels transport blood through pulmonary and systemic circulation.',
  lymphatic:'Lymphatic vessels and organs support interstitial fluid return and immune defense.',
  respiratory:'Airways and lungs conduct air and enable exchange of oxygen and carbon dioxide.',
  digestive:'Digestive organs process food, absorb nutrients and eliminate indigestible residue.',
  renal:'Kidneys and urinary passages filter blood and regulate water, electrolytes and acid-base balance.',
  endocrine:'Endocrine organs release hormones that coordinate metabolism, growth and physiological homeostasis.',
  reproductive:'Reproductive anatomy comprises organs involved in gamete production, fertilization and reproductive function.',
  integumentary:'The skin and appendages form a protective barrier and contribute to sensation and thermoregulation.',
  visceral:'This reference group contains additional internal structures; verify each record’s individual anatomical classification.',
  regional:'Regional anatomy is organized by anatomical region and spatial relationships among structures.'
};
const SYSTEM_ABBR={skeletal:'SK',articular:'JT',muscular:'MS',nervous:'NS',cardiovascular:'CV',lymphatic:'LY',respiratory:'RS',digestive:'GI',renal:'UR',endocrine:'EN',reproductive:'RP',integumentary:'IN',visceral:'VS',regional:'RG'};
const systemOrder=['Body structure','Circulation','Neural & special senses','Internal organs','Additional reference'];
const state={sources:null,systems:[],sex:'male',system:null,manifests:{},manifestFailures:{},records:[],cards:[],ownerCards:{},cmsContent:{},cmsOwner:false,cloudModels:[],visibility:{},renderer:null,engineFailure:'',selected:null,selectedMesh:null,quiz:false,quizTarget:null,quizCorrect:0,quizAttempts:0,clip:false,loadToken:0,loadedSex:'male',localCardKey:'msh.anatomy.owner-cards.v22',toastTimeout:null,navMode:'systems',structureLimit:75,overlay:false,notes:{},favorites:[],viewVersion:30};
function toast(msg){const t=$('toast');t.textContent=String(msg);t.classList.add('on');clearTimeout(state.toastTimeout);state.toastTimeout=setTimeout(()=>t.classList.remove('on'),3200);}
function setLoading(title,detail='',pct=9){$('stagePlaceholder').hidden=true;$('errorStatus').hidden=true;$('loadStatus').hidden=false;$('loadTitle').textContent=title;$('loadDetail').textContent=detail;$('loadBar').style.width=Math.max(3,Math.min(100,pct))+'%';}
function stopLoading(){$('loadStatus').hidden=true;}
function showError(message){stopLoading();$('stagePlaceholder').hidden=true;$('errorStatus').hidden=false;$('errorText').textContent=message;}
function sysVisible(s){return state.cmsOwner||state.visibility?.systems?.[VIS_KEYS[s.id]||s.name]!==false;}
function currentSystems(){return state.systems.filter(s=>Boolean(s[state.sex])&&sysVisible(s));}
function systemById(id){return state.systems.find(s=>s.id===id);}
function currentManifest(){return state.manifests[state.sex];}
function manifestRecords(){return Array.isArray(currentManifest()?.organs)?currentManifest().organs:[];}
function sourceRecordsFor(system){
  if(!system)return [];
  const records=manifestRecords().filter(r=>r.mesh_file===system[state.sex]||r.system===system.id);
  if(records.length)return records;
  // Editorial-only cards remain accessible when a remote manifest is unreachable.
  return state.cards.filter(c=>norm(c.system)===norm(system.name.replace(' System',''))||norm(c.system)===norm(VIS_KEYS[system.id])).map(c=>({
    organ_id:'card:'+c.id,name_en:c.name,system:system.id,mesh_file:null,ta2_latin:'',path:[c.region||system.name],textOnly:true
  }));
}
function uniqueRecords(){
  const records=new Map();
  for(const r of state.records||[])records.set(String(r.organ_id),r);
  if(!records.size)for(const s of state.systems)for(const r of sourceRecordsFor(s))records.set(String(r.organ_id),r);
  return [...records.values()];
}
function contentKey(record){return norm(record?.name_en||record?.name||record?.organ_id);}
function matchEditorial(record){
  const k=contentKey(record),id=norm(record?.organ_id);
  const exact=state.cards.find(c=>norm(c.id)===id||norm(c.name)===k);
  if(exact)return exact;
  // Conservative match: a side-specific anatomy mesh can use a general card for the organ type.
  const clean=name=>String(name||'').toLowerCase().replace(/^(left|right|superior|inferior|anterior|posterior|medial|lateral)\s+/g,'').trim();
  const singular=name=>clean(name).replace(/ies$/,'y').replace(/s$/,'');
  const name=singular(String(record?.name_en||'').replace(/\s*\((left|right)\)\s*$/i,'').replace(/,\s*(left|right)\s*$/i,''));
  const candidates=state.cards.filter(c=>singular(c.name)===name&&name.length>3);
  if(candidates.length===1)return candidates[0];
  return null;
}
function mergedCard(record){
  const original=matchEditorial(record)||{},stored=state.ownerCards[record?.organ_id]||state.ownerCards[contentKey(record)]||{};
  const host=state.cmsContent[original.id]||{};
  return {...original,...host,...stored};
}
function pathFor(record){return [record?.path].flat().filter(Boolean).join(' / ');}
function allFields(card){return card.fields&&typeof card.fields==='object'?card.fields:{};}
function indexStatus(){const n=manifestRecords().length;const hasGeom=state.renderer?.allMeshes?.length||0;return `${n.toLocaleString()} indexed structures / ${hasGeom.toLocaleString()} loaded meshes`;}
function updateFooter(){
  if($('footerStat'))$('footerStat').textContent=indexStatus();
  if($('coverageText'))$('coverageText').textContent=indexStatus();
  if($('datasetBadge'))$('datasetBadge').textContent=(state.sex==='male'?'Male · Z-Anatomy':'Female · HRA partial')+(state.renderer?.loaded.size?` · ${state.renderer.loaded.size} models ready`:'');
}
function openLeft(){closeRight();$('leftRail').classList.add('open');$('mobileScrim').hidden=false;}
function closeLeft(){$('leftRail').classList.remove('open');if(!$('rightRail').classList.contains('open'))$('mobileScrim').hidden=true;}
function openRight(){closeLeft();if(matchMedia('(max-width:940px)').matches){$('rightRail').classList.add('open');$('mobileScrim').hidden=false;}}
function closeRight(){$('rightRail').classList.remove('open');if(!$('leftRail').classList.contains('open'))$('mobileScrim').hidden=true;}
function updateHeader(){
  const sys=systemById(state.system);
  $('currentSystemTitle').innerHTML='Body systems <span>/</span> '+esc(sys?.name||'Anatomy atlas');
  $('stageHeading').textContent=sys?.name||'Study real human anatomy';
  $('stageCaption').textContent=sys?`Select any indexed structure to inspect its model and linked medical card. ${state.sex==='female'?'Female coverage is partial.':''}`:
    'Choose a body system, browse its individual structures, and study the source-linked scientific cards.';
}
function renderSystems(){
  let html='';
  for(const group of systemOrder){const systems=state.systems.filter(s=>s.group===group&&sysVisible(s));if(!systems.length)continue;
    html+=`<div class="system-section-head">${esc(group.toUpperCase())}</div>`;
    for(const s of systems){const available=Boolean(s[state.sex]);const loaded=state.renderer?.hasLoaded(s.id);
      const count=sourceRecordsFor(s).length;
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
  $('systemList').querySelectorAll('button[data-system]').forEach(b=>b.addEventListener('click',()=>{chooseSystem(b.dataset.system);if(matchMedia('(max-width:660px)').matches)closeLeft();}));
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
      if(state.sex===sex){state.records=data.organs;renderSystems();renderStructureList();}
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
      onProgress:(id,pct)=>{if(id===state.system&&!$('loadStatus').hidden){$('loadBar').style.width=pct+'%';$('loadDetail').textContent=systemById(id)?.name+` · ${pct}%`; }},
      onMeshCount:()=>{updateFooter();renderStructureList();},
      onHover:hit=>{const el=$('meshHoverLabel');if(!el)return;el.textContent=hit?.record?.name_en||hit?.name||'';el.hidden=!hit||!el.textContent;}
    });
    state.renderer=instance;return instance;
  }catch(e){state.engineFailure='WebGL/Three.js cannot start: '+(e?.message||String(e));throw Error(state.engineFailure);}
}
async function ensureSystemLoaded(sys){
  const sex=state.sex,token=++state.loadToken;
  const system=systemById(sys);
  if(!system)throw Error('Unknown anatomical system: '+sys);
  if(!system[sex]){toast(`${system.name} has no verified ${sex} GLB in this reference.`);renderStructureList();return false;}
  const cached=state.renderer?.hasLoaded(sys);
  if(cached){if(!state.overlay)state.renderer.showOnlySystem(sys);else{state.renderer.setSystemVisible(sys,true);state.renderer.fitView();}renderStructureList();return true;}
  setLoading('Preparing '+system.name,sex==='female'?'Loading female HRA source meshes':'Loading Z-Anatomy source meshes',8);
  try{
    const manifest=await ensureManifest(sex);
    if(token!==state.loadToken||sex!==state.sex)return false;
    const renderer=await ensureRenderer();
    const records=manifest.organs.filter(r=>r.mesh_file===system[sex]||r.system===sys);
    const loaded=await renderer.loadSystem(system,sex,records,remoteAssetUrls(system[sex]));
    if(token!==state.loadToken||sex!==state.sex){renderer.setSystemVisible(sys,false);return false;}
    if(!state.overlay)renderer.showOnlySystem(sys);else{renderer.setSystemVisible(sys,true);renderer.fitView();}
    stopLoading();$('stagePlaceholder').hidden=true;$('errorStatus').hidden=true;
    if(!state.selected)renderSystemGuide(system);
    $('viewerHint').textContent=`${loaded.meshes.length.toLocaleString()} individually selectable mesh parts · Select a structure from the left panel or tap the model`;
    renderSystems();renderStructureList();updateFooter();return true;
  }catch(error){if(token===state.loadToken){showError(error?.message||String(error));renderStructureList();}return false;}
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
  const system=systemById(sys);
  state.system=sys;state.quiz=false;stopQuizQuiet();
  state.selected=null;state.selectedMesh=null;
  state.renderer?.clearSelection();
  if(!state.overlay&&state.renderer){for(const loadedId of state.renderer.getLoadedSystems())state.renderer.setSystemVisible(loadedId,false);}
  resetDetail();setActiveStructure(null);
  if(system)renderSystemGuide(system);
  updateHeader();renderSystems();setNavMode('structures');
  if(!system||!sysVisible(system)){showError('This system is unavailable or hidden by the platform owner.');return;}
  if(!system[state.sex]){
    showError('The '+system.name+' has no separate '+state.sex+' reference model. We do not substitute another anatomical sex or fabricate meshes.');
    renderStructureList();return;
  }
  await ensureSystemLoaded(sys);
}
async function setSex(sex){
  if(!['male','female'].includes(sex))return;
  if(state.sex!==sex){
    state.sex=sex;state.loadToken++;state.renderer?.clear();
    state.selected=null;state.selectedMesh=null;state.records=[];state.system=null;state.quiz=false;stopQuizQuiet();
    $('errorStatus').hidden=true;$('stagePlaceholder').hidden=false;stopLoading();resetDetail();setActiveStructure(null);setNavMode('systems');
  }
  for(const b of document.querySelectorAll('[data-sex]')){b.classList.toggle('active',b.dataset.sex===sex);b.setAttribute('aria-pressed',String(b.dataset.sex===sex));}
  updateHeader();renderSystems();renderStructureList();updateFooter();
  try{await ensureManifest(sex);renderSystems();renderStructureList();}catch(e){toast(e.message);renderStructureList();}
}
function renderSystemGuide(system){
  if(!system)return;
  const available=Boolean(system[state.sex]);
  const loaded=state.renderer?.hasLoaded(system.id),indexed=sourceRecordsFor(system).length;
  const guide=SYSTEM_GUIDES[system.id]||'Explore this anatomical reference by selecting an indexed structure.';
  const provenance=state.sex==='male'?'Z-Anatomy / BodyParts3D · CC BY-SA 4.0':'NIH Human Reference Atlas · CC BY 4.0 · partial female reference';
  $('detailBody').innerHTML=`<article class="selected-detail system-orientation"><span class="eyebrow">SYSTEM OVERVIEW</span><h2>${esc(system.name)}</h2><p class="system-guide-summary">${esc(guide)}</p><div class="identity-grid"><div><small>Reference</small><strong>${esc(state.sex==='male'?'Male':'Female · partial')}</strong></div><div><small>3D model</small><strong>${available?loaded?'Ready to explore':'Available · load required':'Not available'}</strong></div><div><small>Named structures</small><strong>${indexed.toLocaleString()} indexed entries</strong></div><div><small>Provenance</small><strong>${esc(provenance)}</strong></div></div><section class="detail-block"><h3>How to study</h3><p>Open the Structures tab, choose an anatomical structure, or tap a polygon in the 3D viewer. Choose Isolate, Hide or Focus to inspect it. Structure-specific clinical details appear only where a reviewed study card is available.</p></section><p class="availability-note">This system overview is not a replacement for individual anatomical descriptions.</p></article>`;
  for(const id of ['hideBtn','isolateBtn','focusBtn'])$(id).disabled=true;
}
function resetDetail(){
  $('detailBody').innerHTML='<div class="empty-detail"><div class="detail-symbol">+</div><h3>Every structure has an identity</h3><p>Open <b>Structures</b> and choose an organ, bone, nerve, or vessel. The source hierarchy and scientific card are shown here. Models are never replaced with unrelated geometry.</p></div>';
  for(const id of ['hideBtn','isolateBtn','focusBtn'])$(id).disabled=true;
}
function buildRecordForUnindexed(name,mesh){return {organ_id:'unindexed:'+norm(name),name_en:name||'Unnamed polygon mesh',ta2_latin:'',system:mesh?.userData?._systemId||state.system||'Unclassified',mesh_file:state.renderer?.loaded?.get(mesh?.userData?._systemId)?.filename||'',path:[],unindexed:true};}
function on3DSelected(record,name,mesh){
  if(state.quiz){gradeQuiz(record,mesh);return;}
  if(!mesh){setActiveStructure(null);return;}
  state.selected=record||buildRecordForUnindexed(name,mesh);state.selectedMesh=mesh;
  renderDetail(state.selected);setActiveStructure(state.selected);renderStructureList();openRight();
}
function renderDetail(record){
  if(!record){setActiveStructure(null);return resetDetail();}
  state.selected=record;
  const card=mergedCard(record),system=systemById(record.system);
  const fields=allFields(card),sections=[];
  for(const [title,value] of [['Overview',card.overview],['Anatomical relations',card.relations],['Function',card.function],['Clinical relevance',card.clinical]])if(strip(value))sections.push([title,strip(value)]);
  for(const [title,value] of Object.entries(fields))if(strip(value))sections.push([title,strip(value)]);
  const hasReview=sections.length>0,modelPresent=Boolean(state.renderer?.hasRecord(record)||record.unindexed&&state.selectedMesh),name=record.name_en||record.name||record.organ_id;
  const path=pathFor(record),key=recordKey(record),isFavorite=state.favorites.includes(key);
  const source=record.textOnly?'Editorial card (index offline) — not a confirmed GLB node':record.userSource?'Owner-supplied 3D asset (provenance requires confirmation)':state.sex==='female'?'NIH Human Reference Atlas · partial female reference':'Z-Anatomy / BodyParts3D source mesh';
  const guide=SYSTEM_GUIDES[record.system]||'Review the anatomical region and system classification in the source hierarchy.';
  const sourceNodes=`<div class="identity-grid"><div><small>System</small><strong>${esc(system?.name||record.system||'Not classified')}</strong></div><div><small>Reference</small><strong>${esc(state.sex==='female'?'Female (partial)':'Male')}</strong></div><div><small>3D linkage</small><strong>${modelPresent?'Selectable mesh ready':record.textOnly?'Text-only educational card':'Index entry · model not loaded'}</strong></div><div><small>Location / hierarchy</small><strong>${esc(path||card.region||'Source region not specified')}</strong></div></div>`;
  const article=sections.map(([k,v])=>`<section class="detail-block"><h3>${esc(k)}</h3><p>${esc(v)}</p></section>`).join('');
  const fallback=!hasReview?`<div class="detail-block knowledge-orientation"><h3>${esc(system?.name||'Anatomy')} · system orientation</h3><p>${esc(guide)}</p><small>This is general system context, not a clinical description of the selected structure. More detailed editorial content has not been reviewed for this specific record.</small></div>`:'';
  $('detailBody').innerHTML=`<article class="selected-detail"><div class="card-headline"><span class="eyebrow">${esc((system?.name||'ANATOMY').toUpperCase())}</span><button class="favorite-card" id="favoriteStructureBtn" aria-pressed="${isFavorite}" title="Save this structure to your browser">${isFavorite?'★':'☆'}</button></div><h2>${esc(name)}</h2>${record.ta2_latin?`<p class="latin">${esc(record.ta2_latin)}</p>`:''}<div class="tagline"><span>${hasReview?'SCIENTIFIC STUDY CARD':'SOURCE-INDEXED RECORD'}</span><span>${modelPresent?'3D SELECTABLE':'REFERENCE'}</span></div>${sourceNodes}${article}${fallback}<section class="detail-block provenance"><h3>Source and traceability</h3><p>${esc(source)}</p><small>Structure ID: ${esc(record.organ_id)}${record.node?` · Node: ${esc(record.node)}`:''}</small></section><div class="detail-buttons"><button id="focusFromDetails" ${!modelPresent?'disabled':''}>Focus model</button><button id="isolateFromDetails" ${!modelPresent?'disabled':''}>Isolate organ</button><button id="hideFromDetails" ${!modelPresent?'disabled':''}>Hide organ</button>${state.cmsOwner?'<button id="editSelectedCard">Edit scientific card</button>':''}</div><div class="study-note"><label for="studyNoteInput">My study note <small>Stored on this device</small></label><textarea id="studyNoteInput" rows="3" placeholder="Add a mnemonic or observation..."></textarea><button id="saveStudyNoteBtn">Save note</button><span id="noteSavedLabel" aria-live="polite"></span></div></article>`;
  $('studyNoteInput').value=state.notes[key]||'';
  $('saveStudyNoteBtn')?.addEventListener('click',()=>{state.notes[key]=safe($('studyNoteInput').value).slice(0,2500);try{localStorage.setItem('msh.anatomy.student-notes.v30',JSON.stringify(state.notes));$('noteSavedLabel').textContent='Saved locally';}catch{toast('Local storage is disabled on this device.');}});
  $('favoriteStructureBtn')?.addEventListener('click',()=>{const i=state.favorites.indexOf(key);if(i<0)state.favorites.push(key);else state.favorites.splice(i,1);try{localStorage.setItem('msh.anatomy.favorites.v30',JSON.stringify(state.favorites));}catch{}renderDetail(record);});
  $('focusFromDetails')?.addEventListener('click',()=>{if(state.selectedMesh)state.renderer?.focusMesh(state.selectedMesh);else focusRecord(record);closeRight();});
  $('isolateFromDetails')?.addEventListener('click',()=>{if(state.selectedMesh)state.renderer?.isolateSelected();else focusRecord(record);renderStructureList();closeRight();});
  $('hideFromDetails')?.addEventListener('click',()=>{if(record.unindexed)state.renderer?.hideSelected();else state.renderer?.setRecordVisible(record,false);renderStructureList();closeRight();});
  $('editSelectedCard')?.addEventListener('click',openEditor);
  for(const id of ['hideBtn','isolateBtn','focusBtn'])$(id).disabled=!modelPresent;
}
async function focusRecord(record){
  if(!record)return;
  if(record.system!==state.system){state.system=record.system;updateHeader();renderSystems();setNavMode('structures');}
  state.selected=record;state.selectedMesh=null;
  renderDetail(record);setActiveStructure(record);
  if(record.textOnly){toast('Scientific card available. This entry is not linked to an independently selectable 3D mesh.');openRight();return;}
  if(!systemById(record.system)?.[state.sex]){toast('No verified 3D model is available for this reference.');openRight();return;}
  const wantedSex=state.sex;
  const ok=await ensureSystemLoaded(record.system);if(!ok||wantedSex!==state.sex||state.system!==record.system)return;
  const selected=state.renderer?.selectRecord(record);
  state.selectedMesh=selected?state.renderer.selected:null;
  if(!selected)toast('This structure is indexed, but no separately selectable mesh matched its source ID.');
  renderDetail(record);setActiveStructure(record);renderStructureList();openRight();
}
function recordKey(record){return `${state.sex}:${record?.organ_id||record?.name_en||'unknown'}`;}
function stopQuizQuiet(){state.quiz=false;state.quizTarget=null;renderQuiz();}
function setActiveStructure(record){
  const label=$('activeStructureBadge');if(!label)return;
  label.hidden=!record;
  if(record)$('selectedStructureLabel').textContent=record.name_en||record.name||record.organ_id||'Unnamed mesh';
  const has=Boolean(record&&(state.renderer?.hasRecord(record)||record.unindexed&&state.selectedMesh));
  for(const id of ['quickIsolateBtn','quickHideBtn','quickFocusBtn'])$(id).disabled=!has;
}
function setNavMode(mode){
  state.navMode=mode==='structures'?'structures':'systems';
  const structures=state.navMode==='structures';
  $('systemList').hidden=structures;$('structurePanel').hidden=!structures;
  $('systemsTab').classList.toggle('active',!structures);$('structuresTab').classList.toggle('active',structures);
  $('systemsTab').setAttribute('aria-selected',String(!structures));$('structuresTab').setAttribute('aria-selected',String(structures));
  if(structures)renderStructureList();
}
function renderStructureList(){
  const panel=$('structureList');if(!panel)return;
  const sys=systemById(state.system);
  const records=sys?sourceRecordsFor(sys):[];
  const list=records.filter(r=>state.cmsOwner||state.visibility?.structures?.[r.organ_id]!==false);
  const shown=state.renderer?.loaded.get(state.system);
  $('structurePanelTitle').textContent=sys?.name||'Select a body system';
  $('structurePanelSub').textContent=sys?`${list.length.toLocaleString()} source-indexed names`:'Choose a system from the Systems tab';
  $('structureTabCount').textContent=String(list.length);
  const q=norm($('structureSearch').value),readyOnly=$('loadedOnlyToggle').checked;
  const filtered=list.filter(r=>(!q||[r.name_en,r.ta2_latin,pathFor(r)].some(v=>norm(v).includes(q)))&&(!readyOnly||state.renderer?.hasRecord(r)));
  // Make selectable geometry discoverable first, while keeping the complete named index.
  filtered.sort((a,b)=>Number(Boolean(state.renderer?.hasRecord(b)))-Number(Boolean(state.renderer?.hasRecord(a))));
  const page=filtered.slice(0,state.structureLimit);
  $('structuresShown').textContent=`${filtered.length.toLocaleString()} structures`;
  $('moreStructuresBtn').hidden=filtered.length<=state.structureLimit;
  if(!sys){panel.innerHTML='<div class="structure-empty">Choose a system to see its organs and structures. The list links directly to the 3D viewport.</div>';return;}
  if(!list.length){panel.innerHTML='<div class="structure-empty">Reference index not loaded yet. Published educational cards are still available in the Knowledge panel when their source is present. Check your connection and retry if the atlas file fails.</div>';return;}
  if(!filtered.length){panel.innerHTML='<div class="structure-empty">No structures match this filter. Clear the search or turn off Only 3D-ready.</div>';return;}
  panel.innerHTML=page.map((r,i)=>{
    const exists=state.renderer?.hasRecord(r),selected=state.selected?.organ_id===r.organ_id;
    const visible=exists?state.renderer.isRecordVisible(r):false;
    const name=esc(r.name_en||r.organ_id),path=esc(pathFor(r)||r.ta2_latin||'Anatomical structure');
    return `<div class="structure-entry ${selected?'selected':''}" data-recrow="${i}"><button class="structure-entry-name" data-open-rec="${i}" aria-label="Inspect ${name}"><span class="structure-entry-icon">${exists?'3D':'+'}</span><span class="structure-entry-copy"><strong>${name}</strong><small>${path}</small></span></button><button class="structure-eye ${visible?'on':''}" title="${exists?(visible?'Hide':'Show')+' selected structure':'3D mesh not yet loaded'}" aria-label="${exists?(visible?'Hide':'Show')+' '+name:'3D not loaded'}" data-eye-rec="${i}" ${exists?'':'disabled'}>${visible?'◉':'◯'}</button></div>`;
  }).join('');
  panel.querySelectorAll('[data-open-rec]').forEach(btn=>btn.addEventListener('click',()=>{focusRecord(page[Number(btn.dataset.openRec)]);if(matchMedia('(max-width:660px)').matches)closeLeft();}));
  panel.querySelectorAll('[data-eye-rec]').forEach(btn=>btn.addEventListener('click',()=>{
    const r=page[Number(btn.dataset.eyeRec)];if(!state.renderer?.hasRecord(r))return;
    const visible=state.renderer.isRecordVisible(r);state.renderer.setRecordVisible(r,!visible);renderStructureList();
    if(state.selected?.organ_id===r.organ_id)renderDetail(r);
  }));
}
function searchItems(q){
  const search=norm(q);if(search.length<2)return[];
  return uniqueRecords().filter(r=>sysVisible(systemById(r.system)||{id:r.system,name:r.system})&&(state.cmsOwner||state.visibility?.structures?.[r.organ_id]!==false))
    .filter(r=>[r.name_en,r.organ_id,r.ta2_latin,pathFor(r)].some(v=>norm(v).includes(search))).slice(0,80);
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
async function loadAll(){const list=currentSystems();if(!list.length)return;state.overlay=true;$('overlayBtn').textContent='Overlay: On';$('overlayBtn').classList.add('active');$('overlayBtn').setAttribute('aria-pressed','true');toast('Loading '+list.length+' authentic system models. This may use significant data.');let count=0;for(const s of list){const result=await ensureSystemLoaded(s.id);if(result)count++;else{if(state.engineFailure)break;}}state.system=null;updateHeader();renderSystems();if(count){state.renderer?.showAll();state.renderer?.fitView();renderStructureList();toast(`${count} source system models loaded.`);}}
function quizPool(){return state.renderer?.getPickable().filter(x=>x.record?.name_en)||[];}
function renderQuiz(){const b=$('quizBanner');b.hidden=!state.quiz;$('quizBtn').classList.toggle('active',state.quiz);if(state.quiz){$('quizScore').textContent=`${state.quizCorrect} correct / ${state.quizAttempts} attempts`;}}
function newQuiz(){const items=quizPool();if(items.length<2){toast('Load a system with at least two indexed selectable meshes for the identification quiz.');return;}state.quiz=true;state.selected=null;state.selectedMesh=null;state.renderer?.clearSelection();const item=items[Math.floor(Math.random()*items.length)];state.quizTarget=item.record;$('quizPrompt').textContent='Find: '+item.record.name_en;renderQuiz();closeRight();}
function gradeQuiz(record,mesh){if(!state.quiz||!state.quizTarget)return;state.quizAttempts++;const match=record?.organ_id===state.quizTarget.organ_id;if(match){state.quizCorrect++;toast('Correct: '+state.quizTarget.name_en);state.renderer?.selectMesh(mesh);setTimeout(newQuiz,550);}else{toast(`Not yet. You selected ${record?.name_en||'an unnamed mesh'}. Try again.`);}renderQuiz();}
function stopQuiz(){state.quiz=false;state.quizTarget=null;renderQuiz();toast('Identification quiz ended.');}
function downloadJSON(name,json){const blob=new Blob([JSON.stringify(json,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);}
function openEditor(){if(!state.selected){toast('Select a structure first.');return;}if(!state.cmsOwner){toast('Owner permission required to edit public scientific cards.');return;}const rec=state.selected;const card=mergedCard(rec);$('editCardName').value=rec.name_en||rec.name||rec.organ_id;$('editCardOverview').value=strip(card.overview||'');$('editorNote').textContent='Changes will be stored locally until exported. No cloud publication is claimed.';$('cardModal').hidden=false;}
function saveEditor(){const rec=state.selected;if(!rec)return;state.ownerCards[rec.organ_id]={overview:$('editCardOverview').value.trim().slice(0,6000)};try{localStorage.setItem(state.localCardKey,JSON.stringify(state.ownerCards));}catch(e){toast('Local storage unavailable; export the JSON.');}$('cardModal').hidden=true;renderDetail(rec);toast('Saved locally. Export JSON and publish it into anatomy/data/owner_cards.json to share with learners.');}
async function importCards(event){const file=event.target.files?.[0];if(!file)return;try{if(file.size>3e6)throw Error('JSON is larger than 3 MB');const raw=JSON.parse(await file.text());if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Expected a JSON object');state.ownerCards={...state.ownerCards,...raw};localStorage.setItem(state.localCardKey,JSON.stringify(state.ownerCards));$('editorNote').textContent='Imported '+Object.keys(raw).length+' locally saved entries.';if(state.selected)renderDetail(state.selected);}catch(e){toast('Invalid card file: '+e.message);}}
function rootConfiguration(){if(window.parent!==window){window.parent.postMessage({type:'MSH_ANATOMY_READY'},location.origin);}}
function announceExit(){if(window.parent!==window)window.parent.postMessage({type:'MSH_ANATOMY_EXIT'},location.origin);else location.href='../index.html';}
function wireEvents(){
  $('backToHub').addEventListener('click',announceExit);
  for(const b of document.querySelectorAll('[data-sex]'))b.addEventListener('click',()=>setSex(b.dataset.sex));
  $('startExplore').addEventListener('click',()=>chooseSystem('skeletal'));
  $('structureSearch').addEventListener('input',()=>{if(state.navMode==='structures')renderStructureList();renderSearch();});
  $('systemsTab').addEventListener('click',()=>setNavMode('systems'));
  $('structuresTab').addEventListener('click',()=>setNavMode('structures'));
  $('mobileStructuresBtn').addEventListener('click',()=>{setNavMode('structures');openLeft();});
  $('loadedOnlyToggle').addEventListener('change',()=>{state.structureLimit=75;renderStructureList();});
  $('moreStructuresBtn').addEventListener('click',()=>{state.structureLimit+=100;renderStructureList();});
  $('overlayBtn').addEventListener('click',()=>{state.overlay=!state.overlay;const b=$('overlayBtn');b.textContent='Overlay: '+(state.overlay?'On':'Off');b.classList.toggle('active',state.overlay);b.setAttribute('aria-pressed',String(state.overlay));if(state.renderer&&state.system){if(state.overlay)state.renderer.showAll();else state.renderer.showOnlySystem(state.system);}renderStructureList();});
  $('quickIsolateBtn').addEventListener('click',()=>{state.renderer?.isolateSelected();renderStructureList();});
  $('quickHideBtn').addEventListener('click',()=>{state.renderer?.hideSelected();renderStructureList();});
  $('quickFocusBtn').addEventListener('click',()=>state.renderer?.focusMesh(state.selectedMesh));
  $('retryBtn').addEventListener('click',()=>{state.engineFailure='';state.manifestFailures={};state.system&&chooseSystem(state.system);});
  $('allSystemsBtn').addEventListener('click',loadAll);
  $('resetViewBtn').addEventListener('click',()=>state.renderer?.fitView());
  $('showAllBtn').addEventListener('click',()=>{if(state.system){state.renderer?.restoreCurrent(state.system);if(!state.overlay)state.renderer?.showOnlySystem(state.system);}else state.renderer?.showAll();state.renderer?.fitView();$('toggleSystemBtn').textContent='Hide system';$('explodeSlider').value=0;setExplosion(0);renderStructureList();});
  $('toggleSystemBtn').addEventListener('click',()=>{
    if(!state.system||!state.renderer?.hasLoaded(state.system)){toast('Choose and load a system first.');return;}
    const shown=state.renderer.visible.get(state.system)!==false;
    state.renderer.setSystemVisible(state.system,!shown);renderStructureList();
    $('toggleSystemBtn').textContent=shown?'Show system':'Hide system';
  });
  $('isolateBtn').addEventListener('click',()=>{state.renderer?.isolateSelected();renderStructureList();});
  $('hideBtn').addEventListener('click',()=>{state.renderer?.hideSelected();renderStructureList();toast('Structure hidden. Use Restore all to show it again.');});
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
    try{const notes=JSON.parse(localStorage.getItem('msh.anatomy.student-notes.v30')||'{}');state.notes=notes&&typeof notes==='object'&&!Array.isArray(notes)?notes:{};}catch{}
    try{const favorites=JSON.parse(localStorage.getItem('msh.anatomy.favorites.v30')||'[]');state.favorites=Array.isArray(favorites)?favorites:[];}catch{}
    renderSystems();updateHeader();setNavMode('systems');rootConfiguration();
    ensureManifest(state.sex).then(()=>{renderSystems();renderStructureList();}).catch(e=>{renderStructureList();console.warn(e);$('coverageText').textContent='3D index requires network or downloaded model files';});
    if(new URLSearchParams(location.search).get('system'))chooseSystem(new URLSearchParams(location.search).get('system'));
  }catch(e){showError(e?.message||String(e));}
}
init();
