/**
 * RichNoteEditor — Block-based note editor.
 *
 * Matches Figma "Reflections on Meditations" design:
 *  - Top app bar (back + title + save)
 *  - Toolbar with block-type buttons
 *  - Serif title field
 *  - Tag row (note types — multiple selectable)
 *  - Block-based body: paragraph / quote / thought blocks
 *
 * Data model:
 *  - title: string (optional)
 *  - blocks: [{ id, type: 'paragraph'|'quote'|'thought', text, attribution? }]
 *  - types: string[] (note types — Quote/Insight/Question/Action/Summary/Connection)
 *  - bookId, bookTitle, page, chapter — preserved from existing schema
 *
 * Backwards-compatible: when a note is saved, we also populate `text` (a
 * concatenated string of all block text) and the primary `type` (first
 * selected type) so the existing NotesScreen list view keeps working.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { BookCover } from './BookCover';
import { AppHeader } from './AppHeader';
import { useTheme } from '../theme';

// ── Note type definitions ─────────────────────────────────────────────
const TYPES = [
  { key: 'quote',      label: 'Quote',      icon: '💬' },
  { key: 'insight',    label: 'Insight',    icon: '💡' },
  { key: 'question',   label: 'Question',   icon: '🔍' },
  { key: 'action',     label: 'Action',     icon: '✅' },
  { key: 'summary',    label: 'Summary',    icon: '📌' },
  { key: 'connection', label: 'Connection', icon: '🔗' },
];

// ── Helpers ────────────────────────────────────────────────────────────
const newBlock = (type = 'paragraph', extras = {}) => ({
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
function blocksToText(blocks) {
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

// ── Toolbar ────────────────────────────────────────────────────────────
function Toolbar({ onInsert, onPickFromGallery, onTakePhoto }) {
  const { C, F, themeVersion } = useTheme();
  const tb = useMemo(() => StyleSheet.create({
    scrollContent: {
      paddingHorizontal: 20,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.white,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 4,
      paddingVertical: 4,
      gap: 0,
    },
    btn: {
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 30,
    },
    btnTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontStyle: 'italic' },
    btnTxtBold: { fontStyle: 'normal', fontWeight: '700', fontSize: 15 },
    divider: { width: 1, height: 14, backgroundColor: C.border, opacity: 0.7 },
    sectionDivider: { width: 1, height: 20, backgroundColor: C.borderMid, marginHorizontal: 4 },
    highlightSwatch: {
      backgroundColor: C.amberPale,
      paddingHorizontal: 5,
      borderRadius: 3,
    },
  }), [themeVersion]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tb.scrollContent}
      keyboardShouldPersistTaps="always"
    >
      <View style={tb.bar}>
      {/* Media buttons */}
      <TouchableOpacity style={tb.btn} onPress={onPickFromGallery} activeOpacity={0.6}>
        <Ionicons name="image-outline" size={17} color={C.inkSoft} />
      </TouchableOpacity>
      <View style={tb.divider} />
      <TouchableOpacity style={tb.btn} onPress={onTakePhoto} activeOpacity={0.6}>
        <Ionicons name="camera-outline" size={18} color={C.inkSoft} />
      </TouchableOpacity>

      <View style={tb.sectionDivider} />

      {/* Block-type buttons */}
      <TouchableOpacity style={tb.btn} onPress={() => onInsert('heading')} activeOpacity={0.6}>
        <Text style={[tb.btnTxt, tb.btnTxtBold]}>H</Text>
      </TouchableOpacity>
      <View style={tb.divider} />
      <TouchableOpacity style={tb.btn} onPress={() => onInsert('bullet')} activeOpacity={0.6}>
        <Ionicons name="list-outline" size={17} color={C.inkSoft} />
      </TouchableOpacity>
      <View style={tb.divider} />
      <TouchableOpacity style={tb.btn} onPress={() => onInsert('quote')} activeOpacity={0.6}>
        <Text style={tb.btnTxt}>99</Text>
      </TouchableOpacity>
      <View style={tb.divider} />
      <TouchableOpacity style={tb.btn} onPress={() => onInsert('thought')} activeOpacity={0.6}>
        <Ionicons name="bulb-outline" size={16} color={C.inkSoft} />
      </TouchableOpacity>
      <View style={tb.divider} />
      <TouchableOpacity style={tb.btn} onPress={() => onInsert('paragraph')} activeOpacity={0.6}>
        <Ionicons name="text-outline" size={16} color={C.inkSoft} />
      </TouchableOpacity>
    </View>
    </ScrollView>
  );
}

// ── Tag row ────────────────────────────────────────────────────────────
function TagRow({ selectedTypes, onToggle }) {
  const { C, F, themeVersion } = useTheme();
  const tg = useMemo(() => StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 20,
      marginTop: 2,
      marginBottom: 10,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.amberPale,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    chipTxt: { fontFamily: F.serif, fontSize: 12, color: C.ink, fontWeight: '600' },
    addBtn: { paddingHorizontal: 8, paddingVertical: 4 },
    addBtnTxt: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, fontWeight: '500' },
    pickerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    pickerCard: {
      width: '100%',
      maxWidth: 280,
      backgroundColor: C.paper,
      borderRadius: 16,
      paddingVertical: 8,
      shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18, shadowRadius: 24, elevation: 16,
    },
    pickerTitle: {
      fontFamily: F.sans,
      fontSize: 10, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1,
      paddingHorizontal: 16, paddingVertical: 10,
    },
    pickerRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingHorizontal: 16, paddingVertical: 13,
    },
    pickerIcon: { fontSize: 16 },
    pickerLabel: { fontFamily: F.serif, fontSize: 15, color: C.ink, fontWeight: '500' },
  }), [themeVersion]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const unselected = TYPES.filter(t => !selectedTypes.includes(t.key));

  return (
    <View style={tg.wrap}>
      <Ionicons name="pricetag-outline" size={13} color={C.inkMuted} />

      {selectedTypes.map(key => {
        const meta = TYPES.find(t => t.key === key);
        if (!meta) return null;
        return (
          <View key={key} style={tg.chip}>
            <Text style={tg.chipTxt}>{meta.label}</Text>
            <TouchableOpacity
              onPress={() => onToggle(key)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Ionicons name="close" size={11} color={C.inkMuted} />
            </TouchableOpacity>
          </View>
        );
      })}

      {unselected.length > 0 && (
        <TouchableOpacity
          style={tg.addBtn}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.6}
        >
          <Text style={tg.addBtnTxt}>+ Add Tag</Text>
        </TouchableOpacity>
      )}

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={tg.pickerBackdrop} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={tg.pickerCard}>
            <Text style={tg.pickerTitle}>ADD TAG</Text>
            {unselected.map(t => (
              <TouchableOpacity
                key={t.key}
                style={tg.pickerRow}
                onPress={() => { onToggle(t.key); setPickerOpen(false); }}
                activeOpacity={0.6}
              >
                <Text style={tg.pickerIcon}>{t.icon}</Text>
                <Text style={tg.pickerLabel}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}


// Markdown wrap helpers — used by both inline format and the block components
const FORMAT_DELIMS = {
  bold:      { prefix: '**',  suffix: '**'  },
  italic:    { prefix: '*',   suffix: '*'   },
  underline: { prefix: '__',  suffix: '__'  },
  highlight: { prefix: '==',  suffix: '=='  },
};

// Inline block-type shortcuts. Typing one of these patterns at the start
// of an empty paragraph converts the block to the matching type. The
// trigger is the prefix character followed by a space — same convention
// as Notion / Craft / Bear.
const MD_SHORTCUTS = {
  '# ': 'heading',
  '- ': 'bullet',
  '> ': 'quote',
  '" ': 'quote',
};

// Wrap the selection [start, end] in `text` with markdown delimiters.
// Returns { text, selection } so caller can update both.
function wrapSelection(text, selection, prefix, suffix) {
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

// ── Block styles helper ───────────────────────────────────────────────
// Each block component is a separate React component, so each calls
// useBlkStyles to build the theme-aware StyleSheet. Keeping the body
// identical across block types is easier with this shared hook.
function useBlkStyles() {
  const { C, F, themeVersion } = useTheme();
  return useMemo(() => StyleSheet.create({
    paragraphWrap: {
      paddingHorizontal: 20,
      marginBottom: 18,
      position: 'relative',
    },
    paragraph: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.ink,
      lineHeight: 23,
      minHeight: 24,
      padding: 0,
    },
    headingWrap: {
      paddingHorizontal: 20,
      marginTop: 8,
      marginBottom: 10,
      position: 'relative',
    },
    heading: {
      fontFamily: F.serif,
      fontSize: 20,
      fontWeight: '700',
      color: C.ink,
      lineHeight: 26,
      letterSpacing: -0.3,
      minHeight: 28,
      padding: 0,
    },
    bulletWrap: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 8,
      gap: 10,
      position: 'relative',
    },
    bulletDot: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.inkSoft,
      lineHeight: 23,
      width: 12,
      textAlign: 'center',
    },
    bulletText: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 15,
      color: C.ink,
      lineHeight: 23,
      minHeight: 24,
      padding: 0,
    },
    quoteWrap: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 20,
      marginBottom: 18,
      position: 'relative',
    },
    quoteRule: {
      width: 2,
      backgroundColor: C.inkMuted,
      alignSelf: 'stretch',
      marginVertical: 4,
    },
    quoteText: {
      fontFamily: F.serifItalic,
      fontSize: 15,
      color: C.inkSoft,
      fontStyle: 'italic',
      lineHeight: 22,
      padding: 0,
      paddingTop: 2,
    },
    attribution: {
      fontFamily: F.sans,
      fontSize: 12,
      color: C.inkMuted,
      marginTop: 6,
      padding: 0,
    },
    thoughtWrap: {
      marginHorizontal: 20,
      marginBottom: 18,
      backgroundColor: C.sagePale,
      borderRadius: 10,
      borderLeftWidth: 3,
      borderLeftColor: C.sage,
      paddingHorizontal: 14,
      paddingVertical: 12,
      position: 'relative',
    },
    thoughtHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 6,
    },
    thoughtLabel: {
      fontFamily: F.serif,
      fontSize: 10,
      fontWeight: '700',
      color: C.inkSoft,
      letterSpacing: 0.8,
    },
    thoughtText: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkSoft,
      fontStyle: 'italic',
      lineHeight: 19,
      minHeight: 40,
      padding: 0,
    },
    removeBtn: {
      position: 'absolute',
      top: 0, right: 20,
      paddingTop: 2,
    },
    removeBtnAbs: {
      position: 'absolute',
      top: 8, right: 8,
    },

    // Image block
    imageWrap: {
      paddingHorizontal: 20,
      marginBottom: 18,
    },
    imageFrame: {
      width: '100%',
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: C.cream,
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      width: '100%',
      borderRadius: 12,
      backgroundColor: C.cream,
      borderWidth: 1,
      borderColor: C.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      position: 'relative',
    },
    imagePlaceholderTxt: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkFaint,
    },
    imageRemoveBtn: {
      position: 'absolute',
      top: 8, right: 8,
      width: 24, height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageCaption: {
      fontFamily: F.sans,
      fontSize: 13,
      color: C.inkMuted,
      fontStyle: 'italic',
      marginTop: 8,
      padding: 0,
      minHeight: 18,
    },
  }), [themeVersion]);
}

// ── Block components ──────────────────────────────────────────────────
const ParagraphBlock = React.forwardRef(function ParagraphBlock(
  { block, onChange, onRemove, placeholder, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  // Auto-focus on mount if marked (used when block is appended via tail tap)
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  // Expose applyFormat to parent so toolbar buttons can wrap selection
  React.useImperativeHandle(ref, () => ({
    applyFormat: (type) => {
      const d = FORMAT_DELIMS[type];
      if (!d) return;
      const wrapped = wrapSelection(block.text || '', selection, d.prefix, d.suffix);
      onChange({ ...block, text: wrapped.text });
      // Defer cursor update until after the text change has rendered
      setTimeout(() => {
        inputRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => inputRef.current?.focus(),
  }), [block.text, selection, onChange]);

  // Markdown auto-shortcuts — only fire on an empty paragraph when the
  // user types a trigger pattern at the start. Notion/Craft/Bear pattern.
  const handleChangeText = (newText) => {
    if (block.text === '') {
      const shortcut = MD_SHORTCUTS[newText];
      if (shortcut) {
        onChange({ ...block, type: shortcut, text: '', autoFocus: true });
        return;
      }
    }
    onChange({ ...block, text: newText });
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={blk.paragraphWrap}>
        <TextInput
          ref={inputRef}
          style={blk.paragraph}
          value={block.text}
          onChangeText={handleChangeText}
          onFocus={onFocus}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder={placeholder}
          placeholderTextColor={C.inkFaint}
          multiline
          textAlignVertical="top"
        />
        {block.text.length === 0 && onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

const QuoteBlock = React.forwardRef(function QuoteBlock(
  { block, onChange, onRemove, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const quoteRef = useRef(null);
  const attribRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => quoteRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  React.useImperativeHandle(ref, () => ({
    applyFormat: (type) => {
      const d = FORMAT_DELIMS[type];
      if (!d) return;
      const wrapped = wrapSelection(block.text || '', selection, d.prefix, d.suffix);
      onChange({ ...block, text: wrapped.text });
      setTimeout(() => {
        quoteRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => quoteRef.current?.focus(),
  }), [block.text, selection, onChange]);

  return (
    <Pressable onPress={() => quoteRef.current?.focus()}>
      <View style={blk.quoteWrap}>
        <View style={blk.quoteRule} />
        <View style={{ flex: 1 }}>
          <TextInput
            ref={quoteRef}
            style={blk.quoteText}
            value={block.text}
            onChangeText={text => onChange({ ...block, text })}
            onFocus={onFocus}
            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
            placeholder="A quote that struck you…"
            placeholderTextColor={C.inkFaint}
            multiline
            textAlignVertical="top"
          />
          <TextInput
            ref={attribRef}
            style={blk.attribution}
            value={block.attribution || ''}
            onChangeText={attribution => onChange({ ...block, attribution })}
            placeholder="— Author, Source"
            placeholderTextColor={C.inkFaint}
          />
        </View>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

const ThoughtBlock = React.forwardRef(function ThoughtBlock(
  { block, onChange, onRemove, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  React.useImperativeHandle(ref, () => ({
    applyFormat: (type) => {
      const d = FORMAT_DELIMS[type];
      if (!d) return;
      const wrapped = wrapSelection(block.text || '', selection, d.prefix, d.suffix);
      onChange({ ...block, text: wrapped.text });
      setTimeout(() => {
        inputRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => inputRef.current?.focus(),
  }), [block.text, selection, onChange]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={blk.thoughtWrap}>
        <View style={blk.thoughtHeader}>
          <Ionicons name="bulb-outline" size={11} color={C.inkSoft} />
          <Text style={blk.thoughtLabel}>THOUGHT</Text>
        </View>
        <TextInput
          ref={inputRef}
          style={blk.thoughtText}
          value={block.text}
          onChangeText={text => onChange({ ...block, text })}
          onFocus={onFocus}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder="What does this connect to? What surprised you?"
          placeholderTextColor={C.inkFaint}
          multiline
          textAlignVertical="top"
        />
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtnAbs} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

const HeadingBlock = React.forwardRef(function HeadingBlock(
  { block, onChange, onRemove, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  React.useImperativeHandle(ref, () => ({
    applyFormat: (type) => {
      const d = FORMAT_DELIMS[type];
      if (!d) return;
      const wrapped = wrapSelection(block.text || '', selection, d.prefix, d.suffix);
      onChange({ ...block, text: wrapped.text });
      setTimeout(() => {
        inputRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => inputRef.current?.focus(),
  }), [block.text, selection, onChange]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={blk.headingWrap}>
        <TextInput
          ref={inputRef}
          style={blk.heading}
          value={block.text}
          onChangeText={text => onChange({ ...block, text })}
          onFocus={onFocus}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder="Heading"
          placeholderTextColor={C.inkFaint}
          multiline
          textAlignVertical="top"
        />
        {block.text.length === 0 && onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

const BulletBlock = React.forwardRef(function BulletBlock(
  { block, onChange, onRemove, autoFocus, onFocus },
  ref
) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  const inputRef = useRef(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  React.useImperativeHandle(ref, () => ({
    applyFormat: (type) => {
      const d = FORMAT_DELIMS[type];
      if (!d) return;
      const wrapped = wrapSelection(block.text || '', selection, d.prefix, d.suffix);
      onChange({ ...block, text: wrapped.text });
      setTimeout(() => {
        inputRef.current?.setNativeProps?.({ selection: wrapped.selection });
        setSelection(wrapped.selection);
      }, 16);
    },
    focus: () => inputRef.current?.focus(),
  }), [block.text, selection, onChange]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={blk.bulletWrap}>
        <Text style={blk.bulletDot}>•</Text>
        <TextInput
          ref={inputRef}
          style={blk.bulletText}
          value={block.text}
          onChangeText={text => onChange({ ...block, text })}
          onFocus={onFocus}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder="List item"
          placeholderTextColor={C.inkFaint}
          multiline
          textAlignVertical="top"
        />
        {block.text.length === 0 && onRemove && (
          <TouchableOpacity onPress={onRemove} style={blk.removeBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="close-circle" size={16} color={C.inkFaint} />
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
});

// ── Image block — shows the picked/captured image with optional caption ──
function ImageBlock({ block, onChange, onRemove }) {
  const { C } = useTheme();
  const blk = useBlkStyles();
  // Aspect ratio: fall back to 4:3 if dimensions unknown
  const aspect = (block.width && block.height) ? (block.width / block.height) : (4 / 3);

  return (
    <View style={blk.imageWrap}>
      {block.uri ? (
        <View style={[blk.imageFrame, { aspectRatio: aspect }]}>
          <Image source={{ uri: block.uri }} style={blk.image} resizeMode="cover" />
          {onRemove && (
            <TouchableOpacity onPress={onRemove} style={blk.imageRemoveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color={C.white} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={[blk.imagePlaceholder, { aspectRatio: 4 / 3 }]}>
          <Ionicons name="image-outline" size={28} color={C.inkFaint} />
          <Text style={blk.imagePlaceholderTxt}>Image unavailable</Text>
          {onRemove && (
            <TouchableOpacity onPress={onRemove} style={blk.imageRemoveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color={C.white} />
            </TouchableOpacity>
          )}
        </View>
      )}

      <TextInput
        style={blk.imageCaption}
        value={block.text}
        onChangeText={text => onChange({ ...block, text })}
        placeholder="Add a caption…"
        placeholderTextColor={C.inkFaint}
        multiline
      />
    </View>
  );
}


// ── Book picker step (step 1) ─────────────────────────────────────────
function BookPicker({ books, onPick, onCancel }) {
  const { C, F, themeVersion } = useTheme();
  const bp = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    cancel: { fontFamily: F.serif, fontSize: 14, color: C.inkMuted },
    title: { fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
    strip: { backgroundColor: C.cream, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
    stripTxt: { fontFamily: F.serif, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
    bookRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: C.white, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: C.border,
    },
    bookTitle: { fontFamily: F.serif, fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 20, marginBottom: 3 },
    bookAuthor: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginBottom: 8 },
    statusPill: { alignSelf: 'flex-start', backgroundColor: C.amberPale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    statusTxt: { fontFamily: F.serif, fontSize: 11, fontWeight: '600', color: C.ink },
  }), [themeVersion]);
  const activeBooks = books.filter(b => b.status !== 'want_to_read');

  return (
    <SafeAreaView style={bp.safe}>
      <View style={bp.header}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={bp.cancel}>Cancel</Text>
        </TouchableOpacity>
        <Text style={bp.title}>New Note</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={bp.strip}>
        <Text style={bp.stripTxt}>Which book is this note about?</Text>
      </View>

      {activeBooks.length === 0 ? (
        <View style={bp.empty}>
          <Text style={bp.emptyIcon}>📚</Text>
          <Text style={bp.emptyTitle}>No books in progress</Text>
          <Text style={bp.emptySub}>Go to the Add tab to find your first book — then come back here to capture notes.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
          {activeBooks.map(b => (
            <TouchableOpacity
              key={b.id}
              style={bp.bookRow}
              onPress={() => onPick(b)}
              activeOpacity={0.85}
            >
              <BookCover title={b.title} author={b.author} cover={b.cover}
                coverId={b.coverId} width={48} height={68} />
              <View style={{ flex: 1 }}>
                <Text style={bp.bookTitle} numberOfLines={2}>{b.title}</Text>
                <Text style={bp.bookAuthor}>{b.author}</Text>
                <View style={bp.statusPill}>
                  <Text style={bp.statusTxt}>
                    {b.status === 'reading' ? '📖 Reading' : b.status === 'finished' ? '✓ Finished' : 'Want to read'}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.inkFaint} />
            </TouchableOpacity>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}


// ── Main editor screen (step 2) ───────────────────────────────────────
function EditorScreen({ book, initialData, onSave, onCancel, onChangeBook }) {
  const { C, F, themeVersion } = useTheme();
  const ed = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    // Top bar is now a column — actions row on top, title below
    appBar: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
    },
    // Row 1: back chevron (left) + Save pill (right)
    appBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -8,  // visually align chevron flush left, accounting for hitslop
    },
    // Substack-style Save pill — solid navy, rounded, compact
    savePill: {
      backgroundColor: C.ink,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 20,
    },
    savePillTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.white,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    // Row 2: serif title that wraps across multiple lines if needed
    appBarTitle: {
      fontFamily: F.serif,
      fontSize: 22,
      lineHeight: 28,
      color: C.ink,
      letterSpacing: -0.3,
    },
    // Inline "Change" affordance shown when book was pre-attached and the
    // user is composing a new note — lets them swap target without
    // backing out of the modal.
    changeBookRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
      gap: 4,
    },
    changeBookTxt: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      fontWeight: '600',
      letterSpacing: 0.2,
    },
    toolbarWrap: {
      marginBottom: 10,
    },
    title: {
      fontFamily: F.serif,
      fontSize: 24,
      color: C.ink,
      letterSpacing: -0.4,
      lineHeight: 30,
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 0,
      marginTop: 4,
    },
    // Fills the empty space at the bottom of the editor so users can tap
    // anywhere below the last block to add or focus a paragraph.
    tailZone: {
      minHeight: 240,
    },
  }), [themeVersion]);
  // initialData provided when editing an existing note
  const [title, setTitle]     = useState(initialData?.title || '');
  const [blocks, setBlocks]   = useState(
    initialData?.blocks?.length
      ? initialData.blocks
      : [newBlock('paragraph')]
  );
  // Selected note types. Default to ['insight'] for new notes; preserve when editing.
  const [types, setTypes]     = useState(
    initialData?.types?.length
      ? initialData.types
      : initialData?.type ? [initialData.type] : ['insight']
  );

  const scrollRef = useRef(null);

  // Refs to each block's imperative interface (applyFormat, focus).
  // Keyed by block id so order changes don't shuffle refs incorrectly.
  const blockRefs = useRef({});
  // The id of the most recently focused block — toolbar formatting targets this.
  const focusedBlockId = useRef(null);

  const registerBlockRef = (id) => (ref) => {
    if (ref) blockRefs.current[id] = ref;
    else delete blockRefs.current[id];
  };

  // Dispatch a format action to the focused block (bold/italic/underline/highlight)
  const handleFormat = (type) => {
    const id = focusedBlockId.current;
    if (!id) return;
    const ref = blockRefs.current[id];
    ref?.applyFormat?.(type);
  };

  // Helpers
  const updateBlock = (idx, updated) => {
    setBlocks(bs => bs.map((b, i) => i === idx ? updated : b));
  };

  const removeBlock = (idx) => {
    setBlocks(bs => {
      const next = bs.filter((_, i) => i !== idx);
      return next.length === 0 ? [newBlock('paragraph')] : next;
    });
  };

  const insertBlock = (type) => {
    setBlocks(bs => [...bs, newBlock(type)]);
    // Scroll to bottom after insert
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  // Insert one or more image blocks at the end with given URIs
  const insertImageBlocks = (assets) => {
    if (!assets || assets.length === 0) return;
    const newImageBlocks = assets.map(a =>
      newBlock('image', { uri: a.uri, width: a.width || 0, height: a.height || 0 })
    );
    setBlocks(bs => [...bs, ...newImageBlocks]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Pick from gallery
  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Photos access needed',
        'BookWise needs access to your photos so you can attach them to notes. Enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (!result.canceled) {
      insertImageBlocks(result.assets);
    }
  };

  // Take a photo with the camera
  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera access needed',
        'BookWise needs access to the camera so you can capture book pages and notes. Enable it in Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled) {
      insertImageBlocks(result.assets);
    }
  };

  const toggleType = (key) => {
    setTypes(ts => ts.includes(key) ? ts.filter(t => t !== key) : [...ts, key]);
  };

  // Save — flatten blocks → text for backwards compat
  const handleSave = () => {
    // Keep blocks with content OR images (image blocks may have empty caption)
    const cleanBlocks = blocks.filter(b => {
      if (b.type === 'image') return !!b.uri;
      return b.text.trim() || b.attribution?.trim();
    });
    if (cleanBlocks.length === 0) return;

    const flatText = blocksToText(cleanBlocks);

    onSave({
      bookId:     book.id,
      bookTitle:  book.title,
      title:      title.trim(),
      blocks:     cleanBlocks,
      types:      types.length ? types : ['insight'],
      type:       types[0] || 'insight', // primary type for backwards compat
      text:       flatText,              // flattened body for backwards compat
      thinking:   '',                    // legacy field — empty (folded into blocks)
      page:       '',
      chapter:    '',
    });
  };

  const canSave = blocks.some(b => b.text.trim());

  return (
    <SafeAreaView style={ed.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar — two rows:
            Row 1: back chevron (left) · Save pill (right)
            Row 2: "Note on [book]" serif title — full width, wraps as needed */}
        <View style={ed.appBar}>
          <View style={ed.appBarActions}>
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={ed.backBtn}
            >
              <Ionicons name="chevron-back" size={22} color={C.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.85}
              style={[ed.savePill, !canSave && { opacity: 0.4 }]}
            >
              <Text style={ed.savePillTxt}>Save</Text>
            </TouchableOpacity>
          </View>
          <Text style={ed.appBarTitle}>
            Note on {book.title}
          </Text>
          {onChangeBook && (
            <TouchableOpacity
              onPress={onChangeBook}
              activeOpacity={0.6}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
              style={ed.changeBookRow}
            >
              <Ionicons name="swap-horizontal" size={13} color={C.inkMuted} />
              <Text style={ed.changeBookTxt}>Change book</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Toolbar */}
          <View style={ed.toolbarWrap}>
            <Toolbar
              onInsert={insertBlock}
              onPickFromGallery={handlePickFromGallery}
              onTakePhoto={handleTakePhoto}
            />
          </View>

          {/* Tag row — sits directly under the toolbar (no title field) */}
          <TagRow selectedTypes={types} onToggle={toggleType} />

          {/* Blocks */}
          {blocks.map((block, idx) => {
            const removeFn = blocks.length > 1 ? () => removeBlock(idx) : null;
            const onFocusBlock = () => { focusedBlockId.current = block.id; };
            if (block.type === 'quote') {
              return (
                <QuoteBlock
                  key={block.id}
                  ref={registerBlockRef(block.id)}
                  block={block}
                  onChange={updated => updateBlock(idx, updated)}
                  onRemove={removeFn}
                  autoFocus={block.autoFocus}
                  onFocus={onFocusBlock}
                />
              );
            }
            if (block.type === 'thought') {
              return (
                <ThoughtBlock
                  key={block.id}
                  ref={registerBlockRef(block.id)}
                  block={block}
                  onChange={updated => updateBlock(idx, updated)}
                  onRemove={removeFn}
                  autoFocus={block.autoFocus}
                  onFocus={onFocusBlock}
                />
              );
            }
            if (block.type === 'heading') {
              return (
                <HeadingBlock
                  key={block.id}
                  ref={registerBlockRef(block.id)}
                  block={block}
                  onChange={updated => updateBlock(idx, updated)}
                  onRemove={removeFn}
                  autoFocus={block.autoFocus}
                  onFocus={onFocusBlock}
                />
              );
            }
            if (block.type === 'bullet') {
              return (
                <BulletBlock
                  key={block.id}
                  ref={registerBlockRef(block.id)}
                  block={block}
                  onChange={updated => updateBlock(idx, updated)}
                  onRemove={removeFn}
                  autoFocus={block.autoFocus}
                  onFocus={onFocusBlock}
                />
              );
            }
            if (block.type === 'image') {
              return (
                <ImageBlock
                  key={block.id}
                  block={block}
                  onChange={updated => updateBlock(idx, updated)}
                  onRemove={removeFn}
                />
              );
            }
            return (
              <ParagraphBlock
                key={block.id}
                ref={registerBlockRef(block.id)}
                block={block}
                onChange={updated => updateBlock(idx, updated)}
                onRemove={removeFn}
                placeholder={idx === 0 ? 'Start writing…' : 'Continue your reflection…'}
                autoFocus={block.autoFocus}
                onFocus={onFocusBlock}
              />
            );
          })}

          {/* Tail tap zone — fills empty space, lets user click below last block */}
          <Pressable
            onPress={() => {
              const last = blocks[blocks.length - 1];
              if (last && last.type === 'paragraph') {
                // No-op — paragraph wrapper already handles focus on tap.
                // But ScrollView siblings don't bubble, so explicitly call focus
                // via a ref if we tracked it. For now, append a new paragraph
                // only when last block ISN'T a paragraph.
                return;
              }
              // Last block is quote/thought — append a new paragraph and autoFocus it
              setBlocks(bs => [
                ...bs,
                { ...newBlock('paragraph'), autoFocus: true },
              ]);
            }}
            style={ed.tailZone}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


// ── Main export — RichNoteEditor Modal ────────────────────────────────
// Two-step flow inside one modal:
//   1. Book picker (if no bookId passed)
//   2. Editor
//
// Props:
//   visible      — boolean
//   books        — array of book objects from store
//   initialNote  — null for new note, or an existing note to edit
//   defaultBook  — book to pre-attach when launching a new note (FAB,
//                  BookDetailScreen). User can still tap "Change" to swap.
//   onSave(data) — called with the assembled note payload
//   onClose()    — close without saving
export function RichNoteEditor({ visible, books, initialNote, defaultBook, onSave, onClose }) {
  const [pickedBook, setPickedBook] = useState(null);

  // If editing, jump straight to step 2 with the note's existing book.
  // If defaultBook is provided, skip the picker and pre-attach that book —
  // the editor still surfaces a "Change" link so the user can swap.
  useEffect(() => {
    if (visible && initialNote) {
      const book = books.find(b => b.id === initialNote.bookId);
      setPickedBook(book || null);
    } else if (visible && defaultBook) {
      setPickedBook(defaultBook);
    } else if (visible) {
      setPickedBook(null);
    }
  }, [visible, initialNote, defaultBook, books]);

  const handleCancel = () => {
    setPickedBook(null);
    onClose();
  };

  const handleSaveFromEditor = (data) => {
    onSave(data);
    setPickedBook(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      {/* Modals on iOS create a separate React tree that doesn't inherit
          the app-root SafeAreaProvider context. We provide our own here so
          the inner SafeAreaView correctly reads the device's notch insets. */}
      <SafeAreaProvider>
        {!pickedBook ? (
          <BookPicker
            books={books}
            onPick={setPickedBook}
            onCancel={handleCancel}
          />
        ) : (
          <EditorScreen
            book={pickedBook}
            initialData={initialNote}
            onSave={handleSaveFromEditor}
            onCancel={handleCancel}
            onChangeBook={!initialNote ? () => setPickedBook(null) : null}
          />
        )}
      </SafeAreaProvider>
    </Modal>
  );
}