# PROJECT_STATUS — One Piece TCG Idle

## Fases
- [x] Fase 1: Arquitectura (aprobada)
- [~] Fase 2: Estructura y configuración (archivos entregados, pendiente de verificar despliegue)
- [ ] Fases 3-12 pendientes

## Decisiones aprobadas
- Catálogo: optcgapi.com importado por GitHub Action a cards.json / sets.json (jugadores nunca llaman a la API).
- Imágenes oficiales por hotlink (proyecto privado, responsabilidad asumida por el usuario). Plan B si falla CORS: carta generada.
- Sin recuperación de contraseña. Email interno sintético.
- Stack + Zustand + supabase-js. UI en español, datos de cartas en inglés.
- Repositorio PÚBLICO (necesario para GitHub Pages gratis). Sin secretos en el código.
- Autoridad en Postgres (funciones RPC SECURITY DEFINER). Solo 1 Edge Function (register).

## Requisitos de ADMIN (diseñar en Fase 3, UI en Fase 6/9)
- profiles.role = 'player' | 'admin'. Solo se cambia desde el panel de Supabase (SQL/Table Editor), nunca desde el cliente.
- Tecla de acceso rápido abre menú admin (solo si role = admin). Seguridad real en las funciones admin_* (comprueban is_admin() en servidor).
- Acciones: dar monedas, fijar saldo, dar carta, fijar nivel de carta, dar sobre/booster/starter deck de cualquier producto, ver/buscar usuarios, resetear usuario.
- Tabla admin_log con todas las acciones.
- Tabla player_packs (sobres sin abrir) para poder "dar sobres".
- Registro de usuarios cerrable con un interruptor en game_config.

## Archivos creados (Fase 2)
package.json, vite.config.js, index.html, .gitignore, .github/workflows/deploy.yml (crear a mano),
src/main.jsx, src/App.jsx, src/App.module.css, src/index.css, src/config.js, src/services/supabaseClient.js

## Problemas conocidos
- Build no probado todavía (sin red en mi entorno): si Actions falla, pegar el error.
- CORS de imágenes de Bandai sin verificar (Fase 4). Cobertura de variantes sin verificar (Fase 4).
- Supabase gratis se pausa a los 7 días sin actividad (keep-alive en Fase 3).

## Siguiente
Fase 3: esquema SQL, RLS, autenticación usuario/contraseña, funciones admin.
