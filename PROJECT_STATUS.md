# PROJECT_STATUS — One Piece TCG Idle

## Fases
- [x] Fases 1-5 (arquitectura, estructura, BD+auth+admin, catálogo, economía) — verificadas
- [x] Fase 6 (mesa 3D, diseño nuevo sin cartas en la mesa) — verificada
- [x] Fase 7 (sobres y apertura, +7b abrir en masa y zoom en resultados) — verificada
- [x] Fase 8 Álbum 3D (+8b inspección con zoom) — verificada
- [x] Fase 9 Mejoras y duplicados — verificada
- [x] Fase 10 Seguridad y pruebas — VERIFICADA por el usuario (pruebas JS y SQL en verde en Actions; 0005 y Edge Function register aplicadas en Supabase)
- [x] Fase 11 Optimización — VERIFICADA por el usuario (11a: sin Card3D/gsap/zustand, reloj de economía a 1 s y pausado con pestaña oculta; build verde y todo funciona)
- [x] Fase 12 Publicación y limpieza — VERIFICADA por el usuario (workflows en Node 24, keep-alive, OPI_SECRET_KEY creada y registro probado, README)

**PLAN ORIGINAL COMPLETADO (Fases 1-12).** Cualquier mejora nueva se trata como fase extra a petición del usuario.

## Fases extra
- [~] Fase 13 Imágenes reales en 3D — ENTREGADA, pendiente de verificar
- [ ] Fase 14 Rasgado del sobre realista (estilo Pokémon TCG Pocket)


## Fase 11 — optimización
### 11a (verificada)
- Card3D.jsx ELIMINADO (solo se usaba tipoEfecto): tipoEfecto ahora está en utils/rarityStyle.js y RevealStage lo importa de ahí.
- gsap ELIMINADO (solo se usaba en useAnimatedNumber): reescrito con requestAnimationFrame (mismo frenado suave). zustand eliminado de package.json (nunca se usó).
- useEconomy: el reloj que calcula lo "pendiente" va cada 1 s (antes 0,5 s) y se DETIENE con la pestaña oculta. Menos re-renders de toda la mesa y el álbum.
- Three.js ya iba en un trozo aparte (TableView y TableScene son lazy): el login no lo descarga.
- Descartado por ahora: manualChunks en vite.config.js (riesgo sin poder compilar aquí, poco beneficio).
### Ideas para 11b (NO necesarias por ahora: sin tirones notados; retomar si aparecen)
- La mesa 3D se re-renderiza en cada tick de la economía porque `economia` y varias funciones cambian de identidad: estabilizar (useMemo/useCallback/refs) y envolver TableScene en React.memo.
- Medido en el build: login ~109 KB gzip (index); tras entrar +199 KB (TableView) +49 KB (TableScene), casi todo Three.js. Aviso de >500 kB es solo informativo. cards.json se carga aparte (sin medir).
- Imágenes: carga perezosa ya activa en álbum/resultados; revisar peso al abrir sets grandes.
- Medir FPS reales en el móvil/PC del usuario (no se puede medir desde el entorno de Claude).

## Fase 12 — publicación y limpieza (VERIFICADA)
- Workflows actualizados a acciones con Node 24: checkout@v7, setup-node@v7 (node-version 22), configure-pages@v6, upload-pages-artifact@v5, deploy-pages@v5 (versiones comprobadas en la búsqueda). Quita los avisos de Node 20. Copia en ci/tests.yml.
- NUEVO keep-alive.yml: lunes y jueves hace una lectura de game_config con la clave pública de src/config.js (evita la pausa de Supabase a los 7 días). Ojo: GitHub desactiva los flujos programados tras 60 días sin actividad en el repo; si pasa, reactivarlos en Actions.
- OPI_SECRET_KEY: creada en Supabase > Edge Functions > Secrets; la Edge Function la lee primero (si no existe, usa la antigua).
- README.md final añadido.
- Verificado por el usuario: workflows, keep-alive y OPI_SECRET_KEY (registro de cuenta funciona).

## Fase 13 — imágenes reales en 3D (pendiente de verificar)
- Proxy de Cloudflare creado por el usuario: https://opi-imagenes.kazutoxsuguha23.workers.dev (código en cloudflare/image-proxy.js; solo acepta el origen de la web y hosts de la lista blanca). IMAGE_PROXY_URL puesto en src/imageConfig.js.
- Las cartas del revelado usan la MISMA imagen (info.image de optcgapi) que el álbum: la carta que decide el servidor es la que se muestra.
- imageLoader.js: caché con límite de 40 texturas (las antiguas se liberan con dispose para no llenar la memoria gráfica), caché de fallos 60 s, getTexturaCargada() y precargarImagenes() (máx. 5 s).
- TableView.abrirSobre: precarga las imágenes de las cartas mientras el sobre se abre ("abriendo"), así salen ya con imagen. RevealStage: carta actual y saliente usan la imagen real si está cargada (antes la saliente se dibujaba por código).
- Sobres: art_url de los OPxx (images.scrydex.com, NO verificado). Si falla se ve el sobre dibujado.
- Pendiente de verificar en navegador: que salen las imágenes, orden/efectos de rareza intactos, y que "Abrir todos" no se ralentiza ni gasta mucha memoria.

## Diseño de la mesa (decidido por el usuario)
- La mesa NO tiene cartas: solo los sobres comprados, apilados por set (12 por página, 6x2). Se seleccionan.
- Inspección 3D del sobre: arrastrar = girar; deslizar por la parte de arriba hacia un lado = rasgar/abrir; botón "Abrir sobre" alternativo; zoom con rueda y botones.
- Revelado: las cartas salen una a una (clic = siguiente, arrastrar = girar), con efectos según rareza; pantalla de resultados (nuevas/repetidas).
- Las cartas se ven e inspeccionan en el ÁLBUM, donde también se RECLAMA la producción (también en "Colección").

## Fase 7 — qué hay
- SQL 0003_sobres.sql: purchase_history, pick_weighted, pick_card_for_tier, sync_pack_products (+admin_sync_products), buy_pack, open_pack. Un producto por set (booster 1000+250*n, extra 2500, premium 6000, starter 3000).
- Sobre aleatorio: 6 cartas = 3x{C85,UC15} + 2x{UC100} + 1x{R62,SR18,L6,ALT8,SEC3,SP2,MANGA1}. Premium con mejores tiradas. Starter deck = todas sus cartas base. Configurable en pack_products.config. Probabilidades FICTICIAS.
- Idempotencia: request_id único por compra/apertura.
- Front: packService, usePacks, packTexture, imageLoader (proxy CORS), PackModel/PackPile/InspectPack/RevealStage, ShopPanel, ResultsPanel, TableView (máquina de estados), TableHud.
- Apertura en masa: "Abrir 1" y "Abrir todos (N)"; en lote se rasga solo el siguiente (450 ms); "Saltar este sobre" / "Saltar todos"; resultados juntos.
- Rendimiento: dpr 1-1.25, 1 sombra de 1024, sin chispas ni sombras en calidad baja, PerformanceMonitor a 25 fps.

## Fase 8 — álbum
- Libro 3D con CSS (NO WebGL), por eso las imágenes reales se ven sin proxy (<img>, sin CORS). Sin imagen: carta dibujada (CardImage).
- Un set por libro; filtros (rareza/variante, estado), orden, búsqueda (no revela nombres sin descubrir). 9 cartas por página (3x3). Reclamar por carta y "Recoger todo".
- Ficha de carta con inclinación y brillo; inspección ampliada (FLIP) con giro e inercia, brillo holográfico, zoom, Esc.
- Mientras el álbum está abierto, el render 3D de la mesa se pausa.
- Lógica pura probada en albumUtils.js.

## Fase 9 — mejoras y duplicados (0004_mejoras.sql)
- Config en game_config clave "upgrades": card_level, sell, global.
- Subir nivel 1->100: copias REPETIDAS de la MISMA carta + monedas. Copias por tramo 1/2/3/5/8 (x0.5 SR, x0.25 SEC/TR, variantes alt/sp x0.5, manga x0.25). Monedas = producción nivel 1 x 600 s x 1.07^(n-1). La PRIMERA COPIA está protegida.
- Vender: 300 s de producción por copia. Una carta o en masa por rarezas (con vista previa y confirmación).
- Mejoras globales: Maestría del tesoro (+10% por nivel, 50 niveles) y Almacén ampliado (+1 h por nivel, 24 niveles).
- Atomicidad: parámetros de estado esperado (nivel, copias, monedas, request_id) rechazan dobles envíos.
- Equilibrio: propuesta, ajustar jugando.

## Fase 10 — seguridad y pruebas (VERIFICADA)
- 0005_seguridad.sql: enforce_rate_limit + 9 funciones regeneradas con límite por jugador; permisos por defecto de objetos futuros cerrados. SIEMPRE ejecutar la última; si se re-ejecuta 0002-0004, re-ejecutar 0005.
- LECCIÓN: el permiso de ejecución para PUBLIC es un valor por defecto GLOBAL de PostgreSQL; para cerrarlo hay que usar `alter default privileges for role postgres revoke execute on functions from PUBLIC` SIN "in schema". Ya está en 0005.
- Pruebas (flujo "Pruebas", .github/workflows/tests.yml, copia en ci/tests.yml): 33 JS + ~235 SQL contra un PostgreSQL real (tests/sql/run.sh). run.sh abre las funciones ayudantes del esquema "t" (t.ok, t.fails, t.login) antes de cada archivo de pruebas, porque las migraciones cierran los permisos por defecto.
- Edge Function register: usa cf-connecting-ip / última IP de x-forwarded-for + límite global 60/h.
- SEGURIDAD.md: qué cubre y qué NO.

## Imágenes reales en WebGL (hecho en la Fase 13)
- Sin proxy configurado, cartas y sobres de la mesa 3D se dibujan por código.
- art_url de los OPxx apunta a images.scrydex.com (NO verificado); si falla, sobre dibujado.
- Cartas por sobre: 6 (página oficial asia-en); un minorista dice 12 para inglés. Configurable (slots).
- Pendiente de pulido: rasgado del sobre más realista cuando haya imágenes reales (ajustar PACK_TAPA).

## Ajustes manuales en Supabase
- Authentication: "Allow new users to sign up" DESACTIVADO. Edge Function register con "Verify JWT" desactivado.
- Promover admin: update public.profiles set role='admin' where username_lower='TU_USUARIO';
- Cerrar registro: update public.game_config set value='false'::jsonb where key='registration_open';

## Problemas conocidos / riesgos
- El 3D y la mayoría del front nunca se han visto desde el entorno de Claude (sin navegador, red ni Postgres): validar con capturas del usuario.
- Los admin pueden LEER filas de todos por RLS: el cliente SIEMPRE filtra por user_id.
- Algunas cartas no tienen imagen en la API. Marca "SAMPLE" heredada de la fuente. DON!! = "DON!! Card".

## Siguiente
Fase extra en curso: 13 (imágenes 3D) y luego 14 (rasgado). Otras posibles:
- Rasgado del sobre más realista (progresivo, borde irregular, destello).
- Equilibrar la economía jugando (game_config "economy" y "upgrades").
- Optimización 11b si aparecen tirones (estabilizar props de TableScene + React.memo).
