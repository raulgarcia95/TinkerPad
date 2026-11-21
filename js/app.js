/* =====================================================================
   app.js — Escena 3D, bucle de física, interacción e interfaz.

   MODOS
   - Montaje:   la física está parada. Se arrastran, giran y borran piezas.
   - Play:      se reconstruye el mundo desde el montaje y se simula.
   - Reiniciar: se para y se reconstruye el montaje tal como estaba.

   FÍSICA (Rapier 2D)
   - Paso fijo de 1/120 s con detección continua de colisiones (CCD) en
     bolas y pesos: no atraviesan piezas finas aunque vayan rápido.
   - Engranajes: dos ruedas engranan si sus ejes están a la distancia
     r1 + r2. Tras cada paso se igualan sus velocidades en el punto de
     contacto (acoplarEngranajes), repartiendo el impulso según la inercia.
   - Determinismo: al pulsar Play se crea un mundo nuevo con los cuerpos
     siempre en el mismo orden y se avanza con el mismo paso fijo.
   ===================================================================== */
(async function () {
  const T = THREE, S = TK.S;
  const RAPIER_URL = "https://cdn.jsdelivr.net/npm/@dimforge/rapier2d-compat@0.14.0/rapier.es.js";

  const PASO = 1 / 120;      // paso fijo de física (s)
  const VMAX = 40;           // velocidad máxima (unidades/s), red de seguridad
  // Dónde se enganchan las piezas que no se sostienen solas
  const ESPIGAS = ["espiga", "espigaLarga"];
  /* Dónde puede morder una pinza de verdad (bordes finos, menos de ~1,5 cm):
       vores     listón plano: sus cantos largos y sus puntas
       boques    tubo de PVC: solo la boca (las puntas de sus paredes)
       boca-alta cono de alambre: solo el aro de arriba
     La rampa cóncava y los bloques son demasiado gruesos: no se pueden pinzar.
     Además, espigas y gomas (ver anclajePinza y gatillo). */
  const AGARRE = { liston: "vores", tubo: "boques", cono: "boca-alta" };
  // Dónde se puede enganchar una goma además de las espigas (px locales de la pieza)
  const FORATS = { liston: [[-100, 0], [100, 0]], canal: [[-100, 0], [100, 0]], bloque: [[-60, 0], [-20, 0], [20, 0], [60, 0]], cuna: [[30, 12]] };
  const MANGO_PINZA = [[64, 0]];
  const SOLAPE = 0.025; // las piezas pueden tocarse, pero no meterse una en otra más de 2,5 px

  const escenario = document.getElementById("escenario");
  const lienzo = document.getElementById("lienzo");
  const cargando = document.getElementById("cargando");

  /* ================= Cargar Rapier (WebAssembly) ================= */
  try {
    const mod = await import(RAPIER_URL);
    TK.R = mod.default || mod;
    await TK.R.init();
  } catch (e) {
    cargando.textContent = TK.t("errFisica");
    console.error(e);
    return;
  }
  const R = TK.R;

  /* ================= Escena ================= */
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: lienzo, antialias: true });
  } catch (e) {
    cargando.textContent = TK.t("errWebgl");
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const escena = new T.Scene();
  escena.background = new T.Color("#efe3cf");
  const camara = new T.PerspectiveCamera(30, 1, 0.1, 100);

  // Luz suave de museo: cielo cálido + foco desde arriba a la izquierda con sombras
  escena.add(new T.HemisphereLight("#fff6e6", "#b39270", 0.62));
  const foco = new T.DirectionalLight("#fff1dc", 1.2);
  foco.position.set(-5, 7, 7);
  foco.castShadow = true;
  foco.shadow.mapSize.set(2048, 2048);
  Object.assign(foco.shadow.camera, { left: -9, right: 9, top: 6, bottom: -6, near: 1, far: 30 });
  foco.shadow.bias = -0.0004;
  foco.shadow.normalBias = 0.02;
  escena.add(foco);

  // Pared, tablero perforado y marco
  let matFrente, matPared, grupTauler = null;
  matPared = new T.MeshStandardMaterial({ color: "#eadbc3", roughness: 1 });
  const pared = new T.Mesh(new T.PlaneGeometry(80, 50), matPared);
  pared.position.z = -0.6;
  pared.receiveShadow = true;
  escena.add(pared);
  matFrente = new T.MeshStandardMaterial({ roughness: 0.85 });
  const texTauler = {}; // una textura por medida de panel
  /** Tablero perforado y marco con la medida actual (TK.W x TK.H). */
  function construirTauler() {
    if (grupTauler) { escena.remove(grupTauler); grupTauler.traverse((o) => o.geometry && o.geometry.dispose()); }
    const clau = TK.W + "x" + TK.H;
    if (!texTauler[clau]) {
      const tex = new T.CanvasTexture(TK.lienzoTablero(1.5));
      tex.encoding = T.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texTauler[clau] = tex;
    }
    matFrente.map = texTauler[clau];
    matFrente.needsUpdate = true;
    grupTauler = new T.Group();
    const canto = TK.MAT.maderaMedia;
    const w = TK.W * S, h = TK.H * S;
    const tabla = new T.Mesh(new T.BoxGeometry(w, h, 0.3), [canto, canto, canto, canto, matFrente, canto]);
    tabla.position.z = -0.15;
    tabla.receiveShadow = tabla.castShadow = true;
    grupTauler.add(tabla);
    const g = 0.32; // grosor del marco
    [[0, h / 2 + g / 2, w + 2 * g, g], [0, -h / 2 - g / 2, w + 2 * g, g], [-w / 2 - g / 2, 0, g, h], [w / 2 + g / 2, 0, g, h]].forEach(([x, y, bw, bh]) => {
      const m = new T.Mesh(new T.BoxGeometry(bw, bh, 0.7), TK.MAT.maderaOscura);
      m.position.set(x, y, 0.05);
      m.castShadow = m.receiveShadow = true;
      grupTauler.add(m);
    });
    escena.add(grupTauler);
  }
  construirTauler();
  /** Cambia la medida del panel: el de los retos o el pequeño («Peces grans»). */
  function midaTauler(petit) {
    const W = petit ? TK.PETIT.W : TK.W0, H = petit ? TK.PETIT.H : TK.H0;
    if (W === TK.W && H === TK.H) return false;
    TK.W = W; TK.H = H;
    construirTauler();
    return true;
  }

  /**
   * Retos de mesa: el mismo tablero perforado, tumbado sobre una mesa y visto
   * desde arriba. Sin gravedad en el plano, luz cenital y otros colores.
   */
  // Tablero de la mesa: tablas de madera oscura con vetas (textura dibujada una vez)
  const texMesa = (function () {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 1024;
    const g = c.getContext("2d");
    const tonos = ["#8a5a33", "#93613a", "#7f522e", "#8e5d36"];
    const alto = 128;
    for (let k = 0; k < 8; k++) {
      g.fillStyle = tonos[k % tonos.length];
      g.fillRect(0, k * alto, 1024, alto);
      g.strokeStyle = "rgba(60, 35, 18, .28)";
      for (let v = 0; v < 9; v++) {
        g.lineWidth = 1 + (v % 3);
        g.beginPath();
        const y0 = k * alto + 10 + v * 13;
        for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y0 + Math.sin(x / 90 + k * 1.7 + v) * 4);
        g.stroke();
      }
      g.fillStyle = "rgba(40, 22, 10, .55)";
      g.fillRect(0, k * alto, 1024, 3); // junta entre tablas
    }
    const t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(5, 3);
    return t;
  })();
  /**
   * Panel o mesa. En la mesa todo cambia para que se note: el tablero está
   * tumbado sobre una mesa de madera, la cámara lo mira inclinada desde
   * delante, la luz cae de arriba y la interfaz se vuelve verde.
   */
  /* Mueble de la mesa baja: tablero de madera con canto grueso, cuatro patas
     y el suelo del aula debajo. Como la cámara mira inclinada desde delante,
     se ven el canto y las patas: se nota que es una mesa sobre la que se trabaja. */
  let moble = null;
  const matSuelo = new T.MeshStandardMaterial({ color: "#c9b79c", roughness: 1 });
  const matPata = new T.MeshStandardMaterial({ color: "#6b4426", roughness: 0.7 });
  function construirMoble() {
    if (moble) { escena.remove(moble); moble.traverse((o) => o.geometry && o.geometry.dispose()); }
    moble = new T.Group();
    const w = TK.W * S + 4.2, h = TK.H * S + 3.2, g = 0.5, z0 = -0.3;
    const sobre = new T.Mesh(new T.BoxGeometry(w, h, g), new T.MeshStandardMaterial({ map: texMesa, roughness: 0.75 }));
    sobre.position.z = z0 - g / 2;
    sobre.receiveShadow = sobre.castShadow = true;
    moble.add(sobre);
    // Patas: cortas (mesa baja) y gruesas, en las esquinas
    const llarg = 3.2;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const p = new T.Mesh(new T.BoxGeometry(0.55, 0.55, llarg), matPata);
      p.position.set(sx * (w / 2 - 0.6), sy * (h / 2 - 0.6), z0 - g - llarg / 2);
      p.castShadow = true;
      moble.add(p);
    }
    const terra = new T.Mesh(new T.PlaneGeometry(120, 90), matSuelo);
    terra.position.z = z0 - g - llarg;
    terra.receiveShadow = true;
    moble.add(terra);
    escena.add(moble);
  }
  /**
   * Panel o mesa. En la mesa todo cambia para que se note: el tablero está
   * tumbado sobre una mesa baja de madera (con canto, patas y suelo), la
   * cámara lo mira inclinada desde delante, la luz cae de arriba y la
   * interfaz se vuelve verde.
   */
  function aplicarAspecto(mesa) {
    TK.vistaMesa = mesa;
    document.body.classList.toggle("vista-mesa", mesa);
    escena.background.set(mesa ? "#d8c7ab" : "#efe3cf");
    pared.visible = !mesa;
    if (mesa) construirMoble(); else if (moble) { escena.remove(moble); moble = null; }
    matFrente.color.set(mesa ? "#fff1dc" : "#ffffff");
    if (mesa) foco.position.set(-2.5, 4, 10);
    else foco.position.set(-5, 7, 7);
    encuadrar();
  }

  // Halos: amarillo para la selección, rojo para los errores (pista del nivel 7)
  function crearHalo(color) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    const rg = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
    rg.addColorStop(0, color + ".95)");
    rg.addColorStop(0.65, color + ".6)");
    rg.addColorStop(1, color + "0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, 128, 128);
    return new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false });
  }
  const matHaloSel = crearHalo("rgba(255,205,70,"), matHaloError = crearHalo("rgba(235,70,60,");
  const geoHalo = new T.PlaneGeometry(1, 1);
  const halo = new T.Mesh(geoHalo, matHaloSel);
  halo.position.z = 0.012;
  halo.visible = false;
  escena.add(halo);
  const halosError = [];

  // Encuadre: el panel completo cabe entre la barra del reto y los mandos
  function encuadrar() {
    const w = escenario.clientWidth, h = escenario.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    const barra = document.querySelector(".barra");
    // La barra y las piezas ya no tapan el tablero (están fuera del escenario): solo un margen
    const reservaArriba = 12, reservaAbajo = 12;
    // A los lados están las cajas de piezas: el tablero no se mete debajo
    const lados = (document.getElementById("caixes-esq") || { offsetWidth: 0 }).offsetWidth + 14;
    const util = Math.max(h - reservaArriba - reservaAbajo, h * 0.55), utilW = Math.max(w - 2 * lados, w * 0.5);
    const bw = TK.W * S + 1.0, bh = TK.H * S + 1.0;
    const tan = Math.tan((camara.fov * Math.PI) / 360);
    const mesa = TK.vistaMesa;
    // En la mesa la cámara se inclina 40°: se ve una mesa baja (más ancha cerca, más estrecha lejos)
    const visH = (Math.max((bh * h) / util, (bw * w) / utilW / camara.aspect) * (mesa ? 1.18 : 1)) / vista.zoom;
    const d = visH / 2 / tan;
    const desplaza = ((reservaAbajo - reservaArriba) / 2 / h) * visH;
    // Con zoom, el tablero se puede desplazar, pero sin perderlo de vista
    const mx = Math.max(0, (bw / 2) * (1 - 1 / vista.zoom)), my = Math.max(0, (bh / 2) * (1 - 1 / vista.zoom));
    vista.x = Math.max(-mx, Math.min(mx, vista.x));
    vista.y = Math.max(-my, Math.min(my, vista.y));
    const cx = vista.x, cy = vista.y - desplaza;
    if (mesa) {
      const inc = (40 * Math.PI) / 180;
      camara.position.set(cx, cy - d * Math.sin(inc), d * Math.cos(inc));
    } else camara.position.set(cx + 0.45 / vista.zoom, cy + 0.35 / vista.zoom, d);
    camara.lookAt(cx, cy, 0);
    camara.updateProjectionMatrix();
    vista.d = d;
    vista.visH = visH;
  }
  /* Zoom del tablero: pellizcar con dos dedos, botones + / − / ver todo, o
     la rueda del ratón fuera de las piezas. El tablero no cambia de medida
     (es el panel real: espigas de 8 mm cada 2,5 cm); solo se acerca. */
  const vista = { zoom: 1, x: 0, y: 0, d: 1, visH: 1 };
  const ZOOM_MAX = 3;
  /** Acerca o aleja manteniendo fijo el punto de pantalla (sx, sy). */
  function hacerZoom(factor, sx, sy) {
    const z0 = vista.zoom, z = Math.max(1, Math.min(ZOOM_MAX, z0 * factor));
    if (z === z0) return;
    const r = lienzo.getBoundingClientRect();
    const ux = sx === undefined ? 0 : ((sx - r.left) / r.height - r.width / r.height / 2) * vista.visH;
    const uy = sy === undefined ? 0 : (0.5 - (sy - r.top) / r.height) * vista.visH;
    // El punto bajo el dedo se queda bajo el dedo
    vista.x += ux * (1 - z0 / z);
    vista.y += uy * (1 - z0 / z);
    vista.zoom = z;
    encuadrar();
    pintarZoom();
  }
  function moverVista(dxPx, dyPx) {
    const r = lienzo.getBoundingClientRect(), u = vista.visH / r.height;
    vista.x -= dxPx * u;
    vista.y += dyPx * u;
    encuadrar();
  }
  function zoomInicial() { vista.zoom = 1; vista.x = vista.y = 0; encuadrar(); pintarZoom(); }
  function pintarZoom() {
    const z = document.getElementById("zoom");
    if (!z) return;
    z.querySelector("[data-zoom='mes']").disabled = vista.zoom >= ZOOM_MAX - 0.01;
    z.querySelector("[data-zoom='menys']").disabled = z.querySelector("[data-zoom='tot']").disabled = vista.zoom <= 1.001;
  }
  /** Píxeles de pantalla que ocupa 1 px del panel (para que los toques sean a medida del dedo). */
  function pantallaPorPanel() {
    const r = lienzo.getBoundingClientRect();
    return r.height / (vista.visH / S);
  }
  const observador = new ResizeObserver(encuadrar);
  observador.observe(escenario);
  observador.observe(document.querySelector(".barra"));

  /* ================= Miniaturas 3D para el repositorio ================= */
  const TIPOS_REPO = TK.CATEGORIAS.flatMap((c) => c.piezas);
  const miniaturas = (function () {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(176, 132);
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.ACESFilmicToneMapping;
    const esc = new T.Scene();
    esc.add(new T.HemisphereLight("#fff7ea", "#a68a6a", 0.9));
    const l = new T.DirectionalLight("#ffffff", 0.9);
    l.position.set(-2, 3, 5);
    esc.add(l);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
    const ctx = { mundo: new R.World({ x: 0, y: -TK.GRAVEDAD }), mapa: new Map() };
    const out = {};
    for (const tipo of TIPOS_REPO) {
      const def = TK.PIEZAS[tipo];
      const inst = def.crear({ tipo, x: TK.W / 2, y: TK.H / 2, angulo: def.angulo0 || 0 }, ctx);
      esc.add(inst.raiz);
      inst.raiz.updateMatrixWorld(true);
      const caja = new T.Box3().setFromObject(inst.raiz);
      const c = caja.getCenter(new T.Vector3()), s = caja.getSize(new T.Vector3());
      const half = (Math.max(s.x / (4 / 3), s.y, 0.25) / 2) * 1.12;
      Object.assign(cam, { left: (-half * 4) / 3, right: (half * 4) / 3, top: half, bottom: -half });
      cam.position.set(c.x + half * 0.25, c.y + half * 0.3, c.z + 10);
      cam.lookAt(c);
      cam.updateProjectionMatrix();
      r.render(esc, cam);
      out[tipo] = r.domElement.toDataURL("image/png");
      esc.remove(inst.raiz);
      TK.liberar(inst.raiz);
    }
    ctx.mundo.free();
    r.dispose();
    return out;
  })();

  /* ================= Estado ================= */
  const estado = {
    nivel: 0,              // índice en TK.RETOS, o -1 = taller libre
    piezas: [],            // registros {tipo, x, y, angulo, fija, error, inst, extras}
    seleccion: null,
    jugando: false,
    superado: false,
    pista: false,
    memoria: {},           // montaje guardado por nivel
    pecesGrans: (() => { try { return localStorage.getItem("tinkerpad-grans") === "1"; } catch (e) { return false; } })(),
  };
  // estado.nivel: índice en TK.RETOS; -1 = taller libre en el panel; -2 = taller libre en la mesa
  const reto = () => (estado.nivel >= 0 ? TK.RETOS[estado.nivel] : null);
  const esMesa = () => (reto() ? !!reto().mesa : estado.nivel === -2);

  // ctx.mundo: mundo de Rapier; ctx.mapa: handle de collider -> {pieza, etiqueta}
  const ctx = { mundo: null, mapa: new Map() };
  let eventos = null, acumulado = 0, ultimaCampana = -1e9, pasosSimulados = 0, paresEngranaje = [], paresCadena = [];

  /* ================= Mundo físico ================= */
  function paredes() {
    const rb = ctx.mundo.createRigidBody(R.RigidBodyDesc.fixed());
    const w = (TK.W * S) / 2, h = (TK.H * S) / 2, g = 0.5;
    [[0, -h - g, w + 2, g], [0, h + g, w + 2, g], [-w - g, 0, g, h + 2], [w + g, 0, g, h + 2]].forEach(([x, y, hw, hh]) =>
      ctx.mundo.createCollider(R.ColliderDesc.cuboid(hw, hh).setTranslation(x, y).setFriction(TK.FIS.madera.f).setRestitution(TK.FIS.madera.r), rb));
  }

  function crearInst(rec) {
    rec.inst = TK.PIEZAS[rec.tipo].crear(rec, ctx);
    escena.add(rec.inst.raiz);
    // Tornillos de latón en las piezas fijas que no son espigas ni dinámicas
    const primero = rec.inst.cuerpos[0];
    const puntos = rec.inst.clavos || (primero.isFixed() && rec.tipo !== "espiga" && rec.tipo !== "espigaLarga" && !rec.inst.engranaje ? [{ x: rec.x, y: rec.y }] : []);
    if (rec.fija && puntos.length) {
      rec.extras = new T.Group();
      puntos.forEach((pt) => {
        const g = new T.Group();
        g.add(TK.cilindro(6, 0.06, TK.MAT.laton, { z: TK.Z + 0.23 }), TK.caja(10, 2, TK.MAT.ranura, { prof: 0.03, z: TK.Z + 0.26, r: 1, ang: 0.6 }));
        TK.pose(g, pt.x, pt.y, 0);
        rec.extras.add(g);
      });
      escena.add(rec.extras);
    }
  }
  function quitarMalla(rec) {
    if (!rec.inst) return;
    escena.remove(rec.inst.raiz);
    TK.liberar(rec.inst.raiz);
    if (rec.extras) { escena.remove(rec.extras); TK.liberar(rec.extras); rec.extras = null; }
  }
  function quitarInst(rec) {
    quitarMalla(rec);
    rec.inst.quitar();
    rec.inst = null;
  }
  function actualizarPieza(rec) {
    quitarInst(rec);
    crearInst(rec);
    alinearEngranajes();
  }

  /** Reconstruye TODO el mundo desde el montaje (base del determinismo). */
  function reconstruir() {
    estado.piezas.forEach(quitarMalla);
    if (ctx.mundo) ctx.mundo.free();
    if (eventos) eventos.free();
    ctx.mesa = esMesa();
    ctx.mundo = new R.World({ x: 0, y: ctx.mesa ? 0 : -TK.GRAVEDAD });
    ctx.mundo.timestep = PASO;
    ctx.mundo.integrationParameters.numSolverIterations = 8;
    ctx.mapa = new Map();
    eventos = new R.EventQueue(true);
    paredes();
    estado.piezas.forEach(crearInst);
    alinearEngranajes();
    acumulado = 0;
    pasosSimulados = 0;
    tocados.clear();
    ultimaCampana = -1e9;
  }

  /* ---------- Engranajes ---------- */
  /** Busca parejas que engranan y alinea los dientes visualmente. */
  function alinearEngranajes() {
    const ruedas = estado.piezas.filter((r) => r.inst && r.inst.engranaje).map((r) => r.inst);
    paresEngranaje = [];
    const vecinos = new Map(ruedas.map((i) => [i, []]));
    for (let a = 0; a < ruedas.length; a++) for (let b = a + 1; b < ruedas.length; b++) {
      const A = ruedas[a].engranaje, B = ruedas[b].engranaje;
      const d = Math.hypot(B.x - A.x, B.y - A.y);
      if (Math.abs(d - (A.r + B.r)) <= 4) {
        paresEngranaje.push([ruedas[a], ruedas[b]]);
        vecinos.get(ruedas[a]).push(ruedas[b]);
        vecinos.get(ruedas[b]).push(ruedas[a]);
      }
    }
    // Cadenas: unen dos ruedas que no se tocan (mismo sentido de giro)
    paresCadena = estado.piezas.filter((r) => r.tipo === "cadena" && r.a.inst && r.b.inst && r.a.inst.engranaje && r.b.inst.engranaje)
      .map((r) => [r.a.inst, r.b.inst]);
    // Recorrido en anchura: cada rueda nueva se gira para que sus dientes
    // caigan en los huecos de la vecina (sa + sb = 0 se mantiene al girar).
    const hecho = new Set();
    for (const raiz of ruedas) {
      if (hecho.has(raiz)) continue;
      raiz.engranaje.interno.rotation.z = 0;
      hecho.add(raiz);
      const cola = [raiz];
      while (cola.length) {
        const a = cola.shift(), A = a.engranaje;
        for (const b of vecinos.get(a)) {
          if (hecho.has(b)) continue;
          const B = b.engranaje, Pa = (2 * Math.PI) / A.n, Pb = (2 * Math.PI) / B.n;
          const alfa = Math.atan2(-(B.y - A.y), B.x - A.x); // en el plano Three (Y arriba)
          let sa = (alfa - A.interno.rotation.z) / Pa - 0.31;
          sa -= Math.floor(sa);
          B.interno.rotation.z = alfa + Math.PI - Pb * (0.81 - sa);
          hecho.add(b);
          cola.push(b);
        }
      }
    }
  }
  /** Iguala la velocidad en el punto de contacto: rA·ωA + rB·ωB = 0. */
  function acoplarEngranajes() {
    for (let it = 0; it < 24; it++) {
      for (const [a, b] of paresEngranaje) {
        const A = a.engranaje, B = b.engranaje;
        const wa = A.rb.angvel(), wb = B.rb.angvel();
        const error = A.r * wa + B.r * wb;
        const ia = a.girando ? 0 : 1 / A.rb.principalInertia(), ib = b.girando ? 0 : 1 / B.rb.principalInertia();
        const k = A.r * A.r * ia + B.r * B.r * ib;
        if (!k || Math.abs(error) < 1e-7) continue;
        const J = -error / k;
        if (ia) A.rb.setAngvel(wa + J * A.r * ia, true);
        if (ib) B.rb.setAngvel(wb + J * B.r * ib, true);
      }
      // Cadena: la velocidad en el borde es la misma y en el mismo sentido: rA·ωA − rB·ωB = 0
      for (const [a, b] of paresCadena) {
        const A = a.engranaje, B = b.engranaje;
        const wa = A.rb.angvel(), wb = B.rb.angvel();
        const error = A.r * wa - B.r * wb;
        const ia = a.girando ? 0 : 1 / A.rb.principalInertia(), ib = b.girando ? 0 : 1 / B.rb.principalInertia();
        const k = A.r * A.r * ia + B.r * B.r * ib;
        if (!k || Math.abs(error) < 1e-7) continue;
        const J = -error / k;
        if (ia) A.rb.setAngvel(wa + J * A.r * ia, true);
        if (ib) B.rb.setAngvel(wb - J * B.r * ib, true);
      }
    }
  }

  /** Eventos de contacto: campana, meta y sonido de golpes. */
  function alChocar(h1, h2, empieza) {
    if (!empieza) return;
    const c1 = ctx.mundo.getCollider(h1), c2 = ctx.mundo.getCollider(h2);
    if (!c1 || !c2) return;
    const b1 = c1.parent(), b2 = c2.parent();
    const i1 = ctx.mapa.get(h1) || {}, i2 = ctx.mapa.get(h2) || {};
    for (const [yo, otro] of [[i1, b2], [i2, b1]]) {
      if (!otro || !otro.isDynamic()) continue;
      if (yo.etiqueta === "campana" || yo.etiqueta === "meta") alcanzarObjetivo(yo.pieza, yo.etiqueta);
      // Pinza-gatillo: se suelta si le cae algo que pese bastante
      if (yo.etiqueta === "gatillo" && yo.pieza.disparar && otro.mass() >= TK.GOMA.GATILLO) yo.pieza.disparar();
    }
    if (c1.isSensor() || c2.isSensor()) return;
    const v1 = b1 ? b1.linvel() : { x: 0, y: 0 }, v2 = b2 ? b2.linvel() : { x: 0, y: 0 };
    const rel = Math.hypot(v1.x - v2.x, v1.y - v2.y);
    if (rel > 2) TK.audio.toc(rel / 3);
  }

  function pasoFisica() {
    pasosSimulados++;
    ctx.mundo.step(eventos);
    eventos.drainCollisionEvents(alChocar);
    // paso() de cada pieza: gomas (fuerza elástica), polea, manivela…
    for (const rec of estado.piezas) if (rec.inst.paso) rec.inst.paso();
    acoplarEngranajes();
    ctx.mundo.forEachRigidBody((rb) => {
      if (!rb.isDynamic()) return;
      const v = rb.linvel(), m = Math.hypot(v.x, v.y);
      if (m > VMAX) rb.setLinvel({ x: (v.x * VMAX) / m, y: (v.y * VMAX) / m }, true);
    });
  }

  /* ================= Objetivo y celebración ================= */
  const tocados = new Set(); // objetivos tocados en este Play
  /** Condiciones activas: las del reto (solo, sin, limite, distintos) más las de la variante. */
  function condiciones() {
    const r = reto(), base = r ? { solo: r.solo, sin: r.sin, limite: r.limite, distintos: r.distintos } : {};
    const v = estado.variante ? estado.variante.cambios : {};
    return { ...base, ...Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)) };
  }
  function alcanzarObjetivo(inst, etiqueta) {
    // Antirrebote en tiempo de simulación (no de reloj): no rompe el determinismo
    if (pasosSimulados - (inst.ultimoToque ?? -1e9) < 40) return;
    inst.ultimoToque = pasosSimulados;
    inst.sonar && inst.sonar();
    TK.audio.campana();
    if (estado.superado) return;
    // Retos con varios objetivos: hay que tocarlos todos (en el mismo Play)
    tocados.add(inst);
    const r = reto();
    if (r && r.totes) {
      const total = estado.piezas.filter((q) => q.fija && (q.tipo === "campana" || q.tipo === "meta")).length;
      if (tocados.size < total) { avisar(TK.t("falten", { n: total - tocados.size }), "bombilla"); return; }
    }
    // Condiciones del reto o de la variante (p. ej. "solo con 2 piezas")
    const c = condiciones();
    const puestas = estado.piezas.filter((r) => r.puesta);
    if (c.limite && puestas.length > c.limite) {
      avisar(TK.t("massaPeces", { n: puestas.length, m: c.limite }), "bombilla");
      return;
    }
    if (c.distintos && new Set(puestas.filter((r) => r.inst.engranaje).map((r) => r.tipo)).size < 2) {
      avisar(TK.t("distintos"), "bombilla");
      return;
    }
    estado.superado = true;
    TK.audio.fanfarria();
    lanzarConfeti(inst.p.x, inst.p.y);
    if (reto()) {
      document.getElementById("tarjeta-reto").classList.add("superado");
      if (!TK.Progres.superat(reto().id)) {
        TK.Progres.superar(reto().id);
        pintarNiveles();
      }
      const texto = TK.t(etiqueta === "meta" ? "metaOk" : "campanaOk");
      setTimeout(() => {
        if (!estado.superado) return;
        TK.Reflexion.abrir(ui.reflexion, { reto: TK.retoTraducit(reto()), texto: texto + " " + TK.t("deVeritat"), miniaturas, alAccion: accionReflexion });
        ui.victoria.hidden = false;
      }, 1100);
    }
  }
  /** Lo que se elige al final de la reflexión. */
  function accionReflexion(a) {
    ui.victoria.hidden = true;
    if (a === "otra") { reiniciar(); setTimeout(jugar, 250); }
    else if (a === "seguir") reiniciar();
    else if (a === "siguiente") {
      // Siguiente reto de la misma dificultad; al acabar la lista, a la portada
      const r = reto(), sig = TK.RETOS.findIndex((q, k) => k > estado.nivel && q.dificultat === r.dificultat);
      if (sig >= 0) cargarNivel(sig);
      else irPortada(r.dificultat);
    } else if (a && a.variante !== undefined) {
      const v = reto().reinventar[a.variante];
      if (v.cambios.libre) cargarNivel(reto().mesa ? -2 : -1);
      else cargarNivel(estado.nivel, v);
    }
  }

  const confeti = [];
  const geoConfeti = new T.PlaneGeometry(0.11, 0.06);
  const matConfeti = ["#e2483d", "#2f7fd8", "#3aa55b", "#ffcf3f", "#ef8a2a"].map((c) => new T.MeshBasicMaterial({ color: c, side: T.DoubleSide }));
  function lanzarConfeti(x, y) {
    for (let i = 0; i < 110; i++) {
      const m = new T.Mesh(geoConfeti, matConfeti[i % matConfeti.length]);
      m.position.set(TK.X(x), TK.Y(y), 0.9);
      m.userData = {
        v: new T.Vector3((Math.random() - 0.5) * 7, 2.5 + Math.random() * 4.5, Math.random() * 2),
        w: new T.Vector3(Math.random() * 10, Math.random() * 10, Math.random() * 10),
        vida: 2.4 + Math.random(),
      };
      escena.add(m);
      confeti.push(m);
    }
  }
  function animarConfeti(dt) {
    for (let i = confeti.length - 1; i >= 0; i--) {
      const m = confeti[i], u = m.userData;
      u.v.y -= 7 * dt;
      u.v.multiplyScalar(0.985);
      m.position.addScaledVector(u.v, dt);
      m.rotation.x += u.w.x * dt; m.rotation.y += u.w.y * dt; m.rotation.z += u.w.z * dt;
      u.vida -= dt;
      if (u.vida <= 0) { escena.remove(m); confeti.splice(i, 1); }
    }
  }

  /* ================= Bucle principal ================= */
  let previo = performance.now();
  function bucle(t) {
    const dt = Math.min(t - previo, 50) / 1000;
    previo = t;
    if (estado.jugando) {
      acumulado += dt;
      while (acumulado >= PASO) { pasoFisica(); acumulado -= PASO; }
    }
    for (const rec of estado.piezas) rec.inst.sync();
    actualizarHalos();
    animarConfeti(dt);
    renderer.render(escena, camara);
    requestAnimationFrame(bucle);
  }

  const cajaHalo = new T.Box3();
  function ponerHalo(m, rec) {
    cajaHalo.setFromObject(rec.inst.raiz);
    m.position.x = (cajaHalo.min.x + cajaHalo.max.x) / 2;
    m.position.y = (cajaHalo.min.y + cajaHalo.max.y) / 2;
    m.scale.set(cajaHalo.max.x - cajaHalo.min.x + 0.7, cajaHalo.max.y - cajaHalo.min.y + 0.7, 1);
  }
  // Puntos donde se puede enganchar una goma (anillos amarillos en modo enganche)
  const geoPunto = new T.TorusGeometry(0.075, 0.018, 8, 24);
  const matPunto = new T.MeshBasicMaterial({ color: "#ffc531" });
  const puntosGuia = [];
  function actualizarHalos() {
    const rec = estado.seleccion;
    halo.visible = !!(rec && !estado.jugando && rec.inst);
    if (halo.visible) {
      ponerHalo(halo, rec);
      halo.material = rec.choca ? matHaloError : matHaloSel; // rojo: ahí no se puede fijar
    }
    // Goma: anillos en cada punto donde se puede enganchar
    const pts = enganche && enganche.tipo === "goma" && !estado.jugando ? puntosGoma() : [];
    while (puntosGuia.length < pts.length) {
      const m = new T.Mesh(geoPunto, matPunto);
      escena.add(m);
      puntosGuia.push(m);
    }
    puntosGuia.forEach((m, k) => {
      m.visible = k < pts.length;
      if (m.visible) m.position.set(TK.X(pts[k].x), TK.Y(pts[k].y), TK.Z + 0.45);
    });
    // Pinza: brillan las espigas, los bordes que puede morder y las gomas
    const guia = enganche && enganche.tipo === "cadena"
      ? estado.piezas.filter((r) => r.inst && TK.radiEngranatge(r.tipo) && r !== enganche.a)
      : enganche && enganche.tipo === "pinza"
      ? estado.piezas.filter((r) => r.inst && (esEspiga(r) || (!enganche.goma && ((r.tipo in AGARRE) || (r.tipo === "goma" && !r.tensor)))))
      : [];
    const errores = (estado.pista && !estado.jugando ? estado.piezas.filter((r) => r.error && r.inst) : []).concat(guia);
    while (halosError.length < errores.length) {
      const m = new T.Mesh(geoHalo, matHaloError);
      m.position.z = 0.011;
      escena.add(m);
      halosError.push(m);
    }
    const nErrores = errores.length - guia.length;
    halosError.forEach((m, k) => {
      m.visible = k < errores.length;
      m.material = k < nErrores ? matHaloError : matHaloSel; // rojo = error, amarillo = enganche
      if (m.visible) ponerHalo(m, errores[k]);
    });
  }

  /* ================= Montaje: colocar, mover, girar, borrar ================= */
  const raycaster = new T.Raycaster(), ndc = new T.Vector2(), tmp = new T.Vector3();
  const plano = new T.Plane(new T.Vector3(0, 0, 1), -TK.Z);
  /** Punto del panel (px) bajo el puntero. */
  function puntoPanel(e) {
    const r = lienzo.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camara);
    if (!raycaster.ray.intersectPlane(plano, tmp)) return null;
    return { x: tmp.x / S + TK.W / 2, y: -tmp.y / S + TK.H / 2 };
  }
  function sobreLienzo(e) {
    const r = lienzo.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
  /** Ajuste a la rejilla suave, o al agujero más cercano si la pieza va en un eje. */
  function ajustar(tipo, x, y) {
    if (TK.PIEZAS[tipo].agujero) return { x: limitar(TK.agujero(x), 10, TK.W - 10), y: limitar(TK.agujero(y), 10, TK.H - 10) };
    const r = (v) => Math.round(v / TK.REJILLA) * TK.REJILLA;
    return { x: limitar(r(x), 20, TK.W - 20), y: limitar(r(y), 20, TK.H - 20) };
  }

  /** Pieza bajo un punto, con tolerancia para piezas finas (más con el dedo). */
  let tolerancia = 7;
  function piezaEn(pt) {
    const t = tolerancia, t2 = t * 2;
    for (const [dx, dy] of [[0, 0], [t, 0], [-t, 0], [0, t], [0, -t], [t2, 0], [-t2, 0], [0, t2], [0, -t2]]) {
      const q = { x: TK.X(pt.x + dx), y: TK.Y(pt.y + dy) };
      let mejor = null, idx = -1;
      ctx.mundo.forEachCollider((col) => {
        const info = ctx.mapa.get(col.handle);
        if (!info || !info.pieza || !col.containsPoint(q)) return;
        const i = estado.piezas.indexOf(info.pieza.p);
        if (i > idx) { idx = i; mejor = info.pieza.p; }
      });
      if (mejor) return mejor;
    }
    return null;
  }

  function mover(rec, x, y) {
    const a = ajustar(rec.tipo, x, y);
    if (a.x === rec.x && a.y === rec.y) return;
    rec.x = a.x; rec.y = a.y;
    actualizarPieza(rec);
    actualizarDependientes(rec);
  }
  /** Una pinza que muerde un listón no gira sola: gira con el listón. */
  const puedeGirar = (rec) => TK.PIEZAS[rec.tipo].rotable && !(rec.tipo === "pinza" && rec.host && !esEspiga(rec.host));
  function rotar(rec, dir) {
    if (!rec || rec.fija || estado.jugando || !puedeGirar(rec)) return;
    const antes = guardarPos(rec);
    rec.angulo =Math.round(((rec.angulo || 0) + dir * TK.PASO_GIRO) / TK.PASO_GIRO) * TK.PASO_GIRO;
    if (rec.angulo > Math.PI) rec.angulo -= 2 * Math.PI;
    if (rec.angulo <= -Math.PI) rec.angulo += 2 * Math.PI;
    if (rec.host) rec.local.ang = rec.angulo - (rec.host.angulo || 0);
    actualizarPieza(rec);
    actualizarDependientes(rec);
    if (solapa(rec)) { ponerPos(rec, antes); noCabe(rec); return; }
    TK.audio.clic();
  }
  function borrar(rec) {
    if (!rec || rec.fija || estado.jugando) return;
    quitarRegistro(rec);
    alinearEngranajes();
    seleccionar(null);
    TK.audio.clic();
  }
  /** Quita una pieza y lo que cuelga de ella (gomas y pinzas enganchadas). */
  function quitarRegistro(rec) {
    const k0 = estado.piezas.indexOf(rec);
    if (k0 < 0) return;
    estado.piezas.splice(k0, 1);
    dependientes(rec).forEach(quitarRegistro);
    if (rec.inst) quitarInst(rec);
    // Si se quita la pinza de un tirachinas, la goma vuelve a quedar recta
    if (rec.goma && rec.goma.tensor === rec) {
      rec.goma.tensor = null;
      if (estado.piezas.includes(rec.goma) && rec.goma.inst) actualizarPieza(rec.goma);
    }
    if (estado.seleccion === rec) seleccionar(null);
  }

  /* ---------- Enganches: gomas entre espigas y pinzas ----------
     La goma se engancha tocando dos espigas. La pinza se abre al tocarla y
     muerde una espiga o el borde de un listón (rampa cóncava, cono).
     Gomas y pinzas siguen a su espiga o listón si este se mueve o gira. */
  const esEspiga = (r) => !!r && ESPIGAS.includes(r.tipo);
  const dependientes = (rec) => estado.piezas.filter((r) => r.a === rec || r.b === rec || r.host === rec || r.goma === rec);
  const distancia = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  /** Punto del panel (px) de un punto local de una pieza: sigue su posición y su giro. */
  function aPanel(host, l) {
    const ha = host.angulo || 0, cs = Math.cos(ha), sn = Math.sin(ha);
    return { x: host.x + cs * l.x - sn * l.y, y: host.y + sn * l.x + cs * l.y };
  }
  /** Todos los puntos donde se puede enganchar una goma: espigas, agujeros y mangos de pinza. */
  function puntosGoma() {
    const out = [];
    for (const r of estado.piezas) {
      if (!r.inst) continue;
      const locales = esEspiga(r) ? [[0, 0]] : FORATS[r.tipo] || (r.tipo === "pinza" && !r.goma ? MANGO_PINZA : null);
      if (!locales) continue;
      for (const [x, y] of locales) out.push({ host: r, local: { x, y }, ...aPanel(r, { x, y }) });
    }
    return out;
  }
  function puntoGomaEn(pt, excluir) {
    let mejor = null, dmin = tolerancia * 2 + 6;
    for (const p of puntosGoma()) {
      if (excluir && distancia(p, excluir) < 4) continue;
      const d = distancia(p, pt);
      if (d < dmin) { dmin = d; mejor = p; }
    }
    return mejor;
  }
  /** Recalcula los extremos de una goma a partir de las piezas donde está enganchada. */
  function puntosDeGoma(r) {
    r.pa = aPanel(r.a, r.la || { x: 0, y: 0 });
    r.pb = aPanel(r.b, r.lb || { x: 0, y: 0 });
    r.x = (r.pa.x + r.pb.x) / 2;
    r.y = (r.pa.y + r.pb.y) / 2;
  }
  /** Goma bajo el dedo (no en sus extremos). */
  function gomaEn(pt) {
    let mejor = null, dmin = tolerancia + 10;
    for (const r of estado.piezas) {
      if (r.tipo !== "goma" || !r.pa) continue;
      const dx = r.pb.x - r.pa.x, dy = r.pb.y - r.pa.y, l2 = dx * dx + dy * dy;
      const t = ((pt.x - r.pa.x) * dx + (pt.y - r.pa.y) * dy) / l2;
      if (t < 0.12 || t > 0.88) continue;
      const d = Math.abs((pt.x - r.pa.x) * dy - (pt.y - r.pa.y) * dx) / Math.sqrt(l2);
      if (d < dmin) { dmin = d; mejor = r; }
    }
    return mejor;
  }

  /* ---------- Las piezas no se pueden cruzar ----------
     Se comprueba la pieza que se mueve contra todas las demás con la forma
     exacta de sus colliders (contactCollider). Tocarse está permitido. */
  const solidos = (rec) => {
    const out = [];
    for (const rb of rec.inst.cuerpos) for (let k = 0; k < rb.numColliders(); k++) { const c = rb.collider(k); if (!c.isSensor()) out.push(c); }
    return out;
  };
  function convivenBien(rec, otro) {
    if (otro === rec || !otro.inst || otro.tipo === "goma" || otro.tipo === "cadena") return true;
    if (rec.host === otro || otro.host === rec) return true;            // la pinza muerde esa pieza
    if (rec.host && rec.host === otro.host) return true;                 // dos pinzas en la misma espiga
    return false;
  }
  function solapa(rec) {
    if (!rec || !rec.inst || rec.tipo === "goma" || rec.tipo === "cadena") return false;
    const mios = solidos(rec);
    for (const otro of estado.piezas) {
      if (convivenBien(rec, otro)) continue;
      // Dos engranajes: pueden engranar (ejes a r1 + r2), pero no montarse
      if (rec.inst.engranaje && otro.inst.engranaje) {
        const A = rec.inst.engranaje, B = otro.inst.engranaje;
        if (distancia(A, B) < A.r + B.r - 5) return otro;
        continue;
      }
      // Un engranaje cuenta por el centro de su rueda (los dientes y la biela
      // giran y pueden rozar la campana o una bola: para eso están)
      const rueda = rec.inst.engranaje || otro.inst.engranaje;
      if (rueda) {
        const fija = rec.inst.engranaje ? otro : rec;
        const forma = new R.Ball(rueda.r * 0.6 * S), centro = { x: TK.X(rueda.x), y: TK.Y(rueda.y) };
        for (const c of solidos(fija)) { const k = c.contactShape(forma, centro, 0, 0); if (k && k.distance < -SOLAPE) return otro; }
        continue;
      }
      for (const c2 of solidos(otro)) for (const c1 of mios) {
        const k = c1.contactCollider(c2, 0);
        if (k && k.distance < -SOLAPE) return otro;
      }
    }
    return false;
  }
  const guardarPos = (rec) => ({ x: rec.x, y: rec.y, angulo: rec.angulo, host: rec.host, local: rec.local ? { ...rec.local } : undefined });
  function ponerPos(rec, p) {
    Object.assign(rec, p, { local: p.local ? { ...p.local } : undefined });
    rec.choca = false;
    actualizarPieza(rec);
    actualizarDependientes(rec);
  }
  /** Busca un sitio libre cerca de (x, y) para una pieza nueva. */
  function buscarSitio(rec) {
    const x0 = rec.x, y0 = rec.y;
    for (let r = 0; r <= 480; r += 40) {
      const pasos = r ? Math.round((2 * Math.PI * r) / 40) : 1;
      for (let k = 0; k < pasos; k++) {
        const a = (k / pasos) * 2 * Math.PI, p = ajustar(rec.tipo, x0 + r * Math.cos(a), y0 + r * Math.sin(a));
        rec.x = p.x; rec.y = p.y;
        actualizarPieza(rec);
        if (!solapa(rec)) return true;
      }
    }
    return false;
  }
  let destello = null;
  /** La pieza no cabe: halo rojo un momento y aviso. */
  function noCabe(rec) {
    rec.choca = true;
    clearTimeout(destello);
    destello = setTimeout(() => { rec.choca = false; }, 700);
    avisar(TK.t("noCap"), "bombilla");
  }

  /** Espiga más cercana al punto (con margen para el dedo). */
  function espigaEn(pt, excluir) {
    const lim = tolerancia * 2 + 4;
    let mejor = null, dmin = lim;
    for (const r of estado.piezas) {
      if (!esEspiga(r) || r === excluir) continue;
      const d = distancia(r, pt);
      if (d < dmin) { dmin = d; mejor = r; }
    }
    return mejor;
  }

  /** Dónde mordería una pinza en este punto: una espiga o el borde de un listón. */
  function anclajePinza(pt, anguloEspiga) {
    const espiga = espigaEn(pt);
    if (espiga) return { host: espiga, x: espiga.x, y: espiga.y, angulo: anguloEspiga };
    const q = { x: TK.X(pt.x), y: TK.Y(pt.y) }, lim = (tolerancia + 6) * S;
    let mejor = null, dmin = Infinity;
    for (const r of estado.piezas) {
      if (!(r.tipo in AGARRE) || !r.inst) continue;
      const rb = r.inst.cuerpos[0];
      for (let k = 0; k < rb.numColliders(); k++) {
        const col = rb.collider(k);
        if (col.shapeType() !== R.ShapeType.Cuboid) continue;
        const c = col.translation(), a = col.rotation(), h = col.halfExtents();
        const cs = Math.cos(a), sn = Math.sin(a);
        const lx = cs * (q.x - c.x) + sn * (q.y - c.y), ly = -sn * (q.x - c.x) + cs * (q.y - c.y);
        const dx = Math.abs(lx) - h.x, dy = Math.abs(ly) - h.y;
        const fuera = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
        if (fuera > lim) continue;
        // Borde más cercano: cara larga (y) o punta (x). Según la pieza, solo vale donde una
        // pinza de verdad puede morder (ver AGARRE): el tubo y el cono, solo por la boca.
        const regla = AGARRE[r.tipo];
        const caraLarga = regla === "vores" && (dx < 0 && dy < 0 ? -dy <= -dx : dy >= dx);
        if (!caraLarga) {
          // Punta: el extremo del borde
          const ex = c.x + cs * Math.sign(lx || 1) * h.x, ey = c.y + sn * Math.sign(lx || 1) * h.x;
          if (Math.hypot(q.x - ex, q.y - ey) > lim + h.y) continue;
          if (regla === "boca-alta") {
            // Cono: solo el aro de arriba (el extremo que queda hacia arriba en la pieza)
            const ha = r.angulo || 0, hx = TK.X(r.x), hy = TK.Y(r.y);
            if ((ex - hx) * Math.sin(ha) + (ey - hy) * Math.cos(ha) < 0.15) continue;
          }
        }
        const margen = Math.min(9 * S, h.x);
        const bx = caraLarga ? Math.max(-h.x + margen, Math.min(h.x - margen, lx)) : Math.sign(lx || 1) * h.x;
        const by = caraLarga ? Math.sign(ly || 1) * h.y : Math.max(-h.y, Math.min(h.y, ly));
        const nx = caraLarga ? 0 : Math.sign(lx || 1), ny = caraLarga ? Math.sign(ly || 1) : 0;
        const d = Math.min(fuera, Math.abs(caraLarga ? Math.abs(ly) - h.y : Math.abs(lx) - h.x));
        if (d >= dmin) continue;
        dmin = d;
        // De vuelta a px del panel (Y hacia abajo)
        const wx = c.x + cs * bx - sn * by, wy = c.y + sn * bx + cs * by;
        const wnx = cs * nx - sn * ny, wny = sn * nx + cs * ny;
        mejor = { host: r, x: wx / S + TK.W / 2, y: -wy / S + TK.H / 2, angulo: Math.atan2(-wny, wnx) };
      }
    }
    return mejor;
  }

  /** Guarda la posición de la pinza relativa a la pieza que muerde. */
  function fijarEnHost(rec, anc) {
    const h = anc.host, ha = h.angulo || 0, cs = Math.cos(ha), sn = Math.sin(ha);
    const dx = anc.x - h.x, dy = anc.y - h.y;
    Object.assign(rec, { host: h, x: anc.x, y: anc.y, angulo: anc.angulo });
    rec.local = { x: cs * dx + sn * dy, y: -sn * dx + cs * dy, ang: anc.angulo - ha };
  }
  /** Recoloca la pinza tras mover o girar la pieza que muerde. */
  function seguirHost(rec) {
    const h = rec.host, ha = h.angulo || 0, cs = Math.cos(ha), sn = Math.sin(ha), l = rec.local;
    rec.x = h.x + cs * l.x - sn * l.y;
    rec.y = h.y + sn * l.x + cs * l.y;
    rec.angulo = ha + l.ang;
  }
  /** Tras mover/girar una pieza: las gomas y pinzas enganchadas la siguen. */
  function actualizarDependientes(rec) {
    for (const r of dependientes(rec)) {
      if (!estado.piezas.includes(r)) continue;
      if (r.tipo === "cadena") {
        // La cadena sigue a sus engranajes; si quedan demasiado cerca o lejos, salta
        const mida = TK.midaCadena(r.a, r.b), d = distancia(r.a, r.b);
        if (!mida || d < TK.radiEngranatge(r.a.tipo) + TK.radiEngranatge(r.b.tipo) + TK.CADENA.MARGE) { quitarRegistro(r); avisar(TK.t("cadenaSaltada"), "bombilla"); continue; }
        Object.assign(r, { mida, x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 });
        actualizarPieza(r);
        continue;
      }
      if (r.tipo === "goma") {
        puntosDeGoma(r);
        const d = distancia(r.pa, r.pb);
        if (d > TK.GOMA.MAX || d < TK.GOMA.MIN || (r.tensor && !tiraValida(r, r.tensor.host))) {
          quitarRegistro(r);
          avisar(TK.t(d < TK.GOMA.MIN ? "gomaCaiguda" : "gomaSaltada"), "goma");
          continue;
        }
        actualizarPieza(r);
      } else {
        if (r.goma && rec === r.goma) { actualizarPieza(r); continue; } // gatillo: la goma se ha movido
        seguirHost(r);
        actualizarPieza(r);
        if (r.goma) {
          if (!tiraValida(r.goma, r.host)) { quitarRegistro(r); avisar(TK.t("gomaSaltada"), "goma"); continue; }
          actualizarPieza(r.goma);
        }
        actualizarDependientes(r); // gomas enganchadas al mango de la pinza
      }
    }
  }
  /** ¿Se puede estirar la goma g hasta la espiga e (tirachinas)? Devuelve el motivo si no. */
  function motivoTira(g, e) {
    if (distancia(e, g.pa) < 12 || distancia(e, g.pb) < 12) return "altraEspiga";
    const dx = g.pb.x - g.pa.x, dy = g.pb.y - g.pa.y, l = Math.hypot(dx, dy);
    const t = ((e.x - g.pa.x) * dx + (e.y - g.pa.y) * dy) / (l * l);
    const h = Math.abs((e.x - g.pa.x) * dy - (e.y - g.pa.y) * dx) / l;
    if (t < 0.1 || t > 0.9 || h < 24) return "gatillLinia";
    if (distancia(e, g.pa) + distancia(e, g.pb) > TK.GOMA.TIRA) return "gomaLluny";
    return null;
  }
  const tiraValida = (g, e) => !motivoTira(g, e);

  function nuevaPieza(rec) {
    estado.piezas.push(rec);
    crearInst(rec);
    seleccionar(rec);
    TK.audio.clic();
    return rec;
  }
  /** Crea una goma entre dos puntos de enganche {host, local, x, y} (o explica por qué no se puede). */
  function crearGoma(A, B) {
    const d = distancia(A, B);
    if (d > TK.GOMA.MAX) { avisar(TK.t("gomaLluny"), "goma"); return null; }
    if (d < TK.GOMA.MIN) { avisar(TK.t("gomaAprop"), "goma"); return null; }
    if (estado.piezas.some((r) => r.tipo === "goma" && r.pa && ((distancia(r.pa, A) < 4 && distancia(r.pb, B) < 4) || (distancia(r.pa, B) < 4 && distancia(r.pb, A) < 4)))) {
      avisar(TK.t("gomaRepetida"), "goma");
      return null;
    }
    const rec = { tipo: "goma", a: A.host, la: { ...A.local }, b: B.host, lb: { ...B.local }, angulo: 0, fija: false, puesta: true };
    puntosDeGoma(rec);
    nuevaPieza(rec);
    const tension = d / TK.GOMA.L0;
    avisar(TK.t(tension <= 1 ? "gomaFluixa" : tension < 1.6 ? "gomaTensa" : "gomaMoltTensa"), "goma");
    return rec;
  }
  /** Engranaje (o manivela) bajo el dedo: se puede tocar en cualquier punto de la rueda. */
  function engranajeEn(pt) {
    let mejor = null, dmin = Infinity;
    for (const r of estado.piezas) {
      const rr = TK.radiEngranatge(r.tipo);
      if (!rr) continue;
      const d = distancia(r, pt);
      if (d <= rr + tolerancia + 6 && d < dmin) { dmin = d; mejor = r; }
    }
    return mejor;
  }
  /** Cadena de bicicleta entre dos engranajes: la medida más corta que llega. */
  function crearCadena(a, b) {
    const d = distancia(a, b);
    if (d < TK.radiEngranatge(a.tipo) + TK.radiEngranatge(b.tipo) + TK.CADENA.MARGE) { avisar(TK.t("cadenaAprop"), "bombilla", 3000); return null; }
    const mida = TK.midaCadena(a, b);
    if (!mida) { avisar(TK.t("cadenaLluny", { n: TK.CADENA.MIDES[TK.CADENA.MIDES.length - 1] }), "bombilla", 3000); return null; }
    if (estado.piezas.some((r) => r.tipo === "cadena" && ((r.a === a && r.b === b) || (r.a === b && r.b === a)))) { avisar(TK.t("cadenaRepetida"), "bombilla"); return null; }
    const rec = nuevaPieza({ tipo: "cadena", a, b, mida, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, angulo: 0, fija: false, puesta: true });
    alinearEngranajes();
    avisar(TK.t("cadenaMida", { n: mida }), "bombilla", 3500);
    return rec;
  }
  function crearPinza(anc) {
    const rec = { tipo: "pinza", fija: false, puesta: true };
    fijarEnHost(rec, anc);
    nuevaPieza(rec);
    if (solapa(rec)) { quitarRegistro(rec); noCabeAviso(); return null; }
    return rec;
  }
  const noCabeAviso = () => avisar(TK.t("noCap"), "bombilla");
  /**
   * Tirachinas: la pinza muerde la goma g, la estira hasta la espiga e y se
   * apoya en ella. El mango sale paralelo a la goma, hacia fuera.
   */
  function crearGatillo(g, e, grados) {
    const motivo = motivoTira(g, e);
    if (motivo) { avisar(TK.t(motivo), "goma", 3000); return null; }
    const dx = g.pb.x - g.pa.x, dy = g.pb.y - g.pa.y;
    const t = ((e.x - g.pa.x) * dx + (e.y - g.pa.y) * dy) / (dx * dx + dy * dy);
    const angulo = grados !== undefined ? (grados * Math.PI) / 180 : Math.atan2(dy, dx) + (t < 0.5 ? Math.PI : 0);
    const rec = { tipo: "pinza", fija: false, puesta: true, goma: g };
    fijarEnHost(rec, { host: e, x: e.x, y: e.y, angulo });
    g.tensor = rec;
    nuevaPieza(rec);
    actualizarPieza(g);
    if (solapa(rec)) { quitarRegistro(rec); noCabeAviso(); return null; }
    avisar(TK.t("gatillLlest"), "goma", 3500);
    return rec;
  }

  /* Modo enganche: tras escoger goma o pinza en el repositorio, se toca el panel */
  let enganche = null; // { tipo, a } (a = primera espiga de la goma)
  const fantasmaGoma = TK.mallaGoma(), fantasmaPinza = TK.mallaPinza();
  fantasmaPinza.abrir(1);
  fantasmaGoma.raiz.visible = fantasmaPinza.raiz.visible = false;
  escena.add(fantasmaGoma.raiz, fantasmaPinza.raiz);
  // Claves de los textos del modo enganche (js/textos/<idioma>.js)
  const CLAVES_ENGANCHE = {
    goma: { falta: "faltaGoma", toca: "tocaGoma1", otra: "tocaGoma2", no: "noGoma" },
    pinza: { falta: "faltaPinza", toca: "tocaPinza", no: "noPinza" },
    cadena: { falta: "faltaCadena", toca: "tocaCadena1", otra: "tocaCadena2", no: "noCadena" },
  };
  const textoEnganche = (tipo) => Object.fromEntries(Object.entries(CLAVES_ENGANCHE[tipo]).map(([k, v]) => [k, TK.t(v)]));
  // Solo se piden espigas si en el panel no hay ningún sitio donde engancharla
  function hayDondeEnganchar(tipo) {
    if (tipo === "goma") return puntosGoma().length >= 2;
    if (tipo === "cadena") return estado.piezas.filter((r) => TK.radiEngranatge(r.tipo)).length >= 2;
    return estado.piezas.some((r) => esEspiga(r) || (r.tipo in AGARRE) || r.tipo === "goma");
  }
  function empezarEnganche(tipo) {
    if (!hayDondeEnganchar(tipo)) { avisar(textoEnganche(tipo).falta, "espiga", 3500); return false; }
    enganche = { tipo, a: null };
    seleccionar(null);
    avisar(textoEnganche(tipo).toca, "mano", Infinity);
    ui.repo.querySelectorAll(".ficha").forEach((f) => f.classList.toggle("activa", f.dataset.tipo === tipo));
    return true;
  }
  function acabarEnganche() {
    if (!enganche) return;
    enganche = null;
    fantasmaGoma.raiz.visible = fantasmaPinza.raiz.visible = false;
    ui.aviso.hidden = true;
    ui.repo.querySelectorAll(".ficha.activa").forEach((f) => f.classList.remove("activa"));
  }
  /** Un toque en el panel mientras se engancha una goma o una pinza. */
  function tocarEnganche(pt) {
    const t = textoEnganche(enganche.tipo);
    if (enganche.tipo === "cadena") {
      const e = engranajeEn(pt);
      if (!e) { avisar(t.no, "bombilla", Infinity); return; }
      if (!enganche.a) { enganche.a = e; TK.audio.clic(); avisar(t.otra, "mano", Infinity); return; }
      if (e === enganche.a) { avisar(t.otra, "mano", Infinity); return; }
      const a = enganche.a;
      acabarEnganche();
      crearCadena(a, e);
      return;
    }
    if (enganche.tipo === "goma") {
      const punto = puntoGomaEn(pt, enganche.a);
      if (!punto) { avisar(enganche.a && puntoGomaEn(pt) ? TK.t("altraEspiga") : t.no, "espiga", Infinity); return; }
      if (!enganche.a) { enganche.a = punto; TK.audio.clic(); avisar(t.otra, "mano", Infinity); moverEnganche(pt); return; }
      const a = enganche.a;
      acabarEnganche();
      crearGoma(a, punto);
    } else if (enganche.goma) {
      // Segundo toque del tirachinas: la espiga donde se apoya la pinza
      const e = espigaEn(pt);
      if (!e) { avisar(TK.t("gatillEspiga"), "espiga", Infinity); return; }
      const g = enganche.goma;
      acabarEnganche();
      crearGatillo(g, e);
    } else {
      const e = espigaEn(pt), g = gomaEn(pt);
      if (g && !g.tensor && (!e || distancia(pt, e) > 12)) {
        enganche.goma = g;
        TK.audio.clic();
        avisar(TK.t("gatillEspiga"), "mano", Infinity);
        return;
      }
      const anc = anclajePinza(pt, 0);
      if (!anc) { avisar(t.no, "espiga", Infinity); return; }
      acabarEnganche();
      crearPinza(anc);
    }
  }
  /** Vista previa: la goma sale del primer punto; la pinza abierta sigue al dedo. */
  function moverEnganche(pt) {
    if (enganche.tipo === "cadena") return;
    if (enganche.tipo === "goma") {
      if (!enganche.a) return;
      const fin = puntoGomaEn(pt, enganche.a) || pt;
      fantasmaGoma.dibujar({ x: TK.X(enganche.a.x), y: TK.Y(enganche.a.y) }, { x: TK.X(fin.x), y: TK.Y(fin.y) });
      fantasmaGoma.raiz.visible = true;
    } else {
      const anc = anclajePinza(pt, 0) || { x: pt.x, y: pt.y, angulo: 0 };
      TK.pose(fantasmaPinza.raiz, anc.x, anc.y, anc.angulo);
      fantasmaPinza.raiz.position.z = 0.04;
      fantasmaPinza.raiz.visible = true;
    }
  }
  function seleccionar(rec) {
    estado.seleccion = rec;
    actualizarMandos();
  }

  let arrastre = null;     // mover una pieza del panel
  let nueva = null;        // sacar una pieza del repositorio
  let manivela = null;     // manivela que se está girando durante el Play

  /* Dedos sobre el tablero: con dos se hace zoom (pellizco) y se mueve la vista */
  const dedos = new Map();
  let pellizco = null, esperarDedos = false, primerDedoPieza = null;
  function empezarPellizco() {
    // El primer dedo había empezado a mover una pieza: vuelve a su sitio
    if (arrastre) { ponerPos(arrastre.rec, arrastre.inicial); if (arrastre.rec.tipo === "pinza" && arrastre.rec.inst) arrastre.rec.inst.abrir(0); arrastre = null; }
    if (manivela) { manivela.girando = false; manivela = null; }
    const [a, b] = [...dedos.values()];
    pellizco = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: vista.zoom, m: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    // Si el primer dedo estaba sobre la pieza seleccionada, los dos dedos la giran (en pasos de 15°)
    const p = primerDedoPieza;
    if (p && p === estado.seleccion && !estado.jugando && !p.fija && puedeGirar(p))
      pellizco.girar = { rec: p, a0: Math.atan2(b.y - a.y, b.x - a.x), pasos: 0 };
  }
  function moverPellizco() {
    const [a, b] = [...dedos.values()];
    if (pellizco.girar) {
      const g = pellizco.girar;
      let d = Math.atan2(b.y - a.y, b.x - a.x) - g.a0;
      d = Math.atan2(Math.sin(d), Math.cos(d)); // entre -180° y 180°
      const pasos = Math.round(d / TK.PASO_GIRO);
      while (g.pasos < pasos) { rotar(g.rec, 1); g.pasos++; }
      while (g.pasos > pasos) { rotar(g.rec, -1); g.pasos--; }
      return;
    }
    const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    moverVista(m.x - pellizco.m.x, m.y - pellizco.m.y);
    hacerZoom((pellizco.z0 * d) / pellizco.d0 / vista.zoom, m.x, m.y);
    pellizco.m = m;
  }
  const dedoFuera = (e) => {
    if (!dedos.has(e.pointerId)) return;
    dedos.delete(e.pointerId);
    if (pellizco && dedos.size < 2) { pellizco = null; esperarDedos = dedos.size > 0; }
    if (!dedos.size) esperarDedos = false;
  };
  lienzo.addEventListener("pointerup", dedoFuera);
  lienzo.addEventListener("pointercancel", dedoFuera);

  lienzo.addEventListener("pointerdown", (e) => {
    TK.audio.activar();
    if (e.pointerType === "touch") {
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 2) { empezarPellizco(); return; }
      if (dedos.size > 2 || esperarDedos) return;
    }
    // Radio de toque en píxeles de pantalla (un dedo ~ 28 px, un ratón ~ 11 px),
    // pasado a px del panel: con zoom, el radio en el panel se hace más pequeño.
    const k = pantallaPorPanel();
    tolerancia = e.pointerType === "touch" ? Math.max(7, (28 / k - 4) / 2) : Math.max(5, (11 / k - 4) / 2);
    if (nueva) return;
    const pt = puntoPanel(e);
    if (!pt) return;
    const rec = piezaEn(pt);
    if (e.pointerType === "touch") primerDedoPieza = rec;
    if (estado.jugando) {
      if (rec && rec.inst.manivela) {
        manivela = rec.inst;
        manivela.girando = true;
        lienzo.setPointerCapture(e.pointerId);
        lienzo.style.cursor = "grabbing";
      }
      return;
    }
    if (enganche) { tocarEnganche(pt); return; }
    if (!rec) { seleccionar(null); return; }
    if (rec.fija) { seleccionar(null); avisar(TK.t("clavada"), "candado"); return; }
    seleccionar(rec);
    // La goma no se arrastra: se mueven sus espigas (o se quita). La pinza del tirachinas tampoco.
    if (rec.tipo === "goma" || rec.goma) return;
    arrastre = { rec, dx: rec.x - pt.x, dy: rec.y - pt.y, valida: guardarPos(rec), inicial: guardarPos(rec) };
    if (rec.tipo === "pinza") rec.inst.abrir(1); // al cogerla, la pinza se abre
    lienzo.setPointerCapture(e.pointerId);
    lienzo.style.cursor = "grabbing";
  });
  /** Arrastrar una pinza: muerde la espiga o el borde más cercano al dedo. */
  function moverPinza(rec, pt) {
    const anc = anclajePinza(pt, esEspiga(rec.host) ? rec.angulo : 0);
    if (!anc || (anc.host === rec.host && Math.abs(anc.x - rec.x) < 1 && Math.abs(anc.y - rec.y) < 1)) return;
    fijarEnHost(rec, anc);
    actualizarPieza(rec);
    actualizarDependientes(rec);
    rec.inst.abrir(1);
  }
  lienzo.addEventListener("pointermove", (e) => {
    if (dedos.has(e.pointerId)) {
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pellizco && dedos.size >= 2) { moverPellizco(); return; }
      if (esperarDedos) return;
    }
    if (nueva) return;
    const pt = puntoPanel(e);
    if (!pt) return;
    if (enganche && !estado.jugando) { moverEnganche(pt); return; }
    if (arrastre) {
      const x = pt.x + arrastre.dx, y = pt.y + arrastre.dy;
      const r = arrastre.rec;
      if (r.tipo === "pinza") moverPinza(r, { x, y });
      else mover(r, x, y);
      r.choca = solapa(r);
      if (!r.choca) arrastre.valida = guardarPos(r);
      return;
    }
    if (manivela) return;
    const rec = piezaEn(pt);
    if (estado.jugando) { lienzo.style.cursor = rec && rec.inst.manivela ? "grab" : "default"; return; }
    lienzo.style.cursor = !rec ? "default" : rec.fija ? "not-allowed" : "grab";
  });
  const soltar = () => {
    if (arrastre) TK.audio.clic();
    // Si al soltarla se cruza con otra pieza, vuelve al último sitio libre
    if (arrastre && arrastre.rec.choca) { ponerPos(arrastre.rec, arrastre.valida); noCabeAviso(); }
    if (arrastre && arrastre.rec.tipo === "pinza" && arrastre.rec.inst) arrastre.rec.inst.abrir(0);
    arrastre = null;
    if (manivela) { manivela.girando = false; manivela = null; }
    lienzo.style.cursor = "default";
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  let ultimoGiro = 0;
  lienzo.addEventListener("wheel", (e) => {
    const pt = puntoPanel(e);
    const rec = !estado.jugando && (estado.seleccion || (pt && piezaEn(pt)));
    // Sin pieza debajo (o con Ctrl, o jugando): la rueda acerca y aleja el tablero
    if (!rec || e.ctrlKey) { e.preventDefault(); hacerZoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY); return; }
    e.preventDefault();
    const ahora = performance.now();
    if (ahora - ultimoGiro < 120) return;
    ultimoGiro = ahora;
    rotar(rec, e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  const ui = {
    repo: document.getElementById("repo-lista"),
    play: document.getElementById("btn-play"),
    reiniciar: document.getElementById("btn-reiniciar"),
    izq: document.getElementById("btn-izq"),
    der: document.getElementById("btn-der"),
    borrar: document.getElementById("btn-borrar"),
    pista: document.getElementById("btn-pista"),
    grans: document.getElementById("btn-grans"),
    modo: document.getElementById("modo"),
    victoria: document.getElementById("victoria"),
    reflexion: document.getElementById("reflexion"),
    variante: document.getElementById("variante"),
    aviso: document.getElementById("aviso"),
    enunciado: document.getElementById("enunciado"),
    nivel: document.getElementById("nivel"),
    niveles: document.getElementById("niveles"),
    casa: document.getElementById("barra-casa"),
    caixesEsq: document.getElementById("caixes-esq"),
    caixesDre: document.getElementById("caixes-dre"),
  };

  // Sacar piezas del repositorio (arrastrar, o tocar para ponerla en el centro)
  ui.repo.addEventListener("pointerdown", (e) => {
    TK.audio.activar();
    const ficha = e.target.closest(".ficha");
    if (!ficha) return;
    e.preventDefault();
    if (estado.jugando) { avisar(TK.t("tornaMuntarAvis"), "reiniciar"); return; }
    const tipo = ficha.dataset.tipo;
    // Goma y pinza no se sostienen solas: se enganchan a espigas o bordes
    if (TK.PIEZAS[tipo].engancha) {
      if (enganche && enganche.tipo === tipo) { acabarEnganche(); return; }
      acabarEnganche();
      if (empezarEnganche(tipo)) { nueva = { tipo, x0: e.clientX, y0: e.clientY, enganche: true, movido: false }; setTimeout(tancarCaixa, 0); }
      return;
    }
    acabarEnganche();
    nueva = { tipo, x0: e.clientX, y0: e.clientY, rec: null, movido: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!nueva) return;
    if (Math.hypot(e.clientX - nueva.x0, e.clientY - nueva.y0) > 6) nueva.movido = true;
    if (!nueva.movido) return;
    if (!ui.repo.hidden) ui.repo.hidden = true; // al arrastrar, la bandeja se aparta para ver el tablero
    if (nueva.enganche) {
      const pt = sobreLienzo(e) && puntoPanel(e);
      if (pt && enganche) moverEnganche(pt);
      return;
    }
    const pt = sobreLienzo(e) && puntoPanel(e);
    if (pt && !nueva.rec) {
      const def = TK.PIEZAS[nueva.tipo], a = ajustar(nueva.tipo, pt.x, pt.y);
      nueva.rec = { tipo: nueva.tipo, x: a.x, y: a.y, angulo: def.angulo0 || 0, fija: false, puesta: true };
      estado.piezas.push(nueva.rec);
      crearInst(nueva.rec);
      alinearEngranajes();
      seleccionar(nueva.rec);
    }
    if (nueva.rec) {
      if (pt) {
        mover(nueva.rec, pt.x, pt.y);
        nueva.rec.choca = solapa(nueva.rec);
        if (!nueva.rec.choca) nueva.valida = guardarPos(nueva.rec);
      }
      nueva.rec.inst.raiz.visible = !!pt;
    }
  });
  window.addEventListener("pointerup", (e) => {
    if (!nueva) return;
    const n = nueva;
    nueva = null;
    if (!n.enganche) tancarCaixa(); // pieza puesta: la caja se cierra
    if (n.enganche) {
      // Arrastrada hasta el panel: soltarla equivale a tocar allí
      if (n.movido && enganche && sobreLienzo(e)) { const pt = puntoPanel(e); if (pt) tocarEnganche(pt); }
      return;
    }
    if (!n.movido) {
      // Toque sin arrastrar: la pieza aparece en el centro del panel
      const def = TK.PIEZAS[n.tipo], a = ajustar(n.tipo, TK.W / 2, 360);
      const rec = { tipo: n.tipo, x: a.x, y: a.y, angulo: def.angulo0 || 0, fija: false, puesta: true };
      estado.piezas.push(rec);
      crearInst(rec);
      if (solapa(rec) && !buscarSitio(rec)) { quitarRegistro(rec); alinearEngranajes(); noCabeAviso(); return; }
      alinearEngranajes();
      seleccionar(rec);
      TK.audio.clic();
      return;
    }
    if (!n.rec) return;
    if (sobreLienzo(e) && n.rec.inst.raiz.visible) {
      // Soltada encima de otra pieza: vuelve al último sitio libre (o no se pone)
      if (n.rec.choca) {
        if (n.valida) { ponerPos(n.rec, n.valida); noCabeAviso(); }
        else { quitarRegistro(n.rec); alinearEngranajes(); seleccionar(null); noCabeAviso(); return; }
      }
      seleccionar(n.rec);
      TK.audio.clic();
    } else { quitarRegistro(n.rec); alinearEngranajes(); seleccionar(null); }
  });

  /* ================= Play / Reiniciar ================= */
  function jugar() {
    if (estado.jugando) return;
    TK.audio.activar();
    acabarEnganche();
    seleccionar(null);
    reconstruir();
    estado.jugando = true;
    estado.superado = false;
    document.body.classList.add("jugando");
    actualizarMandos();
    if (reto() && reto().ayuda) avisar(TK.t(reto().ayuda), "mano", 3500);
  }
  function reiniciar() {
    estado.jugando = false;
    estado.superado = false;
    manivela = null;
    ui.victoria.hidden = true;
    document.getElementById("tarjeta-reto").classList.remove("superado");
    document.body.classList.remove("jugando");
    reconstruir();
    actualizarMandos();
  }

  /* ================= Niveles ================= */
  /** Copia del montaje para guardarlo; los enganches se guardan como índices. */
  function copiarMontaje(lista) {
    const idx = (r) => (r ? lista.indexOf(r) : undefined);
    return lista.map(({ tipo, x, y, angulo, fija, error, bola, contrapeso, puesta, a, b, host, local, la, lb, pa, pb, goma, tensor, mida }) => ({
      tipo, x, y, angulo, fija, error, bola, contrapeso, puesta, mida,
      a: idx(a), b: idx(b), host: idx(host), goma: idx(goma), tensor: idx(tensor),
      local: local ? { ...local } : undefined, la, lb, pa, pb,
    }));
  }
  function restaurarMontaje(copias) {
    const lista = copias.map((c) => ({ ...c, local: c.local ? { ...c.local } : undefined }));
    for (const r of lista) for (const k of ["a", "b", "host", "goma", "tensor"]) r[k] = r[k] === undefined ? undefined : lista[r[k]];
    return lista;
  }
  /**
   * Carga un reto (n = índice en TK.RETOS; -1 = taller libre en el panel;
   * -2 = taller libre en la mesa). Con `variante` se carga reinventado:
   * cambia la bola, mueve un objetivo o añade una condición.
   */
  function cargarNivel(n, variante) {
    acabarEnganche();
    vista.zoom = 1; vista.x = vista.y = 0; pintarZoom(); // cada reto empieza viendo el tablero entero
    marcarIntentado();
    if (estado.piezas.length && !estado.variante) estado.memoria[estado.nivel] = copiarMontaje(estado.piezas);
    estado.piezas.forEach(quitarMalla);
    estado.nivel = n;
    estado.variante = variante || null;
    estado.pista = false;
    // Los retos van en el panel grande; el taller libre, en el que se haya elegido
    // Fácil: tablero pequeño de piezas grandes; Medio y Difícil: panel completo
    if (midaTauler(n < 0 ? estado.pecesGrans : TK.taulerPetit(TK.RETOS[n]))) { delete estado.memoria[-1]; delete estado.memoria[-2]; }
    const guardado = variante ? null : estado.memoria[n];
    const desdeReto = (p, fija) => ({ ...p, angulo: ((p.angulo || 0) * Math.PI) / 180, fija });
    if (guardado) estado.piezas = restaurarMontaje(guardado);
    else if (n >= 0) {
      const r = TK.RETOS[n], c = variante ? variante.cambios : {};
      const fijas = r.fijas.map((p) => ({ ...p }));
      if (c.bola) fijas.forEach((p) => { if (p.tipo === "salida" || p.tipo === "lanzador") p.bola = c.bola; });
      if (c.mover) { const p = fijas.find((q) => q.tipo === c.mover.tipo); if (p) Object.assign(p, { x: c.mover.x, y: c.mover.y }); }
      estado.piezas = [...fijas.map((p) => desdeReto(p, true)), ...(r.piezas || []).map((p) => desdeReto(p, false))];
    } else if (n === -2) {
      estado.piezas = [desdeReto({ tipo: "lanzador", x: 160, y: TK.H / 2, bola: "canica" }, false), desdeReto({ tipo: "campana", x: TK.W - 210, y: TK.H / 2 }, false)];
    } else {
      estado.piezas = [desdeReto({ tipo: "salida", x: 130, y: 150, bola: "corcho" }, false), desdeReto({ tipo: "campana", x: TK.W - 210, y: TK.H - 240 }, false)];
    }
    const r = reto();
    aplicarAspecto(esMesa());
    pintarTarjeta();
    ui.modo.hidden = !esMesa();
    ui.pista.hidden = !r;
    ui.grans.hidden = !!r;
    ui.grans.setAttribute("aria-pressed", String(!!estado.pecesGrans));
    ui.pista.setAttribute("aria-pressed", "false");
    document.getElementById("tarjeta-reto").dataset.dificultat = r ? r.dificultat : "lliure";
    seleccionar(null);
    reiniciar();
    pintarRepo();
    pintarNiveles();
  }
  /** Título, misión y variante del reto actual, en el idioma elegido. */
  function pintarTarjeta() {
    const r = reto(), v = estado.variante;
    const tr = r ? TK.retoTraducit(r) : null;
    ui.nivel.textContent = r ? TK.tituloReto(r) + (v ? " · " + TK.t("reinventat") : "") : TK.t(estado.nivel === -2 ? "tallerTaula" : "tallerPanell");
    ui.enunciado.textContent = r ? tr.enunciado : TK.t("inventa");
    ui.variante.hidden = !v;
    if (v) ui.variante.textContent = tr.reinventar[r.reinventar.indexOf(v)].texto;
  }
  /** Un reto que se deja sin superar queda marcado como "intentat". */
  function marcarIntentado() {
    const r = reto();
    if (r && !TK.Progres.superat(r.id)) TK.Progres.intentar(r.id);
  }
  /** Volver a la portada (desde el botón de la casa o al acabar un nivel). */
  function irPortada(dificultat) {
    if (estado.jugando) reiniciar();
    marcarIntentado();
    pintarNiveles();
    TK.Portada.mostrar(dificultat);
  }

  /* ================= Interfaz ================= */
  const ICONOS = {
    candado: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>',
    reiniciar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12a7 7 0 1 0 2.1-5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M5 4.5V9h4.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mano: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10h.5V3.5a1.5 1.5 0 0 1 3 0V10h.5V5a1.5 1.5 0 0 1 3 0v8.5c0 4-2.7 7-6.5 7-2.6 0-4.3-1.2-5.6-3.3L4.2 13a1.5 1.5 0 0 1 2.5-1.6L8.5 14V11z"/></svg>',
    bombilla: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8v.5h6V16c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5zM9 18h6v1.2a2.3 2.3 0 0 1-2.3 2.3h-1.4A2.3 2.3 0 0 1 9 19.2z"/></svg>',
    espiga: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="4" ry="2" fill="currentColor"/><path d="M8 6v12a4 2 0 0 0 8 0V6" fill="currentColor" opacity=".75"/></svg>',
    goma: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.4" fill="currentColor"/><circle cx="19" cy="12" r="2.4" fill="currentColor"/><path d="M5 9.6C9 13 15 13 19 9.6M5 14.4c4 3.4 10 3.4 14 0" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };

  function ficha(tipo, pista) {
    const def = TK.PIEZAS[tipo];
    const nom = TK.nomPieza(tipo);
    const etiqueta = nom + (pista ? ", " + TK.t("pistaSuggereix", { n: pista }) : "");
    return `<button class="ficha${pista ? " sugerida" : ""}" data-tipo="${tipo}" aria-label="${etiqueta}" title="${nom}">
      <img src="${miniaturas[tipo]}" alt="" draggable="false">
      <span class="ficha-nombre">${nom}</span>
      ${pista ? `<span class="ficha-cuenta">×${pista}</span>` : ""}
    </button>`;
  }
  /**
   * Repositorio abajo: una fila de categorías; al tocar una se despliegan sus
   * piezas encima (y al volver a tocarla se pliega y el tablero se agranda).
   * Con la pista, las categorías con piezas sugeridas llevan un punto amarillo.
   */
  function pintarRepo() {
    const r = reto(), pista = estado.pista && r && !estado.variante ? r.pista : {};
    const c = condiciones();
    const vale = (t) => (!c.sin || !c.sin.includes(t)) && (!c.solo || c.solo.includes(t)) && !(esMesa() && TK.NO_MESA.includes(t));
    const cats = TK.CATEGORIAS.filter((cat) => !(r && cat.soloLibre)).map((cat) => ({ ...cat, tipos: cat.piezas.filter(vale) })).filter((cat) => cat.tipos.length);
    if (estado.categoria === undefined || (estado.categoria !== null && !cats.some((cat) => cat.id === estado.categoria))) estado.categoria = null;
    // La pista abre la primera categoría con piezas sugeridas
    if (estado.pista && Object.keys(pista).length && !cats.some((cat) => cat.id === estado.categoria && cat.tipos.some((t) => pista[t])))
      estado.categoria = (cats.find((cat) => cat.tipos.some((t) => pista[t])) || {}).id ?? estado.categoria;
    const noms = (TK.TEXTOS[TK.idioma] || TK.TEXTOS.ca).categorias;
    // Cajas: la mitad a la izquierda del tablero y el resto a la derecha
    const caixa = (cat) => `<button class="caixa${cat.tipos.some((t) => pista[t]) ? " sugerida" : ""}" data-cat="${cat.id}" aria-expanded="${cat.id === estado.categoria}" aria-controls="repo-lista">
        <span class="caixa-cos"><img src="${miniaturas[cat.tipos[0]]}" alt="" draggable="false"></span><span class="caixa-nom">${noms[cat.id]}</span></button>`;
    const meitat = Math.ceil(cats.length / 2);
    ui.caixesEsq.innerHTML = cats.slice(0, meitat).map(caixa).join("");
    ui.caixesDre.innerHTML = cats.slice(meitat).map(caixa).join("");
    const actual = cats.find((cat) => cat.id === estado.categoria);
    ui.repo.hidden = !actual;
    ui.repo.innerHTML = actual ? `<h3>${noms[actual.id]}</h3>` + actual.tipos.map((t) => ficha(t, pista[t])).join("") : "";
    if (actual) colocarSafata();
  }
  /** La bandeja sale al lado de su caja, hacia el tablero. */
  function colocarSafata() {
    const b = escenario.querySelector(`.caixa[data-cat="${estado.categoria}"]`);
    if (!b) return;
    const re = escenario.getBoundingClientRect(), rb = b.getBoundingClientRect(), s = ui.repo;
    const esq = !!b.closest(".caixes-esq");
    s.style.left = esq ? rb.right - re.left + 10 + "px" : "auto";
    s.style.right = esq ? "auto" : re.right - rb.left + 10 + "px";
    const alt = s.offsetHeight, y = rb.top - re.top + rb.height / 2 - alt / 2;
    s.style.top = Math.max(12, Math.min(re.height - alt - 12, y)) + "px";
  }
  /** Tocar una caja: la abre y salen sus piezas; tocar la abierta: la cierra. */
  function tocarCategoria(id) {
    estado.categoria = estado.categoria === id ? null : id;
    pintarRepo();
    TK.audio.clic();
  }
  function tancarCaixa() {
    if (estado.categoria === null) return;
    estado.categoria = null;
    pintarRepo();
  }
  /**
   * Barra de retos: la casa (portada) y los retos de la misma dificultad.
   * Marca verde = superado; marca naranja = intentado sin superar; nada = sin hacer.
   */
  function pintarNiveles() {
    const r = reto();
    const casa = `<button class="nivel-boton casa" data-casa aria-label="${TK.t("portada")}" title="${TK.t("portada")}"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.2 2.8 11a1 1 0 0 0 1.3 1.5l.9-.8V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-8.3l.9.8a1 1 0 0 0 1.3-1.5z"/></svg></button>`;
    const so = `<button class="nivel-boton so" data-so aria-pressed="${TK.audio.silenciat()}" aria-label="${TK.t("silenci")}" title="${TK.t("silenci")}">${TK.iconoSo(TK.audio.silenciat())}</button>`;
    const taula = '<svg class="mini-taula" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9.5 7 5h10l4.5 4.5z" fill="currentColor"/><path d="M4 9.5v9M20 9.5v9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    ui.casa.innerHTML = casa + so;
    // El título del reto abre un menú con los 10 retos de su dificultad
    if (r) ui.nivel.setAttribute("aria-haspopup", "true"); else ui.nivel.removeAttribute("aria-haspopup");
    if (!r) { ui.niveles.innerHTML = ""; ui.niveles.hidden = true; ui.nivel.setAttribute("aria-expanded", "false"); return; }
    ui.niveles.innerHTML = TK.RETOS.map((q, k) => [q, k]).filter(([q]) => q.dificultat === r.dificultat).map(([q, k]) => {
      const marca = TK.Progres.superat(q.id) ? " hecho" : TK.Progres.intentat(q.id) ? " intentat" : "";
      return `<button class="nivel-boton${marca}${q.mesa ? " mesa" : ""}" data-nivel="${k}" aria-pressed="${estado.nivel === k}" title="${TK.tituloReto(q)}: ${TK.retoTraducit(q).enunciado}">${q.mesa ? taula : ""}${q.num}</button>`;
    }).join("");
  }
  function menuNiveles(obrir) {
    ui.niveles.hidden = !obrir;
    ui.nivel.setAttribute("aria-expanded", String(obrir));
  }
  TK.audio.alCanviar(() => pintarNiveles());
  ui.casa.addEventListener("click", (e) => {
    if (e.target.closest("[data-so]")) { TK.audio.activar(); TK.audio.alternar(); return; }
    if (e.target.closest("[data-casa]")) { menuNiveles(false); irPortada(reto() ? reto().dificultat : null); }
  });
  ui.nivel.addEventListener("click", () => { if (reto()) { TK.audio.activar(); TK.audio.clic(); menuNiveles(ui.niveles.hidden); } });
  ui.niveles.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nivel]");
    if (!b) return;
    menuNiveles(false);
    const n = Number(b.dataset.nivel);
    if (n !== estado.nivel) cargarNivel(n);
  });
  // Tocar fuera del menú de retos lo cierra
  document.addEventListener("pointerdown", (e) => { if (!ui.niveles.hidden && !e.target.closest("#niveles, #nivel")) menuNiveles(false); });
  for (const c of [ui.caixesEsq, ui.caixesDre]) c.addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (b) { TK.audio.activar(); tocarCategoria(b.dataset.cat); } });
  // Tocar fuera de la bandeja y de las cajas la cierra
  document.addEventListener("pointerdown", (e) => { if (estado.categoria !== null && !e.target.closest("#repo-lista, .caixa")) tancarCaixa(); });

  function actualizarMandos() {
    const rec = estado.seleccion;
    const editable = !estado.jugando && rec && !rec.fija;
    ui.play.disabled = estado.jugando;
    ui.izq.disabled = ui.der.disabled = !(editable && puedeGirar(rec));
    ui.borrar.disabled = !editable;
  }

  let temporizadorAviso;
  /** Mensaje flotante. ms = Infinity lo deja fijo (instrucciones de enganche). */
  function avisar(texto, icono, ms = 2200) {
    ui.aviso.innerHTML = (ICONOS[icono] || "") + `<span>${texto}</span>`;
    ui.aviso.hidden = false;
    clearTimeout(temporizadorAviso);
    if (ms !== Infinity) temporizadorAviso = setTimeout(() => (ui.aviso.hidden = true), ms);
  }

  // «Peces grans» (solo taller libre): panel más pequeño, todo se ve más grande
  ui.grans.addEventListener("click", () => {
    TK.audio.activar();
    estado.pecesGrans = !estado.pecesGrans;
    try { localStorage.setItem("tinkerpad-grans", estado.pecesGrans ? "1" : "0"); } catch (e) { /* sin almacenamiento */ }
    if (estado.jugando) reiniciar();
    estado.piezas.forEach(quitarMalla);
    estado.piezas = [];
    cargarNivel(estado.nivel);
    avisar(TK.t(estado.pecesGrans ? "gransSi" : "gransNo"), "mano", 3000);
  });
  // Botones de zoom (+, −, ver todo)
  document.getElementById("zoom").addEventListener("click", (e) => {
    const b = e.target.closest("[data-zoom]");
    if (!b) return;
    TK.audio.activar();
    if (b.dataset.zoom === "mes") hacerZoom(1.4);
    else if (b.dataset.zoom === "menys") hacerZoom(1 / 1.4);
    else zoomInicial();
  });
  ui.play.addEventListener("click", jugar);
  ui.reiniciar.addEventListener("click", () => { TK.audio.activar(); reiniciar(); });
  ui.izq.addEventListener("click", () => rotar(estado.seleccion, -1));
  ui.der.addEventListener("click", () => rotar(estado.seleccion, 1));
  ui.borrar.addEventListener("click", () => borrar(estado.seleccion));
  ui.pista.addEventListener("click", () => {
    estado.pista = !estado.pista;
    ui.pista.setAttribute("aria-pressed", String(estado.pista));
    pintarRepo();
    const r = reto();
    if (estado.pista && r && !Object.keys(r.pista).length) avisar(TK.t("pistaVermell"), "bombilla");
  });

  window.addEventListener("keydown", (e) => {
    TK.audio.activar();
    // Escribiendo (clave de la zona docente) o con la portada abierta, las teclas no tocan el montaje
    if (e.target.closest && e.target.closest("input, textarea")) return;
    if (!document.getElementById("portada").hidden) return;
    if (e.target.closest && e.target.closest("button") && (e.key === " " || e.key === "Enter")) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); borrar(estado.seleccion); }
    else if (e.key === "r" || e.key === "e") rotar(estado.seleccion, 1);
    else if (e.key === "R" || e.key === "q") rotar(estado.seleccion, -1);
    else if (e.key === " ") { e.preventDefault(); estado.jugando ? reiniciar() : jugar(); }
    else if (e.key === "Escape") { acabarEnganche(); seleccionar(null); }
  });

  /* ================= Acceso para pruebas desde la consola =================
     TK.juego.nivel(4)                        -> carga el nivel 5 (índice 4)
     TK.juego.colocar("liston", 400, 300, 15) -> pone una pieza (ángulo en grados)
     TK.juego.jugar() / TK.juego.reiniciar() / TK.juego.simular(pasos) */
  TK.juego = {
    estado, jugar, reiniciar, ctx, miniaturas,
    nivel: cargarNivel,
    /** Comprueba un reto: vacío no debe ganarse; con la solución sí. Devuelve pasos o -1. */
    probar(k, conSolucion, maxPasos = 2400) {
      estado.piezas.forEach(quitarMalla);
      estado.piezas = [];          // sin guardar el montaje anterior
      estado.memoria = {};
      cargarNivel(k);
      const r = TK.RETOS[k];
      if (conSolucion) for (const s of r.solucion || []) {
        if (s.goma) this.goma(s.goma);
        else if (s.cadena) this.cadena(s.cadena);
        else if (s.gatillo) this.gatillo(s.gatillo, s.angulo);
        else if (s.desde) { // arreglar una pieza ya puesta: moverla, girarla o quitarla
          const rec = estado.piezas.find((q) => q.x === s.desde[0] && q.y === s.desde[1]);
          if (s.quitar) borrar(rec);
          else { Object.assign(rec, { x: s.x ?? rec.x, y: s.y ?? rec.y, angulo: s.angulo !== undefined ? (s.angulo * Math.PI) / 180 : rec.angulo }); actualizarPieza(rec); }
        } else if (s.tipo === "pinza") this.pinza(s.x, s.y, s.angulo || 0);
        else this.colocar(s.tipo, s.x, s.y, s.angulo || 0, s.extra);
      }
      jugar();
      if (r.manivela && conSolucion) this.girarManivela(true);
      for (let i = 0; i < maxPasos; i++) { pasoFisica(); if (estado.superado) { const p = i; reiniciar(); return p; } }
      reiniciar();
      return -1;
    },
    /**
     * Fotografía 3D de un reto montado con su solución (ilustraciones de la
     * guía docente). No toca el progreso ni el montaje guardado del alumno, y
     * al acabar vuelve al nivel que había.
     */
    captura(k, conSolucion = true, ancho = 1280) {
      const previo = estado.nivel, guardado = estado.memoria[k], memPrevio = estado.piezas.length && !estado.variante ? copiarMontaje(estado.piezas) : null;
      const marca = marcarIntentado;
      marcarIntentado = () => {};
      try {
        delete estado.memoria[k];
        cargarNivel(k);
        if (conSolucion) for (const s of TK.RETOS[k].solucion || []) {
          if (s.goma) this.goma(s.goma);
          else if (s.cadena) this.cadena(s.cadena);
          else if (s.gatillo) this.gatillo(s.gatillo, s.angulo);
          else if (s.desde) {
            const rec = estado.piezas.find((q) => q.x === s.desde[0] && q.y === s.desde[1]);
            if (s.quitar) borrar(rec);
            else { Object.assign(rec, { x: s.x ?? rec.x, y: s.y ?? rec.y, angulo: s.angulo !== undefined ? (s.angulo * Math.PI) / 180 : rec.angulo }); actualizarPieza(rec); }
          } else if (s.tipo === "pinza") this.pinza(s.x, s.y, s.angulo || 0);
          else this.colocar(s.tipo, s.x, s.y, s.angulo || 0, s.extra);
        }
        seleccionar(null);
        for (const rec of estado.piezas) rec.inst.sync();
        actualizarHalos();
        renderer.render(escena, camara);
        // Recorte central 16:10 del lienzo (el tablero queda en medio)
        const c = document.createElement("canvas"), w = lienzo.width, h = lienzo.height;
        let sw = w, sh = w / 1.6;
        if (sh > h) { sh = h; sw = h * 1.6; }
        c.width = ancho; c.height = Math.round(ancho / 1.6);
        c.getContext("2d").drawImage(lienzo, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.86);
      } finally {
        estado.piezas.forEach(quitarMalla);
        estado.piezas = [];
        if (guardado) estado.memoria[k] = guardado; else delete estado.memoria[k];
        cargarNivel(previo);
        if (memPrevio && previo === estado.nivel) { estado.piezas.forEach(quitarMalla); estado.piezas = restaurarMontaje(memPrevio); reiniciar(); }
        marcarIntentado = marca;
      }
    },
    colocar(tipo, x, y, grados, extra) {
      const a = ajustar(tipo, x, y);
      const rec = { tipo, x: a.x, y: a.y, angulo: ((grados ?? 0) * Math.PI) / 180, fija: false, puesta: true, ...extra };
      estado.piezas.push(rec);
      crearInst(rec);
      alinearEngranajes();
      return rec;
    },
    /** Goma entre los puntos de enganche más cercanos a (x1, y1) y (x2, y2). */
    goma([x1, y1, x2, y2]) {
      const P = puntosGoma(), cerca = (x, y) => P.find((p) => Math.abs(p.x - x) < 5 && Math.abs(p.y - y) < 5);
      const A = cerca(x1, y1), B = cerca(x2, y2);
      return A && B ? crearGoma(A, B) : null;
    },
    /** Cadena entre los engranajes de (x1, y1) y (x2, y2). */
    cadena([x1, y1, x2, y2]) {
      const g = (x, y) => estado.piezas.find((q) => TK.radiEngranatge(q.tipo) && q.x === TK.agujero(x) && q.y === TK.agujero(y));
      const a = g(x1, y1), b = g(x2, y2);
      return a && b ? crearCadena(a, b) : null;
    },
    /** Tirachinas: la pinza muerde la goma que pasa por (gx, gy) y se apoya en la espiga (ex, ey). */
    gatillo([gx, gy, ex, ey], grados) {
      tolerancia = 7;
      const g = gomaEn({ x: gx, y: gy }), e = estado.piezas.find((q) => esEspiga(q) && q.x === TK.agujero(ex) && q.y === TK.agujero(ey));
      return g && e ? crearGatillo(g, e, grados) : null;
    },
    solapa, vista, hacerZoom,
    /** Punto de pantalla (px CSS) de un punto del panel (para probar toques). */
    aPantalla(x, y) {
      const v = new T.Vector3(TK.X(x), TK.Y(y), TK.Z).project(camara), r = lienzo.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
    },
    /** Piezas de la solución que se cruzan con otras (deben ser 0). */
    solapes(k) {
      this.probar(k, true, 0);
      return estado.piezas.filter((q) => q.puesta && solapa(q)).map((q) => `${q.tipo}@${q.x},${q.y} x ${solapa(q).tipo}@${solapa(q).x},${solapa(q).y}`);
    },
    pinza(x, y, grados = 0) { const anc = anclajePinza({ x, y }, (grados * Math.PI) / 180); return anc ? crearPinza(anc) : null; },
    mover(rec, x, y) { if (rec.tipo === "pinza") moverPinza(rec, { x, y }); else mover(rec, x, y); },
    rotar, borrar,
    girarManivela(si) { estado.piezas.forEach((r) => { if (r.inst && r.inst.manivela) r.inst.girando = si; }); },
    simular(pasos) { for (let i = 0; i < pasos; i++) pasoFisica(); },
  };

  /* ================= Arranque ================= */
  TK.aplicarIdioma();
  // Al cambiar de idioma en la portada se repinta todo lo que tiene texto
  TK.alCanviarIdioma(() => { pintarTarjeta(); pintarRepo(); pintarNiveles(); });
  encuadrar();
  cargarNivel(0);
  cargando.hidden = true;
  requestAnimationFrame(bucle);
  // Portada: escoger dificultad y reto, taller libre o zona docente
  TK.Portada.iniciar({
    jugar: (k) => cargarNivel(k),
    lliure: (mesa) => cargarNivel(mesa ? -2 : -1),
    miniaturas,
  });
  TK.Portada.mostrar();
})();
