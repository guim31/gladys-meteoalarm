// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake MeteoAlarm server
// serving the fixture feeds, a temporary /data, and the integration wired on
// top through registerHandlers — with a clock the tests move.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { MeteoalarmClient } from '../../src/client.js';
import { Store } from '../../src/store.js';

// LOG_LEVEL=debug npm test shows the integration logs.
process.env.LOG_LEVEL ??= 'silent';

const FIXTURES = new URL('../fixtures/feeds/', import.meta.url);
export const fixture = (name) => readFileSync(new URL(name, FIXTURES), 'utf8');

const FEED_PREFIX = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-';

/** The CAP documents of the fixtures, by the URL the feeds link them under. */
export const CAPS = {
  'https://feeds.meteoalarm.org/api/v1/warnings/feeds-france/04d497d4-d114-4d6b-93ba-13fa7ed577fe':
    'france-avalanches.cap.xml',
  'https://feeds.meteoalarm.org/api/v1/warnings/feeds-united-kingdom/a4647d38-40ea-4c01-b874-4e2b3df383b9':
    'united-kingdom-ice.cap.xml',
  'https://feeds.meteoalarm.org/api/v1/warnings/feeds-ireland/558830a2-74a1-402a-915c-ab365ec68d25':
    'ireland-low-temperature.cap.xml',
  'https://feeds.meteoalarm.org/api/v1/warnings/feeds-belgium/7d1c1e52-0b6e-4c58-9a1e-000000000001':
    'belgium-wind.cap.xml',
  'https://feeds.meteoalarm.org/api/v1/warnings/feeds-belgium/7d1c1e52-0b6e-4c58-9a1e-000000000002':
    'belgium-rain.cap.xml',
};

/**
 * A fake MeteoAlarm server: the feed of each country from `feeds` (name of a
 * fixture file, or raw XML), the CAP documents of CAPS. Every request is
 * recorded in `requests`.
 */
export function createFakeMeteoalarm({ feeds = {}, caps = CAPS } = {}) {
  const server = {
    feeds: { ...feeds },
    caps: { ...caps },
    requests: [],
    /** Status forced for every request (e.g. 503), or a thrown network error. */
    failure: null,
    /** Answer the feeds with an ETag, and 304 when the client sends it back. */
    etags: false,
    async fetch(url, options = {}) {
      server.requests.push({ url, headers: options.headers ?? {} });
      if (server.failure === 'network') {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
      }
      if (server.failure) {
        return new Response('down', { status: server.failure });
      }
      let body;
      if (url.startsWith(FEED_PREFIX)) {
        body = server.feeds[url.slice(FEED_PREFIX.length)];
      } else {
        body = server.caps[url];
      }
      if (body === undefined) {
        return new Response('not found', { status: 404 });
      }
      const xml = body.trimStart().startsWith('<') ? body : fixture(body);
      const headers = { 'content-type': 'application/xml' };
      if (server.etags && url.startsWith(FEED_PREFIX)) {
        const etag = `"${xml.length}-${xml.slice(-40).replace(/\W/g, '')}"`;
        if (options.headers?.['if-none-match'] === etag) {
          return new Response(null, { status: 304 });
        }
        headers.etag = etag;
      }
      return new Response(xml, { status: 200, headers });
    },
    feedRequests: () => server.requests.filter((request) => request.url.startsWith(FEED_PREFIX)),
    capRequests: () => server.requests.filter((request) => !request.url.startsWith(FEED_PREFIX)),
  };
  return server;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object} [options.feeds] country → fixture name or XML
 * @param {string|number} [options.now] the clock at start (ISO or epoch ms)
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses]
 * @param {string} [options.dataDir]
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 */
export async function createWorld({
  config = {},
  feeds = {},
  now = '2022-12-08T01:00:00Z',
  devices = [],
  houses = [],
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-meteoalarm-')),
  connect = true,
  timers = false,
} = {}) {
  const clock = { now: typeof now === 'number' ? now : Date.parse(now) };
  const server = createFakeMeteoalarm({ feeds });
  const gladys = createFakeGladys({ config, devices, houses });
  const app = registerHandlers(gladys, {
    client: new MeteoalarmClient({ fetch: server.fetch }),
    store: new Store(dataDir),
    timers,
    now: () => clock.now,
    timeZone: 'UTC',
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  const world = {
    gladys,
    server,
    app,
    clock,
    dataDir,
    /** Move the clock. */
    advance(ms) {
      clock.now += ms;
    },
    /** Add every discovered device to Gladys, as the user would. */
    async createAll() {
      for (const device of gladys.fake.discoveredDevices) {
        await gladys.fake.deviceCreated(device);
      }
    },
    state: (externalId) => gladys.fake.lastState(externalId),
  };
  return world;
}
