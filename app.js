const STORAGE_KEY = 'detodoec_tasks_v1';
let tasks = loadTasks();
let editingImage = '';

const $ = (s) => document.querySelector(s);
const taskGrid = $('#taskGrid');
const emptyState = $('#emptyState');
const dialog = $('#taskDialog');
const form = $('#taskForm');
const imagePreview = $('#imagePreview');
const imageWrap = document.querySelector('.image-preview-wrap');

function loadTasks(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveTasks(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
function money(n){ return new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(n||0)); }
function prettyDate(v){
  if(!v) return '—';
  const [y,m,d] = v.split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(y,m-1,d));
}
function statusLabel(v){ return ({pendiente:'Pendiente',proceso:'En proceso',listo:'Listo',entregado:'Entregado'})[v] || v; }
function placeholderSvg(){
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="100%" height="100%" fill="#efefec"/><circle cx="400" cy="200" r="70" fill="#b9ff39"/><path d="M340 260h120" stroke="#111" stroke-width="18" stroke-linecap="round"/><path d="M400 140v120" stroke="#111" stroke-width="18" stroke-linecap="round"/></svg>`);
}

function render(){
  const q = $('#searchInput').value.trim().toLowerCase();
  const status = $('#statusFilter').value;
  const filtered = tasks.filter(t => {
    const matchesQ = `${t.clientName} ${t.taskName} ${t.description||''}`.toLowerCase().includes(q);
    const matchesS = status === 'all' || t.status === status;
    return matchesQ && matchesS;
  });

  taskGrid.innerHTML = '';
  filtered.sort((a,b)=> (a.deliveryDate||'').localeCompare(b.deliveryDate||'')).forEach(t => {
    const node = $('#taskTemplate').content.cloneNode(true);
    const card = node.querySelector('.task-card');
    node.querySelector('.task-image').src = t.image || placeholderSvg();
    node.querySelector('.status-pill').textContent = statusLabel(t.status);
    node.querySelector('.client').textContent = t.clientName;
    node.querySelector('.task-name').textContent = t.taskName;
    node.querySelector('.description').textContent = t.description || 'Sin descripción';
    node.querySelector('.delivery').textContent = prettyDate(t.deliveryDate);
    node.querySelector('.payment').textContent = prettyDate(t.paymentDate);
    node.querySelector('.total').textContent = money(t.totalAmount);
    node.querySelector('.deposit').textContent = money(t.depositAmount);
    node.querySelector('.balance').textContent = money(Math.max(0, Number(t.totalAmount||0) - Number(t.depositAmount||0)));
    node.querySelector('.edit-btn').onclick = () => openEdit(t.id);
    node.querySelector('.pay-btn').onclick = () => addPayment(t.id);
    node.querySelector('.delete-btn').onclick = () => deleteTask(t.id);
    node.querySelector('.menu-btn').onclick = () => openEdit(t.id);
    card.dataset.id = t.id;
    taskGrid.appendChild(node);
  });
  emptyState.style.display = filtered.length ? 'none' : 'block';
  updateStats();
}

function updateStats(){
  $('#statTotal').textContent = tasks.length;
  $('#statPending').textContent = tasks.filter(t=>t.status!=='entregado').length;
  $('#statDone').textContent = tasks.filter(t=>t.status==='entregado').length;
  const balance = tasks.reduce((sum,t)=>sum + Math.max(0, Number(t.totalAmount||0)-Number(t.depositAmount||0)),0);
  $('#statBalance').textContent = money(balance);
}

function clearForm(){
  form.reset();
  $('#taskId').value='';
  $('#totalAmount').value='0';
  $('#depositAmount').value='0';
  $('#status').value='pendiente';
  editingImage='';
  imagePreview.removeAttribute('src');
  imageWrap.classList.remove('active');
  $('#dialogTitle').textContent='Nueva tarea';
}

function openNew(){ clearForm(); dialog.showModal(); }
function openEdit(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  clearForm();
  $('#dialogTitle').textContent='Editar tarea';
  $('#taskId').value=t.id;
  $('#clientName').value=t.clientName;
  $('#taskName').value=t.taskName;
  $('#deliveryDate').value=t.deliveryDate||'';
  $('#status').value=t.status||'pendiente';
  $('#totalAmount').value=t.totalAmount||0;
  $('#depositAmount').value=t.depositAmount||0;
  $('#paymentDate').value=t.paymentDate||'';
  $('#description').value=t.description||'';
  editingImage=t.image||'';
  if(editingImage){ imagePreview.src=editingImage; imageWrap.classList.add('active'); }
  dialog.showModal();
}

function addPayment(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  const raw = prompt(`Abono actual: ${money(t.depositAmount)}\n¿Cuánto deseas agregar?`, '0');
  if(raw===null) return;
  const amount = Number(String(raw).replace(',','.'));
  if(!Number.isFinite(amount) || amount<=0) return alert('Ingresa un valor válido.');
  t.depositAmount = Number(t.depositAmount||0) + amount;
  t.paymentDate = new Date().toISOString().slice(0,10);
  saveTasks(); render();
}

function deleteTask(id){
  const t = tasks.find(x=>x.id===id);
  if(!t || !confirm(`¿Eliminar la tarea "${t.taskName}"?`)) return;
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

form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const id = $('#taskId').value || crypto.randomUUID();
  const existing = tasks.findIndex(x=>x.id===id);
  const task = {
    id,
    clientName: $('#clientName').value.trim(),
    taskName: $('#taskName').value.trim(),
    deliveryDate: $('#deliveryDate').value,
    status: $('#status').value,
    totalAmount: Number($('#totalAmount').value||0),
    depositAmount: Number($('#depositAmount').value||0),
    paymentDate: $('#paymentDate').value,
    description: $('#description').value.trim(),
    image: editingImage,
    updatedAt: new Date().toISOString()
  };
  if(existing>=0) tasks[existing]=task; else tasks.push(task);
  saveTasks(); dialog.close(); render();
});

['newTaskTop','newTaskHero','newTaskEmpty'].forEach(id=>$('#'+id).onclick=openNew);
$('#closeDialog').onclick=()=>dialog.close();
$('#cancelDialog').onclick=()=>dialog.close();
$('#searchInput').addEventListener('input',render);
$('#statusFilter').addEventListener('change',render);

render();
