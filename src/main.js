// KARTOPIA - entry point. Wires menus, selection, shop, championship & HUD.
import { Game } from './game.js';
import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { Progress, raceCoinReward, trophyForPlace, raceXpReward } from './progress.js';
import {
  CHARACTERS, KARTS, TRACKS, CUPS, GP_POINTS,
  getCharacter, getKart, getCup, getCupTracks,
} from './data.js';

window.__kartopiaBooted = true;

const $ = (sel) => document.querySelector(sel);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const ITEM_EMOJI = { banana: '🍌', shell: '🐢', boost: '🍄', lightning: '⚡', bomb: '💣', oil: '🛢️', shield: '🛡️' };

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
  flashMsg: (text) => {
    const el = $('#flash-msg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  },
  taunt: (kind) => {
    const lines = {
      pass: ['Comeu poeira! 😎', 'Tchau, otário! 👋', 'Vai comer no rabo! 🏎️', 'Sai da frente! 💨', 'Lerdo demais! 🐢'],
      passed: ['Ei, isso é trapaça! 😤', 'Vou te pegar! 😡', 'Volta aqui! 🤬', 'Ah, qual é! 😩'],
      win: ['SOU O REI DA PISTA! 👑', 'Fácil demais! 🏆', 'Ninguém pra mim! 🔥'],
      hit: ['Essa doeu! 😵', 'Ai, caramba! 💥', 'Quem jogou isso?! 😠'],
    };
    const pool = lines[kind] || lines.pass;
    const el = $('#taunt');
    if (!el) return;
    el.textContent = pool[Math.floor(Math.random() * pool.length)];
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
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
  const lb = $('#level-badge-title');
  if (lb) lb.querySelector('span').textContent = progress.level;
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
    const card = document.createElement('div');
    card.className = 'track-card' + (t.id === sel.track.id ? ' selected' : '');
    const sky = hex(t.theme.sky);
    const ground = hex(t.theme.ground);
    const road = hex(t.theme.road);
    const curb = hex(t.theme.curb);
    // Mini SVG preview: themed sky/ground panel + a stylized loop drawn from
    // the same harmonic params used to build the real track.
    const preview = trackPreviewSVG(t, road, curb);
    card.innerHTML = `
      <div class="track-preview" style="background:linear-gradient(160deg, ${sky}, ${ground})">
        ${preview}
        <span class="track-badge">${'★'.repeat(t.difficulty)}</span>
      </div>
      <div class="track-info">
        <div class="tname">${t.name}</div>
        <div class="tmeta">${t.laps} voltas • ${t.width >= 17 ? 'Largo' : 'Técnico'}</div>
      </div>
      <div class="track-check">✓</div>`;
    card.onclick = () => {
      sel.track = t;
      list.querySelectorAll('.track-card').forEach((r) => r.classList.remove('selected'));
      card.classList.add('selected');
      audio.play('drift');
    };
    list.appendChild(card);
  });
}

// Build a small SVG of the track loop shape from its harmonic definition.
function trackPreviewSVG(t, road, curb) {
  const L = t.loop;
  const pts = [];
  const N = 80;
  const harmonics = L.harmonics || [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (L.rotate || 0);
    let r = L.radius;
    for (const h of harmonics) r += h.amp * Math.sin(h.k * a + (h.phase || 0));
    const x = Math.cos(a) * r * (L.squashX || 1);
    const z = Math.sin(a) * r * (L.squashZ || 1);
    pts.push([x, z]);
  }
  // normalize to a 0..100 viewbox with padding
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  const w = maxX - minX || 1, h = maxZ - minZ || 1;
  const pad = 14;
  const sc = (100 - pad * 2) / Math.max(w, h);
  const ox = (100 - w * sc) / 2 - minX * sc;
  const oy = (100 - h * sc) / 2 - minZ * sc;
  const d = pts.map(([x, z], i) => `${i === 0 ? 'M' : 'L'}${(x * sc + ox).toFixed(1)},${(z * sc + oy).toFixed(1)}`).join(' ') + ' Z';
  return `<svg class="track-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
    <path d="${d}" fill="none" stroke="${curb}" stroke-width="9" stroke-linejoin="round" opacity="0.55"/>
    <path d="${d}" fill="none" stroke="${road}" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="#ffffff" stroke-width="0.8" stroke-dasharray="2 3" stroke-linejoin="round" opacity="0.7"/>
  </svg>`;
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
  const affordable = !owned && progress.coins >= (def.price || 0);
  card.className = 'card shop-card' + (owned ? ' owned' : (affordable ? ' can-afford' : ''));
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
  startRace(sel.track, null, 5);
}

function startTimeTrial() {
  session = { mode: 'time' };
  startRace(sel.track, null, 0); // solo: no rivals
}

function startSessionRace() {
  const track = getCupTracks(session.cup.id)[session.raceIndex];
  sel.track = track;
  startRace(track, session.roster, 5);
}

function startRace(trackDef, roster, opponents) {
  audio.init();
  show(null);
  setRaceUI(true);
  input.reset();
  hud.setItem(null);
  game.start({
    trackDef,
    playerChar: sel.char,
    playerKart: sel.kart,
    opponents: opponents != null ? opponents : 5,
    input,
    roster,
  });
}

function onRaceFinish(standings) {
  setRaceUI(false);
  progress.recordRace();

  const me = standings.find((s) => s.isPlayer);
  const place = me ? me.place : 6;

  // Time Trial: show the lap time + best-time record, no coin/place rewards.
  if (session && session.mode === 'time') {
    const t = me && me.time != null ? me.time : null;
    let isRecord = false;
    if (t != null) isRecord = progress.setBestTime(sel.track.id, t);
    // small participation XP/coins so it still feels rewarding
    progress.addCoins(40);
    const lvl = progress.addXp(30);
    showTimeTrialResults(t, isRecord, lvl);
    return;
  }

  // Coin + XP rewards for this race
  const reward = raceCoinReward(place);
  progress.addCoins(reward);
  const xpGain = raceXpReward(place);
  const levelInfo = progress.addXp(xpGain); // { levelsGained, level, coinBonus }

  if (session && session.mode === 'gp') {
    // Award championship points to everyone, then show standings.
    standings.forEach((s) => {
      const pts = GP_POINTS[s.place - 1] || 0;
      const key = s.isPlayer ? 'player' : s.rivalId;
      if (key && session.points[key] != null) session.points[key] += pts;
    });
    showRaceResults(standings, reward, true, xpGain, levelInfo);
  } else {
    showRaceResults(standings, reward, false, xpGain, levelInfo);
  }
}

function showTimeTrialResults(time, isRecord, levelInfo) {
  $('#results-title').textContent = isRecord ? '⏱️ Novo Recorde!' : '⏱️ Contra o Tempo';
  const best = progress.bestTime(sel.track.id);
  let html = time != null ? `Seu tempo: <b>${fmtTime(time)}</b>` : 'Corrida não concluída';
  if (best != null) html += `<br>Melhor tempo: <b>${fmtTime(best)}</b>`;
  if (levelInfo && levelInfo.levelsGained > 0) {
    html += `<br><span class="levelup">⬆️ Nível ${levelInfo.level}! +🪙 ${levelInfo.coinBonus}</span>`;
  }
  $('#reward-line').innerHTML = html;
  $('#xp-bar-wrap').innerHTML = '';
  $('#results-list').innerHTML = '';
  const actions = $('#results-actions');
  actions.innerHTML = '';
  actions.appendChild(mkBtn('btn-ghost', 'Menu', () => { game.cleanup(); show('screen-title'); }));
  actions.appendChild(mkBtn('btn-primary', 'Tentar de novo', () => startTimeTrial()));
  show('screen-results');
}

function showRaceResults(standings, reward, isGp, xpGain, levelInfo) {
  const me = standings.find((s) => s.isPlayer);
  $('#results-title').textContent = me ? podiumText(me.place) : 'Resultado';
  let rewardHtml = `Você ganhou <b>🪙 ${reward}</b> e <b>✨ ${xpGain} XP</b>!`;
  if (levelInfo && levelInfo.levelsGained > 0) {
    rewardHtml += `<br><span class="levelup">⬆️ Subiu para o nível ${levelInfo.level}! +🪙 ${levelInfo.coinBonus}</span>`;
  }
  $('#reward-line').innerHTML = rewardHtml;
  // XP progress bar toward next level
  const lp = progress.levelProgress();
  const pct = Math.max(0, Math.min(100, (lp.into / lp.need) * 100));
  $('#xp-bar-wrap').innerHTML =
    `<div class="xp-row"><span>Nível ${lp.level}</span><span>${lp.into}/${lp.need} XP</span></div>
     <div class="xp-bar"><div class="xp-fill" style="width:${pct}%"></div></div>`;
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
  } else if (mode === 'time') {
    $('#select-title').textContent = 'Contra o Tempo — escolha a pista';
    $('#track-section').style.display = '';
    buildTrackList();
    $('#btn-race').textContent = '⏱️ LARGAR!';
    $('#btn-race').onclick = () => startTimeTrial();
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
$('#btn-time').onclick = () => { audio.init(); openSelect('time'); };
$('#btn-shop').onclick = () => { audio.init(); buildShop(); show('screen-shop'); };
$('#btn-back').onclick = () => show('screen-title');
$('#btn-cups-back').onclick = () => show('screen-select');
$('#btn-shop-back').onclick = () => show('screen-title');
$('#btn-mute').onclick = () => {
  const muted = audio.toggleMute();
  $('#btn-mute').textContent = muted ? '🔇' : '🔊';
};

// ---- Profile (racer name) ----
function refreshGreeting() {
  const el = $('#greet-name');
  if (el) el.textContent = progress.profileName || 'Piloto';
}
function openProfile(firstTime) {
  const input = $('#profile-input');
  input.value = progress.profileName || '';
  // on first launch the only way forward is to save a name
  $('#btn-save-profile').textContent = firstTime ? 'Começar! 🏁' : 'Salvar';
  show('screen-profile');
  setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);
}
$('#btn-edit-name').onclick = () => { audio.init(); openProfile(false); };
$('#btn-save-profile').onclick = () => {
  const name = ($('#profile-input').value || '').trim();
  if (!name) { $('#profile-input').focus(); return; }
  progress.setProfileName(name);
  refreshGreeting();
  toast(`Bora, ${progress.profileName}! 🏎️`);
  show('screen-title');
};
$('#profile-input') && $('#profile-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#btn-save-profile').click();
});

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
refreshGreeting();
if (progress.hasProfile()) {
  show('screen-title');
} else {
  openProfile(true); // first launch: ask for a racer name
}
game.resize();
