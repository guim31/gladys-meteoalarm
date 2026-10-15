// -----------------------------------------------------------------------------
// Scene triggers: "new warning" and "warning lifted".
//
// What they add to the device states: a warning is announced as soon as it
// enters the feed, often the day before it starts, with its texts and its
// period — the level features only move when it comes into force. The
// comparison is made per phenomenon, on the highest level of the warnings in
// force or announced:
//   - "new warning" when a phenomenon appears, or its level rises (yellow wind
//     then orange wind: announced twice; a lower level is no news);
//   - "warning lifted" when a phenomenon has no warning any more, expired or
//     withdrawn.
// Known warnings are saved under /data: a restart does not announce again
// what was already announced. A device seen for the first time starts from
// what is in the feed, silently: installing during a storm does not fire
// every scene at once.
// -----------------------------------------------------------------------------

import { LEVEL_KEYS } from './cap.js';
import { LEVEL_LABELS, PHENOMENON_LABELS, formatPeriod } from './i18n.js';
import { localized, startOf } from './warnings.js';

export const TRIGGER = { ISSUED: 'warning_issued', LIFTED: 'warning_lifted' };

/** Every trigger the code fires (checked against the manifest by the tests). */
export const SCENE_TRIGGER_KEYS = Object.values(TRIGGER);

// Event strings are capped at 1000 characters by the core.
const MAX_EVENT_TEXT = 1000;
const cap = (text) => (text ? String(text).slice(0, MAX_EVENT_TEXT) : null);

/**
 * The highest warning per phenomenon, among the warnings in force or
 * announced ('other' for a warning of unknown type).
 * @param {{ present: object[] }} evaluation
 * @returns {Map<string, object>}
 */
export function strongest(evaluation) {
  const byPhenomenon = new Map();
  for (const warning of evaluation.present) {
    const key = warning.phenomenon ?? 'other';
    const known = byPhenomenon.get(key);
    if (!known || warning.level > known.level) {
      byPhenomenon.set(key, warning);
    }
  }
  return byPhenomenon;
}

/**
 * Compare with the levels known before.
 * @param {Record<string, number>} previous phenomenon → level
 * @param {Map<string, object>} next from strongest()
 * @returns {{ issued: object[], lifted: Array<{ phenomenon: string, level: number }>, levels: Record<string, number> }}
 */
export function compare(previous, next) {
  const issued = [];
  const lifted = [];
  for (const [phenomenon, warning] of next) {
    if (!(phenomenon in previous) || warning.level > previous[phenomenon]) {
      issued.push(warning);
    }
  }
  for (const [phenomenon, level] of Object.entries(previous)) {
    if (!next.has(phenomenon)) {
      lifted.push({ phenomenon, level });
    }
  }
  const levels = Object.fromEntries([...next].map(([key, warning]) => [key, warning.level]));
  return { issued, lifted, levels };
}

/**
 * The data of a "new warning" event (the keys declared in the manifest).
 * @param {{ ids: object, name: string }} target
 * @param {object} warning
 * @param {string} language
 * @param {number} now
 * @param {string} [timeZone]
 */
export function issuedData(target, warning, language, now, timeZone) {
  const phenomenon = warning.phenomenon ?? 'other';
  const texts = localized(warning, language);
  const start = startOf(warning);
  return {
    device: target.ids.device,
    zone: target.name,
    level: LEVEL_KEYS[warning.level],
    level_label: LEVEL_LABELS[language][warning.level],
    phenomenon,
    phenomenon_label: PHENOMENON_LABELS[language][phenomenon],
    in_force: !start || Date.parse(start) <= now,
    period: formatPeriod(start, warning.expires, language, timeZone),
    onset: start,
    expires: warning.expires,
    headline: cap(texts?.headline ?? texts?.event ?? warning.event ?? warning.title),
    description: cap(texts?.description),
    instruction: cap(texts?.instruction),
  };
}

/** The data of a "warning lifted" event. */
export function liftedData(target, { phenomenon, level }, language) {
  return {
    device: target.ids.device,
    zone: target.name,
    level: LEVEL_KEYS[level],
    level_label: LEVEL_LABELS[language][level],
    phenomenon,
    phenomenon_label: PHENOMENON_LABELS[language][phenomenon],
  };
}
