const STORAGE_KEY = 'detodoec_tasks_v1';
const SETTINGS_KEY = 'detodoec_tasks_settings_v2';
let tasks = loadTasks();
let editingImage = '';
let activeStatus = 'all';
let detailTaskId = '';
let pendingDeleteId = '';

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

function loadTasks(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return raw.map(t=>{
      let history = Array.isArray(t.paymentHistory) ? t.paymentHistory : [];
      if(!history.length && Number(t.depositAmount||0)>0){
        history = [{id:'legacy-'+t.id, amount:Number(t.depositAmount||0), date:t.paymentDate||'', createdAt:t.updatedAt||''}];
      }
      return {
        ...t,
        status:t.status==='listo'?'terminado':(t.status||'pendiente'),
        workerName:t.workerName||'', orderTaker:t.orderTaker||'',
        archived:Boolean(t.archived), archivedAt:t.archivedAt||'', paymentHistory:history
      };
    });
  }catch{return []}
}
function saveTasks(){localStorage.setItem(STORAGE_KEY,JSON.stringify(tasks))}
function loadSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY))||{}}catch{return {}}}
function saveSettings(s){localStorage.setItem(SETTINGS_KEY,JSON.stringify(s))}
function money(n){return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0))}
function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function prettyDate(v){if(!v)return '—';const [y,m,d]=v.split('-').map(Number);return new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d))}
function statusLabel(v){return ({pendiente:'Pendiente',proceso:'En proceso',terminado:'Terminado',entregado:'Entregado'})[v]||v}
function distributable(t){return Math.max(0,Number(t.totalAmount||0))}
function balance(t){return Math.max(0,Number(t.totalAmount||0)-Number(t.depositAmount||0))}
function placeholderSvg(){return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#efefec"/><circle cx="400" cy="360" r="105" fill="#b9ff39"/><path d="M310 470h180" stroke="#111" stroke-width="26" stroke-linecap="round"/><path d="M400 270v180" stroke="#111" stroke-width="26" stroke-linecap="round"/></svg>`)}

function createTaskCard(t){
  const node=$('#taskTemplate').content.cloneNode(true);const card=node.querySelector('.task-card');
  node.querySelector('.task-image').src=t.image||placeholderSvg();
  node.querySelector('.card-client').textContent=t.clientName||'Sin cliente';
  node.querySelector('.card-delivery').textContent=prettyDate(t.deliveryDate);
  node.querySelector('.card-total').textContent=money(t.totalAmount);
  card.dataset.id=t.id;
  card.addEventListener('click',()=>openDetail(t.id));
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
  archiveGrid.innerHTML='';archived.sort((a,b)=>(b.archivedAt||'').localeCompare(a.archivedAt||'')).forEach(t=>archiveGrid.appendChild(createTaskCard(t)));
  archiveEmpty.style.display=archived.length?'none':'block';$('#archiveCount').textContent=tasks.filter(t=>t.archived).length;
}
function updateStats(){
  const active=tasks.filter(t=>!t.archived);$('#statTotal').textContent=active.length;$('#statPending').textContent=active.filter(t=>t.status==='pendiente').length;$('#statDone').textContent=active.filter(t=>t.status==='terminado'||t.status==='entregado').length;$('#statBalance').textContent=money(active.reduce((s,t)=>s+balance(t),0));
}

function clearForm(){
  form.reset();$('#taskId').value='';$('#totalAmount').value='0';$('#depositAmount').value='0';$('#status').value='pendiente';editingImage='';imagePreview.removeAttribute('src');imageWrap.classList.remove('active');$('#dialogTitle').textContent='Nueva tarea';$('#initialDepositWrap').hidden=false;$('#initialPaymentDateWrap').hidden=false;$('#depositAmount').disabled=false;$('#paymentDate').disabled=false;updateSplitPreview();
}
function openNew(){clearForm();dialog.showModal()}
function openEdit(id){
  const t=tasks.find(x=>x.id===id);if(!t)return;detailDialog?.close();clearForm();$('#dialogTitle').textContent='Editar tarea';$('#taskId').value=t.id;$('#clientName').value=t.clientName;$('#taskName').value=t.taskName;$('#workerName').value=t.workerName||'';$('#orderTaker').value=t.orderTaker||'';$('#deliveryDate').value=t.deliveryDate||'';$('#status').value=t.status||'pendiente';$('#totalAmount').value=t.totalAmount||0;$('#description').value=t.description||'';$('#initialDepositWrap').hidden=true;$('#initialPaymentDateWrap').hidden=true;$('#depositAmount').disabled=true;$('#paymentDate').disabled=true;editingImage=t.image||'';if(editingImage){imagePreview.src=editingImage;imageWrap.classList.add('active')}updateSplitPreview();dialog.showModal();
}
function updateSplitPreview(){const p=Math.max(0,Number($('#totalAmount').value||0));$('#profitTotal').textContent=money(p);$('#profitWorker').textContent=money(p*.70);$('#profitTaker').textContent=money(p*.30)}

function openDetail(id){
  const t=tasks.find(x=>x.id===id);if(!t)return;detailTaskId=id;
  $('#detailTitle').textContent=t.taskName||'Información de la tarea';$('#detailImage').src=t.image||placeholderSvg();$('#detailStatus').textContent=statusLabel(t.status);$('#detailClient').textContent=t.clientName||'—';$('#detailTask').textContent=t.taskName||'—';$('#detailWorker').textContent=t.workerName||'Sin asignar';$('#detailTaker').textContent=t.orderTaker||'Sin asignar';$('#detailDelivery').textContent=prettyDate(t.deliveryDate);$('#detailTotal').textContent=money(t.totalAmount);$('#detailDeposit').textContent=money(t.depositAmount);$('#detailBalance').textContent=money(balance(t));$('#detailWorkerShare').textContent=money(distributable(t)*.70);$('#detailTakerShare').textContent=money(distributable(t)*.30);$('#detailDescription').textContent=t.description||'Sin descripción';
  const list=$('#paymentHistoryList');list.innerHTML='';const hist=[...(t.paymentHistory||[])].sort((a,b)=>(b.date||b.createdAt||'').localeCompare(a.date||a.createdAt||''));$('#paymentHistoryCount').textContent=`${hist.length} registro${hist.length===1?'':'s'}`;if(!hist.length){list.innerHTML='<div class="history-empty">Todavía no hay abonos registrados.</div>'}else hist.forEach(h=>{const row=document.createElement('div');row.className='history-item';row.innerHTML=`<span>${prettyDate(h.date)}</span><strong>${money(h.amount)}</strong>`;list.appendChild(row)});
  $('#detailPay').hidden=t.archived||balance(t)<=0;$('#detailDeliver').hidden=t.archived||t.status==='entregado';$('#detailArchive').hidden=!t.archived&&t.status!=='entregado';$('#detailArchive').textContent=t.archived?'Restaurar':'Archivar';$('#detailEdit').hidden=t.archived;
  detailDialog.showModal();
}

function showToast(message,title='Guardado correctamente'){const toast=$('#toast');$('#toastTitle').textContent=title;$('#toastMessage').textContent=message||'';toast.classList.add('show');clearTimeout(showToast._timer);showToast._timer=setTimeout(()=>toast.classList.remove('show'),2800)}
function addPayment(id){const t=tasks.find(x=>x.id===id);if(!t)return;const pending=balance(t);$('#paymentTaskId').value=id;$('#paymentCurrent').textContent=money(t.depositAmount);$('#paymentPending').textContent=money(pending);$('#paymentAmount').value=pending>0?pending.toFixed(2):'';$('#paymentAmount').max=pending>0?String(pending):'';$('#paymentEntryDate').value=todayLocal();detailDialog?.close();paymentDialog.showModal();setTimeout(()=>$('#paymentAmount').select(),50)}
function markDelivered(id){const t=tasks.find(x=>x.id===id);if(!t)return;t.status='entregado';t.deliveredAt=new Date().toISOString();t.updatedAt=new Date().toISOString();saveTasks();render();showToast(`La tarea de ${t.clientName} fue marcada como entregada.`,'Tarea entregada')}
function archiveTask(id){const t=tasks.find(x=>x.id===id);if(!t)return;if(t.archived){t.archived=false;t.archivedAt='';saveTasks();render();detailDialog.close();showToast('El pedido volvió a tareas activas.','Pedido restaurado');return}if(t.status!=='entregado'){showToast('Primero marca el pedido como entregado.','No se puede archivar');return}t.archived=true;t.archivedAt=new Date().toISOString();saveTasks();render();detailDialog.close();showToast('El pedido fue archivado.','Pedido archivado')}
function requestDelete(id){const t=tasks.find(x=>x.id===id);if(!t)return;pendingDeleteId=id;$('#deleteMessage').textContent=`Vas a eliminar la tarea “${t.taskName}” de ${t.clientName}. Esta acción no se puede deshacer.`;detailDialog?.close();deleteDialog.showModal()}
function confirmDelete(){const t=tasks.find(x=>x.id===pendingDeleteId);if(!t){deleteDialog.close();return}const name=t.taskName;tasks=tasks.filter(x=>x.id!==pendingDeleteId);pendingDeleteId='';saveTasks();render();deleteDialog.close();showToast(`“${name}” fue eliminada correctamente.`,'Tarea eliminada')}

$('#taskImage').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1_500_000)showToast('Conviene usar imágenes menores a 1.5 MB.','Imagen pesada');const reader=new FileReader();reader.onload=()=>{editingImage=reader.result;imagePreview.src=editingImage;imageWrap.classList.add('active')};reader.readAsDataURL(file)});
$('#removeImage').onclick=()=>{editingImage='';imagePreview.removeAttribute('src');imageWrap.classList.remove('active');$('#taskImage').value=''};
$('#totalAmount').addEventListener('input',updateSplitPreview);
form.addEventListener('submit',e=>{
  e.preventDefault();const id=$('#taskId').value||(crypto.randomUUID?crypto.randomUUID():String(Date.now()));const existing=tasks.findIndex(x=>x.id===id);const previous=existing>=0?tasks[existing]:{};const isNew=existing<0;let deposit=isNew?Math.max(0,Number($('#depositAmount').value||0)):Number(previous.depositAmount||0);const total=Math.max(0,Number($('#totalAmount').value||0));deposit=Math.min(deposit,total);let history=Array.isArray(previous.paymentHistory)?[...previous.paymentHistory]:[];if(isNew&&deposit>0)history.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),amount:deposit,date:$('#paymentDate').value||todayLocal(),createdAt:new Date().toISOString()});
  const task={...previous,id,clientName:$('#clientName').value.trim(),taskName:$('#taskName').value.trim(),workerName:$('#workerName').value.trim(),orderTaker:$('#orderTaker').value.trim(),deliveryDate:$('#deliveryDate').value,status:$('#status').value,totalAmount:total,depositAmount:deposit,paymentDate:history.length?(history[history.length-1].date||previous.paymentDate||''):'',paymentHistory:history,description:$('#description').value.trim(),image:editingImage,archived:Boolean(previous.archived),archivedAt:previous.archivedAt||'',updatedAt:new Date().toISOString()};
  if(existing>=0)tasks[existing]=task;else tasks.push(task);saveTasks();dialog.close();render();showToast(`${task.clientName}: ${task.taskName}`,'Tarea guardada correctamente');
});

paymentForm.addEventListener('submit',e=>{e.preventDefault();const id=$('#paymentTaskId').value;const t=tasks.find(x=>x.id===id);if(!t)return;const pending=balance(t);const amount=Number(String($('#paymentAmount').value||'').replace(',','.'));if(!Number.isFinite(amount)||amount<=0){$('#paymentAmount').focus();return}const applied=Math.min(amount,pending);const date=$('#paymentEntryDate').value||todayLocal();t.depositAmount=Math.min(Number(t.totalAmount||0),Number(t.depositAmount||0)+applied);t.paymentDate=date;t.paymentHistory=Array.isArray(t.paymentHistory)?t.paymentHistory:[];t.paymentHistory.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),amount:applied,date,createdAt:new Date().toISOString()});t.updatedAt=new Date().toISOString();saveTasks();paymentDialog.close();render();showToast(`Se registró ${money(applied)} para ${t.clientName}.`,'Abono guardado correctamente')});

function setArchiveView(show){const a=$('#archivados'),t=$('#tareas');a.hidden=!show;t.hidden=show;if(show){renderArchive();a.scrollIntoView({behavior:'smooth',block:'start'})}else t.scrollIntoView({behavior:'smooth',block:'start'})}
function setTheme(theme,persist=true){const next=theme==='dark'?'dark':'light';document.documentElement.setAttribute('data-theme',next);$('#themeIcon').textContent=next==='dark'?'☀':'☾';$('#themeLabel').textContent=next==='dark'?'Claro':'Oscuro';$('#themeToggle').setAttribute('aria-pressed',String(next==='dark'));if(persist){const s=loadSettings();s.theme=next;saveSettings(s)}}
function toggleTheme(){setTheme((document.documentElement.getAttribute('data-theme')||'light')==='dark'?'light':'dark')}
function applySiteIcon(dataUrl){const wrap=document.querySelector('.brand-icon-wrap'),box=document.querySelector('.icon-preview-box');if(dataUrl){$('#brandIcon').src=dataUrl;wrap.classList.add('has-icon');$('#siteIconPreview').src=dataUrl;box.classList.add('has-icon');$('#dynamicFavicon').href=dataUrl}else{$('#brandIcon').removeAttribute('src');wrap.classList.remove('has-icon');$('#siteIconPreview').removeAttribute('src');box.classList.remove('has-icon');$('#dynamicFavicon').href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23b9ff39'/%3E%3Cpath d='M18 33l9 9 19-22' fill='none' stroke='%23111' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"}}

function requestCustomize(){const s=loadSettings();$('#loginUser').value='';$('#loginPass').value='';$('#loginError').hidden=true;loginDialog.showModal();setTimeout(()=>$('#loginUser').focus(),50)}
function currentCredentials(){const s=loadSettings();return {user:s.customizeUser||'admin',pass:s.customizePass||'1234'}}
$('#loginForm').addEventListener('submit',e=>{e.preventDefault();const c=currentCredentials();if($('#loginUser').value===c.user&&$('#loginPass').value===c.pass){loginDialog.close();const s=loadSettings();$('#customUser').value=s.customizeUser||'admin';$('#customPass').value='';customizeDialog.showModal()}else{$('#loginError').hidden=false;$('#loginPass').select()}});

function on(id,event,handler){const el=$('#'+id);if(el)el.addEventListener(event,handler)}
on('archiveNav','click',()=>setArchiveView(true));on('closeArchive','click',()=>setArchiveView(false));on('archiveSearchInput','input',renderArchive);on('themeToggle','click',toggleTheme);on('customizeBtn','click',requestCustomize);on('closeLogin','click',()=>loginDialog.close());on('cancelLogin','click',()=>loginDialog.close());on('closeCustomize','click',()=>customizeDialog.close());on('cancelCustomize','click',()=>customizeDialog.close());on('closePaymentDialog','click',()=>paymentDialog.close());on('cancelPaymentDialog','click',()=>paymentDialog.close());on('closeDialog','click',()=>dialog.close());on('cancelDialog','click',()=>dialog.close());on('closeDetail','click',()=>detailDialog.close());on('cancelDelete','click',()=>deleteDialog.close());on('confirmDelete','click',confirmDelete);on('searchInput','input',render);['newTaskHero','newTaskEmpty'].forEach(id=>on(id,'click',openNew));
on('detailEdit','click',()=>openEdit(detailTaskId));on('detailPay','click',()=>addPayment(detailTaskId));on('detailDeliver','click',()=>{const id=detailTaskId;detailDialog.close();markDelivered(id)});on('detailArchive','click',()=>archiveTask(detailTaskId));on('detailDelete','click',()=>requestDelete(detailTaskId));
$$('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{activeStatus=btn.dataset.status;$$('.filter-chip').forEach(b=>b.classList.toggle('active',b===btn));render()}));
$$('.nav a[href="#inicio"]').forEach(a=>a.addEventListener('click',()=>setArchiveView(false)));$$('.nav a[href="#tareas"]').forEach(a=>a.addEventListener('click',()=>setArchiveView(false)));
on('siteIconInput','change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>600_000){showToast('Usa un icono menor a 600 KB.','Archivo demasiado grande');return}const reader=new FileReader();reader.onload=()=>{const s=loadSettings();s.siteIcon=reader.result;saveSettings(s);applySiteIcon(reader.result);showToast('El icono de la página fue actualizado.')};reader.readAsDataURL(file)});
on('resetIcon','click',()=>{const s=loadSettings();delete s.siteIcon;saveSettings(s);applySiteIcon('');$('#siteIconInput').value='';showToast('Se restauró el icono original.')});
on('saveAccess','click',()=>{const user=$('#customUser').value.trim();const pass=$('#customPass').value;if(!user){showToast('Escribe un usuario válido.','No se guardó');return}const s=loadSettings();s.customizeUser=user;if(pass)s.customizePass=pass;else if(!s.customizePass)s.customizePass='1234';saveSettings(s);$('#customPass').value='';showToast('Usuario y contraseña actualizados.','Acceso actualizado')});

const initialSettings=loadSettings();const preferredTheme=initialSettings.theme||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');setTheme(preferredTheme,false);applySiteIcon(initialSettings.siteIcon||'');render();
