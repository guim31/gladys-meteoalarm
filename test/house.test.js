// -----------------------------------------------------------------------------
// Following a house of Gladys: the warnings whose outlined area contains it.
// Only some issuers outline their areas (Ireland does, France and the United
// Kingdom do not, in the real fixtures): the status says when it cannot work.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/i18n.js';
import { createWorld } from './helpers/world.js';

const HOME = { id: '1', name: 'Home', selector: 'home', latitude: 50.6338, longitude: 5.5672 };

test('a house in Liège gets the wind warning of its outlined area', async () => {
  const world = await createWorld({
    config: { country: 'belgium', house: 'home', language: 'en' },
    feeds: { belgium: 'belgium.atom.xml' },
    houses: [HOME],
    now: '2026-10-15T08:00:00Z',
  });
  const [device] = world.gladys.fake.discoveredDevices;
  assert.equal(device.name, 'MeteoAlarm Home');
  assert.equal(device.external_id, world.gladys.externalIds('house', 'belgium.home').device);
  await world.createAll();
  const ids = world.gladys.externalIds('house', 'belgium.home');
  assert.equal(world.state(ids.feature('level')), 2);
  assert.equal(world.state(ids.feature('level_wind')), 2);
  // The rain document has no outline: the house cannot be placed in it.
  assert.match(world.state(ids.feature('summary')), /^Orange: Wind \(/);
  assert.doesNotMatch(world.state(ids.feature('summary')), /Rain/);
  // Every live warning document is read to test its outline — not the
  // cancelled, test, expired or green ones.
  assert.deepEqual(
    world.server.capRequests().map((request) => request.url.slice(-1)),
    ['1', '2'],
  );
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
});

test('a house outside every outline has no warning', async () => {
  const world = await createWorld({
    config: { country: 'belgium', house: 'home', language: 'en' },
    feeds: { belgium: 'belgium.atom.xml' },
    houses: [{ ...HOME, latitude: 51.2194, longitude: 4.4025 }],
    now: '2026-10-15T08:00:00Z',
  });
  await world.createAll();
  const ids = world.gladys.externalIds('house', 'belgium.home');
  assert.equal(world.state(ids.feature('level')), 0);
  assert.equal(world.state(ids.feature('summary')), 'No warning');
});

test('Ireland outlines its areas: a house in the Midlands is placed', async () => {
  const world = await createWorld({
    config: { country: 'ireland', house: 'home', language: 'en' },
    feeds: { ireland: 'ireland.atom.xml' },
    houses: [{ ...HOME, latitude: 53.7, longitude: -7.3 }],
    now: '2022-12-08T06:00:00Z',
  });
  await world.createAll();
  const ids = world.gladys.externalIds('house', 'ireland.home');
  assert.equal(world.state(ids.feature('level_low_temperature')), 1);
  const zones = await world.gladys.fake.action('list_zones');
  assert.match(zones.data.message.en, /This feed outlines its areas: a house can be followed\.$/);
});

test('France does not outline its areas: the status says to follow zones', async () => {
  const world = await createWorld({
    config: { country: 'france', house: 'home', zones: 'Savoie', language: 'en' },
    feeds: { france: 'france.atom.xml' },
    houses: [{ ...HOME, latitude: 45.9, longitude: 6.1 }],
    now: '2022-12-08T06:00:00Z',
  });
  await world.createAll();
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.noGeometry,
  });
  // The zone works all the same.
  const savoie = world.gladys.externalIds('zone', 'france.savoie');
  assert.equal(world.state(savoie.feature('level_avalanches')), 1);
});

test('a house without location, or deleted, is reported', async () => {
  const world = await createWorld({
    config: { country: 'belgium', house: 'home' },
    feeds: { belgium: 'belgium.atom.xml' },
    houses: [{ ...HOME, latitude: null, longitude: null }],
    now: '2026-10-15T08:00:00Z',
  });
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.houseNotLocated,
  });
  await world.createAll();
  const ids = world.gladys.externalIds('house', 'belgium.home');
  assert.equal(world.state(ids.feature('level')), 0);

  // Located in Gladys: read again with the next feed reading.
  world.gladys.fake.houses = [HOME];
  world.advance(15 * 60_000);
  await world.app.refresh();
  assert.equal(world.state(ids.feature('level')), 2);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });

  world.gladys.fake.houses = [];
  await world.gladys.fake.configUpdated({ country: 'belgium', house: 'home' });
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.houseNotFound,
  });
});
