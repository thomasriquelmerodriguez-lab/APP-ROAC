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


## v36.1 – usuarios de solo lectura

Esta versión parte directamente de la v36 funcional.

Usuarios:
- TRIQUELME: administrador, conserva todos los permisos.
- CMTV: solo lectura.
- Mrodriguez: solo lectura.

Los usuarios de solo lectura pueden:
- navegar entre casinos;
- seleccionar empresas;
- cambiar mes y año para consultar;
- revisar todos los datos;
- abrir resúmenes;
- generar y descargar reportes;
- descargar respaldos y CSV.

No pueden:
- modificar cantidades;
- modificar colaciones;
- cambiar nombres o valores;
- agregar/eliminar empresas;
- cambiar el nombre del casino;
- restaurar respaldos;
- restablecer la aplicación;
- marcar/desmarcar “Reporte listo”.

La restricción principal está en el servidor: `PUT /api/state` exige rol administrador.
La interfaz solo añade un bloqueo simple de los controles de edición.
No se utilizan MutationObserver ni wrappers de render para los permisos.

### Variables de entorno adicionales

En Render > Environment agrega:
- `CMTV_PASSWORD`
- `MRODRIGUEZ_PASSWORD`

No necesitas cambiar DATABASE_URL, SESSION_SECRET, ADMIN_USERNAME ni ADMIN_PASSWORD.
No necesitas modificar ni recrear PostgreSQL.


## v36.2 – resumen simplificado en Mina y Quilmenco

Se modificó únicamente el bloque “Resumen de la empresa” para casinos con
registro Sistema + Planilla (Mina y Quilmenco).

Ahora muestra solo 5 cuadros:

1. Total almuerzos = Almuerzo Sistema + Almuerzo Planilla.
2. Total cenas = Cena Sistema + Cena Planilla.
3. Total colaciones almuerzo.
4. Total colaciones cena.
5. Total a pagar.

Se eliminaron de ese resumen visual los cuadros:
- Alm. Sistema.
- Alm. Planilla.
- Cena Sistema.
- Cena Planilla.
- Total servicios.

No se modificaron:
- los datos diarios;
- los cálculos;
- los reportes;
- PostgreSQL;
- los usuarios y permisos;
- Salamanca;
- Servicios Especiales.
