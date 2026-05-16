/**
 * NotesScreen — Knowledge Base.
 *
 * Four-view architecture:
 *  1. EXPLORE  — flat browse, search + tag filter
 *  2. BY BOOK  — notes grouped under their book, drills into BookNotesScreen
 *  3. BY TYPE  — notes grouped by type (quote / insight / question / …)
 *  4. GRAPH    — Obsidian-style force-directed graph
 *
 * The four views live in their own files under ./notes/. This file is just
 * the tab strip + the new/edit RichNoteEditor wiring + the store glue.
 *
 * The "+ Add Note" FAB lives in App.js — no in-screen add button.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../components/AppText';
import { useStore, todayKey } from '../store';
import { genId } from '../schema';
import { AppHeader } from '../components/AppHeader';
import { RichNoteEditor } from '../components/RichNoteEditor';
import { useTheme } from '../theme';
import { ExploreView } from './notes/ExploreView';
import { ByBookView } from './notes/ByBookView';
import { ByTypeView } from './notes/ByTypeView';
import { GraphView } from './notes/GraphView';

// Re-export NoteCard so callers like BookDetailScreen that historically
// imported it from NotesScreen keep working.
export { NoteCard } from './notes/NoteCard';

export function NotesScreen({ navigation, route }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
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
    tabTxt: { fontFamily: F.serif, fontSize: 14, color: C.inkMuted, fontWeight: '500' },
    tabTxtActive: { fontFamily: F.serif, color: C.ink, fontWeight: '700' },
    tabUnderline: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 2, backgroundColor: C.ink, borderRadius: 1,
    },
  }), [themeVersion]);

  const { notes, books, addNote, deleteNote, updateNote } = useStore();
  const [view, setView]                   = useState('explore');
  const [showModal, setShowModal]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNote, setEditNote]           = useState(null);

  const handleSave = (data) => {
    addNote({
      id:            genId('n'),
      bookId:        data.bookId,
      bookTitle:     data.bookTitle,
      title:         data.title || '',
      blocks:        data.blocks || [],
      types:         data.types || [data.type || 'insight'],
      type:          data.type,
      text:          data.text,
      thinking:      data.thinking || '',
      page:          data.page || '',
      chapter:       data.chapter || '',
      tags:          Array.isArray(data.tags) ? data.tags : [],
      linkedNoteIds: Array.isArray(data.linkedNoteIds) ? data.linkedNoteIds : [],
      isQuote:       data.type === 'quote',
      starred:       false,
      date:          todayKey(),
    });
  };

  const handleEdit = (note) => {
    setEditNote(note);
    setShowEditModal(true);
  };

  const handleSaveEdit = (data) => {
    if (!editNote) { setEditNote(null); return; }
    const patch = {
      title:         data.title || '',
      blocks:        data.blocks || [],
      types:         data.types || [data.type || 'insight'],
      type:          data.type,
      text:          data.text,
      thinking:      data.thinking || '',
      page:          data.page || '',
      chapter:       data.chapter || '',
      tags:          Array.isArray(data.tags) ? data.tags : [],
      linkedNoteIds: Array.isArray(data.linkedNoteIds) ? data.linkedNoteIds : [],
      isQuote:       data.type === 'quote',
    };
    // Guard against "deleted mid-edit" — if the underlying note is gone,
    // re-add it from the edit state rather than silently dropping the save.
    const stillExists = notes.some(n => n.id === editNote.id);
    if (stillExists) {
      updateNote(editNote.id, patch);
    } else {
      addNote({
        ...editNote,
        ...patch,
        starred: editNote.starred || false,
      });
    }
    setEditNote(null);
  };

  const handleStar = (id) => {
    const note = notes.find(n => n.id === id);
    if (note) updateNote(id, { starred: !note.starred });
  };

  const handleDelete = (id) => deleteNote(id);

  // Honour `editNoteId` route param — set when a note is tapped from the
  // global search modal. Opens that note in the editor. The `_t`
  // cache-buster lets the same note be reopened after being closed.
  //
  // `notes` is deliberately not a dependency: re-running this effect
  // whenever the store updates would re-fire while the editor is open and
  // overwrite the in-flight edit state with the stored snapshot. The route
  // param is the only trigger we want.
  useEffect(() => {
    const id = route?.params?.editNoteId;
    if (!id) return;
    const note = notes.find(n => n.id === id);
    if (note) {
      setEditNote(note);
      setShowEditModal(true);
    }
    navigation.setParams({ editNoteId: undefined, _t: undefined });
  }, [route?.params?.editNoteId, route?.params?._t]);

  const VIEWS = [
    { key: 'explore',  label: 'Explore' },
    { key: 'by_book',  label: 'By Book' },
    { key: 'by_type',  label: 'Note Type' },
    { key: 'graph',    label: 'Graph' },
  ];

  const sharedProps = {
    notes, books,
    onStar: handleStar,
    onDelete: handleDelete,
    onEdit: handleEdit,
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
      <AppHeader onAvatarPress={() => navigation.navigate('Profile')} />

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
      {view === 'by_type' && <ByTypeView notes={notes} onDelete={handleDelete} onEdit={handleEdit} />}
      {view === 'graph'   && <GraphView notes={notes} books={books} onEdit={handleEdit} onDelete={handleDelete} />}

    </SafeAreaView>
  );
}
