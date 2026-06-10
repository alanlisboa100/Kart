/* ============================================================
   PRINCESAS FORCE — UI COMPLETA
   Menu, loja de armas, seleção personagem/arma/mapa, HUD
   ============================================================ */
const UI = {
  selChar: null,
  selWeapon: null,
  selMap: null,

  init() {
    Game.init();
    this.bindNav();
    this.buildCharGrid();
    this.buildShop();
    this.buildMapGrid();
    this.bindFlow();
    this.updateMoney();
  },

  go(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    if (id !== "screen-game" && Game.running) Game.stop();
    if (id === "screen-shop") this.buildShop();
    if (id === "screen-loadout") this.buildLoadoutGrid();
    if (id === "screen-menu") this.updateMoney();
  },

  bindNav() {
    document.querySelectorAll("[data-go]").forEach(btn => {
      btn.addEventListener("click", () => this.go(btn.dataset.go));
    });
  },

  updateMoney() {
    document.getElementById("menu-money").textContent = Economy.money;
    const shopEl = document.getElementById("shop-money");
    if (shopEl) shopEl.textContent = Economy.money;
  },

  /* =================== LOJA DE ARMAS =================== */
  buildShop() {
    const grid = document.getElementById("shop-grid");
    grid.innerHTML = "";
    document.getElementById("shop-money").textContent = Economy.money;

    for (const [id, w] of Object.entries(WEAPONS)) {
      const owned = Economy.owns(id);
      const canBuy = !owned && Economy.canAfford(w.price);
      const card = document.createElement("div");
      card.className = "card" + (owned ? " owned" : "") + (!owned && !canBuy ? " locked" : "");

      const cv = document.createElement("canvas");
      cv.width = 100; cv.height = 60;
      this.drawWeaponIcon(cv.getContext("2d"), cv.width, cv.height, w);
      card.appendChild(cv);

      card.insertAdjacentHTML("beforeend", `
        <div class="cname">${w.emoji} ${w.name}</div>
        <div class="cstat">${w.desc}<br>DMG:${w.damage} · RATE:${Math.round(60000/w.fireRate)}rpm · MAG:${w.mag}</div>
        ${owned
          ? '<div class="price-tag free">✅ Comprada</div><div class="owned-badge">✓</div>'
          : `<div class="price-tag">💰 ${w.price}</div>`}
      `);

      if (canBuy) {
        card.addEventListener("click", () => {
          if (Economy.buyWeapon(id)) {
            this.buildShop();
            this.showNotification(`Comprou ${w.name}! 🎉`);
          }
        });
      }
      grid.appendChild(card);
    }
  },

  drawWeaponIcon(ctx, w, h, weapon) {
    ctx.fillStyle = weapon.color;
    // Gun body shape
    ctx.fillRect(w * 0.15, h * 0.35, w * 0.6, h * 0.2);
    ctx.fillRect(w * 0.55, h * 0.25, w * 0.25, h * 0.4);
    // Barrel
    ctx.fillRect(w * 0.05, h * 0.38, w * 0.15, h * 0.14);
    // Handle
    ctx.fillRect(w * 0.5, h * 0.5, w * 0.12, h * 0.3);
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.fillRect(w * 0.15, h * 0.35, w * 0.6, h * 0.06);
    // Emoji
    ctx.font = "22px serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(weapon.emoji, w * 0.85, h * 0.5);
  },

  /* =================== PERSONAGENS =================== */
  buildCharGrid() {
    const grid = document.getElementById("char-grid");
    grid.innerHTML = "";
    PRINCESSES.forEach(p => {
      const card = document.createElement("div");
      card.className = "card";
      const cv = document.createElement("canvas");
      cv.width = 160; cv.height = 160;
      drawPrincess(cv.getContext("2d"), 80, 88, 44, p, -Math.PI / 2, "pink", {});
      card.appendChild(cv);
      card.insertAdjacentHTML("beforeend",
        `<div class="cname">${p.emoji} ${p.name}</div>
         <div class="cstat">${p.desc}</div>`);
      card.addEventListener("click", () => {
        this.selChar = p.id;
        grid.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        document.getElementById("char-next").disabled = false;
      });
      grid.appendChild(card);
    });
  },

  /* =================== LOADOUT (armas compradas) =================== */
  buildLoadoutGrid() {
    const grid = document.getElementById("loadout-grid");
    grid.innerHTML = "";
    for (const [id, w] of Object.entries(WEAPONS)) {
      if (!Economy.owns(id)) continue;
      const card = document.createElement("div");
      card.className = "card" + (this.selWeapon === id ? " selected" : "");

      const cv = document.createElement("canvas");
      cv.width = 100; cv.height = 60;
      this.drawWeaponIcon(cv.getContext("2d"), cv.width, cv.height, w);
      card.appendChild(cv);

      card.insertAdjacentHTML("beforeend", `
        <div class="cname">${w.emoji} ${w.name}</div>
        <div class="cstat">DMG:${w.damage} · MAG:${w.mag}</div>
      `);
      card.addEventListener("click", () => {
        this.selWeapon = id;
        grid.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        document.getElementById("loadout-next").disabled = false;
      });
      grid.appendChild(card);
    }
  },

  /* =================== MAPAS =================== */
  buildMapGrid() {
    const grid = document.getElementById("map-grid");
    grid.innerHTML = "";
    MAPS.forEach(m => {
      const card = document.createElement("div");
      card.className = "card map";
      const cv = document.createElement("canvas");
      cv.width = 280; cv.height = 160;
      this.drawMapThumb(cv.getContext("2d"), cv.width, cv.height, m);
      card.appendChild(cv);
      card.insertAdjacentHTML("beforeend",
        `<div class="cname">${m.name}</div><div class="desc">${m.desc}</div>`);
      card.addEventListener("click", () => {
        this.selMap = m.id;
        grid.querySelectorAll(".card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        document.getElementById("map-start").disabled = false;
      });
      grid.appendChild(card);
    });
  },

  drawMapThumb(ctx, w, h, m) {
    const sx = w / m.width, sy = h / m.height;
    ctx.fillStyle = m.floor; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = m.wallColor;
    m.walls.forEach(wl => ctx.fillRect(wl.x * sx, wl.y * sy, Math.max(1, wl.w * sx), Math.max(1, wl.h * sy)));
    if (m.sites) m.sites.forEach(s => {
      ctx.fillStyle = "rgba(255,95,162,.5)";
      ctx.beginPath(); ctx.arc(s.x * sx, s.y * sy, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(s.label, s.x * sx, s.y * sy);
    });
    m.spawnsPink.forEach(s => { ctx.fillStyle = "#ff5fa2"; ctx.beginPath(); ctx.arc(s.x * sx, s.y * sy, 4, 0, Math.PI * 2); ctx.fill(); });
    m.spawnsBlue.forEach(s => { ctx.fillStyle = "#7fb6ff"; ctx.beginPath(); ctx.arc(s.x * sx, s.y * sy, 4, 0, Math.PI * 2); ctx.fill(); });
  },

  /* =================== FLUXO =================== */
  bindFlow() {
    document.getElementById("char-next").addEventListener("click", () => {
      if (this.selChar) this.go("screen-loadout");
    });
    document.getElementById("loadout-next").addEventListener("click", () => {
      if (this.selWeapon) this.go("screen-map");
    });
    document.getElementById("map-start").addEventListener("click", () => {
      if (!this.selChar || !this.selWeapon || !this.selMap) return;
      this.go("screen-game");
      requestAnimationFrame(() => Game.start(this.selChar, this.selWeapon, this.selMap));
    });
  },

  /* =================== NOTIFICAÇÃO =================== */
  showNotification(msg) {
    const div = document.createElement("div");
    div.style.cssText = "position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);color:#fff;padding:12px 24px;border-radius:20px;font-size:16px;font-weight:bold;z-index:999;animation:fadeIn .3s;";
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 2000);
  }
};

window.addEventListener("DOMContentLoaded", () => UI.init());
