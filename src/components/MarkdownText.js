/**
 * MarkdownText — minimal inline markdown renderer for note bodies.
 *
 * Supports four span styles:
 *   **bold**       → fontWeight: 700
 *   *italic*       → fontStyle: italic
 *   __underline__  → textDecorationLine: underline
 *   ==highlight==  → amberPale background
 *
 * Single-line / multi-line text both supported. Pass props that Text accepts
 * (numberOfLines, ellipsizeMode, style) and they'll be forwarded to the
 * outer wrapper Text.
 *
 * Edge cases:
 *  - Unclosed delimiters render as literal text
 *  - Nested formatting only works at one level (bold inside italic, etc.)
 *  - Markdown inside ` ` code spans is not supported (we don't have code spans)
 */

import React, { useMemo } from 'react';
import { AppText as Text } from './AppText';
import { useTheme } from '../theme';

// Regex matches in priority order: wiki-links first (so `[[Title]]` isn't
// shredded by the `**...**` pass), then bold > underline > highlight > italic.
const PATTERNS = [
  { type: 'wikilink',  regex: /\[\[([^\]\n]+?)\]\]/ },
  { type: 'bold',      regex: /\*\*([^*]+?)\*\*/ },
  { type: 'underline', regex: /__([^_]+?)__/ },
  { type: 'highlight', regex: /==([^=]+?)==/ },
  { type: 'italic',    regex: /\*([^*]+?)\*/ },
];

// Parse a piece of text into a list of { text, style? } chunks.
// Recursive — applies one pattern at a time, calling itself on the parts
// outside the match. Stops when no patterns match. `spanStyles` is passed
// in so the parser can stay pure while picking up the active theme.
function parseChunks(text, spanStyles) {
  if (!text) return [{ text: '' }];

  for (const { type, regex } of PATTERNS) {
    const match = regex.exec(text);
    if (match) {
      const before = text.slice(0, match.index);
      const inside = match[1];
      const after  = text.slice(match.index + match[0].length);
      return [
        ...parseChunks(before, spanStyles),
        { text: inside, style: spanStyles[type], type },
        ...parseChunks(after, spanStyles),
      ];
    }
  }
  // No more matches
  return [{ text }];
}

export function MarkdownText({ children, style, ...rest }) {
  const { C, F, themeVersion } = useTheme();
  const spanStyles = useMemo(() => ({
    bold:      { fontFamily: F.serif, fontWeight: '700' },
    italic:    { fontFamily: F.serifItalic, fontStyle: 'italic' },
    underline: { fontFamily: F.serif, textDecorationLine: 'underline' },
    highlight: { fontFamily: F.serif, backgroundColor: C.amberPale },
    // Wiki-link chip — rendered as a subtly tinted, accent-colored span so
    // [[Title]] references read as a link without being visually noisy.
    wikilink:  {
      fontFamily: F.serif,
      color: C.sage,
      fontWeight: '700',
      backgroundColor: C.sagePale,
    },
  }), [themeVersion]);

  const chunks = parseChunks(typeof children === 'string' ? children : '', spanStyles);
  return (
    <Text style={style} {...rest}>
      {chunks.map((c, i) => (
        <Text key={i} style={c.style}>{c.text}</Text>
      ))}
    </Text>
  );
}
