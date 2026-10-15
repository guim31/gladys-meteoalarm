// -----------------------------------------------------------------------------
// Conformity with the Gladys core, on every device discovered from realistic
// fixtures: zones typed as names and as codes, a house, four countries, in
// every feature-name language.
//
// The table (test/fixtures/gladys-feature-table.json) is extracted from the
// core code: a category/type couple missing there shows as "undefined" or
// without icon in Gladys, a poll frequency outside its list is a 400 on
// discovery, a feature without min/max is a 422 on "Add to Gladys".
// Do not loosen this test to make it pass: fix the integration.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWorld } from './helpers/world.js';

const table = JSON.parse(
  await readFile(new URL('./fixtures/gladys-feature-table.json', import.meta.url), 'utf8'),
);

const HOUSE = { id: '1', name: 'Home', selector: 'home', latitude: 50.6338, longitude: 5.5672 };
const FEEDS = {
  belgium: 'belgium.atom.xml',
  france: 'france.atom.xml',
  ireland: 'ireland.atom.xml',
  'united-kingdom': 'united-kingdom.atom.xml',
};

const scenarios = [
  {
    label: 'Belgian zones and a house, French names',
    config: { country: 'belgium', zones: 'Liège, BE011, Gent', house: 'home', language: 'fr' },
  },
  { label: 'English names', config: { country: 'france', zones: 'Savoie, FR035', language: 'en' } },
  { label: 'German names', config: { country: 'ireland', zones: 'EI10', language: 'de' } },
  {
    label: 'Spanish names',
    config: { country: 'united-kingdom', zones: 'Orkney & Shetland', language: 'es' },
  },
];

for (const scenario of scenarios) {
  test(`every discovered device follows the Gladys rules (${scenario.label})`, async () => {
    const world = await createWorld({
      config: scenario.config,
      feeds: FEEDS,
      houses: [HOUSE],
      now: '2022-12-08T06:00:00Z',
    });
    try {
      // Added to Gladys, so the states are published too (and checked by the
      // fake Gladys like the host API does: numeric state or string text).
      await world.createAll();
      const devices = world.gladys.fake.discoveredDevices;
      assert.ok(devices.length >= 1, 'no device');
      const deviceIds = new Set();

      for (const device of devices) {
        const where = device.name;
        assert.ok(!deviceIds.has(device.external_id), `${where}: duplicate device external_id`);
        deviceIds.add(device.external_id);

        // should_poll: true if and only if poll_frequency is provided, in ms.
        if (device.poll_frequency === undefined) {
          assert.notEqual(device.should_poll, true, `${where}: should_poll without poll_frequency`);
        } else {
          assert.equal(device.should_poll, true, `${where}: poll_frequency without should_poll`);
          assert.ok(
            table.poll_frequencies_ms.includes(device.poll_frequency),
            `${where}: poll_frequency ${device.poll_frequency} is not one of ${table.poll_frequencies_ms}`,
          );
        }

        assert.ok(device.features.length > 0, `${where}: no feature`);
        const externalIds = new Set();
        const names = new Set();
        for (const feature of device.features) {
          const at = `${where} / ${feature.name}`;
          const pair = table.pairs[`${feature.category}/${feature.type}`];
          assert.ok(
            pair,
            `${at}: ${feature.category}/${feature.type} is not a couple Gladys knows`,
          );
          assert.ok(
            pair.label_en && pair.label_fr && pair.icon,
            `${at}: couple without label or icon`,
          );

          assert.equal(typeof feature.min, 'number', `${at}: min must be a number`);
          assert.equal(typeof feature.max, 'number', `${at}: max must be a number`);
          assert.ok(
            Number.isFinite(feature.min) && Number.isFinite(feature.max),
            `${at}: finite min/max`,
          );
          assert.ok(feature.min <= feature.max, `${at}: min > max`);
          assert.equal(typeof feature.read_only, 'boolean', `${at}: read_only must be a boolean`);
          assert.equal(
            typeof feature.has_feedback,
            'boolean',
            `${at}: has_feedback must be a boolean`,
          );
          if (feature.unit !== undefined) {
            assert.ok(table.units.includes(feature.unit), `${at}: unknown unit ${feature.unit}`);
          }

          assert.ok(!externalIds.has(feature.external_id), `${at}: duplicate external_id`);
          externalIds.add(feature.external_id);
          assert.ok(!names.has(feature.name), `${at}: duplicate feature name on the device`);
          names.add(feature.name);

          // Every published value stays within the bounds of its feature.
          const value = world.state(feature.external_id);
          assert.notEqual(value, undefined, `${at}: no state published`);
          if (typeof value === 'number') {
            assert.ok(
              value >= feature.min && value <= feature.max,
              `${at}: ${value} out of bounds`,
            );
          } else {
            assert.ok(value.length > 0, `${at}: empty text`);
          }
        }
      }
    } finally {
      await world.app.stop();
    }
  });
}
