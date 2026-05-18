/**
 * RichNoteEditor — Block-based note editor.
 *
 * Two-step flow inside one modal:
 *  1. BookPicker — choose which book this note is about (skipped when a
 *     defaultBook is passed or an existing note is being edited).
 *  2. EditorScreen — the actual editor: toolbar, tag row, blocks.
 *
 * Block components, the toolbar, the tag row, and the book picker each
 * live in their own files under ./editor/. This file holds the shell:
 * the two-step modal flow + the EditorScreen wiring (state, save, image
 * pickers, block dispatch).
 *
 * Data model:
 *  - title: string (optional)
 *  - blocks: [{ id, type: 'paragraph'|'quote'|'thought'|'heading'|'bullet'|'image', text, attribution?, uri?, width?, height? }]
 *  - types: string[] (note types — Quote/Insight/Question/Action/Summary/Connection)
 *  - bookId, bookTitle, page, chapter — preserved from existing schema
 *
 * Backwards-compatible: when a note is saved, we also populate `text` (a
 * concatenated string of all block text) and the primary `type` (first
 * selected type) so the existing NotesScreen list view keeps working.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity, Pressable,
  StyleSheet, Modal, KeyboardAvoidingView, Platform, Alert, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { File, Directory, Paths } from 'expo-file-system';
import { AppText as Text, AppTextInput as TextInput } from './AppText';
import { LinkedNotesPicker } from './LinkedNotesPicker';
import { useTheme } from '../theme';
import { useStore } from '../store';
import { newBlock, blocksToText, noteToMarkdown } from './editor/shared';
import { Toolbar } from './editor/Toolbar';
import { TagRow } from './editor/TagRow';
import { BookPicker } from './editor/BookPicker';
import { ParagraphBlock } from './editor/blocks/ParagraphBlock';
import { QuoteBlock } from './editor/blocks/QuoteBlock';
import { ThoughtBlock } from './editor/blocks/ThoughtBlock';
import { HeadingBlock } from './editor/blocks/HeadingBlock';
import { BulletBlock } from './editor/blocks/BulletBlock';
import { ImageBlock } from './editor/blocks/ImageBlock';

// ── Autosave / draft recovery ─────────────────────────────────────────
// Single-slot draft stored in AsyncStorage. Only fresh (no-initialData)
// edits write here — editing an existing note shouldn't fork into a
// "draft" copy. On modal open we read the slot; if it's non-empty we
// offer to restore. Save clears the slot; explicit Discard clears it
// too. Keep the schema explicit so a future version can either migrate
// or drop unknown drafts on hydration.
export const DRAFT_KEY = 'bw.v1.draft';

function draftHasContent(d) {
  if (!d) return false;
  if ((d.title || '').trim()) return true;
  if (Array.isArray(d.tags) && d.tags.length) return true;
  if (Array.isArray(d.linkedNoteIds) && d.linkedNoteIds.length) return true;
  return Array.isArray(d.blocks) && d.blocks.some(b => {
    if (b.type === 'image') return !!b.uri;
    return (b.text || '').trim() || (b.attribution || '').trim();
  });
}

async function readDraft() {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!draftHasContent(parsed)) return null;
    return parsed;
  } catch (e) {
    console.warn('[draft] read failed', e);
    return null;
  }
}

async function writeDraft(payload) {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('[draft] write failed', e);
  }
}

async function clearDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.warn('[draft] clear failed', e);
  }
}

// Copy a picked/captured image from the ImagePicker cache directory into
// the app's documents directory so the URI survives the OS evicting the
// cache. Returns the persisted file:// URI, or falls back to the original
// (cache) URI if the copy fails — the block still renders, it just won't
// outlive aggressive cache pressure.
function persistImageAsset(asset) {
  try {
    const src = new File(asset.uri);
    if (!src.exists) return asset.uri;
    const dir = new Directory(Paths.document, 'note-images');
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const ext = src.extension || '.jpg';
    const fname = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const dest = new File(dir, fname);
    src.copy(dest);
    return dest.uri;
  } catch (e) {
    console.warn('[image] persist failed, using source URI', e);
    return asset.uri;
  }
}

// ── Main editor screen (step 2) ───────────────────────────────────────
function EditorScreen({ book, initialData, onSave, onCancel, onChangeBook, registerCancelGuard }) {
  const { C, F, themeVersion } = useTheme();
  const { notes: allNotes, books: allBooks, showToast } = useStore();
  const ed = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    appBar: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
    },
    appBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    backBtn: {
      width: 36, height: 36,
      alignItems: 'center', justifyContent: 'center',
      marginLeft: -8,
    },
    appBarRight: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    iconBtn: {
      width: 36, height: 36,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 18,
    },
    savePill: {
      backgroundColor: C.ink,
      paddingHorizontal: 18, paddingVertical: 8,
      borderRadius: 20,
    },
    savePillTxt: {
      fontFamily: F.serif, fontSize: 13,
      color: C.white, fontWeight: '700', letterSpacing: 0.2,
    },
    appBarTitle: {
      fontFamily: F.serif, fontSize: 22, lineHeight: 28,
      color: C.ink, letterSpacing: -0.3,
    },
    // Inline "Change" affordance shown when book was pre-attached and the
    // user is composing a new note — lets them swap target without
    // backing out of the modal.
    changeBookPill: {
      alignSelf: 'flex-start',
      marginTop: 8,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 999,
    },
    changeBookTxt: {
      fontFamily: F.serif, fontSize: 12,
      color: C.inkMuted, fontWeight: '600', letterSpacing: 0.2,
    },
    toolbarWrap: { marginBottom: 10 },
    titleWrap: {
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: 6,
    },
    titleInput: {
      fontFamily: F.serif, fontSize: 22, lineHeight: 28,
      color: C.ink, letterSpacing: -0.3,
      padding: 0,
      minHeight: 30,
    },
    // Fills the empty space at the bottom of the editor so users can tap
    // anywhere below the last block to add or focus a paragraph.
    tailZone: { minHeight: 240 },

    linksWrap: { paddingHorizontal: 20, marginBottom: 12 },
    linksHeader: {
      flexDirection: 'row', alignItems: 'center',
      gap: 6, marginBottom: 8,
    },
    linksHeaderTxt: {
      fontFamily: F.sans, fontSize: 10, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1.2,
    },
    linksRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
    linkChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.amberPale,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 12,
    },
    linkChipTxt: {
      fontFamily: F.serif, fontSize: 12,
      color: C.ink, fontWeight: '600',
      maxWidth: 200,
    },
    addLinkBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 12,
      borderWidth: 1, borderColor: C.border,
      backgroundColor: C.cream,
    },
    addLinkTxt: { fontFamily: F.serif, fontSize: 12, color: C.inkSoft, fontWeight: '600' },
  }), [themeVersion]);

  // initialData provided when editing an existing note. Title is user-
  // editable via the slim TitleInput above the blocks. Falls back to
  // empty for new notes — the schema treats title as optional and
  // NoteCard derives one from the first paragraph when missing.
  const initialTitle = initialData?.title || '';
  const [title, setTitle] = useState(initialTitle);
  const [blocks, setBlocks]  = useState(
    initialData?.blocks?.length
      ? initialData.blocks
      : [newBlock('paragraph')]
  );
  const [types, setTypes]    = useState(
    initialData?.types?.length
      ? initialData.types
      : initialData?.type ? [initialData.type] : ['insight']
  );
  const [tags, setTags]      = useState(
    Array.isArray(initialData?.tags) ? initialData.tags : []
  );
  const [linkedNoteIds, setLinkedNoteIds] = useState(
    Array.isArray(initialData?.linkedNoteIds) ? initialData.linkedNoteIds : []
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
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const insertImageBlocks = (assets) => {
    if (!assets || assets.length === 0) return;
    const newImageBlocks = assets.map(a =>
      newBlock('image', {
        uri: persistImageAsset(a),
        width: a.width || 0,
        height: a.height || 0,
      })
    );
    setBlocks(bs => [...bs, ...newImageBlocks]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handlePickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Allow photo access?',
        'To attach photos to your notes, turn on Photos access in your iPhone settings.',
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

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Use your camera?',
        'Snap pages and notes by turning on Camera access in your iPhone settings.',
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

  // Linked-notes picker — only relevant when "Connection" type is active.
  const [linksPickerOpen, setLinksPickerOpen] = useState(false);
  const isConnection = types.includes('connection');

  // ── Dirty-state tracking ─────────────────────────────────────────────
  // True when the user has typed/changed something they'd lose on cancel.
  // For a new note, dirty = any non-default content. For an existing note,
  // dirty = any field differs from the initial snapshot.
  const isDirty = useMemo(() => {
    const hasBlockContent = blocks.some(b => {
      if (b.type === 'image') return !!b.uri;
      return (b.text || '').trim() || (b.attribution || '').trim();
    });
    if (!initialData) {
      const nonDefaultTypes = !(types.length === 1 && types[0] === 'insight');
      return hasBlockContent || title.trim().length > 0 || tags.length > 0 || linkedNoteIds.length > 0 || nonDefaultTypes;
    }
    const initBlocks = initialData.blocks || [];
    const blocksChanged = blocks.length !== initBlocks.length
      || blocks.some((b, i) => {
        const o = initBlocks[i];
        if (!o) return true;
        return b.type !== o.type
          || (b.text || '') !== (o.text || '')
          || (b.attribution || '') !== (o.attribution || '')
          || (b.uri || '') !== (o.uri || '');
      });
    const initTypes = initialData.types?.length
      ? initialData.types
      : (initialData.type ? [initialData.type] : ['insight']);
    const typesChanged = types.join('|') !== initTypes.join('|');
    const tagsChanged  = tags.join('|') !== (initialData.tags || []).join('|');
    const linksChanged = linkedNoteIds.join('|') !== (initialData.linkedNoteIds || []).join('|');
    const titleChanged = (title || '').trim() !== (initialData.title || '').trim();
    return blocksChanged || typesChanged || tagsChanged || linksChanged || titleChanged;
  }, [blocks, title, types, tags, linkedNoteIds, initialData]);

  const confirmCancel = () => {
    if (!isDirty) { onCancel(); return; }
    Alert.alert(
      'Discard changes?',
      'Your edits to this note will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            if (!isExistingNote) clearDraft();
            onCancel();
          },
        },
      ],
    );
  };

  // Autosave to the draft slot every ~2s while editing a new note. We
  // skip autosave when editing an existing note (initialData.id present)
  // — those edits flow through updateNote on Save, so a separate draft
  // slot would just duplicate state and risk overwriting on cancel.
  const isExistingNote = !!initialData?.id;
  useEffect(() => {
    if (isExistingNote) return;
    const t = setTimeout(() => {
      const payload = {
        bookId:        book.id,
        bookTitle:     book.title,
        title:         (title || '').trim(),
        blocks,
        types,
        tags,
        linkedNoteIds,
        savedAt:       Date.now(),
      };
      if (draftHasContent(payload)) writeDraft(payload);
      else clearDraft();
    }, 2000);
    return () => clearTimeout(t);
  }, [isExistingNote, title, blocks, types, tags, linkedNoteIds, book.id, book.title]);

  // Expose the dirty-aware cancel up to the Modal so hardware-back / swipe-
  // down dismissals also prompt instead of silently discarding.
  //
  // A ref carries the latest `confirmCancel` so we can register the guard
  // exactly once (on mount) without re-registering on every keystroke. The
  // previous effect had no dep array and tore down + reinstalled the guard
  // on every render — leaving a brief window where back-press would skip
  // the dirty prompt entirely.
  const confirmCancelRef = useRef(confirmCancel);
  confirmCancelRef.current = confirmCancel;
  useEffect(() => {
    registerCancelGuard?.(() => confirmCancelRef.current?.());
    return () => registerCancelGuard?.(null);
  }, [registerCancelGuard]);

  // Share the current note as Markdown via the OS share sheet. The
  // share sheet's built-in "Copy" action is how the user gets a copy-as-
  // markdown without us having to depend on a separate clipboard
  // module. Composed from the in-flight editor state so a user can
  // share their draft mid-edit without saving first.
  const handleShare = async () => {
    const cleanBlocks = blocks.filter(b => {
      if (b.type === 'image') return !!b.uri;
      return (b.text || '').trim() || (b.attribution || '').trim();
    });
    const md = noteToMarkdown({
      title:     (title || '').trim(),
      blocks:    cleanBlocks,
      tags,
      bookTitle: book.title,
      chapter:   initialData?.chapter || '',
      page:      initialData?.page || '',
      text:      blocksToText(cleanBlocks),
    });
    if (!md) {
      showToast?.({ message: 'Nothing to share yet — add some text or an image' });
      return;
    }
    try {
      await Share.share({
        message: md,
        title:   (title || '').trim() || `Note on ${book.title}`,
      });
    } catch (e) {
      console.warn('[share] failed', e);
    }
  };

  // Save — flatten blocks → text for backwards compat
  const handleSave = () => {
    const cleanBlocks = blocks.filter(b => {
      if (b.type === 'image') return !!b.uri;
      return b.text.trim() || b.attribution?.trim();
    });
    if (cleanBlocks.length === 0) {
      // Defensive — canSave usually prevents reaching this branch, but a
      // race (delete after canSave evaluated) could still land here. A
      // silent no-op was the original bug; surface a toast so the user
      // knows why the tap appeared to do nothing.
      showToast?.({ message: 'Add some text or an image before saving' });
      return;
    }

    const flatText = blocksToText(cleanBlocks);

    const finalTypes = types.length ? types : ['insight'];
    // Only persist linked notes when Connection is actually selected.
    const finalLinkedIds = finalTypes.includes('connection') ? linkedNoteIds : [];

    // Persisted draft is no longer recoverable once the note is saved.
    if (!isExistingNote) clearDraft();

    onSave({
      bookId:        book.id,
      bookTitle:     book.title,
      title:         (title || '').trim(),
      blocks:        cleanBlocks,
      types:         finalTypes,
      type:          finalTypes[0],
      text:          flatText,
      thinking:      '',
      page:          '',
      chapter:       '',
      tags,
      linkedNoteIds: finalLinkedIds,
    });
  };

  // Mirror the `cleanBlocks` filter in handleSave — image blocks count as
  // content even with no caption, and a quote with just an attribution is
  // also valid. The old `b.text.trim()` check disabled Save for image-only
  // notes, making the camera/gallery toolbar buttons functionally dead-end.
  const canSave = blocks.some(b => {
    if (b.type === 'image') return !!b.uri;
    return (b.text || '').trim() || (b.attribution || '').trim();
  });

  return (
    <SafeAreaView style={ed.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={ed.appBar}>
          <View style={ed.appBarActions}>
            <TouchableOpacity
              onPress={confirmCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={ed.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Close editor"
              accessibilityHint="Discards or cancels the note and returns to the previous screen"
            >
              <Ionicons name="chevron-back" size={22} color={C.ink} importantForAccessibility="no" />
            </TouchableOpacity>
            <View style={ed.appBarRight}>
              <TouchableOpacity
                onPress={handleShare}
                disabled={!canSave}
                activeOpacity={0.7}
                style={[ed.iconBtn, !canSave && { opacity: 0.4 }]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Share note as Markdown"
                accessibilityHint="Opens the system share sheet — use Copy for plain Markdown"
                accessibilityState={{ disabled: !canSave }}
              >
                <Ionicons name="share-outline" size={20} color={C.ink} importantForAccessibility="no" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.85}
                style={[ed.savePill, !canSave && { opacity: 0.4 }]}
                accessibilityRole="button"
                accessibilityLabel="Save note"
                accessibilityState={{ disabled: !canSave }}
              >
                <Text style={ed.savePillTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={ed.appBarTitle} accessibilityRole="header">
            Note on {book.title}
          </Text>
          {onChangeBook && (
            <TouchableOpacity
              onPress={onChangeBook}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}
              style={ed.changeBookPill}
              accessibilityRole="button"
              accessibilityLabel="Change book"
              accessibilityHint="Picks a different book for this note"
            >
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
          <View style={ed.toolbarWrap}>
            <Toolbar
              onInsert={insertBlock}
              onPickFromGallery={handlePickFromGallery}
              onTakePhoto={handleTakePhoto}
            />
          </View>

          {/* Title — optional slim input. The schema has always supported
              note.title; this exposes it directly so users can give a
              note a stable name instead of relying on derived previews. */}
          <View style={ed.titleWrap}>
            <TextInput
              style={ed.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Title (optional)"
              placeholderTextColor={C.inkFaint}
              multiline
              textAlignVertical="top"
              accessibilityLabel="Note title"
            />
          </View>

          {/* Tag row — fixed note-type chips and free-text custom tags
              on a single line, below the title. */}
          <TagRow
            selectedTypes={types}
            onToggle={toggleType}
            tags={tags}
            onTagsChange={setTags}
          />

          {/* Linked notes row — only renders when "Connection" is selected.
              This is what makes the Connection type behave like a real
              relationship instead of a label with no payload. */}
          {isConnection && (
            <View style={ed.linksWrap}>
              <View style={ed.linksHeader}>
                <Ionicons name="link" size={11} color={C.inkMuted} />
                <Text style={ed.linksHeaderTxt}>LINKED NOTES</Text>
              </View>
              <View style={ed.linksRow}>
                {linkedNoteIds.map(id => {
                  const linked = allNotes.find(n => n.id === id);
                  if (!linked) return null;
                  const label = linked.title?.trim()
                    || linked.text?.split('\n')[0]?.slice(0, 40)
                    || 'Untitled';
                  return (
                    <View key={id} style={ed.linkChip}>
                      <Text style={ed.linkChipTxt} numberOfLines={1}>{label}</Text>
                      <TouchableOpacity
                        onPress={() => setLinkedNoteIds(ids => ids.filter(x => x !== id))}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Ionicons name="close" size={11} color={C.inkMuted} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
                <TouchableOpacity
                  style={ed.addLinkBtn}
                  onPress={() => setLinksPickerOpen(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={13} color={C.inkSoft} />
                  <Text style={ed.addLinkTxt}>
                    {linkedNoteIds.length === 0 ? 'Link a note' : 'Add another'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <LinkedNotesPicker
            visible={linksPickerOpen}
            excludeNoteId={initialData?.id}
            selectedIds={linkedNoteIds}
            onChange={setLinkedNoteIds}
            onClose={() => setLinksPickerOpen(false)}
          />

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
                allNotes={allNotes}
                allBooks={allBooks}
              />
            );
          })}

          {/* Tail tap zone — fills empty space, lets user click below last
              block to focus a paragraph for fresh writing. If the last
              block is already a paragraph, focus it via its imperative
              handle so the user can keep typing; otherwise append a new
              paragraph and let autoFocus pull it in. */}
          <Pressable
            onPress={() => {
              const last = blocks[blocks.length - 1];
              if (last && last.type === 'paragraph') {
                blockRefs.current[last.id]?.focus?.();
                return;
              }
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
//   1. Book picker (skipped if defaultBook is passed or editing existing)
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
  // Restored draft from the autosave slot. When non-null, EditorScreen
  // receives it as initialData so the in-flight title/blocks/types/tags
  // load back into state instead of the empty defaults. Cleared once the
  // user saves, discards, or declines to restore.
  const [restoredDraft, setRestoredDraft] = useState(null);
  // Set by EditorScreen on mount with its dirty-aware cancel handler. Null
  // while the BookPicker step is showing — picker has no work to lose.
  const cancelGuardRef = useRef(null);

  useEffect(() => {
    if (visible && initialNote) {
      const book = books.find(b => b.id === initialNote.bookId);
      setPickedBook(book || null);
      setRestoredDraft(null);
      return;
    }
    if (!visible) {
      setPickedBook(null);
      setRestoredDraft(null);
      return;
    }

    // New-note flow. Check for an autosaved draft before falling back to
    // the default book or the picker. If a draft exists, ask the user
    // whether to restore — declining clears the draft so it doesn't keep
    // re-prompting every time they open the editor.
    let cancelled = false;
    (async () => {
      const draft = await readDraft();
      if (cancelled) return;
      if (draft) {
        const draftBook = books.find(b => b.id === draft.bookId) || defaultBook;
        Alert.alert(
          'Restore your unsaved note?',
          draftBook?.title ? `Pick up your draft on "${draftBook.title}".` : 'Pick up where you left off.',
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => {
                clearDraft();
                if (defaultBook) setPickedBook(defaultBook);
                else setPickedBook(null);
              },
            },
            {
              text: 'Restore',
              onPress: () => {
                setRestoredDraft(draft);
                setPickedBook(draftBook || null);
              },
            },
          ],
          { cancelable: false },
        );
        return;
      }
      if (defaultBook) setPickedBook(defaultBook);
      else setPickedBook(null);
    })();
    return () => { cancelled = true; };
  }, [visible, initialNote, defaultBook, books]);

  const handleCancel = () => {
    setPickedBook(null);
    onClose();
  };

  // Modal hardware-back / swipe-down path. Defers to the editor's confirm if
  // it has registered one, otherwise closes immediately.
  const handleRequestClose = () => {
    if (cancelGuardRef.current) cancelGuardRef.current();
    else handleCancel();
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
      onRequestClose={handleRequestClose}
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
            // A restored draft is wired in as initialData so the editor's
            // existing state seeding loads the recovered title/blocks/types
            // /tags. We deliberately omit `id` so the draft is treated as a
            // new note on save (creating, not updating).
            initialData={initialNote || restoredDraft || null}
            onSave={handleSaveFromEditor}
            onCancel={handleCancel}
            onChangeBook={!initialNote ? () => setPickedBook(null) : null}
            registerCancelGuard={(fn) => { cancelGuardRef.current = fn; }}
          />
        )}
      </SafeAreaProvider>
    </Modal>
  );
}
