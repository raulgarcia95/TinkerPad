/* =====================================================================
   portada.js — Pantalla de inicio de Tinker Pad, progreso y zona docente.

   - Inici: logotipo, idioma, tres dificultades (fácil, medio, difícil),
     taller libre (panel o mesa) y zona docente.
   - Llista: los retos de una dificultad con su estado:
       marca verde   = superado
       marca naranja = intentado y dejado sin superar
       sin marca     = todavía no se ha hecho
   - Zona docent: fichas en papel (PDF) de cada reto o de toda una
     dificultad, y borrar el progreso de la tablet.

   El progreso se guarda en este navegador (localStorage):
     tinkering-superados   ids de retos superados
     tinkering-intentats   ids de retos intentados sin superar
   ===================================================================== */
(function () {
  /* ---------- Progreso ---------- */
  const CLAVES = { superats: "tinkering-superados", intentats: "tinkering-intentats" };
  function leer(clave) {
    try { return JSON.parse(localStorage.getItem(clave) || "[]"); } catch (e) { return []; }
  }
  function escribir(clave, lista) {
    try { localStorage.setItem(clave, JSON.stringify(lista)); } catch (e) { /* sin almacenamiento */ }
  }
  TK.Progres = {
    superat: (id) => leer(CLAVES.superats).includes(id),
    intentat: (id) => leer(CLAVES.intentats).includes(id),
    superar(id) {
      const s = leer(CLAVES.superats);
      if (!s.includes(id)) escribir(CLAVES.superats, [...s, id]);
      escribir(CLAVES.intentats, leer(CLAVES.intentats).filter((x) => x !== id));
    },
    intentar(id) {
      const i = leer(CLAVES.intentats);
      if (!i.includes(id)) escribir(CLAVES.intentats, [...i, id]);
    },
    esborrar() { escribir(CLAVES.superats, []); escribir(CLAVES.intentats, []); },
  };

  /* ---------- Logotipo: "Tinker Pad" hecho con piezas del juego ----------
     Cada letra está construida con materiales del panel: listones de
     madera clavados con espigas, una canica (punto de la i), un tubo
     corrugado (n), una goma elástica entre espigas (e), una pinza (r), un
     engranaje (P), una bola de corcho (a) y una pelota de goma (d). */
  function engranaje(cx, cy, r, n) {
    let d = "";
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, p = (Math.PI * 2) / n;
      const pts = [[r - 5, a], [r + 4, a + p * 0.18], [r + 4, a + p * 0.42], [r - 5, a + p * 0.6]];
      d += pts.map(([rr, aa], j) => `${k === 0 && j === 0 ? "M" : "L"}${(cx + rr * Math.cos(aa)).toFixed(1)},${(cy + rr * Math.sin(aa)).toFixed(1)}`).join("");
    }
    return d + "Z";
  }
  const listo = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#lgFusta)" stroke="#9a6a35" stroke-width="1.5"/>`;
  const barra = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#9a6a35" stroke-width="19" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#lgFusta)" stroke-width="16" stroke-linecap="round"/>`;
  const espiga = (x, y) => `<circle cx="${x}" cy="${y}" r="5" fill="#f3dcae" stroke="#a87b45" stroke-width="1.6"/>`;
  function logo() {
    return `<svg class="pt-logo" viewBox="0 0 770 186" role="img" aria-label="Tinker Pad">
      <defs>
        <linearGradient id="lgFusta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0c98a"/><stop offset="1" stop-color="#d9a35e"/></linearGradient>
        <radialGradient id="lgVidre" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#9fd3f2"/><stop offset="1" stop-color="#2f7fd8"/></radialGradient>
        <radialGradient id="lgSuro" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e7c08e"/><stop offset="1" stop-color="#b0804b"/></radialGradient>
        <radialGradient id="lgGoma" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffb3a1"/><stop offset="1" stop-color="#e2483d"/></radialGradient>
        <pattern id="lgForats" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="2.2" fill="#c49a62"/></pattern>
      </defs>
      <rect x="4" y="18" width="762" height="164" rx="22" fill="#f2dcb3"/><rect x="4" y="18" width="762" height="164" rx="22" fill="url(#lgForats)"/>
      <rect x="4" y="18" width="762" height="164" rx="22" fill="none" stroke="#c99b60" stroke-width="4"/>
      <!-- T -->${listo(22, 34, 84, 19)}${listo(54, 34, 19, 132)}${espiga(63, 43)}${espiga(63, 154)}
      <!-- i -->${listo(122, 86, 19, 80)}${espiga(131, 154)}<circle cx="131" cy="60" r="13" fill="url(#lgVidre)" stroke="#2a6bb8" stroke-width="1.5"/><path d="M125 58q4-6 11-2" stroke="#e2483d" stroke-width="3" fill="none" stroke-linecap="round"/>
      <!-- n: listones + tubo corrugado en arco -->${listo(157, 86, 19, 80)}${listo(209, 104, 19, 62)}
        <path d="M166 112 A26 26 0 0 1 218 112" fill="none" stroke="#ef8a2a" stroke-width="17" stroke-linecap="round"/>
        <path d="M166 112 A26 26 0 0 1 218 112" fill="none" stroke="#c86a14" stroke-width="17" stroke-dasharray="2 5"/>${espiga(166, 154)}${espiga(218, 154)}
      <!-- k -->${listo(246, 34, 19, 132)}${barra(258, 122, 298, 88)}${barra(258, 122, 300, 158)}${espiga(256, 122)}${espiga(255, 43)}
      <!-- e: goma elástica tensada entre espigas -->
        <path d="M322 124 L388 124 A33 33 0 1 0 378 148" fill="none" stroke="#2b2b2b" stroke-width="9" stroke-linecap="round"/>
        ${espiga(322, 124)}${espiga(388, 124)}${espiga(378, 148)}
      <!-- r: listón + pinza -->${listo(404, 86, 19, 80)}${espiga(413, 154)}
        <g transform="translate(414 98) rotate(-18)"><rect x="0" y="-9" width="46" height="7" rx="3" fill="url(#lgFusta)" stroke="#9a6a35"/><rect x="0" y="2" width="46" height="7" rx="3" fill="url(#lgFusta)" stroke="#9a6a35"/><circle cx="20" cy="0" r="5" fill="#8a8f98" stroke="#5d626b"/></g>
      <g transform="translate(30 0)">
      <!-- P: listón + engranaje -->${listo(482, 34, 19, 132)}
        <path d="${engranaje(526, 78, 36, 12)}" fill="url(#lgFusta)" stroke="#9a6a35" stroke-width="1.5"/><circle cx="526" cy="78" r="13" fill="#f2dcb3" stroke="#9a6a35" stroke-width="1.5"/>${espiga(526, 78)}${espiga(491, 154)}
      <!-- a: bola de corcho + listón -->
        <circle cx="597" cy="128" r="31" fill="url(#lgSuro)" stroke="#8f6232" stroke-width="1.5"/>
        <g fill="#8f6232" opacity=".55"><circle cx="587" cy="118" r="2"/><circle cx="604" cy="134" r="2.4"/><circle cx="592" cy="142" r="1.6"/><circle cx="610" cy="116" r="1.7"/></g>${listo(624, 96, 18, 70)}${espiga(633, 154)}
      <!-- d: pelota de goma + listón alto -->
        <circle cx="684" cy="130" r="29" fill="url(#lgGoma)" stroke="#b8322a" stroke-width="1.5"/>${listo(708, 34, 18, 132)}${espiga(717, 43)}${espiga(717, 154)}
      </g>
    </svg>`;
  }

  /* ---------- Iconos ---------- */
  const ICONO = {
    panell: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><g fill="currentColor"><circle cx="8" cy="8" r="1.2"/><circle cx="12" cy="8" r="1.2"/><circle cx="16" cy="8" r="1.2"/><circle cx="8" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="16" cy="12" r="1.2"/><circle cx="8" cy="16" r="1.2"/><circle cx="12" cy="16" r="1.2"/><circle cx="16" cy="16" r="1.2"/></g></svg>',
    taula: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 9.5 7 5h10l4.5 4.5z" fill="currentColor"/><path d="M4 9.5v9M20 9.5v9M7 9.5v6M17 9.5v6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    enrere: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    docent: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 2.5h9l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 20V4A1.5 1.5 0 0 1 6 2.5zm8 1.5v4h4z"/><path d="M8 12h8M8 15.5h8M8 19h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>',
    pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3a1.4 1.4 0 0 1 1.4 1.4v8.2l2.6-2.6a1.4 1.4 0 1 1 2 2L13 17a1.4 1.4 0 0 1-2 0l-5-5a1.4 1.4 0 1 1 2-2l2.6 2.6V4.4A1.4 1.4 0 0 1 12 3zM4.5 18.5h15a1.3 1.3 0 0 1 0 2.6h-15a1.3 1.3 0 0 1 0-2.6z"/></svg>',
    estrella: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>',
    llibre: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 5.2c2.9-.9 5.9-.8 8.2.9v13.4c-2.3-1.5-5.3-1.7-8.2-.9zM21 5.2c-2.9-.9-5.9-.8-8.2.9v13.4c2.3-1.5 5.3-1.7 8.2-.9z"/></svg>',
    ma: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 11V4.5a1.5 1.5 0 0 1 3 0V10h.5V3.5a1.5 1.5 0 0 1 3 0V10h.5V5a1.5 1.5 0 0 1 3 0v8.5c0 4-2.7 7-6.5 7-2.6 0-4.3-1.2-5.6-3.3L4.2 13a1.5 1.5 0 0 1 2.5-1.6L8.5 14V11z"/></svg>',
    ull: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>',
    mon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  };

  let el, opciones, vista = "inici", dificultatActual = null;

  const marca = (id) => (TK.Progres.superat(id) ? "superat" : TK.Progres.intentat(id) ? "intentat" : "");
  const indices = (dif) => TK.RETOS.map((r, k) => [r, k]).filter(([r]) => r.dificultat === dif);
  const t = TK.t;

  /* Banderitas (SVG sencillos: las de Cataluña, Galicia y Euskadi no existen como emoji) */
  const BANDERA = {
    ca: '<rect width="30" height="20" fill="#fcdd09"/><g fill="#da121a"><rect y="2.2" width="30" height="2.2"/><rect y="6.7" width="30" height="2.2"/><rect y="11.1" width="30" height="2.2"/><rect y="15.6" width="30" height="2.2"/></g>',
    es: '<rect width="30" height="20" fill="#c60b1e"/><rect y="5" width="30" height="10" fill="#ffc400"/>',
    gl: '<rect width="30" height="20" fill="#fff"/><path d="M0 0h4l26 17.3V20h-4L0 2.7z" fill="#0099cc"/>',
    eu: '<rect width="30" height="20" fill="#d52b1e"/><path d="M0 0l30 20M30 0L0 20" stroke="#009b48" stroke-width="3"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="3"/>',
    en: '<rect width="30" height="20" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.5"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.5"/>',
    fr: '<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#002395"/><rect x="20" width="10" height="20" fill="#ed2939"/>',
  };
  const bandera = (codi) => `<svg class="pt-bandera" viewBox="0 0 30 20" aria-hidden="true">${BANDERA[codi]}</svg>`;
  let menuObert = false;

  /** Barra superior: zona docente (izquierda), sonido e idioma (derecha). */
  const barraSuperior = () => `<div class="pt-dalt">
      ${vista === "docent" || vista === "clau" ? "<span></span>" : `<button class="pt-docent-dalt" data-docent>${ICONO.docent}<span>${t("zonaDocent")}</span></button>`}
      <div class="pt-dalt-dreta">
        <button class="pt-globus pt-so" data-so aria-pressed="${TK.audio.silenciat()}" aria-label="${t("silenci")}" title="${t("silenci")}">${TK.iconoSo(TK.audio.silenciat())}</button>
        ${selectorIdioma()}
      </div></div>`;
  /** Pie: licencia Creative Commons y autoría (el nombre enlaza al correo del autor). */
  const peu = () => `<footer class="pt-peu">
      <a class="pt-cc" href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.${TK.idioma}" target="_blank" rel="noopener" title="${t("llicencia")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.6 9.6a3 3 0 1 0 0 4.8M16.6 9.6a3 3 0 1 0 0 4.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>BY-NC-SA 4.0</a>
      <span>© <a href="mailto:rgarci95@xtec.cat">Raúl García Antolín</a> · 2026</span>
    </footer>`;

  /** Selector de idioma discreto: botón con el globo y la bandera; al tocarlo, un desplegable. */
  const selectorIdioma = () => `<div class="pt-idiomes">
      <button class="pt-globus" data-menu-idioma aria-haspopup="true" aria-expanded="${menuObert}" aria-label="${t("idioma")}" title="${t("idioma")}">${ICONO.mon}${bandera(TK.idioma)}</button>
      <div class="pt-menu-idioma" role="menu" ${menuObert ? "" : "hidden"}>
        ${TK.IDIOMES.map((i) => `<button role="menuitemradio" class="pt-idioma" data-idioma="${i.codi}" lang="${i.codi}" aria-checked="${i.codi === TK.idioma}">${bandera(i.codi)}<span>${i.nom}</span></button>`).join("")}
      </div></div>`;

  function pintarInici() {
    const tarjetas = TK.DIFICULTATS.map((d, n) => {
      const llista = indices(d.id), fets = llista.filter(([r]) => TK.Progres.superat(r.id)).length;
      return `<button class="pt-dif" data-dif="${d.id}" style="--c:${d.color};--c2:${d.fons}">
        <span class="pt-estrelles">${ICONO.estrella.repeat(n + 1)}</span>
        <span class="pt-dif-nom">${TK.nomDificultat(d.id)}</span>
        <span class="pt-dif-desc">${TK.descDificultat(d.id)}</span>
        <span class="pt-progres"><span class="pt-barra"><span style="width:${(100 * fets) / Math.max(1, llista.length)}%"></span></span>${t("deTotal", { a: fets, b: llista.length })}</span>
      </button>`;
    }).join("");
    el.innerHTML = `${barraSuperior()}<div class="pt-cap"><h1>${logo()}</h1><p>${t("lema")}</p></div>
      <div class="pt-difs">${tarjetas}</div>
      <div class="pt-extra">
        <button class="pt-boto" data-lliure="panell">${ICONO.panell}<span>${t("tallerLliure")}<small>${t("alPanell")}</small></span></button>
        <button class="pt-boto taula" data-lliure="taula">${ICONO.taula}<span>${t("tallerLliure")}<small>${t("aLaTaula")}</small></span></button>
        <button class="pt-boto tut" data-tut>${ICONO.ma}<span>${t("tutBoto")}<small>${t("tutSub")}</small></span></button>
      </div>${peu()}`;
  }

  function targetaReto([r, k]) {
    const m = marca(r.id), tr = TK.retoTraducit(r);
    return `<button class="pt-reto ${m}${r.mesa ? " mesa" : ""}" data-reto="${k}">
      <span class="pt-num">${r.num}</span>
      <img src="${opciones.miniaturas[r.icono] || ""}" alt="" draggable="false">
      <span class="pt-reto-nom">${tr.nom}</span>
      <span class="pt-lloc">${r.mesa ? ICONO.taula + t("taula") : ICONO.panell + t("panell")}</span>
      ${m ? `<span class="pt-marca" aria-label="${m === "superat" ? t("superat") : t("intentatSense")}"></span>` : ""}
    </button>`;
  }
  function pintarLlista(dif) {
    const d = TK.DIFICULTATS.find((x) => x.id === dif);
    el.innerHTML = `${barraSuperior()}<div class="pt-barra-sup"><button class="pt-enrere" data-inici aria-label="${t("enrere")}">${ICONO.enrere}</button>
        <h2 style="color:${d.color}">${TK.nomDificultat(dif)}</h2>
        <span class="pt-llegenda"><span class="pt-marca superat"></span>${t("superat")} <span class="pt-marca intentat"></span>${t("intentat")}</span></div>
      <div class="pt-retos">${indices(dif).map(targetaReto).join("")}</div>${peu()}`;
  }

  /** Pareja de botones: ver en pantalla y descargar. */
  const verBaixar = (dades, etiqueta) => `<span class="pt-parella" role="group" aria-label="${etiqueta}">
      <button class="pt-pdf" data-veure ${dades}>${ICONO.ull}<span>${t("veure")}</span></button>
      <button class="pt-pdf baixa" data-baixar ${dades} aria-label="${t("baixar")}" title="${t("baixar")}">${ICONO.pdf}</button></span>`;
  function pintarDocent() {
    const blocs = TK.DIFICULTATS.map((d) => `<section class="pt-doc-bloc">
        <div class="pt-doc-cap"><h3 style="color:${d.color}">${TK.nomDificultat(d.id)}<small>${t("edat_" + d.id)}</small></h3></div>
        <div class="pt-doc-tots">
          <span class="pt-doc-etiq">${t("rubrica")}</span>${verBaixar(`data-rub="${d.id}"`, t("rubrica"))}
        </div>
        <ul>${indices(d.id).map(([r, k]) => { const tr = TK.retoTraducit(r); return `<li><span class="pt-num petit">${r.num}</span>
          <span class="pt-doc-nom">${tr.nom}<small>${t(r.mesa ? "taula" : "panell")} · ${tr.concepte}</small></span>
          ${verBaixar(`data-fitxa="${k}"`, tr.nom)}</li>`; }).join("")}</ul>
      </section>`).join("");
    el.innerHTML = `${barraSuperior()}<div class="pt-barra-sup"><button class="pt-enrere" data-inici aria-label="${t("enrere")}">${ICONO.enrere}</button><h2>${t("zonaDocent")}</h2></div>
      <p class="pt-doc-intro">${t("docIntro")}</p>
      <section class="pt-guia">
        <span class="pt-guia-icona">${ICONO.llibre}</span>
        <span class="pt-guia-text"><strong>${t("guia")}</strong><small>${t("guiaDesc")}</small></span>
        ${verBaixar('data-guia="1"', t("guia"))}
      </section>
      <div class="pt-doc">${blocs}</div>
      <div class="pt-doc-peu"><button class="pt-boto petit" data-esborrar>${t("esborrar")}</button></div>${peu()}`;
  }

  /* ---------- Clave de la zona docente ----------
     Se guarda solo su huella SHA-256 (la clave es "TinkerPad"). Es una
     barrera para el alumnado, no una protección fuerte: todo va en el
     navegador. Una vez abierta, no se vuelve a pedir hasta cerrar la pestaña. */
  const HUELLA = "7745b5f10547de95d184466997b69a88303a1fd949036ef93c97ae1ff67cbe77";
  let docentObert = false;
  try { docentObert = sessionStorage.getItem("tinkerpad-docent") === "1"; } catch (e) { /* sin almacenamiento */ }
  let clauError = false;
  async function huella(text) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  function pintarClau() {
    el.innerHTML = `${barraSuperior()}<div class="pt-barra-sup"><button class="pt-enrere" data-inici aria-label="${t("enrere")}">${ICONO.enrere}</button><h2>${t("zonaDocent")}</h2></div>
      <form class="pt-clau" autocomplete="off">
        <span class="pt-clau-icona">${ICONO.docent}</span>
        <label for="pt-clau-camp">${t("clauDemana")}</label>
        <input id="pt-clau-camp" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" aria-invalid="${clauError}" ${clauError ? 'aria-describedby="pt-clau-error"' : ""}>
        ${clauError ? `<p class="pt-clau-error" id="pt-clau-error" role="alert">${t("clauError")}</p>` : ""}
        <button class="boton verde grande" type="submit">${t("clauEntra")}</button>
      </form>${peu()}`;
    const camp = el.querySelector("#pt-clau-camp");
    setTimeout(() => camp && camp.focus(), 50);
  }
  async function comprovarClau(e) {
    e.preventDefault();
    const camp = el.querySelector("#pt-clau-camp");
    if (!camp) return;
    let ok = false;
    try { ok = (await huella(camp.value.trim())) === HUELLA; } catch (err) { ok = camp.value.trim() === "TinkerPad"; }
    if (ok) {
      docentObert = true;
      clauError = false;
      try { sessionStorage.setItem("tinkerpad-docent", "1"); } catch (err) { /* sin almacenamiento */ }
      vista = "docent";
    } else clauError = true;
    pintar();
  }

  function pintar() {
    el.dataset.vista = vista;
    if (vista === "llista") pintarLlista(dificultatActual);
    else if (vista === "clau") pintarClau();
    else if (vista === "docent") pintarDocent();
    else pintarInici();
  }

  /** Lo que pide un botón ver/descargar: fichas de un reto, de una dificultad o la rúbrica. */
  function document_(b) {
    const mini = opciones.miniaturas;
    if (b.dataset.guia) return { veure: () => TK.Guia.veure(mini), baixar: () => TK.Guia.descarregar(mini) };
    if (b.dataset.fitxa !== undefined) {
      const r = TK.RETOS[Number(b.dataset.fitxa)];
      return { titol: `${t("fitxa")} · ${TK.retoTraducit(r).nom}`, veure: () => TK.Fitxa.veureFitxes([r], mini, `${t("fitxa")} · ${TK.retoTraducit(r).nom}`),
        baixar: () => TK.Fitxa.descarregar([r], mini) };
    }
    if (b.dataset.dif) {
      const retos = indices(b.dataset.dif).map(([r]) => r), nom = `tinkerpad-${b.dataset.dif}-${TK.idioma}.pdf`, titol = `${t("totesFitxes")} · ${TK.nomDificultat(b.dataset.dif)}`;
      return { veure: () => TK.Fitxa.veureFitxes(retos, mini, titol, nom), baixar: () => TK.Fitxa.descarregar(retos, mini, nom) };
    }
    const dif = b.dataset.rub, titol = `${t("rubrica")} · ${TK.nomDificultat(dif)}`;
    return { veure: () => TK.Fitxa.veureRubrica(dif, mini, titol), baixar: () => TK.Fitxa.descarregarRubrica(dif, mini) };
  }
  async function descarregar(boto, fer) {
    const text = boto.innerHTML;
    boto.disabled = true;
    boto.textContent = "…";
    try { await fer(); }
    finally { boto.disabled = false; boto.innerHTML = text; }
  }

  function alClic(e) {
    const b = e.target.closest("button");
    // Tocar fuera del desplegable lo cierra
    if (menuObert && (!b || !b.closest(".pt-idiomes"))) { menuObert = false; pintar(); if (!b) return; }
    if (!b || b.disabled) return;
    TK.audio.activar();
    TK.audio.clic();
    if ("menuIdioma" in b.dataset) { menuObert = !menuObert; return pintar(); }
    if (b.dataset.idioma) { menuObert = false; TK.canviarIdioma(b.dataset.idioma); return pintar(); }
    if (b.dataset.dif) { vista = "llista"; dificultatActual = b.dataset.dif; el.scrollTop = 0; return pintar(); }
    if ("inici" in b.dataset) { vista = "inici"; el.scrollTop = 0; return pintar(); }
    if ("docent" in b.dataset) { vista = docentObert ? "docent" : "clau"; clauError = false; el.scrollTop = 0; return pintar(); }
    if (b.dataset.reto !== undefined) { amagar(); return opciones.jugar(Number(b.dataset.reto)); }
    if (b.dataset.lliure) { amagar(); return opciones.lliure(b.dataset.lliure === "taula"); }
    // Tutorial: abre el taller libre y explica cada parte de la pantalla
    if ("tut" in b.dataset) { amagar(); opciones.lliure(false); return setTimeout(() => TK.Tutorial.iniciar(), 350); }
    if ("so" in b.dataset) { TK.audio.alternar(); return pintar(); }
    if ("veure" in b.dataset) return document_(b).veure();
    if ("baixar" in b.dataset) return descarregar(b, document_(b).baixar);
    if ("esborrar" in b.dataset) {
      // Doble toque para confirmar: no se borra por accidente
      if (b.dataset.confirmar) { TK.Progres.esborrar(); b.textContent = t("esborrat"); b.disabled = true; return; }
      b.dataset.confirmar = "1";
      b.textContent = t("confirmar");
    }
  }

  function amagar() { el.hidden = true; }

  TK.Portada = {
    logo,
    iniciar(op) {
      opciones = op;
      el = document.getElementById("portada");
      el.addEventListener("click", alClic);
      el.addEventListener("submit", comprovarClau);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menuObert) { menuObert = false; pintar(); } });
    },
    /** Muestra la portada; con una dificultad, directamente su lista de retos. */
    mostrar(dificultat) {
      vista = dificultat ? "llista" : "inici";
      dificultatActual = dificultat || null;
      pintar();
      el.hidden = false;
      el.scrollTop = 0;
    },
  };
})();
