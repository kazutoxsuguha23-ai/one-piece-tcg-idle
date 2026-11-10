# PROJECT_STATUS — One Piece TCG Idle

## Fases
- [x] Fase 1: Arquitectura
- [x] Fase 2: Estructura y configuración
- [x] Fase 3: Base de datos y autenticación (verificada)
- [~] Fase 4: Importación de cartas (importación real OK: 5596 cartas, 61 sets; pendiente confirmar tablas catalog_* en Supabase y test CORS)
- [ ] Fases 5-12 pendientes

## Decisiones aprobadas
- Catálogo: optcgapi.com importado por GitHub Action a public/data/cards.json y sets.json, y a las tablas catalog_*.
- Imágenes: URL de la API (optcgapi.com/media/static/Card_Images/...). Proyecto privado, responsabilidad del usuario.
- Sin recuperación de contraseña. Email interno <usuario>@opidle.app.
- Repo PÚBLICO. Autoridad en Postgres (RPC). Solo 1 Edge Function (register).
- Admin: tecla F2. Pendiente: dar carta / fijar nivel (Fase 5).

## Fase 4 — qué hay
- scripts/import-catalog.mjs: lee allSetCards, allSTCards, allPromoCards, allDonCards (4 peticiones).
- Normaliza rarezas (C, UC, R, SR, SEC, L, P, SP, TR, DON; las desconocidas se guardan tal cual).
- Variantes: id de imagen con sufijo _pN = arte alternativo; "(Manga)" / "(SP)" en el nombre => flags manga/sp.
- ids de carta ESTABLES (card_id = image_id; si choca entre sets: image_id@SET). Cartas que desaparecen de la API se conservan con retired=true.
- Seguridad: aborta si la API devuelve <80% de las cartas anteriores. Nunca borra filas de la BD.
- .github/workflows/import-catalog.yml: manual + día 1 de cada mes. Hace commit de public/data y relanza deploy.yml.
- Front: catalogService.js (carga/caché), CatalogCheck.jsx (panel de verificación + test CORS).

## Secretos de GitHub necesarios (Settings > Secrets and variables > Actions)
- SUPABASE_URL
- SUPABASE_SECRET_KEY  (clave sb_secret_..., SOLO ahí, nunca en el código)

## Problemas conocidos / riesgos
- Importador probado con datos simulados; NO con la API real (sin red en mi entorno). Revisar el resumen de la primera ejecución.
- Campos de la API inferidos de un SDK de terceros + la web de optcgapi (no hay documentación de campos). 
- Promos: todas van a un único set PROMO. DON!!: set DON. Stage no confirmado en la API.
- Imágenes alojadas en el VPS de optcgapi (el autor pide no abusar): solo se cargan las cartas visibles.
- CORS de imágenes: lo verifica CatalogCheck.
- Sin tasas oficiales de aparición: se configuran en Fase 7 (ficticias, etiquetadas).
- SUPABASE_SERVICE_ROLE_KEY heredada se retira a principios de 2027 (usar OPI_SECRET_KEY, Fase 12).
- Keep-alive anti-pausa de Supabase: pendiente.

## Resultados reales de la importación (primera ejecución)
- 5645 leídas, 5596 en catálogo, 0 descartadas, 49 duplicados. DON: 187 (ruta allDonCards OK). Promos: 1082 (ruta correcta: /allPromos/).
- Arte alternativo 1203, Manga 49, SP 126. Rarezas: C, UC, R, SR, SEC, L, TR(7), PR(490), P(1), DON.
- PR = muy probablemente "Promotion" (cartas de promoción dentro de sets). No confirmado en la API.
- Sufijos de imagen: _pN = paralela (arte alt), _rN = reimpresión. Las paralelas conservan la rareza de la base (salvo excepciones, p. ej. TR).
- OP14EB04 y OP15EB04 son sets combinados oficiales.
- CORS de optcgapi.com: FALLA -> las imágenes no sirven como textura WebGL tal cual. Decisión en Fase 6 (proxy gratuito en Cloudflare Worker / CSS3D / plan B de carta generada).
- Las imágenes de la API llevan marca "SAMPLE" (heredada de la fuente).

## Siguiente
Fase 5: economía idle (producción por rareza/set/nivel, recoger, offline, dar carta y fijar nivel en admin).
