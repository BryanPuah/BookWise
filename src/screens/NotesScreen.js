/**
 * NotesScreen — Knowledge Base
 *
 * Three-view architecture:
 *  1. DIGEST  — daily surfaced notes (spaced repetition for ideas)
 *  2. EXPLORE — browse by type, tag, or connection across books
 *  3. LIBRARY — all notes organised by book
 *
 * Note types follow atomic note principles:
 *  Quote / Insight / Question / Action / Summary / Connection
 *
 * "Connection" is the key addition — links an idea to another note
 * from a different book, building a cross-book knowledge graph.
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Modal, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generateFlashcard } from '../services/ai';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { C } from '../theme';

const { width: SW } = Dimensions.get('window');

// ── Note type definitions ──────────────────────────────────────────────
const NT = {
  quote:      { label: 'Quote',      icon: '💬', color: '#6B5B95', bg: '#F0EDF8', desc: 'Direct words from the author' },
  insight:    { label: 'Insight',    icon: '💡', color: '#2874A6', bg: '#EAF4FB', desc: 'Your own interpretation or realisation' },
  question:   { label: 'Question',   icon: '🔍', color: '#A04000', bg: '#FDF0E6', desc: 'Something you want to investigate further' },
  action:     { label: 'Action',     icon: '✅', color: '#1E8449', bg: '#E9F7EF', desc: 'Something you will apply or do' },
  summary:    { label: 'Summary',    icon: '📌', color: '#76448A', bg: '#F5EEF8', desc: 'Distilled key idea from a chapter' },
  connection: { label: 'Connection', icon: '🔗', color: '#17A589', bg: '#E8F8F5', desc: 'This idea connects to another book or note' },
};

// ── Helpers ────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days/7)}w ago`;
  return `${Math.floor(days/30)}mo ago`;
}

function pickDailyNotes(notes) {
  // Surface a curated mix: starred first, then by type variety, then oldest-unseen
  const starred   = notes.filter(n => n.starred);
  const questions = notes.filter(n => n.type === 'question' && !n.starred);
  const insights  = notes.filter(n => n.type === 'insight'  && !n.starred);
  const actions   = notes.filter(n => n.type === 'action'   && !n.starred);
  const rest      = notes.filter(n => !['question','insight','action'].includes(n.type) && !n.starred);

  const pool = [
    ...starred.slice(0, 2),
    ...questions.slice(0, 1),
    ...insights.slice(0, 2),
    ...actions.slice(0, 1),
    ...rest,
  ];
  // Shuffle deterministically by today's date so it changes daily
  const seed = new Date().toDateString();
  return pool.sort((a, b) => (a.id + seed > b.id + seed ? 1 : -1)).slice(0, 5);
}

// ── Edit Note Modal ───────────────────────────────────────────────────
function EditNoteModal({ visible, note, onSave, onClose }) {
  const [text, setText]         = useState('');
  const [thinking, setThinking] = useState('');
  const [page, setPage]         = useState('');
  const [chapter, setChapter]   = useState('');
  const [type, setType]         = useState('insight');

  // Populate fields when note changes
  React.useEffect(() => {
    if (note) {
      setText(note.text || '');
      setThinking(note.thinking || '');
      setPage(note.page || '');
      setChapter(note.chapter || '');
      setType(note.type || 'insight');
    }
  }, [note]);

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({ text: text.trim(), thinking: thinking.trim(), page: page.trim(), chapter: chapter.trim(), type });
    onClose();
  };

  const t = NT[type] || NT.insight;

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
          {/* Book context */}
          {note && (
            <View style={mo.bookCtx}>
              <Text style={mo.bookCtxLbl}>EDITING NOTE FROM</Text>
              <Text style={mo.bookCtxTitle} numberOfLines={2}>{note.bookTitle}</Text>
              {note.page ? (
                <Text style={{ fontSize: 11, color: C.inkMuted, marginTop: 4 }}>
                  Page {note.page}{note.chapter ? ` · ${note.chapter}` : ''}
                </Text>
              ) : null}
            </View>
          )}

          {/* Note type */}
          <Text style={mo.label}>NOTE TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
            {Object.entries(NT).map(([key, val]) => (
              <TouchableOpacity key={key}
                style={[mo.typePill, type === key && { backgroundColor: val.color, borderColor: val.color }]}
                onPress={() => setType(key)} activeOpacity={0.8}>
                <Text style={[mo.typePillIcon, type === key && { color: '#fff' }]}>{val.icon}</Text>
                <Text style={[mo.typePillTxt, type === key && { color: '#fff' }]}>{val.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Main text */}
          <Text style={mo.label}>
            {type === 'quote' ? 'QUOTE' : type === 'question' ? 'QUESTION' :
             type === 'action' ? 'ACTION' : type === 'summary' ? 'SUMMARY' :
             type === 'connection' ? 'CONNECTING IDEA' : 'INSIGHT'}
          </Text>
          <TextInput style={[mo.mainInput, { borderColor: t.color + '55' }]}
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

// ── Add Note Modal — 2-step: pick book → write note ──────────────────
function AddNoteModal({ visible, books, onSave, onClose }) {
  const [step, setStep]         = useState(1);   // 1 = book picker, 2 = note editor
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

        {/* ── STEP 1: Book picker ── */}
        {step === 1 && (
          <>
            <View style={mo.header}>
              <TouchableOpacity onPress={handleClose}>
                <Text style={mo.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={mo.title}>New Note</Text>
              <View style={{ width: 52 }} />
            </View>

            {/* Full-width question strip */}
            <View style={mo.step1Strip}>
              <Text style={mo.step1StripTxt}>Which book is this note about?</Text>
            </View>

            {/* Empty state */}
            {activeBooks.length === 0 && (
              <View style={mo.emptyBooks}>
                <Text style={mo.emptyBooksIcon}>📚</Text>
                <Text style={mo.emptyBooksTxt}>No books in progress</Text>
                <Text style={mo.emptyBooksSub}>
                  Add a book from Discover and start reading to attach notes.
                </Text>
              </View>
            )}

            {/* Book list — full rows, clear and tappable */}
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
                    <View style={[mo.bookRowStatus, {
                      backgroundColor: b.status === 'reading' ? C.amberPale
                        : b.status === 'finished' ? '#E9F7EF' : C.cream
                    }]}>
                      <Text style={[mo.bookRowStatusTxt, {
                        color: b.status === 'reading' ? C.amber
                          : b.status === 'finished' ? '#1E8449' : C.inkMuted
                      }]}>
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

        {/* ── STEP 2: Note editor ── */}
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

            {/* Selected book banner */}
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
              {/* Note type */}
              <Text style={mo.label}>NOTE TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {Object.entries(NT).map(([key, val]) => (
                  <TouchableOpacity key={key}
                    style={[mo.typePill, type === key && { backgroundColor: val.color, borderColor: val.color }]}
                    onPress={() => setType(key)} activeOpacity={0.8}>
                    <Text style={[mo.typePillIcon, type === key && { color: '#fff' }]}>{val.icon}</Text>
                    <Text style={[mo.typePillTxt, type === key && { color: '#fff' }]}>{val.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[mo.typeHint, { color: t.color }]}>{t.desc}</Text>

              {/* Main text */}
              <Text style={mo.label}>
                {type === 'quote' ? 'QUOTE' : type === 'question' ? 'QUESTION' :
                 type === 'action' ? 'ACTION' : type === 'summary' ? 'SUMMARY' :
                 type === 'connection' ? 'CONNECTING IDEA' : 'INSIGHT'}
              </Text>
              <TextInput style={[mo.mainInput, { borderColor: t.color + '55' }]}
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

              {/* My thinking */}
              <Text style={mo.label}>
                MY THINKING <Text style={mo.optional}>— why this matters to you</Text>
              </Text>
              <TextInput style={mo.thinkInput}
                value={thinking} onChangeText={setThinking} multiline numberOfLines={3}
                textAlignVertical="top" placeholderTextColor={C.inkFaint}
                placeholder="How does this change how you think or act?" />

              {/* Location */}
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

// ── Compact note card ──────────────────────────────────────────────────
function NoteCard({ note, onStar, onDelete, onMakeCard, generating, cardNoteIds, showBook = false, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const t = NT[note.type] || NT.insight;
  const isLong = note.text.length > 160 || (note.thinking?.length > 80);

  return (
    <View style={[nc.card, note.starred && nc.cardStarred]}>
      <View style={[nc.bar, { backgroundColor: t.color }]} />
      <View style={nc.body}>

        {/* Top row */}
        <View style={nc.topRow}>
          <View style={[nc.badge, { backgroundColor: t.bg }]}>
            <Text style={nc.badgeIcon}>{t.icon}</Text>
            <Text style={[nc.badgeTxt, { color: t.color }]}>{t.label}</Text>
          </View>
          <View style={nc.topRight}>
            {note.page ? <Text style={nc.loc}>p.{note.page}</Text> : null}
            <TouchableOpacity onPress={() => onStar(note.id)}
              hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Text style={[nc.star, note.starred && nc.starOn]}>
                {note.starred ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Book reference */}
        {showBook && (
          <Text style={nc.bookRef} numberOfLines={1}>📚 {note.bookTitle}</Text>
        )}

        {/* Chapter */}
        {note.chapter ? <Text style={nc.chapter}>{note.chapter}</Text> : null}

        {/* Main text */}
        <Text style={[nc.text, note.type === 'quote' && nc.quoteText]}
          numberOfLines={expanded ? undefined : 3}>
          {note.type === 'quote' ? `"${note.text}"` : note.text}
        </Text>

        {/* My thinking */}
        {note.thinking ? (
          <View style={nc.thinkBox}>
            <Text style={nc.thinkLabel}>MY THINKING</Text>
            <Text style={nc.thinkText} numberOfLines={expanded ? undefined : 2}>
              {note.thinking}
            </Text>
          </View>
        ) : null}

        {isLong && (
          <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
            <Text style={nc.expandTxt}>{expanded ? 'Less ▲' : 'More ▼'}</Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={nc.actions}>
          <Text style={nc.date}>{timeAgo(note.date)}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {onEdit && (
              <TouchableOpacity style={nc.editBtn} onPress={() => onEdit(note)} activeOpacity={0.8}>
                <Text style={nc.editTxt}>✎ Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[nc.actionBtn, generating === note.id && { opacity: 0.5 }]}
              onPress={() => onMakeCard(note)} disabled={!!generating} activeOpacity={0.8}>
              <Text style={nc.actionTxt}>
                {generating === note.id ? '✦ ...' : cardNoteIds.has(note.id) ? '✦ Redo' : '✦ Card'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={nc.delBtn} onPress={() => onDelete(note.id)}
              activeOpacity={0.7} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Text style={nc.delTxt}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Digest view — categorised by note type, 5 per type ───────────────
function DigestView({ notes, books, cards, onStar, onDelete, onMakeCard, generating, onEdit }) {
  const cardNoteIds = new Set(cards.map(c => c.noteId));
  const seed = new Date().toDateString();

  // Pick up to 5 notes per type, shuffled deterministically by today
  const byType = useMemo(() => {
    return Object.entries(NT).reduce((acc, [key, val]) => {
      const pool = notes
        .filter(n => n.type === key)
        .sort((a, b) => (a.id + seed > b.id + seed ? 1 : -1))
        .slice(0, 5);
      if (pool.length > 0) acc.push({ key, val, notes: pool });
      return acc;
    }, []);
  }, [notes, seed]);

  if (notes.length === 0) {
    return (
      <View style={dv.empty}>
        <Text style={dv.emptyIcon}>🧠</Text>
        <Text style={dv.emptyTitle}>Your knowledge base is empty</Text>
        <Text style={dv.emptySub}>Start adding notes to your books and they'll surface here daily.</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={dv.digestHeader}>
        <Text style={dv.digestTitle}>Today's Digest</Text>
        <Text style={dv.digestSub}>Up to 5 notes per type, refreshed daily</Text>
      </View>

      {byType.map(({ key, val, notes: typeNotes }, idx) => (
        <View key={key} style={[dv.section, idx === byType.length - 1 && { marginBottom: 100 }]}>
          {/* Type section header */}
          <View style={[dv.typeHeader, { borderLeftColor: val.color }]}>
            <View style={[dv.typeIconWrap, { backgroundColor: val.bg }]}>
              <Text style={dv.typeIcon}>{val.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[dv.typeLabel, { color: val.color }]}>{val.label.toUpperCase()}</Text>
              <Text style={dv.typeDesc}>{val.desc}</Text>
            </View>
            <View style={[dv.typeCount, { backgroundColor: val.bg }]}>
              <Text style={[dv.typeCountTxt, { color: val.color }]}>{typeNotes.length}</Text>
            </View>
          </View>

          {typeNotes.map(n => (
            <NoteCard key={n.id} note={n} onStar={onStar} onDelete={onDelete}
              onMakeCard={onMakeCard} generating={generating}
              cardNoteIds={cardNoteIds} showBook onEdit={onEdit} />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

// ── Explore view — browse by type across all books ─────────────────────
function ExploreView({ notes, cards, books, onStar, onDelete, onMakeCard, generating, onEdit }) {
  const [activeType, setActiveType] = useState('all');
  const [search, setSearch]         = useState('');
  const cardNoteIds = new Set(cards.map(c => c.noteId));

  const counts = useMemo(() => {
    const c = { all: notes.length };
    Object.keys(NT).forEach(k => { c[k] = notes.filter(n => n.type === k).length; });
    c.starred = notes.filter(n => n.starred).length;
    return c;
  }, [notes]);

  const filtered = useMemo(() => {
    let list = notes;
    if (activeType === 'starred') list = list.filter(n => n.starred);
    else if (activeType !== 'all') list = list.filter(n => n.type === activeType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.text.toLowerCase().includes(q) ||
        (n.thinking || '').toLowerCase().includes(q) ||
        n.bookTitle.toLowerCase().includes(q) ||
        (n.chapter || '').toLowerCase().includes(q)
      );
    }
    // Starred float to top
    return [...list.filter(n => n.starred), ...list.filter(n => !n.starred)];
  }, [notes, activeType, search]);

  const typeFilters = [
    { key: 'all',     label: 'All',        icon: '◉',  count: counts.all,     color: C.ink,      bg: C.creamDark },
    { key: 'starred', label: 'Starred',    icon: '★',  count: counts.starred, color: '#D4A800',  bg: '#FFFBEA' },
    ...Object.entries(NT).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon, count: counts[k] || 0, color: v.color, bg: v.bg })),
  ];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={[0]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Sticky header — search + filter pills, always fixed at top */}
      <View style={ev.stickyHeader}>
        <View style={ev.searchWrap}>
          <Text>🔍</Text>
          <TextInput style={ev.search} value={search} onChangeText={setSearch}
            placeholder="Search notes, books, chapters..."
            placeholderTextColor={C.inkFaint} />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={{ color: C.inkMuted, fontSize: 18 }}>×</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter pills — horizontal scroll, never squishes */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 7 }}
          style={{ marginBottom: 8 }}
        >
          {typeFilters.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[ev.filterTile, activeType === f.key && { backgroundColor: f.color, borderColor: f.color }]}
              onPress={() => setActiveType(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[ev.filterTileIcon, activeType === f.key && { color: '#fff' }]}>
                {f.icon}
              </Text>
              <Text style={[ev.filterTileTxt, activeType === f.key && { color: '#fff' }]}>
                {f.label}
              </Text>
              <Text style={[ev.filterTileCount, activeType === f.key && { color: 'rgba(255,255,255,0.7)' }]}>
                {f.count}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Notes list — scrolls under the sticky header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        {filtered.length === 0 && (
          <View style={ev.emptyState}>
            <Text style={ev.emptyStateIcon}>
              {activeType === 'all' ? '📝' : activeType === 'starred' ? '★' :
               NT[activeType]?.icon || '📝'}
            </Text>
            <Text style={ev.emptyStateTitle}>
              {search
                ? 'No notes match your search'
                : activeType === 'all' ? 'No notes yet'
                : activeType === 'starred' ? 'No starred notes yet'
                : `No ${NT[activeType]?.label || ''} notes yet`}
            </Text>
            <Text style={ev.emptyStateSub}>
              {search ? 'Try different keywords' : 'Add a note from any book to see it here'}
            </Text>
          </View>
        )}
        {filtered.map(n => (
          <NoteCard key={n.id} note={n} onStar={onStar} onDelete={onDelete}
            onMakeCard={onMakeCard} generating={generating}
            cardNoteIds={cardNoteIds} showBook onEdit={onEdit} />
        ))}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ── Book Notes Screen — dedicated full-screen notes for one book ────────
function BookNotesScreen({ book, notes, cards, onStar, onDelete, onMakeCard, generating, onEdit, onBack, navigation }) {
  const cardNoteIds = new Set(cards.map(c => c.noteId));
  const starred     = notes.filter(n => n.starred).length;

  const typeCounts = Object.entries(NT).reduce((a, [k]) => {
    const c = notes.filter(n => n.type === k).length;
    if (c > 0) a.push({ key: k, count: c, ...NT[k] });
    return a;
  }, []);

  const sorted = [...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)];

  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {/* Header */}
      <View style={bns.header}>
        <TouchableOpacity onPress={onBack} style={bns.backBtn} activeOpacity={0.8}>
          <Text style={bns.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={bns.headerInfo}>
          <BookCover title={book.title} author={book.author} cover={book.cover}
            coverId={book.coverId} width={44} height={62} />
          <View style={{ flex: 1 }}>
            <Text style={bns.bookTitle} numberOfLines={2}>{book.title}</Text>
            <Text style={bns.bookAuthor}>{book.author}</Text>
            <View style={bns.countRow}>
              <Text style={bns.noteCount}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
              {starred > 0 && <Text style={bns.starCount}>★ {starred} starred</Text>}
            </View>
          </View>
          {/* Pill button — same height as book cover */}
          <TouchableOpacity
            style={bns.openBtn}
            onPress={() => navigation.navigate('Library', { screen: 'BookDetail', params: { bookId: book.id } })}
            activeOpacity={0.8}
          >
            <Text style={bns.openBtnTxt}>Open{'\n'}Book{'\n'}Page</Text>
          </TouchableOpacity>
        </View>
        {/* Type breakdown pills */}
        {typeCounts.length > 0 && (
          <View style={bns.typePills}>
            {typeCounts.map(tc => (
              <View key={tc.key} style={[bns.typePill, { backgroundColor: tc.bg }]}>
                <Text style={[bns.typePillTxt, { color: tc.color }]}>{tc.icon} {tc.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Notes list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {sorted.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📝</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 6 }}>No notes yet</Text>
            <Text style={{ fontSize: 13, color: C.inkMuted, textAlign: 'center' }}>
              Open the book page and add your first note.
            </Text>
          </View>
        )}
        {sorted.map(n => (
          <NoteCard key={n.id} note={n} onStar={onStar} onDelete={onDelete}
            onMakeCard={onMakeCard} generating={generating}
            cardNoteIds={cardNoteIds} onEdit={onEdit} />
        ))}
      </ScrollView>
    </View>
  );
}

// ── Library view — book list, tap to open dedicated notes screen ────────
function LibraryView({ notes, books, cards, onStar, onDelete, onMakeCard, generating, navigation, onEdit }) {
  const cardNoteIds = new Set(cards.map(c => c.noteId));
  const [selectedBook, setSelectedBook] = useState(null);

  const grouped = useMemo(() => {
    const ids = [...new Set(notes.map(n => n.bookId))];
    return ids.map(id => ({
      book: books.find(b => b.id === id),
      notes: notes.filter(n => n.bookId === id),
    })).filter(g => g.book);
  }, [notes, books]);

  // Show dedicated notes screen for selected book
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

  // Book list
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        {grouped.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Text style={{ fontSize: 13, color: C.inkFaint }}>No notes yet.</Text>
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
              style={lv.bookBlock}
              onPress={() => setSelectedBook(book.id)}
              activeOpacity={0.8}
            >
              <View style={lv.bookHead}>
                <BookCover title={book.title} author={book.author} cover={book.cover}
                  coverId={book.coverId} width={44} height={62} />
                <View style={lv.bookMeta}>
                  <Text style={lv.bookTitle} numberOfLines={1}>{book.title}</Text>
                  <Text style={lv.bookAuthor}>{book.author}</Text>
                  <View style={lv.countRow}>
                    <Text style={lv.noteCount}>{bn.length} note{bn.length !== 1 ? 's' : ''}</Text>
                    {starred > 0 && <Text style={lv.starCount}>★ {starred}</Text>}
                  </View>
                  <View style={lv.typePills}>
                    {typeCounts.map(tc => (
                      <View key={tc.key} style={[lv.typePill, { backgroundColor: tc.bg }]}>
                        <Text style={[lv.typePillTxt, { color: tc.color }]}>{tc.icon} {tc.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <Text style={lv.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

// ── Main NotesScreen ───────────────────────────────────────────────────
export function NotesScreen({ navigation }) {
  const { notes, books, cards, addNote, addCard, deleteNote, updateNote } = useStore();
  const [view, setView]             = useState('digest');
  const [showModal, setShowModal]   = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNote, setEditNote]     = useState(null);
  const [generating, setGenerating] = useState(null);

  const activeBooks = books.filter(b => b.status !== 'want_to_read');

  const handleSave = (data) => {
    addNote({
      id:        Date.now().toString(),
      bookId:    data.bookId,
      bookTitle: data.bookTitle,
      type:      data.type,
      text:      data.text,
      thinking:  data.thinking,
      page:      data.page,
      chapter:   data.chapter,
      connection: data.connection,
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
        text: data.text,
        thinking: data.thinking,
        page: data.page,
        chapter: data.chapter,
        type: data.type,
        isQuote: data.type === 'quote',
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

  const totalNotes   = notes.length;
  const starredCount = notes.filter(n => n.starred).length;

  const VIEWS = [
    { key: 'digest',  label: 'Digest' },
    { key: 'explore', label: 'Explore' },
    { key: 'library', label: 'By Book' },
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
    <SafeAreaView style={s.safe}>

      <AddNoteModal
        visible={showModal}
        books={activeBooks}
        onSave={handleSave}
        onClose={() => setShowModal(false)}
      />

      <EditNoteModal
        visible={showEditModal}
        note={editNote}
        onSave={handleSaveEdit}
        onClose={() => { setShowEditModal(false); setEditNote(null); }}
      />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Knowledge Base</Text>
          <Text style={s.sub}>
            {totalNotes} note{totalNotes !== 1 ? 's' : ''}
            {starredCount > 0 ? ` · ★ ${starredCount}` : ''}
            {' · '}{new Set(notes.map(n => n.bookId)).size} book{new Set(notes.map(n => n.bookId)).size !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowModal(true)} activeOpacity={0.85}>
          <Text style={s.addBtnTxt}>✎ New note</Text>
        </TouchableOpacity>
      </View>

      {/* View switcher */}
      <View style={s.viewSwitcher}>
        {VIEWS.map(v => (
          <TouchableOpacity key={v.key} style={[s.viewTab, view === v.key && s.viewTabOn]}
            onPress={() => setView(v.key)} activeOpacity={0.8}>
            <Text style={[s.viewTabTxt, view === v.key && s.viewTabTxtOn]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Views */}
      {view === 'digest'  && <DigestView  {...sharedProps} />}
      {view === 'explore' && <ExploreView {...sharedProps} />}
      {view === 'library' && <LibraryView {...sharedProps} navigation={navigation} />}

    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const mo = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: C.paper },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  title:       { fontSize: 16, fontWeight: '700', color: C.ink },
  cancel:      { fontSize: 15, color: C.inkMuted },
  save:        { fontSize: 15, color: C.amber, fontWeight: '700' },
  saveOff:     { opacity: 0.3 },
  scroll:      { flex: 1 },
  label:       { fontSize: 10, fontWeight: '700', color: C.inkMuted, letterSpacing: 1, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
  optional:    { fontWeight: '400', color: C.inkFaint },
  bookChip:    { alignItems: 'center', width: 60, opacity: 0.45 },
  bookChipActive: { opacity: 1 },
  bookChipTxt: { fontSize: 9, color: C.inkMuted, textAlign: 'center', marginTop: 4, lineHeight: 12 },
  bookChipTxtActive: { color: C.ink, fontWeight: '600' },
  typePill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.creamDark, borderWidth: 1, borderColor: C.border },
  typePillIcon:{ fontSize: 13, color: C.inkMuted },
  typePillTxt: { fontSize: 12, fontWeight: '600', color: C.inkMuted },
  typeHint:    { fontSize: 12, marginHorizontal: 20, marginTop: 6, marginBottom: 2, fontStyle: 'italic' },
  mainInput:   { marginHorizontal: 20, backgroundColor: C.white, borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, color: C.ink, minHeight: 100, textAlignVertical: 'top', lineHeight: 22 },
  thinkInput:  { marginHorizontal: 20, backgroundColor: '#FFFEF5', borderRadius: 12, borderWidth: 1, borderColor: '#D4C870', padding: 14, fontSize: 14, color: C.ink, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  // Step 1 — book picker
  step1Hero:   { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
  step1Strip:  { backgroundColor: C.cream, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 20, paddingVertical: 14 },
  step1StripTxt: { fontSize: 15, fontWeight: '600', color: C.inkSoft, letterSpacing: -0.2 },
  stepHint:    { paddingHorizontal: 20, paddingBottom: 12 },
  stepHintTxt: { fontSize: 14, color: C.inkMuted, lineHeight: 20 },
  emptyBooks:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyBooksIcon: { fontSize: 40, marginBottom: 12 },
  emptyBooksTxt:  { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 6 },
  emptyBooksSub:  { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  bookRow:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
  bookRowActive:   { borderColor: C.amber, backgroundColor: C.amberPale },
  bookRowInfo:     { flex: 1 },
  bookRowTitle:    { fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 20, marginBottom: 3 },
  bookRowAuthor:   { fontSize: 12, color: C.inkMuted, marginBottom: 8 },
  bookRowStatus:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  bookRowStatusTxt:{ fontSize: 11, fontWeight: '600' },
  bookRowArrow:    { fontSize: 20, color: C.inkFaint },
  // Step 2 — selected book banner
  selectedBookBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.cream, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  selectedBookTitle:  { fontSize: 13, fontWeight: '700', color: C.ink },
  selectedBookAuthor: { fontSize: 11, color: C.inkMuted, marginTop: 2 },
  selectedBookChange: { fontSize: 12, color: C.amber, fontWeight: '600' },
  locRow:      { flexDirection: 'row', marginHorizontal: 20, gap: 10 },
  locLabel:    { fontSize: 10, color: C.inkMuted, fontWeight: '600', marginBottom: 5 },
  locInput:    { backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 13, color: C.ink },
  bookCtx:     { marginHorizontal: 20, marginTop: 16, backgroundColor: C.cream, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  bookCtxLbl:  { fontSize: 10, fontWeight: '700', color: C.inkMuted, letterSpacing: 0.8, marginBottom: 4 },
  bookCtxTitle:{ fontSize: 15, fontWeight: '700', color: C.ink, lineHeight: 20 },
});

const nc = StyleSheet.create({
  card:       { flexDirection: 'row', backgroundColor: C.white, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardStarred:{ backgroundColor: '#FFFEF8' },
  bar:        { width: 4 },
  body:       { flex: 1, padding: 12 },
  topRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badge:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeIcon:  { fontSize: 11 },
  badgeTxt:   { fontSize: 10, fontWeight: '700' },
  topRight:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loc:        { fontSize: 10, color: C.inkFaint, backgroundColor: C.creamDark, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  star:       { fontSize: 17, color: C.inkFaint },
  starOn:     { color: '#D4A800' },
  bookRef:    { fontSize: 10, color: C.amber, fontWeight: '500', marginBottom: 4 },
  chapter:    { fontSize: 11, color: C.inkMuted, fontStyle: 'italic', marginBottom: 4 },
  text:       { fontSize: 13, color: C.ink, lineHeight: 20 },
  quoteText:  { fontStyle: 'italic', color: C.inkSoft, fontSize: 14, lineHeight: 22 },
  thinkBox:   { backgroundColor: '#FFFEF0', borderRadius: 8, padding: 10, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#D4C840' },
  thinkLabel: { fontSize: 9, fontWeight: '700', color: '#7A6A10', letterSpacing: 1, marginBottom: 3 },
  thinkText:  { fontSize: 12, color: C.inkSoft, lineHeight: 18, fontStyle: 'italic' },
  expandTxt:  { fontSize: 11, color: C.amber, fontWeight: '600', marginTop: 4 },
  actions:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  date:       { fontSize: 10, color: C.inkFaint },
  actionBtn:  { backgroundColor: C.amberPale, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  actionTxt:  { fontSize: 11, color: C.amber, fontWeight: '600' },
  editBtn:    { backgroundColor: '#EBF5FB', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  editTxt:    { fontSize: 11, color: '#2874A6', fontWeight: '600' },
  delBtn:     { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  delTxt:     { fontSize: 12 },
});

const dv = StyleSheet.create({
  digestHeader:  { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 },
  digestTitle:   { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  digestSub:     { fontSize: 12, color: C.inkMuted, marginTop: 2, marginBottom: 6 },
  section:       { paddingHorizontal: 20, marginBottom: 2 },
  // Slim inline type divider — just a coloured left bar + label on one line
  typeHeader:    { flexDirection: 'row', alignItems: 'center', gap: 7,
                   paddingVertical: 7, paddingLeft: 10,
                   borderLeftWidth: 3, marginTop: 10, marginBottom: 6 },
  typeIconWrap:  { width: 22, height: 22, borderRadius: 6,
                   alignItems: 'center', justifyContent: 'center' },
  typeIcon:      { fontSize: 12 },
  typeLabel:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  typeDesc:      { fontSize: 11, color: C.inkMuted, flex: 1 },
  typeCount:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  typeCountTxt:  { fontSize: 11, fontWeight: '700' },
  empty:         { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon:     { fontSize: 52, marginBottom: 16 },
  emptyTitle:    { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
  emptySub:      { fontSize: 14, color: C.inkMuted, textAlign: 'center', lineHeight: 22 },
});

const ev = StyleSheet.create({
  searchWrap:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 20, marginBottom: 10, gap: 8 },
  search:         { flex: 1, fontSize: 14, color: C.ink },
  stickyHeader:   { backgroundColor: C.paper, paddingTop: 8, paddingBottom: 2 },
  filterGrid:     { marginBottom: 12 },
  filterTile:     {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: 20, backgroundColor: C.creamDark,
    borderWidth: 1, borderColor: C.border,
    minWidth: 90,           // always wide enough for icon + label
    overflow: 'hidden',     // no clipping
  },
  filterTileIcon: { fontSize: 14, color: C.inkMuted, flexShrink: 0 },
  filterTileTxt:  { fontSize: 12, fontWeight: '600', color: C.inkMuted, flexShrink: 0 },
  filterTileCount:{ fontSize: 11, fontWeight: '400', color: C.inkFaint, flexShrink: 0 },
  noResults:      { textAlign: 'center', color: C.inkFaint, fontSize: 13, marginTop: 40 },
  legendPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  legendIcon:     { fontSize: 13 },
  legendTxt:      { fontSize: 11, fontWeight: '600' },
  emptyState:     { alignItems: 'center', paddingTop: 48, paddingHorizontal: 40, paddingBottom: 24 },
  emptyStateIcon: { fontSize: 36, marginBottom: 10 },
  emptyStateTitle:{ fontSize: 16, fontWeight: '700', color: C.ink, marginBottom: 5, textAlign: 'center' },
  emptyStateSub:  { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
});

const lv = StyleSheet.create({
  bookBlock:   { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden' },
  bookHead:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  bookMeta:    { flex: 1 },
  bookTitle:   { fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 19 },
  bookAuthor:  { fontSize: 11, color: C.inkMuted, marginTop: 1 },
  countRow:    { flexDirection: 'row', gap: 10, marginTop: 3 },
  noteCount:   { fontSize: 11, color: C.inkMuted },
  starCount:   { fontSize: 11, color: '#D4A800', fontWeight: '600' },
  typePills:   { flexDirection: 'row', gap: 5, marginTop: 6, flexWrap: 'wrap' },
  typePill:    { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  typePillTxt: { fontSize: 10, fontWeight: '700' },
  chevron:     { fontSize: 22, color: C.inkFaint, fontWeight: '300' },
  notesList:   { padding: 12, paddingTop: 8 },
  openBookBtn: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.creamDark, marginTop: 4 },
  openBookTxt: { fontSize: 12, color: C.amber, fontWeight: '600', textAlign: 'center' },
});

const bns = StyleSheet.create({
  header:      { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 12 },
  backBtn:     { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8, alignSelf: 'flex-start' },
  backTxt:     { fontSize: 14, color: C.amber, fontWeight: '600' },
  headerInfo:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  bookTitle:   { fontSize: 16, fontWeight: '700', color: C.ink, lineHeight: 22 },
  bookAuthor:  { fontSize: 12, color: C.inkMuted, marginTop: 2 },
  countRow:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  noteCount:   { fontSize: 11, color: C.inkMuted },
  starCount:   { fontSize: 11, color: '#D4A800', fontWeight: '600' },
  typePills:   { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingHorizontal: 20, marginTop: 12 },
  typePill:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  typePillTxt: { fontSize: 11, fontWeight: '700' },
  openBookBtn: { marginHorizontal: 20, marginTop: 12, backgroundColor: C.amberPale, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(184,114,10,0.2)' },
  openBookTxt: { fontSize: 13, color: C.amber, fontWeight: '600' },
  openBtn:     { height: 62, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.amberPale, borderWidth: 1, borderColor: 'rgba(184,114,10,0.25)', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  openBtnTxt:  { fontSize: 11, color: C.amber, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
});

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: C.paper },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:        { fontSize: 30, fontWeight: '700', color: C.ink, letterSpacing: -0.6 },
  sub:          { fontSize: 12, color: C.inkMuted, marginTop: 3 },
  addBtn:       { backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22 },
  addBtnTxt:    { color: C.white, fontSize: 13, fontWeight: '600' },
  viewSwitcher: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 12, backgroundColor: C.creamDark, borderRadius: 12, padding: 3 },
  viewTab:      { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  viewTabOn:    { backgroundColor: C.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  viewTabTxt:   { fontSize: 13, fontWeight: '500', color: C.inkMuted },
  viewTabTxtOn: { color: C.ink, fontWeight: '700' },
});