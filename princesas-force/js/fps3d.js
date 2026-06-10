/* ============================================================
   PRINCESAS FORCE v6 — RAYCASTER 3D FPS
   Renderizado direto em Canvas 2D com projeção 3D (estilo Wolfenstein/CS)
   ZERO dependências externas. Funciona em qualquer navegador.
   ============================================================ */
(function(){
"use strict";

// === MAPA (grid-based para raycasting) ===
// 1=parede, 0=vazio. Cores diferentes por valor.
const MAP_W=32, MAP_H=32, TILE=64;
const MAP=[
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,2,2,0,0,0,0,0,2,2,0,0,0,1,1,0,0,0,2,2,0,0,0,0,2,2,0,0,0,1,
  1,0,0,2,2,0,0,0,0,0,2,2,0,0,0,1,1,0,0,0,2,2,0,0,0,0,2,2,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,1,1,0,0,0,0,0,0,0,2,2,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,0,1,
  1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1,
  1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,1,
  1,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,1,1,
  1,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,1,1,1,
  1,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1,
  1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1,
  1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,1,1,0,0,0,0,0,0,0,2,2,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,2,2,0,0,0,0,1,1,0,0,0,0,0,0,0,2,2,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,2,2,0,0,0,0,0,2,2,0,0,0,1,1,0,0,0,2,2,0,0,0,0,2,2,0,0,0,1,
  1,0,0,2,2,0,0,0,0,0,2,2,0,0,0,1,1,0,0,0,2,2,0,0,0,0,2,2,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
  1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1
];

function mapAt(gx,gy){if(gx<0||gx>=MAP_W||gy<0||gy>=MAP_H)return 1;return MAP[gy*MAP_W+gx];}

const WALL_COLORS={1:"#4a4470",2:"#8b4513",3:"#3a6a3a"};
const WALL_DARK={1:"#3a3460",2:"#6b3510",3:"#2a5a2a"};

// === ARMAS ===
const WEAPONS={
  glock:{name:"Glock-18",dmg:25,rate:160,mag:20,rel:2000,auto:false,spr:.03,kr:300},
  ak47:{name:"AK-47",dmg:36,rate:110,mag:30,rel:2500,auto:true,spr:.04,kr:300},
  m4a1:{name:"M4A1",dmg:33,rate:95,mag:30,rel:2500,auto:true,spr:.035,kr:300},
  awp:{name:"AWP",dmg:115,rate:1400,mag:5,rel:3600,auto:false,spr:.005,kr:50}
};

// === GAME STATE ===
const P={x:3*TILE+32,y:3*TILE+32,a:0,hp:100,ammo:20,mag:20,weapon:"glock",
  reloading:false,relEnd:0,lastShot:0,nades:2,alive:true,
  spd:160,money:800,kills:0,earned:0};
const BOTS=[];
let scoreT=0,scoreCT=0,round=1,rTime=55,freeze=4,active=true,t=0;
let firing=false,semiLock=false;
let cv,ctx,W,H;
let keys={},mdx=0,mdy=0;
let joyId=null,jcx=0,jcy=0,moveVec={x:0,z:0};
let aimId=null,aimLast={x:0,y:0};

// === INIT ===
function init(){
  cv=document.getElementById("cv");ctx=cv.getContext("2d");
  resize();window.addEventListener("resize",resize);
  spawnBots();
  setupInput();
  document.getElementById("btn-play").onclick=()=>{
    document.getElementById("menu").classList.remove("active");
    document.getElementById("game").classList.add("active");
    resize();loop(performance.now());
  };
  document.getElementById("btn-help").onclick=()=>{
    alert("🎮 Controles:\n\nPC:\n  WASD - Mover\n  Mouse - Olhar/Mirar\n  Click - Atirar\n  R - Recarregar\n  G - Granada\n\nMobile:\n  Joystick Esquerdo - Mover\n  Arrastar Direita - Olhar\n  Botão ⊕ - Atirar\n  ↻ - Recarregar\n  💣 - Granada");
  };
}

function resize(){
  W=innerWidth;H=innerHeight;
  cv.width=W;cv.height=H;
}

function spawnBots(){
  BOTS.length=0;
  // 5 CTs (inimigos)
  const ctSpawns=[[28,3],[28,5],[28,15],[28,20],[28,28]];
  for(let i=0;i<5;i++){
    const s=ctSpawns[i];
    BOTS.push({x:s[0]*TILE+32,y:s[1]*TILE+32,a:Math.PI,hp:100,alive:true,team:"ct",
      spd:80+Math.random()*30,lastShot:0,ai:{dir:Math.PI,pat:0}});
  }
  // 4 T allies
  const tSpawns=[[3,5],[3,15],[3,20],[3,28]];
  for(let i=0;i<4;i++){
    const s=tSpawns[i];
    BOTS.push({x:s[0]*TILE+32,y:s[1]*TILE+32,a:0,hp:100,alive:true,team:"t",
      spd:70+Math.random()*30,lastShot:0,ai:{dir:0,pat:0}});
  }
}

// === INPUT ===
function setupInput(){
  // Keyboard
  window.addEventListener("keydown",e=>{keys[e.code]=true;
    if(e.code==="KeyR")startReload();
    if(e.code==="KeyG")throwNade();});
  window.addEventListener("keyup",e=>{keys[e.code]=false;if(e.code==="Space"||e.button===0)firing=false;});
  // Mouse
  document.addEventListener("mousemove",e=>{if(document.pointerLockElement){mdx+=e.movementX;mdy+=e.movementY;}});
  cv.addEventListener("mousedown",e=>{if(!document.pointerLockElement)cv.requestPointerLock();else firing=true;});
  window.addEventListener("mouseup",()=>{firing=false;});
  // Touch joystick
  const jz=document.getElementById("jz"),jb=document.getElementById("jb"),jk=document.getElementById("jk");
  const R=38;
  jz.addEventListener("pointerdown",e=>{if(joyId!==null)return;joyId=e.pointerId;
    const r=jb.getBoundingClientRect();jcx=r.left+r.width/2;jcy=r.top+r.height/2;
    jz.setPointerCapture(e.pointerId);e.preventDefault();});
  jz.addEventListener("pointermove",e=>{if(e.pointerId!==joyId)return;
    let dx=e.clientX-jcx,dy=e.clientY-jcy;const d=Math.hypot(dx,dy)||1;const c=Math.min(d,R);
    const nx=dx/d,ny=dy/d;jk.style.transform=`translate(calc(-50%+${nx*c}px),calc(-50%+${ny*c}px))`;
    const mag=c/R;if(mag<.1){moveVec.x=0;moveVec.z=0;}else{moveVec.x=nx*mag;moveVec.z=ny*mag;}
    e.preventDefault();});
  const jup=e=>{if(e.pointerId!==joyId)return;joyId=null;moveVec.x=0;moveVec.z=0;jk.style.transform="translate(-50%,-50%)";};
  jz.addEventListener("pointerup",jup);jz.addEventListener("pointercancel",jup);
  // Touch aim
  const az=document.getElementById("az");
  az.addEventListener("pointerdown",e=>{if(aimId!==null)return;aimId=e.pointerId;aimLast={x:e.clientX,y:e.clientY};az.setPointerCapture(e.pointerId);e.preventDefault();});
  az.addEventListener("pointermove",e=>{if(e.pointerId!==aimId)return;mdx+=e.clientX-aimLast.x;mdy+=e.clientY-aimLast.y;aimLast={x:e.clientX,y:e.clientY};e.preventDefault();});
  const aup=e=>{if(e.pointerId!==aimId)return;aimId=null;};
  az.addEventListener("pointerup",aup);az.addEventListener("pointercancel",aup);
  // Buttons
  const bf=document.getElementById("b-fire");
  bf.addEventListener("pointerdown",e=>{firing=true;bf.setPointerCapture(e.pointerId);e.preventDefault();});
  bf.addEventListener("pointerup",()=>{firing=false;});bf.addEventListener("pointercancel",()=>{firing=false;});
  document.getElementById("b-rel").addEventListener("pointerdown",e=>{startReload();e.preventDefault();});
  document.getElementById("b-nade").addEventListener("pointerdown",e=>{throwNade();e.preventDefault();});
}

// === LOOP ===
let lastT=0;
function loop(ts){
  const dt=Math.min((ts-lastT)/1000,.05);lastT=ts;t+=dt*1000;
  if(active){
    if(freeze>0){freeze-=dt;if(freeze<=0){freeze=0;toast("GO GO GO!");}}
    else{rTime-=dt;if(rTime<=0){rTime=0;endRound("time");}}
  }
  if(freeze<=0&&P.alive){
    updatePlayer(dt);
    if(firing)shoot();
    updateReload();
  }
  if(freeze<=0)updateBots(dt);
  render();
  hudUpdate();
  requestAnimationFrame(loop);
}

// === PLAYER ===
function updatePlayer(dt){
  // Look
  P.a+=mdx*.002;mdx=0;mdy=0;
  // Move
  let fx=0,fz=0;
  if(keys["KeyW"]||keys["ArrowUp"])fz=1;
  if(keys["KeyS"]||keys["ArrowDown"])fz=-1;
  if(keys["KeyA"]||keys["ArrowLeft"])fx=-1;
  if(keys["KeyD"]||keys["ArrowRight"])fx=1;
  if(moveVec.x||moveVec.z){fx=moveVec.x;fz=-moveVec.z;}
  if(fx||fz){
    const m=Math.hypot(fx,fz);fx/=m;fz/=m;
    const cos=Math.cos(P.a),sin=Math.sin(P.a);
    const dx=(fx*cos+fz*sin)*P.spd*dt;
    const dy=(-fx*sin+fz*cos)*P.spd*dt;
    const r=12;
    if(!solid(P.x+dx,P.y,r))P.x+=dx;
    if(!solid(P.x,P.y+dy,r))P.y+=dy;
  }
}

function solid(x,y,r){
  // Check 4 corners
  for(const ox of[-r,r])for(const oy of[-r,r]){
    const gx=Math.floor((x+ox)/TILE),gy=Math.floor((y+oy)/TILE);
    if(mapAt(gx,gy)>0)return true;
  }
  return false;
}

// === SHOOTING ===
function shoot(){
  const w=WEAPONS[P.weapon];
  if(P.reloading)return;
  if(P.ammo<=0){startReload();return;}
  if(t-P.lastShot<w.rate)return;
  if(!w.auto&&semiLock)return;
  P.lastShot=t;P.ammo--;if(!w.auto)semiLock=true;

  // Raycast for hit detection
  const spread=(Math.random()-.5)*w.spr;
  const ra=P.a+spread;
  const hit=castRay(P.x,P.y,ra,800);

  // Check bots
  for(const b of BOTS){
    if(!b.alive||b.team==="t")continue;
    const dx=b.x-P.x,dy=b.y-P.y;
    const dist=Math.hypot(dx,dy);
    if(dist>600)continue;
    // angle to bot
    const aToBot=Math.atan2(dy,dx);
    let diff=aToBot-ra;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;
    const hitWidth=Math.atan2(14,dist); // bot radius in angles
    if(Math.abs(diff)<hitWidth){
      // Check wall between
      const wDist=castRay(P.x,P.y,ra,dist).d;
      if(wDist>=dist-5){
        const hs=Math.random()<.2;
        const dmg=hs?Math.floor(w.dmg*2.5):w.dmg;
        b.hp-=dmg;
        if(b.hp<=0){b.hp=0;b.alive=false;P.kills++;const kr=w.kr;P.money+=kr;P.earned+=kr;
          addKill("Enemy",hs);}
        break;
      }
    }
  }
  hudAmmo();
}

function startReload(){
  const w=WEAPONS[P.weapon];if(P.reloading||P.ammo===w.mag)return;
  P.reloading=true;P.relEnd=t+w.rel;toast("Reloading...");
}
function updateReload(){if(P.reloading&&t>=P.relEnd){P.reloading=false;P.ammo=WEAPONS[P.weapon].mag;hudAmmo();}}

function throwNade(){
  if(P.nades<=0)return;P.nades--;
  // Damage bots in front
  for(const b of BOTS){
    if(!b.alive||b.team==="t")continue;
    const dx=b.x-P.x,dy=b.y-P.y;const dist=Math.hypot(dx,dy);
    if(dist>300)continue;
    const aToBot=Math.atan2(dy,dx);let diff=aToBot-P.a;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;
    if(Math.abs(diff)<.8){
      const dmg=Math.round(80*(1-dist/300));
      b.hp-=dmg;if(b.hp<=0){b.hp=0;b.alive=false;P.kills++;P.money+=300;P.earned+=300;addKill("Enemy",false);}
    }
  }
  toast("Fire in the hole!");
}

// === BOT AI ===
function updateBots(dt){
  for(const b of BOTS){
    if(!b.alive)continue;
    b.ai.pat-=dt*1000;
    if(b.ai.pat<=0){b.ai.dir+=Math.random()*2-1;b.ai.pat=1500+Math.random()*2000;}
    const nx=b.x+Math.cos(b.ai.dir)*b.spd*dt;
    const ny=b.y+Math.sin(b.ai.dir)*b.spd*dt;
    if(!solid(nx,ny,10)){b.x=nx;b.y=ny;}else{b.ai.dir+=Math.PI*.5+Math.random();b.ai.pat=300;}
    // CT shoot player
    if(b.team==="ct"&&P.alive){
      const dx=P.x-b.x,dy=P.y-b.y;const dist=Math.hypot(dx,dy);
      if(dist<400&&t-b.lastShot>600+Math.random()*400){
        b.lastShot=t;b.a=Math.atan2(dy,dx);
        const wDist=castRay(b.x,b.y,b.a,dist).d;
        if(wDist>=dist-5){P.hp-=12+Math.floor(Math.random()*8);
          if(P.hp<=0){P.hp=0;P.alive=false;toast("YOU DIED");}}
      }
    }
  }
}

// === RAYCASTER ===
function castRay(ox,oy,angle,maxDist){
  const sin=Math.sin(angle),cos=Math.cos(angle);
  let dist=0;const step=4;
  while(dist<maxDist){
    dist+=step;
    const x=ox+cos*dist,y=oy+sin*dist;
    const gx=Math.floor(x/TILE),gy=Math.floor(y/TILE);
    const v=mapAt(gx,gy);
    if(v>0)return{d:dist,v,side:0};
  }
  return{d:maxDist,v:0,side:0};
}

// DDA raycaster (more accurate for rendering)
function castDDA(ox,oy,angle){
  const dx=Math.cos(angle),dy=Math.sin(angle);
  const mapX=Math.floor(ox/TILE),mapY=Math.floor(oy/TILE);
  let stepX,stepY,sideDistX,sideDistY;
  const ddx=Math.abs(1/dx)*TILE,ddy=Math.abs(1/dy)*TILE;
  let mx=mapX,my=mapY,side=0;

  if(dx<0){stepX=-1;sideDistX=(ox/TILE-mx)*ddx;}else{stepX=1;sideDistX=(mx+1-ox/TILE)*ddx;}
  if(dy<0){stepY=-1;sideDistY=(oy/TILE-my)*ddy;}else{stepY=1;sideDistY=(my+1-oy/TILE)*ddy;}

  for(let i=0;i<64;i++){
    if(sideDistX<sideDistY){sideDistX+=ddx;mx+=stepX;side=0;}
    else{sideDistY+=ddy;my+=stepY;side=1;}
    const v=mapAt(mx,my);
    if(v>0){
      let d;
      if(side===0)d=(mx-ox/TILE+(1-stepX)/2)*TILE/dx;
      else d=(my-oy/TILE+(1-stepY)/2)*TILE/dy;
      return{d:Math.abs(d),v,side};
    }
  }
  return{d:2000,v:0,side:0};
}

// === RENDER ===
function render(){
  // Sky
  ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,W,H/2);
  // Floor
  ctx.fillStyle="#2a2a2a";ctx.fillRect(0,H/2,W,H/2);

  const fov=Math.PI/3;
  const numRays=Math.min(W,400); // limit for performance on mobile
  const stripW=W/numRays;

  // Cast rays
  for(let i=0;i<numRays;i++){
    const ra=P.a-fov/2+fov*(i/numRays);
    const hit=castDDA(P.x,P.y,ra);
    // Fix fisheye
    const ca=ra-P.a;const d=hit.d*Math.cos(ca);
    // Wall height
    const wallH=Math.min(H*2,(TILE/d)*H*.8);
    const top=(H-wallH)/2;
    // Color
    const base=WALL_COLORS[hit.v]||"#4a4470";
    const dark=WALL_DARK[hit.v]||"#3a3460";
    ctx.fillStyle=hit.side?dark:base;
    ctx.fillRect(i*stripW,top,stripW+1,wallH);
    // Shade by distance
    const shade=Math.min(.7,d/800);
    ctx.fillStyle=`rgba(0,0,0,${shade})`;
    ctx.fillRect(i*stripW,top,stripW+1,wallH);
  }

  // Draw sprites (bots)
  const sprites=[];
  for(const b of BOTS){
    if(!b.alive)continue;
    const dx=b.x-P.x,dy=b.y-P.y;
    const dist=Math.hypot(dx,dy);
    const ang=Math.atan2(dy,dx)-P.a;
    let a=ang;while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;
    if(Math.abs(a)<fov*.7)sprites.push({b,dist,a});
  }
  sprites.sort((a,b)=>b.dist-a.dist);
  for(const s of sprites){
    const sx=W/2+Math.tan(s.a)*(W/2)/Math.tan(fov/2);
    const scale=(TILE/s.dist)*H*.7;
    const sw=scale*.6,sh=scale;
    const x=sx-sw/2,y=H/2-sh/2;
    // Body
    ctx.fillStyle=s.b.team==="ct"?"#3a5a3a":"#5a3a3a";
    ctx.fillRect(x,y+sh*.2,sw,sh*.6);
    // Head
    ctx.fillStyle="#ffcc99";
    ctx.beginPath();ctx.arc(sx,y+sh*.15,sw*.3,0,Math.PI*2);ctx.fill();
    // Helmet
    ctx.fillStyle=s.b.team==="ct"?"#2a4a2a":"#4a2a2a";
    ctx.beginPath();ctx.arc(sx,y+sh*.1,sw*.32,Math.PI,0);ctx.fill();
    // HP bar
    const hpW=sw*.8;
    ctx.fillStyle="rgba(0,0,0,.5)";ctx.fillRect(sx-hpW/2,y-6,hpW,4);
    ctx.fillStyle=s.b.hp>50?"#44cc44":"#ff4444";
    ctx.fillRect(sx-hpW/2,y-6,hpW*(s.b.hp/100),4);
    // Distance shade
    const sh2=Math.min(.6,s.dist/500);
    ctx.fillStyle=`rgba(0,0,0,${sh2})`;ctx.fillRect(x,y,sw,sh);
  }

  // Weapon on screen
  drawWeapon();
}

function drawWeapon(){
  const bx=W*.55,by=H*.65,ws=Math.min(W*.35,200);
  // Weapon body
  ctx.fillStyle="#333";
  ctx.fillRect(bx,by,ws*.8,ws*.15);// barrel
  ctx.fillRect(bx+ws*.2,by-ws*.05,ws*.5,ws*.25);// body
  ctx.fillStyle="#222";
  ctx.fillRect(bx+ws*.35,by+ws*.15,ws*.12,ws*.2);// grip
  ctx.fillRect(bx+ws*.55,by-ws*.02,ws*.15,ws*.1);// sight
  // Muzzle flash on recent shot
  if(t-P.lastShot<60){
    ctx.fillStyle="rgba(255,220,60,.6)";
    ctx.beginPath();ctx.arc(bx-4,by+ws*.07,12+Math.random()*8,0,Math.PI*2);ctx.fill();
  }
}

// === ROUND LOGIC ===
function checkWin(){
  const ctAlive=BOTS.filter(b=>b.team==="ct"&&b.alive).length;
  if(ctAlive===0&&active)endRound("t");
  else if(!P.alive&&active)endRound("ct");
}
setInterval(()=>{if(active&&freeze<=0)checkWin();},500);

function endRound(w){
  if(!active)return;active=false;
  let won=w==="t";
  if(won){scoreT++;P.money+=3250;P.earned+=3250;}else{scoreCT++;P.money+=1400;P.earned+=1400;}
  setTimeout(()=>{toast(won?"TERRORISTS WIN":"CT WIN");
    setTimeout(()=>{nextRound();},2000);},500);
}

function nextRound(){
  P.hp=100;P.alive=true;P.ammo=WEAPONS[P.weapon].mag;P.nades=2;P.reloading=false;
  P.x=3*TILE+32;P.y=3*TILE+32;P.a=0;
  P.kills=0;P.earned=0;
  rTime=55;freeze=4;active=true;round++;
  spawnBots();toast("FREEZE TIME");
}

// === HUD ===
function hudUpdate(){
  document.getElementById("ht-t").textContent=scoreT;
  document.getElementById("ht-ct").textContent=scoreCT;
  const s=freeze>0?Math.ceil(freeze):Math.max(0,Math.ceil(rTime));
  document.getElementById("ht-time").textContent=(freeze>0?"❄ ":"")+Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
  document.getElementById("hb-hp").textContent=Math.max(0,P.hp);
  document.getElementById("hb-money").textContent="$"+P.money;
  hudAmmo();
}
function hudAmmo(){
  document.getElementById("hb-wep").textContent=WEAPONS[P.weapon].name;
  document.getElementById("hb-ammo").textContent=P.reloading?"...":P.ammo+"/"+WEAPONS[P.weapon].mag;
}
function toast(m){const el=document.getElementById("msg");el.textContent=m;el.classList.add("show");
  clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),1200);}
function addKill(v,hs){const el=document.getElementById("kf");const d=document.createElement("div");
  d.textContent=`You [${WEAPONS[P.weapon].name}${hs?" HS":""}] ${v}`;el.appendChild(d);
  if(el.children.length>4)el.removeChild(el.firstChild);setTimeout(()=>{if(d.parentNode)d.remove();},4000);}

// Prevent context menu
document.addEventListener("contextmenu",e=>e.preventDefault());
// Release semi
window.addEventListener("mouseup",()=>{semiLock=false;});
window.addEventListener("pointerup",()=>{semiLock=false;firing=false;});

// Start
document.addEventListener("DOMContentLoaded",init);
})();
