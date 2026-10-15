// -----------------------------------------------------------------------------
// Every text the integration sends to Gladys, in the four languages of its
// interface: feature names, the texts of the states, widget, action messages
// and connection status. German says "du", Spanish says "usted".
// The vocabulary follows the Gladys interface (weather alerts of the
// dashboard and of the scene editor: "Wetterwarnung", "Alerta meteorológica").
// -----------------------------------------------------------------------------

import { findCountry } from './countries.js';

/** Feature names, frozen when the user adds the device: kept short. */
export const NAMES = {
  en: {
    level: 'Highest warning level',
    summary: 'Current and upcoming warnings',
    description: 'Warning description',
    start: 'Warning start',
    end: 'Warning end',
    wind: 'Wind warning',
    snow_ice: 'Snow and ice warning',
    thunderstorm: 'Thunderstorm warning',
    fog: 'Fog warning',
    high_temperature: 'Heat warning',
    low_temperature: 'Cold warning',
    coastal_event: 'Coastal event warning',
    forest_fire: 'Forest fire warning',
    avalanches: 'Avalanche warning',
    rain: 'Rain warning',
    flooding: 'Flood warning',
    rain_flood: 'Rain and flood warning',
  },
  fr: {
    level: 'Niveau de vigilance maximal',
    summary: 'Vigilances en cours et à venir',
    description: 'Description de la vigilance',
    start: 'Début de la vigilance',
    end: 'Fin de la vigilance',
    wind: 'Vigilance vent',
    snow_ice: 'Vigilance neige-verglas',
    thunderstorm: 'Vigilance orages',
    fog: 'Vigilance brouillard',
    high_temperature: 'Vigilance canicule',
    low_temperature: 'Vigilance grand froid',
    coastal_event: 'Vigilance vagues-submersion',
    forest_fire: 'Vigilance feux de forêt',
    avalanches: 'Vigilance avalanches',
    rain: 'Vigilance pluie',
    flooding: 'Vigilance crues',
    rain_flood: 'Vigilance pluie-inondation',
  },
  de: {
    level: 'Höchste Warnstufe',
    summary: 'Aktuelle und kommende Warnungen',
    description: 'Beschreibung der Warnung',
    start: 'Beginn der Warnung',
    end: 'Ende der Warnung',
    wind: 'Warnstufe Wind',
    snow_ice: 'Warnstufe Schnee und Glätte',
    thunderstorm: 'Warnstufe Gewitter',
    fog: 'Warnstufe Nebel',
    high_temperature: 'Warnstufe Hitze',
    low_temperature: 'Warnstufe Kälte',
    coastal_event: 'Warnstufe Sturmflut',
    forest_fire: 'Warnstufe Waldbrand',
    avalanches: 'Warnstufe Lawinen',
    rain: 'Warnstufe Regen',
    flooding: 'Warnstufe Hochwasser',
    rain_flood: 'Warnstufe Starkregen und Hochwasser',
  },
  es: {
    level: 'Nivel máximo de alerta',
    summary: 'Alertas vigentes y próximas',
    description: 'Descripción de la alerta',
    start: 'Inicio de la alerta',
    end: 'Fin de la alerta',
    wind: 'Alerta por viento',
    snow_ice: 'Alerta por nieve y hielo',
    thunderstorm: 'Alerta por tormentas',
    fog: 'Alerta por niebla',
    high_temperature: 'Alerta por calor',
    low_temperature: 'Alerta por frío',
    coastal_event: 'Alerta por fenómenos costeros',
    forest_fire: 'Alerta por incendios forestales',
    avalanches: 'Alerta por avalanchas',
    rain: 'Alerta por lluvia',
    flooding: 'Alerta por inundaciones',
    rain_flood: 'Alerta por lluvia e inundaciones',
  },
};

/** The phenomena in running text ("Orange: Wind"). */
export const PHENOMENON_LABELS = {
  en: {
    wind: 'Wind',
    snow_ice: 'Snow and ice',
    thunderstorm: 'Thunderstorms',
    fog: 'Fog',
    high_temperature: 'Heat',
    low_temperature: 'Cold',
    coastal_event: 'Coastal event',
    forest_fire: 'Forest fire',
    avalanches: 'Avalanches',
    rain: 'Rain',
    flooding: 'Flooding',
    rain_flood: 'Rain and flooding',
    other: 'Other',
  },
  fr: {
    wind: 'Vent',
    snow_ice: 'Neige-verglas',
    thunderstorm: 'Orages',
    fog: 'Brouillard',
    high_temperature: 'Canicule',
    low_temperature: 'Grand froid',
    coastal_event: 'Vagues-submersion',
    forest_fire: 'Feux de forêt',
    avalanches: 'Avalanches',
    rain: 'Pluie',
    flooding: 'Crues',
    rain_flood: 'Pluie-inondation',
    other: 'Autre',
  },
  de: {
    wind: 'Wind',
    snow_ice: 'Schnee und Glätte',
    thunderstorm: 'Gewitter',
    fog: 'Nebel',
    high_temperature: 'Hitze',
    low_temperature: 'Kälte',
    coastal_event: 'Sturmflut',
    forest_fire: 'Waldbrand',
    avalanches: 'Lawinen',
    rain: 'Regen',
    flooding: 'Hochwasser',
    rain_flood: 'Starkregen und Hochwasser',
    other: 'Sonstiges',
  },
  es: {
    wind: 'Viento',
    snow_ice: 'Nieve y hielo',
    thunderstorm: 'Tormentas',
    fog: 'Niebla',
    high_temperature: 'Calor',
    low_temperature: 'Frío',
    coastal_event: 'Fenómenos costeros',
    forest_fire: 'Incendios forestales',
    avalanches: 'Avalanchas',
    rain: 'Lluvia',
    flooding: 'Inundaciones',
    rain_flood: 'Lluvia e inundaciones',
    other: 'Otro',
  },
};

/** The MeteoAlarm colors, by awareness level. */
export const LEVEL_LABELS = {
  en: { 1: 'Green', 2: 'Yellow', 3: 'Orange', 4: 'Red' },
  fr: { 1: 'Vert', 2: 'Jaune', 3: 'Orange', 4: 'Rouge' },
  de: { 1: 'Grün', 2: 'Gelb', 3: 'Orange', 4: 'Rot' },
  es: { 1: 'Verde', 2: 'Amarillo', 3: 'Naranja', 4: 'Rojo' },
};

/** Short texts of the states and of the widget. */
export const TEXT = {
  none: { en: 'No warning', fr: 'Aucune vigilance', de: 'Keine Warnung', es: 'Ninguna alerta' },
  noDate: { en: '-', fr: '-', de: '-', es: '-' },
  untilFurtherNotice: {
    en: 'until further notice',
    fr: "jusqu'à nouvel ordre",
    de: 'bis auf Weiteres',
    es: 'hasta nuevo aviso',
  },
  highest: { en: 'Highest level', fr: 'Niveau maximal', de: 'Höchste Stufe', es: 'Nivel máximo' },
  inForce: { en: 'in force', fr: 'en cours', de: 'aktiv', es: 'vigente' },
  upcoming: { en: 'upcoming', fr: 'à venir', de: 'angekündigt', es: 'próxima' },
  source: {
    en: 'Source: MeteoAlarm (EUMETNET)',
    fr: 'Source : MeteoAlarm (EUMETNET)',
    de: 'Quelle: MeteoAlarm (EUMETNET)',
    es: 'Fuente: MeteoAlarm (EUMETNET)',
  },
  pickDevice: {
    en: 'Choose a MeteoAlarm zone in the widget settings.',
    fr: 'Choisissez une zone MeteoAlarm dans les réglages du widget.',
    de: 'Wähle in den Widget-Einstellungen eine MeteoAlarm-Zone.',
    es: 'Elija una zona MeteoAlarm en los ajustes del widget.',
  },
  waiting: {
    en: 'Waiting for the first MeteoAlarm reading.',
    fr: 'En attente de la première lecture MeteoAlarm.',
    de: 'Warte auf die erste MeteoAlarm-Abfrage.',
    es: 'Esperando la primera lectura de MeteoAlarm.',
  },
  unreachable: {
    en: 'MeteoAlarm does not answer: the warnings shown may be out of date.',
    fr: 'MeteoAlarm ne répond pas : les vigilances affichées peuvent être périmées.',
    de: 'MeteoAlarm antwortet nicht: Die angezeigten Warnungen sind vielleicht veraltet.',
    es: 'MeteoAlarm no responde: las alertas mostradas pueden estar desactualizadas.',
  },
};

/** Connection statuses of the Configuration screen. */
export const STATUS = {
  noCountry: {
    en: 'Choose the country of your zones.',
    fr: 'Choisissez le pays de vos zones.',
    de: 'Wähle das Land deiner Zonen.',
    es: 'Elija el país de sus zonas.',
  },
  noTarget: {
    en: 'Enter at least one zone, or choose a house.',
    fr: 'Saisissez au moins une zone, ou choisissez une maison.',
    de: 'Gib mindestens eine Zone ein oder wähle ein Haus.',
    es: 'Introduzca al menos una zona o elija una vivienda.',
  },
  notFound: {
    en: 'MeteoAlarm has no feed for this country.',
    fr: "MeteoAlarm n'a pas de flux pour ce pays.",
    de: 'MeteoAlarm hat keinen Feed für dieses Land.',
    es: 'MeteoAlarm no tiene ninguna fuente para este país.',
  },
  unreachable: {
    en: 'MeteoAlarm does not answer, new attempt at the next refresh.',
    fr: 'MeteoAlarm ne répond pas, nouvel essai à la prochaine relève.',
    de: 'MeteoAlarm antwortet nicht, neuer Versuch bei der nächsten Abfrage.',
    es: 'MeteoAlarm no responde, nuevo intento en la próxima consulta.',
  },
  houseNotFound: {
    en: 'The chosen house no longer exists in Gladys: choose it again.',
    fr: "La maison choisie n'existe plus dans Gladys : choisissez-la de nouveau.",
    de: 'Das gewählte Haus gibt es in Gladys nicht mehr: Wähle es erneut.',
    es: 'La vivienda elegida ya no existe en Gladys: vuelva a elegirla.',
  },
  houseNotLocated: {
    en: 'The chosen house has no location: set it in Settings → Houses.',
    fr: "La maison choisie n'a pas de position : renseignez-la dans Paramètres → Maisons.",
    de: 'Das gewählte Haus hat keinen Standort: Lege ihn unter Einstellungen → Zuhause fest.',
    es: 'La vivienda elegida no tiene ubicación: indíquela en Configuración → Viviendas.',
  },
  noGeometry: {
    en: 'This country feed does not outline its areas: the house cannot be placed, follow zones.',
    fr: 'Le flux de ce pays ne donne pas le contour des zones : la maison ne peut être placée, suivez des zones.',
    de: 'Der Feed dieses Landes liefert keine Zonenumrisse: Das Haus lässt sich nicht verorten, verfolge Zonen.',
    es: 'La fuente de este país no da el contorno de las zonas: no se puede ubicar la vivienda, siga zonas.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
};

/** Pieces of the "List the zones" report, one table per language. */
export const ZONES_TEXT = {
  en: {
    noCountry: 'Choose a country first, then save.',
    failed: (reason) => `MeteoAlarm does not answer (${reason}).`,
    warnings: (country, count) => `${country}: ${count} warning(s) in the feed.`,
    zones: (count, list) => `${count} zone(s) known: ${list}.`,
    noZone: 'No zone known yet: a zone shows up here once it had a warning.',
    more: (count) => `and ${count} more`,
    yours: (list) => `Your zones: ${list}.`,
    found: 'found',
    notSeen: 'not seen yet',
    geometry: 'This feed outlines its areas: a house can be followed.',
    noGeometry: 'This feed does not outline its areas: follow zones, not a house.',
  },
  fr: {
    noCountry: "Choisissez d'abord un pays, puis enregistrez.",
    failed: (reason) => `MeteoAlarm ne répond pas (${reason}).`,
    warnings: (country, count) => `${country} : ${count} vigilance(s) dans le flux.`,
    zones: (count, list) => `${count} zone(s) connue(s) : ${list}.`,
    noZone: 'Aucune zone connue pour le moment : une zone apparaît ici après une vigilance.',
    more: (count) => `et ${count} autre(s)`,
    yours: (list) => `Vos zones : ${list}.`,
    found: 'trouvée',
    notSeen: 'pas encore vue',
    geometry: 'Ce flux donne le contour de ses zones : une maison peut être suivie.',
    noGeometry: 'Ce flux ne donne pas le contour de ses zones : suivez des zones, pas une maison.',
  },
  de: {
    noCountry: 'Wähle zuerst ein Land und speichere dann.',
    failed: (reason) => `MeteoAlarm antwortet nicht (${reason}).`,
    warnings: (country, count) => `${country}: ${count} Warnung(en) im Feed.`,
    zones: (count, list) => `${count} bekannte Zone(n): ${list}.`,
    noZone: 'Noch keine Zone bekannt: Eine Zone erscheint hier nach ihrer ersten Warnung.',
    more: (count) => `und ${count} weitere`,
    yours: (list) => `Deine Zonen: ${list}.`,
    found: 'gefunden',
    notSeen: 'noch nicht gesehen',
    geometry: 'Dieser Feed liefert die Umrisse seiner Zonen: Ein Haus kann verfolgt werden.',
    noGeometry: 'Dieser Feed liefert keine Umrisse: Verfolge Zonen, kein Haus.',
  },
  es: {
    noCountry: 'Elija primero un país y guarde.',
    failed: (reason) => `MeteoAlarm no responde (${reason}).`,
    warnings: (country, count) => `${country}: ${count} alerta(s) en la fuente.`,
    zones: (count, list) => `${count} zona(s) conocida(s): ${list}.`,
    noZone: 'Aún no se conoce ninguna zona: una zona aparece aquí tras su primera alerta.',
    more: (count) => `y ${count} más`,
    yours: (list) => `Sus zonas: ${list}.`,
    found: 'encontrada',
    notSeen: 'aún no vista',
    geometry: 'Esta fuente da el contorno de sus zonas: se puede seguir una vivienda.',
    noGeometry: 'Esta fuente no da el contorno de sus zonas: siga zonas, no una vivienda.',
  },
};

/** The name of a country in a language. */
export const countryName = (slug, language) => findCountry(slug)?.[language] ?? slug;

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/**
 * A date as the user reads it: "Thu 8 Dec, 16:00", in the time zone of
 * Gladys (TZ, injected by the supervisor) unless one is given.
 * @param {string|null} iso
 * @param {string} language
 * @param {string} [timeZone]
 */
export function formatDate(iso, language, timeZone) {
  if (!iso) {
    return null;
  }
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** "Thu 8 Dec, 16:00 → Fri 9 Dec, 12:00" (or "→ until further notice"). */
export function formatPeriod(start, end, language, timeZone) {
  const from = formatDate(start, language, timeZone);
  const to = formatDate(end, language, timeZone) ?? TEXT.untilFurtherNotice[language];
  return from ? `${from} → ${to}` : `→ ${to}`;
}

/** "Orange: Wind" */
export function warningLabel(warning, language) {
  const phenomenon = PHENOMENON_LABELS[language][warning.phenomenon ?? 'other'];
  const separator = language === 'fr' ? ' : ' : ': ';
  return `${LEVEL_LABELS[language][warning.level]}${separator}${phenomenon}`;
}
