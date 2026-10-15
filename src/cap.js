// -----------------------------------------------------------------------------
// Reading the MeteoAlarm feeds: the Atom feed of a country, and the CAP 1.2
// document each of its entries links to.
//
// The Atom feed lists the warnings in force or announced, one <entry> per
// warning AND per area (an orange wind warning over 12 provinces is 12
// entries pointing to the same CAP document). An entry carries the area
// (name, EMMA_ID, the national geocode), the times and a title such as
// "Yellow Avalanches Warning issued for France - Haute Savoie", always in
// English. The CAP document adds the texts, in one <info> block per language,
// the MeteoAlarm awareness parameters ("2; yellow; Moderate", "9; avalanches")
// and, for some issuers only, the outline of the areas (<polygon>, <circle>).
// -----------------------------------------------------------------------------

import { blocks, startTags, text } from './xml.js';

/**
 * The MeteoAlarm awareness types, by their number in the `awareness_type`
 * parameter. The keys name the device features and the scene filter values:
 * they never change.
 */
export const PHENOMENA = [
  'wind',
  'snow_ice',
  'thunderstorm',
  'fog',
  'high_temperature',
  'low_temperature',
  'coastal_event',
  'forest_fire',
  'avalanches',
  'rain',
  'flooding',
  'rain_flood',
];

const AWARENESS_TYPES = {
  1: 'wind',
  2: 'snow_ice',
  3: 'thunderstorm',
  4: 'fog',
  5: 'high_temperature',
  6: 'low_temperature',
  7: 'coastal_event',
  8: 'forest_fire',
  9: 'avalanches',
  10: 'rain',
  12: 'flooding',
  13: 'rain_flood',
};

// The English names found in the Atom titles and in the awareness_type
// parameter ("Snow-ice", "low-temperature", "Rain-flood"…), most specific
// first: "rain-flood" must win over "rain" and "flood".
const PHENOMENON_WORDS = [
  [/rain[\s-]*flood/, 'rain_flood'],
  [/snow|ice/, 'snow_ice'],
  [/thunder/, 'thunderstorm'],
  [/fog/, 'fog'],
  [/high[\s-]*temp|heat/, 'high_temperature'],
  [/low[\s-]*temp|cold|frost/, 'low_temperature'],
  [/coast/, 'coastal_event'],
  [/forest|fire/, 'forest_fire'],
  [/avalanch/, 'avalanches'],
  [/flood/, 'flooding'],
  [/rain/, 'rain'],
  [/wind/, 'wind'],
];

/** Awareness levels: 1 green (no particular awareness) to 4 red. */
export const LEVEL_KEYS = { 1: 'green', 2: 'yellow', 3: 'orange', 4: 'red' };
const LEVEL_BY_COLOR = { green: 1, yellow: 2, orange: 3, red: 4 };
const LEVEL_BY_SEVERITY = { minor: 1, moderate: 2, severe: 3, extreme: 4 };

/**
 * The awareness level of a warning: the `awareness_level` parameter when the
 * CAP document is known, else the color of the Atom title, else the CAP
 * severity. A warning nobody can grade counts as yellow: it is in the feed.
 * @param {{ awarenessLevel?: string|null, title?: string|null, severity?: string|null }} source
 * @returns {1|2|3|4}
 */
export function levelOf({ awarenessLevel, title, severity }) {
  const number = Number.parseInt(String(awarenessLevel ?? '').trim(), 10);
  if (number >= 1 && number <= 4) {
    return number;
  }
  const color = String(awarenessLevel ?? '').match(/\b(green|yellow|orange|red)\b/i);
  if (color) {
    return LEVEL_BY_COLOR[color[1].toLowerCase()];
  }
  const titleColor = String(title ?? '').match(/^\s*(green|yellow|orange|red)\b/i);
  if (titleColor) {
    return LEVEL_BY_COLOR[titleColor[1].toLowerCase()];
  }
  return LEVEL_BY_SEVERITY[String(severity ?? '').toLowerCase()] ?? 2;
}

/**
 * The phenomenon of a warning: the number of the `awareness_type` parameter,
 * else its name, else the words of the Atom title or of the event. null when
 * nothing matches: the warning still counts in the highest level.
 * @param {{ awarenessType?: string|null, title?: string|null, event?: string|null }} source
 * @returns {string|null}
 */
export function phenomenonOf({ awarenessType, title, event }) {
  const number = Number.parseInt(String(awarenessType ?? '').trim(), 10);
  if (AWARENESS_TYPES[number]) {
    return AWARENESS_TYPES[number];
  }
  const typeName = String(awarenessType ?? '').replace(/^\s*\d+\s*;/, '');
  // The title names the type between the color and "Warning".
  const titleType = String(title ?? '').match(
    /^\s*(?:green|yellow|orange|red)\s+(.+?)\s+warning\b/i,
  );
  for (const candidate of [typeName, titleType?.[1], event]) {
    const words = String(candidate ?? '').toLowerCase();
    if (words.trim() === '') {
      continue;
    }
    const found = PHENOMENON_WORDS.find(([pattern]) => pattern.test(words));
    if (found) {
      return found[1];
    }
  }
  return null;
}

/** A date of the feed, or null when absent or unreadable. */
function dateOf(value) {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * Parse the Atom feed of a country.
 * @param {string} xml
 * @returns {{ updated: string|null, entries: object[] }}
 */
export function parseFeed(xml) {
  if (!/<(?:[\w.-]+:)?feed[\s>]/.test(xml)) {
    throw new Error('not an Atom feed');
  }
  const entries = blocks(xml, 'entry').map((entry) => {
    const links = startTags(entry, 'link');
    const capLink = links.find((link) => link.type === 'application/cap+xml');
    // The link to the area page carries its EMMA_ID, the MeteoAlarm code of
    // the area, the same in every country (FR035, UK105, BE004…).
    const emmaId =
      links
        .map((link) => String(link.href ?? '').match(/geocode=EMMA_ID:([A-Za-z0-9_-]+)/))
        .find(Boolean)?.[1] ?? null;
    const geocodes = blocks(entry, 'geocode')
      .map((geocode) => ({ name: text(geocode, 'valueName'), value: text(geocode, 'value') }))
      .filter((geocode) => geocode.value);
    const title = text(entry, 'title');
    const event = text(entry, 'event');
    return {
      id: text(entry, 'id'),
      title,
      capUrl: capLink?.href ?? null,
      identifier: text(entry, 'identifier'),
      areaDesc: text(entry, 'areaDesc'),
      emmaId,
      geocodes,
      event,
      severity: text(entry, 'severity'),
      status: text(entry, 'status'),
      messageType: text(entry, 'message_type'),
      sent: dateOf(text(entry, 'sent')),
      effective: dateOf(text(entry, 'effective')),
      onset: dateOf(text(entry, 'onset')),
      expires: dateOf(text(entry, 'expires')),
      level: levelOf({ title, severity: text(entry, 'severity') }),
      phenomenon: phenomenonOf({ title, event }),
    };
  });
  return { updated: dateOf(text(xml.replace(/<entry[\s\S]*$/, ''), 'updated')), entries };
}

/** "lat,lon lat,lon …" → [[lat, lon], …]; null when unreadable. */
function parsePolygon(raw) {
  const points = String(raw)
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(',').map(Number))
    .filter((pair) => pair.length === 2 && pair.every(Number.isFinite));
  return points.length >= 3 ? points : null;
}

/** "lat,lon radius_km" → { lat, lon, radiusKm }; null when unreadable. */
function parseCircle(raw) {
  const [center, radius] = String(raw).trim().split(/\s+/);
  const [lat, lon] = String(center ?? '')
    .split(',')
    .map(Number);
  const radiusKm = Number(radius);
  return [lat, lon, radiusKm].every(Number.isFinite) ? { lat, lon, radiusKm } : null;
}

/** Texts of a warning: spaces and tabs squeezed, line breaks kept. */
function cleanText(value) {
  if (!value) {
    return null;
  }
  return value
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parameterOf(info, name) {
  const parameter = blocks(info, 'parameter').find(
    (block) => String(text(block, 'valueName')).toLowerCase() === name,
  );
  return parameter ? text(parameter, 'value') : null;
}

/**
 * Parse a CAP 1.2 alert.
 * @param {string} xml
 * @returns {{ identifier: string|null, status: string|null, msgType: string|null, infos: object[] }}
 */
export function parseCap(xml) {
  if (!/<(?:[\w.-]+:)?alert[\s>]/.test(xml)) {
    throw new Error('not a CAP alert');
  }
  const header = xml.replace(/<(?:[\w.-]+:)?info[\s>][\s\S]*$/, '');
  const infos = blocks(xml, 'info').map((info) => {
    const awarenessLevel = parameterOf(info, 'awareness_level');
    const awarenessType = parameterOf(info, 'awareness_type');
    const event = text(info, 'event');
    const severity = text(info, 'severity');
    return {
      language: (text(info, 'language') ?? 'en-US').toLowerCase(),
      event,
      headline: cleanText(text(info, 'headline')),
      description: cleanText(text(info, 'description')),
      instruction: cleanText(text(info, 'instruction')),
      senderName: text(info, 'senderName'),
      severity,
      effective: dateOf(text(info, 'effective')),
      onset: dateOf(text(info, 'onset')),
      expires: dateOf(text(info, 'expires')),
      level: awarenessLevel ? levelOf({ awarenessLevel, severity }) : null,
      phenomenon: awarenessType ? phenomenonOf({ awarenessType, event }) : null,
      areas: blocks(info, 'area').map((area) => ({
        desc: text(area, 'areaDesc'),
        polygons: blocks(area, 'polygon').map(parsePolygon).filter(Boolean),
        circles: blocks(area, 'circle').map(parseCircle).filter(Boolean),
        geocodes: blocks(area, 'geocode')
          .map((geocode) => text(geocode, 'value'))
          .filter(Boolean),
      })),
    };
  });
  return {
    identifier: text(header, 'identifier'),
    status: text(header, 'status'),
    msgType: text(header, 'msgType'),
    infos,
  };
}

/** Whether a CAP document outlines its areas (polygon or circle). */
export const hasGeometry = (cap) =>
  cap.infos.some((info) =>
    info.areas.some((area) => area.polygons.length > 0 || area.circles.length > 0),
  );
