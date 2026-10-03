/**
 * MathText
 * Renders plain-text engineering notation with real superscripts and subscripts
 * so exponents never appear as a raw caret ("^").
 *
 *   Superscripts:  x^2  R^(2/3)  e^(-λt)  S^-0.385  Q^1.852  10^{-5}  Q_AB^{(1)}
 *   Subscripts:    Q_AB  M_grade  y_{c,max}
 *
 * Rules
 *  - "^(...)"  → parentheses are grouping only and are dropped (except iteration indices like ^(1)):  R^(2/3) → R<sup>2/3</sup>
 *  - "^{...}"  → braces are grouping only; content shown verbatim (use ^{(1)} to keep parentheses)
 *  - "^-0.385" → optional sign + number or identifier (a trailing sentence period is not consumed)
 *  - "_x"      → letters/digits after an underscore become a subscript; "_{...}" for longer groups
 *  - Hyphen-minus inside a superscript is typeset as a true minus sign (−).
 */

const SUP_STYLE = { fontSize: '0.72em', lineHeight: 0, verticalAlign: '0.5em', position: 'relative' };
const SUB_STYLE = { fontSize: '0.72em', lineHeight: 0, verticalAlign: '-0.25em', position: 'relative' };

const BASE_CHAR = /[\p{L}\p{N})\]}′'″.%|]/u;
const SIMPLE_SUP = /^[-+−]?(?:\d+(?:\.\d+)?|[\p{L}][\p{L}\d]*)/u;
const SIMPLE_SUB = /^[\p{L}\d]+/u; // ASCII digits only, so a trailing ² stays outside the subscript

// Find the index of the bracket matching the opener at position `start`
const matchBracket = (s, start) => {
  const open = s[start];
  const close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
};

const toMinus = (s) => s.replace(/-/g, '−');

/**
 * Convert a string into an array of React nodes.
 * @param {string} text
 * @param {string} [keyPrefix]
 */
export const renderMath = (text, keyPrefix = 'm') => {
  if (text === null || text === undefined) return text;
  const s = String(text);
  if (!s.includes('^') && !s.includes('_')) return s;

  const out = [];
  let buf = '';
  let k = 0;
  const flush = () => {
    if (buf) { out.push(buf); buf = ''; }
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const prev = i > 0 ? s[i - 1] : '';

    if ((c === '^' || c === '_') && prev && BASE_CHAR.test(prev)) {
      const isSup = c === '^';
      const rest = s.slice(i + 1);
      let content = null;
      let consumed = 0;

      if (rest[0] === '{' || (isSup && rest[0] === '(')) {
        const end = matchBracket(s, i + 1);
        if (end > i + 1) {
          content = s.slice(i + 2, end);
          consumed = end - i;
          // Iteration indices such as Q^(1) or Q^(next) keep their parentheses
          if (isSup && rest[0] === '(' && /^(\d+|next|k|i|n|k\+1|n\+1)$/.test(content)) content = `(${content})`;
        }
      } else {
        const m = (isSup ? SIMPLE_SUP : SIMPLE_SUB).exec(rest);
        if (m) {
          content = m[0];
          consumed = m[0].length;
        }
      }

      if (content !== null && content.length > 0) {
        flush();
        const key = `${keyPrefix}-${k++}`;
        const inner = renderMath(isSup ? toMinus(content) : content, key);
        out.push(isSup
          ? <sup key={key} style={SUP_STYLE}>{inner}</sup>
          : <sub key={key} style={SUB_STYLE}>{inner}</sub>);
        i += consumed;
        continue;
      }
    }
    buf += c;
  }
  flush();
  return out.length === 1 && typeof out[0] === 'string' ? out[0] : out;
};
