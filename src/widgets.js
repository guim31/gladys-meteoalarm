// -----------------------------------------------------------------------------
// Dashboard widget "MeteoAlarm warnings" (Gladys 5.1+): the warnings of one
// zone, in force and announced, with their color, phenomenon and period; a
// tap on a warning opens its full text (the core's detail panel).
//
// Budget of the core: 8 components, 2 texts at most. This one sends a heading,
// a status line, the list and a caption — 4 components, 2 texts. The list
// shows 8 warnings at most (the `list` display cap).
// Colors: the widget vocabulary has no orange, so yellow is `warning`, orange
// and red are `danger`; the badge text says the real color.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LEVEL_LABELS, TEXT, formatPeriod, warningLabel } from './i18n.js';
import { localized, startOf } from './warnings.js';

export const WIDGET = { WARNINGS: 'warnings' };

const COLORS = {
  1: WIDGET_COLORS.SUCCESS,
  2: WIDGET_COLORS.WARNING,
  3: WIDGET_COLORS.DANGER,
  4: WIDGET_COLORS.DANGER,
};

const MAX_ITEMS = 8;
const MAX_DESCRIPTION = 2000;
const MAX_HEADING = 40;
const MAX_SUBTITLE = 60;

const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** Content when the widget has no zone, or an unknown one. */
export function pickDeviceContent(language) {
  return {
    ttl_seconds: 300,
    components: [{ type: 'text', variant: 'body', text: TEXT.pickDevice[language] }],
  };
}

/** Content before the first reading of the feed. */
export function waitingContent(target, language) {
  return {
    ttl_seconds: 60,
    components: [
      { type: 'text', variant: 'heading', text: shorten(target.name, MAX_HEADING) },
      { type: 'text', variant: 'caption', text: TEXT.waiting[language] },
    ],
  };
}

/**
 * The widget content of one zone.
 * @param {object} options
 * @param {{ name: string, ids: object }} options.target
 * @param {ReturnType<import('./warnings.js').evaluate>} options.evaluation
 * @param {string} options.language the language of the dashboard
 * @param {boolean} [options.stale] the last reading of the feed failed
 * @param {string} [options.timeZone]
 */
export function buildWarningsContent({ target, evaluation, language, stale = false, timeZone }) {
  const levels = LEVEL_LABELS[language];
  const components = [
    { type: 'text', variant: 'heading', text: shorten(target.name, MAX_HEADING) },
    {
      type: 'status',
      items: [
        {
          label: TEXT.highest[language],
          value: evaluation.present.length === 0 ? TEXT.none[language] : levels[evaluation.level],
          color: COLORS[evaluation.level],
          icon: evaluation.level > 1 ? 'alert-triangle' : 'check-circle',
        },
      ],
    },
  ];
  const isCurrent = new Set(evaluation.current);
  // In force first (highest level first), then announced, by start.
  const ordered = [
    ...[...evaluation.current].sort((a, b) => b.level - a.level),
    ...evaluation.upcoming,
  ].slice(0, MAX_ITEMS);
  if (ordered.length > 0) {
    components.push({
      type: 'card-list',
      display: 'list',
      items: ordered.map((warning) => {
        const texts = localized(warning, language);
        const description = [texts?.headline, texts?.description, texts?.instruction]
          .filter(Boolean)
          .filter((part, index, parts) => parts.indexOf(part) === index)
          .join('\n\n');
        const when = isCurrent.has(warning) ? TEXT.inForce[language] : TEXT.upcoming[language];
        return {
          title: warningLabel(warning, language),
          subtitle: shorten(
            `${when} · ${formatPeriod(startOf(warning), warning.expires, language, timeZone)}`,
            MAX_SUBTITLE,
          ),
          badge: { text: levels[warning.level], color: COLORS[warning.level] },
          ...(description ? { description: shorten(description, MAX_DESCRIPTION) } : {}),
        };
      }),
    });
  }
  components.push({
    type: 'text',
    variant: 'caption',
    text: stale ? TEXT.unreachable[language] : TEXT.source[language],
  });
  return { ttl_seconds: 300, components };
}
