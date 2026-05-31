// KARTOPIA - entry point. Wires menus, selection, shop, championship & HUD.
import { Game } from './game.js';
import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { Progress, raceCoinReward, trophyForPlace } from './progress.js';
import {
  CHARACTERS, KARTS, TRACKS, CUPS, GP_POINTS,
  getCharacter, getKart, getCup, getCupTracks,
} from './data.js';

window.__kartopiaBooted = true;

const $ = (sel) => document.querySelector(sel);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const ITEM_EMOJI = { banana: '🍌', shell: '🐢', boost: '🍄', lightning: '⚡' };

const canvas = $('#game');
const input = new Input();
const audio = new AudioManager();
const progress = new Progress();

// ---- HUD bridge ----
const driftMeter = $('#drift-meter');
const hud = {
  setLap: (l, t) => ($('#hud-lap').textContent = `${l}/${t}`),
  setPos: (p, t) => ($('#hud-pos').textContent = `${p}/${t}`),
  setSpeed: (s) => ($('#hud-speed').textContent = s),
  setTime: (sec) => ($('#hud-time').textContent = fmtTime(sec)),
  setDrift: (tier) => { driftMeter.className = 'drift-meter' + (tier ? ' t' + tier : ''); },
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
  onFinish: (standings) => onRaceFinish(standings),
};

const game = new Game(canvas, hud, audio);
input.bindButtons($('#touch'));
input.bindJoystick($('#joy-zone'), $('#joystick'), $('#joy-knob'));

// ---- Mode/selection state ----
const sel = { char: CHARACTERS[0], kart: KARTS[0], track: TRACKS[0] };
// session: describes what we're playing now
let session = null; // { mode: 'quick'|'gp', cup?, raceIndex?, roster?, points?{} }

// ---- Screen helpers ----
function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  if (screenId) $('#' + screenId).classList.add('active');
  updateCoinBadges();
}
function setRaceUI(on) {
  $('#hud').classList.toggle('hidden', !on);
  $('#touch').classList.toggle('hidden', !on);
  $('#btn-mute').classList.toggle('hidden', !on);
}
function updateCoinBadges() {
  document.querySelectorAll('.coin-badge span').forEach((s) => (s.textContent = progress.coins));
}

// ===========================================================================
// SELECTION (used by Quick Race and as the pre-GP driver/kart picker)
// ===========================================================================
function ownedFirst(defs, ownsFn) {
  // selection should default to an owned item
  return defs.find((d) => ownsFn(d.id)) || defs[0];
}

function buildCharCards() {
  const grid = $('#char-grid');
  grid.innerHTML = '';
  CHARACTERS.forEach((c) => {
    const owned = progress.ownsChar(c.id);
    const card = document.createElement('div');
    card.className = 'card' + (c.id === sel.char.id ? ' selected' : '') + (owned ? '' : ' locked');
    card.innerHTML = `
      <div class="swatch" style="background:linear-gradient(160deg,#2a2750,#15132e)">
        <div class="head" style="background:${hex(c.skin)}"></div>
        <div class="body" style="background:${hex(c.shirt)}"></div>
        ${owned ? '' : '<div class="lock">🔒</div>'}
      </div>
      <div class="name">${c.name}</div>
      <div class="stats">⚡${c.speed} 🚀${c.accel} 🎯${c.handling}</div>`;
    card.onclick = () => {
      if (!progress.ownsChar(c.id)) { flash(card); return; }
      sel.char = c; buildCharCards();
    };
    grid.appendChild(card);
  });
}
function buildKartCards() {
  const grid = $('#kart-grid');
  grid.innerHTML = '';
  KARTS.forEach((k) => {
    const owned = progress.ownsKart(k.id);
    const card = document.createElement('div');
    card.className = 'card' + (k.id === sel.kart.id ? ' selected' : '') + (owned ? '' : ' locked');
    card.innerHTML = `
      <div class="kart-swatch" style="background:linear-gradient(160deg,${hex(k.color)},${hex(k.accent)})">
        ${owned ? '' : '<div class="lock">🔒</div>'}
      </div>
      <div class="name">${k.name}</div>
      <div class="stats">⚡${fmtMod(k.dSpeed)} 🚀${fmtMod(k.dAccel)} 🎯${fmtMod(k.dHandling)}</div>`;
    card.onclick = () => {
      if (!progress.ownsKart(k.id)) { flash(card); return; }
      sel.kart = k; buildKartCards();
    };
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
        <div class="tdiff">${'★'.repeat(t.difficulty)}${'☆'.repeat(5 - t.difficulty)} • ${t.laps} voltas</div>
      </div>`;
    row.onclick = () => {
      sel.track = t;
      list.querySelectorAll('.track-row').forEach((r) => r.classList.remove('selected'));
      row.classList.add('selected');
    };
    list.appendChild(row);
  });
}
const fmtMod = (n) => (n > 0 ? '+' + n : n === 0 ? '0' : '' + n);
function flash(el) { el.classList.add('shake'); setTimeout(() => el.classList.remove('shake'), 350); }

// ===========================================================================
// SHOP
// ===========================================================================
function buildShop() {
  const cg = $('#shop-char-grid');
  cg.innerHTML = '';
  CHARACTERS.forEach((c) => cg.appendChild(shopCard(c, 'char')));
  const kg = $('#shop-kart-grid');
  kg.innerHTML = '';
  KARTS.forEach((k) => kg.appendChild(shopCard(k, 'kart')));
  updateCoinBadges();
}
function shopCard(def, kind) {
  const owned = kind === 'char' ? progress.ownsChar(def.id) : progress.ownsKart(def.id);
  const card = document.createElement('div');
  card.className = 'card shop-card' + (owned ? ' owned' : '');
  const visual = kind === 'char'
    ? `<div class="swatch" style="background:linear-gradient(160deg,#2a2750,#15132e)">
         <div class="head" style="background:${hex(def.skin)}"></div>
         <div class="body" style="background:${hex(def.shirt)}"></div></div>`
    : `<div class="kart-swatch" style="background:linear-gradient(160deg,${hex(def.color)},${hex(def.accent)})"></div>`;
  const priceTag = owned
    ? '<div class="price owned-tag">✓ Adquirido</div>'
    : `<div class="price">🪙 ${def.price}</div>`;
  card.innerHTML = `${visual}<div class="name">${def.name}</div>${priceTag}`;
  if (!owned) {
    card.onclick = () => {
      const res = kind === 'char' ? progress.buyChar(def.id) : progress.buyKart(def.id);
      if (res.ok) {
        audio.play('item');
        toast(`${def.name} desbloqueado! 🎉`);
        buildShop();
      } else if (res.reason === 'broke') {
        flash(card);
        toast('Moedas insuficientes 🪙');
      }
    };
  }
  return card;
}

// ===========================================================================
// CUPS (Grand Prix)
// ===========================================================================
function buildCupList() {
  const list = $('#cup-list');
  list.innerHTML = '';
  CUPS.forEach((cup) => {
    const tracks = getCupTracks(cup.id);
    const trophy = progress.trophyFor(cup.id);
    const trophyIcon = trophy === 'gold' ? '🥇' : trophy === 'silver' ? '🥈' : trophy === 'bronze' ? '🥉' : '';
    const row = document.createElement('div');
    row.className = 'cup-row';
    row.innerHTML = `
      <div class="cup-emoji">${cup.emoji}</div>
      <div class="cup-meta">
        <div class="cup-name">${cup.name} ${trophyIcon}</div>
        <div class="cup-tracks">${tracks.map((t) => t.name).join(' • ')}</div>
      </div>
      <div class="cup-go">▶</div>`;
    row.onclick = () => startCup(cup.id);
    list.appendChild(row);
  });
}

// Build a fixed roster of 5 rivals for a championship season.
function makeRoster(playerCharId) {
  const rivals = [];
  const pool = CHARACTERS.filter((c) => c.id !== playerCharId);
  for (let i = 0; i < 5; i++) {
    const char = pool[i % pool.length];
    const kart = KARTS[(i + 1) % KARTS.length];
    rivals.push({ id: 'rival' + i, char, kart, skill: 0.85 + i * 0.02 });
  }
  return rivals;
}

function startCup(cupId) {
  const cup = getCup(cupId);
  const roster = makeRoster(sel.char.id);
  const points = { player: 0 };
  roster.forEach((r) => (points[r.id] = 0));
  session = { mode: 'gp', cup, raceIndex: 0, roster, points };
  startSessionRace();
}

// ===========================================================================
// RACE FLOW
// ===========================================================================
function startQuickRace() {
  session = { mode: 'quick' };
  startRace(sel.track, null);
}

function startSessionRace() {
  const track = getCupTracks(session.cup.id)[session.raceIndex];
  sel.track = track;
  startRace(track, session.roster);
}

function startRace(trackDef, roster) {
  audio.init();
  show(null);
  setRaceUI(true);
  input.reset();
  hud.setItem(null);
  game.start({
    trackDef,
    playerChar: sel.char,
    playerKart: sel.kart,
    opponents: 5,
    input,
    roster,
  });
}

function onRaceFinish(standings) {
  setRaceUI(false);
  progress.recordRace();

  const me = standings.find((s) => s.isPlayer);
  const place = me ? me.place : 6;

  // Coin reward for this race
  const reward = raceCoinReward(place);
  progress.addCoins(reward);

  if (session && session.mode === 'gp') {
    // Award championship points to everyone, then show standings.
    standings.forEach((s) => {
      const pts = GP_POINTS[s.place - 1] || 0;
      const key = s.isPlayer ? 'player' : s.rivalId;
      if (key && session.points[key] != null) session.points[key] += pts;
    });
    showRaceResults(standings, reward, true);
  } else {
    showRaceResults(standings, reward, false);
  }
}

function showRaceResults(standings, reward, isGp) {
  const me = standings.find((s) => s.isPlayer);
  $('#results-title').textContent = me ? podiumText(me.place) : 'Resultado';
  $('#reward-line').innerHTML = `Você ganhou <b>🪙 ${reward}</b>!`;
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

  const actions = $('#results-actions');
  actions.innerHTML = '';
  if (isGp) {
    const next = mkBtn('btn-primary', 'Ver classificação →', () => showStandings());
    actions.appendChild(next);
  } else {
    actions.appendChild(mkBtn('btn-ghost', 'Menu', () => { game.cleanup(); show('screen-title'); }));
    actions.appendChild(mkBtn('btn-primary', 'Correr de novo', () => startQuickRace()));
  }
  show('screen-results');
}

function showStandings() {
  const cup = session.cup;
  const tracks = getCupTracks(cup.id);
  const isLast = session.raceIndex >= tracks.length - 1;

  // Build standings array
  const rows = [{ key: 'player', name: sel.char.name + ' (você)', isPlayer: true, pts: session.points.player }];
  session.roster.forEach((r) => rows.push({ key: r.id, name: r.char.name, isPlayer: false, pts: session.points[r.id] }));
  rows.sort((a, b) => b.pts - a.pts);

  $('#standings-title').textContent = `${cup.emoji} ${cup.name}`;
  $('#standings-sub').textContent = isLast
    ? 'Classificação final!'
    : `Corrida ${session.raceIndex + 1} de ${tracks.length} concluída`;

  const ol = $('#standings-list');
  ol.innerHTML = '';
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.isPlayer) li.classList.add('me');
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
    li.innerHTML = `<span class="pl">${medal}</span>
      <span>${r.name}</span>
      <span class="rt">${r.pts} pts</span>`;
    ol.appendChild(li);
  });

  const actions = $('#standings-actions');
  actions.innerHTML = '';
  if (isLast) {
    // Final: award trophy + bonus coins based on final place
    const myPlace = rows.findIndex((r) => r.isPlayer) + 1;
    const trophy = trophyForPlace(myPlace);
    let bonus = 0;
    if (myPlace === 1) bonus = 500;
    else if (myPlace === 2) bonus = 300;
    else if (myPlace === 3) bonus = 150;
    if (bonus) progress.addCoins(bonus);
    if (trophy) progress.setTrophy(cup.id, trophy);

    $('#standings-sub').textContent = trophy
      ? `Você terminou em ${myPlace}º! ${trophy === 'gold' ? '🥇 Troféu de Ouro!' : trophy === 'silver' ? '🥈 Prata!' : '🥉 Bronze!'} +🪙 ${bonus}`
      : `Você terminou em ${myPlace}º. Tente de novo para subir ao pódio!`;
    actions.appendChild(mkBtn('btn-ghost', 'Menu', () => { game.cleanup(); session = null; show('screen-title'); }));
    actions.appendChild(mkBtn('btn-primary', '🏆 Campeonatos', () => { game.cleanup(); session = null; buildCupList(); show('screen-cups'); }));
  } else {
    actions.appendChild(mkBtn('btn-primary', 'Próxima corrida →', () => {
      session.raceIndex++;
      startSessionRace();
    }));
  }
  show('screen-standings');
}

function podiumText(place) {
  if (place === 1) return '🏆 Você venceu!';
  if (place <= 3) return `Pódio! ${place}º lugar 🎉`;
  return `${place}º lugar — bora de novo!`;
}
function mkBtn(cls, label, onClick) {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

// ===========================================================================
// NAV WIRING
// ===========================================================================
function openSelect(mode) {
  // make sure selection points at owned gear
  if (!progress.ownsChar(sel.char.id)) sel.char = ownedFirst(CHARACTERS, (id) => progress.ownsChar(id));
  if (!progress.ownsKart(sel.kart.id)) sel.kart = ownedFirst(KARTS, (id) => progress.ownsKart(id));
  buildCharCards(); buildKartCards();
  if (mode === 'quick') {
    $('#select-title').textContent = 'Corrida Rápida';
    $('#track-section').style.display = '';
    buildTrackList();
    $('#btn-race').textContent = 'CORRER!';
    $('#btn-race').onclick = () => startQuickRace();
  } else {
    // GP: pick driver/kart, track chosen by cup
    $('#select-title').textContent = 'Campeonato — escolha piloto e kart';
    $('#track-section').style.display = 'none';
    $('#btn-race').textContent = 'Escolher Copa →';
    $('#btn-race').onclick = () => { buildCupList(); show('screen-cups'); };
  }
  show('screen-select');
}

$('#btn-quick').onclick = () => { audio.init(); openSelect('quick'); };
$('#btn-cups').onclick = () => { audio.init(); openSelect('gp'); };
$('#btn-shop').onclick = () => { audio.init(); buildShop(); show('screen-shop'); };
$('#btn-back').onclick = () => show('screen-title');
$('#btn-cups-back').onclick = () => show('screen-select');
$('#btn-shop-back').onclick = () => show('screen-title');
$('#btn-mute').onclick = () => {
  const muted = audio.toggleMute();
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
};

// ---- Toast ----
let toastTimer = null;
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

// kick off
updateCoinBadges();
show('screen-title');
game.resize();
