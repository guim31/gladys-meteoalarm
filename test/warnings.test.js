// -----------------------------------------------------------------------------
// From the feed to the warnings of a zone or a house, and what is in force:
// pure functions, replayed on the fixtures at their date.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCap, parseFeed } from '../src/cap.js';
import { normalizeName, parseZones } from '../src/config.js';
import { distanceKm, inPolygon } from '../src/geo.js';
import {
  evaluate,
  isLive,
  localized,
  pointWarnings,
  zoneMatches,
  zoneWarnings,
} from '../src/warnings.js';
import { CAPS, fixture } from './helpers/world.js';

const URL_BY_FILE = Object.fromEntries(Object.entries(CAPS).map(([url, file]) => [file, url]));
const capsOf =
  (...files) =>
  (url) => {
    const file = files.find((name) => URL_BY_FILE[name] === url);
    return file ? parseCap(fixture(file)) : null;
  };

const belgium = parseFeed(fixture('belgium.atom.xml'));
const belgianCaps = capsOf('belgium-wind.cap.xml', 'belgium-rain.cap.xml');
const at = (iso) => Date.parse(iso);

test('a zone matches by name (accents, case, dashes ignored), EMMA_ID or national code', () => {
  const france = parseFeed(fixture('france.atom.xml'));
  const hauteSavoie = france.entries[0];
  for (const zone of ['Haute Savoie', 'haute-savoie', 'HAUTE SAVOIE', 'FR035', 'fr035', 'FR718']) {
    assert.ok(zoneMatches(hauteSavoie, zone), zone);
  }
  // Exact match only: the library behind Home Assistant searches the name,
  // so "Savoie" there also catches "Haute Savoie".
  assert.ok(!zoneMatches(hauteSavoie, 'Savoie'));
  assert.ok(!zoneMatches(hauteSavoie, ''));
  const liege = belgium.entries[0];
  assert.ok(zoneMatches(liege, 'liege'));
  assert.ok(zoneMatches(liege, 'Liège'));
});

test('cancellations and test messages are not warnings', () => {
  const kinds = belgium.entries.map((entry) => [entry.areaDesc, entry.title, isLive(entry)]);
  assert.deepEqual(
    kinds.filter(([, , live]) => !live).map(([area, title]) => `${area}: ${title}`),
    [
      'Luxembourg: Yellow Thunderstorm Warning issued for Belgium - Luxembourg',
      'Antwerpen: Red Wind Warning issued for Belgium - Antwerpen',
    ],
  );
});

test('Liège: orange wind in force, yellow rain announced; French texts', () => {
  const warnings = zoneWarnings(belgium, 'Liège', belgianCaps);
  const evaluation = evaluate(warnings, at('2026-10-15T08:00:00Z'));
  assert.equal(evaluation.level, 3);
  assert.deepEqual(evaluation.byPhenomenon, { wind: 3 });
  assert.deepEqual(
    evaluation.current.map((w) => w.phenomenon),
    ['wind'],
  );
  assert.deepEqual(
    evaluation.upcoming.map((w) => w.phenomenon),
    ['rain'],
  );
  assert.equal(evaluation.main.phenomenon, 'wind');
  assert.equal(localized(evaluation.main, 'fr').headline, 'Fortes rafales de vent');
  assert.equal(localized(evaluation.main, 'de').headline, 'Schwere Sturmböen');
  // No Spanish text from the issuer: English.
  assert.equal(localized(evaluation.main, 'es').headline, 'Severe gusts of wind');
});

test('the period of a warning is followed to the minute', () => {
  const warnings = zoneWarnings(belgium, 'Liège', belgianCaps);
  const before = evaluate(warnings, at('2026-10-15T05:59:00Z'));
  assert.equal(before.level, 1);
  assert.equal(before.main.phenomenon, 'wind', 'the next one announced is the main one');
  assert.equal(evaluate(warnings, at('2026-10-15T06:00:00Z')).level, 3);
  const night = evaluate(warnings, at('2026-10-15T22:00:00Z'));
  assert.equal(night.level, 1);
  assert.deepEqual(
    night.present.map((w) => w.phenomenon),
    ['rain'],
  );
  const rain = evaluate(warnings, at('2026-10-16T09:00:00Z'));
  assert.equal(rain.level, 2);
  assert.deepEqual(rain.byPhenomenon, { rain: 2 });
  const after = evaluate(warnings, at('2026-10-16T18:00:00Z'));
  assert.equal(after.present.length, 0);
  assert.equal(after.main, null);
});

test('expired, cancelled, test and green entries raise nothing', () => {
  const now = at('2026-10-15T08:00:00Z');
  // Namur: an expired fog warning, and the announced rain.
  assert.deepEqual(
    evaluate(zoneWarnings(belgium, 'Namur', belgianCaps), now).present.map((w) => w.phenomenon),
    ['rain'],
  );
  // Luxembourg: its thunderstorm warning was cancelled; the wind remains.
  assert.deepEqual(
    evaluate(zoneWarnings(belgium, 'Luxembourg', belgianCaps), now).present.map(
      (w) => w.phenomenon,
    ),
    ['wind'],
  );
  // Antwerpen: a test message. Hainaut: green.
  assert.equal(evaluate(zoneWarnings(belgium, 'Antwerpen', belgianCaps), now).present.length, 0);
  assert.equal(evaluate(zoneWarnings(belgium, 'BE007', belgianCaps), now).level, 1);
});

test('the 12 entries of one warning over several areas count once per zone', () => {
  const ireland = parseFeed(fixture('ireland.atom.xml'));
  const warnings = zoneWarnings(ireland, 'Ireland', capsOf('ireland-low-temperature.cap.xml'));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].phenomenon, 'low_temperature');
});

test('without its CAP document a warning still counts, from the feed alone', () => {
  const warnings = zoneWarnings(belgium, 'Liège', () => null);
  const evaluation = evaluate(warnings, at('2026-10-15T08:00:00Z'));
  assert.equal(evaluation.level, 3);
  assert.equal(localized(evaluation.main, 'fr'), null);
});

test('a house inside a polygon gets the warnings of the area', () => {
  const now = at('2026-10-15T08:00:00Z');
  const liegeCity = { lat: 50.63, lon: 5.57 };
  const inLiege = pointWarnings(belgium, liegeCity, belgianCaps);
  // The wind outlines its areas; the rain document does not: not placeable.
  assert.deepEqual(
    inLiege.map((w) => [w.phenomenon, w.level]),
    [['wind', 3]],
  );
  assert.equal(evaluate(inLiege, now).level, 3);
  assert.equal(pointWarnings(belgium, { lat: 51.2, lon: 4.4 }, belgianCaps).length, 0);
});

test('Ireland: a point inside one of the six outlines of the area', () => {
  const ireland = parseFeed(fixture('ireland.atom.xml'));
  const caps = capsOf('ireland-low-temperature.cap.xml');
  const polygon = parseCap(fixture('ireland-low-temperature.cap.xml')).infos[0].areas[0]
    .polygons[0];
  // The middle of the first outline (a county of the Midlands).
  const lats = polygon.map(([lat]) => lat);
  const lons = polygon.map(([, lon]) => lon);
  const middle = {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
  };
  assert.ok(inPolygon(middle, polygon));
  assert.equal(pointWarnings(ireland, middle, caps).length, 1);
  // Paris is in none of them.
  assert.equal(pointWarnings(ireland, { lat: 48.85, lon: 2.35 }, caps).length, 0);
});

test('geometry helpers', () => {
  const square = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
  ];
  assert.ok(inPolygon({ lat: 5, lon: 5 }, square));
  assert.ok(!inPolygon({ lat: 15, lon: 5 }, square));
  assert.ok(!inPolygon({ lat: 5, lon: -1 }, square));
  const paris = { lat: 48.8566, lon: 2.3522 };
  const brussels = { lat: 50.8503, lon: 4.3517 };
  assert.ok(Math.abs(distanceKm(paris, brussels) - 264) < 3);
});

test('zones: split on commas, semicolons and lines, duplicates dropped, 10 at most', () => {
  assert.deepEqual(parseZones(' Liège ; BE004,\nliege ,, Namur  '), ['Liège', 'BE004', 'Namur']);
  assert.deepEqual(parseZones(undefined), []);
  assert.equal(parseZones(Array.from({ length: 12 }, (_, i) => `Z${i}`).join(',')).length, 10);
  assert.equal(normalizeName('  Haute-Savoie '), 'haute savoie');
  assert.equal(normalizeName('Île-de-France'), 'ile de france');
});
