/* PRINCESAS FORCE v4 — UI */
const UI={
  selChar:null,selMap:null,
  init(){Game.init();this.nav();this.chars();this.maps();this.flow();},
  go(id){document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));document.getElementById(id).classList.add("active");if(id!=="screen-game"&&Game.running)Game.stop();},
  nav(){document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>this.go(b.dataset.go)));},
  chars(){
    const g=document.getElementById("char-grid");g.innerHTML="";
    CHARS.forEach(ch=>{
      const d=document.createElement("div");d.className="ccard";
      const cv=document.createElement("canvas");cv.width=80;cv.height=80;
      drawChar(cv.getContext("2d"),40,44,18,ch,-Math.PI/2,"t",false,false,0);
      d.appendChild(cv);
      d.insertAdjacentHTML("beforeend",`<div class="cn">${ch.name}</div><div class="cs">${ch.desc} · HP:${ch.hp} SPD:${ch.spd}</div>`);
      d.addEventListener("click",()=>{this.selChar=ch.id;g.querySelectorAll(".ccard").forEach(c=>c.classList.remove("sel"));d.classList.add("sel");document.getElementById("btn-next-map").disabled=false;});
      g.appendChild(d);
    });
  },
  maps(){
    const g=document.getElementById("map-grid");g.innerHTML="";
    MAPS.forEach(m=>{
      const d=document.createElement("div");d.className="ccard map";
      const cv=document.createElement("canvas");cv.width=240;cv.height=140;
      const ctx=cv.getContext("2d"),sx=240/m.w,sy=140/m.h;
      ctx.fillStyle=m.floorA;ctx.fillRect(0,0,240,140);
      ctx.fillStyle=m.wallFill;m.walls.forEach(w=>ctx.fillRect(w.x*sx,w.y*sy,Math.max(1,w.w*sx),Math.max(1,w.h*sy)));
      m.sites.forEach(s=>{ctx.fillStyle="rgba(255,255,0,.5)";ctx.font="bold 10px monospace";ctx.textAlign="center";ctx.fillText(s.l,s.x*sx,s.y*sy+4);});
      d.appendChild(cv);
      d.insertAdjacentHTML("beforeend",`<div class="cn">${m.name}</div><div class="cs">${m.desc}</div>`);
      d.addEventListener("click",()=>{this.selMap=m.id;g.querySelectorAll(".ccard").forEach(c=>c.classList.remove("sel"));d.classList.add("sel");document.getElementById("btn-start").disabled=false;});
      g.appendChild(d);
    });
  },
  flow(){
    document.getElementById("btn-next-map").addEventListener("click",()=>{if(this.selChar)this.go("screen-map");});
    document.getElementById("btn-start").addEventListener("click",()=>{if(!this.selChar||!this.selMap)return;this.go("screen-game");requestAnimationFrame(()=>Game.start(this.selChar,this.selMap));});
  }
};
window.addEventListener("DOMContentLoaded",()=>UI.init());
