// -----------------------------------------------------------------------------
// Reading the feeds: real MeteoAlarm answers (France, Ireland, United
// Kingdom) and the synthetic Belgian feed, see test/fixtures/feeds/README.md.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasGeometry, levelOf, parseCap, parseFeed, phenomenonOf } from '../src/cap.js';
import { decodeText, startTags } from '../src/xml.js';
import { fixture } from './helpers/world.js';

test('the French feed: one entry per area, EMMA_ID and national code, times', () => {
  const feed = parseFeed(fixture('france.atom.xml'));
  assert.equal(feed.updated, '2022-12-08T00:36:08.851Z');
  assert.equal(feed.entries.length, 12);
  const [first] = feed.entries;
  assert.equal(first.areaDesc, 'Haute Savoie');
  assert.equal(first.emmaId, 'FR035');
  assert.deepEqual(first.geocodes, [{ name: 'NUTS3', value: 'FR718' }]);
  assert.equal(
    first.capUrl,
    'https://feeds.meteoalarm.org/api/v1/warnings/feeds-france/04d497d4-d114-4d6b-93ba-13fa7ed577fe',
  );
  assert.equal(first.onset, '2022-12-07T15:00:00.000Z');
  assert.equal(first.expires, '2022-12-08T15:00:00.000Z');
  assert.equal(first.level, 2);
  assert.equal(first.phenomenon, 'avalanches');
  assert.equal(first.status, 'Actual');
  assert.equal(first.messageType, 'Alert');
});

test('the UK feed decodes the entities of the area names', () => {
  const feed = parseFeed(fixture('united-kingdom.atom.xml'));
  assert.equal(feed.entries.length, 25);
  const names = feed.entries.map((entry) => entry.areaDesc);
  assert.ok(names.includes('Orkney & Shetland'), names.join(', '));
  assert.ok(feed.entries.every((entry) => entry.phenomenon === 'snow_ice'));
  assert.ok(feed.entries.every((entry) => entry.level === 2));
});

test('the Irish feed: FIPS geocodes, every entry linking the same CAP document', () => {
  const feed = parseFeed(fixture('ireland.atom.xml'));
  assert.equal(feed.entries.length, 20);
  assert.equal(new Set(feed.entries.map((entry) => entry.capUrl)).size, 1);
  assert.deepEqual(feed.entries[0].geocodes, [{ name: 'FIPS', value: 'EI10' }]);
  assert.equal(feed.entries[0].phenomenon, 'low_temperature');
});

test('a CAP document: one info block per language, awareness parameters, areas', () => {
  const cap = parseCap(fixture('france-avalanches.cap.xml'));
  assert.equal(cap.msgType, 'Update');
  assert.deepEqual(
    cap.infos.map((info) => [info.language, info.level, info.phenomenon]),
    [
      ['fr-fr', 2, 'avalanches'],
      ['en-gb', 2, 'avalanches'],
    ],
  );
  assert.equal(cap.infos[0].headline, 'Vigilance jaune avalanches');
  // The tabs and runs of spaces of the source are squeezed.
  assert.doesNotMatch(cap.infos[0].description, /\t| {2}/);
  assert.equal(cap.infos[0].areas.length, 6);
  assert.deepEqual(cap.infos[0].areas[5], {
    desc: 'Haute Savoie',
    polygons: [],
    circles: [],
    geocodes: ['FR718'],
  });
  assert.equal(hasGeometry(cap), false);
});

test('only some issuers outline their areas: the Irish one does', () => {
  const ireland = parseCap(fixture('ireland-low-temperature.cap.xml'));
  assert.equal(hasGeometry(ireland), true);
  const [area] = ireland.infos[0].areas;
  assert.equal(area.polygons.length, 6);
  assert.deepEqual(area.polygons[0][0], [53.7762, -7.40536]);
  assert.equal(hasGeometry(parseCap(fixture('united-kingdom-ice.cap.xml'))), false);
});

test('the Belgian CAP document carries four languages and a polygon per area', () => {
  const cap = parseCap(fixture('belgium-wind.cap.xml'));
  assert.deepEqual(
    cap.infos.map((info) => info.language),
    ['nl-be', 'fr-be', 'de-de', 'en-gb'],
  );
  // &apos; decoded.
  assert.equal(cap.infos[1].description, "Rafales jusqu'à 100 km/h attendues sur les hauteurs.");
  assert.ok(cap.infos.every((info) => info.level === 3 && info.phenomenon === 'wind'));
  assert.equal(cap.infos[0].areas[0].polygons[0].length, 5);
});

test('levels: awareness parameter first, then the title color, then the severity', () => {
  assert.equal(levelOf({ awarenessLevel: '3; orange; Severe', title: 'Yellow Wind' }), 3);
  assert.equal(levelOf({ awarenessLevel: 'red', severity: 'Moderate' }), 4);
  assert.equal(levelOf({ title: 'Orange Rain Warning issued for Belgium - Liège' }), 3);
  assert.equal(levelOf({ title: 'Something', severity: 'Extreme' }), 4);
  assert.equal(levelOf({ severity: 'Minor' }), 1);
  // In the feed, so a warning: yellow when nothing grades it.
  assert.equal(levelOf({}), 2);
});

test('phenomena: awareness type number, its name, then the words of the title', () => {
  assert.equal(phenomenonOf({ awarenessType: '9; avalanches' }), 'avalanches');
  assert.equal(phenomenonOf({ awarenessType: '13; Rain-Flood' }), 'rain_flood');
  assert.equal(phenomenonOf({ awarenessType: '11; something new' }), null);
  assert.equal(phenomenonOf({ awarenessType: '99; Rain-flood' }), 'rain_flood');
  const fromTitle = (title) => phenomenonOf({ title: `${title} Warning issued for X - Y` });
  assert.equal(fromTitle('Yellow Rain-flood'), 'rain_flood');
  assert.equal(fromTitle('Yellow Flooding'), 'flooding');
  assert.equal(fromTitle('Yellow Rain'), 'rain');
  assert.equal(fromTitle('Orange High-temperature'), 'high_temperature');
  assert.equal(fromTitle('Orange Low-temperature'), 'low_temperature');
  assert.equal(fromTitle('Red Forest-fire'), 'forest_fire');
  assert.equal(fromTitle('Yellow Coastal Event'), 'coastal_event');
  assert.equal(fromTitle('Yellow Thunderstorm'), 'thunderstorm');
  assert.equal(fromTitle('Yellow Fog'), 'fog');
  assert.equal(fromTitle('Yellow Snow-ice'), 'snow_ice');
  assert.equal(fromTitle('Yellow Wind'), 'wind');
  assert.equal(phenomenonOf({ title: 'Unknown', event: 'Yellow Low Temperature/Ice' }), 'snow_ice');
  assert.equal(phenomenonOf({ title: 'Yellow Tsunami Warning issued for X' }), null);
});

test('XML helpers: entities, CDATA, attributes, refusal of a non-feed', () => {
  assert.equal(
    decodeText('a &amp; b &lt;c&gt; &#233;&#x20AC; &unknown;'),
    'a & b <c> é€ &unknown;',
  );
  assert.equal(decodeText('x <![CDATA[<b>&amp;</b>]]> y &amp;'), 'x <b>&amp;</b> y &');
  assert.deepEqual(startTags('<link href="a?x=1&amp;y=2" type=\'t\'/>', 'link'), [
    { href: 'a?x=1&y=2', type: 't' },
  ]);
  assert.throws(() => parseFeed('<html>maintenance</html>'), /not an Atom feed/);
  assert.throws(() => parseCap('<feed></feed>'), /not a CAP alert/);
  assert.deepEqual(parseFeed('<feed xmlns="http://www.w3.org/2005/Atom"></feed>').entries, []);
});

test('a CAP document with namespace prefixes and circles is read the same', () => {
  const cap = parseCap(`<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
    <cap:identifier>x</cap:identifier><cap:msgType>Alert</cap:msgType>
    <cap:info><cap:language>de-DE</cap:language><cap:event>Sturm</cap:event>
      <cap:parameter><cap:valueName>awareness_level</cap:valueName><cap:value>4; red; Extreme</cap:value></cap:parameter>
      <cap:area><cap:areaDesc>Kreis</cap:areaDesc><cap:circle>50.1,8.6 12.5</cap:circle></cap:area>
    </cap:info></cap:alert>`);
  assert.equal(cap.identifier, 'x');
  assert.equal(cap.infos[0].level, 4);
  assert.deepEqual(cap.infos[0].areas[0].circles, [{ lat: 50.1, lon: 8.6, radiusKm: 12.5 }]);
  assert.equal(hasGeometry(cap), true);
});
