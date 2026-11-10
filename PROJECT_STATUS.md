# PROJECT_STATUS — One Piece TCG Idle

## Fases
- [x] Fase 1: Arquitectura
- [x] Fase 2: Estructura y configuración
- [x] Fase 3: Base de datos y autenticación
- [x] Fase 4: Catálogo (5596 cartas, 61 sets, en JSON y en catalog_*)
- [x] Fase 5: Economía idle (verificada)
- [~] Fase 6: Mesa 3D (entregada, pendiente de verificar en navegador)
- [ ] Fases 7-12 pendientes

## Decisiones aprobadas
- Catálogo: optcgapi.com -> public/data/*.json + tablas catalog_*. Importador: GitHub Action manual/mensual.
- Sin recuperación de contraseña. Email interno <usuario>@opidle.app. Repo PÚBLICO. Autoridad en Postgres (RPC).
- Admin: tecla F2. Un solo Edge Function (register).
- CORS: las imágenes de optcgapi.com y la candidata de Bandai FALLAN como textura WebGL. Decisión en Fase 6 (proxy Cloudflare Worker recomendado / CSS3D / plan B).

## Fase 5 — modelo económico
- Producción/s de una carta = base_rareza x variante(alt 2 / sp 4 / manga 6) x set(por tipo) x nivel x mejoras(upgrades.prod_mult).
- Nivel: (1 + (n-1)*0.10) x 2^floor(n/25).  Todo en game_config clave "economy" (editable en Supabase).
- Cada carta acumula desde last_collected_at hasta un máximo de offline_cap_seconds (28800 = 8 h) + upgrades.storage_bonus_seconds.
  Ese mismo tope vale online y offline. Reloj SIEMPRE del servidor.
- Recoger: collect_card(id) y collect_all(). Se conserva la fracción de moneda no pagada (no se pierde por recoger a menudo).
- Cambiar una carta/nivel/mejora/config => recalc_player_production(user): primero paga lo pendiente al ritmo antiguo.
- Admin (F2): dar carta, fijar nivel, recalcular producción de todos.
- Producción cacheada en player_cards.production_per_sec y player_economy.production_per_sec.
- Cliente: useEconomy (estimación visual cada 0,5 s, corregida por el servidor), EconomyPanel (provisional hasta Fase 6), format.js.

## Ajustes manuales en Supabase
- Authentication: "Allow new users to sign up" DESACTIVADO. Edge Function register con "Verify JWT" desactivado.
- Promover admin: update public.profiles set role='admin' where username_lower='TU_USUARIO';
- Cerrar registro: update public.game_config set value='false'::jsonb where key='registration_open';

## Selector visual de cartas (admin)
- CardPicker.jsx: ventana con desplegable de sets (agrupados por tipo), filtro de rareza y de texto, cuadrícula con imágenes (60 en 60).
- Comprobación de completitud: OP01 = 154 filas (coincide con la base oficial japonesa: 121 + 33 paralelas). PRB01: 309 vs 319 en la base japonesa; OP17: 161 vs ~169 (119 + 39 paralelas + 11 SP). Posibles huecos de la API o diferencias EN/JP: revisar en el selector.
- El importador ahora lista ejemplos de las duplicadas ignoradas (posible causa de huecos).
- Marca SAMPLE: viene de las imágenes oficiales (la API usa los id de imagen de la web oficial). No se quita con ajustes. CatalogCheck compara 3 fuentes.

## Problemas conocidos / riesgos
- SQL de Fase 5 y front sin probar en mi entorno (sin Postgres ni red).
- Valores económicos (bases, multiplicadores) son una primera propuesta: equilibrar jugando; precios de sobres en Fase 7.
- Las políticas RLS dejan a los admin LEER filas de todos: el cliente SIEMPRE debe filtrar por user_id.
- Las cartas DON!! se llaman todas "DON!! Card"; tratar como categoría aparte en el álbum.
- Imágenes con marca "SAMPLE" (heredada de la fuente).
- SUPABASE_SERVICE_ROLE_KEY heredada se retira a principios de 2027 (usar OPI_SECRET_KEY, Fase 12).
- Keep-alive anti-pausa de Supabase: pendiente. Avisos de Node 20 / ubuntu-latest en Actions: Fase 12.

## Fase 6 — mesa 3D
- App.jsx -> TableView (HUD HTML + escena lazy). Escena en src/components/table/: Table, CoinStack(+CoinBurst), Card3D, CameraRig, TableScene.
- Texturas SIN descargas: fieltro y madera procedurales (proceduralTextures.js) y caras de carta dibujadas en canvas (cardTexture.js) = plan B sin imágenes/CORS.
- Escaparate: las 5 cartas que más producen (3 en pantalla estrecha). Hover/selección = se levantan; clic = detalle + Recoger. Efectos por rareza: halo + chispas (Manga rosa, SP cian, SEC/TR oro, SR plata, Alt violeta).
- Monedero + pila de monedas (escala logarítmica) + lluvia de monedas al recoger. Contador de monedas animado con GSAP.
- Rendimiento: dpr 1-1.5, 1 sombra de 1024, sin postprocesado; calidad alta/baja (localStorage) y bajada automática con PerformanceMonitor. Canvas remonta al cambiar calidad.
- Botones: Tienda(F7)/Álbum(F8)/Mejoras(F9) DESHABILITADOS con su fase; Colección, Catálogo, Calidad, Admin, Salir funcionan.
- Validado aquí: sintaxis de los 29 archivos, imports/exports y nombres no declarados (tsc). NO renderizado (sin Three.js ni navegador en mi entorno).

## Decisión pendiente para Fase 7
- Imágenes reales en 3D: requieren proxy CORS (Cloudflare Worker gratuito, cuenta de Cloudflare) o se mantienen las cartas dibujadas. Algunas cartas no tienen imagen en la API: usarán carta dibujada.

## Siguiente
Fase 7: sobres y apertura (catálogo de productos pack_products, precios, generador de sobres en SQL con probabilidades configurables, historial, anti-duplicado, apertura 3D con arrastre, revelado, duplicados).
