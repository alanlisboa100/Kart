/* ============================================================
   PRINCESAS FORCE v4.0 — Baseado no visual da referência
   Estilo exato: personagens chibi com capacete, paredes escuras,
   grid floor, HUD CS style, joystick + botão de tiro
   ============================================================ */

const Economy={
  money:800,inventory:["glock","knife"],startMoney:800,maxMoney:16000,loseStreak:0,
  KILL:300,WIN:3250,LOSE:1400,LOSE2:1900,LOSE3:2400,LOSE4:2900,LOSE5:3400,
  earn(n){this.money=Math.min(this.maxMoney,this.money+n);},
  spend(n){if(this.money>=n){this.money-=n;return true;}return false;},
  getLoss(){return[this.LOSE,this.LOSE2,this.LOSE3,this.LOSE4,this.LOSE5][Math.min(this.loseStreak,4)];},
  reset(){this.money=this.startMoney;this.inventory=["glock","knife"];this.loseStreak=0;}
};

/* === PERSONAGENS (chibi militar como na referência) === */
const CHARS=[
  {id:"aurora",name:"Aurora",body:"#5b7744",head:"#ffe0c9",hat:"#4a5a3a",band:"#cc4444",hp:100,spd:2.6,desc:"Balanced"},
  {id:"elsa",name:"Elsa",body:"#446644",head:"#fff5f0",hat:"#3a4a3a",band:"#4488cc",hp:110,spd:2.3,desc:"Tank"},
  {id:"ariel",name:"Ariel",body:"#5a6b44",head:"#ffe0c9",hat:"#4a5535",band:"#cc4444",hp:90,spd:3.0,desc:"Fast"},
  {id:"rapunzel",name:"Rapunzel",body:"#556644",head:"#f7e3d3",hat:"#3a5530",band:"#cc4444",hp:100,spd:2.7,desc:"Versatile"},
  {id:"mulan",name:"Mulan",body:"#4a5f3a",head:"#f5d6b8",hat:"#3a4830",band:"#cc4444",hp:100,spd:2.8,desc:"Aggressive"},
  {id:"merida",name:"Merida",body:"#5a6344",head:"#ffe0c9",hat:"#4a5638",band:"#cc4444",hp:95,spd:2.5,desc:"Sniper"}
];

/* === ARMAS (realistas CS 1.6) === */
const WEAPONS={
  knife:{name:"Knife",type:"melee",dmg:55,rate:400,mag:1,rel:0,spd:0,spr:0,rng:50,auto:true,melee:true,price:0,kr:1500},
  glock:{name:"Glock-18",type:"pistol",dmg:25,rate:150,mag:20,rel:2100,spd:14,spr:.035,rng:600,auto:false,price:0,kr:300},
  usp:{name:"USP-S",type:"pistol",dmg:34,rate:170,mag:12,rel:2200,spd:15,spr:.025,rng:650,auto:false,price:500,kr:300},
  deagle:{name:"Desert Eagle",type:"pistol",dmg:63,rate:420,mag:7,rel:2200,spd:16,spr:.045,rng:700,auto:false,price:700,kr:300},
  mac10:{name:"MAC-10",type:"smg",dmg:20,rate:62,mag:30,rel:2400,spd:12,spr:.09,rng:420,auto:true,price:1050,kr:600},
  mp5:{name:"MP5",type:"smg",dmg:26,rate:80,mag:30,rel:2600,spd:13,spr:.06,rng:500,auto:true,price:1500,kr:600},
  p90:{name:"P90",type:"smg",dmg:22,rate:68,mag:50,rel:3300,spd:14,spr:.07,rng:480,auto:true,price:2350,kr:600},
  galil:{name:"Galil",type:"rifle",dmg:30,rate:98,mag:35,rel:2800,spd:15,spr:.055,rng:690,auto:true,price:1800,kr:300},
  famas:{name:"FAMAS",type:"rifle",dmg:30,rate:95,mag:25,rel:2800,spd:15,spr:.05,rng:700,auto:true,price:2050,kr:300},
  ak47:{name:"AK-47",type:"rifle",dmg:36,rate:100,mag:30,rel:2500,spd:16,spr:.05,rng:750,auto:true,price:2700,kr:300},
  m4a1:{name:"M4A1",type:"rifle",dmg:33,rate:90,mag:30,rel:2500,spd:17,spr:.04,rng:780,auto:true,price:3100,kr:300},
  awp:{name:"AWP",type:"sniper",dmg:115,rate:1400,mag:5,rel:3600,spd:28,spr:.005,rng:1400,auto:false,price:4750,kr:50},
  scout:{name:"Scout",type:"sniper",dmg:75,rate:900,mag:10,rel:3000,spd:24,spr:.01,rng:1200,auto:false,price:1700,kr:300},
  nova:{name:"Nova",type:"shotgun",dmg:22,rate:700,mag:8,rel:3500,spd:11,spr:.14,rng:250,auto:false,pellets:8,price:1200,kr:900},
  m249:{name:"M249",type:"lmg",dmg:32,rate:80,mag:100,rel:5500,spd:15,spr:.08,rng:650,auto:true,price:5200,kr:300}
};

const GRENADE={fuse:1500,radius:110,dmg:85,spd:9,price:300};

/* === MAPAS (estilo escuro como na referência, paredes roxas/azuis) === */
const MAPS=[
  {
    id:"de_rio",name:"de_rio",
    desc:"Rio favela · Corridors and open areas",
    floorA:"#3a3a3a",floorB:"#333333",wallFill:"#3a3470",wallStroke:"#4a4480",
    w:2000,h:1300,
    walls:[
      // borders
      {x:0,y:0,w:2000,h:24},{x:0,y:1276,w:2000,h:24},{x:0,y:0,w:24,h:1300},{x:1976,y:0,w:24,h:1300},
      // T spawn area structures
      {x:80,y:250,w:180,h:150},{x:80,y:600,w:120,h:200},{x:80,y:950,w:180,h:150},
      // Long corridor top
      {x:380,y:24,w:24,h:320},{x:380,y:24,w:500,h:24},{x:550,y:130,w:150,h:100},{x:850,y:24,w:24,h:260},
      // Mid section
      {x:380,y:520,w:24,h:260},{x:500,y:560,w:140,h:140},{x:720,y:500,w:100,h:70},{x:720,y:730,w:100,h:70},
      {x:920,y:520,w:24,h:260},
      // Long corridor bottom
      {x:380,y:960,w:24,h:316},{x:380,y:1100,w:500,h:24},{x:550,y:1000,w:150,h:80},{x:850,y:1016,w:24,h:260},
      // Site A (top right)
      {x:1050,y:80,w:180,h:130},{x:1350,y:60,w:120,h:180},{x:1050,y:280,w:280,h:24},{x:1550,y:60,w:24,h:240},
      // Site B (bottom right)
      {x:1050,y:920,w:180,h:130},{x:1350,y:960,w:120,h:180},{x:1050,y:880,w:280,h:24},{x:1550,y:900,w:24,h:240},
      // CT structures
      {x:1650,y:350,w:150,h:120},{x:1650,y:830,w:150,h:120},{x:1800,y:540,w:130,h:200},
      // Connectors
      {x:980,y:340,w:24,h:140},{x:980,y:820,w:24,h:140}
    ],
    spT:[{x:130,y:650},{x:130,y:420},{x:130,y:880},{x:160,y:650},{x:200,y:550}],
    spCT:[{x:1880,y:650},{x:1860,y:450},{x:1860,y:850},{x:1900,y:650},{x:1850,y:550}],
    sites:[{x:1250,y:170,l:"A"},{x:1250,y:1000,l:"B"}]
  },
  {
    id:"de_mansion",name:"de_mansion",
    desc:"Mansion · Close quarters & sniping lanes",
    floorA:"#363636",floorB:"#303030",wallFill:"#2e3a5a",wallStroke:"#3a4a6a",
    w:1800,h:1200,
    walls:[
      {x:0,y:0,w:1800,h:24},{x:0,y:1176,w:1800,h:24},{x:0,y:0,w:24,h:1200},{x:1776,y:0,w:24,h:1200},
      // T spawn
      {x:80,y:300,w:160,h:24},{x:80,y:550,w:100,h:180},{x:80,y:876,w:160,h:24},
      // Apts (top)
      {x:340,y:24,w:24,h:280},{x:340,y:24,w:350,h:24},{x:460,y:100,w:140,h:130},{x:660,y:24,w:24,h:240},{x:700,y:80,w:130,h:110},{x:660,y:240,w:250,h:24},
      // Banana
      {x:340,y:460,w:24,h:280},{x:420,y:520,w:100,h:100},{x:560,y:640,w:120,h:70},
      // Mid
      {x:700,y:400,w:24,h:400},{x:800,y:480,w:130,h:130},{x:1000,y:450,w:90,h:70},{x:1000,y:700,w:90,h:70},{x:1100,y:400,w:24,h:400},
      // Lower
      {x:340,y:880,w:24,h:296},{x:420,y:940,w:180,h:24},{x:500,y:980,w:130,h:90},{x:680,y:940,w:24,h:236},{x:750,y:1000,w:110,h:70},
      // Site A
      {x:1200,y:60,w:180,h:130},{x:1430,y:50,w:24,h:240},{x:1500,y:120,w:140,h:90},{x:1200,y:260,w:250,h:24},{x:1150,y:60,w:24,h:220},
      // Site B
      {x:1200,y:860,w:180,h:120},{x:1430,y:900,w:24,h:220},{x:1500,y:1000,w:140,h:100},{x:1200,y:830,w:260,h:24},{x:1150,y:900,w:24,h:220},
      // CT
      {x:1550,y:360,w:120,h:120},{x:1550,y:720,w:120,h:120},{x:1680,y:500,w:72,h:200}
    ],
    spT:[{x:100,y:600},{x:100,y:420},{x:100,y:780},{x:130,y:600},{x:150,y:500}],
    spCT:[{x:1720,y:600},{x:1700,y:440},{x:1700,y:760},{x:1740,y:600},{x:1700,y:540}],
    sites:[{x:1300,y:160,l:"A"},{x:1300,y:960,l:"B"}]
  }
];

/* === DESENHO DO PERSONAGEM (estilo da referência: chibi circular com capacete) === */
function drawChar(ctx,x,y,r,ch,angle,team,isPlayer,moving,t){
  ctx.save();
  ctx.translate(x,y);

  // Sombra chão
  ctx.save();ctx.scale(1,.4);
  ctx.beginPath();ctx.arc(0,r*2.5,r*.9,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,.4)";ctx.fill();ctx.restore();

  // Anel de time no chão (vermelho/azul como na ref)
  ctx.beginPath();ctx.arc(0,0,r*1.15,0,Math.PI*2);
  ctx.strokeStyle=team==="t"?"rgba(200,50,50,.85)":"rgba(60,130,220,.85)";
  ctx.lineWidth=2.5;ctx.stroke();
  // Arco de progresso (decorativo)
  ctx.beginPath();ctx.arc(0,0,r*1.15,angle-.3,angle+.3);
  ctx.strokeStyle=team==="t"?"#ff4444":"#4488ff";ctx.lineWidth=3;ctx.stroke();

  // Arma (retângulo na direção do angle)
  ctx.save();ctx.rotate(angle);
  ctx.fillStyle="#2a2a2a";
  ctx.fillRect(r*.4,-2.5,r*1.3,5);// cano
  ctx.fillRect(r*.2,-4,r*.5,8);// corpo
  ctx.fillStyle="#1a1a1a";
  ctx.fillRect(r*.7,-1.5,r*.4,3);// detalhe
  ctx.restore();

  // Corpo (círculo preenchido)
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);
  ctx.fillStyle=ch.body;ctx.fill();

  // Barra verde HP em cima
  if(!isPlayer){
    ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(-r,-(r+10),r*2,4);
    ctx.fillStyle="#44cc44";ctx.fillRect(-r,-(r+10),r*2,4);
  }

  // Cabeça/capacete
  const bob=moving?Math.sin(t/90)*1.5:0;
  ctx.beginPath();ctx.arc(0,-2+bob,r*.65,0,Math.PI*2);
  ctx.fillStyle=ch.hat;ctx.fill();
  // Rosto
  ctx.beginPath();ctx.arc(0,2+bob,r*.45,0,Math.PI*2);
  ctx.fillStyle=ch.head;ctx.fill();
  // Bandana/faixa
  ctx.fillStyle=ch.band;
  ctx.fillRect(-r*.4,-r*.15+bob,r*.8,r*.2);

  // Olhinhos
  ctx.fillStyle="#1a1a1a";
  ctx.beginPath();ctx.arc(-r*.15,2+bob,r*.08,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(r*.15,2+bob,r*.08,0,Math.PI*2);ctx.fill();

  // Label "YOU"
  if(isPlayer){
    ctx.fillStyle="#fff";ctx.font="bold 10px monospace";ctx.textAlign="center";
    ctx.fillText("YOU",0,-(r+14));
  }

  ctx.restore();
}
