#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Read-only probe of the real MeteoAlarm feeds, with the integration's own
// client and parser. No account, nothing written, nothing sensitive printed.
//
//   node scripts/probe.mjs <country> [zone]   one country (and one zone)
//   node scripts/probe.mjs --all              every country of the list
//
// It answers what the development session could not check (no network
// there): the feed addresses of the 38 countries, the shape of today's feeds,
// the languages of the CAP documents, which issuers outline their areas, and
// whether a zone is matched.
// -----------------------------------------------------------------------------

import { hasGeometry } from '../src/cap.js';
import { MeteoalarmClient } from '../src/client.js';
import { COUNTRIES, feedUrl, findCountry } from '../src/countries.js';
import { evaluate, isLive, zoneWarnings } from '../src/warnings.js';

const client = new MeteoalarmClient();
const MAX_CAPS = 5;

async function probeCountry(slug, { verbose }) {
  const started = Date.now();
  const feed = await client.fetchFeed(slug);
  const live = feed.entries.filter(isLive);
  const urls = [...new Set(live.map((entry) => entry.capUrl).filter(Boolean))];
  const summary = {
    country: slug,
    ms: Date.now() - started,
    updated: feed.updated,
    entries: feed.entries.length,
    live: live.length,
    documents: urls.length,
    areas: new Set(feed.entries.map((entry) => entry.areaDesc)).size,
    withEmmaId: feed.entries.filter((entry) => entry.emmaId).length,
    unknownPhenomenon: [...new Set(live.filter((e) => !e.phenomenon).map((e) => e.title))],
  };
  if (!verbose) {
    return summary;
  }
  const languages = new Set();
  let outlined = 0;
  for (const url of urls.slice(0, MAX_CAPS)) {
    const cap = await client.fetchCap(url);
    cap.infos.forEach((info) => languages.add(info.language));
    if (hasGeometry(cap)) {
      outlined += 1;
    }
  }
  return {
    ...summary,
    capsRead: Math.min(urls.length, MAX_CAPS),
    capsOutlined: outlined,
    languages: [...languages],
    sampleAreas: [...new Set(live.map((e) => `${e.areaDesc} (${e.emmaId ?? '-'})`))].slice(0, 15),
    sampleTitles: [...new Set(live.map((e) => e.title))].slice(0, 10),
  };
}

const [arg, zone] = process.argv.slice(2);
if (!arg) {
  console.error('Usage: node scripts/probe.mjs <country> [zone] | --all');
  process.exit(2);
}

if (arg === '--all') {
  let failures = 0;
  for (const { slug } of COUNTRIES) {
    try {
      const result = await probeCountry(slug, { verbose: false });
      console.log(JSON.stringify(result));
    } catch (err) {
      failures += 1;
      console.log(JSON.stringify({ country: slug, url: feedUrl(slug), error: err.message }));
    }
  }
  console.log(`${COUNTRIES.length - failures}/${COUNTRIES.length} feeds readable`);
  process.exit(failures > 0 ? 1 : 0);
}

if (!findCountry(arg)) {
  console.error(`Unknown country "${arg}". Known: ${COUNTRIES.map((c) => c.slug).join(', ')}`);
  process.exit(2);
}
try {
  console.log(JSON.stringify(await probeCountry(arg, { verbose: true }), null, 2));
  if (zone) {
    const feed = await client.fetchFeed(arg);
    const warnings = zoneWarnings(feed, zone, (url) => client.cachedCap(url));
    for (const url of new Set(warnings.map((w) => w.capUrl).filter(Boolean))) {
      await client.fetchCap(url);
    }
    const evaluation = evaluate(
      zoneWarnings(feed, zone, (url) => client.cachedCap(url)),
      Date.now(),
    );
    console.log(
      JSON.stringify(
        {
          zone,
          matched: warnings.length,
          level: evaluation.level,
          byPhenomenon: evaluation.byPhenomenon,
          present: evaluation.present.map((w) => ({
            level: w.level,
            phenomenon: w.phenomenon,
            onset: w.onset,
            expires: w.expires,
            languages: w.texts.map((t) => t.language),
          })),
        },
        null,
        2,
      ),
    );
  }
} catch (err) {
  console.error(`${arg}: ${err.message}`);
  process.exit(1);
}
