# 1. Arquitectura

[Contrato común](../../../coordinacion-wt/ipt-estado/ipn-tools/encargos/GRUPOS-contrato.md), fuente de verdad.
`tools/grupos_appscript.gs` recibe escrituras anónimas en una Sheet privada; solo agrega historial.
Pestañas `Enlaces` y `Prueba`: fecha UTC, tipo, id, url, anterior, motivo, detalle, ocultar.
Cada decisión de escritura relee la hoja con candado; no usa el mapa de caché.
El curado ordena fechas, omite filas ocultas y aplica reemplazos solo sobre el anterior vigente.
Oferta: caché 6 h; mapa: 60 s e invalidación al guardar; cuota global: 30 escrituras/minuto.
`exportar` devuelve el mapa curado directamente y exige `CLAVE_EXPORT`.
La Action exporta ambos modos, valida y cambia JSON únicamente cuando cambia el contenido.
Los archivos de `tools/grupos_sitio/.github/` se copian al `.github/` del repositorio del sitio.
El build de la página nunca genera `enlaces*.json`; solo la Action los mantiene.
Instalación y propiedades: [guía clasp](../tools/grupos_appscript.md).

# 2. Operación

| Acción | Procedimiento |
|---|---|
| Ocultar | Marcar `ocultar=TRUE` en la fila, sin borrar historial; esperar caché y publicación |
| Cerrar escritura | Propiedad del script `ESCRITURA=cerrada`; borrar para reabrir |
| Rotar token | Revocar token anterior, crear token fino Actions: write y actualizar `GH_TOKEN` |
| Rotar clave | Cambiar `CLAVE_EXPORT` y secreto GitHub `GRUPOS_CLAVE` juntos; no registrarlos en Git |
| Cambiar horario | Editar `data/grupos.json`, regenerar y publicar `config.json` con el flujo del sitio |
| Semestre nuevo | Cerrar escritura, archivar o vaciar ambas pestañas conservando encabezados, regenerar oferta |
| Refrescar caché | En editor: `CacheService.getScriptCache().removeAll(['oferta', 'mapa_Enlaces', 'mapa_Prueba'])` |
| Finalizar semestre | Refrescar caché, reabrir escritura, ejecutar Action manual y verificar ambos JSON |

# 3. Decisiones y límites

El día de seis reemplazos se cuenta en UTC, incluyendo filas ocultas, por pestaña y casilla.
La cuota por minuto es global para ambos modos; CacheService puede expulsar entradas antes de vencer.
No se guardan identidades, IP ni datos personales; el detalle libre se protege contra fórmulas.
Un despacho GitHub se intenta como máximo cada 6 min; un activador único difiere el siguiente.
El horario de GitHub es aproximado; la ejecución manual siempre pasa la compuerta.
Pendiente del dueño: desplegar Apps Script, configurar secretos y copiar la Action al repo del sitio.
GitHub Pages puede no reconstruir cambios enviados con `GITHUB_TOKEN`: verificar Pages al integrar.
