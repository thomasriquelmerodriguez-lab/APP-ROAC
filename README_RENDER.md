# ROAC – Control Mensual de Alimentación (Render v35)

Esta versión transforma la aplicación v34 en una aplicación web centralizada:

- Frontend: HTML + CSS + JavaScript.
- API: Node.js + Express.
- Base de datos: PostgreSQL.
- Hosting: Render.
- Autenticación: contraseña del sistema + cookie de sesión HttpOnly.
- Persistencia: PostgreSQL; ya no se usa `localStorage` para los datos operativos.

## Cómo desplegar en Render

1. Descomprime este proyecto.
2. Sube la carpeta completa a un repositorio de GitHub.
3. En Render, elige **New > Blueprint**.
4. Conecta el repositorio.
5. Render detectará `render.yaml`.
6. El usuario queda configurado como `TRIQUELME` mediante `ADMIN_USERNAME`.
7. Durante la creación Render te solicitará `ADMIN_PASSWORD`.
   - Ingresa allí la contraseña que definiste para este acceso.
   - No la escribas dentro de GitHub ni dentro del archivo HTML.
8. `SESSION_SECRET` se genera automáticamente.
9. `DATABASE_URL` se conecta automáticamente a la base PostgreSQL declarada en el Blueprint.
10. Espera que el Web Service y PostgreSQL queden en estado activo.
11. Abre la URL `https://...onrender.com`.

## Migrar la información de la versión local v34

La información antigua estaba en el navegador, no dentro del archivo HTML.

Antes de dejar de usar la versión local:
1. Abre la v34 en el computador que contiene los registros.
2. En **Respaldo y exportación**, presiona **Descargar JSON**.
3. Despliega esta versión en Render.
4. Inicia sesión.
5. En **Respaldo y exportación > Restaurar respaldo**, selecciona el JSON antiguo.
6. La aplicación guardará ese respaldo en PostgreSQL.
7. Desde ese momento todos los equipos autorizados verán la misma información.

## API interna

- `GET /health`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/session`
- `GET /api/state`
- `PUT /api/state`

No necesitas una API Key de Render para que la aplicación funcione.
Las credenciales sensibles se configuran como variables de entorno en Render.

## Protección ante ediciones simultáneas

La base usa un número de revisión. Si dos equipos intentan guardar sobre versiones diferentes, el servidor devuelve un conflicto y la aplicación recarga la versión más reciente para evitar una sobrescritura silenciosa.

Además, el servidor conserva automáticamente hasta 50 versiones anteriores en `state_history`.


## Usuario configurado

- Usuario: `TRIQUELME`
- La contraseña se configura únicamente en Render como `ADMIN_PASSWORD`.
- Por seguridad, la contraseña no está escrita dentro de los archivos públicos del proyecto.


## Usuarios y permisos – v37

La aplicación ahora tiene tres perfiles:

- `TRIQUELME`: administrador. Puede visualizar, agregar, modificar, eliminar, restaurar respaldos y bloquear/desbloquear reportes.
- `CMTV`: solo lectura. Puede revisar toda la información y descargar reportes, pero no modificar datos.
- `Mrodriguez`: solo lectura. Puede revisar toda la información y descargar reportes, pero no modificar datos.

### Variables nuevas en Render

En **Environment** del Web Service agrega:

- `CMTV_PASSWORD` = contraseña que quieras asignar a CMTV.
- `MRODRIGUEZ_PASSWORD` = contraseña que quieras asignar a Mrodriguez.

Las contraseñas no deben escribirse dentro de GitHub ni en `public/index.html`.

El servidor también impide por API que los perfiles de solo lectura ejecuten `PUT /api/state`, por lo que el bloqueo no depende únicamente de la interfaz.
