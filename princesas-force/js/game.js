/* ============================================================
   PRINCESAS FORCE — MOTOR DO JOGO COMPLETO
   Loop, jogador, IA, combate, economia, granadas, efeitos, rounds
   ============================================================ */
const Game = {
  canvas:null, ctx:null, W:0, H:0, dpr:1,
  map:null, playerChar:null, playerWeapon:null,
  cam:{x:0,y:0},
  units:[], bullets:[], grenades:[], particles:[], texts:[],
  player:null,
  running:false, paused:false,
  t:0, last:0,
  round:1, scorePink:0, scoreBlue:0,
  roundTime:0, roundActive:false,
  MAX_SCORE:4, ROUND_SECONDS:50,
  killsThisRound:0, moneyEarnedThisRound:0,
  killFeed:[],

  init(){
    this.canvas=document.getElementById("game-canvas");
    this.ctx=this.canvas.getContext("2d");
    window.addEventListener("resize",()=>this.resize());
    document.getElementById("btn-pause").addEventListener("click",()=>this.pause());
    document.getElementById("resume").addEventListener("click",()=>this.resume());
    document.getElementById("result-next").addEventListener("click",()=>this.nextRound());
    document.getElementById("buy-close").addEventListener("click",()=>this.closeBuyMenu());
  },

  resize(){
    this.dpr=Math.min(window.devicePixelRatio||1,2);
    this.W=window.innerWidth;this.H=window.innerHeight;
    this.canvas.width=this.W*this.dpr;this.canvas.height=this.H*this.dpr;
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  },

  start(charId,weaponId,mapId){
    this.playerChar=PRINCESSES.find(p=>p.id===charId)||PRINCESSES[0];
    this.playerWeapon=weaponId;
    this.map=MAPS.find(m=>m.id===mapId)||MAPS[0];
    this.round=1;this.scorePink=0;this.scoreBlue=0;
    this.resize();
    Input.init();
    document.getElementById("btn-pause").style.display="block";
    this.running=true;this.paused=false;
    this.startRound();
    this.last=performance.now();
    requestAnimationFrame((ts)=>this.loop(ts));
  },

  /* =========== ROUND =========== */
  startRound(){
    this.units=[];this.bullets=[];this.grenades=[];this.particles=[];this.texts=[];
    this.killFeed=[];this.killsThisRound=0;this.moneyEarnedThisRound=0;
    Input.reset();
    document.getElementById("kill-feed").innerHTML="";

    // Player (time rosa)
    const sp=this.map.spawnsPink[0];
    this.player=this.makeUnit(this.playerChar,"pink",sp.x,sp.y,true,this.playerWeapon);
    this.units.push(this.player);
    // Aliadas
    const allies=PRINCESSES.filter(p=>p.id!==this.playerChar.id);
    for(let i=0;i<2;i++){
      const c=allies[i%allies.length];
      const s=this.map.spawnsPink[(i+1)%this.map.spawnsPink.length];
      const wkeys=Object.keys(WEAPONS);
      this.units.push(this.makeUnit(c,"pink",s.x,s.y,false,wkeys[Math.floor(Math.random()*3)]));
    }
    // Inimigas (time azul)
    for(let i=0;i<3;i++){
      const c=PRINCESSES[(i+2)%PRINCESSES.length];
      const s=this.map.spawnsBlue[i%this.map.spawnsBlue.length];
      const wkeys=Object.keys(WEAPONS);
      this.units.push(this.makeUnit(c,"blue",s.x,s.y,false,wkeys[1+Math.floor(Math.random()*4)]));
    }
    this.roundTime=this.ROUND_SECONDS;
    this.roundActive=true;
    document.getElementById("round-label").textContent=`Round ${this.round}/${this.MAX_SCORE*2-1}`;
    this.showToast(`Round ${this.round} — Vai! 💖`,1200);
    this.updateAllHUD();
  },

  makeUnit(char,team,x,y,isPlayer,weaponId){
    const wId=weaponId||"pistola_coracao";
    const w=WEAPONS[wId]||WEAPONS.pistola_coracao;
    return{
      char,team,x,y,r:18,angle:team==="pink"?0:Math.PI,
      hp:char.hp,maxHp:char.hp,speed:char.speed,alive:true,
      weaponId:wId,w,
      ammo:w.mag,mag:w.mag,reloading:false,reloadEnd:0,lastShot:0,
      isPlayer,nades:2,
      ai:{state:"hunt",target:null,repath:0,dir:Math.random()*Math.PI*2,strafe:1,nextStrafe:0},
      hitFlash:0, deathTime:0
    };
  },

  /* =========== LOOP =========== */
  loop(ts){
    if(!this.running) return;
    const dt=Math.min(50,ts-this.last);
    this.last=ts;this.t+=dt;
    if(!this.paused) this.update(dt);
    this.render();
    requestAnimationFrame((t)=>this.loop(t));
  },

  update(dt){
    if(this.roundActive){
      this.roundTime-=dt/1000;
      if(this.roundTime<=0){this.roundTime=0;this.endRound("time");}
    }
    Input.pollKeyboard();
    if(Input.consumeBuy()&&this.roundActive) this.openBuyMenu();
    this.updatePlayer(dt);
    for(const u of this.units) if(!u.isPlayer&&u.alive) this.updateBot(u,dt);
    this.updateBullets(dt);
    this.updateGrenades(dt);
    this.updateParticles(dt);
    this.updateCamera();
    if(this.roundActive) this.checkWin();
    this.cleanKillFeed();
  },

  /* =========== JOGADOR =========== */
  updatePlayer(dt){
    const p=this.player;if(!p.alive) return;
    const mv=Input.move;
    if(mv.x||mv.y) this.moveUnit(p,mv.x*p.speed,mv.y*p.speed);
    // Mira
    if(Input.usingMouseAim&&Input.mouse.active){
      const wx=Input.mouse.x+this.cam.x, wy=Input.mouse.y+this.cam.y;
      p.angle=Math.atan2(wy-p.y,wx-p.x);
    }else{
      const tgt=this.nearestEnemy(p,700);
      if(Input.firing&&tgt) p.angle=Math.atan2(tgt.y-p.y,tgt.x-p.x);
      else if(mv.x||mv.y) p.angle=Math.atan2(mv.y,mv.x);
    }
    if(Input.consumeReload()) this.startReload(p);
    if(Input.consumeNade()) this.throwGrenade(p);
    this.updateReload(p);
    if(Input.firing) this.tryShoot(p);
    if(p.hitFlash>0) p.hitFlash-=dt;
  },

  /* =========== IA BOTS =========== */
  updateBot(u,dt){
    if(u.hitFlash>0) u.hitFlash-=dt;
    this.updateReload(u);
    const enemy=this.nearestEnemy(u,900);
    u.ai.target=enemy;
    if(enemy){
      const dist=Math.hypot(enemy.x-u.x,enemy.y-u.y);
      const los=this.lineOfSight(u,enemy);
      const desired=Math.atan2(enemy.y-u.y,enemy.x-u.x);
      u.angle=this.lerpAngle(u.angle,desired,0.16);
      if(los){
        const ideal=u.w.type==="sniper"?500:u.w.type==="smg"?200:u.w.type==="shotgun"?150:320;
        let mx=0,my=0;
        const dirx=(enemy.x-u.x)/(dist||1),diry=(enemy.y-u.y)/(dist||1);
        if(dist>ideal+50){mx=dirx;my=diry;}
        else if(dist<ideal-50){mx=-dirx;my=-diry;}
        u.ai.nextStrafe-=dt;
        if(u.ai.nextStrafe<=0){u.ai.strafe=Math.random()<.5?1:-1;u.ai.nextStrafe=500+Math.random()*800;}
        mx+=(-diry)*u.ai.strafe*0.6;my+=dirx*u.ai.strafe*0.6;
        const m=Math.hypot(mx,my)||1;
        this.moveUnit(u,(mx/m)*u.speed*0.8,(my/m)*u.speed*0.8);
        if(Math.abs(this.angleDiff(u.angle,desired))<0.3) this.tryShoot(u);
        if(u.nades>0&&Math.random()<0.001&&dist<250) this.throwGrenade(u);
      }else this.moveTowards(u,enemy.x,enemy.y,dt);
    }else{
      u.ai.repath-=dt;
      if(u.ai.repath<=0){u.ai.dir=Math.random()*Math.PI*2;u.ai.repath=600+Math.random()*1000;}
      this.moveUnit(u,Math.cos(u.ai.dir)*u.speed*0.5,Math.sin(u.ai.dir)*u.speed*0.5);
      u.angle=u.ai.dir;
    }
  },

  moveTowards(u,tx,ty,dt){
    const ang=Math.atan2(ty-u.y,tx-u.x);
    const before={x:u.x,y:u.y};
    this.moveUnit(u,Math.cos(ang)*u.speed*0.75,Math.sin(ang)*u.speed*0.75);
    if(Math.hypot(u.x-before.x,u.y-before.y)<0.5){
      const side=ang+(Math.random()<.5?1.3:-1.3);
      this.moveUnit(u,Math.cos(side)*u.speed*0.75,Math.sin(side)*u.speed*0.75);
    }
    u.angle=ang;
  },

  /* =========== FÍSICA =========== */
  moveUnit(u,vx,vy){
    let nx=u.x+vx;
    if(!this.hitsWall(nx,u.y,u.r)) u.x=nx;
    let ny=u.y+vy;
    if(!this.hitsWall(u.x,ny,u.r)) u.y=ny;
    u.x=Math.max(u.r,Math.min(this.map.width-u.r,u.x));
    u.y=Math.max(u.r,Math.min(this.map.height-u.r,u.y));
  },

  hitsWall(cx,cy,r){
    for(const w of this.map.walls){
      const px=Math.max(w.x,Math.min(cx,w.x+w.w));
      const py=Math.max(w.y,Math.min(cy,w.y+w.h));
      if((cx-px)**2+(cy-py)**2<r*r) return true;
    }
    return false;
  },

  lineOfSight(a,b){
    const steps=18;
    for(let i=1;i<steps;i++){
      const x=a.x+(b.x-a.x)*(i/steps), y=a.y+(b.y-a.y)*(i/steps);
      for(const w of this.map.walls)
        if(x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h) return false;
    }
    return true;
  },

  nearestEnemy(u,maxDist){
    let best=null,bd=maxDist*maxDist;
    for(const o of this.units){
      if(!o.alive||o.team===u.team) continue;
      const d=(o.x-u.x)**2+(o.y-u.y)**2;
      if(d<bd){bd=d;best=o;}
    }
    return best;
  },

  /* =========== TIRO =========== */
  tryShoot(u){
    const now=this.t;
    if(u.reloading) return;
    if(u.ammo<=0){this.startReload(u);return;}
    if(now-u.lastShot<u.w.fireRate) return;
    if(!u.w.auto&&u.isPlayer&&this._semiLock) return;
    u.lastShot=now; u.ammo--;
    const pellets=u.w.pellets||1;
    for(let p=0;p<pellets;p++){
      const spread=(Math.random()-.5)*2*u.w.spread;
      const ang=u.angle+spread;
      const mx=u.x+Math.cos(ang)*(u.r+8), my=u.y+Math.sin(ang)*(u.r+8);
      this.bullets.push({x:mx,y:my,vx:Math.cos(ang)*u.w.bulletSpeed,vy:Math.sin(ang)*u.w.bulletSpeed,
        dmg:u.w.damage,team:u.team,life:u.w.range/u.w.bulletSpeed,color:u.w.color,owner:u});
    }
    this.spawnMuzzle(u.x+Math.cos(u.angle)*(u.r+8),u.y+Math.sin(u.angle)*(u.r+8),u.w.color);
    if(u.isPlayer){this.updateAmmoHUD();this.kick();}
    if(!u.w.auto&&u.isPlayer) this._semiLock=true;
  },

  startReload(u){
    if(u.reloading||u.ammo===u.mag) return;
    u.reloading=true;u.reloadEnd=this.t+u.w.reload;
    if(u.isPlayer) this.showToast("Recarregando... 🔄",600);
  },
  updateReload(u){
    if(u.reloading&&this.t>=u.reloadEnd){u.reloading=false;u.ammo=u.mag;if(u.isPlayer) this.updateAmmoHUD();}
    if(u.isPlayer&&!Input.firing) this._semiLock=false;
  },

  updateBullets(dt){
    const step=dt/16.67;
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i];
      b.x+=b.vx*step;b.y+=b.vy*step;b.life-=step;
      let dead=b.life<=0;
      if(!dead){
        for(const w of this.map.walls){
          if(b.x>w.x&&b.x<w.x+w.w&&b.y>w.y&&b.y<w.y+w.h){dead=true;this.spawnHit(b.x,b.y,"#fff");break;}
        }
      }
      if(!dead){
        for(const u of this.units){
          if(!u.alive||u.team===b.team) continue;
          if((u.x-b.x)**2+(u.y-b.y)**2<(u.r+5)**2){
            this.damage(u,b.dmg,b.owner);this.spawnHit(b.x,b.y,"#ff5fa2");dead=true;break;
          }
        }
      }
      if(dead) this.bullets.splice(i,1);
    }
  },

  damage(u,dmg,owner){
    if(!u.alive) return;
    u.hp-=dmg;u.hitFlash=150;
    this.floatText(u.x,u.y-u.r-10,"-"+dmg,"#ff2d7a");
    if(u.hp<=0){
      u.alive=false;u.hp=0;u.deathTime=this.t;
      this.spawnDeath(u.x,u.y);
      if(owner){
        this.addKillFeed(owner,u);
        if(owner.isPlayer){
          this.killsThisRound++;
          const reward=Economy.KILL_REWARD;
          Economy.earn(reward);
          this.moneyEarnedThisRound+=reward;
          this.floatText(u.x,u.y-30,`+${reward}💰`,"#ffd23f");
          this.updateMoneyHUD();
        }
      }
    }
    if(u.isPlayer) this.updateHealthHUD();
  },

  /* =========== KILL FEED =========== */
  addKillFeed(killer,victim){
    const msg=`${killer.char.emoji} ${killer.char.name} ➜ ${victim.char.emoji} ${victim.char.name}`;
    this.killFeed.push({msg,time:this.t});
    const el=document.getElementById("kill-feed");
    const div=document.createElement("div");
    div.className="kill-msg";div.textContent=msg;
    el.appendChild(div);
    if(el.children.length>5) el.removeChild(el.firstChild);
  },
  cleanKillFeed(){
    const el=document.getElementById("kill-feed");
    while(el.firstChild&&this.killFeed.length>0&&this.t-this.killFeed[0].time>4000){
      this.killFeed.shift();el.removeChild(el.firstChild);
    }
  },

  /* =========== GRANADA =========== */
  throwGrenade(u){
    if(u.nades<=0) return;
    u.nades--;
    if(u.isPlayer) document.getElementById("nade-count").textContent=u.nades;
    const ang=u.angle;
    this.grenades.push({x:u.x+Math.cos(ang)*(u.r+6),y:u.y+Math.sin(ang)*(u.r+6),
      vx:Math.cos(ang)*GRENADE.throwSpeed,vy:Math.sin(ang)*GRENADE.throwSpeed,
      fuse:GRENADE.fuse,team:u.team,owner:u,spin:0});
    if(u.isPlayer) this.showToast("Granada Cupcake! 🧁",600);
  },

  updateGrenades(dt){
    const step=dt/16.67;
    for(let i=this.grenades.length-1;i>=0;i--){
      const g=this.grenades[i];
      g.x+=g.vx*step;g.y+=g.vy*step;
      g.vx*=0.95;g.vy*=0.95;g.spin+=0.2*step;
      if(this.hitsWall(g.x,g.y,9)){g.x-=g.vx*step;g.y-=g.vy*step;g.vx*=-0.4;g.vy*=-0.4;}
      g.fuse-=dt;
      if(g.fuse<=0){this.explode(g);this.grenades.splice(i,1);}
    }
  },

  explode(g){
    this.spawnExplosion(g.x,g.y);
    for(const u of this.units){
      if(!u.alive) continue;
      const d=Math.hypot(u.x-g.x,u.y-g.y);
      if(d<GRENADE.radius){
        const dmg=Math.round(GRENADE.damage*(1-d/GRENADE.radius));
        if(dmg>0) this.damage(u,dmg,g.owner);
      }
    }
  },

  /* =========== EFEITOS =========== */
  spawnMuzzle(x,y,color){
    for(let i=0;i<5;i++)
      this.particles.push({x,y,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,life:180,max:180,r:3+Math.random()*3,color,kind:"spark"});
  },
  spawnHit(x,y,color){
    const emojis=["💗","✨","💕","⭐","🌸"];
    for(let i=0;i<7;i++)
      this.particles.push({x,y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*5,life:400,max:400,r:4+Math.random()*4,color,kind:Math.random()<.5?"heart":"spark",emoji:emojis[(Math.random()*emojis.length)|0]});
  },
  spawnDeath(x,y){
    for(let i=0;i<20;i++){
      const a=Math.random()*Math.PI*2,s=2+Math.random()*5;
      this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:800,max:800,r:5+Math.random()*6,color:"#ff8fc4",kind:"heart",emoji:["💖","✨","🌸","⭐","💫"][(Math.random()*5)|0]});
    }
  },
  spawnExplosion(x,y){
    for(let i=0;i<30;i++){
      const a=Math.random()*Math.PI*2,s=2+Math.random()*7;
      this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:650,max:650,r:5+Math.random()*8,color:["#ffd23f","#ff8e3c","#ff5fa2","#fff","#e040fb"][(Math.random()*5)|0],kind:"spark"});
    }
    this.particles.push({x,y,vx:0,vy:0,life:400,max:400,r:GRENADE.radius,color:"#fff8a8",kind:"ring"});
  },
  updateParticles(dt){
    const step=dt/16.67;
    for(let i=this.particles.length-1;i>=0;i--){
      const p=this.particles[i];
      p.x+=p.vx*step;p.y+=p.vy*step;p.vx*=0.93;p.vy*=0.93;p.life-=dt;
      if(p.life<=0) this.particles.splice(i,1);
    }
    for(let i=this.texts.length-1;i>=0;i--){
      this.texts[i].y-=0.5*step;this.texts[i].life-=dt;
      if(this.texts[i].life<=0) this.texts.splice(i,1);
    }
  },
  floatText(x,y,txt,color){this.texts.push({x,y,txt,color,life:800,max:800});},

  /* =========== CÂMERA =========== */
  updateCamera(){
    const tx=this.player.x-this.W/2, ty=this.player.y-this.H/2;
    this.cam.x+=(tx-this.cam.x)*0.1;this.cam.y+=(ty-this.cam.y)*0.1;
    this.cam.x=Math.max(0,Math.min(this.map.width-this.W,this.cam.x));
    this.cam.y=Math.max(0,Math.min(this.map.height-this.H,this.cam.y));
    if(this.map.width<this.W) this.cam.x=(this.map.width-this.W)/2;
    if(this.map.height<this.H) this.cam.y=(this.map.height-this.H)/2;
  },

  /* =========== ROUNDS / ECONOMIA =========== */
  checkWin(){
    const pA=this.units.some(u=>u.team==="pink"&&u.alive);
    const bA=this.units.some(u=>u.team==="blue"&&u.alive);
    if(!pA) this.endRound("blue");
    else if(!bA) this.endRound("pink");
  },

  endRound(who){
    if(!this.roundActive) return;
    this.roundActive=false;
    let title,sub;
    let won=false;
    if(who==="pink"){this.scorePink++;title="Round Vencido! 🎉";sub="As princesas dominaram! 👑";won=true;}
    else if(who==="blue"){this.scoreBlue++;title="Round Perdido 💔";sub="O time azul venceu desta vez.";}
    else{
      if(this.player.alive){this.scorePink++;title="Tempo! Sobreviveu 💖";sub="Ponto para o rosa.";won=true;}
      else{this.scoreBlue++;title="Tempo esgotado ⏰";sub="Ponto para o azul.";}
    }
    // Recompensa de round
    const roundReward=won?Economy.ROUND_WIN:Economy.ROUND_LOSE;
    Economy.earn(roundReward);
    this.moneyEarnedThisRound+=roundReward;
    this.updateMoneyHUD();
    document.getElementById("score-pink").textContent=this.scorePink;
    document.getElementById("score-blue").textContent=this.scoreBlue;

    const matchOver=this.scorePink>=this.MAX_SCORE||this.scoreBlue>=this.MAX_SCORE;
    setTimeout(()=>{
      const ov=document.getElementById("overlay-result");
      document.getElementById("result-title").textContent=matchOver
        ?(this.scorePink>this.scoreBlue?"VITÓRIA TOTAL! 👑💖🎉":"Derrota... 💔")
        :title;
      document.getElementById("result-sub").textContent=matchOver
        ?`Placar final ${this.scorePink} x ${this.scoreBlue}`
        :`${sub} (${this.scorePink} x ${this.scoreBlue})`;
      document.getElementById("result-money").textContent=
        `+${this.moneyEarnedThisRound}💰 ganhos neste round (${this.killsThisRound} kills)`;
      document.getElementById("result-next").textContent=matchOver?"🔁 Jogar Novamente":"Próximo Round ➡️";
      this._matchOver=matchOver;
      ov.classList.remove("hidden");
    },800);
  },

  nextRound(){
    document.getElementById("overlay-result").classList.add("hidden");
    if(this._matchOver){this.scorePink=0;this.scoreBlue=0;this.round=0;}
    this.round++;
    this.startRound();
  },

  /* =========== BUY MENU (mid-game) =========== */
  openBuyMenu(){
    const ov=document.getElementById("overlay-buy");
    if(!ov.classList.contains("hidden")){this.closeBuyMenu();return;}
    this.paused=true;
    document.getElementById("buy-money").textContent=Economy.money;
    const grid=document.getElementById("buy-grid");
    grid.innerHTML="";
    for(const[id,w] of Object.entries(WEAPONS)){
      const owned=Economy.owns(id);
      const card=document.createElement("div");
      card.className="card"+(owned?" owned":"")+((!owned&&!Economy.canAfford(w.price))?" locked":"");
      card.innerHTML=`
        <div class="cname">${w.emoji} ${w.name}</div>
        <div class="cstat">${w.desc}<br>DMG:${w.damage} · MAG:${w.mag}</div>
        ${owned?'<div class="price-tag free">✅ Comprada</div>':`<div class="price-tag">💰${w.price}</div>`}
      `;
      if(!owned&&Economy.canAfford(w.price)){
        card.addEventListener("click",()=>{
          if(Economy.buyWeapon(id)){
            this.playerWeapon=id;
            this.player.weaponId=id;this.player.w=WEAPONS[id];this.player.ammo=w.mag;this.player.mag=w.mag;
            this.updateAmmoHUD();this.updateMoneyHUD();
            document.getElementById("buy-money").textContent=Economy.money;
            this.closeBuyMenu();
            this.showToast(`Comprou ${w.name}!`,800);
          }
        });
      }else if(owned){
        card.addEventListener("click",()=>{
          this.playerWeapon=id;
          this.player.weaponId=id;this.player.w=WEAPONS[id];this.player.ammo=w.mag;this.player.mag=w.mag;
          this.updateAmmoHUD();
          this.closeBuyMenu();
          this.showToast(`Equipou ${w.name}!`,600);
        });
      }
      grid.appendChild(card);
    }
    ov.classList.remove("hidden");
  },
  closeBuyMenu(){
    document.getElementById("overlay-buy").classList.add("hidden");
    this.paused=false;
  },

  pause(){if(!this.roundActive)return;this.paused=true;document.getElementById("overlay-pause").classList.remove("hidden");},
  resume(){this.paused=false;document.getElementById("overlay-pause").classList.add("hidden");},
  stop(){this.running=false;document.getElementById("btn-pause").style.display="none";},

  showToast(msg,ms){
    const el=document.getElementById("center-toast");el.textContent=msg;el.classList.add("show");
    clearTimeout(this._toastTO);this._toastTO=setTimeout(()=>el.classList.remove("show"),ms||1000);
  },

  /* =========== HUD =========== */
  updateAllHUD(){
    document.getElementById("score-pink").textContent=this.scorePink;
    document.getElementById("score-blue").textContent=this.scoreBlue;
    this.updateHealthHUD();this.updateAmmoHUD();this.updateMoneyHUD();
    document.getElementById("nade-count").textContent=this.player.nades;
    this._timerLoop();
  },
  _timerLoop(){
    if(this._timerRAF) cancelAnimationFrame(this._timerRAF);
    const tick=()=>{
      const s=Math.max(0,Math.ceil(this.roundTime));
      document.getElementById("round-timer").textContent=Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
      if(this.running) this._timerRAF=requestAnimationFrame(tick);
    };tick();
  },
  updateHealthHUD(){
    const p=this.player;if(!p)return;
    document.getElementById("hp-fill").style.width=Math.max(0,p.hp/p.maxHp*100)+"%";
    document.getElementById("hp-text").textContent=Math.max(0,Math.round(p.hp));
  },
  updateAmmoHUD(){
    const p=this.player;if(!p)return;
    document.getElementById("weapon-name").textContent=p.w.name;
    const cur=document.getElementById("ammo-cur");
    cur.textContent=p.reloading?"...":p.ammo;
    cur.classList.toggle("low",!p.reloading&&p.ammo<=Math.ceil(p.mag*0.25));
    document.getElementById("ammo-max").textContent=p.mag;
  },
  updateMoneyHUD(){
    document.getElementById("game-money").textContent=Economy.money;
    const menuEl=document.getElementById("menu-money");
    if(menuEl) menuEl.textContent=Economy.money;
    const shopEl=document.getElementById("shop-money");
    if(shopEl) shopEl.textContent=Economy.money;
  },
  kick(){
    const btn=document.getElementById("btn-fire");
    if(!btn)return;btn.style.transform="scale(.9)";
    clearTimeout(this._kickTO);this._kickTO=setTimeout(()=>btn.style.transform="",70);
  },

  /* =========== UTIL =========== */
  angleDiff(a,b){let d=b-a;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;},
  lerpAngle(a,b,t){return a+this.angleDiff(a,b)*t;},

  /* ===========================================================
     RENDER
     =========================================================== */
  render(){
    const ctx=this.ctx;
    ctx.clearRect(0,0,this.W,this.H);
    ctx.save();ctx.translate(-this.cam.x,-this.cam.y);
    this.drawFloor(ctx);
    this.drawDecor(ctx);
    this.drawSites(ctx);
    this.drawWalls(ctx);
    this.drawGrenades(ctx);
    this.drawBullets(ctx);
    for(const u of this.units) if(!u.alive) this.drawDead(ctx,u);
    for(const u of this.units) if(u.alive) this.drawUnit(ctx,u);
    this.drawParticles(ctx);
    this.drawTexts(ctx);
    ctx.restore();
    this.drawMinimap(ctx);
  },

  drawFloor(ctx){
    ctx.fillStyle=this.map.floor;
    ctx.fillRect(0,0,this.map.width,this.map.height);
    ctx.fillStyle=this.map.floorAccent;
    const s=70;
    const x0=Math.floor(this.cam.x/s)*s, y0=Math.floor(this.cam.y/s)*s;
    for(let x=x0;x<this.cam.x+this.W+s;x+=s)
      for(let y=y0;y<this.cam.y+this.H+s;y+=s)
        if(((x/s)+(y/s))%2===0) ctx.fillRect(x,y,s,s);
  },

  drawDecor(ctx){
    if(!this.map.decor) return;
    ctx.font="28px serif";ctx.textAlign="center";ctx.textBaseline="middle";
    for(const d of this.map.decor) ctx.fillText(d.emoji,d.x,d.y);
  },

  drawSites(ctx){
    for(const s of this.map.sites){
      ctx.save();ctx.globalAlpha=0.2+Math.sin(this.t/400)*0.08;
      ctx.fillStyle="#ff5fa2";ctx.beginPath();ctx.arc(s.x,s.y,75,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.fillStyle="rgba(255,255,255,.85)";ctx.font="bold 38px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(s.label,s.x,s.y);
    }
  },

  drawWalls(ctx){
    for(const w of this.map.walls){
      // Sombra
      ctx.fillStyle="rgba(0,0,0,.12)";
      this.rr(ctx,w.x+3,w.y+3,w.w,w.h,8);ctx.fill();
      // Parede principal
      const g=ctx.createLinearGradient(w.x,w.y,w.x,w.y+w.h);
      g.addColorStop(0,this.map.wallColor);g.addColorStop(1,this.map.wallDark||this.map.wallColor);
      ctx.fillStyle=g;
      this.rr(ctx,w.x,w.y,w.w,w.h,8);ctx.fill();
      // Brilho topo
      ctx.fillStyle="rgba(255,255,255,.3)";
      this.rr(ctx,w.x+3,w.y+3,w.w-6,Math.min(8,w.h-6),5);ctx.fill();
      // Detalhes fofos
      ctx.fillStyle="rgba(255,255,255,.4)";
      const step=30;
      for(let bx=w.x+15;bx<w.x+w.w-8;bx+=step){
        ctx.beginPath();ctx.arc(bx,w.y+w.h-8,2.5,0,Math.PI*2);ctx.fill();
      }
    }
  },

  drawBullets(ctx){
    for(const b of this.bullets){
      ctx.save();
      ctx.shadowColor=b.color;ctx.shadowBlur=10;
      ctx.fillStyle=b.color;
      ctx.beginPath();ctx.arc(b.x,b.y,4.5,0,Math.PI*2);ctx.fill();
      // Trail
      ctx.globalAlpha=0.4;
      ctx.beginPath();ctx.arc(b.x-b.vx*0.5,b.y-b.vy*0.5,3,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  },

  drawGrenades(ctx){
    for(const g of this.grenades){
      ctx.save();ctx.translate(g.x,g.y);ctx.rotate(g.spin);
      // Cupcake base
      ctx.fillStyle="#d98cc0";
      this.rr(ctx,-10,0,20,12,3);ctx.fill();
      // Wrapper lines
      ctx.strokeStyle="rgba(255,255,255,.4)";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(-8,4);ctx.lineTo(8,4);ctx.stroke();
      // Frosting
      ctx.fillStyle="#fff0f6";
      ctx.beginPath();ctx.arc(0,-3,10,Math.PI,0);ctx.fill();
      // Sprinkles
      ctx.fillStyle="#ff5fa2";ctx.fillRect(-4,-6,2,4);
      ctx.fillStyle="#7ecbff";ctx.fillRect(2,-8,2,4);
      ctx.fillStyle="#ffd23f";ctx.fillRect(-1,-4,2,3);
      // Cherry (blinks before exploding)
      const blink=g.fuse<400&&Math.floor(this.t/80)%2===0;
      ctx.fillStyle=blink?"#fff":"#ff1744";
      ctx.beginPath();ctx.arc(0,-11,4,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
  },

  drawUnit(ctx,u){
    if(u.hitFlash>0){
      ctx.save();ctx.globalAlpha=0.5;
      ctx.beginPath();ctx.arc(u.x,u.y,u.r+8,0,Math.PI*2);
      ctx.fillStyle="#fff";ctx.fill();ctx.restore();
    }
    drawPrincess(ctx,u.x,u.y,u.r,u.char,u.angle,u.team,{t:this.t,moving:u.isPlayer?(Input.move.x||Input.move.y):true});
    // HP bar
    const bw=38,bh=5,bx=u.x-bw/2,by=u.y-u.r-18;
    ctx.fillStyle="rgba(0,0,0,.4)";this.rr(ctx,bx-1,by-1,bw+2,bh+2,3);ctx.fill();
    ctx.fillStyle=u.team==="pink"?"#ff5fa2":"#7fb6ff";
    this.rr(ctx,bx,by,bw*(u.hp/u.maxHp),bh,3);ctx.fill();
    if(u.isPlayer){
      ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";
      ctx.fillText("★ VOCÊ",u.x,by-5);
    }
  },

  drawDead(ctx,u){
    ctx.save();ctx.globalAlpha=0.35;ctx.translate(u.x,u.y);
    ctx.font="24px serif";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillText("💔",0,0);ctx.restore();
  },

  drawParticles(ctx){
    for(const p of this.particles){
      const a=Math.max(0,p.life/p.max);
      ctx.save();ctx.globalAlpha=a;
      if(p.kind==="heart"){
        ctx.font=(p.r*2.5)+"px serif";ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText(p.emoji||"💗",p.x,p.y);
      }else if(p.kind==="ring"){
        ctx.strokeStyle=p.color;ctx.lineWidth=4*a+1;
        ctx.beginPath();ctx.arc(p.x,p.y,p.r*(1-a),0,Math.PI*2);ctx.stroke();
      }else{
        ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r*a,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
  },

  drawTexts(ctx){
    for(const t of this.texts){
      ctx.save();ctx.globalAlpha=Math.max(0,t.life/t.max);
      ctx.fillStyle=t.color;ctx.strokeStyle="rgba(0,0,0,.6)";ctx.lineWidth=3;
      ctx.font="bold 15px sans-serif";ctx.textAlign="center";
      ctx.strokeText(t.txt,t.x,t.y);ctx.fillText(t.txt,t.x,t.y);
      ctx.restore();
    }
  },

  drawMinimap(ctx){
    const mw=120,mh=120*(this.map.height/this.map.width);
    const mx=this.W-mw-10,my=54;
    const sx=mw/this.map.width,sy=mh/this.map.height;
    ctx.save();ctx.globalAlpha=0.8;
    ctx.fillStyle="rgba(0,0,0,.5)";this.rr(ctx,mx-5,my-5,mw+10,mh+10,8);ctx.fill();
    ctx.fillStyle=this.map.floorAccent;ctx.fillRect(mx,my,mw,mh);
    ctx.fillStyle=this.map.wallColor;
    for(const w of this.map.walls) ctx.fillRect(mx+w.x*sx,my+w.y*sy,Math.max(1,w.w*sx),Math.max(1,w.h*sy));
    for(const u of this.units){
      if(!u.alive) continue;
      ctx.fillStyle=u.isPlayer?"#fff":(u.team==="pink"?"#ff5fa2":"#7fb6ff");
      ctx.beginPath();ctx.arc(mx+u.x*sx,my+u.y*sy,u.isPlayer?4:2.5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  },

  rr(ctx,x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
};
