# mcp-bart

BART MCP — San Francisco Bay Area Rapid Transit real-time data (api.bart.gov)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1476+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `bart_departures` | Real-time BART San Francisco Bay Area train departures for a station — next train departure times in minutes, per destination, with platform, direction, train length (cars), line color, delay, and bikes allowed. Station accepts a 4-letter BART code ("EMBR", "SFIA") or a station name ("Embarcadero", "Downtown Berkeley", "SFO"). Answers "when is the next BART train". Example: bart_departures({ station: "Embarcadero" }) |
| `bart_stations` | List all 50 BART San Francisco Bay Area train stations with 4-letter code, full name, city, street address, and coordinates. Optional filter matches station name or city (e.g. "Oakland", "Berkeley", "airport"). Use to find the station code for departures, trips, or fares. Example: bart_stations({ filter: "San Francisco" }) |
| `bart_trip_planner` | Plan a BART trip between two Bay Area stations — the next trains from origin to destination with departure and arrival times, trip duration, legs (line, transfer stations, bikes), and the fare (Clipper and discount prices). Covers trips like SF to Oakland, Embarcadero to SFO airport, Berkeley to Millbrae. Stations accept 4-letter codes or names. Example: bart_trip_planner({ from: "Embarcadero", to: "SFIA" }) |
| `bart_advisories` | Current BART service advisories and delays for the San Francisco Bay Area train system, plus elevator outage status at stations. Answers "is BART delayed right now", "are there BART service alerts", "which BART elevators are out". Example: bart_advisories({}) |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "bart": {
      "url": "https://gateway.pipeworx.io/bart/mcp"
    }
  }
}
```

### What this endpoint actually serves

`tools/list` at `https://gateway.pipeworx.io/bart/mcp` returns the tools in the table
above **plus the shared Pipeworx meta-tools** — `ask_pipeworx`,
`discover_tools`, `search_within`, `remember`/`recall` and the rest of the
gateway-wide set. So the tool count you see is larger than this table: a
single-pack endpoint currently lists roughly 30 shared tools alongside the
pack's own. The connection's `initialize` response states its exact scope, and
is the authoritative answer for a given day.

This is deliberate, not multiplexing by accident. The meta-tools are what let a
scoped connection answer a question this pack does not cover — via
`ask_pipeworx`, which routes across the whole catalog — without you adding a
second MCP server. There is currently no way to mount a pack endpoint without
them; if the extra schemas cost you more context than the routing is worth,
connect to the full gateway once rather than to several pack endpoints.

Or connect to the full Pipeworx gateway to get every pack's tools listed
directly, instead of just this one's:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

Both URLs reach the same gateway and the same 1476+ data sources. The
only difference is which pack's tools are listed **directly**; `ask_pipeworx`
reaches all of them from either one.

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English —
this works on the pack endpoint above as well as on the full gateway:

```
ask_pipeworx({ question: "your question about Bart data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

## No MCP client? Call it over HTTP

```bash
curl -X POST https://gateway.pipeworx.io/v1/tools/bart_departures \
  -H 'Content-Type: application/json' \
  -d '{"station":"EMBR"}'
```

No account needed for the first calls. Inspect any tool: `GET https://gateway.pipeworx.io/v1/tools/bart_departures`. Find one: `POST https://gateway.pipeworx.io/v1/tools/search_packs` with `{"query":"..."}`.
