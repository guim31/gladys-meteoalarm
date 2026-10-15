// -----------------------------------------------------------------------------
// Scene triggers: "new warning" when a phenomenon appears or its level rises,
// "warning lifted" when it has no warning left. Silent at the first reading,
// no repeat after a restart.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createWorld, fixture } from './helpers/world.js';

const CONFIG = { country: 'belgium', zones: 'Liège', language: 'en' };
const WIND = '7d1c1e52-0b6e-4c58-9a1e-000000000001';
const RAIN = '7d1c1e52-0b6e-4c58-9a1e-000000000002';
const CAP_PREFIX = 'https://feeds.meteoalarm.org/api/v1/warnings/feeds-belgium/';
const QUARTER = 15 * 60_000;

/** The Belgian feed without the entries of some CAP documents. */
const without = (...ids) =>
  ids.reduce(
    (xml, id) =>
      xml.replace(new RegExp(`<entry>(?:(?!</entry>)[\\s\\S])*?${id}[\\s\\S]*?</entry>`, 'g'), ''),
    fixture('belgium.atom.xml'),
  );

/** The Belgian feed where the wind became red (an update: a new CAP document). */
function redWind(world) {
  const id = '7d1c1e52-0b6e-4c58-9a1e-000000000007';
  world.server.caps[CAP_PREFIX + id] = fixture('belgium-wind.cap.xml').replaceAll(
    '3; orange; Severe',
    '4; red; Extreme',
  );
  return fixture('belgium.atom.xml').replaceAll(WIND, id).replaceAll('Orange Wind', 'Red Wind');
}

async function setup(options = {}) {
  const world = await createWorld({
    config: CONFIG,
    feeds: { belgium: without(WIND, RAIN) },
    now: '2026-10-15T05:30:00Z',
    ...options,
  });
  await world.createAll();
  return world;
}

const next = async (world) => {
  world.advance(QUARTER);
  await world.app.refresh();
};

test('the first reading is silent, a new warning is announced before it starts', async () => {
  const world = await setup({ feeds: { belgium: without(RAIN) } });
  // Installed while the wind warning is announced: no event.
  assert.deepEqual(world.gladys.fake.sceneEvents, []);

  world.server.feeds.belgium = fixture('belgium.atom.xml');
  await next(world);
  assert.equal(world.gladys.fake.sceneEvents.length, 1);
  const [{ key, data }] = world.gladys.fake.sceneEvents;
  assert.equal(key, 'warning_issued');
  const device = world.gladys.externalIds('zone', 'belgium.liege').device;
  assert.deepEqual(data, {
    device,
    zone: 'MeteoAlarm Liège',
    level: 'yellow',
    level_label: 'Yellow',
    phenomenon: 'rain',
    phenomenon_label: 'Rain',
    in_force: false,
    period: 'Fri 16 Oct, 00:00 → Fri 16 Oct, 18:00',
    onset: '2026-10-16T00:00:00.000Z',
    expires: '2026-10-16T18:00:00.000Z',
    headline: 'Heavy rain',
    description: '30 to 40 mm of rain in 24 hours.',
    instruction: 'Avoid flood-prone areas.',
  });

  // Nothing new: nothing more, even when the wind comes into force.
  world.advance(30 * 60_000);
  await next(world);
  assert.equal(world.gladys.fake.sceneEvents.length, 1);
});

test('a level that rises is announced again, a lower one is not', async () => {
  const world = await setup({ feeds: { belgium: without(RAIN) }, now: '2026-10-15T07:00:00Z' });
  world.server.feeds.belgium = redWind(world);
  await next(world);
  const issued = world.gladys.fake.sceneEvents.filter((e) => e.key === 'warning_issued');
  assert.deepEqual(
    issued.map(({ data }) => [data.phenomenon, data.level, data.in_force]),
    [
      ['wind', 'red', true],
      ['rain', 'yellow', false],
    ],
  );
  assert.equal(issued[0].data.level_label, 'Red');
  world.server.feeds.belgium = fixture('belgium.atom.xml');
  await next(world);
  assert.equal(world.gladys.fake.sceneEvents.length, 2, 'back to orange: no news');
});

test('a warning that expires or is withdrawn is lifted, once', async () => {
  const world = await setup({
    feeds: { belgium: fixture('belgium.atom.xml') },
    now: '2026-10-15T20:00:00Z',
  });
  assert.deepEqual(world.gladys.fake.sceneEvents, []);
  // 21:00: the wind expires.
  world.advance(60 * 60_000);
  await world.app.refresh();
  assert.deepEqual(world.gladys.fake.sceneEvents, [
    {
      key: 'warning_lifted',
      data: {
        device: world.gladys.externalIds('zone', 'belgium.liege').device,
        zone: 'MeteoAlarm Liège',
        level: 'orange',
        level_label: 'Orange',
        phenomenon: 'wind',
        phenomenon_label: 'Wind',
      },
    },
  ]);
  // The rain warning is withdrawn before it starts.
  world.server.feeds.belgium = without(WIND, RAIN);
  await next(world);
  await next(world);
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map(({ key, data }) => `${key} ${data.phenomenon}`),
    ['warning_lifted wind', 'warning_lifted rain'],
  );
});

test('a restart does not announce again what was announced', async () => {
  const world = await setup();
  world.server.feeds.belgium = fixture('belgium.atom.xml');
  await next(world);
  assert.equal(world.gladys.fake.sceneEvents.length, 2);
  await world.app.stop();
  const saved = JSON.parse(await readFile(join(world.dataDir, 'meteoalarm.json'), 'utf8'));
  assert.deepEqual(Object.values(saved.known), [{ wind: 3, rain: 2 }]);

  // Same /data, Gladys knows the device: the warnings are known.
  const again = await createWorld({
    config: CONFIG,
    feeds: { belgium: 'belgium.atom.xml' },
    now: '2026-10-15T06:30:00Z',
    dataDir: world.dataDir,
    devices: world.gladys.fake.discoveredDevices,
  });
  assert.deepEqual(again.gladys.fake.sceneEvents, []);
  // What changed while it was off is announced.
  again.server.feeds.belgium = without(RAIN);
  await next(again);
  assert.deepEqual(
    again.gladys.fake.sceneEvents.map(({ key, data }) => `${key} ${data.phenomenon}`),
    ['warning_lifted rain'],
  );
});

test('a feed that does not answer lifts nothing', async () => {
  const world = await setup({
    feeds: { belgium: 'belgium.atom.xml' },
    now: '2026-10-15T08:00:00Z',
  });
  world.server.failure = 503;
  await next(world);
  await next(world);
  assert.deepEqual(world.gladys.fake.sceneEvents, []);
});

test('the event texts follow the configured language', async () => {
  const world = await setup({ feeds: { belgium: without(WIND, RAIN) } });
  await world.gladys.fake.configUpdated({ ...CONFIG, language: 'fr' });
  world.server.feeds.belgium = without(RAIN);
  await next(world);
  const [{ data }] = world.gladys.fake.sceneEvents;
  assert.equal(data.level_label, 'Orange');
  assert.equal(data.phenomenon_label, 'Vent');
  assert.equal(data.headline, 'Fortes rafales de vent');
  assert.equal(data.period, 'jeu. 15 oct., 06:00 → jeu. 15 oct., 21:00');
});
