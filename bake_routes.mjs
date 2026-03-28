// Bake routes: Overpass geometry + Google Geocoding + A* pathfinding
// 1. Fetch all street geometries from Overpass
// 2. Match each itinerary street to an OSM street by name similarity + geocoded location
// 3. Find intersections (shared nodes) between consecutive matched streets
// 4. Build a bidirectional graph from all Overpass way geometries
// 5. Run A* shortest path between consecutive checkpoints on the graph
// 6. Concatenate all paths → final route
import { writeFileSync } from 'fs';

const API_KEY = process.env.GOOGLE_GEOCODING_API_KEY;
if (!API_KEY) { console.error('Set GOOGLE_GEOCODING_API_KEY env var'); process.exit(1); }

const PROCESSIONS_STREETS = {
  'unidad': ['C/Sierra de Gredos','C/Sierra Alhamilla','C/Sierra de Bacares','C/Sierra de Gádor','C/Sierra de Fondón','C/Sierra de Laujar','C/Sierra de Monteagud','C/Sierra de Tabernas','C/Sierra de Fondón','C/Sierra Alhamilla','C/Sierra de Gredos'],
  'borriquita': ['C/Tirso de Molina','C/Doctor Gregorio Marañón','Rambla Obispo Orberá','C/Javier Sanz','C/Rueda López','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','C/San Indalecio','C/Lope de Vega','C/Las Tiendas','Plaza Manuel Pérez García','Puerta de Purchena','Plaza San Sebastián','C/Alcalde Muñoz','C/Terriza','Avda. Federico García Lorca','C/Doctor Jiménez Cangas Arguelles','C/Tirso de Molina'],
  'estrella': ['C/Alta de la Iglesia','C/Verbena','C/Ángel Ochotorena','C/San Juan Bosco','C/Alcalde Muñoz','C/San Leonardo','Rambla Obispo Orberá','C/Navarro Rodrigo','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','C/San Indalecio','C/Lope de Vega','C/Tiendas','Puerta de Purchena','Plaza San Sebastián','C/Alcalde Muñoz','C/San Juan Bosco','Carretera del Perú','C/San Francisco Javier','C/Ntra. Sra. del Mar','C/Redonda','C/Baja de la Iglesia','C/Santiago','C/Alta de la Iglesia'],
  'angeles': ['Plaza de la Plata','C/Quinta Avenida','C/Maestría','C/España','C/Diamante','C/Turquesa','C/Maestría','C/Quinta Avenida','C/Inglés','C/Granada','Puerta de Purchena','Paseo de Almería','C/General Tamayo','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Tiendas','Plaza Manuel Pérez García','Puerta de Purchena','Avda. Pablo Iglesias','Plaza Virgen del Consuelo','C/Cruces','C/Quintana','Avda. Vilches','C/Acosta','C/Malecón de San Blas','C/Lopán','Avda. de Los Ángeles','C/Turquesa','C/Diamante'],
  'santa-cena': ['C/Ricardos','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','C/Mariana','C/Jovellanos','C/Real','C/Trajano','C/San Pedro','C/Padre Luque','C/Gómez Ulla','C/Ricardos'],
  'pasion': ['C/Rafael Alberti','C/Hermanos Machado','C/Artés de Arcos','C/Los Picos','Avda. Federico García Lorca','Rambla Obispo Orberá','C/Eguilior','C/Javier Sanz','C/Rueda López','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cubo','Plaza Bendicho','C/Murillo','Plaza Masnou','C/Real','C/Gravina','Plaza Virgen del Mar','C/General Tamayo','C/Marqués de Comillas','Avda. Federico García Lorca','Plaza Emilio Pérez','C/Canónigo Molina Alonso','C/Rafael Alberti'],
  'gran-poder': ['C/Tejar','C/Villaricos','Avda. Cabo de Gata','Rotonda Cable Inglés','Parque Víctimas del Terrorismo','Carretera de Ronda','C/Ribera de las Almadrabillas','C/Belén','Avda. Federico García Lorca','C/General Segura','C/Marqués de Comillas','C/Rueda López','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cubo','Plaza Bendicho','C/Murillo','Plaza Masnou','C/Real','C/Gerona','C/Arapiles','C/Juan Pérez Pérez','C/Reina Regente','Carretera de Ronda','Parque Víctimas del Terrorismo','Rotonda Cable Inglés','Avda. Cabo de Gata','C/Bilbao','C/Tejar'],
  'coronacion': ['C/Gregorio Marañón','Avda. Federico García Lorca','Rambla Obispo Orberá','C/Javier Sanz','C/Rueda López','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Real','C/Tiendas','Plaza Manuel Pérez García','Puerta de Purchena','Plaza San Sebastián','C/Alcalde Muñoz','C/San Juan Bosco','Avda. del Perú','C/Manuel Hazaña','C/Pilares','C/Rosa Felices','C/Olivo','Carretera de Níjar','C/Juan Segura Murcia'],
  'amor': ['C/Alcalde Muñoz','Plaza San Sebastián','C/Granada','C/Triunfo','C/Murcia','C/Santísimo Cristo del Amor','C/Alcalde Muñoz','Plaza Santa Rita','C/Juan Lirola','Rambla Obispo Orberá','C/Javier Sanz','C/Rueda López','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Tiendas','Plaza Manuel Pérez García','Puerta de Purchena','Plaza San Sebastián','C/Alcalde Muñoz'],
  'perdon': ['C/Ntra. Sra. de las Mercedes','C/Acosta','C/Silencio','C/Murcia','C/Joaquín Peralta','C/Alcalde Muñoz','C/San Leonardo','C/Navarro Rodrigo','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','C/San Indalecio','C/Lope de Vega','C/Tiendas','Plaza Manuel Pérez García','Puerta de Purchena','Avda. Pablo Iglesias','Plaza Virgen del Consuelo','C/Cruces','Avda. Vilches','C/Quintana','C/Zagal','C/Beata Soledad Torres Acosta','C/Acosta','C/Ntra. Sra. de las Mercedes'],
  'calvario': ['Plaza San Roque','C/Corbeta','C/Sales','C/Mariposa','Avda. del Mar','C/General Luque','Plaza Cristo de la Buena Muerte','C/Pedro Jover','C/Estrella','C/Almedina','C/Reina','C/Bailén','Plaza Granero','C/General Castaños','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Las Tiendas','C/Virgen de la Soledad','Plaza Flores','C/Plácido Langle','Plaza de San Pedro','C/Ricardos','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/General Castaños','Plaza Granero','C/Bailén','C/Reina','C/Almedina','C/San Juan','Plaza Cristo de la Buena Muerte','C/General Luque','Avda. del Mar','C/Rosario','C/Hipócrates','C/Corbeta','Plaza San Roque'],
  'prendimiento': ['Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Jovellanos','C/Marín','Plaza del Monte','C/Hernán Cortés','C/Tiendas','C/Virgen de la Soledad','Plaza Flores','C/Plácido Langle','Plaza de San Pedro','C/Juan Antonio Barrios','C/Real','C/Antonio González Egea','C/San Pedro','C/Padre Luque','C/Conde Ofalia','C/Lachambre','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/General Castaños','Plaza Granero','C/Bailén','C/Reina','C/Hospital','C/Duendes','Ronda del Beato Diego Ventaja','Plaza Jesús Cautivo de Medinaceli'],
  'macarena': ['C/Ntra. Sra. de las Mercedes','Circunvalación Plaza de Toros','Avda. Vilches','C/Granada','C/Triunfo','Plaza San Sebastián','Puerta de Purchena','Plaza Manuel Pérez García','C/Tiendas','C/Virgen de la Soledad','Plaza Flores','C/Plácido Langle','Plaza de San Pedro','C/Ricardos','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','C/San Indalecio','C/Lope de Vega','C/Tiendas','Puerta de Purchena','Avda. Pablo Iglesias','C/Las Cruces','C/Quintana','Avda. Vilches','C/Acosta','C/Ntra. Sra. de las Mercedes'],
  'estudiantes': ['Plaza de la Catedral','C/General Castaños','C/José Ángel Valente','C/Arráez','C/La Reina','C/Pedro Jover','C/La Estrella','C/Almedina','C/La Reina','C/Arráez','C/Juez','Plaza de la Administración Vieja','C/Mariana','C/Las Tiendas','C/Virgen de la Soledad','Plaza Flores','C/Plácido Langle','Plaza de San Pedro','C/Ricardos','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral'],
  'encuentro': ['Plaza de España','C/El Salvador','C/La Marina','C/José Morales Abad','Rotonda Cable Inglés','C/Rafael Alberti','C/Canónigo Molina Alonso','Avda. Federico García Lorca','Plaza de las Velas','Avda. Federico García Lorca','C/Marqués de Comillas','C/Rueda López','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cubo','Plaza Bendicho','C/Murillo','Plaza Masnou','C/Real','C/Gerona','C/Arapiles','C/Juan Pérez Pérez','C/Reina Regente','Plaza de las Velas','C/Canónigo Molina Alonso','C/Rafael Alberti','Rotonda Cable Inglés','C/José Morales Abad','C/La Marina','C/El Salvador','Plaza de España'],
  'angustias': ['C/San Leonardo','C/González Garbín','Plaza San Sebastián','C/Granada','Puerta de Purchena','Plaza Manuel Pérez García','C/Tiendas','C/Virgen de la Soledad','Plaza Flores','C/Plácido Langle','Plaza de San Pedro','C/Ricardos','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Jovellanos','C/Real','C/Floridablanca','Plaza de San Pedro','C/Ricardos','Paseo de Almería','C/Navarro Rodrigo','Rambla Obispo Orberá'],
  'rosario-mar': ['Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/General Castaños','C/Velázquez','C/Duendes','C/Hospital','C/La Reina','C/Arráez','C/Juez','Plaza de la Administración Vieja','C/Mariana','C/Tiendas','C/Virgen de la Soledad','Plaza Flores','C/Plácido Langle','Plaza de San Pedro','C/Ricardos','C/Doctor Gómez Ulla','C/Conde Ofalia','C/Lachambre','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar'],
  'silencio': ['C/Noria','C/Cruces','Plaza Virgen del Consuelo','Avda. Pablo Iglesias','Puerta de Purchena','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Jovellanos','Plaza del Monte','C/Hernán Cortés','C/Las Tiendas','Puerta de Purchena','Avda. Pablo Iglesias','Plaza Virgen del Consuelo','Rambla Alfareros'],
  'escucha': ['Plaza de la Catedral','C/Eduardo Pérez','C/Real','C/Gravina','Plaza Virgen del Mar','C/General Tamayo','Paseo de Almería','Puerta de Purchena','Plaza Manuel Pérez García','C/Las Tiendas','C/Mariana','Plaza de la Administración Vieja','C/Cervantes','Plaza de la Catedral'],
  'santo-entierro': ['C/Ricardos','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Jovellanos','C/Real','C/Floridablanca','Plaza de San Pedro','C/Ricardos'],
  'caridad': ['C/Rafael Alberti','C/Doctor Arráez Pacheco','C/Artés de Arcos','C/Los Picos','Avda. Federico García Lorca','C/Rueda López','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cubo','Plaza Bendicho','C/Murillo','Plaza Masnou','C/Real','C/Gravina','C/General Tamayo','Avda. Federico García Lorca','C/Belén','C/Canónigo Molina Alonso','C/Rafael Alberti'],
  'soledad': ['C/Tiendas','Plaza Manuel Pérez García','Plaza del Carmen','C/Antonio Vico','C/Pósito','C/Juez','Arco del Ayuntamiento','Plaza de la Constitución','C/Marín','C/Jovellanos','C/Real','C/Floridablanca','Plaza de San Pedro','C/Ricardos','C/Gómez Ulla','C/Conde Ofalia','C/Lachambre','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Las Tiendas'],
  'senor-vida': ['C/Limoneros','Avda. Padre Méndez','C/El Alcázar','C/Calzada de Castro','Carretera de Ronda','C/Doctor Gregorio Marañón','Avda. Federico García Lorca','Rambla Obispo Orberá','C/Navarro Rodrigo','Paseo de Almería','C/General Tamayo','Plaza Virgen del Mar','C/Lucano','C/Trajano','C/Real','C/Eduardo Pérez','Plaza de la Catedral','C/Cervantes','Plaza de la Administración Vieja','C/Mariana','C/Jovellanos','C/Las Tiendas','Puerta de Purchena','Plaza San Sebastián','C/Alcalde Muñoz','Plaza Santa Rita','C/Santos Zárate','Avda. Federico García Lorca','C/Paco Aquino','Carretera de Ronda','Avda. Padre Méndez','C/Limoneros'],
};

const STREET_ALIASES = {
  'C/Las Tiendas': 'Calle de las Tiendas',
  'C/Tiendas': 'Calle de las Tiendas',
  'Puerta de Purchena': 'Puerta de Purchena',
  'C/del Cubo': 'Calle Cubo',
  'C/Cubo': 'Calle Cubo',
  'Avda. del Perú': 'Carrera del Perú',
  'Carretera del Perú': 'Carrera del Perú',
  'Plaza Manuel Pérez García': 'Puerta de Purchena',
  'Arco del Ayuntamiento': 'Plaza de la Constitución',
  'C/La Reina': 'Calle de la Reina',
  'C/La Estrella': 'Calle Estrella',
  'C/Doctor Gómez Ulla': 'Calle Gómez Ulla',
  'Parque Víctimas del Terrorismo': 'Carretera de Ronda',
  'C/Doctor Jiménez Cangas Arguelles': 'Calle Jiménez',
  'C/Paco Aquino': 'Calle Poeta Paco Aquino',
};

// Manual coordinates for places that no geocoding service can find
const MANUAL_COORDS = {
  'Plaza de la Plata': [36.8490, -2.4580],
  'Plaza Virgen del Consuelo': [36.8443, -2.4644],
  'C/Juan Antonio Barrios': [36.8400, -2.4652],
  'C/Belén': [36.8355, -2.4603],
};

// ─── Utility: Node key for graph lookups ─────────────────
function nk(lat, lon) {
  return `${lat.toFixed(7)},${lon.toFixed(7)}`;
}

// ─── Utility: Haversine distance in meters ───────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Utility: Extract core name for fuzzy matching ───────
function extractCoreName(name) {
  let s = name;
  // Strip prefixes
  s = s.replace(/^(C\/|Calle|Avda\.?|Avenida|Plaza|Rambla|Paseo|Carretera)\s*/i, '');
  // Strip articles
  s = s.replace(/\b(de\s+la|de\s+las|de\s+los|de\s+el|del|de)\b/gi, '');
  // Normalize accents
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Lowercase, collapse whitespace
  s = s.toLowerCase().replace(/\s+/g, ' ').trim();
  return s;
}

// ─── Utility: Name similarity (Dice coefficient on bigrams) ──
function nameSimilarity(a, b) {
  const coreA = extractCoreName(a);
  const coreB = extractCoreName(b);
  if (coreA === coreB) return 1.0;

  const bigrams = s => {
    const bg = new Set();
    for (let i = 0; i < s.length - 1; i++) bg.add(s.substring(i, i + 2));
    return bg;
  };
  const setA = bigrams(coreA);
  const setB = bigrams(coreB);
  if (setA.size === 0 && setB.size === 0) return 1.0;
  let intersection = 0;
  for (const bg of setA) if (setB.has(bg)) intersection++;
  return (2 * intersection) / (setA.size + setB.size);
}

// ─── Google Geocoding with rate limiting and caching ─────
const geocodeCache = new Map();
let lastGeoTime = 0;

async function geocode(streetName) {
  // Check manual coordinates first (for places no geocoding service finds)
  if (MANUAL_COORDS[streetName]) return MANUAL_COORDS[streetName];

  const resolved = STREET_ALIASES[streetName] || streetName;
  if (geocodeCache.has(resolved)) return geocodeCache.get(resolved);

  // Rate limit: 40ms between calls
  const now = Date.now();
  const wait = Math.max(0, 40 - (now - lastGeoTime));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastGeoTime = Date.now();

  // Simple geocoding - same as searching on Google Maps
  const params = new URLSearchParams({
    address: `${resolved}, Almería, España`,
    key: API_KEY,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await res.json();
  if (data.status === 'OK' && data.results.length > 0) {
    const formatted = data.results[0].formatted_address;
    // Reject results that are just the city (geocoding failed to find the specific place)
    if (formatted === 'Almería, Spain' || /^\d{5} Almería, Spain$/.test(formatted)) {
      console.log(`    ⚠ "${resolved}" resolved to generic city, skipping`);
      geocodeCache.set(resolved, null);
      return null;
    }
    const loc = data.results[0].geometry.location;
    // Reject results too far from Almería city center (>3km = wrong town)
    const distToCenter = haversine(loc.lat, loc.lng, 36.8401, -2.4650);
    if (distToCenter > 3000) {
      console.log(`    ⚠ "${resolved}" resolved to ${formatted} (${(distToCenter/1000).toFixed(1)}km away), skipping`);
      geocodeCache.set(resolved, null);
      return null;
    }
    const result = [loc.lat, loc.lng];
    geocodeCache.set(resolved, result);
    return result;
  }
  geocodeCache.set(resolved, null);
  return null;
}

// ─── Overpass: fetch all street ways with geometry ────────
async function fetchOverpassWays() {
  const query = '[out:json][timeout:90];way["highway"]["name"](36.82,-2.50,36.86,-2.44);out geom;';
  const servers = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];
  for (const server of servers) {
    try {
      console.log(`  Trying ${server}...`);
      const res = await fetch(server, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      const text = await res.text();
      if (text.startsWith('{')) {
        const parsed = JSON.parse(text);
        if (parsed.elements) return parsed.elements;
      }
    } catch (e) {
      console.log(`    Failed: ${e.message}`);
    }
  }
  throw new Error('All Overpass servers failed');
}

// ─── Build street data structures from Overpass elements ──
function buildStreetData(elements) {
  // streetWays[name] = [{lat,lon}, ...] arrays (one per way)
  const streetWays = {};
  // streetNodeSets[name] = Set of nk() keys for all nodes
  const streetNodeSets = {};

  for (const el of elements) {
    const name = el.tags?.name;
    if (!name || !el.geometry) continue;
    if (!streetWays[name]) {
      streetWays[name] = [];
      streetNodeSets[name] = new Set();
    }
    const way = el.geometry.map(n => [n.lat, n.lon]);
    streetWays[name].push(way);
    for (const n of way) streetNodeSets[name].add(nk(n[0], n[1]));
  }
  return { streetWays, streetNodeSets };
}

// ─── Build bidirectional graph from ALL Overpass ways ─────
function buildGraph(elements) {
  // graph[nodeKey] = [{ key, lat, lon, dist }, ...]
  const graph = {};
  const nodeCoords = {}; // nodeKey → [lat, lon]

  for (const el of elements) {
    if (!el.geometry || el.geometry.length < 2) continue;
    for (let i = 0; i < el.geometry.length - 1; i++) {
      const a = el.geometry[i];
      const b = el.geometry[i + 1];
      const keyA = nk(a.lat, a.lon);
      const keyB = nk(b.lat, b.lon);
      const dist = haversine(a.lat, a.lon, b.lat, b.lon);

      if (!graph[keyA]) graph[keyA] = [];
      if (!graph[keyB]) graph[keyB] = [];
      nodeCoords[keyA] = [a.lat, a.lon];
      nodeCoords[keyB] = [b.lat, b.lon];

      graph[keyA].push({ key: keyB, lat: b.lat, lon: b.lon, dist });
      graph[keyB].push({ key: keyA, lat: a.lat, lon: a.lon, dist });
    }
  }
  return { graph, nodeCoords };
}

// ─── Find nearest graph node to a given point ────────────
function findNearestGraphNode(lat, lon, nodeCoords) {
  let bestKey = null;
  let bestDist = Infinity;
  for (const [key, [nlat, nlon]] of Object.entries(nodeCoords)) {
    const d = (nlat - lat) ** 2 + (nlon - lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestKey = key;
    }
  }
  return bestKey;
}

// ─── A* shortest path on the graph ───────────────────────
function astar(graph, nodeCoords, startKey, goalKey) {
  if (startKey === goalKey) {
    const c = nodeCoords[startKey];
    return c ? [c] : [];
  }
  if (!graph[startKey] || !graph[goalKey]) return null;

  const goalCoord = nodeCoords[goalKey];
  if (!goalCoord) return null;

  // Priority queue using a simple sorted array (sufficient for city-scale graphs)
  const openSet = new Map(); // key → { fScore, gScore }
  const cameFrom = new Map();
  const gScore = new Map();

  gScore.set(startKey, 0);
  const startCoord = nodeCoords[startKey];
  const h0 = haversine(startCoord[0], startCoord[1], goalCoord[0], goalCoord[1]);
  openSet.set(startKey, { fScore: h0, gScore: 0 });

  const closedSet = new Set();

  while (openSet.size > 0) {
    // Find node with lowest fScore
    let currentKey = null;
    let currentF = Infinity;
    for (const [key, val] of openSet) {
      if (val.fScore < currentF) {
        currentF = val.fScore;
        currentKey = key;
      }
    }

    if (currentKey === goalKey) {
      // Reconstruct path
      const path = [];
      let node = goalKey;
      while (node) {
        const coord = nodeCoords[node];
        if (coord) path.unshift(coord);
        node = cameFrom.get(node) || null;
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    const currentG = gScore.get(currentKey);
    const neighbors = graph[currentKey] || [];

    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor.key)) continue;

      const tentativeG = currentG + neighbor.dist;
      const prevG = gScore.get(neighbor.key);

      if (prevG !== undefined && tentativeG >= prevG) continue;

      cameFrom.set(neighbor.key, currentKey);
      gScore.set(neighbor.key, tentativeG);

      const h = haversine(neighbor.lat, neighbor.lon, goalCoord[0], goalCoord[1]);
      openSet.set(neighbor.key, { fScore: tentativeG + h, gScore: tentativeG });
    }
  }

  return null; // No path found
}

// ─── Match itinerary name to best OSM street (strict matching) ──
function matchStreetToOSM(itinName, streetWays) {
  const resolved = STREET_ALIASES[itinName] || itinName;
  const coreResolved = extractCoreName(resolved);

  // Pass 1: exact core name match (most reliable)
  for (const osmName of Object.keys(streetWays)) {
    if (extractCoreName(osmName) === coreResolved) return osmName;
  }

  // Pass 2: check if core name is contained in OSM name or vice versa
  // Handles cases like "Lucano" matching "Calle Lucano" but NOT "Tucán"
  for (const osmName of Object.keys(streetWays)) {
    const coreOsm = extractCoreName(osmName);
    if (coreResolved.length >= 4 && coreOsm.length >= 4) {
      if (coreOsm.includes(coreResolved) || coreResolved.includes(coreOsm)) return osmName;
    }
  }

  // Pass 3: fuzzy with very high threshold (0.8+)
  let bestName = null;
  let bestSim = 0;
  for (const osmName of Object.keys(streetWays)) {
    const sim = nameSimilarity(resolved, osmName);
    if (sim > bestSim) { bestSim = sim; bestName = osmName; }
  }
  return bestSim >= 0.8 ? bestName : null;
}

// ─── Process one procession ──────────────────────────────
async function processRoute(id, streets, streetWays, streetNodeSets, graph, nodeCoords) {
  console.log(`\n  Processing ${id} (${streets.length} streets):`);

  // Step 1: Geocode every street (baseline) + match to OSM
  const data = []; // { name, geo, osm }
  for (const street of streets) {
    const geo = await geocode(street);
    const osm = matchStreetToOSM(street, streetWays);
    data.push({ name: street, geo, osm });
  }

  // Step 2: For each consecutive pair, find the best checkpoint
  // Priority: OSM intersection > geocode midpoint
  const checkpoints = [];
  const checkpointNames = [];
  const segmentTypes = []; // 'route' or 'straight' for rendering

  for (let i = 0; i < data.length - 1; i++) {
    const a = data[i];
    const b = data[i + 1];
    const prevPoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : null;
    let cp = null;

    // Try OSM intersection
    if (a.osm && b.osm && streetNodeSets[a.osm] && streetNodeSets[b.osm]) {
      const shared = [];
      for (const key of streetNodeSets[a.osm]) {
        if (streetNodeSets[b.osm].has(key)) {
          const [lat, lon] = key.split(',').map(Number);
          shared.push([lat, lon]);
        }
      }

      if (shared.length > 0) {
        // Pick shared node closest to previous checkpoint (spatial continuity)
        if (prevPoint) {
          shared.sort((x, y) => {
            const dx = (x[0] - prevPoint[0]) ** 2 + (x[1] - prevPoint[1]) ** 2;
            const dy = (y[0] - prevPoint[0]) ** 2 + (y[1] - prevPoint[1]) ** 2;
            return dx - dy;
          });
        }
        const candidate = shared[0];

        // Sanity: must be within 300m of previous checkpoint OR geocoded point of street A
        let ok = false;
        if (prevPoint && haversine(candidate[0], candidate[1], prevPoint[0], prevPoint[1]) < 300) ok = true;
        if (!ok && a.geo && haversine(candidate[0], candidate[1], a.geo[0], a.geo[1]) < 300) ok = true;
        if (!ok && !prevPoint && !a.geo) ok = true; // no reference to check
        if (ok) cp = candidate;
      }

      // No shared nodes: find closest pair near the previous checkpoint
      if (!cp) {
        let minD = Infinity;
        let bestA = null, bestB = null;
        for (const wayA of streetWays[a.osm]) {
          for (const na of wayA) {
            if (prevPoint && haversine(na[0], na[1], prevPoint[0], prevPoint[1]) > 300) continue;
            for (const wayB of streetWays[b.osm]) {
              for (const nb of wayB) {
                const d = (na[0] - nb[0]) ** 2 + (na[1] - nb[1]) ** 2;
                if (d < minD) { minD = d; bestA = na; bestB = nb; }
              }
            }
          }
        }
        // Only use if the two streets are <200m apart (real near-intersection)
        if (bestA && bestB && haversine(bestA[0], bestA[1], bestB[0], bestB[1]) < 200) {
          // Use the node on street A closest to B (edge of plaza/street, not midpoint)
          cp = bestA;
        }
      }
    }

    // Fallback: use whichever geocode is closest to previous checkpoint
    if (!cp) {
      const geos = [a.geo, b.geo].filter(Boolean);
      if (geos.length === 0) continue;
      if (geos.length === 1 || !prevPoint) {
        cp = geos[0];
      } else {
        // Pick the geocode closest to the previous checkpoint
        geos.sort((x, y) =>
          haversine(x[0], x[1], prevPoint[0], prevPoint[1]) -
          haversine(y[0], y[1], prevPoint[0], prevPoint[1])
        );
        cp = geos[0];
      }
    }

    if (cp) {
      checkpoints.push(cp);
      checkpointNames.push(`${a.name} / ${b.name}`);
    }
  }

  if (checkpoints.length < 2) {
    console.log(`    SKIP: only ${checkpoints.length} checkpoints`);
    return null;
  }

  console.log(`    ${checkpoints.length} checkpoints`);

  // Step 3: Build route segments using A* between consecutive checkpoints
  const segments = []; // { points: [[lat,lon],...], type: 'route'|'straight' }

  for (let i = 0; i < checkpoints.length - 1; i++) {
    const [latA, lonA] = checkpoints[i];
    const [latB, lonB] = checkpoints[i + 1];

    const startKey = findNearestGraphNode(latA, lonA, nodeCoords);
    const goalKey = findNearestGraphNode(latB, lonB, nodeCoords);

    let added = false;

    if (startKey && goalKey) {
      const path = astar(graph, nodeCoords, startKey, goalKey);
      if (path && path.length > 1) {
        let pathLen = 0;
        for (let j = 1; j < path.length; j++) {
          pathLen += haversine(path[j][0], path[j][1], path[j-1][0], path[j-1][1]);
        }
        const directDist = haversine(latA, lonA, latB, lonB);
        if (directDist < 50 || pathLen <= directDist * 3) {
          segments.push({
            points: path.map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]),
            type: 'route',
          });
          added = true;
        }
      }
    }

    if (!added) {
      segments.push({
        points: [
          [+latA.toFixed(6), +lonA.toFixed(6)],
          [+latB.toFixed(6), +lonB.toFixed(6)],
        ],
        type: 'straight',
      });
    }
  }

  // Build flat route for backwards compat
  let fullRoute = [];
  for (const seg of segments) {
    if (fullRoute.length === 0) fullRoute.push(...seg.points);
    else fullRoute.push(...seg.points.slice(1));
  }

  const cpRounded = checkpoints.map(p => [+p[0].toFixed(6), +p[1].toFixed(6)]);
  const straightCount = segments.filter(s => s.type === 'straight').length;
  console.log(`    Route: ${fullRoute.length} pts (${straightCount} straight segments)`);

  return {
    route: fullRoute,
    segments,
    checkpoints: { points: cpRounded, names: checkpointNames },
  };
}

// ─── MAIN ────────────────────────────────────────────────
async function main() {
  console.log('=== BAKING: Overpass geometry + Google Geocoding + A* routing ===\n');

  // Fetch Overpass data
  console.log('Fetching Overpass street geometries...');
  const elements = await fetchOverpassWays();
  const { streetWays, streetNodeSets } = buildStreetData(elements);
  console.log(`  ${Object.keys(streetWays).length} streets, ${elements.length} ways`);

  // Build the bidirectional graph from ALL way geometries
  console.log('Building street graph...');
  const { graph, nodeCoords } = buildGraph(elements);
  console.log(`  ${Object.keys(nodeCoords).length} nodes, ${Object.values(graph).reduce((s, n) => s + n.length, 0) / 2} edges`);

  const bakedRoutes = {};
  const bakedCheckpoints = {};
  const bakedSegmentTypes = {};
  const ids = Object.keys(PROCESSIONS_STREETS);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const streets = PROCESSIONS_STREETS[id];
    process.stdout.write(`\n[${i + 1}/${ids.length}] ${id}`);

    const result = await processRoute(id, streets, streetWays, streetNodeSets, graph, nodeCoords);
    if (result) {
      bakedRoutes[id] = result.route;
      bakedCheckpoints[id] = result.checkpoints;
      bakedSegmentTypes[id] = result.segments;
      console.log(`  => ${result.route.length} pts, ${result.checkpoints.points.length} cp`);
    } else {
      console.log('  => FAILED');
      bakedRoutes[id] = [];
      bakedCheckpoints[id] = { points: [], names: [] };
      bakedSegmentTypes[id] = [];
    }
  }

  // Write output
  const output = { routes: bakedRoutes, checkpoints: bakedCheckpoints, segments: bakedSegmentTypes };
  writeFileSync('/Users/jairo/almeria/baked_routes.json', JSON.stringify(output));

  let totalPts = 0;
  for (const r of Object.values(bakedRoutes)) totalPts += r.length;
  console.log(`\n=== DONE: ${ids.length} processions, ${totalPts} total route points ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
