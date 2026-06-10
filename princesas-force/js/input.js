/* ============ INPUT v4 — preciso e responsivo ============ */
const Input={
  move:{x:0,y:0},firing:false,
  reloadEdge:false,nadeEdge:false,buyEdge:false,switchEdge:false,
  mouse:{x:0,y:0,active:false},usingMouse:false,
  _jid:null,_jcx:0,_jcy:0,_aid:null,_alx:0,_aly:0,_keys:{},_numKey:null,

  init(){this._joy();this._aim();this._btns();this._kb();this._ms();},
  reset(){this.move.x=0;this.move.y=0;this.firing=false;this._jid=null;this._aid=null;
    const k=document.getElementById("jknob");if(k)k.style.transform="translate(-50%,-50%)";},

  _joy(){
    const z=document.getElementById("jzone"),b=document.getElementById("jbase"),k=document.getElementById("jknob");
    if(!z)return;const R=44;
    z.addEventListener("pointerdown",e=>{if(this._jid!==null)return;this._jid=e.pointerId;
      const r=b.getBoundingClientRect();this._jcx=r.left+r.width/2;this._jcy=r.top+r.height/2;
      z.setPointerCapture(e.pointerId);this._jmove(e,R,k);e.preventDefault();});
    z.addEventListener("pointermove",e=>{if(e.pointerId!==this._jid)return;this._jmove(e,R,k);e.preventDefault();});
    const up=e=>{if(e.pointerId!==this._jid)return;this._jid=null;this.move.x=0;this.move.y=0;
      k.style.transform="translate(-50%,-50%)";};
    z.addEventListener("pointerup",up);z.addEventListener("pointercancel",up);
  },
  _jmove(e,R,k){
    let dx=e.clientX-this._jcx,dy=e.clientY-this._jcy;
    const d=Math.hypot(dx,dy)||1,c=Math.min(d,R),nx=dx/d,ny=dy/d;
    k.style.transform=`translate(calc(-50% + ${nx*c}px),calc(-50% + ${ny*c}px))`;
    const mag=c/R;if(mag<0.12){this.move.x=0;this.move.y=0;}else{this.move.x=nx*mag;this.move.y=ny*mag;}
  },

  _aim(){
    const z=document.getElementById("azone");if(!z)return;
    z.addEventListener("pointerdown",e=>{if(this._aid!==null)return;this._aid=e.pointerId;
      this._alx=e.clientX;this._aly=e.clientY;z.setPointerCapture(e.pointerId);e.preventDefault();});
    z.addEventListener("pointermove",e=>{if(e.pointerId!==this._aid)return;
      const dx=e.clientX-this._alx,dy=e.clientY-this._aly;
      this._alx=e.clientX;this._aly=e.clientY;
      if(typeof Game!=='undefined'&&Game.player&&Game.player.alive){Game.player.angle+=dx*0.006;}
      e.preventDefault();});
    const up=e=>{if(e.pointerId!==this._aid)return;this._aid=null;};
    z.addEventListener("pointerup",up);z.addEventListener("pointercancel",up);
  },

  _btns(){
    const f=document.getElementById("btn-fire");
    if(f){f.addEventListener("pointerdown",e=>{this.firing=true;this.usingMouse=false;f.setPointerCapture(e.pointerId);e.preventDefault();});
      f.addEventListener("pointerup",e=>{this.firing=false;e.preventDefault();});f.addEventListener("pointercancel",()=>{this.firing=false;});}
    const tap=(id,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener("pointerdown",e=>{fn();e.preventDefault();});};
    tap("btn-reload",()=>{this.reloadEdge=true;});
    tap("btn-nade",()=>{this.nadeEdge=true;});
    tap("btn-switch",()=>{this.switchEdge=true;});
  },

  _kb(){
    window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();this._keys[k]=true;
      if(k==="r")this.reloadEdge=true;if(k==="g")this.nadeEdge=true;
      if(k==="b")this.buyEdge=true;if(k==="q")this.switchEdge=true;
      if(e.key>="1"&&e.key<="3")this._numKey=+e.key;});
    window.addEventListener("keyup",e=>{this._keys[e.key.toLowerCase()]=false;});
  },

  _ms(){
    const c=document.getElementById("game-canvas");if(!c)return;
    c.addEventListener("mousemove",e=>{this.mouse.x=e.clientX;this.mouse.y=e.clientY;this.mouse.active=true;this.usingMouse=true;});
    c.addEventListener("mousedown",e=>{if(e.button===0){this.firing=true;this.usingMouse=true;}});
    window.addEventListener("mouseup",e=>{if(e.button===0)this.firing=false;});
    c.addEventListener("contextmenu",e=>e.preventDefault());
  },

  poll(){
    let kx=0,ky=0;
    if(this._keys["w"]||this._keys["arrowup"])ky-=1;
    if(this._keys["s"]||this._keys["arrowdown"])ky+=1;
    if(this._keys["a"]||this._keys["arrowleft"])kx-=1;
    if(this._keys["d"]||this._keys["arrowright"])kx+=1;
    if(kx||ky){const m=Math.hypot(kx,ky);this.move.x=kx/m;this.move.y=ky/m;}
  },
  eatReload(){const v=this.reloadEdge;this.reloadEdge=false;return v;},
  eatNade(){const v=this.nadeEdge;this.nadeEdge=false;return v;},
  eatBuy(){const v=this.buyEdge;this.buyEdge=false;return v;},
  eatSwitch(){const v=this.switchEdge;this.switchEdge=false;return v;},
  eatNum(){const v=this._numKey;this._numKey=null;return v;}
};
