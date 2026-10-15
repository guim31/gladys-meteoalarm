// -----------------------------------------------------------------------------
// Every text Gladys shows exists in the four languages of its interface
// (English, French, German, Spanish): the manifest, the tables of the code,
// the documentation. German says "du", never the polite "Sie"; Spanish says
// "usted".
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { LANGUAGES } from '../src/config.js';
import { COUNTRIES } from '../src/countries.js';
import { LEVEL_LABELS, NAMES, PHENOMENON_LABELS, STATUS, TEXT, ZONES_TEXT } from '../src/i18n.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

const LANGS = ['en', 'fr', 'de', 'es'];
const POLITE_GERMAN = /(?<!\p{L})(Sie|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen)(?!\p{L})/u;
// Spanish addresses the user as "usted": no "tú" forms in the interface.
const FAMILIAR_SPANISH = /(?<!\p{L})(tú|tu|tus|te|ti|contigo)(?!\p{L})/iu;

// Upper bounds, in characters: what the Gladys interface shows without cutting.
const MAX = {
  catalog: 100,
  widgetLabel: 30,
  label: 60,
  placeholder: 60,
  description: 300,
  section: 1000,
  message: 200,
  short: 40,
  featureName: 40,
  caption: 80,
};

const sorted = (keys) => [...keys].sort();

/** Checks one multi-language object; returns its problems. */
function problems(value, path, max) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`${path} must be a multi-language object`];
  }
  const found = [];
  if (JSON.stringify(sorted(Object.keys(value))) !== JSON.stringify(sorted(LANGS))) {
    found.push(`${path} has [${Object.keys(value)}], expected exactly [${LANGS}]`);
  }
  for (const [lang, text] of Object.entries(value)) {
    found.push(...textProblems(text, `${path}.${lang}`, lang, max));
  }
  return found;
}

function textProblems(text, path, lang, max) {
  if (typeof text !== 'string' || text.trim() === '') {
    return [`${path} is empty`];
  }
  const found = [];
  if (text.length > max) {
    found.push(`${path} has ${text.length} characters (${max} at most)`);
  }
  if (lang === 'de' && POLITE_GERMAN.test(text)) {
    found.push(`${path} uses the polite form: "${text}"`);
  }
  if (lang === 'es' && FAMILIAR_SPANISH.test(text)) {
    found.push(`${path} uses the familiar form: "${text}"`);
  }
  return found;
}

/** Every multi-language object of the manifest, with its length limit. */
function manifestTexts(root) {
  const texts = [];
  const walk = (value, path, key, parent) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`, key, parent));
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }
    const isText =
      ['label', 'description', 'placeholder'].includes(key) ||
      Object.keys(value).some((child) => LANGS.includes(child));
    if (isText) {
      // The store schema caps the catalog and widget descriptions, and widget
      // labels; the core caps a section text at 1000 characters.
      let max = MAX[key] ?? MAX.label;
      if (path === 'manifest.description' || /^manifest\.widgets\[\d+\]\.description$/.test(path)) {
        max = MAX.catalog;
      } else if (/^manifest\.widgets\[\d+\]\.label$/.test(path)) {
        max = MAX.widgetLabel;
      } else if (key === 'description' && parent?.type === 'section') {
        max = MAX.section;
      }
      texts.push({ path, value, max });
      return;
    }
    for (const [child, item] of Object.entries(value)) {
      walk(item, `${path}.${child}`, child, value);
    }
  };
  walk(root, 'manifest', null, null);
  return texts;
}

test('the configuration offers the four languages', () => {
  assert.deepEqual(LANGUAGES, LANGS);
  assert.deepEqual(Object.keys(NAMES), LANGS);
});

test('every text of the manifest is in English, French, German and Spanish', () => {
  const texts = manifestTexts(manifest);
  assert.ok(texts.length >= 110, `only ${texts.length} texts found in the manifest`);
  const found = texts.flatMap(({ path, value, max }) => problems(value, path, max));
  assert.deepEqual(found, []);
});

test('the name is the same in every language, and the catalog description long enough', () => {
  assert.equal(typeof manifest.name, 'string');
  assert.ok(manifest.name.length >= 3 && manifest.name.length <= 30);
  for (const lang of LANGS) {
    assert.ok(manifest.description[lang].length >= 10, `description.${lang} is too short`);
  }
});

// Tables written one language at a time: same keys everywhere, no empty text.
function tableProblems(table, name, max, render = (value) => value) {
  const found = [];
  if (JSON.stringify(sorted(Object.keys(table))) !== JSON.stringify(sorted(LANGS))) {
    found.push(`${name} has [${Object.keys(table)}], expected exactly [${LANGS}]`);
  }
  for (const lang of LANGS) {
    const entries = table[lang] ?? {};
    if (
      JSON.stringify(sorted(Object.keys(entries))) !== JSON.stringify(sorted(Object.keys(table.en)))
    ) {
      found.push(`${name}.${lang} does not have the keys of ${name}.en`);
    }
    for (const [key, value] of Object.entries(entries)) {
      found.push(...textProblems(render(value), `${name}.${lang}.${key}`, lang, max));
    }
  }
  return found;
}

test('feature names, phenomena and levels exist in every language', () => {
  assert.deepEqual(tableProblems(NAMES, 'NAMES', MAX.featureName), []);
  assert.deepEqual(tableProblems(PHENOMENON_LABELS, 'PHENOMENON_LABELS', MAX.short), []);
  assert.deepEqual(tableProblems(LEVEL_LABELS, 'LEVEL_LABELS', 16), []);
});

test('the messages of the code exist in every language', () => {
  const found = [
    ...Object.entries(TEXT).flatMap(([key, value]) =>
      problems(
        value,
        `TEXT.${key}`,
        ['source', 'unreachable', 'waiting', 'pickDevice'].includes(key) ? MAX.caption : MAX.short,
      ),
    ),
    ...Object.entries(STATUS).flatMap(([key, value]) =>
      problems(value, `STATUS.${key}`, MAX.message),
    ),
  ];
  assert.deepEqual(found, []);
  const render = (value) => (typeof value === 'function' ? value('Belgium', 3, 'x') : value);
  assert.deepEqual(tableProblems(ZONES_TEXT, 'ZONES_TEXT', MAX.message, render), []);
});

test('the countries are named in every language', () => {
  for (const country of COUNTRIES) {
    for (const lang of LANGS) {
      assert.ok(country[lang]?.trim(), `${country.slug}.${lang}`);
    }
  }
});

// The four documentations have the same sections, in the same order.
const SECTIONS = {
  en: [
    'What it does',
    'Requirements',
    'Configuration',
    'Refresh and terms of use',
    'Devices',
    'Dashboard widget',
    'Scene triggers',
    'Scene examples',
    'Troubleshooting',
    'Limitations',
  ],
  fr: [
    'Ce que fait l’intégration',
    'Prérequis',
    'Configuration',
    'Relève et conditions d’utilisation',
    'Appareils',
    'Widget du tableau de bord',
    'Déclencheurs de scène',
    'Exemples de scènes',
    'Dépannage',
    'Limites',
  ],
  de: [
    'Was die Integration macht',
    'Voraussetzungen',
    'Konfiguration',
    'Abfrage und Nutzungsbedingungen',
    'Geräte',
    'Dashboard-Widget',
    'Szenen-Auslöser',
    'Szenen-Beispiele',
    'Fehlerbehebung',
    'Einschränkungen',
  ],
  es: [
    'Qué hace',
    'Requisitos',
    'Configuración',
    'Consulta y condiciones de uso',
    'Dispositivos',
    'Widget del panel',
    'Disparadores de escena',
    'Ejemplos de escenas',
    'Solución de problemas',
    'Limitaciones',
  ],
};

test('the four documentations have the same sections, and say what matters', async () => {
  for (const lang of LANGS) {
    const doc = await readFile(new URL(`../docs/${lang}.md`, import.meta.url), 'utf8');
    const headings = [...doc.matchAll(/^## (.+)$/gm)].map((match) => match[1].trim());
    assert.deepEqual(headings, SECTIONS[lang], `docs/${lang}.md`);
    assert.ok(doc.length >= 3000, `docs/${lang}.md is short (${doc.length})`);
    // Without the real feed: said in every language, with the trademark notice.
    assert.match(doc, /EUMETNET/);
    assert.match(doc, /feedback|retours|Rückmeldungen|comentarios/i, `docs/${lang}.md`);
    if (lang === 'de') {
      assert.doesNotMatch(doc.replace(/`[^`]*`/g, ''), POLITE_GERMAN, 'docs/de.md: polite form');
    }
  }
});

test('the guard catches a missing language, an empty text and the wrong forms', () => {
  assert.equal(problems({ en: 'Light', fr: 'Éclairage', de: 'Licht' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'Light', fr: 'Éclairage', de: '', es: 'Luz' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a', es: 'a', it: 'a' }, 'x', 60).length, 1);
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a'.repeat(61), es: 'a' }, 'x', 60).length, 1);
  for (const polite of ['Wählen Sie', 'Ihr Gerät', 'Ihre IP', 'mit Ihrem', 'Ihnen']) {
    assert.equal(problems({ en: 'a', fr: 'a', de: polite, es: 'a' }, 'x', 60).length, 1, polite);
  }
  assert.equal(problems({ en: 'a', fr: 'a', de: 'a', es: 'Elige tu zona' }, 'x', 60).length, 1);
  // Words that only contain the letters stay allowed.
  assert.deepEqual(
    problems(
      { en: 'a', fr: 'a', de: 'Siebenschläfer, ihre', es: 'Elija su zona, tutorial' },
      'x',
      60,
    ),
    [],
  );
  // A manifest text forgotten in German is found.
  const forgotten = structuredClone(manifest);
  delete forgotten.config_schema[2].placeholder.de;
  const found = manifestTexts(forgotten).flatMap(({ path, value, max }) =>
    problems(value, path, max),
  );
  assert.deepEqual(found, [
    'manifest.config_schema[2].placeholder has [en,fr,es], expected exactly [en,fr,de,es]',
  ]);
});
