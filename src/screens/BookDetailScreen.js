/**
 * BookDetailScreen — single book view.
 *
 * Layout:
 *   1. Top nav (back / remove)
 *   2. Light hero card — sage left rule, paper bg, cover + serif title +
 *      author + genre pill + stars
 *   3. Description (only if present and not "Subjects:" auto-junk)
 *   4. Status badge + start-reading / mark-finished button (or undo)
 *   5. Reading progress bar + page input (when reading/finished)
 *   6. Notes list — renders using the shared NoteCard from NotesScreen
 *      with swipe-to-delete, image thumbnails, tag pills.
 *
 * Removed in this redesign:
 *   - Cards tab + flashcard generation flow
 *   - Internal AddNoteModal duplicate
 *   - Internal NoteCard duplicate
 *   - Dark gradient hero
 *
 * Adding a note now opens RichNoteEditor with defaultBook so the user
 * skips the book picker step and lands directly in the editor (with a
 * "Change book" link if they want to swap).
 */

import React, { useState, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { BookCover } from '../components/BookCover';
import { RichNoteEditor } from '../components/RichNoteEditor';
import { NoteCard } from './notes/NoteCard';
import { useTheme } from '../theme';

// ── Stars — interactive rating ────────────────────────────────────────
function Stars({ rating = 0, onRate }) {
  const { C } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => onRate?.(n)}
          activeOpacity={0.7}
          disabled={!onRate}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Ionicons
            name={n <= rating ? 'star' : 'star-outline'}
            size={16}
            color={n <= rating ? C.amber : C.inkFaint}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────
export function BookDetailScreen({ route, navigation }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    // Top nav row — padding mirrors ModalHeader so the back chevron sits at a
    // comfortable tap distance from the status bar / notch.
    topNav: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 56,
    },
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },

    // Hero card — unified container holding identity + status + progress
    heroCard: {
      marginHorizontal: 8,
      marginTop: 8,
      marginBottom: 16,
      borderRadius: 20,
      overflow: 'hidden',
      backgroundColor: C.white,
      borderLeftWidth: 6,
      borderLeftColor: C.sage,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
      elevation: 3,
    },
    heroInner: {
      flexDirection: 'row',
      padding: 18,
      paddingBottom: 16,
      gap: 16,
      alignItems: 'flex-start',
    },
    heroCoverCol: { width: 106 },
    heroInfoCol:  { flex: 1, paddingTop: 2 },

    heroTagPill: {
      alignSelf: 'flex-start',
      backgroundColor: C.amberPale,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      marginBottom: 10,
    },
    heroTagPillTxt: {
      fontFamily: F.serif,
      fontSize: 9,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: 0.6,
    },
    heroTitle: {
      fontFamily: F.serif,
      fontSize: 22,
      color: C.ink,
      letterSpacing: -0.3,
      lineHeight: 28,
      marginBottom: 4,
    },
    heroAuthor: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      marginBottom: 8,
    },
    stars: {
      flexDirection: 'row',
      gap: 3,
    },

    // Genre pills — horizontal scrollable row mirroring DiscoverScreen's sheet
    genreScroll: {
      paddingHorizontal: 18,
      gap: 6,
      paddingBottom: 14,
    },
    genrePill: {
      backgroundColor: C.sagePale,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.sage,
    },
    genrePillTxt: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.sage,
      fontWeight: '700',
    },

    // Divider between identity and status/progress
    heroDivider: {
      height: 0.5,
      backgroundColor: C.border,
      marginHorizontal: 18,
    },

    // Bottom half — status + progress
    heroBottom: {
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 18,
      gap: 16,
    },

    // Description — sits outside the card as commentary
    descWrap: {
      marginHorizontal: 20,
      marginBottom: 16,
    },
    desc: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      lineHeight: 21,
      fontWeight: '400',
    },

    // Status row inside the hero card
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    statusTxt: {
      fontFamily: F.serif,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    actionBtn: {
      backgroundColor: C.ink,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 14,
    },
    actionBtnTxt: {
      fontFamily: F.sans,
      fontSize: 15,
      color: C.white,
      fontWeight: '700',
    },
    undoBtn: {
      backgroundColor: C.cream,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: C.border,
    },
    undoBtnTxt: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      fontWeight: '600',
    },

    // Reading progress — compact, single tap-to-edit row + bar
    progressSection: { gap: 10 },
    progressTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 34,
      gap: 12,
    },
    // Display state — tappable pill showing current page
    pagePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: C.cream,
      borderWidth: 1,
      borderColor: C.border,
    },
    pagePillTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.ink,
      fontWeight: '600',
    },
    // Edit state — inline input + save/cancel
    editRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    editText: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.ink,
      fontWeight: '500',
    },
    editInput: {
      fontFamily: F.sans,
      fontSize: 14,
      color: C.ink,
      fontWeight: '700',
      backgroundColor: C.white,
      borderWidth: 1.5,
      borderColor: C.sage,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      minWidth: 60,
      textAlign: 'center',
    },
    editActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginLeft: 'auto',
    },
    editIconBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: C.cream,
      borderWidth: 1,
      borderColor: C.border,
    },
    editSaveBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      backgroundColor: C.sage,
    },
    progressPct: {
      fontFamily: F.serif,
      fontSize: 22,
      fontWeight: '800',
      color: C.sage,
      letterSpacing: -0.5,
    },
    track: {
      height: 6,
      backgroundColor: C.cream,
      borderRadius: 3,
      overflow: 'hidden',
    },
    fill: {
      height: 6,
      backgroundColor: C.sage,
      borderRadius: 3,
    },

    // Notes section
    notesSection: {
      paddingHorizontal: 8,
    },
    notesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
      paddingHorizontal: 12,
    },
    // Title cluster — serif "Notes" + small muted count number next to it
    notesTitleWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
    },
    notesTitle: {
      fontFamily: F.serif,
      fontSize: 22,
      color: C.ink,
      letterSpacing: -0.3,
    },
    notesCount: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkMuted,
      letterSpacing: -0.2,
    },
    // Add Note pill — compact, sits on far right of header line
    addNotePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: C.sage,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    addNotePillTxt: {
      fontFamily: F.serif,
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    emptyNotes: {
      paddingHorizontal: 30,
      paddingTop: 30,
      paddingBottom: 30,
      alignItems: 'center',
    },
    emptyNotesTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
  }), [themeVersion]);

  const { bookId } = route.params;
  const {
    books, updateBook, removeBook,
    addNote, deleteNoteWithUndo, updateNote,
    bookNotes,
  } = useStore();
  const handleStarNote = (id) => {
    const n = bookNotes(bookId).find(x => x.id === id);
    if (n) updateNote(id, { starred: !n.starred });
  };
  const book = books.find(b => b.id === bookId);

  const [pageInput, setPageInput] = useState(book?.currentPage?.toString() || '');
  const [editingPage, setEditingPage] = useState(false);
  const [editorOpen, setEditorOpen]   = useState(false);
  const [editingNote, setEditingNote] = useState(null);

  if (!book) return null;

  const notes = bookNotes(bookId);
  const progress = book.pageCount ? Math.min(1, book.currentPage / book.pageCount) : 0;
  const pct = Math.round(progress * 100);
  const hasDescription = book.description && !book.description.startsWith('Subjects:');

  // Live preview: while editing, the bar + % reflect the pending input so
  // the user can see their value land before committing.
  const pendingPage = parseInt(pageInput, 10);
  const pendingValid = !isNaN(pendingPage) && pendingPage >= 0 && pendingPage <= book.pageCount;
  const displayPct = editingPage && pendingValid
    ? Math.round(Math.min(1, pendingPage / book.pageCount) * 100)
    : pct;

  const handlePageUpdate = () => {
    const p = parseInt(pageInput, 10);
    if (isNaN(p) || p < 0 || p > book.pageCount) return;
    const patch = { currentPage: p };
    if (p === book.pageCount) {
      patch.status = 'finished';
      patch.finishedAt = new Date().toISOString();
    } else if (book.status === 'want_to_read') {
      patch.status = 'reading';
    }
    updateBook(bookId, patch);
  };

  const startEditPage = () => {
    setPageInput(book.currentPage?.toString() || '0');
    setEditingPage(true);
  };
  const cancelEditPage = () => {
    setPageInput(book.currentPage?.toString() || '0');
    setEditingPage(false);
  };
  const saveEditPage = () => {
    if (!pendingValid) return;
    handlePageUpdate();
    setEditingPage(false);
  };

  const handleRemoveBook = () => {
    Alert.alert('Remove book', `Remove "${book.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeBook(bookId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleStatusToggle = () => {
    if (book.status === 'want_to_read') {
      updateBook(bookId, { status: 'reading' });
    } else if (book.status === 'reading') {
      updateBook(bookId, {
        status: 'finished',
        currentPage: book.pageCount,
        finishedAt: new Date().toISOString(),
      });
    }
  };

  const handleUndoFinished = () => {
    // Flip back to "reading" without losing progress. The old ternary
    // reset to 0 whenever currentPage === pageCount (i.e. always, since
    // finishing snaps to pageCount). Preserve whatever's there.
    updateBook(bookId, {
      status: 'reading',
      finishedAt: null,
    });
  };

  // RichNoteEditor save handler — handles both new and edit
  const handleSaveNote = (data) => {
    if (editingNote) {
      updateNote(editingNote.id, data);
      setEditingNote(null);
    } else {
      addNote({ bookId, bookTitle: book.title, ...data });
    }
    setEditorOpen(false);
  };

  const openNewNote = () => {
    setEditingNote(null);
    setEditorOpen(true);
  };

  const openEditNote = (note) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  const STATUS_META = {
    reading:      { label: 'Reading',     bg: C.amberPale, fg: C.amber },
    want_to_read: { label: 'Want to read', bg: C.cream,     fg: C.inkMuted },
    finished:     { label: 'Finished',    bg: C.sagePale,  fg: C.sage },
    abandoned:    { label: 'Abandoned',   bg: C.cream,     fg: C.inkMuted },
  };
  const statusMeta = STATUS_META[book.status] || STATUS_META.want_to_read;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Rich note editor — handles both new and edit paths.
            defaultBook skips the picker so the user is in the editor
            immediately, with a "Change book" affordance if they want to swap. */}
        <RichNoteEditor
          visible={editorOpen}
          books={books}
          defaultBook={book}
          initialNote={editingNote}
          onSave={handleSaveNote}
          onClose={() => {
            setEditorOpen(false);
            setEditingNote(null);
          }}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 80 }}
        >
          {/* Top nav */}
          <View style={s.topNav}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={C.ink} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRemoveBook} style={s.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={20} color={C.inkMuted} />
            </TouchableOpacity>
          </View>

          {/* Unified hero card — identity (top), divider, status + progress (bottom) */}
          <View style={s.heroCard}>
            {/* Top half — book identity */}
            <View style={s.heroInner}>
              <View style={s.heroCoverCol}>
                <BookCover
                  title={book.title}
                  author={book.author}
                  cover={book.cover}
                  coverId={book.coverId}
                  width={106}
                  height={150}
                />
              </View>
              <View style={s.heroInfoCol}>
                {book.genres?.[0] && (
                  <View style={s.heroTagPill}>
                    <Text style={s.heroTagPillTxt} numberOfLines={1}>
                      {book.genres[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={s.heroTitle} numberOfLines={3}>{book.title}</Text>
                <Text style={s.heroAuthor} numberOfLines={1}>
                  {book.author}{book.year ? ` · ${book.year}` : ''}
                </Text>
                <Stars
                  rating={book.rating}
                  onRate={(r) => updateBook(bookId, { rating: r })}
                />
              </View>
            </View>

            {/* Genre pills — horizontal scroll, mirrors the DiscoverScreen book sheet */}
            {book.genres?.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.genreScroll}
              >
                {book.genres.map((g, i) => (
                  <View key={i} style={s.genrePill}>
                    <Text style={s.genrePillTxt}>{g}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Thin divider separating identity from status/progress */}
            <View style={s.heroDivider} />

            {/* Bottom half — status + progress */}
            <View style={s.heroBottom}>
              <View style={s.statusRow}>
                <View style={[s.statusBadge, { backgroundColor: statusMeta.bg }]}>
                  <Text style={[s.statusTxt, { color: statusMeta.fg }]}>
                    {statusMeta.label}
                  </Text>
                </View>
                {book.status !== 'finished' ? (
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={handleStatusToggle}
                    activeOpacity={0.85}
                  >
                    <Text style={s.actionBtnTxt}>
                      {book.status === 'want_to_read' ? 'Start reading' : 'Mark finished'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={s.undoBtn}
                    onPress={handleUndoFinished}
                    activeOpacity={0.85}
                  >
                    <Text style={s.undoBtnTxt}>Undo</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Reading progress — compact tap-to-edit. The page pill IS
                  the edit affordance: tap to enter edit mode, inline input
                  appears with save/cancel. The bar and % update live as
                  the user types so they can preview the change. */}
              {(book.status === 'reading' || book.status === 'finished') && book.pageCount > 0 && (
                <View style={s.progressSection}>
                  <View style={s.progressTopRow}>
                    {editingPage ? (
                      <View style={s.editRow}>
                        <Text style={s.editText}>Page</Text>
                        <TextInput
                          style={s.editInput}
                          value={pageInput}
                          onChangeText={setPageInput}
                          keyboardType="numeric"
                          autoFocus
                          selectTextOnFocus
                          returnKeyType="done"
                          onSubmitEditing={saveEditPage}
                          maxLength={5}
                          placeholderTextColor={C.inkFaint}
                        />
                        <Text style={s.editText}>of {book.pageCount}</Text>
                        <View style={s.editActions}>
                          <TouchableOpacity
                            onPress={cancelEditPage}
                            style={s.editIconBtn}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="close" size={16} color={C.inkMuted} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={saveEditPage}
                            style={[s.editSaveBtn, !pendingValid && { opacity: 0.35 }]}
                            disabled={!pendingValid}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={startEditPage}
                        activeOpacity={0.7}
                        style={s.pagePill}
                      >
                        <Ionicons name="book-outline" size={13} color={C.inkMuted} />
                        <Text style={s.pagePillTxt}>
                          Page {book.currentPage} of {book.pageCount}
                        </Text>
                        <Ionicons name="pencil-outline" size={12} color={C.inkFaint} />
                      </TouchableOpacity>
                    )}

                    <Text style={s.progressPct}>{displayPct}%</Text>
                  </View>

                  <View style={s.track}>
                    <View style={[s.fill, { width: `${displayPct}%` }]} />
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Description (outside the card — feels like commentary, not metadata) */}
          {hasDescription && (
            <View style={s.descWrap}>
              <Text style={s.desc}>{book.description}</Text>
            </View>
          )}

          {/* Notes section */}
          <View style={s.notesSection}>
            <View style={s.notesHeader}>
              {/* Title + count on the left */}
              <View style={s.notesTitleWrap}>
                <Text style={s.notesTitle}>Notes</Text>
                {notes.length > 0 && (
                  <Text style={s.notesCount}>{notes.length}</Text>
                )}
              </View>
              {/* Add Note pill on the far right of the same line */}
              <TouchableOpacity
                style={s.addNotePill}
                onPress={openNewNote}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text style={s.addNotePillTxt}>Add Note</Text>
              </TouchableOpacity>
            </View>

            {/* Notes list — uses the shared NoteCard from NotesScreen.
                showBook=false since the user is already on the book page. */}
            {notes.length === 0 ? (
              <View style={s.emptyNotes}>
                <Text style={s.emptyNotesTxt}>
                  No notes yet. Tap "Add Note" to capture your first thought.
                </Text>
              </View>
            ) : (
              <>
                {[...notes.filter(n => n.starred), ...notes.filter(n => !n.starred)].map(n => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    onDelete={deleteNoteWithUndo}
                    onEdit={openEditNote}
                    onStar={handleStarNote}
                    showBook={false}
                  />
                ))}
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

