/* ============================================================
   PRINCESAS FORCE v3.0 — CS 1.6 STYLE
   Armas REALISTAS, mapas clássicos, economia tática completa
   ============================================================ */

/* =================== ECONOMIA CS STYLE =================== */
const Economy = {
  money: 800,
  owned: ["glock","knife"],
  startMoney: 800,
  maxMoney: 16000,

  KILL_REWARD_DEFAULT: 300,
  KILL_REWARD_KNIFE: 1500,
  KILL_REWARD_AWP: 50,
  KILL_REWARD_NADE: 300,
  ROUND_WIN: 3250,
  ROUND_LOSE: 1400,
  ROUND_LOSE_2: 1900,
  ROUND_LOSE_3: 2400,
  ROUND_LOSE_4: 2900,
  ROUND_LOSE_5: 3400,
  loseStreak: 0,

  earn(amount) { this.money = Math.min(this.maxMoney, this.money + amount); },
  spend(amount) { if (this.money >= amount) { this.money -= amount; return true; } return false; },
  canAfford(amount) { return this.money >= amount; },
  owns(weaponId) { return this.owned.includes(weaponId); },
  buyWeapon(weaponId) {
    const w = WEAPONS[weaponId];
    if (!w || !this.canAfford(w.price)) return false;
    this.money -= w.price;
    if (!this.owned.includes(weaponId)) this.owned.push(weaponId);
    return true;
  },
  resetMatch() {
    this.money = this.startMoney;
    this.owned = ["glock","knife"];
    this.loseStreak = 0;
  },
  getRoundLoss() {
    const rewards = [this.ROUND_LOSE, this.ROUND_LOSE_2, this.ROUND_LOSE_3, this.ROUND_LOSE_4, this.ROUND_LOSE_5];
    return rewards[Math.min(this.loseStreak, rewards.length - 1)];
  }
};

/* =================== PERSONAGENS (estilo operadoras CS femininas) =================== */
const PRINCESSES = [
  {
    id:"aurora", name:"Aurora", emoji:"👑",
    hair:"#d4a229", dress:"#556b2f", skin:"#ffe0c9", crown:"#ffd54a",
    accessory:"#8b7355", eyes:"#2e8b57",
    hp:100, speed:2.5, armor:0,
    desc:"Balanceada · Velocidade média"
  },
  {
    id:"elsa", name:"Elsa", emoji:"❄️",
    hair:"#e8e8f0", dress:"#4a6741", skin:"#fff5f0", crown:"#87ceeb",
    accessory:"#556b2f", eyes:"#4682b4",
    hp:100, speed:2.3, armor:1,
    desc:"Resistente · Lenta mas tanque"
  },
  {
    id:"ariel", name:"Ariel", emoji:"🧜",
    hair:"#cc3333", dress:"#5f6b4a", skin:"#ffe0c9", crown:"#daa520",
    accessory:"#6b5b3a", eyes:"#4169e1",
    hp:100, speed:2.8, armor:0,
    desc:"Veloz · Flanqueadora"
  },
  {
    id:"rapunzel", name:"Rapunzel", emoji:"🌸",
    hair:"#8b6914", dress:"#4f6b4a", skin:"#f7e3d3", crown:"#ff69b4",
    accessory:"#6b5a4a", eyes:"#8b4513",
    hp:100, speed:2.6, armor:0,
    desc:"Versátil · Boa em tudo"
  },
  {
    id:"mulan", name:"Mulan", emoji:"⚔️",
    hair:"#1a1a2e", dress:"#3d5c3a", skin:"#f5d6b8", crown:"#cd853f",
    accessory:"#4a4a3a", eyes:"#2f4f4f",
    hp:100, speed:2.7, armor:0,
    desc:"Agressiva · Entry fragger"
  },
  {
    id:"merida", name:"Merida", emoji:"🏹",
    hair:"#cc5500", dress:"#4a5f3a", skin:"#ffe0c9", crown:"#b8860b",
    accessory:"#6b5a3a", eyes:"#228b22",
    hp:100, speed:2.4, armor:0,
    desc:"Sniper · Precisão mortal"
  }
];

/* =================== ARMAS REALISTAS CS 1.6 =================== */
const WEAPONS = {
  // --- PISTOLAS ---
  knife: {
    name:"Faca", type:"knife", emoji:"🔪",
    damage:55, fireRate:400, mag:999, reload:0,
    bulletSpeed:0, spread:0, range:55, color:"#c0c0c0",
    auto:true, bulletEmoji:"", melee:true,
    price:0, killReward:1500,
    desc:"Corpo-a-corpo · $1500 por kill"
  },
  glock: {
    name:"Glock-18", type:"pistol", emoji:"🔫",
    damage:25, fireRate:150, mag:20, reload:2100,
    bulletSpeed:14, spread:0.035, range:600, color:"#ffdd44",
    auto:false, bulletEmoji:"",
    price:0, killReward:300,
    desc:"Pistola padrão CT/TR"
  },
  usp: {
    name:"USP-S", type:"pistol", emoji:"🔫",
    damage:34, fireRate:170, mag:12, reload:2200,
    bulletSpeed:15, spread:0.025, range:650, color:"#ffee66",
    auto:false, bulletEmoji:"",
    price:500, killReward:300,
    desc:"Silenciada · Precisa"
  },
  deagle: {
    name:"Desert Eagle", type:"pistol", emoji:"🦅",
    damage:63, fireRate:420, mag:7, reload:2200,
    bulletSpeed:16, spread:0.04, range:700, color:"#ffd700",
    auto:false, bulletEmoji:"",
    price:700, killReward:300,
    desc:"Uma bala, um headshot"
  },
  // --- SMGs ---
  mp5: {
    name:"MP5 Navy", type:"smg", emoji:"⚡",
    damage:26, fireRate:80, mag:30, reload:2600,
    bulletSpeed:13, spread:0.055, range:500, color:"#aaaaff",
    auto:true, bulletEmoji:"",
    price:1500, killReward:600,
    desc:"SMG versátil · $600/kill"
  },
  p90: {
    name:"P90", type:"smg", emoji:"💨",
    damage:22, fireRate:68, mag:50, reload:3300,
    bulletSpeed:14, spread:0.07, range:480, color:"#88ddff",
    auto:true, bulletEmoji:"",
    price:2350, killReward:600,
    desc:"50 balas · Correria"
  },
  mac10: {
    name:"MAC-10", type:"smg", emoji:"🔥",
    damage:20, fireRate:62, mag:30, reload:2400,
    bulletSpeed:12, spread:0.09, range:420, color:"#ffaa44",
    auto:true, bulletEmoji:"",
    price:1050, killReward:600,
    desc:"Barata e mortal de perto"
  },
  // --- RIFLES ---
  ak47: {
    name:"AK-47", type:"rifle", emoji:"☠️",
    damage:36, fireRate:100, mag:30, reload:2500,
    bulletSpeed:16, spread:0.05, range:750, color:"#ff8844",
    auto:true, bulletEmoji:"",
    price:2700, killReward:300,
    desc:"O clássico · 1 tap na cabeça"
  },
  m4a1: {
    name:"M4A1", type:"rifle", emoji:"⭐",
    damage:33, fireRate:90, mag:30, reload:2500,
    bulletSpeed:17, spread:0.04, range:780, color:"#44aaff",
    auto:true, bulletEmoji:"",
    price:3100, killReward:300,
    desc:"CT favorita · Precisa e estável"
  },
  famas: {
    name:"FAMAS", type:"rifle", emoji:"🎯",
    damage:30, fireRate:95, mag:25, reload:2800,
    bulletSpeed:15, spread:0.05, range:700, color:"#66dd66",
    auto:true, bulletEmoji:"",
    price:2050, killReward:300,
    desc:"Eco round · Custo-benefício"
  },
  galil: {
    name:"Galil", type:"rifle", emoji:"💥",
    damage:30, fireRate:98, mag:35, reload:2800,
    bulletSpeed:15, spread:0.055, range:690, color:"#dd8844",
    auto:true, bulletEmoji:"",
    price:1800, killReward:300,
    desc:"Eco TR · 35 balas"
  },
  // --- SNIPERS ---
  awp: {
    name:"AWP", type:"sniper", emoji:"💀",
    damage:115, fireRate:1400, mag:5, reload:3600,
    bulletSpeed:28, spread:0.005, range:1400, color:"#00ff88",
    auto:false, bulletEmoji:"",
    price:4750, killReward:50,
    desc:"Um tiro, um abate"
  },
  scout: {
    name:"Scout (SSG-08)", type:"sniper", emoji:"🎯",
    damage:75, fireRate:900, mag:10, reload:3000,
    bulletSpeed:24, spread:0.01, range:1200, color:"#88ff88",
    auto:false, bulletEmoji:"",
    price:1700, killReward:300,
    desc:"Leve · Pode pular e atirar"
  },
  // --- SHOTGUNS ---
  nova: {
    name:"Nova", type:"shotgun", emoji:"💣",
    damage:22, fireRate:700, mag:8, reload:3500,
    bulletSpeed:11, spread:0.14, range:250, color:"#ff6644",
    auto:false, bulletEmoji:"", pellets:8,
    price:1200, killReward:900,
    desc:"$900 por kill! Close range"
  },
  // --- LMG ---
  m249: {
    name:"M249 Para", type:"lmg", emoji:"🔥",
    damage:32, fireRate:80, mag:100, reload:5500,
    bulletSpeed:15, spread:0.08, range:650, color:"#ff4444",
    auto:true, bulletEmoji:"",
    price:5200, killReward:300,
    desc:"100 balas de supressão"
  }
};

/* =================== GRANADAS =================== */
const GRENADE = { name:"HE Grenade", fuse:1500, radius:110, damage:85, throwSpeed:9, price:300 };
const FLASH = { name:"Flashbang", fuse:1200, radius:180, duration:2000, throwSpeed:10, price:200 };
const SMOKE = { name:"Smoke", fuse:1000, radius:120, duration:8000, throwSpeed:8, price:300 };

/* =================== MAPAS CS 1.6 ESTILO =================== */
const MAPS = [
  {
    id:"de_rio",
    name:"de_rio",
    desc:"Favela do Rio · Becos estreitos, lajes, e dois bombsites. Clássico brasileiro!",
    floor:"#8b7355", floorAccent:"#7a6548", wallColor:"#a0522d", wallDark:"#8b4513",
    accent1:"#cd853f", accent2:"#d2691e",
    width:2200, height:1400,
    walls:[
      // BORDAS
      {x:0,y:0,w:2200,h:30},{x:0,y:1370,w:2200,h:30},
      {x:0,y:0,w:30,h:1400},{x:2170,y:0,w:30,h:1400},
      // === SPAWN T (esquerda) ===
      {x:30,y:300,w:200,h:30}, // parede superior spawn T
      {x:30,y:500,w:120,h:180}, // casinha spawn T
      {x:30,y:900,w:200,h:30}, // parede inferior spawn T
      {x:30,y:1000,w:120,h:180}, // casinha inferior T
      // === CORREDOR LONGO (top lane → Site A) ===
      {x:350,y:30,w:30,h:350}, // parede esquerda corredor longo
      {x:350,y:30,w:600,h:30}, // teto corredor
      {x:600,y:140,w:200,h:120}, // caixa no corredor longo
      {x:920,y:30,w:30,h:280}, // fim corredor longo
      // === MID (centro do mapa) ===
      {x:350,y:550,w:30,h:300}, // parede esq mid
      {x:500,y:600,w:150,h:150}, // caixas mid
      {x:750,y:500,w:120,h:80}, // obstáculo mid superior
      {x:750,y:820,w:120,h:80}, // obstáculo mid inferior
      {x:980,y:550,w:30,h:300}, // parede dir mid
      // === CORREDOR BAIXO (bottom lane → Site B) ===
      {x:350,y:1050,w:30,h:320}, // parede esq corredor baixo
      {x:350,y:1200,w:600,h:30}, // chão corredor
      {x:550,y:1080,w:180,h:100}, // caixas corredor baixo
      {x:920,y:1090,w:30,h:280}, // fim corredor baixo
      // === SITE A (topo direita) ===
      {x:1100,y:100,w:180,h:120}, // caixa A principal
      {x:1400,y:60,w:120,h:180}, // caixa A lateral
      {x:1350,y:300,w:200,h:30}, // parede sul site A
      {x:1600,y:100,w:30,h:230}, // parede leste A
      {x:1700,y:60,w:140,h:100}, // cantinho A
      // === SITE B (baixo direita) ===
      {x:1100,y:1000,w:180,h:120}, // caixa B
      {x:1400,y:1100,w:120,h:160}, // caixa B lateral
      {x:1350,y:950,w:200,h:30}, // parede norte site B
      {x:1600,y:1000,w:30,h:250}, // parede leste B
      {x:1700,y:1150,w:140,h:120}, // cantinho B
      // === CONNECTOR (liga mid aos sites) ===
      {x:1050,y:380,w:30,h:150}, // conector A
      {x:1050,y:870,w:30,h:150}, // conector B
      // === SPAWN CT (direita) ===
      {x:1900,y:400,w:140,h:120}, // casinha CT
      {x:1900,y:900,w:140,h:120}, // casinha CT baixo
      {x:2000,y:600,w:140,h:200} // base CT
    ],
    spawnsPink:[{x:120,y:700},{x:150,y:450},{x:150,y:950},{x:80,y:700}], // T spawn
    spawnsBlue:[{x:2080,y:700},{x:2050,y:500},{x:2050,y:900},{x:2100,y:700}], // CT spawn
    sites:[{x:1350,y:180,label:"A"},{x:1350,y:1100,label:"B"}],
    decor:[
      {x:250,y:700,emoji:"🏚️"},{x:700,y:700,emoji:"📦"},
      {x:1350,y:180,emoji:"💣"},{x:1350,y:1100,emoji:"💣"},
      {x:1950,y:700,emoji:"🚔"}
    ]
  },
  {
    id:"de_mansion",
    name:"de_mansion",
    desc:"Mansão abandonada · Salões, escadaria central, e jardim dos fundos. Estilo Inferno!",
    floor:"#696969", floorAccent:"#5a5a5a", wallColor:"#4a4a6a", wallDark:"#3a3a5a",
    accent1:"#6a5acd", accent2:"#483d8b",
    width:2000, height:1400,
    walls:[
      // BORDAS
      {x:0,y:0,w:2000,h:30},{x:0,y:1370,w:2000,h:30},
      {x:0,y:0,w:30,h:1400},{x:1970,y:0,w:30,h:1400},
      // === SPAWN T (esquerda) ===
      {x:30,y:350,w:180,h:30},
      {x:30,y:600,w:100,h:200},
      {x:30,y:1000,w:180,h:30},
      // === APARTMENTS (top lane) ===
      {x:300,y:30,w:30,h:300},
      {x:300,y:30,w:400,h:30},
      {x:420,y:120,w:160,h:140}, // room 1
      {x:670,y:30,w:30,h:250},
      {x:670,y:250,w:300,h:30}, // floor
      {x:800,y:100,w:140,h:120}, // room 2
      // === BANANA (diagonal connector) ===
      {x:300,y:500,w:30,h:400},
      {x:420,y:580,w:100,h:100}, // box banana
      {x:550,y:700,w:120,h:80}, // car
      // === MID ===
      {x:700,y:450,w:30,h:500},
      {x:800,y:550,w:140,h:140}, // crate mid
      {x:1000,y:500,w:100,h:80}, // box
      {x:1000,y:820,w:100,h:80}, // box low
      {x:1150,y:450,w:30,h:500},
      // === LOWER (bottom lane) ===
      {x:300,y:1050,w:30,h:320},
      {x:400,y:1100,w:200,h:30},
      {x:500,y:1150,w:140,h:100}, // box
      {x:700,y:1100,w:30,h:270},
      {x:800,y:1150,w:120,h:80}, // obstacle
      // === SITE A (top right) ===
      {x:1300,y:80,w:200,h:140}, // box A
      {x:1550,y:60,w:30,h:280}, // wall A
      {x:1600,y:150,w:160,h:100}, // pit
      {x:1300,y:300,w:280,h:30}, // wall south A
      {x:1200,y:80,w:30,h:250}, // entrance wall
      // === SITE B (bottom right) ===
      {x:1250,y:1000,w:200,h:130}, // box B
      {x:1550,y:1050,w:30,h:250}, // wall B
      {x:1600,y:1150,w:160,h:120}, // corner
      {x:1250,y:950,w:330,h:30}, // wall north B
      {x:1200,y:1050,w:30,h:250},
      // === CT SPAWN ===
      {x:1700,y:400,w:140,h:140},
      {x:1700,y:860,w:140,h:140},
      {x:1850,y:580,w:100,h:240}
    ],
    spawnsPink:[{x:120,y:700},{x:100,y:450},{x:100,y:950},{x:150,y:700}],
    spawnsBlue:[{x:1900,y:700},{x:1880,y:480},{x:1880,y:920},{x:1920,y:700}],
    sites:[{x:1400,y:180,label:"A"},{x:1400,y:1100,label:"B"}],
    decor:[
      {x:200,y:700,emoji:"🚗"},{x:850,y:700,emoji:"📦"},
      {x:1400,y:180,emoji:"💣"},{x:1400,y:1100,emoji:"💣"},
      {x:1800,y:700,emoji:"🏛️"}
    ]
  }
];

/* =================== DESENHO PERSONAGEM (estilo tático/militar) =================== */
function drawPrincess(ctx, cx, cy, r, ch, angle, team, opts={}) {
  const t = opts.t || 0;
  const moving = opts.moving;
  const bob = moving ? Math.sin(t/70) * (r*0.06) : 0;
  ctx.save();
  ctx.translate(cx, cy + bob);

  // Sombra
  ctx.save(); ctx.scale(1,.4);
  ctx.beginPath(); ctx.arc(0,(r+6)*2.5, r*1.0,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,.3)"; ctx.fill(); ctx.restore();

  // Anel de time
  ctx.beginPath(); ctx.arc(0,0,r*1.2,0,Math.PI*2);
  ctx.strokeStyle = team==="pink" ? "rgba(255,80,80,.8)" : "rgba(80,150,255,.8)";
  ctx.lineWidth=2.5; ctx.stroke();

  // Corpo (uniforme tático)
  ctx.save(); ctx.rotate(angle);
  // Arma na frente
  ctx.fillStyle="#4a4a4a";
  ctx.fillRect(r*0.3, -3, r*1.2, 6); // cano
  ctx.fillRect(r*0.1, -5, r*0.5, 10); // corpo arma
  ctx.fillStyle="#2a2a2a";
  ctx.fillRect(r*0.6, -2, r*0.4, 4); // detalhe
  ctx.restore();

  // Corpo principal
  const bodyGrad = ctx.createRadialGradient(0,0,0, 0,0,r);
  bodyGrad.addColorStop(0, ch.dress);
  bodyGrad.addColorStop(1, ch.accessory);
  ctx.beginPath(); ctx.arc(0,0,r*0.85,0,Math.PI*2);
  ctx.fillStyle = bodyGrad; ctx.fill();

  // Colete tático
  ctx.fillStyle = team==="pink" ? "rgba(180,60,60,.4)" : "rgba(60,80,140,.4)";
  ctx.beginPath(); ctx.arc(0,r*0.1,r*0.55,0,Math.PI*2); ctx.fill();

  // Cabeça
  ctx.beginPath(); ctx.arc(0,-r*0.15,r*0.48,0,Math.PI*2);
  ctx.fillStyle=ch.skin; ctx.fill();

  // Cabelo/capacete
  ctx.beginPath(); ctx.arc(0,-r*0.3,r*0.45,Math.PI,0);
  ctx.fillStyle=ch.hair; ctx.fill();

  // Bandana/headband do time
  ctx.fillStyle = team==="pink" ? "#cc4444" : "#4477cc";
  ctx.fillRect(-r*0.4, -r*0.45, r*0.8, r*0.12);

  // Olhos
  const eyeY=-r*0.1, eyeX=r*0.15;
  for(const sx of [-1,1]){
    ctx.beginPath(); ctx.arc(sx*eyeX,eyeY,r*0.08,0,Math.PI*2);
    ctx.fillStyle="#1a1a1a"; ctx.fill();
    ctx.beginPath(); ctx.arc(sx*eyeX+1,eyeY-1,r*0.03,0,Math.PI*2);
    ctx.fillStyle="#fff"; ctx.fill();
  }

  // Indicador direcional
  ctx.save(); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(r*1.2,0); ctx.lineTo(r*0.95,-4); ctx.lineTo(r*0.95,4); ctx.closePath();
  ctx.fillStyle = team==="pink" ? "#ff4444" : "#4488ff"; ctx.fill();
  ctx.restore();

  ctx.restore();
}
