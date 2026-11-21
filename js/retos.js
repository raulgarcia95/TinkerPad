/* =====================================================================
   retos.js — Los 30 retos de Tinker Pad (solo datos; los textos de cada
   idioma están en js/textos/<idioma>.js, bajo retos[id]).

   10 retos por dificultad; en cada una, 3 son de mesa (posiciones 3, 6 y 9),
   mezclados con los de panel. Fácil = una idea y pocas piezas; Medio =
   dos mecanismos; Difícil = cadenas largas, piezas prohibidas o contadas y
   mecanismos nuevos (tirachinas con gatillo, polea, engranajes distintos).

   En todos los retos se pueden usar muchas piezas: hay muchas maneras de
   resolverlos. La pista solo ilumina las piezas de la solución sencilla.
   Todos están comprobados en simulación: sin montar nada no se superan y
   con la `solucion` sí (TK.juego.probar); y ninguna pieza de la solución
   se cruza con otra (TK.juego.solapes).

   Cada reto tiene:
     id          identificador único (progreso guardado y textos)
     dificultat  "facil" | "mitja" | "dificil"
     icono       pieza cuya miniatura lo representa en la portada
     mesa        true = reto en una mesa vista desde arriba (sin gravedad
                 en el plano; la bola sale de un lanzador)
     ayuda       (opcional) clave de un aviso que sale al pulsar Play
     fijas       piezas clavadas: {tipo, x, y, angulo?, ...}
                 (px del panel 1360 x 800 = 170 x 100 cm, 1 px = 1,25 mm,
                 Y hacia abajo, ángulo en grados)
     piezas      (opcional) piezas ya puestas que SÍ se pueden mover;
                 con error: true se iluminan al pedir la pista
     solo / sin  (opcional) piezas permitidas / prohibidas
     limite      (opcional) como mucho n piezas añadidas
     distintos   (opcional) engranajes de tamaños distintos
     totes       (opcional) hay que tocar TODOS los objetivos
     pista       piezas que conviene añadir: {tipo: cantidad}
     solucion    una solución comprobada (también sale en la ficha docente):
                   {tipo, x, y, angulo}          pieza nueva
                   {goma: [x1, y1, x2, y2]}      goma entre dos puntos de enganche
                   {cadena: [x1, y1, x2, y2]}    cadena entre los engranajes de esos dos puntos
                   {gatillo: [gx, gy, ex, ey]}   pinza que muerde la goma por (gx, gy)
                                                 y se apoya en la espiga (ex, ey)
                   {desde: [x, y], x, y, angulo | quitar}  arreglar una pieza
     manivela    true si la solución necesita girar la manivela
     pregunta    { correcta: índice de la opción buena, pieza? }
     reinventar  variantes: [{ pieza, cambios }] con cambios:
                   bola, mover {tipo, x, y}, limite, distintos, sin, solo, libre

   Ideas tomadas de la presentación de Tinkering (STEAMcat), del Tinkering
   Studio del Exploratorium (Marble Machines, Chain Reaction) y de la
   propuesta de materiales del laboratorio de mecánica.
   ===================================================================== */
TK.DIFICULTATS = [
  { id: "facil", color: "#2f9a52", fons: "#dff2e4" },
  { id: "mitja", color: "#d9771c", fons: "#fde8cf" },
  { id: "dificil", color: "#c23a4e", fons: "#f9dde1" },
];

/* Campo de espigas al tresbolillo */
TK.campoEspigas = (x0, y0, filas, cols, dx, dy) => {
  const e = [];
  for (let f = 0; f < filas; f++)
    for (let k = 0; k < cols - (f % 2); k++) e.push({ tipo: "espiga", x: x0 + (f % 2) * (dx / 2) + k * dx, y: y0 + f * dy });
  return e;
};
/* ---------- Soluciones montadas con espigas ----------
   Como en el panel real, cada pieza de madera de una solución (y cada pieza
   ya puesta que se puede mover) va sujeta con espigas en sus agujeros
   (TK.FORATS, ver piezas.js). Las espigas no cuentan para el límite de piezas.
     ESP(x, y)                 espiga en el agujero (x, y) del panel
     EIX(tipo, x, y)           engranaje, manivela… sobre su espiga
     FIXA(tipo, x, y, ang)     pieza a 0° o 90° con espigas en todos sus agujeros
     RAMPA(tipo, x, y, ang, o) pieza "como" (x, y, ang) colgada de una espiga en
                               el agujero de su punta más alta y apoyada en otra
                               espiga por debajo. Su ángulo es aquel en que toca
                               esa espiga: así no se mueve al pulsar Play. En la
                               mesa (o.doble) lleva otra espiga por la otra cara.
                               o.forat: agujero donde cuelga; o.lado: -1 = apoyo por encima. */
const ESP = (x, y) => ({ tipo: "espiga", x, y });
const EIX = (tipo, x, y, extra) => [ESP(x, y), { tipo, x, y, ...extra }];
const FIXA = (tipo, x, y, ang = 0) => {
  const a = (ang * Math.PI) / 180, fs = TK.FORATS[tipo];
  return [{ tipo, x, y, angulo: ang }, ...[fs[0], fs[fs.length - 1]].map(([fx, fy]) => { const v = TK.rot(fx, fy, a); return ESP(Math.round(x + v.x), Math.round(y + v.y)); })];
};
/**
 * Tubo de PVC (recto) como rampa, apoyado sobre dos espigas que tocan su pared
 * de abajo (si se quiere que no se mueva nada, se puede atar con una goma).
 * La pieza se desplaza un poco en perpendicular para tocar la espiga más cercana.
 */
function TUB(x, y, ang, l1 = -60, l2 = 60) {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const aPanel = (lx, ly) => [x + lx * c - ly * s, y + lx * s + ly * c];
  const rejilla = ([px, py]) => [TK.agujero(px), TK.agujero(py)];
  const dist = (P) => -(P[0] - x) * s + (P[1] - y) * c; // distancia al eje del tubo (hacia abajo)
  // Bajo cada punta, la espiga más cercana a la pared (a 36 px del eje, más el radio 5 de la espiga)
  const apoyo = (l0) => {
    let Q = null;
    for (let lx = l0 - 20; lx <= l0 + 20; lx += 5) for (let ly = 38; ly <= 62; ly += 4) {
      const P = rejilla(aPanel(lx, ly));
      if (dist(P) >= 41 - 0.01 && (!Q || dist(P) < dist(Q))) Q = P;
    }
    return Q;
  };
  const Q1 = apoyo(l1), Q2 = apoyo(l2), d = Math.min(dist(Q1), dist(Q2));
  const tubo = { tipo: "tubo", x: Math.round((x - s * (d - 41)) * 100) / 100, y: Math.round((y + c * (d - 41)) * 100) / 100, angulo: ang };
  return [tubo, ESP(...Q1), ESP(...Q2)];
}
const GRUIX = { liston: 12, canal: 10, bloque: 25 }; // medio grosor + radio de la espiga (px)
const MITJA = { liston: 120, canal: 120, bloque: 80 }; // medio largo (px)
function RAMPA(tipo, x, y, ang, o = {}) {
  const fs = TK.FORATS[tipo], a = (ang * Math.PI) / 180, D = 180 / Math.PI;
  const mundo = ([fx, fy]) => { const v = TK.rot(fx, fy, a); return [x + v.x, y + v.y]; };
  const extremos = [0, fs.length - 1];
  // En el panel cuelga del agujero de la punta más alta; en la mesa, del que menos se desplaza al encajar
  const desvio = (j) => { const [hx, hy] = mundo(fs[j]); return Math.hypot(TK.agujero(hx) - hx, TK.agujero(hy) - hy); };
  const k = o.forat ?? (o.doble ? extremos.reduce((m, j) => (desvio(j) < desvio(m) ? j : m), extremos[0])
    : extremos.reduce((m, j) => (mundo(fs[j])[1] < mundo(fs[m])[1] ? j : m), extremos[0]));
  const h = mundo(fs[k]), P = [TK.agujero(h[0]), TK.agujero(h[1])];
  const haciaX = fs[k][0] < 0 ? 1 : -1, r = GRUIX[tipo], L = MITJA[tipo];
  // Ángulo en que la pieza (agujero k en P) toca Q a distancia r de su línea central
  const tangente = (Q, lado) => {
    const dx = Q[0] - P[0], dy = Q[1] - P[1], R = Math.hypot(dx, dy);
    if (R <= r) return null;
    const fi = Math.atan2(dx, dy), c = Math.acos((r * lado) / R);
    const norm = (t) => Math.atan2(Math.sin(t), Math.cos(t));
    return [norm(c - fi), norm(-c - fi)].map((t) => t * D).sort((p, q) => Math.abs(p - ang) - Math.abs(q - ang))[0];
  };
  const local = (Q, th) => { const t = (th * Math.PI) / 180; return fs[k][0] + (Q[0] - P[0]) * Math.cos(t) + (Q[1] - P[1]) * Math.sin(t); };
  // Espiga de la rejilla a una distancia de la línea central entre d0 y d1 (con signo), lejos del agujero k
  const tope = (th, d0, d1) => {
    const t = (th * Math.PI) / 180;
    let m = null;
    for (let gx = P[0] - 280; gx <= P[0] + 280; gx += 20) for (let gy = P[1] - 280; gy <= P[1] + 280; gy += 20) {
      const dd = -(gx - P[0]) * Math.sin(t) + (gy - P[1]) * Math.cos(t), lx = local([gx, gy], th);
      if (dd < d0 - 0.01 || dd > d1 + 0.01 || haciaX * (lx - fs[k][0]) < 50 || Math.abs(lx) > L - 8) continue;
      if (!m || Math.abs(lx) > Math.abs(m.lx) + 1 || (Math.abs(lx) > Math.abs(m.lx) - 1 && Math.abs(dd) < Math.abs(m.dd))) m = { Q: [gx, gy], lx, dd };
    }
    return m;
  };
  let th, Q, Q2 = null;
  if (o.doble) {
    // Mesa: el ángulo exacto, con una espiga por cada cara casi tocando (holgura ≤ 5 px):
    // el golpe de la bola no la puede girar
    th = ang;
    Q = tope(th, r, r + 5);
    Q2 = tope(th, -r - 5, -r);
    Q = Q && Q.Q; Q2 = Q2 && Q2.Q;
  } else {
    let millor = null;
    for (let gx = P[0] - 280; gx <= P[0] + 280; gx += 20) for (let gy = P[1] - 280; gy <= P[1] + 280; gy += 20) {
      const t1 = tangente([gx, gy], o.lado || 1);
      if (t1 === null) continue;
      const lx = local([gx, gy], t1);
      if (haciaX * (lx - fs[k][0]) < 70 || Math.abs(lx) > L - 8) continue;
      const err = Math.abs(t1 - ang);
      if (!millor || err < millor.err - 0.4 || (err < millor.err + 0.4 && Math.abs(lx) > Math.abs(millor.lx))) millor = { th: t1, Q: [gx, gy], err, lx };
    }
    th = Math.round(millor.th * 100) / 100;
    Q = millor.Q;
  }
  const v = TK.rot(fs[k][0], fs[k][1], (th * Math.PI) / 180);
  const out = [ESP(...P), { tipo, x: Math.round((P[0] - v.x) * 100) / 100, y: Math.round((P[1] - v.y) * 100) / 100, angulo: th }];
  if (Q) out.push(ESP(...Q));
  if (Q2) out.push(ESP(...Q2));
  return out;
}
const SALIDA = (bola) => ({ tipo: "salida", x: 130, y: 150, bola });
const BOLA = (b) => ({ pieza: b === "madera" ? "canica" : b, cambios: { bola: b } });
const SIN_BOLAS = ["canica", "corcho", "pelota"];

// Reto "arregla": el listón girado al revés (con sus espigas) y el bloque que corta el camino
const ARREGLA_MAL = RAMPA("liston", 330, 250, -15);
const ARREGLA_BLOC = FIXA("bloque", 930, 530, 90);
const treu = (q) => ({ desde: [q.x, q.y], tipo: q.tipo, quitar: true });
const ERR = (q) => ({ ...q, error: true });

TK.RETOS = [
  /* ======================= FÀCIL =======================
     Tablero pequeño de piezas grandes (TK.PETIT: 840 x 500 px = 105 x 62,5 cm),
     más cómodo con el dedo para los más pequeños. */
  { id: "campana", dificultat: "facil", icono: "campana",
    fijas: [SALIDA("corcho"), { tipo: "campana", x: 660, y: 420 }],
    pista: { liston: 2, espiga: 4 }, solucion: [...RAMPA("liston", 330, 250, 15), ...RAMPA("liston", 480, 340, 15)], pregunta: { correcta: 0 },
    reinventar: [BOLA("canica"), { pieza: "campana", cambios: { mover: { tipo: "campana", x: 690, y: 440 } } }, { pieza: "liston", cambios: { limite: 1 } }] },
  { id: "espigas", dificultat: "facil", icono: "espiga",
    fijas: [{ tipo: "salida", x: 300, y: 70, bola: "canica" }, ...TK.campoEspigas(390, 190, 4, 6, 60, 50), { tipo: "meta", x: 110, y: 464 }],
    pista: { liston: 1, espiga: 2 }, solucion: RAMPA("liston", 270, 370, -15),
    pregunta: { correcta: 0 },
    reinventar: [BOLA("pelota"), { pieza: "meta", cambios: { mover: { tipo: "meta", x: 730, y: 464 } } }, { pieza: "liston", cambios: { limite: 1 } }] },
  { id: "paret", dificultat: "facil", icono: "lanzador", mesa: true,
    fijas: [{ tipo: "lanzador", x: 120, y: 110, bola: "canica" }, { tipo: "meta", x: 560, y: 400 }],
    pista: { bloque: 1, espiga: 3 }, solucion: RAMPA("bloque", 560, 110, 45, { doble: true }), pregunta: { correcta: 0, pieza: "bloque" },
    reinventar: [BOLA("pelota"), { pieza: "meta", cambios: { mover: { tipo: "meta", x: 330, y: 400 } } }] },
  { id: "rampa", dificultat: "facil", icono: "canal", solo: ["canal", "cuna", "espiga", "espigaLarga"],
    fijas: [SALIDA("canica"), { tipo: "bloque", x: 470, y: 420, angulo: 90 }, { tipo: "meta", x: 640, y: 464 }],
    pista: { canal: 2, espiga: 4 }, solucion: [...RAMPA("canal", 300, 240, 15), ...RAMPA("canal", 400, 300, -10)], pregunta: { correcta: 0 },
    reinventar: [BOLA("corcho"), { pieza: "canal", cambios: { limite: 1 } }] },
  { id: "manovella", dificultat: "facil", icono: "manivela", ayuda: "ayudaManivela", manivela: true,
    fijas: [{ tipo: "manivela", x: 190, y: 250 }, { tipo: "campana", x: 410, y: 250 }],
    pista: { engranaje200: 1, espiga: 1 }, solucion: EIX("engranaje200", 310, 250), pregunta: { correcta: 0, pieza: "engranaje50" },
    reinventar: [{ pieza: "engranaje150", cambios: { distintos: true } }, { pieza: "campana", cambios: { mover: { tipo: "campana", x: 570, y: 250 } } }] },
  { id: "campanaTaula", dificultat: "facil", icono: "campana", mesa: true,
    fijas: [{ tipo: "lanzador", x: 120, y: 400, bola: "canica" }, { tipo: "campana", x: 420, y: 140 }],
    pista: { bloque: 1, espiga: 3 }, solucion: RAMPA("bloque", 450, 400, -45, { doble: true }), pregunta: { correcta: 0, pieza: "canica" },
    reinventar: [BOLA("corcho"), BOLA("pelota")] },
  { id: "pendol", dificultat: "facil", icono: "pendulo",
    fijas: [SALIDA("canica"), { tipo: "pendulo", x: 530, y: 90, angulo: 0 }, { tipo: "campana", x: 620, y: 260 }],
    pista: { liston: 1, espiga: 2 }, solucion: RAMPA("liston", 330, 220, 15), pregunta: { correcta: 0, pieza: "pendulo" },
    reinventar: [BOLA("corcho"), { pieza: "campana", cambios: { mover: { tipo: "campana", x: 650, y: 260 } } }] },
  { id: "domino", dificultat: "facil", icono: "domino",
    fijas: [SALIDA("madera"), { tipo: "liston", x: 540, y: 440, angulo: 0 }, ...[0, 1, 2, 3, 4].map((k) => ({ tipo: "domino", x: 492 + k * 28, y: 395 })), { tipo: "campana", x: 670, y: 355 }],
    pista: { liston: 1, espiga: 2 }, solucion: RAMPA("liston", 330, 350, 10), pregunta: { correcta: 0, pieza: "domino" },
    reinventar: [BOLA("canica"), { pieza: "pendulo", cambios: { solo: ["pendulo", "espiga", "espigaLarga", "bloque", "cuna"] } }, { pieza: "liston", cambios: { limite: 1 } }] },
  { id: "duesParets", dificultat: "facil", icono: "bloque", mesa: true,
    fijas: [{ tipo: "lanzador", x: 120, y: 90, bola: "canica" }, { tipo: "campana", x: 440, y: 400 }],
    pista: { bloque: 2, espiga: 6 }, solucion: [...RAMPA("bloque", 680, 90, 45, { doble: true }), ...RAMPA("bloque", 680, 400, -45, { doble: true })],
    pregunta: { correcta: 0 },
    reinventar: [BOLA("pelota"), { pieza: "campana", cambios: { mover: { tipo: "campana", x: 300, y: 400 } } }] },
  { id: "pinça", dificultat: "facil", icono: "pinza",
    fijas: [SALIDA("canica"), { tipo: "espiga", x: 330, y: 270 }, { tipo: "campana", x: 140, y: 440 }],
    pista: { pinza: 1 }, solucion: [{ tipo: "pinza", x: 330, y: 270, angulo: 150 }], pregunta: { correcta: 0, pieza: "pinza" },
    reinventar: [BOLA("pelota"), BOLA("corcho")] },
  /* ======================= MITJÀ ======================= */
  { id: "saltadora", dificultat: "mitja", icono: "goma",
    fijas: [SALIDA("canica"), { tipo: "bloque", x: 560, y: 720, angulo: 90 }, { tipo: "meta", x: 820, y: 764 }],
    pista: { espiga: 2, goma: 1 }, solucion: [{ tipo: "espiga", x: 370, y: 630 }, { tipo: "espiga", x: 530, y: 730 }, { goma: [370, 630, 530, 730] }],
    pregunta: { correcta: 0, pieza: "goma" },
    reinventar: [BOLA("corcho"), { pieza: "goma", cambios: { solo: ["espiga", "espigaLarga", "goma"] } }] },
  { id: "tubo", dificultat: "mitja", icono: "corrugado",
    fijas: [SALIDA("canica"), { tipo: "bloque", x: 110, y: 470 }, { tipo: "bloque", x: 270, y: 470 }, { tipo: "meta", x: 140, y: 764 }],
    pista: { liston: 2, corrugado: 1, espiga: 8, goma: 2 },
    // El tubo en U, atado con dos gomas que lo cruzan por la curva
    solucion: [...RAMPA("liston", 330, 250, 15), { tipo: "corrugado", x: 520, y: 320, angulo: 180 },
      ESP(470, 310), ESP(590, 310), ESP(470, 330), ESP(590, 330), { goma: [470, 310, 590, 310] }, { goma: [470, 330, 590, 330] },
      ...RAMPA("liston", 380, 600, -30)],
    pregunta: { correcta: 0, pieza: "corrugado" },
    reinventar: [BOLA("corcho"), { pieza: "codo", cambios: { sin: ["corrugado"] } }, { pieza: "liston", cambios: { limite: 2 } }] },
  { id: "billar", dificultat: "mitja", icono: "pelota", mesa: true,
    fijas: [{ tipo: "lanzador", x: 160, y: 300, bola: "canica" }, { tipo: "pelota", x: 600, y: 300 }, { tipo: "meta", x: 910, y: 640 }],
    pista: { bloque: 1, espiga: 3 }, solucion: RAMPA("bloque", 1000, 300, 45, { doble: true }), pregunta: { correcta: 0 },
    reinventar: [BOLA("pelota"), { pieza: "bloque", cambios: { limite: 1 } }] },
  { id: "bicicleta", dificultat: "mitja", icono: "cadena", ayuda: "ayudaManivela", manivela: true,
    fijas: [{ tipo: "manivela", x: 470, y: 410 }, { tipo: "bloque", x: 650, y: 410, angulo: 90 }, { tipo: "campana", x: 1000, y: 410 }],
    pista: { engranaje200: 1, cadena: 1, espiga: 1 }, solucion: [...EIX("engranaje200", 910, 410), { cadena: [470, 410, 910, 410] }],
    pregunta: { correcta: 0, pieza: "cadena" },
    reinventar: [{ pieza: "engranaje150", cambios: { sin: ["engranaje200"] } }, { pieza: "campana", cambios: { mover: { tipo: "campana", x: 1000, y: 250 } } }] },
  { id: "arregla", dificultat: "mitja", icono: "bloque",
    fijas: [SALIDA("corcho"), { tipo: "campana", x: 1050, y: 560 }],
    // Ya montada (con sus espigas): un listón está girado al revés y un bloque corta el camino
    piezas: [ARREGLA_MAL[0], ERR(ARREGLA_MAL[1]), ARREGLA_MAL[2], ...RAMPA("liston", 560, 330, 15), ...RAMPA("liston", 760, 440, 15),
      ERR(ARREGLA_BLOC[0]), ARREGLA_BLOC[1], ARREGLA_BLOC[2]],
    pista: {}, solucion: [treu(ARREGLA_MAL[1]), treu(ARREGLA_MAL[0]), treu(ARREGLA_MAL[2]), ...RAMPA("liston", 330, 250, 15),
      treu(ARREGLA_BLOC[0]), treu(ARREGLA_BLOC[1]), treu(ARREGLA_BLOC[2])], pregunta: { correcta: 1 },
    reinventar: [{ pieza: "bloque", cambios: { libre: true } }, BOLA("canica")] },
  { id: "gomesTaula", dificultat: "mitja", icono: "goma", mesa: true, solo: ["espiga", "espigaLarga", "goma"],
    fijas: [{ tipo: "lanzador", x: 160, y: 150, bola: "canica" }, { tipo: "meta", x: 1150, y: 660 }],
    pista: { espiga: 2, goma: 1 }, solucion: [{ tipo: "espiga", x: 1070, y: 90 }, { tipo: "espiga", x: 1190, y: 210 }, { goma: [1070, 90, 1190, 210] }],
    pregunta: { correcta: 0, pieza: "goma" }, reinventar: [BOLA("pelota"), BOLA("corcho")] },
  { id: "embut", dificultat: "mitja", icono: "cono",
    fijas: [{ tipo: "salida", x: 130, y: 150, bola: "canica" }, ...TK.campoEspigas(210, 300, 3, 4, 60, 50), { tipo: "tubo", x: 420, y: 650, angulo: 90 }, { tipo: "meta", x: 420, y: 764 }],
    // El cono, atado con dos gomas que lo cruzan entre espigas a cada lado
    pista: { cono: 1, espiga: 4, goma: 2 },
    solucion: [{ tipo: "cono", x: 420, y: 500 }, ESP(350, 480), ESP(490, 480), ESP(370, 520), ESP(470, 520), { goma: [350, 480, 490, 480] }, { goma: [370, 520, 470, 520] }],
    pregunta: { correcta: 0, pieza: "cono" },
    reinventar: [BOLA("pelota"), BOLA("corcho")] },
  { id: "catapulta", dificultat: "mitja", icono: "palanca",
    fijas: [SALIDA("madera"), { tipo: "palanca", x: 1010, y: 560, angulo: 0 }, { tipo: "bloque", x: 1130, y: 587, angulo: 0 }, { tipo: "corcho", x: 1125, y: 532 },
      { tipo: "campana", x: 1060, y: 410 }],
    pista: { liston: 2, espiga: 4 }, solucion: [...RAMPA("liston", 330, 250, 15), ...RAMPA("liston", 560, 330, 15)], pregunta: { correcta: 0, pieza: "corcho" }, reinventar: [BOLA("canica")] },
  { id: "engranatgesTaula", dificultat: "mitja", icono: "engranaje200", mesa: true, ayuda: "ayudaManivela", manivela: true,
    fijas: [{ tipo: "manivela", x: 310, y: 610 }, { tipo: "campana", x: 310, y: 240 }],
    pista: { engranaje200: 2, espiga: 2 }, solucion: [...EIX("engranaje200", 310, 490), ...EIX("engranaje200", 310, 330)],
    pregunta: { correcta: 0 }, reinventar: [{ pieza: "engranaje150", cambios: { distintos: true } }, { pieza: "manivela", cambios: { libre: true } }] },
  { id: "caminPinces", dificultat: "mitja", icono: "pinza", solo: ["pinza", "espiga", "espigaLarga"],
    fijas: [SALIDA("canica"), { tipo: "espiga", x: 290, y: 310 }, { tipo: "espiga", x: 510, y: 470 }, { tipo: "meta", x: 820, y: 764 }],
    pista: { pinza: 2 }, solucion: [{ tipo: "pinza", x: 290, y: 310, angulo: 30 }, { tipo: "pinza", x: 510, y: 470, angulo: 30 }],
    pregunta: { correcta: 0, pieza: "pinza" }, reinventar: [BOLA("corcho"), BOLA("pelota")] },

  /* ======================= DIFÍCIL ======================= */
  { id: "gatillo", dificultat: "dificil", icono: "pinza", sin: SIN_BOLAS,
    fijas: [SALIDA("canica"), { tipo: "espiga", x: 830, y: 450 }, { tipo: "espiga", x: 990, y: 450 }, { tipo: "espiga", x: 890, y: 550 }, { tipo: "espiga", x: 930, y: 550 },
      { tipo: "pelota", x: 910, y: 531 }, { tipo: "campana", x: 910, y: 90 }],
    pista: { goma: 1, pinza: 1, espiga: 5, liston: 2 },
    solucion: [{ goma: [830, 450, 990, 450] }, { tipo: "espiga", x: 910, y: 610 }, { gatillo: [910, 450, 910, 610], angulo: 180 }, ...RAMPA("liston", 330, 250, 15), ...RAMPA("liston", 530, 360, 15)],
    pregunta: { correcta: 0, pieza: "pinza" }, reinventar: [{ pieza: "goma", cambios: { limite: 4 } }] },
  { id: "polea", dificultat: "dificil", icono: "polea", sin: ["liston", "canal", "bloque", "cuna"],
    fijas: [SALIDA("madera"), { tipo: "polea", x: 890, y: 260, contrapeso: 330 }, { tipo: "bloque", x: 890, y: 420, angulo: 90 }, { tipo: "campana", x: 1010, y: 338 }],
    pista: { tubo: 2, espiga: 4 }, solucion: [...TUB(330, 250, 15), ...TUB(570, 310, 10)],
    pregunta: { correcta: 0, pieza: "corcho" },
    reinventar: [BOLA("corcho"), BOLA("canica"), { pieza: "tubo", cambios: { limite: 1 } }] },
  { id: "billarDues", dificultat: "dificil", icono: "canica", mesa: true, limite: 2,
    fijas: [{ tipo: "lanzador", x: 160, y: 700, angulo: -90, bola: "canica" }, { tipo: "canica", x: 700, y: 300 }, { tipo: "meta", x: 970, y: 470 }],
    pista: { bloque: 2, espiga: 6 }, solucion: [...RAMPA("bloque", 160, 300, -45, { doble: true }), ...RAMPA("bloque", 1000, 300, 45, { doble: true })],
    pregunta: { correcta: 0 }, reinventar: [BOLA("pelota")] },
  { id: "transmissio", dificultat: "dificil", icono: "cadena", ayuda: "ayudaManivela", manivela: true, distintos: true, limite: 5,
    fijas: [{ tipo: "manivela", x: 310, y: 650 }, { tipo: "bloque", x: 470, y: 570, angulo: 90 }, { tipo: "bloque", x: 820, y: 420, angulo: 0 }, { tipo: "campana", x: 1060, y: 230 }],
    pista: { cadena: 2, engranaje150: 1, engranaje200: 2, espiga: 3 },
    solucion: [...EIX("engranaje150", 630, 650), ...EIX("engranaje200", 630, 510), ...EIX("engranaje200", 970, 230),
      { cadena: [310, 650, 630, 650] }, { cadena: [630, 510, 970, 230] }],
    pregunta: { correcta: 0, pieza: "cadena" },
    reinventar: [{ pieza: "cadena", cambios: { limite: 4 } }, { pieza: "manivela", cambios: { libre: true } }] },
  { id: "arregla2", dificultat: "dificil", icono: "engranaje150", ayuda: "ayudaManivela", manivela: true,
    fijas: [{ tipo: "manivela", x: 310, y: 410 }, { tipo: "campana", x: 1000, y: 410 }],
    // Ya montados sobre sus espigas: uno está mal colocado y otro es demasiado pequeño
    piezas: [...EIX("engranaje200", 430, 410), ...EIX("engranaje200", 590, 410), ESP(770, 430), { tipo: "engranaje200", x: 770, y: 430, error: true },
      ESP(910, 410), { tipo: "engranaje150", x: 910, y: 410, error: true }],
    pista: {}, solucion: [{ desde: [770, 430], tipo: "engranaje200", x: 750, y: 410 }, treu(ESP(770, 430)), ESP(750, 410),
      { desde: [910, 410], tipo: "engranaje150", quitar: true }, { tipo: "engranaje200", x: 910, y: 410 }],
    pregunta: { correcta: 1 }, reinventar: [{ pieza: "engranaje100", cambios: { libre: true } }] },
  { id: "laberint", dificultat: "dificil", icono: "cuna", mesa: true, limite: 3,
    fijas: [{ tipo: "lanzador", x: 160, y: 150, bola: "canica" }, { tipo: "bloque", x: 500, y: 290, angulo: 0 }, { tipo: "bloque", x: 760, y: 640, angulo: 0 },
      { tipo: "bloque", x: 200, y: 560, angulo: 90 }, { tipo: "bloque", x: 620, y: 510, angulo: 90 }, { tipo: "meta", x: 400, y: 640 }],
    pista: { bloque: 3, espiga: 9 }, solucion: [...RAMPA("bloque", 820, 150, 45, { doble: true }), ...RAMPA("bloque", 820, 360, -45, { doble: true }), ...RAMPA("bloque", 410, 410, -45, { doble: true })],
    pregunta: { correcta: 0 }, reinventar: [BOLA("pelota")] },
  { id: "cotxe", dificultat: "dificil", icono: "coche", sin: ["liston", "canal"],
    fijas: [SALIDA("canica"), { tipo: "liston", x: 800, y: 420, angulo: 0 }, { tipo: "coche", x: 790, y: 382 }, { tipo: "campana", x: 1040, y: 730 }],
    pista: { tubo: 2, espiga: 4 }, solucion: [...TUB(330, 250, 15), ...TUB(560, 350, 25)],
    pregunta: { correcta: 0, pieza: "corcho" }, reinventar: [BOLA("corcho"), BOLA("madera")] },
  { id: "pendolDomino", dificultat: "dificil", icono: "pendulo", sin: ["canal", "tubo", "bloque", "cuna"], limite: 2,
    fijas: [SALIDA("canica"), { tipo: "pendulo", x: 750, y: 170, angulo: 0 }, { tipo: "liston", x: 940, y: 420, angulo: 0 },
      ...[0, 1, 2, 3, 4].map((k) => ({ tipo: "domino", x: 820 + k * 46, y: 375 })), { tipo: "campana", x: 1070, y: 380 }],
    pista: { liston: 2, espiga: 4 }, solucion: [...RAMPA("liston", 330, 250, 15), ...RAMPA("liston", 585, 335, 15)],
    pregunta: { correcta: 0, pieza: "domino" }, reinventar: [BOLA("corcho"), BOLA("madera")] },
  { id: "taulaGatillo", dificultat: "dificil", icono: "goma", mesa: true, sin: SIN_BOLAS, limite: 3,
    fijas: [{ tipo: "lanzador", x: 160, y: 650, bola: "canica" }, { tipo: "espiga", x: 710, y: 210 }, { tipo: "espiga", x: 710, y: 370 }, { tipo: "espiga", x: 610, y: 290 },
      { tipo: "pelota", x: 650, y: 290 }, { tipo: "campana", x: 1180, y: 290 }],
    pista: { goma: 1, pinza: 1, bloque: 1, espiga: 3 },
    solucion: [{ goma: [710, 210, 710, 370] }, { gatillo: [710, 290, 610, 290] }, ...RAMPA("bloque", 610, 650, -45, { doble: true })],
    pregunta: { correcta: 0, pieza: "goma" }, reinventar: [{ pieza: "bloque", cambios: { limite: 2 } }] },
  { id: "granMaquina", dificultat: "dificil", icono: "manivela", totes: true, ayuda: "ayudaManivela", manivela: true, limite: 6,
    fijas: [SALIDA("corcho"), { tipo: "campana", x: 1050, y: 560 }, { tipo: "manivela", x: 310, y: 650 }, { tipo: "campana", x: 690, y: 650 }, { tipo: "caja", x: 1200, y: 750 }],
    pista: { liston: 3, engranaje200: 2, espiga: 8 },
    solucion: [...RAMPA("liston", 330, 250, 15), ...RAMPA("liston", 560, 330, 15), ...RAMPA("liston", 760, 440, 15), ...EIX("engranaje200", 430, 650), ...EIX("engranaje200", 590, 650)],
    pregunta: { correcta: 0 }, reinventar: [BOLA("canica")] },
];

/* Número dentro de su dificultad y título ("Fàcil 3 · Panell") */
TK.numerarRetos = () => {
  const n = {};
  TK.RETOS.forEach((r) => { n[r.dificultat] = (n[r.dificultat] || 0) + 1; r.num = n[r.dificultat]; });
};
TK.tituloReto = (r) => `${TK.nomDificultat(r.dificultat)} ${r.num} · ${TK.t(r.mesa ? "taula" : "panell")}`;
TK.numerarRetos();
