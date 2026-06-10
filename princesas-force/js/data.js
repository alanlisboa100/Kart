/* ============================================================
   PRINCESAS FORCE — DADOS COMPLETOS
   Personagens, armas (estilo Hello Kitty kawaii), economia, mapas
   ============================================================ */

/* =================== ECONOMIA =================== */
const Economy = {
  money: 1500, // dinheiro inicial
  owned: ["pistola_coracao"], // armas já compradas
  
  KILL_REWARD: 300,
  ROUND_WIN: 800,
  ROUND_LOSE: 400,
  
  earn(amount) { this.money += amount; this.save(); },
  spend(amount) { if (this.money >= amount) { this.money -= amount; this.save(); return true; } return false; },
  canAfford(amount) { return this.money >= amount; },
  owns(weaponId) { return this.owned.includes(weaponId); },
  buyWeapon(weaponId) {
    if (this.owns(weaponId)) return false;
    const w = WEAPONS[weaponId];
    if (!w || !this.canAfford(w.price)) return false;
    this.money -= w.price;
    this.owned.push(weaponId);
    this.save();
    return true;
  },
  save() {
    try { localStorage.setItem("pf_money", this.money); localStorage.setItem("pf_owned", JSON.stringify(this.owned)); } catch(e){}
  },
  load() {
    try {
      const m = localStorage.getItem("pf_money");
      const o = localStorage.getItem("pf_owned");
      if (m !== null) this.money = parseInt(m);
      if (o !== null) this.owned = JSON.parse(o);
    } catch(e){}
  }
};
Economy.load();

/* =================== PRINCESAS =================== */
const PRINCESSES = [
  {
    id:"rosa", name:"Princesa Rosa", emoji:"🌹",
    hair:"#5b3a2a", dress:"#ff5fa2", skin:"#ffe0c9", crown:"#ffd54a",
    accessory:"#ff8fc4", eyes:"#3a2a3a",
    hp:100, speed:2.8,
    desc:"Equilibrada · ❤️100 · ⚡Rápida"
  },
  {
    id:"neve", name:"Princesa Neve", emoji:"❄️",
    hair:"#1a1a2e", dress:"#7ecbff", skin:"#fff5f0", crown:"#bfe9ff",
    accessory:"#a8e6ff", eyes:"#1a237e",
    hp:130, speed:2.3,
    desc:"Tanque · ❤️130 · 🛡️Resistente"
  },
  {
    id:"coral", name:"Princesa Coral", emoji:"🐚",
    hair:"#7a1f3d", dress:"#ff8fb1", skin:"#ffe0c9", crown:"#ffb86b",
    accessory:"#ffcc80", eyes:"#4e342e",
    hp:85, speed:3.2,
    desc:"Velocista · ❤️85 · 💨Super Rápida"
  },
  {
    id:"lua", name:"Princesa Lua", emoji:"🌙",
    hair:"#3a2a5b", dress:"#b388ff", skin:"#f3e0d0", crown:"#e0c3ff",
    accessory:"#ce93d8", eyes:"#4a148c",
    hp:95, speed:2.6,
    desc:"Assassina · 🎯Dano Crítico"
  },
  {
    id:"sol", name:"Princesa Sol", emoji:"☀️",
    hair:"#d4a229", dress:"#ffd23f", skin:"#ffe0c9", crown:"#ff8e3c",
    accessory:"#ffab40", eyes:"#e65100",
    hp:100, speed:2.7,
    desc:"Versátil · 🌈Boa em tudo"
  },
  {
    id:"jade", name:"Princesa Jade", emoji:"🦋",
    hair:"#1b5e20", dress:"#9ff0d8", skin:"#f7e3d3", crown:"#69f0ae",
    accessory:"#80cbc4", eyes:"#004d40",
    hp:110, speed:2.5,
    desc:"Suporte · ❤️110 · ✨Resistente"
  }
];

/* =================== ARMAS (TODAS KAWAII / HELLO KITTY STYLE) =================== */
const WEAPONS = {
  pistola_coracao: {
    name:"Pistola Coração 💕", type:"pistol", emoji:"💕",
    damage:24, fireRate:260, mag:12, reload:1000,
    bulletSpeed:12, spread:0.04, range:500, color:"#ff5fa2",
    auto:false, bulletEmoji:"💗",
    price:0, desc:"Pistola inicial fofa"
  },
  smg_bolha: {
    name:"SMG Bolhinhas 🫧", type:"smg", emoji:"🫧",
    damage:16, fireRate:75, mag:30, reload:1300,
    bulletSpeed:13, spread:0.11, range:440, color:"#7ecbff",
    auto:true, bulletEmoji:"🫧",
    price:1200, desc:"Rajada rápida de bolhas"
  },
  rifle_estrela: {
    name:"Rifle Estrela ⭐", type:"rifle", emoji:"⭐",
    damage:28, fireRate:125, mag:30, reload:1600,
    bulletSpeed:14, spread:0.06, range:620, color:"#ffd23f",
    auto:true, bulletEmoji:"⭐",
    price:2800, desc:"Rifle versátil e preciso"
  },
  ak_arcoiris: {
    name:"AK Arco-íris 🌈", type:"rifle", emoji:"🌈",
    damage:32, fireRate:140, mag:30, reload:1900,
    bulletSpeed:14, spread:0.08, range:650, color:"#ff8e3c",
    auto:true, bulletEmoji:"🌈",
    price:3200, desc:"Alta potência colorida"
  },
  sniper_diamante: {
    name:"Sniper Diamante 💎", type:"sniper", emoji:"💎",
    damage:95, fireRate:1100, mag:5, reload:2200,
    bulletSpeed:22, spread:0.0, range:1100, color:"#b388ff",
    auto:false, bulletEmoji:"💎",
    price:4500, desc:"Um tiro, um brilho mortal"
  },
  shotgun_rosa: {
    name:"Shotgun Rosas 🌹", type:"shotgun", emoji:"🌹",
    damage:18, fireRate:600, mag:6, reload:2000,
    bulletSpeed:11, spread:0.18, range:280, color:"#e91e63",
    auto:false, bulletEmoji:"🌹", pellets:6,
    price:2000, desc:"6 pétalas por tiro!"
  },
  lmg_confete: {
    name:"LMG Confete 🎉", type:"lmg", emoji:"🎉",
    damage:20, fireRate:90, mag:60, reload:3200,
    bulletSpeed:12, spread:0.12, range:550, color:"#e040fb",
    auto:true, bulletEmoji:"🎊",
    price:5000, desc:"Chuva de confete infinita"
  },
  uzi_glitter: {
    name:"Uzi Glitter ✨", type:"smg", emoji:"✨",
    damage:14, fireRate:60, mag:35, reload:1400,
    bulletSpeed:13, spread:0.13, range:380, color:"#ffd54f",
    auto:true, bulletEmoji:"✨",
    price:1800, desc:"Faíscas douradas velozes"
  }
};

/* =================== GRANADA =================== */
const GRENADE = {
  name:"Granada Cupcake 🧁",
  fuse:1300, radius:100, damage:70, throwSpeed:8
};

/* =================== MAPAS =================== */
const MAPS = [
  {
    id:"cd_rio",
    name:"CD Rio 🏖️",
    desc:"Favela colorida com becos, barracas e vista pro mar. Estilo CS Rio clássico!",
    floor:"#e8d4a0", floorAccent:"#dcc78a", wallColor:"#ff9ac6", wallDark:"#d4799e",
    accent1:"#4fc3f7", accent2:"#ffb74d",
    width:1800, height:1200,
    walls:[
      // Bordas
      {x:0,y:0,w:1800,h:28},{x:0,y:1172,w:1800,h:28},
      {x:0,y:0,w:28,h:1200},{x:1772,y:0,w:28,h:1200},
      // Casas / barracas lado esquerdo
      {x:120,y:120,w:200,h:160},
      {x:120,y:400,w:140,h:180},
      {x:120,y:750,w:200,h:140},
      {x:120,y:1000,w:160,h:140},
      // Centro - favela
      {x:500,y:100,w:100,h:200},
      {x:660,y:200,w:180,h:100},
      {x:500,y:440,w:140,h:120},
      {x:740,y:400,w:80,h:200},
      {x:500,y:700,w:200,h:80},
      {x:500,y:900,w:120,h:160},
      {x:740,y:700,w:100,h:160},
      // Centro corredor
      {x:900,y:140,w:60,h:340},
      {x:900,y:720,w:60,h:340},
      // Lado direito
      {x:1060,y:200,w:180,h:100},
      {x:1060,y:440,w:140,h:120},
      {x:1300,y:100,w:100,h:200},
      {x:1060,y:700,w:200,h:80},
      {x:1300,y:700,w:100,h:160},
      {x:1060,y:900,w:120,h:160},
      {x:1460,y:120,w:200,h:160},
      {x:1500,y:400,w:160,h:180},
      {x:1460,y:750,w:200,h:140},
      {x:1500,y:1000,w:160,h:140}
    ],
    spawnsPink:[{x:80,y:600},{x:200,y:340},{x:200,y:920}],
    spawnsBlue:[{x:1720,y:600},{x:1600,y:340},{x:1600,y:920}],
    sites:[{x:700,y:300,label:"A"},{x:900,y:900,label:"B"}],
    decor:[
      {x:400,y:50,emoji:"🌴"},{x:1400,y:50,emoji:"🌴"},
      {x:60,y:1150,emoji:"🏖️"},{x:1740,y:1150,emoji:"🏖️"},
      {x:900,y:550,emoji:"⚽"}
    ]
  },
  {
    id:"sala_assault",
    name:"Mansão Assault 🏰",
    desc:"Mansão real com salões, corredores estreitos e dois bombsites. Clássico!",
    floor:"#d8c7e8", floorAccent:"#cbb6e0", wallColor:"#9575cd", wallDark:"#7e57c2",
    accent1:"#ce93d8", accent2:"#b39ddb",
    width:1700, height:1200,
    walls:[
      // Bordas
      {x:0,y:0,w:1700,h:28},{x:0,y:1172,w:1700,h:28},
      {x:0,y:0,w:28,h:1200},{x:1672,y:0,w:28,h:1200},
      // Salão principal
      {x:200,y:200,w:300,h:30},
      {x:200,y:200,w:30,h:250},
      {x:200,y:420,w:300,h:30},
      // Corredor central
      {x:700,y:28,w:30,h:380},
      {x:700,y:550,w:30,h:120},
      {x:700,y:800,w:30,h:372},
      {x:970,y:28,w:30,h:380},
      {x:970,y:550,w:30,h:120},
      {x:970,y:800,w:30,h:372},
      // Salão direita
      {x:1200,y:200,w:300,h:30},
      {x:1470,y:200,w:30,h:250},
      {x:1200,y:420,w:300,h:30},
      // Salas inferiores
      {x:200,y:750,w:300,h:30},
      {x:200,y:750,w:30,h:250},
      {x:200,y:970,w:300,h:30},
      {x:1200,y:750,w:300,h:30},
      {x:1470,y:750,w:30,h:250},
      {x:1200,y:970,w:300,h:30},
      // Caixas centrais
      {x:790,y:480,w:120,h:120},
      {x:820,y:850,w:80,h:80},
      // Obstáculos
      {x:400,y:580,w:100,h:80},
      {x:1200,y:580,w:100,h:80}
    ],
    spawnsPink:[{x:100,y:600},{x:150,y:320},{x:150,y:880}],
    spawnsBlue:[{x:1600,y:600},{x:1550,y:320},{x:1550,y:880}],
    sites:[{x:850,y:300,label:"A"},{x:850,y:1000,label:"B"}],
    decor:[
      {x:350,y:310,emoji:"🪑"},{x:1350,y:310,emoji:"🪑"},
      {x:350,y:860,emoji:"💎"},{x:1350,y:860,emoji:"💎"},
      {x:850,y:600,emoji:"👑"}
    ]
  }
];

/* =================== DESENHO DA PRINCESA (SPRITE FOFO DETALHADO) =================== */
function drawPrincess(ctx, cx, cy, r, ch, angle, team, opts={}) {
  const t = opts.t || 0;
  const moving = opts.moving;
  const bob = moving ? Math.sin(t/80) * (r*0.08) : 0;
  ctx.save();
  ctx.translate(cx, cy + bob);

  // Sombra
  ctx.save(); ctx.scale(1,.45);
  ctx.beginPath(); ctx.arc(0,(r+8)*2.2, r*1.1,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,.2)"; ctx.fill(); ctx.restore();

  // Anel de time
  ctx.beginPath(); ctx.arc(0,0,r*1.3,0,Math.PI*2);
  ctx.strokeStyle = team==="pink" ? "rgba(255,95,162,.9)" : "rgba(127,182,255,.9)";
  ctx.lineWidth=3; ctx.stroke();

  // Indicador de direção
  ctx.save(); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(r*1.1,0); ctx.lineTo(r*1.6,-5); ctx.lineTo(r*1.6,5); ctx.closePath();
  ctx.fillStyle = team==="pink" ? "#ff5fa2" : "#7fb6ff"; ctx.fill();
  ctx.restore();

  // Vestido (corpo com camadas)
  const dressGrad = ctx.createRadialGradient(0,r*0.5,0, 0,r*0.5,r*1.2);
  dressGrad.addColorStop(0, ch.dress);
  dressGrad.addColorStop(1, ch.accessory || ch.dress);
  ctx.beginPath();
  ctx.moveTo(-r*0.95,r*1.0);
  ctx.quadraticCurveTo(-r*0.3,r*0.3, 0,r*0.2);
  ctx.quadraticCurveTo(r*0.3,r*0.3, r*0.95,r*1.0);
  ctx.lineTo(r*0.6,r*0.25);
  ctx.lineTo(-r*0.6,r*0.25);
  ctx.closePath();
  ctx.fillStyle = dressGrad; ctx.fill();
  // Babados
  ctx.beginPath();
  for(let i=-3;i<=3;i++){
    const bx = i*r*0.27, by = r*0.95 + Math.sin(i+t/200)*2;
    ctx.arc(bx, by, r*0.15, 0, Math.PI);
  }
  ctx.fillStyle="rgba(255,255,255,.5)"; ctx.fill();

  // Cabelo (volume)
  const hairGrad = ctx.createRadialGradient(0,-r*0.2,0, 0,-r*0.1,r*0.9);
  hairGrad.addColorStop(0, ch.hair);
  hairGrad.addColorStop(1, ch.hair+"99");
  ctx.beginPath(); ctx.arc(0,-r*0.08,r*0.8,0,Math.PI*2);
  ctx.fillStyle = hairGrad; ctx.fill();
  // Mechas laterais
  ctx.beginPath();
  ctx.ellipse(-r*0.6, r*0.1, r*0.2, r*0.5, -0.2, 0, Math.PI*2);
  ctx.ellipse(r*0.6, r*0.1, r*0.2, r*0.5, 0.2, 0, Math.PI*2);
  ctx.fillStyle = ch.hair; ctx.fill();

  // Rosto
  ctx.beginPath(); ctx.arc(0,-r*0.05, r*0.58, 0,Math.PI*2);
  ctx.fillStyle=ch.skin; ctx.fill();

  // Franja
  ctx.beginPath();
  ctx.arc(0,-r*0.22, r*0.6, Math.PI+0.3, -0.3);
  ctx.lineTo(r*0.35,-r*0.1);
  ctx.quadraticCurveTo(0,-r*0.35, -r*0.35,-r*0.1);
  ctx.closePath();
  ctx.fillStyle=ch.hair; ctx.fill();

  // Olhos kawaii (grandes e brilhantes)
  const eyeY=-r*0.02, eyeX=r*0.22;
  for(const sx of [-1,1]){
    // Branco
    ctx.beginPath(); ctx.ellipse(sx*eyeX,eyeY,r*0.14,r*0.18,0,0,Math.PI*2);
    ctx.fillStyle="#fff"; ctx.fill();
    // Íris
    ctx.beginPath(); ctx.ellipse(sx*eyeX,eyeY+r*0.02,r*0.11,r*0.14,0,0,Math.PI*2);
    ctx.fillStyle=ch.eyes||"#3a2a3a"; ctx.fill();
    // Pupila
    ctx.beginPath(); ctx.arc(sx*eyeX,eyeY+r*0.03,r*0.06,0,Math.PI*2);
    ctx.fillStyle="#1a1a1a"; ctx.fill();
    // Brilhos
    ctx.beginPath(); ctx.arc(sx*eyeX+r*0.05,eyeY-r*0.04,r*0.04,0,Math.PI*2);
    ctx.fillStyle="#fff"; ctx.fill();
    ctx.beginPath(); ctx.arc(sx*eyeX-r*0.02,eyeY+r*0.05,r*0.025,0,Math.PI*2);
    ctx.fillStyle="rgba(255,255,255,.7)"; ctx.fill();
    // Cílios
    ctx.beginPath();
    ctx.moveTo(sx*(eyeX-r*0.12),eyeY-r*0.12);
    ctx.quadraticCurveTo(sx*eyeX, eyeY-r*0.22, sx*(eyeX+r*0.12),eyeY-r*0.12);
    ctx.strokeStyle="#2a1a2a"; ctx.lineWidth=1.5; ctx.stroke();
  }

  // Bochechas
  for(const sx of [-1,1]){
    ctx.beginPath(); ctx.arc(sx*r*0.4,r*0.15,r*0.09,0,Math.PI*2);
    ctx.fillStyle="rgba(255,120,170,.5)"; ctx.fill();
  }
  // Boquinha sorrindo
  ctx.beginPath(); ctx.arc(0,r*0.18,r*0.08,0.1,Math.PI-0.1);
  ctx.strokeStyle="#d23b6b"; ctx.lineWidth=2; ctx.stroke();

  // Coroa detalhada
  const cw=r*0.75, cy2=-r*0.75;
  ctx.beginPath();
  ctx.moveTo(-cw/2,cy2+r*0.08);
  ctx.lineTo(-cw/2+4,cy2-r*0.05);
  ctx.lineTo(-cw/4,cy2-r*0.3);
  ctx.lineTo(-cw/8,cy2-r*0.08);
  ctx.lineTo(0,cy2-r*0.35);
  ctx.lineTo(cw/8,cy2-r*0.08);
  ctx.lineTo(cw/4,cy2-r*0.3);
  ctx.lineTo(cw/2-4,cy2-r*0.05);
  ctx.lineTo(cw/2,cy2+r*0.08);
  ctx.closePath();
  const crownGrad = ctx.createLinearGradient(0,cy2-r*0.35,0,cy2+r*0.08);
  crownGrad.addColorStop(0,ch.crown); crownGrad.addColorStop(1,"#fff8e1");
  ctx.fillStyle=crownGrad; ctx.fill();
  ctx.strokeStyle="rgba(180,130,0,.5)"; ctx.lineWidth=1; ctx.stroke();
  // Joias
  ctx.beginPath(); ctx.arc(0,cy2-r*0.15,r*0.06,0,Math.PI*2);
  ctx.fillStyle="#ff1744"; ctx.fill();
  ctx.beginPath(); ctx.arc(-cw/4,cy2-r*0.1,r*0.04,0,Math.PI*2);
  ctx.fillStyle="#2979ff"; ctx.fill();
  ctx.beginPath(); ctx.arc(cw/4,cy2-r*0.1,r*0.04,0,Math.PI*2);
  ctx.fillStyle="#00e676"; ctx.fill();

  ctx.restore();
}
