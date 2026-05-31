// KARTOPIA - player progress & economy, persisted in localStorage.
// Tracks coins, which characters/karts are unlocked, and best cup results.
import { CHARACTERS, KARTS } from './data.js';

const KEY = 'kartopia_save_v1';

const defaults = () => ({
  coins: 0,
  // first character and first kart are free/owned from the start
  ownedChars: ['pip'],
  ownedKarts: ['beep'],
  cupTrophies: {},   // cupId -> 'gold' | 'silver' | 'bronze'
  totalRaces: 0,
});

export class Progress {
  constructor() {
    this.data = defaults();
    this.load();
    // Make sure freebies are always owned (in case of older saves).
    this._ensure('ownedChars', 'pip');
    this._ensure('ownedKarts', 'beep');
  }

  _ensure(list, id) {
    if (!this.data[list]) this.data[list] = [];
    if (!this.data[list].includes(id)) this.data[list].push(id);
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = Object.assign(defaults(), JSON.parse(raw));
    } catch (e) { /* storage unavailable - run with defaults */ }
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {}
  }

  // --- Coins ---
  get coins() { return this.data.coins; }
  addCoins(n) { this.data.coins = Math.max(0, this.data.coins + Math.round(n)); this.save(); return this.data.coins; }

  // --- Ownership ---
  ownsChar(id) { return this.data.ownedChars.includes(id); }
  ownsKart(id) { return this.data.ownedKarts.includes(id); }

  // Attempt to buy. Returns { ok, reason }.
  buyChar(id) { return this._buy('ownedChars', CHARACTERS, id); }
  buyKart(id) { return this._buy('ownedKarts', KARTS, id); }

  _buy(list, defs, id) {
    if (this.data[list].includes(id)) return { ok: false, reason: 'owned' };
    const def = defs.find((d) => d.id === id);
    if (!def) return { ok: false, reason: 'missing' };
    const price = def.price || 0;
    if (this.data.coins < price) return { ok: false, reason: 'broke' };
    this.data.coins -= price;
    this.data[list].push(id);
    this.save();
    return { ok: true };
  }

  // --- Cup results ---
  recordRace() { this.data.totalRaces++; this.save(); }
  trophyFor(cupId) { return this.data.cupTrophies[cupId] || null; }
  // Save the best trophy earned for a cup (gold > silver > bronze).
  setTrophy(cupId, trophy) {
    const rank = { bronze: 1, silver: 2, gold: 3 };
    const cur = this.data.cupTrophies[cupId];
    if (!cur || (rank[trophy] || 0) > (rank[cur] || 0)) {
      this.data.cupTrophies[cupId] = trophy;
      this.save();
    }
  }
}

// Coin reward for finishing a single race by placement (1-indexed).
export function raceCoinReward(place) {
  const table = [120, 90, 70, 50, 35, 25];
  return table[place - 1] != null ? table[place - 1] : 20;
}

// Trophy by final championship placement.
export function trophyForPlace(place) {
  if (place === 1) return 'gold';
  if (place === 2) return 'silver';
  if (place === 3) return 'bronze';
  return null;
}
