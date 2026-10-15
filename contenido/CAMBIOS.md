<!-- SPDX-License-Identifier: CC0-1.0 -->
# Cambios de textos

## 2026-10-15 · 2026.10.24 · Claude (GOOG1)

| Claves | Cambio |
|---|---|
| `cuenta.migracion.*` | Nuevas: pasos y avisos para pasar los datos guardados con Google a Microsoft. Google ya no se ofrece para iniciar sesión; se retiran los avisos de «fase de prueba» de Google (que estaban escritos en `tools/cuenta.py`). |

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
