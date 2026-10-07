import { createClient } from '@supabase/supabase-js';
import { expiryLabel, status } from './status.js';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createClient(url, key) : null;
const root = document.querySelector('#app');
let demo = false, students = [], history = [], schoolGroups = [], selected = null, activeGroup = null, view = 'groups', promotionYear = null, groupYear = null, search = '', filter = '', session = null;

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const groupKey = student => JSON.stringify([student.academic_year, student.group_name]);
const tone = value => value === 'Vigente' ? 'green' : value === 'Vencido' ? 'red' : value === 'Próximo a vencer' ? 'amber' : 'gray';
const badge = value => `<span class="badge ${tone(value)}">${value}</span>`;
const header = () => `<header><a class="brand" href="/">P<span>PORVENIR<small>Carné del adolescente</small></span></a><div class="account">${demo ? '<span class="demo">Demostración · datos ficticios</span>' : escape(session?.user.email || 'Espacio del equipo')} ${session || demo ? '<button id="logout" class="secondary">Salir</button>' : ''}</div></header>`;

function message(text, error = false) {
  const element = document.querySelector('#message');
  if (!element) return;
  element.textContent = text;
  element.className = error ? 'message error' : 'message';
}

async function action(button, callback) {
  button.disabled = true;
  message('Procesando…');
  try { await callback(); }
  catch (error) { message(error.message || 'No se pudo completar la operación.', true); }
  finally { button.disabled = false; }
}

function login() {
  root.innerHTML = `${header()}<main class="login"><div class="eyebrow">LICEO PUEBLO PORVENIR</div><h1>Carnés al día,<br>en un solo lugar.</h1><p>Consulta el estado y actualiza el vencimiento del carné adolescente de cada estudiante.</p><section class="card"><h2>Ingresar al espacio del equipo</h2><form id="login"><label>Correo electrónico<input name="email" type="email" autocomplete="username" required></label><label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label><button ${!db ? 'disabled' : ''}>Ingresar</button></form>${!db ? '<p class="muted">Falta conectar este frontend con Supabase.</p>' : ''}<button id="demo" class="secondary">Explorar demostración</button><p id="message" role="status" aria-live="polite"></p></section></main>`;
  document.querySelector('#login').onsubmit = event => {
    event.preventDefault();
    action(event.submitter, async () => {
      const form = new FormData(event.target);
      const { data, error } = await db.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
      if (error) throw new Error('No se pudo ingresar. Revisa el correo y la contraseña.');
      session = data.session;
      await load();
    });
  };
  document.querySelector('#demo').onclick = () => {
    demo = true;
    students = [
      { id: 'a', full_name: 'Lucía Fernández', document_number: '51234567', birth_date: '2012-05-14', group_name: '8.º G. 1', group_code: '108433', list_number: 1, school_code: '1118', academic_year: 2026, card_status: 'has_card', card_expiry_month: '2026-09-01', review_required: false, notes: '' },
      { id: 'b', full_name: 'Mateo Rodríguez', document_number: '52345678', birth_date: '2013-03-22', group_name: '7.º 1E', group_code: '', list_number: 2, school_code: '1118', academic_year: 2026, card_status: 'no_card', card_expiry_month: null, review_required: false, notes: '' },
      { id: 'c', full_name: 'Valentina Silva', document_number: '53456789', birth_date: '2011-08-06', group_name: '9.º G. 1', group_code: '108434', list_number: 3, school_code: '1118', academic_year: 2026, card_status: 'unknown', card_expiry_month: null, review_required: true, notes: 'Confirmar con la familia.' },
    ];
    students.forEach(student => { student.is_active = true; rememberGroup(student); });
    schoolGroups = [...new Set(students.map(groupKey))].map((key, index) => { const [academic_year, name] = JSON.parse(key); return { id: index + 1, academic_year, name }; });
    render();
  };
}

function rememberGroup(student) {
  history = history.filter(item => !(String(item.student_id) === String(student.id) && item.academic_year === student.academic_year));
  history.push({ student_id: student.id, academic_year: student.academic_year, group_name: student.group_name, group_code: student.group_code, list_number: student.list_number });
}

async function load() {
  const rows = [];
  // ponytail: carga completa para 85 estudiantes; paginar si el volumen vuelve lenta la vista.
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('students').select('*').order('group_name').order('list_number').range(from, from + 499);
    if (error) throw new Error('No se pudieron cargar los estudiantes.');
    rows.push(...data);
    if (data.length < 500) break;
  }
  students = rows;
  const { data: groups, error: groupError } = await db.from('school_groups').select('*').order('academic_year').order('name');
  if (groupError) throw new Error('Falta ejecutar supabase/group-management.sql en Supabase.');
  schoolGroups = groups;
  history = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from('student_group_history').select('*').order('academic_year', { ascending: false }).range(from, from + 499);
    if (error) throw new Error('Falta ejecutar supabase/annual-management.sql en Supabase.');
    history.push(...data);
    if (data.length < 500) break;
  }
  if (selected && !students.some(student => String(student.id) === String(selected))) selected = null;
  if (activeGroup && !students.some(student => student.is_active !== false && groupKey(student) === activeGroup)) activeGroup = null;
  render();
}

function render() {
  students.sort((a, b) => a.group_name.localeCompare(b.group_name, 'es') || a.list_number - b.list_number || a.full_name.localeCompare(b.full_name, 'es'));
  const active = students.filter(student => student.is_active !== false);
  const labels = ['Sin confirmar', 'No tiene', 'Vigente', 'Próximo a vencer', 'Vencido', 'Revisar'];
  const counts = Object.fromEntries(labels.map(label => [label, active.filter(student => status(student) === label).length]));
  const groups = [...new Set(active.map(groupKey))];
  const groupsView = `<section class="card workspace"><div class="section-head"><h2>Grupos <span class="count">${groups.length}</span></h2><p class="muted">Elige un grupo para ver sus estudiantes.</p></div><div class="groups">${groups.map(key => { const [year, group] = JSON.parse(key); const members = active.filter(student => groupKey(student) === key); const attention = members.filter(student => status(student) !== 'Vigente').length; const overdue = members.filter(student => status(student) === 'Vencido').length; return `<button class="group-card ${overdue ? 'has-overdue' : attention ? 'has-attention' : 'all-current'}" data-group="${escape(key)}"><span class="group-icon">${escape(group.match(/\d+/)?.[0] || 'G')}</span><span><strong>${escape(group)}</strong><small>${year} · ${members.length} estudiantes</small><em>${overdue ? `${overdue} vencidos` : attention ? `${attention} requieren atención` : 'Todos al día'}</em></span><span class="arrow">›</span></button>`; }).join('')}</div></section>`;
  const [activeYear, activeName] = activeGroup ? JSON.parse(activeGroup) : ['', ''];
  const studentsView = `<section class="card workspace"><div class="section-head group-heading"><div><button id="back-groups" class="back">‹ Todos los grupos</button><h2>${escape(activeName)} · ${activeYear} <span class="count">${active.filter(student => groupKey(student) === activeGroup).length}</span></h2><p class="muted">Selecciona un estudiante para consultar o actualizar su carné.</p></div></div><div class="toolbar"><label class="search">Buscar<input id="search" type="search" placeholder="Nombre o cédula…" value="${escape(search)}"></label><label>Estado<select id="filter"><option value="">Todos</option>${labels.map(label => `<option ${filter === label ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button id="refresh" class="secondary">Actualizar</button></div><div class="columns"><div id="students"></div><div id="detail"></div></div></section>`;
  const managementView = `<section class="card workspace"><div class="section-head"><h2>Alta, baja y modificación</h2><p class="muted">La baja deja al estudiante inactivo y conserva su historial y carné.</p></div><div class="toolbar"><label class="search">Buscar por nombre o cédula<input id="manage-search" type="search" placeholder="Buscar estudiante…"></label></div><div class="management-list">${[...students].sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || a.full_name.localeCompare(b.full_name, 'es')).map(student => { const past = history.filter(item => String(item.student_id) === String(student.id)).sort((a, b) => b.academic_year - a.academic_year).map(item => `${item.academic_year}: ${escape(item.group_name)}`).join(' · '); return `<div class="management-row" data-search="${escape(`${student.full_name} ${student.document_number}`.toLocaleLowerCase('es'))}"><div><strong>${escape(student.full_name)}</strong> ${student.is_active === false ? '<span class="badge gray">Inactivo</span>' : '<span class="badge green">Activo</span>'}<small>${escape(student.document_number)} · ${student.academic_year} · ${escape(student.group_name)} · Lista ${student.list_number}</small><small>Historial: ${past || 'Sin datos'}</small></div><div class="actions"><button class="secondary" data-edit-id="${student.id}">Editar</button><button class="secondary" data-toggle-id="${student.id}">${student.is_active === false ? 'Reactivar' : 'Dar de baja'}</button></div></div>`; }).join('')}</div></section>`;
  const years = [...new Set(active.map(student => student.academic_year))].sort((a, b) => a - b);
  if (!years.includes(promotionYear)) promotionYear = years[0] || new Date().getFullYear();
  const groupYears = [...new Set([...schoolGroups.map(group => group.academic_year), new Date().getFullYear(), (promotionYear || new Date().getFullYear()) + 1])].sort((a, b) => a - b);
  if (!groupYears.includes(groupYear)) groupYear = Math.max(new Date().getFullYear(), ...active.map(student => student.academic_year));
  const groupEditorView = `<section class="card workspace"><div class="section-head"><h2>Administrar grupos</h2><p class="muted">Crea grupos para que aparezcan en el selector de estudiantes. Un cambio de nombre se aplica a las fichas y al historial de ese año.</p><div class="group-tools"><label>Año lectivo<select id="group-year">${groupYears.map(year => `<option ${year === groupYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label><button id="new-group">+ Crear grupo</button></div></div><div class="management-list">${schoolGroups.filter(group => group.academic_year === groupYear).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(group => `<div class="management-row"><div><strong>${escape(group.name)}</strong><small>${group.academic_year} · ${students.filter(student => student.academic_year === group.academic_year && student.group_name === group.name && student.is_active !== false).length} estudiantes activos</small></div><button class="secondary" data-edit-group="${group.id}">Cambiar nombre</button></div>`).join('') || '<p class="empty">Todavía no hay grupos para este año.</p>'}</div></section>`;
  const sourceGroups = [...new Set(active.filter(student => student.academic_year === promotionYear).map(student => student.group_name))];
  const targetGroups = schoolGroups.filter(group => group.academic_year === promotionYear + 1).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const promotionView = `<section class="card workspace"><div class="section-head"><h2>Pase de año</h2><p class="muted">Elegí un grupo destino existente. Desmarca a quienes no pasan; quedarán en el año de origen para resolverlos por separado.</p><label>Año de origen<select id="promotion-year">${years.map(year => `<option ${year === promotionYear ? 'selected' : ''}>${year}</option>`).join('')}</select></label>${targetGroups.length ? '' : '<p>Primero creá los grupos del año siguiente en “Administrar grupos”.</p>'}</div><div class="promotion-groups">${sourceGroups.map(group => { const members = active.filter(student => student.academic_year === promotionYear && student.group_name === group); return `<form class="promotion-card" data-source-group="${escape(group)}"><h3>${escape(group)} <span class="count">${members.length}</span></h3><p>Pase de ${promotionYear} a ${promotionYear + 1}</p><div class="promotion-fields"><label>Grupo destino<select name="target_group" required><option value="">Seleccionar grupo</option>${targetGroups.map(target => `<option value="${escape(target.name)}">${escape(target.name)}</option>`).join('')}</select></label><label>Código destino (opcional)<input name="target_code" maxlength="30"></label></div><div class="promotion-members">${members.map(student => `<label class="check"><input type="checkbox" name="move" value="${student.id}" checked>${escape(student.full_name)}</label>`).join('')}</div><button>Avanzar estudiantes seleccionados</button></form>`; }).join('') || '<p class="empty">No hay estudiantes activos en este año.</p>'}</div></section>`;
  const navigation = `<nav class="section-nav" aria-label="Secciones"><button data-view="groups" class="${view === 'groups' ? 'current' : 'secondary'}">Grupos</button><button data-view="management" class="${view === 'management' ? 'current' : 'secondary'}">Estudiantes</button><button data-view="groupEditor" class="${view === 'groupEditor' ? 'current' : 'secondary'}">Administrar grupos</button><button data-view="promotion" class="${view === 'promotion' ? 'current' : 'secondary'}">Pase de año</button></nav>`;
  root.innerHTML = `${header()}<main><div class="heading"><div><div class="eyebrow">SECRETARÍA / ESTUDIANTES</div><h1>Carné del adolescente</h1><p>Estado y vencimiento de los ${active.length} estudiantes activos.</p></div><button id="new-student">+ Estudiante</button></div>${demo ? '<div class="notice">Los cambios de esta demostración se pierden al salir o recargar. No ingreses datos reales.</div>' : ''}${navigation}<div class="stats">${Object.entries(counts).filter(([, count]) => count || active.length === 0).map(([label, count]) => `<div class="card ${tone(label)}"><span>${label}</span><strong>${count}</strong><small>estudiantes</small></div>`).join('')}</div>${view === 'management' ? managementView : view === 'groupEditor' ? groupEditorView : view === 'promotion' ? promotionView : activeGroup ? studentsView : groupsView}<p id="message" class="message" role="status" aria-live="polite"></p><footer>Próximo a vencer: el carné vence durante los siguientes 30 días. La fecha registrada representa mes y año.</footer></main><dialog id="modal"></dialog>`;
  document.querySelector('#logout').onclick = event => action(event.target, async () => {
    if (!demo) { const { error } = await db.auth.signOut(); if (error) throw error; }
    demo = false; session = null; students = []; history = []; schoolGroups = []; selected = null; activeGroup = null; view = 'groups'; search = ''; filter = ''; login();
  });
  document.querySelector('#new-student').onclick = () => studentModal();
  document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => { if (view === 'promotion' && button.dataset.view === 'groupEditor') groupYear = promotionYear + 1; view = button.dataset.view; activeGroup = null; selected = null; render(); });
  if (view === 'management') {
    document.querySelector('#manage-search').oninput = event => document.querySelectorAll('[data-search]').forEach(row => { row.hidden = !row.dataset.search.includes(event.target.value.toLocaleLowerCase('es')); });
    document.querySelectorAll('[data-edit-id]').forEach(button => button.onclick = () => studentModal(students.find(student => String(student.id) === button.dataset.editId)));
    document.querySelectorAll('[data-toggle-id]').forEach(button => button.onclick = () => toggleStudent(students.find(student => String(student.id) === button.dataset.toggleId), button));
    return;
  }
  if (view === 'groupEditor') {
    document.querySelector('#group-year').onchange = event => { groupYear = Number(event.target.value); render(); };
    document.querySelector('#new-group').onclick = () => groupModal();
    document.querySelectorAll('[data-edit-group]').forEach(button => button.onclick = () => groupModal(schoolGroups.find(group => String(group.id) === button.dataset.editGroup)));
    return;
  }
  if (view === 'promotion') {
    document.querySelector('#promotion-year').onchange = event => { promotionYear = Number(event.target.value); render(); };
    document.querySelectorAll('[data-source-group]').forEach(form => form.onsubmit = event => promoteGroup(event, form));
    return;
  }
  document.querySelectorAll('[data-group]').forEach(element => element.onclick = () => { activeGroup = element.dataset.group; selected = null; search = ''; filter = ''; render(); });
  if (!activeGroup) return;
  document.querySelector('#back-groups').onclick = () => { activeGroup = null; selected = null; search = ''; filter = ''; render(); };
  document.querySelector('#search').oninput = event => { search = event.target.value; list(); };
  document.querySelector('#filter').onchange = event => { filter = event.target.value; list(); };
  document.querySelector('#refresh').onclick = event => action(event.target, async () => { if (!demo) await load(); else render(); message('Información actualizada.'); });
  list(); detail();
}

function list() {
  const term = search.toLocaleLowerCase('es');
  const visible = students.filter(student => student.is_active !== false && groupKey(student) === activeGroup && `${student.full_name} ${student.document_number}`.toLocaleLowerCase('es').includes(term) && (!filter || status(student) === filter));
  document.querySelector('#students').innerHTML = visible.length ? visible.map(student => { const state = status(student); return `<button class="student ${tone(state)} ${String(selected) === String(student.id) ? 'active' : ''}" data-id="${student.id}" aria-pressed="${String(selected) === String(student.id)}"><span class="avatar">${escape(student.full_name.charAt(0))}</span><span><strong>${escape(student.full_name)}</strong><small>${escape(student.group_name)} · Lista ${student.list_number}</small>${badge(state)}</span><span class="arrow">›</span></button>`; }).join('') : '<div class="empty">No hay estudiantes que coincidan.</div>';
  document.querySelectorAll('[data-id]').forEach(element => element.onclick = () => { selected = element.dataset.id; list(); detail(); });
}

function detail() {
  const student = students.find(item => String(item.id) === String(selected));
  const element = document.querySelector('#detail');
  if (!student) { element.innerHTML = '<div class="empty"><div class="empty-icon">▤</div><h2>Selecciona un estudiante</h2><p>Aquí podrás consultar y actualizar su carné.</p></div>'; return; }
  const expiryMonth = student.card_expiry_month?.slice(5, 7) || '', expiryYear = student.card_expiry_month?.slice(0, 4) || '';
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const currentYear = new Date().getFullYear(), years = Array.from({ length: 16 }, (_, index) => currentYear - 5 + index);
  if (expiryYear && !years.includes(Number(expiryYear))) years.push(Number(expiryYear));
  element.innerHTML = `<div class="detail-head"><div><div class="eyebrow">FICHA DEL ESTUDIANTE</div><h2>${escape(student.full_name)}</h2><p>${escape(student.group_name)} · Lista ${student.list_number}</p></div><button id="edit-student" class="secondary">Editar datos</button></div><div class="info"><span><small>Cédula</small>${escape(student.document_number)}</span><span><small>Nacimiento</small>${escape(student.birth_date?.split('-').reverse().join('/') || 'Sin dato')}</span><span><small>Código de grupo</small>${escape(student.group_code || 'Sin dato')}</span></div><form id="card" class="document ${tone(status(student))}"><div class="doc-title"><h3>Carné del adolescente</h3>${badge(status(student))}</div><div class="doc-fields"><label>Situación<select name="card_status"><option value="unknown" ${student.card_status === 'unknown' ? 'selected' : ''}>Sin confirmar</option><option value="no_card" ${student.card_status === 'no_card' ? 'selected' : ''}>No tiene</option><option value="has_card" ${student.card_status === 'has_card' ? 'selected' : ''}>Tiene carné</option></select></label><div class="expiry-fields"><label>Mes<select name="expiry_month"><option value="">Seleccionar</option>${months.map((month, index) => { const value = String(index + 1).padStart(2, '0'); return `<option value="${value}" ${expiryMonth === value ? 'selected' : ''}>${month}</option>`; }).join('')}</select></label><label>Año<select name="expiry_year"><option value="">Seleccionar</option>${years.map(year => `<option ${expiryYear === String(year) ? 'selected' : ''}>${year}</option>`).join('')}</select></label></div><button>Guardar</button></div><label>Observaciones<textarea name="notes" rows="3" maxlength="500">${escape(student.notes || '')}</textarea></label><label class="check"><input name="review_required" type="checkbox" ${student.review_required ? 'checked' : ''}>Requiere revisión contra la documentación original</label><p class="muted">Vencimiento registrado: ${expiryLabel(student.card_expiry_month)}</p></form>`;
  document.querySelector('#edit-student').onclick = () => studentModal(student);
  const form = document.querySelector('#card');
  const syncExpiry = () => { const enabled = form.elements.card_status.value === 'has_card'; ['expiry_month', 'expiry_year'].forEach(name => { form.elements[name].disabled = !enabled; form.elements[name].required = enabled; if (!enabled) form.elements[name].value = ''; }); };
  form.elements.card_status.onchange = syncExpiry; syncExpiry();
  form.onsubmit = event => {
    event.preventDefault();
    const hasCard = form.elements.card_status.value === 'has_card', expiry = `${form.elements.expiry_year.value}-${form.elements.expiry_month.value}`;
    if (hasCard && !/^\d{4}-(0[1-9]|1[0-2])$/.test(expiry)) { message('Selecciona el mes y el año de vencimiento.', true); return; }
    const row = { card_status: form.elements.card_status.value, card_expiry_month: hasCard ? `${expiry}-01` : null, review_required: form.elements.review_required.checked, notes: form.elements.notes.value.trim() || null };
    action(event.submitter, async () => {
      if (!demo) { const { error } = await db.from('students').update(row).eq('id', student.id); if (error) throw new Error('No se pudo guardar el carné.'); }
      Object.assign(student, row); render(); message(`Carné de ${student.full_name} actualizado${demo ? ' en la demostración' : ''}.`);
    });
  };
}

function toggleStudent(student, button) {
  const activating = student.is_active === false;
  if (!activating && !confirm(`¿Dar de baja a ${student.full_name}? Su historial y su carné se conservarán.`)) return;
  action(button, async () => {
    if (!demo) {
      const { error } = await db.from('students').update({ is_active: activating }).eq('id', student.id);
      if (error) throw new Error(activating ? 'No se pudo reactivar. Revisa si su número de lista ya está ocupado.' : 'No se pudo dar de baja.');
    }
    student.is_active = activating; render(); message(`${student.full_name}: ${activating ? 'activo' : 'inactivo'}.`);
  });
}

function promoteGroup(event, form) {
  event.preventDefault();
  const members = students.filter(student => student.is_active !== false && student.academic_year === promotionYear && student.group_name === form.dataset.sourceGroup);
  const selectedIds = [...form.querySelectorAll('input[name="move"]:checked')].map(input => input.value);
  if (!selectedIds.length) { message('Selecciona al menos un estudiante para avanzar.', true); return; }
  const target = form.elements.target_group.value.trim(), code = form.elements.target_code.value.trim();
  if (!target) { form.elements.target_group.reportValidity(); return; }
  if (!schoolGroups.some(group => group.academic_year === promotionYear + 1 && group.name === target)) { message('Primero crea el grupo destino en Administrar grupos.', true); return; }
  if (!confirm(`¿Avanzar ${selectedIds.length} estudiantes de ${form.dataset.sourceGroup} (${promotionYear}) a ${target} (${promotionYear + 1})? ${members.length - selectedIds.length} quedarán en el año de origen.`)) return;
  action(event.submitter, async () => {
    if (!demo) {
      const excluded = members.filter(student => !selectedIds.includes(String(student.id))).map(student => student.id);
      const { error } = await db.rpc('advance_student_group', { source_year: promotionYear, source_group: form.dataset.sourceGroup, target_group: target, target_code: code || null, excluded_ids: excluded });
      if (error) throw new Error('No se pudo completar el pase. Revisa el grupo destino y vuelve a intentarlo.');
      await load();
    } else {
      let next = Math.max(0, ...students.filter(student => student.is_active !== false && student.academic_year === promotionYear + 1 && student.group_name === target).map(student => student.list_number));
      members.filter(student => selectedIds.includes(String(student.id))).forEach(student => { student.academic_year++; student.group_name = target; student.group_code = code || null; student.list_number = ++next; rememberGroup(student); });
      render();
    }
    message(`${selectedIds.length} estudiantes avanzaron a ${target}.`);
  });
}

function modal(title, fields, save) {
  const dialog = document.querySelector('#modal');
  dialog.innerHTML = `<form><h2>${title}</h2>${fields}<p class="modal-error" role="alert"></p><div class="actions"><button type="button" class="secondary" id="cancel">Cancelar</button><button>Guardar</button></div></form>`;
  dialog.querySelector('#cancel').onclick = () => dialog.close();
  dialog.querySelector('form').onsubmit = async event => {
    event.preventDefault(); event.submitter.disabled = true;
    try { await save(new FormData(event.target)); dialog.close(); render(); message('Datos guardados.'); }
    catch (error) { dialog.querySelector('.modal-error').textContent = error.message || 'No se pudo guardar.'; }
    finally { event.submitter.disabled = false; }
  };
  dialog.showModal();
}

function groupModal(group) {
  const fields = `${group ? `<p>Año lectivo: ${group.academic_year}</p>` : `<label>Año lectivo<input name="academic_year" type="number" min="2000" max="2100" required value="${groupYear}"></label>`}<label>Nombre del grupo<input name="name" required maxlength="80" value="${escape(group?.name || '')}" placeholder="Ej.: 8.º G. 1"></label>`;
  modal(group ? 'Cambiar nombre del grupo' : 'Crear grupo', fields, async form => {
    const academic_year = group?.academic_year || Number(form.get('academic_year'));
    const name = form.get('name').trim();
    if (!name || !Number.isInteger(academic_year) || academic_year < 2000 || academic_year > 2100) throw new Error('Indica un nombre y año válidos.');
    if (schoolGroups.some(item => item.academic_year === academic_year && item.name === name && String(item.id) !== String(group?.id))) throw new Error('Ese grupo ya existe en el año seleccionado.');
    let row = { id: group?.id || crypto.randomUUID(), academic_year, name };
    if (!demo) {
      const query = group ? db.from('school_groups').update({ name }).eq('id', group.id) : db.from('school_groups').insert({ academic_year, name });
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.code === '23505' ? 'Ese grupo ya existe.' : 'No se pudo guardar el grupo.');
      row = data;
    }
    if (group && group.name !== name) {
      students.filter(student => student.academic_year === academic_year && student.group_name === group.name).forEach(student => { student.group_name = name; });
      history.filter(item => item.academic_year === academic_year && item.group_name === group.name).forEach(item => { item.group_name = name; });
    }
    schoolGroups = schoolGroups.filter(item => String(item.id) !== String(row.id)); schoolGroups.push(row); groupYear = academic_year;
  });
}

function studentModal(student) {
  const defaultYear = Math.max(new Date().getFullYear(), ...students.filter(item => item.is_active !== false).map(item => item.academic_year));
  const groupOptions = (year, selectedName = '') => `<option value="">Seleccionar grupo</option>${schoolGroups.filter(group => group.academic_year === Number(year)).sort((a, b) => a.name.localeCompare(b.name, 'es')).map(group => `<option value="${escape(group.name)}" ${group.name === selectedName ? 'selected' : ''}>${escape(group.name)}</option>`).join('')}`;
  modal(student ? 'Editar estudiante' : 'Nuevo estudiante', `<label>Nombre completo<input name="full_name" required maxlength="150" value="${escape(student?.full_name || '')}"></label><label>Cédula<input name="document_number" inputmode="numeric" pattern="[0-9]{8}" required value="${escape(student?.document_number || '')}"></label><label>Fecha de nacimiento<input name="birth_date" type="date" required value="${escape(student?.birth_date || '')}"></label><label>Año lectivo<input name="academic_year" type="number" min="2000" max="2100" required value="${student?.academic_year || defaultYear}"></label><label>Grupo<select name="group_name" required>${groupOptions(student?.academic_year || defaultYear, student?.group_name)}</select></label><label>Código de grupo<input name="group_code" maxlength="30" value="${escape(student?.group_code || '')}"></label><label>N.º de lista<input name="list_number" type="number" min="1" max="999" required value="${escape(student?.list_number || '')}"></label>`, async form => {
    let row = { school_code: student?.school_code || '1118', academic_year: Number(form.get('academic_year')), full_name: form.get('full_name').trim(), document_number: form.get('document_number').trim(), birth_date: form.get('birth_date'), group_name: form.get('group_name').trim(), group_code: form.get('group_code').trim() || null, list_number: Number(form.get('list_number')) };
    if (!/^\d{8}$/.test(row.document_number)) throw new Error('La cédula debe tener 8 dígitos.');
    if (!schoolGroups.some(group => group.academic_year === row.academic_year && group.name === row.group_name)) throw new Error('Selecciona un grupo del año lectivo indicado.');
    if (!demo) {
      const query = student ? db.from('students').update(row).eq('id', student.id) : db.from('students').insert({ ...row, card_status: 'unknown' });
      const { data, error } = await query.select().single();
      if (error) throw new Error(error.code === '23505' ? 'La cédula o el número de lista ya están registrados.' : 'No se pudo guardar el estudiante.');
      row = data;
    } else row = { ...student, ...row, id: student?.id || crypto.randomUUID(), card_status: student?.card_status || 'unknown', card_expiry_month: student?.card_expiry_month || null, review_required: student?.review_required || false, notes: student?.notes || null };
    students = students.filter(item => String(item.id) !== String(row.id)); students.push(row); rememberGroup(row);
    if (view === 'groups') { selected = row.id; activeGroup = groupKey(row); }
  });
  const dialog = document.querySelector('#modal');
  const yearInput = dialog.querySelector('[name="academic_year"]'), groupInput = dialog.querySelector('[name="group_name"]');
  yearInput.onchange = () => { groupInput.innerHTML = groupOptions(yearInput.value); dialog.querySelector('[name="group_code"]').value = ''; };
  groupInput.onchange = () => { dialog.querySelector('[name="group_code"]').value = students.find(item => item.academic_year === Number(yearInput.value) && item.group_name === groupInput.value)?.group_code || ''; };
}

login();
if (db) {
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    session = data.session;
    if (session) await load();
  } catch (error) { message(error.message || 'No se pudo iniciar la aplicación.', true); }
  db.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' && !demo) { session = null; students = []; history = []; schoolGroups = []; selected = null; activeGroup = null; view = 'groups'; login(); }
  });
}
