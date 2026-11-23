# Seguridad — One Piece TCG Idle

## Qué está protegido (y cómo se comprueba)
- **El navegador nunca decide saldo, cartas ni recompensas.** Todo son funciones SQL del servidor; las tablas no admiten escritura desde el juego (sin políticas de insert/update/delete y sin permisos). *Comprobado por pruebas SQL y estáticas.*
- **Cada jugador solo ve lo suyo** (RLS). El cliente además filtra siempre por su id porque los admin pueden leer todo.
- **Funciones internas** (cálculo de producción, aleatoriedad, límites) no son ejecutables por jugadores. Las funciones de admin comprueban el rol EN EL SERVIDOR.
- **Atómico y sin duplicados:** compras, aperturas, mejoras y ventas ocurren en una transacción con bloqueo por jugador; un reintento o doble clic no cobra ni premia dos veces.
- **Límite de frecuencia por jugador** en las 9 funciones de juego (migración 0005) y por IP + global en el registro.
- **Aleatoriedad solo en el servidor.** Las probabilidades son ficticias y están etiquetadas así.
- **Sin claves secretas en el navegador** (una prueba lo vigila en cada subida). La clave `sb_secret_` solo vive en los secretos de GitHub y de Supabase.
- **CSP** en `index.html`: solo scripts propios, conexión a tu Supabase.
- **Objetos futuros** (tablas/funciones nuevas) nacen cerrados.

## Qué NO está cubierto (honestamente)
- **Sin CAPTCHA** en el registro. Mitigación: registro cerrable, código de invitación, límite por IP y global.
- **El registro revela si un nombre existe** ("ya existe"). Inevitable con nombres únicos; limitado por frecuencia.
- **Sin recuperación de contraseña** (no hay email real). Si se olvida, se borra la cuenta y se crea otra.
- **Fuerza bruta en el login:** depende de los límites propios de Supabase Auth (no verificados aquí).
- **La web es pública** (GitHub Pages gratis exige repositorio público): el código es visible, por diseño sin secretos.
- **No hay cabeceras HTTP de seguridad** (GitHub Pages no permite configurarlas); la CSP va por `<meta>`.
- **Concurrencia real** (dos peticiones simultáneas) no está probada automáticamente; se confía en el bloqueo `FOR UPDATE`.
- **Copias de seguridad:** el plan gratuito de Supabase no garantiza copias; exporta tus datos si te importan.

## Cuentas administrador
Solo se crean con SQL en el panel de Supabase. Protege esa cuenta con una contraseña larga y única.
