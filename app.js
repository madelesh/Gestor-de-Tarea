const APP_VERSION = '11.6.3';
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
let focusedCheckinUserId = null;
let currentAttendanceRows = [];
let editingCheckinId = null;
let confirmResolver = null;
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
const myCheckinPage = $('#myCheckinPage');
const confirmDialog = $('#confirmDialog');
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



/* =========================================================
   V11.3.1 — Restauración de tareas, empleados y carga de archivos
   ========================================================= */

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

function copyQuoteSummary() {
  if (!quoteItems.length) return;

  const lines = ['Cotización', ''];

  quoteItems.forEach((item, index) => {
    lines.push(`${item.nombre}`);
    lines.push(`Alto ${item.height.toFixed(2)}M x Ancho ${item.width.toFixed(2)}m ${money(item.total)}`);
    lines.push(`*Subtotal:* ${money(item.total)}`);

    if (index < quoteItems.length - 1) {
      lines.push('');
    }
  });

  const content = lines.join('\n');

  navigator.clipboard?.writeText(content)
    .then(() => showToast('La cotización fue copiada y está lista para enviarla al cliente.', 'Cotización copiada'))
    .catch(() => showToast(content, 'Cotización lista'));
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

    // V10.15: las tareas ya no se archivan automáticamente por estar pagadas.


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
  const statusBadge = node.querySelector('.card-status-badge');
  statusBadge.textContent = task.archived ? 'Entregado' : statusLabel(task.status);
  if (task.archived) statusBadge.classList.add('archived-delivered');
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
  const copyClientBtn = node.querySelector('.card-copy-client');
  copyClientBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(task.clientName || '');
      showToast(task.clientName || '', 'Nombre del cliente copiado');
    } catch {
      showToast('No se pudo copiar el nombre.', 'Copiar');
    }
  });
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
    if (task.archived) {
      countdownEl.innerHTML = `${iconUse('icon-check')}<span>Entregado</span>`;
      countdownEl.dataset.tone = 'success';
      countdownEl.classList.add('archived-delivered-label');
    } else {
      countdownEl.textContent = countdown.text;
      countdownEl.dataset.tone = countdown.tone;
      countdownEl.classList.remove('archived-delivered-label');
    }
  }
  card.dataset.id = task.id;
  card.draggable = !task.archived;
  card.addEventListener('dragstart', (e) => {
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(task.id));
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.addEventListener('click', () => openDetail(task.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDetail(task.id);
    }
  });
  return node;
}

async function moveTaskToStatus(taskId, nextStatus) {
  const task = tasks.find((item) => String(item.id) === String(taskId));
  if (!task || task.status === nextStatus) return;

  const previous = task.status;
  task.status = nextStatus;
  render();

  try {
    await apiFetch(`/api/tareas/${task.id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ ...toApi(task), estado:nextStatus })
    });
    showToast(
      `${task.taskName || 'La tarea'} pasó de ${statusLabel(previous)} a ${statusLabel(nextStatus)}.`,
      'Estado actualizado'
    );
    await refreshTasks({ silent:true });
  } catch (err) {
    task.status = previous;
    render();
    showToast(err.message, 'No se pudo mover la tarea');
  }
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

      const wrapper = document.createElement('section');
      wrapper.className = `task-group task-group-${group.key}`;
      wrapper.dataset.statusDrop = group.key;

      const heading = document.createElement('div');
      heading.className = `task-group-heading task-group-${group.key}`;
      heading.innerHTML = `
        <strong>${group.label}</strong>
        <span>${items.length}</span>
        <small>Arrastra aquí para cambiar estado</small>
      `;

      const body = document.createElement('div');
      body.className = 'task-group-body';

      if (!items.length) {
        body.innerHTML = `<div class="task-group-empty">Suelta una tarea aquí</div>`;
      } else {
        items.forEach((t) => body.appendChild(createTaskCard(t)));
      }

      wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        wrapper.classList.add('drag-over');
      });
      wrapper.addEventListener('dragleave', (e) => {
        if (!wrapper.contains(e.relatedTarget)) wrapper.classList.remove('drag-over');
      });
      wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('drag-over');
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) moveTaskToStatus(taskId, group.key);
      });

      wrapper.append(heading, body);
      taskGrid.appendChild(wrapper);
    });
  } else {
    const singleGrid = document.createElement('div');
    singleGrid.className = 'task-group-body standalone-task-grid';
    filtered.sort(sortByDate).forEach((t) => singleGrid.appendChild(createTaskCard(t)));
    taskGrid.appendChild(singleGrid);
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
  const archiveButton = $('#detailArchive');
  if (archiveButton) {
    archiveButton.innerHTML = task.archived ? `${iconUse('icon-refresh')}<span>Desarchivar</span>` : `${iconUse('icon-archive')}<span>Archivar</span>`;
    archiveButton.classList.toggle('unarchive-action', task.archived);
  }
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

function hideStandalonePages() {
  if (settingsPage) settingsPage.hidden = true;
  if (myCheckinPage) myCheckinPage.hidden = true;
  if (adminPage) adminPage.hidden = true;
  document.body.classList.remove('standalone-open', 'admin-page-open');
}

async function refreshMyCheckin() {
  if (!currentUser) return;

  try {
    const [state, rows] = await Promise.all([
      apiFetch('/api/asistencia/estado'),
      apiFetch(`/api/mi-checkin?_=${Date.now()}`, { cache:'no-store' })
    ]);

    const open = Boolean(state?.abierto);
    const had = Boolean(state?.entrada);

    $('#myCheckinStatus').textContent = open ? 'Trabajando' : had ? 'Jornada cerrada' : 'Sin registro';
    $('#myCheckinEntry').textContent = formatTime(state?.entrada);
    $('#myCheckinExit').textContent = formatTime(state?.salida);
    $('#myCheckinWorked').textContent = formatWorkedTime(Number(state?.minutos || 0));

    const tbody = $('#myCheckinTableBody');
    if (tbody) {
      tbody.innerHTML = '';
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${escapeHtml(formatAttendanceDate(row.fecha_local))}</td>
          <td>${formatTime(row.entrada)}</td>
          <td>${formatTime(row.salida)}</td>
          <td><strong>${formatWorkedTime(Number(row.minutos || 0))}</strong></td>
          <td><span class="attendance-status ${row.salida ? 'closed' : 'open'}">${row.salida ? 'Finalizada' : 'Trabajando'}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }

    if ($('#myCheckinEmpty')) $('#myCheckinEmpty').hidden = Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    showToast(err.message || 'No se pudo cargar Mi Check-in.', 'Mi Check-in');
  }
}

function showMyCheckinPage() {
  hideStandalonePages();

  ['home','resumen','tareas','archivados','cotizador','disenos'].forEach((id) => {
    const el = $('#' + id);
    if (el) el.hidden = true;
  });

  if (myCheckinPage) myCheckinPage.hidden = false;
  document.body.classList.add('standalone-open');
  window.scrollTo({ top:0, behavior:'instant' });
  refreshMyCheckin();
}

function showSettingsPage() {
  hideStandalonePages();
  ['home','resumen','tareas','archivados','cotizador','disenos'].forEach((id) => {
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

  const isHome = view === 'home';
  const isTasks = view === 'tasks';
  const isQuote = view === 'quote';
  const isDesigns = view === 'designs';

  $('#home').hidden = !isHome;
  $('#resumen').hidden = !isTasks;
  $('#tareas').hidden = !isTasks;
  $('#archivados').hidden = true;
  $('#cotizador').hidden = !isQuote;
  $('#disenos').hidden = !isDesigns;

  $('#navHome')?.classList.toggle('active', isHome);
  $('#navTasks')?.classList.toggle('active', isTasks);
  $('#navQuote')?.classList.toggle('active', isQuote);
  $('#navDesigns')?.classList.toggle('active', isDesigns);

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
    const networkError =
      err instanceof TypeError ||
      /fetch|network|failed|load|cloudflare no respondió/i.test(String(err?.message || ''));

    if (networkError) {
      setSyncState('error');
      if (notify) showToast(err.message || 'No se pudo conectar con Cloudflare.', 'Sin conexión');
    } else {
      setSyncState('ok');
      console.error(`[DeTodoEc V${APP_VERSION}] Error interno actualizando módulos`, err);
      if (notify) showToast(err.message || 'Un módulo no pudo actualizarse.', 'Error de interfaz');
    }
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

  safeBind('profileBtn', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = !menu.hidden;
  });

  safeBind('profileEditMenu', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    openProfile();
  });

  safeBind('profileMyCheckinMenu', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    showMyCheckinPage();
  });

  safeBind('profileThemeMenu', () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    toggleTheme();
    const themeState = $('#profileThemeState');
    if (themeState) themeState.textContent = document.documentElement.dataset.theme === 'dark' ? 'Claro' : 'Oscuro';
  });

  safeBind('profileLogoutMenu', async () => {
    const menu = $('#profileDropdown');
    if (menu) menu.hidden = true;
    const sure = await themedConfirm({
      title:'Cerrar sesión',
      message:'¿Estás seguro de que quieres cerrar tu sesión?',
      confirmText:'Cerrar sesión',
      danger:true
    });
    if (sure) await logoutApp();
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
    const isAdminViewer = currentUser?.rol === 'admin';
    card.className = `home-worker-card ${user.online ? 'online' : 'offline'} ${isAdminViewer ? 'admin-clickable' : ''}`;
    card.dataset.userId = user.id;

    const statusDetail = user.online && user.entrada_actual
      ? `Entrada ${formatTime(user.entrada_actual)}`
      : 'Sin jornada abierta';

    card.innerHTML = `
      <div class="home-worker-avatar">
        ${user.foto_url ? `<img src="${escapeHtml(user.foto_url)}" alt="" />` : iconUse('icon-user')}
        <span class="presence-dot" aria-hidden="true"></span>
      </div>

      <div class="home-worker-copy">
        <strong>${escapeHtml(user.nombre || user.usuario)}</strong>
        <span>${escapeHtml(user.role_name || (user.rol === 'admin' ? 'Administrador' : 'Usuario'))}</span>
        <small>${escapeHtml(statusDetail)}</small>
      </div>

      <div class="home-worker-side">
        <span class="home-worker-status">${user.online ? 'Online' : 'Offline'}</span>
        ${isAdminViewer ? '<span class="home-worker-open">Ver check-in ›</span>' : ''}
      </div>
    `;

    if (isAdminViewer) {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Ver check-in de ${user.nombre || user.usuario}`);

      const openCheckin = async () => {
        focusedCheckinUserId = String(user.id);
        requestAdminPanel('checkin');
        await refreshAttendance();
        requestAnimationFrame(() => focusCheckinRows(user.id));
      };

      card.addEventListener('click', openCheckin);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCheckin();
        }
      });
    }

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
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${total} min · ${hours} h ${mins} min`;
}

function attendancePay(minutes = 0, hourlyRate = 0) {
  return (Number(minutes || 0) / 60) * Number(hourlyRate || 0);
}

function renderAttendanceState() {
  const state = attendanceState || {};
  const open = Boolean(state.abierto);
  const hadSession = Boolean(state.entrada);
  const worked = Number(state.minutos || 0);
  const quickBtn = $('#homeAttendanceBtn');
  const mainLabel = $('#homeAttendanceText');
  const subLabel = $('#homeAttendanceSubtext');
  const iconUse = $('#homeAttendanceIconUse');

  let mainText = 'Entrada';
  let subText = 'Pulsa para marcar tu entrada';
  let iconHref = '#icon-checkin-entry';
  let stateClass = 'attendance-entry';

  if (open) {
    mainText = 'Salida';
    subText = `Entrada marcada: ${formatTime(state.entrada)}`;
    iconHref = '#icon-checkin-exit';
    stateClass = 'attendance-exit';
  } else if (hadSession) {
    mainText = 'Completado';
    subText = `Trabajado hoy: ${formatWorkedTime(worked)}`;
    iconHref = '#icon-checkin-done';
    stateClass = 'attendance-completed';
  }

  if (mainLabel) mainLabel.textContent = mainText;
  if (subLabel) subLabel.textContent = subText;
  if (iconUse) iconUse.setAttribute('href', iconHref);

  if (quickBtn) {
    quickBtn.classList.remove('attendance-entry', 'attendance-exit', 'attendance-completed', 'is-clocked-in', 'is-completed');
    quickBtn.classList.add(stateClass);
    quickBtn.classList.toggle('is-clocked-in', open);
    quickBtn.classList.toggle('is-completed', !open && hadSession);
    quickBtn.disabled = false;
    quickBtn.title = open ? 'Marcar salida' : hadSession ? 'Marcar otra entrada' : 'Marcar entrada';
  }

  if ($('#profileAttendanceEntry')) $('#profileAttendanceEntry').textContent = formatTime(state.entrada);
  if ($('#profileAttendanceExit')) $('#profileAttendanceExit').textContent = formatTime(state.salida);
  if ($('#profileAttendanceTime')) $('#profileAttendanceTime').textContent = formatWorkedTime(worked);

  if ($('#profileAttendanceStatus')) {
    $('#profileAttendanceStatus').textContent = open
      ? 'Jornada en curso'
      : hadSession
        ? 'Última jornada finalizada'
        : 'Sin entrada registrada';
  }

  if ($('#profileAttendanceBadge')) {
    $('#profileAttendanceBadge').textContent = open ? 'Trabajando' : hadSession ? 'Finalizada' : 'Pendiente';
    $('#profileAttendanceBadge').className = `profile-attendance-state ${open ? 'open' : hadSession ? 'closed' : 'pending'}`;
  }
}
function renderAttendanceRows(rows = []) {
  currentAttendanceRows = Array.isArray(rows) ? rows : [];
  const tbody = $('#attendanceTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  let totalMinutes = 0;
  let totalPay = 0;
  let openCount = 0;

  rows.forEach((row) => {
    const minutes = Number(row.minutos || 0);
    const rate = Number(row.valor_hora_efectivo ?? row.valor_hora ?? 0);
    const pay = Number(row.valor_pagado ?? attendancePay(minutes, rate));
    totalMinutes += minutes;
    totalPay += pay;
    if (!row.salida) openCount += 1;

    const tr = document.createElement('tr');
    tr.dataset.userId = String(row.usuario_id);
    tr.dataset.checkinId = String(row.id);

    if (String(editingCheckinId) === String(row.id)) {
      const entry = localDateTimeParts(row.entrada);
      const exit = localDateTimeParts(row.salida);
      tr.classList.add('checkin-inline-editing');
      tr.innerHTML = `
        <td><div class="attendance-table-user"><span class="attendance-table-avatar">${row.foto_url ? `<img src="${escapeHtml(row.foto_url)}" alt="" />` : iconUse('icon-user')}</span><span><strong>${escapeHtml(row.nombre || row.usuario)}</strong><small>@${escapeHtml(row.usuario)}</small></span></div></td>
        <td><input class="checkin-inline-input" data-field="entrada" type="time" value="${escapeHtml(entry.time)}" /></td>
        <td><input class="checkin-inline-input" data-field="salida" type="time" value="${escapeHtml(row.salida ? exit.time : '')}" /></td>
        <td>
          <div class="checkin-inline-time">
            <input class="checkin-inline-input" data-field="minutos" type="number" min="0" step="1" value="${Math.round(minutes)}" />
            <span>min</span>
            <input class="checkin-inline-input" data-field="horas" type="number" min="0" step="0.01" value="${(minutes/60).toFixed(2)}" />
            <span>h</span>
          </div>
        </td>
        <td><input class="checkin-inline-input money" data-field="valor_hora" type="number" min="0" step="0.01" value="${rate.toFixed(2)}" /></td>
        <td><input class="checkin-inline-input money" data-field="valor_pagado" type="number" min="0" step="0.01" value="${pay.toFixed(2)}" /></td>
        <td><span class="attendance-status ${row.salida ? 'closed' : 'open'}">${row.salida ? 'Finalizada' : 'Trabajando'}</span></td>
        <td>
          <div class="checkin-inline-actions">
            <button type="button" class="checkin-save-btn" data-save-checkin="${row.id}" title="Guardar">${iconUse('icon-check')}</button>
            <button type="button" class="checkin-cancel-btn" data-cancel-checkin="${row.id}" title="Cancelar">×</button>
          </div>
        </td>`;
    } else {
      tr.innerHTML = `
        <td><div class="attendance-table-user"><span class="attendance-table-avatar">${row.foto_url ? `<img src="${escapeHtml(row.foto_url)}" alt="" />` : iconUse('icon-user')}</span><span><strong>${escapeHtml(row.nombre || row.usuario)}</strong><small>@${escapeHtml(row.usuario)}</small></span></div></td>
        <td>${formatTime(row.entrada)}</td>
        <td>${formatTime(row.salida)}</td>
        <td><strong>${formatWorkedTime(minutes)}</strong></td>
        <td>${money(rate)}</td>
        <td><strong>${money(pay)}</strong></td>
        <td><span class="attendance-status ${row.salida ? 'closed' : 'open'}">${row.salida ? 'Finalizada' : 'Trabajando'}</span></td>
        <td><button type="button" class="checkin-edit-btn" data-edit-checkin="${row.id}" title="Editar">${iconUse('icon-edit')}</button></td>`;
    }
    tbody.appendChild(tr);
  });

  $('#attendanceEmpty').hidden = rows.length > 0;
  if ($('#checkinUsersCount')) $('#checkinUsersCount').textContent = String(new Set(rows.map((r) => r.usuario_id)).size);
  if ($('#checkinOpenCount')) $('#checkinOpenCount').textContent = String(openCount);
  if ($('#checkinHoursTotal')) $('#checkinHoursTotal').textContent = formatWorkedTime(totalMinutes);
  if ($('#checkinPayTotal')) $('#checkinPayTotal').textContent = money(totalPay);

  if (focusedCheckinUserId) requestAnimationFrame(() => focusCheckinRows(focusedCheckinUserId));
}

function focusCheckinRows(userId) {
  const tbody = $('#attendanceTableBody');
  if (!tbody || !userId) return;

  const rows = [...tbody.querySelectorAll('tr[data-user-id]')];
  rows.forEach((row) => row.classList.toggle('checkin-focus-row', String(row.dataset.userId) === String(userId)));

  const target = rows.find((row) => String(row.dataset.userId) === String(userId));
  if (target) {
    target.scrollIntoView({ behavior:'smooth', block:'center' });
  }
}

function populateCheckinUserFilter(rows = []) {
  const select = $('#checkinUserFilter');
  if (!select) return;
  const current = select.value;
  const users = new Map();

  adminUsers.forEach((user) => users.set(String(user.id), user.nombre || user.usuario));
  rows.forEach((row) => users.set(String(row.usuario_id), row.nombre || row.usuario));

  select.innerHTML = '<option value="">Todos los usuarios</option>' +
    [...users.entries()]
      .sort((a,b) => a[1].localeCompare(b[1], 'es'))
      .map(([id,name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`)
      .join('');

  if (current && [...select.options].some((o) => o.value === current)) select.value = current;
}

async function refreshAttendance() {
  if (!currentUser) return;

  try {
    const state = await apiFetch('/api/asistencia/estado');
    attendanceState = state;
    renderAttendanceState();

    if (currentUser.rol === 'admin') {
      const startInput = $('#checkinStartDate');
      const endInput = $('#checkinEndDate');
      const userInput = $('#checkinUserFilter');

      if (startInput && !startInput.value) startInput.value = todayLocal();
      if (endInput && !endInput.value) endInput.value = todayLocal();

      const params = new URLSearchParams();
      params.set('inicio', startInput?.value || todayLocal());
      params.set('fin', endInput?.value || startInput?.value || todayLocal());
      if (userInput?.value) params.set('usuario_id', userInput.value);
      params.set('_', Date.now());

      const rows = await apiFetch(`/api/asistencia?${params.toString()}`, { cache:'no-store' });
      populateCheckinUserFilter(Array.isArray(rows) ? rows : []);
      renderAttendanceRows(Array.isArray(rows) ? rows : []);

      if ($('#attendanceDateLabel')) {
        const ini = startInput?.value || '';
        const fin = endInput?.value || '';
        $('#attendanceDateLabel').textContent = ini === fin
          ? formatAttendanceDate(ini)
          : `${formatAttendanceDate(ini)} — ${formatAttendanceDate(fin)}`;
      }
    }
  } catch (err) {
    showToast(err.message, 'No se pudo cargar la asistencia');
  }
}

function localDateTimeParts(isoValue) {
  if (!isoValue) return { date:'', time:'' };
  const date = new Date(isoValue);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:'America/Guayaquil',
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    date:`${get('year')}-${get('month')}-${get('day')}`,
    time:`${get('hour')}:${get('minute')}`
  };
}

function openCheckinEdit(id) {
  if (currentUser?.rol !== 'admin') return;
  editingCheckinId = String(id);
  renderAttendanceRows(currentAttendanceRows);
}

function cancelInlineCheckinEdit() {
  editingCheckinId = null;
  renderAttendanceRows(currentAttendanceRows);
}

async function saveInlineCheckinEdit(id) {
  if (currentUser?.rol !== 'admin') return;
  const row = currentAttendanceRows.find((item) => String(item.id) === String(id));
  const tr = document.querySelector(`tr[data-checkin-id="${CSS.escape(String(id))}"]`);
  if (!row || !tr) return;

  const get = (field) => tr.querySelector(`[data-field="${field}"]`)?.value ?? '';
  const entrada = get('entrada');
  const salida = get('salida');
  const minutos = Math.max(0, Number(get('minutos') || 0));
  const valorHora = Math.max(0, Number(get('valor_hora') || 0));
  const valorPagado = Math.max(0, Number(get('valor_pagado') || 0));

  if (!entrada) {
    showToast('La hora de entrada es obligatoria.', 'Check-in');
    return;
  }

  try {
    const result = await apiFetch(`/api/asistencia/${id}`, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        fecha_local:row.fecha_local,
        entrada_local:`${row.fecha_local}T${entrada}`,
        salida_local:salida ? `${row.fecha_local}T${salida}` : null,
        minutos_override:minutos,
        valor_hora_override:valorHora,
        valor_pagado_override:valorPagado
      })
    });

    editingCheckinId = null;
    showToast(result.mensaje || 'Registro actualizado.', 'Check-in actualizado');
    await Promise.allSettled([refreshAttendance(), refreshHomeUsers()]);
  } catch (err) {
    showToast(err.message, 'No se pudo editar el check-in');
  }
}


function themedConfirm({
  title = 'Confirmar acción',
  message = '¿Deseas continuar?',
  confirmText = 'Confirmar',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    const dialog = $('#confirmDialog');
    const titleEl = $('#confirmTitle');
    const messageEl = $('#confirmMessage');
    const acceptEl = $('#confirmAccept');
    const cancelEl = $('#confirmCancel');

    if (!dialog || typeof dialog.showModal !== 'function') {
      resolve(window.confirm(message));
      return;
    }

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;

    if (acceptEl) {
      acceptEl.textContent = confirmText;
      acceptEl.className = danger ? 'btn btn-danger' : 'btn btn-accent';
    }

    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;

      acceptEl?.removeEventListener('click', acceptHandler);
      cancelEl?.removeEventListener('click', cancelHandler);
      dialog.removeEventListener('cancel', cancelEventHandler);
      dialog.removeEventListener('close', closeHandler);

      if (dialog.open) dialog.close();
      resolve(Boolean(value));
    };

    const acceptHandler = () => finish(true);
    const cancelHandler = () => finish(false);
    const cancelEventHandler = (event) => {
      event.preventDefault();
      finish(false);
    };
    const closeHandler = () => {
      if (!settled) finish(false);
    };

    acceptEl?.addEventListener('click', acceptHandler, { once:true });
    cancelEl?.addEventListener('click', cancelHandler, { once:true });
    dialog.addEventListener('cancel', cancelEventHandler, { once:true });
    dialog.addEventListener('close', closeHandler, { once:true });

    dialog.showModal();
  });
}

function closeThemedConfirm(value) {
  const dialog = $('#confirmDialog');
  if (dialog?.open) dialog.close();
  if (confirmResolver) {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(Boolean(value));
  }
}

async function toggleAttendance() {
  if (!currentUser) return;
  const isOpen = Boolean(attendanceState?.abierto);

  if (isOpen) {
    const sure = await themedConfirm({
      title:'Marcar salida',
      message:'¿Estás seguro de que quieres registrar tu salida ahora?',
      confirmText:'Marcar salida',
      danger:true
    });
    if (!sure) return;
  }

  const btns = [$('#homeAttendanceBtn')].filter(Boolean);
  btns.forEach((btn) => btn.disabled = true);

  try {
    const endpoint = isOpen ? '/api/asistencia/salida' : '/api/asistencia/entrada';
    const result = await apiFetch(endpoint, { method:'POST' });

    if (isOpen) {
      showToast(
        `Salida marcada. Tiempo trabajado: ${formatWorkedTime(Number(result.minutos || 0))}.`,
        'Salida registrada'
      );
    } else {
      showToast(
        `Entrada marcada a las ${formatTime(result.entrada)}.`,
        'Entrada registrada'
      );
    }

    await Promise.allSettled([
      refreshAttendance(),
      refreshHomeUsers()
    ]);
  } catch (err) {
    showToast(err.message, 'Asistencia');
  } finally {
    btns.forEach((btn) => btn.disabled = false);
  }
}
async function refreshAdminUsers() {
  if (!currentUser || currentUser.rol !== 'admin') return;
  try {
    adminUsers = await apiFetch('/api/usuarios');
    renderAdminUsers();
    populateCheckinUserFilter(currentAttendanceRows);
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
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
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
  if (target === 'checkin') refreshAttendance();
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
  ['home','resumen','tareas','archivados','cotizador','disenos'].forEach((id) => {
    const el = $('#' + id);
    if (el) el.hidden = true;
  });

  if (settingsPage) settingsPage.hidden = true;
  if (adminPage) adminPage.hidden = false;
  document.body.classList.add('standalone-open', 'admin-page-open');

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
on('checkinStartDate', 'change', refreshAttendance);
on('checkinEndDate', 'change', refreshAttendance);
on('checkinUserFilter', 'change', refreshAttendance);
on('closeMyCheckin', 'click', () => showMainView('home'));
on('refreshMyCheckin', 'click', refreshMyCheckin);


$('#attendanceTableBody')?.addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit-checkin]');
  const save = e.target.closest('[data-save-checkin]');
  const cancel = e.target.closest('[data-cancel-checkin]');
  if (edit) openCheckinEdit(edit.dataset.editCheckin);
  if (save) saveInlineCheckinEdit(save.dataset.saveCheckin);
  if (cancel) cancelInlineCheckinEdit();
});

$('#attendanceTableBody')?.addEventListener('input', (e) => {
  const tr = e.target.closest('tr[data-checkin-id]');
  if (!tr) return;
  if (e.target.dataset.field === 'minutos') {
    const minutes = Math.max(0, Number(e.target.value || 0));
    const hours = tr.querySelector('[data-field="horas"]');
    if (hours) hours.value = (minutes / 60).toFixed(2);
  } else if (e.target.dataset.field === 'horas') {
    const hours = Math.max(0, Number(e.target.value || 0));
    const minutes = tr.querySelector('[data-field="minutos"]');
    if (minutes) minutes.value = String(Math.round(hours * 60));
  }
});
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
const preferredTheme = initialSettings.theme || 'dark';

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
