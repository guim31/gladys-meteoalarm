// -----------------------------------------------------------------------------
// The integration: registers every SDK handler on a GladysIntegration (or the
// SDK's fake Gladys in the tests) and runs the refresh loop. index.js only
// creates the client and connects.
//
// Refresh: the container does not wait for the core to poll (it may never do
// it, GladysAssistant/Gladys#3198). Its own timer ticks every minute:
//   - the Atom feed of the country is read when the last reading is at least
//     one refresh period old (10 or 15 minutes, configuration);
//   - the CAP documents are read once, only those the followed zones need
//     (all of them for a house, to test their outlines);
//   - every tick re-reads the times of the known warnings, so a warning comes
//     into force and expires on the minute without any request.
// The core's onPoll, if it comes, runs the same refresh: no double reading,
// the refreshes are serialized and the feed age decides.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { hasGeometry } from './cap.js';
import { MeteoalarmClient } from './client.js';
import { normalizeConfig, normalizeName } from './config.js';
import { DEVICE_TYPES, buildDevice, buildStates, targetsOf } from './devices.js';
import { STATUS, ZONES_TEXT, countryName } from './i18n.js';
import { createIssueLog } from './issues.js';
import { Store } from './store.js';
import {
  SCENE_TRIGGER_KEYS,
  TRIGGER,
  compare,
  issuedData,
  liftedData,
  strongest,
} from './triggers.js';
import { evaluate, isLive, pointWarnings, zoneMatches, zoneWarnings } from './warnings.js';
import { WIDGET, buildWarningsContent, pickDeviceContent, waitingContent } from './widgets.js';

export { SCENE_TRIGGER_KEYS };

const logger = createLogger({ name: 'meteoalarm' });

/** The local tick: times re-read every minute, the feed when it is due. */
export const TICK_MS = 60_000;
/** A value that does not change is sent again this often (the front says "no recent value" past 48 h). */
export const HEARTBEAT_MS = 6 * 60 * 60 * 1000;
/** CAP documents read at most per refresh (a house reads them all): the rest comes next time. */
const MAX_CAP_READS = 40;
const CAP_CONCURRENCY = 3;
/** Zones remembered per country for the "List the zones" action. */
const MAX_KNOWN_ZONES = 3000;
const MAX_LISTED_ZONES = 60;

export class MeteoalarmApp {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration
   * @param {MeteoalarmClient} [options.client]
   * @param {Store} [options.store]
   * @param {boolean} [options.timers] run the minute tick (tests may turn it off)
   * @param {() => number} [options.now]
   * @param {string} [options.timeZone] for the dates in the texts (default: TZ)
   */
  constructor({ gladys, client, store, timers = true, now = () => Date.now(), timeZone }) {
    this.gladys = gladys;
    this.client = client ?? new MeteoalarmClient();
    this.store = store ?? new Store();
    this.timers = timers;
    this.now = now;
    this.timeZone = timeZone;
    this.issues = createIssueLog(logger);
    this.config = normalizeConfig();
    this.data = { zones: {}, known: {}, geometry: {} };
    this.feed = null;
    this.feedAt = null;
    this.feedFailed = false;
    this.feedLogged = false;
    this.feedError = null;
    this.house = null;
    this.houseProblem = null;
    this.status = null;
    this.summaries = new Map();
    /** CAP documents that failed, by URL: tried again after the next feed reading. */
    this.capFailedAt = new Map();
    this.chain = Promise.resolve();
    this.timer = null;
    this.stopped = false;
    this.started = false;
  }

  // --- lifecycle --------------------------------------------------------------

  /** First connection: load /data, publish the devices, read the feed. */
  async start(config) {
    this.data = { zones: {}, known: {}, geometry: {}, ...(await this.store.load()) };
    this.started = true;
    await this.reconfigure(config);
    this.schedule();
  }

  /**
   * A new configuration (or a reconnection): publish the devices again and
   * read the feed now.
   */
  async reconfigure(config) {
    if (config.country !== this.config.country) {
      this.client.clear();
      this.feed = null;
      this.feedAt = null;
    }
    this.config = config;
    await this.publishDevices();
    await this.refresh({ force: true });
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = null;
    return this.store.flush();
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.timers || this.stopped) {
      return;
    }
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.refresh().catch((err) => logger.error(`Refresh failed (${err.message})`));
      this.schedule();
    }, TICK_MS);
  }

  // --- devices ----------------------------------------------------------------

  /** The official name of a zone (typed as a name or a code), once a feed showed it. */
  zoneName(zone) {
    const wanted = normalizeName(zone);
    const known = Object.values(this.data.zones[this.config.country] ?? {});
    const match = known.find(
      (area) =>
        normalizeName(area.name) === wanted ||
        normalizeName(area.emmaId) === wanted ||
        (area.geocodes ?? []).some((code) => normalizeName(code) === wanted),
    );
    return match?.name ?? null;
  }

  targets() {
    return targetsOf(this.gladys, this.config, {
      zoneName: (zone) => this.zoneName(zone),
      house: this.house,
    });
  }

  /** The targets whose device the user added to Gladys: only they are read. */
  createdTargets() {
    const created = new Set((this.gladys.devices ?? []).map((device) => device.external_id));
    return this.targets().filter((target) => created.has(target.ids.device));
  }

  ownsDevice(externalId) {
    return this.targets().some((target) => target.ids.device === externalId);
  }

  async loadHouse() {
    this.house = null;
    this.houseProblem = null;
    if (!this.config.house) {
      return;
    }
    let houses;
    try {
      houses = await this.gladys.getHouses();
      this.issues.ok('houses', 'Houses of Gladys readable again');
    } catch (err) {
      this.issues.fail('houses', `Cannot read the houses of Gladys (${err.message})`);
      return;
    }
    const house = houses.find((candidate) => candidate.selector === this.config.house);
    if (!house) {
      this.houseProblem = 'houseNotFound';
    } else if (!Number.isFinite(house.latitude) || !Number.isFinite(house.longitude)) {
      this.house = house;
      this.houseProblem = 'houseNotLocated';
    } else {
      this.house = house;
    }
  }

  /**
   * Publish the devices of the configuration (Discovery tab).
   * @param {{ reloadHouse?: boolean }} [options]
   */
  async publishDevices({ reloadHouse = true } = {}) {
    if (reloadHouse) {
      await this.loadHouse();
    }
    const devices = this.targets().map((target) => buildDevice(target, this.config.language));
    await this.gladys.publishDiscoveredDevices(devices);
    logger.debug(`${devices.length} device(s) published`);
  }

  // --- refresh ----------------------------------------------------------------

  periodMs() {
    return this.config.refresh_minutes * 60_000;
  }

  /**
   * One refresh, serialized with the others: the feed if due (or forced), the
   * missing CAP documents, then the states, triggers and widget.
   * @param {{ force?: boolean }} [options]
   */
  refresh(options = {}) {
    const run = this.chain.then(() => this.refreshNow(options));
    this.chain = run.catch(() => {});
    return run;
  }

  async refreshNow({ force = false } = {}) {
    if (this.gladys.connected === false) {
      // Gladys restarting: nothing could be published. The reconnection
      // reads everything again.
      logger.debug('Gladys unreachable: refresh skipped');
      return;
    }
    if (!this.config.country) {
      await this.setStatus(false, 'noCountry');
      return;
    }
    const hasTargets = this.targets().length > 0;
    if (!hasTargets && !force) {
      await this.setStatus(false, 'noTarget');
      return;
    }
    // Forced (new configuration, "List the zones"): the feed is read even
    // without any zone yet — choosing the zones is what it helps with.
    const due = !this.feed || this.now() - this.feedAt >= this.periodMs();
    if (force || due) {
      await this.readFeed();
    }
    if (!this.feed || !hasTargets) {
      await this.setStatus(...this.currentStatus());
      return;
    }
    if (this.config.house && (force || due)) {
      // A house moved, or got a location: read again with the feed.
      await this.loadHouse();
    }
    await this.readCaps();
    await this.publishStates();
    await this.setStatus(...this.currentStatus());
  }

  async readFeed() {
    const { country } = this.config;
    try {
      const feed = await this.client.fetchFeed(country);
      this.feed = feed;
      this.feedAt = this.now();
      this.feedError = null;
      const live = feed.entries.filter(isLive).length;
      if (this.feedFailed || !this.feedLogged) {
        logger.info(`MeteoAlarm feed of ${country} reachable (${live} warning entries)`);
      } else {
        logger.debug(`Feed of ${country} read: ${live} warning entries`);
      }
      this.feedLogged = true;
      this.feedFailed = false;
      this.issues.ok('feed', `MeteoAlarm feed of ${country} answers again`);
      const names = this.targets().map((target) => target.name);
      if (this.rememberZones(feed)) {
        const renamed = this.targets().some((target, index) => target.name !== names[index]);
        if (renamed) {
          // A zone typed as a code now has its official name (Discovery tab).
          await this.publishDevices({ reloadHouse: false });
        }
      }
    } catch (err) {
      this.feedError = err;
      this.feedFailed = true;
      this.issues.fail('feed', `MeteoAlarm feed of ${country} unreadable (${err.message})`);
    }
  }

  /** Remember the zones of the feed: a feed only lists the zones with a warning. */
  rememberZones(feed) {
    const { country } = this.config;
    const zones = { ...(this.data.zones[country] ?? {}) };
    let changed = false;
    for (const entry of feed.entries) {
      if (!entry.areaDesc) {
        continue;
      }
      const key = entry.emmaId ?? normalizeName(entry.areaDesc);
      const area = {
        name: entry.areaDesc,
        emmaId: entry.emmaId,
        geocodes: entry.geocodes.map((geocode) => geocode.value),
      };
      if (JSON.stringify(zones[key]) !== JSON.stringify(area)) {
        zones[key] = area;
        changed = true;
      }
    }
    if (changed) {
      const kept = Object.entries(zones).slice(-MAX_KNOWN_ZONES);
      this.data.zones = { ...this.data.zones, [country]: Object.fromEntries(kept) };
      this.save();
    }
    return changed;
  }

  /** The CAP URLs the created devices need. */
  neededCaps() {
    const urls = new Set();
    const now = this.now();
    // Warnings that count: not green, not expired.
    const live = this.feed.entries.filter(
      (entry) =>
        isLive(entry) &&
        entry.capUrl &&
        entry.level >= 2 &&
        (!entry.expires || Date.parse(entry.expires) > now),
    );
    for (const target of this.createdTargets()) {
      if (target.kind === DEVICE_TYPES.HOUSE) {
        if (this.house && !this.houseProblem) {
          live.forEach((entry) => urls.add(entry.capUrl));
        }
      } else {
        live.filter((entry) => zoneMatches(entry, target.zone)).forEach((e) => urls.add(e.capUrl));
      }
    }
    return urls;
  }

  async readCaps() {
    const linked = new Set(this.feed.entries.map((entry) => entry.capUrl).filter(Boolean));
    this.client.pruneCaps(linked);
    for (const url of this.capFailedAt.keys()) {
      if (!linked.has(url)) {
        this.capFailedAt.delete(url);
      }
    }
    const missing = [...this.neededCaps()].filter(
      (url) => !this.client.hasCap(url) && this.capFailedAt.get(url) !== this.feedAt,
    );
    const batch = missing.slice(0, MAX_CAP_READS);
    let failed = null;
    for (let index = 0; index < batch.length; index += CAP_CONCURRENCY) {
      await Promise.all(
        batch.slice(index, index + CAP_CONCURRENCY).map((url) =>
          this.client.fetchCap(url).then(
            (cap) => this.noteGeometry(cap),
            (err) => {
              failed = err;
              this.capFailedAt.set(url, this.feedAt);
            },
          ),
        ),
      );
    }
    if (failed) {
      this.issues.fail('cap', `Some warning details are unreadable (${failed.message})`);
    } else if (batch.length > 0) {
      this.issues.ok('cap', 'Warning details readable again');
    }
    if (missing.length > batch.length) {
      logger.debug(`${missing.length - batch.length} warning details left for the next refresh`);
    }
  }

  noteGeometry(cap) {
    const { country } = this.config;
    const outlined = hasGeometry(cap);
    // One outlined document is enough to say the issuer outlines its areas.
    if (this.data.geometry[country] !== true && this.data.geometry[country] !== outlined) {
      this.data.geometry = { ...this.data.geometry, [country]: outlined };
      this.save();
    }
  }

  /** The warnings of a target, from the feed and the CAP documents read. */
  warningsOf(target) {
    const capOf = (url) => this.client.cachedCap(url);
    if (target.kind === DEVICE_TYPES.HOUSE) {
      if (!this.house || this.houseProblem) {
        return [];
      }
      const point = { lat: this.house.latitude, lon: this.house.longitude };
      return pointWarnings(this.feed, point, capOf);
    }
    return zoneWarnings(this.feed, target.zone, capOf);
  }

  async publishStates() {
    const now = this.now();
    const { language } = this.config;
    const states = [];
    let widgetChanged = false;
    let knownChanged = false;
    const events = [];
    for (const target of this.createdTargets()) {
      const evaluation = evaluate(this.warningsOf(target), now);
      const deviceStates = buildStates(target, evaluation, language, this.timeZone);
      states.push(...deviceStates);

      const summary = JSON.stringify(deviceStates);
      if (this.summaries.get(target.ids.device) !== summary) {
        this.summaries.set(target.ids.device, summary);
        widgetChanged = true;
      }

      const next = strongest(evaluation);
      const previous = this.data.known[target.ids.device];
      const { issued, lifted, levels } = compare(previous ?? {}, next);
      if (previous !== undefined) {
        // A device seen for the first time starts silently (see src/triggers.js).
        issued.forEach((warning) =>
          events.push([TRIGGER.ISSUED, issuedData(target, warning, language, now, this.timeZone)]),
        );
        lifted.forEach((gone) => events.push([TRIGGER.LIFTED, liftedData(target, gone, language)]));
      }
      if (JSON.stringify(previous) !== JSON.stringify(levels)) {
        this.data.known = { ...this.data.known, [target.ids.device]: levels };
        knownChanged = true;
      }
    }

    if (states.length > 0) {
      try {
        const { count } = await this.gladys.publishChangedStates(states, {
          heartbeat: HEARTBEAT_MS,
        });
        this.issues.ok('states', 'Gladys accepts the states again');
        logger.debug(`${count} state(s) sent`);
      } catch (err) {
        // Kept by the SDK for the next call (429, Gladys restarting…).
        this.issues.fail('states', `States refused by Gladys (${err.message})`);
      }
    }
    for (const [key, data] of events) {
      try {
        await this.gladys.publishSceneEvent(key, data);
        logger.debug(`Scene event ${key}: ${data.level} ${data.phenomenon} on ${data.zone}`);
      } catch (err) {
        logger.warn(`Scene event ${key} refused (${err.message})`);
      }
    }
    if (knownChanged) {
      this.save();
    }
    if (widgetChanged) {
      this.gladys.requestWidgetRefresh(WIDGET.WARNINGS);
    }
  }

  // --- status -----------------------------------------------------------------

  currentStatus() {
    if (this.targets().length === 0) {
      return [false, 'noTarget'];
    }
    if (this.feedError) {
      return [false, this.feedError.kind === 'not_found' ? 'notFound' : 'unreachable'];
    }
    if (this.config.house) {
      if (this.houseProblem) {
        return [false, this.houseProblem];
      }
      if (this.data.geometry[this.config.country] === false) {
        return [false, 'noGeometry'];
      }
    }
    return [true, null];
  }

  /** Report the status in the Configuration screen, only when it changes. */
  async setStatus(connected, messageKey) {
    const key = `${connected}:${messageKey}`;
    if (this.status === key) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(connected, messageKey ? STATUS[messageKey] : undefined);
      this.status = key;
    } catch (err) {
      logger.debug(`Connection status not sent (${err.message})`);
    }
  }

  save() {
    this.store.save(this.data);
  }

  // --- handlers ---------------------------------------------------------------

  /** The core polls one of our devices: same refresh, the feed only if due. */
  async pollFromCore(device) {
    if (!this.ownsDevice(device.external_id)) {
      logger.debug(`onPoll ignored for ${device.external_id}`);
      return;
    }
    await this.refresh();
  }

  /**
   * A device was just added: its states now (the SDK forgot what it sent for
   * it, and Gladys dropped the states of a feature it did not have yet).
   */
  async deviceCreated(device) {
    if (!this.ownsDevice(device.external_id)) {
      return;
    }
    this.summaries.delete(device.external_id);
    await this.refresh();
    this.gladys.requestWidgetRefresh(WIDGET.WARNINGS);
  }

  /** The "warnings" widget of one zone. */
  async widgetContent({ settings, language }) {
    const lang = ['en', 'fr', 'de', 'es'].includes(language) ? language : this.config.language;
    const target = this.targets().find((candidate) => candidate.ids.device === settings?.device);
    if (!target) {
      return pickDeviceContent(lang);
    }
    if (!this.feed) {
      return waitingContent(target, lang);
    }
    return buildWarningsContent({
      target,
      evaluation: evaluate(this.warningsOf(target), this.now()),
      language: lang,
      stale: this.feedError !== null,
      timeZone: this.timeZone,
    });
  }

  /** The "List the zones" action: the zones known for the country, and yours. */
  async listZones() {
    const { country, language } = this.config;
    if (!country) {
      return localizedReport((lang) => ZONES_TEXT[lang].noCountry);
    }
    logger.info(`Action list_zones for ${country}`);
    await this.refresh({ force: true });
    const known = Object.values(this.data.zones[country] ?? {}).sort((a, b) =>
      a.name.localeCompare(b.name, language),
    );
    return localizedReport((lang) => {
      const text = ZONES_TEXT[lang];
      const parts = [];
      if (this.feedError || !this.feed) {
        parts.push(text.failed(this.feedError?.message ?? 'no answer'));
      } else {
        parts.push(
          text.warnings(countryName(country, lang), this.feed.entries.filter(isLive).length),
        );
      }
      if (known.length === 0) {
        parts.push(text.noZone);
      } else {
        const listed = known
          .slice(0, MAX_LISTED_ZONES)
          .map((area) => (area.emmaId ? `${area.name} (${area.emmaId})` : area.name));
        if (known.length > MAX_LISTED_ZONES) {
          listed.push(text.more(known.length - MAX_LISTED_ZONES));
        }
        parts.push(text.zones(known.length, listed.join(', ')));
      }
      if (this.config.zones.length > 0) {
        const yours = this.config.zones.map((zone) => {
          const seen = known.some(
            (area) =>
              normalizeName(area.name) === normalizeName(zone) ||
              normalizeName(area.emmaId) === normalizeName(zone) ||
              (area.geocodes ?? []).some((code) => normalizeName(code) === normalizeName(zone)),
          );
          return `${zone} (${seen ? text.found : text.notSeen})`;
        });
        parts.push(text.yours(yours.join(', ')));
      }
      if (this.data.geometry[country] === true) {
        parts.push(text.geometry);
      } else if (this.data.geometry[country] === false) {
        parts.push(text.noGeometry);
      }
      return parts.join(' ');
    });
  }
}

/** A report built once per language. */
function localizedReport(build) {
  return Object.fromEntries(['en', 'fr', 'de', 'es'].map((lang) => [lang, build(lang)]));
}

/**
 * Register every SDK handler, before connect().
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: client, store, timers, now, timeZone
 */
export function registerHandlers(gladys, options = {}) {
  const app = new MeteoalarmApp({ gladys, ...options });

  // Resolved once the first start is over: every handler waits for it, so an
  // event arriving during the first reading is not lost.
  let resolveReady;
  app.ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  const whenReady =
    (fn) =>
    async (...args) => {
      await app.ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (app.started) {
        // A reconnection (Gladys restarted): publish again, read again.
        app.status = null;
        await app.reconfigure(config);
        return;
      }
      logger.info(
        `Following ${config.zones.length} zone(s)${config.house ? ' and a house' : ''}` +
          ` in ${config.country || '(no country)'}, every ${config.refresh_minutes} minutes`,
      );
      await app.start(config);
    } catch (err) {
      logger.error('Initialization failed', err);
      await gladys.setConnectionStatus(false, STATUS.initFailed).catch(() => {});
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(whenReady(() => app.publishDevices()));

  gladys.onConfigUpdated(
    whenReady(async (newConfig) => {
      const config = normalizeConfig(newConfig);
      logger.info(
        `Configuration updated: ${config.zones.length} zone(s)${config.house ? ' and a house' : ''}` +
          ` in ${config.country || '(no country)'}`,
      );
      app.status = null;
      await app.reconfigure(config);
    }),
  );

  // The devices are read-only: nothing to set.
  gladys.onSetValue(async (device) => {
    throw new Error(`${device.external_id} is read-only`);
  });

  gladys.onPoll(whenReady((device) => app.pollFromCore(device)));
  gladys.onDeviceCreated(whenReady((device) => app.deviceCreated(device)));
  gladys.onDeviceUpdated(whenReady((device) => app.deviceCreated(device)));

  gladys.onAction(
    'list_zones',
    whenReady(() => app.listZones()),
  );

  gladys.onWidgetGet(
    WIDGET.WARNINGS,
    whenReady((request) => app.widgetContent(request)),
  );

  return app;
}
