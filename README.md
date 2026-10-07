# Porvenir · Carné del adolescente

Aplicación para consultar el estado del carné, gestionar estudiantes y avanzar grupos al siguiente año lectivo. Netlify aloja el frontend y Supabase guarda los datos.

## Base de datos existente

La base inicial se creó con `supabase/setup.sql`. Ese archivo contiene datos estudiantiles y no se publica en Git. **No vuelvas a ejecutarlo.** Si aún falta, ejecuta [supabase/annual-management.sql](supabase/annual-management.sql); después ejecuta [supabase/group-management.sql](supabase/group-management.sql) en el SQL Editor de Supabase **antes de publicar esta versión**. Las migraciones conservan los estudiantes y carnés existentes y no realizan pases automáticamente.

Los grupos se crean y renombran en **Administrar grupos**. Al agregar o editar un estudiante, el grupo se elige en una lista del año lectivo indicado. Renombrar un grupo actualiza las fichas y el historial correspondiente a ese año.

La baja marca al estudiante como inactivo. El pase de año se hace por grupo: el personal indica el grupo destino y desmarca a quienes no avanzan. Los excluidos permanecen en su año de origen. El pase ocurre en una sola transacción por grupo; el historial del año anterior se conserva.

## Desarrollo y publicación

Requiere Node.js 22.12 o posterior.

```sh
npm install
npm test
npm run build
npm run dev
```

La demostración usa datos ficticios en memoria. Para conectar Supabase, configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env` y en Netlify. Nunca coloques una clave secreta en el frontend. Un push a la rama conectada a Netlify publica el build definido en `netlify.toml`.
