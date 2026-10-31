<!-- SPDX-License-Identifier: CC0-1.0 -->
# Cambios de textos

## 2026-10-31 · 2026.10.30 · Codex (R28-MAN)

Se agregaron claves `sate.guia.manual.*` para el selector, árbol, ficha y citas de manuales oficiales.

## 2026-10-15 · 2026.10.26 · Claude (GUIA5)

| Claves | Cambio |
|---|---|
| `sate.guia.situacion`, `tramites`, `reglamentos`, `acudir` y sus `_descripcion`/`_intro`, `buscar_guia_*`, `resultados_preguntas`, `que_hacer`, `a_quien`, `formato_titulo`, `fuente*`, `revisado`, `en_ventanilla` | Nuevas: la Guía politécnica ahora tiene cinco apartados (preguntas frecuentes buscables con fuente, reglamentos, a quién acudir y programas de estudio). El contenido vive en `data/guia/upiita.json`. `sate.guia.intro` cambia a la nueva presentación. |
| `sate.guia.caminos`, `explorar_titulo/texto/punto_*/boton`, `ayuda_*`, `ver_todos`, `oficial`, `buscar_catalogo`, `abrir_externo`, `normativa*`; `temarios.buscar.*`, `temarios.filtro.nivel*/tipo*/carrera_todas`, `temarios.lista.coincide`, `temarios.donde.*`, `temarios.explorador.titulo/volver/elegir/cargando`, `temarios.panel.abrir_explorador` | Retiradas: ya no hay tres vistas de materia ni lista larga; la ficha es una sola y el selector es una ventana. |
| `temarios.selector.*`, `temarios.ficha.*`, `temarios.explorador.no_encontrado_titulo` | Nuevas: selector de unidad de aprendizaje (buscador, áreas, orden por nivel o de la A a la Z), ficha única con índice, «Ver ficha completa» en el vistazo del Mapa. |
| `sate.biblio.*`, `sate.guia.biblio_digital_aviso`, `biblio_tesis*` | Nuevas: búsqueda en las bibliotecas del IPN (catálogo, Biblioteca Digital y tesis) desde SATE. |
| `componentes.migas`, `volver_a`, `buscar_borrar`, `pestana_nueva` | Nuevas: migas y «Volver a …» comunes, buscador y aviso de pestaña nueva. |
| `sate.ventanilla.volver`, `ver_guia*`, `guia_*` | `volver` ahora dice «← Volver a Ventanilla digital»; nuevos enlaces de la Ventanilla a la respuesta de la Guía. |

## 2026-10-15 · 2026.10.25 · Claude (GUIA4)

| Claves | Cambio |
|---|---|
| `sate.guia.oficial`, `sate.guia.nota` | «Leer el programa completo aquí» (transcripción) y nota que remite al PDF original. |
| `sate.guia.pdf`, `pdf_ayuda`, `descripcion_pendiente`, `bibliografia`, `buscar_catalogo`, `relaciones`, `antes`, `despues`, `*_ninguna` | Ficha en panel grande: PDF original en la nube de la UPIITA, bibliografía, nota de descripción pendiente de revisión y materias de antes y después. |
| `sate.guia.consultar_*`, `explorar_*`, `modo_*`, `ayuda_*`, `biblio_*`, `inspector_vacio`, `que_es`, `abrir_*` | Portada de la Guía con dos caminos (consultar un temario / explorar mi carrera), explorador por líneas de aprendizaje y «¿No sabes por dónde empezar?» con las bibliotecas del IPN (enlaces en `data/sate.json`, `bibliotecas`). |

## 2026-10-15 · 2026.10.25 · Claude (VEN1)

| Claves | Cambio |
|---|---|
| `sate.ventanilla.*` | Portada por grupos («En curso y terminados», «Disponibles»), pasos navegables, ayuda de revisión, texto de guardado y botones de datos movidos del código a claves. `titulo` ahora es «Ventanilla digital»; `estado_no_iniciado` → «Sin iniciar»; `revisar` → «Revisa y descarga». |
| `sate.baja.*`, `sate.tramite.baja_temporal/baja_definitiva.titulo` | Nuevas: bajas temporal y definitiva. Textos de requisitos y plazos **pendientes de contrastar con el reglamento**. |
| `sate.electivas.categoria_catalogo/nombre_ayuda` | Nuevas: la categoría del catálogo va aparte y el nombre de la actividad se puede cambiar. |
| `sate.cupos.config_titulo` y relacionadas | Barra de configuración de Cupos (avisos y consulta automática), «Última consulta» con aviso de consulta antigua y medidor por fila. `avisos_mas` se conserva porque el marcador del SAES todavía la usa. |

## 2026-10-15 · 2026.10.24 · Claude (GOOG1)

| Claves | Cambio |
|---|---|
| `cuenta.migracion.*` | Nuevas: pasos y avisos para pasar los datos guardados con Google a Microsoft. Google ya no se ofrece para iniciar sesión; se retiran los avisos de «fase de prueba» de Google (que estaban escritos en `tools/cuenta.py`). |

## 2026-10-15 · Claude (DESC1)

| Claves | Cambio |
|---|---|
| Descripciones de materias (`data/temarios/upiita/descripciones/*.json`) | La ficha muestra una descripción breve redactada por materia (no oficial; `revisada: false`, pendiente de revisión humana) en lugar del objetivo recortado; el objetivo completo sigue en «Ver programa oficial completo». Créditos y horas faltan: se toman del plan del SAES o se ocultan. |

## 2026-10-15 · Codex (GUIA1)

| Claves | Cambio |
|---|---|
| `sate.pestana.guia.*`, `sate.guia.*` | Guía politécnica, apartados desde datos, hoja «Más» y ficha breve de materia: tres datos, pasos temáticos, recursos opcionales y acceso al programa completo. |
| `temarios.explorador.titulo`, `sate.ventanilla.sin_tramites` | Título formal de Programas de estudio y estado vacío de Ventanilla en unidades sin trámites disponibles. |

## 2026-10-15 · Codex (LEC2)

| Claves | Cambio |
|---|---|
| `temarios.modo.*`, `temarios.mapa.sin_temario/abrir_aria` | Retiradas al quitar del mapa el modo de exploración y el enlace general a temarios. |
| `temarios.mapa.ver` | «Ver programa» en la ficha de la materia; conserva el enlace a su temario. |

## 2026-10-14 · 2026.10.23 · Claude (LEC1)

| Claves | Cambio |
|---|---|
| `policore.lector.*` | Textos del lector de documentos de PoliCORE (índice, búsqueda, copiar enlace, fuente). |
| `sate.vista.temarios.*`, `temarios.*` | Modo «Explorar unidades de aprendizaje» del mapa, panel del temario, explorador de temarios y etiquetas del adaptador. |

## 2026-10-07 · 2026.10.20 · Codex

| Claves | Cambio |
|---|---|
| `sate.encabezado.actualizar/indicador/usando_datos/sin_datos` | Actualizar datos e indicador accesible SAES en la fila de avisos, con fecha de lectura. |
| `sate.trayectoria.sin_datos` | Invita solo al Lector; retiradas las claves de demostración y del menú SAES sin uso. |

## 2026-10-07 · 2026.10.19 · Codex

| Claves | Cambio |
|---|---|
| `sate.encabezado.*` | Encabezado compacto: cambio de unidad, chip de fase de prueba, carrera accesible, Mis datos y opciones de actualización/demostración; estados del SAES conservados. |

## 2026-10-07 · 2026.10.18 · Claude

| Clave | Antes | Después |
|---|---|---|
| `sate.minimapa.done/fail/late` | {n} acreditadas / reprobadas / desfasadas | con plural (1 acreditada, 1 reprobada, 1 desfasada) |

## 2026-10-07 · 2026.10.17 · Claude

| Clave | Antes | Después |
|---|---|---|
| `sate.minimapa.pend` | {n} pendientes | {n} por cursar |

## 2026-10-07 · 2026.10.16 · Claude

| Clave | Antes | Después |
|---|---|---|
| `sate.pie` | (en el código) Herramienta de consulta para que el alumno planee su reinscripción… | SATE te ayuda a entender tu situación escolar y a planear tu trayectoria… |

## 2026-10-07 · 2026.10.15 · Codex

| Claves | Cambio |
|---|---|
| `sate.pestana.horarios.titulo`, `sate.pestana.calendario.titulo` | Horarios de clase y Calendario escolar; ids, rutas y etiquetas cortas conservados. |
| `sate.minimapa.*` | Acción accesible y leyenda de acreditadas, en curso, pendientes, reprobadas y desfasadas para el minimapa compartido. |

## 2026-10-07 · 2026.10.13 · Codex

| Claves | Cambio |
|---|---|
| `sate.pestana.calendario.*`, `sate.calendario.anterior`, `proximo`, `filtros`, `instrucciones`, `sin_eventos`, `leyenda`, `categoria_*` | Vista mensual, filtros, navegación por teclado y categorías del calendario compartido. |

## 2026-10-07 · 2026.10.12 · Codex

| Claves | Cambio |
|---|---|
| `sate.planeacion.leer_mapa`, `explorar_cursor`, `explorar_tactil`, `supuesto_titulo`, `pie`, `pie_tope`, `sin_trayectoria`, `propuesta`, `flechas`, `sombreado`, `niveles`, `flechas_lejanas`, `resaltar_tactil`, `resaltar_cursor`, `flechas_ocultas` | Ayuda fuera del flujo, supuesto contextual y resumen compacto de ambos periodos en el pie integrado del mapa. |

## 2026-10-07 · 2026.10.11 · Codex

| Claves | Cambio |
|---|---|
| `sate.planeacion.activo`, `asignada`, `horarios`, `quitar_activo`, `quitar`, `sin_grupos`, `obligatoria` | Pincel de periodo anunciado, leyenda numerada y grupos simultáneos debajo del mapa; horario de N. |

## 2026-10-07 · 2026.10.10 · Codex

| Claves | Cambio |
|---|---|
| `sate.planeacion.resumen` | Resumen de materias y carga en una línea para el módulo plegable junto al minimapa. |

## 2026-10-06 · 2026.10.9 · Codex

| Claves | Cambio |
|---|---|
| `sate.planeacion.*` | Panel del mapa, dos periodos, proyección de N+1, créditos, acceso al simulador y cuenta ICU. |

## 2026-10-06 · 2026.10.8 · Codex

| Claves | Cambio |
|---|---|
| `sate.desempeno.*` | Panel independiente, invitación al Lector y DEMO, simulación plegada, chip global y acción Quitar; controles de simulación trasladados. Cuenta de materias con plural ICU. |

## 2026-10-06 · 2026.10.7 · Claude

| Clave | Antes | Después |
|---|---|---|
| `situacion.adeudos_cuerpo` (o equivalente) | Hay {n} materias pendientes… | Plural: «Hay 1 materia pendiente…» / «Hay N materias…» |
| `plazo_titulo` | — | Plazos por vencer (título de la tarjeta cuando hay plazo próximo sin desfase) |

## 2026-10-06 · 2026.10.6 · Codex

| Claves | Cambio |
|---|---|
| `sate.situacion.*` | Situación escolar: chips, tarjetas por tema, cuatro cifras, invitación al Lector y demostración, opciones por materia y modales. Orientación informativa: una cita ausente no confirma baja; consultar baja temporal autorizada con Gestión Escolar. |
| `sate.calendario.*` | Textos del calendario existente trasladados a claves; conserva fechas, fuente y reglas de vigencia. |

## 2026-10-06 · 2026.10.5 · Codex

| Clave | Antes | Después |
|---|---|---|
| `proyecto.nombre` | Sin clave (migas: IPN-tools) | HADES (decisión del dueño; antes se propuso SARES) |

## 2026-10-06 · 2026.10.3 · Codex

| Clave | Antes | Después |
|---|---|---|
| `proyecto.apoyo.enlace` | Sin texto | Apoya el proyecto |
| `proyecto.apoyo.ayuda` | Sin texto | Donar es voluntario; el proyecto es gratuito y lo mantiene un alumno del IPN. |

## 2026.10.14

Mi trayectoria une el presente y el desempeño; resumen, siguiente paso, metas y estado vacío por clave. Pestañas agrupadas y compatibilidad de rutas anteriores.
