// -----------------------------------------------------------------------------
// The "warnings" dashboard widget: content valid for the core in every
// language and every state (the SDK's validateWidgetContent mirrors the core
// rules: vocabulary, text bounds, budget of 8 components and 2 texts).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { buildWarningsContent } from '../src/widgets.js';
import { evaluate } from '../src/warnings.js';
import { createWorld } from './helpers/world.js';

const LANGS = ['en', 'fr', 'de', 'es'];
const CONFIG = { country: 'belgium', zones: 'Liège, Hainaut', language: 'fr' };

async function contentOf(world, zone, language) {
  const device = world.gladys.externalIds('zone', `belgium.${zone}`).device;
  const ack = await world.gladys.fake.widgetGet('warnings', { settings: { device }, language });
  assert.equal(ack.success, true);
  return ack.data.content;
}

test('warnings in force and announced, in every language, as the core accepts them', async () => {
  const world = await createWorld({
    config: CONFIG,
    feeds: { belgium: 'belgium.atom.xml' },
    now: '2026-10-15T08:00:00Z',
  });
  await world.createAll();
  for (const language of LANGS) {
    const content = await contentOf(world, 'liege', language);
    assert.deepEqual(validateWidgetContent(content), [], language);
    const texts = content.components.filter((component) => component.type === 'text');
    assert.ok(texts.length <= 2);
  }
  const content = await contentOf(world, 'liege', 'en');
  const list = content.components.find((component) => component.type === 'card-list');
  assert.deepEqual(
    list.items.map((item) => [item.title, item.subtitle, item.badge]),
    [
      [
        'Orange: Wind',
        'in force · Thu 15 Oct, 06:00 → Thu 15 Oct, 21:00',
        { text: 'Orange', color: 'danger' },
      ],
      [
        'Yellow: Rain',
        'upcoming · Fri 16 Oct, 00:00 → Fri 16 Oct, 18:00',
        { text: 'Yellow', color: 'warning' },
      ],
    ],
  );
  assert.equal(
    list.items[0].description,
    'Severe gusts of wind\n\nGusts up to 100 km/h are expected on high ground.\n\n' +
      'Stay indoors and secure loose objects.',
  );
  assert.deepEqual(content.components[1].items[0], {
    label: 'Highest level',
    value: 'Orange',
    color: 'danger',
    icon: 'alert-triangle',
  });
  // The texts of the dashboard language when the issuer wrote it.
  const german = await contentOf(world, 'liege', 'de');
  assert.match(german.components[2].items[0].description, /^Schwere Sturmböen/);
});

test('a zone without warning, a widget without zone, before the first reading', async () => {
  const world = await createWorld({
    config: CONFIG,
    feeds: { belgium: 'belgium.atom.xml' },
    now: '2026-10-15T08:00:00Z',
    connect: false,
  });
  world.server.failure = 503;
  await world.gladys.connect();
  await world.app.ready;
  for (const language of LANGS) {
    const waiting = await contentOf(world, 'liege', language);
    assert.deepEqual(validateWidgetContent(waiting), []);
    const pick = (await world.gladys.fake.widgetGet('warnings', { settings: {}, language })).data
      .content;
    assert.deepEqual(validateWidgetContent(pick), []);
  }
  world.server.failure = null;
  await world.app.refresh({ force: true });
  const quiet = await contentOf(world, 'hainaut', 'fr');
  assert.deepEqual(validateWidgetContent(quiet), []);
  assert.deepEqual(quiet.components[1].items[0], {
    label: 'Niveau maximal',
    value: 'Aucune vigilance',
    color: 'success',
    icon: 'check-circle',
  });
  assert.equal(quiet.components.length, 3, 'no list');
  // An unknown language falls back to the configured one.
  const fallback = await contentOf(world, 'hainaut', 'it');
  assert.equal(fallback.components[1].items[0].label, 'Niveau maximal');
});

test('many warnings: 8 at most in the list, long texts cut to the core bounds', () => {
  const warnings = Array.from({ length: 11 }, (_, index) => ({
    level: 2 + (index % 3),
    phenomenon: ['wind', 'rain', 'fog'][index % 3],
    onset: `2026-10-15T0${index % 10}:00:00Z`,
    expires: null,
    texts: [{ language: 'en-gb', headline: 'H'.repeat(500), description: 'D'.repeat(3000) }],
  }));
  const target = { name: `MeteoAlarm ${'Very long zone name '.repeat(4)}`, ids: {} };
  for (const language of LANGS) {
    const content = buildWarningsContent({
      target,
      evaluation: evaluate(warnings, Date.parse('2026-10-15T05:30:00Z')),
      language,
      timeZone: 'UTC',
    });
    assert.deepEqual(validateWidgetContent(content), [], language);
    const list = content.components.find((component) => component.type === 'card-list');
    assert.equal(list.items.length, 8);
  }
});

test('the widget is asked to refresh when a zone changes, not at every tick', async () => {
  const world = await createWorld({
    config: CONFIG,
    feeds: { belgium: 'belgium.atom.xml' },
    now: '2026-10-15T05:58:00Z',
  });
  await world.createAll();
  const count = () => world.gladys.fake.widgetRefreshes.length;
  const before = count();
  world.advance(60_000);
  await world.app.refresh();
  assert.equal(count(), before, '05:59: nothing changed');
  world.advance(60_000);
  await world.app.refresh();
  assert.equal(count(), before + 1, '06:00: the wind comes into force');
});
