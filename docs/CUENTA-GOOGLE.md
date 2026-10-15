# RETIRADO (GOOG1, 2026-10-15): Google solo sirve para migrar

Decisión del dueño: el inicio de sesión con Google está retirado («deprecado»). La cuenta de SATE es solo Microsoft
(Outlook/Hotmail o institucional). Lo que queda de Google:

- **Solo migración:** `data/cuenta.json` → `googleSoloMigracion: true` (y `googleClientId`). Quien guardó su perfil
  en Google Drive lo **lee** una vez (permiso `drive.appdata`, solo peticiones GET; no existe código de escritura) y lo
  pasa a su OneDrive en tres pasos (traer, guardar en el navegador, continuar con Microsoft). No se borra nada del Drive;
  el alumno puede eliminar el archivo en Drive › Configuración › Administrar aplicaciones › «Eliminar datos ocultos de la app».
- Una sesión de Google recordada (`ipnt.prov = 'google'`) ya no sincroniza: el diálogo de cuenta muestra el aviso de migración.
- CSP: `accounts.google.com` y `www.googleapis.com` se conservan solo por esta migración. Al retirarla, quitar
  `googleSoloMigracion`, `googleClientId`, `GO` en `tools/cuenta.py` y esos orígenes de las CSP.
- Ya no hay usuarios de prueba ni aviso de «fase de prueba» (`googlePrueba` y el correo de contacto se retiraron).

Lo siguiente es el registro histórico de la aplicación en Google Cloud (sigue siendo necesario mientras exista la migración).

# Registro de la aplicación en Google Cloud

«Continuar con Google» guarda el perfil (`perfil.ipnt.json`) en el **espacio privado de la aplicación** del
Google Drive del alumno (`appDataFolder`). Ese espacio no aparece entre sus archivos y la herramienta no puede
ver nada más de su Drive. El identificador de cliente es público y va en `data/cuenta.json` como
`googleClientId`. No se crea ningún secreto.

## Pasos

1. https://console.cloud.google.com › **Nuevo proyecto**: `IPN-tools`.
2. **APIs y servicios › Biblioteca** › habilita **Google Drive API**.
3. **Google Auth Platform** (pantalla de consentimiento de OAuth):
   - **Branding:** nombre `IPN-tools`, correo de asistencia y, cuando exista, la liga al aviso de privacidad.
   - **Audience:** *External*. Mientras esté en modo **Testing**, agrega como usuarios de prueba las cuentas de
     Google que lo van a probar (hasta 100).
   - **Data access:** agrega `.../auth/drive.appdata`, `openid`, `.../auth/userinfo.email` y `.../auth/userinfo.profile`.
4. **Clients › Create client › Web application**:
   - Nombre: `IPN-tools web`.
   - **Authorized JavaScript origins:** `https://silver-vs.github.io` y `http://localhost:8080`.
   - No hacen falta *redirect URIs*: se usa la ventana emergente de Google Identity Services.
5. Copia el **Client ID** (termina en `.apps.googleusercontent.com`) a `data/cuenta.json`:

   ```json
   { "googleClientId": "1234567890-abc.apps.googleusercontent.com" }
   ```

## Diferencias con Microsoft

- Sin servidor, Google entrega permisos de 1 hora sin renovación automática. Al vencer, la herramienta
  muestra **«Volver a conectar con Google»** y guarda lo pendiente después de reconectar. Microsoft sí renueva
  la sesión en silencio.
- Drive no admite escritura condicional. La herramienta compara la versión del archivo justo antes de escribir;
  si cambió, vuelve a descargar y fusionar.
- Para salir del modo *Testing* hay que publicar la app. Revisa en **Data access** cómo clasifica Google los
  permisos: con permisos no sensibles basta la verificación de marca (nombre, logo, dominio, aviso de privacidad).
