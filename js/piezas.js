/* =====================================================================
   piezas.js — Catálogo de piezas (física Rapier 2D + malla Three.js).

   Las piezas reproducen los materiales del "Laboratori de mecànica" de la
   propuesta: espigas de 8 mm (50 y 100 mm), listones planos y cóncavos,
   bloques perforados rectangulares y triangulares, tubos de PVC, codos,
   tubos corrugados, conos de hilo, gomas elásticas, pinzas de madera,
   engranajes de 50/100/150/200 mm, manivela, polea con cordel, canicas de
   vidrio y pelotas de corcho o goma.

   Cada entrada de TK.PIEZAS describe un tipo de pieza:
     nombre       texto corto para el repositorio
     rotable      si se puede girar en pasos de 15°
     agujero      si su eje se encaja en un agujero del panel (espigas,
                  engranajes, palancas…): la posición salta de agujero en agujero
     angulo0      ángulo inicial al sacarla del repositorio (rad)
     crear(p, ctx) construye la pieza p = {tipo, x, y, angulo, ...} dentro del
                  mundo físico ctx.mundo y devuelve una INSTANCIA:
                    cuerpos   cuerpos rígidos de Rapier
                    raiz      THREE.Group con la malla 3D
                    sync()    copia la física a la malla (cada fotograma)
                    paso()    opcional: lógica extra tras cada paso físico
                    engranaje opcional: {rb, r, x, y, n, interno} si engrana
                    clavos    opcional: dónde dibujar tornillos si es fija
                    quitar()  la saca del mundo físico

   Las medidas se escriben en px locales de la pieza (Y hacia abajo,
   1 px = 1,25 mm). Los ayudantes de abajo las convierten.

   AÑADIR UNA PIEZA NUEVA
   1. Escribe su entrada aquí: cuerpo(), caja()/bola()/poligono()/arco()
      para la física y TK.caja / TK.cilindro / TK.espiga / TK.extruir para
      la malla.
   2. Añádela a una categoría de TK.CATEGORIAS para que salga en el repositorio.
   ===================================================================== */
(function () {
  const T = THREE, S = TK.S, Z = TK.Z, F = TK.FIS, M = TK.MAT;
  const G = Math.PI / 180;
  const R = () => TK.R; // módulo Rapier (se carga en app.js)

  /* ---------- Ayudantes de física (medidas en px locales) ---------- */

  /**
   * Cuerpo rígido con su origen en (x, y) px y giro horario `ang`.
   * En la mesa (ctx.mesa) no hay gravedad en el plano: lo que se mueve se
   * frena por el roce con la mesa (amortiguación alta, o `opciones.mesa`).
   */
  function cuerpo(ctx, tipo, x, y, ang, opciones = {}) {
    const d = tipo === "fijo" ? R().RigidBodyDesc.fixed() : R().RigidBodyDesc.dynamic();
    d.setTranslation(TK.X(x), TK.Y(y)).setRotation(-(ang || 0));
    if (opciones.ccd) d.setCcdEnabled(true);
    if (opciones.sinGiro) d.lockRotations();
    const lineal = ctx.mesa ? opciones.mesa ?? Math.max(1.2, opciones.amortiguar ?? 0) : opciones.amortiguar ?? 0.05;
    const giro = ctx.mesa ? Math.max(1, opciones.amortiguarGiro ?? 0) : opciones.amortiguarGiro ?? 0.1;
    d.setLinearDamping(lineal).setAngularDamping(giro);
    return ctx.mundo.createRigidBody(d);
  }
  /** Aplica material (madera, corcho, goma, vidrio, pvc, metal) y ajustes. */
  function material(cd, mat, ajustes = {}) {
    const m = { ...F[mat], ...ajustes };
    return cd.setFriction(m.f).setRestitution(m.r).setDensity(m.d);
  }
  function terminar(ctx, rb, cd, o) {
    if (o.grupos) cd.setCollisionGroups(o.grupos);
    else if (rb.isFixed()) cd.setCollisionGroups(TK.GRUPO_FIJO);
    if (o.sensor) cd.setSensor(true);
    return ctx.mundo.createCollider(cd, rb);
  }
  /** Rectángulo w x h px, centrado en (x, y) px locales, girado `ang`. */
  function caja(ctx, rb, w, h, mat, o = {}) {
    const cd = material(R().ColliderDesc.cuboid((w / 2) * S, (h / 2) * S), mat, o.ajustes);
    cd.setTranslation((o.x || 0) * S, -(o.y || 0) * S).setRotation(-(o.ang || 0));
    return terminar(ctx, rb, cd, o);
  }
  /** Círculo de radio r px centrado en (x, y) px locales. */
  function bola(ctx, rb, r, mat, o = {}) {
    const cd = material(R().ColliderDesc.ball(r * S), mat, o.ajustes);
    cd.setTranslation((o.x || 0) * S, -(o.y || 0) * S);
    return terminar(ctx, rb, cd, o);
  }
  /** Polígono convexo a partir de puntos [x, y] en px locales. */
  function poligono(ctx, rb, puntos, mat, o = {}) {
    const arr = new Float32Array(puntos.flatMap(([x, y]) => [x * S, -y * S]));
    return terminar(ctx, rb, material(R().ColliderDesc.convexHull(arr), mat, o.ajustes), o);
  }
  /** Pared curva: n tramos rectos a lo largo de un arco (ángulos horarios en px). */
  function arco(ctx, rb, cx, cy, radio, a0, a1, n, grosor, mat) {
    for (let k = 0; k < n; k++) {
      const am = a0 + ((k + 0.5) * (a1 - a0)) / n;
      const largo = 2 * radio * Math.sin(Math.abs(a1 - a0) / (2 * n)) + 3;
      caja(ctx, rb, largo, grosor, mat, { x: cx + radio * Math.cos(am), y: cy + radio * Math.sin(am), ang: am + Math.PI / 2 });
    }
  }
  /** Copia la pose de un cuerpo a un grupo Three. */
  function posar(g, rb) {
    const t = rb.translation();
    g.position.x = t.x;
    g.position.y = t.y;
    g.rotation.z = rb.rotation();
  }
  function grupo(hijos) {
    const g = new T.Group();
    hijos.forEach((h) => h && g.add(h));
    return g;
  }
  function fijo(g, x, y) { TK.pose(g, x, y, 0); return g; }

  /**
   * Une cuerpos y malla en una instancia y registra cada collider en
   * ctx.mapa (handle -> {pieza, etiqueta}) para la selección y los eventos.
   */
  function instancia(p, ctx, cuerpos, raiz, sync, extra) {
    const i = Object.assign({ p, cuerpos, raiz, sync }, extra || {});
    const handles = [];
    for (const rb of cuerpos) {
      for (let k = 0; k < rb.numColliders(); k++) {
        const col = rb.collider(k);
        const info = ctx.mapa.get(col.handle) || {};
        info.pieza = i;
        ctx.mapa.set(col.handle, info);
        handles.push(col.handle);
        if (rb.isDynamic() || info.etiqueta) col.setActiveEvents(R().ActiveEvents.COLLISION_EVENTS);
      }
    }
    i.quitar = () => {
      handles.forEach((h) => ctx.mapa.delete(h));
      cuerpos.forEach((rb) => ctx.mundo.removeRigidBody(rb)); // quita también colliders y juntas
    };
    i.sync();
    return i;
  }
  const etiquetar = (ctx, col, etiqueta) => ctx.mapa.set(col.handle, { etiqueta });

  /* ---------- Montaje con espigas ----------
     Como en el panel real, las piezas de madera (listones, rampas, bloques,
     caja, lanzador) y las que giran sobre un eje (engranajes, manivela,
     polea, palanca, péndulo) se sujetan con espigas metidas en sus agujeros
     (TK.FORATS). Al pulsar Play (ctx.jugando) app.js calcula p.montaje:
       n    espigas metidas en agujeros de la pieza
       eje  la espiga (registro) cuando solo hay una
       fijo tubos y conos: atados con gomas a las espigas, no se mueven
     Sin espigas la pieza cae (en la mesa se queda suelta); con una, cuelga y
     gira sobre ella hasta apoyarse en algo (otra espiga, por ejemplo); con dos
     o más, queda fija. Las piezas fijas de los retos (p.fija) van atornilladas. */
  TK.FORATS = {
    liston: [[-100, 0], [0, 0], [100, 0]], canal: [[-100, 0], [0, 0], [100, 0]],
    bloque: [[-60, 0], [-20, 0], [20, 0], [60, 0]], cuna: [[10, 12], [50, 12], [50, -8]],
    caja: [[-40, 30], [40, 30]], lanzador: [[-80, -20], [-80, 20]], palanca: [[-120, 0], [-60, 0], [0, 0], [60, 0], [120, 0]],
    engranaje50: [[0, 0]], engranaje100: [[0, 0]], engranaje150: [[0, 0]], engranaje200: [[0, 0]], manivela: [[0, 0]],
    polea: [[0, 0]], pendulo: [[0, 0]],
  };
  /** Tubos y conos: no tienen agujeros; se apoyan en espigas y se atan con gomas. */
  TK.APOYO = ["tubo", "codo", "corrugado", "cono"];
  /** ¿Cómo queda la pieza al pulsar Play? "fijo" o "dinamico". */
  function montada(p, ctx) {
    if (!ctx.jugando || p.fija || !p.montaje) return "fijo";
    return p.montaje.fijo || p.montaje.n >= 2 ? "fijo" : "dinamico";
  }
  const suelta = (p, ctx) => montada(p, ctx) === "dinamico" && !(p.montaje && p.montaje.n === 1);
  /** Con una sola espiga, la pieza gira sobre ella (articulación sin choque entre las dos). */
  function colgar(ctx, p, rb) {
    const e = p.montaje && p.montaje.n === 1 && p.montaje.eje;
    if (!e || !e.inst || !rb.isDynamic()) return null;
    const t = rb.translation(), a = rb.rotation(), c = Math.cos(a), s = Math.sin(a);
    const ex = TK.X(e.x) - t.x, ey = TK.Y(e.y) - t.y;
    const j = ctx.mundo.createImpulseJoint(R().JointData.revolute({ x: c * ex + s * ey, y: -s * ex + c * ey }, { x: 0, y: 0 }), rb, e.inst.cuerpos[0], true);
    j.setContactsEnabled(false);
    return j;
  }

  /** Pieza de un solo cuerpo: `fisica(rb)` añade colliders, `hijos` es la malla.
      tipo "montado": cuelga de sus espigas (ver montada). */
  function piezaSimple(p, ctx, tipo, fisica, hijos, opciones, extra) {
    const t = tipo === "montado" ? montada(p, ctx) : tipo;
    const rb = cuerpo(ctx, t, p.x, p.y, p.angulo, tipo === "montado" ? { amortiguarGiro: 0.8, ...opciones } : opciones);
    fisica(rb);
    if (tipo === "montado") colgar(ctx, p, rb);
    const g = grupo(hijos);
    return instancia(p, ctx, [rb], g, () => posar(g, rb), extra);
  }

  /* ---------- Bolas ----------
     Valores ajustados a bolas reales (rebote sobre madera, roce, peso):
       canica  vidrio, Ø 27 mm, ~30 g: la más pesada; rebote medio; rueda muy
               bien (casi sin roce de rodadura)
       pelota  goma hueca, Ø 55 mm, ~20 g: rebota mucho y agarra
       corcho  Ø 50 mm, ~8 g: muy ligera, casi no rebota, el aire la frena
       madera  haya, Ø 45 mm, ~28 g: rebote bajo
     El rebote de la bola manda en el choque (regla "Max" de Rapier): una
     pelota de goma rebota igual sobre madera que sobre PVC.
     En 2D la masa es densidad × área, así que las densidades `d` están
     calculadas para que las masas guarden la proporción real. */
  // mesa: frenado al rodar sobre la mesa (la canica llega más lejos)
  const BOLAS = {
    canica: { r: 11, mat: "vidrio", f: 0.25, rebote: 0.5, d: 2.75, aire: 0.01, rodadura: 0.05, mesa: 0.35 },
    pelota: { r: 22, mat: "goma", f: 0.9, rebote: 0.8, d: 0.46, aire: 0.06, rodadura: 0.35, mesa: 0.75 },
    corcho: { r: 20, mat: "corcho", f: 0.7, rebote: 0.22, d: 0.28, aire: 0.18, rodadura: 0.6, mesa: 1.3 },
    madera: { r: 18, mat: "madera", f: 0.5, rebote: 0.4, d: 1.0, aire: 0.03, rodadura: 0.2, mesa: 0.55 },
  };
  /** Malla de una bola. Las canicas llevan un remolino de color dentro. */
  function mallaBola(tipo, x, y) {
    const b = BOLAS[tipo];
    if (tipo === "canica") {
      const color = M.remolinos[Math.abs(Math.round(x * 7 + y * 13)) % M.remolinos.length];
      const dentro = TK.esfera(7, color);
      dentro.scale.set(1, 0.55, 1);
      dentro.rotation.z = 0.6;
      const fuera = TK.esfera(b.r, M.vidrio);
      fuera.castShadow = true;
      return grupo([dentro, fuera]);
    }
    return grupo([TK.esfera(b.r, { corcho: M.corcho, pelota: M.pelota, madera: M.haya }[tipo])]);
  }
  /** Crea una bola dinámica (con CCD) en (x, y) px de montaje. */
  function crearBola(ctx, tipo, x, y) {
    const b = BOLAS[tipo];
    const rb = cuerpo(ctx, "dinamico", x, y, 0, { ccd: true, amortiguar: b.aire, amortiguarGiro: b.rodadura, mesa: b.mesa });
    const col = bola(ctx, rb, b.r, b.mat, { ajustes: { f: b.f, r: b.rebote, d: b.d } });
    col.setRestitutionCombineRule(R().CoefficientCombineRule.Max);
    return { rb, malla: mallaBola(tipo, x, y) };
  }
  function piezaBola(nombre, tipo) {
    return {
      nombre, rotable: false,
      crear(p, ctx) {
        const { rb, malla } = crearBola(ctx, tipo, p.x, p.y);
        return instancia(p, ctx, [rb], malla, () => posar(malla, rb));
      },
    };
  }

  /* ---------- Engranajes ---------- */
  /**
   * Engranaje de contrachapado sobre una espiga-eje. Radio primitivo r px
   * (diámetro real = 2r · 1,25 mm). Los engranajes cuyos ejes están a la
   * distancia justa (r1 + r2) engranan: lo resuelve app.js.
   */
  function crearEngranaje(p, ctx, r, extra = {}) {
    const n = Math.round(r * 0.4);
    const eje = cuerpo(ctx, "fijo", p.x, p.y, 0);
    const rueda = cuerpo(ctx, "dinamico", p.x, p.y, 0, { amortiguarGiro: 0.4 });
    bola(ctx, rueda, r + 2, "madera", { grupos: TK.GRUPO_ENGRANAJE, ajustes: { d: 0.6 } });
    const huecos = [];
    const m = r >= 80 ? 6 : r >= 60 ? 5 : r >= 40 ? 4 : 0;
    for (let k = 0; k < m; k++) {
      const a = (k * 2 * Math.PI) / m;
      huecos.push([0.52 * r * Math.cos(a), 0.52 * r * Math.sin(a), 0.17 * r]);
    }
    const interno = new T.Group();
    interno.add(TK.extruir(TK.formaEngranaje(r, n, huecos), M.madera, { prof: 0.12, bisel: 0.01, z: 0.12 }));
    // Biela: espiga clavada en las ruedas grandes. Es una espiga como las demás:
    // empuja bolas, toca la campana y se le pueden enganchar gomas y pinzas.
    // (Fuera de `interno`, que se gira solo para alinear los dientes: así se ve
    // justo donde está su collider.)
    let biela = null, mallaBiela = null;
    if (r >= 60) {
      const a = Math.PI / m, d = 0.8 * r;
      const bx = d * Math.cos(a), by = d * Math.sin(a); // en px, plano local con Y arriba
      bola(ctx, rueda, 6, "madera", { x: bx, y: -by });
      mallaBiela = TK.espiga(0.55);
      mallaBiela.position.set(bx * S, by * S, 0.2);
      biela = { x: bx, y: -by }; // px locales de la pieza (Y abajo)
    }
    (extra.adornos || []).forEach((a) => interno.add(a));
    // Sin espiga en el agujero del centro, la rueda no tiene eje: cae
    const libre = suelta(p, ctx);
    if (!libre) ctx.mundo.createImpulseJoint(R().JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 }), eje, rueda, true).setContactsEnabled(false);
    const gR = grupo([interno, mallaBiela]);
    // Las de los retos llevan su eje atornillado; las demás se ponen sobre una espiga
    const gE = p.fija ? fijo(grupo([TK.espiga(0.62)]), p.x, p.y) : null;
    const i = instancia(p, ctx, [eje, rueda], grupo([gR, gE]), () => posar(gR, rueda), extra.instancia);
    i.engranaje = { rb: rueda, r, n, x: p.x, y: p.y, interno, suelto: libre, biela };
    // Cuerpo que se mueve con un punto local de la pieza (gomas y pinzas enganchadas a la biela)
    i.cuerpoDe = (l) => (l && (l.x || l.y) ? rueda : eje);
    // Roce seco del eje: una rueda suelta no gira sola por el peso de su
    // espiga excéntrica (como en el panel real); la manivela la vence sin esfuerzo.
    i.friccion = () => {
      if (libre) return;
      const w = rueda.angvel();
      if (w) rueda.setAngvel(Math.sign(w) * Math.max(0, Math.abs(w) - 1.2 * ctx.mundo.timestep), true);
    };
    i.paso = i.friccion;
    return i;
  }
  function piezaEngranaje(nombre, r) {
    return { nombre, rotable: false, agujero: true, crear: (p, ctx) => crearEngranaje(p, ctx, r) };
  }

  /* ---------- Tubos: mallas ---------- */
  /** Anillo (borde) de tubo. */
  function anillo(radio, mat) {
    const m = new T.Mesh(new T.TorusGeometry(radio, 0.02, 8, 28), mat);
    m.castShadow = true;
    return m;
  }
  /** Curva circular en unidades para TubeGeometry (ángulos antihorarios). */
  class Arco extends T.Curve {
    constructor(cx, cy, radio, a0, a1) { super(); Object.assign(this, { cx, cy, radio, a0, a1 }); }
    getPoint(t, out = new T.Vector3()) {
      const a = this.a0 + (this.a1 - this.a0) * t;
      return out.set(this.cx + this.radio * Math.cos(a), this.cy + this.radio * Math.sin(a), Z);
    }
  }

  /* ---------- Goma elástica entre dos espigas ----------
     La goma no es un sólido de Rapier: es una cuerda elástica calculada a
     mano en cada paso. Mide L0 sin estirar. Si las espigas están más cerca
     que L0, queda floja (hace panza y casi no empuja); si están más lejos,
     ya está tensa y empuja en cuanto la tocan.

     Cuando un objeto la empuja, la goma forma una V desde cada espiga hasta
     el punto de contacto Q. Su tensión es T = K · (largo de la V − L0) y la
     fuerza sobre el objeto es la suma de los dos tirones (hacia cada
     espiga). Un amortiguador (C) se lleva parte de la energía: a los
     objetos ligeros les quita proporcionalmente más, así que rebotan menos
     que los pesados. Con roce (MU), lo que cae sobre una goma inclinada
     rueda o resbala hacia abajo. */
  TK.GOMA = {
    L0: 160,     // largo sin estirar (px) = 20 cm
    MIN: 40,     // distancia mínima entre espigas (px)
    MAX: 400,    // distancia máxima: más allá la goma saltaría (px)
    K: 40,       // rigidez (fuerza por unidad de estiramiento)
    C: 0.5,      // amortiguación con la goma a L0; crece cuanto más floja está
    P: 3,        // exponente: C · (L0 / distancia)^P
    CMAX: 8,     // tope del factor de amortiguación
    MU: 0.4,     // roce goma-objeto
    MB: 0.012,   // masa efectiva de la goma (los objetos ligeros rebotan menos)
    // Tirachinas: una pinza muerde la goma, la estira y se apoya en una espiga
    KT: 24,      // rigidez de la goma estirada por la pinza (como un tirachinas)
    TIRA: 480,   // largo máximo de la goma estirada (px)
    GATILLO: 0.06, // masa mínima que suelta la pinza al caerle encima (el corcho no llega)
    // Tres medidas de goma (factor sobre L0, MIN y MAX). Una goma más larga es
    // más blanda: con el mismo estiramiento empuja menos (K / factor).
    MIDES: { gomaPetita: 0.5, goma: 1, gomaGran: 1.6 },
  };
  /** Factor de medida de una goma (registro con p.mida; 1 = la de 20 cm). */
  TK.gomaMida = (p) => (p && p.mida) || 1;

  /* ---------- Cadenas de bicicleta ---------- */
  TK.CADENA = {
    MIDES: [60, 90, 120, 150, 180], // medidas de cadena disponibles (cm de vuelta completa)
    MARGE: 16,                       // px libres entre las dos ruedas: si no, engranarían
  };
  /** Radio primitivo (px) de las piezas que llevan dientes: engranajes y manivela. */
  TK.radiEngranatge = (tipo) => ({ engranaje50: 20, engranaje100: 40, engranaje150: 60, engranaje200: 80, manivela: 40 })[tipo] || 0;
  /**
   * Camino de la cadena alrededor de dos ruedas (px, centros A y B, radios rA y rB):
   * la envolvente convexa de las dos circunferencias. Devuelve su largo (unidades),
   * los cm de vuelta y punt(s): posición y ángulo a una distancia s del inicio.
   */
  TK.camiCadena = (A, rA, B, rB) => {
    const pts = [];
    for (const [c, r] of [[A, rA + 5], [B, rB + 5]]) for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      pts.push({ x: TK.X(c.x) + r * S * Math.cos(a), y: TK.Y(c.y) + r * S * Math.sin(a) });
    }
    pts.sort((p, q) => p.x - q.x || p.y - q.y);
    const creu = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const baix = [], dalt = [];
    for (const p of pts) { while (baix.length >= 2 && creu(baix[baix.length - 2], baix[baix.length - 1], p) <= 0) baix.pop(); baix.push(p); }
    for (const p of pts.slice().reverse()) { while (dalt.length >= 2 && creu(dalt[dalt.length - 2], dalt[dalt.length - 1], p) <= 0) dalt.pop(); dalt.push(p); }
    const casc = baix.slice(0, -1).concat(dalt.slice(0, -1)); // en sentido antihorario
    const acum = [0];
    for (let k = 1; k <= casc.length; k++) { const p = casc[k - 1], q = casc[k % casc.length]; acum.push(acum[k - 1] + Math.hypot(q.x - p.x, q.y - p.y)); }
    const llarg = acum[acum.length - 1];
    return {
      llarg, cm: (llarg / S) * 0.125,
      punt(s) {
        s = ((s % llarg) + llarg) % llarg;
        let k = 1;
        while (acum[k] < s) k++;
        const p = casc[k - 1], q = casc[k % casc.length], t = (s - acum[k - 1]) / (acum[k] - acum[k - 1] || 1);
        return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, a: Math.atan2(q.y - p.y, q.x - p.x) };
      },
    };
  };
  /** Medida de cadena que hace falta entre dos piezas con dientes (cm), o null si no hay ninguna tan larga. */
  TK.midaCadena = (a, b) => {
    const cm = TK.camiCadena(a, TK.radiEngranatge(a.tipo), b, TK.radiEngranatge(b.tipo)).cm;
    const m = TK.CADENA.MIDES.find((x) => x >= cm);
    return m === undefined ? null : m;
  };

  /** Punto de un collider más lejano en la dirección `dir` (bolas, cajas y polígonos). */
  function soporte(col, dir) {
    const c = col.translation(), tipo = col.shapeType();
    if (tipo === R().ShapeType.Ball) {
      const r = col.radius();
      return { x: c.x + dir.x * r, y: c.y + dir.y * r };
    }
    let v = null;
    if (tipo === R().ShapeType.Cuboid) {
      const h = col.halfExtents();
      v = [h.x, h.y, -h.x, h.y, -h.x, -h.y, h.x, -h.y];
    } else {
      try { v = col.vertices(); } catch (e) { v = null; }
    }
    if (!v || !v.length) return null;
    const a = col.rotation(), cs = Math.cos(a), sn = Math.sin(a);
    let mejor = null, max = -Infinity;
    for (let k = 0; k < v.length; k += 2) {
      const x = c.x + cs * v[k] - sn * v[k + 1], y = c.y + sn * v[k] + cs * v[k + 1];
      const d = x * dir.x + y * dir.y;
      if (d > max) { max = d; mejor = { x, y }; }
    }
    return mejor;
  }

  /**
   * Física de una goma entre a y b (unidades), de medida `mida` (factor).
   * moverA / moverB (opcionales) dan la posición actual de un extremo que se
   * mueve (goma enganchada a un listón que cuelga de una sola espiga, por ejemplo).
   * Devuelve paso(), los extremos actuales (a, b) y los contactos para dibujarla.
   */
  function fisicaGoma(ctx, a, b, mida = 1, moverA = null, moverB = null, cuerpoA = null, cuerpoB = null) {
    const { MU } = TK.GOMA, K = TK.GOMA.K / mida, L0 = TK.GOMA.L0 * S * mida;
    let d, C, u, n;
    const medir = () => {
      d = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1e-4);
      // Una goma floja se deforma mucho y se queda la energía (casi no rebota);
      // una goma muy tensa la devuelve casi entera.
      C = TK.GOMA.C * Math.min(TK.GOMA.CMAX, Math.pow(L0 / d, TK.GOMA.P));
      u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
      n = { x: -u.y, y: u.x };
    };
    medir();
    const estados = new Map(); // handle del collider -> { lado, toca }
    const f = { contactos: [], estirado: 0, a, b, ignorar: new Set() }; // ignorar: cuerpos donde está enganchada
    /*
     * Un extremo se suelta (la pinza que lo sujetaba se ha abierto): la goma se
     * encoge de golpe y ese extremo sale disparado hacia la espiga del otro.
     * Es un cuerpo ligero (la masa de la goma) que empuja lo que encuentra.
     */
    let vuelo = null;
    f.soltar = (lado) => {
      if (vuelo || f.rota || f.recogida) return;
      const p0 = lado === "a" ? a : b, r = 5 * S;
      const rb = ctx.mundo.createRigidBody(R().RigidBodyDesc.dynamic().setTranslation(p0.x, p0.y)
        .setGravityScale(0).setCcdEnabled(true).lockRotations());
      ctx.mundo.createCollider(R().ColliderDesc.ball(r).setDensity(TK.GOMA.MB / (Math.PI * r * r))
        .setRestitution(0.3).setFriction(0.2).setCollisionGroups((0x0010 << 16) | 0x0009), rb);
      if (lado === "a") moverA = null; else moverB = null;
      vuelo = { lado, rb };
      TK.audio.boing();
    };
    const VMAX = 22; // unidades/s: lo más rápido que vuela el extremo suelto
    f.paso = () => {
      const dt = ctx.mundo.timestep;
      if (f.rota || f.recogida) return;
      if (vuelo) {
        const t = vuelo.rb.translation(), libre = { x: t.x, y: t.y };
        if (vuelo.lado === "a") a = f.a = libre; else b = f.b = libre;
        medir();
        const otro = vuelo.lado === "a" ? b : a;
        // Ha llegado a la otra espiga: la goma se queda enrollada en ella
        if (d < 0.08) {
          ctx.mundo.removeRigidBody(vuelo.rb);
          vuelo = null;
          f.recogida = true;
          f.a = { x: otro.x - 0.03, y: otro.y };
          f.b = { x: otro.x + 0.03, y: otro.y };
          f.contactos = [];
          return;
        }
        // La goma tira del extremo hacia la otra espiga
        const dir = vuelo.lado === "a" ? u : { x: -u.x, y: -u.y };
        const J = K * d * dt;
        vuelo.rb.applyImpulse({ x: dir.x * J, y: dir.y * J }, true);
        const v = vuelo.rb.linvel(), vm = Math.hypot(v.x, v.y);
        if (vm > VMAX) vuelo.rb.setLinvel({ x: (v.x / vm) * VMAX, y: (v.y / vm) * VMAX }, true);
        f.contactos = [];
        return;
      }
      if (moverA || moverB) {
        if (moverA) a = f.a = moverA();
        if (moverB) b = f.b = moverB();
        medir();
        // Estirada de más (una rueda que gira y la arrastra): se rompe
        if (d > TK.GOMA.MAX * S * mida) {
          f.rota = true;
          f.contactos = [];
          TK.audio.boing();
          return;
        }
        // Tensa, tira de los extremos que se mueven hacia el otro: hace de muelle
        const estira = d - L0;
        if (estira > 0) {
          const J = K * estira * dt;
          if (cuerpoA && moverA) cuerpoA.applyImpulseAtPoint({ x: u.x * J, y: u.y * J }, a, true);
          if (cuerpoB && moverB) cuerpoB.applyImpulseAtPoint({ x: -u.x * J, y: -u.y * J }, b, true);
        }
      }
      f.contactos = [];
      ctx.mundo.forEachCollider((col) => {
        if (col.isSensor()) return;
        const rb = col.parent();
        if (!rb || !rb.isDynamic() || col.collisionGroups() === TK.GRUPO_ENGRANAJE || f.ignorar.has(rb.handle)) return;
        const c = col.translation();
        const sd = (c.x - a.x) * n.x + (c.y - a.y) * n.y; // distancia (con signo) a la goma
        let e = estados.get(col.handle);
        if (!e) {
          if (Math.abs(sd) > 1.5) return;
          e = { lado: sd >= 0 ? 1 : -1, toca: false };
          estados.set(col.handle, e);
        }
        // El lado desde el que llegó el objeto se recuerda: aunque en un paso
        // cruce la línea de la goma, la goma lo devuelve hacia ese lado.
        const dir = { x: -e.lado * n.x, y: -e.lado * n.y };
        const q = soporte(col, dir);
        if (!q) return;
        const pen = (q.x - a.x) * dir.x + (q.y - a.y) * dir.y; // cuánto empuja la goma
        const tq = (q.x - a.x) * u.x + (q.y - a.y) * u.y;     // dónde, a lo largo de la goma
        if (tq <= 0 || tq >= d || pen <= 0) {
          e.toca = e.tenso = false;
          e.lado = sd >= 0 ? 1 : -1;
          return;
        }
        const wa = { x: a.x - q.x, y: a.y - q.y }, wb = { x: b.x - q.x, y: b.y - q.y };
        const La = Math.hypot(wa.x, wa.y), Lb = Math.hypot(wb.x, wb.y);
        const estira = La + Lb - L0;
        const fx = wa.x / La + wb.x / Lb, fy = wa.y / La + wb.y / Lb, fm = Math.hypot(fx, fy);
        const nh = fm > 1e-6 ? { x: fx / fm, y: fy / fm } : { x: e.lado * n.x, y: e.lado * n.y };
        // Velocidad del objeto en el punto de contacto
        const v = rb.linvel(), w = rb.angvel(), o = rb.translation();
        const vx = v.x - w * (q.y - o.y), vy = v.y + w * (q.x - o.x);
        const vn = vx * nh.x + vy * nh.y;
        if (!e.toca) e.toca = true;
        // Al tensarse, la goma (que también tiene masa) frena el golpe: choque
        // inelástico con la masa MB. Un objeto ligero pierde más velocidad.
        if (estira > 0 && !e.tenso) {
          e.tenso = true;
          if (vn < 0) {
            const m = rb.mass(), j = (-vn * m * TK.GOMA.MB) / (m + TK.GOMA.MB);
            rb.applyImpulseAtPoint({ x: nh.x * j, y: nh.y * j }, q, true);
            if (vn < -3) TK.audio.boing();
          }
        } else if (estira <= 0) e.tenso = false;
        // Empuje elástico + amortiguación (nunca tira del objeto hacia dentro)
        const F = estira > 0 ? Math.max(0, K * estira * fm - C * vn) : 0;
        // Roce a lo largo de la goma
        const tx = -nh.y, ty = nh.x, vt = vx * tx + vy * ty;
        const Jt = -Math.sign(vt) * Math.min(MU * F * dt, 0.3 * rb.mass() * Math.abs(vt));
        if (F > 0) rb.applyImpulseAtPoint({ x: nh.x * F * dt + tx * Jt, y: nh.y * F * dt + ty * Jt }, q, true);
        if (f.contactos.length < 4) f.contactos.push({ t: tq, x: q.x, y: q.y });
      });
      f.contactos.sort((p, q) => p.t - q.t);
    };
    return f;
  }

  /**
   * Tirachinas: la goma (a-b, unidades) está estirada hasta la espiga donde
   * se apoya la pinza (tensor, px). En el punto estirado hay una "bolsa"
   * (una cuna pequeña donde puede descansar una bola). Mientras la pinza la
   * sujeta, la bolsa no se mueve; al soltarla (soltar()), la goma tira de la
   * bolsa hacia la línea a-b y lanza lo que tenga delante.
   */
  function tirachinas(ctx, a, b, tensor, mida = 1) {
    const L0 = TK.GOMA.L0 * S * mida, KT = TK.GOMA.KT / mida;
    const e = { x: TK.X(tensor.x), y: TK.Y(tensor.y) };
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const u = { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
    const lado = (e.x - a.x) * -u.y + (e.y - a.y) * u.x >= 0 ? 1 : -1;
    const n = { x: -u.y * lado, y: u.x * lado }; // de la línea hacia la espiga
    const q = { x: e.x - n.x * 0.12, y: e.y - n.y * 0.12 };
    const bolsa = ctx.mundo.createRigidBody(R().RigidBodyDesc.kinematicPositionBased()
      .setTranslation(q.x, q.y).setRotation(Math.atan2(u.y, u.x)).lockRotations().setCcdEnabled(true));
    // Cuna en V abierta hacia la línea de la goma. Solo choca con objetos que se mueven.
    const grupos = (0x0010 << 16) | 0x0009;
    const malla = new T.Group();
    for (const k of [-1, 1]) {
      const ang = -lado * k * 0.42, cx = k * 11 * S, cy = -lado * 0.04;
      const cd = R().ColliderDesc.cuboid(0.12, 0.03).setTranslation(cx, cy).setRotation(ang)
        .setFriction(0.8).setRestitution(0.1).setDensity(1).setCollisionGroups(grupos);
      ctx.mundo.createCollider(cd, bolsa);
      const m = TK.sombra(new T.Mesh(new T.BoxGeometry(0.24, 0.05, 0.08), M.gomaNegra));
      m.position.set(cx, cy, Z);
      m.rotation.z = ang;
      malla.add(m);
    }
    let libre = false;
    return {
      bolsa, malla,
      punto: () => bolsa.translation(),
      sync: () => posar(malla, bolsa),
      soltar() {
        if (libre) return;
        libre = true;
        bolsa.setBodyType(R().RigidBodyType.Dynamic, true);
        bolsa.setLinearDamping(0.25);
      },
      paso() {
        if (!libre) return;
        const t = bolsa.translation(), v = bolsa.linvel(), dt = ctx.mundo.timestep;
        const wa = { x: a.x - t.x, y: a.y - t.y }, wb = { x: b.x - t.x, y: b.y - t.y };
        const La = Math.hypot(wa.x, wa.y), Lb = Math.hypot(wb.x, wb.y), s = La + Lb - L0;
        // Una vez cruza la línea, la goma se queda vibrando y se para
        if ((t.x - a.x) * n.x + (t.y - a.y) * n.y < 0) bolsa.setLinearDamping(4);
        if (s <= 0 || La < 1e-4 || Lb < 1e-4) return;
        const fx = wa.x / La + wb.x / Lb, fy = wa.y / La + wb.y / Lb;
        bolsa.applyImpulse({ x: KT * s * fx * dt, y: KT * s * fy * dt }, true);
      },
    };
  }

  /**
   * Malla de una goma: lazo negro de dos tramos alrededor de las espigas.
   * dibujar(a, b, contactos) la redibuja (unidades): floja hace panza; al
   * empujarla forma una V; cuanto más estirada, más delgada.
   */
  function mallaGoma(mida = 1) {
    const raiz = new T.Group();
    const geo = new T.CylinderGeometry(1, 1, 1, 8);
    const tramos = [];
    for (let k = 0; k < 48; k++) {
      const m = new T.Mesh(geo, M.gomaNegra);
      m.castShadow = true;
      m.visible = false;
      raiz.add(m);
      tramos.push(m);
    }
    const aros = [0, 1].map(() => {
      const m = TK.sombra(new T.Mesh(new T.TorusGeometry(0.052, 0.014, 8, 24), M.gomaNegra));
      m.position.z = Z;
      raiz.add(m);
      return m;
    });
    const L0 = TK.GOMA.L0 * S * mida;
    // za / zb: cuánto sube cada extremo (enganchado en una espiga que atraviesa una
    // pieza, la goma va por encima de esa pieza, no por debajo)
    const out = { raiz, dibujar, za: 0, zb: 0 };
    function dibujar(a, b, contactos = []) {
      const za = out.za, zb = out.zb, abx = b.x - a.x, aby = b.y - a.y, ab2 = abx * abx + aby * aby || 1;
      const zEn = (x, y) => Z + za + (zb - za) * Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / ab2));
      const nodos = [a, ...contactos, b];
      let largo = 0;
      for (let k = 1; k < nodos.length; k++) largo += Math.hypot(nodos[k].x - nodos[k - 1].x, nodos[k].y - nodos[k - 1].y);
      // Panza: lo que sobra de goma cuelga hacia abajo (parábola en cada tramo)
      const sobra = TK.vistaMesa ? 0 : Math.max(0, L0 - largo); // en la mesa no cuelga
      const puntos = [];
      for (let k = 1; k < nodos.length; k++) {
        const p = nodos[k - 1], q = nodos[k], l = Math.hypot(q.x - p.x, q.y - p.y);
        const h = l > 0 ? Math.sqrt((3 * l * ((sobra * l) / largo)) / 8) : 0;
        for (let j = k === 1 ? 0 : 1; j <= 4; j++) {
          const s = j / 4;
          puntos.push({ x: p.x + (q.x - p.x) * s, y: p.y + (q.y - p.y) * s - 4 * h * s * (1 - s), junto: (j === 0 && k > 1) || (j === 4 && k < nodos.length - 1) });
        }
      }
      const grosor = (0.016 + 0.006 * mida) / Math.sqrt(Math.max(1, largo / L0)); // las grandes, más gruesas
      const dx = b.x - a.x, dy = b.y - a.y, dl = Math.hypot(dx, dy) || 1;
      const nx = -dy / dl, ny = dx / dl;
      let k = 0;
      for (const lado of [1, -1]) {
        for (let i = 1; i < puntos.length; i++) {
          // Los dos tramos del lazo se separan en las espigas y se juntan donde empuja el objeto
          const w1 = puntos[i - 1].junto ? 0.012 : 0.047, w2 = puntos[i].junto ? 0.012 : 0.047;
          const m = tramos[k++];
          const x1 = puntos[i - 1].x + nx * w1 * lado, y1 = puntos[i - 1].y + ny * w1 * lado;
          const x2 = puntos[i].x + nx * w2 * lado, y2 = puntos[i].y + ny * w2 * lado;
          const ex = x2 - x1, ey = y2 - y1;
          m.position.set((x1 + x2) / 2, (y1 + y2) / 2, zEn((x1 + x2) / 2, (y1 + y2) / 2));
          m.scale.set(grosor, Math.max(Math.hypot(ex, ey), 1e-4), grosor);
          m.rotation.set(0, 0, Math.atan2(-ex, ey));
          m.visible = true;
        }
      }
      for (; k < tramos.length; k++) tramos[k].visible = false;
      aros[0].position.set(a.x, a.y, Z + za);
      aros[1].position.set(b.x, b.y, Z + zb);
    }
    return out;
  }
  TK.mallaGoma = mallaGoma;

  /**
   * Malla de una pinza de madera. Origen en la punta que muerde (x = 0);
   * el cuerpo se extiende hacia +x. abrir(f) abre las mandíbulas (0 a 1).
   */
  function mallaPinza() {
    const raiz = new T.Group();
    const mitad = (signo) => {
      const pivote = new T.Group();
      pivote.position.x = 20 * S; // el muelle hace de bisagra
      pivote.add(TK.caja(84, 8, M.madera, { x: 8, y: signo * 6, r: 3, prof: 0.18 }));
      raiz.add(pivote);
      return pivote;
    };
    const arriba = mitad(-1), abajo = mitad(1);
    raiz.add(TK.cilindro(6, 0.26, M.hierro, { x: 20 }));
    return {
      raiz,
      abrir(f) { arriba.rotation.z = -0.14 * f; abajo.rotation.z = 0.14 * f; },
    };
  }
  TK.mallaPinza = mallaPinza;

  /* ---------- Catálogo ---------- */
  TK.PIEZAS = {
    /* Pelotas y bales */
    canica: piezaBola("Bala de vidre", "canica"),
    corcho: piezaBola("Bola de suro", "corcho"),
    pelota: piezaBola("Pilota de goma", "pelota"),

    /* Espigas de 8 mm: se clavan en un agujero. Hacen de tope o de eje. */
    espiga: {
      nombre: "Espiga", rotable: false, agujero: true,
      crear: (p, ctx) => piezaSimple(p, ctx, "fijo", (rb) => bola(ctx, rb, 5, "madera"), [TK.espiga(0.56)]),
    },
    espigaLarga: {
      nombre: "Espiga llarga", rotable: false, agujero: true,
      crear: (p, ctx) => piezaSimple(p, ctx, "fijo", (rb) => bola(ctx, rb, 5, "madera"), [TK.espiga(0.9)]),
    },

    /* Listón plano (rampa) de contrachapado con tres agujeros. */
    liston: {
      nombre: "Llistó", rotable: true, angulo0: 15 * G,
      crear: (p, ctx) => piezaSimple(p, ctx, "montado", (rb) => caja(ctx, rb, 240, 14, "madera"),
        [TK.caja(240, 14, M.madera, { r: 4 }), TK.agujeros(TK.FORATS.liston, 3.5)]),
    },

    /* Rampa cóncava: listón grueso con una acanaladura. */
    canal: {
      nombre: "Rampa còncava", rotable: true, angulo0: 15 * G,
      crear(p, ctx) {
        const L = 240 * S, s = new T.Shape();
        s.moveTo(-0.22, -0.1); s.lineTo(0.22, -0.1); s.lineTo(0.22, 0.1); s.lineTo(0.13, 0.1);
        s.absarc(0, 0.1, 0.13, 0, Math.PI, true);
        s.lineTo(-0.22, 0.1); s.closePath();
        const geo = new T.ExtrudeGeometry(s, { depth: L, bevelEnabled: false, curveSegments: 16 });
        geo.rotateY(Math.PI / 2);
        geo.translate(-L / 2, 0, Z);
        const m = TK.sombra(new T.Mesh(geo, M.maderaMedia));
        return piezaSimple(p, ctx, "montado", (rb) => caja(ctx, rb, 240, 10, "madera", { ajustes: { f: 0.35 } }),
          [m, TK.agujeros(TK.FORATS.canal.map(([x]) => [x, 6]), 3.5, Z + 0.225)]);
      },
    },

    /* Bloque perforado rectangular (madera envejecida). */
    bloque: {
      nombre: "Bloc",rotable: true,
      crear: (p, ctx) => piezaSimple(p, ctx, "montado", (rb) => caja(ctx, rb, 160, 40, "madera"),
        [TK.caja(160, 40, M.maderaVieja, { r: 4 }), TK.agujeros(TK.FORATS.bloque, 4)]),
    },

    /* Bloque perforado triangular (prisma): una cuña que sirve de rampa. */
    cuna: {
      nombre: "Bloc triangular", rotable: true,
      crear(p, ctx) {
        const pts = [[-60, 30], [60, 30], [60, -30]];
        const f = new T.Shape();
        pts.forEach(([x, y], k) => (k ? f.lineTo(x * S, -y * S) : f.moveTo(x * S, -y * S)));
        f.closePath();
        return piezaSimple(p, ctx, "montado", (rb) => poligono(ctx, rb, pts, "madera"),
          [TK.extruir(f, M.maderaVieja, { bisel: 0.015 }), TK.agujeros(TK.FORATS.cuna, 4)]);
      },
    },

    /* Pinza de madera (engancha: "pinza"). Nunca va suelta: o bien está
       CLAVADA por el muelle en una espiga (p.clavada; la boca queda libre),
       o bien MUERDE la punta de un listón, la boca de un tubo, el aro de un
       cono o una goma. (x, y) es la punta de la boca y el ángulo, hacia dónde
       sale el cuerpo; el muelle está a 20 px de la punta.
       Si lo que muerde se mueve (un listón con una sola espiga, un tubo
       suelto…), la pinza va con él. Una bola que pese (vidrio, goma, madera;
       el corcho no: TK.GOMA.GATILLO) la abre al tocarle la boca: la clavada
       la deja pasar y se vuelve a cerrar; la que muerde se suelta y cae.
       Con p.goma es un gatillo: muerde esa goma estirada y se apoya en la
       espiga; si le cae encima algo que pese, se suelta, cae y la goma sale
       disparada. */
    pinza: {
      nombre: "Pinça", rotable: true, engancha: "pinza",
      crear(p, ctx) {
        const m = mallaPinza();
        // Lo que sostiene la pinza: la pieza que muerde, o (clavada) la biela de una rueda, que gira
        let hostRb = null;
        if (ctx.jugando && p.host && p.host.inst && !p.goma) {
          if (!p.clavada) hostRb = p.host.inst.cuerpos[0];
          else if (p.host.inst.cuerpoDe) hostRb = p.host.inst.cuerpoDe(p.pal);
        }
        const mueve = !!(hostRb && hostRb.isDynamic());
        let col = null, boca = null;
        const i = piezaSimple(p, ctx, mueve ? "dinamico" : "fijo", (rb) => {
          if (p.clavada) {
            // Clavada en una espiga por el muelle: la boca (lo que se abre y cierra,
            // donde puede ir una goma) y el mango, que es lo que hay que golpear
            boca = caja(ctx, rb, 34, 18, "madera", { x: 3 });
            col = caja(ctx, rb, 50, 18, "madera", { x: 45 });
            etiquetar(ctx, col, "mango");
          } else {
            col = caja(ctx, rb, 84, 18, "madera", { x: 28 });
            etiquetar(ctx, col, p.goma ? "gatillo" : "mossega");
          }
        }, [m.raiz]);
        i.abrir = m.abrir;
        const rb0 = i.cuerpos[0];
        let union = null;
        if (mueve) {
          const t = rb0.translation(), h = hostRb.translation(), ha = hostRb.rotation(), c = Math.cos(ha), s = Math.sin(ha);
          const dx = t.x - h.x, dy = t.y - h.y;
          union = ctx.mundo.createImpulseJoint(R().JointData.fixed({ x: c * dx + s * dy, y: -s * dx + c * dy }, rb0.rotation() - ha, { x: 0, y: 0 }, 0), hostRb, rb0, true);
          union.setContactsEnabled(false);
        }
        // Una bola pesada que golpea el mango abre la boca (el corcho no):
        // si la boca sujetaba una goma, la suelta
        let abierta = 0, soltada = false;
        i.tocar = (otro) => {
          if (p.goma || soltada || abierta || otro.mass() < TK.GOMA.GATILLO) return;
          const t = rb0.translation(), b = otro.translation(), a = rb0.rotation();
          const lx = Math.cos(a) * (b.x - t.x) + Math.sin(a) * (b.y - t.y); // a lo largo de la pinza (0 = punta)
          if (p.clavada) {
            abierta = 60;
            m.abrir(1);
            TK.audio.clic();
            if (ctx.pinzaOberta) ctx.pinzaOberta(p);
          } else if (lx < 0.22) {
            soltada = true;
            if (union) { ctx.mundo.removeImpulseJoint(union, true); union = null; }
            if (!rb0.isDynamic()) rb0.setBodyType(R().RigidBodyType.Dynamic, true);
            col.setCollisionGroups((0x0010 << 16) | 0x0001);
            m.abrir(1);
            TK.audio.clic();
          }
        };
        i.paso = () => {
          if (abierta && --abierta === 0) m.abrir(0);
        };
        if (p.goma) {
          const rb = i.cuerpos[0];
          let suelta = false;
          i.disparar = () => {
            if (suelta) return;
            suelta = true;
            rb.setBodyType(R().RigidBodyType.Dynamic, true);
            col.setCollisionGroups((0x0010 << 16) | 0x0001); // cae sin engancharse en el panel
            rb.setAngvel(3, true);
            m.abrir(1);
            if (p.goma.inst && p.goma.inst.soltar) p.goma.inst.soltar();
            TK.audio.boing();
          };
        }
        return i;
      },
    },

    /* Tubo de PVC recto: dos paredes; la bola entra por los extremos. */
    tubo: {
      nombre: "Tub de PVC", rotable: true,
      crear(p, ctx) {
        const L = 200;
        const cil = new T.Mesh(new T.CylinderGeometry(0.31, 0.31, L * S, 28, 1, true), M.pvc);
        cil.rotation.z = Math.PI / 2;
        cil.position.z = Z;
        const a1 = anillo(0.31, M.pvcBorde), a2 = anillo(0.31, M.pvcBorde);
        [a1, a2].forEach((a, k) => { a.rotation.y = Math.PI / 2; a.position.set((k ? 1 : -1) * (L / 2) * S, 0, Z); });
        return piezaSimple(p, ctx, "montado", (rb) => {
          caja(ctx, rb, L, 6, "pvc", { y: -33 });
          caja(ctx, rb, L, 6, "pvc", { y: 33 });
        }, [cil, a1, a2]);
      },
    },

    /* Codo de PVC de 90°: la bola entra por arriba y sale hacia la derecha. */
    codo: {
      nombre: "Colze de PVC", rotable: true,
      crear(p, ctx) {
        const Rc = 62, ox = 46, oy = -46;
        const toro = new T.Mesh(new T.TorusGeometry(Rc * S, 0.31, 16, 24, Math.PI / 2), M.pvc);
        toro.rotation.z = Math.PI;
        toro.position.set(ox * S, -oy * S, Z);
        const aArriba = anillo(0.31, M.pvcBorde), aDcha = anillo(0.31, M.pvcBorde);
        aArriba.rotation.x = Math.PI / 2; aArriba.position.set((ox - Rc) * S, -oy * S, Z);
        aDcha.rotation.y = Math.PI / 2; aDcha.position.set(ox * S, -(oy + Rc) * S, Z);
        return piezaSimple(p, ctx, "montado", (rb) => {
          arco(ctx, rb, ox, oy, Rc - 34, 90 * G, 180 * G, 5, 6, "pvc");
          arco(ctx, rb, ox, oy, Rc + 34, 90 * G, 180 * G, 11, 6, "pvc");
        }, [toro, aArriba, aDcha]);
      },
    },

    /* Tubo corrugado en U: la bola entra por arriba y vuelve en sentido contrario. */
    corrugado: {
      nombre: "Tub corrugat", rotable: true,
      crear(p, ctx) {
        const Rc = 66, ox = 48;
        const mat = M.corrugados[Math.abs(Math.round(p.x / 20 + p.y / 20)) % M.corrugados.length];
        const curva = new Arco(ox * S, 0, Rc * S, Math.PI / 2, (3 * Math.PI) / 2);
        const tubo = new T.Mesh(new T.TubeGeometry(curva, 40, 0.3, 14, false), mat);
        const hijos = [tubo];
        for (let k = 0; k <= 16; k++) { // estrías
          const t = k / 16, pt = curva.getPoint(t), a = Math.PI / 2 + Math.PI * t;
          const r = new T.Mesh(new T.TorusGeometry(0.31, 0.018, 6, 22), mat);
          r.position.copy(pt);
          r.rotation.set(Math.PI / 2, 0, a, "ZXY");
          r.rotation.order = "ZXY";
          hijos.push(r);
        }
        return piezaSimple(p, ctx, "montado", (rb) => {
          arco(ctx, rb, ox, 0, Rc - 34, -90 * G, -270 * G, 7, 6, "pvc");
          arco(ctx, rb, ox, 0, Rc + 34, -90 * G, -270 * G, 16, 6, "pvc");
        }, hijos);
      },
    },

    /* Cono de hilo perforado: embudo que recoge y centra las bolas. */
    cono: {
      nombre: "Con", rotable: true,
      crear(p, ctx) {
        const lathe = new T.LatheGeometry([new T.Vector2(0.27, -0.45), new T.Vector2(0.62, 0.45)], 32, -Math.PI / 2, Math.PI);
        const m = TK.sombra(new T.Mesh(lathe, M.cono));
        m.scale.z = 0.7;
        const ang = Math.atan2(90, 35), largo = Math.hypot(35, 90);
        return piezaSimple(p, ctx, "montado", (rb) => {
          caja(ctx, rb, largo, 8, "madera", { x: -44, y: 0, ang });
          caja(ctx, rb, largo, 8, "madera", { x: 44, y: 0, ang: Math.PI - ang });
        }, [m]);
      },
    },

    /* Goma elástica negra enganchada entre dos puntos: espigas, agujeros de
       un listón o un bloque, o la boca de una pinza clavada (p.a y p.b son las
       piezas; p.pa y p.pb, los puntos en px; engancha: "goma"). Ver TK.GOMA.
       Con p.tensor (una pinza apoyada en una espiga) es un tirachinas. */
    goma: {
      nombre: "Goma elàstica", rotable: false, engancha: "goma",
      crear(p, ctx) {
        const mida = TK.gomaMida(p);
        // Sin espigas (miniatura del repositorio): dos espigas de muestra
        const A = p.pa || (p.a ? { x: p.a.x, y: p.a.y } : { x: p.x - 80 * mida, y: p.y });
        const B = p.pb || (p.b ? { x: p.b.x, y: p.b.y } : { x: p.x + 80 * mida, y: p.y });
        const a = { x: TK.X(A.x), y: TK.Y(A.y) }, b = { x: TK.X(B.x), y: TK.Y(B.y) };
        const dibujo = mallaGoma(mida);
        const hijos = [dibujo.raiz];
        if (!p.a) hijos.push(fijo(grupo([TK.espiga(0.4)]), A.x, A.y), fijo(grupo([TK.espiga(0.4)]), B.x, B.y));
        // Sensor fino a lo largo de la goma: solo sirve para tocarla y seleccionarla
        const largo = Math.hypot(B.x - A.x, B.y - A.y);
        const rb = cuerpo(ctx, "fijo", (A.x + B.x) / 2, (A.y + B.y) / 2, Math.atan2(B.y - A.y, B.x - A.x));
        caja(ctx, rb, Math.max(largo - 24, 8), 14, "goma", { sensor: true });
        if (p.tensor) {
          const t = tirachinas(ctx, a, b, p.tensor, mida);
          hijos.push(t.malla);
          const i = instancia(p, ctx, [rb, t.bolsa], grupo(hijos), () => { t.sync(); dibujo.dibujar(a, b, [t.punto()]); });
          i.paso = t.paso;
          i.soltar = t.soltar;
          i.dibujo = dibujo;
          return i;
        }
        // Atada alrededor de un tubo o un cono (p.lligam): lo sujeta, no rebota
        if (p.lligam) return Object.assign(instancia(p, ctx, [rb], grupo(hijos), () => dibujo.dibujar(a, b, [])), { dibujo });
        // Si la pieza donde está enganchada se mueve, el extremo la sigue
        // (la biela de un engranaje se mueve con la rueda, no con su eje)
        const cuerpoDe = (host, l) => (ctx.jugando && host && host.inst ? (host.inst.cuerpoDe ? host.inst.cuerpoDe(l) : host.inst.cuerpos[0]) : null);
        const movil = (host, l) => {
          const hb = cuerpoDe(host, l);
          if (!hb || !hb.isDynamic()) return null;
          const lx = ((l && l.x) || 0) * S, ly = -((l && l.y) || 0) * S;
          return () => { const t = hb.translation(), r = hb.rotation(), c = Math.cos(r), s = Math.sin(r); return { x: t.x + c * lx - s * ly, y: t.y + s * lx + c * ly }; };
        };
        const fis = fisicaGoma(ctx, a, b, mida, movil(p.a, p.la), movil(p.b, p.lb), cuerpoDe(p.a, p.la), cuerpoDe(p.b, p.lb));
        for (const h of [p.a, p.b]) if (ctx.jugando && h && h.inst) h.inst.cuerpos.forEach((c) => fis.ignorar.add(c.handle));
        const i = instancia(p, ctx, [rb], grupo(hijos), () => {
          dibujo.raiz.visible = !fis.rota; // rota: ya no se ve
          dibujo.dibujar(fis.a, fis.b, fis.contactos);
        });
        i.paso = fis.paso;
        i.soltarDe = (lado) => fis.soltar(lado); // la pinza que sujetaba ese extremo se ha abierto
        i.dibujo = dibujo;
        return i;
      },
    },
    /* Gomas pequeña (10 cm) y grande (32 cm): en el panel son una "goma" con p.mida. */
    gomaPetita: { nombre: "Goma petita", rotable: false, engancha: "goma", mida: TK.GOMA.MIDES.gomaPetita, crear: (p, ctx) => TK.PIEZAS.goma.crear({ ...p, mida: TK.GOMA.MIDES.gomaPetita }, ctx) },
    gomaGran: { nombre: "Goma gran", rotable: false, engancha: "goma", mida: TK.GOMA.MIDES.gomaGran, crear: (p, ctx) => TK.PIEZAS.goma.crear({ ...p, mida: TK.GOMA.MIDES.gomaGran }, ctx) },

    /* Cadena de bicicleta entre dos engranajes (p.a y p.b son sus registros;
       engancha: "cadena"). Une engranajes que no se tocan: giran en el MISMO
       sentido y la velocidad cambia según los tamaños (r1·ω1 = r2·ω2). Hay
       cadenas de varias medidas (TK.CADENA.MIDES, en cm de vuelta): se usa la
       más corta que llega. La física la resuelve app.js (acoplarEngranajes). */
    cadena: {
      nombre: "Cadena", rotable: false, engancha: "cadena",
      crear(p, ctx) {
        const RA = p.a ? TK.radiEngranatge(p.a.tipo) : 32, RB = p.b ? TK.radiEngranatge(p.b.tipo) : 22;
        const A = p.a ? { x: p.a.x, y: p.a.y } : { x: p.x - 70, y: p.y }, B = p.b ? { x: p.b.x, y: p.b.y } : { x: p.x + 70, y: p.y };
        const cami = TK.camiCadena(A, RA, B, RB);
        const raiz = new T.Group();
        // Eslabones: placas de acero alternas, oscuras y claras
        const geo = new T.BoxGeometry(0.11, 0.05, 0.05), mats = [M.hierro, M.gomaNegra];
        const n = Math.max(8, Math.floor(cami.llarg / 0.12)), pas = cami.llarg / n, baules = [];
        for (let k = 0; k < n; k++) { const m = new T.Mesh(geo, k % 2 ? mats[0] : mats[1]); m.castShadow = true; raiz.add(m); baules.push(m); }
        // Sin engranajes (miniatura): dos ruedas de muestra
        if (!p.a) {
          raiz.add(fijo(grupo([TK.extruir(TK.formaEngranaje(RA, 13, []), M.madera, { prof: 0.12, z: 0.12 })]), A.x, A.y));
          raiz.add(fijo(grupo([TK.extruir(TK.formaEngranaje(RB, 9, []), M.madera, { prof: 0.12, z: 0.12 })]), B.x, B.y));
        }
        // Sensor fino para poder tocarla y quitarla
        const llarg = Math.hypot(B.x - A.x, B.y - A.y);
        const rb = cuerpo(ctx, "fijo", (A.x + B.x) / 2, (A.y + B.y) / 2, Math.atan2(B.y - A.y, B.x - A.x));
        caja(ctx, rb, Math.max(llarg - 20, 8), 2 * Math.max(RA, RB) + 10, "metal", { sensor: true });
        // La cadena avanza con el engranaje A: desplazamiento = ángulo acumulado · radio
        let acumulat = 0, previ = null;
        const sync = () => {
          const ea = p.a && p.a.inst && p.a.inst.engranaje;
          if (ea) {
            const ang = ea.rb.rotation();
            if (previ !== null) { let d = ang - previ; d = Math.atan2(Math.sin(d), Math.cos(d)); acumulat += d; }
            previ = ang;
          }
          const desp = acumulat * (RA + 5) * S;
          baules.forEach((m, k) => {
            const pt = cami.punt(k * pas + desp);
            m.position.set(pt.x, pt.y, Z + 0.2);
            m.rotation.z = pt.a;
          });
        };
        const i = instancia(p, ctx, [rb], raiz, sync);
        return i;
      },
    },

    /* Engranajes de 50, 100, 150 y 200 mm. */
    engranaje50: piezaEngranaje("Engranatge 50", 20),
    engranaje100: piezaEngranaje("Engranatge 100", 40),
    engranaje150: piezaEngranaje("Engranatge 150", 60),
    engranaje200: piezaEngranaje("Engranatge 200", 80),

    /* Manivela con pomo sobre un engranaje de 100 mm.
       Durante el Play, mantenla pulsada para girarla. */
    manivela: {
      nombre: "Manovella", rotable: false, agujero: true,
      crear(p, ctx) {
        const brazo = TK.caja(14, 62, M.maderaOscura, { y: -28, prof: 0.1, z: Z + 0.13, r: 6 });
        const pomo = TK.cilindro(9, 0.34, M.gomaRoja, { y: -54, z: Z + 0.33 });
        const i = crearEngranaje(p, ctx, 40, { adornos: [brazo, pomo], instancia: { girando: false } });
        i.manivela = true;
        i.paso = () => { if (i.girando && !i.engranaje.suelto) i.engranaje.rb.setAngvel(-4, true); else i.friccion(); };
        return i;
      },
    },

    /* Polea de madera con cordel rojo: cubo a la izquierda, contrapeso a la
       derecha (algo más pesado que el cubo vacío). Si cae una canica o una
       bola de madera en el cubo, baja y el contrapeso sube (Atwood). El
       corcho pesa demasiado poco. Rapier no trae poleas: la cuerda se
       resuelve en paso() corrigiendo posición y velocidad. */
    polea: {
      nombre: "Politja", rotable: false, agujero: true,
      crear(p, ctx) {
        const RAD = 80, LMIN = 1.2; // polea grande de 200 mm
        const libre = suelta(p, ctx); // sin espiga en el centro: cae todo
        const rueda = cuerpo(ctx, libre ? "dinamico" : "fijo", p.x, p.y, 0);
        bola(ctx, rueda, RAD, "madera");
        const iz = { x: TK.X(p.x - RAD), y: TK.Y(p.y) }, de = { x: TK.X(p.x + RAD), y: TK.Y(p.y) };
        const cubo = cuerpo(ctx, "dinamico", p.x - RAD, p.y + LMIN / S, 0, { sinGiro: true, amortiguar: 0.3 });
        caja(ctx, cubo, 74, 10, "madera", { y: 22 });
        caja(ctx, cubo, 10, 50, "madera", { x: -32 });
        caja(ctx, cubo, 10, 50, "madera", { x: 32 });
        const pesa = cuerpo(ctx, "dinamico", p.x + RAD, p.y + (p.contrapeso ?? 220), 0, { sinGiro: true, amortiguar: 0.3 });
        caja(ctx, pesa, 40, 40, "madera", { ajustes: { d: 1.46 } });
        const LTOT = (iz.y - cubo.translation().y) + (de.y - pesa.translation().y);

        const gR = fijo(grupo([TK.cilindro(RAD, 0.26, M.madera), TK.cilindro(RAD - 8, 0.3, M.maderaMedia), TK.cilindro(16, 0.36, M.hierro), p.fija ? TK.espiga(0.6) : null,
          TK.agujeros([[40, 0], [-40, 0], [0, 40], [0, -40]].map(([x, y]) => [x, y]), 6, Z + 0.16)]), p.x, p.y);
        const arcoCuerda = new T.Mesh(new T.TorusGeometry(RAD * S, 0.016, 6, 24, Math.PI), M.cuerda);
        arcoCuerda.position.z = Z;
        gR.add(arcoCuerda);
        const gC = grupo([TK.caja(74, 10, M.maderaVieja, { y: 22 }), TK.caja(10, 50, M.maderaVieja, { x: -32 }), TK.caja(10, 50, M.maderaVieja, { x: 32 })]);
        const gW = grupo([TK.caja(40, 40, M.maderaOscura, { r: 5 }), TK.agujeros([[0, 0]], 4)]);
        const hilos = [TK.cuerda(), TK.cuerda(), TK.cuerda(), TK.cuerda()];
        const tensarU = (m, ax, ay, bx, by, z) => TK.tensar(m, ax / S + TK.W / 2, -ay / S + TK.H / 2, bx / S + TK.W / 2, -by / S + TK.H / 2, z);
        function tramo(a, b) {
          const t = b.translation(), v = b.linvel();
          const dx = t.x - a.x, dy = t.y - a.y, l = Math.hypot(dx, dy) || 1e-6;
          const u = { x: dx / l, y: dy / l };
          return { t, v, l, u, vn: v.x * u.x + v.y * u.y };
        }
        if (libre) hilos.forEach((h) => (h.visible = false));
        return instancia(p, ctx, [rueda, cubo, pesa], grupo([gR, gC, gW, ...hilos]), () => {
          posar(gC, cubo);
          posar(gW, pesa);
          if (libre) { posar(gR, rueda); return; }
          const c = cubo.translation(), w = pesa.translation();
          const borde = c.y + 0.25, nudo = { x: c.x, y: borde + 0.28 };
          tensarU(hilos[0], iz.x, iz.y, nudo.x, nudo.y);
          tensarU(hilos[1], nudo.x, nudo.y, c.x - 0.32, borde, Z + 0.12);
          tensarU(hilos[2], nudo.x, nudo.y, c.x + 0.32, borde, Z + 0.12);
          tensarU(hilos[3], de.x, de.y, w.x, w.y + 0.2);
        }, {
          paso() {
            if (libre) return;
            const pares = [[cubo, iz], [pesa, de]];
            // Cuelgan rectos: solo se mueven en vertical, bajo su punto de la rueda
            for (const [b, a] of pares) {
              const t = b.translation(), v = b.linvel();
              if (t.x !== a.x) b.setTranslation({ x: a.x, y: t.y }, true);
              if (v.x) b.setLinvel({ x: 0, y: v.y }, true);
            }
            for (let it = 0; it < 2; it++) {
              // 1) Tope: ningún lado sube más allá de LMIN.
              const tope = pares.map(([b, a]) => {
                const s = tramo(a, b);
                if (s.l > LMIN + 0.005) return false;
                if (s.l < LMIN) b.setTranslation({ x: a.x + s.u.x * LMIN, y: a.y + s.u.y * LMIN }, true);
                if (s.vn < 0) b.setLinvel({ x: s.v.x - s.u.x * s.vn, y: s.v.y - s.u.y * s.vn }, true);
                return true;
              });
              // 2) Cuerda inextensible: L1 + L2 <= LTOT.
              const s1 = tramo(iz, cubo), s2 = tramo(de, pesa);
              const exceso = s1.l + s2.l - LTOT;
              if (exceso <= 0) continue;
              const w1 = tope[0] ? 0 : 1 / cubo.mass(), w2 = tope[1] ? 0 : 1 / pesa.mass(), w = w1 + w2;
              if (w === 0) continue;
              cubo.setTranslation({ x: s1.t.x - s1.u.x * exceso * w1 / w, y: s1.t.y - s1.u.y * exceso * w1 / w }, true);
              pesa.setTranslation({ x: s2.t.x - s2.u.x * exceso * w2 / w, y: s2.t.y - s2.u.y * exceso * w2 / w }, true);
              const ritmo = s1.vn + s2.vn;
              if (ritmo > 0) {
                const J = ritmo / w;
                cubo.setLinvel({ x: s1.v.x - s1.u.x * J * w1, y: s1.v.y - s1.u.y * J * w1 }, true);
                pesa.setLinvel({ x: s2.v.x - s2.u.x * J * w2, y: s2.v.y - s2.u.y * J * w2 }, true);
              }
            }
          },
        });
      },
    },

    /* Dominó de madera: dinámico, cae y transmite el movimiento. */
    domino: {
      nombre: "Dòmino", rotable: true,
      crear: (p, ctx) => piezaSimple(p, ctx, "dinamico",
        (rb) => caja(ctx, rb, 16, 76, "madera", { ajustes: { f: 0.6, r: 0.05 } }),
        [TK.caja(16, 76, M.madera, { r: 4 }), TK.agujeros([[0, -26]], 3)]),
    },

    /* Palanca: listón sobre una espiga-eje. Gira ±28°. */
    palanca: {
      nombre: "Palanca", rotable: true, agujero: true,
      crear(p, ctx) {
        // Eje en el agujero del centro: sube y baja ±28°. Con la espiga en otro
        // agujero cuelga de ella; con dos espigas no se mueve; sin espiga, cae.
        const LIM = 28 * G, m = p.montaje, jugando = ctx.jugando && !p.fija && m;
        const centro = !jugando || (m.n === 1 && Math.abs(m.eje.x - p.x) < 3 && Math.abs(m.eje.y - p.y) < 3);
        const ancla = cuerpo(ctx, "fijo", p.x, p.y, p.angulo);
        const tabla = cuerpo(ctx, jugando && m.n >= 2 ? "fijo" : "dinamico", p.x, p.y, p.angulo, { amortiguarGiro: 0.3 });
        caja(ctx, tabla, 280, 14, "madera", { ajustes: { d: 0.8 } });
        if (centro) {
          const eje = ctx.mundo.createImpulseJoint(R().JointData.revolute({ x: 0, y: 0 }, { x: 0, y: 0 }), ancla, tabla, true);
          eje.setLimits(-LIM, LIM);
          eje.setContactsEnabled(false);
        } else colgar(ctx, p, tabla);
        const gT = grupo([TK.caja(280, 14, M.madera, { r: 4 }), TK.agujeros(TK.FORATS.palanca, 3.5)]);
        const gE = p.fija ? fijo(grupo([TK.espiga(0.6)]), p.x, p.y) : null;
        return instancia(p, ctx, [ancla, tabla], grupo([gT, gE]), () => posar(gT, tabla));
      },
    },

    /* Péndulo: bola de madera colgada de una espiga con cordel rojo.
       El giro de la pieza es el ángulo desde el que se suelta. */
    pendulo: {
      nombre: "Pèndol", rotable: true, agujero: true, angulo0: 45 * G,
      crear(p, ctx) {
        // El ángulo al colocarlo es cuánto se aparta de la vertical: a 0° cuelga
        // quieto; apartado, oscila y se va frenando (roce del eje y del aire)
        // hasta pararse. Si algo lo golpea, se mueve según la fuerza del golpe.
        const L = 170, off = TK.rot(0, L, p.angulo || 0);
        // Sin espiga en el agujero del eje, todo el péndulo cae
        const libre = suelta(p, ctx);
        const ancla = cuerpo(ctx, libre ? "dinamico" : "fijo", p.x, p.y, 0);
        bola(ctx, ancla, 10, "madera", { sensor: !libre }); // asa para seleccionarlo
        const peso = cuerpo(ctx, "dinamico", p.x + off.x, p.y + off.y, 0, { ccd: true, amortiguar: 0.22, amortiguarGiro: 0.3 });
        bola(ctx, peso, 22, "madera", { ajustes: { d: 2 } });
        // Varilla rígida: articulación de giro en el eje (no una cuerda que se afloja)
        ctx.mundo.createImpulseJoint(R().JointData.revolute({ x: 0, y: 0 }, { x: -off.x * S, y: off.y * S }), ancla, peso, true)
          .setContactsEnabled(false);
        // Las de los retos llevan su espiga; las demás muestran el agujero del eje
        const gA = fijo(grupo([p.fija ? TK.espiga(0.45) : TK.cilindro(10, 0.08, M.maderaOscura, { z: Z + 0.02 }), p.fija ? null : TK.agujeros([[0, 0]], 4, Z + 0.07)]), p.x, p.y);
        const gP = grupo([TK.esfera(22, M.haya)]);
        const hilo = TK.cuerda();
        const i = instancia(p, ctx, [ancla, peso], grupo([gA, gP, hilo]), () => {
          posar(gP, peso);
          const t = peso.translation(), a = ancla.translation();
          if (libre) posar(gA, ancla);
          TK.tensar(hilo, a.x / S + TK.W / 2, -a.y / S + TK.H / 2, t.x / S + TK.W / 2, -t.y / S + TK.H / 2);
        });
        // Roce seco del eje: frena siempre lo mismo, así que al final se para del todo
        i.paso = () => {
          const v = peso.linvel(), m = Math.hypot(v.x, v.y);
          if (!m) return;
          const k = Math.max(0, m - 0.5 * ctx.mundo.timestep) / m;
          peso.setLinvel({ x: v.x * k, y: v.y * k }, true);
        };
        return i;
      },
    },

    /* Coche de madera con ruedas de goma. */
    coche: {
      nombre: "Cotxe", rotable: true,
      crear(p, ctx) {
        const grupos = TK.GRUPO_COCHE;
        const ch = cuerpo(ctx, "dinamico", p.x, p.y, p.angulo, { amortiguar: 0.02 });
        caja(ctx, ch, 104, 22, "madera", { grupos });
        caja(ctx, ch, 52, 18, "madera", { x: -8, y: -19, grupos });
        const ruedas = [-34, 34].map((dx) => {
          const w = TK.rot(dx, 16, p.angulo || 0);
          const r = cuerpo(ctx, "dinamico", p.x + w.x, p.y + w.y, 0, { amortiguar: 0.02, amortiguarGiro: 0.05 });
          bola(ctx, r, 15, "goma", { ajustes: { r: 0.1, d: 1 }, grupos });
          ctx.mundo.createImpulseJoint(R().JointData.revolute({ x: dx * S, y: -16 * S }, { x: 0, y: 0 }), ch, r, true).setContactsEnabled(false);
          return r;
        });
        const gCh = grupo([TK.caja(104, 22, M.maderaMedia, { r: 8 }), TK.caja(52, 18, M.madera, { x: -8, y: -19, r: 7 }),
          TK.caja(18, 10, M.gomaAmarilla, { x: -14, y: -19, prof: 0.42, r: 3 })]);
        const gR = ruedas.map(() => grupo([TK.cilindro(15, 0.24, M.neumatico, { z: Z + 0.1 }), TK.cilindro(7, 0.3, M.madera, { z: Z + 0.1 }),
          TK.caja(14, 3, M.ranura, { prof: 0.32, z: Z + 0.1, r: 1 })]));
        return instancia(p, ctx, [ch, ...ruedas], grupo([gCh, ...gR]), () => {
          posar(gCh, ch);
          ruedas.forEach((r, k) => posar(gR[k], r));
        });
      },
    },

    /* Caja de bloques: recoge objetos. */
    caja: {
      nombre: "Caixa", rotable: true,
      crear: (p, ctx) => piezaSimple(p, ctx, "montado", (rb) => {
        caja(ctx, rb, 110, 12, "madera", { y: 30 });
        caja(ctx, rb, 12, 72, "madera", { x: -49, y: -6 });
        caja(ctx, rb, 12, 72, "madera", { x: 49, y: -6 });
      }, [TK.caja(110, 12, M.maderaVieja, { y: 30 }), TK.caja(12, 72, M.maderaVieja, { x: -49, y: -6 }), TK.caja(12, 72, M.maderaVieja, { x: 49, y: -6 }),
        TK.agujeros(TK.FORATS.caja, 3.5)]),
    },

    /* Meta (objetivo): caja con banderín. Cuando una bola entra, reto superado. */
    meta: {
      nombre: "Meta", rotable: false,
      crear(p, ctx) {
        const estrella = new T.Shape();
        for (let k = 0; k < 10; k++) {
          const a = Math.PI / 2 + (k * Math.PI) / 5, rr = (k % 2 ? 0.07 : 0.16);
          k ? estrella.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : estrella.moveTo(rr * Math.cos(a), rr * Math.sin(a));
        }
        const i = piezaSimple(p, ctx, "fijo", (rb) => {
          caja(ctx, rb, 120, 12, "madera", { y: 30 });
          caja(ctx, rb, 12, 72, "madera", { x: -54, y: -6 });
          caja(ctx, rb, 12, 72, "madera", { x: 54, y: -6 });
          etiquetar(ctx, caja(ctx, rb, 90, 36, "madera", { y: 6, sensor: true }), "meta");
        }, [TK.caja(120, 12, M.maderaVieja, { y: 30 }), TK.caja(12, 72, M.maderaVieja, { x: -54, y: -6 }), TK.caja(12, 72, M.maderaVieja, { x: 54, y: -6 }),
          TK.espiga(0.3, { x: 54, y: -58 }), (() => { const m = TK.extruir(estrella, M.gomaAmarilla, { prof: 0.06, x: 54, y: -64, z: 0.33 }); return m; })(),
          (() => { const m = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.3, 8), M.maderaOscura); m.position.set(0.54, 0.5, 0.3); return m; })()],
        {}, { t0: -1 });
        i.sonar = () => (i.t0 = performance.now());
        return i;
      },
    },

    /* Campana (objetivo): cuelga de un bloque perforado sujeto con espiga. */
    campana: {
      nombre: "Campana", rotable: false,
      crear(p, ctx) {
        const perfil = [[0, 0], [0.06, 0], [0.08, -0.03], [0.13, -0.06], [0.17, -0.13], [0.19, -0.25], [0.22, -0.38], [0.28, -0.5], [0.32, -0.56], [0.31, -0.6], [0.26, -0.58]]
          .map(([r, y]) => new T.Vector2(r, y));
        const campana = new T.Mesh(new T.LatheGeometry(perfil, 40), M.laton);
        campana.castShadow = true;
        const badajo = new T.Mesh(new T.SphereGeometry(0.06, 16, 12), M.hierro);
        badajo.position.y = -0.55;
        const pivote = grupo([campana, badajo]);
        pivote.position.set(0, 32 * S, Z);
        const varilla = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 0.12, 8), M.hierro);
        varilla.position.set(0, 38 * S, Z);
        const i = piezaSimple(p, ctx, "fijo", (rb) => {
          etiquetar(ctx, bola(ctx, rb, 30, "metal", { ajustes: { r: 0.5 } }), "campana");
          caja(ctx, rb, 150, 24, "madera", { x: 70, y: -54 });
        }, [pivote, varilla, TK.caja(150, 24, M.maderaVieja, { x: 70, y: -54 }), TK.agujeros([[30, -54], [70, -54]], 4), TK.espiga(0.55, { x: 110, y: -54 })],
        {}, { t0: -1, clavos: [{ x: p.x + 130, y: p.y - 54 }] });
        i.sonar = () => (i.t0 = performance.now());
        const base = i.sync;
        i.sync = () => {
          base();
          if (i.t0 < 0) return;
          const t = (performance.now() - i.t0) / 1000;
          pivote.rotation.z = Math.sin(t * 14) * Math.exp(-t * 2.2) * 0.45;
        };
        return i;
      },
    },

    /* Salida: listón inclinado con una espiga de tope y una bola lista
       para rodar (p.bola: "corcho", "canica", "pelota" o "madera"). */
    salida: {
      nombre: "Sortida", rotable: false,
      crear(p, ctx) {
        const INC = 0.16, tipo = p.bola || "corcho", rB = BOLAS[tipo].r;
        const base = cuerpo(ctx, "fijo", p.x, p.y, 0);
        caja(ctx, base, 170, 14, "madera", { ang: INC });
        bola(ctx, base, 5, "madera", { x: -80, y: -22 });
        const bandera = new T.Shape();
        bandera.moveTo(0, 0); bandera.lineTo(0.3, -0.08); bandera.lineTo(0, -0.17); bandera.closePath();
        const gB = fijo(grupo([TK.caja(170, 14, M.madera, { ang: INC, r: 4 }), TK.espiga(0.45, { x: -80, y: -22 }),
          (() => { const m = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.5, 8), M.maderaOscura); m.position.set(-0.8, 0.47, 0.42); return m; })(),
          TK.extruir(bandera, M.gomaVerde, { x: -80, y: -72, prof: 0.05, z: 0.42 })]), p.x, p.y);
        const yb = -50 * Math.tan(INC) - 7 / Math.cos(INC) - rB - 1;
        const { rb, malla } = crearBola(ctx, tipo, p.x - 50, p.y + yb);
        return instancia(p, ctx, [base, rb], grupo([gB, malla]), () => posar(malla, rb), { clavos: [{ x: p.x + 40, y: p.y + 6 }] });
      },
    },

    /* Lanzador de muelle: canal de madera con un émbolo. Al pulsar Play
       dispara la bola (p.bola) en la dirección en que apunta. Es la salida
       de los retos de mesa, donde no hay cuesta abajo. */
    lanzador: {
      nombre: "Llançador", rotable: true,
      crear(p, ctx) {
        const tipo = p.bola || "canica", V = TK.LANZADOR.V;
        const base = cuerpo(ctx, montada(p, ctx), p.x, p.y, p.angulo);
        caja(ctx, base, 110, 8, "madera", { x: -20, y: -30 });
        caja(ctx, base, 110, 8, "madera", { x: -20, y: 30 });
        caja(ctx, base, 12, 68, "madera", { x: -80 });
        colgar(ctx, p, base);
        const gB = grupo([TK.caja(110, 8, M.maderaMedia, { x: -20, y: -30, r: 3 }), TK.caja(110, 8, M.maderaMedia, { x: -20, y: 30, r: 3 }),
          TK.caja(12, 68, M.maderaOscura, { x: -80, r: 3 }), TK.agujeros(TK.FORATS.lanzador, 3.5, Z + 0.22)]);
        // Émbolo: muelle + pomo rojo; avanza de golpe al disparar
        const embolo = new T.Group();
        const muelle = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 1, 12, 1, true), M.hierro);
        muelle.rotation.z = Math.PI / 2;
        const pomo = TK.cilindro(14, 0.08, M.gomaRoja, {});
        pomo.rotation.set(0, 0, Math.PI / 2);
        embolo.add(muelle, pomo);
        gB.add(embolo);
        const rB = BOLAS[tipo].r;
        const pos = TK.rot(-2, 0, p.angulo || 0); // la bola espera delante del émbolo
        const { rb, malla } = crearBola(ctx, tipo, p.x + pos.x, p.y + pos.y);
        const dir = TK.rot(1, 0, p.angulo || 0);
        rb.setLinvel({ x: dir.x * V, y: -dir.y * V }, true);
        let pasos = 0;
        const g = grupo([gB]);
        TK.pose(g, p.x, p.y, p.angulo || 0);
        const i = instancia(p, ctx, [base, rb], grupo([g, malla]), () => {
          posar(g, base);
          posar(malla, rb);
          const avance = Math.min(1, pasos / 5);
          const xp = (-6 - rB - 22 + avance * 22) * S; // cabeza del émbolo: tensado, y suelta al disparar
          pomo.position.set(xp - 0.06, 0, Z);
          muelle.position.set((xp + -74 * S) / 2, 0, Z);
          muelle.scale.y = Math.max(0.05, xp - -74 * S);
        });
        i.paso = () => { pasos++; };
        return i;
      },
    },
  };
  TK.LANZADOR = { V: 11 }; // velocidad de salida (unidades/s)

  /** Repositorio por categorías (como las secciones de la propuesta). */
  TK.CATEGORIAS = [
    // Títulos en js/textos/<idioma>.js -> categorias[id]
    { id: "boles", piezas: ["canica", "corcho", "pelota"] },
    { id: "espigues", piezas: ["espiga", "espigaLarga", "gomaPetita", "goma", "gomaGran", "pinza"] },
    { id: "rampes", piezas: ["liston", "canal", "bloque", "cuna"] },
    { id: "tubs", piezas: ["tubo", "codo", "corrugado", "cono"] },
    { id: "engranatges", piezas: ["engranaje50", "engranaje100", "engranaje150", "engranaje200", "manivela", "cadena", "polea"] },
    { id: "maquines", piezas: ["lanzador", "domino", "palanca", "pendulo", "coche", "caja"] },
    { id: "objectius", piezas: ["campana", "meta"], soloLibre: true },
  ];
  /** Piezas que necesitan gravedad: no salen en los retos de mesa. */
  TK.NO_MESA = ["polea", "pendulo", "palanca", "domino"];
})();
