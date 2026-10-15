# 1. Propósito y alcance

El simulador permite probar el marcador SATE, su Lector y la consulta de cupos sin entrar al SAES real. Escucha exclusivamente en `127.0.0.1`, no usa contraseñas y no hace solicitudes a servicios externos. Las respuestas parten de 21 capturas anonimizadas de UPIITA del 14 de octubre de 2026, conservadas sin cambios en `tests/fixtures/saes/upiita/2026-10-14/`.

`INDICE.json` identifica ruta, método, fecha y campos de selección de cada respuesta. Los campos indicados son los que seleccionan el estado capturado; no contienen tokens reales. La negociación de Ocupabilidad es GET → periodo actual → carrera → plan. El simulador exige ViewState `FICTICIO` y mantiene el estado por una cookie propia `saes_sim`, con `HttpOnly` y `SameSite=Strict`.

# 2. Compilar y arrancar

Desde la raíz del proyecto, en PowerShell, ejecuta comandos normales y legibles:

```powershell
$env:UPIITA_SITE = 'https://guinda-labs.github.io/'
$env:SATE_QA = '1'
python tools/build_horarios.py
$env:UNIDAD = 'escom'
python tools/build_horarios.py
$env:UNIDAD = 'upibi'
python tools/build_horarios.py
Remove-Item Env:UNIDAD
Remove-Item Env:SATE_QA
python tools/saes_simulado.py
```

Abre `http://saes-upiita.localhost:8765/qa-saes-simulado.html` en el navegador integrado. No necesitas instalar dependencias ni configurar perfiles de navegador. Si ese navegador no resuelve el subdominio `.localhost`, queda pendiente resolverlo en su entorno; no cambies el marcador publicado ni abras el SAES real. `127.0.0.1` permite comprobar HTTP, pero no es un origen aceptado por el marcador.

`--puerto 8766` cambia el puerto. `--modo vencida` o `--modo columnas` establece el estado inicial de nuevas sesiones. Detén el servidor con Ctrl+C.

# 3. Recorrido manual

1. Arrastra «SATE · pruebas locales» desde la página QA a la barra de marcadores. Abre «alumno ficticio» y ejecuta ese marcador.
2. Comprueba el saludo de «ALUMNO FICTICIO EJEMPLO», la copia del perfil del Lector y los cupos en ambos modos, dentro del SAES y en otra ventana. Recorre B/09, E/18, M/09, S/08 y T/09. B/98, M/98 y T/98 no tienen grupos: el SAES devuelve una sola celda con `colspan=7`, sin encabezados, y el parser vigente responde `columnas`. El contrato conserva ese comportamiento. Respeta los 15 segundos entre consultas manuales que ya exige el componente.
3. Usa los enlaces de columnas cambiadas y sesión vencida de la página QA; vuelve a ejecutar el marcador. Comprueba el aviso de columnas y la detección de sesión vencida. «Restablecer sesión normal» recupera la sesión ficticia.

Los enlaces `/__simulado/normal`, `/__simulado/columnas` y `/__simulado/vencida` solo afectan a la cookie local actual. No hay formulario de autenticación funcional. El servidor elimina scripts y acciones de los HTML servidos, neutraliza referencias externas y aplica CSP para mantener las solicitudes de recursos y formularios en el propio origen.

# 4. Separación de QA y publicación

| Artefacto | Comportamiento |
|---|---|
| `web/dist/sate.js` | Marcador normal; rechaza el origen local incluso si se compila con `SATE_QA=1` |
| `web/dist/sate/` | Implementación normal; conserva su validación de origen |
| `web/dist/qa-sate.js` | Marcador QA; acepta exclusivamente `http://saes-upiita.localhost:<puerto>` además de los orígenes normales |
| `web/dist/qa-sate/` | Copia QA de SATE con receptora de cupos que valida el origen local y `window.opener` |
| `web/qa-saes-simulado.html` y `web/dist/qa-saes-simulado.html` | Instrucciones y marcador arrastrable; se generan solo con `SATE_QA=1` |

Los artefactos QA son locales e ignorados por Git. No publiques salidas de una compilación QA. La compilación normal retira los artefactos de este simulador en `web/dist`; el archivo de ayuda bajo `web/` solo se usa localmente.

# 5. Contratos y comprobaciones

```powershell
python tools/saes_estructuras.py
python -m unittest tests.test_saes_simulado
D:\Tools\nodejs\node.exe tests/qa_sate_saes_simulado.mjs
```

La prueba de JavaScript necesita los artefactos QA ya compilados. Python usa `D:\Tools\nodejs\node.exe` en Windows; la variable `NODE` permite señalar otra instalación. No se usa navegador, CDP, Playwright ni conexión externa.

`saes_estructuras.py` transforma los HTML en árboles de etiquetas, atributos y texto mediante `html.parser`. Node ejecuta el Lector completo, `IPNCupos.parsear`, `IPNCupos.consultar` y los parsers puros que también llama el capturador. `tests/saes_parsers.mjs` adapta únicamente las operaciones DOM de lectura necesarias, sin ejecutar los scripts de las capturas. La fecha de lectura y la huella del Lector se excluyen del contrato porque no son datos de la captura.

Si cambia el parser, la comparación con `estructuras.json` falla. Revisa el cambio y después actualiza de forma explícita:

```powershell
python tools/saes_estructuras.py --actualizar
```

Las pruebas verifican boleta ficticia única, ausencia de CURP y correo, ViewState ficticio, rutas HTTP, secuencia de postbacks, ocho combinaciones carrera/plan, sesiones independientes, caducidad, columnas cambiadas y rechazo del origen QA en el marcador publicado. Las páginas sin parser de marcador, como calificaciones y dictamen, conservan tablas de texto como diagnóstico; no se presenta ese diagnóstico como un nuevo parser de trámites.

# 6. Limitaciones y pendientes

Las capturas GET de oferta y mapa curricular no contienen filas de resultados. Se conservan sus filtros y resultados vacíos. Los POST de esas páginas devuelven 405 porque no existe una respuesta capturada con la que simularlos fielmente. El horario del alumno también está vacío. El simulador no implementa inscripción, comprobantes ni otros envíos.

Las rutas de páginas que usa el Lector están tomadas de sus solicitudes. Para calificaciones y respuesta de dictamen se usa el directorio funcional y el nombre del formulario capturado; la captura no conserva la URL absoluta original. Esa procedencia se declara en el índice y deberá cotejarse con un manifiesto del capturador, sin consultar el SAES real.

La prueba visual y la ejecución manual de marcadores en el navegador integrado corresponden al orquestador. Las verificaciones automáticas de esta entrega se hacen con DOM en memoria y HTTP local, sin afirmar comprobación visual.
