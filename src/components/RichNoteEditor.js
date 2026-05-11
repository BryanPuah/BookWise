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

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BookCover } from './BookCover';
import { AppHeader } from './AppHeader';
import { C, F } from '../theme';

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
const newBlock = (type = 'paragraph') => ({
  id:   `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type,
  text: '',
  attribution: type === 'quote' ? '' : undefined,
});

// Flatten blocks → plain text (kept on note.text for backwards compat)
function blocksToText(blocks) {
  return blocks
    .map(b => {
      if (b.type === 'quote')   return `"${b.text}"${b.attribution ? ` — ${b.attribution}` : ''}`;
      if (b.type === 'thought') return `💭 ${b.text}`;
      return b.text;
    })
    .filter(s => s.trim())
    .join('\n\n');
}

// ── Toolbar ────────────────────────────────────────────────────────────
function Toolbar({ onInsert }) {
  return (
    <View style={tb.bar}>
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
  );
}

const tb = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    marginHorizontal: 20,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 0,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  btnTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkSoft, fontStyle: 'italic' },
  divider: { width: 1, height: 16, backgroundColor: C.border },
});

// ── Tag row ────────────────────────────────────────────────────────────
function TagRow({ selectedTypes, onToggle }) {
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

const tg = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
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
  chipTxt: { fontSize: 12, color: C.ink, fontWeight: '600' },
  addBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  addBtnTxt: { fontSize: 12, color: C.inkMuted, fontWeight: '500' },
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
    fontSize: 10, fontWeight: '700',
    color: C.inkMuted, letterSpacing: 1,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  pickerIcon: { fontSize: 16 },
  pickerLabel: { fontSize: 15, color: C.ink, fontWeight: '500' },
});

// ── Block components ──────────────────────────────────────────────────
function ParagraphBlock({ block, onChange, onRemove, placeholder, autoFocus }) {
  const inputRef = useRef(null);

  // Auto-focus on mount if marked (used when block is appended via tail tap)
  useEffect(() => {
    if (autoFocus) {
      // Small delay lets layout settle before the keyboard rises
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()}>
      <View style={blk.paragraphWrap}>
        <TextInput
          ref={inputRef}
          style={blk.paragraph}
          value={block.text}
          onChangeText={text => onChange({ ...block, text })}
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
}

function QuoteBlock({ block, onChange, onRemove }) {
  const quoteRef = useRef(null);
  const attribRef = useRef(null);
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
}

function ThoughtBlock({ block, onChange, onRemove }) {
  const inputRef = useRef(null);
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
}

const blk = StyleSheet.create({
  paragraphWrap: {
    paddingHorizontal: 20,
    marginBottom: 18,
    position: 'relative',
  },
  paragraph: {
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
    fontSize: 10,
    fontWeight: '700',
    color: C.inkSoft,
    letterSpacing: 0.8,
  },
  thoughtText: {
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
});

// ── Book picker step (step 1) ─────────────────────────────────────────
function BookPicker({ books, onPick, onCancel }) {
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
          <Text style={bp.emptySub}>Add a book from Discover to start capturing notes.</Text>
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

const bp = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  cancel: { fontSize: 14, color: C.inkMuted },
  title: { fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
  strip: { backgroundColor: C.cream, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  stripTxt: { fontFamily: F.serif, fontSize: 17, color: C.ink, letterSpacing: -0.2 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  bookRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.white, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  bookTitle: { fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 20, marginBottom: 3 },
  bookAuthor: { fontSize: 12, color: C.inkMuted, marginBottom: 8 },
  statusPill: { alignSelf: 'flex-start', backgroundColor: C.amberPale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusTxt: { fontSize: 11, fontWeight: '600', color: C.ink },
});

// ── Main editor screen (step 2) ───────────────────────────────────────
function EditorScreen({ book, initialData, onSave, onCancel }) {
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

  const toggleType = (key) => {
    setTypes(ts => ts.includes(key) ? ts.filter(t => t !== key) : [...ts, key]);
  };

  // Save — flatten blocks → text for backwards compat
  const handleSave = () => {
    const cleanBlocks = blocks.filter(b => b.text.trim() || b.attribution?.trim());
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
        {/* App bar */}
        <View style={ed.appBar}>
          <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={ed.appBarTitle} numberOfLines={1}>Modern Library</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[ed.saveBtn, !canSave && { opacity: 0.3 }]}>Save</Text>
          </TouchableOpacity>
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
            <Toolbar onInsert={insertBlock} />
          </View>

          {/* Title */}
          <TextInput
            style={ed.title}
            value={title}
            onChangeText={setTitle}
            placeholder={`Reflections on ${book.title.split(' ').slice(0, 3).join(' ')}…`}
            placeholderTextColor={C.inkFaint}
            multiline
          />

          {/* Tag row */}
          <TagRow selectedTypes={types} onToggle={toggleType} />

          {/* Blocks */}
          {blocks.map((block, idx) => {
            const removeFn = blocks.length > 1 ? () => removeBlock(idx) : null;
            if (block.type === 'quote') {
              return (
                <QuoteBlock
                  key={block.id}
                  block={block}
                  onChange={updated => updateBlock(idx, updated)}
                  onRemove={removeFn}
                />
              );
            }
            if (block.type === 'thought') {
              return (
                <ThoughtBlock
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
                block={block}
                onChange={updated => updateBlock(idx, updated)}
                onRemove={removeFn}
                placeholder={idx === 0 ? 'Start writing…' : 'Continue your reflection…'}
                autoFocus={block.autoFocus}
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

const ed = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  appBarTitle: {
    flex: 1,
    fontFamily: F.serif,
    fontSize: 22,
    color: C.ink,
    letterSpacing: -0.2,
    marginLeft: 14,
  },
  saveBtn: {
    fontSize: 14,
    color: C.ink,
    fontWeight: '700',
  },
  toolbarWrap: {
    marginBottom: 18,
  },
  title: {
    fontFamily: F.serif,
    fontSize: 24,
    color: C.ink,
    letterSpacing: -0.4,
    lineHeight: 30,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 0,
  },
  // Fills the empty space at the bottom of the editor so users can tap
  // anywhere below the last block to add or focus a paragraph.
  tailZone: {
    minHeight: 240,
  },
});

// ── Main export — RichNoteEditor Modal ────────────────────────────────
// Two-step flow inside one modal:
//   1. Book picker (if no bookId passed)
//   2. Editor
//
// Props:
//   visible      — boolean
//   books        — array of book objects from store
//   initialNote  — null for new note, or an existing note to edit
//   onSave(data) — called with the assembled note payload
//   onClose()    — close without saving
export function RichNoteEditor({ visible, books, initialNote, onSave, onClose }) {
  const [pickedBook, setPickedBook] = useState(null);

  // If editing, jump straight to step 2 with the note's existing book
  useEffect(() => {
    if (visible && initialNote) {
      const book = books.find(b => b.id === initialNote.bookId);
      setPickedBook(book || null);
    } else if (visible) {
      setPickedBook(null);
    }
  }, [visible, initialNote, books]);

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
        />
      )}
    </Modal>
  );
}