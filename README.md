# Porvenir · Documentación estudiantil

Primera versión: acceso del personal, alta y edición de estudiantes, búsqueda por nombre o grupo, tipos de documento compartidos, entrega y fecha de caducidad. Sin carga de archivos ni notificaciones.

## Probar en tu equipo

Requiere Node.js 22.12 o posterior.

```sh
npm install
npm run dev
```

Abre la dirección que muestra Vite y pulsa **Explorar demostración**. Son datos ficticios en memoria; al recargar se descartan. La demostración no escribe en Supabase.

## Conectar Supabase

1. Crea un proyecto y ejecuta `supabase/schema.sql` una sola vez en su SQL Editor.
2. En Authentication, desactiva el registro público y crea las cuentas del personal con correo y contraseña, confirmando el correo desde la administración cuando corresponda.
3. Autoriza cada cuenta desde el SQL Editor sustituyendo el UUID por el identificador de Authentication → Users:

```sql
insert into public.staff (user_id) values ('UUID-DEL-USUARIO');
```

4. Copia `.env.example` como `.env` y completa la URL del proyecto y la clave **publishable** (también sirve la antigua `anon`). Nunca uses `service_role` ni una clave secreta en el frontend.
5. Reinicia `npm run dev` e ingresa con una cuenta autorizada.

Todo el personal autorizado comparte lectura y edición. La tabla `staff` solo se administra desde Supabase; crear una cuenta por sí solo no concede acceso a estudiantes. Para retirar acceso, elimina su fila de `staff` desde el SQL Editor. RLS protege las tres tablas de datos.

No se agregan documentos reales por defecto: crea los tipos que use la institución desde la web. Un tipo nuevo aparece pendiente para todos los estudiantes. Una entrega sin fecha se interpreta como documento sin caducidad. El vencimiento ocurre al día siguiente de la fecha indicada; el aviso visual incluye los siguientes 30 días. Se usa la fecha local del dispositivo.

## Publicar en Netlify

1. Sube este proyecto a tu repositorio y conéctalo a Netlify.
2. Configura las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en Netlify antes del deploy.
3. `netlify.toml` define `npm run build` y la carpeta de publicación `dist`.
4. Ejecuta el deploy. Si cambias variables, vuelve a desplegar.

La aplicación no está publicada automáticamente y el SQL debe ejecutarse en tu proyecto. Sin las variables se muestra el acceso a la demostración.

## Verificación

```sh
npm test
npm run build
```

La prueba cubre documentos pendientes, sin caducidad, vencidos y los límites de 0, 30 y 31 días con cambio de año.

Antes de usar datos reales, comprueba con Supabase conectado: una cuenta autorizada guarda y ve los cambios después de recargar; otra cuenta autorizada ve esos cambios; una cuenta sin fila en `staff` y una petición anónima no acceden a datos. No se han ejecutado esas comprobaciones contra una instancia real desde este proyecto.

Si dos personas guardan el mismo documento, prevalece la última escritura. El botón Actualizar trae los cambios del equipo; esta versión no tiene sincronización en vivo ni historial.

Referencias: [acceso con contraseña](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [políticas RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [compilación en Netlify](https://docs.netlify.com/build/configure-builds/overview/).
