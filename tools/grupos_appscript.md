# 1. Instalación con clasp

Desde una carpeta de despliegue `<dir>` fuera del checkout, ejecutar:

```sh
npx @google/clasp create --type sheets --title "SATE · Grupos de WhatsApp" --rootDir <dir>
```

Copiar `grupos_appscript.gs` como `Codigo.gs` y `grupos_appsscript.json` como
**`appsscript.json`** dentro de `<dir>` (clasp exige ese nombre). Conservar `.clasp.json`;
retirar el archivo `.gs` inicial si lo hay. Desde esa carpeta:

```sh
npx @google/clasp push
npx @google/clasp deploy
```

En el editor ejecutar `configurar()` una vez y autorizar. Copiar `CLAVE_EXPORT` del
registro al secreto **GRUPOS_CLAVE** del repositorio del sitio. No guardar esa clave en Git.
Verificar la implementación web: ejecutar como el dueño y acceso «Cualquier usuario».
Poner su URL `/exec` en `data/grupos.json` → `endpoint`; recompilar mediante el flujo del sitio.
Para actualizar conservando la URL: `npx @google/clasp push` y
`npx @google/clasp deploy -i <id-implementacion>`.

# 2. Propiedades del script

| Propiedad | Valor |
|---|---|
| `CLAVE_EXPORT` | La genera `configurar()` si falta; secreto de lectura de la Action |
| `GH_TOKEN` | Token fino, solo repo del sitio, permiso Actions: write; opcional |
| `GH_REPO` | `Guinda-Labs/guinda-labs.github.io` (predeterminado) |
| `GH_WORKFLOW` | `grupos.yml` (predeterminado) |
| `SITIO` | `https://guinda-labs.github.io` (predeterminado) |
| `ESCRITURA` | `cerrada` para congelar; borrar para abrir |
| `ULTIMO_DESPACHO` | Interna; instante del último intento, no editar |

# 3. Operación

Para ocultar un renglón, poner booleano `TRUE` (casilla marcada) en su columna `ocultar`.
El historial posterior se vuelve a evaluar; si dependía del enlace oculto también deja de aplicar.
Esperar hasta 60 s de caché y la próxima publicación. `exportar` devuelve directamente
el mapa `{id: {url, desde, reemplazo}}`, sin envoltura. El día de la cuota es UTC y
cuenta reemplazos ocultos; ambos modos tienen cuota propia por casilla y comparten el tope global.
El activador `despachar` es único; necesita autorización previa de `configurar`/editor.
