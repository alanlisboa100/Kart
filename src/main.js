// KARTOPIA - entry point. Wires menus, selection and HUD to the Game.
import { Game } from './game.js';
import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { CHARACTERS, KARTS, TRACKS } from './data.js';

window.__kartopiaBooted = true; // tell the fallback timer we made it

const $ = (sel) => document.querySelector(sel);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const ITEM_EMOJI = { banana: '🍌', shell: '🐢', boost: '🍄', lightning: '⚡' };

const canvas = $('#game');
const input = new Input();
const audio = new AudioManager();

// ---- HUD bridge ----
const driftMeter = $('#drift-meter');
const hud = {
  setLap: (l, t) => ($('#hud-lap').textContent = `${l}/${t}`),
  setPos: (p, t) => ($('#hud-pos').textContent = `${p}/${t}`),
  setSpeed: (s) => ($('#hud-speed').textContent = s),
  setTime: (sec) => ($('#hud-time').textContent = fmtTime(sec)),
  setDrift: (tier) => {
    driftMeter.className = 'drift-meter' + (tier ? ' t' + tier : '');
  },
  setItem: (name) => {
    const el = $('#hud-item');
    if (!name) { el.textContent = ''; el.className = 'hud-item empty'; return; }
    if (name === 'roll') { el.textContent = '❓'; el.className = 'hud-item rolling'; return; }
    el.textContent = ITEM_EMOJI[name] || '❓';
    el.className = 'hud-item';
  },
  setCountdown: (n) => {
    const el = $('#countdown');
    const num = $('#countdown-num');
    if (n === null) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    num.textContent = n <= 0 ? 'JÁ!' : n;
    num.style.animation = 'none'; void num.offsetWidth; num.style.animation = '';
  },
  onFinish: (standings) => showResults(standings),
};

const game = new Game(canvas, hud, audio);
input.bindButtons($('#touch'));

// ---- Selection state ----
const sel = { char: CHARACTERS[0], kart: KARTS[0], track: TRACKS[0] };

// ---- Screen helpers ----
function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  if (screenId) $('#' + screenId).classList.add('active');
}
function setRaceUI(on) {
  $('#hud').classList.toggle('hidden', !on);
  $('#touch').classList.toggle('hidden', !on);
  $('#btn-mute').classList.toggle('hidden', !on);
}

// ---- Build selection cards ----
function buildCharCards() {
  const grid = $('#char-grid');
  grid.innerHTML = '';
  CHARACTERS.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'card' + (c.id === sel.char.id ? ' selected' : '');
    card.innerHTML = `
      <div class="swatch" style="background:linear-gradient(160deg,#2a2750,#15132e)">
        <div class="head" style="background:${hex(c.skin)}"></div>
        <div class="body" style="background:${hex(c.shirt)}"></div>
      </div>
      <div class="name">${c.name}</div>
      <div class="stats">⚡${c.speed} 🚀${c.accel} 🎯${c.handling}</div>`;
    card.onclick = () => { sel.char = c; refreshSelected('char-grid', CHARACTERS, c.id); };
    grid.appendChild(card);
  });
}
function buildKartCards() {
  const grid = $('#kart-grid');
  grid.innerHTML = '';
  KARTS.forEach((k) => {
    const card = document.createElement('div');
    card.className = 'card' + (k.id === sel.kart.id ? ' selected' : '');
    card.innerHTML = `
      <div class="kart-swatch" style="background:linear-gradient(160deg,${hex(k.color)},${hex(k.accent)})"></div>
      <div class="name">${k.name}</div>
      <div class="stats">⚡${fmtMod(k.dSpeed)} 🚀${fmtMod(k.dAccel)} 🎯${fmtMod(k.dHandling)}</div>`;
    card.onclick = () => { sel.kart = k; refreshSelected('kart-grid', KARTS, k.id); };
    grid.appendChild(card);
  });
}
function buildTrackList() {
  const list = $('#track-list');
  list.innerHTML = '';
  TRACKS.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'track-row' + (t.id === sel.track.id ? ' selected' : '');
    row.innerHTML = `
      <div class="track-color" style="background:${hex(t.theme.ground)}"></div>
      <div class="track-meta">
        <div class="tname">${t.name}</div>
        <div class="tdiff">Dificuldade: ${'★'.repeat(t.difficulty)}${'☆'.repeat(5 - t.difficulty)} • ${t.laps} voltas</div>
      </div>`;
    row.onclick = () => {
      sel.track = t;
      list.querySelectorAll('.track-row').forEach((r) => r.classList.remove('selected'));
      row.classList.add('selected');
    };
    list.appendChild(row);
  });
}
function refreshSelected(gridId, arr, id) {
  const cards = $('#' + gridId).children;
  [...cards].forEach((card, i) => card.classList.toggle('selected', arr[i].id === id));
}
const fmtMod = (n) => (n > 0 ? '+' + n : n === 0 ? '0' : '' + n);

// ---- Results ----
function showResults(standings) {
  setRaceUI(false);
  const me = standings.find((s) => s.isPlayer);
  $('#results-title').textContent = me ? podiumText(me.place) : 'Resultado';
  const ol = $('#results-list');
  ol.innerHTML = '';
  standings.forEach((s) => {
    const li = document.createElement('li');
    if (s.isPlayer) li.classList.add('me');
    const medal = s.place === 1 ? '🥇' : s.place === 2 ? '🥈' : s.place === 3 ? '🥉' : s.place;
    li.innerHTML = `<span class="pl">${medal}</span>
      <span>${s.name} <small style="opacity:.6">• ${s.kart}</small></span>
      <span class="rt">${s.time != null ? fmtTime(s.time) : 'DNF'}</span>`;
    ol.appendChild(li);
  });
  show('screen-results');
}
function podiumText(place) {
  if (place === 1) return '🏆 Você venceu!';
  if (place <= 3) return `Pódio! ${place}º lugar 🎉`;
  return `${place}º lugar — bora de novo!`;
}

// ---- Flow ----
function startRace() {
  audio.init();
  show(null);
  setRaceUI(true);
  input.reset();
  hud.setItem(null);
  game.start({
    trackDef: sel.track,
    playerChar: sel.char,
    playerKart: sel.kart,
    opponents: 5,
    input,
  });
}

$('#btn-play').onclick = () => { audio.init(); buildCharCards(); buildKartCards(); buildTrackList(); show('screen-select'); };
$('#btn-back').onclick = () => show('screen-title');
$('#btn-race').onclick = startRace;
$('#btn-again').onclick = startRace;
$('#btn-menu').onclick = () => { game.cleanup(); show('screen-title'); };
$('#btn-mute').onclick = () => {
  const muted = audio.toggleMute();
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
};

// helpers
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// kick off
show('screen-title');
game.resize();
