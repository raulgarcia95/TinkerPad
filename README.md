# Tinker Pad

**Úsala en el navegador:** https://raulgarcia95.github.io/TinkerPad/  
**App para tablet Android (APK):** [descarrega/TinkerPad.apk](descarrega/TinkerPad.apk)

Reacciones en cadena sobre un panel perforado de madera de 170 × 100 cm (navegador, PC y tablet). Three.js para el 3D y Rapier 2D para la física, que solo actúa en el plano del panel.

© 2026 Raúl García Antolín (rgarci95@xtec.cat) · Licencia Creative Commons BY-NC-SA 4.0.

## Cómo abrirlo

Sirve la carpeta con cualquier servidor estático y abre `http://localhost:8765`:

```
python -m http.server 8765
```

Hace falta conexión a internet: Three.js, Rapier, jsPDF, PDF.js (visor) y las fuentes se cargan desde CDN.

## Idiomas

Català, castellano, galego, euskara, English y français. Por defecto se usa el idioma del sistema (si no es ninguno de estos, inglés); se cambia en la portada y queda guardado en el navegador. La lectura en voz alta usa una voz del idioma elegido si el sistema la tiene.

- `js/idiomes.js`: detección, cambio de idioma y funciones `TK.t()`, `TK.nomPieza()`, `TK.retoTraducit()`.
- `js/textos/<idioma>.js`: todos los textos (interfaz, piezas, categorías, dificultades, reflexión, los 30 retos, la ficha PDF y la rúbrica). Para añadir un idioma: copia `ca.js`, tradúcelo y añádelo a `TK.IDIOMES`.

El código y sus comentarios están en castellano.

## Estructura

| Archivo | Qué contiene |
|---|---|
| `index.html` | Maquetación, estilos, iconos y visor de PDF |
| `audio/musica.mp3` | Música de fondo (en bucle; botón del altavoz para silenciar) |
| `js/base.js` | Coordenadas, escala real (1 px = 1,25 mm), materiales, texturas, geometría, sonido y música |
| `js/idiomes.js`, `js/textos/*.js` | Idiomas y textos |
| `js/piezas.js` | Catálogo de piezas (física + malla 3D), goma elástica, tirachinas, pinza, lanzador y categorías |
| `js/retos.js` | Los 30 retos (solo datos: piezas, solución comprobada, variantes) |
| `js/reflexion.js` | Reflexión táctil al terminar cada reto |
| `js/portada.js` | Portada: zona docente, sonido, idioma, logotipo, dificultades, progreso y licencia |
| `js/fitxa.js` | Fichas en papel por edades, rúbricas de evaluación y visor (PDF.js) |
| `js/app.js` | Escena, física, montaje, enganches, solapes, Play/Reiniciar, niveles e interfaz |

## Retos

30 retos: 10 por dificultad, y en cada una 3 son de **mesa** (posiciones 3, 6 y 9), mezclados con los de panel. La mesa se ve distinta: el tablero está tumbado sobre una mesa de madera, la cámara lo mira inclinada y la interfaz se vuelve verde. Sin pendiente, la bola sale de un lanzador de muelle.

- **Fácil** (6-8 años): una idea y pocas piezas (listones, rampas cóncavas, espigas, bloques, engranaje, péndulo, dominós, pinza).
- **Medio** (8-10): dos mecanismos (goma, tubo en U, billar, cadena de engranajes, depurar, embudo y tubo, catapulta, camino de pinzas).
- **Difícil** (10-12): cadenas largas con piezas prohibidas o contadas y mecanismos nuevos: tirachinas con gatillo (panel y mesa), polea solo con tubos, engranajes distintos esquivando un bloque, coche, laberinto con 3 piezas, péndulo y dominós con 2 piezas, depurar engranajes y la gran máquina.

Todos están comprobados en simulación: sin montar nada no se superan, con la `solucion` guardada sí, y ninguna pieza de la solución se cruza con otra.

En la barra y en la portada: marca verde = superado, naranja = intentado sin superar, sin marca = sin hacer.

## Pantalla y tableros

- **Arriba**: casa, sonido, título del reto (al tocarlo se abre el menú de los 10 retos), Pista y los mandos (Play, volver a montar, girar y quitar). **A los lados del tablero**: las cajas de madera de cada categoría de piezas; al tocar una se abre una bandeja con sus piezas por encima del tablero (que no cambia de tamaño) y se cierra al poner una pieza o al tocar fuera.
- **Mesa**: el tablero está sobre una mesa baja de madera (canto, patas y suelo) vista inclinada desde arriba; el panel se ve de frente, en la pared.
- **Reto superado**: «Repetir otra vez» o «Siguiente reto»; este último pasa por «Antes de seguir, pensemos un poco» (las preguntas de reflexión), con «Salta» bien visible.
- **Tutorial** (`js/tutorial.js`): desde la portada («¿Cómo funciona?»), ilumina cada parte de la pantalla y la explica con una frase: cajas, arrastrar y mover piezas, girar y quitar, dos dedos para girar, pellizco y botones de zoom, gomas / pinzas / cadenas, engranajes y manivela, Play, el reto y la casa.
- **Dos tableros**: los retos **Fáciles** van en un tablero pequeño de piezas grandes (`TK.PETIT`, 840 × 500 px = 105 × 62,5 cm, 42 × 25 agujeros), más cómodo con el dedo; **Medio** y **Difícil**, en el panel completo (1360 × 800 px = 170 × 100 cm). El taller libre puede usar los dos (botón «Peces grans»). Las fichas dibujan cada reto con la medida de su tablero (`TK.midaRepte`).
- **Gestos**: un dedo mueve piezas; dos dedos hacen zoom y desplazan la vista; dos dedos empezando sobre la pieza seleccionada la giran (pasos de 15°). Botones de zoom +, − y ver todo; rueda del ratón para el zoom.

## Montaje

- **Las piezas no se cruzan**: si al arrastrar o girar una pieza se mete en otra, brilla en rojo y, al soltarla, vuelve al último sitio libre. Tocarse sí está permitido; dos engranajes pueden engranar. Los engranajes cuentan por el centro de la rueda (los dientes y la biela deben poder rozar la campana).
- **Goma elástica**: se toca un punto y luego otro. Puntos de enganche: espigas, agujeros de listones, rampas y bloques, y el mango de las pinzas. Solo se piden espigas si no hay ningún punto en el panel. Su tensión depende de la distancia (sin estirar mide 20 cm): floja hace panza y casi no rebota; tensa rebota más; los objetos pesados saltan más. Sigue a las piezas donde está enganchada.
- **Pinza**: solo muerde donde lo haría una de verdad (bordes finos): espigas, los cantos y las puntas de un listón plano, la boca de un tubo de PVC, el aro de arriba de un cono de alambre, o **una goma**. La rampa cóncava y los bloques son demasiado gruesos.
- **Tirachinas con gatillo**: con la pinza se toca una goma y después la espiga donde se apoyará. La goma queda estirada hasta allí con una cuna donde puede descansar una bola. Si a la pinza le cae encima algo que pese (canica, pelota de goma, bola de madera; el corcho no), se suelta y la goma dispara lo que hay en la cuna. Parámetros en `TK.GOMA` (`KT`, `TIRA`, `GATILLO`).

## Física

- Paso fijo de 1/120 s, CCD en bolas y pesos. Determinista: cada Play crea un mundo nuevo.
- Bolas con valores reales: la canica es la más pesada y rueda mucho; la pelota de goma rebota mucho; el corcho casi no rebota y lo frena el aire.
- El péndulo es una varilla rígida con roce en el eje: oscila y se para. Los engranajes también tienen roce en el eje.
- Parámetros en `TK.FIS`, `TK.GRAVEDAD` (`base.js`), `TK.GOMA`, `TK.LANZADOR` y `BOLAS` (`piezas.js`).

## Zona docente

Está arriba a la izquierda de la portada. Para cada reto, para toda una dificultad y para la rúbrica se puede **ver** el PDF en pantalla (visor con PDF.js) o **descargarlo**.

- **Fichas** (2 páginas por reto) adaptadas a la edad: Fácil muy visual (material en dibujos, cuatro pasos con iconos, dibujar la predicción, caras); Medio con medidas, pasos, predicción escrita y reflexión; Difícil con planificación por partes, hipótesis con "porque", registro de pruebas, cadena de energía y justificación. Abajo, la parte del docente con una solución dibujada.
- **Rúbricas** (un PDF por dificultad): portada con saberes, competencias específicas y pensamiento computacional del ciclo (LOMLOE, RD 157/2022; Decret 175/2022 en Cataluña) y una tabla por reto con 5 criterios (descomposición, predicción/algoritmo, construcción, depuración y explicación científica) en 4 niveles.

La zona docente pide una clave (en el código solo está su huella SHA-256; pídela al autor). Es una barrera para el alumnado, no una protección fuerte.

**Guía de tinkering para docentes** (`js/guia.js`): presentación apaisada de 29 diapositivas en el idioma elegido, que se ve en el visor o se descarga en PDF. Explica qué es el tinkering, cómo trabajarlo en la escuela (secuencia, rol del docente, organización), el pensamiento computacional por etapas (infantil, los tres ciclos de primaria y secundaria), los materiales para construir un espacio de tinkering y cómo usar Tinker Pad en el aula. Ilustraciones: fotos 3D de retos montados (`TK.juego.captura`), retos dibujados, las piezas en 3D, un rincón de tinkering en SVG e iconos vectoriales. Textos en `TK.TEXTOS.<idioma>.guia`. Se basa en la formación «Tinkering» de Mentories 4.0 · STEAMcat y en la «Proposta Tinkering» de materiales.

`TK.Fitxa.documentComplet()` genera un único PDF con todas las fichas y rúbricas.

## App para tablet (APK)

[descarrega/TinkerPad.apk](descarrega/TinkerPad.apk): Android 7 o superior, funciona sin internet (lleva dentro Three.js, Rapier, jsPDF, PDF.js y las fuentes). Para instalarla, permite «instalar aplicaciones de origen desconocido». Los PDF se guardan en Descargas/TinkerPad.

## Probar desde la consola

```js
TK.juego.probar(0, false);   // reto 0 sin piezas: -1 (no se supera)
TK.juego.probar(0, true);    // con su solución: pasos hasta superarlo
TK.juego.solapes(0);         // piezas de la solución que se cruzan: []
TK.juego.nivel(0); TK.juego.colocar("liston", 760, 440, 15); TK.juego.jugar();
```

`probar` marca los retos como superados: después, borra el progreso desde la zona docente.
