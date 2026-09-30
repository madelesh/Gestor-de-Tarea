const API_BASE = 'https://gestor-tareas-api.detodoec.workers.dev';
const STORAGE_KEY = 'detodoec_tasks_v1';
const SETTINGS_KEY = 'detodoec_tasks_settings_v2';
const MIGRATION_KEY = 'detodoec_cloud_migration_v7';

let tasks = [];
let activeStatus = 'all';
let detailTaskId = '';
let pendingDeleteId = '';
let editingImage = '';
let editingImageFile = null;
let removeExistingImage = false;
let currentImageUrl = '';
let isLoading = false;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const taskGrid = $('#taskGrid');
const emptyState = $('#emptyState');
const archiveGrid = $('#archiveGrid');
const archiveEmpty = $('#archiveEmpty');
const dialog = $('#taskDialog');
const detailDialog = $('#detailDialog');
const customizeDialog = $('#customizeDialog');
const loginDialog = $('#loginDialog');
const paymentDialog = $('#paymentDialog');
const deleteDialog = $('#deleteDialog');
const paymentForm = $('#paymentForm');
const form = $('#taskForm');
const imagePreview = $('#imagePreview');
const imageWrap = document.querySelector('.image-preview-wrap');

function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY))||{}}catch{return {}}}
function saveSettings(s){localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}
function loadLocalTasks(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY))||[];
    return raw.map(t=>{
      let history=Array.isArray(t.paymentHistory)?t.paymentHistory:[];
      if(!history.length&&Number(t.depositAmount||0)>0){history=[{id:'legacy-'+t.id,amount:Number(t.depositAmount||0),date:t.paymentDate||'',createdAt:t.updatedAt||''}]}
      return {...t,paymentHistory:history,status:t.status==='listo'?'terminado':(t.status||'pendiente'),workerName:t.workerName||'',orderTaker:t.orderTaker||'',archived:Boolean(t.archived)};
    });
  }catch{return []}
}
function money(n){return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0))}
function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function prettyDate(v){if(!v)return '—';const clean=String(v).slice(0,10);const [y,m,d]=clean.split('-').map(Number);if(!y||!m||!d)return clean;return new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d))}
function statusLabel(v){return ({pendiente:'Pendiente',proceso:'En proceso',terminado:'Terminado',entregado:'Entregado'})[v]||v}
function distributable(t){return Math.max(0,Number(t.totalAmount||0))}
function balance(t){return Math.max(0,Number(t.totalAmount||0)-Number(t.depositAmount||0))}
function placeholderSvg(){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#efefec"/><circle cx="400" cy="360" r="105" fill="#b9ff39"/><path d="M310 470h180" stroke="#111" stroke-width="26" stroke-linecap="round"/><path d="M400 270v180" stroke="#111" stroke-width="26" stroke-linecap="round"/></svg>`)}
function setSyncState(text,state='ok'){
  const el=$('#syncStatus'); if(!el)return;
  el.textContent=text; el.dataset.state=state;
}
function showToast(message,title='Guardado correctamente'){
  const toast=$('#toast');$('#toastTitle').textContent=title;$('#toastMessage').textContent=message||'';toast.classList.add('show');clearTimeout(showToast._timer);showToast._timer=setTimeout(()=>toast.classList.remove('show'),3000)
}

async function apiFetch(path,options={}){
  const res=await fetch(API_BASE+path,{...options,headers:{...(options.headers||{})}});
  const type=res.headers.get('content-type')||'';
  const data=type.includes('application/json')?await res.json():await res.text();
  if(!res.ok){throw new Error(data?.error||data?.message||String(data)||`Error ${res.status}`)}
  return data;
}

function fromApi(t){
  const history=(t.abonos||[]).map(a=>({id:String(a.id),amount:Number(a.valor||0),date:String(a.fecha||'').slice(0,10),createdAt:a.fecha||''}));
  const deposit=Number(t.total_abonado ?? history.reduce((s,h)=>s+h.amount,0));
  return {
    id:String(t.id),
    clientName:t.cliente||'',
    taskName:t.titulo||'',
    description:t.descripcion||'',
    deliveryDate:t.fecha_entrega||'',
    totalAmount:Number(t.valor_total||0),
    workerName:t.responsable||'',
    orderTaker:t.tomo_pedido||'',
    status:t.estado||'pendiente',
    image:t.imagen_url||'',
    archived:Boolean(t.archivada),
    paymentHistory:history,
    depositAmount:deposit,
    paymentDate:history[0]?.date||''
  };
}
function toApi(t){return {cliente:t.clientName||'',titulo:t.taskName||'',descripcion:t.description||'',fecha_entrega:t.deliveryDate||'',valor_total:Number(t.totalAmount||0),responsable:t.workerName||'',tomo_pedido:t.orderTaker||'',estado:t.status||'pendiente',imagen_url:t.image||'',archivada:Boolean(t.archived)}}

async function refreshTasks({silent=false}={}){
  if(isLoading)return;
  isLoading=true;setSyncState('Sincronizando…','loading');
  try{
    const data=await apiFetch('/api/tareas');
    tasks=(Array.isArray(data)?data:[]).map(fromApi);
    render();
    setSyncState('Nube conectada','ok');
  }catch(err){
    console.error(err);setSyncState('Sin conexión','error');
    if(!silent)showToast(err.message,'No se pudo sincronizar');
  }finally{isLoading=false}
}

function createTaskCard(t){
  const node=$('#taskTemplate').content.cloneNode(true);const card=node.querySelector('.task-card');
  node.querySelector('.task-image').src=t.image||placeholderSvg();
  node.querySelector('.card-client').textContent=t.clientName||'Sin cliente';
  node.querySelector('.card-delivery').textContent=prettyDate(t.deliveryDate);
  node.querySelector('.card-total').textContent=money(t.totalAmount);
  card.dataset.id=t.id;card.addEventListener('click',()=>openDetail(t.id));
  card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetail(t.id)}});
  return node;
}
function render(){
  const q=$('#searchInput').value.trim().toLowerCase();const active=tasks.filter(t=>!t.archived);
  const filtered=active.filter(t=>`${t.clientName} ${t.taskName} ${t.description||''} ${t.workerName||''} ${t.orderTaker||''}`.toLowerCase().includes(q)&&(activeStatus==='all'||t.status===activeStatus));
  taskGrid.innerHTML='';filtered.sort((a,b)=>(a.deliveryDate||'').localeCompare(b.deliveryDate||'')).forEach(t=>taskGrid.appendChild(createTaskCard(t)));
  emptyState.style.display=filtered.length?'none':'block';updateStats();renderArchive();
}
function renderArchive(){
  const q=$('#archiveSearchInput').value.trim().toLowerCase();const archived=tasks.filter(t=>t.archived).filter(t=>`${t.clientName} ${t.taskName} ${t.description||''}`.toLowerCase().includes(q));
  archiveGrid.innerHTML='';archived.forEach(t=>archiveGrid.appendChild(createTaskCard(t)));archiveEmpty.style.display=archived.length?'none':'block';$('#archiveCount').textContent=archived.length;
}
function updateStats(){
  const active=tasks.filter(t=>!t.archived);$('#statTotal').textContent=active.length;$('#statPending').textContent=active.filter(t=>t.status==='pendiente').length;$('#statDone').textContent=active.filter(t=>t.status==='terminado'||t.status==='entregado').length;$('#statBalance').textContent=money(active.reduce((s,t)=>s+balance(t),0));
}

function clearForm(){
  form.reset();$('#taskId').value='';$('#totalAmount').value='0';$('#depositAmount').value='0';$('#status').value='pendiente';editingImage='';editingImageFile=null;removeExistingImage=false;currentImageUrl='';imagePreview.removeAttribute('src');imageWrap.classList.remove('active');$('#dialogTitle').textContent='Nueva tarea';$('#initialDepositWrap').hidden=false;$('#initialPaymentDateWrap').hidden=false;$('#depositAmount').disabled=false;$('#paymentDate').disabled=false;updateSplitPreview();
}
function openNew(){clearForm();dialog.showModal()}
function openEdit(id){
  const t=tasks.find(x=>x.id===String(id));if(!t)return;detailDialog?.close();clearForm();$('#dialogTitle').textContent='Editar tarea';$('#taskId').value=t.id;$('#clientName').value=t.clientName;$('#taskName').value=t.taskName;$('#workerName').value=t.workerName||'';$('#orderTaker').value=t.orderTaker||'';$('#deliveryDate').value=t.deliveryDate||'';$('#status').value=t.status||'pendiente';$('#totalAmount').value=t.totalAmount||0;$('#description').value=t.description||'';$('#initialDepositWrap').hidden=true;$('#initialPaymentDateWrap').hidden=true;$('#depositAmount').disabled=true;$('#paymentDate').disabled=true;editingImage=t.image||'';currentImageUrl=t.image||'';if(editingImage){imagePreview.src=editingImage;imageWrap.classList.add('active')}updateSplitPreview();dialog.showModal();
}
function updateSplitPreview(){const p=Math.max(0,Number($('#totalAmount').value||0));$('#profitTotal').textContent=money(p);$('#profitWorker').textContent=money(p*.70);$('#profitTaker').textContent=money(p*.30)}
function openDetail(id){
  const t=tasks.find(x=>x.id===String(id));if(!t)return;detailTaskId=String(id);
  $('#detailTitle').textContent=t.taskName||'Información de la tarea';$('#detailImage').src=t.image||placeholderSvg();$('#detailStatus').textContent=statusLabel(t.status);$('#detailClient').textContent=t.clientName||'—';$('#detailTask').textContent=t.taskName||'—';$('#detailWorker').textContent=t.workerName||'Sin asignar';$('#detailTaker').textContent=t.orderTaker||'Sin asignar';$('#detailDelivery').textContent=prettyDate(t.deliveryDate);$('#detailTotal').textContent=money(t.totalAmount);$('#detailDeposit').textContent=money(t.depositAmount);$('#detailBalance').textContent=money(balance(t));$('#detailWorkerShare').textContent=money(distributable(t)*.70);$('#detailTakerShare').textContent=money(distributable(t)*.30);$('#detailDescription').textContent=t.description||'Sin descripción';
  const list=$('#paymentHistoryList');list.innerHTML='';const hist=[...(t.paymentHistory||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));$('#paymentHistoryCount').textContent=`${hist.length} registro${hist.length===1?'':'s'}`;if(!hist.length){list.innerHTML='<div class="history-empty">Todavía no hay abonos registrados.</div>'}else hist.forEach(h=>{const row=document.createElement('div');row.className='history-item';row.innerHTML=`<span>${prettyDate(h.date)}</span><strong>${money(h.amount)}</strong>`;list.appendChild(row)});
  $('#detailPay').hidden=t.archived||balance(t)<=0;$('#detailDeliver').hidden=t.archived||t.status==='entregado';$('#detailArchive').hidden=!t.archived&&t.status!=='entregado';$('#detailArchive').textContent=t.archived?'Restaurar':'Archivar';$('#detailEdit').hidden=t.archived;detailDialog.showModal();
}

async function uploadImage(file){
  if(!file)return '';
  if(file.size>2*1024*1024)throw new Error('La imagen no puede superar los 2 MB');
  const fd=new FormData();fd.append('imagen',file);
  const data=await apiFetch('/api/imagenes',{method:'POST',body:fd});
  return data.url;
}
async function deleteImageUrl(url){
  if(!url||!url.startsWith(API_BASE+'/api/imagenes/'))return;
  const path=url.slice(API_BASE.length);try{await apiFetch(path,{method:'DELETE'})}catch(err){console.warn('No se pudo borrar imagen anterior',err)}
}

$('#taskImage').addEventListener('change',e=>{
  const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){showToast('La imagen no puede superar los 2 MB.','Imagen demasiado grande');e.target.value='';return}
  editingImageFile=file;removeExistingImage=false;const reader=new FileReader();reader.onload=()=>{editingImage=reader.result;imagePreview.src=editingImage;imageWrap.classList.add('active')};reader.readAsDataURL(file);
});
$('#removeImage').onclick=()=>{removeExistingImage=Boolean(currentImageUrl);editingImage='';editingImageFile=null;imagePreview.removeAttribute('src');imageWrap.classList.remove('active');$('#taskImage').value=''};
$('#totalAmount').addEventListener('input',updateSplitPreview);

form.addEventListener('submit',async e=>{
  e.preventDefault();const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Guardando…';
  const id=$('#taskId').value;const isNew=!id;let uploadedUrl='';
  try{
    if(editingImageFile){uploadedUrl=await uploadImage(editingImageFile)}
    const imageUrl=uploadedUrl || (removeExistingImage?'':currentImageUrl||'');
    const payload={cliente:$('#clientName').value.trim(),titulo:$('#taskName').value.trim(),descripcion:$('#description').value.trim(),fecha_entrega:$('#deliveryDate').value,valor_total:Math.max(0,Number($('#totalAmount').value||0)),responsable:$('#workerName').value.trim(),tomo_pedido:$('#orderTaker').value.trim(),estado:$('#status').value,imagen_url:imageUrl,archivada:false};
    if(isNew){
      const created=await apiFetch('/api/tareas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const initial=Math.max(0,Number($('#depositAmount').value||0));
      if(initial>0){await apiFetch(`/api/tareas/${created.id}/abonos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({valor:initial,fecha:$('#paymentDate').value||todayLocal()})})}
    }else{
      const previous=tasks.find(t=>t.id===String(id));payload.archivada=Boolean(previous?.archived);
      await apiFetch(`/api/tareas/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(removeExistingImage&&currentImageUrl&&!uploadedUrl){await deleteImageUrl(currentImageUrl)}
    }
    dialog.close();await refreshTasks({silent:true});showToast(`${payload.cliente}: ${payload.titulo}`,'Tarea guardada correctamente');
  }catch(err){if(uploadedUrl&&isNew)await deleteImageUrl(uploadedUrl);showToast(err.message,'No se pudo guardar')}
  finally{submit.disabled=false;submit.textContent='Guardar tarea'}
});

function addPayment(id){const t=tasks.find(x=>x.id===String(id));if(!t)return;const pending=balance(t);$('#paymentTaskId').value=id;$('#paymentCurrent').textContent=money(t.depositAmount);$('#paymentPending').textContent=money(pending);$('#paymentAmount').value='';$('#paymentAmount').max=String(pending);$('#paymentEntryDate').value=todayLocal();detailDialog?.close();paymentDialog.showModal();setTimeout(()=>$('#paymentAmount').focus(),50)}
paymentForm.addEventListener('submit',async e=>{
  e.preventDefault();const id=$('#paymentTaskId').value;const t=tasks.find(x=>x.id===String(id));if(!t)return;const amount=Number(String($('#paymentAmount').value||'').replace(',','.'));const date=$('#paymentEntryDate').value||todayLocal();
  if(!Number.isFinite(amount)||amount<=0){$('#paymentAmount').focus();return}
  const submit=paymentForm.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Guardando…';
  try{await apiFetch(`/api/tareas/${id}/abonos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({valor:amount,fecha:date})});paymentDialog.close();await refreshTasks({silent:true});showToast(`Se registró ${money(amount)} para ${t.clientName}.`,'Abono guardado correctamente')}
  catch(err){showToast(err.message,'No se pudo guardar el abono')}finally{submit.disabled=false;submit.textContent='Guardar abono'}
});

async function updateTaskState(id,patch,successTitle,successMessage){
  const t=tasks.find(x=>x.id===String(id));if(!t)return;
  try{await apiFetch(`/api/tareas/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...toApi(t),...patch})});detailDialog?.close();await refreshTasks({silent:true});showToast(successMessage,successTitle)}catch(err){showToast(err.message,'No se pudo actualizar')}
}
function markDelivered(id){const t=tasks.find(x=>x.id===String(id));if(!t)return;updateTaskState(id,{estado:'entregado'},'Tarea entregada',`La tarea de ${t.clientName} fue marcada como entregada.`)}
function archiveTask(id){const t=tasks.find(x=>x.id===String(id));if(!t)return;if(!t.archived&&t.status!=='entregado'){showToast('Primero marca el pedido como entregado.','No se puede archivar');return}updateTaskState(id,{archivada:!t.archived},t.archived?'Pedido restaurado':'Pedido archivado',t.archived?'El pedido volvió a tareas activas.':'El pedido fue archivado.')}
function requestDelete(id){const t=tasks.find(x=>x.id===String(id));if(!t)return;pendingDeleteId=String(id);$('#deleteMessage').textContent=`Vas a eliminar la tarea “${t.taskName}” de ${t.clientName}. Esta acción no se puede deshacer.`;detailDialog?.close();deleteDialog.showModal()}
async function confirmDelete(){const t=tasks.find(x=>x.id===String(pendingDeleteId));if(!t){deleteDialog.close();return}const btn=$('#confirmDelete');btn.disabled=true;btn.textContent='Eliminando…';try{await apiFetch(`/api/tareas/${pendingDeleteId}`,{method:'DELETE'});deleteDialog.close();await refreshTasks({silent:true});showToast(`“${t.taskName}” fue eliminada correctamente.`,'Tarea eliminada')}catch(err){showToast(err.message,'No se pudo eliminar')}finally{pendingDeleteId='';btn.disabled=false;btn.textContent='Sí, eliminar'}}

async function migrateLocalTasks(){
  const local=loadLocalTasks();if(!local.length){showToast('No hay tareas locales para migrar.','Migración');return}
  if(localStorage.getItem(MIGRATION_KEY)==='done'){showToast('Esta computadora ya realizó la migración anteriormente.','Migración completada');return}
  const btn=$('#migrateLocal');btn.disabled=true;btn.textContent='Migrando…';let ok=0;let failed=0;
  try{
    for(const t of local){
      try{
        let imageUrl='';
        if(t.image&&t.image.startsWith('data:image/')){
          const blob=await (await fetch(t.image)).blob();
          const ext=(blob.type.split('/')[1]||'png').replace('jpeg','jpg');
          const file=new File([blob],`migrada-${Date.now()}.${ext}`,{type:blob.type});imageUrl=await uploadImage(file);
        }else if(t.image&&t.image.startsWith('http')){imageUrl=t.image}
        const created=await apiFetch('/api/tareas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cliente:t.clientName||'',titulo:t.taskName||'Tarea',descripcion:t.description||'',fecha_entrega:t.deliveryDate||'',valor_total:Number(t.totalAmount||0),responsable:t.workerName||'',tomo_pedido:t.orderTaker||'',estado:t.status||'pendiente',imagen_url:imageUrl,archivada:Boolean(t.archived)})});
        for(const h of (t.paymentHistory||[])){if(Number(h.amount||0)>0){await apiFetch(`/api/tareas/${created.id}/abonos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({valor:Number(h.amount),fecha:h.date||todayLocal()})})}}
        ok++;
      }catch(err){console.error('Error migrando tarea',t,err);failed++}
    }
    if(failed===0)localStorage.setItem(MIGRATION_KEY,'done');
    await refreshTasks({silent:true});showToast(`${ok} tarea(s) migradas${failed?` · ${failed} con error`:''}.`,'Migración terminada');
  }finally{btn.disabled=false;btn.textContent='Migrar tareas locales a la nube'}
}

function setArchiveView(show){const a=$('#archivados'),t=$('#tareas');a.hidden=!show;t.hidden=show;if(show){renderArchive();a.scrollIntoView({behavior:'smooth',block:'start'})}else t.scrollIntoView({behavior:'smooth',block:'start'})}
function setTheme(theme,persist=true){const next=theme==='dark'?'dark':'light';document.documentElement.setAttribute('data-theme',next);$('#themeIcon').textContent=next==='dark'?'☀':'☾';$('#themeLabel').textContent=next==='dark'?'Claro':'Oscuro';$('#themeToggle').setAttribute('aria-pressed',String(next==='dark'));if(persist){const s=loadSettings();s.theme=next;saveSettings(s)}}
function toggleTheme(){setTheme((document.documentElement.getAttribute('data-theme')||'light')==='dark'?'light':'dark')}
function applySiteIcon(dataUrl){const wrap=document.querySelector('.brand-icon-wrap'),box=document.querySelector('.icon-preview-box');if(dataUrl){$('#brandIcon').src=dataUrl;wrap.classList.add('has-icon');$('#siteIconPreview').src=dataUrl;box.classList.add('has-icon');$('#dynamicFavicon').href=dataUrl}else{$('#brandIcon').removeAttribute('src');wrap.classList.remove('has-icon');$('#siteIconPreview').removeAttribute('src');box.classList.remove('has-icon');$('#dynamicFavicon').href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23b9ff39'/%3E%3Cpath d='M18 33l9 9 19-22' fill='none' stroke='%23111' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"}}
function requestCustomize(){const s=loadSettings();$('#loginUser').value='';$('#loginPass').value='';$('#loginError').hidden=true;loginDialog.showModal();setTimeout(()=>$('#loginUser').focus(),50)}
function currentCredentials(){const s=loadSettings();return {user:s.customizeUser||'admin',pass:s.customizePass||'1234'}}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const c=currentCredentials();if($('#loginUser').value===c.user&&$('#loginPass').value===c.pass){loginDialog.close();const s=loadSettings();$('#customUser').value=s.customizeUser||'admin';$('#customPass').value='';customizeDialog.showModal()}else{$('#loginError').hidden=false;$('#loginPass').select()}});

function on(id,event,handler){const el=$('#'+id);if(el)el.addEventListener(event,handler)}
on('archiveNav','click',()=>setArchiveView(true));on('closeArchive','click',()=>setArchiveView(false));on('archiveSearchInput','input',renderArchive);on('themeToggle','click',toggleTheme);on('customizeBtn','click',requestCustomize);on('closeLogin','click',()=>loginDialog.close());on('cancelLogin','click',()=>loginDialog.close());on('closeCustomize','click',()=>customizeDialog.close());on('cancelCustomize','click',()=>customizeDialog.close());on('closePaymentDialog','click',()=>paymentDialog.close());on('cancelPaymentDialog','click',()=>paymentDialog.close());on('closeDialog','click',()=>dialog.close());on('cancelDialog','click',()=>dialog.close());on('closeDetail','click',()=>detailDialog.close());on('cancelDelete','click',()=>deleteDialog.close());on('confirmDelete','click',confirmDelete);on('searchInput','input',render);on('migrateLocal','click',migrateLocalTasks);on('refreshCloud','click',()=>refreshTasks());['newTaskHero','newTaskEmpty'].forEach(id=>on(id,'click',openNew));
on('detailEdit','click',()=>openEdit(detailTaskId));on('detailPay','click',()=>addPayment(detailTaskId));on('detailDeliver','click',()=>markDelivered(detailTaskId));on('detailArchive','click',()=>archiveTask(detailTaskId));on('detailDelete','click',()=>requestDelete(detailTaskId));
$$('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{activeStatus=btn.dataset.status;$$('.filter-chip').forEach(b=>b.classList.toggle('active',b===btn));render()}));
$$('.nav a[href="#inicio"]').forEach(a=>a.addEventListener('click',()=>setArchiveView(false)));$$('.nav a[href="#tareas"]').forEach(a=>a.addEventListener('click',()=>setArchiveView(false)));
on('siteIconInput','change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>600_000){showToast('Usa un icono menor a 600 KB.','Archivo demasiado grande');return}const reader=new FileReader();reader.onload=()=>{const s=loadSettings();s.siteIcon=reader.result;saveSettings(s);applySiteIcon(reader.result);showToast('El icono de la página fue actualizado.')};reader.readAsDataURL(file)});
on('resetIcon','click',()=>{const s=loadSettings();delete s.siteIcon;saveSettings(s);applySiteIcon('');$('#siteIconInput').value='';showToast('Se restauró el icono original.')});
on('saveAccess','click',()=>{const user=$('#customUser').value.trim();const pass=$('#customPass').value;if(!user){showToast('Escribe un usuario válido.','No se guardó');return}const s=loadSettings();s.customizeUser=user;if(pass)s.customizePass=pass;else if(!s.customizePass)s.customizePass='1234';saveSettings(s);$('#customPass').value='';showToast('Usuario y contraseña actualizados.','Acceso actualizado')});

const initialSettings=loadSettings();const preferredTheme=initialSettings.theme||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');setTheme(preferredTheme,false);applySiteIcon(initialSettings.siteIcon||'');render();refreshTasks();
