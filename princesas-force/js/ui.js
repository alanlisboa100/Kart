/* ============================================================
   PRINCESAS FORCE v3 — UI CS STYLE
   Menu tático, buy menu, seleção, HUD militar
   ============================================================ */
const UI = {
  selChar:null,
  selMap:null,

  init(){
    Game.init();
    this.bindNav();
    this.buildCharGrid();
    this.buildMapGrid();
    this.bindFlow();
  },

  go(id){
    document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    if(id!=="screen-game"&&Game.running) Game.stop();
  },

  bindNav(){
    document.querySelectorAll("[data-go]").forEach(btn=>{
      btn.addEventListener("click",()=>this.go(btn.dataset.go));
    });
  },

  /* ===== PERSONAGENS ===== */
  buildCharGrid(){
    const grid=document.getElementById("char-grid");
    grid.innerHTML="";
    PRINCESSES.forEach(p=>{
      const card=document.createElement("div");
      card.className="card";
      const cv=document.createElement("canvas");
      cv.width=120;cv.height=120;
      drawPrincess(cv.getContext("2d"),60,66,30,p,-Math.PI/2,"pink",{});
      card.appendChild(cv);
      card.insertAdjacentHTML("beforeend",
        `<div class="cname">${p.emoji} ${p.name}</div>
         <div class="cstat">${p.desc}<br>HP:${p.hp} SPD:${p.speed}</div>`);
      card.addEventListener("click",()=>{
        this.selChar=p.id;
        grid.querySelectorAll(".card").forEach(c=>c.classList.remove("selected"));
        card.classList.add("selected");
        document.getElementById("char-next").disabled=false;
      });
      grid.appendChild(card);
    });
  },

  /* ===== MAPAS ===== */
  buildMapGrid(){
    const grid=document.getElementById("map-grid");
    grid.innerHTML="";
    MAPS.forEach(m=>{
      const card=document.createElement("div");
      card.className="card map";
      const cv=document.createElement("canvas");
      cv.width=300;cv.height=180;
      this.drawMapThumb(cv.getContext("2d"),cv.width,cv.height,m);
      card.appendChild(cv);
      card.insertAdjacentHTML("beforeend",
        `<div class="cname">${m.name}</div><div class="desc">${m.desc}</div>`);
      card.addEventListener("click",()=>{
        this.selMap=m.id;
        grid.querySelectorAll(".card").forEach(c=>c.classList.remove("selected"));
        card.classList.add("selected");
        document.getElementById("map-start").disabled=false;
      });
      grid.appendChild(card);
    });
  },

  drawMapThumb(ctx,w,h,m){
    const sx=w/m.width,sy=h/m.height;
    ctx.fillStyle=m.floor;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=m.wallColor;
    m.walls.forEach(wl=>ctx.fillRect(wl.x*sx,wl.y*sy,Math.max(1,wl.w*sx),Math.max(1,wl.h*sy)));
    if(m.sites) m.sites.forEach(s=>{
      ctx.fillStyle="rgba(255,255,0,.5)";ctx.beginPath();ctx.arc(s.x*sx,s.y*sy,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#fff";ctx.font="bold 12px monospace";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(s.label,s.x*sx,s.y*sy);
    });
    m.spawnsPink.forEach(s=>{ctx.fillStyle="#ff4444";ctx.beginPath();ctx.arc(s.x*sx,s.y*sy,3,0,Math.PI*2);ctx.fill();});
    m.spawnsBlue.forEach(s=>{ctx.fillStyle="#4488ff";ctx.beginPath();ctx.arc(s.x*sx,s.y*sy,3,0,Math.PI*2);ctx.fill();});
  },

  /* ===== FLUXO ===== */
  bindFlow(){
    document.getElementById("char-next").addEventListener("click",()=>{
      if(this.selChar) this.go("screen-map");
    });
    document.getElementById("map-start").addEventListener("click",()=>{
      if(!this.selChar||!this.selMap) return;
      this.go("screen-game");
      requestAnimationFrame(()=>Game.start(this.selChar,this.selMap));
    });
  }
};

window.addEventListener("DOMContentLoaded",()=>UI.init());
