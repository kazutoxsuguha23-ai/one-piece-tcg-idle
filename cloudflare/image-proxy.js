// Proxy de imágenes con CORS para One Piece TCG Idle (Cloudflare Workers, plan gratuito).
// Lo único que hace: descargar una imagen de una web de la lista blanca y devolverla con la
// cabecera CORS que el navegador necesita para usarla como textura 3D. Se guarda en caché 30 días.

const HOSTS_PERMITIDOS = [
  'optcgapi.com',
  'en.onepiece-cardgame.com',
  'asia-en.onepiece-cardgame.com',
  'images.scrydex.com',
  'images.onepiecedb.io',
];
// Solo tu web puede usar este proxy. Si algún día cambias de dirección, cámbialo aquí.
const ORIGEN_PERMITIDO = 'https://kazutoxsuguha23-ai.github.io';

export default {
  async fetch(request) {
    const cors = { 'Access-Control-Allow-Origin': ORIGEN_PERMITIDO, Vary: 'Origin' };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'GET') return new Response('Método no permitido', { status: 405 });

    const origen = request.headers.get('Origin');
    if (origen && origen !== ORIGEN_PERMITIDO) return new Response('Origen no permitido', { status: 403 });

    let destino;
    try {
      destino = new URL(new URL(request.url).searchParams.get('url'));
    } catch {
      return new Response('URL no válida', { status: 400, headers: cors });
    }
    if (destino.protocol !== 'https:' || !HOSTS_PERMITIDOS.includes(destino.hostname)) {
      return new Response('Servidor no permitido', { status: 403, headers: cors });
    }

    const respuesta = await fetch(destino.toString(), {
      headers: { 'User-Agent': 'OnePieceTCGIdle-imageproxy (private fan project)', Accept: 'image/*' },
      cf: { cacheEverything: true, cacheTtl: 2592000 },
    });
    if (!respuesta.ok) return new Response('No se pudo obtener la imagen', { status: 502, headers: cors });

    const tipo = respuesta.headers.get('Content-Type') || '';
    if (!tipo.startsWith('image/')) return new Response('No es una imagen', { status: 415, headers: cors });

    return new Response(respuesta.body, {
      headers: { ...cors, 'Content-Type': tipo, 'Cache-Control': 'public, max-age=2592000' },
    });
  },
};
