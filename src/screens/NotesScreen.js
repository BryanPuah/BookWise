/**
 * NotesScreen — Knowledge Base, Figma-aligned
 *
 * Two-view architecture:
 *  1. EXPLORE — flat browse, filterable by genre + note type, with search
 *  2. BY BOOK — notes grouped under their book, tap to open dedicated view
 *
 * Theme: matches Library page (navy ink, sandy gold tag pills, sage accents).
 * Top app bar reused from AppHeader component.
 * The "+ Add Note" FAB lives in App.js — no in-screen add button.
 *
 * Preserved logic: addNote, updateNote, deleteNote, addCard, generateFlashcard,
 * search, type filters, starring, BookNotesScreen, AddNoteModal, EditNoteModal.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Modal, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { generateFlashcard } from '../services/ai';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { AppHeader } from '../components/AppHeader';
import { RichNoteEditor } from '../components/RichNoteEditor';
import { MarkdownText } from '../components/MarkdownText';
import { C, F } from '../theme';

// ── Note type definitions (preserved) ─────────────────────────────────
const NT = {
  quote:      { label: 'Quote',      icon: '💬', color: C.ink, bg: C.cream,     desc: 'Direct words from the author' },
  insight:    { label: 'Insight',    icon: '💡', color: C.ink, bg: C.amberPale, desc: 'Your own interpretation or realisation' },
  question:   { label: 'Question',   icon: '🔍', color: C.ink, bg: C.cream,     desc: 'Something you want to investigate further' },
  action:     { label: 'Action',     icon: '✅', color: C.ink, bg: C.sagePale,  desc: 'Something you will apply or do' },
  summary:    { label: 'Summary',    icon: '📌', color: C.ink, bg: C.amberPale, desc: 'Distilled key idea from a chapter' },
  connection: { label: 'Connection', icon: '🔗', color: C.ink, bg: C.sagePale,  desc: 'This idea connects to another book or note' },
};

// Returns true if `note` carries the given type tag — checks the multi-type
// `types[]` array first, then falls back to the legacy single `type` field.
// Used by all type-filtering / type-grouping code so a note tagged with
// both "insight" and "question" appears under BOTH categories.
function noteHasType(note, typeKey) {
  if (Array.isArray(note.types) && note.types.includes(typeKey)) return true;
  return note.type === typeKey;
}

// ── Helpers ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
}

// ── Edit Note Modal ───────────────────────────────────────────────────
function EditNoteModal({ visible, note, onSave, onClose }) {
  const [text, setText]         = useState('');
  const [thinking, setThinking] = useState('');
  const [page, setPage]         = useState('');
  const [chapter, setChapter]   = useState('');
  const [type, setType]         = useState('insight');

  React.useEffect(() => {
    if (note) {
      setText(String(note.text || ''));
      setThinking(String(note.thinking || ''));
      setPage(String(note.page || ''));
      setChapter(String(note.chapter || ''));
      setType(note.type || 'insight');
    }
  }, [note]);

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      text:     text.trim(),
      thinking: String(thinking || '').trim(),
      page:     String(page     || '').trim(),
      chapter:  String(chapter  || '').trim(),
      type,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={mo.safe}>
        <View style={mo.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={mo.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={mo.title}>Edit Note</Text>
          <TouchableOpacity onPress={handleSave} disabled={!text.trim()}>
            <Text style={[mo.save, !text.trim() && mo.saveOff]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={mo.scroll} keyboardShouldPersistTaps="handled">
          {note && (
            <View style={mo.bookCtx}>
              <Text style={mo.bookCtxLbl}>EDITING NOTE FROM</Text>
              <Text style={mo.bookCtxTitle} numberOfLines={2}>{note.bookTitle}</Text>
              {note.page ? (
                <Text style={mo.bookCtxMeta}>
                  Page {note.page}{note.chapter ? ` · ${note.chapter}` : ''}
                </Text>
              ) : null}
            </View>
          )}

          <Text style={mo.label}>NOTE TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {Object.entries(NT).map(([key, val]) => (
              <TouchableOpacity key={key}
                style={[mo.typePill, type === key && mo.typePillActive]}
                onPress={() => setType(key)} activeOpacity={0.8}>
                <Text style={mo.typePillIcon}>{val.icon}</Text>
                <Text style={[mo.typePillTxt, type === key && mo.typePillTxtActive]}>{val.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={mo.label}>
            {type === 'quote' ? 'QUOTE' : type === 'question' ? 'QUESTION' :
             type === 'action' ? 'ACTION' : type === 'summary' ? 'SUMMARY' :
             type === 'connection' ? 'CONNECTING IDEA' : 'INSIGHT'}
          </Text>
          <TextInput style={mo.mainInput}
            value={text} onChangeText={setText} multiline numberOfLines={5}
            textAlignVertical="top" placeholderTextColor={C.inkFaint}
            placeholder="Edit your note..." />

          <Text style={mo.label}>MY THINKING <Text style={mo.optional}>— your reflection</Text></Text>
          <TextInput style={mo.thinkInput}
            value={thinking} onChangeText={setThinking} multiline numberOfLines={3}
            textAlignVertical="top" placeholderTextColor={C.inkFaint}
            placeholder="Your reflection or interpretation..." />

          <Text style={mo.label}>LOCATION</Text>
          <View style={mo.locRow}>
            <View style={{ flex: 1 }}>
              <Text style={mo.locLabel}>Page</Text>
              <TextInput style={mo.locInput} value={page} onChangeText={setPage}
                keyboardType="numeric" placeholder="e.g. 148" placeholderTextColor={C.inkFaint} />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={mo.locLabel}>Chapter / Section</Text>
              <TextInput style={mo.locInput} value={chapter} onChangeText={setChapter}
                placeholder="e.g. Chapter 4" placeholderTextColor={C.inkFaint} />
            </View>
          </View>
          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Add Note Modal — 2-step (preserved logic, restyled) ───────────────
function AddNoteModal({ visible, books, onSave, onClose }) {
  const [step, setStep]         = useState(1);
  const [bookId, setBookId]     = useState('');
  const [type, setType]         = useState('insight');
  const [text, setText]         = useState('');
  const [thinking, setThinking] = useState('');
  const [page, setPage]         = useState('');
  const [chapter, setChapter]   = useState('');

  const activeBooks = books.filter(b => b.status !== 'want_to_read');
  const selectedBook = books.find(b => b.id === bookId);

  const reset = () => {
    setStep(1); setBookId(''); setType('insight');
    setText(''); setThinking(''); setPage(''); setChapter('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = () => {
    if (!text.trim() || !bookId) return;
    onSave({
      bookId,
      bookTitle: selectedBook?.title || '',
      type, text: text.trim(),
      thinking: thinking.trim(),
      page: String(page || '').trim(),
      chapter: String(chapter || '').trim(),
    });
    reset(); onClose();
  };

  const t = NT[type] || NT.insight;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={mo.safe}>

        {step === 1 && (
          <>
            <View style={mo.header}>
              <TouchableOpacity onPress={handleClose}>
                <Text style={mo.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={mo.title}>New Note</Text>
              <View style={{ width: 52 }} />
            </View>

            <View style={mo.step1Strip}>
              <Text style={mo.step1StripTxt}>Which book is this note about?</Text>
            </View>

            {activeBooks.length === 0 && (
              <View style={mo.emptyBooks}>
                <Text style={mo.emptyBooksIcon}>📚</Text>
                <Text style={mo.emptyBooksTxt}>No books in progress</Text>
                <Text style={mo.emptyBooksSub}>
                  Add a book from Discover and start reading to attach notes.
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20, gap: 10 }}>
              {activeBooks.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[mo.bookRow, bookId === b.id && mo.bookRowActive]}
                  onPress={() => { setBookId(b.id); setStep(2); }}
                  activeOpacity={0.8}
                >
                  <BookCover title={b.title} author={b.author} cover={b.cover}
                    coverId={b.coverId} width={48} height={68} />
                  <View style={mo.bookRowInfo}>
                    <Text style={mo.bookRowTitle} numberOfLines={2}>{b.title}</Text>
                    <Text style={mo.bookRowAuthor}>{b.author}</Text>
                    <View style={mo.bookRowStatus}>
                      <Text style={mo.bookRowStatusTxt}>
                        {b.status === 'reading' ? '📖 Reading'
                          : b.status === 'finished' ? '✓ Finished'
                          : 'Want to read'}
                      </Text>
                    </View>
                  </View>
                  <Text style={mo.bookRowArrow}>›</Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </>
        )}

        {step === 2 && (
          <>
            <View style={mo.header}>
              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={mo.cancel}>← Back</Text>
              </TouchableOpacity>
              <Text style={mo.title}>New Note</Text>
              <TouchableOpacity onPress={handleSave} disabled={!text.trim()}>
                <Text style={[mo.save, !text.trim() && mo.saveOff]}>Save</Text>
              </TouchableOpacity>
            </View>

            {selectedBook && (
              <TouchableOpacity style={mo.selectedBookBanner} onPress={() => setStep(1)} activeOpacity={0.8}>
                <BookCover title={selectedBook.title} author={selectedBook.author}
                  cover={selectedBook.cover} coverId={selectedBook.coverId} width={32} height={44} />
                <View style={{ flex: 1 }}>
                  <Text style={mo.selectedBookTitle} numberOfLines={1}>{selectedBook.title}</Text>
                  <Text style={mo.selectedBookAuthor}>{selectedBook.author}</Text>
                </View>
                <Text style={mo.selectedBookChange}>Change</Text>
              </TouchableOpacity>
            )}

            <ScrollView style={mo.scroll} keyboardShouldPersistTaps="handled">
              <Text style={mo.label}>NOTE TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {Object.entries(NT).map(([key, val]) => (
                  <TouchableOpacity key={key}
                    style={[mo.typePill, type === key && mo.typePillActive]}
                    onPress={() => setType(key)} activeOpacity={0.8}>
                    <Text style={mo.typePillIcon}>{val.icon}</Text>
                    <Text style={[mo.typePillTxt, type === key && mo.typePillTxtActive]}>{val.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={mo.typeHint}>{t.desc}</Text>

              <Text style={mo.label}>
                {type === 'quote' ? 'QUOTE' : type === 'question' ? 'QUESTION' :
                 type === 'action' ? 'ACTION' : type === 'summary' ? 'SUMMARY' :
                 type === 'connection' ? 'CONNECTING IDEA' : 'INSIGHT'}
              </Text>
              <TextInput style={mo.mainInput}
                value={text} onChangeText={setText} multiline numberOfLines={4}
                textAlignVertical="top" placeholderTextColor={C.inkFaint}
                autoFocus
                placeholder={
                  type === 'quote'      ? 'Paste or type the exact words...' :
                  type === 'question'   ? 'What do you want to investigate?' :
                  type === 'action'     ? 'What will you specifically do?' :
                  type === 'summary'    ? 'Distil the chapter to its core idea...' :
                  type === 'connection' ? 'What idea connects across books?' :
                  'What did you realise or understand?'
                } />

              <Text style={mo.label}>
                MY THINKING <Text style={mo.optional}>— why this matters to you</Text>
              </Text>
              <TextInput style={mo.thinkInput}
                value={thinking} onChangeText={setThinking} multiline numberOfLines={3}
                textAlignVertical="top" placeholderTextColor={C.inkFaint}
                placeholder="How does this change how you think or act?" />

              <Text style={mo.label}>LOCATION</Text>
              <View style={mo.locRow}>
                <View style={{ flex: 1 }}>
                  <Text style={mo.locLabel}>Page</Text>
                  <TextInput style={mo.locInput} value={page} onChangeText={setPage}
                    keyboardType="numeric" placeholder="e.g. 148" placeholderTextColor={C.inkFaint} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={mo.locLabel}>Chapter / Section</Text>
                  <TextInput style={mo.locInput} value={chapter} onChangeText={setChapter}
                    placeholder="e.g. Chapter 4" placeholderTextColor={C.inkFaint} />
                </View>
              </View>

              <View style={{ height: 48 }} />
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ── Note card ──────────────────────────────────────────────────────────
export function NoteCard({ note, onDelete, onEdit, showBook = false }) {
  const hasBlocks = Array.isArray(note.blocks) && note.blocks.length > 0;

  // Types row — multi-type if note.types[] exists, otherwise primary type
  const typesList = Array.isArray(note.types) && note.types.length
    ? note.types
    : [note.type || 'insight'];

  // Find first image block (if any) — used to show a thumbnail on the card
  const firstImageBlock = hasBlocks
    ? note.blocks.find(b => b.type === 'image' && b.uri)
    : null;

  // Body — first paragraph block for block-based notes; legacy text otherwise.
  // If the only content is image(s), fall back to caption or empty.
  let bodyText = '';
  if (hasBlocks) {
    const firstPara = note.blocks.find(b => b.type === 'paragraph' && b.text?.trim());
    const firstAny  = note.blocks.find(b => b.text?.trim());
    bodyText = (firstPara || firstAny)?.text || '';
  } else {
    bodyText = note.text || '';
  }

  // Title — explicit title field if present, otherwise derive from first line
  // of body (helps legacy notes render with a serif heading too).
  // If image-only with no caption, fall back to "Image note".
  const isImageOnly = !bodyText && firstImageBlock;
  const cardTitle = note.title?.trim()
    ? note.title.trim()
    : isImageOnly
      ? 'Image note'
      : bodyText.split('\n')[0].split('. ')[0].slice(0, 80);
  const cardBody = note.title?.trim()
    ? bodyText
    : isImageOnly
      ? ''
      : bodyText.slice(cardTitle.length).replace(/^[\.\s]+/, '');

  // Render right-side delete action when swiped
  const renderRightActions = () => (
    <View style={nc.deleteAction}>
      <TouchableOpacity
        style={nc.deleteBtn}
        onPress={() => onDelete(note.id)}
        activeOpacity={0.85}
      >
        <Ionicons name="trash-outline" size={20} color={C.white} />
        <Text style={nc.deleteTxt}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity
        style={nc.card}
        onPress={() => onEdit && onEdit(note)}
        activeOpacity={0.85}
      >
        {/* Top row: date + type tags */}
        <View style={nc.topRow}>
          <Text style={nc.date}>{formatDate(note.date)}</Text>
          <View style={nc.typesWrap}>
            {typesList.slice(0, 3).map(typeKey => {
              const meta = NT[typeKey] || NT.insight;
              return (
                <View key={typeKey} style={nc.typePill}>
                  <Text style={nc.typePillTxt}>{meta.label.toUpperCase()}</Text>
                </View>
              );
            })}
            {typesList.length > 3 && (
              <View style={nc.typePill}>
                <Text style={nc.typePillTxt}>+{typesList.length - 3}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Serif title */}
        {cardTitle ? (
          <MarkdownText style={nc.cardTitle} numberOfLines={2}>
            {cardTitle}
          </MarkdownText>
        ) : null}

        {/* Image thumbnail — shown when note has an image block */}
        {firstImageBlock ? (
          <Image
            source={{ uri: firstImageBlock.uri }}
            style={nc.thumbnail}
            resizeMode="cover"
          />
        ) : null}

        {/* Body paragraph — muted, 3 lines max */}
        {cardBody ? (
          <MarkdownText style={nc.bodyText} numberOfLines={3}>
            {cardBody}
          </MarkdownText>
        ) : null}

        {/* Book reference at the bottom */}
        {showBook && (
          <View style={nc.bookRefRow}>
            <Ionicons name="book-outline" size={13} color={C.inkMuted} />
            <Text style={nc.bookRef} numberOfLines={1}>{note.bookTitle}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

// ── Explore view — flat browse, dual filters (genre + type) ───────────
function ExploreView({ notes, cards, books, onStar, onDelete, onMakeCard, generating, onEdit }) {
  const [search, setSearch] = useState('');
  const cardNoteIds = new Set(cards.map(c => c.noteId));

  const filtered = useMemo(() => {
    let list = notes;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.text || '').toLowerCase().includes(q) ||
        (n.title || '').toLowerCase().includes(q) ||
        (n.thinking || '').toLowerCase().includes(q) ||
        (n.bookTitle || '').toLowerCase().includes(q) ||
        (n.chapter || '').toLowerCase().includes(q)
      );
    }

    // Sort: starred first, then most recent
    return [...list.filter(n => n.starred), ...list.filter(n => !n.starred)]
      .sort((a, b) => {
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return new Date(b.date) - new Date(a.date);
      });
  }, [notes, search]);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Search */}
      <View style={ev.searchWrap}>
        <Ionicons name="search" size={16} color={C.inkMuted} />
        <TextInput style={ev.search} value={search} onChangeText={setSearch}
          placeholder="Search your digital garden..."
          placeholderTextColor={C.inkFaint} />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Notes list */}
      <View style={ev.listWrap}>
        {filtered.length === 0 && (
          <View style={ev.emptyState}>
            <Text style={ev.emptyStateTitle}>
              {search ? 'No notes match your search' : 'No notes yet'}
            </Text>
            <Text style={ev.emptyStateSub}>
              {search ? 'Try different keywords'
                : 'Tap the + button below to capture your first thought'}
            </Text>
          </View>
        )}
        {filtered.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            onDelete={onDelete}
            onEdit={onEdit}
            showBook
          />
        ))}
      </View>
      <View style={{ height: 140 }} />
    </ScrollView>
  );
}

// ── Book Notes Screen — dedicated full-screen notes for one book ────────
function BookNotesScreen({ book, notes, cards, onStar, onDelete, onMakeCard, generating, onEdit, onBack, navigation }) {
  const cardNoteIds = new Set(cards.map(c => c.noteId));
  const starred     = notes.filter(n => n.starred).length;

  const typeCounts = Object.entries(NT).reduce((a, [k]) => {
    const c = notes.filter(n => noteHasType(n, k)).length;
    if (c > 0) a.push({ key: k, count: c, ...NT[k] });
    return a;
  }, []);

  const sorted = [...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={bns.header}>
        <TouchableOpacity onPress={onBack} style={bns.backBtn} activeOpacity={0.8}>
          <Text style={bns.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={bns.headerInfo}>
          <BookCover title={book.title} author={book.author} cover={book.cover}
            coverId={book.coverId} width={48} height={68} />
          <View style={{ flex: 1 }}>
            <Text style={bns.bookTitle} numberOfLines={2}>{book.title}</Text>
            <Text style={bns.bookAuthor}>{book.author}</Text>
            <View style={bns.countRow}>
              <Text style={bns.noteCount}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
              {starred > 0 && <Text style={bns.starCount}>★ {starred}</Text>}
            </View>
          </View>
          <TouchableOpacity
            style={bns.openBtn}
            onPress={() => navigation.navigate('Library', { screen: 'BookDetail', params: { bookId: book.id } })}
            activeOpacity={0.85}
          >
            <Text style={bns.openBtnTxt}>Open</Text>
          </TouchableOpacity>
        </View>
        {typeCounts.length > 0 && (
          <View style={bns.typePills}>
            {typeCounts.map(tc => (
              <View key={tc.key} style={[bns.typeTag, { backgroundColor: tc.bg }]}>
                <Text style={bns.typeTagTxt}>{tc.icon} {tc.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        {sorted.length === 0 && (
          <View style={bns.empty}>
            <Text style={bns.emptyIcon}>📝</Text>
            <Text style={bns.emptyTitle}>No notes yet</Text>
            <Text style={bns.emptySub}>Tap the + button to capture your first thought.</Text>
          </View>
        )}
        {sorted.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── By Book view ───────────────────────────────────────────────────────
function ByBookView({ notes, books, cards, onStar, onDelete, onMakeCard, generating, navigation, onEdit }) {
  const [selectedBook, setSelectedBook] = useState(null);

  const grouped = useMemo(() => {
    const ids = [...new Set(notes.map(n => n.bookId))];
    return ids.map(id => ({
      book: books.find(b => b.id === id),
      notes: notes.filter(n => n.bookId === id),
    })).filter(g => g.book);
  }, [notes, books]);

  if (selectedBook) {
    const group = grouped.find(g => g.book.id === selectedBook);
    if (group) {
      return (
        <BookNotesScreen
          book={group.book}
          notes={group.notes}
          cards={cards}
          onStar={onStar}
          onDelete={onDelete}
          onMakeCard={onMakeCard}
          generating={generating}
          onEdit={onEdit}
          onBack={() => setSelectedBook(null)}
          navigation={navigation}
        />
      );
    }
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {grouped.length === 0 && (
          <View style={bbv.empty}>
            <Text style={bbv.emptyIcon}>📚</Text>
            <Text style={bbv.emptyTitle}>No notes yet</Text>
            <Text style={bbv.emptySub}>
              Tap the + button to capture your first thought.
            </Text>
          </View>
        )}
        {grouped.map(({ book, notes: bn }) => {
          const starred = bn.filter(n => n.starred).length;
          const typeCounts = Object.entries(NT).reduce((a, [k]) => {
            const c = bn.filter(n => n.type === k).length;
            if (c > 0) a.push({ key: k, count: c, ...NT[k] });
            return a;
          }, []);

          return (
            <TouchableOpacity
              key={book.id}
              style={bbv.bookBlock}
              onPress={() => setSelectedBook(book.id)}
              activeOpacity={0.85}
            >
              <View style={bbv.bookHead}>
                <BookCover title={book.title} author={book.author} cover={book.cover}
                  coverId={book.coverId} width={48} height={68} />
                <View style={bbv.bookMeta}>
                  <Text style={bbv.bookTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={bbv.bookAuthor}>{book.author}</Text>
                  <View style={bbv.countRow}>
                    <Text style={bbv.noteCount}>{bn.length} note{bn.length !== 1 ? 's' : ''}</Text>
                    {starred > 0 && <Text style={bbv.starCount}>★ {starred}</Text>}
                  </View>
                  <View style={bbv.typePills}>
                    {typeCounts.slice(0, 4).map(tc => (
                      <View key={tc.key} style={[bbv.typeTag, { backgroundColor: tc.bg }]}>
                        <Text style={bbv.typeTagTxt}>{tc.icon} {tc.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.inkFaint} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 140 }} />
    </ScrollView>
  );
}

// ── Type Notes Screen — dedicated full-screen notes for one type ───────
function TypeNotesScreen({ typeKey, typeMeta, notes, onDelete, onEdit, onBack }) {
  const starred = notes.filter(n => n.starred).length;
  const sorted  = [...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      <View style={tns.header}>
        <TouchableOpacity onPress={onBack} style={tns.backBtn} activeOpacity={0.8}>
          <Text style={tns.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={tns.headerInfo}>
          <View style={[tns.iconWrap, { backgroundColor: typeMeta.bg }]}>
            <Text style={tns.icon}>{typeMeta.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={tns.typeTitle}>{typeMeta.label}</Text>
            <Text style={tns.typeDesc}>{typeMeta.desc}</Text>
            <View style={tns.countRow}>
              <Text style={tns.noteCount}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
              {starred > 0 && <Text style={tns.starCount}>★ {starred}</Text>}
            </View>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        {sorted.length === 0 && (
          <View style={tns.empty}>
            <Text style={tns.emptyIcon}>{typeMeta.icon}</Text>
            <Text style={tns.emptyTitle}>No {typeMeta.label.toLowerCase()} notes yet</Text>
            <Text style={tns.emptySub}>Tap the + button to capture your first thought.</Text>
          </View>
        )}
        {sorted.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            onDelete={onDelete}
            onEdit={onEdit}
            showBook
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── By Type view — list of types, tap to drill in ─────────────────────
function ByTypeView({ notes, cards, onDelete, onEdit }) {
  const [selectedType, setSelectedType] = useState(null);

  // Group notes by type, keeping only types that have notes
  const grouped = useMemo(() => {
    return Object.entries(NT).reduce((acc, [key, meta]) => {
      const typeNotes = notes.filter(n => noteHasType(n, key));
      if (typeNotes.length > 0) {
        acc.push({ key, meta, notes: typeNotes });
      }
      return acc;
    }, []);
  }, [notes]);

  // Drill-down view
  if (selectedType) {
    const group = grouped.find(g => g.key === selectedType);
    if (group) {
      return (
        <TypeNotesScreen
          typeKey={group.key}
          typeMeta={group.meta}
          notes={group.notes}
          onDelete={onDelete}
          onEdit={onEdit}
          onBack={() => setSelectedType(null)}
        />
      );
    }
  }

  // List view
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {grouped.length === 0 && (
          <View style={btv.empty}>
            <Text style={btv.emptyIcon}>📝</Text>
            <Text style={btv.emptyTitle}>No notes yet</Text>
            <Text style={btv.emptySub}>
              Tap the + button to capture your first thought.
            </Text>
          </View>
        )}
        {grouped.map(({ key, meta, notes: tn }) => {
          const starred = tn.filter(n => n.starred).length;
          return (
            <TouchableOpacity
              key={key}
              style={btv.typeBlock}
              onPress={() => setSelectedType(key)}
              activeOpacity={0.85}
            >
              <View style={btv.typeHead}>
                <View style={[btv.iconWrap, { backgroundColor: meta.bg }]}>
                  <Text style={btv.icon}>{meta.icon}</Text>
                </View>
                <View style={btv.typeMeta}>
                  <Text style={btv.typeTitle}>{meta.label}</Text>
                  <Text style={btv.typeDesc} numberOfLines={1}>{meta.desc}</Text>
                  <View style={btv.countRow}>
                    <Text style={btv.noteCount}>{tn.length} note{tn.length !== 1 ? 's' : ''}</Text>
                    {starred > 0 && <Text style={btv.starCount}>★ {starred}</Text>}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.inkFaint} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 140 }} />
    </ScrollView>
  );
}


export function NotesScreen({ navigation }) {
  const { notes, books, cards, addNote, addCard, deleteNote, updateNote } = useStore();
  const [view, setView]                   = useState('explore');
  const [showModal, setShowModal]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNote, setEditNote]           = useState(null);
  const [generating, setGenerating]       = useState(null);

  const handleSave = (data) => {
    addNote({
      id:        Date.now().toString(),
      bookId:    data.bookId,
      bookTitle: data.bookTitle,
      title:     data.title || '',
      blocks:    data.blocks || [],
      types:     data.types || [data.type || 'insight'],
      type:      data.type,           // legacy single-type, kept for filters
      text:      data.text,            // flattened body string, kept for search
      thinking:  data.thinking || '',  // legacy, mostly empty now
      page:      data.page || '',
      chapter:   data.chapter || '',
      isQuote:   data.type === 'quote',
      starred:   false,
      date:      new Date().toISOString().slice(0, 10),
    });
  };

  const handleEdit = (note) => {
    setEditNote(note);
    setShowEditModal(true);
  };

  const handleSaveEdit = (data) => {
    if (editNote) {
      updateNote(editNote.id, {
        title:    data.title || '',
        blocks:   data.blocks || [],
        types:    data.types || [data.type || 'insight'],
        type:     data.type,
        text:     data.text,
        thinking: data.thinking || '',
        page:     data.page || '',
        chapter:  data.chapter || '',
        isQuote:  data.type === 'quote',
      });
    }
    setEditNote(null);
  };

  const handleStar = (id) => {
    const note = notes.find(n => n.id === id);
    if (note) updateNote(id, { starred: !note.starred });
  };

  const handleDelete = (id) => deleteNote(id);

  const handleMakeCard = async (note) => {
    const book = books.find(b => b.id === note.bookId);
    setGenerating(note.id);
    try {
      const fullText = note.thinking
        ? `${note.text}\n\nMy thinking: ${note.thinking}`
        : note.text;
      const card = await generateFlashcard(fullText, note.bookTitle, book?.author || '');
      addCard({
        id: Date.now().toString(), noteId: note.id,
        bookId: note.bookId, bookTitle: note.bookTitle,
        question: card.question, answer: card.answer,
        due: new Date().toISOString(),
      });
    } catch (e) { console.log('Card gen failed:', e); }
    finally { setGenerating(null); }
  };

  const VIEWS = [
    { key: 'explore',  label: 'Explore' },
    { key: 'by_book',  label: 'By Book' },
    { key: 'by_type',  label: 'Note Type' },
  ];

  const sharedProps = {
    notes, books, cards,
    onStar: handleStar,
    onDelete: handleDelete,
    onMakeCard: handleMakeCard,
    onEdit: handleEdit,
    generating,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* RichNoteEditor handles both new note + edit flows */}
      <RichNoteEditor
        visible={showModal || showEditModal}
        books={books}
        initialNote={showEditModal ? editNote : null}
        onSave={(data) => {
          if (showEditModal && editNote) {
            handleSaveEdit(data);
            setShowEditModal(false);
            setEditNote(null);
          } else {
            handleSave(data);
            setShowModal(false);
          }
        }}
        onClose={() => {
          setShowModal(false);
          setShowEditModal(false);
          setEditNote(null);
        }}
      />

      {/* Top app bar */}
      <AppHeader onAvatarPress={() => navigation.navigate('Library', { screen: 'Profile' })} />

      {/* Tab strip */}
      <View style={s.tabStrip}>
        {VIEWS.map(v => {
          const isActive = view === v.key;
          return (
            <TouchableOpacity
              key={v.key}
              style={s.tab}
              onPress={() => setView(v.key)}
              activeOpacity={0.6}
            >
              <Text style={[s.tabTxt, isActive && s.tabTxtActive]}>{v.label}</Text>
              {isActive && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Views */}
      {view === 'explore' && <ExploreView {...sharedProps} />}
      {view === 'by_book' && <ByBookView {...sharedProps} navigation={navigation} />}
      {view === 'by_type' && <ByTypeView notes={notes} cards={cards} onDelete={handleDelete} onEdit={handleEdit} />}

    </SafeAreaView>
  );
}

// ── Main screen styles ────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  tabStrip: {
    flexDirection: 'row',
    gap: 28,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    marginBottom: 8,
  },
  tab: { paddingBottom: 12, paddingTop: 4 },
  tabTxt: { fontSize: 14, color: C.inkMuted, fontWeight: '500' },
  tabTxtActive: { color: C.ink, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: C.ink, borderRadius: 1,
  },
});

// ── Modal styles ──────────────────────────────────────────────────────
const mo = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
  cancel: { fontSize: 14, color: C.inkMuted },
  save: { fontSize: 14, color: C.ink, fontWeight: '700' },
  saveOff: { opacity: 0.3 },
  scroll: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', color: C.inkMuted, letterSpacing: 1, marginHorizontal: 20, marginTop: 22, marginBottom: 8 },
  optional: { fontWeight: '400', color: C.inkFaint },

  step1Strip: { backgroundColor: C.cream, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 20, paddingVertical: 14 },
  step1StripTxt: { fontFamily: F.serif, fontSize: 17, color: C.ink, letterSpacing: -0.2 },

  emptyBooks: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyBooksIcon: { fontSize: 40, marginBottom: 12 },
  emptyBooksTxt: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
  emptyBooksSub: { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },

  bookRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  bookRowActive: { borderColor: C.ink, backgroundColor: C.amberPale },
  bookRowInfo: { flex: 1 },
  bookRowTitle: { fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 20, marginBottom: 3 },
  bookRowAuthor: { fontSize: 12, color: C.inkMuted, marginBottom: 8 },
  bookRowStatus: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: C.amberPale },
  bookRowStatusTxt: { fontSize: 11, fontWeight: '600', color: C.ink },
  bookRowArrow: { fontSize: 22, color: C.inkFaint, fontWeight: '300' },

  selectedBookBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.cream, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  selectedBookTitle: { fontSize: 13, fontWeight: '700', color: C.ink },
  selectedBookAuthor: { fontSize: 11, color: C.inkMuted, marginTop: 2 },
  selectedBookChange: { fontSize: 12, color: C.ink, fontWeight: '600' },

  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
  typePillActive: { backgroundColor: C.ink, borderColor: C.ink },
  typePillIcon: { fontSize: 13 },
  typePillTxt: { fontSize: 12, fontWeight: '600', color: C.inkSoft },
  typePillTxtActive: { color: C.white },
  typeHint: { fontSize: 12, color: C.inkMuted, fontStyle: 'italic', marginHorizontal: 20, marginTop: 8 },

  mainInput: { marginHorizontal: 20, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, fontSize: 14, color: C.ink, minHeight: 100, textAlignVertical: 'top', lineHeight: 22 },
  thinkInput: { marginHorizontal: 20, backgroundColor: C.sagePale, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(122,139,94,0.25)', padding: 14, fontSize: 14, color: C.ink, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },

  locRow: { flexDirection: 'row', marginHorizontal: 20, gap: 10 },
  locLabel: { fontSize: 10, color: C.inkMuted, fontWeight: '600', marginBottom: 5 },
  locInput: { backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 13, color: C.ink },

  bookCtx: { marginHorizontal: 20, marginTop: 16, backgroundColor: C.cream, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  bookCtxLbl: { fontSize: 10, fontWeight: '700', color: C.inkMuted, letterSpacing: 0.8, marginBottom: 4 },
  bookCtxTitle: { fontFamily: F.serif, fontSize: 16, color: C.ink },
  bookCtxMeta: { fontSize: 11, color: C.inkMuted, marginTop: 4 },
});

// ── Note card styles — Figma-aligned ──────────────────────────────────
const nc = StyleSheet.create({
  // Card — wraps inside Swipeable so corner radius applies cleanly
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
  },

  // Top row — date stamp on left, tag chips on right
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  date: {
    fontSize: 10,
    color: C.inkMuted,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  typesWrap: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 1,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  typePill: {
    backgroundColor: C.amberPale,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typePillTxt: {
    fontSize: 9,
    fontWeight: '700',
    color: C.ink,
    letterSpacing: 0.5,
  },

  // Serif title — the visual anchor of the card
  cardTitle: {
    fontFamily: F.serif,
    fontSize: 19,
    color: C.ink,
    letterSpacing: -0.3,
    lineHeight: 26,
    marginBottom: 8,
  },

  // Image thumbnail on note cards with image blocks
  thumbnail: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: C.cream,
    marginBottom: 8,
  },

  // Body text — muted grey, 14px, 3 lines max
  bodyText: {
    fontSize: 14,
    color: C.inkMuted,
    lineHeight: 21,
  },

  // Book reference row at the bottom
  bookRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  bookRef: {
    flex: 1,
    fontSize: 12,
    color: C.inkMuted,
    fontWeight: '500',
  },

  // Swipe-to-delete action — slides in from the right
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  deleteBtn: {
    backgroundColor: C.rose,
    borderRadius: 14,
    width: 90,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteTxt: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});

// ── Explore view styles ───────────────────────────────────────────────
const ev = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cream,
    borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    marginHorizontal: 20, marginTop: 8, marginBottom: 14,
    gap: 10,
  },
  search: { flex: 1, fontSize: 15, color: C.ink },
  filterSection: { marginBottom: 10 },
  genreChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: C.amberPale,
  },
  genreChipActive: { backgroundColor: C.ink },
  genreChipTxt: { fontSize: 12, fontWeight: '600', color: C.ink },
  genreChipTxtActive: { color: C.white },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: C.cream,
    borderWidth: 1, borderColor: C.border,
  },
  typeChipActive: { backgroundColor: C.sagePale, borderColor: C.sage },
  typeChipIcon: { fontSize: 13 },
  typeChipTxt: { fontSize: 12, fontWeight: '600', color: C.inkSoft },
  typeChipTxtActive: { color: C.ink, fontWeight: '700' },
  listWrap: { paddingHorizontal: 20, paddingTop: 12 },
  emptyState: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 30 },
  emptyStateTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6, textAlign: 'center' },
  emptyStateSub: { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
});

// ── By Book view styles ───────────────────────────────────────────────
const bbv = StyleSheet.create({
  bookBlock: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  bookHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  bookMeta: { flex: 1 },
  bookTitle: { fontFamily: F.serif, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
  bookAuthor: { fontSize: 11, color: C.inkMuted, marginTop: 2 },
  countRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  noteCount: { fontSize: 11, color: C.inkMuted },
  starCount: { fontSize: 11, color: C.amber, fontWeight: '600' },
  typePills: { flexDirection: 'row', gap: 5, marginTop: 7, flexWrap: 'wrap' },
  typeTag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  typeTagTxt: { fontSize: 10, fontWeight: '700', color: C.ink },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
});

// ── BookNotesScreen styles ────────────────────────────────────────────
const bns = StyleSheet.create({
  header: { backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 14 },
  backBtn: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, alignSelf: 'flex-start' },
  backTxt: { fontSize: 14, color: C.inkSoft, fontWeight: '600' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  bookTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, lineHeight: 24, letterSpacing: -0.2 },
  bookAuthor: { fontSize: 12, color: C.inkMuted, marginTop: 2 },
  countRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  noteCount: { fontSize: 11, color: C.inkMuted },
  starCount: { fontSize: 11, color: C.amber, fontWeight: '600' },
  typePills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: 20, marginTop: 12 },
  typeTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typeTagTxt: { fontSize: 11, fontWeight: '700', color: C.ink },
  openBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: C.ink },
  openBtnTxt: { fontSize: 12, color: C.white, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
});

// ── ByTypeView styles ─────────────────────────────────────────────────
const btv = StyleSheet.create({
  typeBlock: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  typeHead: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  typeMeta: { flex: 1 },
  typeTitle: { fontFamily: F.serif, fontSize: 16, color: C.ink, letterSpacing: -0.2 },
  typeDesc: { fontSize: 11, color: C.inkMuted, marginTop: 2 },
  countRow: { flexDirection: 'row', gap: 10, marginTop: 5 },
  noteCount: { fontSize: 11, color: C.inkMuted },
  starCount: { fontSize: 11, color: C.amber, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
});

// ── TypeNotesScreen styles ────────────────────────────────────────────
const tns = StyleSheet.create({
  header: { backgroundColor: C.white, borderBottomWidth: 0.5, borderBottomColor: C.border, paddingBottom: 18 },
  backBtn: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, alignSelf: 'flex-start' },
  backTxt: { fontSize: 14, color: C.inkSoft, fontWeight: '600' },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 24 },
  typeTitle: { fontFamily: F.serif, fontSize: 20, color: C.ink, lineHeight: 26, letterSpacing: -0.3 },
  typeDesc: { fontSize: 12, color: C.inkMuted, marginTop: 3 },
  countRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  noteCount: { fontSize: 11, color: C.inkMuted },
  starCount: { fontSize: 11, color: C.amber, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
  emptySub: { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
});