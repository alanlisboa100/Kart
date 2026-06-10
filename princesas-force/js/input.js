/* ============================================================
   PRINCESAS FORCE — SISTEMA DE INPUT (Touch + Teclado + Mouse)
   Joystick virtual estilo Crossfire Mobile com movimentação perfeita
   ============================================================ */
const Input = {
  move:{x:0,y:0},
  firing:false,
  reloadEdge:false,
  nadeEdge:false,
  buyEdge:false,
  mouse:{x:0,y:0,active:false},
  usingMouseAim:false,
  _joyId:null,
  _joyCenter:{x:0,y:0},
  _keys:{},

  init(){
    this._initJoystick();
    this._initButtons();
    this._initKeyboard();
    this._initMouse();
  },

  reset(){
    this.move.x=0;this.move.y=0;this.firing=false;
    this.reloadEdge=false;this.nadeEdge=false;this.buyEdge=false;
    this._joyId=null;
    const knob=document.getElementById("joystick-knob");
    if(knob) knob.style.transform="translate(0,0)";
  },

  _initJoystick(){
    const zone=document.getElementById("joystick-zone");
    const base=document.getElementById("joystick-base");
    const knob=document.getElementById("joystick-knob");
    if(!zone||!base||!knob) return;
    const radius=52;
    const setKnob=(dx,dy)=>{knob.style.transform=`translate(${dx}px,${dy}px)`;};

    zone.addEventListener("pointerdown",(e)=>{
      if(this._joyId!==null) return;
      this._joyId=e.pointerId;
      const r=base.getBoundingClientRect();
      this._joyCenter={x:r.left+r.width/2,y:r.top+r.height/2};
      zone.setPointerCapture(e.pointerId);
      this._updateJoy(e.clientX,e.clientY,radius,setKnob);
      e.preventDefault();
    });
    zone.addEventListener("pointermove",(e)=>{
      if(e.pointerId!==this._joyId) return;
      this._updateJoy(e.clientX,e.clientY,radius,setKnob);
      e.preventDefault();
    });
    const end=(e)=>{
      if(e.pointerId!==this._joyId) return;
      this._joyId=null; this.move.x=0; this.move.y=0; setKnob(0,0);
    };
    zone.addEventListener("pointerup",end);
    zone.addEventListener("pointercancel",end);
  },

  _updateJoy(cx,cy,radius,setKnob){
    let dx=cx-this._joyCenter.x, dy=cy-this._joyCenter.y;
    const dist=Math.hypot(dx,dy)||1;
    const clamped=Math.min(dist,radius);
    const nx=dx/dist, ny=dy/dist;
    setKnob(nx*clamped, ny*clamped);
    const mag=clamped/radius;
    if(mag<0.12){this.move.x=0;this.move.y=0;}
    else{this.move.x=nx*mag; this.move.y=ny*mag;}
  },

  _initButtons(){
    const fire=document.getElementById("btn-fire");
    if(fire){
      fire.addEventListener("pointerdown",(e)=>{this.firing=true;this.usingMouseAim=false;fire.setPointerCapture(e.pointerId);e.preventDefault();});
      fire.addEventListener("pointerup",(e)=>{this.firing=false;e.preventDefault();});
      fire.addEventListener("pointercancel",()=>{this.firing=false;});
    }
    const tap=(id,fn)=>{const el=document.getElementById(id);if(el) el.addEventListener("pointerdown",(e)=>{fn();e.preventDefault();});};
    tap("btn-reload",()=>{this.reloadEdge=true;});
    tap("btn-nade",()=>{this.nadeEdge=true;});
  },

  _initKeyboard(){
    window.addEventListener("keydown",(e)=>{
      this._keys[e.key.toLowerCase()]=true;
      if(e.key.toLowerCase()==="r") this.reloadEdge=true;
      if(e.key.toLowerCase()==="g") this.nadeEdge=true;
      if(e.key.toLowerCase()==="b") this.buyEdge=true;
    });
    window.addEventListener("keyup",(e)=>{this._keys[e.key.toLowerCase()]=false;});
  },

  _initMouse(){
    const canvas=document.getElementById("game-canvas");
    if(!canvas) return;
    canvas.addEventListener("mousemove",(e)=>{
      this.mouse.x=e.clientX;this.mouse.y=e.clientY;
      this.mouse.active=true;this.usingMouseAim=true;
    });
    canvas.addEventListener("mousedown",(e)=>{if(e.button===0){this.firing=true;this.usingMouseAim=true;}});
    window.addEventListener("mouseup",(e)=>{if(e.button===0) this.firing=false;});
    canvas.addEventListener("contextmenu",(e)=>e.preventDefault());
  },

  pollKeyboard(){
    let kx=0,ky=0;
    if(this._keys["w"]||this._keys["arrowup"]) ky-=1;
    if(this._keys["s"]||this._keys["arrowdown"]) ky+=1;
    if(this._keys["a"]||this._keys["arrowleft"]) kx-=1;
    if(this._keys["d"]||this._keys["arrowright"]) kx+=1;
    if(kx||ky){const m=Math.hypot(kx,ky);this.move.x=kx/m;this.move.y=ky/m;}
  },

  consumeReload(){const v=this.reloadEdge;this.reloadEdge=false;return v;},
  consumeNade(){const v=this.nadeEdge;this.nadeEdge=false;return v;},
  consumeBuy(){const v=this.buyEdge;this.buyEdge=false;return v;}
};
