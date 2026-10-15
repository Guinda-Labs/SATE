# Formato del perfil IPN-tools (`ipnt` 1)

Es el documento con el que las herramientas guardan y recuperan lo que el alumno genera: planes de horario,
marcas, materias elegidas, preferencias y, si el alumno lo autoriza, los datos que leyó del SAES. El mismo
documento sirve para:

- la **sincronización** con la cuenta institucional (OneDrive del alumno, carpeta de la aplicación);
- el **respaldo en archivo** (`*.ipnt.json`) que se descarga y se restaura sin iniciar sesión.

No hay servidor propio: el documento vive en el navegador (localStorage) y, opcionalmente, en el OneDrive
del propio alumno. Implementación: `tools/cuenta.py`.

## Documento

```json
{
  "ipnt": 1,
  "tipo": "perfil",
  "app": "IPN-tools",
  "version": "1.1.0",
  "unidad": "upiita",
  "guardado": "2026-10-02T23:10:00.000Z",
  "claves": {
    "hu.w.proximo": { "t": 1759446600000, "v": { "plan": "A", "plans": { "A": { "sel": [], "own": [] } }, "marks": {} } },
    "hu.t.B":       { "t": 1759446500000, "v": { "want": ["B101", "B102"] } },
    "ue.s":         { "t": 1759440000000, "v": { "...": "estado de Electivas" } }
  },
  "borrados": { "saes.alumno": 1759446000000 }
}
```

| Campo | Significado |
|---|---|
| `ipnt` | Versión del formato. Un lector rechaza versiones mayores a la que conoce. |
| `tipo` | `perfil` (documento completo). Reservado: `plan` para compartir un solo horario. |
| `app`, `version` | Herramienta y versión que escribió el documento (informativo). |
| `unidad` | Unidad académica de los datos (`upiita`, `escom`…). |
| `guardado` | Fecha ISO 8601 de escritura. |
| `claves` | Mapa `clave → {t, v}`: `v` es el valor tal como lo guarda la página; `t`, la marca de tiempo (ms desde 1970) de su último cambio. `t: 0` = valor anterior a la sincronización. |
| `borrados` | Mapa `clave → t` de valores eliminados, para que el borrado también se propague. |

## Claves

El nombre de la clave es la llave de localStorage. El prefijo indica la herramienta.

| Prefijo / clave | Herramienta | Contenido | Se sincroniza |
|---|---|---|---|
| `hu.w.<periodo>` | Horarios | Planes A, B… (grupos elegidos y horarios propios), marcas Sí/Quizá/No | Sí |
| `hu.t.<carrera>` | Horarios | Materias que quieres cursar (mapa) | Sí |
| `hu.miSemana` / `hu.<unidad>.miSemana` | Horarios | Rutina opcional: trabajo semanal, traslado por sentido, sueño diario, estudio semanal, límites de entrada y días, rango de comida | Sí |
| `hu.car`, `hu.excl`, `hu.hide`, `hu.onlyWant`, `hu.weekend`, `hu.gtime`, `hu.verSug`, `hu.sim` | Horarios | Carrera, profesores excluidos, filtros, criterios del generador, perfil de demostración | Sí |
| `hu.exp*` | Horarios | Preferencias de exportación (estilo, tema, horarios por hoja) | Sí |
| `hu.tab`, `hu.per`, `hu.tur`, `hu.niv`, `hu.view`, `hu.mview`, `hu.cview`, `hu.mobnote` | Horarios | Estado de la pantalla de cada dispositivo | No |
| `ue.s` | Electivas | Actividades registradas, datos del formato | Sí |
| `saes.alumno` | Ambas | Datos leídos del SAES (kárdex, estado general, cita) | Solo si el alumno lo activa |
| `saes.aviso`, `ipnt.*` | — | Avisos vistos y control interno de la sincronización | No |

Una clave nueva con prefijo `hu.` o `ue.` se sincroniza sin cambiar el formato; las de pantalla se agregan
a la lista de exclusión en `tools/cuenta.py`.

### Datos del SAES para unidades sin plan cargado

El Lector agrega a `saes.alumno` el campo opcional `materias`, un mapa de clave a
`[nombre, semestre|null]`. Ejemplo ficticio: `{"Z101": ["Álgebra ficticia", 1]}`.
El semestre procede del título de la tabla del kárdex o, si no existe, de su orden;
Estado General puede completarlo con `No_Periodo`. El horario aporta nombres sin
inventar semestres. La versión `lector` sigue siendo la huella del código publicado.

Una unidad ausente de `data/sate.json` abre SATE mediante `sate/index.html?sateUnidad=<unidad>`.
Sus vistas son Mi trayectoria y Mapa curricular, construidas con el SAES, sin oferta
ni seriación. Si faltan semestres, el mapa agrupa por periodo cursado y por cursar.
Los perfiles anteriores siguen admitidos: muestran claves y solicitan actualizar el
Lector para incorporar nombres. El desfase se presenta únicamente desde
`desfasadas_saes` y `desfase_saes`; no se calcula a partir de antigüedad o seriación.

Los bloques de trabajo y responsabilidades reutilizan `own` en `hu.w.<periodo>` (o
`hu.<unidad>.w.<periodo>`), con `tipo: "trabajo"` o `tipo: "otras"` opcional.
Los bloques anteriores sin `tipo` se conservan y cuentan como otras responsabilidades;
los bloques con `saes` cuentan como clases. Borrar Mi semana elimina las preferencias y
los bloques con `tipo` de las versiones del periodo consultado, conservando los anteriores.

### Planeación de dos periodos (opcional, ipnt 1)

`hu.t.<carrera>` (o `hu.<unidad>.t.<carrera>`) admite
`{"want":["B101"],"wantPorPeriodo":{"27/1":["B101"],"27/2":["B102"]}}`.
`wantPorPeriodo` es opcional y asocia el periodo escolar a las claves elegidas.
Sin ese campo, `want` se interpreta como la selección del periodo N; al editar,
se conserva `want` como espejo de N para lectores anteriores y se preservan
campos desconocidos. Al avanzar el horizonte se recupera la selección por su periodo.
La pestaña seleccionada es estado transitorio de pantalla, no cambia `ipnt` ni el
periodo del armado de horarios. N+1 se calcula suponiendo acreditadas las materias
de N y excluye las de N y las acreditadas reales o simuladas; no modifica el SAES.
La oferta futura no se conoce y la carga mostrada es una referencia con los datos
disponibles, pendiente de confirmación en la cita correspondiente.
Si no hay periodo conocido por SAES ni calendario, las claves opcionales son
`proximo` y `siguiente`, mostradas como «el próximo periodo» y «el periodo siguiente».
La selección de `siguiente` se recupera cuando se conoce el periodo de destino.

## Fusión

Se combina clave por clave: gana el valor con la `t` más reciente (último en escribir). Un borrado gana si
su `t` es mayor que la del valor. Así, dos dispositivos que editan claves distintas no se pisan.

- **Al iniciar sesión o abrir la página con sesión:** se descarga el perfil, se fusiona con el navegador y,
  si hubo cambios, la página se recarga para mostrarlos.
- **Al guardar un valor distinto:** después de 3 s sin más cambios se sube el perfil. La escritura usa la
  etiqueta `eTag` de OneDrive (`If-Match`); si otro dispositivo escribió antes, se vuelve a descargar,
  fusionar y subir.
- **Restaurar un respaldo:** reemplaza los valores del navegador por los del archivo (con la hora actual), y
  después se sincronizan como cualquier cambio.

## Almacenamiento en la nube del alumno

Un solo proveedor de sesión (`tools/cuenta.py`): Microsoft (OneDrive). Google Drive (`appDataFolder`) solo se lee una vez
para migrar perfiles antiguos (ver `docs/CUENTA-GOOGLE.md`); el archivo y el formato son los mismos.

### Microsoft

- Inicio de sesión con Microsoft Entra ID (MSAL.js). En producción, solo cuentas del tenant del IPN
  (`f94bf4d9-8097-4794-adf6-a5466ca28563`: `@alumno.ipn.mx`, `@ipn.mx`); en pruebas, `common` (también personales).
  Las cuentas del IPN requieren la aprobación del administrador del IPN (app multiinquilino de editor no verificado).
- Permiso único: `Files.ReadWrite.AppFolder`. La aplicación solo ve su propia carpeta
  (`OneDrive › Aplicaciones › IPN-tools`), no el resto de los archivos del alumno.
- Archivo: `perfil.ipnt.json` en esa carpeta (Graph: `/me/drive/special/approot:/perfil.ipnt.json`).
- La sesión (caché de MSAL) se guarda en el navegador (localStorage) para no pedir el inicio de sesión en cada visita; el token va directo a Microsoft Graph y no pasa por ningún servidor nuestro. «Cerrar sesión y borrar mis datos de este navegador» sirve para las computadoras compartidas.
- Registro de la aplicación: `docs/CUENTA-ENTRA.md`.
