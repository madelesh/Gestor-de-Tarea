const STORAGE_KEY = 'detodoec_tasks_v1';
const SETTINGS_KEY = 'detodoec_tasks_settings_v2';
let tasks = loadTasks();
let editingImage = '';
let activeStatus = 'all';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const taskGrid = $('#taskGrid');
const emptyState = $('#emptyState');
const archiveGrid = $('#archiveGrid');
const archiveEmpty = $('#archiveEmpty');
const dialog = $('#taskDialog');
const customizeDialog = $('#customizeDialog');
const form = $('#taskForm');
const imagePreview = $('#imagePreview');
const imageWrap = document.querySelector('.image-preview-wrap');

function loadTasks(){
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return raw.map(t => ({
      ...t,
      status: t.status === 'listo' ? 'terminado' : (t.status || 'pendiente'),
      workerName: t.workerName || '',
      orderTaker: t.orderTaker || '',
      costAmount: Number(t.costAmount || 0),
      archived: Boolean(t.archived),
      archivedAt: t.archivedAt || ''
    }));
  } catch { return []; }
}
function saveTasks(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function loadSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}
function saveSettings(settings){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function money(n){ return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0)); }
function todayLocal(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${d.getFullYear()}-${m}-${day}`;
}
function prettyDate(v){
  if(!v) return '—';
  const [y,m,d] = v.split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d));
}
function statusLabel(v){ return ({pendiente:'Pendiente',proceso:'En proceso',terminado:'Terminado',entregado:'Entregado'})[v] || v; }
function calcProfit(t){ return Math.max(0, Number(t.totalAmount||0) - Number(t.costAmount||0)); }
function placeholderSvg(){
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="100%" height="100%" fill="#efefec"/><circle cx="400" cy="360" r="105" fill="#b9ff39"/><path d="M310 470h180" stroke="#111" stroke-width="26" stroke-linecap="round"/><path d="M400 270v180" stroke="#111" stroke-width="26" stroke-linecap="round"/></svg>`);
}

function createTaskCard(t, archivedView = false){
  const node = $('#taskTemplate').content.cloneNode(true);
  const card = node.querySelector('.task-card');
  const profit = calcProfit(t);
  const workerShare = profit * 0.70;
  const takerShare = profit * 0.30;
  node.querySelector('.task-image').src = t.image || placeholderSvg();
  node.querySelector('.status-pill').textContent = statusLabel(t.status);
  node.querySelector('.client').textContent = t.clientName;
  node.querySelector('.task-name').textContent = t.taskName;
  node.querySelector('.description').textContent = t.description || 'Sin descripción';
  node.querySelector('.worker').textContent = t.workerName || 'Sin asignar';
  node.querySelector('.taker').textContent = t.orderTaker || 'Sin asignar';
  node.querySelector('.delivery').textContent = prettyDate(t.deliveryDate);
  node.querySelector('.payment').textContent = prettyDate(t.paymentDate);
  node.querySelector('.total').textContent = money(t.totalAmount);
  node.querySelector('.deposit').textContent = money(t.depositAmount);
  node.querySelector('.balance').textContent = money(Math.max(0, Number(t.totalAmount||0) - Number(t.depositAmount||0)));
  node.querySelector('.profit').textContent = money(profit);
  node.querySelector('.worker-share').textContent = money(workerShare);
  node.querySelector('.taker-share').textContent = money(takerShare);

  node.querySelector('.edit-btn').onclick = () => openEdit(t.id);
  node.querySelector('.pay-btn').onclick = () => addPayment(t.id);
  node.querySelector('.delete-btn').onclick = () => deleteTask(t.id);
  node.querySelector('.menu-btn').onclick = () => openEdit(t.id);
  node.querySelector('.deliver-btn').onclick = () => markDelivered(t.id);
  node.querySelector('.archive-btn').onclick = () => archivedView ? restoreTask(t.id) : archiveTask(t.id);

  if(archivedView){
    node.querySelector('.pay-btn').hidden = true;
    node.querySelector('.deliver-btn').hidden = true;
    node.querySelector('.archive-btn').textContent = 'Restaurar';
  } else {
    node.querySelector('.deliver-btn').hidden = t.status === 'entregado';
    node.querySelector('.archive-btn').hidden = t.status !== 'entregado';
  }
  card.dataset.id = t.id;
  return node;
}

function render(){
  const q = $('#searchInput').value.trim().toLowerCase();
  const activeTasks = tasks.filter(t => !t.archived);
  const filtered = activeTasks.filter(t => {
    const haystack = `${t.clientName} ${t.taskName} ${t.description||''} ${t.workerName||''} ${t.orderTaker||''}`.toLowerCase();
    const matchesQ = haystack.includes(q);
    const matchesS = activeStatus === 'all' || t.status === activeStatus;
    return matchesQ && matchesS;
  });

  taskGrid.innerHTML = '';
  filtered.sort((a,b)=> (a.deliveryDate||'').localeCompare(b.deliveryDate||'')).forEach(t => taskGrid.appendChild(createTaskCard(t)));
  emptyState.style.display = filtered.length ? 'none' : 'block';
  updateStats();
  renderArchive();
}

function renderArchive(){
  const q = $('#archiveSearchInput').value.trim().toLowerCase();
  const archived = tasks.filter(t => t.archived).filter(t => `${t.clientName} ${t.taskName} ${t.description||''} ${t.workerName||''} ${t.orderTaker||''}`.toLowerCase().includes(q));
  archiveGrid.innerHTML = '';
  archived.sort((a,b)=>(b.archivedAt||'').localeCompare(a.archivedAt||'')).forEach(t => archiveGrid.appendChild(createTaskCard(t, true)));
  archiveEmpty.style.display = archived.length ? 'none' : 'block';
  $('#archiveCount').textContent = tasks.filter(t=>t.archived).length;
}

function updateStats(){
  const active = tasks.filter(t=>!t.archived);
  $('#statTotal').textContent = active.length;
  $('#statPending').textContent = active.filter(t=>t.status==='pendiente').length;
  $('#statDone').textContent = active.filter(t=>t.status==='terminado' || t.status==='entregado').length;
  const balance = active.reduce((sum,t)=>sum + Math.max(0, Number(t.totalAmount||0)-Number(t.depositAmount||0)),0);
  $('#statBalance').textContent = money(balance);
}

function clearForm(){
  form.reset();
  $('#taskId').value='';
  $('#totalAmount').value='0';
  $('#costAmount').value='0';
  $('#depositAmount').value='0';
  $('#status').value='pendiente';
  editingImage='';
  imagePreview.removeAttribute('src');
  imageWrap.classList.remove('active');
  $('#dialogTitle').textContent='Nueva tarea';
  updateProfitPreview();
}
function openNew(){ clearForm(); dialog.showModal(); }
function openEdit(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  clearForm();
  $('#dialogTitle').textContent='Editar tarea';
  $('#taskId').value=t.id;
  $('#clientName').value=t.clientName;
  $('#taskName').value=t.taskName;
  $('#workerName').value=t.workerName||'';
  $('#orderTaker').value=t.orderTaker||'';
  $('#deliveryDate').value=t.deliveryDate||'';
  $('#status').value=t.status||'pendiente';
  $('#totalAmount').value=t.totalAmount||0;
  $('#costAmount').value=t.costAmount||0;
  $('#depositAmount').value=t.depositAmount||0;
  $('#paymentDate').value=t.paymentDate||'';
  $('#description').value=t.description||'';
  editingImage=t.image||'';
  if(editingImage){ imagePreview.src=editingImage; imageWrap.classList.add('active'); }
  updateProfitPreview();
  dialog.showModal();
}

function updateProfitPreview(){
  const profit = Math.max(0, Number($('#totalAmount').value||0)-Number($('#costAmount').value||0));
  $('#profitTotal').textContent = money(profit);
  $('#profitWorker').textContent = money(profit*.70);
  $('#profitTaker').textContent = money(profit*.30);
}

function addPayment(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  const pending = Math.max(0, Number(t.totalAmount||0)-Number(t.depositAmount||0));
  const raw = prompt(`Abono actual: ${money(t.depositAmount)}\nSaldo pendiente: ${money(pending)}\n¿Cuánto deseas agregar?`, pending ? String(pending.toFixed(2)) : '0');
  if(raw===null) return;
  const amount = Number(String(raw).replace(',','.'));
  if(!Number.isFinite(amount) || amount<=0) return alert('Ingresa un valor válido.');
  t.depositAmount = Math.min(Number(t.totalAmount||0), Number(t.depositAmount||0) + amount);
  t.paymentDate = todayLocal();
  t.updatedAt = new Date().toISOString();
  saveTasks(); render();
}

function markDelivered(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  if(!confirm(`¿Marcar "${t.taskName}" como entregado?`)) return;
  t.status = 'entregado';
  t.deliveredAt = new Date().toISOString();
  t.updatedAt = new Date().toISOString();
  saveTasks(); render();
}
function archiveTask(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  if(t.status !== 'entregado') return alert('Primero marca el pedido como entregado.');
  if(!confirm(`¿Archivar el pedido "${t.taskName}"?`)) return;
  t.archived = true;
  t.archivedAt = new Date().toISOString();
  saveTasks(); render();
}
function restoreTask(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  t.archived = false;
  t.archivedAt = '';
  saveTasks(); render();
}
function deleteTask(id){
  const t = tasks.find(x=>x.id===id);
  if(!t || !confirm(`¿Eliminar la tarea "${t.taskName}"? Esta acción no se puede deshacer.`)) return;
  tasks = tasks.filter(x=>x.id!==id); saveTasks(); render();
}

$('#taskImage').addEventListener('change', (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  if(file.size > 1_500_000) alert('Consejo: usa imágenes menores a 1.5 MB para no llenar el almacenamiento del navegador.');
  const reader = new FileReader();
  reader.onload = () => { editingImage=reader.result; imagePreview.src=editingImage; imageWrap.classList.add('active'); };
  reader.readAsDataURL(file);
});
$('#removeImage').onclick=()=>{editingImage='';imagePreview.removeAttribute('src');imageWrap.classList.remove('active');$('#taskImage').value='';};
$('#totalAmount').addEventListener('input', updateProfitPreview);
$('#costAmount').addEventListener('input', updateProfitPreview);

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const id = $('#taskId').value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const existing = tasks.findIndex(x=>x.id===id);
  const previous = existing >= 0 ? tasks[existing] : {};
  const task = {
    ...previous,
    id,
    clientName: $('#clientName').value.trim(),
    taskName: $('#taskName').value.trim(),
    workerName: $('#workerName').value.trim(),
    orderTaker: $('#orderTaker').value.trim(),
    deliveryDate: $('#deliveryDate').value,
    status: $('#status').value,
    totalAmount: Number($('#totalAmount').value||0),
    costAmount: Number($('#costAmount').value||0),
    depositAmount: Number($('#depositAmount').value||0),
    paymentDate: $('#paymentDate').value,
    description: $('#description').value.trim(),
    image: editingImage,
    archived: Boolean(previous.archived),
    archivedAt: previous.archivedAt || '',
    updatedAt: new Date().toISOString()
  };
  if(task.depositAmount > task.totalAmount) task.depositAmount = task.totalAmount;
  if(existing>=0) tasks[existing]=task; else tasks.push(task);
  saveTasks(); dialog.close(); render();
});

function setArchiveView(show){
  const archiveSection = $('#archivados');
  const taskSection = $('#tareas');
  if(!archiveSection || !taskSection) return;
  archiveSection.hidden = !show;
  taskSection.hidden = show;
  if(show){ renderArchive(); archiveSection.scrollIntoView({behavior:'smooth',block:'start'}); }
  else { taskSection.scrollIntoView({behavior:'smooth',block:'start'}); }
}

function setTheme(theme, persist=true){
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  const icon = $('#themeIcon');
  const label = $('#themeLabel');
  const btn = $('#themeToggle');
  if(icon) icon.textContent = next === 'dark' ? '☀' : '☾';
  if(label) label.textContent = next === 'dark' ? 'Claro' : 'Oscuro';
  if(btn){
    btn.setAttribute('aria-pressed', String(next === 'dark'));
    btn.setAttribute('aria-label', next === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro');
    btn.title = next === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  }
  if(persist){
    const settings = loadSettings();
    settings.theme = next;
    saveSettings(settings);
  }
}
function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function applySiteIcon(dataUrl){
  const wrap = document.querySelector('.brand-icon-wrap');
  const previewBox = document.querySelector('.icon-preview-box');
  if(dataUrl){
    $('#brandIcon').src = dataUrl; wrap?.classList.add('has-icon');
    $('#siteIconPreview').src = dataUrl; previewBox?.classList.add('has-icon');
    $('#dynamicFavicon').href = dataUrl;
  } else {
    $('#brandIcon').removeAttribute('src'); wrap?.classList.remove('has-icon');
    $('#siteIconPreview').removeAttribute('src'); previewBox?.classList.remove('has-icon');
    $('#dynamicFavicon').href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23b9ff39'/%3E%3Cpath d='M18 33l9 9 19-22' fill='none' stroke='%23111' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
  }
}

function on(id, event, handler){ const el=$('#'+id); if(el) el.addEventListener(event, handler); }

on('archiveNav','click',()=>setArchiveView(true));
on('closeArchive','click',()=>setArchiveView(false));
on('archiveSearchInput','input',renderArchive);
on('themeToggle','click',toggleTheme);
on('customizeBtn','click',()=>customizeDialog?.showModal());
on('closeCustomize','click',()=>customizeDialog?.close());
on('cancelCustomize','click',()=>customizeDialog?.close());
on('resetIcon','click',()=>{const settings=loadSettings();delete settings.siteIcon;saveSettings(settings);applySiteIcon('');$('#siteIconInput').value='';});
on('closeDialog','click',()=>dialog?.close());
on('cancelDialog','click',()=>dialog?.close());
on('searchInput','input',render);
['newTaskTop','newTaskHero','newTaskEmpty'].forEach(id=>on(id,'click',openNew));

$$('.filter-chip').forEach(btn=>btn.addEventListener('click',()=>{
  activeStatus = btn.dataset.status;
  $$('.filter-chip').forEach(b=>b.classList.toggle('active',b===btn));
  render();
}));

$$('.nav a[href="#inicio"]').forEach(a=>a.addEventListener('click',()=>setArchiveView(false)));
$$('.nav a[href="#tareas"]').forEach(a=>a.addEventListener('click',()=>setArchiveView(false)));

on('siteIconInput','change',(e)=>{
  const file=e.target.files?.[0]; if(!file) return;
  if(file.size > 600_000) return alert('Usa un icono menor a 600 KB.');
  const reader=new FileReader();
  reader.onload=()=>{const settings=loadSettings();settings.siteIcon=reader.result;saveSettings(settings);applySiteIcon(reader.result);};
  reader.readAsDataURL(file);
});

const initialSettings = loadSettings();
const preferredTheme = initialSettings.theme || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
setTheme(preferredTheme, false);
applySiteIcon(initialSettings.siteIcon || '');
render();
