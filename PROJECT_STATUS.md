# PROJECT_STATUS — One Piece TCG Idle

## Fases
- [x] Fases 1-5 (arquitectura, estructura, BD+auth+admin, catálogo, economía) — verificadas
- [~] Fase 6 (mesa 3D): REHECHA con el diseño nuevo (sin cartas en la mesa)
- [~] Fase 7 (sobres y apertura): VERIFICADA por el usuario (SQL, tienda, compra, apertura, rasgado OK). Añadidos: abrir en masa y zoom en resultados (pendiente de verificar)
- [ ] Fase 8 Álbum 3D (+ reclamar producción) · Fase 9 Mejoras y duplicados · Fases 10-12

## Diseño de la mesa (decidido por el usuario)
- La mesa NO tiene cartas: solo los sobres comprados, apilados por set (12 por página, 6x2). Se seleccionan.
- Inspección 3D del sobre: arrastrar = girar; deslizar por la parte de arriba hacia un lado = rasgar/abrir; botón "Abrir sobre" alternativo; zoom con rueda y botones.
- Revelado: las cartas salen una a una (clic = siguiente, arrastrar = girar), con efectos según rareza; pantalla de resultados (nuevas/repetidas).
- Las cartas se ven e inspeccionan en el ÁLBUM (Fase 8), donde también se RECLAMA la producción. Mientras tanto se reclama en "Colección".

## Fase 7 — qué hay
- SQL 0003_sobres.sql: purchase_history, pick_weighted, pick_card_for_tier, sync_pack_products (+admin_sync_products), buy_pack, open_pack. Crea un producto por set (booster 1000+250*n, extra 2500, premium 6000, starter 3000).
- Sobre aleatorio: 6 cartas = 3x{C85,UC15} + 2x{UC100} + 1x{R62,SR18,L6,ALT8,SEC3,SP2,MANGA1}. Premium con mejores tiradas. Starter deck = todas sus cartas base. TODO configurable en pack_products.config. Probabilidades FICTICIAS (no oficiales).
- Idempotencia: request_id único por compra/apertura (si se repite, no se duplica).
- Front: packService, usePacks, packTexture (sobres dibujados), imageLoader (proxy CORS), PackModel/PackPile/InspectPack/RevealStage, ShopPanel, ResultsPanel, TableView (máquina de estados), TableHud.
- Rendimiento: dpr 1-1.25, 1 sombra de 1024, sin chispas ni sombras en calidad baja, PerformanceMonitor a 25 fps.

## Fase 7b — apertura en masa y resultados
- "Abrir 1 sobre" y "Abrir todos (N)" (solo si quedan >=2). En lote: al terminar las cartas de un sobre se rasga solo el siguiente (retraso 450 ms); los resultados de todos se juntan en una pantalla final.
- Botones durante el revelado: "Saltar este sobre" (en lote pasa al siguiente) y "Saltar todos" (abre el resto de golpe, sin animación).
- Resultados: al pasar el ratón / enfocar / tocar, la carta se levanta y crece (CSS). Si no hay imagen, se muestra la carta dibujada.
- App.jsx carga TableView bajo demanda (lazy): Three.js ya no pesa en la pantalla de login.

## Pendiente de pulido (realismo del rasgado, estilo Pokémon TCG Pocket)
- Independiente de las texturas: se puede mejorar en cualquier momento. Ideas: rasgado progresivo a lo largo del gesto (tapa en segmentos que se despegan uno a uno), borde irregular, curvatura del papel, destello de luz y ráfaga de cartas al abrir. Con imagen real hay que ajustar PACK_TAPA a la proporción real del sellado superior. Hacerlo cuando estén las imágenes reales (proxy Cloudflare).

## Imágenes reales (pendiente, opcional)
- Requiere crear el proxy gratuito de Cloudflare (cloudflare/image-proxy.js) y pegar su URL en src/imageConfig.js (IMAGE_PROXY_URL).
- Sin proxy: cartas y sobres se dibujan por código (funciona igual).
- Sobres: config.art_url de los OPxx apunta a images.scrydex.com/onepiece/OPxx-s1/large (NO verificado). Si falla, se usa el sobre dibujado. Se puede editar art_url en pack_products.config.
- Cartas por sobre: 6 (página oficial asia-en); un minorista dice 12 para inglés. Configurable (slots).

## Ajustes manuales en Supabase
- Authentication: "Allow new users to sign up" DESACTIVADO. Edge Function register con "Verify JWT" desactivado.
- Promover admin: update public.profiles set role='admin' where username_lower='TU_USUARIO';
- Cerrar registro: update public.game_config set value='false'::jsonb where key='registration_open';

## Problemas conocidos / riesgos
- SQL de Fase 7 y 3D sin probar en mi entorno (sin Postgres, navegador ni red). Validados: sintaxis de todos los .jsx/.js, imports y nombres.
- Rendimiento: la calidad alta empeoró tras la Fase 6; esta versión elimina cartas, halos grandes y chispas de la mesa.
- Las políticas RLS dejan a los admin LEER filas de todos: el cliente SIEMPRE filtra por user_id.
- Card3D.jsx ya no se usa como componente (se importa tipoEfecto): se puede limpiar en Fase 11.
- Algunas cartas no tienen imagen en la API. Marca "SAMPLE" heredada de la fuente. DON!! = "DON!! Card".
- SUPABASE_SERVICE_ROLE_KEY heredada se retira a principios de 2027 (usar OPI_SECRET_KEY, Fase 12). Keep-alive anti-pausa pendiente.

## Siguiente
Fase 8: Álbum 3D (libro, páginas, filtros por set/rareza, búsqueda, descubiertas/desconocidas, detalle, ordenar, ratón/teclado/táctil) + reclamar producción.
