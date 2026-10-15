// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the
// `config_schema` of `gladys-assistant-integration.json`. This module provides
// the defaults and normalizes the received object, so the rest of the code
// never deals with `undefined`, strings for numbers or stray spaces.
// -----------------------------------------------------------------------------

import { findCountry } from './countries.js';

/** The languages of the Gladys interface; `fr` by default (Guilhem's choice). */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** The feed refresh intervals offered, in minutes. */
export const REFRESH_MINUTES = [10, 15];

/** At most this many zones: one device each, one feed for all of them. */
export const MAX_ZONES = 10;

// Defaults: they MUST stay consistent with the `default` values declared in
// the `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  country: '', // feed slug, see src/countries.js
  zones: '', // "Liège, BE004": area names or codes, comma-separated
  house: '', // selector of a Gladys house, located by the area outlines
  language: 'fr', // feature names, texts sent to Gladys, warning texts
  refresh_minutes: '15', // a select: its values are strings
};

/**
 * Split the zones field into distinct entries ("Liège, BE004" → two zones).
 * Commas, semicolons and line breaks separate; an entry repeated with other
 * accents or case is kept once.
 * @param {unknown} raw
 * @returns {string[]}
 */
export function parseZones(raw) {
  const seen = new Set();
  const zones = [];
  for (const part of String(raw ?? '').split(/[,;\n]+/)) {
    const zone = part.trim().replace(/\s+/g, ' ');
    const key = normalizeName(zone);
    if (key === '' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    zones.push(zone);
  }
  return zones.slice(0, MAX_ZONES);
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const country = String(raw.country ?? DEFAULT_CONFIG.country)
    .trim()
    .toLowerCase();
  const refresh = Number(raw.refresh_minutes ?? DEFAULT_CONFIG.refresh_minutes);
  return {
    country: findCountry(country) ? country : '',
    zones: parseZones(raw.zones),
    house: String(raw.house ?? DEFAULT_CONFIG.house).trim(),
    language: LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_CONFIG.language,
    refresh_minutes: REFRESH_MINUTES.includes(refresh)
      ? refresh
      : Number(DEFAULT_CONFIG.refresh_minutes),
  };
}

/**
 * Lower case, no accent, words separated by single spaces: "Liège" and
 * "liege", "Haute-Savoie" and "Haute Savoie" are the same area.
 * @param {unknown} value
 */
export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
