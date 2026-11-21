/* =====================================================================
   idiomes.js — Idiomas de Tinker Pad.

   Idiomas: català, castellano, galego, euskara, English, français.
   Por defecto se usa el idioma del sistema (navigator.languages); si no
   es ninguno de estos, inglés. La elección de la portada se guarda en el
   navegador ("tinkerpad-idioma").

   Los textos están en js/textos/<codi>.js, cada uno con la misma forma:
     TK.TEXTOS.ca = {
       ui:          textos de la interfaz (claves -> texto; {n} = valor)
       piezas:      nombre de cada tipo de pieza
       categorias:  título de cada categoría del repositorio (por id)
       dificultats: { facil: [nombre, descripción], ... }
       comun:       preguntas comunes de la reflexión
       retos:       { id: { nom, enunciado, concepte,
                            pregunta: [texto, opción1, opción2, opción3, explicación],
                            reinventar: [texto1, texto2, ...] } }
       fitxa:       textos de la ficha en PDF
     }
   Añadir un idioma: copiar ca.js, traducirlo y añadirlo a TK.IDIOMES.
   ===================================================================== */
(function () {
  TK.TEXTOS = {};
  TK.IDIOMES = [
    { codi: "ca", nom: "Català", veu: "ca-ES" },
    { codi: "es", nom: "Castellano", veu: "es-ES" },
    { codi: "gl", nom: "Galego", veu: "gl-ES" },
    { codi: "eu", nom: "Euskara", veu: "eu-ES" },
    { codi: "en", nom: "English", veu: "en-GB" },
    { codi: "fr", nom: "Français", veu: "fr-FR" },
  ];
  const CLAU = "tinkerpad-idioma";

  function delSistema() {
    const llista = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
    for (const l of llista) {
      const base = String(l).toLowerCase().split("-")[0];
      if (TK.IDIOMES.some((i) => i.codi === base)) return base;
    }
    return "en";
  }
  let guardat = null;
  try { guardat = localStorage.getItem(CLAU); } catch (e) { /* sin almacenamiento */ }
  TK.idioma = TK.IDIOMES.some((i) => i.codi === guardat) ? guardat : delSistema();

  const dic = () => TK.TEXTOS[TK.idioma] || TK.TEXTOS.ca;

  /** Texto de la interfaz. {n} se sustituye por valores[n]. */
  TK.t = (clau, valors) => {
    let s = dic().ui[clau] ?? TK.TEXTOS.ca.ui[clau] ?? clau;
    if (valors) for (const [k, v] of Object.entries(valors)) s = s.split(`{${k}}`).join(v);
    return s;
  };
  TK.nomPieza = (tipo) => dic().piezas[tipo] || TK.TEXTOS.ca.piezas[tipo] || tipo;
  TK.textFitxa = (clau) => dic().fitxa[clau] ?? TK.TEXTOS.ca.fitxa[clau] ?? clau;
  TK.veu = () => TK.IDIOMES.find((i) => i.codi === TK.idioma).veu;

  /**
   * Reto con sus textos en el idioma actual (y la parte estructural:
   * respuesta correcta, piezas de las variantes...).
   */
  TK.retoTraducit = (r) => {
    const t = dic().retos[r.id] || TK.TEXTOS.ca.retos[r.id];
    const p = t.pregunta;
    // En los textos la respuesta buena suele ir primero: se gira el orden
    // (siempre igual para cada reto) para que no esté siempre en el mismo sitio.
    const opciones = [p[1], p[2], p[3]].map((texto, k) => ({ texto, correcta: k === r.pregunta.correcta }));
    const giro = /^\d+$/.test(p[1]) ? 0 : [...r.id].reduce((s, c) => s + c.charCodeAt(0), 0) % 3;
    return {
      ...r,
      nom: t.nom, enunciado: t.enunciado, concepte: t.concepte,
      ayuda: r.ayuda ? TK.t(r.ayuda) : null,
      pregunta: {
        pieza: r.pregunta.pieza, texto: p[0], explicacion: p[4],
        opciones: [...opciones.slice(giro), ...opciones.slice(0, giro)],
      },
      reinventar: r.reinventar.map((v, k) => ({ ...v, texto: t.reinventar[k] })),
    };
  };
  TK.comunTraducit = () => {
    const c = dic().comun;
    return {
      sentir: { texto: c.sentir[0], opciones: ["contenta", "normal", "pensativa"].map((cara, k) => ({ texto: c.sentir[k + 1], cara })) },
      estrategias: {
        texto: c.estrategias[0], ayuda: c.estrategias[1], multiple: true,
        opciones: ["repetir", "girar", "mover", "lupa", "bombilla", "equipo"].map((icono, k) => ({ texto: c.estrategias[k + 2], icono })),
      },
    };
  };
  TK.nomDificultat = (id) => dic().dificultats[id][0];
  TK.descDificultat = (id) => dic().dificultats[id][1];

  /** Cambia el idioma y avisa a quien escuche (app, portada...). */
  const oients = [];
  TK.alCanviarIdioma = (fn) => oients.push(fn);
  TK.canviarIdioma = (codi) => {
    TK.idioma = codi;
    try { localStorage.setItem(CLAU, codi); } catch (e) { /* sin almacenamiento */ }
    TK.aplicarIdioma();
    oients.forEach((fn) => fn(codi));
  };
  /** Traduce los textos fijos del HTML (data-i18n, data-i18n-title, data-i18n-aria). */
  TK.aplicarIdioma = () => {
    document.documentElement.lang = TK.idioma;
    document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = TK.t(el.dataset.i18n)));
    document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = TK.t(el.dataset.i18nTitle)));
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", TK.t(el.dataset.i18nAria)));
  };
})();
