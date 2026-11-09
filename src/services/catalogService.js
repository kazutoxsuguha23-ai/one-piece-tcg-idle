// Carga el catálogo (cards.json y sets.json) una sola vez y lo guarda en memoria.
let promesa = null;

async function leerJson(ruta) {
  const respuesta = await fetch(`${import.meta.env.BASE_URL}${ruta}`);
  if (!respuesta.ok) throw new Error(`No se encontró ${ruta} (error ${respuesta.status})`);
  return respuesta.json();
}

export function loadCatalog() {
  if (!promesa) {
    promesa = Promise.all([leerJson('data/cards.json'), leerJson('data/sets.json')])
      .then(([c, s]) => ({
        cards: c.cards,
        sets: s.sets,
        generatedAt: c.generated_at,
        source: c.source,
        byId: new Map(c.cards.map((carta) => [carta.id, carta])),
      }))
      .catch((error) => {
        promesa = null;
        throw error;
      });
  }
  return promesa;
}
