// -----------------------------------------------------------------------------
// One Gladys device per followed zone (or house), and its states.
//
// Features (external ids are forever: never rename a key):
//   level            risk/integer  highest level in force (0 green … 3 red)
//   level_<type>     risk/integer  the same, per phenomenon (wind, rain…)
//   summary          text/text     every warning in force or announced
//   description      text/text     texts of the main warning
//   start, end       text/text     its period, in the user's language
// The core front draws a risk/integer as a colored badge: 0 "no risk" green,
// 1 "low" yellow, 2 "medium" orange, 3 "high" red — exactly the MeteoAlarm
// colors, hence the value is the awareness level minus one.
//
// The devices are published with should_poll and the one-minute frequency so
// a core that polls calls onPoll (a cheap re-reading of the times, the feed is
// read every 10 or 15 minutes only); the container does not count on it and
// refreshes by itself (src/app.js, GladysAssistant/Gladys#3198).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { PHENOMENA } from './cap.js';
import { normalizeName } from './config.js';
import { NAMES, TEXT, formatDate, formatPeriod, warningLabel } from './i18n.js';
import { localized, startOf } from './warnings.js';

export const DEVICE_TYPES = { ZONE: 'zone', HOUSE: 'house' };

/** Feature keys. */
export const FEATURE = {
  LEVEL: 'level',
  SUMMARY: 'summary',
  DESCRIPTION: 'description',
  START: 'start',
  END: 'end',
  phenomenon: (phenomenon) => `level_${phenomenon}`,
};

// Gladys stores text states in a TEXT column, the dashboard shows a line or
// two: a warning description is cut here, the widget shows it in full.
const MAX_TEXT = 1000;

const clip = (text) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text);

/** "Liège" → "liege", "Haute-Savoie" → "haute-savoie": the stable part of an id. */
export const zoneSlug = (zone) => normalizeName(zone).replace(/ /g, '-');

/**
 * The devices to publish for a configuration.
 * @param {object} gladys GladysIntegration (externalIds)
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 * @param {object} [context]
 * @param {(zone: string) => string|null} [context.zoneName] the area name of a code, if known
 * @param {{ selector: string, name: string, latitude: number|null, longitude: number|null }|null} [context.house]
 * @returns {Array<{ kind: string, zone?: string, house?: object, name: string, ids: object }>}
 */
export function targetsOf(gladys, config, { zoneName = () => null, house = null } = {}) {
  if (!config.country) {
    return [];
  }
  const targets = config.zones.map((zone) => ({
    kind: DEVICE_TYPES.ZONE,
    zone,
    name: `MeteoAlarm ${zoneName(zone) ?? zone}`,
    ids: gladys.externalIds(DEVICE_TYPES.ZONE, `${config.country}.${zoneSlug(zone)}`),
  }));
  if (config.house) {
    targets.push({
      kind: DEVICE_TYPES.HOUSE,
      house,
      name: `MeteoAlarm ${house?.name ?? config.house}`,
      ids: gladys.externalIds(DEVICE_TYPES.HOUSE, `${config.country}.${config.house}`),
    });
  }
  return targets;
}

const riskFeature = (ids, key, name) => ({
  name,
  external_id: ids.feature(key),
  category: DEVICE_FEATURE_CATEGORIES.RISK,
  type: DEVICE_FEATURE_TYPES.RISK.INTEGER,
  read_only: true,
  has_feedback: false,
  keep_history: true,
  min: 0,
  max: 3,
});

// min/max are NOT NULL in t_device_feature, text features included (422 on
// "Add to Gladys" without them).
const textFeature = (ids, key, name) => ({
  name,
  external_id: ids.feature(key),
  category: DEVICE_FEATURE_CATEGORIES.TEXT,
  type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  read_only: true,
  has_feedback: false,
  keep_history: false,
  min: 0,
  max: 0,
});

/**
 * The Gladys device of a target, feature names in the configured language.
 * @param {{ name: string, ids: object }} target
 * @param {string} language
 */
export function buildDevice(target, language) {
  const names = NAMES[language];
  return {
    name: target.name,
    external_id: target.ids.device,
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: [
      riskFeature(target.ids, FEATURE.LEVEL, names.level),
      ...PHENOMENA.map((phenomenon) =>
        riskFeature(target.ids, FEATURE.phenomenon(phenomenon), names[phenomenon]),
      ),
      textFeature(target.ids, FEATURE.SUMMARY, names.summary),
      textFeature(target.ids, FEATURE.DESCRIPTION, names.description),
      textFeature(target.ids, FEATURE.START, names.start),
      textFeature(target.ids, FEATURE.END, names.end),
    ],
  };
}

/** One line per warning: "Orange: Wind (Thu 8 Dec, 16:00 → Fri 9 Dec, 12:00)". */
export function summaryText(evaluation, language, timeZone) {
  if (evaluation.present.length === 0) {
    return TEXT.none[language];
  }
  return clip(
    evaluation.present
      .map(
        (warning) =>
          `${warningLabel(warning, language)} (${formatPeriod(startOf(warning), warning.expires, language, timeZone)})`,
      )
      .join(' · '),
  );
}

/** The headline and description of a warning, in the language or the nearest one. */
export function descriptionText(warning, language) {
  const texts = localized(warning, language);
  const parts = [texts?.headline, texts?.description].filter(Boolean);
  // Some issuers repeat the headline as the description.
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);
  return clip(unique.join(' — ') || texts?.event || warning.event || warning.title || '-');
}

/**
 * The states of a device for an evaluation (see warnings.evaluate).
 * @param {{ ids: object }} target
 * @param {ReturnType<import('./warnings.js').evaluate>} evaluation
 * @param {string} language
 * @param {string} [timeZone]
 */
export function buildStates(target, evaluation, language, timeZone) {
  const { ids } = target;
  const { main } = evaluation;
  return [
    { device_feature_external_id: ids.feature(FEATURE.LEVEL), state: evaluation.level - 1 },
    ...PHENOMENA.map((phenomenon) => ({
      device_feature_external_id: ids.feature(FEATURE.phenomenon(phenomenon)),
      state: (evaluation.byPhenomenon[phenomenon] ?? 1) - 1,
    })),
    {
      device_feature_external_id: ids.feature(FEATURE.SUMMARY),
      text: summaryText(evaluation, language, timeZone),
    },
    {
      device_feature_external_id: ids.feature(FEATURE.DESCRIPTION),
      text: main ? descriptionText(main, language) : TEXT.none[language],
    },
    {
      device_feature_external_id: ids.feature(FEATURE.START),
      text: (main && formatDate(startOf(main), language, timeZone)) || TEXT.noDate[language],
    },
    {
      device_feature_external_id: ids.feature(FEATURE.END),
      text: main
        ? (formatDate(main.expires, language, timeZone) ?? TEXT.untilFurtherNotice[language])
        : TEXT.noDate[language],
    },
  ];
}
