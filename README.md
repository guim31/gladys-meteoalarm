# MeteoAlarm for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com)
that follows the **official weather warnings of 38 European countries**, as
the national weather services publish them on
[MeteoAlarm](https://meteoalarm.org) (EUMETNET): Belgium, Switzerland,
Luxembourg, Germany, Spain, Italy, the Netherlands, Ireland, Austria… and
France. It reads the public Atom / CAP feeds: no account, no key.

> **Developed without access to the live feed: feedback welcome.** The
> development environment could not reach `feeds.meteoalarm.org`. The
> integration is built and tested against real feeds published with the
> `meteoalert-api` test suite (France, Ireland, United Kingdom) and a
> synthetic Belgian feed of the same structure; `scripts/probe.mjs` checks the
> live feeds read-only. Please report what works and what does not in the
> [issues](https://github.com/guim31/gladys-meteoalarm/issues).

For France, the Météo-France integration (another author) follows the
departmental vigilance in more detail. This one is meant above all for the
neighboring countries and for cross-border workers.

## Features

- **One device per zone** you follow (typed as on meteoalarm.org, or by code),
  and optionally one for a **house of Gladys**, placed in the warning areas
  when the issuer outlines them.
- On each device: the **highest warning level in force** and the level **per
  phenomenon** (12 `risk` features, drawn by Gladys as green / yellow /
  orange / red badges), the **current and upcoming warnings**, the
  **description** of the main one, its **start** and **end**.
- **Scene triggers**: _New weather warning_ (when it enters the feed, often
  the day before, with level, phenomenon, period and texts) and _Weather
  warning lifted_.
- **Dashboard widget** _Weather warnings_: the warnings of a zone, in force
  and announced, color, phenomenon, times, and the full text on tap.
- **Configuration action** _List the zones_: the zones known for the country,
  with their codes, and whether yours were found.
- Texts in English, French, German or Spanish (feature names and texts sent
  to Gladys); warning texts in that language when the issuer writes it.
- Read only. The feed is read every **10 or 15 minutes**; start and end times
  are followed to the minute.

## Requirements

- Gladys Assistant **5.2.0** or later.
- Internet access from the Gladys host to `feeds.meteoalarm.org`.
- To follow a house: the house located in Gladys, and a country whose issuer
  outlines its warning areas (Ireland does; France and the United Kingdom did
  not in the samples).

## Installation

In Gladys: **Integrations → Install from GitHub**, then
`https://github.com/guim31/gladys-meteoalarm`. Open its **Configuration**
tab, choose the country, type your zones (or choose a house), save, then add
the devices from the **Discovery** tab.

The user documentation, in [English](docs/en.md), [French](docs/fr.md),
[German](docs/de.md) and [Spanish](docs/es.md), is also linked from the
Configuration screen.

## How it works

- `index.js` creates the SDK client; `src/app.js` registers the handlers and
  runs the refresh. The container ticks every minute by itself: it reads the
  country's Atom feed when the last reading is one period old (with
  `If-None-Match` / `If-Modified-Since`), reads the CAP document of a warning
  once (only for the followed zones; all of them for a house, 40 at most per
  refresh), and re-reads the times of the known warnings at every tick. The
  core's `onPoll`, if it comes, runs the same refresh
  (GladysAssistant/Gladys#3198).
- Only the changed states are published (`publishChangedStates`), with a 6 h
  heartbeat; everything is sent again when a device is added.
- Under `/data/meteoalarm.json`: the zones seen in the feeds (for _List the
  zones_), the warnings each device already announced (no repeat after a
  restart), and whether the country outlines its areas.

```
index.js            SDK wiring (src/app.js registers the handlers)
src/app.js          refresh loop, states, triggers, widget, action, statuses
src/client.js       HTTP client of the feeds (conditional GET, CAP cache)
src/cap.js          Atom and CAP parsing, levels and phenomena
src/xml.js          the few XML readings needed, no dependency
src/warnings.js     warnings of a zone or a point, what is in force
src/geo.js          point in polygon / circle
src/devices.js      Gladys devices and states
src/triggers.js     "new warning" / "warning lifted"
src/widgets.js      "Weather warnings" widget
src/i18n.js         every text, in four languages
src/countries.js    the 38 feeds
src/store.js        /data persistence
scripts/probe.mjs   read-only probe of the live feeds
```

## Limitations

- Developed without the live feed (see above). The country slugs follow the
  addresses used by `meteoalert-api`; `node scripts/probe.mjs --all` checks
  them.
- A feed only lists the zones that have a warning: there is no full list of
  the zones of a country, so the user types names or codes, and _List the
  zones_ grows with the warnings seen.
- House tracking needs area outlines in the CAP documents, which only some
  issuers provide.
- One country per installation, 10 zones at most.
- MeteoAlarm calls the Atom feed "legacy": if it is retired, the integration
  will have to move to its successor.
- Not an official alert system: for any decision, refer to the national
  weather service.

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test                    # node --test: fixtures + SDK fake Gladys
npm run lint
npm run format:check
node scripts/probe.mjs belgium "Liège"   # live feed, read-only (network needed)
node scripts/probe.mjs --all             # every country feed
npx github:GladysAssistant/integration-store .   # store validator
```

`test/gladys-rules.test.js` checks every discovered device against the
category/type table extracted from the Gladys core.

To run it outside Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="meteoalarm" \
METEOALARM_DATA_DIR=./data \
LOG_LEVEL=debug \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit
the versions by hand. A hand-pushed `vX.Y.Z` tag also builds the image and the
GitHub Release, but then `version` in `package.json` and in the manifest (with
the `docker_image` tag) must be bumped and committed before tagging. See
[`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [`meteoalert-api`](https://github.com/rolfberkenbosch/meteoalert-api) by
  Rolf Berkenbosch and contributors (MIT), the library behind the Home
  Assistant integration: the feed addresses, how entries match a province, and
  the real feeds of its test suite, reused in `test/fixtures/feeds/`.
- Home Assistant's
  [`meteoalarm`](https://github.com/home-assistant/core/tree/dev/homeassistant/components/meteoalarm)
  integration (Apache-2.0): the country / province / language model.
- The national weather services and [MeteoAlarm](https://meteoalarm.org)
  (EUMETNET), who publish the warnings.

## Disclaimer

This project is not affiliated with, endorsed or sponsored by EUMETNET or
MeteoAlarm. "MeteoAlarm" is the name of its owners' service. The warnings are
those of the national weather services.

## License

[Apache-2.0](LICENSE)
