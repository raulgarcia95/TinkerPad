/* =====================================================================
   guia.js — Guía de tinkering para docentes (presentación en PDF).

   Diapositivas apaisadas (297 x 167 mm) en el idioma elegido, generadas
   con jsPDF: qué es el tinkering, cómo trabajarlo en la escuela, el rol
   del docente, el pensamiento computacional en cada etapa, materiales para
   construir un espacio de tinkering y cómo usar Tinker Pad en el aula.

   Ilustraciones: fotos 3D reales de retos montados (TK.juego.captura),
   retos dibujados a escala, las piezas en 3D del repositorio, dibujos de
   un rincón de tinkering (SVG) e iconos y esquemas vectoriales.

   Se ve en la zona docente (visor) y se descarga en PDF.
   Textos: TK.TEXTOS.<idioma>.guia (js/textos/<idioma>.js).
   Contenido basado en la formación «Tinkering» de Mentories 4.0 · STEAMcat
   y en la «Proposta Tinkering» de materiales de Raúl García Antolín.
   ===================================================================== */
(function () {
  const W = 297, H = 167, M = 14;
  const C = {
    tinta: [63, 44, 29], suau: [122, 100, 80], fons: [251, 245, 234], paper: [255, 253, 248], vora: [226, 203, 168],
    fusta: [224, 183, 122], fustaFosca: [154, 106, 53], verd: [47, 154, 82], taronja: [217, 119, 28], vermell: [194, 58, 78],
    blau: [47, 127, 216], lila: [111, 76, 190], docent: [58, 74, 122], sol: [255, 197, 49], rosa: [226, 72, 61],
  };
  // Color de cada sección de la guía
  const SECCIO = [C.taronja, C.verd, C.blau, C.fustaFosca, C.lila, C.vermell];
  const clar = (c, k = 0.82) => c.map((v) => Math.round(v + (255 - v) * k));

  const dic = () => (TK.TEXTOS[TK.idioma] && TK.TEXTOS[TK.idioma].guia) || TK.TEXTOS.ca.guia;
  const G = (k) => k.split(".").reduce((o, p) => (o == null ? o : o[p]), dic()) ?? k.split(".").reduce((o, p) => (o == null ? o : o[p]), TK.TEXTOS.ca.guia);

  /* ---------- Ayudantes de dibujo ---------- */
  let doc, eines, mini, fotos, imgLogo, imgEspai, pagina = 0;
  const fill = (c) => doc.setFillColor(...c), stroke = (c) => doc.setDrawColor(...c);

  function text(s, x, y, w, mida = 12, color = C.tinta, estil = "normal", align = "left") {
    doc.setFont("helvetica", estil); doc.setFontSize(mida); doc.setTextColor(...color);
    const l = doc.splitTextToSize(String(s), w);
    doc.text(l, align === "center" ? x + w / 2 : x, y, { align, lineHeightFactor: 1.18 });
    return y + l.length * mida * 0.36 * 1.18 + 1.2;
  }
  /** Fondo, número de sección, título y pie de cada diapositiva. */
  function diapo(sec, titol) {
    if (pagina++) doc.addPage([H, W], "landscape");
    fill(C.fons); doc.rect(0, 0, W, H, "F");
    const c = SECCIO[sec];
    fill(c); doc.rect(0, 0, 6, H, "F");
    if (titol) {
      fill(c); doc.roundedRect(M, 11, 9, 9, 2, 2, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
      doc.text(String(sec + 1), M + 4.5, 17.4, { align: "center" });
      doc.setFontSize(21); doc.setTextColor(...C.tinta);
      doc.text(titol, M + 13, 18.6);
      stroke(clar(c, 0.5)); doc.setLineWidth(0.8); doc.line(M + 13, 22.5, M + 13 + Math.min(doc.getTextWidth(titol), W - 2 * M - 13), 22.5);
    }
    doc.addImage(imgLogo, "PNG", W - M - 33, 9, 33, 8, "logo", "FAST");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...C.suau);
    doc.text(`${G("titol")} · Tinker Pad`, M, H - 5);
    doc.text(String(pagina), W - M, H - 5, { align: "right" });
    return c;
  }
  /** Tarjeta con icono, título y texto. */
  function targeta(x, y, w, h, color, titol, cos, icona, mida = 10.5) {
    fill(C.paper); stroke(clar(color, 0.45)); doc.setLineWidth(0.5);
    doc.roundedRect(x, y, w, h, 3.5, 3.5, "FD");
    fill(color); doc.roundedRect(x, y, w, 2.4, 1.2, 1.2, "F");
    let ty = y + 9;
    if (icona) { fill(clar(color, 0.85)); doc.circle(x + 9.5, y + 11.5, 6.5, "F"); dibuixIcona(icona, x + 9.5, y + 11.5, 4.6, color); }
    const tx = icona ? x + 19 : x + 5;
    ty = text(titol, tx, y + 10, w - (tx - x) - 4, 11.5, C.tinta, "bold");
    if (cos) text(cos, x + 5, Math.max(ty + 1, icona ? y + 21 : ty + 1), w - 10, mida, C.tinta);
  }
  function fletxa(x1, y1, x2, y2, color, g = 1) {
    stroke(color); fill(color); doc.setLineWidth(g);
    const a = Math.atan2(y2 - y1, x2 - x1), l = 3.2;
    doc.line(x1, y1, x2 - Math.cos(a) * l * 0.8, y2 - Math.sin(a) * l * 0.8);
    doc.triangle(x2, y2, x2 - l * Math.cos(a - 0.45), y2 - l * Math.sin(a - 0.45), x2 - l * Math.cos(a + 0.45), y2 - l * Math.sin(a + 0.45), "F");
  }
  function poli(punts, estil = "F") {
    doc.lines(punts.slice(1).map((p, k) => [p[0] - punts[k][0], p[1] - punts[k][1]]), punts[0][0], punts[0][1], [1, 1], estil, true);
  }
  function engranatge(cx, cy, r, n, color) {
    const p = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, d = (Math.PI * 2) / n;
      [[r * 0.82, a], [r, a + d * 0.18], [r, a + d * 0.42], [r * 0.82, a + d * 0.6]].forEach(([rr, aa]) => p.push([cx + rr * Math.cos(aa), cy + rr * Math.sin(aa)]));
    }
    fill(color); poli(p, "F");
    fill(C.paper); doc.circle(cx, cy, r * 0.3, "F");
  }
  /** Iconos vectoriales sencillos. */
  function dibuixIcona(nom, cx, cy, s, c) {
    stroke(c); fill(c); doc.setLineWidth(s * 0.18);
    const L = (a, b, d, e) => doc.line(cx + a * s, cy + b * s, cx + d * s, cy + e * s);
    switch (nom) {
      case "pensa": case "munta": case "prova": case "millora": eines.icona(doc, nom, cx, cy, c); break;
      case "caixes": doc.rect(cx - s, cy - 0.2 * s, s * 0.9, s * 0.9, "F"); doc.rect(cx + 0.1 * s, cy - 0.2 * s, s * 0.9, s * 0.9, "F"); doc.rect(cx - 0.45 * s, cy - s, s * 0.9, s * 0.75, "F"); break;
      case "pregunta": doc.setFont("helvetica", "bold"); doc.setFontSize(s * 6); doc.setTextColor(...c); doc.text("?", cx, cy + s * 0.75, { align: "center" }); break;
      case "estrella": { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? s * 0.42 : s; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } poli(p); break; }
      case "somriure": doc.setLineWidth(s * 0.16); doc.circle(cx, cy, s, "S"); doc.circle(cx - s * 0.35, cy - s * 0.25, s * 0.12, "F"); doc.circle(cx + s * 0.35, cy - s * 0.25, s * 0.12, "F");
        { const b = []; for (let k = 0; k <= 8; k++) { const t = k / 8 - 0.5; b.push([cx + t * s * 1.1, cy + s * 0.25 + s * 0.3 * (1 - 4 * t * t)]); } poli(b, "S"); } break;
      case "recicla": for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3 - Math.PI / 2, b = a + 1.5; fletxa(cx + s * Math.cos(a), cy + s * Math.sin(a), cx + s * Math.cos(b), cy + s * Math.sin(b), c, s * 0.18); } break;
      case "persones": doc.circle(cx - s * 0.45, cy - s * 0.45, s * 0.3, "F"); doc.circle(cx + s * 0.45, cy - s * 0.45, s * 0.3, "F");
        doc.roundedRect(cx - s * 0.9, cy - s * 0.05, s * 0.8, s * 0.95, s * 0.3, s * 0.3, "F"); doc.roundedRect(cx + s * 0.1, cy - s * 0.05, s * 0.8, s * 0.95, s * 0.3, s * 0.3, "F"); break;
      case "rellotge": doc.setLineWidth(s * 0.16); doc.circle(cx, cy, s, "S"); L(0, 0, 0, -0.65); L(0, 0, 0.45, 0.2); break;
      case "lupa": doc.setLineWidth(s * 0.2); doc.circle(cx - s * 0.2, cy - s * 0.2, s * 0.6, "S"); L(0.25, 0.25, 0.9, 0.9); break;
      case "puzzle": doc.rect(cx - s, cy - s, s * 0.9, s * 0.9, "F"); doc.rect(cx + 0.1 * s, cy + 0.1 * s, s * 0.9, s * 0.9, "F"); doc.circle(cx - 0.1 * s, cy - 0.55 * s, s * 0.22, "F"); doc.circle(cx + 0.55 * s, cy + 0.1 * s, s * 0.22, "F");
        fill(clar(c, 0.5)); doc.rect(cx + 0.1 * s, cy - s, s * 0.9, s * 0.9, "F"); doc.rect(cx - s, cy + 0.1 * s, s * 0.9, s * 0.9, "F"); break;
      case "patro": [[-0.7, -0.5], [0, -0.5], [0.7, -0.5]].forEach(([a, b], k) => { if (k % 2) doc.rect(cx + a * s - s * 0.25, cy + b * s - s * 0.25, s * 0.5, s * 0.5, "F"); else doc.circle(cx + a * s, cy + b * s, s * 0.27, "F"); });
        [[-0.7, 0.4], [0, 0.4], [0.7, 0.4]].forEach(([a, b], k) => { if (k % 2) doc.rect(cx + a * s - s * 0.25, cy + b * s - s * 0.25, s * 0.5, s * 0.5, "F"); else doc.circle(cx + a * s, cy + b * s, s * 0.27, "F"); }); break;
      case "llista": for (let k = 0; k < 3; k++) { doc.circle(cx - s * 0.7, cy + (k - 1) * s * 0.65, s * 0.16, "F"); L(-0.4, (k - 1) * 0.65, 0.9, (k - 1) * 0.65); } break;
      case "error": doc.setLineWidth(s * 0.16); doc.circle(cx, cy, s, "S"); L(-0.45, -0.45, 0.45, 0.45); L(0.45, -0.45, -0.45, 0.45); break;
      case "paleta": doc.ellipse(cx, cy, s, s * 0.8, "F"); fill(C.paper); [[-0.45, -0.3], [0.05, -0.45], [0.5, -0.2], [0.35, 0.3]].forEach(([a, b]) => doc.circle(cx + a * s, cy + b * s, s * 0.14, "F")); break;
      case "engranatge": engranatge(cx, cy, s, 10, c); break;
      case "bandera": doc.setLineWidth(s * 0.16); L(-0.6, -1, -0.6, 1); poli([[cx - 0.6 * s, cy - s], [cx + s, cy - 0.55 * s], [cx - 0.6 * s, cy - 0.1 * s]]); break;
      case "diana": doc.setLineWidth(s * 0.14); doc.circle(cx, cy, s, "S"); doc.circle(cx, cy, s * 0.6, "S"); doc.circle(cx, cy, s * 0.2, "F"); break;
      case "tauleta": doc.setLineWidth(s * 0.14); doc.roundedRect(cx - s, cy - s * 0.7, s * 2, s * 1.4, s * 0.2, s * 0.2, "S"); doc.circle(cx + s * 0.8, cy, s * 0.08, "F"); break;
      case "candau": doc.roundedRect(cx - s * 0.7, cy - s * 0.1, s * 1.4, s, s * 0.2, s * 0.2, "F"); doc.setLineWidth(s * 0.2); doc.ellipse(cx, cy - s * 0.25, s * 0.45, s * 0.55, "S"); break;
      case "llibre": poli([[cx - s, cy - s * 0.7], [cx - s * 0.05, cy - s * 0.5], [cx - s * 0.05, cy + s * 0.8], [cx - s, cy + s * 0.6]]); poli([[cx + s, cy - s * 0.7], [cx + s * 0.05, cy - s * 0.5], [cx + s * 0.05, cy + s * 0.8], [cx + s, cy + s * 0.6]]); break;
      case "camera": doc.roundedRect(cx - s, cy - s * 0.55, s * 2, s * 1.3, s * 0.25, s * 0.25, "F"); doc.rect(cx - s * 0.35, cy - s * 0.8, s * 0.7, s * 0.3, "F"); fill(C.paper); doc.circle(cx, cy + s * 0.08, s * 0.42, "F"); break;
      case "taula": doc.rect(cx - s, cy - s * 0.4, s * 2, s * 0.3, "F"); doc.setLineWidth(s * 0.2); L(-0.8, -0.1, -0.8, 0.9); L(0.8, -0.1, 0.8, 0.9); break;
      case "panell": doc.setLineWidth(s * 0.14); doc.roundedRect(cx - s, cy - s * 0.8, s * 2, s * 1.6, s * 0.15, s * 0.15, "S");
        for (let a = -0.6; a <= 0.61; a += 0.4) for (let b = -0.45; b <= 0.46; b += 0.3) doc.circle(cx + a * s, cy + b * s, s * 0.06, "F"); break;
      case "eines": doc.setLineWidth(s * 0.22); L(-0.8, 0.8, 0.5, -0.5); doc.roundedRect(cx + 0.2 * s, cy - s, s * 0.8, s * 0.45, s * 0.1, s * 0.1, "F"); L(0.8, 0.8, -0.3, -0.3); break;
      case "seguretat": poli([[cx, cy - s], [cx + s * 0.85, cy - s * 0.6], [cx + s * 0.7, cy + s * 0.4], [cx, cy + s], [cx - s * 0.7, cy + s * 0.4], [cx - s * 0.85, cy - s * 0.6]]); break;
      default: doc.circle(cx, cy, s * 0.6, "F");
    }
  }
  /** Pieza 3D del repositorio (miniatura), centrada en (cx, cy), ancho w. */
  function peca(tipo, cx, cy, w) {
    const img = mini[tipo];
    if (img) doc.addImage(img, "PNG", cx - w / 2, cy - (w * 0.75) / 2, w, w * 0.75, "mini-" + tipo, "FAST");
  }
  /** Foto 3D de un reto (o dibujo si no hay foto) con marco. */
  function foto(id, x, y, w, peu) {
    const f = fotos[id], h = f ? (w * f.h) / f.w : w * 0.6;
    fill(C.paper); stroke(C.vora); doc.setLineWidth(0.6); doc.roundedRect(x - 1.5, y - 1.5, w + 3, h + 3 + (peu ? 6 : 0), 2.5, 2.5, "FD");
    if (f) doc.addImage(f.url, "JPEG", x, y, w, h, "foto-" + id, "FAST");
    else dibuixRepte(id, x, y, w);
    if (peu) text(peu, x, y + h + 4.6, w, 8, C.suau, "italic", "center");
    return y + h + 3 + (peu ? 6 : 0);
  }
  /** Reto dibujado a escala con su solución. */
  function dibuixRepte(id, x, y, w, solucio = true) {
    const r = TK.RETOS.find((q) => q.id === id);
    const d = eines.dibuixant(doc, x, y, w, TK.midaRepte(r));
    d.tauler();
    if (solucio) eines.dibuixarSolucio(d, r); else r.fijas.forEach((p) => d.peca(p, false));
    return y + d.alt;
  }
  /** Lista con viñetas de color. */
  function vinyetes(items, x, y, w, color, mida = 11.5, sep = 2) {
    items.forEach((s) => {
      fill(color); doc.circle(x + 1.6, y - mida * 0.12, 1.4, "F");
      y = text(s, x + 6, y, w - 6, mida) + sep;
    });
    return y;
  }

  /* ---------- Ilustración SVG: un rincón de tinkering en el aula ---------- */
  function svgEspai() {
    const forats = [];
    for (let x = 70; x < 430; x += 18) for (let y = 50; y < 250; y += 18) forats.push(`<circle cx="${x}" cy="${y}" r="2.3" fill="#c49a62"/>`);
    const caixa = (x, y, c) => `<rect x="${x}" y="${y}" width="58" height="34" rx="5" fill="${c}"/><rect x="${x + 6}" y="${y + 6}" width="46" height="9" rx="3" fill="#fff" opacity=".75"/>`;
    const nen = (x, c, h) => `<g transform="translate(${x} ${360 - h})"><circle cx="0" cy="0" r="17" fill="#f2c9a0"/><path d="M-17 -4 Q0 -26 17 -4" fill="#5b3a22"/><rect x="-20" y="18" width="40" height="${h - 30}" rx="16" fill="${c}"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 420">
      <rect width="800" height="420" fill="#f7ead2"/><rect y="360" width="800" height="60" fill="#d9b88a"/>
      <rect x="50" y="30" width="400" height="240" rx="12" fill="#f0d3a2" stroke="#a87b45" stroke-width="8"/>${forats.join("")}
      <g stroke="#a87b45" stroke-width="3"><rect x="90" y="70" width="140" height="14" rx="5" fill="#e9be7c" transform="rotate(12 160 77)"/>
      <rect x="200" y="125" width="140" height="14" rx="5" fill="#e9be7c" transform="rotate(12 270 132)"/></g>
      <path d="M330 170 q30 0 40 40" fill="none" stroke="#ef8a2a" stroke-width="18" stroke-linecap="round"/>
      <circle cx="105" cy="58" r="11" fill="#2f7fd8"/><circle cx="395" cy="215" r="20" fill="#e5b84a" stroke="#9c7a20" stroke-width="3"/>
      <g fill="#d9a35e" stroke="#8a5a2b" stroke-width="3"><circle cx="160" cy="215" r="32"/><circle cx="214" cy="215" r="22"/></g>
      <path d="M260 230 L320 250" stroke="#2b2b2b" stroke-width="5"/>
      <rect x="500" y="40" width="250" height="200" rx="10" fill="#c99b60"/>
      <rect x="512" y="104" width="226" height="8" fill="#a87b45"/><rect x="512" y="170" width="226" height="8" fill="#a87b45"/>
      ${caixa(516, 64, "#e2483d")}${caixa(582, 64, "#2f7fd8")}${caixa(648, 64, "#3aa55b")}
      ${caixa(516, 132, "#ffcf3f")}${caixa(582, 132, "#ef8a2a")}${caixa(648, 132, "#8f6bd6")}
      ${caixa(516, 198, "#3aa55b")}${caixa(582, 198, "#e2483d")}${caixa(648, 198, "#2f7fd8")}
      <rect x="470" y="290" width="300" height="18" rx="6" fill="#a87b45"/><rect x="490" y="306" width="14" height="56" fill="#8a5a2b"/><rect x="736" y="306" width="14" height="56" fill="#8a5a2b"/>
      <circle cx="560" cy="280" r="12" fill="#e2483d"/><rect x="600" y="270" width="80" height="12" rx="4" fill="#e9be7c" stroke="#a87b45" stroke-width="2"/>
      ${nen(150, "#3aa55b", 120)}${nen(320, "#2f7fd8", 110)}${nen(620, "#ef8a2a", 100)}
    </svg>`;
  }
  async function svgPNG(svg, w, h) {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; });
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(img, 0, 0, w, h);
    return c.toDataURL("image/png");
  }

  /* ---------- Diapositivas ---------- */
  const DIAPOS = [
    // 0 · Portada
    () => {
      diapo(0, null);
      fill(C.paper); doc.roundedRect(M, 14, 150, 139, 6, 6, "F");
      doc.addImage(imgLogo, "PNG", M + 8, 24, 134, 32, "logo", "FAST");
      let y = text(G("titol"), M + 8, 74, 134, 25, C.tinta, "bold");
      y = text(G("subtitol"), M + 8, y + 3, 134, 13, C.suau);
      fill(C.taronja); doc.roundedRect(M + 8, H - 34, 70, 9, 3, 3, "F");
      text(G("edats"), M + 8, H - 28, 70, 10, [255, 255, 255], "bold", "center");
      text("© 2026 Raúl García Antolín · CC BY-NC-SA 4.0", M + 8, H - 17, 134, 8.5, C.suau);
      foto("granMaquina", 176, 18, 107);
      foto("taulaGatillo", 176, 92, 107);
    },
    // 1 · Índice
    () => {
      diapo(0, G("index"));
      const s = G("seccions");
      s.forEach((t, k) => {
        const x = M + 8 + (k % 3) * 91, y = 32 + Math.floor(k / 3) * 62;
        fill(clar(SECCIO[k], 0.85)); doc.roundedRect(x, y, 85, 55, 4, 4, "F");
        fill(SECCIO[k]); doc.circle(x + 14, y + 15, 9, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.text(String(k + 1), x + 14, y + 20.6, { align: "center" });
        text(t, x + 6, y + 34, 74, 13, C.tinta, "bold");
        dibuixIcona(["pensa", "persones", "puzzle", "caixes", "tauleta", "diana"][k], x + 68, y + 15, 5, SECCIO[k]);
      });
    },
    // 2 · Qué es el tinkering
    () => {
      const c = diapo(0, G("s1.t"));
      let y = text(G("s1.lema"), M + 8, 36, 150, 19, c, "bold");
      y = text(G("s1.x"), M + 8, y + 3, 150, 12.5);
      G("s1.items").forEach((t, k) => {
        const x = M + 8 + k * 51;
        fill(clar(c, 0.85)); doc.roundedRect(x, y + 6, 47, 32, 4, 4, "F");
        dibuixIcona(["eines", "error", "lupa"][k], x + 23.5, y + 17, 5, c);
        text(t, x + 2, y + 30, 43, 10.5, C.tinta, "bold", "center");
      });
      // Montaje de piezas 3D, como sobre una mesa
      fill(clar(C.fusta, 0.55)); doc.roundedRect(182, 30, 101, 118, 6, 6, "F");
      [["engranaje200", 210, 55, 44], ["canica", 260, 50, 22], ["pinza", 255, 80, 34], ["goma", 214, 92, 40], ["liston", 236, 112, 54], ["pelota", 205, 132, 24], ["codo", 262, 132, 30], ["espiga", 270, 102, 16]]
        .forEach(([t, x, yy, w]) => peca(t, x, yy, w));
    },
    // 3 · Cómo es una actividad
    () => {
      const c = diapo(0, G("s2.t"));
      const ic = ["caixes", "pregunta", "estrella", "somriure", "recicla", "persones"];
      G("s2.items").forEach(([t, d], k) => targeta(M + 8 + (k % 3) * 89, 30 + Math.floor(k / 3) * 63, 84, 57, [c, C.verd, C.blau, C.lila, C.verd, C.vermell][k], t, d, ic[k], 13));
    },
    // 4 · STEAM
    () => {
      const c = diapo(0, G("s3.t"));
      const lletres = [["S", C.verd], ["T", C.blau], ["E", C.taronja], ["A", C.vermell], ["M", C.lila]];
      lletres.forEach(([l, col], k) => {
        const big = l === "E", x = M + 8 + k * 25, s = big ? 26 : 20, y = big ? 32 : 35;
        fill(col); doc.roundedRect(x, y, s, s, 3, 3, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(big ? 30 : 22); doc.setTextColor(255, 255, 255); doc.text(l, x + s / 2, y + s * 0.72, { align: "center" });
      });
      text(G("s3.x"), M + 8, 72, 125, 12.5);
      G("s3.items").forEach(([t, q], k) => {
        const y = 32 + k * 31, col = [C.verd, C.lila, C.vermell, C.blau][k];
        fill(C.paper); stroke(clar(col, 0.4)); doc.setLineWidth(0.5); doc.roundedRect(150, y, 133, 27, 4, 4, "FD");
        fill(clar(col, 0.85)); doc.circle(162, y + 13.5, 8, "F"); dibuixIcona(["lupa", "patro", "paleta", "engranatge"][k], 162, y + 13.5, 5, col);
        text(t, 174, y + 10, 104, 12, col, "bold");
        text("«" + q + "»", 174, y + 17, 104, 10.5, C.tinta, "italic");
      });
      peca("engranaje150", 48, 125, 40); peca("engranaje50", 82, 130, 26); peca("domino", 112, 125, 26);
    },
    // 5 · Exploración → reto
    () => {
      const c = diapo(1, G("s4.t"));
      const ic = ["lupa", "bandera", "diana"], col = [C.blau, C.taronja, C.verd];
      G("s4.items").forEach((t, k) => {
        const x = M + 8 + k * 92;
        fill(clar(col[k], 0.85)); doc.roundedRect(x, 32, 80, 64, 5, 5, "F");
        fill(col[k]); doc.circle(x + 40, 48, 12, "F"); dibuixIcona(ic[k], x + 40, 48, 6.5, [255, 255, 255]);
        const [tit, ...resta] = t.split(": ");
        text(tit, x + 4, 68, 72, 13, C.tinta, "bold", "center");
        text(resta.join(": "), x + 5, 76, 70, 10.5, C.tinta, "normal", "center");
        if (k < 2) fletxa(x + 81, 64, x + 91, 64, C.suau, 1.2);
      });
      text(G("s4.peu"), M + 8, 112, 150, 12, c, "bold");
      foto("espigas", 170, 104, 70);
    },
    // 6 · Secuencia
    () => {
      const c = diapo(1, G("s5.t"));
      const it = G("s5.items"), ic = ["eines", "bandera", "munta", "persones", "diana"];
      const cx = 92, cy = 92, R = 52;
      stroke(clar(c, 0.5)); doc.setLineWidth(2); doc.circle(cx, cy, R, "S");
      it.forEach(([t, d], k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / it.length, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
        fill(SECCIO[k % SECCIO.length]); doc.circle(x, y, 11, "F"); dibuixIcona(ic[k], x, y, 5.5, [255, 255, 255]);
      });
      doc.setFont("helvetica", "bold"); doc.setFontSize(30); doc.setTextColor(...c); doc.text("5", cx, cy + 6, { align: "center" });
      let y = 34;
      it.forEach(([t, d], k) => {
        fill(SECCIO[k % SECCIO.length]); doc.roundedRect(165, y - 5, 8, 8, 2, 2, "F");
        doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text(String(k + 1), 169, y + 0.8, { align: "center" });
        text(t, 177, y + 0.8, 106, 12.5, C.tinta, "bold");
        y = text(d, 177, y + 7, 106, 10.5, C.suau) + 6;
      });
    },
    // 7 · Rol del docente
    () => {
      const c = diapo(1, G("s6.t"));
      const col = [C.taronja, C.blau, C.verd], ic = ["estrella", "persones", "pensa"];
      G("s6.items").forEach(([t, d], k) => targeta(M + 8 + k * 89, 32 + (2 - k) * 8, 84, 100 - (2 - k) * 8, col[k], t, d, ic[k], 13));
      text(G("s6.peu"), M + 8, H - 12, 260, 8.5, C.suau, "italic");
    },
    // 8 · Organización
    () => {
      const c = diapo(1, G("s7.t"));
      const it = G("s7.items");
      targeta(M + 8, 30, 85, 86, C.verd, it[0][0], it[0][1], "persones", 13);
      targeta(M + 97, 30, 85, 86, C.blau, it[1][0], it[1][1], "panell", 13);
      targeta(M + 186, 30, 83, 86, C.taronja, it[2][0], it[2][1], "rellotge", 13);
      // Pastel del tiempo de una sesión
      const parts = G("s7.temps"), cols = [C.blau, C.taronja, C.verd, C.lila];
      let a0 = -Math.PI / 2;
      const cx = 52, cy = 138, r = 14;
      const tot = parts.reduce((s, p) => s + p[1], 0);
      parts.forEach(([nom, min], k) => {
        const a1 = a0 + (min / tot) * Math.PI * 2, p = [[cx, cy]];
        for (let j = 0; j <= 16; j++) { const a = a0 + ((a1 - a0) * j) / 16; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
        fill(cols[k]); poli(p);
        fill(cols[k]); doc.roundedRect(78 + (k % 2) * 95, 126 + Math.floor(k / 2) * 12, 6, 6, 1, 1, "F");
        text(`${nom} · ${min} min`, 86 + (k % 2) * 95, 131 + Math.floor(k / 2) * 12, 85, 11, C.tinta, "bold");
        a0 = a1;
      });
    },
    // 9 · Pensamiento computacional
    () => {
      const c = diapo(2, G("s8.t"));
      text(G("s8.x"), M + 8, 32, 262, 12.5, C.tinta);
      const ic = ["puzzle", "patro", "llista", "lupa"];
      G("s8.items").forEach(([t, d], k) => targeta(M + 8 + k * 67, 46, 62, 66, [C.blau, C.lila, C.taronja, C.vermell][k], t, d, ic[k], 12));
      fill(clar(c, 0.88)); doc.roundedRect(M + 8, 118, 262, 30, 4, 4, "F");
      peca("engranaje100", M + 26, 133, 26); peca("domino", M + 52, 133, 20); peca("pendulo", M + 74, 133, 22);
      text(G("s8.app"), M + 90, 128, 175, 11, c, "bold");
    },
    // 10 · PC con estructuras y engranajes
    () => {
      const c = diapo(2, G("s9.t"));
      const retos = ["campana", "bicicleta", "polea", "arregla"];
      G("s9.items").forEach(([t, d], k) => {
        const x = M + 8 + (k % 2) * 133, y = 30 + Math.floor(k / 2) * 63;
        fill(C.paper); stroke(clar(c, 0.5)); doc.setLineWidth(0.5); doc.roundedRect(x, y, 128, 58, 4, 4, "FD");
        dibuixRepte(retos[k], x + 4, y + 6, 50);
        let ty = text(t, x + 58, y + 10, 66, 11.5, c, "bold");
        text(d, x + 58, ty + 1, 66, 9.5);
      });
    },
    // 11 · Tabla por etapas
    () => {
      const c = diapo(2, G("s10.t"));
      const cap = G("s10.cap"), files = G("s10.files"), am = [52, 118, 99];
      let y = 30, x = M + 8;
      fill(c); doc.rect(x, y, 269, 9, "F");
      cap.forEach((t, k) => { text(t, x + 2 + am.slice(0, k).reduce((a, b) => a + b, 0), y + 6.2, am[k] - 4, 10.5, [255, 255, 255], "bold"); });
      y += 9;
      files.forEach((f, i) => {
        doc.setFontSize(9.5);
        const alt = Math.max(...f.map((t, k) => doc.splitTextToSize(t, am[k] - 5).length)) * 4.3 + 4.5;
        fill(i % 2 ? C.paper : clar(c, 0.9)); doc.rect(x, y, 269, alt, "F");
        fill([C.sol, C.verd, C.taronja, C.vermell, C.lila][i]); doc.rect(x, y, 2.2, alt, "F");
        f.forEach((t, k) => text(t, x + 4 + am.slice(0, k).reduce((a, b) => a + b, 0), y + 5.3, am[k] - 6, 9.5, C.tinta, k ? "normal" : "bold"));
        y += alt;
      });
    },
    // 12-14 · Un ciclo por diapositiva con su reto de ejemplo
    ...[["c1", "domino", C.verd], ["c2", "engranatgesTaula", C.taronja], ["c3", "gatillo", C.vermell]].map(([k, id, col]) => () => {
      diapo(2, G(`${k}.t`));
      fill(col); doc.roundedRect(M + 8, 28, 120, 8, 2.5, 2.5, "F");
      text(G(`${k}.edat`), M + 10, 33.6, 116, 10, [255, 255, 255], "bold");
      let y = vinyetes(G(`${k}.items`), M + 8, 46, 122, col, 12.5, 3);
      // Caja de preguntas a medida del texto
      doc.setFontSize(11.5);
      const altP = G(`${k}.preg`).reduce((s, q) => s + doc.splitTextToSize(q, 108).length * 5.4 + 2, 0) + 18;
      fill(clar(col, 0.88)); doc.roundedRect(M + 8, y + 3, 122, altP, 4, 4, "F");
      text(G("preguntes"), M + 12, y + 11, 114, 12, col, "bold");
      vinyetes(G(`${k}.preg`), M + 12, y + 19, 114, col, 11.5, 2);
      const yf = foto(id, 152, 30, 130, TK.retoTraducit(TK.RETOS.find((r) => r.id === id)).nom);
      text(G(`${k}.repte`), 152, yf + 5, 130, 10, C.suau);
    }),
    // 15 · Espacio de tinkering
    () => {
      const c = diapo(3, G("s14.t"));
      text(G("s14.x"), M + 8, 32, 128, 12);
      doc.addImage(imgEspai, "PNG", M + 8, 52, 128, 67, "espai", "FAST");
      G("s14.items").forEach(([t, d], k) => targeta(150, 30 + k * 31, 133, 28, [C.fustaFosca, C.blau, C.verd, C.taronja][k], t, d, ["panell", "caixes", "taula", "camera"][k], 9.5));
    },
    // 16-17 · Materiales con piezas 3D
    ...["s15", "s16"].map((k) => () => {
      const c = diapo(3, G(`${k}.t`));
      G(`${k}.items`).forEach(([tipus, t, d], i) => {
        const x = M + 8 + (i % 4) * 67, y = 30 + Math.floor(i / 4) * 63;
        fill(C.paper); stroke(C.vora); doc.setLineWidth(0.5); doc.roundedRect(x, y, 63, 58, 4, 4, "FD");
        fill(clar(C.fusta, 0.75)); doc.roundedRect(x + 3, y + 3, 57, 24, 3, 3, "F");
        tipus.split(",").forEach((tp, j, arr) => peca(tp, x + 31.5 + (j - (arr.length - 1) / 2) * 20, y + 15, arr.length > 1 ? 22 : 34));
        const ty = text(t, x + 4, y + 33, 55, 10.5, c, "bold");
        text(d, x + 4, ty + 0.5, 55, 8.6);
      });
    }),
    // 18 · Kit para empezar
    () => {
      const c = diapo(3, G("s17.t"));
      text(G("s17.x"), M + 8, 32, 262, 11.5);
      const it = G("s17.items"), meitat = Math.ceil(it.length / 2);
      it.forEach(([tipus, t], i) => {
        const x = M + 8 + (i < meitat ? 0 : 134), y = 44 + (i % meitat) * 15;
        fill(i % 2 ? C.paper : clar(c, 0.9)); doc.roundedRect(x, y - 6, 128, 13.5, 2.5, 2.5, "F");
        peca(tipus, x + 10, y + 0.7, 16);
        text(t, x + 21, y + 2, 104, 9.8);
      });
    },
    // 19 · Consejos prácticos
    () => {
      const c = diapo(3, G("s18.t"));
      const ic = ["recicla", "caixes", "persones", "seguretat", "camera", "estrella"];
      G("s18.items").forEach(([t, d], k) => targeta(M + 8 + (k % 3) * 89, 30 + Math.floor(k / 3) * 63, 84, 57, [C.verd, C.blau, C.taronja, C.vermell, C.lila, C.fustaFosca][k], t, d, ic[k], 12.5));
    },
    // 20 · Tinker Pad
    () => {
      const c = diapo(4, G("s19.t"));
      let y = text(G("s19.x"), M + 8, 32, 122, 12);
      vinyetes(G("s19.items"), M + 8, y + 4, 122, c, 11, 2.2);
      // Tableta con una foto del juego
      fill([45, 45, 52]); doc.roundedRect(146, 30, 140, 92, 7, 7, "F");
      const f = fotos.campana;
      if (f) doc.addImage(f.url, "JPEG", 152, 36, 128, 80, "foto-campana", "FAST");
      fill([90, 90, 98]); doc.circle(283, 76, 1.4, "F");
      peca("liston", 170, 140, 34); peca("espiga", 205, 140, 18); peca("canica", 232, 140, 16); peca("campana", 262, 138, 28);
    },
    // 21 · Cómo usar Tinker Pad en clase
    () => {
      const c = diapo(4, G("s20.t"));
      const ic = ["tauleta", "pensa", "munta", "prova", "diana"];
      G("s20.items").forEach(([t, d], k) => {
        const x = M + 8 + k * 54;
        fill(clar(SECCIO[k], 0.86)); doc.roundedRect(x, 32, 49, 82, 4, 4, "F");
        fill(SECCIO[k]); doc.circle(x + 24.5, 46, 10, "F"); dibuixIcona(ic[k], x + 24.5, 46, 5.4, [255, 255, 255]);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...SECCIO[k]); doc.text(String(k + 1), x + 4, 38);
        const ty = text(t, x + 3, 64, 43, 11, C.tinta, "bold", "center");
        text(d, x + 4, ty + 1, 41, 9.5, C.tinta, "normal", "center");
        if (k < 4) fletxa(x + 49.5, 46, x + 53.5, 46, C.suau, 0.8);
      });
      fill(c); doc.roundedRect(M + 8, 122, 266, 22, 4, 4, "F");
      dibuixIcona("eines", M + 20, 133, 5, [255, 255, 255]);
      text(G("s20.nota"), M + 32, 131, 236, 12.5, [255, 255, 255], "bold");
    },
    // 22 · Tres maneras
    () => {
      const c = diapo(4, G("s21.t"));
      const fotosId = ["engranatgesTaula", "bicicleta", null];
      G("s21.items").forEach(([t, d], k) => {
        const x = M + 8 + k * 89;
        fill(C.paper); stroke(clar(c, 0.5)); doc.setLineWidth(0.5); doc.roundedRect(x, 30, 84, 118, 4, 4, "FD");
        if (fotosId[k]) foto(fotosId[k], x + 5, 36, 74);
        else { fill(clar(C.fusta, 0.6)); doc.roundedRect(x + 5, 36, 74, 46, 3, 3, "F"); ["engranaje200", "coche", "palanca", "cono"].forEach((p, j) => peca(p, x + 18 + (j % 2) * 40, 48 + Math.floor(j / 2) * 22, 30)); }
        const ty = text(t, x + 5, 96, 74, 14, c, "bold");
        text(d, x + 5, ty + 2, 74, 12.5);
      });
    },
    // 23 · Los 30 retos
    () => {
      const c = diapo(4, G("s22.t"));
      text(G("s22.x"), M + 8, 31, 262, 11);
      TK.DIFICULTATS.forEach((d, k) => {
        const x = M + 8 + k * 89, col = TK.Fitxa.eines.colorDif[d.id];
        fill(col); doc.roundedRect(x, 38, 84, 10, 3, 3, "F");
        text(`${TK.nomDificultat(d.id)} · ${TK.t("edat_" + d.id)}`, x + 3, 44.6, 78, 10, [255, 255, 255], "bold");
        TK.RETOS.filter((r) => r.dificultat === d.id).forEach((r, i) => {
          const y = 51 + i * 10.4;
          fill(i % 2 ? C.paper : clar(col, 0.9)); doc.rect(x, y, 84, 10.4, "F");
          peca(r.icono, x + 7, y + 5.2, 11);
          text(`${r.num}. ${TK.retoTraducit(r).nom}${r.mesa ? " · " + TK.t("taula") : ""}`, x + 14, y + 6.6, 69, 9);
        });
      });
    },
    // 24 · Fichas por edad
    () => {
      const c = diapo(5, G("s23.t"));
      G("s23.items").forEach(([t, d], k) => {
        const x = M + 8 + k * 89, col = [C.verd, C.taronja, C.vermell][k];
        // Miniatura de una ficha
        fill([255, 255, 255]); stroke(C.vora); doc.setLineWidth(0.5); doc.rect(x + 22, 30, 40, 56, "FD");
        fill(col); doc.rect(x + 46, 32, 14, 3.5, "F");
        fill(clar(C.fusta, 0.6)); doc.rect(x + 25, 40, 34, 19, "F");
        if (k === 0) { [0, 1, 2, 3].forEach((j) => { fill(clar(col, 0.7)); doc.roundedRect(x + 25 + j * 8.6, 63, 7.6, 7, 1, 1, "F"); }); [0, 1, 2].forEach((j) => eines.cara(doc, x + 30 + j * 12, 78, 4, j)); }
        else { stroke(C.vora); for (let j = 0; j < (k === 1 ? 6 : 4); j++) doc.line(x + 25, 64 + j * 3.6, x + 59, 64 + j * 3.6); if (k === 2) { doc.rect(x + 25, 79, 34, 5); doc.line(x + 36, 79, x + 36, 84); doc.line(x + 47, 79, x + 47, 84); } }
        const ty = text(t, x, 96, 84, 13, col, "bold", "center");
        text(d, x + 3, ty + 1, 78, 10.5, C.tinta, "normal", "center");
      });
    },
    // 25 · Evaluar
    () => {
      const c = diapo(5, G("s24.t"));
      G("s24.items").forEach(([t, d], k) => targeta(M + 8 + (k % 2) * 70, 30 + Math.floor(k / 2) * 56, 66, 51, [C.blau, C.vermell, C.verd, C.taronja][k], t, d, ["lupa", "llista", "somriure", "camera"][k], 12));
      // Rúbrica en miniatura
      const x = 160, y = 34, cols = [C.fusta, ...[0.85, 0.65, 0.45, 0.2].map((v) => clar(C.vermell, v))];
      cols.forEach((col, k) => { fill(col); doc.rect(x + k * 24.6, y, 24.6, 8, "F"); });
      for (let f = 0; f < 5; f++) for (let k = 0; k < 5; k++) { fill(k ? [255, 255, 255] : clar(C.fusta, 0.8)); stroke(C.vora); doc.rect(x + k * 24.6, y + 8 + f * 13, 24.6, 13, "FD"); }
      fill(C.verd); [[2, 0], [3, 1], [2, 2], [4, 3], [3, 4]].forEach(([k, f]) => { doc.circle(x + k * 24.6 + 12.3, y + 14.5 + f * 13, 2.6, "F"); });
      text(G("s24.x"), x, y + 82, 123, 10, C.suau);
      G("s24.criteris").forEach((t, f) => text(t, x + 1.5, y + 13.6 + f * 13, 22, 6.5, C.tinta, "bold"));
    },
    // 26 · Zona docente
    () => {
      const c = diapo(5, G("s25.t"));
      fill(clar(c, 0.88)); doc.roundedRect(M + 8, 30, 120, 118, 5, 5, "F");
      fill(c); doc.circle(M + 68, 66, 22, "F"); dibuixIcona("candau", M + 68, 66, 11, [255, 255, 255]);
      text(G("s25.clau"), M + 14, 102, 108, 12, C.tinta, "bold", "center");
      text(G("s25.x"), M + 14, 118, 108, 10.5, C.suau, "normal", "center");
      let y = 34;
      G("s25.items").forEach(([t, d], k) => {
        const col = [C.verd, C.taronja, C.vermell, C.docent][k];
        fill(C.paper); stroke(clar(col, 0.4)); doc.setLineWidth(0.5); doc.roundedRect(150, y, 133, 26, 4, 4, "FD");
        fill(clar(col, 0.85)); doc.circle(162, y + 13, 8, "F"); dibuixIcona(["llista", "lupa", "diana", "llibre"][k], 162, y + 13, 5, col);
        const ty = text(t, 174, y + 10, 105, 11.5, col, "bold");
        text(d, 174, ty + 0.5, 105, 9.5);
        y += 29;
      });
    },
    // 27 · Para saber más
    () => {
      const c = diapo(5, G("s26.t"));
      vinyetes(G("s26.items"), M + 8, 38, 175, c, 13, 5);
      peca("pinza", 238, 50, 40); peca("engranaje150", 252, 88, 44); peca("corcho", 222, 120, 24); peca("cono", 262, 128, 30);
    },
    // 28 · Cierre
    () => {
      diapo(5, null);
      doc.addImage(imgLogo, "PNG", (W - 160) / 2, 30, 160, 38.5, "logo", "FAST");
      text(G("s27.t"), M, 92, W - 2 * M, 26, C.tinta, "bold", "center");
      text(G("s27.x"), M, 106, W - 2 * M, 15, C.suau, "normal", "center");
      ["liston", "canica", "engranaje100", "goma", "pinza", "domino", "pelota", "codo"].forEach((t, k) => peca(t, 45 + k * 29, 135, 24));
    },
  ];

  /** Genera la guía (Blob PDF) en el idioma actual. */
  async function generar(miniaturas) {
    eines = TK.Fitxa.eines;
    mini = miniaturas;
    imgLogo = await eines.logo();
    imgEspai = await svgPNG(svgEspai(), 1200, 630);
    // Fotos 3D de retos montados (si el juego está cargado)
    fotos = {};
    if (TK.juego && TK.juego.captura) {
      for (const id of ["granMaquina", "taulaGatillo", "espigas", "domino", "engranatgesTaula", "bicicleta", "gatillo", "campana"]) {
        const k = TK.RETOS.findIndex((r) => r.id === id);
        try {
          // La captura siempre es 16:10
          fotos[id] = { url: TK.juego.captura(k, true, 1100), w: 16, h: 10 };
        } catch (e) { console.warn("captura", id, e); }
      }
    }
    doc = new window.jspdf.jsPDF({ unit: "mm", format: [H, W], orientation: "landscape", compress: true });
    pagina = 0;
    DIAPOS.forEach((d) => d());
    return doc.output("blob");
  }
  const nom = () => `tinkerpad-guia-${TK.idioma}.pdf`;
  TK.Guia = {
    generar,
    veure: (miniaturas) => eines0().veure(G("titol"), () => generar(miniaturas), nom()),
    descarregar: async (miniaturas) => eines0().guardar(await generar(miniaturas), nom()),
    titol: () => G("titol"),
  };
  const eines0 = () => TK.Fitxa.eines;
})();
