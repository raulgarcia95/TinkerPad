/* =====================================================================
   tutorial.js — Tutorial básico de uso (se abre desde la portada).

   Ilumina una parte de la pantalla cada vez (el resto queda oscuro) y la
   explica con una frase corta. Los gestos con los dedos llevan una mano
   animada. Pasos: cajas de piezas, arrastrar al tablero, mover y elegir,
   girar y quitar, girar con dos dedos, pellizcar para el zoom, botones de
   zoom, gomas / pinzas / cadenas, engranajes y manivela, Play y volver a
   montar, el reto y la pista, y la casa.

   Textos: TK.t("tut1") ... (js/textos/<idioma>.js).
   ===================================================================== */
(function () {
  const $ = (s) => document.querySelector(s);
  /** Rectángulo que une varios elementos (para iluminar un grupo de botones). */
  function caixa(...sels) {
    const rs = sels.map((s) => $(s)).filter((e) => e && !e.hidden && e.offsetParent !== null).map((e) => e.getBoundingClientRect());
    if (!rs.length) return null;
    const l = Math.min(...rs.map((r) => r.left)), t = Math.min(...rs.map((r) => r.top));
    return { left: l, top: t, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - t };
  }
  /** Zona central del tablero (para los gestos sobre él). */
  function tauler() {
    const r = $("#lienzo").getBoundingClientRect(), m = 0.2;
    // Deja sitio debajo para la burbuja
    return { left: r.left + r.width * m, top: r.top + r.height * 0.12, width: r.width * (1 - 2 * m), height: r.height * 0.52 };
  }
  const MA = '<path d="M20 30V14a3 3 0 0 1 6 0v12h1V10a3 3 0 0 1 6 0v16h1V13a3 3 0 0 1 6 0v19c0 8-5 14-13 14-5 0-9-3-11-7l-5-9a3 3 0 0 1 5-3l4 5z" fill="#fff" stroke="#3f2c1d" stroke-width="2.2" stroke-linejoin="round"/>';
  // Gestos animados (CSS): un dedo que arrastra, dos que se separan, dos que giran
  const GESTOS = {
    arrossegar: `<svg class="tut-gest g-arr" viewBox="0 0 64 64" aria-hidden="true"><g class="g-ma">${MA}</g></svg>`,
    pessic: `<svg class="tut-gest g-pes" viewBox="0 0 64 64" aria-hidden="true"><circle class="d1" cx="24" cy="32" r="6" fill="#ffcf3f" stroke="#3f2c1d" stroke-width="2"/><circle class="d2" cx="40" cy="32" r="6" fill="#ffcf3f" stroke="#3f2c1d" stroke-width="2"/><path d="M8 32h8M48 32h8" stroke="#3f2c1d" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="2 4"/></svg>`,
    girar: `<svg class="tut-gest g-gir" viewBox="0 0 64 64" aria-hidden="true"><g class="g-par"><circle cx="20" cy="32" r="6" fill="#ffcf3f" stroke="#3f2c1d" stroke-width="2"/><circle cx="44" cy="32" r="6" fill="#ffcf3f" stroke="#3f2c1d" stroke-width="2"/></g><path d="M32 10a22 22 0 0 1 20 14" fill="none" stroke="#3f2c1d" stroke-width="2.5" stroke-linecap="round"/><path d="M52 16v8h-8" fill="none" stroke="#3f2c1d" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    tocar: `<svg class="tut-gest g-toc" viewBox="0 0 64 64" aria-hidden="true"><circle class="ona" cx="23" cy="14" r="10" fill="none" stroke="#ffcf3f" stroke-width="3"/><g>${MA}</g></svg>`,
  };
  // Cada paso: qué se ilumina y qué se dice (y un gesto, si hace falta)
  const PASSOS = [
    { zona: () => [caixa("#caixes-esq"), caixa("#caixes-dre")], text: "tut1", gest: "tocar" },
    { zona: tauler, text: "tut2", gest: "arrossegar" },
    { zona: tauler, text: "tut3", gest: "arrossegar" },
    { zona: () => caixa("#btn-izq", "#btn-der", "#btn-borrar"), text: "tut4" },
    { zona: tauler, text: "tut5", gest: "girar" },
    { zona: tauler, text: "tut6", gest: "pessic" },
    { zona: () => caixa("#zoom"), text: "tut7" },
    { zona: () => caixa('.caixa[data-cat="espigues"]'), text: "tut8", gest: "tocar" },
    { zona: () => caixa('.caixa[data-cat="engranatges"]'), text: "tut9" },
    { zona: () => caixa("#btn-play", "#btn-reiniciar"), text: "tut10" },
    { zona: () => caixa("#tarjeta-reto"), text: "tut11" },
    { zona: () => caixa("#barra-casa"), text: "tut12" },
  ];

  let el = null, pas = 0;
  function pintar() {
    const p = PASSOS[pas], marge = 8;
    // Una o varias zonas iluminadas (el resto, oscuro): máscara SVG con agujeros
    const zones = [].concat(p.zona() || tauler()).filter(Boolean).map((z) => ({ left: z.left - marge, top: z.top - marge, width: z.width + 2 * marge, height: z.height + 2 * marge }));
    const llum = { left: Math.min(...zones.map((z) => z.left)), top: Math.min(...zones.map((z) => z.top)) };
    llum.width = Math.max(...zones.map((z) => z.left + z.width)) - llum.left;
    llum.height = Math.max(...zones.map((z) => z.top + z.height)) - llum.top;
    const forats = zones.map((z) => `<rect x="${z.left}" y="${z.top}" width="${z.width}" height="${z.height}" rx="18" fill="#000"/>`).join("");
    const vores = zones.map((z) => `<rect x="${z.left}" y="${z.top}" width="${z.width}" height="${z.height}" rx="18" fill="none" stroke="#ffcf3f" stroke-width="3"/>`).join("");
    const ultim = pas === PASSOS.length - 1;
    el.innerHTML = `<svg class="tut-fosc" width="${innerWidth}" height="${innerHeight}" aria-hidden="true"><defs><mask id="tut-mask"><rect width="100%" height="100%" fill="#fff"/>${forats}</mask></defs>
        <rect width="100%" height="100%" fill="rgba(30,20,10,.62)" mask="url(#tut-mask)"/>${vores}</svg>
      <div class="tut-bafarada" role="dialog" aria-live="polite">
        ${p.gest ? GESTOS[p.gest] : ""}
        <p>${TK.t(p.text)}</p>
        <div class="tut-peu"><span class="tut-num">${pas + 1}/${PASSOS.length}</span>
          ${ultim ? "" : `<button class="tut-salta" data-tut="fi">${TK.t("tutSalta")}</button>`}
          <button class="boton verde" data-tut="seg">${TK.t(ultim ? "tutFi" : "seguent")}</button></div>
      </div>`;
    // La burbuja va al lado con más sitio (debajo, encima, a un lado)
    const b = el.querySelector(".tut-bafarada"), W = innerWidth, H = innerHeight, bw = b.offsetWidth, bh = b.offsetHeight;
    let x, y;
    if (llum.top + llum.height + bh + 16 < H) { y = llum.top + llum.height + 12; x = llum.left + llum.width / 2 - bw / 2; }
    else if (llum.top - bh - 16 > 0) { y = llum.top - bh - 12; x = llum.left + llum.width / 2 - bw / 2; }
    else { y = llum.top + llum.height / 2 - bh / 2; x = llum.left + llum.width + 12 + bw < W ? llum.left + llum.width + 12 : llum.left - bw - 12; }
    b.style.left = Math.max(10, Math.min(W - bw - 10, x)) + "px";
    b.style.top = Math.max(10, Math.min(H - bh - 10, y)) + "px";
    b.querySelector("[data-tut='seg']").focus();
  }
  function tancar() { if (el) { el.remove(); el = null; } removeEventListener("resize", pintar); }
  function iniciar() {
    tancar();
    pas = 0;
    el = document.createElement("div");
    el.className = "tutorial";
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tut]");
      if (!b) return;
      TK.audio.clic();
      if (b.dataset.tut === "fi" || pas === PASSOS.length - 1) return tancar();
      pas++;
      pintar();
    });
    document.body.appendChild(el);
    addEventListener("resize", pintar);
    pintar();
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && el) tancar(); });
  TK.Tutorial = { iniciar, tancar };
})();
