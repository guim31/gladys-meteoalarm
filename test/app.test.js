// -----------------------------------------------------------------------------
// The integration end to end, on the SDK's fake Gladys and a fake MeteoAlarm
// server serving the fixture feeds: devices, states, statuses, the refresh
// by the container's own timer, the core's onPoll fallback, the logs.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HEARTBEAT_MS, TICK_MS } from '../src/app.js';
import { STATUS, TEXT } from '../src/i18n.js';
import { createWorld, fixture } from './helpers/world.js';

const BELGIUM = { country: 'belgium', zones: 'Liège, BE011', language: 'fr' };
const IN_FORCE = '2026-10-15T08:00:00Z';

const liege = (world) => world.gladys.externalIds('zone', 'belgium.liege');
const namur = (world) => world.gladys.externalIds('zone', 'belgium.be011');

/** Let the async work started by a timer run to its end. */
async function settle() {
  for (let i = 0; i < 30; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/** Capture the lines the SDK logger writes (info/debug on console.log, warn/error on console.error). */
function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    if (previous === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = previous;
    }
  });
  const lines = [];
  for (const stream of ['log', 'error']) {
    t.mock.method(console, stream, (...args) => lines.push(args.join(' ')));
  }
  return lines;
}

test('one device per zone, named after the feed once it showed the zone', async () => {
  const world = await createWorld({ config: BELGIUM, feeds: { belgium: 'belgium.atom.xml' } });
  const devices = world.gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((device) => [device.name, device.external_id]),
    [
      ['MeteoAlarm Liège', liege(world).device],
      // Typed as a code: the feed gave its name.
      ['MeteoAlarm Namur', namur(world).device],
    ],
  );
  assert.equal(devices[0].features.length, 17);
  assert.equal(devices[0].features[0].name, 'Niveau de vigilance maximal');
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
});

test('only the devices added to Gladys are read, and get every state', async () => {
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  // Nothing added yet: the feed is read, no CAP document, no state.
  assert.equal(world.server.feedRequests().length, 1);
  assert.equal(world.server.capRequests().length, 0);
  assert.equal(world.gladys.fake.states.length, 0);

  await world.gladys.fake.deviceCreated(world.gladys.fake.discoveredDevices[0]);
  const ids = liege(world);
  assert.equal(world.state(ids.feature('level')), 2, 'orange: medium risk');
  assert.equal(world.state(ids.feature('level_wind')), 2);
  assert.equal(world.state(ids.feature('level_rain')), 0, 'the rain is only announced');
  assert.equal(world.state(ids.feature('level_avalanches')), 0);
  assert.equal(
    world.state(ids.feature('summary')),
    'Orange : Vent (jeu. 15 oct., 06:00 → jeu. 15 oct., 21:00) · ' +
      'Jaune : Pluie (ven. 16 oct., 00:00 → ven. 16 oct., 18:00)',
  );
  assert.equal(
    world.state(ids.feature('description')),
    "Fortes rafales de vent — Rafales jusqu'à 100 km/h attendues sur les hauteurs.",
  );
  assert.equal(world.state(ids.feature('start')), 'jeu. 15 oct., 06:00');
  assert.equal(world.state(ids.feature('end')), 'jeu. 15 oct., 21:00');
  // Only the documents of Liège: the wind and the rain.
  assert.equal(world.server.capRequests().length, 2);
  assert.ok(world.gladys.fake.widgetRefreshes.includes('warnings'));
});

test('the states refresh by the container timer, without any onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml' },
    now: '2026-10-15T05:30:00Z',
    timers: true,
  });
  t.after(() => world.app.stop());
  await world.createAll();
  const ids = liege(world);
  assert.equal(world.state(ids.feature('level')), 0, 'the wind starts at 06:00');
  const polls = [];
  t.mock.method(world.app, 'pollFromCore', (...args) => polls.push(args));

  const tick = async () => {
    world.advance(TICK_MS);
    t.mock.timers.tick(TICK_MS);
    await settle();
  };
  // 06:00 → in force, from the times alone: no request.
  for (let minute = 0; minute < 30; minute += 1) {
    await tick();
    if (minute === 13) {
      // 15 minutes after the first reading: read again.
      assert.equal(world.server.feedRequests().length, 1);
    }
  }
  assert.equal(world.state(ids.feature('level')), 2);
  // One reading every 15 minutes: at 05:30, 05:45 and 06:00.
  assert.equal(world.server.feedRequests().length, 3);

  // The warning is withdrawn from the feed: seen at the next reading.
  world.server.feeds.belgium = fixture('belgium.atom.xml').replace(
    /<entry>(?:(?!<\/entry>)[\s\S])*?000000000001[\s\S]*?<\/entry>/g,
    '',
  );
  for (let minute = 0; minute < 15; minute += 1) {
    await tick();
  }
  assert.equal(world.state(ids.feature('level')), 0);
  assert.equal(world.state(ids.feature('level_wind')), 0);
  assert.equal(polls.length, 0, 'the core never polled');
});

test("the core's onPoll is a fallback: the feed is read only when due", async () => {
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml' },
    now: '2026-10-15T05:30:00Z',
  });
  await world.createAll();
  const [device] = world.gladys.fake.discoveredDevices;
  world.advance(31 * 60_000); // 06:01, the timer is off in this world
  assert.deepEqual(await world.gladys.fake.poll(device), { success: true });
  assert.equal(world.state(liege(world).feature('level')), 2);
  assert.equal(world.server.feedRequests().length, 2);
  world.advance(60_000);
  await world.gladys.fake.poll(device);
  assert.equal(world.server.feedRequests().length, 2, 'read 1 minute ago: not again');
  // A device of another integration (or an old one) is ignored.
  assert.deepEqual(
    await world.gladys.fake.poll({ ...device, external_id: 'ext:test-integration:zone:x' }),
    { success: true },
  );
});

test('a device just added gets its states at once, even unchanged', async () => {
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  await world.createAll();
  const count = world.gladys.fake.states.length;
  // The user deletes and adds it again: Gladys lost its values.
  const [device] = world.gladys.fake.discoveredDevices;
  await world.gladys.fake.deviceDeleted(device);
  await world.gladys.fake.deviceCreated(device);
  assert.equal(world.gladys.fake.states.length - count, 17);
});

test('an unchanged value is sent again after the heartbeat', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(IN_FORCE) });
  const world = await createWorld({
    config: { ...BELGIUM, zones: 'Liège' },
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  await world.createAll();
  const level = liege(world).feature('level');
  const sent = () => world.gladys.fake.states.filter((s) => s.device_feature_external_id === level);
  assert.equal(sent().length, 1);
  world.advance(16 * 60_000);
  t.mock.timers.tick(16 * 60_000);
  await world.app.refresh();
  assert.equal(sent().length, 1, 'unchanged: not sent');
  world.advance(HEARTBEAT_MS);
  t.mock.timers.tick(HEARTBEAT_MS);
  await world.app.refresh();
  assert.equal(sent().length, 2);
});

test('an unchanged feed costs a 304', async () => {
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
    connect: false,
  });
  world.server.etags = true;
  await world.gladys.connect();
  await world.app.ready;
  await world.createAll();
  world.advance(15 * 60_000);
  await world.app.refresh();
  const [first, second] = world.server.feedRequests();
  assert.equal(first.headers['if-none-match'], undefined);
  assert.match(second.headers['if-none-match'], /^"/);
  assert.equal(world.state(liege(world).feature('level')), 2, 'still known');
  assert.match(first.headers['user-agent'], /^gladys-meteoalarm/);
});

test('statuses: no country, no zone, unknown country feed, then fixed', async () => {
  const world = await createWorld({ config: {} });
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.noCountry,
  });
  await world.gladys.fake.configUpdated({ country: 'belgium' });
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.noTarget,
  });
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
  // No feed served for Malta by the fake server: a 404.
  await world.gladys.fake.configUpdated({ country: 'malta', zones: 'Malta' });
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.notFound,
  });
  world.server.feeds.malta = '<feed xmlns="http://www.w3.org/2005/Atom"></feed>';
  await world.gladys.fake.configUpdated({ country: 'malta', zones: 'Malta' });
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  // An unknown country value is dropped, like no country.
  await world.gladys.fake.configUpdated({ country: 'atlantis', zones: 'x' });
  assert.deepEqual(world.gladys.fake.connectionStatus.message, STATUS.noCountry);
});

test('MeteoAlarm down: one warning, states kept, one info line on recovery', async (t) => {
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  await world.createAll();
  const lines = captureLogs(t);
  world.server.failure = 503;
  for (let i = 0; i < 4; i += 1) {
    world.advance(15 * 60_000);
    await world.app.refresh();
  }
  assert.deepEqual(world.gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.unreachable,
  });
  assert.equal(world.state(liege(world).feature('level')), 2, 'the last reading still counts');
  const widget = await world.gladys.fake.widgetGet('warnings', {
    settings: { device: liege(world).device },
    language: 'en',
  });
  assert.equal(widget.data.content.components.at(-1).text, TEXT.unreachable.en);

  world.server.failure = 'network';
  world.advance(15 * 60_000);
  await world.app.refresh();
  world.server.failure = null;
  world.advance(15 * 60_000);
  await world.app.refresh();
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });

  const warnings = lines.filter((line) => line.includes('[WARN]'));
  assert.equal(warnings.length, 1, lines.join('\n'));
  assert.match(warnings[0], /feed of belgium unreadable \(HTTP 503/);
  const infos = lines.filter((line) => line.includes('[INFO]'));
  assert.equal(infos.length, 2, infos.join('\n'));
  assert.match(infos.join('\n'), /reachable/);
  assert.match(infos.join('\n'), /answers again/);
});

test('a normal cycle writes nothing at info level, and never the house location', async (t) => {
  const world = await createWorld({
    config: { ...BELGIUM, house: 'home' },
    feeds: { belgium: 'belgium.atom.xml' },
    houses: [{ id: '1', name: 'Home', selector: 'home', latitude: 50.6338, longitude: 5.5672 }],
    now: IN_FORCE,
  });
  await world.createAll();
  const lines = captureLogs(t);
  for (let i = 0; i < 20; i += 1) {
    world.advance(TICK_MS);
    await world.app.refresh();
  }
  const [device] = world.gladys.fake.discoveredDevices;
  await world.gladys.fake.poll(device);
  await world.gladys.fake.widgetGet('warnings', { settings: { device: device.external_id } });
  assert.ok(world.server.feedRequests().length >= 2, 'the feed was read again');
  assert.deepEqual(lines, [], 'no line at info level or above');

  // Even in debug, the coordinates of the house never reach the logs.
  const debug = captureLogs(t, 'debug');
  await world.gladys.fake.configUpdated({ ...BELGIUM, house: 'home' });
  world.advance(15 * 60_000);
  await world.app.refresh();
  assert.ok(debug.length > 0);
  assert.ok(!debug.some((line) => /50\.63|5\.56/.test(line)), debug.join('\n'));
});

test('one info line per user action and per configuration change', async (t) => {
  const world = await createWorld({ config: BELGIUM, feeds: { belgium: 'belgium.atom.xml' } });
  const lines = captureLogs(t);
  await world.gladys.fake.action('list_zones');
  await world.gladys.fake.configUpdated({ ...BELGIUM, zones: 'Namur' });
  assert.deepEqual(
    lines.map((line) => line.replace(/^.*\[INFO\] \[meteoalarm\] /, '')),
    ['Action list_zones for belgium', 'Configuration updated: 1 zone(s) in belgium'],
  );
});

test('List the zones: the zones known, with their code, and yours', async () => {
  const world = await createWorld({
    config: { country: 'belgium', zones: 'Liège, Gent', language: 'en' },
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  const { success, data } = await world.gladys.fake.action('list_zones');
  assert.equal(success, true);
  assert.equal(
    data.message.en,
    'Belgium: 6 warning(s) in the feed. 5 zone(s) known: Antwerpen (BE004), Hainaut (BE007), ' +
      'Liège (BE009), Luxembourg (BE010), Namur (BE011). Your zones: Liège (found), Gent (not seen yet).',
  );
  assert.match(data.message.fr, /^Belgique : 6 vigilance\(s\) dans le flux\./);
  assert.match(data.message.de, /Deine Zonen: Liège \(gefunden\), Gent \(noch nicht gesehen\)/);
  assert.match(data.message.es, /Sus zonas: Liège \(encontrada\), Gent \(aún no vista\)/);

  // The zones are remembered under /data: a quiet feed still lists them.
  await world.app.store.flush();
  const saved = JSON.parse(await readFile(join(world.dataDir, 'meteoalarm.json'), 'utf8'));
  assert.equal(Object.keys(saved.zones.belgium).length, 5);
  world.server.feeds.belgium = '<feed xmlns="http://www.w3.org/2005/Atom"></feed>';
  const quiet = await world.gladys.fake.action('list_zones');
  assert.match(quiet.data.message.en, /^Belgium: 0 warning\(s\) in the feed\. 5 zone\(s\) known/);
});

test('List the zones without a country, and with a feed down', async () => {
  const world = await createWorld({ config: {}, feeds: { belgium: 'belgium.atom.xml' } });
  const none = await world.gladys.fake.action('list_zones');
  assert.equal(none.data.message.en, 'Choose a country first, then save.');
  await world.gladys.fake.configUpdated({ country: 'belgium', zones: 'Liège', language: 'en' });
  world.server.failure = 500;
  const down = await world.gladys.fake.action('list_zones');
  assert.match(down.data.message.en, /^MeteoAlarm does not answer \(HTTP 500 on https:/);
});

test('feature names follow the language; the warning texts too, else English', async () => {
  const world = await createWorld({
    config: { ...BELGIUM, language: 'es' },
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  await world.createAll();
  const [device] = world.gladys.fake.discoveredDevices;
  assert.equal(device.features[1].name, 'Alerta por viento');
  const ids = liege(world);
  assert.match(world.state(ids.feature('summary')), /^Naranja: Viento \(jue, 15 oct, 06:00/);
  assert.equal(
    world.state(ids.feature('description')),
    'Severe gusts of wind — Gusts up to 100 km/h are expected on high ground.',
  );

  await world.gladys.fake.configUpdated({ ...BELGIUM, language: 'de' });
  await world.createAll();
  assert.equal(world.gladys.fake.discoveredDevices[0].features[0].name, 'Höchste Warnstufe');
  assert.match(world.state(ids.feature('description')), /^Schwere Sturmböen/);
});

test('another country: other devices, other feed', async () => {
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml', france: 'france.atom.xml' },
    now: '2022-12-08T01:00:00Z',
  });
  await world.gladys.fake.configUpdated({ country: 'france', zones: 'FR035', language: 'en' });
  const devices = world.gladys.fake.discoveredDevices;
  assert.deepEqual(
    devices.map((d) => [d.name, d.external_id]),
    [['MeteoAlarm Haute Savoie', world.gladys.externalIds('zone', 'france.fr035').device]],
  );
  await world.createAll();
  const ids = world.gladys.externalIds('zone', 'france.fr035');
  assert.equal(world.state(ids.feature('level_avalanches')), 1);
  assert.equal(
    world.state(ids.feature('description')),
    'Moderate avalanches warning — ' +
      'Although rather usual in this region, locally or potentially dangerous phenomena are ' +
      'expected. (such as local winds, summer thunderstorms, rising streams or high waves)',
  );
});

test('the devices are read-only', async () => {
  const world = await createWorld({ config: BELGIUM, feeds: { belgium: 'belgium.atom.xml' } });
  const [device] = world.gladys.fake.discoveredDevices;
  const ack = await world.gladys.fake.setValue(device, device.features[0], 1);
  assert.equal(ack.success, false);
});

test('a CAP document that fails is tried again after the next feed reading only', async () => {
  const world = await createWorld({
    config: { ...BELGIUM, zones: 'Liège' },
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  const rainUrl =
    'https://feeds.meteoalarm.org/api/v1/warnings/feeds-belgium/7d1c1e52-0b6e-4c58-9a1e-000000000002';
  delete world.server.caps[rainUrl];
  await world.createAll();
  const rainReads = () => world.server.capRequests().filter((r) => r.url === rainUrl).length;
  assert.equal(rainReads(), 1);
  for (let i = 0; i < 5; i += 1) {
    world.advance(TICK_MS);
    await world.app.refresh();
  }
  assert.equal(rainReads(), 1, 'not every minute');
  world.advance(15 * 60_000);
  await world.app.refresh();
  assert.equal(rainReads(), 2);
  // The rain still counts, from the feed alone.
  assert.match(world.state(liege(world).feature('summary')), /Jaune : Pluie/);
});

test('List the zones reads the feed before any zone is typed', async () => {
  const world = await createWorld({
    config: { country: 'belgium', language: 'en' },
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  assert.equal(world.gladys.fake.connectionStatus.message.en, STATUS.noTarget.en);
  const { data } = await world.gladys.fake.action('list_zones');
  assert.match(data.message.en, /^Belgium: 6 warning\(s\) in the feed\. 5 zone\(s\) known: /);
  assert.deepEqual(world.gladys.fake.discoveredDevices, []);
  // The timer does not read the feed for nothing.
  world.advance(30 * 60_000);
  await world.app.refresh();
  assert.equal(world.server.feedRequests().length, 2);
});

test('Gladys unreachable: the refresh waits, a refused state is logged once', async (t) => {
  const world = await createWorld({
    config: BELGIUM,
    feeds: { belgium: 'belgium.atom.xml' },
    now: IN_FORCE,
  });
  await world.createAll();
  const lines = captureLogs(t);
  t.mock.method(world.gladys, 'publishChangedStates', async () => {
    throw new Error('RATE_LIMIT_EXCEEDED');
  });
  for (let i = 0; i < 3; i += 1) {
    world.advance(TICK_MS);
    world.app.summaries.clear();
    await world.app.refresh();
  }
  assert.equal(lines.filter((line) => line.includes('[WARN]')).length, 1, lines.join('\n'));
  await world.gladys.disconnect();
  const requests = world.server.requests.length;
  world.advance(30 * 60_000);
  await world.app.refresh();
  assert.equal(world.server.requests.length, requests, 'nothing read while Gladys is away');
});
