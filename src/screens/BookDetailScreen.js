import React, { useState } from 'react';
import { generateFlashcard } from '../services/ai';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { C } from '../theme';

// ── Note types — matches NotesScreen ──────────────────────────────────
const NOTE_TYPES = {
  quote:    { label: 'Quote',      icon: '💬', color: '#6B5B95', bg: '#F0EDF8', desc: 'Direct words from the book' },
  insight:  { label: 'Insight',    icon: '💡', color: '#2874A6', bg: '#EAF4FB', desc: 'Your own interpretation or realisation' },
  question: { label: 'Question',   icon: '🔍', color: '#A04000', bg: '#FDF0E6', desc: 'Something you want to explore further' },
  action:   { label: 'Action',     icon: '✅', color: '#1E8449', bg: '#E9F7EF', desc: 'Something you will apply or do' },
  summary:  { label: 'Summary',    icon: '📌', color: '#76448A', bg: '#F5EEF8', desc: 'Key takeaway from a chapter or section' },
  connection:{ label: 'Connection',icon: '🔗', color: '#17A589', bg: '#E8F8F5', desc: 'This idea connects to another book or note' },
};

// ── Add Note Modal ─────────────────────────────────────────────────────
function AddNoteModal({ visible, book, onSave, onClose, initialNote }) {
  const [type, setType]         = useState('insight');
  const [text, setText]         = useState('');
  const [thinking, setThinking] = useState('');
  const [page, setPage]         = useState('');
  const [chapter, setChapter]   = useState('');

  // Pre-fill when editing an existing note
  React.useEffect(() => {
    if (visible && initialNote) {
      setType(initialNote.type || 'insight');
      setText(initialNote.text || '');
      setThinking(initialNote.thinking || '');
      setPage(String(initialNote.page || ''));
      setChapter(String(initialNote.chapter || ''));
    } else if (visible && !initialNote) {
      setType('insight'); setText(''); setThinking(''); setPage(''); setChapter('');
    }
  }, [visible, initialNote]);

  const reset = () => {
    setType('insight'); setText(''); setThinking(''); setPage(''); setChapter('');
  };

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({ type, text: text.trim(), thinking: thinking.trim(), page: String(page || '').trim(), chapter: String(chapter || '').trim() });
    reset();
    onClose();
  };

  const t = NOTE_TYPES[type] || NOTE_TYPES.insight;
  const isEditing = !!initialNote;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe}>
        <View style={m.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Text style={m.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={m.headerTitle}>{isEditing ? 'Edit Note' : 'Add Note'}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[m.save, !text.trim() && m.saveDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={m.scroll} keyboardShouldPersistTaps="handled">
          {/* Book context */}
          {book && (
            <View style={m.bookCtx}>
              <Text style={m.bookCtxLbl}>Adding note to</Text>
              <Text style={m.bookCtxTitle} numberOfLines={1}>{book.title}</Text>
            </View>
          )}

          {/* Note type */}
          <Text style={m.sectionLabel}>NOTE TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={m.typeRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
            {Object.entries(NOTE_TYPES).map(([key, val]) => (
              <TouchableOpacity
                key={key}
                style={[m.typePill, type === key && { backgroundColor: val.color, borderColor: val.color }]}
                onPress={() => setType(key)}
                activeOpacity={0.8}
              >
                <Text style={[m.typePillIcon, type === key && { color: '#fff' }]}>{val.icon}</Text>
                <Text style={[m.typePillTxt, type === key && { color: '#fff' }]}>{val.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[m.typeDesc, { color: t.color }]}>{t.desc}</Text>

          {/* Main text */}
          <Text style={m.sectionLabel}>
            {type === 'quote' ? 'QUOTE FROM BOOK' :
             type === 'question' ? 'YOUR QUESTION' :
             type === 'action' ? 'ACTION TO TAKE' :
             type === 'summary' ? 'CHAPTER SUMMARY' : 'YOUR INSIGHT'}
          </Text>
          <TextInput
            style={[m.mainInput, { borderColor: t.color + '40' }]}
            value={text}
            onChangeText={setText}
            placeholder={
              type === 'quote'    ? 'Type or paste the exact quote...' :
              type === 'question' ? 'What do you want to explore further?' :
              type === 'action'   ? 'What will you actually do with this?' :
              type === 'summary'  ? 'Summarise this chapter in your own words...' :
              'What did you realise or understand?'
            }
            placeholderTextColor={C.inkFaint}
            multiline numberOfLines={4} textAlignVertical="top"
          />

          {/* My thinking */}
          <Text style={m.sectionLabel}>
            MY THINKING <Text style={m.optional}>(optional — but powerful)</Text>
          </Text>
          <TextInput
            style={m.thinkingInput}
            value={thinking}
            onChangeText={setThinking}
            placeholder={
              type === 'quote'    ? 'Why does this quote matter to you? How does it connect to your life?' :
              type === 'question' ? 'What do you already think the answer might be?' :
              type === 'action'   ? 'Why this action? What outcome are you hoping for?' :
              type === 'summary'  ? 'What surprised you? What will you remember in 6 months?' :
              'What does this connect to? Have you seen this idea elsewhere?'
            }
            placeholderTextColor={C.inkFaint}
            multiline numberOfLines={3} textAlignVertical="top"
          />

          {/* Location */}
          <Text style={m.sectionLabel}>LOCATION IN BOOK</Text>
          <View style={m.locationRow}>
            <View style={m.locationField}>
              <Text style={m.locationLabel}>Page</Text>
              <TextInput
                style={m.locationInput}
                value={page} onChangeText={setPage}
                placeholder="e.g. 148"
                placeholderTextColor={C.inkFaint}
                keyboardType="numeric"
              />
            </View>
            <View style={[m.locationField, { flex: 2 }]}>
              <Text style={m.locationLabel}>Chapter / Section</Text>
              <TextInput
                style={m.locationInput}
                value={chapter} onChangeText={setChapter}
                placeholder="e.g. Chapter 4, Part II"
                placeholderTextColor={C.inkFaint}
              />
            </View>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Note card (in book detail) ─────────────────────────────────────────
function NoteCard({ note, generating, noteIds, onMakeCard, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const t = NOTE_TYPES[note.type] || NOTE_TYPES.insight;

  return (
    <View style={nc.card}>
      <View style={[nc.typeBar, { backgroundColor: t.color }]} />
      <View style={nc.body}>
        <View style={nc.header}>
          <View style={[nc.badge, { backgroundColor: t.bg }]}>
            <Text style={nc.badgeIcon}>{t.icon}</Text>
            <Text style={[nc.badgeTxt, { color: t.color }]}>{t.label}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {note.page ? <Text style={nc.pageTxt}>p.{note.page}</Text> : null}
            {note.starred ? <Text style={{ fontSize: 14, color: '#D4A800' }}>★</Text> : null}
          </View>
        </View>

        {note.chapter ? <Text style={nc.chapterTxt}>{note.chapter}</Text> : null}

        <Text style={[nc.mainTxt, note.type === 'quote' && nc.quoteTxt]}
          numberOfLines={expanded ? undefined : 4}>
          {note.type === 'quote' ? `"${note.text}"` : note.text}
        </Text>

        {note.thinking ? (
          <View style={nc.thinkingBox}>
            <Text style={nc.thinkingLabel}>MY THINKING</Text>
            <Text style={nc.thinkingTxt} numberOfLines={expanded ? undefined : 2}>
              {note.thinking}
            </Text>
          </View>
        ) : null}

        {(note.text.length > 160 || (note.thinking && note.thinking.length > 100)) && (
          <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
            <Text style={nc.expandBtn}>{expanded ? 'Show less ▲' : 'Read more ▼'}</Text>
          </TouchableOpacity>
        )}

        <View style={nc.footer}>
          <Text style={nc.dateTxt}>{note.date}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              style={nc.editBtn}
              onPress={() => onEdit(note)}
              activeOpacity={0.8}
            >
              <Text style={nc.editBtnTxt}>✎ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[nc.flashBtn, generating === note.id && { opacity: 0.55 }]}
              onPress={() => onMakeCard(note)}
              disabled={!!generating}
              activeOpacity={0.8}
            >
              <Text style={nc.flashBtnTxt}>
                {generating === note.id ? '✦ Generating...' :
                 noteIds.has(note.id) ? '✦ Regenerate' : '✦ Flashcard'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={nc.deleteBtn}
              onPress={() => onDelete(note.id)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={nc.deleteTxt}>🗑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Edit Card Modal ───────────────────────────────────────────────────
function EditCardModal({ visible, card, onSave, onClose }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer]     = useState('');

  React.useEffect(() => {
    if (card) { setQuestion(card.question || ''); setAnswer(card.answer || ''); }
  }, [card]);

  const handleSave = () => {
    if (!question.trim() || !answer.trim()) return;
    onSave({ question: question.trim(), answer: answer.trim() });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe}>
        <View style={m.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={m.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={m.headerTitle}>Edit Flashcard</Text>
          <TouchableOpacity onPress={handleSave} disabled={!question.trim() || !answer.trim()}>
            <Text style={[m.save, (!question.trim() || !answer.trim()) && m.saveDisabled]}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={m.scroll} keyboardShouldPersistTaps="handled">
          {card && (
            <View style={m.bookCtx}>
              <Text style={m.bookCtxLbl}>Flashcard from</Text>
              <Text style={m.bookCtxTitle} numberOfLines={1}>{card.bookTitle}</Text>
            </View>
          )}
          <Text style={m.sectionLabel}>QUESTION</Text>
          <TextInput
            style={[m.mainInput, { borderColor: C.amber + '55' }]}
            value={question} onChangeText={setQuestion}
            multiline numberOfLines={4} textAlignVertical="top"
            placeholder="Edit the question..." placeholderTextColor={C.inkFaint}
          />
          <Text style={m.sectionLabel}>ANSWER</Text>
          <TextInput
            style={m.thinkingInput}
            value={answer} onChangeText={setAnswer}
            multiline numberOfLines={4} textAlignVertical="top"
            placeholder="Edit the answer..." placeholderTextColor={C.inkFaint}
          />
          <View style={{ height: 48 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Stars component ────────────────────────────────────────────────────
function Stars({ rating = 0, onRate }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2, marginTop: 8 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <TouchableOpacity key={s} onPress={() => onRate?.(s)} activeOpacity={0.7} disabled={!onRate}>
          <Text style={{ fontSize: 16, color: s <= rating ? C.amber : 'rgba(255,255,255,0.3)' }}>
            {s <= rating ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────
export function BookDetailScreen({ route, navigation }) {
  const { bookId, tab: initialTab } = route.params;
  const { books, updateBook, removeBook, addNote, deleteNote, updateNote, addCard, updateCard, bookNotes, bookCards } = useStore();
  const book = books.find(b => b.id === bookId);

  const [tab, setTab]               = useState(initialTab || 'notes');
  const [pageInput, setPage]        = useState(book?.currentPage?.toString() || '');
  const [showModal, setShowModal]       = useState(false);
  const [editCard, setEditCard]         = useState(null);
  const [showCardEdit, setShowCardEdit] = useState(false);
  const [editNote, setEditNote]         = useState(null);
  const [showNoteEdit, setShowNoteEdit] = useState(false);
  const [generating, setGenerating] = useState(null);

  if (!book) return null;

  const notes    = bookNotes(bookId);
  const cards    = bookCards(bookId);
  const noteIds  = new Set(cards.map(c => c.noteId));
  const progress = book.currentPage / (book.pageCount || 1);

  const handlePageUpdate = () => {
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 0 && p <= book.pageCount) {
      const patch = { currentPage: p };
      if (p === book.pageCount) patch.status = 'finished';
      else if (book.status === 'want_to_read') patch.status = 'reading';
      updateBook(bookId, patch);
    }
  };

  const handleSaveNote = (data) => {
    addNote({
      id:        Date.now().toString(),
      bookId,
      bookTitle: book.title,
      type:      data.type,
      text:      data.text,
      thinking:  data.thinking,
      page:      data.page,
      chapter:   data.chapter,
      isQuote:   data.type === 'quote',
      starred:   false,
      date:      new Date().toISOString().slice(0, 10),
    });
  };

  const handleMakeCard = async (note) => {
    setGenerating(note.id);
    try {
      const fullText = note.thinking
        ? `${note.text}\n\nMy thinking: ${note.thinking}`
        : note.text;
      const card = await generateFlashcard(fullText, book.title, book.author);
      addCard({
        id: Date.now().toString(),
        noteId: note.id, bookId,
        bookTitle: book.title,
        question: card.question,
        answer: card.answer,
        due: new Date().toISOString(),
      });
      Alert.alert('✦ Flashcard created!', 'Added to your review deck.');
    } catch (e) {
      Alert.alert('Error', 'Could not generate flashcard.');
    } finally {
      setGenerating(null);
    }
  };

  const handleDelete = () => {
    Alert.alert('Remove book', `Remove "${book.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => { removeBook(bookId); navigation.goBack(); } },
    ]);
  };

  const statusMap = { reading: 'Reading', want_to_read: 'Want to read', finished: 'Finished', abandoned: 'Abandoned' };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={s.safe} edges={['bottom']}>

        {/* Add / Edit Note Modal — same modal, pre-filled when editing */}
        <AddNoteModal
          visible={showModal || showNoteEdit}
          book={book}
          initialNote={showNoteEdit ? editNote : null}
          onSave={(data) => {
            if (showNoteEdit && editNote) {
              updateNote(editNote.id, { ...data, isQuote: data.type === 'quote' });
              setEditNote(null);
              setShowNoteEdit(false);
            } else {
              handleSaveNote(data);
              setShowModal(false);
            }
          }}
          onClose={() => { setShowModal(false); setShowNoteEdit(false); setEditNote(null); }}
        />

        {/* Edit Card Modal */}
        <EditCardModal
          visible={showCardEdit}
          card={editCard}
          onSave={(data) => { if (editCard) updateCard(editCard.id, data); setEditCard(null); }}
          onClose={() => { setShowCardEdit(false); setEditCard(null); }}
        />

        <ScrollView showsVerticalScrollIndicator={false}>

          {/* Hero */}
          <LinearGradient colors={[C.heroTop, C.heroBot]} style={s.hero}>
            <SafeAreaView edges={['top']}>
              <View style={s.heroNav}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn}>
                  <Text style={s.navBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={s.navBtn}>
                  <Text style={s.navBtnText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
            <View style={s.heroBody}>
              <BookCover title={book.title} author={book.author} cover={book.cover} coverId={book.coverId} width={106} height={150} />
              <Text style={s.heroTitle}>{book.title}</Text>
              <Text style={s.heroAuthor}>{book.author}{book.year ? ` · ${book.year}` : ''}</Text>
              <Stars rating={book.rating} onRate={r => updateBook(bookId, { rating: r })} />
              <View style={s.chips}>
                {book.genres?.map(g => <View key={g} style={s.chip}><Text style={s.chipTxt}>{g}</Text></View>)}
                {book.pageCount > 0 && <View style={s.chip}><Text style={s.chipTxt}>{book.pageCount} pages</Text></View>}
              </View>

              {/* Add note — sits inside hero below chips */}
              <TouchableOpacity
                style={s.heroAddNote}
                onPress={() => setShowModal(true)}
                activeOpacity={0.8}
              >
                <Text style={s.heroAddNoteIcon}>✎</Text>
                <Text style={s.heroAddNoteTxt}>Add a note</Text>
              </TouchableOpacity>

            </View>
          </LinearGradient>

          {/* Status + progress — clean card below hero */}
          <View style={s.actionCard}>

            {/* Description — hide auto-generated subjects text */}
            {book.description && !book.description.startsWith('Subjects:') ? (
              <Text style={s.desc}>{book.description}</Text>
            ) : null}

            {/* Status + action */}
            <View style={s.statusRow}>
              <View style={[s.statusBadge, {
                backgroundColor: book.status === 'reading' ? C.amberPale
                  : book.status === 'finished' ? '#E9F7EF' : C.cream,
              }]}>
                <Text style={[s.statusTxt, {
                  color: book.status === 'reading' ? C.amber
                    : book.status === 'finished' ? '#1E8449' : C.inkMuted,
                }]}>
                  {statusMap[book.status]}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {book.status !== 'finished' && (
                  <TouchableOpacity style={s.statusBtn} activeOpacity={0.8}
                    onPress={() => updateBook(bookId, book.status === 'want_to_read'
                      ? { status: 'reading' }
                      : { status: 'finished', currentPage: book.pageCount }
                    )}>
                    <Text style={s.statusBtnTxt}>
                      {book.status === 'want_to_read' ? 'Start reading' : 'Mark finished'}
                    </Text>
                  </TouchableOpacity>
                )}
                {/* Undo — shown when finished so user can revert */}
                {book.status === 'finished' && (
                  <TouchableOpacity style={s.undoBtn} activeOpacity={0.8}
                    onPress={() => updateBook(bookId, {
                      status: 'reading',
                      currentPage: book.currentPage < book.pageCount ? book.currentPage : 0,
                    })}>
                    <Text style={s.undoBtnTxt}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Reading progress — only when reading or finished */}
            {(book.status === 'reading' || book.status === 'finished') && (
              <View style={s.progressSection}>
                <View style={s.progressHeader}>
                  <Text style={s.progressLabel}>Reading progress</Text>
                  <Text style={s.progressPct}>{Math.round(progress * 100)}%</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
                </View>
                <View style={s.progressInputRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pageInputLabel}>Page number</Text>
                    <TextInput
                      style={s.pageInput}
                      value={pageInput}
                      onChangeText={setPage}
                      keyboardType="numeric"
                      placeholder={`of ${book.pageCount}`}
                      placeholderTextColor={C.inkFaint}
                      returnKeyType="done"
                      onSubmitEditing={handlePageUpdate}
                    />
                  </View>
                  <TouchableOpacity style={[s.updateBtn, { alignSelf: 'flex-end' }]} onPress={handlePageUpdate} activeOpacity={0.8}>
                    <Text style={s.updateBtnTxt}>Update</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Tabs — Notes + Cards only */}
          <View style={s.tabs}>
            {['notes', 'cards'].map(t => (
              <TouchableOpacity key={t} style={s.tab} onPress={() => setTab(t)}>
                <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
                  {t === 'notes' ? `Notes (${notes.length})` : `Cards (${cards.length})`}
                </Text>
                {tab === t && <View style={s.tabLine} />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.body}>

            {/* NOTES */}
            {tab === 'notes' && (
              <>
                {notes.length === 0 && (
                  <Text style={s.emptyTxt}>No notes yet. Tap "Add a note" in the book header to capture your first thought.</Text>
                )}

                {/* Starred first, then rest */}
                {[...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)].map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    generating={generating}
                    noteIds={noteIds}
                    onMakeCard={handleMakeCard}
                    onDelete={deleteNote}
                    onEdit={(note) => { setEditNote(note); setShowNoteEdit(true); }}
                  />
                ))}
              </>
            )}

            {/* CARDS */}
            {tab === 'cards' && (
              <>
                {cards.length === 0 && (
                  <Text style={s.emptyTxt}>No flashcards yet. Make them from your notes!</Text>
                )}
                {cards.map(c => (
                  <View key={c.id} style={s.cardPreview}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={s.cardLabel}>QUESTION</Text>
                      <TouchableOpacity
                        style={s.cardEditBtn}
                        onPress={() => { setEditCard(c); setShowCardEdit(true); }}
                        activeOpacity={0.8}
                      >
                        <Text style={s.cardEditBtnTxt}>✎ Edit</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={s.cardQ}>{c.question}</Text>
                    <View style={{ height: 0.5, backgroundColor: C.border, marginVertical: 10 }} />
                    <Text style={s.cardLabel}>ANSWER</Text>
                    <Text style={s.cardA}>{c.answer}</Text>
                  </View>
                ))}
              </>
            )}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ── Modal styles ───────────────────────────────────────────────────────
const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 16, fontWeight: '700', color: C.ink },
  cancel: { fontSize: 15, color: C.inkMuted },
  save: { fontSize: 15, color: C.amber, fontWeight: '700' },
  saveDisabled: { opacity: 0.3 },
  scroll: { flex: 1 },
  simpleInput: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.amber + '55',
    padding: 16,
    fontSize: 15,
    color: C.ink,
    minHeight: 160,
    lineHeight: 24,
  },
  bookCtx: { marginHorizontal: 20, marginTop: 16, backgroundColor: C.cream, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border },
  bookCtxLbl: { fontSize: 10, color: C.inkMuted, fontWeight: '500', letterSpacing: 0.5, marginBottom: 2 },
  bookCtxTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.inkMuted, letterSpacing: 1, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
  optional: { fontWeight: '400', fontSize: 10, color: C.inkFaint },
  typeRow: { marginBottom: 4 },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.creamDark, borderWidth: 1, borderColor: C.border },
  typePillIcon: { fontSize: 13, color: C.inkMuted },
  typePillTxt: { fontSize: 12, fontWeight: '600', color: C.inkMuted },
  typeDesc: { fontSize: 12, marginHorizontal: 20, marginTop: 4, marginBottom: 4, fontStyle: 'italic' },
  mainInput: { marginHorizontal: 20, backgroundColor: C.white, borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, color: C.ink, minHeight: 100, textAlignVertical: 'top', lineHeight: 22 },
  thinkingInput: { marginHorizontal: 20, backgroundColor: '#FFFFF0', borderRadius: 12, borderWidth: 1, borderColor: '#D4C870', padding: 14, fontSize: 14, color: C.ink, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  locationRow: { flexDirection: 'row', marginHorizontal: 20, gap: 10 },
  locationField: { flex: 1 },
  locationLabel: { fontSize: 10, color: C.inkMuted, fontWeight: '600', marginBottom: 5 },
  locationInput: { backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 13, color: C.ink },
});

// ── Note card styles ───────────────────────────────────────────────────
const nc = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: C.white, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  typeBar: { width: 4 },
  body: { flex: 1, padding: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeIcon: { fontSize: 11 },
  badgeTxt: { fontSize: 10, fontWeight: '700' },
  pageTxt: { fontSize: 10, color: C.inkFaint, backgroundColor: C.creamDark, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  chapterTxt: { fontSize: 11, color: C.inkMuted, marginBottom: 6, fontStyle: 'italic' },
  mainTxt: { fontSize: 14, color: C.ink, lineHeight: 22 },
  quoteTxt: { fontStyle: 'italic', color: C.inkSoft },
  thinkingBox: { backgroundColor: '#FFFEF0', borderRadius: 8, padding: 10, marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#D4C840' },
  thinkingLabel: { fontSize: 9, fontWeight: '700', color: '#8A7A10', letterSpacing: 1, marginBottom: 4 },
  thinkingTxt: { fontSize: 13, color: C.inkSoft, lineHeight: 20, fontStyle: 'italic' },
  expandBtn: { fontSize: 12, color: C.amber, fontWeight: '600', marginTop: 6 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  dateTxt: { fontSize: 10, color: C.inkFaint },
  flashBtn: { backgroundColor: C.amberPale, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  flashBtnTxt: { fontSize: 11, color: C.amber, fontWeight: '600' },
  editBtn: { backgroundColor: '#EBF5FB', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  editBtnTxt: { fontSize: 11, color: '#2874A6', fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  deleteTxt: { fontSize: 13 },
});

// ── Screen styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  hero: { paddingBottom: 24 },
  heroNav: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  navBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20 },
  navBtnText: { color: C.white, fontSize: 13 },
  heroBody: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: C.white, textAlign: 'center', marginTop: 16, letterSpacing: -0.3, lineHeight: 28 },
  heroAuthor: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' },
  chip: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  chipTxt: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  heroAddNote: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  heroAddNoteIcon: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  heroAddNoteTxt:  { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  actionCard: { marginHorizontal: 20, marginTop: 16, marginBottom: 4, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16, gap: 14 },
  desc: { fontSize: 13, color: C.inkMuted, lineHeight: 21, fontWeight: '300' },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusTxt: { fontSize: 12, fontWeight: '600' },
  statusBtn: { backgroundColor: C.ink, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22 },
  statusBtnTxt: { fontSize: 13, color: C.white, fontWeight: '600' },
  undoBtn: { backgroundColor: C.cream, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, borderWidth: 1, borderColor: C.border },
  undoBtnTxt: { fontSize: 12, color: C.inkMuted, fontWeight: '500' },
  tabs: { flexDirection: 'row', borderBottomWidth: 0.5, borderColor: C.border, marginTop: 8 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabTxt: { fontSize: 13, color: C.inkFaint },
  tabTxtActive: { color: C.amber, fontWeight: '600' },
  tabLine: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: C.amber, borderRadius: 1 },
  body: { padding: 20 },
  progressSection: { gap: 10 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 11, fontWeight: '700', color: C.inkMuted, letterSpacing: 0.5 },
  progressPct: { fontSize: 22, fontWeight: '800', color: C.amber, letterSpacing: -0.5 },
  track: { height: 4, backgroundColor: C.creamDark, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: C.amber, borderRadius: 2 },
  progressInputRow: { flexDirection: 'row', gap: 8 },
  pageInputLabel: { fontSize: 10, fontWeight: '600', color: C.inkFaint, letterSpacing: 0.5, marginBottom: 5 },
  pageInput: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.ink },
  updateBtn: { backgroundColor: C.amber, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  updateBtnTxt: { fontSize: 13, color: C.white, fontWeight: '600' },
  addNoteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.amberPale,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(184,114,10,0.25)',
    marginBottom: 16,
  },
  addNoteBtnIcon: { fontSize: 24, color: C.amber, fontWeight: '300', width: 28, textAlign: 'center' },
  addNoteBtnTitle: { fontSize: 15, fontWeight: '700', color: C.inkSoft, marginBottom: 2 },
  addNoteBtnSub: { fontSize: 11, color: C.inkMuted },
  addNoteBtnArrow: { fontSize: 22, color: C.amber },
  emptyTxt: { fontSize: 13, color: C.inkFaint, textAlign: 'center', marginTop: 24 },
  cardPreview: { backgroundColor: C.white, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: C.border },
  cardLabel:   { fontSize: 9, fontWeight: '700', color: C.inkFaint, letterSpacing: 1 },
  cardEditBtn: { backgroundColor: '#EBF5FB', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  cardEditBtnTxt: { fontSize: 11, color: '#2874A6', fontWeight: '600' },
  cardQ: { fontSize: 13, fontWeight: '500', color: C.ink, lineHeight: 20 },
  cardA: { fontSize: 13, color: C.inkMuted, lineHeight: 20, fontWeight: '300' },
});