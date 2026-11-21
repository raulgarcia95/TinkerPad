/* =====================================================================
   reflexion.js — Reflexión al terminar un reto.

   Sigue la secuencia de la propuesta de Tinkering: comunicar, evaluar
   ("¿qué hemos aprendido?") y reinventar el reto. Todo se responde
   tocando tarjetas grandes (pensado para tablet y para todas las
   edades): nada de escribir. El botón del altavoz lee la pregunta en voz
   alta para quien aún no lee.

   Pasos:
     1. ¡Reto superado!         celebración
     2. ¿Cómo te ha ido?        una cara entre tres
     3. Pregunta del reto       una opción, con explicación al responder
     4. ¿Qué has hecho?         varias casillas
     5. Reinventa el reto       variantes que se cargan al tocarlas

   Las respuestas se guardan en este navegador (localStorage,
   "tinkering-reflexiones") para que el docente pueda revisarlas.

   Uso: TK.Reflexion.abrir(contenedor, { reto, texto, miniaturas, alAccion })
        alAccion recibe "siguiente" | "otra" | "seguir" | { variante }
   ===================================================================== */
(function () {
  const CLAVE = "tinkering-reflexiones";
  const svg = (d, extra = "") => `<svg viewBox="0 0 48 48" aria-hidden="true" ${extra}>${d}</svg>`;
  const cara = (boca, ojos = '<circle cx="17" cy="20" r="3" fill="currentColor"/><circle cx="31" cy="20" r="3" fill="currentColor"/>') =>
    svg(`<circle cx="24" cy="24" r="21" fill="#ffd45c" stroke="#e0a91c" stroke-width="2"/>${ojos}${boca}`);
  const ICONOS = {
    contenta: cara('<path d="M14 28c3 6 17 6 20 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
    normal: cara('<path d="M15 31h18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
    pensativa: cara('<path d="M15 33c4-5 14-5 18 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
      '<path d="M13 17l7 3M35 17l-7 3" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'),
    repetir: svg('<path d="M10 24a14 14 0 0 1 24-10M38 24a14 14 0 0 1-24 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M34 6v8h-8M14 42v-8h8" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
    girar: svg('<path d="M12 28a13 13 0 1 0 5-14" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 6l-2 9 9 2" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
    mover: svg('<path d="M24 6v36M6 24h36" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M18 12l6-6 6 6M18 36l6 6 6-6M12 18l-6 6 6 6M36 18l6 6-6 6" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
    lupa: svg('<circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="4"/><path d="M29 29l12 12" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'),
    bombilla: svg('<path fill="currentColor" d="M24 5a13 13 0 0 0-7.8 23.4c1.2 1 1.8 2.2 1.8 3.6v1h12v-1c0-1.4.6-2.6 1.8-3.6A13 13 0 0 0 24 5zM18 36h12v2.4A4.6 4.6 0 0 1 25.4 43h-2.8A4.6 4.6 0 0 1 18 38.4z"/>'),
    equipo: svg('<circle cx="16" cy="16" r="7" fill="currentColor"/><circle cx="33" cy="16" r="7" fill="currentColor" opacity=".7"/><path d="M3 40c1-9 7-13 13-13s12 4 13 13zM22 40c1-9 6-13 11-13s11 4 12 13z" fill="currentColor"/>'),
    altavoz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    campana: svg('<path fill="currentColor" d="M24 4a3 3 0 0 1 3 3v1.3A12 12 0 0 1 36 20v7l3.6 5.5a1.5 1.5 0 0 1-1.3 2.3H9.7a1.5 1.5 0 0 1-1.3-2.3L12 27v-7a12 12 0 0 1 9-11.7V7a3 3 0 0 1 3-3zM19 38h10a5 5 0 0 1-10 0z"/>'),
  };

  const voz = "speechSynthesis" in window;
  // Voz del idioma elegido si el sistema tiene una instalada (las tablets
  // suelen tenerlas); si no, el navegador usa la voz que tenga por defecto.
  function vozIdioma() {
    try {
      const re = new RegExp(`^${TK.idioma}(-|_|$)`, "i");
      return speechSynthesis.getVoices().find((v) => re.test(v.lang)) || null;
    } catch (e) { return null; }
  }
  function leer(texto) {
    if (!voz) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = TK.veu();
      const v = vozIdioma();
      if (v) u.voice = v;
      u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) { /* sin voz */ }
  }
  function guardar(registro) {
    try {
      const todos = JSON.parse(localStorage.getItem(CLAVE) || "[]");
      todos.push(registro);
      localStorage.setItem(CLAVE, JSON.stringify(todos.slice(-200)));
    } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  function abrir(cont, { reto, texto, miniaturas, alAccion }) {
    const comun = TK.comunTraducit();
    const pasos = ["celebrar", "sentir", "pregunta", "estrategias", "reinventar"].filter((p) => p !== "pregunta" || reto.pregunta);
    const resp = { reto: reto.id, fecha: new Date().toISOString(), sentir: null, pregunta: null, acierto: null, estrategias: [] };
    let paso = 0, guardado = false;

    const imagen = (pieza) => (pieza && miniaturas[pieza] ? `<img src="${miniaturas[pieza]}" alt="" draggable="false">` : "");
    const opcionHTML = (o, k, seleccion, multiple, corregir) => {
      const marcada = multiple ? seleccion.includes(k) : seleccion === k;
      const dibujo = o.cara ? ICONOS[o.cara] : o.icono ? ICONOS[o.icono] : imagen(o.pieza);
      // Tras responder la pregunta del reto, la respuesta buena se ve en verde
      const clase = corregir ? (o.correcta ? " correcta" : marcada ? " fallada" : "") : marcada ? " marcada" : "";
      return `<button class="op${clase}" data-op="${k}" aria-pressed="${marcada}">
        ${dibujo ? `<span class="op-dibujo">${dibujo}</span>` : ""}<span class="op-texto">${o.texto}</span>
        ${multiple ? `<span class="op-casilla" aria-hidden="true"></span>` : ""}</button>`;
    };
    const textoVoz = (d) => d.texto + ". " + d.opciones.map((o) => o.texto).join(". ");

    function terminar(accion) {
      if (!guardado) { guardado = true; guardar(resp); }
      if (voz) speechSynthesis.cancel();
      alAccion(accion);
    }

    function pintar() {
      const nombre = pasos[paso];
      const puntos = pasos.map((_, k) => `<span class="punto${k === paso ? " activo" : k < paso ? " hecho" : ""}"></span>`).join("");
      let cuerpo = "", pie = "", lectura = "";
      if (nombre === "celebrar") {
        cuerpo = `<div class="celebra-icono">${ICONOS.campana}</div>
          <h2 id="r-titulo">${TK.t("repteSuperat")}</h2><p class="r-sub">${texto}</p>`;
        // Dos caminos: repetir el reto, o pasar al siguiente pensando antes un poco
        pie = `<button class="boton claro grande" data-accion="otra">${ICONOS.repetir}${TK.t("repetir")}</button>
          <button class="boton verde grande" data-ir="1">${TK.t("repteSeguent")} ›</button>`;
        lectura = TK.t("repteSuperat") + " " + texto;
      } else if (nombre === "sentir" || nombre === "pregunta" || nombre === "estrategias") {
        const d = nombre === "sentir" ? comun.sentir : nombre === "pregunta" ? reto.pregunta : comun.estrategias;
        const multiple = !!d.multiple;
        const sel = nombre === "estrategias" ? resp.estrategias : nombre === "sentir" ? resp.sentir : resp.pregunta;
        // Al pulsar «Siguiente reto»: antes de seguir, pensemos un poco
        cuerpo = `${paso === 1 ? `<p class="r-intro">${TK.t("abansSeguir")}</p>` : ""}${d.pieza ? `<div class="r-pieza">${imagen(d.pieza)}</div>` : ""}<h2 id="r-titulo">${d.texto}</h2>
          ${d.ayuda ? `<p class="r-sub">${d.ayuda}</p>` : ""}
          <div class="ops${multiple ? " multiple" : ""}">${d.opciones.map((o, k) => opcionHTML(o, k, sel, multiple, nombre === "pregunta" && sel !== null)).join("")}</div>`;
        if (nombre === "pregunta" && resp.pregunta !== null) {
          const bien = !!d.opciones[resp.pregunta].correcta;
          cuerpo += `<p class="r-explica ${bien ? "bien" : "casi"}"><strong>${TK.t(bien ? "moltBe" : "gairebe")}</strong> ${d.explicacion}${bien ? "" : " " + TK.t("provaPanell")}</p>`;
        }
        const listo = multiple || sel !== null;
        // «Salta» bien visible: lleva directamente al siguiente reto
        pie = `<button class="boton claro saltar" data-accion="siguiente">${TK.t("salta")} ⏭</button>
          <button class="boton verde grande" data-ir="${paso + 1}" ${listo ? "" : "disabled"}>${TK.t("seguent")}</button>`;
        lectura = textoVoz(d);
      } else {
        const vars = reto.reinventar || [];
        cuerpo = `<h2 id="r-titulo">${TK.t("reinventa")}</h2><p class="r-sub">${TK.t("triaDiferent")}</p>
          <div class="ops">${vars.map((v, k) => `<button class="op" data-variante="${k}">${v.pieza ? `<span class="op-dibujo">${imagen(v.pieza)}</span>` : ""}<span class="op-texto">${v.texto}</span></button>`).join("")}</div>`;
        pie = `<button class="boton verde grande" data-accion="siguiente">${TK.t("repteSeguent")}</button>
          <button class="boton claro" data-accion="otra">${TK.t("unaAltra")}</button>`;
        lectura = TK.t("reinventa") + " " + vars.map((v) => v.texto).join(". ");
      }
      cont.innerHTML = `<div class="r-cabecera"><div class="puntos" aria-label="${TK.t("pas", { a: paso + 1, b: pasos.length })}">${puntos}</div>
          ${voz ? `<button class="r-voz" data-leer aria-label="${TK.t("llegeix")}" title="${TK.t("llegeix")}">${ICONOS.altavoz}</button>` : ""}</div>
        <div class="r-cuerpo">${cuerpo}</div><div class="r-pie">${pie}</div>`;
      cont.dataset.lectura = lectura;
    }

    cont.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b || b.disabled) return;
      TK.audio.clic();
      if ("leer" in b.dataset) return leer(cont.dataset.lectura);
      if (b.dataset.accion) return terminar(b.dataset.accion);
      if (b.dataset.variante) return terminar({ variante: Number(b.dataset.variante) });
      if (b.dataset.ir) { paso = Number(b.dataset.ir); if (voz) speechSynthesis.cancel(); return pintar(); }
      if (b.dataset.op) {
        const k = Number(b.dataset.op), nombre = pasos[paso];
        if (nombre === "sentir") resp.sentir = k;
        else if (nombre === "pregunta") {
          resp.pregunta = k;
          resp.acierto = !!reto.pregunta.opciones[k].correcta;
        } else {
          const i = resp.estrategias.indexOf(k);
          i >= 0 ? resp.estrategias.splice(i, 1) : resp.estrategias.push(k);
        }
        pintar();
      }
    };
    pintar();
  }

  TK.Reflexion = { abrir, clave: CLAVE };
})();
