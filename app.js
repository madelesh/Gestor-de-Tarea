const APP_VERSION = '10.9.1';
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
let designs = [];
let designEditingPreviewUrl = '';
let designEditingSourceUrl = '';
let designEditingPreviewFile = null;
let designEditingSourceFile = null;
let pendingAdminSection = 'apariencia';

const QUOTE_DEFAULTS = [
  { clave:'lona', nombre:'Lona', precio:7.25, activo:1, orden:1 },
  { clave:'lona_microperforada', nombre:'Lona Microperforada', precio:null, activo:0, orden:2 },
  { clave:'lona_translucida', nombre:'Lona Translucida', precio:12.00, activo:1, orden:3 },
  { clave:'vinil_blanco', nombre:'Vinil Blanco', precio:8.50, activo:1, orden:4 },
  { clave:'vinil_transparente', nombre:'Vinil Transparente', precio:null, activo:0, orden:5 },
  { clave:'pvc', nombre:'PVC', precio:25.00, activo:1, orden:6 },
  { clave:'lapida', nombre:'Lapidas', precio:65.00, activo:1, orden:7 }
];
let quoteMaterials = QUOTE_DEFAULTS.map((x) => ({...x}));
let quoteItems = [];
const QUOTE_EXTRAS = {
  eyelet: 0.50,
  cut: 1.00,
  design: 2.75
};

const MATERIAL_ICONS = {
  lona: 'icon-banner',
  lona_microperforada: 'icon-banner',
  lona_translucida: 'icon-banner',
  vinil_blanco: 'icon-vinyl',
  vinil_transparente: 'icon-vinyl',
  pvc: 'icon-pvc',
  lapida: 'icon-stone'
};

const DEFAULT_QUOTE_ICON_SETTINGS = {
  eyelet: 'icon-eyelet',
  cut: 'icon-cut',
  design: 'icon-design'
};

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
const designForm = $('#designForm');

const DESIGN_MATERIALS = ['MDF', 'Acrílico', 'Vinil', 'Tornillos'];

function selectedDesignMaterials() {
  return $$('.design-material-chip.is-selected').map((btn) => btn.dataset.material).filter(Boolean);
}

function syncDesignMaterialsInput() {
  const input = $('#designMaterials');
  if (input) input.value = selectedDesignMaterials().join(', ');
}

function setDesignMaterials(value = '') {
  const selected = new Set(String(value || '').split(',').map((v) => v.trim()).filter(Boolean));
  $$('.design-material-chip').forEach((btn) => {
    const on = selected.has(btn.dataset.material);
    btn.classList.toggle('is-selected', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  syncDesignMaterialsInput();
}

function populateDesignTimeValues(unit = 'horas', selectedValue = 1) {
  const valueSelect = $('#designTimeValue');
  if (!valueSelect) return;
  const max = unit === 'dias' ? 30 : 24;
  valueSelect.innerHTML = '';
  for (let i = 1; i <= max; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    valueSelect.appendChild(opt);
  }
  valueSelect.value = String(Math.min(Math.max(Number(selectedValue) || 1, 1), max));
  syncDesignTimeInput();
}

function syncDesignTimeInput() {
  const value = Number($('#designTimeValue')?.value || 1);
  const unit = $('#designTimeUnit')?.value || 'horas';
  const input = $('#designTime');
  if (input) input.value = `${value} ${unit}`;
}

function setDesignTime(value = '') {
  const match = String(value || '').trim().match(/(\d+)\s*(hora|horas|día|dias|día|días)/i);
  let amount = match ? Number(match[1]) : 1;
  let unit = match && /d/i.test(match[2]) ? 'dias' : 'horas';
  if ($('#designTimeUnit')) $('#designTimeUnit').value = unit;
  populateDesignTimeValues(unit, amount);
}
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
function deliveryCountdown(v) {
  if (!v) return { text: 'Sin fecha', tone: 'neutral' };
  const clean = String(v).slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return { text: 'Sin fecha', tone: 'neutral' };
  const target = new Date(y, m - 1, d);
  target.setHours(0,0,0,0);
  const today = new Date();
  today.setHours(0,0,0,0);
  const days = Math.round((target - today) / 86400000);
  if (days > 1) return { text: `Faltan ${days} días`, tone: days <= 3 ? 'warning' : 'ok' };
  if (days === 1) return { text: 'Falta 1 día', tone: 'warning' };
  if (days === 0) return { text: 'Entrega hoy', tone: 'late' };
  const late = Math.abs(days);
  return { text: `Atrasado ${late} ${late === 1 ? 'día' : 'días'}`, tone: 'late' };
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

async function uploadDesignFile(file) {
  const fd = new FormData();
  fd.append('archivo', file);
  const data = await apiFetch('/api/archivos', { method: 'POST', body: fd });
  return { url: data.url || '', name: data.nombre || file.name || '', type: data.tipo || file.type || '' };
}

function fromDesignApi(item) {
  return {
    id: String(item.id),
    name: item.nombre || '',
    description: item.descripcion || '',
    price: Number(item.precio || 0),
    materials: item.materiales || '',
    width: Number(item.ancho || 0),
    height: Number(item.alto || 0),
    time: item.tiempo_estimado || '',
    previewUrl: item.preview_url || '',
    fileUrl: item.archivo_url || '',
    fileName: item.archivo_nombre || '',
    fileType: item.archivo_tipo || ''
  };
}

async function refreshDesigns({ silent = true } = {}) {
  try {
    const data = await apiFetch('/api/disenos');
    designs = (Array.isArray(data) ? data : []).map(fromDesignApi);
    renderDesigns();
    renderAdminDesigns();
  } catch (err) {
    console.error('No se pudieron cargar los diseños', err);
    designs = [];
    renderDesigns();
    renderAdminDesigns();
    if (!silent) showToast(err.message, 'No se pudieron cargar los diseños');
  }
}

function designFileLabel(design) {
  const name = String(design.fileName || '').trim();
  if (name.includes('.')) return name.split('.').pop().toUpperCase();
  if (String(design.fileType || '').includes('svg')) return 'SVG';
  return 'AI';
}

function renderDesigns() {
  const grid = $('#designGrid');
  const empty = $('#designEmpty');
  if (!grid || !empty) return;
  const q = ($('#designSearchInput')?.value || '').trim().toLowerCase();
  const filtered = designs.filter((d) => `${d.name} ${d.materials} ${d.description}`.toLowerCase().includes(q));
  grid.innerHTML = '';
  filtered.forEach((d) => {
    const card = document.createElement('article');
    card.className = 'design-card';
    card.innerHTML = `
      <div class="design-preview"><img src="${escapeHtml(d.previewUrl || placeholderSvg())}" alt="Vista previa de ${escapeHtml(d.name)}" /></div>
      <div class="design-card-body">
        <div class="design-card-title"><h3>${escapeHtml(d.name)}</h3><span class="design-price">${money(d.price)}</span></div>
        ${d.description ? `<p class="design-description">${escapeHtml(d.description)}</p>` : ''}
        <div class="design-specs">
          <div class="design-spec design-materials"><span class="field-icon-badge">${iconUse('icon-box')}</span><span><small>Materiales</small><strong>${escapeHtml(d.materials || 'Sin especificar')}</strong></span></div>
          <div class="design-spec"><span class="field-icon-badge">${iconUse('icon-ruler')}</span><span><small>Medidas</small><strong>${Number(d.width || 0).toFixed(2)} × ${Number(d.height || 0).toFixed(2)} cm</strong></span></div>
          <div class="design-spec"><span class="field-icon-badge">${iconUse('icon-clock')}</span><span><small>Tiempo</small><strong>${escapeHtml(d.time || 'Sin estimar')}</strong></span></div>
        </div>
        <span class="design-file-type">Archivo ${escapeHtml(designFileLabel(d))}</span>
        <a class="btn btn-dark design-download" href="${escapeHtml(d.fileUrl)}" target="_blank" rel="noopener" download="${escapeHtml(d.fileName || '')}">${iconUse('icon-download')}<span>Descargar archivo</span></a>
      </div>`;
    grid.appendChild(card);
  });
  empty.style.display = filtered.length ? 'none' : 'block';
}

function renderAdminDesigns() {
  const box = $('#adminDesignList');
  if (!box) return;
  box.innerHTML = '';
  if (!designs.length) {
    box.innerHTML = '<div class="admin-design-empty">Todavía no hay diseños guardados.</div>';
    return;
  }
  designs.forEach((d) => {
    const row = document.createElement('article');
    row.className = 'admin-design-card';
    row.innerHTML = `
      <img src="${escapeHtml(d.previewUrl || placeholderSvg())}" alt="" />
      <div class="admin-design-main"><strong>${escapeHtml(d.name)}</strong><span>${money(d.price)} · ${escapeHtml(d.materials)} · ${Number(d.width || 0).toFixed(2)} × ${Number(d.height || 0).toFixed(2)} cm · ${escapeHtml(d.time)}</span></div>
      <div class="admin-design-actions"><button type="button" class="btn btn-outline small" data-edit-design="${d.id}">Editar</button><button type="button" class="btn btn-danger small" data-delete-design="${d.id}">Eliminar</button></div>`;
    box.appendChild(row);
  });
}

function clearDesignForm() {
  if (!designForm) return;
  designForm.reset();
  $('#designId').value = '';
  designEditingPreviewUrl = '';
  designEditingSourceUrl = '';
  designEditingPreviewFile = null;
  designEditingSourceFile = null;
  $('#designFormPreviewWrap').hidden = true;
  $('#designFormPreview').removeAttribute('src');
  $('#designCurrentFileName').textContent = '';
  $('#designSaveBtn').textContent = 'Guardar diseño';
  setDesignMaterials('');
  setDesignTime('1 horas');
}

function editDesign(id) {
  const d = designs.find((x) => x.id === String(id));
  if (!d) return;
  $('#designId').value = d.id;
  $('#designName').value = d.name;
  $('#designPrice').value = d.price;
  setDesignMaterials(d.materials);
  setDesignTime(d.time);
  $('#designWidth').value = d.width;
  $('#designHeight').value = d.height;
  $('#designDescription').value = d.description || '';
  designEditingPreviewUrl = d.previewUrl || '';
  designEditingSourceUrl = d.fileUrl || '';
  designEditingPreviewFile = null;
  designEditingSourceFile = null;
  $('#designFormPreviewWrap').hidden = false;
  $('#designFormPreview').src = d.previewUrl || placeholderSvg();
  $('#designCurrentFileName').textContent = d.fileName || 'Archivo guardado';
  $('#designSaveBtn').textContent = 'Actualizar diseño';
  showAdminSection('disenos');
}

async function deleteDesign(id) {
  const d = designs.find((x) => x.id === String(id));
  if (!d) return;
  if (!window.confirm(`¿Eliminar el diseño "${d.name}"?`)) return;
  try {
    await apiFetch(`/api/disenos/${id}`, { method:'DELETE' });
    await refreshDesigns({ silent:true });
    showToast(`Se eliminó ${d.name}.`, 'Diseño eliminado');
  } catch (err) {
    showToast(err.message, 'No se pudo eliminar el diseño');
  }
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

function normalizeQuoteMaterial(item) {
  return {
    clave: String(item?.clave || ''),
    nombre: String(item?.nombre || ''),
    precio: item?.precio === null || item?.precio === undefined || item?.precio === '' ? null : Number(item.precio),
    activo: Number(item?.activo ?? 0) ? 1 : 0,
    orden: Number(item?.orden || 999)
  };
}

async function refreshQuoteMaterials({ silent = true } = {}) {
  try {
    const data = await apiFetch('/api/cotizador/materiales');
    if (Array.isArray(data) && data.length) quoteMaterials = data.map(normalizeQuoteMaterial).sort((a,b) => a.orden-b.orden);
  } catch (err) {
    console.error('No se pudieron cargar los precios del cotizador', err);
    quoteMaterials = QUOTE_DEFAULTS.map((x) => ({...x}));
    if (!silent) showToast('Se usaron precios locales de respaldo.', 'Cotizador sin sincronizar');
  }
  renderQuoteMaterialSelect();
  renderQuotePriceAdmin();
  calculateQuote();
}

function renderQuoteMaterialSelect() {
  const select = $('#quoteMaterial');
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '';
  quoteMaterials.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.clave;
    option.textContent = item.activo && Number.isFinite(item.precio)
      ? `${item.nombre} — ${money(item.precio)}/m²`
      : `${item.nombre} — No disponible por el momento`;
    option.disabled = !(item.activo && Number.isFinite(item.precio));
    select.appendChild(option);
  });
  const available = quoteMaterials.find((x) => x.activo && Number.isFinite(x.precio));
  if (previous && [...select.options].some((o) => o.value === previous && !o.disabled)) select.value = previous;
  else if (available) select.value = available.clave;
  renderQuoteMaterialIcon();
}

function currentQuoteMaterial() {
  const key = $('#quoteMaterial')?.value;
  return quoteMaterials.find((x) => x.clave === key) || quoteMaterials.find((x) => x.activo && Number.isFinite(x.precio)) || null;
}

function materialIconId(key) {
  return MATERIAL_ICONS[key] || 'icon-task';
}

function renderQuoteMaterialIcon() {
  const material = currentQuoteMaterial();
  const slot = $('#quoteMaterialIcon');
  if (!slot) return;
  slot.innerHTML = iconUse(materialIconId(material?.clave));
}

function loadQuoteIconSettings() {
  const settings = loadSettings();
  return { ...DEFAULT_QUOTE_ICON_SETTINGS, ...(settings.quoteExtraIcons || {}) };
}

function applyQuoteExtraIcons() {
  const icons = loadQuoteIconSettings();
  const pairs = [
    ['#quoteEyeletsEnabled', icons.eyelet],
    ['#quoteCutEnabled', icons.cut],
    ['#quoteDesignEnabled', icons.design]
  ];
  pairs.forEach(([selector, iconId]) => {
    const input = $(selector);
    const label = input?.closest('.quote-extra-option');
    const slot = label?.querySelector('.quote-extra-icon');
    if (slot) slot.innerHTML = iconUse(iconId);
  });
  if ($('#quoteEyeletIconSelect')) $('#quoteEyeletIconSelect').value = icons.eyelet;
  if ($('#quoteCutIconSelect')) $('#quoteCutIconSelect').value = icons.cut;
  if ($('#quoteDesignIconSelect')) $('#quoteDesignIconSelect').value = icons.design;
}

function saveQuoteIconSettings() {
  const settings = loadSettings();
  settings.quoteExtraIcons = {
    eyelet: $('#quoteEyeletIconSelect')?.value || DEFAULT_QUOTE_ICON_SETTINGS.eyelet,
    cut: $('#quoteCutIconSelect')?.value || DEFAULT_QUOTE_ICON_SETTINGS.cut,
    design: $('#quoteDesignIconSelect')?.value || DEFAULT_QUOTE_ICON_SETTINGS.design
  };
  saveSettings(settings);
  applyQuoteExtraIcons();
}

function getQuoteDraft() {
  const material = currentQuoteMaterial();
  const width = Math.max(0, Number($('#quoteWidth')?.value || 0));
  const height = Math.max(0, Number($('#quoteHeight')?.value || 0));
  const qty = Math.max(1, Math.floor(Number($('#quoteQty')?.value || 1)));
  const area = width * height * qty;
  const price = material && material.activo && Number.isFinite(material.precio) ? Number(material.precio) : null;
  const materialTotal = price === null ? 0 : area * price;
  const eyeletsEnabled = Boolean($('#quoteEyeletsEnabled')?.checked);
  const eyeletsQty = eyeletsEnabled ? Math.max(0, Math.floor(Number($('#quoteEyeletsQty')?.value || 0))) : 0;
  const cutEnabled = Boolean($('#quoteCutEnabled')?.checked);
  const cutMeters = cutEnabled ? Math.max(0, Number($('#quoteCutMeters')?.value || 0)) : 0;
  const designEnabled = Boolean($('#quoteDesignEnabled')?.checked);
  const extras = {
    eyelets: eyeletsQty * QUOTE_EXTRAS.eyelet,
    cut: cutMeters * QUOTE_EXTRAS.cut,
    design: designEnabled ? QUOTE_EXTRAS.design : 0
  };
  const extrasTotal = extras.eyelets + extras.cut + extras.design;
  const total = materialTotal + extrasTotal;
  return { material, width, height, qty, area, price, materialTotal, eyeletsEnabled, eyeletsQty, cutEnabled, cutMeters, designEnabled, extras, extrasTotal, total };
}

function calculateQuote() {
  renderQuoteMaterialIcon();
  const eyeletsEnabled = Boolean($('#quoteEyeletsEnabled')?.checked);
  const cutEnabled = Boolean($('#quoteCutEnabled')?.checked);
  if ($('#quoteEyeletsQty')) $('#quoteEyeletsQty').disabled = !eyeletsEnabled;
  if ($('#quoteCutMeters')) $('#quoteCutMeters').disabled = !cutEnabled;
  const draft = getQuoteDraft();
  if ($('#quoteArea')) $('#quoteArea').textContent = `${draft.area.toFixed(2)} m²`;
  if ($('#quoteMaterialName')) $('#quoteMaterialName').textContent = draft.material?.nombre || 'Material';
  if ($('#quoteUnitPrice')) $('#quoteUnitPrice').textContent = draft.price === null ? 'No disponible' : `${money(draft.price)}/m²`;
  if ($('#quoteSubtotal')) $('#quoteSubtotal').textContent = draft.price === null ? '—' : money(draft.total);
  if ($('#quoteNote')) {
    if (draft.price === null) $('#quoteNote').textContent = 'Este material está deshabilitado hasta que se configure su precio real.';
    else if (draft.extrasTotal > 0) $('#quoteNote').textContent = `Material ${money(draft.materialTotal)} + acabados ${money(draft.extrasTotal)}.`;
    else $('#quoteNote').textContent = 'Listo para agregar a la cotización.';
  }
  $('#addQuoteItem')?.toggleAttribute('disabled', draft.price === null || draft.area <= 0);
}

function addQuoteItem() {
  const draft = getQuoteDraft();
  if (!draft.material || draft.price === null || draft.area <= 0) return;
  quoteItems.push({
    id: crypto.randomUUID(),
    clave: draft.material.clave,
    nombre: draft.material.nombre,
    width: draft.width,
    height: draft.height,
    qty: draft.qty,
    area: draft.area,
    price: draft.price,
    materialTotal: draft.materialTotal,
    eyeletsQty: draft.eyeletsQty,
    cutMeters: draft.cutMeters,
    designEnabled: draft.designEnabled,
    extras: draft.extras,
    extrasTotal: draft.extrasTotal,
    total: draft.total
  });
  renderQuoteItems();
  showToast(`${draft.material.nombre} agregado a la cotización.`, 'Material agregado');
}

function renderQuoteItems() {
  const box = $('#quoteItems');
  const empty = $('#quoteEmpty');
  if (!box || !empty) return;
  box.innerHTML = '';
  quoteItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'quote-item';
    row.innerHTML = `
      <div class="quote-item-index quote-item-material-icon">${iconUse(materialIconId(item.clave))}</div>
      <div class="quote-item-main">
        <strong>${escapeHtml(item.nombre)}</strong>
        <small>${item.width.toFixed(2)} m × ${item.height.toFixed(2)} m · ${item.qty} ${item.qty === 1 ? 'pieza' : 'piezas'} · ${item.area.toFixed(2)} m²</small>
        <span>${money(item.price)}/m²</span>
        ${item.eyeletsQty ? `<span class="quote-item-extra">Ojales: ${item.eyeletsQty} × ${money(QUOTE_EXTRAS.eyelet)}</span>` : ''}
        ${item.cutMeters ? `<span class="quote-item-extra">Corte: ${item.cutMeters.toFixed(2)} m × ${money(QUOTE_EXTRAS.cut)}</span>` : ''}
        ${item.designEnabled ? `<span class="quote-item-extra">Diseño: ${money(QUOTE_EXTRAS.design)}</span>` : ''}
      </div>
      <strong class="quote-item-total">${money(item.total)}</strong>
      <button type="button" class="quote-item-remove" data-remove-quote="${item.id}" title="Quitar material" aria-label="Quitar material">×</button>
    `;
    box.appendChild(row);
  });
  empty.hidden = quoteItems.length > 0;
  const total = quoteItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  $('#quoteTotal').textContent = money(total);
  $('#copyQuote')?.toggleAttribute('disabled', quoteItems.length === 0);
  $('#clearQuote')?.toggleAttribute('disabled', quoteItems.length === 0);
}

function removeQuoteItem(id) {
  quoteItems = quoteItems.filter((item) => item.id !== id);
  renderQuoteItems();
}

function clearQuote() {
  quoteItems = [];
  renderQuoteItems();
}

function renderQuotePriceAdmin() {
  const box = $('#quotePriceAdmin');
  if (!box) return;
  box.innerHTML = '';
  quoteMaterials.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'quote-price-row';
    row.dataset.key = item.clave;
    row.innerHTML = `
      <div class="quote-price-name quote-price-name-with-icon"><span class="quote-material-mini-icon">${iconUse(materialIconId(item.clave))}</span><span><strong>${escapeHtml(item.nombre)}</strong><small>Precio por metro cuadrado</small></span></div>
      <label class="quote-price-input"><span>$</span><input type="number" min="0" step="0.01" data-quote-price="${escapeHtml(item.clave)}" value="${item.precio ?? ''}" placeholder="Sin precio" /></label>
      <label class="quote-toggle"><input type="checkbox" data-quote-active="${escapeHtml(item.clave)}" ${item.activo ? 'checked' : ''} /> Disponible</label>
    `;
    box.appendChild(row);
  });
}

async function saveQuotePrices() {
  const btn = $('#saveQuotePrices');
  if (!btn) return;
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    for (const item of quoteMaterials) {
      const input = document.querySelector(`[data-quote-price="${item.clave}"]`);
      const toggle = document.querySelector(`[data-quote-active="${item.clave}"]`);
      const raw = input?.value?.trim() ?? '';
      const precio = raw === '' ? null : Number(raw);
      const activo = Boolean(toggle?.checked && Number.isFinite(precio) && precio >= 0);
      await apiFetch(`/api/cotizador/materiales/${encodeURIComponent(item.clave)}`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ precio, activo })
      });
    }
    saveQuoteIconSettings();
    await refreshQuoteMaterials({ silent:true });
    showToast('Los precios e iconos del cotizador se actualizaron.', 'Cambios guardados');
  } catch (err) {
    showToast(err.message, 'No se pudieron guardar los precios');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

function showMainView(view) {
  const isTasks = view === 'tasks';
  const isQuote = view === 'quote';
  const isDesigns = view === 'designs';
  $('#resumen').hidden = !isTasks;
  $('#tareas').hidden = !isTasks;
  $('#archivados').hidden = true;
  $('#cotizador').hidden = !isQuote;
  $('#disenos').hidden = !isDesigns;
  $('#navTasks')?.classList.toggle('active', isTasks);
  $('#navQuote')?.classList.toggle('active', isQuote);
  $('#navDesigns')?.classList.toggle('active', isDesigns);
  if (isQuote) {
    renderQuoteMaterialSelect();
    applyQuoteExtraIcons();
    calculateQuote();
  }
  if (isDesigns) renderDesigns();
}

function copyQuoteSummary() {
  if (!quoteItems.length) return;
  const total = quoteItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const lines = ['Cotización DeTodoEc', ''];
  quoteItems.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.nombre}`);
    lines.push(`   ${item.width.toFixed(2)} m × ${item.height.toFixed(2)} m × ${item.qty} = ${item.area.toFixed(2)} m²`);
    lines.push(`   ${money(item.price)}/m² → ${money(item.materialTotal ?? (item.area * item.price))}`);
    if (item.eyeletsQty) lines.push(`   + Ojales: ${item.eyeletsQty} × ${money(QUOTE_EXTRAS.eyelet)} = ${money(item.extras?.eyelets || 0)}`);
    if (item.cutMeters) lines.push(`   + Corte: ${item.cutMeters.toFixed(2)} m × ${money(QUOTE_EXTRAS.cut)} = ${money(item.extras?.cut || 0)}`);
    if (item.designEnabled) lines.push(`   + Diseño = ${money(QUOTE_EXTRAS.design)}`);
    lines.push(`   Subtotal: ${money(item.total)}`);
  });
  lines.push('', `TOTAL: ${money(total)}`);
  const content = lines.join('\n');
  navigator.clipboard?.writeText(content)
    .then(() => showToast('La cotización fue copiada y está lista para enviarla al cliente.', 'Cotización copiada'))
    .catch(() => showToast(content, 'Cotización lista'));
}

function showAdminSection(section) {
  const target = section || 'apariencia';
  $$('.admin-view').forEach((view) => {
    const active = view.dataset.adminView === target;
    view.hidden = !active;
    view.classList.toggle('active', active);
  });
  $$('.admin-nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.adminTarget === target));
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

    // V10.4: si una tarea está totalmente pagada y en estado final,
    // se archiva automáticamente en la nube para que ocurra en todas las PCs.
    const autoArchive = tasks.filter((t) =>
      !t.archived &&
      (t.status === 'terminado' || t.status === 'entregado') &&
      balance(t) <= 0.0001
    );

    if (autoArchive.length) {
      await Promise.all(autoArchive.map((task) =>
        apiFetch(`/api/tareas/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...toApi(task), archivada: true })
        }).catch((error) => {
          console.error('No se pudo archivar automáticamente', task.id, error);
          return null;
        })
      ));

      const refreshed = await apiFetch('/api/tareas');
      tasks = (Array.isArray(refreshed) ? refreshed : []).map(fromApi);
    }

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
  const cardBalance = node.querySelector('.card-balance');
  if (cardBalance) cardBalance.textContent = money(balance(task));
  const countdown = deliveryCountdown(task.deliveryDate);
  const countdownEl = node.querySelector('.card-days-left');
  if (countdownEl) {
    countdownEl.textContent = countdown.text;
    countdownEl.dataset.tone = countdown.tone;
  }
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
  const sortByDate = (a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || '');

  if (activeStatus === 'all') {
    const groups = [
      { key: 'pendiente', label: 'Pendientes' },
      { key: 'proceso', label: 'En proceso' },
      { key: 'terminado', label: 'Terminados' },
      { key: 'entregado', label: 'Entregados' }
    ];

    groups.forEach((group) => {
      const items = filtered.filter((t) => t.status === group.key).sort(sortByDate);
      if (!items.length) return;
      const heading = document.createElement('div');
      heading.className = `task-group-heading task-group-${group.key}`;
      heading.innerHTML = `<strong>${group.label}</strong><span>${items.length}</span>`;
      taskGrid.appendChild(heading);
      items.forEach((t) => taskGrid.appendChild(createTaskCard(t)));
    });
  } else {
    filtered.sort(sortByDate).forEach((t) => taskGrid.appendChild(createTaskCard(t)));
  }

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

function requestAdminPanel(section = 'apariencia') {
  pendingAdminSection = section || 'apariencia';
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
  renderQuotePriceAdmin();
  clearEmployeeForm();
  showAdminSection('apariencia');
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
on('customizeBtn', 'click', () => requestAdminPanel('apariencia'));
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
on('navQuote', 'click', () => showMainView('quote'));
on('navTasks', 'click', () => showMainView('tasks'));
on('navDesigns', 'click', () => showMainView('designs'));
on('manageDesignsBtn', 'click', () => requestAdminPanel('disenos'));
on('designSearchInput', 'input', renderDesigns);

['quoteEyeletIconSelect','quoteCutIconSelect','quoteDesignIconSelect'].forEach((id) => on(id, 'change', applyQuoteExtraIcons));
['quoteMaterial','quoteWidth','quoteHeight','quoteQty','quoteEyeletsQty','quoteCutMeters'].forEach((id) => on(id, 'input', calculateQuote));
['quoteMaterial','quoteEyeletsEnabled','quoteCutEnabled','quoteDesignEnabled'].forEach((id) => on(id, 'change', calculateQuote));
on('copyQuote', 'click', copyQuoteSummary);
on('addQuoteItem', 'click', addQuoteItem);
on('clearQuote', 'click', clearQuote);
on('saveQuotePrices', 'click', saveQuotePrices);
$('#quoteItems')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-quote]');
  if (btn) removeQuoteItem(btn.dataset.removeQuote);
});
$$('.admin-nav-btn').forEach((btn) => btn.addEventListener('click', () => showAdminSection(btn.dataset.adminTarget)));


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




$('#designMaterialsOptions')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.design-material-chip');
  if (!btn) return;
  const next = !btn.classList.contains('is-selected');
  btn.classList.toggle('is-selected', next);
  btn.setAttribute('aria-pressed', next ? 'true' : 'false');
  syncDesignMaterialsInput();
});

$('#designTimeUnit')?.addEventListener('change', () => {
  populateDesignTimeValues($('#designTimeUnit').value, 1);
});

$('#designTimeValue')?.addEventListener('change', syncDesignTimeInput);

$('#designPreviewFile')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  designEditingPreviewFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    $('#designFormPreviewWrap').hidden = false;
    $('#designFormPreview').src = reader.result;
  };
  reader.readAsDataURL(file);
});

$('#designSourceFile')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  designEditingSourceFile = file || null;
  if (file) {
    $('#designFormPreviewWrap').hidden = false;
    $('#designCurrentFileName').textContent = file.name;
  }
});

on('designCancelBtn', 'click', clearDesignForm);

designForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#designId').value.trim();
  const name = $('#designName').value.trim();
  syncDesignMaterialsInput();
  syncDesignTimeInput();
  const materials = $('#designMaterials').value.trim();
  const time = $('#designTime').value.trim();
  const price = Number($('#designPrice').value || 0);
  const width = Number($('#designWidth').value || 0);
  const height = Number($('#designHeight').value || 0);
  const description = $('#designDescription').value.trim();
  if (!name || !materials || !time || width <= 0 || height <= 0) {
    showToast('Selecciona al menos un material y completa nombre, medidas y tiempo estimado.', 'Faltan datos');
    return;
  }
  if (!id && (!designEditingPreviewFile || !designEditingSourceFile)) {
    showToast('Para crear un diseño debes subir la imagen de vista previa y el archivo SVG o AI.', 'Faltan archivos');
    return;
  }
  const btn = $('#designSaveBtn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    let previewUrl = designEditingPreviewUrl;
    let fileUrl = designEditingSourceUrl;
    let fileName = $('#designCurrentFileName').textContent || '';
    let fileType = '';
    if (designEditingPreviewFile) previewUrl = await uploadImage(designEditingPreviewFile);
    if (designEditingSourceFile) {
      const uploaded = await uploadDesignFile(designEditingSourceFile);
      fileUrl = uploaded.url;
      fileName = uploaded.name;
      fileType = uploaded.type;
    } else if (id) {
      const current = designs.find((x) => x.id === id);
      fileType = current?.fileType || '';
      fileName = current?.fileName || fileName;
    }
    const payload = { nombre:name, descripcion:description, precio:price, materiales, ancho:width, alto:height, tiempo_estimado:time, preview_url:previewUrl, archivo_url:fileUrl, archivo_nombre:fileName, archivo_tipo:fileType };
    await apiFetch(id ? `/api/disenos/${id}` : '/api/disenos', { method:id ? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    clearDesignForm();
    await refreshDesigns({ silent:true });
    showToast(id ? 'El diseño fue actualizado.' : 'El diseño fue guardado.', id ? 'Diseño actualizado' : 'Diseño guardado');
  } catch (err) {
    console.error('Error guardando diseño:', err);
    showToast(err.message || 'No se pudo guardar el diseño.', id ? 'No se pudo actualizar el diseño' : 'No se pudo guardar el diseño');
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});

$('#adminDesignList')?.addEventListener('click', (e) => {
  const editId = e.target.closest('[data-edit-design]')?.dataset.editDesign;
  const deleteId = e.target.closest('[data-delete-design]')?.dataset.deleteDesign;
  if (editId) editDesign(editId);
  if (deleteId) deleteDesign(deleteId);
});

window.addEventListener('error', (event) => {
  console.error(`[DeTodoEc V${APP_VERSION}]`, event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(`[DeTodoEc V${APP_VERSION}] Promesa rechazada`, event.reason);
});

populateDesignTimeValues('horas', 1);
setDesignMaterials('');

const initialSettings = loadSettings();
employees = loadEmployees();
const preferredTheme = initialSettings.theme || ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
setTheme(preferredTheme, false);
applySiteIcon(initialSettings.siteIcon || '');
applyQuoteExtraIcons();
renderEmployeeList();
renderEmployeeFilter();
render();
refreshTasks();
refreshEmployees();
refreshQuoteMaterials();
refreshDesigns();
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
