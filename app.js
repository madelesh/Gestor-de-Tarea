const APP_VERSION = '11.3';
const API_BASE = 'https://gestor-tareas-api.detodoec.workers.dev';
const STORAGE_KEY = 'detodoec_tasks_v1';
const SETTINGS_KEY = 'detodoec_tasks_settings_v3';
const EMPLOYEES_KEY = 'detodoec_employees_v1';
const MIGRATION_KEY = 'detodoec_cloud_migration_v8';
const SESSION_KEY = 'detodoec_session_v11';
const SESSION_USER_KEY = 'detodoec_session_user_v11';
let sessionToken = localStorage.getItem(SESSION_KEY) || '';
let currentUser = null;
let attendanceState = null;
let adminUsers = [];
let appRoles = [];
let selectedRoleId = '';
let homeUsers = [];
let homeRefreshTimer = null;
let profilePhotoFile = null;
let adminUserPhotoFile = null;
let adminUserPhotoUrl = '';

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
let designEditingPreviewUrls = [];
let designEditingSourceUrl = '';
let designEditingPreviewFiles = [];
let designEditingSourceFile = null;
let pendingAdminSection = 'apariencia';

const QUOTE_DEFAULTS = [
  { clave:'lona', nombre:'Lona', precio:7.25, precio_publico:7.25, precio_privado:7.25, activo:1, orden:1 },
  { clave:'lona_microperforada', nombre:'Lona Microperforada', precio:null, precio_publico:null, precio_privado:null, activo:0, orden:2 },
  { clave:'lona_translucida', nombre:'Lona Translucida', precio:12.00, precio_publico:12.00, precio_privado:12.00, activo:1, orden:3 },
  { clave:'vinil_blanco', nombre:'Vinil Blanco', precio:8.50, precio_publico:8.50, precio_privado:8.50, activo:1, orden:4 },
  { clave:'vinil_transparente', nombre:'Vinil Transparente', precio:null, precio_publico:null, precio_privado:null, activo:0, orden:5 },
  { clave:'pvc', nombre:'PVC', precio:25.00, precio_publico:25.00, precio_privado:25.00, activo:1, orden:6 },
  { clave:'lapida', nombre:'Lapidas', precio:65.00, precio_publico:65.00, precio_privado:65.00, activo:1, orden:7 }
];
let quoteMaterials = QUOTE_DEFAULTS.map((x) => ({...x}));
let quoteItems = [];
let quoteClients = [];
let quotePublicClient = { id:'publico', nombre:'Cliente público', foto_url:'', publico:true };
let quoteClientPrices = [];
let selectedQuoteCustomerId = 'publico';
let quoteClientEditingPhotoUrl = '';
let quoteClientEditingPhotoFile = null;
let quoteCloudIcons = { eyelet:'', cut:'', design:'' };
let quotePendingIconFiles = { eyelet:null, cut:null, design:null };
let taskDefaultImage = '';
let pendingDefaultTaskImageFile = null;
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
const adminPage = $('#adminPage');
const loginDialog = $('#loginDialog');
const settingsPage = $('#settingsPage');
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
  if (taskDefaultImage) return taskDefaultImage;
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
  const headers = { ...(options.headers || {}) };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  try {
    setSyncState('loading');
    const res = await fetch(API_BASE + path, { ...options, headers });

    // Una respuesta HTTP significa que Cloudflare está accesible.
    setSyncState('ok');

    const type = res.headers.get('content-type') || '';
    const data = type.includes('application/json') ? await res.json() : await res.text();

    // Solo invalida la sesión cuando el endpoint de sesión confirma que expiró.
    // Un 401 de otro módulo no debe sacar al usuario de la página.
    if (res.status === 401 && path === '/api/auth/me') {
      sessionToken = '';
      currentUser = null;
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_USER_KEY);
      showAuthGate('Tu sesión expiró. Inicia sesión nuevamente.');
    }

    if (!res.ok) {
      throw new Error(data?.error || data?.message || String(data) || `Error ${res.status}`);
    }

    return data;
  } catch (error) {
    if (
      error instanceof TypeError ||
      /fetch|network|failed|load/i.test(String(error?.message || ''))
    ) {
      setSyncState('error');
    }
    throw error;
  }
}

function fromDesignApi(item) {
  const numericCode = Number(item.codigo ?? 0);
  return {
    id: String(item.id),
    code: Number.isFinite(numericCode) ? String(numericCode).padStart(5, '0') : '00000',
    name: item.nombre || '',
    description: item.descripcion || '',
    price: Number(item.precio || 0),
    materials: item.materiales || '',
    width: Number(item.ancho || 0),
    height: Number(item.alto || 0),
    time: item.tiempo_estimado || '',
    previewUrl: item.preview_url || '',
    previewUrls: (() => {
      try {
        const parsed = JSON.parse(item.preview_urls || '[]');
        if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean).slice(0, 5);
      } catch {}
      return item.preview_url ? [item.preview_url] : [];
    })(),
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

async function buildSocialImageWithCode(imageUrl, code) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('No se pudo descargar la imagen');
  const blob = await response.blob();

  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const label = `COD ${String(code || '').padStart(5, '0')}`;
  const scale = Math.max(1, Math.min(canvas.width, canvas.height) / 900);
  const fontSize = Math.max(22, 56 * scale);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, 6 * scale);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.fillStyle = 'rgba(10, 17, 31, 0.18)';
  ctx.strokeText(label, 0, 0);
  ctx.fillText(label, 0, 0);
  ctx.restore();

  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error('No se pudo generar la imagen'));
        return;
      }
      resolve(result);
    }, 'image/png');
  });
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function renderDesigns() {
  const grid = $('#designGrid');
  const empty = $('#designEmpty');
  if (!grid || !empty) return;

  const q = ($('#designSearchInput')?.value || '').trim().toLowerCase();
  const filtered = designs.filter((d) => `${d.code} ${d.name}`.toLowerCase().includes(q));

  grid.innerHTML = '';

  filtered.forEach((d) => {
    const previews = (d.previewUrls?.length ? d.previewUrls : [d.previewUrl]).filter(Boolean).slice(0, 5);
    const safePreviews = previews.length ? previews : [placeholderSvg()];
    const card = document.createElement('article');
    card.className = 'design-card design-card-v1010';
    card.dataset.previewIndex = '0';

    card.innerHTML = `
      <div class="design-preview design-preview-v1010">
        <img
          class="design-main-preview"
          src="${escapeHtml(safePreviews[0])}"
          alt="Vista previa del diseño ${escapeHtml(d.code)}"
        />
        <span class="design-price-badge">${money(d.price)}</span>
        <span class="design-code-badge">#${escapeHtml(d.code)}</span>
        ${safePreviews.length > 1 ? `
          <button type="button" class="design-preview-arrow prev" aria-label="Imagen anterior">‹</button>
          <button type="button" class="design-preview-arrow next" aria-label="Imagen siguiente">›</button>
          <div class="design-preview-dots">${safePreviews.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
        ` : ''}
      </div>

      <div class="design-card-body design-card-body-v1010">
        <div class="design-primary-data">
          <div class="design-info-row">
            <span class="field-icon-badge">${iconUse('icon-ruler')}</span>
            <span>
              <small>Medidas</small>
              <strong>${Number(d.width || 0).toFixed(2)} × ${Number(d.height || 0).toFixed(2)} cm</strong>
            </span>
          </div>

          <div class="design-info-row design-code-row">
            <span class="field-icon-badge">${iconUse('icon-search')}</span>
            <span>
              <small>Código de búsqueda</small>
              <strong>${escapeHtml(d.code)}</strong>
            </span>
            <button type="button" class="design-copy-code" data-copy-design-code="${escapeHtml(d.code)}" title="Copiar código" aria-label="Copiar código">
              ${iconUse('icon-copy')}
            </button>
          </div>
        </div>

        <div class="design-download-actions">
          <button type="button" class="btn btn-outline design-social-download" data-social-image="${escapeHtml(safePreviews[0])}" data-social-name="${escapeHtml(`diseno-${d.code}.png`)}">
            ${iconUse('icon-image')}
            <span>Descargar imagen</span>
          </button>
          <a class="btn btn-dark design-download" href="${escapeHtml(d.fileUrl)}" target="_blank" rel="noopener" download="${escapeHtml(d.fileName || '')}">
            ${iconUse('icon-download')}
            <span>Descargar archivo</span>
          </a>
        </div>
      </div>
    `;

    if (safePreviews.length > 1) {
      const img = card.querySelector('.design-main-preview');
      const dots = [...card.querySelectorAll('.design-preview-dots span')];
      const show = (next) => {
        const index = (next + safePreviews.length) % safePreviews.length;
        card.dataset.previewIndex = String(index);
        img.src = safePreviews[index];
        dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
      };
      card.querySelector('.prev')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        show(Number(card.dataset.previewIndex || 0) - 1);
      });
      card.querySelector('.next')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        show(Number(card.dataset.previewIndex || 0) + 1);
      });
    }

    card.querySelector('[data-copy-design-code]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const code = e.currentTarget.dataset.copyDesignCode || d.code;
      try {
        await navigator.clipboard.writeText(code);
        showToast(code, 'Código copiado');
      } catch {
        showToast('No se pudo copiar el código.', 'Copiar');
      }
    });

    card.querySelector('[data-social-image]')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const btn = e.currentTarget;
      const activeIndex = Number(card.dataset.previewIndex || 0);
      const url = safePreviews[activeIndex] || btn.dataset.socialImage;
      const filename = btn.dataset.socialName || `diseno-${d.code}.png`;
      try {
        const finalBlob = await buildSocialImageWithCode(url, d.code);
        const objectUrl = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        showToast('Imagen lista para publicar con marca de agua del código.', 'Imagen descargada');
      } catch (err) {
        showToast(err.message || 'No se pudo descargar la imagen.', 'Descarga');
      }
    });

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
      <div class="admin-design-main"><strong>#${escapeHtml(d.code)} · ${escapeHtml(d.name)}</strong><span>${money(d.price)} · ${escapeHtml(d.materials)} · ${Number(d.width || 0).toFixed(2)} × ${Number(d.height || 0).toFixed(2)} cm · ${escapeHtml(d.time)}</span></div>
      <div class="admin-design-actions"><button type="button" class="btn btn-outline small" data-edit-design="${d.id}">Editar</button><button type="button" class="btn btn-danger small" data-delete-design="${d.id}">Eliminar</button></div>`;
    box.appendChild(row);
  });
}

function clearDesignForm() {
  if (!designForm) return;
  designForm.reset();
  $('#designId').value = '';
  designEditingPreviewUrls = [];
  designEditingSourceUrl = '';
  designEditingPreviewFiles = [];
  designEditingSourceFile = null;
  $('#designFormPreviewWrap').hidden = true;
  $('#designPreviewGallery').innerHTML = '';
  $('#designCurrentFileName').textContent = '';
  $('#designSaveBtn').textContent = 'Guardar diseño';
  setDesignMaterials('');
  setDesignTime('1 horas');
}

function renderDesignAdminPreviewGallery(urls = []) {
  const gallery = $('#designPreviewGallery');
  if (!gallery) return;
  gallery.innerHTML = '';
  urls.filter(Boolean).slice(0, 5).forEach((url, index) => {
    const item = document.createElement('div');
    item.className = 'design-preview-thumb';
    item.innerHTML = `<img src="${escapeHtml(url)}" alt="Vista previa ${index + 1}"/><span>${index + 1}</span>`;
    gallery.appendChild(item);
  });
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
  designEditingPreviewUrls = (d.previewUrls?.length ? d.previewUrls : [d.previewUrl]).filter(Boolean).slice(0, 5);
  designEditingSourceUrl = d.fileUrl || '';
  designEditingPreviewFiles = [];
  designEditingSourceFile = null;
  $('#designFormPreviewWrap').hidden = false;
  renderDesignAdminPreviewGallery(designEditingPreviewUrls);
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
  const legacy = item?.precio === null || item?.precio === undefined || item?.precio === '' ? null : Number(item.precio);
  const publico = item?.precio_publico === null || item?.precio_publico === undefined || item?.precio_publico === '' ? legacy : Number(item.precio_publico);
  const privado = item?.precio_privado === null || item?.precio_privado === undefined || item?.precio_privado === '' ? publico : Number(item.precio_privado);
  return {
    clave: String(item?.clave || ''),
    nombre: String(item?.nombre || ''),
    precio: publico,
    precio_publico: publico,
    precio_privado: privado,
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

function currentQuoteCustomer() {
  if (selectedQuoteCustomerId === 'publico') {
    return quotePublicClient;
  }
  return quoteClients.find((client) => String(client.id) === String(selectedQuoteCustomerId))
    || quotePublicClient;
}

function quoteCustomerLabel(customer = currentQuoteCustomer()) {
  return customer?.nombre || 'Cliente público';
}

function quotePriceFor(material, customerId = selectedQuoteCustomerId) {
  if (!material) return null;

  if (String(customerId) === 'publico') {
    const raw = material.precio_publico;
    return raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw))
      ? null
      : Number(raw);
  }

  const row = quoteClientPrices.find(
    (price) => String(price.cliente_id) === String(customerId) && price.material_clave === material.clave
  );
  const raw = row?.precio;
  return raw === null || raw === undefined || raw === '' || !Number.isFinite(Number(raw))
    ? null
    : Number(raw);
}

function renderQuoteCustomerPicker() {
  const menu = $('#quoteCustomerMenu');
  const triggerName = $('#quoteCustomerName');
  const trigger = $('#quoteCustomerTrigger');
  if (!menu || !triggerName || !trigger) return;

  const current = currentQuoteCustomer();
  triggerName.textContent = quoteCustomerLabel(current);

  const avatar = trigger.querySelector('.quote-customer-avatar');
  if (avatar) {
    if (current.foto_url) {
      avatar.innerHTML = `<img src="${escapeHtml(current.foto_url)}" alt="" />`;
      avatar.classList.remove('public-avatar');
    } else {
      avatar.innerHTML = iconUse('icon-user');
      avatar.classList.add('public-avatar');
    }
  }

  const rows = [
    quotePublicClient,
    ...quoteClients
  ];

  menu.innerHTML = rows.map((client) => `
    <button type="button" class="quote-customer-option ${String(client.id) === String(selectedQuoteCustomerId) ? 'active' : ''}" data-quote-customer="${escapeHtml(String(client.id))}" role="option">
      <span class="quote-customer-avatar ${client.foto_url ? '' : 'public-avatar'}">
        ${client.foto_url ? `<img src="${escapeHtml(client.foto_url)}" alt="" />` : iconUse('icon-user')}
      </span>
      <span>${escapeHtml(client.nombre)}</span>
      ${String(client.id) === String(selectedQuoteCustomerId) ? '<span class="quote-customer-check">✓</span>' : ''}
    </button>
  `).join('');

  $('#quoteCustomerId').value = String(selectedQuoteCustomerId);
}

function selectQuoteCustomer(id) {
  selectedQuoteCustomerId = String(id || 'publico');
  renderQuoteCustomerPicker();
  renderQuoteMaterialSelect();
  calculateQuote();
  if ($('#quoteCustomerMenu')) $('#quoteCustomerMenu').hidden = true;
  $('#quoteCustomerTrigger')?.setAttribute('aria-expanded', 'false');
}

function renderQuoteMaterialSelect() {
  const select = $('#quoteMaterial');
  if (!select) return;
  const previous = select.value;
  select.innerHTML = '';
  quoteMaterials.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.clave;
    const price = quotePriceFor(item);
    option.textContent = item.activo && price !== null
      ? `${item.nombre} — ${money(price)}/m²`
      : `${item.nombre} — No disponible para este cliente`;
    option.disabled = !(item.activo && price !== null);
    select.appendChild(option);
  });
  const available = quoteMaterials.find((x) => x.activo && quotePriceFor(x) !== null);
  if (previous && [...select.options].some((o) => o.value === previous && !o.disabled)) select.value = previous;
  else if (available) select.value = available.clave;
  renderQuoteMaterialIcon();
}

function currentQuoteMaterial() {
  const key = $('#quoteMaterial')?.value;
  return quoteMaterials.find((x) => x.clave === key)
    || quoteMaterials.find((x) => x.activo && quotePriceFor(x) !== null)
    || null;
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

function quoteExtraIconMarkup(type) {
  const url = quoteCloudIcons[type];
  if (url) return `<img src="${escapeHtml(url)}" alt="" />`;
  const fallback = type === 'eyelet' ? 'icon-eyelet' : type === 'cut' ? 'icon-cut' : 'icon-design';
  return iconUse(fallback);
}

function applyQuoteExtraIcons() {
  const pairs = [
    ['#quoteEyeletsEnabled', 'eyelet'],
    ['#quoteCutEnabled', 'cut'],
    ['#quoteDesignEnabled', 'design']
  ];
  pairs.forEach(([selector, type]) => {
    const input = $(selector);
    const label = input?.closest('.quote-extra-option');
    const slot = label?.querySelector('.quote-extra-icon');
    if (slot) slot.innerHTML = quoteExtraIconMarkup(type);
  });

  [['eyelet','#quoteEyeletIconPreview'],['cut','#quoteCutIconPreview'],['design','#quoteDesignIconPreview']].forEach(([type, selector]) => {
    const slot = $(selector);
    if (slot) slot.innerHTML = quoteExtraIconMarkup(type);
  });
}

async function uploadQuoteCloudIcon(type, file) {
  if (!file) return quoteCloudIcons[type] || '';
  const fd = new FormData();
  fd.append('imagen', file);
  const result = await apiFetch('/api/imagenes', { method:'POST', body:fd });
  return result.url || '';
}

function renderQuoteClientPhotoPreview(url = '') {
  const preview = $('#quoteClientPhotoPreview');
  if (!preview) return;
  if (url) preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Foto del cliente" />`;
  else preview.innerHTML = iconUse('icon-user');
}

function clearQuoteClientForm() {
  $('#quoteClientForm')?.reset();
  if ($('#quoteClientId')) $('#quoteClientId').value = '';
  quoteClientEditingPhotoUrl = '';
  quoteClientEditingPhotoFile = null;
  renderQuoteClientPhotoPreview('');
  if ($('#quoteClientSaveBtn')) $('#quoteClientSaveBtn').textContent = 'Guardar cliente';
}

function renderQuoteClientAdmin() {
  const list = $('#quoteClientAdminList');
  if (!list) return;

  list.innerHTML = `
    <article class="quote-client-admin-card public-client-card">
      <span class="quote-client-admin-avatar ${quotePublicClient.foto_url ? '' : 'public-avatar'}">
        ${quotePublicClient.foto_url ? `<img src="${escapeHtml(quotePublicClient.foto_url)}" alt="" />` : iconUse('icon-user')}
      </span>
      <div><strong>${escapeHtml(quotePublicClient.nombre || 'Cliente público')}</strong><small>Cliente público</small></div>
      <div class="quote-client-admin-actions">
        <button type="button" class="btn btn-outline small" data-edit-quote-client="publico">Editar</button>
      </div>
    </article>
  `;

  quoteClients.forEach((client) => {
    const card = document.createElement('article');
    card.className = 'quote-client-admin-card';
    card.innerHTML = `
      <span class="quote-client-admin-avatar ${client.foto_url ? '' : 'public-avatar'}">
        ${client.foto_url ? `<img src="${escapeHtml(client.foto_url)}" alt="" />` : iconUse('icon-user')}
      </span>
      <div><strong>${escapeHtml(client.nombre)}</strong><small>Cliente personalizado</small></div>
      <div class="quote-client-admin-actions">
        <button type="button" class="btn btn-outline small" data-edit-quote-client="${client.id}">Editar</button>
        <button type="button" class="btn btn-danger small" data-delete-quote-client="${client.id}">Eliminar</button>
      </div>
    `;
    list.appendChild(card);
  });
}

function editQuoteClient(id) {
  const client = String(id) === 'publico'
    ? quotePublicClient
    : quoteClients.find((item) => String(item.id) === String(id));
  if (!client) return;
  $('#quoteClientId').value = String(client.id);
  $('#quoteClientNameInput').value = client.nombre;
  quoteClientEditingPhotoUrl = client.foto_url || '';
  quoteClientEditingPhotoFile = null;
  renderQuoteClientPhotoPreview(quoteClientEditingPhotoUrl);
  $('#quoteClientSaveBtn').textContent = String(client.id) === 'publico'
    ? 'Actualizar cliente público'
    : 'Actualizar cliente';
}

async function deleteQuoteClient(id) {
  const client = quoteClients.find((item) => String(item.id) === String(id));
  if (!client) return;
  if (!confirm(`¿Eliminar al cliente "${client.nombre}"?`)) return;
  try {
    await apiFetch(`/api/cotizador/clientes/${id}`, { method:'DELETE' });
    if (String(selectedQuoteCustomerId) === String(id)) selectedQuoteCustomerId = 'publico';
    await refreshQuoteConfig({ silent:true });
    showToast(`${client.nombre} fue eliminado.`, 'Cliente eliminado');
  } catch (err) {
    showToast(err.message, 'No se pudo eliminar el cliente');
  }
}

async function refreshQuoteConfig({ silent = true } = {}) {
  try {
    const [materials, clients, prices, settings] = await Promise.all([
      apiFetch('/api/cotizador/materiales'),
      apiFetch('/api/cotizador/clientes'),
      apiFetch('/api/cotizador/precios-clientes'),
      apiFetch('/api/cotizador/ajustes')
    ]);

    if (Array.isArray(materials) && materials.length) {
      quoteMaterials = materials.map(normalizeQuoteMaterial).sort((a,b) => a.orden-b.orden);
    }
    quoteClients = Array.isArray(clients) ? clients : [];
    quoteClientPrices = Array.isArray(prices) ? prices : [];
    quoteCloudIcons = {
      eyelet: settings?.icon_ojelet || '',
      cut: settings?.icon_corte || '',
      design: settings?.icon_diseno || ''
    };
    quotePublicClient = {
      id:'publico',
      nombre: settings?.publico_nombre || 'Cliente público',
      foto_url: settings?.publico_foto || '',
      publico:true
    };
    taskDefaultImage = settings?.task_placeholder || '';
    renderDefaultTaskImagePreview();
  } catch (err) {
    console.error('No se pudo cargar la configuración del cotizador', err);
    if (!silent) showToast('No se pudo sincronizar la configuración del cotizador.', 'Cotizador');
  }

  if (selectedQuoteCustomerId !== 'publico' && !quoteClients.some((c) => String(c.id) === String(selectedQuoteCustomerId))) {
    selectedQuoteCustomerId = 'publico';
  }

  renderQuoteCustomerPicker();
  renderQuoteClientAdmin();
  renderQuoteMaterialSelect();
  renderQuotePriceAdmin();
  applyQuoteExtraIcons();
  calculateQuote();
}

function renderDefaultTaskImagePreview(previewUrl = '') {
  const img = $('#defaultTaskImagePreview');
  if (!img) return;
  img.src = previewUrl || taskDefaultImage || placeholderSvg();
}

async function saveTaskDefaultImage() {
  const btn = $('#saveDefaultTaskImage');
  if (!btn) return;
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try {
    let imageUrl = taskDefaultImage || '';
    if (pendingDefaultTaskImageFile) {
      const fd = new FormData();
      fd.append('imagen', pendingDefaultTaskImageFile);
      const upload = await apiFetch('/api/imagenes', { method:'POST', body:fd });
      imageUrl = upload.url || '';
    }
    await apiFetch('/api/cotizador/ajustes', {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ task_placeholder:imageUrl })
    });
    taskDefaultImage = imageUrl;
    pendingDefaultTaskImageFile = null;
    $('#defaultTaskImageInput').value = '';
    renderDefaultTaskImagePreview();
    render();
    showToast('La imagen predeterminada se guardó en la nube.', 'Imagen actualizada');
  } catch (err) {
    showToast(err.message, 'No se pudo guardar la imagen');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

async function resetTaskDefaultImage() {
  try {
    await apiFetch('/api/cotizador/ajustes', {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ task_placeholder:'' })
    });
    taskDefaultImage = '';
    pendingDefaultTaskImageFile = null;
    $('#defaultTaskImageInput').value = '';
    renderDefaultTaskImagePreview();
    render();
    showToast('Se restauró la imagen predeterminada original.', 'Imagen restablecida');
  } catch (err) {
    showToast(err.message, 'No se pudo restablecer la imagen');
  }
}

function getQuoteDraft() {
  const material = currentQuoteMaterial();
  const width = Math.max(0, Number($('#quoteWidth')?.value || 0));
  const height = Math.max(0, Number($('#quoteHeight')?.value || 0));
  const qty = Math.max(1, Math.floor(Number($('#quoteQty')?.value || 1)));
  const area = width * height * qty;
  const customer = currentQuoteCustomer();
  const customerId = String(customer.id);
  const price = material && material.activo ? quotePriceFor(material, customerId) : null;
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
  return { material, customer, customerId, width, height, qty, area, price, materialTotal, eyeletsEnabled, eyeletsQty, cutEnabled, cutMeters, designEnabled, extras, extrasTotal, total };
}

function calculateQuote() {
  renderQuoteMaterialIcon();
  const eyeletsEnabled = Boolean($('#quoteEyeletsEnabled')?.checked);
  const cutEnabled = Boolean($('#quoteCutEnabled')?.checked);
  if ($('#quoteEyeletsQty')) $('#quoteEyeletsQty').disabled = !eyeletsEnabled;
  if ($('#quoteCutMeters')) $('#quoteCutMeters').disabled = !cutEnabled;
  const draft = getQuoteDraft();
  if ($('#quoteArea')) $('#quoteArea').textContent = `${draft.area.toFixed(2)} m²`;
  if ($('#quoteCustomerTypeLabel')) $('#quoteCustomerTypeLabel').textContent = quoteCustomerLabel(draft.customer);
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
    customerId: draft.customerId,
    customerName: quoteCustomerLabel(draft.customer),
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
        <span class="quote-item-client-type">${escapeHtml(item.customerName || 'Cliente público')}</span>
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
    const card = document.createElement('div');
    card.className = 'quote-price-material-card';
    card.dataset.key = item.clave;

    const clientInputs = quoteClients.map((client) => {
      const row = quoteClientPrices.find(
        (price) => String(price.cliente_id) === String(client.id) && price.material_clave === item.clave
      );
      return `
        <label class="quote-price-client-field">
          <span class="quote-price-client-label">
            <span class="quote-price-client-avatar ${client.foto_url ? '' : 'public-avatar'}">
              ${client.foto_url ? `<img src="${escapeHtml(client.foto_url)}" alt="" />` : iconUse('icon-user')}
            </span>
            <small>${escapeHtml(client.nombre)}</small>
          </span>
          <span class="quote-price-input-wrap">$ <input type="number" min="0" step="0.01" data-quote-client-price="${client.id}:${escapeHtml(item.clave)}" value="${row?.precio ?? ''}" placeholder="Sin precio" /></span>
        </label>
      `;
    }).join('');

    card.innerHTML = `
      <div class="quote-price-material-head">
        <span class="quote-material-mini-icon">${iconUse(materialIconId(item.clave))}</span>
        <div><strong>${escapeHtml(item.nombre)}</strong><small>Precio por m²</small></div>
        <label class="quote-toggle"><input type="checkbox" data-quote-active="${escapeHtml(item.clave)}" ${item.activo ? 'checked' : ''} /> Disponible</label>
      </div>
      <div class="quote-price-client-grid">
        <label class="quote-price-client-field public-price-field">
          <span class="quote-price-client-label">
            <span class="quote-price-client-avatar public-avatar">${iconUse('icon-user')}</span>
            <small>Cliente público</small>
          </span>
          <span class="quote-price-input-wrap">$ <input type="number" min="0" step="0.01" data-quote-price-public="${escapeHtml(item.clave)}" value="${item.precio_publico ?? ''}" placeholder="Sin precio" /></span>
        </label>
        ${clientInputs}
      </div>
    `;
    box.appendChild(card);
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
      const publicInput = document.querySelector(`[data-quote-price-public="${item.clave}"]`);
      const toggle = document.querySelector(`[data-quote-active="${item.clave}"]`);
      const publicRaw = publicInput?.value?.trim() ?? '';
      const precio_publico = publicRaw === '' ? null : Number(publicRaw);

      await apiFetch(`/api/cotizador/materiales/${encodeURIComponent(item.clave)}`, {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          precio_publico,
          precio_privado: precio_publico,
          activo:Boolean(toggle?.checked)
        })
      });

      for (const client of quoteClients) {
        const input = document.querySelector(`[data-quote-client-price="${client.id}:${item.clave}"]`);
        const raw = input?.value?.trim() ?? '';
        const precio = raw === '' ? null : Number(raw);
        await apiFetch(`/api/cotizador/precios-clientes/${client.id}/${encodeURIComponent(item.clave)}`, {
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ precio })
        });
      }
    }

    const iconUrls = { ...quoteCloudIcons };
    for (const type of ['eyelet','cut','design']) {
      if (quotePendingIconFiles[type]) {
        iconUrls[type] = await uploadQuoteCloudIcon(type, quotePendingIconFiles[type]);
      }
    }

    await apiFetch('/api/cotizador/ajustes', {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        icon_ojelet: iconUrls.eyelet || '',
        icon_corte: iconUrls.cut || '',
        icon_diseno: iconUrls.design || ''
      })
    });

    quotePendingIconFiles = { eyelet:null, cut:null, design:null };
    await refreshQuoteConfig({ silent:true });
    showToast('Precios e iconos guardados en la nube.', 'Cotizador actualizado');
  } catch (err) {
    showToast(err.message, 'No se pudieron guardar los cambios');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

function hideStandalonePages() {
  if (settingsPage) settingsPage.hidden = true;
  if (adminPage) adminPage.hidden = true;
  document.body.classList.remove('standalone-open');
}

function showSettingsPage() {
  hideStandalonePages();
  ['home','resumen','tareas','archivados','cotizador','disenos','checkin'].forEach((id) => {
    const el = $('#' + id);
    if (el) el.hidden = true;
  });
  if (settingsPage) settingsPage.hidden = false;
  document.body.classList.add('standalone-open');
  window.scrollTo({ top:0, behavior:'instant' });
}

function showMainView(view) {
  hideStandalonePages();
  const permissionMap = {
    home:'home',
    tasks:'tasks',
    quote:'quote',
    designs:'designs'
  };

  if (permissionMap[view] && !userCan(permissionMap[view])) {
    showToast('Tu rol no tiene permiso para ver esta sección.', 'Sin permiso');
    return;
  }

  if (view === 'checkin' && !(currentUser?.rol === 'admin' && userCan('checkin'))) {
    showToast('Solo un administrador con permiso puede abrir Check-in.', 'Acceso restringido');
    return;
  }

  const isHome = view === 'home';
  const isTasks = view === 'tasks';
  const isQuote = view === 'quote';
  const isDesigns = view === 'designs';
  const isCheckIn = view === 'checkin';

  $('#home').hidden = !isHome;
  $('#resumen').hidden = !isTasks;
  $('#tareas').hidden = !isTasks;
  $('#archivados').hidden = true;
  $('#cotizador').hidden = !isQuote;
  $('#disenos').hidden = !isDesigns;
  $('#checkin').hidden = !isCheckIn;

  $('#navHome')?.classList.toggle('active', isHome);
  $('#navTasks')?.classList.toggle('active', isTasks);
  $('#navQuote')?.classList.toggle('active', isQuote);
  $('#navDesigns')?.classList.toggle('active', isDesigns);
  $('#navCheckIn')?.classList.toggle('active', isCheckIn);

  if (homeRefreshTimer) {
    clearInterval(homeRefreshTimer);
    homeRefreshTimer = null;
  }

  if (isHome) {
    Promise.allSettled([refreshAttendance(), refreshHomeUsers()]);
    homeRefreshTimer = setInterval(() => {
      if (currentUser && !$('#home')?.hidden) {
        refreshHomeUsers();
        refreshAttendance();
      }
    }, 30000);
  }

  if (isQuote) {
    renderQuoteCustomerPicker();
    renderQuoteMaterialSelect();
    applyQuoteExtraIcons();
    calculateQuote();
  }
  if (isDesigns) refreshDesigns({ silent:true });
  if (isCheckIn) refreshAttendance();
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


function showAuthGate(message = '') {
  const gate = $('#authGate');
  if (gate) gate.hidden = false;
  document.body.classList.add('auth-locked');
  if ($('#appLoginError')) {
    $('#appLoginError').hidden = !message;
    $('#appLoginError').textContent = message || '';
  }
  setTimeout(() => $('#appLoginUser')?.focus(), 50);
}

function hideAuthGate() {
  const gate = $('#authGate');
  if (gate) gate.hidden = true;
  document.body.classList.remove('auth-locked');
}

function userAvatarMarkup(user = currentUser) {
  if (user?.foto_url) return `<img src="${escapeHtml(user.foto_url)}" alt="" />`;
  return iconUse('icon-user');
}

function userCan(view) {
  if (!currentUser) return false;
  if (currentUser.rol === 'admin') return true;
  const permissions = currentUser.permissions || {};
  return Boolean(permissions[view]);
}

function roleLabel(user = currentUser) {
  return user?.role_name || (user?.rol === 'admin' ? 'Administrador' : 'Usuario');
}

function updateNavigationPermissions() {
  const mapping = [
    ['navHome', 'home'],
    ['navTasks', 'tasks'],
    ['navQuote', 'quote'],
    ['navDesigns', 'designs']
  ];

  mapping.forEach(([id, permission]) => {
    const el = $('#' + id);
    if (el) el.hidden = !userCan(permission);
  });

  const checkin = $('#navCheckIn');
  if (checkin) checkin.hidden = !(currentUser?.rol === 'admin' && userCan('checkin'));

  const adminMenu = $('#profileAdminMenu');
  if (adminMenu) adminMenu.hidden = currentUser?.rol !== 'admin';
}

function updateCurrentUserUI() {
  if (!currentUser) return;

  const name = currentUser.nombre || currentUser.usuario || 'Usuario';
  const topName = $('#topUserName');
  const topAvatar = $('#topUserAvatar');
  const greeting = $('#homeGreetingName');

  if (topName) topName.textContent = name;
  if (topAvatar) topAvatar.innerHTML = userAvatarMarkup(currentUser);
  if (greeting) greeting.textContent = name;

  const themeState = $('#profileThemeState');
  if (themeState) themeState.textContent = document.documentElement.dataset.theme === 'dark' ? 'Claro' : 'Oscuro';

  updateNavigationPermissions();
}

async function loginApp(username, password) {
  const result = await apiFetch('/api/auth/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ usuario:username, password })
  });

  if (!result?.token || !result?.usuario) {
    throw new Error('El servidor aceptó la solicitud pero no devolvió una sesión válida.');
  }

  sessionToken = result.token;
  currentUser = result.usuario;
  localStorage.setItem(SESSION_KEY, sessionToken);
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));

  // La sesión ya es válida: abre la aplicación inmediatamente.
  updateCurrentUserUI();
  hideAuthGate();

  try {
    if (userCan('home')) showMainView('home');
    else if (userCan('tasks')) showMainView('tasks');
    else if (userCan('quote')) showMainView('quote');
    else if (userCan('designs')) showMainView('designs');

    await bootstrapPrivateData();
  } catch (err) {
    // Un fallo de un módulo secundario no debe devolver al usuario al login.
    console.error(`[DeTodoEc V${APP_VERSION}] Error cargando la aplicación después del login`, err);
    showToast(
      'La sesión se inició correctamente, pero una sección no pudo cargarse. Actualiza la página si algo no aparece.',
      'Sesión iniciada'
    );
  }
}

let loginFormBound = false;

function bindLoginFormEarly() {
  if (loginFormBound) return;
  const form = $('#appLoginForm');
  if (!form) return;

  loginFormBound = true;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userInput = $('#appLoginUser');
    const passwordInput = $('#appLoginPassword');
    const user = userInput?.value.trim() || '';
    const password = passwordInput?.value || '';
    const submit = form.querySelector('[type="submit"]');
    const label = submit?.querySelector('span');

    if (!user || !password) {
      showAuthGate('Escribe tu usuario y contraseña.');
      return;
    }

    if (submit) submit.disabled = true;
    if (label) label.textContent = 'Entrando…';

    const errorBox = $('#appLoginError');
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    try {
      await loginApp(user, password);
      if (passwordInput) passwordInput.value = '';
    } catch (err) {
      console.error(`[DeTodoEc V${APP_VERSION}] Login`, err);
      showAuthGate(err?.message || 'No se pudo iniciar sesión.');
    } finally {
      if (submit) submit.disabled = false;
      if (label) label.textContent = 'Entrar';
    }
  });
}

// Se conecta el formulario aquí, antes de inicializar el resto de módulos.
bindLoginFormEarly();

async function refreshCloudData({ notify = true } = {}) {
  const button = $('#refreshCloud');
  if (button) button.disabled = true;
  setSyncState('loading');

  try {
    const health = await fetch(API_BASE + '/', { cache:'no-store' });
    if (!health.ok) throw new Error('Cloudflare no respondió correctamente');

    const jobs = [];
    if (currentUser) {
      jobs.push(refreshTasks());
      jobs.push(refreshEmployees());
      jobs.push(refreshAttendance());
      jobs.push(refreshHomeUsers());
      jobs.push(refreshQuoteConfig({ silent:true }));
      jobs.push(refreshDesigns({ silent:true }));
      if (currentUser.rol === 'admin') {
        jobs.push(refreshAdminUsers());
        jobs.push(refreshRoles());
      }
    }

    const results = await Promise.allSettled(jobs);
    const failures = results.filter((r) => r.status === 'rejected');

    setSyncState('ok');

    if (notify) {
      showToast(
        failures.length
          ? `Nube conectada. ${failures.length} módulo(s) no pudieron actualizarse.`
          : 'Todos los datos fueron actualizados desde Cloudflare.',
        failures.length ? 'Actualización parcial' : 'Nube actualizada'
      );
    }
  } catch (err) {
    setSyncState('error');
    if (notify) showToast(err.message || 'No se pudo conectar con Cloudflare.', 'Sin conexión');
  } finally {
    if (button) button.disabled = false;
  }
}

let coreNavigationBound = false;

function bindCoreNavigationEarly() {
  if (coreNavigationBound) return;
  coreNavigationBound = true;

  const safeBind = (id, handler) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (event) => {
      event.preventDefault();
      try {
        handler(event);
      } catch (err) {
        console.error(`[DeTodoEc V${APP_VERSION}] Error en ${id}`, err);
        showToast('No se pudo abrir esta sección.', 'Interfaz');
      }
    });
  };

  safeBind('navHome', () => showMainView('home'));
  safeBind('navTasks', () => showMainView('tasks'));
  safeBind('navQuote', () => showMainView('quote'));
  safeBind('navDesigns', () => showMainView('designs'));
  safeBind('navCheckIn', () => showMainView('checkin'));

  safeBind('profileBtn', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = !menu.hidden;
  });

  safeBind('profileEditMenu', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    openProfile();
  });

  safeBind('profileThemeMenu', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    toggleTheme();
    const themeState = $('#profileThemeState');
    if (themeState) themeState.textContent = document.documentElement.dataset.theme === 'dark' ? 'Claro' : 'Oscuro';
  });

  safeBind('profileSettingsMenu', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    showSettingsPage();
  });

  safeBind('profileAdminMenu', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    requestAdminPanel('apariencia');
  });

  safeBind('homeAttendanceBtn', () => toggleAttendance());
  safeBind('refreshCloud', () => refreshCloudData());
}

bindCoreNavigationEarly();

document.addEventListener('pointerdown', (e) => {
  const menu = $('#profileDropdown');
  const button = $('#profileBtn');
  if (!menu || menu.hidden) return;
  if (!menu.contains(e.target) && !button?.contains(e.target)) {
    menu.hidden = true;
  }
}, true);



async function restoreSession() {
  if (!sessionToken) return false;

  // Restaura la interfaz inmediatamente para no pedir login en cada recarga.
  try {
    const cached = JSON.parse(localStorage.getItem(SESSION_USER_KEY) || 'null');
    if (cached) {
      currentUser = cached;
      updateCurrentUserUI();
      hideAuthGate();
      if (userCan('home')) showMainView('home');
      else if (userCan('tasks')) showMainView('tasks');
    }
  } catch {}

  try {
    const result = await apiFetch('/api/auth/me');
    if (!result?.usuario) throw new Error('Sesión inválida');

    currentUser = result.usuario;
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));
    updateCurrentUserUI();
    hideAuthGate();

    try {
      await bootstrapPrivateData();
    } catch (err) {
      console.error(`[DeTodoEc V${APP_VERSION}] Error restaurando módulos`, err);
    }

    return true;
  } catch (err) {
    console.error(`[DeTodoEc V${APP_VERSION}] No se pudo validar la sesión`, err);

    // Si fue un error de red, conserva la sesión local y deja usar la interfaz.
    if (sessionToken && currentUser && /fetch|network|failed|load/i.test(String(err?.message || ''))) {
      setSyncState('error');
      return true;
    }

    sessionToken = '';
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    return false;
  }
}
async function logoutApp() {
  try { await apiFetch('/api/auth/logout', { method:'POST' }); } catch {}
  sessionToken = '';
  currentUser = null;
  attendanceState = null;
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_USER_KEY);
  $('#profileDialog')?.close();
  showAuthGate();
}

function openProfile() {
  if (!currentUser) return;
  $('#profileName').value = currentUser.nombre || '';
  $('#profileUsername').value = currentUser.usuario || '';
  $('#profileNewPassword').value = '';
  $('#profileHeroName').textContent = currentUser.nombre || currentUser.usuario || 'Usuario';
  $('#profileHeroRole').textContent = roleLabel(currentUser);
  $('#profileAvatarPreview').innerHTML = userAvatarMarkup(currentUser);
  profilePhotoFile = null;
  $('#profilePhoto').value = '';
  $('#profileDialog').showModal();
}

function renderHomeUsers() {
  const grid = $('#homeWorkersGrid');
  const empty = $('#homeWorkersEmpty');
  if (!grid || !empty) return;
  grid.innerHTML = '';

  homeUsers.forEach((user) => {
    const card = document.createElement('article');
    card.className = `home-worker-card ${user.online ? 'online' : 'offline'}`;
    card.innerHTML = `
      <div class="home-worker-avatar">
        ${user.foto_url ? `<img src="${escapeHtml(user.foto_url)}" alt="" />` : iconUse('icon-user')}
        <span class="presence-dot" aria-hidden="true"></span>
      </div>
      <div class="home-worker-copy">
        <strong>${escapeHtml(user.nombre || user.usuario)}</strong>
        <span>${escapeHtml(user.role_name || (user.rol === 'admin' ? 'Administrador' : 'Usuario'))}</span>
      </div>
      <span class="home-worker-status">${user.online ? 'Online' : 'Offline'}</span>
    `;
    grid.appendChild(card);
  });

  empty.hidden = homeUsers.length > 0;
}

async function refreshHomeUsers() {
  if (!currentUser || !userCan('home')) return;
  try {
    const rows = await apiFetch(`/api/home/usuarios?_=${Date.now()}`, { cache:'no-store' });
    homeUsers = Array.isArray(rows)
      ? rows.map((user) => ({ ...user, online:Boolean(Number(user.online)) }))
      : [];
    renderHomeUsers();
    const now = new Date();
    const label = new Intl.DateTimeFormat('es-EC', {
      weekday:'long', day:'2-digit', month:'long', year:'numeric'
    }).format(now);
    if ($('#homeCurrentDate')) $('#homeCurrentDate').textContent = label;
  } catch (err) {
    console.error(err);
    showToast(err.message, 'No se pudo actualizar Home');
  }
}

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('es-EC', { hour:'2-digit', minute:'2-digit', hour12:false }).format(date);
}

function formatAttendanceDate(value = todayLocal()) {
  const [y,m,d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }).format(new Date(y,m-1,d));
}

function formatWorkedTime(minutes = 0) {
  const total = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(total / 60);
  const mins = Math.round(total % 60);
  if (!hours) return `${mins} min`;
  return `${hours} h ${mins} min`;
}

function attendancePay(minutes = 0, hourlyRate = 0) {
  return (Number(minutes || 0) / 60) * Number(hourlyRate || 0);
}

function renderAttendanceState() {
  const state = attendanceState || {};
  const open = Boolean(state.abierto);
  const completed = Boolean(state.cerrado_dia);
  const worked = Number(state.minutos || 0);
  const quickBtn = $('#homeAttendanceBtn');

  $('#homeAttendanceText').textContent = open ? 'Marcar salida' : completed ? 'Jornada completada' : 'Marcar entrada';
  quickBtn?.classList.toggle('is-clocked-in', open);
  if (quickBtn) {
    quickBtn.disabled = completed;
    quickBtn.title = completed
      ? 'La jornada de hoy ya fue cerrada. Podrás registrar otra entrada desde las 00:00.'
      : open ? 'Registrar salida' : 'Registrar entrada';
  }

  if ($('#profileAttendanceEntry')) $('#profileAttendanceEntry').textContent = formatTime(state.entrada);
  if ($('#profileAttendanceExit')) $('#profileAttendanceExit').textContent = formatTime(state.salida);
  if ($('#profileAttendanceTime')) $('#profileAttendanceTime').textContent = formatWorkedTime(worked);
  if ($('#profileAttendanceStatus')) {
    $('#profileAttendanceStatus').textContent = open
      ? 'Jornada en curso'
      : completed
        ? 'Jornada finalizada'
        : 'Sin entrada registrada';
  }
  if ($('#profileAttendanceBadge')) {
    $('#profileAttendanceBadge').textContent = open ? 'Trabajando' : completed ? 'Finalizada' : 'Pendiente';
    $('#profileAttendanceBadge').className = `profile-attendance-state ${open ? 'open' : completed ? 'closed' : 'pending'}`;
  }
}
function renderAttendanceRows(rows = []) {
  const tbody = $('#attendanceTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let totalMinutes = 0;
  let totalPay = 0;
  let openCount = 0;

  rows.forEach((row) => {
    const minutes = Number(row.minutos || 0);
    const rate = Number(row.valor_hora || 0);
    const pay = attendancePay(minutes, rate);
    totalMinutes += minutes;
    totalPay += pay;
    if (!row.salida) openCount += 1;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="attendance-table-user"><span class="attendance-table-avatar">${row.foto_url ? `<img src="${escapeHtml(row.foto_url)}" alt="" />` : iconUse('icon-user')}</span><span><strong>${escapeHtml(row.nombre || row.usuario)}</strong><small>@${escapeHtml(row.usuario)}</small></span></div></td>
      <td>${formatTime(row.entrada)}</td>
      <td>${formatTime(row.salida)}</td>
      <td><strong>${formatWorkedTime(minutes)}</strong></td>
      <td>${money(rate)}</td>
      <td><strong>${money(pay)}</strong></td>
      <td><span class="attendance-status ${row.salida ? 'closed' : 'open'}">${row.salida ? 'Finalizada' : 'Trabajando'}</span></td>`;
    tbody.appendChild(tr);
  });

  $('#attendanceEmpty').hidden = rows.length > 0;
  if ($('#checkinUsersCount')) $('#checkinUsersCount').textContent = String(new Set(rows.map((r) => r.usuario_id)).size);
  if ($('#checkinOpenCount')) $('#checkinOpenCount').textContent = String(openCount);
  if ($('#checkinHoursTotal')) $('#checkinHoursTotal').textContent = formatWorkedTime(totalMinutes);
  if ($('#checkinPayTotal')) $('#checkinPayTotal').textContent = money(totalPay);
}

async function refreshAttendance() {
  if (!currentUser) return;
  const fecha = todayLocal();
  if ($('#attendanceDateLabel')) $('#attendanceDateLabel').textContent = formatAttendanceDate(fecha);

  try {
    const state = await apiFetch('/api/asistencia/estado');
    attendanceState = state;
    renderAttendanceState();

    if (currentUser.rol === 'admin') {
      const rows = await apiFetch(`/api/asistencia?fecha=${encodeURIComponent(fecha)}`);
      renderAttendanceRows(Array.isArray(rows) ? rows : []);
    }
  } catch (err) {
    showToast(err.message, 'No se pudo cargar la asistencia');
  }
}

async function toggleAttendance() {
  if (!currentUser) return;
  const isOpen = Boolean(attendanceState?.abierto);
  const completed = Boolean(attendanceState?.cerrado_dia);

  if (completed && !isOpen) {
    showToast('Ya completaste tu jornada de hoy. Podrás marcar una nueva entrada desde las 00:00.', 'Jornada cerrada');
    return;
  }

  if (isOpen) {
    const sure = window.confirm('¿Estás seguro de que quieres marcar tu salida? Una vez cerrada la jornada no podrás volver a marcar entrada hasta las 00:00 del siguiente día.');
    if (!sure) return;
  }

  const btns = [$('#homeAttendanceBtn')].filter(Boolean);
  btns.forEach((btn) => btn.disabled = true);

  try {
    const endpoint = isOpen ? '/api/asistencia/salida' : '/api/asistencia/entrada';
    const result = await apiFetch(endpoint, { method:'POST' });
    showToast(
      result.mensaje || (isOpen ? 'Salida registrada.' : 'Entrada registrada.'),
      isOpen ? 'Salida registrada' : 'Entrada registrada'
    );
    await refreshAttendance();
    await refreshHomeUsers();
  } catch (err) {
    showToast(err.message, 'Asistencia');
  } finally {
    btns.forEach((btn) => {
      if (!attendanceState?.cerrado_dia) btn.disabled = false;
    });
  }
}
async function refreshAdminUsers() {
  if (!currentUser || currentUser.rol !== 'admin') return;
  try {
    adminUsers = await apiFetch('/api/usuarios');
    renderAdminUsers();
  } catch (err) {
    console.error(err);
  }
}

function renderAdminUserPhoto(url = '') {
  const box = $('#adminUserPhotoPreview');
  if (!box) return;
  box.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="" />` : iconUse('icon-user');
}

function clearAdminUserForm() {
  $('#adminUserForm')?.reset();
  if ($('#adminUserId')) $('#adminUserId').value = '';
  adminUserPhotoFile = null;
  adminUserPhotoUrl = '';
  renderAdminUserPhoto('');
  if ($('#adminUserHourlyRate')) $('#adminUserHourlyRate').value = '0';
  if ($('#adminUserSaveBtn')) $('#adminUserSaveBtn').textContent = 'Guardar usuario';
}

function renderAdminUsers() {
  const list = $('#adminUsersList');
  if (!list) return;
  list.innerHTML = '';
  adminUsers.forEach((user) => {
    const card = document.createElement('article');
    card.className = 'admin-user-card';
    card.innerHTML = `
      <span class="admin-user-avatar">${user.foto_url ? `<img src="${escapeHtml(user.foto_url)}" alt="" />` : iconUse('icon-user')}</span>
      <div class="admin-user-info"><strong>${escapeHtml(user.nombre)}</strong><span>@${escapeHtml(user.usuario)} · ${escapeHtml(user.role_name || (user.rol === 'admin' ? 'Administrador' : 'Usuario'))} · ${money(Number(user.valor_hora || 0))}/h</span></div>
      <div class="admin-user-actions"><button type="button" class="btn btn-outline small" data-edit-app-user="${user.id}">Editar</button>${String(user.id) !== String(currentUser?.id) ? `<button type="button" class="btn btn-danger small" data-delete-app-user="${user.id}">Eliminar</button>` : ''}</div>`;
    list.appendChild(card);
  });
}

function editAdminUser(id) {
  const user = adminUsers.find((item) => String(item.id) === String(id));
  if (!user) return;
  $('#adminUserId').value = user.id;
  $('#adminUserName').value = user.nombre;
  $('#adminUsername').value = user.usuario;
  $('#adminUserPassword').value = '';
  $('#adminUserRole').value = String(user.role_id || '');
  $('#adminUserHourlyRate').value = Number(user.valor_hora || 0);
  adminUserPhotoUrl = user.foto_url || '';
  adminUserPhotoFile = null;
  renderAdminUserPhoto(adminUserPhotoUrl);
  $('#adminUserSaveBtn').textContent = 'Actualizar usuario';
}

async function deleteAdminUser(id) {
  const user = adminUsers.find((item) => String(item.id) === String(id));
  if (!user || !confirm(`¿Eliminar el usuario "${user.nombre}"?`)) return;
  try {
    await apiFetch(`/api/usuarios/${id}`, { method:'DELETE' });
    showToast(`${user.nombre} fue eliminado.`, 'Usuario eliminado');
    await refreshAdminUsers();
  } catch (err) {
    showToast(err.message, 'No se pudo eliminar el usuario');
  }
}

function normalizeRolePermissions(value = {}) {
  return {
    home:value.home !== false,
    tasks:value.tasks !== false,
    quote:value.quote !== false,
    designs:value.designs !== false,
    checkin:Boolean(value.checkin)
  };
}

function renderAdminRoleOptions() {
  const select = $('#adminUserRole');
  if (!select) return;
  const current = select.value;
  select.innerHTML = appRoles.map((role) =>
    `<option value="${role.id}">${escapeHtml(role.nombre)}</option>`
  ).join('');
  if (current && [...select.options].some((opt) => opt.value === current)) {
    select.value = current;
  }
}

function clearRoleEditor() {
  selectedRoleId = '';
  $('#roleId').value = '';
  $('#roleName').value = '';
  $('#roleIsAdmin').checked = false;
  $$('[data-role-permission]').forEach((input) => {
    input.checked = input.dataset.rolePermission !== 'checkin';
  });
  $('#deleteRoleBtn').disabled = true;
}

function renderRolesList() {
  const list = $('#rolesList');
  if (!list) return;
  list.innerHTML = '';

  appRoles.forEach((role) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `roles-list-item ${String(role.id) === String(selectedRoleId) ? 'active' : ''}`;
    btn.dataset.roleId = role.id;
    btn.innerHTML = `
      <span class="role-list-dot ${role.es_admin ? 'admin' : ''}"></span>
      <span><strong>${escapeHtml(role.nombre)}</strong><small>${role.es_admin ? 'Administrador' : 'Rol personalizado'}</small></span>
    `;
    list.appendChild(btn);
  });
}

function editRole(id) {
  const role = appRoles.find((item) => String(item.id) === String(id));
  if (!role) return;
  selectedRoleId = String(role.id);
  $('#roleId').value = role.id;
  $('#roleName').value = role.nombre;
  $('#roleIsAdmin').checked = Boolean(role.es_admin);
  const permissions = normalizeRolePermissions(role.permisos || {});
  $$('[data-role-permission]').forEach((input) => {
    input.checked = Boolean(permissions[input.dataset.rolePermission]);
  });
  $('#deleteRoleBtn').disabled = false;
  renderRolesList();
}

async function refreshRoles() {
  if (!currentUser || currentUser.rol !== 'admin') return;
  try {
    appRoles = await apiFetch('/api/roles');
    renderRolesList();
    renderAdminRoleOptions();
    if (selectedRoleId && appRoles.some((r) => String(r.id) === String(selectedRoleId))) {
      editRole(selectedRoleId);
    }
  } catch (err) {
    console.error(err);
  }
}

async function saveRole() {
  const id = $('#roleId').value.trim();
  const nombre = $('#roleName').value.trim();
  if (!nombre) {
    showToast('Escribe un nombre para el rol.', 'Roles');
    return;
  }

  const permisos = {};
  $$('[data-role-permission]').forEach((input) => {
    permisos[input.dataset.rolePermission] = input.checked;
  });

  const payload = {
    nombre,
    es_admin:$('#roleIsAdmin').checked,
    permisos
  };

  try {
    const result = await apiFetch(id ? `/api/roles/${id}` : '/api/roles', {
      method:id ? 'PUT' : 'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    showToast(result.mensaje || 'Rol guardado.', id ? 'Rol actualizado' : 'Rol creado');
    clearRoleEditor();
    await refreshRoles();
    await refreshAdminUsers();
  } catch (err) {
    showToast(err.message, 'No se pudo guardar el rol');
  }
}

async function deleteRole() {
  const id = $('#roleId').value.trim();
  if (!id) return;
  const role = appRoles.find((item) => String(item.id) === String(id));
  if (!role) return;
  if (!confirm(`¿Eliminar el rol "${role.nombre}"?`)) return;
  try {
    const result = await apiFetch(`/api/roles/${id}`, { method:'DELETE' });
    showToast(result.mensaje || 'Rol eliminado.', 'Rol eliminado');
    clearRoleEditor();
    await refreshRoles();
  } catch (err) {
    showToast(err.message, 'No se pudo eliminar el rol');
  }
}

async function bootstrapPrivateData() {
  try {
    employees = loadEmployees();
    renderEmployeeList();
    renderEmployeeFilter();
    render();
  } catch (err) {
    console.error(`[DeTodoEc V${APP_VERSION}] Error preparando interfaz base`, err);
  }

  const jobFactories = [
    () => refreshTasks(),
    () => refreshEmployees(),
    () => refreshQuoteConfig({ silent:true }),
    () => refreshDesigns({ silent:true }),
    () => refreshAttendance(),
    () => refreshHomeUsers()
  ];

  if (currentUser?.rol === 'admin') {
    jobFactories.push(() => refreshRoles());
    jobFactories.push(() => refreshAdminUsers());
  }

  const results = await Promise.allSettled(
    jobFactories.map((factory) => Promise.resolve().then(factory))
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.error(`[DeTodoEc V${APP_VERSION}] Módulo no cargado`, result.reason);
    }
  });

  const searchBox = $('#searchInput');
  if (searchBox) searchBox.value = '';

  if (userCan('home')) showMainView('home');
  else if (userCan('tasks')) showMainView('tasks');
  else if (userCan('quote')) showMainView('quote');
  else if (userCan('designs')) showMainView('designs');
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

function showAdminSection(section = 'apariencia') {
  const target = section || 'apariencia';

  $$('.admin-view').forEach((view) => {
    view.hidden = view.dataset.adminView !== target;
  });

  $$('.admin-nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.adminTarget === target);
  });

  pendingAdminSection = target;

  if (target === 'acceso') refreshAdminUsers();
  if (target === 'roles') refreshRoles();
  if (target === 'cotizador') {
    renderQuotePriceAdmin();
    renderQuoteClientAdmin();
  }
  if (target === 'disenos') {
    renderAdminDesigns();
  }
}

function requestAdminPanel(section = 'apariencia') {
  if (!currentUser || currentUser.rol !== 'admin') {
    showToast('Solo un administrador puede abrir este panel.', 'Acceso restringido');
    return;
  }
  pendingAdminSection = section || 'apariencia';
  openAdminPanel(section);
}
function openAdminPanel(section = pendingAdminSection || 'apariencia') {
  // Primero abre la página; después carga los módulos.
  ['home','resumen','tareas','archivados','cotizador','disenos','checkin'].forEach((id) => {
    const el = $('#' + id);
    if (el) el.hidden = true;
  });

  if (settingsPage) settingsPage.hidden = true;
  if (adminPage) adminPage.hidden = false;
  document.body.classList.add('standalone-open');

  try { showAdminSection(section); } catch (err) { console.error('Admin navegación:', err); }
  try { renderEmployeeList(); } catch (err) { console.error('Admin empleados:', err); }
  try { renderQuotePriceAdmin(); } catch (err) { console.error('Admin cotizador:', err); }
  try { clearEmployeeForm(); } catch (err) { console.error('Admin formulario:', err); }

  Promise.allSettled([
    Promise.resolve().then(() => refreshAdminUsers()),
    Promise.resolve().then(() => refreshRoles())
  ]);

  window.scrollTo({ top:0, behavior:'instant' });
}

function on(id, event, handler) {
  const el = $('#' + id);
  if (el) el.addEventListener(event, handler);
}

on('archiveNav', 'click', () => setArchiveView(true));
on('closeArchive', 'click', () => setArchiveView(false));
on('archiveSearchInput', 'input', renderArchive);
on('closeLogin', 'click', () => loginDialog.close());
on('cancelLogin', 'click', () => loginDialog.close());
on('closeAdmin', 'click', () => showMainView('home'));
on('closeAdminFooter', 'click', () => showMainView('home'));
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
['newTaskAction', 'newTaskEmpty'].forEach((id) => on(id, 'click', openNew));

on('detailEdit', 'click', () => openEdit(detailTaskId));
on('detailPay', 'click', () => addPayment(detailTaskId));
on('detailDeliver', 'click', () => markDelivered(detailTaskId));
on('detailArchive', 'click', () => archiveTask(detailTaskId));
on('detailDelete', 'click', () => requestDelete(detailTaskId));

$('#paymentHistoryList')?.addEventListener('click', (e) => {
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
on('refreshAttendance', 'click', refreshAttendance);
// Navegación y menú de perfil conectados por bindCoreNavigationEarly().

on('closeSettings', 'click', () => showMainView('home'));
on('settingsLightTheme', 'click', () => setTheme('light'));
on('settingsDarkTheme', 'click', () => setTheme('dark'));
on('refreshHomeUsers', 'click', refreshHomeUsers);
on('closeProfile', 'click', () => $('#profileDialog').close());
on('cancelProfile', 'click', () => $('#profileDialog').close());
on('logoutBtn', 'click', logoutApp);
on('manageDesignsBtn', 'click', () => requestAdminPanel('disenos'));
on('newRoleBtn', 'click', clearRoleEditor);
on('saveRoleBtn', 'click', saveRole);
on('deleteRoleBtn', 'click', deleteRole);
$('#rolesList')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-role-id]');
  if (btn) editRole(btn.dataset.roleId);
});
on('designSearchInput', 'input', renderDesigns);

['quoteMaterial','quoteWidth','quoteHeight','quoteQty','quoteEyeletsQty','quoteCutMeters'].forEach((id) => on(id, 'input', calculateQuote));
['quoteMaterial','quoteEyeletsEnabled','quoteCutEnabled','quoteDesignEnabled'].forEach((id) => on(id, 'change', calculateQuote));

on('quoteCustomerTrigger', 'click', () => {
  const menu = $('#quoteCustomerMenu');
  if (!menu) return;
  menu.hidden = !menu.hidden;
  $('#quoteCustomerTrigger')?.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
});
$('#quoteCustomerMenu')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-quote-customer]');
  if (btn) selectQuoteCustomer(btn.dataset.quoteCustomer);
});

on('quoteClientCancelBtn', 'click', clearQuoteClientForm);
$('#quoteClientPhotoInput')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  quoteClientEditingPhotoFile = file;
  renderQuoteClientPhotoPreview(URL.createObjectURL(file));
});
$('#quoteClientForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#quoteClientId').value.trim();
  const nombre = $('#quoteClientNameInput').value.trim();
  if (!nombre) return;

  const btn = $('#quoteClientSaveBtn');
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = id ? 'Actualizando…' : 'Guardando…';

  try {
    let foto_url = quoteClientEditingPhotoUrl || '';
    if (quoteClientEditingPhotoFile) {
      const fd = new FormData();
      fd.append('imagen', quoteClientEditingPhotoFile);
      const upload = await apiFetch('/api/imagenes', { method:'POST', body:fd });
      foto_url = upload.url || '';
    }

    if (id === 'publico') {
      await apiFetch('/api/cotizador/cliente-publico', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ nombre, foto_url })
      });
    } else {
      await apiFetch(id ? `/api/cotizador/clientes/${id}` : '/api/cotizador/clientes', {
        method:id ? 'PUT' : 'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ nombre, foto_url })
      });
    }

    clearQuoteClientForm();
    await refreshQuoteConfig({ silent:true });
    showToast(
      id === 'publico'
        ? 'Cliente público actualizado correctamente.'
        : id
          ? 'Cliente actualizado correctamente.'
          : 'Cliente creado correctamente.',
      id ? 'Cliente actualizado' : 'Cliente creado'
    );
  } catch (err) {
    showToast(err.message, 'No se pudo guardar el cliente');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
});
$('#quoteClientAdminList')?.addEventListener('click', (e) => {
  const editId = e.target.closest('[data-edit-quote-client]')?.dataset.editQuoteClient;
  const deleteId = e.target.closest('[data-delete-quote-client]')?.dataset.deleteQuoteClient;
  if (editId) editQuoteClient(editId);
  if (deleteId) deleteQuoteClient(deleteId);
});

[['quoteEyeletIconFile','eyelet','#quoteEyeletIconPreview'],['quoteCutIconFile','cut','#quoteCutIconPreview'],['quoteDesignIconFile','design','#quoteDesignIconPreview']].forEach(([id,type,previewSelector]) => {
  on(id, 'change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    quotePendingIconFiles[type] = file;
    const preview = $(previewSelector);
    if (preview) preview.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" />`;
  });
});
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

$('#defaultTaskImageInput')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  pendingDefaultTaskImageFile = file;
  renderDefaultTaskImagePreview(URL.createObjectURL(file));
});
on('saveDefaultTaskImage', 'click', saveTaskDefaultImage);
on('resetDefaultTaskImage', 'click', resetTaskDefaultImage);

$('#siteIconInput')?.addEventListener('change', (e) => {
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

// V11: credenciales administradas desde Usuarios y Mi perfil.


// Login conectado previamente por bindLoginFormEarly().


$('#profilePhoto')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  profilePhotoFile = file;
  $('#profileAvatarPreview').innerHTML = `<img src="${URL.createObjectURL(file)}" alt="" />`;
});

$('#profileForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submit = e.currentTarget.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    let foto_url = currentUser?.foto_url || '';
    if (profilePhotoFile) foto_url = await uploadImage(profilePhotoFile);
    const payload = {
      nombre: $('#profileName').value.trim(),
      usuario: $('#profileUsername').value.trim(),
      foto_url,
      password: $('#profileNewPassword').value || undefined
    };
    const result = await apiFetch('/api/auth/perfil', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    currentUser = result.usuario;
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));
    updateCurrentUserUI();
    $('#profileDialog').close();
    showToast('Tus datos fueron actualizados.', 'Perfil actualizado');
    await refreshAttendance();
  } catch (err) {
    showToast(err.message, 'No se pudo actualizar el perfil');
  } finally {
    submit.disabled = false;
  }
});

$('#adminUserPhoto')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  adminUserPhotoFile = file;
  renderAdminUserPhoto(URL.createObjectURL(file));
});

on('adminUserCancelBtn', 'click', clearAdminUserForm);
$('#adminUserForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('#adminUserId').value.trim();
  const nombre = $('#adminUserName').value.trim();
  const usuario = $('#adminUsername').value.trim();
  const password = $('#adminUserPassword').value;
  if (!id && !password) { showToast('Escribe una contraseña para el nuevo usuario.', 'Falta contraseña'); return; }
  const btn = $('#adminUserSaveBtn');
  btn.disabled = true;
  try {
    let foto_url = adminUserPhotoUrl || '';
    if (adminUserPhotoFile) foto_url = await uploadImage(adminUserPhotoFile);
    const payload = { nombre, usuario, role_id:Number($('#adminUserRole').value || 0), valor_hora:Number($('#adminUserHourlyRate').value || 0), foto_url, password:password || undefined };
    await apiFetch(id ? `/api/usuarios/${id}` : '/api/usuarios', { method:id ? 'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
    clearAdminUserForm();
    await refreshAdminUsers();
    showToast(id ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.', id ? 'Usuario actualizado' : 'Usuario creado');
  } catch (err) {
    showToast(err.message, 'No se pudo guardar el usuario');
  } finally {
    btn.disabled = false;
  }
});

$('#adminUsersList')?.addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit-app-user]')?.dataset.editAppUser;
  const del = e.target.closest('[data-delete-app-user]')?.dataset.deleteAppUser;
  if (edit) editAdminUser(edit);
  if (del) deleteAdminUser(del);
});

$('#taskImage')?.addEventListener('change', (e) => {
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

$('#finishedTaskImage')?.addEventListener('change', (e) => {
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
$('#totalAmount')?.addEventListener('input', updateSplitPreview);
taskForm?.addEventListener('submit', saveTask);

$('#employeePhoto')?.addEventListener('change', (e) => {
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
$('#employeeName')?.addEventListener('input', () => {
  if (!employeeEditingPhoto) setEmployeeAvatarBox($('#employeePhotoPreview'), '', $('#employeeName').value.trim());
});
on('employeeCancelBtn', 'click', clearEmployeeForm);

employeeForm?.addEventListener('submit', async (e) => {
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

$('#employeeList')?.addEventListener('click', (e) => {
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
  const files = [...(e.target.files || [])].slice(0, 5);
  if (!files.length) return;
  designEditingPreviewFiles = files;

  Promise.all(files.map((file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  }))).then((urls) => {
    $('#designFormPreviewWrap').hidden = false;
    renderDesignAdminPreviewGallery(urls);
  });

  if ((e.target.files || []).length > 5) {
    showToast('Solo se usarán las primeras 5 imágenes.', 'Límite de vistas previas');
  }
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
    showToast(
      'Selecciona al menos un material y completa nombre, medidas y tiempo estimado.',
      'Faltan datos'
    );
    return;
  }

  if (!id && (!designEditingPreviewFiles.length || !designEditingSourceFile)) {
    showToast(
      'Para crear un diseño debes subir la vista previa y el archivo SVG o AI.',
      'Faltan archivos'
    );
    return;
  }

  const btn = $('#designSaveBtn');
  const original = btn.textContent;
  btn.disabled = true;

  let uploadedPreviewUrls = [];
  let uploadedSourceUrl = '';

  try {
    const existing = id ? designs.find((d) => String(d.id) === String(id)) : null;

    let previewUrls = (existing?.previewUrls?.length ? existing.previewUrls : [existing?.previewUrl]).filter(Boolean).slice(0, 5);
    let fileUrl = existing?.fileUrl || '';
    let fileName = existing?.fileName || '';
    let fileType = existing?.fileType || '';

    if (designEditingPreviewFiles.length) {
      btn.textContent = 'Subiendo vistas previas…';
      previewUrls = [];
      for (let i = 0; i < designEditingPreviewFiles.length; i++) {
        const previewForm = new FormData();
        previewForm.append('imagen', designEditingPreviewFiles[i]);
        const previewResult = await apiFetch('/api/imagenes', {
          method: 'POST',
          body: previewForm
        });
        const url = previewResult.url || '';
        if (!url) throw new Error(`No se pudo subir la vista previa ${i + 1}.`);
        previewUrls.push(url);
        uploadedPreviewUrls.push(url);
      }
    }

    if (designEditingSourceFile) {
      btn.textContent = 'Subiendo archivo…';
      const fileForm = new FormData();
      fileForm.append('archivo', designEditingSourceFile);
      const fileResult = await apiFetch('/api/archivos', {
        method: 'POST',
        body: fileForm
      });
      fileUrl = fileResult.url || '';
      fileName = fileResult.nombre || designEditingSourceFile.name || '';
      fileType = fileResult.tipo || designEditingSourceFile.type || '';
      uploadedSourceUrl = fileUrl;
    }

    if (!previewUrls.length || !fileUrl) {
      throw new Error('No se pudieron obtener las URLs de los archivos del diseño.');
    }

    btn.textContent = id ? 'Actualizando datos…' : 'Guardando datos…';

    const payload = {
      nombre: name,
      descripcion: description,
      precio: price,
      materiales: materials,
      ancho: width,
      alto: height,
      tiempo_estimado: time,
      preview_url: previewUrls[0],
      preview_urls: previewUrls,
      archivo_url: fileUrl,
      archivo_nombre: fileName,
      archivo_tipo: fileType
    };

    const result = await apiFetch(
      id ? `/api/disenos/${id}` : '/api/disenos',
      {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    clearDesignForm();
    await refreshDesigns({ silent: false });

    showToast(
      result?.mensaje || (id ? 'El diseño fue actualizado.' : 'El diseño fue guardado.'),
      id ? 'Diseño actualizado' : 'Diseño guardado'
    );
  } catch (err) {
    console.error('Error guardando diseño:', err);

    // Si el registro falló después de subir archivos nuevos, intenta limpiar esos archivos.
    try {
      for (const uploadedPreviewUrl of uploadedPreviewUrls) {
        const key = uploadedPreviewUrl.split('/api/imagenes/')[1];
        if (key) await apiFetch(`/api/imagenes/${key}`, { method: 'DELETE' });
      }
      if (uploadedSourceUrl) {
        const key = uploadedSourceUrl.split('/api/archivos/')[1];
        if (key) await apiFetch(`/api/archivos/${key}`, { method: 'DELETE' });
      }
    } catch {}

    showToast(
      err.message || 'No se pudo guardar el diseño.',
      id ? 'No se pudo actualizar el diseño' : 'No se pudo guardar el diseño'
    );
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
  const msg = event?.error?.message || event?.message || '';
  if (msg && currentUser) {
    showToast(`Error de interfaz: ${msg}`, 'Diagnóstico');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error(`[DeTodoEc V${APP_VERSION}] Promesa rechazada`, event.reason);
});

try { populateDesignTimeValues('horas', 1); } catch (err) { console.error('Diseños:', err); }
try { setDesignMaterials(''); } catch (err) { console.error('Materiales:', err); }

let initialSettings = {};
try { initialSettings = loadSettings() || {}; } catch (err) { console.error('Ajustes:', err); }
const preferredTheme = initialSettings.theme || ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');

try { setTheme(preferredTheme, false); } catch (err) { console.error('Tema:', err); }
try { applySiteIcon(initialSettings.siteIcon || ''); } catch (err) { console.error('Icono:', err); }
try { applyQuoteExtraIcons(); } catch (err) { console.error('Cotizador:', err); }

showAuthGate();

// Verifica visualmente la conexión con Cloudflare al iniciar.
fetch(API_BASE + '/')
  .then((res) => {
    if (res.ok) setSyncState('ok');
    else setSyncState('error');
  })
  .catch(() => setSyncState('error'));

restoreSession()
  .then((ok) => { if (!ok) showAuthGate(); })
  .catch((err) => {
    console.error(`[DeTodoEc V${APP_VERSION}] Inicio`, err);
    showAuthGate('No se pudo restaurar la sesión. Puedes iniciar sesión nuevamente.');
  });

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
