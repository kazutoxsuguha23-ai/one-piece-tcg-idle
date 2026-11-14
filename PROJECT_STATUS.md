# PROJECT_STATUS — One Piece TCG Idle

## Fases
- [x] Fases 1-5 (arquitectura, estructura, BD+auth+admin, catálogo, economía) — verificadas
- [~] Fase 6 (mesa 3D): REHECHA con el diseño nuevo (sin cartas en la mesa)
- [~] Fase 7 (sobres y apertura): VERIFICADA por el usuario (SQL, tienda, compra, apertura, rasgado OK). Añadidos: abrir en masa y zoom en resultados (pendiente de verificar)
- [x] Fase 8 Álbum 3D (+ inspección con zoom): VERIFICADA por el usuario
- [~] Fase 9 Mejoras y duplicados: entregada, pendiente de verificar
- [ ] Fases 10-12 (seguridad y pruebas, optimización, publicación)

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

## Fase 8 — álbum
- Libro 3D con transformaciones CSS (NO WebGL): portada que se abre, hojas que giran con perspectiva, 2 páginas (1 en móvil, con deslizamiento). Por eso las IMÁGENES REALES de las cartas ya se ven en el álbum sin proxy de Cloudflare (<img> normal, sin CORS). Cartas sin imagen: carta dibujada (CardImage).
- Un set por libro (desplegable agrupado por tipo, con descubiertas/total). Filtros: rareza o variante (Alt/Manga/SP), estado (todas/descubiertas/sin descubrir), orden (set, rareza, producción, nivel, copias, nombre), búsqueda. Las cartas sin descubrir NO revelan su nombre (la búsqueda por nombre solo encuentra descubiertas; por código encuentra todas).
- 9 cartas por página (3x3). Cada casilla: nombre, copias, nivel, producción/s y botón de monedas acumuladas (reclamar por carta). Cabecera: "Recoger todo".
- Navegación: botones, zonas laterales, flechas/RePág/AvPág/Inicio/Fin, deslizar, "Ir a pág.".
- Ficha de carta: se gira en 3D arrastrando (con su imagen real), brillo y resplandor por rareza, datos completos del catálogo, copias/nivel/producción, botón Recoger, anterior/siguiente.
- Mientras el álbum está abierto el render 3D de la mesa se pausa (frameloop never).
- Lógica pura probada en albumUtils.js (paginación sin páginas perdidas/repetidas hasta 120, filtros, orden, búsqueda).
- Fase 8b: la ficha (info + carta al lado) se inclina y brilla con el ratón; al pulsar la carta se AGRANDA con animación (FLIP) a pantalla grande: giro por arrastre con inercia, brillo holográfico + destello que siguen al puntero (más intensos en SR/SEC/TR/SP/Manga/Alt), zoom con rueda/botones/+/-, "Reencuadrar", dorso visible, volver con Esc o pulsando fuera. Esc cierra la inspección y NO la ficha.
- Bug corregido: al arrastrar se seleccionaba texto (azul) -> user-select:none en la zona de la carta y la inspección.
- Fase 9 añadirá en la ficha: subir nivel y vender duplicados.

## Fase 9 — mejoras y duplicados (SQL 0004_mejoras.sql)
- Config en game_config clave "upgrades" (editable): card_level, sell, global.
- SUBIR NIVEL (1->100): cada nivel gasta copias REPETIDAS de la MISMA carta exacta + monedas. Copias por tramo de nivel: 1 (1-9), 2 (10-24), 3 (25-49), 5 (50-74), 8 (75-99), con multiplicador por rareza (SR x0.5, SEC/TR x0.25) y variante (alt/sp x0.5, manga x0.25), mínimo 1. Monedas = producción nivel 1 de la carta x 600 s x 1.07^(nivel-1). La PRIMERA COPIA está protegida (solo se gastan copias-1).
- VENDER: cada copia repetida paga 300 s de producción (nivel 1) de esa carta, mínimo 1. Una carta o en masa por rarezas (por defecto C y UC; arte alternativo/Manga/SP solo si se marca). La venta en masa tiene vista previa y exige que las monedas confirmadas coincidan con las vistas.
- MEJORAS GLOBALES: "Maestría del tesoro" (+10% producción por nivel, 50 niveles, coste 5000 x 1.35^n) y "Almacén ampliado" (+1 h por nivel, 24 niveles, coste 3000 x 1.3^n). Guardan niveles en player_progress.upgrades.levels y escriben prod_mult / storage_bonus_seconds (los que ya lee la economía).
- Atomicidad y anti-duplicado: todo en una transacción con bloqueo del jugador; p_from_level / p_expected_copies / p_expected_level / p_expected_coins rechazan dobles envíos y reintentos sin cobrar. Antes de cambiar el ritmo de producción se cobra lo acumulado (settle_player).
- Front: MejorarCarta (en la ficha del álbum), BotonConfirmar (confirmación de 2 pasos), EfectoNivel (destello + chispas + "¡NIVEL N!" + brillo de la carta), MejorasPanel (botón Mejoras de la mesa), upgradeService. Los números salen SIEMPRE del servidor.
- Equilibrio (carta Rara, 1.5/s): amortización de un nivel ~1 h (nivel 1), ~11 h (50), ~31 h (75); llegar al 100 cuesta ~1e7 monedas. Es una propuesta: ajustar jugando.

## Imágenes reales en WebGL (pendiente, opcional)
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
Fase 10: Seguridad y pruebas (revisar RLS y funciones, límites de frecuencia, validaciones, pruebas de integridad de la economía, anti-abuso).
