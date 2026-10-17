# Actualización semestral de oferta y salones (UPIITA)

Para el orquestador. Todo sale de `python tools/semestre.py <comando>`; cada comando es idempotente y no usa red salvo
`www.upiita.ipn.mx` (`pdf`) y el Ollama local (`cruce`). El SAES solo se toca en modo lectura, desde el navegador
integrado. Los PDF viven en `recursos/ipn-tools/horarios-upiita/<aaaa>-<n>/` (fuera del repositorio; `--recursos` o
`IPNT_RECURSOS` para otra ruta). El reporte para el dueño se escribe en `coordinacion-wt/ipt-estado/ipn-tools/`
(`--salida` o `IPNT_ESTADO`).

## Pasos

1. `semestre.py estado` — ciclo del PDF, fecha, cobertura de salones, discrepancias y qué falta.
2. `semestre.py pdf` — lee la página de horarios, compara URL + «Actualizados al» + SHA-256 y descarga solo si cambió
   (nunca pisa una versión anterior); regenera `data/salones_<per>.json` con la URL oficial y la fecha de la página.
   `--dry` solo informa; `--archivo ruta.pdf` usa un PDF ya descargado; `--forzar` regenera.
3. `semestre.py snippet-saes` — escribe `tmp-horarios/snippet-saes.js` (solo huellas de lo guardado, sin datos).
   Pégalo en el navegador integrado en una pestaña del SAES con sesión (`--saes proximo` captura un solo periodo y tarda
   la mitad). Al terminar, lee `JSON.stringify(window.SEM)` y guárdalo en `tmp-horarios/diff.json`.
4. `semestre.py aplicar-saes tmp-horarios/diff.json` — reconstruye la oferta, verifica la SHA-256 del texto completo y
   escribe `data/horarios_upiita.json`; si algo no cuadra no escribe nada. `--dry` para ver el informe primero.
   Destino: la lista capturada va a la clave guardada con la que más coincide (≥ 50 %), así la oferta conserva su
   identidad aunque el SAES cambie «actual»/«próximo»; una lista sin parecido ocupa la clave libre. `--mapa
   actual:proximo` (lista del SAES : clave guardada) manda sobre la regla.
5. `semestre.py cruce` — cruza PDF y oferta, corre el OCR si Ollama responde (si no, lo dice y sigue) y escribe
   `REVISION-SALONES-<per>.md`. Cerrar Ollama al terminar.
6. `semestre.py datos` — regenera solo `web/dist/sate/datos/<unidad>/*.json` (también `python tools/build_horarios.py
   --solo-datos`, con `UNIDAD=…`). No toca plantillas, JS ni CSS.
7. Compilación completa, pruebas (`pytest`, `tests/qa_sate*.mjs`) y publicar con aviso al dueño (`tools/publicar.sh`).

## Qué basta publicar si solo cambian los datos

De `web/dist/sate/datos/upiita/`: `oferta.json` (periodos, asignaturas, profesores, salones), `nucleo.json` (fecha de
captura, carreras, mapas) y `electivas.json` (oferta de la Ventanilla). `tramites.json` solo cambia si cambió el
calendario o el dictamen. En ESCOM y UPIBI: `oferta.json` y `nucleo.json` de su carpeta. El navegador los pide sin
versión, así que el caché de GitHub Pages puede tardar unos minutos en reflejarlos. Esta guía no publica nada.

## Cuando 27/1 pase a «actual» (migración pendiente)

Los horarios del alumno viven en `hu.w.proximo` y `hu.w.actual` (y en el perfil `ipnt`). Cambiar solo los datos haría
que su plan de 27/1 apareciera como «próximo» de otro periodo. Propuesta, sin implementar: (1) `oferta.json` lleva el
id de cada periodo (`actual: 26/2`, `proximo: 27/1`); (2) el cliente guarda junto a cada plan el id con que se creó y,
al cargar, si el id de `actual` coincide con el del plan guardado en `proximo`, mueve ese plan a `actual` una sola vez,
conservando el anterior en una clave de respaldo y con la misma marca de tiempo del perfil; (3) se publica primero el
cliente y después los datos. Hasta entonces la oferta se mantiene por identidad (paso 4).
