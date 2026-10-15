// -----------------------------------------------------------------------------
// The few XML readings the MeteoAlarm feeds need, without a dependency.
//
// The Atom feed and the CAP documents are flat, machine-written XML: a list of
// <entry> or <info> blocks with text children, never mixed content, never the
// same element nested in itself. Pulling blocks out with a tolerant regular
// expression is enough, and keeps the image free of an XML library. Namespace
// prefixes are ignored (`cap:areaDesc` and `areaDesc` are the same element):
// some CAP producers write `<cap:info>`, MeteoAlarm writes `<info>`.
// -----------------------------------------------------------------------------

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * Decode the XML entities and unwrap CDATA sections of a text node.
 * @param {string} raw
 * @returns {string}
 */
export function decodeText(raw) {
  let result = '';
  let rest = raw;
  // CDATA content is taken as is; the text around it is entity-decoded.
  for (;;) {
    const start = rest.indexOf('<![CDATA[');
    if (start === -1) {
      return result + decodeEntities(rest);
    }
    const end = rest.indexOf(']]>', start);
    if (end === -1) {
      return result + decodeEntities(rest);
    }
    result += decodeEntities(rest.slice(0, start)) + rest.slice(start + 9, end);
    rest = rest.slice(end + 3);
  }
}

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const escapeName = (name) => name.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');

/**
 * The raw inner XML of every `<name>…</name>` element (any namespace prefix).
 * @param {string} xml
 * @param {string} name local name, e.g. 'entry'
 * @returns {string[]}
 */
export function blocks(xml, name) {
  const local = escapeName(name);
  const pattern = new RegExp(
    `<(?:[\\w.-]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${local}>`,
    'g',
  );
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

/**
 * The decoded, trimmed text of the first `<name>` element, or null.
 * @param {string} xml
 * @param {string} name
 * @returns {string|null}
 */
export function text(xml, name) {
  const [first] = blocks(xml, name);
  if (first === undefined) {
    return null;
  }
  const value = decodeText(first).trim();
  return value === '' ? null : value;
}

/**
 * The attributes of every `<name … />` (or `<name …>`) start tag.
 * @param {string} xml
 * @param {string} name
 * @returns {Record<string, string>[]}
 */
export function startTags(xml, name) {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${escapeName(name)}(\\s[^>]*?)?/?>`, 'g');
  return [...xml.matchAll(pattern)].map((match) => {
    const attributes = {};
    for (const [, key, double, single] of (match[1] ?? '').matchAll(
      /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
    )) {
      attributes[key] = decodeText(double ?? single);
    }
    return attributes;
  });
}
