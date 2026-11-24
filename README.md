# One Piece TCG Idle

Juego idle web de coleccionar cartas de One Piece TCG con mesa 3D. Proyecto privado de aficionado (no oficial; las probabilidades de los sobres son ficticias).

- Web: https://kazutoxsuguha23-ai.github.io/one-piece-tcg-idle/
- Stack: React 18 + Vite + Three.js (@react-three/fiber, drei) + Supabase (base de datos, login, una Edge Function) + GitHub Pages y GitHub Actions.

## Cómo funciona
- Cuenta con usuario y contraseña. Compras sobres con monedas, los abres en 3D, coleccionas cartas en el álbum.
- Cada carta produce monedas por segundo (con límite de acumulación offline). Se pueden mejorar de nivel (gastando copias repetidas) y vender repetidas.
- TODO se decide en el servidor (funciones SQL de Supabase). El navegador solo muestra resultados.

## Carpetas
- `src/` código del juego. `public/data/` catálogo (cards.json, sets.json).
- `supabase/migrations/` esquema y lógica (0001-0005, en orden; la 0005 siempre la última).
- `supabase/functions/register/` Edge Function de registro.
- `scripts/import-catalog.mjs` importador del catálogo (optcgapi.com).
- `tests/js/` y `tests/sql/` pruebas. `cloudflare/image-proxy.js` proxy de imágenes opcional.
- `.github/workflows/` despliegue, pruebas, importación mensual del catálogo y keep-alive de Supabase.

## Mantenimiento
- **Subir cambios:** al subir a `main`, se despliega solo (Actions > "Desplegar en GitHub Pages") y se ejecutan las pruebas.
- **Catálogo:** se actualiza solo el día 1 de cada mes (o a mano: Actions > "Importar catálogo" > Run workflow). Si salen sets nuevos, en la web con F2: "Sincronizar productos con el catálogo".
- **Admin:** tecla F2 con cuenta admin. Para promover: `update public.profiles set role='admin' where username_lower='usuario';` en Supabase > SQL Editor.
- **Cerrar el registro:** `update public.game_config set value='false'::jsonb where key='registration_open';`
- **Economía:** se edita en Supabase > Table Editor > game_config (claves `economy` y `upgrades`). Tras cambiar `economy`, pulsar "Recalcular producción de todos" (F2).
- **Migraciones nuevas:** terminar con `revoke execute on all functions ...` y volver a conceder TODAS las funciones públicas. Si se re-ejecuta 0002, 0003 o 0004, re-ejecutar 0005.
- **Supabase gratis:** se pausa tras 7 días sin actividad; el flujo keep-alive lo evita. Si GitHub lo desactiva (60 días sin actividad en el repo), reactivarlo en Actions. Haz copias de tus datos si te importan.

## Seguridad
Ver `SEGURIDAD.md` (qué cubre y qué no). Nunca poner claves secretas (`sb_secret_`, `service_role`) en el código ni en el chat: solo en los secretos de GitHub y de Supabase.

## Aviso
One Piece y One Piece Card Game son marcas de sus propietarios (Eiichiro Oda, Bandai, Shueisha/Viz). Las imágenes y datos de cartas vienen de optcgapi.com. Proyecto no comercial.
