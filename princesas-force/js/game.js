/* ============================================================
   PRINCESAS FORCE v4 — ENGINE (baseado no visual da referência)
   ============================================================ */
const Game={
  cv:null,ctx:null,W:0,H:0,dpr:1,map:null,pChar:null,
  cam:{x:0,y:0},units:[],bullets:[],nades:[],fx:[],txts:[],
  player:null,running:false,paused:false,t:0,last:0,
  round:1,sT:0,sCT:0,rTime:0,active:false,freeze:0,
  kills:0,earned:0,inv:["glock","knife"],curWep:"glock",
  MR:12,RSEC:55,FSEC:4,

  init(){
    this.cv=document.getElementById("game-canvas");
    this.ctx=this.cv.getContext("2d");
    window.addEventListener("resize",()=>this.resize());
    document.getElementById("btn-pause").addEventListener("click",()=>this.pause());
    document.getElementById("btn-resume").addEventListener("click",()=>this.resume());
    document.getElementById("btn-next-round").addEventListener("click",()=>this.nextRound());
    document.getElementById("buy-close").addEventListener("click",()=>this.closeBuy());
  },

  resize(){
    this.dpr=Math.min(devicePixelRatio||1,2);
    this.W=innerWidth;this.H=innerHeight;
    this.cv.width=this.W*this.dpr;this.cv.height=this.H*this.dpr;
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  },

  start(charId,mapId){
    this.pChar=CHARS.find(c=>c.id===charId)||CHARS[0];
    this.map=MAPS.find(m=>m.id===mapId)||MAPS[0];
    this.round=1;this.sT=0;this.sCT=0;
    Economy.reset();this.inv=["glock","knife"];this.curWep="glock";
    this.resize();Input.init();
    document.getElementById("btn-pause").style.display="block";
    this.running=true;this.paused=false;
    this.startRound();
    this.last=performance.now();
    requestAnimationFrame(ts=>this.loop(ts));
  },

  startRound(){
    this.units=[];this.bullets=[];this.nades=[];this.fx=[];this.txts=[];
    this.kills=0;this.earned=0;Input.reset();
    document.getElementById("kfeed").innerHTML="";
    const m=this.map;
    // Player (T team)
    const s0=m.spT[0];
    this.player=this.mkUnit(this.pChar,"t",s0.x,s0.y,true,this.curWep);
    this.player.inv=this.inv.slice();this.player.nades=1;
    this.units.push(this.player);
    // T bots
    for(let i=0;i<4;i++){
      const c=CHARS[(i+1)%CHARS.length];
      const sp=m.spT[(i+1)%m.spT.length];
      const w=["glock","ak47","m4a1","mp5","galil"][i%5];
      const u=this.mkUnit(c,"t",sp.x,sp.y,false,w);u.nades=1;this.units.push(u);
    }
    // CT bots
    for(let i=0;i<5;i++){
      const c=CHARS[(i+2)%CHARS.length];
      const sp=m.spCT[i%m.spCT.length];
      const w=["glock","m4a1","ak47","awp","p90","mp5"][i%6];
      const u=this.mkUnit(c,"ct",sp.x,sp.y,false,w);u.nades=1;this.units.push(u);
    }
    this.rTime=this.RSEC;this.freeze=this.FSEC;this.active=true;
    document.getElementById("rlabel").textContent="Round "+this.round;
    this.toast("FREEZE TIME",1200);
    this.hudAll();
  },

  mkUnit(ch,team,x,y,isP,wId){
    const w=WEAPONS[wId]||WEAPONS.glock;
    return{ch,team,x,y,r:15,angle:team==="t"?0:Math.PI,
      hp:ch.hp,maxHp:ch.hp,armor:0,spd:ch.spd,alive:true,
      wId,w,ammo:w.mag,mag:w.mag,reloading:false,relEnd:0,lastShot:0,
      isP,nades:0,inv:[wId,"knife"],
      ai:{dir:Math.random()*6.28,strafe:1,ns:0,pat:0},
      flash:0};
  },

  /* === LOOP === */
  loop(ts){
    if(!this.running)return;
    const dt=Math.min(50,ts-this.last);this.last=ts;this.t+=dt;
    if(!this.paused)this.update(dt);
    this.render();
    requestAnimationFrame(t=>this.loop(t));
  },

  update(dt){
    if(this.freeze>0){this.freeze-=dt/1000;if(this.freeze<=0){this.freeze=0;this.toast("GO GO GO!",700);}this.updCam();return;}
    if(this.active){this.rTime-=dt/1000;if(this.rTime<=0){this.rTime=0;this.endRound("time");}}
    Input.poll();
    if(Input.eatBuy())this.openBuy();
    if(Input.eatSwitch())this.switchWep();
    const nk=Input.eatNum();if(nk&&this.player.alive){const inv=this.player.inv;if(nk<=inv.length)this.equip(inv[nk-1]);}
    this.updPlayer(dt);
    for(const u of this.units)if(!u.isP&&u.alive)this.updBot(u,dt);
    this.updBullets(dt);this.updNades(dt);this.updFx(dt);
    this.updCam();
    if(this.active)this.checkWin();
  },

  switchWep(){if(!this.player.alive)return;const inv=this.player.inv;const i=(inv.indexOf(this.player.wId)+1)%inv.length;this.equip(inv[i]);},
  equip(wId){if(!WEAPONS[wId])return;this.player.wId=wId;this.player.w=WEAPONS[wId];this.player.ammo=WEAPONS[wId].mag;this.player.mag=WEAPONS[wId].mag;this.player.reloading=false;this.hudAmmo();},

  updPlayer(dt){
    const p=this.player;if(!p.alive)return;
    const mv=Input.move;const sm=p.w.type==="sniper"?.7:p.w.type==="lmg"?.75:1;
    if(mv.x||mv.y)this.moveU(p,mv.x*p.spd*sm,mv.y*p.spd*sm);
    // Aim
    if(Input.usingMouse&&Input.mouse.active){
      const wx=Input.mouse.x+this.cam.x,wy=Input.mouse.y+this.cam.y;
      p.angle=Math.atan2(wy-p.y,wx-p.x);
    }else{
      const tgt=this.nearest(p,600);
      if(Input.firing&&tgt)p.angle=Math.atan2(tgt.y-p.y,tgt.x-p.x);
      else if(mv.x||mv.y)p.angle=Math.atan2(mv.y,mv.x);
    }
    if(Input.eatReload())this.reload(p);
    if(Input.eatNade())this.throwNade(p);
    this.updReload(p);
    if(Input.firing)this.shoot(p);
    if(p.flash>0)p.flash-=dt;
  },

  updBot(u,dt){
    if(u.flash>0)u.flash-=dt;
    this.updReload(u);
    const e=this.nearest(u,900);
    if(e){
      const d=Math.hypot(e.x-u.x,e.y-u.y);
      const los=this.los(u,e);
      const da=Math.atan2(e.y-u.y,e.x-u.x);
      u.angle=this.lerpA(u.angle,da,.12+Math.random()*.04);
      if(los){
        const ideal=u.w.type==="sniper"?500:u.w.type==="smg"?180:u.w.type==="shotgun"?120:300;
        let mx=0,my=0;const dx=(e.x-u.x)/d,dy=(e.y-u.y)/d;
        if(d>ideal+50)mx=dx,my=dy;else if(d<ideal-50)mx=-dx,my=-dy;
        u.ai.ns-=dt;if(u.ai.ns<=0){u.ai.strafe=Math.random()<.5?1:-1;u.ai.ns=400+Math.random()*600;}
        mx+=(-dy)*u.ai.strafe*.5;my+=dx*u.ai.strafe*.5;
        const m=Math.hypot(mx,my)||1;this.moveU(u,(mx/m)*u.spd*.7,(my/m)*u.spd*.7);
        if(Math.abs(this.adiff(u.angle,da))<.25)this.shoot(u);
        if(u.nades>0&&Math.random()<.001&&d<300)this.throwNade(u);
      }else this.moveTo(u,e.x,e.y);
    }else{
      u.ai.pat-=dt;if(u.ai.pat<=0){const s=this.map.sites[Math.floor(Math.random()*this.map.sites.length)];
        u.ai.dir=Math.atan2(s.y-u.y,s.x-u.x);u.ai.pat=2000+Math.random()*3000;}
      this.moveU(u,Math.cos(u.ai.dir)*u.spd*.5,Math.sin(u.ai.dir)*u.spd*.5);u.angle=u.ai.dir;
    }
  },

  moveTo(u,tx,ty){const a=Math.atan2(ty-u.y,tx-u.x);const bx=u.x,by=u.y;
    this.moveU(u,Math.cos(a)*u.spd*.7,Math.sin(a)*u.spd*.7);
    if(Math.hypot(u.x-bx,u.y-by)<.4){const s=a+(Math.random()<.5?1.2:-1.2);this.moveU(u,Math.cos(s)*u.spd*.7,Math.sin(s)*u.spd*.7);}
    u.angle=a;},

  moveU(u,vx,vy){
    let nx=u.x+vx;if(!this.hitW(nx,u.y,u.r))u.x=nx;
    let ny=u.y+vy;if(!this.hitW(u.x,ny,u.r))u.y=ny;
    u.x=Math.max(u.r,Math.min(this.map.w-u.r,u.x));
    u.y=Math.max(u.r,Math.min(this.map.h-u.r,u.y));
  },
  hitW(cx,cy,r){for(const w of this.map.walls){const px=Math.max(w.x,Math.min(cx,w.x+w.w));const py=Math.max(w.y,Math.min(cy,w.y+w.h));if((cx-px)**2+(cy-py)**2<r*r)return true;}return false;},
  los(a,b){for(let i=1;i<18;i++){const x=a.x+(b.x-a.x)*(i/18),y=a.y+(b.y-a.y)*(i/18);for(const w of this.map.walls)if(x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h)return false;}return true;},
  nearest(u,md){let b=null,bd=md*md;for(const o of this.units){if(!o.alive||o.team===u.team)continue;const d=(o.x-u.x)**2+(o.y-u.y)**2;if(d<bd){bd=d;b=o;}}return b;},

  /* === SHOOT === */
  shoot(u){
    if(u.reloading)return;if(u.ammo<=0){this.reload(u);return;}
    if(this.t-u.lastShot<u.w.rate)return;
    if(!u.w.auto&&u.isP&&this._semi)return;
    if(u.w.melee){this.melee(u);u.lastShot=this.t;if(!u.w.auto&&u.isP)this._semi=true;return;}
    u.lastShot=this.t;u.ammo--;
    const moving=(u.isP&&(Input.move.x||Input.move.y))?1.5:1;
    const pellets=u.w.pellets||1;
    for(let p=0;p<pellets;p++){
      const sp=(Math.random()-.5)*2*u.w.spr*moving;
      const a=u.angle+sp;const mx=u.x+Math.cos(a)*(u.r+10),my=u.y+Math.sin(a)*(u.r+10);
      this.bullets.push({x:mx,y:my,vx:Math.cos(a)*u.w.spd,vy:Math.sin(a)*u.w.spd,dmg:u.w.dmg,team:u.team,life:u.w.rng/u.w.spd,owner:u});
    }
    this.fxMuzzle(u.x+Math.cos(u.angle)*(u.r+10),u.y+Math.sin(u.angle)*(u.r+10));
    if(u.isP){this.hudAmmo();this.kick();}
    if(!u.w.auto&&u.isP)this._semi=true;
  },
  melee(u){for(const o of this.units){if(!o.alive||o.team===u.team)continue;const d=Math.hypot(o.x-u.x,o.y-u.y);const ad=Math.abs(this.adiff(u.angle,Math.atan2(o.y-u.y,o.x-u.x)));if(d<u.w.rng&&ad<.8){this.dmg(o,u.w.dmg,u,false);break;}}},
  reload(u){if(u.reloading||u.ammo===u.mag||u.w.melee)return;u.reloading=true;u.relEnd=this.t+u.w.rel;if(u.isP)this.toast("Reloading...",400);},
  updReload(u){if(u.reloading&&this.t>=u.relEnd){u.reloading=false;u.ammo=u.mag;if(u.isP)this.hudAmmo();}if(u.isP&&!Input.firing)this._semi=false;},

  updBullets(dt){
    const s=dt/16.67;
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i];b.x+=b.vx*s;b.y+=b.vy*s;b.life-=s;let dead=b.life<=0;
      if(!dead){for(const w of this.map.walls){if(b.x>w.x&&b.x<w.x+w.w&&b.y>w.y&&b.y<w.y+w.h){dead=true;this.fxSpark(b.x,b.y);break;}}}
      if(!dead){for(const u of this.units){if(!u.alive||u.team===b.team)continue;if((u.x-b.x)**2+(u.y-b.y)**2<(u.r+4)**2){
        const hs=b.y<u.y-u.r*.3&&Math.random()<.3;
        this.dmg(u,hs?Math.floor(b.dmg*2.5):b.dmg,b.owner,hs);this.fxBlood(b.x,b.y);dead=true;break;}}}
      if(dead)this.bullets.splice(i,1);
    }
  },

  dmg(u,d,owner,hs){
    if(!u.alive)return;let ad=d;if(u.armor>0){const ab=Math.min(u.armor,Math.floor(d*.5));u.armor-=ab;ad=d-ab;}
    u.hp-=ad;u.flash=120;this.ftext(u.x,u.y-u.r-8,(hs?`HS -${ad}`:`-${ad}`),hs?"#ff0000":"#ffcc00");
    if(u.hp<=0){u.alive=false;u.hp=0;this.fxDeath(u.x,u.y);
      if(owner){this.kfeed(owner,u,hs);if(owner.isP){this.kills++;const kr=owner.w.kr||300;Economy.earn(kr);this.earned+=kr;this.ftext(u.x,u.y-28,`+$${kr}`,"#8bc34a");this.hudMoney();}}}
    if(u.isP)this.hudHp();
  },

  kfeed(k,v,hs){const msg=`${k.ch.name} [${k.w.name}${hs?" HS":""}] ${v.ch.name}`;
    const el=document.getElementById("kfeed");const d=document.createElement("div");d.className="kf-msg";
    d.style.borderLeft=`2px solid ${k.team==="t"?"#cc4444":"#4488cc"}`;d.textContent=msg;
    el.appendChild(d);if(el.children.length>5)el.removeChild(el.firstChild);
    setTimeout(()=>{if(d.parentNode)d.remove();},5000);
  },

  throwNade(u){if(u.nades<=0)return;u.nades--;if(u.isP)document.getElementById("nade-c").textContent=u.nades;
    const a=u.angle;this.nades.push({x:u.x+Math.cos(a)*(u.r+8),y:u.y+Math.sin(a)*(u.r+8),vx:Math.cos(a)*GRENADE.spd,vy:Math.sin(a)*GRENADE.spd,fuse:GRENADE.fuse,team:u.team,owner:u,spin:0});
    if(u.isP)this.toast("Fire in the hole!",400);},
  updNades(dt){const s=dt/16.67;for(let i=this.nades.length-1;i>=0;i--){const g=this.nades[i];
    g.x+=g.vx*s;g.y+=g.vy*s;g.vx*=.94;g.vy*=.94;g.spin+=.15*s;
    if(this.hitW(g.x,g.y,6)){g.x-=g.vx*s;g.y-=g.vy*s;g.vx*=-.3;g.vy*=-.3;}
    g.fuse-=dt;if(g.fuse<=0){this.explode(g);this.nades.splice(i,1);}}},
  explode(g){this.fxExplosion(g.x,g.y);for(const u of this.units){if(!u.alive)continue;const d=Math.hypot(u.x-g.x,u.y-g.y);if(d<GRENADE.radius&&this.los(g,u)){const dm=Math.round(GRENADE.dmg*(1-d/GRENADE.radius));if(dm>0)this.dmg(u,dm,g.owner,false);}}},

  /* === FX === */
  fxMuzzle(x,y){for(let i=0;i<3;i++)this.fx.push({x,y,vx:(Math.random()-.5)*3,vy:(Math.random()-.5)*3,l:80,ml:80,r:2+Math.random()*2,c:"#ffdd44"});},
  fxSpark(x,y){for(let i=0;i<3;i++)this.fx.push({x,y,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,l:120,ml:120,r:2+Math.random()*2,c:"#ffa500"});},
  fxBlood(x,y){for(let i=0;i<4;i++)this.fx.push({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*5,l:250,ml:250,r:2+Math.random()*3,c:"#cc0000"});},
  fxDeath(x,y){for(let i=0;i<10;i++){const a=Math.random()*6.28,s=2+Math.random()*4;this.fx.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:400,ml:400,r:3+Math.random()*3,c:"#880000"});}},
  fxExplosion(x,y){for(let i=0;i<20;i++){const a=Math.random()*6.28,s=3+Math.random()*6;this.fx.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,l:400,ml:400,r:4+Math.random()*5,c:["#ff4400","#ffaa00","#ffdd00","#444"][Math.random()*4|0]});}},
  ftext(x,y,t,c){this.txts.push({x,y,t,c,l:800,ml:800});},
  updFx(dt){const s=dt/16.67;for(let i=this.fx.length-1;i>=0;i--){const p=this.fx[i];p.x+=p.vx*s;p.y+=p.vy*s;p.vx*=.92;p.vy*=.92;p.l-=dt;if(p.l<=0)this.fx.splice(i,1);}
    for(let i=this.txts.length-1;i>=0;i--){this.txts[i].y-=.5*s;this.txts[i].l-=dt;if(this.txts[i].l<=0)this.txts.splice(i,1);}},

  /* === CAMERA === */
  updCam(){const tx=this.player.x-this.W/2,ty=this.player.y-this.H/2;this.cam.x+=(tx-this.cam.x)*.12;this.cam.y+=(ty-this.cam.y)*.12;
    this.cam.x=Math.max(0,Math.min(this.map.w-this.W,this.cam.x));this.cam.y=Math.max(0,Math.min(this.map.h-this.H,this.cam.y));
    if(this.map.w<this.W)this.cam.x=(this.map.w-this.W)/2;if(this.map.h<this.H)this.cam.y=(this.map.h-this.H)/2;},

  /* === WIN === */
  checkWin(){const ta=this.units.some(u=>u.team==="t"&&u.alive),ca=this.units.some(u=>u.team==="ct"&&u.alive);if(!ta)this.endRound("ct");else if(!ca)this.endRound("t");},
  endRound(w){if(!this.active)return;this.active=false;let title,won=false;
    if(w==="t"){this.sT++;title="TERRORISTS WIN";won=true;Economy.loseStreak=0;}
    else if(w==="ct"){this.sCT++;title="COUNTER-TERRORISTS WIN";Economy.loseStreak++;}
    else{if(this.player.alive){this.sT++;title="TIME - T WIN";won=true;Economy.loseStreak=0;}else{this.sCT++;title="TIME - CT WIN";Economy.loseStreak++;}}
    const rr=won?Economy.WIN:Economy.getLoss();Economy.earn(rr);this.earned+=rr;this.hudMoney();
    document.getElementById("s-t").textContent=this.sT;document.getElementById("s-ct").textContent=this.sCT;
    const mo=this.sT>this.MR/2||this.sCT>this.MR/2;
    setTimeout(()=>{
      document.getElementById("end-title").textContent=mo?(this.sT>this.sCT?"MATCH WON 🏆":"MATCH LOST"):title;
      document.getElementById("end-sub").textContent=mo?`Final: ${this.sT}-${this.sCT}`:`Score: ${this.sT}-${this.sCT}`;
      document.getElementById("end-money").textContent=`+$${this.earned} (${this.kills} kills)`;
      document.getElementById("btn-next-round").textContent=mo?"NEW MATCH":"NEXT ROUND";
      this._mo=mo;document.getElementById("ov-end").classList.remove("hid");
    },1000);
  },
  nextRound(){document.getElementById("ov-end").classList.add("hid");if(this._mo){this.sT=0;this.sCT=0;this.round=0;Economy.reset();this.inv=["glock","knife"];this.curWep="glock";}this.round++;this.startRound();},

  /* === BUY MENU === */
  openBuy(){const ov=document.getElementById("ov-buy");if(!ov.classList.contains("hid")){this.closeBuy();return;}this.paused=true;
    document.getElementById("buy-bal").textContent="$"+Economy.money;
    const g=document.getElementById("buygrid");g.innerHTML="";
    const cats=[{l:"Pistols",ws:["glock","usp","deagle"]},{l:"SMGs",ws:["mac10","mp5","p90"]},{l:"Rifles",ws:["galil","famas","ak47","m4a1"]},{l:"Snipers",ws:["scout","awp"]},{l:"Heavy",ws:["nova","m249"]}];
    for(const cat of cats){const h=document.createElement("div");h.className="buy-cat";h.textContent=cat.l;g.appendChild(h);
      for(const id of cat.ws){const w=WEAPONS[id];const inInv=this.inv.includes(id);const can=Economy.money>=w.price;
        const d=document.createElement("div");d.className="buy-it"+(inInv?" own":"")+((!can&&!inInv)?" lock":"");
        d.innerHTML=`<div class="bn">${w.name}</div><div class="bp">${w.price>0?"$"+w.price:"FREE"}</div><div class="bs">DMG:${w.dmg} ${w.auto?"AUTO":"SEMI"} ${w.mag}rds</div>`;
        if(!inInv&&can&&w.price>0){d.addEventListener("click",()=>{if(Economy.spend(w.price)){this.inv.push(id);this.player.inv=this.inv.slice();this.curWep=id;this.equip(id);this.hudMoney();this.openBuy();}});}
        else if(inInv){d.addEventListener("click",()=>{this.curWep=id;this.equip(id);this.closeBuy();});}
        g.appendChild(d);}}
    ov.classList.remove("hid");},
  closeBuy(){document.getElementById("ov-buy").classList.add("hid");this.paused=false;},

  pause(){if(!this.active)return;this.paused=true;document.getElementById("ov-pause").classList.remove("hid");},
  resume(){this.paused=false;document.getElementById("ov-pause").classList.add("hid");},
  stop(){this.running=false;document.getElementById("btn-pause").style.display="none";},
  toast(m,ms){const el=document.getElementById("cmsg");el.textContent=m;el.classList.add("show");clearTimeout(this._tt);this._tt=setTimeout(()=>el.classList.remove("show"),ms||800);},

  /* === HUD === */
  hudAll(){document.getElementById("s-t").textContent=this.sT;document.getElementById("s-ct").textContent=this.sCT;this.hudHp();this.hudAmmo();this.hudMoney();document.getElementById("nade-c").textContent=this.player.nades;this._timerLoop();},
  _timerLoop(){if(this._tr)cancelAnimationFrame(this._tr);const tick=()=>{const s=this.freeze>0?Math.ceil(this.freeze):Math.max(0,Math.ceil(this.rTime));
    document.getElementById("timer").textContent=(this.freeze>0?"❄ ":"")+Math.floor(s/60)+":"+String(s%60).padStart(2,"0");if(this.running)this._tr=requestAnimationFrame(tick);};tick();},
  hudHp(){const p=this.player;if(!p)return;document.getElementById("hp-val").textContent=Math.max(0,Math.round(p.hp));document.getElementById("ar-val").textContent=Math.max(0,p.armor);},
  hudAmmo(){const p=this.player;if(!p)return;document.getElementById("wep-name").textContent=p.w.name;document.getElementById("ammo-c").textContent=p.w.melee?"∞":p.reloading?"...":p.ammo;document.getElementById("ammo-m").textContent=p.w.melee?"":p.mag;},
  hudMoney(){document.getElementById("money-ig").textContent="$"+Economy.money;},
  kick(){const b=document.getElementById("btn-fire");if(b){b.style.transform="scale(.88)";clearTimeout(this._kt);this._kt=setTimeout(()=>b.style.transform="",50);}},

  /* === UTIL === */
  adiff(a,b){let d=b-a;while(d>Math.PI)d-=6.28;while(d<-Math.PI)d+=6.28;return d;},
  lerpA(a,b,t){return a+this.adiff(a,b)*t;},

  /* ============ RENDER ============ */
  render(){
    const c=this.ctx;c.clearRect(0,0,this.W,this.H);
    c.save();c.translate(-this.cam.x,-this.cam.y);
    this.rFloor(c);this.rSites(c);this.rWalls(c);this.rNades(c);this.rBullets(c);
    for(const u of this.units)if(!u.alive)this.rDead(c,u);
    for(const u of this.units)if(u.alive)this.rUnit(c,u);
    this.rFx(c);this.rTxts(c);
    c.restore();
    this.rRadar();this.rCross(c);
  },

  rFloor(c){
    const m=this.map,s=64;c.fillStyle=m.floorA;c.fillRect(0,0,m.w,m.h);
    c.fillStyle=m.floorB;
    const x0=Math.floor(this.cam.x/s)*s,y0=Math.floor(this.cam.y/s)*s;
    for(let x=x0;x<this.cam.x+this.W+s;x+=s)for(let y=y0;y<this.cam.y+this.H+s;y+=s)
      if(((x/s|0)+(y/s|0))%2===0)c.fillRect(x,y,s,s);
  },
  rSites(c){for(const s of this.map.sites){c.save();c.strokeStyle="rgba(255,255,0,.3)";c.lineWidth=2;c.setLineDash([6,6]);c.beginPath();c.arc(s.x,s.y,70,0,6.28);c.stroke();c.setLineDash([]);c.restore();
    c.fillStyle="rgba(255,255,0,.6)";c.font="bold 28px monospace";c.textAlign="center";c.textBaseline="middle";c.fillText(s.l,s.x,s.y);}},
  rWalls(c){const m=this.map;for(const w of m.walls){c.fillStyle="rgba(0,0,0,.2)";c.fillRect(w.x+2,w.y+2,w.w,w.h);c.fillStyle=m.wallFill;c.fillRect(w.x,w.y,w.w,w.h);c.strokeStyle=m.wallStroke;c.lineWidth=1;c.strokeRect(w.x,w.y,w.w,w.h);c.fillStyle="rgba(255,255,255,.06)";c.fillRect(w.x,w.y,w.w,Math.min(3,w.h));}},
  rBullets(c){for(const b of this.bullets){c.save();c.fillStyle="#ffdd44";c.shadowColor="#ffdd44";c.shadowBlur=5;c.beginPath();c.arc(b.x,b.y,2.5,0,6.28);c.fill();c.globalAlpha=.3;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-b.vx,b.y-b.vy);c.strokeStyle="#ffdd44";c.lineWidth=1.5;c.stroke();c.restore();}},
  rNades(c){for(const g of this.nades){c.save();c.translate(g.x,g.y);c.rotate(g.spin);c.fillStyle="#3a5a3a";c.beginPath();c.arc(0,0,6,0,6.28);c.fill();c.fillStyle="#2a4a2a";c.fillRect(-1.5,-8,3,4);if(g.fuse<400&&(this.t/80|0)%2){c.fillStyle="#f00";c.beginPath();c.arc(0,-8,2.5,0,6.28);c.fill();}c.restore();}},
  rUnit(c,u){if(u.flash>0){c.save();c.globalAlpha=.3;c.beginPath();c.arc(u.x,u.y,u.r+6,0,6.28);c.fillStyle="#f44";c.fill();c.restore();}
    drawChar(c,u.x,u.y,u.r,u.ch,u.angle,u.team,u.isP,u.isP?(Input.move.x||Input.move.y):true,this.t);
    // HP bar
    const bw=30,bx=u.x-bw/2,by=u.y-u.r-10;
    c.fillStyle="rgba(0,0,0,.5)";c.fillRect(bx,by,bw,3);
    const hp=Math.max(0,u.hp/u.maxHp);c.fillStyle=hp>.5?"#44cc44":hp>.25?"#ffaa00":"#ff2222";c.fillRect(bx,by,bw*hp,3);
  },
  rDead(c,u){c.save();c.globalAlpha=.25;c.fillStyle="#600";c.beginPath();c.arc(u.x,u.y,5,0,6.28);c.fill();c.restore();},
  rFx(c){for(const p of this.fx){const a=Math.max(0,p.l/p.ml);c.save();c.globalAlpha=a;c.fillStyle=p.c;c.beginPath();c.arc(p.x,p.y,p.r*a,0,6.28);c.fill();c.restore();}},
  rTxts(c){for(const t of this.txts){c.save();c.globalAlpha=Math.max(0,t.l/t.ml);c.fillStyle=t.c;c.strokeStyle="rgba(0,0,0,.7)";c.lineWidth=2;c.font="bold 12px monospace";c.textAlign="center";c.strokeText(t.t,t.x,t.y);c.fillText(t.t,t.x,t.y);c.restore();}},

  rRadar(){
    const rc=document.getElementById("radar");const ctx=rc.getContext("2d");
    const rw=120,rh=120;rc.width=rw*2;rc.height=rh*2;ctx.setTransform(2,0,0,2,0,0);
    ctx.clearRect(0,0,rw,rh);ctx.fillStyle="rgba(0,0,0,.4)";ctx.fillRect(0,0,rw,rh);
    const sx=rw/this.map.w,sy=rh/this.map.h;
    ctx.fillStyle=this.map.wallFill;for(const w of this.map.walls)ctx.fillRect(w.x*sx,w.y*sy,Math.max(1,w.w*sx),Math.max(1,w.h*sy));
    for(const s of this.map.sites){ctx.fillStyle="rgba(255,255,0,.5)";ctx.font="bold 8px monospace";ctx.textAlign="center";ctx.fillText(s.l,s.x*sx,s.y*sy+3);}
    for(const u of this.units){if(!u.alive)continue;ctx.fillStyle=u.isP?"#fff":(u.team==="t"?"#ff4444":"#4488ff");ctx.beginPath();ctx.arc(u.x*sx,u.y*sy,u.isP?3:2,0,6.28);ctx.fill();}
  },

  rCross(c){
    if(!this.player.alive)return;const cx=this.W/2,cy=this.H/2;
    c.save();c.strokeStyle="rgba(0,255,0,.7)";c.lineWidth=1.5;
    const g=5,l=10;
    c.beginPath();c.moveTo(cx-g-l,cy);c.lineTo(cx-g,cy);c.stroke();
    c.beginPath();c.moveTo(cx+g,cy);c.lineTo(cx+g+l,cy);c.stroke();
    c.beginPath();c.moveTo(cx,cy-g-l);c.lineTo(cx,cy-g);c.stroke();
    c.beginPath();c.moveTo(cx,cy+g);c.lineTo(cx,cy+g+l);c.stroke();
    c.beginPath();c.arc(cx,cy,1,0,6.28);c.fillStyle="rgba(0,255,0,.5)";c.fill();
    c.restore();
  }
};
