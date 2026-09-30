const APP_VERSION = '10.3';
const API_BASE = 'https://gestor-tareas-api.detodoec.workers.dev';
const STORAGE_KEY = 'detodoec_tasks_v1';
const SETTINGS_KEY = 'detodoec_tasks_settings_v3';
const EMPLOYEES_KEY = 'detodoec_employees_v1';
const MIGRATION_KEY = 'detodoec_cloud_migration_v8';

let tasks = [];
let employees = [];
let activeStatus = 'all';
let detailTaskId = '';
let pendingDeleteId = '';
let editingImage = '';
let editingImageFile = null;
let removeExistingImage = false;
let currentImageUrl = '';
let editingFinishedImage = '';
let editingFinishedImageFile = null;
let removeExistingFinishedImage = false;
let currentFinishedImageUrl = '';
let detailImageIndex = 0;
let isLoading = false;
let employeeEditingPhoto = '';
let employeeEditingPhotoFile = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const taskGrid = $('#taskGrid');
const emptyState = $('#emptyState');
const archiveGrid = $('#archiveGrid');
const archiveEmpty = $('#archiveEmpty');
const dialog = $('#taskDialog');
const detailDialog = $('#detailDialog');
const adminDialog = $('#adminDialog');
const loginDialog = $('#loginDialog');
const paymentDialog = $('#paymentDialog');
const deleteDialog = $('#deleteDialog');
const paymentForm = $('#paymentForm');
const taskForm = $('#taskForm');
const employeeForm = $('#employeeForm');
const imagePreview = $('#imagePreview');
const finishedImagePreview = $('#finishedImagePreview');
const imageWrap = document.querySelector('.image-preview-wrap');

function syncEditorImageStage(hasImage, selector = '.editor-image-stage') {
  const stage = document.querySelector(selector);
  if (!stage) return;
  stage.classList.toggle('has-image', Boolean(hasImage));
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
}
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function loadEmployees() {
  try { return JSON.parse(localStorage.getItem(EMPLOYEES_KEY)) || []; } catch { return []; }
}
function saveEmployees(list) {
  employees = list;
  localStorage.setItem(EMPLOYEES_KEY, JSON.stringify(list));
}
function loadLocalTasks() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return raw.map((t) => {
      let history = Array.isArray(t.paymentHistory) ? t.paymentHistory : [];
      if (!history.length && Number(t.depositAmount || 0) > 0) {
        history = [{
          id: 'legacy-' + t.id,
          amount: Number(t.depositAmount || 0),
          date: t.paymentDate || '',
          createdAt: t.updatedAt || ''
        }];
      }
      return {
        ...t,
        paymentHistory: history,
        status: t.status === 'listo' ? 'terminado' : (t.status || 'pendiente'),
        workerName: t.workerName || '',
        orderTaker: t.orderTaker || '',
        archived: Boolean(t.archived)
      };
    });
  } catch {
    return [];
  }
}

function money(n) {
  return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
}
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function prettyDate(v) {
  if (!v) return '—';
  const clean = String(v).slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return clean;
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));
}
function statusLabel(v) {
  return ({ pendiente: 'Pendiente', proceso: 'En proceso', terminado: 'Terminado', entregado: 'Entregado' })[v] || v || 'Pendiente';
}
function distributable(task) {
  return Math.max(0, Number(task.totalAmount || 0));
}
function balance(task) {
  return Math.max(0, Number(task.totalAmount || 0) - Number(task.depositAmount || 0));
}
function placeholderSvg() {
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="100%" height="100%" fill="#ecefe7"/>
      <rect x="140" y="140" width="520" height="520" rx="42" fill="#ffffff" stroke="#d6dbc9" stroke-width="10"/>
      <circle cx="400" cy="330" r="86" fill="#b9ff39"/>
      <path d="M310 510h180" stroke="#111" stroke-width="26" stroke-linecap="round"/>
      <path d="M400 238v184" stroke="#111" stroke-width="26" stroke-linecap="round"/>
    </svg>
  `);
}
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'DT';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function iconUse(id) {
  return `<svg class="icon" aria-hidden="true"><use href="#${id}"></use></svg>`;
}

function renderThemeIcon(theme) {
  const slot = $('#themeIconSlot');
  if (!slot) return;
  slot.innerHTML = theme === 'dark' ? iconUse('icon-sun') : iconUse('icon-moon');
}

function setSyncState(state = 'loading') {
  const el = $('#syncStatus');
  if (!el) return;
  el.dataset.state = state;
  const title = state === 'ok' ? 'Nube conectada' : state === 'error' ? 'Sin sincronización' : 'Sincronizando';
  el.title = title;
  el.setAttribute('aria-label', title);
}

function showToast(message, title = 'Guardado correctamente') {
  const toast = $('#toast');
  $('#toastTitle').textContent = title;
  $('#toastMessage').textContent = message || '';
  toast.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, { ...options, headers: { ...(options.headers || {}) } });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(data?.error || data?.message || String(data) || `Error ${res.status}`);
  }
  return data;
}

async function uploadImage(file) {
  const fd = new FormData();
  fd.append('imagen', file);
  const data = await apiFetch('/api/imagenes', { method: 'POST', body: fd });
  return data.url || '';
}

function fromEmployeeApi(emp) {
  return { id: String(emp.id), name: emp.nombre || '', photo: emp.foto_url || '' };
}

async function refreshEmployees({ migrateLocal = true } = {}) {
  const local = loadEmployees();
  try {
    let cloud = await apiFetch('/api/empleados');
    cloud = (Array.isArray(cloud) ? cloud : []).map(fromEmployeeApi);
    if (migrateLocal && local.length) {
      const names = new Set(cloud.map((e) => e.name.toLowerCase()));
      for (const emp of local) {
        if (!emp?.name || names.has(String(emp.name).toLowerCase())) continue;
        try {
          let photoUrl = emp.photo || '';
          if (photoUrl.startsWith('data:image/')) {
            const blob = await (await fetch(photoUrl)).blob();
            const ext = (blob.type.split('/')[1] || 'png').replace('jpeg','jpg');
            const file = new File([blob], `empleado-${Date.now()}.${ext}`, { type: blob.type });
            photoUrl = await uploadImage(file);
          }
          await apiFetch('/api/empleados', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ nombre: emp.name, foto_url: photoUrl }) });
          names.add(String(emp.name).toLowerCase());
        } catch (err) { console.warn('No se pudo migrar empleado local', emp?.name, err); }
      }
      cloud = (await apiFetch('/api/empleados')).map(fromEmployeeApi);
    }
    employees = cloud;
    saveEmployees(cloud);
    renderEmployeeList();
    renderEmployeeFilter();
  } catch (err) {
    console.error(err);
    employees = local;
    renderEmployeeList();
    renderEmployeeFilter();
  }
}

function fromApi(t) {
  const history = (t.abonos || []).map((a) => ({
    id: String(a.id),
    amount: Number(a.valor || 0),
    date: String(a.fecha || '').slice(0, 10),
    createdAt: a.fecha || ''
  }));
  const deposit = Number(t.total_abonado ?? history.reduce((sum, item) => sum + item.amount, 0));
  return {
    id: String(t.id),
    clientName: t.cliente || '',
    taskName: t.titulo || '',
    description: t.descripcion || '',
    deliveryDate: t.fecha_entrega || '',
    totalAmount: Number(t.valor_total || 0),
    workerName: t.responsable || '',
    orderTaker: t.tomo_pedido || '',
    status: t.estado || 'pendiente',
    image: t.imagen_url || '',
    finishedImage: t.imagen_terminada_url || '',
    archived: Boolean(t.archivada),
    paymentHistory: history,
    depositAmount: deposit,
    paymentDate: history[0]?.date || ''
  };
}
function toApi(task) {
  return {
    cliente: task.clientName || '',
    titulo: task.taskName || '',
    descripcion: task.description || '',
    fecha_entrega: task.deliveryDate || '',
    valor_total: Number(task.totalAmount || 0),
    responsable: task.workerName || '',
    tomo_pedido: task.orderTaker || '',
    estado: task.status || 'pendiente',
    imagen_url: task.image || '',
    imagen_terminada_url: task.finishedImage || '',
    archivada: Boolean(task.archived)
  };
}

function findEmployeeByName(name) {
  return employees.find((emp) => emp.name === name) || null;
}
function setMiniAvatar(el, name) {
  const emp = findEmployeeByName(name);
  el.textContent = emp?.photo ? '' : initials(name);
  el.style.backgroundImage = emp?.photo ? `url(${emp.photo})` : 'none';
}
function setEmployeeAvatarBox(el, photo, name = '') {
  el.style.backgroundImage = photo ? `url(${photo})` : 'none';
  el.innerHTML = photo ? '' : `<span>${initials(name)}</span>`;
}

function findPayment(taskId, paymentId) {
  const task = tasks.find((x) => x.id === String(taskId));
  if (!task) return { task: null, item: null };
  const item = (task.paymentHistory || []).find((entry) => String(entry.id) === String(paymentId)) || null;
  return { task, item };
}

function renderEmployeeOptions(selectedWorker = '', selectedTaker = '') {
  const workerSelect = $('#workerName');
  const takerSelect = $('#orderTaker');
  if (!workerSelect || !takerSelect) return;

  const buildOptions = (selectedValue) => {
    const usedNames = new Set(employees.map((e) => e.name));
    let options = `<option value="">Sin asignar</option>`;
    if (selectedValue && !usedNames.has(selectedValue)) {
      options += `<option value="${escapeHtml(selectedValue)}">${escapeHtml(selectedValue)}</option>`;
    }
    options += employees.map((emp) => `<option value="${escapeHtml(emp.name)}">${escapeHtml(emp.name)}</option>`).join('');
    return options;
  };

  workerSelect.innerHTML = buildOptions(selectedWorker);
  takerSelect.innerHTML = buildOptions(selectedTaker);
  workerSelect.value = selectedWorker || '';
  takerSelect.value = selectedTaker || '';
}

function renderEmployeeFilter() {
  const select = $('#employeeFilter');
  if (!select) return;
  const current = select.value || 'all';
  select.innerHTML = '<option value="all">Todos los empleados</option>' + employees.map((emp) => `<option value="${escapeHtml(emp.name)}">${escapeHtml(emp.name)}</option>`).join('');
  select.value = employees.some((e) => e.name === current) ? current : 'all';
}

function renderEmployeeList() {
  const list = $('#employeeList');
  if (!list) return;
  list.innerHTML = '';
  if (!employees.length) {
    list.innerHTML = '<p class="employee-empty">No hay empleados registrados todavía.</p>';
    renderEmployeeOptions();
    return;
  }
  employees.forEach((emp) => {
    const article = document.createElement('article');
    article.className = 'employee-card';
    article.innerHTML = `
      <div class="employee-avatar" aria-hidden="true"></div>
      <div class="employee-card-info">
        <strong>${escapeHtml(emp.name)}</strong>
        <span>Disponible para asignar tareas y pedidos</span>
      </div>
      <div class="employee-card-actions">
        <button type="button" class="btn btn-outline small" data-edit-employee="${emp.id}">Editar</button>
        <button type="button" class="btn btn-danger small" data-delete-employee="${emp.id}">Eliminar</button>
      </div>
    `;
    setEmployeeAvatarBox(article.querySelector('.employee-avatar'), emp.photo, emp.name);
    list.appendChild(article);
  });
  renderEmployeeOptions($('#workerName')?.value || '', $('#orderTaker')?.value || '');
}

function clearEmployeeForm() {
  employeeForm.reset();
  $('#employeeId').value = '';
  employeeEditingPhoto = '';
  employeeEditingPhotoFile = null;
  setEmployeeAvatarBox($('#employeePhotoPreview'), '', '');
  $('#employeeSaveBtn').textContent = 'Guardar empleado';
}
function editEmployee(id) {
  const emp = employees.find((item) => item.id === id);
  if (!emp) return;
  $('#employeeId').value = emp.id;
  $('#employeeName').value = emp.name;
  employeeEditingPhoto = emp.photo || '';
  employeeEditingPhotoFile = null;
  setEmployeeAvatarBox($('#employeePhotoPreview'), emp.photo || '', emp.name);
  $('#employeeSaveBtn').textContent = 'Actualizar empleado';
}
async function removeEmployee(id) {
  const emp = employees.find((item) => item.id === String(id));
  if (!emp) return;
  if (!window.confirm(`¿Eliminar al empleado "${emp.name}"?`)) return;
  try {
    await apiFetch(`/api/empleados/${id}`, { method:'DELETE' });
    await refreshEmployees({ migrateLocal:false });
    render();
    showToast(`Se eliminó a ${emp.name}.`, 'Empleado eliminado');
  } catch (err) {
    showToast(err.message, 'No se pudo eliminar el empleado');
  }
}

async function refreshTasks({ silent = false } = {}) {
  if (isLoading) return;
  isLoading = true;
  setSyncState('loading');
  try {
    const data = await apiFetch('/api/tareas');
    tasks = (Array.isArray(data) ? data : []).map(fromApi);
    render();
    setSyncState('ok');
  } catch (err) {
    console.error(err);
    setSyncState('error');
    if (!silent) showToast(err.message, 'No se pudo sincronizar');
  } finally {
    isLoading = false;
  }
}

function createTaskCard(task) {
  const node = $('#taskTemplate').content.cloneNode(true);
  const card = node.querySelector('.task-card');
  node.querySelector('.card-status-badge').textContent = statusLabel(task.status);
  const cardImage = node.querySelector('.task-image');
  const cardImages = [task.image, task.finishedImage].filter(Boolean);
  if (!cardImages.length) cardImages.push(placeholderSvg());
  let cardImageIndex = 0;
  const prevBtn = node.querySelector('.card-image-prev');
  const nextBtn = node.querySelector('.card-image-next');
  const dots = [...node.querySelectorAll('.card-image-dots span')];
  const updateCardImage = () => {
    cardImage.src = cardImages[cardImageIndex];
    dots.forEach((dot, i) => dot.classList.toggle('active', i === cardImageIndex && i < cardImages.length));
    const showControls = cardImages.length > 1;
    prevBtn.hidden = !showControls;
    nextBtn.hidden = !showControls;
    node.querySelector('.card-image-dots').hidden = !showControls;
  };
  prevBtn.addEventListener('click', (e) => { e.stopPropagation(); cardImageIndex = (cardImageIndex - 1 + cardImages.length) % cardImages.length; updateCardImage(); });
  nextBtn.addEventListener('click', (e) => { e.stopPropagation(); cardImageIndex = (cardImageIndex + 1) % cardImages.length; updateCardImage(); });
  updateCardImage();
  node.querySelector('.card-client').textContent = task.clientName || 'Sin cliente';
  node.querySelector('.card-taskname').textContent = task.taskName || 'Sin nombre de tarea';
  const cardWorker = node.querySelector('.card-worker-name');
  const cardWorkerAvatar = node.querySelector('.card-worker-avatar');
  if (cardWorker) cardWorker.textContent = task.workerName || 'Sin asignar';
  if (cardWorkerAvatar) { const emp = findEmployeeByName(task.workerName || ''); cardWorkerAvatar.textContent = emp?.photo ? '' : initials(task.workerName || ''); cardWorkerAvatar.style.backgroundImage = emp?.photo ? `url(${emp.photo})` : 'none'; }
  node.querySelector('.card-delivery').textContent = prettyDate(task.deliveryDate);
  node.querySelector('.card-total').textContent = money(task.totalAmount);
  card.dataset.id = task.id;
  card.addEventListener('click', () => openDetail(task.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetail(task.id);
    }
  });
  return node;
}

function render() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const active = tasks.filter((t) => !t.archived);
  const employeeFilter = $('#employeeFilter')?.value || 'all';
  const filtered = active.filter((t) => {
    const haystack = `${t.clientName} ${t.taskName} ${t.description || ''} ${t.workerName || ''} ${t.orderTaker || ''}`.toLowerCase();
    return haystack.includes(query) && (activeStatus === 'all' || t.status === activeStatus) && (employeeFilter === 'all' || t.workerName === employeeFilter);
  });
  taskGrid.innerHTML = '';
  filtered.sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || '')).forEach((t) => taskGrid.appendChild(createTaskCard(t)));
  emptyState.style.display = filtered.length ? 'none' : 'block';
  updateStats();
  renderArchive();
}

function renderArchive() {
  const query = $('#archiveSearchInput').value.trim().toLowerCase();
  const archived = tasks.filter((t) => t.archived).filter((t) => {
    const haystack = `${t.clientName} ${t.taskName} ${t.description || ''}`.toLowerCase();
    return haystack.includes(query);
  });
  archiveGrid.innerHTML = '';
  archived.forEach((t) => archiveGrid.appendChild(createTaskCard(t)));
  archiveEmpty.style.display = archived.length ? 'none' : 'block';
  $('#archiveCount').textContent = archived.length;
}

function updateStats() {
  const active = tasks.filter((t) => !t.archived);
  $('#statTotal').textContent = active.length;
  $('#statPending').textContent = active.filter((t) => t.status === 'pendiente').length;
  $('#statDone').textContent = active.filter((t) => t.status === 'terminado' || t.status === 'entregado').length;
  $('#statBalance').textContent = money(active.reduce((sum, t) => sum + balance(t), 0));
}

function clearForm() {
  taskForm.reset();
  $('#taskId').value = '';
  $('#totalAmount').value = '0';
  $('#depositAmount').value = '0';
  $('#status').value = 'pendiente';
  $('#deliveryDate').value = todayLocal();
  $('#paymentDate').value = todayLocal();
  editingImage = '';
  editingImageFile = null;
  removeExistingImage = false;
  currentImageUrl = '';
  editingFinishedImage = '';
  editingFinishedImageFile = null;
  removeExistingFinishedImage = false;
  currentFinishedImageUrl = '';
  imagePreview.removeAttribute('src');
  finishedImagePreview?.removeAttribute('src');
  imageWrap?.classList.remove('active');
  syncEditorImageStage(false, '.editor-media-card:first-child .editor-image-stage');
  syncEditorImageStage(false, '.editor-media-card:nth-child(2) .editor-image-stage');
  $('#dialogTitle').textContent = 'Nueva tarea';
  $('#initialDepositWrap').hidden = false;
  $('#initialPaymentDateWrap').hidden = false;
  $('#depositAmount').disabled = false;
  $('#paymentDate').disabled = false;
  renderEmployeeOptions();
  updateSplitPreview();
}

function openNew() {
  clearForm();
  dialog.showModal();
}

function openEdit(id) {
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  detailDialog.close();
  clearForm();
  $('#dialogTitle').textContent = 'Editar tarea';
  $('#taskId').value = task.id;
  $('#clientName').value = task.clientName;
  $('#taskName').value = task.taskName;
  renderEmployeeOptions(task.workerName || '', task.orderTaker || '');
  $('#workerName').value = task.workerName || '';
  $('#orderTaker').value = task.orderTaker || '';
  $('#deliveryDate').value = task.deliveryDate || todayLocal();
  $('#status').value = task.status || 'pendiente';
  $('#totalAmount').value = task.totalAmount || 0;
  $('#description').value = task.description || '';
  $('#initialDepositWrap').hidden = true;
  $('#initialPaymentDateWrap').hidden = true;
  $('#depositAmount').disabled = true;
  $('#paymentDate').disabled = true;
  editingImage = task.image || '';
  currentImageUrl = task.image || '';
  if (editingImage) {
    imagePreview.src = editingImage;
    imageWrap?.classList.add('active');
    syncEditorImageStage(true, '.editor-media-card:first-child .editor-image-stage');
  }
  editingFinishedImage = task.finishedImage || '';
  currentFinishedImageUrl = task.finishedImage || '';
  if (editingFinishedImage) {
    finishedImagePreview.src = editingFinishedImage;
    syncEditorImageStage(true, '.editor-media-card:nth-child(2) .editor-image-stage');
  }
  updateSplitPreview();
  dialog.showModal();
}

function updateSplitPreview() {
  const amount = Math.max(0, Number($('#totalAmount').value || 0));
  $('#profitTotal').textContent = money(amount);
  $('#profitWorker').textContent = money(amount * 0.70);
  $('#profitTaker').textContent = money(amount * 0.30);
}

function renderDetailImage(task) {
  const images = [task.image, task.finishedImage].filter(Boolean);
  if (!images.length) images.push(placeholderSvg());
  detailImageIndex = Math.max(0, Math.min(detailImageIndex, images.length - 1));
  $('#detailImage').src = images[detailImageIndex];
  $('#detailImageCounter').textContent = `${detailImageIndex + 1} / ${images.length}`;
  $('#detailImagePrev').hidden = images.length < 2;
  $('#detailImageNext').hidden = images.length < 2;
}

function openDetail(id) {
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  detailTaskId = String(id);
  $('#detailTitle').textContent = task.taskName || 'Información de la tarea';
  detailImageIndex = 0;
  renderDetailImage(task);
  $('#detailStatus').textContent = statusLabel(task.status);
  $('#detailClient').textContent = task.clientName || '—';
  $('#detailTask').textContent = task.taskName || '—';
  $('#detailWorker').textContent = task.workerName || 'Sin asignar';
  $('#detailTaker').textContent = task.orderTaker || 'Sin asignar';
  $('#detailDelivery').textContent = prettyDate(task.deliveryDate);
  $('#detailTotal').textContent = money(task.totalAmount);
  $('#detailDeposit').textContent = money(task.depositAmount);
  $('#detailBalance').textContent = money(balance(task));
  $('#detailWorkerShareMini').textContent = `70% · ${money(distributable(task) * 0.70)}`;
  $('#detailTakerShareMini').textContent = `30% · ${money(distributable(task) * 0.30)}`;
  $('#detailDescription').textContent = task.description || 'Sin descripción';
  setMiniAvatar($('#detailWorkerAvatar'), task.workerName || '');
  setMiniAvatar($('#detailTakerAvatar'), task.orderTaker || '');

  const list = $('#paymentHistoryList');
  list.innerHTML = '';
  const history = [...(task.paymentHistory || [])].sort((a, b) => ((b.date || '') + (b.createdAt || '')).localeCompare((a.date || '') + (a.createdAt || '')));
  $('#paymentHistoryCount').textContent = `${history.length} registro(s)`;
  if (!history.length) {
    list.innerHTML = '<div class="history-empty">Aún no hay abonos registrados.</div>';
  } else {
    history.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <div class="history-main">
          <strong class="history-amount">${money(item.amount)}</strong>
          <div class="history-meta">
            <span class="history-tag">Abono</span>
            <span class="history-date">${prettyDate(item.date)}${item.createdAt ? ` · ${String(item.createdAt).slice(11, 16)}` : ''}</span>
          </div>
        </div>
        <div class="history-actions">
          <button type="button" class="history-edit" data-edit-payment="${escapeHtml(String(item.id))}" title="Editar abono" aria-label="Editar abono">${iconUse('icon-edit')}</button>
          <button type="button" class="history-delete" data-delete-payment="${escapeHtml(String(item.id))}" title="Eliminar abono" aria-label="Eliminar abono">${iconUse('icon-trash')}</button>
        </div>
      `;
      list.appendChild(row);
    });
  }
  detailDialog.showModal();
}

async function createInitialDeposit(taskId, amount, date) {
  if (Number(amount || 0) <= 0) return;
  await apiFetch(`/api/tareas/${taskId}/abonos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ valor: Number(amount), fecha: date || todayLocal() })
  });
}

function openPaymentDialog(task, mode = 'create', entry = null) {
  if (!task) return;
  if (detailDialog?.open) detailDialog.close();
  $('#paymentTaskId').value = task.id;
  $('#paymentEntryId').value = entry?.id ? String(entry.id) : '';
  $('#paymentDialogTitle').textContent = mode === 'edit' ? 'Editar abono' : 'Registrar abono';
  $('#paymentAmountLabel').textContent = mode === 'edit' ? 'Nuevo valor del abono' : '¿Cuánto deseas agregar?';
  $('#paymentSubmitBtn').textContent = mode === 'edit' ? 'Guardar cambios' : 'Guardar abono';
  $('#paymentCurrent').textContent = money(task.depositAmount);
  $('#paymentPending').textContent = money(balance(task));
  $('#paymentAmount').value = entry ? Number(entry.amount || 0) : '';
  $('#paymentEntryDate').value = entry?.date || todayLocal();
  paymentDialog.showModal();
  setTimeout(() => $('#paymentAmount').focus(), 60);
}

function addPayment(id) {
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  openPaymentDialog(task, 'create');
}

function editPayment(taskId, paymentId) {
  const { task, item } = findPayment(taskId, paymentId);
  if (!task || !item) {
    showToast('No se encontró el abono seleccionado.', 'Abono no disponible');
    return;
  }
  openPaymentDialog(task, 'edit', item);
}

async function updatePaymentEntry(taskId, paymentId, amount, date) {
  const body = JSON.stringify({ valor: amount, fecha: date || todayLocal() });
  const headers = { 'Content-Type': 'application/json' };
  const candidates = [
    `/api/abonos/${paymentId}`,
    `/api/tareas/${taskId}/abonos/${paymentId}`
  ];
  let lastError = null;
  for (const url of candidates) {
    try {
      return await apiFetch(url, { method: 'PUT', headers, body });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No se pudo editar el abono.');
}

async function deletePaymentEntry(taskId, paymentId) {
  const candidates = [
    `/api/abonos/${paymentId}`,
    `/api/tareas/${taskId}/abonos/${paymentId}`
  ];
  let lastError = null;
  for (const url of candidates) {
    try {
      return await apiFetch(url, { method: 'DELETE' });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('No se pudo eliminar el abono.');
}

async function removePayment(taskId, paymentId) {
  const { item } = findPayment(taskId, paymentId);
  if (!item) return;
  if (!window.confirm(`¿Eliminar el abono de ${money(item.amount)} del ${prettyDate(item.date)}?`)) return;
  try {
    await deletePaymentEntry(taskId, paymentId);
    await refreshTasks({ silent: true });
    if (detailTaskId) openDetail(detailTaskId);
    showToast('El abono fue eliminado correctamente.', 'Abono eliminado');
  } catch (err) {
    showToast(err.message, 'No se pudo eliminar el abono');
  }
}

async function saveTask(e) {
  e.preventDefault();
  const id = $('#taskId').value.trim();
  const clientName = $('#clientName').value.trim();
  const taskName = $('#taskName').value.trim();
  const workerName = $('#workerName').value.trim();
  const orderTaker = $('#orderTaker').value.trim();
  const deliveryDate = $('#deliveryDate').value;
  const status = $('#status').value;
  const totalAmount = Number($('#totalAmount').value || 0);
  const description = $('#description').value.trim();
  const initialDeposit = Number($('#depositAmount').value || 0);
  const paymentDate = $('#paymentDate').value || todayLocal();
  const submitBtn = taskForm.querySelector('[type="submit"]');

  if (!clientName || !taskName) {
    showToast('Completa al menos cliente y tarea.', 'Faltan datos');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando…';

  try {
    let imageUrl = currentImageUrl || editingImage || '';
    if (removeExistingImage) imageUrl = '';
    if (editingImageFile) imageUrl = await uploadImage(editingImageFile);

    let finishedImageUrl = currentFinishedImageUrl || editingFinishedImage || '';
    if (removeExistingFinishedImage) finishedImageUrl = '';
    if (editingFinishedImageFile) finishedImageUrl = await uploadImage(editingFinishedImageFile);

    const payload = {
      cliente: clientName,
      titulo: taskName,
      descripcion: description,
      fecha_entrega: deliveryDate,
      valor_total: totalAmount,
      responsable: workerName,
      tomo_pedido: orderTaker,
      estado: status,
      imagen_url: imageUrl,
      imagen_terminada_url: finishedImageUrl,
      archivada: false
    };

    if (id) {
      await apiFetch(`/api/tareas/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      showToast(`La tarea de ${clientName} fue actualizada.`, 'Tarea actualizada');
    } else {
      const created = await apiFetch('/api/tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await createInitialDeposit(created.id, initialDeposit, paymentDate);
      showToast(`La tarea de ${clientName} fue creada correctamente.`, 'Tarea guardada');
    }

    dialog.close();
    await refreshTasks({ silent: true });
  } catch (err) {
    console.error(err);
    showToast(err.message, 'No se pudo guardar');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar tarea';
  }
}

paymentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#paymentTaskId').value;
  const paymentId = $('#paymentEntryId').value;
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  const amount = Number(String($('#paymentAmount').value || '').replace(',', '.'));
  const date = $('#paymentEntryDate').value || todayLocal();
  if (!Number.isFinite(amount) || amount <= 0) {
    $('#paymentAmount').focus();
    return;
  }
  const submit = $('#paymentSubmitBtn');
  const originalText = submit.textContent;
  submit.disabled = true;
  submit.textContent = paymentId ? 'Guardando cambios…' : 'Guardando…';
  try {
    if (paymentId) {
      await updatePaymentEntry(id, paymentId, amount, date);
      paymentDialog.close();
      await refreshTasks({ silent: true });
      if (detailTaskId) openDetail(detailTaskId);
      showToast(`Se actualizó el abono a ${money(amount)}.`, 'Abono editado correctamente');
    } else {
      await apiFetch(`/api/tareas/${id}/abonos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valor: amount, fecha: date })
      });
      paymentDialog.close();
      await refreshTasks({ silent: true });
      if (detailTaskId) openDetail(detailTaskId);
      showToast(`Se registró ${money(amount)} para ${task.clientName}.`, 'Abono guardado correctamente');
    }
  } catch (err) {
    showToast(err.message, paymentId ? 'No se pudo editar el abono' : 'No se pudo guardar el abono');
  } finally {
    submit.disabled = false;
    submit.textContent = originalText;
  }
});

async function updateTaskState(id, patch, successTitle, successMessage) {
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  try {
    await apiFetch(`/api/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...toApi(task), ...patch })
    });
    detailDialog.close();
    await refreshTasks({ silent: true });
    showToast(successMessage, successTitle);
  } catch (err) {
    showToast(err.message, 'No se pudo actualizar');
  }
}
function markDelivered(id) {
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  updateTaskState(id, { estado: 'entregado' }, 'Tarea entregada', `La tarea de ${task.clientName} fue marcada como entregada.`);
}
function archiveTask(id) {
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  if (!task.archived && task.status !== 'entregado') {
    showToast('Primero marca el pedido como entregado.', 'No se puede archivar');
    return;
  }
  updateTaskState(
    id,
    { archivada: !task.archived },
    task.archived ? 'Pedido restaurado' : 'Pedido archivado',
    task.archived ? 'El pedido volvió a tareas activas.' : 'El pedido fue archivado.'
  );
}
function requestDelete(id) {
  const task = tasks.find((x) => x.id === String(id));
  if (!task) return;
  pendingDeleteId = String(id);
  $('#deleteMessage').textContent = `Vas a eliminar la tarea “${task.taskName}” de ${task.clientName}. Esta acción no se puede deshacer.`;
  detailDialog.close();
  deleteDialog.showModal();
}
async function confirmDelete() {
  const task = tasks.find((x) => x.id === String(pendingDeleteId));
  if (!task) {
    deleteDialog.close();
    return;
  }
  const btn = $('#confirmDelete');
  btn.disabled = true;
  btn.textContent = 'Eliminando…';
  try {
    await apiFetch(`/api/tareas/${pendingDeleteId}`, { method: 'DELETE' });
    deleteDialog.close();
    await refreshTasks({ silent: true });
    showToast(`“${task.taskName}” fue eliminada correctamente.`, 'Tarea eliminada');
  } catch (err) {
    showToast(err.message, 'No se pudo eliminar');
  } finally {
    pendingDeleteId = '';
    btn.disabled = false;
    btn.textContent = 'Sí, eliminar';
  }
}

async function migrateLocalTasks() {
  const local = loadLocalTasks();
  if (!local.length) {
    showToast('No hay tareas locales para migrar.', 'Migración');
    return;
  }
  if (localStorage.getItem(MIGRATION_KEY) === 'done') {
    showToast('Esta computadora ya realizó la migración anteriormente.', 'Migración completada');
    return;
  }
  const btn = $('#migrateLocal');
  btn.disabled = true;
  btn.textContent = 'Migrando…';
  let ok = 0;
  let failed = 0;

  try {
    for (const task of local) {
      try {
        let imageUrl = '';
        if (task.image && task.image.startsWith('data:image/')) {
          const blob = await (await fetch(task.image)).blob();
          const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          const file = new File([blob], `migrada-${Date.now()}.${ext}`, { type: blob.type });
          imageUrl = await uploadImage(file);
        } else if (task.image && task.image.startsWith('http')) {
          imageUrl = task.image;
        }

        const created = await apiFetch('/api/tareas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente: task.clientName || '',
            titulo: task.taskName || 'Tarea',
            descripcion: task.description || '',
            fecha_entrega: task.deliveryDate || '',
            valor_total: Number(task.totalAmount || 0),
            responsable: task.workerName || '',
            tomo_pedido: task.orderTaker || '',
            estado: task.status || 'pendiente',
            imagen_url: imageUrl,
            archivada: Boolean(task.archived)
          })
        });

        for (const item of (task.paymentHistory || [])) {
          if (Number(item.amount || 0) > 0) {
            await apiFetch(`/api/tareas/${created.id}/abonos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ valor: Number(item.amount), fecha: item.date || todayLocal() })
            });
          }
        }

        ok++;
      } catch (err) {
        console.error('Error migrando tarea', task, err);
        failed++;
      }
    }
    if (failed === 0) localStorage.setItem(MIGRATION_KEY, 'done');
    await refreshTasks({ silent: true });
    showToast(`${ok} tarea(s) migradas${failed ? ` · ${failed} con error` : ''}.`, 'Migración terminada');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Migrar tareas locales a la nube';
  }
}

function setArchiveView(show) {
  const archive = $('#archivados');
  const tasksSection = $('#tareas');
  archive.hidden = !show;
  tasksSection.hidden = show;
  if (show) {
    renderArchive();
    archive.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    tasksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function setTheme(theme, persist = true) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  renderThemeIcon(next);
  if (persist) {
    const settings = loadSettings();
    settings.theme = next;
    saveSettings(settings);
  }
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function applySiteIcon(dataUrl) {
  const wrap = document.querySelector('.brand-icon-wrap');
  const previewBox = document.querySelector('.icon-preview-box');
  if (dataUrl) {
    $('#brandIcon').src = dataUrl;
    $('#siteIconPreview').src = dataUrl;
    wrap.classList.add('has-icon');
    previewBox.classList.add('has-icon');
    $('#dynamicFavicon').href = dataUrl;
  } else {
    $('#brandIcon').removeAttribute('src');
    $('#siteIconPreview').removeAttribute('src');
    wrap.classList.remove('has-icon');
    previewBox.classList.remove('has-icon');
    $('#dynamicFavicon').href = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23b9ff39'/%3E%3Cpath d='M18 33l9 9 19-22' fill='none' stroke='%23111' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";
  }
}

function requestAdminPanel() {
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  $('#loginError').hidden = true;
  loginDialog.showModal();
  setTimeout(() => $('#loginUser').focus(), 50);
}
function currentCredentials() {
  const settings = loadSettings();
  return { user: settings.adminUser || 'admin', pass: settings.adminPass || '1234' };
}
function openAdminPanel() {
  const settings = loadSettings();
  $('#customUser').value = settings.adminUser || 'admin';
  $('#customPass').value = '';
  renderEmployeeList();
  clearEmployeeForm();
  adminDialog.showModal();
}

$('#loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const credentials = currentCredentials();
  if ($('#loginUser').value === credentials.user && $('#loginPass').value === credentials.pass) {
    loginDialog.close();
    openAdminPanel();
  } else {
    $('#loginError').hidden = false;
    $('#loginPass').select();
  }
});

function on(id, event, handler) {
  const el = $('#' + id);
  if (el) el.addEventListener(event, handler);
}

on('archiveNav', 'click', () => setArchiveView(true));
on('closeArchive', 'click', () => setArchiveView(false));
on('archiveSearchInput', 'input', renderArchive);
on('themeToggle', 'click', toggleTheme);
on('customizeBtn', 'click', requestAdminPanel);
on('closeLogin', 'click', () => loginDialog.close());
on('cancelLogin', 'click', () => loginDialog.close());
on('closeAdmin', 'click', () => adminDialog.close());
on('closeAdminFooter', 'click', () => adminDialog.close());
on('closePaymentDialog', 'click', () => paymentDialog.close());
on('cancelPaymentDialog', 'click', () => paymentDialog.close());
on('closeDialog', 'click', () => dialog.close());
on('cancelDialog', 'click', () => dialog.close());
on('closeDetail', 'click', () => detailDialog.close());
on('cancelDelete', 'click', () => deleteDialog.close());
on('confirmDelete', 'click', confirmDelete);
on('searchInput', 'input', render);
on('employeeFilter', 'change', render);
on('migrateLocal', 'click', migrateLocalTasks);
on('refreshCloud', 'click', () => refreshTasks());
['newTaskAction', 'newTaskEmpty'].forEach((id) => on(id, 'click', openNew));

on('detailEdit', 'click', () => openEdit(detailTaskId));
on('detailPay', 'click', () => addPayment(detailTaskId));
on('detailDeliver', 'click', () => markDelivered(detailTaskId));
on('detailArchive', 'click', () => archiveTask(detailTaskId));
on('detailDelete', 'click', () => requestDelete(detailTaskId));

$('#paymentHistoryList').addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit-payment]');
  if (editBtn) {
    editPayment(detailTaskId, editBtn.dataset.editPayment);
    return;
  }
  const deleteBtn = e.target.closest('[data-delete-payment]');
  if (deleteBtn) removePayment(detailTaskId, deleteBtn.dataset.deletePayment);
});

on('detailImagePrev', 'click', () => {
  const task = tasks.find((x) => x.id === String(detailTaskId));
  if (!task) return;
  const images = [task.image, task.finishedImage].filter(Boolean);
  if (images.length < 2) return;
  detailImageIndex = (detailImageIndex - 1 + images.length) % images.length;
  renderDetailImage(task);
});
on('detailImageNext', 'click', () => {
  const task = tasks.find((x) => x.id === String(detailTaskId));
  if (!task) return;
  const images = [task.image, task.finishedImage].filter(Boolean);
  if (images.length < 2) return;
  detailImageIndex = (detailImageIndex + 1) % images.length;
  renderDetailImage(task);
});
on('navQuote', 'click', () => showToast('El cotizador se agregará en una próxima versión.', 'Cotizador próximamente'));

$$('.filter-chip').forEach((btn) => btn.addEventListener('click', () => {
  activeStatus = btn.dataset.status;
  $$('.filter-chip').forEach((b) => b.classList.toggle('active', b === btn));
  render();
}));

$('#siteIconInput').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 600_000) {
    showToast('Usa un icono menor a 600 KB.', 'Archivo demasiado grande');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const settings = loadSettings();
    settings.siteIcon = reader.result;
    saveSettings(settings);
    applySiteIcon(reader.result);
    showToast('El logo de la página fue actualizado.');
  };
  reader.readAsDataURL(file);
});

on('resetIcon', 'click', () => {
  const settings = loadSettings();
  delete settings.siteIcon;
  saveSettings(settings);
  applySiteIcon('');
  $('#siteIconInput').value = '';
  showToast('Se restauró el icono original.');
});

on('saveAccess', 'click', () => {
  const user = $('#customUser').value.trim();
  const pass = $('#customPass').value;
  if (!user) {
    showToast('Escribe un usuario válido.', 'No se guardó');
    return;
  }
  const settings = loadSettings();
  settings.adminUser = user;
  if (pass) settings.adminPass = pass;
  else if (!settings.adminPass) settings.adminPass = '1234';
  saveSettings(settings);
  $('#customPass').value = '';
  showToast('Usuario y contraseña actualizados.', 'Acceso actualizado');
});

$('#taskImage').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  editingImageFile = file;
  removeExistingImage = false;
  const reader = new FileReader();
  reader.onload = () => {
    imagePreview.src = reader.result;
    imageWrap?.classList.add('active');
    syncEditorImageStage(true, '.editor-media-card:first-child .editor-image-stage');
  };
  reader.readAsDataURL(file);
});

on('removeImage', 'click', () => {
  editingImageFile = null;
  removeExistingImage = true;
  currentImageUrl = '';
  $('#taskImage').value = '';
  imagePreview.removeAttribute('src');
  imageWrap?.classList.remove('active');
  syncEditorImageStage(false, '.editor-media-card:first-child .editor-image-stage');
});

$('#finishedTaskImage').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  editingFinishedImageFile = file;
  removeExistingFinishedImage = false;
  const reader = new FileReader();
  reader.onload = () => {
    finishedImagePreview.src = reader.result;
    syncEditorImageStage(true, '.editor-media-card:nth-child(2) .editor-image-stage');
  };
  reader.readAsDataURL(file);
});

on('removeFinishedImage', 'click', () => {
  editingFinishedImageFile = null;
  removeExistingFinishedImage = true;
  currentFinishedImageUrl = '';
  $('#finishedTaskImage').value = '';
  finishedImagePreview.removeAttribute('src');
  syncEditorImageStage(false, '.editor-media-card:nth-child(2) .editor-image-stage');
});
$('#totalAmount').addEventListener('input', updateSplitPreview);
taskForm.addEventListener('submit', saveTask);

$('#employeePhoto').addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    employeeEditingPhoto = reader.result;
    employeeEditingPhotoFile = file;
    setEmployeeAvatarBox($('#employeePhotoPreview'), employeeEditingPhoto, $('#employeeName').value.trim());
  };
  reader.readAsDataURL(file);
});
$('#employeeName').addEventListener('input', () => {
  if (!employeeEditingPhoto) setEmployeeAvatarBox($('#employeePhotoPreview'), '', $('#employeeName').value.trim());
});
on('employeeCancelBtn', 'click', clearEmployeeForm);

employeeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#employeeId').value.trim();
  const name = $('#employeeName').value.trim();
  if (!name) { showToast('Escribe el nombre del empleado.', 'Faltan datos'); return; }
  const duplicated = employees.find((emp) => emp.name.toLowerCase() === name.toLowerCase() && String(emp.id) !== id);
  if (duplicated) { showToast('Ya existe un empleado con ese nombre.', 'Nombre duplicado'); return; }
  const btn = $('#employeeSaveBtn');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    let photoUrl = employeeEditingPhoto || '';
    if (employeeEditingPhotoFile) photoUrl = await uploadImage(employeeEditingPhotoFile);
    const payload = { nombre:name, foto_url:photoUrl };
    await apiFetch(id ? `/api/empleados/${id}` : '/api/empleados', { method:id ? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    await refreshEmployees({ migrateLocal:false });
    clearEmployeeForm();
    render();
    showToast(id ? `Se actualizó a ${name}.` : `Se creó a ${name}.`, id ? 'Empleado actualizado' : 'Empleado guardado');
  } catch (err) { showToast(err.message, 'No se pudo guardar el empleado'); }
  finally { btn.disabled=false; btn.textContent=original; }
});

$('#employeeList').addEventListener('click', (e) => {
  const editId = e.target.closest('[data-edit-employee]')?.dataset.editEmployee;
  const deleteId = e.target.closest('[data-delete-employee]')?.dataset.deleteEmployee;
  if (editId) editEmployee(editId);
  if (deleteId) removeEmployee(deleteId);
});


window.addEventListener('error', (event) => {
  console.error(`[DeTodoEc V${APP_VERSION}]`, event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(`[DeTodoEc V${APP_VERSION}] Promesa rechazada`, event.reason);
});

const initialSettings = loadSettings();
employees = loadEmployees();
const preferredTheme = initialSettings.theme || ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
setTheme(preferredTheme, false);
applySiteIcon(initialSettings.siteIcon || '');
renderEmployeeList();
renderEmployeeFilter();
render();
refreshTasks();
refreshEmployees();
const searchBox = $('#searchInput');
if (searchBox) { searchBox.value = ''; setTimeout(() => { if (searchBox.value.includes('@')) { searchBox.value=''; render(); } }, 300); }

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
