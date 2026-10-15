// -----------------------------------------------------------------------------
// The countries MeteoAlarm publishes a feed for.
//
// `slug` is the end of the feed URL
// (https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-<slug>) and the
// value stored in the configuration: it is part of every device external id,
// so it never changes. The manifest `country` options mirror this list
// (test/manifest.test.js checks both agree).
// -----------------------------------------------------------------------------

export const COUNTRIES = [
  { slug: 'austria', en: 'Austria', fr: 'Autriche', de: 'Österreich', es: 'Austria' },
  { slug: 'belgium', en: 'Belgium', fr: 'Belgique', de: 'Belgien', es: 'Bélgica' },
  {
    slug: 'bosnia-herzegovina',
    en: 'Bosnia and Herzegovina',
    fr: 'Bosnie-Herzégovine',
    de: 'Bosnien und Herzegowina',
    es: 'Bosnia y Herzegovina',
  },
  { slug: 'bulgaria', en: 'Bulgaria', fr: 'Bulgarie', de: 'Bulgarien', es: 'Bulgaria' },
  { slug: 'croatia', en: 'Croatia', fr: 'Croatie', de: 'Kroatien', es: 'Croacia' },
  { slug: 'cyprus', en: 'Cyprus', fr: 'Chypre', de: 'Zypern', es: 'Chipre' },
  { slug: 'czechia', en: 'Czechia', fr: 'Tchéquie', de: 'Tschechien', es: 'Chequia' },
  { slug: 'denmark', en: 'Denmark', fr: 'Danemark', de: 'Dänemark', es: 'Dinamarca' },
  { slug: 'estonia', en: 'Estonia', fr: 'Estonie', de: 'Estland', es: 'Estonia' },
  { slug: 'finland', en: 'Finland', fr: 'Finlande', de: 'Finnland', es: 'Finlandia' },
  { slug: 'france', en: 'France', fr: 'France', de: 'Frankreich', es: 'Francia' },
  { slug: 'germany', en: 'Germany', fr: 'Allemagne', de: 'Deutschland', es: 'Alemania' },
  { slug: 'greece', en: 'Greece', fr: 'Grèce', de: 'Griechenland', es: 'Grecia' },
  { slug: 'hungary', en: 'Hungary', fr: 'Hongrie', de: 'Ungarn', es: 'Hungría' },
  { slug: 'iceland', en: 'Iceland', fr: 'Islande', de: 'Island', es: 'Islandia' },
  { slug: 'ireland', en: 'Ireland', fr: 'Irlande', de: 'Irland', es: 'Irlanda' },
  { slug: 'israel', en: 'Israel', fr: 'Israël', de: 'Israel', es: 'Israel' },
  { slug: 'italy', en: 'Italy', fr: 'Italie', de: 'Italien', es: 'Italia' },
  { slug: 'latvia', en: 'Latvia', fr: 'Lettonie', de: 'Lettland', es: 'Letonia' },
  { slug: 'lithuania', en: 'Lithuania', fr: 'Lituanie', de: 'Litauen', es: 'Lituania' },
  { slug: 'luxembourg', en: 'Luxembourg', fr: 'Luxembourg', de: 'Luxemburg', es: 'Luxemburgo' },
  { slug: 'malta', en: 'Malta', fr: 'Malte', de: 'Malta', es: 'Malta' },
  { slug: 'moldova', en: 'Moldova', fr: 'Moldavie', de: 'Moldau', es: 'Moldavia' },
  { slug: 'montenegro', en: 'Montenegro', fr: 'Monténégro', de: 'Montenegro', es: 'Montenegro' },
  { slug: 'netherlands', en: 'Netherlands', fr: 'Pays-Bas', de: 'Niederlande', es: 'Países Bajos' },
  { slug: 'norway', en: 'Norway', fr: 'Norvège', de: 'Norwegen', es: 'Noruega' },
  { slug: 'poland', en: 'Poland', fr: 'Pologne', de: 'Polen', es: 'Polonia' },
  { slug: 'portugal', en: 'Portugal', fr: 'Portugal', de: 'Portugal', es: 'Portugal' },
  {
    slug: 'republic-of-north-macedonia',
    en: 'North Macedonia',
    fr: 'Macédoine du Nord',
    de: 'Nordmazedonien',
    es: 'Macedonia del Norte',
  },
  { slug: 'romania', en: 'Romania', fr: 'Roumanie', de: 'Rumänien', es: 'Rumanía' },
  { slug: 'serbia', en: 'Serbia', fr: 'Serbie', de: 'Serbien', es: 'Serbia' },
  { slug: 'slovakia', en: 'Slovakia', fr: 'Slovaquie', de: 'Slowakei', es: 'Eslovaquia' },
  { slug: 'slovenia', en: 'Slovenia', fr: 'Slovénie', de: 'Slowenien', es: 'Eslovenia' },
  { slug: 'spain', en: 'Spain', fr: 'Espagne', de: 'Spanien', es: 'España' },
  { slug: 'sweden', en: 'Sweden', fr: 'Suède', de: 'Schweden', es: 'Suecia' },
  { slug: 'switzerland', en: 'Switzerland', fr: 'Suisse', de: 'Schweiz', es: 'Suiza' },
  { slug: 'ukraine', en: 'Ukraine', fr: 'Ukraine', de: 'Ukraine', es: 'Ucrania' },
  {
    slug: 'united-kingdom',
    en: 'United Kingdom',
    fr: 'Royaume-Uni',
    de: 'Vereinigtes Königreich',
    es: 'Reino Unido',
  },
];

const BY_SLUG = new Map(COUNTRIES.map((country) => [country.slug, country]));

/** @param {string} slug */
export const findCountry = (slug) => BY_SLUG.get(slug) ?? null;

/** The Atom feed of a country. */
export const feedUrl = (slug) =>
  `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-${encodeURIComponent(slug)}`;
