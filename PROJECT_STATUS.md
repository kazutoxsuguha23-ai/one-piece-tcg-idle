# PROJECT_STATUS — One Piece TCG Idle

## Fases
- [x] Fase 1: Arquitectura (aprobada)
- [x] Fase 2: Estructura y configuración (verificada por el usuario)
- [~] Fase 3: Base de datos y autenticación (archivos entregados, pendiente de verificar)
- [ ] Fases 4-12 pendientes

## Decisiones aprobadas
- Catálogo: optcgapi.com importado por GitHub Action a cards.json / sets.json.
- Imágenes oficiales por hotlink (proyecto privado, responsabilidad del usuario). Plan B si falla CORS.
- Sin recuperación de contraseña. Email interno sintético: <usuario>@opidle.app (nunca se envían emails).
- Stack + Zustand + supabase-js. UI en español, datos de cartas en inglés.
- Repositorio PÚBLICO (GitHub Pages gratis). Sin secretos en el código.
- Autoridad en Postgres (RPC SECURITY DEFINER). Solo 1 Edge Function: register.

## Fase 3 — qué hay
- supabase/migrations/0001_esquema_auth_admin.sql: tablas, RLS, trigger de alta, bootstrap_session, funciones admin.
- supabase/functions/register/index.ts: registro (rate limit por IP, registro cerrable, código de invitación opcional).
- Front: AuthScreen, AdminPanel (tecla F2), useAuth, authService, gameService, authRules.
- Admin implementado: listar jugadores, dar/quitar monedas, fijar saldo, dar sobres, resetear jugador (todo con admin_log).
- Admin pendiente: dar carta, fijar nivel (Fase 5, necesitan la fórmula de producción).

## Ajustes manuales en Supabase (no están en el código)
- Authentication: desactivar "Allow new users to sign up" (si no, se salta la Edge Function).
- Edge Function register: desactivar "Verify JWT".
- Promover admin: update public.profiles set role='admin' where username_lower='TU_USUARIO';
- Cerrar registro: update public.game_config set value='false'::jsonb where key='registration_open';

## Problemas conocidos / riesgos
- SQL y front sin probar en mi entorno (sin Postgres ni red). Corregir con los errores reales.
- Si Supabase rechaza el dominio opidle.app como email, cambiar EMAIL_DOMAIN en los 2 sitios.
- SUPABASE_SERVICE_ROLE_KEY (clave heredada) se retira a principios de 2027: antes, crear el secreto OPI_SECRET_KEY en la Edge Function con la clave secret (ya soportado en el código).
- Supabase gratis se pausa a los 7 días sin actividad (keep-alive opcional en Fase 3).
- CORS de imágenes y cobertura de variantes: Fase 4.

## Siguiente
Fase 4: importación del catálogo (cards.json, sets.json, carga a catalog_*).
