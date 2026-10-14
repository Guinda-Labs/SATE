# Rendimiento de SATE

## 1. Alcance y método

Análisis local de la rama `codex/sate-rendimiento`, sobre la base del generador acotado a 3 segundos. No se abrió un navegador, no se descargaron bibliotecas ni se enviaron recursos o perfiles a servicios. Los datos del banco son ficticios. Los tiempos de Node sirven para comparar el motor en esta máquina; no estiman la experiencia de un teléfono.

El [inventario completo](rendimiento/pesos.md) registra cada HTML y script compilado, además de los JSON publicados, con bytes originales y gzip nivel 9 (`mtime=0`). Gzip es una estimación de compresión local: el servidor, la caché y los encabezados determinan la transferencia real. Los logos y las fuentes no están incluidos en ese inventario de código y datos. Las bibliotecas externas se medirán mediante Resource Timing al usarlas.

**Herramienta interna (no se publica):** compilar con `SATE_MEDIR=1` (sin esa variable `medicion.js` no se copia a
`web/dist`) y abrir solo desde un servidor local; `?medir` se ignora en cualquier otro dominio.

Para repetir la medición de carga, servir `web/` con `python -m http.server 8080 --directory web` y abrir `/dist/sate/index.html?medir`. Conservar `?medir` antes del hash de navegación. El panel permanece plegado y permite copiar un JSON local. No contiene nombres, boletas, materias del perfil, valores ni claves completas de almacenamiento. Los recursos se identifican sin query ni fragmento.

## 2. Costos estimados, de mayor a menor

| Prioridad | Hallazgo y evidencia | Costo esperado | Acción |
|---:|---|---|---|
| 1 | `generarPasos`, `generateBank` y `qualityOf` en `horarios.js`: recursión de subconjuntos y grupos; cálculo repetido de calidad, días y puntuación | CPU alta, hasta 250 mil pasos; en Todas se acumulan resultados antes de ordenar y deduplicar | Presupuesto adaptativo implementado; Worker propuesto |
| 2 | `datos/upiita/electivas.json`: 702 967 bytes; `tramites.json`: 508 278; incluyen PDF en base64 | Red y memoria altas al visitar Ventanilla; JSON, cadenas base64 y buffers de PDF pueden coexistir | Ya diferidos; separar formatos del catálogo en una futura tarea |
| 3 | `nucleo.js`: aproximadamente 147 KB sin compresión y 50 KB gzip; cuenta, lector, cálculo académico y listeners compartidos | Parseo, evaluación y estado residente aun si solo se consulta Calendario | No separar ahora: requiere verificar dependencias globales |
| 4 | `index.html`: aproximadamente 232 KB, 55 KB gzip, CSS y configuración compartida | Carga y parseo inicial de estilos/configuración de todas las unidades | Medir primero; no reescribir el cascarón |
| 5 | Gráficas D3/Plot, exportación Excel/PDF y canvas de 1400 px con escala predeterminada 3 | CPU, SVG y memoria al pedir gráficos/exportar; un canvas RGBA de W×H×k² cuesta 4WHk² bytes solo en píxeles | Carga ya diferida; proponer resolución menor por clase |
| 6 | `renderMap0`, `renderOffer`, `renderCal`, `renderStatsVista` reconstruyen subárboles; hover, filtros y simulación los invocan | DOM, estilos y layout repetidos; potencial tarea larga en mapas grandes | Instrumentación implementada; proponer actualizaciones por región |
| 7 | `adaptarPestanas` clona tabs y controles, consulta anchuras y estilos, observa mutaciones/redimensionado | Layout síncrono y DOM temporal; ya agrupado por `requestAnimationFrame` | Mantener; comparar con un teléfono de ancho 375 px |
| 8 | Fuentes Google de Noto Sans variable y Mono; transiciones y scroll suave | Red inicial y repintados breves | Proponer fuentes del sistema con saveData; respetar movimiento reducido |

El límite de 3 segundos se comprueba durante la búsqueda. La ordenación final, el render, la preparación de la oferta y una llamada individual no interrumpible quedan fuera de una garantía estricta de 3 segundos de tiempo total. El banco registra la duración de la operación completa. La interfaz actual cede cada 128 pasos y consume bloques de unos 12 ms antes de volver al temporizador; reduce bloqueos, pero sigue calculando en el hilo principal.

Sin restricciones, con m materias y g grupos uniformes, elegir grupo u omitir una materia produce hasta `(g+1)^m` hojas en Todas. Con 12 materias y 6 grupos esto da `7^12 = 13 841 287 201` hojas. En Automático se recorren tamaños 3 a 8: antes de podas, la suma es `Σ C(m,n)g^n`. Los choques, créditos, optativas, cupos internos y presupuestos evitan recorrer todo; ampliar el plazo no resuelve el crecimiento exponencial.

## 3. Qué se carga y qué se ejecuta

| Elemento | Cuándo se carga | Observación |
|---|---|---|
| Cascarón, componentes, rutas e inicio | Entrada | CSS y configuración inline; fuentes por stylesheet externo |
| `nucleo.json`, `nucleo.js`, `situacion.js` | Elegir una unidad completa | Inicializa cuenta/Lector, almacenamiento, planes, simulación, estado de carrera y controles |
| `generico.js` | Entrada sin unidad o unidad genérica | Cuenta y lector compartidos; no descarga la oferta de una unidad completa |
| `oferta.json` | Primera visita a Mapa u Horarios | Promesa reutilizada; se incorpora a `SATE_DATA` |
| Mapa, Horarios, Desempeño, Calendario | Primera visita a cada pestaña | Los módulos quedan residentes; no se descargan de nuevo |
| D3 7.9.0 y Observable Plot 0.6.17 | Abrir sección Áreas con gráfica | Carga secuencial con integridad; no se solicitan en la entrada ni con sección cerrada |
| Datos de trámites y módulos de los trámites configurados | Primera visita a Ventanilla | Se cargan los módulos de todos los trámites habilitados; los PDF base64 de dictamen viajan con sus datos |
| Datos PDF de Electivas | Preparar Electivas | El catálogo/formatos no está en el núcleo |
| `exportacion.js` | Abrir exportación del horario | Inserta su diálogo y controles entonces |
| ExcelJS 4.4.0 | Solicitar Excel | CDN, no presente en disco para pesar |
| pdf-lib 1.17.1 | Generar PDF de horario o trámite | Dos cargadores existentes; comparten el global PDFLib, no se refactorizaron |
| `saes-dialogo.js` | Abrir el Lector | La lectura del perfil guardado ocurre antes, sin abrir el diálogo |
| `medicion.js` | Solo con `?medir` | Sin descarga, observadores, panel ni recopilación si falta el parámetro |

No se detectó una biblioteca pesada de gráficos/PDF/Excel cargada de entrada que necesite diferirse en esta rama. Se conservó la carga bajo demanda existente. El núcleo sí lee el estado guardado y prepara planes A y simulación aunque esas vistas no se usen; la navegación inicial llama a `renderTop`, `renderAviso` y avisos de situación. Los cálculos de estadísticas y gráficos permanecen ligados a la vista/sección correspondiente. La vista inicial Mapa necesita oferta y sugerencias, por lo que su costo supera el de mostrar únicamente el selector.

Los listeners de documento en `nucleo.js` cubren pointerdown, click, keydown, change, pointerover/out y focusin/out; el scroll de ayudas es pasivo. Hay resize con debounce de 150 ms para mapa, observadores de tema y navegación, y eventos de medios para teléfono. Se registran una vez al cargar los módulos; cambiar de unidad recarga la página. Un filtro de oferta en cada pulsación reconstruye la oferta; hover de grupo repinta el calendario; cambios de selección llaman a `refresh`, que repinta oferta, planes y calendario, y reinicia generación si había resultados. Calendario reconstruye la vista al cambiar mes/filtros; Desempeño invalida y reconstruye sus secciones al recalcular.

Las animaciones observadas son transiciones de 120–150 ms en cajas, interruptores, tarjetas y botones, más entrada del modal en móvil. No hay bucle continuo de animación detectado. El modal, cajas del mapa y pestañas ya incluyen reglas de movimiento reducido; algunos controles y scroll suave no tienen cobertura completa. Su costo estimado es menor que búsqueda, JSON y reconstrucción de DOM.

## 4. Contrato y límites de la medición

| Clave JSON | Qué mide | Límite de interpretación |
|---|---|---|
| `carga` | Navigation Timing, Resource Timing, cantidad/scripts y bytes inline, transferidos y decodificados | Cero puede significar caché o restricción cross-origin; null indica dato ausente |
| `pinturas` | FCP y último LCP observado, en ms desde navegación | LCP solo se estabiliza al interactuar o esconder la página |
| `rutas` | Activación, carga de oferta/módulo y render síncrono del enrutador | No equivale a presentación de píxeles; incluye rutas invalidadas por una nueva navegación |
| `renders` | Cada repintado de pestaña y render principal de Mapa/Horarios/Perfil, Calendario y Ventanilla | Registros anidados no deben sumarse; una promesa incluye espera asíncrona, no solo CPU |
| `generaciones` | Duración, pasos, opciones, truncamiento, cancelación, error y presupuesto | Registra la corrida propia aunque otra la sustituya |
| `tareasLargas` | Inicio y duración de longtask | API principalmente Chromium; no identifica la función culpable |
| `interacciones`, `inpAproximado` | Event Timing de controles de pestaña y Generar, máximo observado | Umbral 16 ms, duraciones redondeadas; no es el INP oficial ni el tiempo total de búsqueda |
| `memoria` | Heap de Chromium; total de measureUserAgentSpecificMemory al copiar o llamar `medirMemoria()` | API experimental; puede requerir aislamiento cross-origin; null/razón si no disponible |
| `dom` | Nodos DOM con TreeWalker y cantidad de elementos | Incluye texto/comentarios; excluye shadow DOM. Si falta TreeWalker, marca soloElementos |
| `almacenamiento` | Bytes UTF-16 por prefijo hu, ue, saes, ipnt y otros | `2 × (longitud de clave + longitud de valor)`; no es cuota real del navegador |
| `dispositivo` | Núcleos lógicos, RAM aproximada, red/saveData, viewport, DPR y movimiento reducido | Señales opcionales, redondeadas y no equivalentes a potencia de CPU |

Se retienen los últimos 500 registros por serie para acotar el costo del diagnóstico. Las marcas y medidas se eliminan de la línea de tiempo después de registrar su duración. El módulo añade un panel y observadores: comparar las pruebas con el mismo modo activo y hacer una pasada adicional sin medición. No hay polling ni envío de red desde el diagnóstico; las cargas habituales de SATE, fuentes y bibliotecas siguen su comportamiento existente.

## 5. Banco del motor

Ejecutar `D:\Tools\nodejs\node.exe tools/bench_generador.mjs` desde la raíz. Produce una tabla y [bench-generador.json](rendimiento/bench-generador.json), con Node, semilla, duración total y presupuesto. Usa las funciones reales de `horarios.js` en VM, sin copia del algoritmo. Semilla fija 20261014, cinco bancos de 4, 6, 8, 10 y 12 materias con 2–6 grupos; cada banco se reutiliza en Automático y Todas. Bloques ficticios de 90 minutos, choques reales, 6 créditos por materia y carga media 40. Preferencias, actividades propias y optativas quedan vacías.

La primera ejecución local duró aproximadamente 10 segundos: 4 materias, 364/899 pasos; 6, 17 113/24 220; 8, 57 857/51 771; 10 y 12, aproximadamente 250 mil pasos y truncamiento en ambos modos. Salvo Automático de 4 materias, que encontró una opción, los casos conservaron seis opciones. Consultar el JSON para los milisegundos de la ejecución final. La duración varía con carga de la máquina, JIT y Node; la semilla repite las entradas, pero el corte por tiempo puede cambiar pasos/resultados en una máquina lenta. El banco consume el iterador sin temporizadores de UI, y no mide layout, paint, descargas ni RAM.

## 6. Dispositivos modestos: propuesta y presupuesto

Las clases son heurísticas con precedencia de baja sobre las demás: baja si una señal disponible indica ≤4 núcleos lógicos, ≤4 GB o saveData; alta si ambas indican ≥8; media en el resto con alguna señal disponible. Sin señales se conserva el presupuesto histórico, etiquetado alta por compatibilidad. No significa que el dispositivo sea potente. saveData expresa preferencia de ahorro, no velocidad de CPU.

| Clase | FCP objetivo, caché fría en red estable | Render de pestaña p95 | Generación propuesta | Heap objetivo después de uso |
|---|---:|---:|---|---:|
| Baja | ≤3 s | ≤100 ms | ≤1.5 s en Worker, 60 mil pasos | ≤80 MiB |
| Media | ≤2.5 s | ≤75 ms | ≤2 s en Worker, 140 mil pasos | ≤120 MiB |
| Alta | ≤2 s | ≤50 ms | ≤3 s, 250 mil pasos | ≤180 MiB |

Son objetivos para validar, no resultados medidos ni garantías. En la implementación barata se aplica únicamente el presupuesto de pasos y se mantiene el plazo máximo histórico de 3 s en las tres clases. No se bloquea una función por la clase ni se conserva una clasificación en localStorage. Cuando una corrida de clase baja alcanza su presupuesto, se explica que se recortó la búsqueda y se recomienda reducir materias o ajustar filtros. Las opciones parciales siguen siendo utilizables; no se promete una búsqueda exhaustiva.

| Orden de degradación | Función esencial preservada | Función ajustable/prescindible | Estado |
|---:|---|---|---|
| 1 | Ver oferta, créditos, choques y horario elegido | Profundidad de búsqueda combinatoria | Implementado por pasos |
| 2 | Interactuar, reiniciar y cancelar | Trabajo del generador en hilo principal | Worker propuesto |
| 3 | Consultar perfil, mapa y trámites | Descargar gráficos/PDF/Excel antes de pedirlos | Ya diferido |
| 4 | Leer relaciones y requisitos | Todas las cajas/flechas simultáneas y gráficas detalladas | Proponer lista/mapa enfocado y resumen textual; sin ocultar requisitos |
| 5 | Exportar un horario legible | Escala 3 del canvas y PDF con todos los horarios | Proponer escala 1–2 y exportación por opción |
| 6 | Foco, navegación y feedback de progreso | Transiciones, scroll suave y fuentes externas | Proponer movimiento mínimo y fuente del sistema con saveData |

Avisos propuestos: «Mostramos una vista más ligera. Puedes abrir el mapa completo cuando lo necesites.» y «La búsqueda llegó al presupuesto de tu dispositivo; estas son las opciones encontradas.» Evitar calificativos sobre la calidad del equipo. Siempre ofrecer continuar con las funciones esenciales y un control explícito para solicitar la vista completa.

## 7. Diseño del Web Worker pendiente

Extraer solo el motor puro a un script compartido por UI, Worker y banco; no duplicar reglas académicas. Hoy depende de globals, DOM (`#g-compact`), `cur`, `tr`, restricciones y funciones de calidad, de modo que moverlo directamente rompería contratos. El trabajo previo consiste en convertir esas lecturas en parámetros inmutables, conservando la API de pruebas.

Al pulsar Generar, tomar un snapshot mínimo con materias, grupos, bloques, créditos, carga, optativas, obligatorias, preferencias y actividades ficticias o propias. No transferir el perfil completo, nombres ni boletas; sustituir referencias por índices. Mensaje de inicio `{id, opciones, restricciones, presupuesto, semilla}`. Respuesta `{id, progreso:{pasos,ms}}` como máximo cada 100 ms y resultado final `{id, opciones, trunco, causa}`. La UI resuelve los índices contra su oferta y realiza el render.

Cancelación: invalidar id y terminar el Worker de la corrida activa; uno nuevo para reiniciar si no acepta cancelación cooperativa. Rechazar mensajes cuyo id no coincida con la corrida actual. Contabilizar deadline dentro del Worker con su propio `performance.now`, sin compartir marcas absolutas entre contextos. Error estructurado con id, etapa, clase, pasos y duración, sin datos personales; recuperar botón y conservar horario elegido. Ante fallo de Worker, usar el motor cooperativo existente con el presupuesto bajo y avisar del recorte.

Validación previa a activarlo: mismos resultados sin límites con bancos pequeños; mismos criterios académicos con fuzz ficticio; cancelación y segunda corrida; temporizadores de UI responden durante búsqueda; p95 de render/heap en teléfonos; costo de structured clone frente al cálculo. Acotar resultados residentes, idealmente conservar solo candidatos necesarios, requiere una tarea separada que demuestre equivalencia de deduplicación y desempates.

## 8. Preguntas, aclaraciones y decisiones pendientes

| Pendiente | Evidencia necesaria |
|---|---|
| Presupuestos finales por clase | Tres ejecuciones frías y tres calientes por unidad, viewport 375 px y escritorio, con DEMO y sin perfil |
| CPU/RAM reales y bytes CDN | JSON del navegador con `?medir`, abrir cada pestaña y generar; no usar perfiles reales |
| Validez de FCP/LCP/INP aproximado | APIs soportadas, caché/red, interacción y visibilidad al copiar; no confundir búsqueda con latencia de interacción |
| Partición de núcleo, formatos y caché | Medir transferencia residente y necesidad de PDF en la primera visita a Ventanilla |
| Recursos institucionales | La suite HTTP local falla con cuatro logos ausentes de dist; `institucional.py` indica que esos archivos oficiales no se incluyen |
| Revisión visual y consola | A cargo del orquestador: sin automatización ni navegador en este trabajo |

## 9. Validación local

Compiladas UPIITA, ESCOM y UPIBI con `UPIITA_SITE=https://silver-vs.github.io/upiita/`. Ejecutadas todas las `tests/qa_sate_*.mjs`, incluida medición, con Node directo: 21 archivos, cero fallos. No se ejecutaron `qa_componentes.mjs`, `qa_dictamen.mjs`, fuzz con Chrome ni herramientas de navegador. Las pruebas de JS usan VM/DOM ficticio y parsean los scripts compilados. La suite `python -m unittest tests.test_sate tests.test_contenido` ejecutó 25 pruebas y reportó cuatro errores 404 del mismo test de recursos publicados por HTTP, por logos oficiales faltantes. El banco final terminó en 7.53 segundos. No hubo commits, push ni publicación.

## 10. Primera medición en navegador (orquestador, 2026-10-14)

Equipo de referencia: escritorio con 24 núcleos lógicos y 16 GB (clase alta), Chromium del navegador integrado, servidor
local, perfil DEMO de UPIITA, ventana de 914 × 473. Una sola pasada fría y una caliente; no es una muestra estadística.

| Métrica | Resultado |
|---|---|
| Documento inicial | 227 KB (sin compresión del servidor local); interactivo en 437 ms |
| FCP / LCP | 356 ms / 560 ms |
| Recursos tras recorrer Perfil, Mapa y Horarios | 17 archivos, ≈ 583 KB |
| Ruta Tu perfil (primera vez / después) | 189 ms / 46 ms (`renderStatsVista` 138 ms) |
| Ruta Mapa (primera vez) | 134 ms |
| Ruta Horarios (primera vez / después) | 97 ms / 19 ms |
| Tareas largas | 4 en todo el recorrido; máximo 170 ms (carga de Tu perfil) |
| Generación (DEMO, base de filtros y «todas las elegidas») | ≈ 31 000 pasos, 230–275 ms, 6 opciones, sin truncar |
| Heap de JS tras recorrer y generar | 6.4 MB usados (16 MB reservados) |
| Nodos DOM | 3 195 (1 877 elementos) |
| Almacenamiento local | < 1 KB (modo DEMO usa sessionStorage) |

Banco del motor (Node, misma máquina): ≈ 7 µs por paso; 10–12 materias llegan a 250 000 pasos en 1.4–1.8 s.

**Lectura.** En un equipo rápido nada se acerca a los presupuestos. Con la regla práctica de que un teléfono de gama baja
ejecuta JavaScript entre 5 y 10 veces más lento (supuesto, falta medirlo en un teléfono real), lo crítico es:
1. el generador sin límite (ya acotado: 3 s y, en clase baja, 60 000 pasos ≈ 2–4 s en ese teléfono);
2. la primera carga de **Tu perfil** (≈ 170–190 ms aquí → ≈ 1–2 s de pantalla congelada en gama baja): primer candidato
   a dividir en partes (estadísticas y gráficas después de pintar lo esencial);
3. el primer render del Mapa (≈ 134 ms → ≈ 0.7–1.3 s).
Memoria y DOM son modestos; no son el problema.

Siguiente: medir en un teléfono real de gama baja (el mismo `?medir` y «Copiar resultados») y, si se confirma, mover el
generador a un Worker y diferir las estadísticas de Tu perfil.
