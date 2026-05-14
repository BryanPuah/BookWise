/**
 * Shared editor helpers + hooks. Pulled out of RichNoteEditor.js so each
 * block component can import only what it needs without circular deps.
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

export const TYPES = [
  { key: 'quote',      label: 'Quote',      icon: '💬' },
  { key: 'insight',    label: 'Insight',    icon: '💡' },
  { key: 'question',   label: 'Question',   icon: '🔍' },
  { key: 'action',     label: 'Action',     icon: '✅' },
  { key: 'summary',    label: 'Summary',    icon: '📌' },
  { key: 'connection', label: 'Connection', icon: '🔗' },
];

export const newBlock = (type = 'paragraph', extras = {}) => ({
  id:   `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type,
  text: '',
  attribution: type === 'quote' ? '' : undefined,
  // Image-specific fields. uri is set when the user picks/captures an image.
  uri:    type === 'image' ? null : undefined,
  width:  type === 'image' ? 0 : undefined,
  height: type === 'image' ? 0 : undefined,
  ...extras,
});

// Flatten blocks → plain text (kept on note.text for backwards compat).
// Image blocks contribute their caption only (if any).
export function blocksToText(blocks) {
  return blocks
    .map(b => {
      if (b.type === 'quote')   return `"${b.text}"${b.attribution ? ` — ${b.attribution}` : ''}`;
      if (b.type === 'thought') return `💭 ${b.text}`;
      if (b.type === 'heading') return `## ${b.text}`;
      if (b.type === 'bullet')  return `• ${b.text}`;
      if (b.type === 'image')   return b.text || '';  // caption only
      return b.text;
    })
    .filter(s => s.trim())
    .join('\n\n');
}

// Markdown wrap helpers — used by both inline format and the block components
export const FORMAT_DELIMS = {
  bold:      { prefix: '**',  suffix: '**'  },
  italic:    { prefix: '*',   suffix: '*'   },
  underline: { prefix: '__',  suffix: '__'  },
  highlight: { prefix: '==',  suffix: '=='  },
};

// Inline block-type shortcuts. Typing one of these patterns at the start
// of an empty paragraph converts the block to the matching type. The
// trigger is the prefix character followed by a space — same convention
// as Notion / Craft / Bear.
export const MD_SHORTCUTS = {
  '# ': 'heading',
  '- ': 'bullet',
  '> ': 'quote',
  '" ': 'quote',
};

// Wrap the selection [start, end] in `text` with markdown delimiters.
// Returns { text, selection } so caller can update both.
export function wrapSelection(text, selection, prefix, suffix) {
  const start = selection?.start ?? text.length;
  const end   = selection?.end   ?? text.length;
  const before  = text.slice(0, start);
  const middle  = text.slice(start, end);
  const after   = text.slice(end);
  const next    = before + prefix + middle + suffix + after;
  // If something was selected, keep selection on the wrapped content
  // If nothing was selected (caret only), put cursor between the delimiters
  const newSel = middle.length > 0
    ? { start: start + prefix.length, end: start + prefix.length + middle.length }
    : { start: start + prefix.length, end: start + prefix.length };
  return { text: next, selection: newSel };
}

// ── [[wiki-link]] autocomplete hook ───────────────────────────────────
// Watches a TextInput's text + selection and, when the user is mid-typing
// inside an open `[[...` pair, exposes the current query string. The
// consumer renders a suggestion list and calls commit(label) to splice the
// chosen title into the text. Self-contained so any block can opt in.
export function useWikiLinkAutocomplete({ text, selection, allNotes, allBooks }) {
  const [openPos, setOpenPos]   = useState(-1);
  const [query, setQuery]       = useState('');
  const [isOpen, setIsOpen]     = useState(false);

  useEffect(() => {
    if (!text || !selection) { setIsOpen(false); return; }
    const cursor = selection.start ?? text.length;
    const before = text.slice(0, cursor);
    const lastOpen = before.lastIndexOf('[[');
    if (lastOpen === -1) { setIsOpen(false); return; }
    const between = text.slice(lastOpen + 2, cursor);
    // Close the picker once the user has typed `]`, `\n`, or backed up
    // before the opening brackets — anything that would mean the link is
    // already finalized or abandoned.
    if (between.includes('\n') || between.includes(']')) { setIsOpen(false); return; }
    setOpenPos(lastOpen);
    setQuery(between);
    setIsOpen(true);
  }, [text, selection?.start, selection?.end]);

  const suggestions = useMemo(() => {
    if (!isOpen) return { notes: [], books: [] };
    const q = query.trim().toLowerCase();
    const matches = (s) => (s || '').toLowerCase().includes(q);
    const notes = (allNotes || [])
      .filter(n => (n.title || '').trim() && (q === '' || matches(n.title)))
      .slice(0, 6);
    const books = (allBooks || [])
      .filter(b => q === '' || matches(b.title))
      .slice(0, 4);
    return { notes, books };
  }, [isOpen, query, allNotes, allBooks]);

  return {
    isOpen,
    query,
    suggestions,
    // The text-range (start, end) that should be replaced when committing.
    range: { from: openPos, to: (openPos === -1 ? -1 : openPos + 2 + query.length) },
    close: () => setIsOpen(false),
  };
}

// ── Block styles helper ───────────────────────────────────────────────
// Each block component is a separate React component, so each calls
// useBlkStyles to build the theme-aware StyleSheet. Keeping the body
// identical across block types is easier with this shared hook.
export function useBlkStyles() {
  const { C, F, themeVersion } = useTheme();
  return useMemo(() => StyleSheet.create({
    paragraphWrap: {
      paddingHorizontal: 20,
      marginBottom: 18,
      position: 'relative',
    },
    paragraph: {
      fontFamily: F.serif, fontSize: 15, color: C.ink,
      lineHeight: 23, minHeight: 24, padding: 0,
    },
    headingWrap: {
      paddingHorizontal: 20,
      marginTop: 8, marginBottom: 10,
      position: 'relative',
    },
    heading: {
      fontFamily: F.serif, fontSize: 20, fontWeight: '700',
      color: C.ink, lineHeight: 26, letterSpacing: -0.3,
      minHeight: 28, padding: 0,
    },
    bulletWrap: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 8, gap: 10,
      position: 'relative',
    },
    bulletDot: {
      fontFamily: F.serif, fontSize: 15,
      color: C.inkSoft, lineHeight: 23,
      width: 12, textAlign: 'center',
    },
    bulletText: {
      flex: 1, fontFamily: F.serif, fontSize: 15,
      color: C.ink, lineHeight: 23,
      minHeight: 24, padding: 0,
    },
    quoteWrap: {
      flexDirection: 'row', gap: 12,
      paddingHorizontal: 20, marginBottom: 18,
      position: 'relative',
    },
    quoteRule: {
      width: 2,
      backgroundColor: C.inkMuted,
      alignSelf: 'stretch',
      marginVertical: 4,
    },
    quoteText: {
      fontFamily: F.serifItalic, fontSize: 15,
      color: C.inkSoft, fontStyle: 'italic',
      lineHeight: 22, padding: 0, paddingTop: 2,
    },
    attribution: {
      fontFamily: F.sans, fontSize: 12,
      color: C.inkMuted, marginTop: 6, padding: 0,
    },
    thoughtWrap: {
      marginHorizontal: 20, marginBottom: 18,
      backgroundColor: C.sagePale,
      borderRadius: 10,
      borderLeftWidth: 3, borderLeftColor: C.sage,
      paddingHorizontal: 14, paddingVertical: 12,
      position: 'relative',
    },
    thoughtHeader: {
      flexDirection: 'row', alignItems: 'center',
      gap: 5, marginBottom: 6,
    },
    thoughtLabel: {
      fontFamily: F.serif, fontSize: 10, fontWeight: '700',
      color: C.inkSoft, letterSpacing: 0.8,
    },
    thoughtText: {
      fontFamily: F.serif, fontSize: 13,
      color: C.inkSoft, fontStyle: 'italic',
      lineHeight: 19, minHeight: 40, padding: 0,
    },
    removeBtn: { position: 'absolute', top: 0, right: 20, paddingTop: 2 },
    removeBtnAbs: { position: 'absolute', top: 8, right: 8 },

    imageWrap: { paddingHorizontal: 20, marginBottom: 18 },
    imageFrame: {
      width: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: C.cream,
      position: 'relative',
    },
    image: { width: '100%', height: '100%' },
    imagePlaceholder: {
      width: '100%',
      borderRadius: 12,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center',
      gap: 6,
      position: 'relative',
    },
    imagePlaceholderTxt: { fontFamily: F.serif, fontSize: 12, color: C.inkFaint },
    imageRemoveBtn: {
      position: 'absolute',
      top: 8, right: 8,
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center', justifyContent: 'center',
    },
    imageCaption: {
      fontFamily: F.sans, fontSize: 13,
      color: C.inkMuted, fontStyle: 'italic',
      marginTop: 8, padding: 0, minHeight: 18,
    },
  }), [themeVersion]);
}
