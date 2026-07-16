interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * BART MCP — San Francisco Bay Area Rapid Transit real-time data (api.bart.gov)
 *
 * Tools:
 * - bart_departures: real-time train departures for a station (ETD)
 * - bart_stations: full station list with optional name filter
 * - bart_trip_planner: next trips between two stations with legs + fare
 * - bart_advisories: current service advisories + elevator outages
 *
 * Auth: BART publishes an open public API key (MW9S-E7SL-26DU-VV8V) for the
 * legacy API — hardcoded as the default; callers may override via _apiKey.
 *
 * API quirks (the legacy API is XML auto-converted to JSON with json=y):
 * - Attributes are `@`-prefixed (e.g. `@fare`, `@origTimeMin`)
 * - Free text arrives wrapped as { "#cdata-section": "..." }
 * - Single item vs array is inconsistent (one platform → object, several →
 *   array) — everything list-like goes through toArray()
 * - Real-time `minutes` is the string "Leaving" when a train is boarding —
 *   normalized to 0 with `leaving: true`
 * - Errors come back HTTP 200 with root.message.error.{text,details}
 */


const BASE_URL = 'https://api.bart.gov/api';
const PUBLIC_KEY = 'MW9S-E7SL-26DU-VV8V'; // BART's officially published open key

// All 50 BART stations (from stn.aspx, 2026-07-15) — embedded so station
// names resolve to codes without an extra API round trip.
const STATIONS: Array<{ abbr: string; name: string; city: string }> = [
  { abbr: '12TH', name: '12th St. Oakland City Center', city: 'Oakland' },
  { abbr: '16TH', name: '16th St. Mission', city: 'San Francisco' },
  { abbr: '19TH', name: '19th St. Oakland', city: 'Oakland' },
  { abbr: '24TH', name: '24th St. Mission', city: 'San Francisco' },
  { abbr: 'ANTC', name: 'Antioch', city: 'Antioch' },
  { abbr: 'ASHB', name: 'Ashby', city: 'Berkeley' },
  { abbr: 'BALB', name: 'Balboa Park', city: 'San Francisco' },
  { abbr: 'BAYF', name: 'Bay Fair', city: 'San Leandro' },
  { abbr: 'BERY', name: 'Berryessa/North San Jose', city: 'San Jose' },
  { abbr: 'CAST', name: 'Castro Valley', city: 'Castro Valley' },
  { abbr: 'CIVC', name: 'Civic Center/UN Plaza', city: 'San Francisco' },
  { abbr: 'COLS', name: 'Coliseum', city: 'Oakland' },
  { abbr: 'COLM', name: 'Colma', city: 'Colma' },
  { abbr: 'CONC', name: 'Concord', city: 'Concord' },
  { abbr: 'DALY', name: 'Daly City', city: 'Daly City' },
  { abbr: 'DBRK', name: 'Downtown Berkeley', city: 'Berkeley' },
  { abbr: 'DUBL', name: 'Dublin/Pleasanton', city: 'Pleasanton' },
  { abbr: 'DELN', name: 'El Cerrito del Norte', city: 'El Cerrito' },
  { abbr: 'PLZA', name: 'El Cerrito Plaza', city: 'El Cerrito' },
  { abbr: 'EMBR', name: 'Embarcadero', city: 'San Francisco' },
  { abbr: 'FRMT', name: 'Fremont', city: 'Fremont' },
  { abbr: 'FTVL', name: 'Fruitvale', city: 'Oakland' },
  { abbr: 'GLEN', name: 'Glen Park', city: 'San Francisco' },
  { abbr: 'HAYW', name: 'Hayward', city: 'Hayward' },
  { abbr: 'LAFY', name: 'Lafayette', city: 'Lafayette' },
  { abbr: 'LAKE', name: 'Lake Merritt', city: 'Oakland' },
  { abbr: 'MCAR', name: 'MacArthur', city: 'Oakland' },
  { abbr: 'MLBR', name: 'Millbrae', city: 'Millbrae' },
  { abbr: 'MLPT', name: 'Milpitas', city: 'Milpitas' },
  { abbr: 'MONT', name: 'Montgomery St.', city: 'San Francisco' },
  { abbr: 'NBRK', name: 'North Berkeley', city: 'Berkeley' },
  { abbr: 'NCON', name: 'North Concord/Martinez', city: 'Concord' },
  { abbr: 'OAKL', name: 'Oakland International Airport', city: 'Oakland' },
  { abbr: 'ORIN', name: 'Orinda', city: 'Orinda' },
  { abbr: 'PITT', name: 'Pittsburg/Bay Point', city: 'Pittsburg' },
  { abbr: 'PCTR', name: 'Pittsburg Center', city: 'Pittsburg' },
  { abbr: 'PHIL', name: 'Pleasant Hill/Contra Costa Centre', city: 'Walnut Creek' },
  { abbr: 'POWL', name: 'Powell St.', city: 'San Francisco' },
  { abbr: 'RICH', name: 'Richmond', city: 'Richmond' },
  { abbr: 'ROCK', name: 'Rockridge', city: 'Oakland' },
  { abbr: 'SBRN', name: 'San Bruno', city: 'San Bruno' },
  { abbr: 'SFIA', name: 'San Francisco International Airport', city: "San Francisco Int'l Airport" },
  { abbr: 'SANL', name: 'San Leandro', city: 'San Leandro' },
  { abbr: 'SHAY', name: 'South Hayward', city: 'Hayward' },
  { abbr: 'SSAN', name: 'South San Francisco', city: 'South San Francisco' },
  { abbr: 'UCTY', name: 'Union City', city: 'Union City' },
  { abbr: 'WCRK', name: 'Walnut Creek', city: 'Walnut Creek' },
  { abbr: 'WARM', name: 'Warm Springs/South Fremont', city: 'Fremont' },
  { abbr: 'WDUB', name: 'West Dublin/Pleasanton', city: 'Dublin' },
  { abbr: 'WOAK', name: 'West Oakland', city: 'Oakland' },
];

// Common aliases agents reach for that plain name-matching would miss.
const ALIASES: Record<string, string> = {
  SFO: 'SFIA',
  'SF AIRPORT': 'SFIA',
  'SFO AIRPORT': 'SFIA',
  'SAN FRANCISCO AIRPORT': 'SFIA',
  'OAKLAND AIRPORT': 'OAKL',
  'OAK AIRPORT': 'OAKL',
  OAK: 'OAKL',
  BERKELEY: 'DBRK',
  OAKLAND: '12TH',
  'DOWNTOWN OAKLAND': '12TH',
  MISSION: '16TH',
  'CIVIC CENTER': 'CIVC',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'bart_departures',
    description:
      'Real-time BART San Francisco Bay Area train departures for a station — next train departure times in minutes, per destination, with platform, direction, train length (cars), line color, delay, and bikes allowed. Station accepts a 4-letter BART code ("EMBR", "SFIA") or a station name ("Embarcadero", "Downtown Berkeley", "SFO"). Answers "when is the next BART train". Example: bart_departures({ station: "Embarcadero" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        station: {
          type: 'string',
          description:
            'BART station — 4-letter code like "EMBR", "MONT", "SFIA", or a name like "Embarcadero", "Powell", "Downtown Berkeley"',
        },
        _apiKey: { type: 'string', description: 'Optional: your own BART API key (defaults to the BART public key)' },
      },
      required: ['station'],
    },
  },
  {
    name: 'bart_stations',
    description:
      'List all 50 BART San Francisco Bay Area train stations with 4-letter code, full name, city, street address, and coordinates. Optional filter matches station name or city (e.g. "Oakland", "Berkeley", "airport"). Use to find the station code for departures, trips, or fares. Example: bart_stations({ filter: "San Francisco" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filter: { type: 'string', description: 'Optional name or city filter, e.g. "Oakland", "airport", "Mission"' },
        _apiKey: { type: 'string', description: 'Optional: your own BART API key (defaults to the BART public key)' },
      },
      required: [],
    },
  },
  {
    name: 'bart_trip_planner',
    description:
      'Plan a BART trip between two Bay Area stations — the next trains from origin to destination with departure and arrival times, trip duration, legs (line, transfer stations, bikes), and the fare (Clipper and discount prices). Covers trips like SF to Oakland, Embarcadero to SFO airport, Berkeley to Millbrae. Stations accept 4-letter codes or names. Example: bart_trip_planner({ from: "Embarcadero", to: "SFIA" })',
    inputSchema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'Origin station — code or name, e.g. "EMBR" or "Embarcadero"' },
        to: { type: 'string', description: 'Destination station — code or name, e.g. "SFIA" or "SFO airport"' },
        trips: { type: 'number', description: 'How many upcoming trips to return, 1-4 (default 4)' },
        _apiKey: { type: 'string', description: 'Optional: your own BART API key (defaults to the BART public key)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'bart_advisories',
    description:
      'Current BART service advisories and delays for the San Francisco Bay Area train system, plus elevator outage status at stations. Answers "is BART delayed right now", "are there BART service alerts", "which BART elevators are out". Example: bart_advisories({})',
    inputSchema: {
      type: 'object' as const,
      properties: {
        _apiKey: { type: 'string', description: 'Optional: your own BART API key (defaults to the BART public key)' },
      },
      required: [],
    },
  },
];

// --- helpers -----------------------------------------------------------

// The JSON is machine-converted XML: one child → object, several → array.
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

// Free-text nodes arrive as { "#cdata-section": "..." } (or plain strings).
function cdata(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && '#cdata-section' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>)['#cdata-section'] ?? '');
  }
  return String(v);
}

/** Resolve a forgiving station input ("EMBR", "Embarcadero", "sfo") to a 4-letter code. */
function resolveStation(input: string): string {
  const raw = (input ?? '').trim();
  if (!raw) {
    throw new Error('BART: station is required — pass a 4-letter code like "EMBR" or a name like "Embarcadero".');
  }
  const upper = raw.toUpperCase();

  if (STATIONS.some((s) => s.abbr === upper)) return upper;
  if (ALIASES[upper]) return ALIASES[upper];

  // Exact name match, then unique substring match on name or city.
  const exact = STATIONS.find((s) => s.name.toUpperCase() === upper);
  if (exact) return exact.abbr;

  const sub = STATIONS.filter(
    (s) => s.name.toUpperCase().includes(upper) || s.city.toUpperCase().includes(upper),
  );
  if (sub.length === 1) return sub[0].abbr;
  if (sub.length > 1) {
    const opts = sub.map((s) => `${s.abbr} (${s.name})`).join(', ');
    throw new Error(`BART: "${raw}" matches multiple stations: ${opts}. Pass one of the 4-letter codes.`);
  }
  throw new Error(
    `BART: unknown station "${raw}". Use bart_stations({}) to list all 50 stations, or pass a 4-letter code like "EMBR" (Embarcadero) or "SFIA" (SFO airport).`,
  );
}

async function bartFetch(
  endpoint: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ ...params, key: apiKey, json: 'y' });
  const res = await fetch(`${BASE_URL}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`BART API error: HTTP ${res.status}`);

  const data = (await res.json()) as { root?: Record<string, unknown> };
  const root = data.root ?? {};

  // The API returns HTTP 200 with an error node for bad params.
  const message = root.message as Record<string, unknown> | undefined;
  const err = message?.error as { text?: string; details?: string } | undefined;
  if (err) {
    throw new Error(`BART API: ${err.text ?? 'error'}${err.details ? ` — ${err.details}` : ''}`);
  }
  return root;
}

// --- tool implementations ----------------------------------------------

interface RawEstimate {
  minutes: string;
  platform: string;
  direction: string;
  length: string;
  color: string;
  hexcolor: string;
  bikeflag: string;
  delay: string;
  cancelflag?: string;
}

async function getDepartures(stationInput: string, apiKey: string) {
  const code = resolveStation(stationInput);
  const root = await bartFetch('etd.aspx', { cmd: 'etd', orig: code }, apiKey);

  const station =
    toArray(root.station as Record<string, unknown> | Record<string, unknown>[])[0] ?? {};
  const etds = toArray(station.etd as Record<string, unknown> | Record<string, unknown>[]);

  const departures = etds.map((etd) => ({
    destination: etd.destination as string,
    destination_abbr: etd.abbreviation as string,
    estimates: toArray(etd.estimate as RawEstimate | RawEstimate[]).map((e) => {
      const leaving = e.minutes === 'Leaving';
      return {
        minutes: leaving ? 0 : Number(e.minutes),
        leaving, // true = train is at the platform boarding now
        platform: Number(e.platform),
        direction: e.direction,
        length_cars: Number(e.length),
        color: e.color,
        hexcolor: e.hexcolor,
        delay_seconds: Number(e.delay),
        bikes_allowed: e.bikeflag === '1',
        cancelled: e.cancelflag === '1',
      };
    }),
  }));

  const warning = (root.message as Record<string, unknown> | undefined)?.warning as
    | string
    | undefined;

  return {
    station: (station.name as string) ?? code,
    station_abbr: (station.abbr as string) ?? code,
    date: root.date as string,
    time: root.time as string,
    departures,
    ...(departures.length === 0
      ? {
          note:
            warning ??
            'No trains currently scheduled from this station (service may have ended for the night).',
        }
      : {}),
  };
}

async function getStations(filter: string | undefined, apiKey: string) {
  const root = await bartFetch('stn.aspx', { cmd: 'stns' }, apiKey);
  const wrapper = (root.stations ?? {}) as Record<string, unknown>;
  let stations = toArray(
    wrapper.station as Record<string, unknown> | Record<string, unknown>[],
  ).map((s) => ({
    abbr: s.abbr as string,
    name: s.name as string,
    city: s.city as string,
    county: s.county as string,
    address: s.address as string,
    zipcode: s.zipcode as string,
    latitude: Number(s.gtfs_latitude),
    longitude: Number(s.gtfs_longitude),
  }));

  if (filter) {
    const f = filter.toUpperCase();
    stations = stations.filter(
      (s) => s.name.toUpperCase().includes(f) || s.city.toUpperCase().includes(f) || s.abbr === f,
    );
  }

  return { count: stations.length, stations };
}

interface RawLeg {
  '@order': string;
  '@origin': string;
  '@destination': string;
  '@origTimeMin': string;
  '@destTimeMin': string;
  '@line': string;
  '@bikeflag': string;
  '@trainHeadStation': string;
}

async function planTrip(
  fromInput: string,
  toInput: string,
  trips: number | undefined,
  apiKey: string,
) {
  const orig = resolveStation(fromInput);
  const dest = resolveStation(toInput);
  if (orig === dest) {
    throw new Error(
      `BART: origin and destination resolve to the same station (${orig}). Pick two different stations.`,
    );
  }
  const a = Math.min(Math.max(Math.trunc(trips ?? 4), 1), 4);
  const root = await bartFetch(
    'sched.aspx',
    { cmd: 'depart', orig, dest, b: '0', a: String(a) },
    apiKey,
  );

  const schedule = (root.schedule ?? {}) as Record<string, unknown>;
  const request = (schedule.request ?? {}) as Record<string, unknown>;
  const rawTrips = toArray(request.trip as Record<string, unknown> | Record<string, unknown>[]);

  const plannedTrips = rawTrips.map((t) => {
    const fares = (t.fares ?? {}) as Record<string, unknown>;
    const fareList = toArray(
      fares.fare as Record<string, unknown> | Record<string, unknown>[],
    ).map((f) => ({
      class: f['@class'] as string,
      name: f['@name'] as string,
      amount: Number(f['@amount']),
    }));
    const legs = toArray(t.leg as RawLeg | RawLeg[]).map((l) => ({
      order: Number(l['@order']),
      from: l['@origin'],
      to: l['@destination'],
      departs: l['@origTimeMin'],
      arrives: l['@destTimeMin'],
      line: l['@line'],
      train_head_station: l['@trainHeadStation'],
      bikes_allowed: l['@bikeflag'] === '1',
    }));
    return {
      departs: t['@origTimeMin'] as string,
      arrives: t['@destTimeMin'] as string,
      date: t['@origTimeDate'] as string,
      trip_minutes: Number(t['@tripTime']),
      fare_usd: Number(t['@fare']),
      fares: fareList,
      transfers: legs.length - 1,
      legs,
    };
  });

  return {
    origin: orig,
    destination: dest,
    date: schedule.date as string,
    time: schedule.time as string,
    trips: plannedTrips,
  };
}

function parseBsaList(root: Record<string, unknown>) {
  return toArray(root.bsa as Record<string, unknown> | Record<string, unknown>[])
    .map((b) => ({
      type: (b.type as string) ?? 'ADVISORY',
      station: (b.station as string) ?? 'BART',
      description: cdata(b.description).trim(),
      posted: (b.posted as string) || undefined,
      expires: (b.expires as string) || undefined,
    }))
    .filter((b) => b.description);
}

async function getAdvisories(apiKey: string) {
  const [bsaRoot, elevRoot] = await Promise.all([
    bartFetch('bsa.aspx', { cmd: 'bsa' }, apiKey),
    bartFetch('bsa.aspx', { cmd: 'elev' }, apiKey),
  ]);

  const advisories = parseBsaList(bsaRoot);
  const elevators = parseBsaList(elevRoot);

  return {
    date: bsaRoot.date as string,
    time: bsaRoot.time as string,
    advisory_count: advisories.length,
    advisories,
    elevator_status: elevators,
  };
}

// --- dispatch -----------------------------------------------------------

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = ((args._apiKey as string | undefined) ?? '').trim() || PUBLIC_KEY;
  delete args._apiKey;

  switch (name) {
    case 'bart_departures':
      return getDepartures(args.station as string, apiKey);
    case 'bart_stations':
      return getStations(args.filter as string | undefined, apiKey);
    case 'bart_trip_planner':
      return planTrip(
        args.from as string,
        args.to as string,
        args.trips as number | undefined,
        apiKey,
      );
    case 'bart_advisories':
      return getAdvisories(apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
