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

import React from 'react';
import { Text } from 'react-native';
import { C } from '../theme';

// Regex matches in priority order: bold > italic, underline, highlight.
// Bold (**...**) is matched before italic (*...*) to avoid `*` ambiguity.
const PATTERNS = [
  { type: 'bold',      regex: /\*\*([^*]+?)\*\*/ },
  { type: 'underline', regex: /__([^_]+?)__/ },
  { type: 'highlight', regex: /==([^=]+?)==/ },
  { type: 'italic',    regex: /\*([^*]+?)\*/ },
];

const SPAN_STYLES = {
  bold:      { fontWeight: '700' },
  italic:    { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  highlight: { backgroundColor: C.amberPale },
};

// Parse a piece of text into a list of { text, style? } chunks.
// Recursive — applies one pattern at a time, calling itself on the parts
// outside the match. Stops when no patterns match.
function parseChunks(text) {
  if (!text) return [{ text: '' }];

  for (const { type, regex } of PATTERNS) {
    const match = regex.exec(text);
    if (match) {
      const before = text.slice(0, match.index);
      const inside = match[1];
      const after  = text.slice(match.index + match[0].length);
      return [
        ...parseChunks(before),
        { text: inside, style: SPAN_STYLES[type], type },
        ...parseChunks(after),
      ];
    }
  }
  // No more matches
  return [{ text }];
}

export function MarkdownText({ children, style, ...rest }) {
  const chunks = parseChunks(typeof children === 'string' ? children : '');
  return (
    <Text style={style} {...rest}>
      {chunks.map((c, i) => (
        <Text key={i} style={c.style}>{c.text}</Text>
      ))}
    </Text>
  );
}