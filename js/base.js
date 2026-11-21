/* =====================================================================
   base.js — Constantes, conversión de coordenadas, texturas, materiales
   compartidos, ayudantes de geometría y sonido.

   SISTEMA DE COORDENADAS
   - El MONTAJE (retos, posiciones de piezas, medidas en piezas.js) se
     escribe en "px de panel": el panel mide TK.W x TK.H, origen arriba a
     la izquierda, Y hacia ABAJO, ángulos en sentido horario.
     Escala real: 1 px = 1,25 mm (el panel de 1360 x 800 px = 170 x 100 cm,
     como la superficie perforada de la propuesta).
   - La física (Rapier 2D) y el render (Three.js) comparten unidades:
     1 unidad = 100 px, origen en el centro del panel, Y hacia ARRIBA,
     ángulos antihorarios. TK.X / TK.Y / TK.S convierten entre ambos.
   ===================================================================== */
(function () {
  const T = THREE;
  const TK = (window.TK = {});

  TK.W0 = 1360;              // panel de los retos y las fichas (px) = 170 x 100 cm
  TK.H0 = 800;
  TK.W = TK.W0;              // panel que se ve ahora (px)
  TK.H = TK.H0;
  // «Peces grans» (taller libre): un panel más pequeño, 840 x 500 px = 105 x 62,5 cm.
  // En la misma pantalla caben menos agujeros y todo se ve 1,6 veces más grande.
  TK.PETIT = { W: 840, H: 500 };
  /** Los retos Fáciles van en el tablero pequeño (piezas grandes, más fácil con el dedo). */
  TK.taulerPetit = (r) => !!r && r.dificultat === "facil";
  /** Medida del tablero de un reto: {W, H} en px. */
  TK.midaRepte = (r) => (TK.taulerPetit(r) ? TK.PETIT : { W: TK.W0, H: TK.H0 });
  TK.S = 0.01;               // px -> unidades Three/Rapier
  TK.Z = 0.25;               // plano medio de las piezas
  TK.REJILLA = 10;           // ajuste suave de posición (px)
  TK.PASO_AGUJERO = 20;      // agujeros cada 20 px = 25 mm
  TK.PASO_GIRO = Math.PI / 12; // 15°

  TK.X = (x) => (x - TK.W / 2) * TK.S;
  TK.Y = (y) => -(y - TK.H / 2) * TK.S;
  /** Centro del agujero más cercano (para espigas y ejes). */
  TK.agujero = (v) => Math.round((v - 10) / TK.PASO_AGUJERO) * TK.PASO_AGUJERO + 10;
  /** Coloca un objeto Three en la posición/ángulo de montaje (px, rad). */
  TK.pose = (obj, x, y, a) => {
    obj.position.x = TK.X(x);
    obj.position.y = TK.Y(y);
    obj.rotation.z = -(a || 0);
  };
  /** Rota un vector local (px, Y abajo) un ángulo a (horario en pantalla). */
  TK.rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

  /* ---------- Materiales físicos ----------
     f = fricción, r = rebote (restitución), d = densidad (masa por unidad²).
     Rapier promedia fricción y rebote de las dos superficies en contacto. */
  TK.FIS = {
    madera: { f: 0.5, r: 0.2, d: 1 },
    corcho: { f: 0.7, r: 0.35, d: 0.25 },
    goma: { f: 0.95, r: 0.75, d: 0.5 },
    vidrio: { f: 0.15, r: 0.4, d: 2.5 },
    pvc: { f: 0.2, r: 0.25, d: 1.4 },
    metal: { f: 0.2, r: 0.35, d: 3 },
  };
  TK.GRAVEDAD = 28; // unidades/s²

  /* Grupos de colisión (16 bits pertenencia | 16 bits filtro).
     Los discos de los engranajes van por delante de las demás piezas,
     como en el panel real: no chocan con piezas fijas ni entre sí (el
     engrane se resuelve en app.js -> acoplarEngranajes). Sí empujan bolas,
     y su espiga excéntrica choca con todo. */
  TK.GRUPO_FIJO = (0x0002 << 16) | 0xffff;                  // piezas clavadas al panel
  TK.GRUPO_ENGRANAJE = (0x0004 << 16) | (0xffff & ~0x0006); // no chocan con fijas ni con otros engranajes
  TK.GRUPO_COCHE = (0x0008 << 16) | (0xffff & ~0x0008);     // las piezas del coche no chocan entre sí

  /* ---------- Generador pseudoaleatorio determinista ---------- */
  function prng(seed) {
    return function () {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  TK.prng = prng;

  /** Vetas de madera horizontales (repetibles en X). */
  function vetas(ctx, w, h, colorVeta, seed, n) {
    const r = prng(seed);
    for (let i = 0; i < n; i++) {
      const y0 = r() * h, amp = 1.5 + r() * 7, k = 1 + Math.floor(r() * 3), fase = r() * Math.PI * 2;
      ctx.strokeStyle = colorVeta;
      ctx.globalAlpha = 0.05 + r() * 0.2;
      ctx.lineWidth = 0.6 + r() * 2.6;
      for (const dy of [-h, 0, h]) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 6) {
          const a = (x / w) * Math.PI * 2 * k + fase;
          const y = y0 + dy + Math.sin(a) * amp + Math.sin(a * 2.7 + fase) * amp * 0.3;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    for (let i = 0; i < 2500; i++) {
      ctx.globalAlpha = 0.04 + r() * 0.05;
      ctx.fillStyle = colorVeta;
      ctx.fillRect(r() * w, r() * h, 1 + r() * 4, 1);
    }
    ctx.globalAlpha = 1;
  }

  function lienzo(w, h, pintar) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    pintar(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.encoding = T.sRGBEncoding;
    return t;
  }
  function texturaMadera(base, veta, seed, rep = 0.45) {
    const t = lienzo(512, 512, (ctx, w, h) => { ctx.fillStyle = base; ctx.fillRect(0, 0, w, h); vetas(ctx, w, h, veta, seed, 70); });
    t.repeat.set(rep, rep);
    return t;
  }
  /** Corcho: granulado marrón claro con poros oscuros. */
  function texturaCorcho() {
    return lienzo(256, 256, (ctx, w, h) => {
      const r = prng(21);
      ctx.fillStyle = "#c9955c"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const c = ["#b07a42", "#d9ad78", "#9b6634", "#e2bd8c"][Math.floor(r() * 4)];
        ctx.fillStyle = c; ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(r() * w, r() * h, 0.6 + r() * 2.4, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = "#5c3a1c"; ctx.globalAlpha = 0.55;
        ctx.beginPath(); ctx.arc(r() * w, r() * h, 0.5 + r() * 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }
  /** Espiga de madera estriada: franjas longitudinales claras/oscuras. */
  function texturaEspiga() {
    return lienzo(256, 32, (ctx, w, h) => {
      ctx.fillStyle = "#e6c79a"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 12; i++) {
        const x = (i / 12) * w;
        const g = ctx.createLinearGradient(x, 0, x + w / 12, 0);
        g.addColorStop(0, "rgba(140,95,50,.0)"); g.addColorStop(0.5, "rgba(140,95,50,.45)"); g.addColorStop(1, "rgba(140,95,50,.0)");
        ctx.fillStyle = g; ctx.fillRect(x, 0, w / 12, h);
      }
    });
  }
  /** Cono de hilo: cartón con perforaciones. */
  function texturaCono() {
    return lienzo(256, 256, (ctx, w, h) => {
      ctx.fillStyle = "#d8b47a"; ctx.fillRect(0, 0, w, h);
      const r = prng(5);
      for (let i = 0; i < 900; i++) { ctx.fillStyle = "rgba(120,80,30,.08)"; ctx.fillRect(r() * w, r() * h, 3, 1); }
      ctx.fillStyle = "#4a3018";
      for (let y = 16; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 32; x < w; x += 32) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
    });
  }

  /** Lienzo del tablero perforado: contrachapado con agujeros cada 25 mm. */
  TK.lienzoTablero = function (k) {
    const c = document.createElement("canvas");
    c.width = TK.W * k;
    c.height = TK.H * k;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#dcbc8c");
    g.addColorStop(1, "#cfab78");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    vetas(ctx, c.width, c.height, "#a87a48", 11, 160);
    for (let y = 10; y < TK.H; y += TK.PASO_AGUJERO) {
      for (let x = 10; x < TK.W; x += TK.PASO_AGUJERO) {
        const cx = x * k, cy = y * k, r = 3.4 * k;
        ctx.fillStyle = "rgba(255,245,225,.45)";
        ctx.beginPath(); ctx.arc(cx, cy + 0.9 * k, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4e351f";
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    return c;
  };

  /* ---------- Materiales visuales compartidos ---------- */
  const std = (o) => new T.MeshStandardMaterial(o);
  const translucido = (color, opacidad) => std({ color, roughness: 0.45, metalness: 0.05, transparent: true, opacity: opacidad, side: T.DoubleSide, depthWrite: false });
  TK.MAT = {
    madera: std({ map: texturaMadera("#ecd2a6", "#b98a55", 1), roughness: 0.62 }),          // contrachapado claro
    maderaMedia: std({ map: texturaMadera("#d9b07a", "#9a6a3a", 2), roughness: 0.6 }),
    maderaOscura: std({ map: texturaMadera("#a8774a", "#6a4524", 3), roughness: 0.65 }),
    maderaVieja: std({ map: texturaMadera("#d3c7b4", "#8d8270", 8), roughness: 0.8 }),       // bloques perforados
    haya: std({ map: texturaMadera("#e5bd84", "#9d6a35", 4), roughness: 0.45 }),             // bola de madera
    espiga: std({ map: texturaEspiga(), roughness: 0.55 }),
    corcho: std({ map: texturaCorcho(), roughness: 0.95 }),
    cono: std({ map: texturaCono(), roughness: 0.85, side: T.DoubleSide }),
    agujero: new T.MeshBasicMaterial({ color: "#3a2614" }),
    gomaRoja: std({ color: "#e2483d", roughness: 0.55 }),
    gomaNegra: std({ color: "#2b2826", roughness: 0.7 }),
    gomaAzul: std({ color: "#2f7fd8", roughness: 0.55 }),
    gomaVerde: std({ color: "#3aa55b", roughness: 0.55 }),
    gomaAmarilla: std({ color: "#f5b82e", roughness: 0.55 }),
    laton: std({ color: "#d9a441", metalness: 0.85, roughness: 0.28, side: T.DoubleSide }),
    hierro: std({ color: "#9aa2ac", metalness: 0.8, roughness: 0.3 }),
    pvc: translucido("#8f979f", 0.55),
    pvcBorde: std({ color: "#7d858d", roughness: 0.5 }),
    corrugados: ["#8fd16a", "#b9a3e6", "#f2d04b", "#f29bc0", "#5ec8c0", "#a4acb4"].map((c) => translucido(c, 0.6)),
    vidrio: new T.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.32, depthWrite: false }),
    remolinos: ["#1e6fd9", "#e2483d", "#2fa35a", "#f5b82e", "#8a4fd8", "#17a2b8"].map((c) => std({ color: c, roughness: 0.3 })),
    pelota: std({ color: "#ef5a3c", roughness: 0.42 }),
    cuerda: std({ color: "#e2585a", roughness: 0.95 }),   // cordel grueso rojo de la propuesta
    neumatico: std({ color: "#3b3431", roughness: 0.8 }),
    ranura: std({ color: "#5a4128", roughness: 0.8 }),
  };

  /* ---------- Ayudantes de geometría (medidas en px locales) ---------- */
  const BT = 0.03, BS = 0.022; // grosor y tamaño del bisel (unidades)
  function sombra(m) { m.castShadow = true; m.receiveShadow = true; return m; }
  TK.sombra = sombra;

  function rectRedondo(w, h, r) {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  /** Extruye una forma (en unidades) con bisel redondeado; centrada en z. */
  TK.extruir = function (forma, mat, o = {}) {
    const prof = o.prof ?? 0.4;
    const d = Math.max(prof - 2 * BT, 0.01);
    const g = new T.ExtrudeGeometry(forma, { depth: d, bevelEnabled: true, bevelThickness: BT, bevelSize: o.bisel ?? BS, bevelSegments: 3, curveSegments: 10 });
    const m = new T.Mesh(g, mat);
    m.position.set((o.x || 0) * TK.S, -(o.y || 0) * TK.S, (o.z ?? TK.Z) - d / 2);
    m.rotation.z = -(o.ang || 0);
    return sombra(m);
  };

  /** Listón / bloque w x h px con cantos redondeados. */
  TK.caja = function (w, h, mat, o = {}) {
    const W = Math.max(w * TK.S - 2 * BS, 0.01), H = Math.max(h * TK.S - 2 * BS, 0.01);
    const r = Math.max(Math.min((o.r ?? 6) * TK.S, W / 2 - 0.001, H / 2 - 0.001), 0.001);
    return TK.extruir(rectRedondo(W, H, r), mat, o);
  };

  /** Cilindro con el eje perpendicular al panel (clavijas, ruedas). */
  TK.cilindro = function (r, prof, mat, o = {}) {
    const m = new T.Mesh(new T.CylinderGeometry(r * TK.S, r * TK.S, prof, 32), mat);
    m.rotation.x = Math.PI / 2;
    m.position.set((o.x || 0) * TK.S, -(o.y || 0) * TK.S, o.z ?? TK.Z);
    return sombra(m);
  };

  /** Espiga de madera de 8 mm que sale del agujero (largo en unidades). */
  TK.espiga = function (largo, o = {}) {
    const g = new T.Group();
    const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, largo, 20), TK.MAT.espiga);
    m.rotation.x = Math.PI / 2;
    m.position.z = largo / 2;
    const punta = new T.Mesh(new T.CylinderGeometry(0.04, 0.05, 0.02, 20), TK.MAT.espiga);
    punta.rotation.x = Math.PI / 2;
    punta.position.z = largo + 0.01;
    g.add(sombra(m), punta);
    g.position.set((o.x || 0) * TK.S, -(o.y || 0) * TK.S, 0);
    return g;
  };

  /** Agujeros oscuros pintados en la cara frontal de una pieza. */
  TK.agujeros = function (puntos, r, z) {
    const g = new T.Group();
    const geo = new T.CircleGeometry(r * TK.S, 16);
    puntos.forEach(([x, y]) => {
      const m = new T.Mesh(geo, TK.MAT.agujero);
      m.position.set(x * TK.S, -y * TK.S, z ?? TK.Z + 0.205);
      g.add(m);
    });
    return g;
  };

  TK.esfera = function (r, mat) {
    const m = new T.Mesh(new T.SphereGeometry(r * TK.S, 32, 20), mat);
    m.position.z = TK.Z;
    return sombra(m);
  };

  /** Forma de engranaje de contrachapado: radio primitivo r (px), n dientes. */
  TK.formaEngranaje = function (r, n, huecos) {
    const S = TK.S, s = new T.Shape(), P = (Math.PI * 2) / n;
    const ro = (r + 6) * S, ri = (r - 6) * S;
    for (let k = 0; k < n; k++) {
      const a = k * P;
      const pts = [[ri, a], [ro, a + 0.2 * P], [ro, a + 0.42 * P], [ri, a + 0.62 * P]];
      pts.forEach(([rr, aa], j) => {
        const x = rr * Math.cos(aa), y = rr * Math.sin(aa);
        k === 0 && j === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
      });
    }
    s.closePath();
    const agujero = (x, y, rad) => { const p = new T.Path(); p.absarc(x * S, y * S, rad * S, 0, Math.PI * 2, true); s.holes.push(p); };
    agujero(0, 0, 5);
    (huecos || []).forEach(([x, y, rad]) => agujero(x, y, rad));
    return s;
  };

  /** Cuerda: cilindro fino que se estira entre dos puntos de montaje (px). */
  TK.cuerda = function () {
    const m = new T.Mesh(new T.CylinderGeometry(0.016, 0.016, 1, 6), TK.MAT.cuerda);
    m.castShadow = true;
    return m;
  };
  TK.tensar = function (m, x1, y1, x2, y2, z) {
    const ax = TK.X(x1), ay = TK.Y(y1), bx = TK.X(x2), by = TK.Y(y2);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    m.position.set((ax + bx) / 2, (ay + by) / 2, z ?? TK.Z);
    m.scale.set(1, Math.max(len, 1e-4), 1);
    m.rotation.set(0, 0, Math.atan2(-dx, dy));
  };

  /** Libera geometrías de un árbol (los materiales son compartidos). */
  TK.liberar = function (obj) {
    obj.traverse((n) => n.geometry && n.geometry.dispose());
  };

  /* ---------- Sonido: efectos sintetizados (Web Audio) y música de fondo ----------
     La música (audio/musica.mp3) suena en bucle desde el primer toque (los
     navegadores no dejan sonar nada antes). El botón del altavoz silencia
     música y efectos; la elección se guarda ("tinkerpad-silenci"). */
  /** Icono del altavoz (con ondas o tachado) para el botón de sonido. */
  TK.iconoSo = (silenci) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9.2h3.3L12 5v14l-4.7-4.2H4z"/>${silenci
    ? '<path d="m15.5 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
    : '<path d="M15.2 9.2a4 4 0 0 1 0 5.6M17.8 6.6a7.7 7.7 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'}</svg>`;
  TK.audio = (function () {
    let ctx = null, salida = null, ultimoToc = 0, musica = null;
    const CLAU = "tinkerpad-silenci";
    let silenci = false;
    try { silenci = localStorage.getItem(CLAU) === "1"; } catch (e) { /* sin almacenamiento */ }
    const oients = [];
    function activar() {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          salida = ctx.createGain();
          salida.gain.value = silenci ? 0 : 0.6;
          salida.connect(ctx.destination);
        } catch (e) { ctx = null; }
      }
      if (ctx && ctx.state === "suspended") ctx.resume();
      if (!musica) {
        musica = new Audio("audio/musica.mp3");
        musica.loop = true;
        musica.volume = 0.32;
      }
      if (!silenci && musica.paused) musica.play().catch(() => { /* aún sin permiso */ });
    }
    function silenciar(si) {
      silenci = si;
      try { localStorage.setItem(CLAU, si ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
      if (salida) salida.gain.value = si ? 0 : 0.6;
      if (musica) { if (si) musica.pause(); else musica.play().catch(() => {}); }
      oients.forEach((fn) => fn(si));
    }
    function tono(f, t0, dur, vol, tipo, fFin) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = tipo || "sine";
      o.frequency.setValueAtTime(f, t0);
      if (fFin) o.frequency.exponentialRampToValueAtTime(fFin, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(salida);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
    return {
      activar,
      silenciat: () => silenci,
      alternar() { silenciar(!silenci); },
      alCanviar: (fn) => oients.push(fn),
      campana() {
        if (!ctx) return;
        const t = ctx.currentTime;
        [[1, 0.32], [2.01, 0.16], [2.76, 0.13], [4.07, 0.07], [5.4, 0.04]].forEach(([r, v]) => tono(880 * r, t, 2.4 / (r * 0.5 + 0.5), v));
      },
      fanfarria() {
        if (!ctx) return;
        const t = ctx.currentTime + 0.35;
        [523, 659, 784, 1047].forEach((f, i) => tono(f, t + i * 0.12, i === 3 ? 0.7 : 0.3, 0.16, "triangle"));
      },
      toc(v) {
        if (!ctx) return;
        const ahora = performance.now();
        if (ahora - ultimoToc < 45) return;
        ultimoToc = ahora;
        tono(380 + Math.min(v, 8) * 40, ctx.currentTime, 0.07, Math.min(0.2, 0.04 + v * 0.03), "triangle");
      },
      boing() { if (ctx) tono(170, ctx.currentTime, 0.3, 0.2, "sine", 520); },
      clic() { if (ctx) tono(950, ctx.currentTime, 0.05, 0.08, "triangle"); },
    };
  })();
})();
