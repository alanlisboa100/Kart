/* ============================================================
   PRINCESAS FORCE 3D — Full FPS Engine with Three.js
   First-person shooter like CS 1.6
   ============================================================ */

// === GAME STATE ===
const G={
  scene:null,cam:null,renderer:null,clock:null,
  player:{x:200,y:0,z:200,yaw:0,pitch:0,hp:100,armor:0,speed:80,
    weapon:"glock",ammo:20,mag:20,nades:1,alive:true,
    reloading:false,relEnd:0,lastShot:0,onGround:true,vy:0},
  bots:[],bullets:[],particles:[],
  walls:[],wallMeshes:[],floorMesh:null,
  round:1,scoreT:0,scoreCT:0,rTime:55,freeze:4,active:true,
  t:0,running:false,paused:false,kills:0,earned:0,money:800,
  MR:12,RSEC:55,FSEC:4,
  keys:{},mouse:{dx:0,dy:0},firing:false,
  moveVec:{x:0,z:0},
  sensitivity:0.002,
  touchJoyId:null,touchAimId:null,touchAimLast:{x:0,y:0}
};

// === WEAPONS ===
const WEPS={
  glock:{name:"Glock-18",dmg:25,rate:150,mag:20,rel:2100,auto:false,spd:900,spr:.02,rng:80,kr:300,price:0},
  usp:{name:"USP-S",dmg:34,rate:170,mag:12,rel:2200,auto:false,spd:1000,spr:.015,rng:90,kr:300,price:500},
  deagle:{name:"Desert Eagle",dmg:63,rate:420,mag:7,rel:2200,auto:false,spd:1100,spr:.03,rng:100,kr:300,price:700},
  mp5:{name:"MP5",dmg:26,rate:80,mag:30,rel:2600,auto:true,spd:850,spr:.04,rng:70,kr:600,price:1500},
  ak47:{name:"AK-47",dmg:36,rate:100,mag:30,rel:2500,auto:true,spd:1000,spr:.035,rng:100,kr:300,price:2700},
  m4a1:{name:"M4A1",dmg:33,rate:90,mag:30,rel:2500,auto:true,spd:1050,spr:.03,rng:110,kr:300,price:3100},
  awp:{name:"AWP",dmg:115,rate:1400,mag:5,rel:3600,auto:false,spd:1500,spr:.003,rng:200,kr:50,price:4750}
};

// === MAP (3D - walls as boxes) ===
const MAP={
  w:2000,h:2000,wallH:120,
  walls:[
    // Outer walls
    {x:0,z:0,w:2000,d:20},{x:0,z:1980,w:2000,d:20},{x:0,z:0,w:20,d:2000},{x:1980,z:0,w:20,d:2000},
    // Buildings / cover
    {x:200,z:200,w:200,d:150},{x:200,z:600,w:150,d:200},{x:200,z:1200,w:200,d:150},
    {x:600,z:100,w:150,d:300},{x:600,z:600,w:120,d:120},{x:600,z:1000,w:150,d:200},
    {x:900,z:300,w:200,d:20},{x:900,z:500,w:20,d:400},{x:900,z:900,w:200,d:20},
    {x:1100,z:200,w:100,d:200},{x:1200,z:600,w:150,d:150},{x:1100,z:1000,w:200,d:100},
    {x:1500,z:200,w:200,d:150},{x:1500,z:600,w:150,d:200},{x:1500,z:1200,w:200,d:150},
    // Center structures
    {x:850,z:850,w:160,d:160},{x:400,z:400,w:80,d:80},{x:1400,z:400,w:80,d:80},
    {x:400,z:1400,w:80,d:80},{x:1400,z:1400,w:80,d:80}
  ],
  spawnsT:[{x:150,z:1000},{x:150,z:800},{x:150,z:1200},{x:250,z:1000},{x:200,z:900}],
  spawnsCT:[{x:1850,z:1000},{x:1850,z:800},{x:1850,z:1200},{x:1750,z:1000},{x:1800,z:900}]
};

// === INIT ===
function init(){
  // Three.js setup
  G.scene=new THREE.Scene();
  G.scene.background=new THREE.Color(0x1a1a2e);
  G.scene.fog=new THREE.Fog(0x1a1a2e,400,1200);

  G.cam=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,1,2000);
  G.cam.position.set(MAP.spawnsT[0].x,50,MAP.spawnsT[0].z);
  G.player.x=MAP.spawnsT[0].x;G.player.z=MAP.spawnsT[0].z;G.player.y=50;

  G.renderer=new THREE.WebGLRenderer({antialias:true});
  G.renderer.setSize(innerWidth,innerHeight);
  G.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  document.getElementById("game-screen").insertBefore(G.renderer.domElement,document.querySelector(".hud"));

  G.clock=new THREE.Clock();

  // Lighting
  const ambient=new THREE.AmbientLight(0xffffff,0.4);G.scene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,0.6);dir.position.set(500,600,300);G.scene.add(dir);
  const hemi=new THREE.HemisphereLight(0x8888cc,0x444422,0.3);G.scene.add(hemi);

  buildMap();
  spawnBots();
  setupInput();
  setupUI();

  G.running=true;
  G.active=true;
  G.freeze=G.FSEC;
  toast("FREEZE TIME",1500);
  hudAll();

  window.addEventListener("resize",()=>{
    G.cam.aspect=innerWidth/innerHeight;G.cam.updateProjectionMatrix();
    G.renderer.setSize(innerWidth,innerHeight);
  });

  loop();
}

// === BUILD MAP ===
function buildMap(){
  // Floor
  const floorGeo=new THREE.PlaneGeometry(MAP.w,MAP.h);
  const floorMat=new THREE.MeshLambertMaterial({color:0x3a3a3a});
  G.floorMesh=new THREE.Mesh(floorGeo,floorMat);
  G.floorMesh.rotation.x=-Math.PI/2;
  G.floorMesh.position.set(MAP.w/2,0,MAP.h/2);
  G.scene.add(G.floorMesh);

  // Grid on floor
  const gridHelper=new THREE.GridHelper(MAP.w,30,0x2a2a2a,0x2a2a2a);
  gridHelper.position.set(MAP.w/2,0.5,MAP.h/2);
  G.scene.add(gridHelper);

  // Ceiling
  const ceilGeo=new THREE.PlaneGeometry(MAP.w,MAP.h);
  const ceilMat=new THREE.MeshLambertMaterial({color:0x222222});
  const ceil=new THREE.Mesh(ceilGeo,ceilMat);
  ceil.rotation.x=Math.PI/2;ceil.position.set(MAP.w/2,MAP.wallH,MAP.h/2);
  G.scene.add(ceil);

  // Walls
  const wallMat=new THREE.MeshPhongMaterial({color:0x4a4470,flatShading:true});
  const wallMatDark=new THREE.MeshPhongMaterial({color:0x3a3460,flatShading:true});

  for(const w of MAP.walls){
    const geo=new THREE.BoxGeometry(w.w,MAP.wallH,w.d);
    const mesh=new THREE.Mesh(geo,Math.random()>.5?wallMat:wallMatDark);
    mesh.position.set(w.x+w.w/2, MAP.wallH/2, w.z+w.d/2);
    G.scene.add(mesh);
    G.walls.push({x:w.x,z:w.z,w:w.w,d:w.d,mesh});
    // Top highlight
    const topGeo=new THREE.BoxGeometry(w.w,2,w.d);
    const topMat=new THREE.MeshBasicMaterial({color:0x6a6490});
    const top=new THREE.Mesh(topGeo,topMat);
    top.position.set(w.x+w.w/2,MAP.wallH+1,w.z+w.d/2);
    G.scene.add(top);
  }
}

// === BOTS ===
function spawnBots(){
  G.bots=[];
  // CT enemies
  for(let i=0;i<5;i++){
    const sp=MAP.spawnsCT[i%MAP.spawnsCT.length];
    const bot=createBot(sp.x,sp.z,"ct",i);
    G.bots.push(bot);
  }
  // T allies
  for(let i=1;i<5;i++){
    const sp=MAP.spawnsT[i%MAP.spawnsT.length];
    const bot=createBot(sp.x,sp.z,"t",i+5);
    G.bots.push(bot);
  }
}

function createBot(x,z,team,idx){
  const color=team==="ct"?0x4488cc:0xcc4444;
  // Body
  const bodyGeo=new THREE.CylinderGeometry(12,12,60,8);
  const bodyMat=new THREE.MeshPhongMaterial({color:team==="ct"?0x3a5a3a:0x5a4a3a});
  const body=new THREE.Mesh(bodyGeo,bodyMat);
  body.position.set(x,30,z);
  G.scene.add(body);
  // Head
  const headGeo=new THREE.SphereGeometry(10,8,6);
  const headMat=new THREE.MeshPhongMaterial({color:0xffcc99});
  const head=new THREE.Mesh(headGeo,headMat);
  head.position.set(0,38,0);
  body.add(head);
  // Helmet
  const helmGeo=new THREE.SphereGeometry(11,8,4,0,Math.PI*2,0,Math.PI/2);
  const helmMat=new THREE.MeshPhongMaterial({color:team==="ct"?0x2a4a2a:0x4a3a2a});
  const helm=new THREE.Mesh(helmGeo,helmMat);
  helm.position.set(0,40,0);
  body.add(helm);
  // Gun
  const gunGeo=new THREE.BoxGeometry(4,4,30);
  const gunMat=new THREE.MeshPhongMaterial({color:0x222222});
  const gun=new THREE.Mesh(gunGeo,gunMat);
  gun.position.set(10,20,15);
  body.add(gun);
  // Team indicator (ring)
  const ringGeo=new THREE.RingGeometry(14,16,16);
  const ringMat=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide});
  const ring=new THREE.Mesh(ringGeo,ringMat);
  ring.rotation.x=-Math.PI/2;ring.position.set(0,-29,0);
  body.add(ring);

  return{
    mesh:body,team,x,z,y:30,hp:100,maxHp:100,alive:true,
    angle:team==="ct"?Math.PI:0,spd:55+Math.random()*15,
    weapon:["glock","ak47","m4a1","mp5","awp"][idx%5],
    lastShot:0,ai:{dir:Math.random()*6.28,strafe:1,ns:0,pat:0}
  };
}

// === COLLISION ===
function collides(x,z,r){
  for(const w of MAP.walls){
    const cx=Math.max(w.x,Math.min(x,w.x+w.w));
    const cz=Math.max(w.z,Math.min(z,w.z+w.d));
    if((x-cx)**2+(z-cz)**2<r*r)return true;
  }
  if(x<20+r||x>MAP.w-20-r||z<20+r||z>MAP.h-20-r)return true;
  return false;
}

// === INPUT ===
function setupInput(){
  // Keyboard
  window.addEventListener("keydown",e=>{G.keys[e.code]=true;
    if(e.code==="KeyR")G.player.reloadReq=true;
    if(e.code==="KeyG")throwNade();
    if(e.code==="KeyB")toast("Buy: Coming soon",600);
  });
  window.addEventListener("keyup",e=>{G.keys[e.code]=false;});
  // Mouse
  document.addEventListener("mousemove",e=>{if(document.pointerLockElement){G.mouse.dx+=e.movementX;G.mouse.dy+=e.movementY;}});
  document.addEventListener("mousedown",e=>{
    if(!document.pointerLockElement){G.renderer.domElement.requestPointerLock();}
    else if(e.button===0)G.firing=true;
  });
  document.addEventListener("mouseup",e=>{if(e.button===0)G.firing=false;});
  document.addEventListener("pointerlockchange",()=>{});

  // Touch joystick
  const jzone=document.getElementById("jzone");
  const jbase=document.getElementById("jbase");
  const jknob=document.getElementById("jknob");
  let jcx=0,jcy=0;const jR=40;
  jzone.addEventListener("pointerdown",e=>{if(G.touchJoyId!==null)return;G.touchJoyId=e.pointerId;
    const r=jbase.getBoundingClientRect();jcx=r.left+r.width/2;jcy=r.top+r.height/2;
    jzone.setPointerCapture(e.pointerId);e.preventDefault();});
  jzone.addEventListener("pointermove",e=>{if(e.pointerId!==G.touchJoyId)return;
    let dx=e.clientX-jcx,dz=e.clientY-jcy;const d=Math.hypot(dx,dz)||1;const c=Math.min(d,jR);
    const nx=dx/d,nz=dz/d;
    jknob.style.transform=`translate(calc(-50% + ${nx*c}px),calc(-50% + ${nz*c}px))`;
    const mag=c/jR;if(mag<.1){G.moveVec.x=0;G.moveVec.z=0;}else{G.moveVec.x=nx*mag;G.moveVec.z=nz*mag;}
    e.preventDefault();});
  const jup=e=>{if(e.pointerId!==G.touchJoyId)return;G.touchJoyId=null;G.moveVec.x=0;G.moveVec.z=0;
    jknob.style.transform="translate(-50%,-50%)";};
  jzone.addEventListener("pointerup",jup);jzone.addEventListener("pointercancel",jup);

  // Touch aim
  const azone=document.getElementById("azone");
  azone.addEventListener("pointerdown",e=>{if(G.touchAimId!==null)return;G.touchAimId=e.pointerId;
    G.touchAimLast={x:e.clientX,y:e.clientY};azone.setPointerCapture(e.pointerId);e.preventDefault();});
  azone.addEventListener("pointermove",e=>{if(e.pointerId!==G.touchAimId)return;
    const dx=e.clientX-G.touchAimLast.x,dy=e.clientY-G.touchAimLast.y;
    G.mouse.dx+=dx;G.mouse.dy+=dy;
    G.touchAimLast={x:e.clientX,y:e.clientY};e.preventDefault();});
  const aup=e=>{if(e.pointerId!==G.touchAimId)return;G.touchAimId=null;};
  azone.addEventListener("pointerup",aup);azone.addEventListener("pointercancel",aup);

  // Buttons
  const fire=document.getElementById("btn-fire");
  fire.addEventListener("pointerdown",e=>{G.firing=true;fire.setPointerCapture(e.pointerId);e.preventDefault();});
  fire.addEventListener("pointerup",()=>{G.firing=false;});
  fire.addEventListener("pointercancel",()=>{G.firing=false;});
  document.getElementById("btn-reload").addEventListener("pointerdown",e=>{G.player.reloadReq=true;e.preventDefault();});
  document.getElementById("btn-nade").addEventListener("pointerdown",e=>{throwNade();e.preventDefault();});
}

// === UI ===
function setupUI(){
  document.getElementById("btn-play").addEventListener("click",()=>{
    document.getElementById("menu").classList.remove("active");
    document.getElementById("game-screen").classList.add("active");
    init3D();
  });
  document.getElementById("btn-info").addEventListener("click",()=>{
    alert("Controls:\nWASD - Move\nMouse - Look\nLeft Click - Shoot\nR - Reload\nG - Grenade\n\nMobile:\nLeft joystick - Move\nRight area - Look\nFire button - Shoot");
  });
  document.getElementById("btn-pause").addEventListener("click",()=>{G.paused=true;document.getElementById("ov-pause").classList.remove("hid");});
  document.getElementById("btn-resume").addEventListener("click",()=>{G.paused=false;document.getElementById("ov-pause").classList.add("hid");});
  document.getElementById("btn-quit").addEventListener("click",()=>{location.reload();});
  document.getElementById("btn-quit2").addEventListener("click",()=>{location.reload();});
  document.getElementById("btn-next").addEventListener("click",nextRound);
}

let initialized=false;
function init3D(){if(initialized)return;initialized=true;init();}

// === LOOP ===
function loop(){
  if(!G.running)return;
  requestAnimationFrame(loop);
  const dt=Math.min(G.clock.getDelta(),0.05);
  G.t+=dt*1000;
  if(!G.paused)update(dt);
  G.renderer.render(G.scene,G.cam);
}

function update(dt){
  // Freeze
  if(G.freeze>0){G.freeze-=dt;if(G.freeze<=0){G.freeze=0;toast("GO GO GO!",700);}updateTimer();return;}
  if(G.active){G.rTime-=dt;if(G.rTime<=0){G.rTime=0;endRound("time");}}
  updateTimer();

  if(G.player.alive){
    updatePlayerMove(dt);
    updatePlayerLook();
    if(G.firing)shoot();
    if(G.player.reloadReq){reload();G.player.reloadReq=false;}
    updateReload();
  }
  updateBots(dt);
  updateBullets(dt);
  updateParticles(dt);
  checkWin();
}

// === PLAYER MOVEMENT ===
function updatePlayerMove(dt){
  const p=G.player;
  let fx=0,fz=0;
  // Keyboard
  if(G.keys["KeyW"]||G.keys["ArrowUp"])fz-=1;
  if(G.keys["KeyS"]||G.keys["ArrowDown"])fz+=1;
  if(G.keys["KeyA"]||G.keys["ArrowLeft"])fx-=1;
  if(G.keys["KeyD"]||G.keys["ArrowRight"])fx+=1;
  // Touch
  if(G.moveVec.x||G.moveVec.z){fx=G.moveVec.x;fz=G.moveVec.z;}

  if(fx||fz){
    const mag=Math.hypot(fx,fz);fx/=mag;fz/=mag;
    // Convert to world space based on yaw
    const sin=Math.sin(p.yaw),cos=Math.cos(p.yaw);
    const wx=fx*cos-fz*sin;
    const wz=fx*sin+fz*cos;
    const spd=p.speed*dt;
    let nx=p.x+wx*spd,nz=p.z+wz*spd;
    if(!collides(nx,p.z,14))p.x=nx;
    if(!collides(p.x,nz,14))p.z=nz;
  }
  G.cam.position.set(p.x,p.y,p.z);
}

function updatePlayerLook(){
  const p=G.player;
  const sens=G.sensitivity;
  p.yaw-=G.mouse.dx*sens;
  p.pitch-=G.mouse.dy*sens;
  p.pitch=Math.max(-Math.PI/2.5,Math.min(Math.PI/2.5,p.pitch));
  G.mouse.dx=0;G.mouse.dy=0;

  G.cam.rotation.order="YXZ";
  G.cam.rotation.y=p.yaw;
  G.cam.rotation.x=p.pitch;
}

// === SHOOTING ===
let semiLock=false;
function shoot(){
  const p=G.player;const w=WEPS[p.weapon];
  if(p.reloading)return;
  if(p.ammo<=0){reload();return;}
  if(G.t-p.lastShot<w.rate)return;
  if(!w.auto&&semiLock)return;
  p.lastShot=G.t;p.ammo--;
  if(!w.auto)semiLock=true;

  // Raycast from camera
  const dir=new THREE.Vector3(0,0,-1);
  dir.applyQuaternion(G.cam.quaternion);
  // Add spread
  dir.x+=(Math.random()-.5)*w.spr;
  dir.y+=(Math.random()-.5)*w.spr*.5;
  dir.z+=(Math.random()-.5)*w.spr;
  dir.normalize();

  // Create bullet tracer
  const start=G.cam.position.clone();
  G.bullets.push({pos:start.clone(),dir:dir.clone(),dist:0,maxDist:w.rng*10,dmg:w.dmg,team:"t"});

  // Muzzle flash (particle at gun position)
  const muzzle=start.clone().add(dir.clone().multiplyScalar(20));
  spawnFlash(muzzle);

  hudAmmo();
  kick();
}

function reload(){
  const p=G.player;const w=WEPS[p.weapon];
  if(p.reloading||p.ammo===w.mag)return;
  p.reloading=true;p.relEnd=G.t+w.rel;
  toast("Reloading...",400);
}
function updateReload(){
  const p=G.player;if(p.reloading&&G.t>=p.relEnd){
    p.reloading=false;p.ammo=WEPS[p.weapon].mag;hudAmmo();
  }
  if(!G.firing)semiLock=false;
}

function throwNade(){
  const p=G.player;if(p.nades<=0)return;p.nades--;
  document.getElementById("nade-c").textContent=p.nades;
  const dir=new THREE.Vector3(0,0,-1).applyQuaternion(G.cam.quaternion);
  const pos=G.cam.position.clone();
  // Simple: damage bots in direction
  for(const b of G.bots){
    if(!b.alive||b.team==="t")continue;
    const toBotDir=new THREE.Vector3(b.x-pos.x,0,b.z-pos.z).normalize();
    const dot=dir.dot(toBotDir);
    const dist=Math.hypot(b.x-pos.x,b.z-pos.z);
    if(dot>.7&&dist<300){
      const dmg=Math.round(85*(1-dist/300));
      damageBot(b,dmg);
    }
  }
  spawnExplosion(pos.clone().add(dir.clone().multiplyScalar(150)));
  toast("Fire in the hole!",400);
}

// === BULLETS ===
function updateBullets(dt){
  for(let i=G.bullets.length-1;i>=0;i--){
    const b=G.bullets[i];
    const step=WEPS[G.player.weapon].spd*dt;
    b.pos.add(b.dir.clone().multiplyScalar(step));
    b.dist+=step;
    if(b.dist>b.maxDist){G.bullets.splice(i,1);continue;}
    // Hit wall?
    if(collides(b.pos.x,b.pos.z,2)){spawnSpark(b.pos.clone());G.bullets.splice(i,1);continue;}
    // Hit bot?
    for(const bot of G.bots){
      if(!bot.alive||(b.team===bot.team))continue;
      const dx=bot.x-b.pos.x,dz=bot.z-b.pos.z;
      if(dx*dx+dz*dz<20*20){
        const hs=b.pos.y>55&&Math.random()<.3;
        damageBot(bot,hs?Math.floor(b.dmg*2.5):b.dmg,hs);
        spawnBlood(b.pos.clone());
        G.bullets.splice(i,1);break;
      }
    }
  }
}

function damageBot(bot,dmg,hs){
  bot.hp-=dmg;
  if(bot.hp<=0){
    bot.alive=false;bot.hp=0;
    bot.mesh.visible=false;
    if(bot.team==="ct"){
      G.kills++;
      const kr=WEPS[G.player.weapon].kr||300;
      G.money+=kr;G.earned+=kr;
      hudMoney();
      kfeed("You",bot.team==="ct"?"Enemy":"Ally",hs);
    }
  }
}

// === BOTS AI ===
function updateBots(dt){
  for(const b of G.bots){
    if(!b.alive)continue;
    // Simple movement AI
    b.ai.pat-=dt*1000;
    if(b.ai.pat<=0){
      b.ai.dir=Math.random()*Math.PI*2;
      b.ai.pat=2000+Math.random()*3000;
    }
    const nx=b.x+Math.cos(b.ai.dir)*b.spd*dt;
    const nz=b.z+Math.sin(b.ai.dir)*b.spd*dt;
    if(!collides(nx,nz,14)){b.x=nx;b.z=nz;}
    else{b.ai.dir+=Math.PI/2+Math.random();b.ai.pat=500;}
    b.mesh.position.set(b.x,30,b.z);
    b.mesh.rotation.y=b.ai.dir;

    // CT bots shoot at player
    if(b.team==="ct"&&G.player.alive){
      const dx=G.player.x-b.x,dz=G.player.z-b.z;
      const dist=Math.hypot(dx,dz);
      if(dist<500){
        // Face player
        b.angle=Math.atan2(dx,dz);
        b.mesh.rotation.y=b.angle;
        // Shoot
        if(G.t-b.lastShot>400+Math.random()*300){
          b.lastShot=G.t;
          // Check line of sight (simple)
          let blocked=false;
          for(let s=0;s<10;s++){
            const sx=b.x+dx*(s/10),sz=b.z+dz*(s/10);
            if(collides(sx,sz,4)){blocked=true;break;}
          }
          if(!blocked){
            const dmg=15+Math.floor(Math.random()*10);
            G.player.hp-=dmg;
            if(G.player.hp<=0){G.player.hp=0;G.player.alive=false;toast("YOU DIED",1500);}
            hudHp();
          }
        }
      }
    }
  }
}

// === PARTICLES ===
function spawnFlash(pos){for(let i=0;i<3;i++){const geo=new THREE.SphereGeometry(2);const mat=new THREE.MeshBasicMaterial({color:0xffdd44});const m=new THREE.Mesh(geo,mat);m.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*5));G.scene.add(m);G.particles.push({mesh:m,life:80});}}
function spawnSpark(pos){for(let i=0;i<2;i++){const geo=new THREE.SphereGeometry(1.5);const mat=new THREE.MeshBasicMaterial({color:0xffaa22});const m=new THREE.Mesh(geo,mat);m.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*8,(Math.random()-.5)*8,(Math.random()-.5)*8));G.scene.add(m);G.particles.push({mesh:m,life:120});}}
function spawnBlood(pos){for(let i=0;i<4;i++){const geo=new THREE.SphereGeometry(2);const mat=new THREE.MeshBasicMaterial({color:0xcc0000});const m=new THREE.Mesh(geo,mat);m.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*10));G.scene.add(m);G.particles.push({mesh:m,life:250});}}
function spawnExplosion(pos){for(let i=0;i<8;i++){const geo=new THREE.SphereGeometry(3+Math.random()*3);const mat=new THREE.MeshBasicMaterial({color:[0xff4400,0xffaa00,0xffdd00,0x444444][i%4]});const m=new THREE.Mesh(geo,mat);m.position.copy(pos).add(new THREE.Vector3((Math.random()-.5)*40,Math.random()*20,(Math.random()-.5)*40));G.scene.add(m);G.particles.push({mesh:m,life:400});}}
function updateParticles(dt){for(let i=G.particles.length-1;i>=0;i--){G.particles[i].life-=dt*1000;if(G.particles[i].life<=0){G.scene.remove(G.particles[i].mesh);G.particles.splice(i,1);}}}

// === ROUND LOGIC ===
function checkWin(){
  const ctAlive=G.bots.filter(b=>b.team==="ct"&&b.alive).length;
  if(ctAlive===0)endRound("t");
  else if(!G.player.alive)endRound("ct");
}

function endRound(w){
  if(!G.active)return;G.active=false;
  let won=false;
  if(w==="t"){G.scoreT++;won=true;}else{G.scoreCT++;}
  const rr=won?3250:1400;G.money+=rr;G.earned+=rr;
  document.getElementById("st").textContent=G.scoreT;
  document.getElementById("sct").textContent=G.scoreCT;

  setTimeout(()=>{
    const mo=G.scoreT>G.MR/2||G.scoreCT>G.MR/2;
    document.getElementById("end-title").textContent=mo?(G.scoreT>G.scoreCT?"MATCH WON 🏆":"MATCH LOST"):(won?"TERRORISTS WIN":"COUNTER-TERRORISTS WIN");
    document.getElementById("end-sub").textContent=`Score: ${G.scoreT}-${G.scoreCT}`;
    document.getElementById("end-money").textContent=`+$${G.earned} (${G.kills} kills)`;
    document.getElementById("btn-next").textContent=mo?"NEW MATCH":"NEXT ROUND";
    document.getElementById("ov-end").classList.remove("hid");
  },1000);
}

function nextRound(){
  document.getElementById("ov-end").classList.add("hid");
  // Reset
  G.player.hp=100;G.player.alive=true;G.player.ammo=WEPS[G.player.weapon].mag;G.player.nades=1;
  G.player.x=MAP.spawnsT[0].x;G.player.z=MAP.spawnsT[0].z;G.player.reloading=false;
  G.kills=0;G.earned=0;G.rTime=G.RSEC;G.freeze=G.FSEC;G.active=true;G.round++;
  G.bullets=[];
  // Respawn bots
  for(const b of G.bots){G.scene.remove(b.mesh);}
  spawnBots();
  toast("FREEZE TIME",1500);
  hudAll();
}

// === HUD ===
function hudAll(){hudHp();hudAmmo();hudMoney();document.getElementById("nade-c").textContent=G.player.nades;}
function hudHp(){document.getElementById("hp").textContent=Math.max(0,G.player.hp);document.getElementById("ar").textContent=G.player.armor;}
function hudAmmo(){const w=WEPS[G.player.weapon];document.getElementById("wlabel").textContent=w.name;document.getElementById("ammo").textContent=G.player.reloading?"...":G.player.ammo+"/"+w.mag;}
function hudMoney(){document.getElementById("money").textContent="$"+G.money;}
function updateTimer(){const s=G.freeze>0?Math.ceil(G.freeze):Math.max(0,Math.ceil(G.rTime));document.getElementById("timer").textContent=(G.freeze>0?"❄ ":"")+Math.floor(s/60)+":"+String(s%60).padStart(2,"0");}
function kfeed(k,v,hs){const el=document.getElementById("kfeed");const d=document.createElement("div");d.className="kf-item";d.textContent=`${k} [${WEPS[G.player.weapon].name}${hs?" HS":""}] ${v}`;el.appendChild(d);if(el.children.length>5)el.removeChild(el.firstChild);setTimeout(()=>{if(d.parentNode)d.remove();},4000);}
function toast(m,ms){const el=document.getElementById("cmsg");el.textContent=m;el.classList.add("show");clearTimeout(G._tt);G._tt=setTimeout(()=>el.classList.remove("show"),ms||800);}
function kick(){/* screen shake would go here */}
