// -----------------------------------------------------------------------------
// HTTP client of the public MeteoAlarm feeds. No account, no key.
//
// - The Atom feed of a country is read once per refresh period (10 or 15
//   minutes), with If-None-Match / If-Modified-Since when the server gave an
//   ETag or a Last-Modified: an unchanged feed costs a 304.
// - A CAP document is read once: its URL names one version of one warning
//   (an update gets a new URL), so it is kept as long as the feed links it.
// - Only the MeteoAlarm hosts are fetched, whatever the feed links to.
// -----------------------------------------------------------------------------

import { parseCap, parseFeed } from './cap.js';
import { feedUrl } from './countries.js';

const USER_AGENT = 'gladys-meteoalarm (+https://github.com/guim31/gladys-meteoalarm)';
const TIMEOUT_MS = 20_000;
// A country feed is a few hundred KB on a stormy day; anything far bigger is
// not a feed, and the container has 256 MB.
const MAX_BYTES = 20 * 1024 * 1024;

/** Why a request failed, for the message shown to the user. */
export class FeedError extends Error {
  /**
   * @param {'not_found'|'server'|'network'|'invalid'} kind
   * @param {string} message
   */
  constructor(kind, message) {
    super(message);
    this.name = 'FeedError';
    this.kind = kind;
  }
}

/** Whether a URL is one of the MeteoAlarm feed hosts, over https. */
export function isMeteoalarmUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === 'https:' &&
      (hostname === 'meteoalarm.org' || hostname.endsWith('.meteoalarm.org'))
    );
  } catch {
    return false;
  }
}

export class MeteoalarmClient {
  /**
   * @param {object} [options]
   * @param {typeof fetch} [options.fetch]
   */
  constructor({ fetch = globalThis.fetch } = {}) {
    this.fetch = fetch;
    /** Last feed answer per country: { etag, lastModified, feed }. */
    this.feeds = new Map();
    /** Parsed CAP documents by URL. */
    this.caps = new Map();
  }

  async request(url, headers = {}) {
    let response;
    try {
      response = await this.fetch(url, {
        headers: { 'user-agent': USER_AGENT, ...headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      throw new FeedError('network', err.cause?.code ?? err.message ?? String(err));
    }
    if (response.status === 304) {
      return { status: 304 };
    }
    if (response.status === 404) {
      throw new FeedError('not_found', `HTTP 404 on ${url}`);
    }
    if (!response.ok) {
      throw new FeedError('server', `HTTP ${response.status} on ${url}`);
    }
    const length = Number(response.headers.get('content-length'));
    if (length > MAX_BYTES) {
      throw new FeedError('invalid', `answer too large (${length} bytes)`);
    }
    const body = await response.text();
    if (body.length > MAX_BYTES) {
      throw new FeedError('invalid', `answer too large (${body.length} characters)`);
    }
    return {
      status: response.status,
      body,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
  }

  /**
   * The parsed Atom feed of a country.
   * @param {string} country feed slug
   * @returns {Promise<{ updated: string|null, entries: object[] }>}
   */
  async fetchFeed(country) {
    const previous = this.feeds.get(country);
    const headers = {};
    if (previous?.etag) {
      headers['if-none-match'] = previous.etag;
    }
    if (previous?.lastModified) {
      headers['if-modified-since'] = previous.lastModified;
    }
    const answer = await this.request(feedUrl(country), headers);
    if (answer.status === 304 && previous) {
      return previous.feed;
    }
    let feed;
    try {
      feed = parseFeed(answer.body ?? '');
    } catch (err) {
      throw new FeedError('invalid', `unreadable feed (${err.message})`);
    }
    this.feeds.set(country, { etag: answer.etag, lastModified: answer.lastModified, feed });
    return feed;
  }

  /**
   * The parsed CAP document of a warning, read once.
   * @param {string} url
   */
  async fetchCap(url) {
    const cached = this.caps.get(url);
    if (cached) {
      return cached;
    }
    if (!isMeteoalarmUrl(url)) {
      throw new FeedError('invalid', `not a MeteoAlarm address: ${url}`);
    }
    const answer = await this.request(url);
    let cap;
    try {
      cap = parseCap(answer.body ?? '');
    } catch (err) {
      throw new FeedError('invalid', `unreadable CAP document (${err.message})`);
    }
    this.caps.set(url, cap);
    return cap;
  }

  /** Whether the CAP document of this URL was already read. */
  hasCap(url) {
    return this.caps.has(url);
  }

  /** The CAP document of this URL if already read, else null. */
  cachedCap(url) {
    return this.caps.get(url) ?? null;
  }

  /**
   * Forget the CAP documents the feed no longer links: a warning that left
   * the feed is over.
   * @param {Set<string>} inUse
   */
  pruneCaps(inUse) {
    for (const url of this.caps.keys()) {
      if (!inUse.has(url)) {
        this.caps.delete(url);
      }
    }
  }

  /** Forget everything (another country). */
  clear() {
    this.feeds.clear();
    this.caps.clear();
  }
}
