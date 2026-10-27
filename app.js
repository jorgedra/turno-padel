'use strict';

const STORAGE_KEY = 'turno-padel:v1';
const DEFAULT_PLAYERS = ['Jorge', 'Samuel', 'César', 'Javi'];
const HISTORY_LIMIT = 10;
const UNDO_MS = 6000;

const $ = (id) => document.getElementById(id);
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const fmtDate = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

// ---- Estado y persistencia ----
// players: [{ id, name }]  (el orden del array es el orden de pago)
// payments: [{ id, playerId, name, date }]  (cronológico; name es copia por si se borra el jugador)

function isValidState(data) {
  return data && Array.isArray(data.players) && Array.isArray(data.payments)
    && data.players.every((p) => p.id && typeof p.name === 'string')
    && data.payments.every((p) => p.id && p.playerId && p.date);
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (isValidState(data)) return data;
  } catch { /* datos corruptos: empezamos de cero */ }
  return { players: DEFAULT_PLAYERS.map((name) => ({ id: uid(), name })), payments: [] };
}

let state = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

// ---- Lógica de turno ----
// Le toca al siguiente en la lista tras el último que pagó.
// Sin pagos, o si el último pagador ya no está en la lista, empieza el primero.
function nextPlayer() {
  const { players, payments } = state;
  if (!players.length) return null;
  const last = payments[payments.length - 1];
  const idx = last ? players.findIndex((p) => p.id === last.playerId) : -1;
  return players[(idx + 1) % players.length];
}

function playerName(payment) {
  return state.players.find((p) => p.id === payment.playerId)?.name ?? payment.name;
}

function addPayment(player) {
  const payment = { id: uid(), playerId: player.id, name: player.name, date: new Date().toISOString() };
  state.payments.push(payment);
  save();
  showUndo(`Pago de ${player.name} registrado`, payment.id);
}

function removePayment(id) {
  state.payments = state.payments.filter((p) => p.id !== id);
  save();
}

// ---- Render ----
function render() {
  const next = nextPlayer();
  $('next-name').textContent = next?.name ?? 'Añade jugadores';
  $('btn-pay').textContent = next ? `Registrar pago de ${next.name}` : 'Registrar pago';
  $('btn-pay').disabled = !next;
  $('btn-other').hidden = state.players.length < 2;

  const recent = state.payments.slice(-HISTORY_LIMIT).reverse();
  $('history-empty').hidden = recent.length > 0;
  $('history').replaceChildren(...recent.map((p) => {
    const li = document.createElement('li');
    li.innerHTML = '<span aria-hidden="true">🎾</span><span class="who"></span><span class="when"></span>'
      + '<button class="del" aria-label="Borrar pago">✕</button>';
    li.querySelector('.who').textContent = playerName(p);
    li.querySelector('.when').textContent = fmtDate.format(new Date(p.date));
    li.querySelector('.del').dataset.id = p.id;
    return li;
  }));

  renderPlayerList();
}

function renderPlayerList() {
  const { players } = state;
  $('player-list').replaceChildren(...players.map((p, i) => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.innerHTML = `<span class="pos">${i + 1}</span><input aria-label="Nombre" maxlength="30">`
      + `<button class="del" data-action="up" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>`
      + `<button class="del" data-action="down" aria-label="Bajar" ${i === players.length - 1 ? 'disabled' : ''}>↓</button>`
      + '<button class="del" data-action="remove" aria-label="Quitar">✕</button>';
    li.querySelector('input').value = p.name;
    return li;
  }));
}

// ---- Deshacer ----
let undoTimer;
let undoId;

function showUndo(msg, paymentId) {
  undoId = paymentId;
  $('toast-msg').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, UNDO_MS);
}

function hideUndo() {
  $('toast').hidden = true;
  undoId = null;
}

// ---- Eventos ----
$('btn-pay').addEventListener('click', () => {
  const next = nextPlayer();
  if (next) addPayment(next);
});

$('toast-undo').addEventListener('click', () => {
  if (undoId) removePayment(undoId);
  hideUndo();
});

$('history').addEventListener('click', (e) => {
  const id = e.target.closest('.del')?.dataset.id;
  const payment = state.payments.find((p) => p.id === id);
  if (!payment) return;
  if (confirm(`¿Borrar el pago de ${playerName(payment)} del ${fmtDate.format(new Date(payment.date))}?`)) {
    removePayment(id);
  }
});

$('btn-other').addEventListener('click', () => {
  $('other-list').replaceChildren(...state.players.map((p) => {
    const btn = document.createElement('button');
    btn.className = 'btn-secondary';
    btn.textContent = p.name;
    btn.addEventListener('click', () => {
      $('dlg-other').close();
      addPayment(p);
    });
    return btn;
  }));
  $('dlg-other').showModal();
});

$('btn-manage').addEventListener('click', () => $('dlg-manage').showModal());

document.querySelectorAll('[data-close]').forEach((btn) =>
  btn.addEventListener('click', () => btn.closest('dialog').close()));

$('player-list').addEventListener('click', (e) => {
  const action = e.target.closest('button')?.dataset.action;
  const id = e.target.closest('li')?.dataset.id;
  if (!action || !id) return;
  const { players } = state;
  const i = players.findIndex((p) => p.id === id);

  if (action === 'up' || action === 'down') {
    const j = action === 'up' ? i - 1 : i + 1;
    [players[i], players[j]] = [players[j], players[i]];
    save();
  } else if (action === 'remove' && confirm(`¿Quitar a ${players[i].name}? Su historial se mantiene.`)) {
    players.splice(i, 1);
    save();
  }
});

$('player-list').addEventListener('change', (e) => {
  const id = e.target.closest('li')?.dataset.id;
  const player = state.players.find((p) => p.id === id);
  const name = e.target.value.trim();
  if (!player) return;
  if (name) player.name = name;
  save();
});

$('form-add').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('new-name').value.trim();
  if (!name) return;
  state.players.push({ id: uid(), name });
  $('new-name').value = '';
  save();
});

$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `turno-padel-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!isValidState(data)) throw new Error('formato');
    if (confirm('Esto reemplazará los datos actuales. ¿Continuar?')) {
      state = data;
      save();
    }
  } catch {
    alert('El archivo no es una copia válida de Turno Pádel.');
  }
});

// ---- Arranque ----
render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}
// Pide al navegador que no borre los datos locales por falta de espacio.
navigator.storage?.persist?.();
