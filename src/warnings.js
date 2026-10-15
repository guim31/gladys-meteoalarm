// -----------------------------------------------------------------------------
// From the feed to the warnings of one zone or one house, and from the
// warnings to what is in force at a given time. Pure functions: the clock and
// the documents are arguments, so the tests replay real feeds at their date.
// -----------------------------------------------------------------------------

import { normalizeName } from './config.js';
import { infoContains } from './geo.js';

/**
 * Whether a feed entry is a real warning: not a test or an exercise, not the
 * cancellation of an earlier one.
 */
export function isLive(entry) {
  const status = String(entry.status ?? 'Actual').toLowerCase();
  const type = String(entry.messageType ?? 'Alert').toLowerCase();
  return status === 'actual' && type !== 'cancel';
}

/** When a warning starts: its onset, else when it became effective, else when it was sent. */
export const startOf = (warning) => warning.onset ?? warning.effective ?? warning.sent ?? null;

/**
 * Whether a feed entry covers the zone the user typed: the area name (accents,
 * case and dashes ignored), its EMMA_ID or its national geocode. Exact match
 * only: "Savoie" must not catch "Haute Savoie".
 * @param {object} entry
 * @param {string} zone as typed in the configuration
 */
export function zoneMatches(entry, zone) {
  const wanted = normalizeName(zone);
  if (wanted === '') {
    return false;
  }
  if (normalizeName(entry.areaDesc) === wanted) {
    return true;
  }
  const codes = [entry.emmaId, ...entry.geocodes.map((geocode) => geocode.value)];
  return codes.some((code) => code && normalizeName(code) === wanted);
}

/** One warning from a feed entry. */
export function warningFromEntry(entry) {
  return {
    capUrl: entry.capUrl,
    identifier: entry.identifier,
    title: entry.title,
    event: entry.event,
    areaDesc: entry.areaDesc,
    level: entry.level,
    phenomenon: entry.phenomenon,
    sent: entry.sent,
    effective: entry.effective,
    onset: entry.onset,
    expires: entry.expires,
    texts: [],
  };
}

/** The key that makes the 12 entries of one warning over 12 areas one warning. */
const warningKey = (warning) =>
  `${warning.capUrl ?? warning.identifier ?? warning.title}#${warning.phenomenon}#${warning.level}`;

/** Keep one warning per CAP document, phenomenon and level. */
export function dedupe(warnings) {
  const byKey = new Map();
  for (const warning of warnings) {
    byKey.set(warningKey(warning), byKey.get(warningKey(warning)) ?? warning);
  }
  return [...byKey.values()];
}

/**
 * Complete a warning with its CAP document: the awareness level and type of
 * the issuer when given, and the texts in every language of the document.
 * The info blocks of another hazard (a CAP document may carry several) are
 * left aside.
 * @param {object} warning from warningFromEntry
 * @param {{ infos: object[] }} cap
 * @param {object[]} [only] the info blocks to use (the ones containing a house)
 */
export function enrich(warning, cap, only = cap.infos) {
  const sameHazard = only.filter(
    (info) =>
      (info.phenomenon ?? warning.phenomenon) === warning.phenomenon &&
      (info.level ?? warning.level) === warning.level,
  );
  const infos = sameHazard.length > 0 ? sameHazard : only;
  const graded = infos.find((info) => info.level !== null) ?? {};
  const typed = infos.find((info) => info.phenomenon !== null) ?? {};
  return {
    ...warning,
    level: graded.level ?? warning.level,
    phenomenon: typed.phenomenon ?? warning.phenomenon,
    texts: infos.map((info) => ({
      language: info.language,
      event: info.event,
      headline: info.headline,
      description: info.description,
      instruction: info.instruction,
    })),
  };
}

/**
 * The texts of a warning in a language: that language if the issuer wrote
 * it, else English, else the first one (the language of the country). null
 * when the CAP document could not be read.
 * @param {{ texts: object[] }} warning
 * @param {string} language 'en' | 'fr' | 'de' | 'es'
 */
export function localized(warning, language) {
  const byPrefix = (prefix) =>
    warning.texts.find((entry) => entry.language.split('-')[0] === prefix);
  return byPrefix(language) ?? byPrefix('en') ?? warning.texts[0] ?? null;
}

/**
 * The warnings of a zone, from the feed and the CAP documents already read.
 * @param {{ entries: object[] }} feed
 * @param {string} zone
 * @param {(url: string) => object|null} capOf
 */
export function zoneWarnings(feed, zone, capOf) {
  const warnings = dedupe(
    feed.entries.filter((entry) => isLive(entry) && zoneMatches(entry, zone)).map(warningFromEntry),
  );
  return warnings.map((warning) => {
    const cap = warning.capUrl ? capOf(warning.capUrl) : null;
    return cap ? enrich(warning, cap) : warning;
  });
}

/**
 * The warnings whose outlined area contains a point. Only the warnings whose
 * CAP document was read, and outlines its areas, can be placed.
 * @param {{ entries: object[] }} feed
 * @param {{ lat: number, lon: number }} point
 * @param {(url: string) => object|null} capOf
 */
export function pointWarnings(feed, point, capOf) {
  const firstEntryByUrl = new Map();
  for (const entry of feed.entries) {
    if (isLive(entry) && entry.capUrl && !firstEntryByUrl.has(entry.capUrl)) {
      firstEntryByUrl.set(entry.capUrl, entry);
    }
  }
  const warnings = [];
  for (const [url, entry] of firstEntryByUrl) {
    const cap = capOf(url);
    const containing = cap?.infos.filter((info) => infoContains(point, info)) ?? [];
    if (containing.length > 0) {
      warnings.push(enrich(warningFromEntry(entry), cap, containing));
    }
  }
  return dedupe(warnings);
}

/**
 * What is in force at `now`, and what is announced.
 * @param {object[]} warnings
 * @param {number} now epoch ms
 * @returns {{ present: object[], current: object[], upcoming: object[], level: number, byPhenomenon: Record<string, number>, main: object|null }}
 */
export function evaluate(warnings, now) {
  // A green entry ("no particular awareness", sent by a few issuers) is no
  // warning: it neither raises a level nor shows in the texts.
  const present = warnings
    .filter((warning) => warning.level >= 2)
    .filter((warning) => !warning.expires || Date.parse(warning.expires) > now)
    .sort(byStartThenLevel);
  const isCurrent = (warning) => {
    const start = startOf(warning);
    return !start || Date.parse(start) <= now;
  };
  const current = present.filter(isCurrent);
  const upcoming = present.filter((warning) => !isCurrent(warning));
  const byPhenomenon = {};
  let level = 1;
  for (const warning of current) {
    level = Math.max(level, warning.level);
    if (warning.phenomenon) {
      byPhenomenon[warning.phenomenon] = Math.max(
        byPhenomenon[warning.phenomenon] ?? 1,
        warning.level,
      );
    }
  }
  // The warning the description, start and end features tell about: the
  // highest in force, else the next one announced.
  const main =
    [...current].sort((a, b) => b.level - a.level || byStartThenLevel(a, b))[0] ??
    upcoming[0] ??
    null;
  return { present, current, upcoming, level, byPhenomenon, main };
}

function byStartThenLevel(a, b) {
  const startA = Date.parse(startOf(a) ?? 0);
  const startB = Date.parse(startOf(b) ?? 0);
  return startA - startB || b.level - a.level;
}
