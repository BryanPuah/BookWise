/**
 * NotesScreen — Knowledge Base.
 *
 * Two-axis navigation:
 *   • Lens   — List | Graph     (how the notes are visualised)
 *   • Group  — All · Book · Type (how they're pivoted within the lens)
 *
 * The old 4-tab strip (Explore / By Book / Note Type / Graph) collapsed
 * one organisational pivot (Book / Type) with one visualisation choice
 * (Graph), which forced GraphView to render its own duplicate grouping
 * toggle. Splitting them removes the duplication and lets the user
 * combine a lens with any grouping independently.
 *
 * Children:
 *   List + group=all  → ExploreView   (flat, filter + sort)
 *   List + group=book → ByBookView    (hub list, drill into BookNotesScreen)
 *   List + group=type → ByTypeView    (hub list, drill into TypeNotesScreen)
 *   Graph + group=*   → GraphView     (group decides hub clustering)
 *
 * The "+ Add Note" FAB lives in App.js — no in-screen add button. Empty
 * states pass `onCapture` so their CTA can open the editor directly.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText as Text } from '../components/AppText';
import { useStore } from '../store';
import { AppHeader } from '../components/AppHeader';
import { RichNoteEditor } from '../components/RichNoteEditor';
import { useTheme } from '../theme';
import { ExploreView } from './notes/ExploreView';
import { ByBookView } from './notes/ByBookView';
import { ByTypeView } from './notes/ByTypeView';
import { GraphView } from './notes/GraphView';
import { TrashView } from './notes/TrashView';

// Re-export NoteCard so callers like BookDetailScreen that historically
// imported it from NotesScreen keep working.
export { NoteCard } from './notes/NoteCard';

// ── Segmented control ────────────────────────────────────────────────
// Pill-style segmented selector used for both Lens (List | Graph) and
// Group (All · Book · Type). Single shared component keeps the two
// controls visually consistent.
function Segmented({ value, onChange, options, ariaLabel }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    strip: {
      flexDirection: 'row',
      backgroundColor: C.cream,
      borderRadius: 999,
      padding: 3,
      borderWidth: 0.5, borderColor: C.border,
    },
    seg: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Active pill picks up the user's chosen accent so the main view
    // controls echo the settings palette. `C.sage` is the legacy public-
    // API name for the active accent token (see theme.js / CLAUDE.md) —
    // it is NOT a hardcoded sage-green. Contrast against fixed white is
    // tuned for AA across every accent.
    segActive: {
      backgroundColor: C.sage,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowOffset: { width: 0, height: 1 },
      shadowRadius: 2,
      elevation: 1,
    },
    segTxt: {
      fontFamily: F.serif, fontSize: 13, color: C.inkMuted,
      fontWeight: '600', letterSpacing: 0.1,
    },
    // Fixed white — `C.white` is a surface token that collapses to a
    // near-black in dark mode, which would make the label invisible on
    // the accent fill.
    segTxtActive: { color: '#FFFFFF', fontWeight: '700' },
  }), [themeVersion]);

  return (
    <View
      style={s.strip}
      accessibilityRole="tablist"
      accessibilityLabel={ariaLabel}
    >
      {options.map(opt => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[s.seg, active && s.segActive]}
            onPress={() => onChange(opt.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
          >
            <Text style={[s.segTxt, active && s.segTxtActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function NotesScreen({ navigation, route }) {
  const { C, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    controls: {
      paddingHorizontal: 20,
      paddingBottom: 10,
      gap: 8,
    },
  }), [themeVersion]);

  const {
    notes, books, trashedNotes,
    addNote, deleteNoteWithUndo, updateNote, restoreNote, toggleStar,
  } = useStore();

  const [lens,  setLens]  = useState('list');  // 'list' | 'graph'
  const [group, setGroup] = useState('all');   // 'all' | 'book' | 'type'

  const [showModal, setShowModal]         = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNote, setEditNote]           = useState(null);

  // Graph doesn't have a meaningful 'all' mode (no hubs to cluster
  // around) — when switching to the Graph lens with group=all, default
  // to Book clustering. Switching back to List restores the user's
  // intent, but if they came in via group=all we keep them on book
  // since that's where the graph put them. Trash is a list-only pivot:
  // switching to Graph from Trash drops back to Book clustering.
  useEffect(() => {
    if (lens === 'graph' && (group === 'all' || group === 'trash')) setGroup('book');
  }, [lens]);

  const openCapture = useCallback(() => setShowModal(true), []);

  const handleSave = useCallback((data) => { addNote(data); }, [addNote]);

  // Handlers passed down to NoteCard are useCallback'd with stable deps so
  // the memo'd card's prop check actually fires — without this, every
  // parent re-render (e.g. notes array identity change from a star toggle
  // elsewhere) would hand each NoteCard a fresh function ref and force a
  // re-render across the whole visible list.
  const handleEdit = useCallback((note) => {
    setEditNote(note);
    setShowEditModal(true);
  }, []);

  // handleStar routes through the new store-level `toggleStar`, which
  // reads the note's current `starred` value inside its setNotes callback.
  // This keeps the handler dep-free (no `notes` closure) and stable across
  // notes mutations — so toggling a star in one row doesn't re-render every
  // other NoteCard in the list.
  const handleStar = useCallback((id) => toggleStar(id), [toggleStar]);

  // Direct pass-through — `deleteNoteWithUndo` is already a stable store
  // callback. Wrapping it in useCallback here keeps the call site explicit
  // about what flows into the children.
  const handleDelete = useCallback((id) => deleteNoteWithUndo(id), [deleteNoteWithUndo]);

  // Edit-save guards against "deleted mid-edit". Three states for the
  // underlying note:
  //   • still live          → patch in place.
  //   • trashed mid-edit    → restore it (clears the trashed flag) and patch.
  //   • truly purged        → re-add as new, preserving the original id/date.
  //
  // Reads `editNote`, `notes`, and `trashedNotes` from closure so its deps
  // include them. This handler is only passed to the editor modal (not to
  // every NoteCard), so identity churn here doesn't affect list re-renders.
  const handleSaveEdit = useCallback((data) => {
    if (!editNote) { setEditNote(null); return; }
    const stillExists = notes.some(n => n.id === editNote.id);
    if (stillExists) {
      updateNote(editNote.id, data);
    } else if (trashedNotes.some(n => n.id === editNote.id)) {
      restoreNote(editNote.id);
      updateNote(editNote.id, data);
    } else {
      addNote({ ...editNote, ...data });
    }
    setEditNote(null);
  }, [editNote, notes, trashedNotes, addNote, updateNote, restoreNote]);

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

  const LENS_OPTIONS = [
    { key: 'list',  label: 'List' },
    { key: 'graph', label: 'Graph' },
  ];

  // Graph mode only offers Book/Type — 'All' has no meaning without hubs,
  // and 'Trash' is list-only. List mode also exposes the Trash pivot with
  // a count chip so users can see how much is waiting to be auto-purged.
  const trashLabel = trashedNotes.length > 0 ? `Trash · ${trashedNotes.length}` : 'Trash';
  const GROUP_OPTIONS = lens === 'graph'
    ? [
        { key: 'book', label: 'By Book' },
        { key: 'type', label: 'By Type' },
      ]
    : [
        { key: 'all',   label: 'All' },
        { key: 'book',  label: 'By Book' },
        { key: 'type',  label: 'By Type' },
        { key: 'trash', label: trashLabel },
      ];

  const sharedProps = {
    notes, books,
    onStar: handleStar,
    onDelete: handleDelete,
    onEdit: handleEdit,
    onCapture: openCapture,
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

      {/* Top app bar — Profile lives on the parent Tab.Navigator, not on
          this screen's local nav, so we hop up via getParent regardless of
          which stack this screen is nested under. */}
      <AppHeader
        onAvatarPress={() => navigation.getParent('MainTabs')?.navigate('Profile')}
      />

      {/* Lens + Group controls */}
      <View style={s.controls}>
        <Segmented
          value={lens}
          onChange={setLens}
          options={LENS_OPTIONS}
          ariaLabel="View as"
        />
        <Segmented
          value={group}
          onChange={setGroup}
          options={GROUP_OPTIONS}
          ariaLabel="Group by"
        />
      </View>

      {/* Views */}
      {lens === 'list' && group === 'all'   && <ExploreView {...sharedProps} />}
      {lens === 'list' && group === 'book'  && <ByBookView {...sharedProps} navigation={navigation} />}
      {lens === 'list' && group === 'type'  && <ByTypeView notes={notes} onDelete={handleDelete} onEdit={handleEdit} onStar={handleStar} onCapture={openCapture} />}
      {lens === 'list' && group === 'trash' && <TrashView />}
      {lens === 'graph' && (
        <GraphView
          notes={notes}
          books={books}
          groupBy={group === 'type' ? 'type' : 'book'}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStar={handleStar}
          onCapture={openCapture}
          onSwitchToList={() => setLens('list')}
        />
      )}

    </SafeAreaView>
  );
}
