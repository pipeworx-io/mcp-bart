# mcp-bart

BART MCP — San Francisco Bay Area Rapid Transit real-time data (api.bart.gov)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

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

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Bart data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
