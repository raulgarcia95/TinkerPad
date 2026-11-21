/* =====================================================================
   fitxa.js — Fichas en papel (PDF) para hacer los retos en el panel real,
   rúbricas de evaluación y visor de PDF.

   FICHAS (2 páginas A4 por reto, adaptadas a la edad):
     Fácil (6-8 años)   poco texto y muy visual: material en dibujos, cuatro
                        pasos con iconos, "dibuja qué pasará", caras para
                        decir cómo ha ido y la pregunta del reto.
     Medio (8-10 años)  montaje con medidas, material, pasos, predicción
                        escrita y reflexión para marcar.
     Difícil (10-12)    además: planificar dividiendo el problema en partes,
                        hipótesis con "porque", registro de pruebas (qué
                        cambio, qué pasa, por qué), cadena de energía y
                        justificar la respuesta.
     Abajo de la página 2, la parte del docente: concepto y una solución.

   RÚBRICAS (un PDF por dificultad, 10 retos): portada con los saberes y
   competencias del currículo de primaria y, para cada reto, una tabla de
   5 criterios x 4 niveles (pensamiento computacional, ciencia y trabajo).

   Usa jsPDF (cdnjs). Para descargar usa la capacidad "downloads" de la
   página publicada (el usuario confirma el guardado); fuera de ella, la
   descarga normal del navegador. El visor dibuja el PDF con PDF.js.
   ===================================================================== */
(function () {
  const A4 = { w: 210, h: 297 }, M = 14;          // mm
  const CM = 0.125;                                // 1 px del panel = 0,125 cm
  const COLOR = {
    tinta: [63, 44, 29], suau: [122, 100, 80], fusta: [224, 183, 122], fustaFosca: [154, 106, 53], fons: [251, 245, 234],
    forat: [205, 180, 140], verd: [47, 154, 82], taronja: [217, 119, 28], vermell: [194, 58, 78], blau: [47, 127, 216],
    pvc: [170, 210, 230], suro: [196, 150, 98], goma: [226, 72, 61], negre: [40, 40, 40], metall: [140, 145, 152], sol: [255, 207, 63],
    docent: [58, 74, 122],
  };
  const colorDif = { facil: COLOR.verd, mitja: COLOR.taronja, dificil: COLOR.vermell };
  const clar = (c, k = 0.82) => c.map((v) => Math.round(v + (255 - v) * k));
  const cm = (v) => (Math.round(v * CM * 10) / 10).toString().replace(".", TK.idioma === "en" ? "." : ",");

  /** Logotipo de la portada convertido a PNG (una vez). */
  let logoPNG = null;
  async function logo() {
    if (logoPNG) return logoPNG;
    const svg = TK.Portada.logo().replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; });
    const c = document.createElement("canvas");
    c.width = 770; c.height = 186;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return (logoPNG = c.toDataURL("image/png"));
  }

  /** Fondo del tablero (agujeros cada 2,5 cm) como PNG, una vez. */
  const tablerPNG = {};
  function imatgeTauler(mida) {
    if (tablerPNG[mida.W]) return tablerPNG[mida.W];
    const k = 2, c = document.createElement("canvas");
    c.width = mida.W * k / 2; c.height = mida.H * k / 2;
    const g = c.getContext("2d");
    g.fillStyle = "#faecd2"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#cdb48c";
    for (let x = 10; x < mida.W; x += 20) for (let y = 10; y < mida.H; y += 20) {
      g.beginPath(); g.arc(x * k / 2, y * k / 2, 1.6, 0, Math.PI * 2); g.fill();
    }
    return (tablerPNG[mida.W] = c.toDataURL("image/png"));
  }

  /* ---------- Dibujo de piezas a escala ---------- */
  function dibuixant(doc, bx, by, ample, mida = { W: TK.W0, H: TK.H0 }) {
    // mida: tablero del reto (los Fáciles van en el pequeño, TK.PETIT)
    const s = ample / mida.W; // mm por px
    const P = (x, y) => [bx + x * s, by + y * s];
    const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    const fill = (c) => doc.setFillColor(...c), stroke = (c) => doc.setDrawColor(...c);
    function poli(punts, estil = "FD") {
      const [x0, y0] = punts[0];
      const d = punts.slice(1).map((p, k) => [p[0] - punts[k][0], p[1] - punts[k][1]]);
      doc.lines(d, x0, y0, [1, 1], estil, true);
    }
    /** Rectángulo w x h px girado `a` (rad) alrededor de (x, y), desplazado (ox, oy) en local. */
    function rect(x, y, w, h, a, ox = 0, oy = 0, c = COLOR.fusta) {
      fill(c); stroke(COLOR.fustaFosca); doc.setLineWidth(0.2);
      poli([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => {
        const [rx, ry] = rot(u + ox, v + oy, a);
        return P(x + rx, y + ry);
      }));
    }
    function cercle(x, y, r, c, vora = COLOR.fustaFosca) {
      fill(c); stroke(vora); doc.setLineWidth(0.2);
      const [px, py] = P(x, y);
      doc.circle(px, py, Math.max(r * s, 0.5), "FD");
    }
    function linia(x1, y1, x2, y2, c = COLOR.negre, g = 0.4) {
      stroke(c); doc.setLineWidth(g);
      doc.line(...P(x1, y1), ...P(x2, y2));
    }
    const BOLES = { canica: [11, COLOR.blau], corcho: [20, COLOR.suro], pelota: [22, COLOR.goma], madera: [18, COLOR.fusta] };

    function tauler() {
      // Tablero perforado: una sola imagen reutilizada en todas las páginas (el PDF pesa poco)
      doc.addImage(imatgeTauler(mida), "PNG", bx, by, ample, mida.H * s, "tauler-" + mida.W, "FAST");
      stroke(COLOR.fustaFosca); doc.setLineWidth(0.5);
      doc.roundedRect(bx, by, ample, mida.H * s, 1.5, 1.5, "S");
      // Regla en cm cada 10 cm
      doc.setFontSize(5.5); doc.setTextColor(...COLOR.suau);
      for (let x = 0; x <= mida.W; x += ample < 100 ? 240 : 80) doc.text(String(x * CM), bx + x * s, by - 1, { align: "center" });
      for (let y = 80; y <= mida.H; y += 80) doc.text(String(y * CM), bx - 1, by + y * s + 1, { align: "right" });
    }

    function peca(p, solucio) {
      const a = ((p.angulo || 0) * Math.PI) / 180, { x, y } = p;
      const marca = solucio ? COLOR.verd : COLOR.fustaFosca;
      const verd = [190, 230, 200];
      switch (p.tipo) {
        case "liston": rect(x, y, 240, 14, a, 0, 0, solucio ? verd : COLOR.fusta); break;
        case "canal": rect(x, y, 240, 20, a, 0, 0, solucio ? verd : [214, 168, 105]); break;
        case "bloque": rect(x, y, 160, 40, a, 0, 0, solucio ? verd : [214, 190, 150]); break;
        case "cuna": fill(solucio ? verd : [214, 190, 150]); stroke(marca); poli([[-60, 30], [60, 30], [60, -30]].map(([u, v]) => { const [rx, ry] = rot(u, v, a); return P(x + rx, y + ry); })); break;
        case "espiga": case "espigaLarga": cercle(x, y, 6, solucio ? verd : [243, 220, 174], marca); break;
        case "pinza": {
          // Clavada: (x, y) es la espiga donde se clava el muelle; si no, la punta que muerde
          const [mx, my] = rot(20, 0, a), px = p.clavada ? x - mx : x, py = p.clavada ? y - my : y;
          rect(px, py, 84, 16, a, 28, 0, solucio ? verd : COLOR.fusta); cercle(px + mx, py + my, 5, COLOR.metall); break;
        }
        case "tubo": rect(x, y, 200, 6, a, 0, -33, solucio ? verd : COLOR.pvc); rect(x, y, 200, 6, a, 0, 33, solucio ? verd : COLOR.pvc); break;
        case "codo": case "corrugado": case "cono": rect(x, y, 120, 70, a, 0, 0, solucio ? verd : p.tipo === "corrugado" ? [250, 190, 120] : COLOR.pvc); break;
        case "domino": rect(x, y, 16, 76, a, 0, 0, COLOR.fusta); break;
        case "palanca": rect(x, y, 280, 14, a, 0, 0, COLOR.fusta); cercle(x, y, 6, [243, 220, 174]); break;
        case "pendulo": { const [ox, oy] = rot(0, 170, a); linia(x, y, x + ox, y + oy, COLOR.goma, 0.3); cercle(x + ox, y + oy, 22, COLOR.fusta); cercle(x, y, 6, [243, 220, 174]); break; }
        case "manivela": cercle(x, y, 40, COLOR.fusta, marca); linia(x, y, x + 30, y - 30, COLOR.fustaFosca, 0.8); cercle(x + 30, y - 30, 8, COLOR.goma); break;
        case "polea": cercle(x, y, 80, COLOR.fusta); linia(x - 80, y, x - 80, y + 150, COLOR.goma, 0.3); linia(x + 80, y, x + 80, y + (p.contrapeso ?? 220), COLOR.goma, 0.3);
          rect(x - 80, y + 160, 74, 50, 0, 0, 0, [214, 190, 150]); rect(x + 80, y + (p.contrapeso ?? 220), 40, 40, 0, 0, 0, [150, 110, 70]); break;
        case "coche": rect(x, y, 104, 22, a, 0, 0, [214, 168, 105]); [-34, 34].forEach((dx) => { const [rx, ry] = rot(dx, 16, a); cercle(x + rx, y + ry, 15, COLOR.negre); }); break;
        case "caja": case "meta": {
          const w = p.tipo === "meta" ? 120 : 110, h = 72, c = p.tipo === "meta" ? [255, 236, 170] : [214, 190, 150];
          rect(x, y + 30, w, 12, 0, 0, 0, c); rect(x - w / 2 + 6, y - 6, 12, h, 0, 0, 0, c); rect(x + w / 2 - 6, y - 6, 12, h, 0, 0, 0, c);
          if (p.tipo === "meta") { fill(COLOR.sol); stroke(COLOR.taronja); const [px, py] = P(x, y - 10); doc.circle(px, py, 1.2, "FD"); }
          break;
        }
        case "campana": rect(x + 70, y - 54, 150, 24, 0, 0, 0, [214, 190, 150]); cercle(x, y, 30, [230, 190, 80], [160, 120, 30]); break;
        case "salida": rect(x, y, 170, 14, 0.16, 0, 0, COLOR.fusta); cercle(x - 80, y - 22, 6, [243, 220, 174]);
          { const [r, c] = BOLES[p.bola || "corcho"]; cercle(x - 50, y - 14 - r, r, c); } break;
        case "lanzador": rect(x, y, 110, 8, a, -20, -30, COLOR.fusta); rect(x, y, 110, 8, a, -20, 30, COLOR.fusta); rect(x, y, 12, 68, a, -80, 0, [150, 110, 70]);
          { const [r, c] = BOLES[p.bola || "canica"]; cercle(x, y, r, c); const [ex, ey] = rot(90, 0, a); linia(x, y, x + ex, y + ey, COLOR.vermell, 0.5); } break;
        case "canica": case "corcho": case "pelota": { const [r, c] = BOLES[p.tipo]; cercle(x, y, r, c); break; }
        default:
          if (p.tipo.startsWith("engranaje")) { const r = { engranaje50: 20, engranaje100: 40, engranaje150: 60, engranaje200: 80 }[p.tipo]; cercle(x, y, r + 5, solucio ? verd : COLOR.fusta, marca); cercle(x, y, 5, [243, 220, 174]); }
      }
    }
    /** Número en un círculo junto a la pieza (para la lista de material). */
    function etiqueta(p, n) {
      const [px, py] = P(p.x, p.y);
      fill(COLOR.tinta); doc.circle(px + 2.6, py - 2.6, 1.8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(6.5);
      doc.text(String(n), px + 2.6, py - 1.9, { align: "center" });
    }
    /** Cadena: las dos tangentes exteriores y el contorno de las ruedas, en gris oscuro. */
    function cadena(x1, y1, r1, x2, y2, r2) {
      r1 += 5; r2 += 5;
      const d = Math.hypot(x2 - x1, y2 - y1), th = Math.atan2(y2 - y1, x2 - x1), be = Math.acos(Math.max(-1, Math.min(1, (r1 - r2) / d)));
      stroke([70, 70, 78]); doc.setLineWidth(0.7);
      for (const sg of [1, -1]) {
        const f = th + sg * be;
        doc.line(...P(x1 + r1 * Math.cos(f), y1 + r1 * Math.sin(f)), ...P(x2 + r2 * Math.cos(f), y2 + r2 * Math.sin(f)));
      }
      for (const [x, y, r] of [[x1, y1, r1], [x2, y2, r2]]) { const [px, py] = P(x, y); doc.circle(px, py, r * s, "S"); }
    }
    return { tauler, peca, etiqueta, linia, cadena, P, alt: mida.H * s };
  }

  /** Dibuja la solución de un reto (piezas nuevas en verde, gomas y tirachinas en negro). */
  function dibuixarSolucio(ds, r) {
    r.fijas.forEach((p) => ds.peca(p, false));
    const mateixa = (s, p) => s.desde && s.desde[0] === p.x && s.desde[1] === p.y && (!s.tipo || s.tipo === p.tipo);
    (r.piezas || []).forEach((p) => { if (!r.solucion.some((s) => mateixa(s, p))) ds.peca(p, false); });
    r.solucion.forEach((s) => {
      if (s.cadena) {
        const g = (x, y) => [...r.fijas, ...r.solucion].find((q) => q.tipo && TK.radiEngranatge(q.tipo) && q.x === x && q.y === y);
        const a = g(s.cadena[0], s.cadena[1]), b = g(s.cadena[2], s.cadena[3]);
        if (a && b) ds.cadena(a.x, a.y, TK.radiEngranatge(a.tipo), b.x, b.y, TK.radiEngranatge(b.tipo));
        return;
      }
      if (s.goma && r.solucion.some((q) => q.gatillo)) return; // el tirachinas dibuja la goma estirada
      if (s.goma) ds.linia(s.goma[0], s.goma[1], s.goma[2], s.goma[3], COLOR.negre, 0.6);
      else if (s.gatillo) {
        const g = r.solucion.find((q) => q.goma);
        if (g) { ds.linia(g.goma[0], g.goma[1], s.gatillo[2], s.gatillo[3], COLOR.negre, 0.6); ds.linia(g.goma[2], g.goma[3], s.gatillo[2], s.gatillo[3], COLOR.negre, 0.6); }
        ds.peca({ tipo: "pinza", x: s.gatillo[2], y: s.gatillo[3], angulo: s.angulo || 0 }, true);
      } else if (s.desde) { if (!s.quitar) { const p = r.piezas.find((q) => mateixa(s, q)); ds.peca({ ...p, x: s.x ?? p.x, y: s.y ?? p.y, angulo: s.angulo ?? p.angulo }, true); } }
      else ds.peca(s.tipo === "pinza" ? { ...s, clavada: true } : s, true);
    });
  }

  /* ---------- Textos de ayuda ---------- */
  const F = (k, v) => {
    let s = TK.textFitxa(k);
    if (v) for (const [a, b] of Object.entries(v)) s = s.split(`{${a}}`).join(b);
    return s;
  };
  const posicio = (p) => `${cm(p.x)} ${F("cm")} · ${cm(p.y)} ${F("cm")}${p.angulo ? ` · ${Math.round(p.angulo)}°` : ""}`;
  function pasSolucio(s, r0) {
    if (s.cadena) {
      const g = (x, y) => r0.fijas.concat(r0.solucion).find((q) => q.tipo && TK.radiEngranatge(q.tipo) && q.x === x && q.y === y);
      const A = g(s.cadena[0], s.cadena[1]), B = g(s.cadena[2], s.cadena[3]);
      const mida = A && B ? TK.midaCadena(A, B) : "";
      return F("cadena", { n: mida, a: `${cm(s.cadena[0])}; ${cm(s.cadena[1])}`, b: `${cm(s.cadena[2])}; ${cm(s.cadena[3])}` });
    }
    if (s.goma) return F("goma", { a: `${cm(s.goma[0])}; ${cm(s.goma[1])}`, b: `${cm(s.goma[2])}; ${cm(s.goma[3])}` });
    if (s.gatillo) return F("gatill", { a: `${cm(s.gatillo[2])}; ${cm(s.gatillo[3])}` });
    if (s.desde) {
      const a = `${cm(s.desde[0])}; ${cm(s.desde[1])}`;
      if (s.quitar) return F("treure", { a });
      if (s.x !== undefined) return F("moure", { a, b: `${cm(s.x)}; ${cm(s.y)}` });
      return F("girar", { a, g: s.angulo });
    }
    return `${TK.nomPieza(s.tipo)}: ${posicio(s)}`;
  }
  function condicions(r) {
    const cond = [];
    if (r.solo) cond.push(F("nomesPeces", { p: r.solo.map(TK.nomPieza).join(", ") }));
    if (r.sin) cond.push(F("senseP", { p: r.sin.map(TK.nomPieza).join(", ") }));
    if (r.limite) cond.push(F("limit", { n: r.limite }));
    if (r.totes) cond.push(F("totes"));
    if (r.distintos) cond.push(F("distints"));
    if (r.ayuda) cond.push(TK.t(r.ayuda));
    return cond;
  }

  /* ---------- Piezas de página ---------- */
  function capcalera(doc, r, tr, imgLogo, pagina) {
    doc.addImage(imgLogo, "PNG", M, 8, 50, 12, "logo", "FAST");
    const c = colorDif[r.dificultat];
    doc.setFillColor(...c);
    doc.roundedRect(A4.w - M - 62, 9, 62, 10, 3, 3, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(TK.tituloReto(r), A4.w - M - 31, 15.6, { align: "center" });
    peu(doc, `${tr.nom} · ${F("pagina", { n: pagina })}`);
  }
  function peu(doc, text, ample = A4.w) {
    doc.setTextColor(...COLOR.suau); doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.text(text, ample - M, doc.internal.pageSize.getHeight() - 7, { align: "right" });
    doc.text("Tinker Pad · CC BY-NC-SA 4.0 · Raúl García Antolín 2026", M, doc.internal.pageSize.getHeight() - 7);
  }
  function titol(doc, text, y, mida = 11, x = M) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(mida); doc.setTextColor(...COLOR.tinta);
    doc.text(text, x, y);
    return y + mida * 0.45 + 1.5;
  }
  function paragraf(doc, text, x, y, ample, mida = 9.5, color = COLOR.tinta, negreta = false) {
    doc.setFont("helvetica", negreta ? "bold" : "normal"); doc.setFontSize(mida); doc.setTextColor(...color);
    const linies = doc.splitTextToSize(text, ample);
    doc.text(linies, x, y);
    return y + linies.length * mida * 0.42 + 1;
  }
  function casella(doc, x, y, text, ample, mida = 9.5) {
    const c = mida * 0.44;
    doc.setDrawColor(...COLOR.tinta); doc.setLineWidth(0.3);
    doc.roundedRect(x, y - c * 0.8, c, c, 0.8, 0.8, "S");
    return paragraf(doc, text, x + c + 2, y, ample - c - 2, mida);
  }
  function linies(doc, x, y, ample, n, pas = 7) {
    doc.setDrawColor(...COLOR.forat); doc.setLineWidth(0.3);
    for (let k = 1; k <= n; k++) doc.line(x, y + k * pas, x + ample, y + k * pas);
    return y + n * pas + 2;
  }
  function nomDataGrup(doc, y) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...COLOR.tinta); doc.setDrawColor(...COLOR.forat);
    [[F("nom"), M, 80], [F("data"), M + 86, 40], [F("grup"), M + 132, 50]].forEach(([t, x, w]) => {
      doc.text(t + ":", x, y + 4); doc.line(x + doc.getTextWidth(t + ":") + 2, y + 4.5, x + w, y + 4.5);
    });
    return y + 11;
  }
  /** Montaje inicial a escala con las piezas numeradas por tipo. Devuelve y final y los tipos. */
  function muntatge(doc, r, y, ample = A4.w - 2 * M - 8) {
    const d = dibuixant(doc, M + 6, y + 3, ample, TK.midaRepte(r));
    d.tauler();
    const peces = [...r.fijas.map((p) => ({ ...p, fija: true })), ...(r.piezas || []).map((p) => ({ ...p }))];
    const tipus = [...new Set(peces.map((p) => p.tipo))];
    peces.forEach((p) => d.peca(p, false));
    // Piezas iguales con el mismo número (un campo de espigas no llena la hoja)
    peces.forEach((p) => { const n = tipus.indexOf(p.tipo) + 1; if (peces.filter((q) => q.tipo === p.tipo).length <= 6) d.etiqueta(p, n); });
    tipus.forEach((tp, k) => { const p = peces.filter((q) => q.tipo === tp); if (p.length > 6) d.etiqueta(p[0], k + 1); });
    return { y: y + 3 + d.alt + 3, tipus, peces };
  }
  function cadenaTipus(r) { return [...new Set([...r.fijas, ...(r.piezas || [])].map((p) => p.tipo))]; }
  const miniTipus = (t) => (t === "salida" ? "liston" : t);

  /* ---------- Iconos dibujados (fichas de Fácil) ---------- */
  function icona(doc, tipus, cx, cy, c) {
    doc.setDrawColor(...c); doc.setFillColor(...c); doc.setLineWidth(1);
    if (tipus === "pensa") { // bombilla
      doc.circle(cx, cy - 1.5, 4, "S"); doc.line(cx - 2, cy + 3.5, cx + 2, cy + 3.5); doc.line(cx - 1.6, cy + 5, cx + 1.6, cy + 5);
    } else if (tipus === "munta") { // martillo
      doc.setLineWidth(1.4); doc.line(cx - 3.5, cy + 4.5, cx + 2, cy - 1); doc.roundedRect(cx - 0.5, cy - 5.5, 7, 3.6, 0.8, 0.8, "F");
    } else if (tipus === "prova") { // play
      doc.triangle(cx - 3, cy - 4.5, cx - 3, cy + 4.5, cx + 4.5, cy, "F");
    } else { // flechas de mejorar (repetir)
      const pts = []; for (let k = 0; k <= 12; k++) { const a = -0.3 + (k / 12) * 4.8; pts.push([cx + 4.2 * Math.cos(a), cy + 4.2 * Math.sin(a)]); }
      doc.lines(pts.slice(1).map((p, k) => [p[0] - pts[k][0], p[1] - pts[k][1]]), pts[0][0], pts[0][1], [1, 1], "S");
      const [ex, ey] = pts[12]; doc.triangle(ex - 2, ey - 1.6, ex + 2.2, ey - 1.8, ex, ey + 1.8, "F");
    }
  }
  /** Carita: 0 contenta, 1 normal, 2 pensativa. */
  function cara(doc, cx, cy, r, tipus) {
    doc.setDrawColor(...COLOR.tinta); doc.setFillColor(...[[255, 230, 140], [255, 240, 190], [230, 230, 240]][tipus]); doc.setLineWidth(0.5);
    doc.circle(cx, cy, r, "FD");
    doc.setFillColor(...COLOR.tinta);
    doc.circle(cx - r * 0.35, cy - r * 0.2, r * 0.09, "F"); doc.circle(cx + r * 0.35, cy - r * 0.2, r * 0.09, "F");
    const boca = []; const curva = [0.28, 0, -0.18][tipus];
    for (let k = 0; k <= 8; k++) { const t = k / 8 - 0.5; boca.push([cx + t * r, cy + r * 0.35 + curva * r * (1 - 4 * t * t)]); }
    doc.lines(boca.slice(1).map((p, k) => [p[0] - boca[k][0], p[1] - boca[k][1]]), boca[0][0], boca[0][1], [1, 1], "S");
  }

  /* ---------- Fichas por dificultad ---------- */
  function paginaFacil1(doc, r, tr, imgLogo, miniaturas) {
    capcalera(doc, r, tr, imgLogo, 1);
    const c = colorDif.facil;
    let y = 31;
    doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(...COLOR.tinta);
    doc.text(tr.nom, M, y); y += 8;
    y = paragraf(doc, tr.enunciado, M, y, A4.w - 2 * M, 14, COLOR.tinta, true);
    y = nomDataGrup(doc, y);
    const m = muntatge(doc, r, y);
    y = m.y + 2;
    // Material con dibujos: lo que ya está y lo que puedes poner
    const caixa = (x, w, titolText, items, color) => {
      doc.setFillColor(...clar(color, 0.88)); doc.setDrawColor(...color); doc.setLineWidth(0.4);
      doc.roundedRect(x, y, w, 30, 3, 3, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...color);
      doc.text(titolText, x + 3, y + 5.5);
      const n5 = Math.max(4, Math.min(6, items.length));
      items.slice(0, 6).forEach(([tipo, etiq], k) => {
        const ix = x + 3 + k * ((w - 6) / n5);
        const img = miniaturas[miniTipus(tipo)];
        if (img) doc.addImage(img, "PNG", ix, y + 8, 15, 11.25, "mini-" + miniTipus(tipo), "FAST");
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...COLOR.tinta);
        doc.text(etiq, ix + 7.5, y + 25, { align: "center" });
      });
    };
    // Lo que ya está: número del dibujo (y cuántas hay); lo que puedes poner: cuántas
    const fixes = m.tipus.map((t, k) => { const n = m.peces.filter((p) => p.tipo === t).length; return [t, `(${k + 1})${n > 1 ? " ×" + n : ""}`]; });
    caixa(M, 100, F("hiHa"), fixes, COLOR.fustaFosca);
    caixa(M + 104, A4.w - 2 * M - 104, F("posa"), Object.entries(r.pista || {}).map(([t, n]) => [t, "×" + n]), COLOR.verd);
    y += 34;
    // Cuatro pasos con iconos
    const pasos = [["pensa", "fPas1"], ["munta", "fPas2"], ["prova", "fPas3"], ["millora", "fPas4"]];
    const w4 = (A4.w - 2 * M - 9) / 4;
    pasos.forEach(([ic, k], n) => {
      const x = M + n * (w4 + 3);
      doc.setFillColor(...clar(c, 0.85)); doc.roundedRect(x, y, w4, 20, 3, 3, "F");
      icona(doc, ic, x + 9, y + 10, c);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...COLOR.tinta);
      doc.text(`${n + 1}. ${F(k)}`, x + 16, y + 11.5);
    });
    y += 26;
    // Predicción dibujada
    y = titol(doc, F("fPrediccio"), y, 13);
    doc.setDrawColor(...COLOR.forat); doc.setLineWidth(0.4);
    doc.roundedRect(M, y - 2, A4.w - 2 * M, Math.max(20, A4.h - 14 - y), 3, 3, "S");
  }

  function paginaFacil2(doc, r, tr, imgLogo) {
    capcalera(doc, r, tr, imgLogo, 2);
    let y = titol(doc, F("dibuix"), 30, 13);
    const d = dibuixant(doc, M + 6, y + 3, A4.w - 2 * M - 8, TK.midaRepte(r));
    d.tauler();
    r.fijas.forEach((p) => d.peca(p, false));
    y += 3 + d.alt + 7;
    // ¿Lo has conseguido?
    y = titol(doc, F("fAconseguit"), y, 13);
    doc.setFontSize(13);
    casella(doc, M + 4, y + 3, F("fSi"), 60, 13); casella(doc, M + 60, y + 3, F("fEncara"), 80, 13);
    y += 12;
    // Caras
    y = titol(doc, TK.comunTraducit().sentir.texto, y, 13);
    [0, 1, 2].forEach((k) => cara(doc, M + 22 + k * 40, y + 8, 8, k));
    y += 22;
    // Pregunta del reto
    y = paragraf(doc, tr.pregunta.texto, M, y, A4.w - 2 * M, 12, COLOR.tinta, true) + 1;
    tr.pregunta.opciones.forEach((o) => { y = casella(doc, M + 4, y + 2, o.texto, A4.w - 2 * M - 4, 12) + 1.5; });
    caixaDocent(doc, r, tr, y + 3);
  }

  function paginaMitja1(doc, r, tr, imgLogo, miniaturas, dificil) {
    capcalera(doc, r, tr, imgLogo, 1);
    let y = 30;
    doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(...COLOR.tinta);
    doc.text(tr.nom, M, y); y += 7;
    y = paragraf(doc, `${F("objectiu")}: ${tr.enunciado}`, M, y, A4.w - 2 * M, 11.5);
    y = paragraf(doc, F(r.mesa ? "taula" : "panell"), M, y, A4.w - 2 * M, 8.5, COLOR.suau);
    y = nomDataGrup(doc, y);
    y = titol(doc, F("muntatge"), y);
    const ample = dificil ? 140 : A4.w - 2 * M - 8;
    const m = muntatge(doc, r, y, ample);
    if (dificil) {
      // Al lado del dibujo: condiciones del reto (en el difícil son la clave)
      let yc = titol(doc, F("condicions"), y + 4, 10, M + ample + 10);
      const cond = condicions(r);
      (cond.length ? cond : [F("capCondicio")]).forEach((c) => { yc = paragraf(doc, "• " + c, M + ample + 10, yc, A4.w - M - (M + ample + 10), 8.5); });
    }
    y = m.y + 1.5;
    y = paragraf(doc, F("mesures"), M, y, A4.w - 2 * M, 7.5, COLOR.suau);
    // Material: piezas fijas (numeradas por tipo) y sugeridas (pista)
    y = titol(doc, F("material"), y + 1);
    const col = (A4.w - 2 * M) / 2;
    let y1 = paragraf(doc, F("fix"), M, y, col - 4, 8.5, COLOR.suau);
    m.tipus.forEach((tp, k) => {
      const grup = m.peces.filter((p) => p.tipo === tp);
      const llocs = grup.length <= (dificil ? 4 : 2) ? "  " + grup.map((p) => `(${posicio(p)})`).join(" ") : "";
      y1 = paragraf(doc, `${k + 1}. ${grup.length > 1 ? grup.length + " × " : ""}${TK.nomPieza(tp)}${llocs}`, M, y1, col - 4, 8.5);
    });
    let y2 = paragraf(doc, F(dificil ? "afegirDif" : "afegir"), M + col, y, col, 8.5, COLOR.suau);
    if (!dificil) {
      Object.entries(r.pista || {}).forEach(([tipo, n]) => {
        if (miniaturas[tipo]) doc.addImage(miniaturas[tipo], "PNG", M + col, y2 - 3.5, 8, 6, "mini-" + tipo, "FAST");
        y2 = paragraf(doc, `${n} × ${TK.nomPieza(tipo)}`, M + col + 10, y2 + 0.5, col - 10, 9) + 1.5;
      });
      y2 = paragraf(doc, F("quantes"), M + col, y2, col, 8.5, COLOR.verd);
    }
    y = Math.max(y1, y2) + 1;
    if (!dificil) {
      const cond = condicions(r);
      if (cond.length) { y = titol(doc, F("condicions"), y); cond.forEach((c) => { y = paragraf(doc, "• " + c, M, y, A4.w - 2 * M, 9); }); }
      y = titol(doc, F("passos"), y + 1);
      ["pas1", "pas2", "pas3", "pas4"].forEach((k, n) => { y = casella(doc, M, y + 1, `${n + 1}. ${F(k)}`, A4.w - 2 * M) + 0.5; });
      y = titol(doc, F("prediccio"), y + 1);
      const alt = Math.max(16, A4.h - 14 - y);
      doc.setDrawColor(...COLOR.forat); doc.setLineWidth(0.3);
      doc.roundedRect(M, y - 2, A4.w - 2 * M, alt, 2, 2, "S");
      for (let ly = y + 6; ly < y - 2 + alt - 2; ly += 7) doc.line(M + 4, ly, A4.w - M - 4, ly);
      return;
    }
    // Difícil: planificar dividiendo el problema en partes (descomposición)
    y = titol(doc, F("planifica"), y + 1);
    y = paragraf(doc, F("planificaAjuda"), M, y, A4.w - 2 * M, 8.5, COLOR.suau);
    y = taula(doc, M, y, [F("part"), F("peces"), F("funcio")], [16, 60, A4.w - 2 * M - 76], 3, 9);
    // Hipótesis con "porque"
    y = titol(doc, F("hipotesi"), y + 3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...COLOR.suau);
    doc.text(F("crecQue"), M, y + 4);
    y = linies(doc, M, y, A4.w - 2 * M, Math.max(2, Math.floor((A4.h - 18 - y) / 7)));
  }

  /** Tabla vacía para rellenar: cabecera y n filas. */
  function taula(doc, x, y, cap, amples, files, alt = 8) {
    const total = amples.reduce((a, b) => a + b, 0);
    doc.setFillColor(...clar(COLOR.fusta, 0.6)); doc.setDrawColor(...COLOR.fustaFosca); doc.setLineWidth(0.3);
    doc.rect(x, y, total, 7, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...COLOR.tinta);
    let cx = x;
    cap.forEach((t, k) => { doc.text(t, cx + 2, y + 4.8); cx += amples[k]; });
    for (let f = 0; f < files; f++) {
      const fy = y + 7 + f * alt;
      doc.rect(x, fy, total, alt, "S");
      cx = x;
      amples.forEach((w, k) => { if (k) doc.line(cx, fy, cx, fy + alt); cx += w; });
    }
    cx = x;
    amples.forEach((w, k) => { if (k) doc.line(cx, y, cx, y + 7); cx += w; });
    return y + 7 + files * alt;
  }

  function paginaMitja2(doc, r, tr, imgLogo) {
    capcalera(doc, r, tr, imgLogo, 2);
    let y = titol(doc, F("dibuix"), 30);
    const d = dibuixant(doc, M + 6, y + 3, A4.w - 2 * M - 8, TK.midaRepte(r));
    d.tauler();
    r.fijas.forEach((p) => d.peca(p, false));
    y += 3 + d.alt + 6;
    y = titol(doc, F("reflexio"), y);
    const comun = TK.comunTraducit();
    const col3 = (A4.w - 2 * M) / 3;
    const fila = (pregunta, opcions, yy) => {
      yy = paragraf(doc, pregunta, M, yy, A4.w - 2 * M, 10);
      let maxY = yy;
      opcions.forEach((o, k) => {
        const x = M + (k % 3) * col3, fy = yy + Math.floor(k / 3) * 7;
        maxY = Math.max(maxY, casella(doc, x, fy + 1, o, col3 - 2));
      });
      return maxY + 2;
    };
    y = fila(comun.sentir.texto, comun.sentir.opciones.map((o) => o.texto), y);
    y = fila(tr.pregunta.texto, tr.pregunta.opciones.map((o) => o.texto), y);
    y = fila(comun.estrategias.texto, comun.estrategias.opciones.map((o) => o.texto), y);
    y = fila(F("reinventa"), tr.reinventar.map((v) => v.texto), y);
    caixaDocent(doc, r, tr, y + 2);
  }

  function paginaDificil2(doc, r, tr, imgLogo) {
    capcalera(doc, r, tr, imgLogo, 2);
    // Dibujo y cadena de energía, lado a lado
    let y = titol(doc, F("dibuix"), 30);
    const ample = 112;
    const d = dibuixant(doc, M + 6, y + 3, ample, TK.midaRepte(r));
    d.tauler();
    r.fijas.forEach((p) => d.peca(p, false));
    const xc = M + ample + 12, wc = A4.w - M - xc;
    let yc = titol(doc, F("cadena"), y, 10, xc);
    yc = paragraf(doc, F("cadenaAjuda"), xc, yc, wc, 8, COLOR.suau);
    for (let k = 0; k < 4; k++) {
      doc.setDrawColor(...COLOR.fustaFosca); doc.setLineWidth(0.3);
      doc.roundedRect(xc, yc, wc, 9, 2, 2, "S");
      if (k < 3) { doc.setFillColor(...COLOR.fustaFosca); doc.triangle(xc + wc / 2 - 2, yc + 10, xc + wc / 2 + 2, yc + 10, xc + wc / 2, yc + 12.5, "F"); }
      yc += 13;
    }
    y = Math.max(y + 3 + d.alt, yc) + 5;
    // Registro de pruebas: depurar paso a paso
    y = titol(doc, F("registre"), y);
    y = taula(doc, M, y, [F("prova"), F("canvi"), F("passa"), F("perque")], [12, 54, 54, A4.w - 2 * M - 120], 4, 9) + 4;
    // Pregunta del reto con justificación
    y = paragraf(doc, tr.pregunta.texto, M, y, A4.w - 2 * M, 10, COLOR.tinta, true);
    const col3 = (A4.w - 2 * M) / 3;
    let maxY = y;
    tr.pregunta.opciones.forEach((o, k) => { maxY = Math.max(maxY, casella(doc, M + k * col3, y + 1, o.texto, col3 - 2)); });
    y = maxY + 1;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...COLOR.suau);
    doc.text(F("justifica"), M, y + 3);
    y = linies(doc, M, y + 1, A4.w - 2 * M, 2, 6.5);
    y = paragraf(doc, `${F("reinventa")}: ${tr.reinventar.map((v) => v.texto).join(" · ")}`, M, y + 1, A4.w - 2 * M, 8.5, COLOR.suau);
    caixaDocent(doc, r, tr, y + 1);
  }

  /** Parte del docente: concepto y una solución dibujada y explicada. */
  function caixaDocent(doc, r, tr, y) {
    const altDoc = A4.h - 14 - y;
    if (altDoc < 30) return;
    doc.setFillColor(238, 240, 246); doc.setDrawColor(...COLOR.docent); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, A4.w - 2 * M, altDoc, 2, 2, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...COLOR.docent);
    doc.text(F("docent"), M + 4, y + 6);
    const mida = TK.midaRepte(r), ampleDib = Math.min(78, (altDoc - 13) * mida.W / mida.H), xText = M + ampleDib + 10, ampleText = A4.w - M - 4 - xText;
    const ds = dibuixant(doc, M + 4, y + 10, ampleDib, mida);
    ds.tauler();
    dibuixarSolucio(ds, r);
    let yt = paragraf(doc, `${F("concepte")}: ${tr.concepte}`, xText, y + 11, ampleText, 9, [40, 50, 90]);
    yt = paragraf(doc, F("solucio") + ":", xText, yt + 1, ampleText, 8.5, [40, 50, 90]);
    // Las espigas nuevas, todas en una línea (sujetan las piezas: ver el dibujo)
    const espigues = r.solucion.filter((s) => s.tipo === "espiga");
    if (espigues.length) yt = paragraf(doc, `• ${TK.nomPieza("espiga")} ×${espigues.length}: ${espigues.map((s) => `(${cm(s.x)}; ${cm(s.y)})`).join(" ")}`, xText, yt, ampleText, 8, [40, 50, 90]);
    r.solucion.filter((s) => s.tipo !== "espiga").forEach((s) => { yt = paragraf(doc, "• " + pasSolucio(s, r), xText, yt, ampleText, 8, [40, 50, 90]); });
    if (r.manivela) yt = paragraf(doc, "• " + TK.t("ayudaManivela"), xText, yt, ampleText, 8, [40, 50, 90]);
    paragraf(doc, `${F("resposta")}: ${tr.pregunta.opciones.find((o) => o.correcta).texto}. ${tr.pregunta.explicacion}`, xText, yt + 1, ampleText, 8, [40, 50, 90]);
  }

  /* ---------- Rúbricas ---------- */
  const NIVELLS = ["n1", "n2", "n3", "n4"];
  const CRITERIS = ["c1", "c2", "c3", "c4", "c5"];
  /** Texto de rúbrica del idioma actual (o del catalán). */
  const RB = (dif, k, v) => {
    const d = (TK.TEXTOS[TK.idioma] || TK.TEXTOS.ca).rubrica || TK.TEXTOS.ca.rubrica;
    let s = (d[dif] && d[dif][k]) ?? d[k] ?? TK.TEXTOS.ca.rubrica[dif]?.[k] ?? TK.TEXTOS.ca.rubrica[k] ?? k;
    if (v) for (const [a, b] of Object.entries(v)) s = s.split(`{${a}}`).join(b);
    return s;
  };

  function portadaRubrica(doc, dif, retos, imgLogo) {
    const W = 297, c = colorDif[dif];
    doc.addImage(imgLogo, "PNG", M, 10, 62, 15, "logo", "FAST");
    let y = 38;
    doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...COLOR.tinta);
    doc.text(`${RB(dif, "titol")} · ${TK.nomDificultat(dif)}`, M, y);
    doc.setFillColor(...c); doc.roundedRect(W - M - 70, 29, 70, 12, 3, 3, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(11); doc.text(RB(dif, "edat"), W - M - 35, 36.8, { align: "center" });
    y += 7;
    y = paragraf(doc, RB(dif, "intro"), M, y, W - 2 * M, 10);
    const col = (W - 2 * M - 8) / 2;
    let y1 = titol(doc, RB(dif, "sabersT"), y + 3, 11);
    RB(dif, "sabers").split("|").forEach((s) => { y1 = paragraf(doc, "• " + s, M, y1, col, 9); });
    let y2 = titol(doc, RB(dif, "compT"), y + 3, 11, M + col + 8);
    RB(dif, "competencies").split("|").forEach((s) => { y2 = paragraf(doc, "• " + s, M + col + 8, y2, col, 9); });
    y = Math.max(y1, y2) + 3;
    y = titol(doc, RB(dif, "pcT"), y, 11);
    RB(dif, "pc").split("|").forEach((s) => { y = paragraf(doc, "• " + s, M, y, W - 2 * M, 9); });
    y = titol(doc, RB(dif, "nivellsT"), y + 2, 11);
    NIVELLS.forEach((n, k) => {
      doc.setFillColor(...clar(c, [0.85, 0.65, 0.45, 0.2][k])); doc.roundedRect(M + k * ((W - 2 * M) / 4), y - 3, (W - 2 * M) / 4 - 3, 9, 2, 2, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...(k === 3 ? [255, 255, 255] : COLOR.tinta));
      doc.text(`${k + 1} · ${RB(dif, n)}`, M + k * ((W - 2 * M) / 4) + 3, y + 2.6);
    });
    y += 10;
    y = paragraf(doc, RB(dif, "us"), M, y, W - 2 * M, 8.5, COLOR.suau);
    y = titol(doc, RB(dif, "llista"), y + 2, 10);
    // Lista de retos en dos columnas
    const yl = y, colL = (W - 2 * M) / 2;
    let yA = yl, yB = yl;
    retos.forEach((r, k) => {
      const text = `${r.num}. ${TK.retoTraducit(r).nom} — ${TK.retoTraducit(r).concepte}`;
      if (k < Math.ceil(retos.length / 2)) yA = paragraf(doc, text, M + 2, yA, colL - 6, 8);
      else yB = paragraf(doc, text, M + colL + 2, yB, colL - 6, 8);
    });
    peu(doc, RB(dif, "titol"), W);
  }

  function paginaRubrica(doc, dif, r, imgLogo, miniaturas) {
    const W = 297, H = 210, c = colorDif[dif], tr = TK.retoTraducit(r);
    doc.addImage(imgLogo, "PNG", M, 8, 42, 10, "logo", "FAST");
    doc.setFillColor(...c); doc.roundedRect(W - M - 62, 8, 62, 10, 3, 3, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(TK.tituloReto(r), W - M - 31, 14.6, { align: "center" });
    let y = 27;
    const img = miniaturas[r.icono];
    if (img) doc.addImage(img, "PNG", M, y - 6, 16, 12, "mini-" + r.icono, "FAST");
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...COLOR.tinta);
    doc.text(`${RB(dif, "titol")}: ${tr.nom}`, M + 19, y);
    y = paragraf(doc, `${F("objectiu")}: ${tr.enunciado}. ${F("concepte")}: ${tr.concepte}.`, M + 19, y + 5, W - 2 * M - 19, 9, COLOR.suau);
    // Datos del reto para concretar los descriptores
    const peces = [...new Set([...cadenaTipus(r).filter((t) => !["campana", "meta", "salida", "lanzador"].includes(t)), ...Object.keys(r.pista || {})])].map(TK.nomPieza).join(", ");
    const cond = condicions(r).filter((x) => x !== TK.t("ayudaManivela"));
    const vals = { peces: peces || TK.nomPieza("liston"), concepte: tr.concepte.charAt(0).toLowerCase() + tr.concepte.slice(1), objectiu: tr.enunciado.charAt(0).toLowerCase() + tr.enunciado.slice(1),
      condicions: cond.length ? cond.join("; ").toLowerCase() : RB(dif, "senseCond"), pregunta: tr.pregunta.texto };
    // Tabla: criterio + 4 niveles
    const x0 = M, amples = [55, ...Array(4).fill((W - 2 * M - 55) / 4)];
    const mida = 7.6;
    doc.setLineWidth(0.25); doc.setDrawColor(...COLOR.fustaFosca);
    let cx = x0;
    ["", ...NIVELLS.map((n, k) => `${k + 1} · ${RB(dif, n)}`)].forEach((t, k) => {
      doc.setFillColor(...(k ? clar(c, [0.85, 0.65, 0.45, 0.2][k - 1]) : clar(COLOR.fusta, 0.6)));
      doc.rect(cx, y + 2, amples[k], 8, "FD");
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...(k === 4 ? [255, 255, 255] : COLOR.tinta));
      doc.text(k ? t : RB(dif, "criteri"), cx + 2, y + 7.2);
      cx += amples[k];
    });
    y += 10;
    CRITERIS.forEach((cr) => {
      const cel = [[RB(dif, cr + "t"), RB(dif, cr + "d", vals)], ...NIVELLS.map((n, k) => [null, RB(dif, `${cr}${k + 1}`, vals)])];
      doc.setFontSize(mida);
      const liniesCel = cel.map(([t, d], k) => doc.splitTextToSize(d, amples[k] - 4));
      const altT = cel[0][0] ? doc.splitTextToSize(cel[0][0], amples[0] - 4).length * 3.8 : 0;
      const alt = Math.max(...liniesCel.map((l, k) => l.length * mida * 0.42 + (k === 0 ? altT : 0))) + 4;
      cx = x0;
      cel.forEach(([t, d], k) => {
        doc.setFillColor(...(k === 0 ? clar(COLOR.fusta, 0.85) : [255, 255, 255]));
        doc.rect(cx, y, amples[k], alt, "FD");
        let ty = y + 4;
        if (t) { doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...COLOR.tinta); const lt = doc.splitTextToSize(t, amples[0] - 4); doc.text(lt, cx + 2, ty); ty += lt.length * 3.8; }
        doc.setFont("helvetica", "normal"); doc.setFontSize(mida); doc.setTextColor(...(k === 0 ? COLOR.suau : COLOR.tinta));
        doc.text(liniesCel[k], cx + 2, ty);
        cx += amples[k];
      });
      y += alt;
    });
    // Observaciones y nota
    y += 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...COLOR.tinta);
    doc.text(`${F("nom")}: ____________________________   ${RB(dif, "observacions")}:`, M, y + 2);
    doc.setDrawColor(...COLOR.forat);
    for (let k = 0; k < 2 && y + 8 + k * 7 < H - 12; k++) doc.line(M, y + 8 + k * 7, W - M, y + 8 + k * 7);
    peu(doc, `${RB(dif, "titol")} · ${tr.nom}`, W);
  }

  /* ---------- Generar y guardar ---------- */
  function nouDoc(orientacio) {
    return new window.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: orientacio || "portrait", compress: true });
  }
  /** PDF con las fichas de los retos (Blob). Con `doc`, las añade a ese documento. */
  async function fitxes(retos, miniaturas, docExistent) {
    const doc = docExistent || nouDoc();
    const imgLogo = await logo();
    retos.forEach((r, k) => {
      const tr = TK.retoTraducit(r);
      if (k || docExistent) doc.addPage("a4", "portrait");
      if (r.dificultat === "facil") { paginaFacil1(doc, r, tr, imgLogo, miniaturas); doc.addPage(); paginaFacil2(doc, r, tr, imgLogo); }
      else if (r.dificultat === "mitja") { paginaMitja1(doc, r, tr, imgLogo, miniaturas, false); doc.addPage(); paginaMitja2(doc, r, tr, imgLogo); }
      else { paginaMitja1(doc, r, tr, imgLogo, miniaturas, true); doc.addPage(); paginaDificil2(doc, r, tr, imgLogo); }
    });
    return docExistent ? doc : doc.output("blob");
  }
  /** PDF con las rúbricas de una dificultad: portada + una tabla por reto. Con `doc`, las añade. */
  async function rubriques(dif, miniaturas, docExistent) {
    const doc = docExistent || nouDoc("landscape");
    const imgLogo = await logo();
    const retos = TK.RETOS.filter((r) => r.dificultat === dif);
    if (docExistent) doc.addPage("a4", "landscape");
    portadaRubrica(doc, dif, retos, imgLogo);
    retos.forEach((r) => { doc.addPage("a4", "landscape"); paginaRubrica(doc, dif, r, imgLogo, miniaturas); });
    return docExistent ? doc : doc.output("blob");
  }
  /** Página de separación de un bloque del documento completo. */
  function separador(doc, titolText, subtitol, color, imgLogo) {
    doc.addImage(imgLogo, "PNG", (A4.w - 120) / 2, 70, 120, 29, "logo", "FAST");
    doc.setFillColor(...color); doc.roundedRect(M, 120, A4.w - 2 * M, 34, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(255, 255, 255);
    doc.text(titolText, A4.w / 2, 136, { align: "center" });
    doc.setFontSize(12); doc.text(subtitol, A4.w / 2, 147, { align: "center" });
    peu(doc, titolText);
  }
  /**
   * Documento completo: portada, y para cada dificultad sus fichas y su
   * rúbrica (las rúbricas en horizontal).
   */
  async function documentComplet(miniaturas) {
    const doc = nouDoc();
    const imgLogo = await logo();
    separador(doc, TK.t("docComplet"), TK.t("docCompletSub", { n: TK.RETOS.length }), COLOR.docent, imgLogo);
    for (const d of TK.DIFICULTATS) {
      doc.addPage("a4", "portrait");
      separador(doc, TK.nomDificultat(d.id), TK.t("edat_" + d.id), colorDif[d.id], imgLogo);
      await fitxes(TK.RETOS.filter((r) => r.dificultat === d.id), miniaturas, doc);
      await rubriques(d.id, miniaturas, doc);
    }
    return doc.output("blob");
  }
  const netejar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const nomFitxes = (retos, nom) => nom || netejar(`tinkerpad-${retos[0].id}-${TK.idioma}.pdf`);
  const nomRubrica = (dif) => `tinkerpad-rubrica-${dif}-${TK.idioma}.pdf`;

  /** Ofrece guardar un Blob: en claude.ai, capacidad "downloads"; fuera, descarga normal. */
  async function guardar(blob, nom) {
    // App Android (apk): el PDF se guarda en Descargas y se abre con el visor de la tablet
    if (window.TinkerPadAndroid) {
      const b64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
      window.TinkerPadAndroid.desaPdf(b64, nom);
      return;
    }
    let baixades = null;
    try { baixades = window.claude && window.claude.use ? await window.claude.use("downloads") : null; } catch (e) { baixades = null; }
    if (baixades) {
      try { await baixades.save({ filename: nom, data: blob }); }
      catch (e) { if (e && e.code !== "declined") alert(TK.t("pdfNo")); }
      return;
    }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** Descarga fichas. Con nomesBlob = true solo devuelve el PDF (pruebas). */
  async function descarregar(retos, miniaturas, nomFitxer, nomesBlob) {
    if (!window.jspdf) { alert(TK.t("pdfNo")); return; }
    const blob = await fitxes(retos, miniaturas);
    if (nomesBlob) return { blob };
    await guardar(blob, nomFitxes(retos, nomFitxer));
  }
  async function descarregarRubrica(dif, miniaturas, nomesBlob) {
    if (!window.jspdf) { alert(TK.t("pdfNo")); return; }
    const blob = await rubriques(dif, miniaturas);
    if (nomesBlob) return { blob };
    await guardar(blob, nomRubrica(dif));
  }

  /* ---------- Visor (PDF.js, se carga solo al usarlo) ---------- */
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  let pdfjs = null;
  function carregarPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = PDFJS + "pdf.min.js";
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; ok(window.pdfjsLib); };
      s.onerror = () => { pdfjs = null; ko(new Error("pdf.js")); };
      document.head.appendChild(s);
    });
    return pdfjs;
  }
  /**
   * Abre el visor con un PDF. `fer` genera el Blob; `nom` es el nombre al descargar.
   * Muestra cada página como imagen, con botones Descargar y Cerrar.
   */
  async function veure(titolVisor, fer, nom) {
    const visor = document.getElementById("visor");
    const pagines = visor.querySelector(".visor-pagines");
    visor.querySelector(".visor-titol").textContent = titolVisor;
    pagines.innerHTML = `<p class="visor-espera">${TK.t("generant")}</p>`;
    visor.hidden = false;
    visor.querySelector(".visor-tancar").focus();
    let blob;
    try {
      blob = await fer();
      visor._baixar = () => guardar(blob, nom);
      const lib = await carregarPdfjs();
      const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      pagines.innerHTML = "";
      const ample = Math.min(pagines.clientWidth - 24, 980);
      for (let n = 1; n <= pdf.numPages; n++) {
        if (visor.hidden) return;
        const pg = await pdf.getPage(n);
        const v0 = pg.getViewport({ scale: 1 }), escala = (ample / v0.width) * Math.min(2, window.devicePixelRatio || 1);
        const v = pg.getViewport({ scale: escala });
        const c = document.createElement("canvas");
        c.width = v.width; c.height = v.height;
        c.style.width = ample + "px";
        c.setAttribute("aria-label", TK.t("paginaN", { n }));
        pagines.appendChild(c);
        await pg.render({ canvasContext: c.getContext("2d"), viewport: v }).promise;
      }
    } catch (e) {
      console.error(e);
      pagines.innerHTML = `<p class="visor-espera">${TK.t("visorNo")}</p>`;
    }
  }
  function iniciarVisor() {
    const visor = document.getElementById("visor");
    if (!visor) return;
    const tancar = () => { visor.hidden = true; visor.querySelector(".visor-pagines").innerHTML = ""; };
    visor.querySelector(".visor-tancar").addEventListener("click", tancar);
    visor.querySelector(".visor-baixar").addEventListener("click", () => visor._baixar && visor._baixar());
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !visor.hidden) tancar(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciarVisor);
  else iniciarVisor();

  TK.Fitxa = {
    descarregar, descarregarRubrica, fitxes, rubriques, documentComplet,
    // Para la guía docente (js/guia.js): dibujo de retos, iconos, logotipo, guardar y visor
    eines: { dibuixant, dibuixarSolucio, icona, cara, logo, guardar, veure, COLOR, colorDif, clar },
    veureFitxes: (retos, miniaturas, titolVisor, nom) => veure(titolVisor, () => fitxes(retos, miniaturas), nomFitxes(retos, nom)),
    veureRubrica: (dif, miniaturas, titolVisor) => veure(titolVisor, () => rubriques(dif, miniaturas), nomRubrica(dif)),
  };
})();
