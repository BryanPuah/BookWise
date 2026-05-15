/**
 * DayPanel — bottom-sheet agenda for a selected day.
 *
 * Shows the week strip across the top, then a single DaySection inside a
 * scrollable agenda: Daily Reflection → Goals → expandable Books with
 * nested notes. A FAB at the bottom opens GoalEditor for a new goal.
 *
 * All inner pieces (DaySection, DailyReflectionSection, ExpandableBookCard,
 * NestedNoteRow) live in this file because they share useDpnlStyles and
 * are only ever reached from DayPanel.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View, TouchableOpacity, ScrollView, StyleSheet,
  Modal, Animated,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppText as Text, AppTextInput as TextInput } from '../AppText';
import { useStore } from '../../store';
import { GoalEditor } from '../../screens/GoalsScreen';
import { useTheme } from '../../theme';
import {
  SH, MONTH_NAMES_SHORT,
  dateKey, useDragToDismiss,
} from './hooks';

// ── DayPanel shared styles ───────────────────────────────────────────
// DayPanel and all its inner sections consume the same `dpnl` set. Each
// component calls useDpnlStyles independently so theme changes propagate
// everywhere via the shared useTheme subscription.
function useDpnlStyles() {
  const { C, F, themeVersion } = useTheme();
  return useMemo(() => StyleSheet.create({
    overlay:  { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim },
    sheet: {
      backgroundColor: C.paper,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 20,
    },
    dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
    handleWrap:  { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
    handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    monthBtn: { flexDirection: 'row', alignItems: 'baseline' },
    monthTxt: { fontFamily: F.serif, fontSize: 17, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
    monthChev:{ fontFamily: F.serif, fontSize: 14, color: C.inkMuted, marginLeft: 2 },
    todayTxt: { fontFamily: F.serif, fontSize: 15, color: C.ink, fontWeight: '600' },

    weekStrip: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingBottom: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
    },
    weekCell: {
      flex: 1, alignItems: 'center',
      paddingTop: 4, paddingBottom: 6,
      position: 'relative',
    },
    weekDayLabel: {
      fontFamily: F.serif, fontSize: 11,
      color: C.ink, fontWeight: '800',
      letterSpacing: 0.6, marginBottom: 6,
    },
    weekDayNum: { fontFamily: F.serif, fontSize: 16, color: C.ink, fontWeight: '700' },
    weekDayNumSelected: { fontFamily: F.serif, color: C.ink, fontWeight: '800' },
    weekDayNumToday:    { fontFamily: F.serif, color: C.ink, fontWeight: '900' },
    weekUnderline: {
      position: 'absolute', bottom: 2,
      height: 2, width: 18,
      borderRadius: 1, backgroundColor: C.ink,
    },
    weekDot: {
      position: 'absolute', bottom: 3,
      width: 3, height: 3,
      borderRadius: 1.5, backgroundColor: C.inkMuted,
    },

    section: { paddingHorizontal: 20, paddingTop: 18 },
    sectionHeader: {
      flexDirection: 'row', alignItems: 'baseline',
      gap: 8, marginBottom: 10,
    },
    sectionLabel: {
      fontFamily: F.serif, fontSize: 16,
      fontWeight: '700', color: C.ink, letterSpacing: -0.2,
    },
    sectionDate: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, fontWeight: '500' },
    emptyDay: { paddingVertical: 18 },
    emptyDayTxt: { fontFamily: F.serif, fontSize: 13, color: C.inkFaint, fontStyle: 'italic' },

    activityIconWrap: {
      width: 36, height: 36, borderRadius: 8,
      backgroundColor: C.cream,
      alignItems: 'center', justifyContent: 'center',
    },
    activityTag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6 },
    activityTagTxt: {
      fontFamily: F.serif, fontSize: 9, fontWeight: '700',
      color: C.ink, letterSpacing: 0.6,
    },

    reflectionPrompt: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
      paddingHorizontal: 14, paddingVertical: 14,
    },
    reflectionPromptTxt: {
      flex: 1, fontFamily: F.serif, fontSize: 14,
      color: C.inkSoft, fontWeight: '500', letterSpacing: -0.1,
    },
    reflectionCard: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 14, paddingVertical: 14,
    },
    reflectionBody: {
      fontFamily: F.serif, fontSize: 14,
      color: C.ink, lineHeight: 21, letterSpacing: -0.1,
    },
    reflectionMeta: { fontFamily: F.serif, fontSize: 11, color: C.inkFaint, marginTop: 6 },
    reflectionEditor: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.amberPale,
      padding: 14,
    },
    reflectionInput: {
      fontFamily: F.serif, fontSize: 14,
      color: C.ink, lineHeight: 21,
      minHeight: 80, padding: 0,
    },
    reflectionActions: {
      flexDirection: 'row', justifyContent: 'flex-end',
      alignItems: 'center', gap: 14,
      marginTop: 10, paddingTop: 10,
      borderTopWidth: 0.5, borderTopColor: C.border,
    },
    reflectionCancel: {
      fontFamily: F.serif, fontSize: 13,
      color: C.inkMuted, fontWeight: '500',
    },
    reflectionSaveBtn: {
      backgroundColor: C.ink,
      paddingHorizontal: 16, paddingVertical: 8,
      borderRadius: 10,
    },
    reflectionSaveTxt: {
      fontFamily: F.serif, fontSize: 13,
      color: C.white, fontWeight: '700', letterSpacing: 0.2,
    },

    bookCard: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1, borderColor: C.border,
      marginBottom: 10,
      overflow: 'hidden',
    },
    bookCardHeader: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 12,
      paddingHorizontal: 14, paddingVertical: 14,
    },
    bookCardTitle: {
      fontFamily: F.serif, fontSize: 18,
      color: C.ink, letterSpacing: -0.3, lineHeight: 24,
    },
    bookCardSub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, marginTop: 2 },
    bookCardRight: { alignItems: 'flex-end', gap: 8 },
    bookCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    bookCardCount: {
      fontFamily: F.serif, fontSize: 11,
      color: C.inkMuted, fontWeight: '600',
    },

    progressRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginTop: 10,
    },
    progressTrack: {
      flex: 1, height: 3,
      backgroundColor: C.cream,
      borderRadius: 2, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: C.sage, borderRadius: 2 },
    progressPct: {
      fontFamily: F.serif, fontSize: 10,
      color: C.inkMuted, fontWeight: '600',
      minWidth: 28, textAlign: 'right',
    },

    notesNested: {
      backgroundColor: C.paper,
      paddingHorizontal: 14,
      paddingTop: 6, paddingBottom: 6,
      borderTopWidth: 0.5, borderTopColor: C.border,
    },
    nestedNoteRow: {
      flexDirection: 'row', alignItems: 'center',
      gap: 10, paddingVertical: 10,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    nestedNoteDot: {
      width: 5, height: 5, borderRadius: 3,
      backgroundColor: C.sage,
    },
    nestedNoteTitle: {
      fontFamily: F.serif, fontSize: 14,
      color: C.ink, fontWeight: '600', letterSpacing: -0.1,
    },
    nestedNoteBody: {
      fontFamily: F.serif, fontSize: 12,
      color: C.inkMuted, marginTop: 2,
    },

    subsectionHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'baseline', marginBottom: 10,
    },
    subsectionTitle: {
      fontFamily: F.serif, fontSize: 13, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 0.6, textTransform: 'uppercase',
    },

    goalsHeader: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'baseline', marginBottom: 8,
    },
    goalsTitle: {
      fontFamily: F.serif, fontSize: 14, fontWeight: '700',
      color: C.ink, letterSpacing: -0.2,
    },
    manageLink: {
      fontFamily: F.serif, fontSize: 12,
      color: C.inkSoft, fontWeight: '600',
    },
    goalRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: C.white,
      borderRadius: 12,
      borderWidth: 1, borderColor: C.border,
      paddingHorizontal: 14, paddingVertical: 12,
      marginBottom: 8, gap: 12,
    },
    goalLabel: {
      flex: 1, fontFamily: F.serif, fontSize: 14,
      color: C.ink, fontWeight: '500',
    },
    goalLabelDone: {
      fontFamily: F.serif, color: C.inkFaint,
      textDecorationLine: 'line-through',
    },
    goalTag: {
      backgroundColor: C.sagePale,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 6,
    },
    goalTagTxt: {
      fontFamily: F.serif, fontSize: 9, fontWeight: '700',
      color: C.ink, letterSpacing: 0.5,
    },

    fab: {
      position: 'absolute',
      right: 24, bottom: 32,
      width: 54, height: 54, borderRadius: 27,
      backgroundColor: C.sage,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 10,
    },
  }), [themeVersion]);
}

// ── Nested note row — compact note display inside an expanded book card
function NestedNoteRow({ note, isLast }) {
  const { C } = useTheme();
  const dpnl = useDpnlStyles();
  const title = note.title?.trim()
    ? note.title.trim()
    : (note.text || '').split('\n')[0].split('. ')[0].slice(0, 70);
  const sub = (() => {
    const rest = (note.text || '').slice(title.length).replace(/^[\.\s]+/, '').trim();
    return rest.split('\n')[0].slice(0, 110);
  })();

  return (
    <TouchableOpacity
      style={[dpnl.nestedNoteRow, isLast && { borderBottomWidth: 0 }]}
      activeOpacity={0.7}
    >
      <View style={dpnl.nestedNoteDot} />
      <View style={{ flex: 1 }}>
        <Text style={dpnl.nestedNoteTitle} numberOfLines={1}>{title}</Text>
        {sub ? (
          <Text style={dpnl.nestedNoteBody} numberOfLines={1}>{sub}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={12} color={C.inkFaint} />
    </TouchableOpacity>
  );
}

// ── Expandable book card — collapsed shows summary; tap to reveal notes
function ExpandableBookCard({ book, bookNotes }) {
  const { C } = useTheme();
  const dpnl = useDpnlStyles();
  const [expanded, setExpanded] = useState(false);
  const count    = bookNotes.length;
  const progress = book.pageCount
    ? Math.min(1, (book.currentPage || 0) / book.pageCount)
    : 0;
  const pct = Math.round(progress * 100);

  return (
    <View style={dpnl.bookCard}>
      <TouchableOpacity
        style={dpnl.bookCardHeader}
        onPress={() => count > 0 && setExpanded(e => !e)}
        activeOpacity={count > 0 ? 0.7 : 1}
      >
        <View style={dpnl.activityIconWrap}>
          <Ionicons name="book" size={20} color={C.sage} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={dpnl.bookCardTitle} numberOfLines={2}>{book.title}</Text>
          <Text style={dpnl.bookCardSub} numberOfLines={1}>
            {book.author}
          </Text>
          {book.pageCount > 0 && (
            <View style={dpnl.progressRow}>
              <View style={dpnl.progressTrack}>
                <View style={[dpnl.progressFill, { width: `${pct}%` }]} />
              </View>
              <Text style={dpnl.progressPct}>{pct}%</Text>
            </View>
          )}
        </View>

        <View style={dpnl.bookCardRight}>
          {book.genres?.[0] && (
            <View style={[dpnl.activityTag, { backgroundColor: C.sagePale }]}>
              <Text style={dpnl.activityTagTxt}>{book.genres[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={dpnl.bookCardMeta}>
            <Text style={dpnl.bookCardCount}>
              {count} {count === 1 ? 'note' : 'notes'}
            </Text>
            {count > 0 && (
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={C.inkFaint}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {expanded && count > 0 && (
        <View style={dpnl.notesNested}>
          {bookNotes.map((n, i) => (
            <NestedNoteRow key={n.id} note={n} isLast={i === bookNotes.length - 1} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Daily Reflection section ──────────────────────────────────────────
// Always visible; empty state shows a "Write today's reflection" prompt.
// Tapping flips to an inline editor with Save / Cancel.
function DailyReflectionSection({ reflection, onSave }) {
  const { C } = useTheme();
  const dpnl = useDpnlStyles();
  const hasReflection = !!reflection?.text;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(reflection?.text || '');

  // Keep draft in sync if the reflection prop changes (e.g. user switches
  // selected day in the panel and the parent passes a new reflection).
  useEffect(() => {
    setDraft(reflection?.text || '');
  }, [reflection?.id, reflection?.text]);

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(reflection?.text || '');
    setEditing(false);
  };

  return (
    <View style={{ marginBottom: 22 }}>
      <View style={dpnl.subsectionHeader}>
        <Text style={dpnl.subsectionTitle}>Daily Reflection</Text>
      </View>

      {editing ? (
        <View style={dpnl.reflectionEditor}>
          <TextInput
            style={dpnl.reflectionInput}
            value={draft}
            onChangeText={setDraft}
            placeholder="What's on your mind today?"
            placeholderTextColor={C.inkFaint}
            multiline
            autoFocus
            textAlignVertical="top"
          />
          <View style={dpnl.reflectionActions}>
            <TouchableOpacity onPress={handleCancel} activeOpacity={0.6}>
              <Text style={dpnl.reflectionCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={dpnl.reflectionSaveBtn}
              activeOpacity={0.85}
            >
              <Text style={dpnl.reflectionSaveTxt}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : hasReflection ? (
        <TouchableOpacity
          style={dpnl.reflectionCard}
          onPress={() => setEditing(true)}
          activeOpacity={0.85}
        >
          <View style={[dpnl.activityIconWrap, { backgroundColor: C.amberPale }]}>
            <Ionicons name="create" size={18} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={dpnl.reflectionBody} numberOfLines={4}>
              {reflection.text}
            </Text>
            <Text style={dpnl.reflectionMeta}>Tap to edit</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={dpnl.reflectionPrompt}
          onPress={() => setEditing(true)}
          activeOpacity={0.7}
        >
          <View style={[dpnl.activityIconWrap, { backgroundColor: C.amberPale }]}>
            <Ionicons name="create-outline" size={18} color={C.amber} />
          </View>
          <Text style={dpnl.reflectionPromptTxt}>Write today's reflection</Text>
          <Ionicons name="add" size={18} color={C.inkMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Single day section inside DayPanel ────────────────────────────────
function DaySection({
  label, dateLine,
  notes, books,
  goals, dateKey: dKey, isGoalCompletedOn, toggleGoalCompletion,
  onManageGoals,
  reflection, onSaveReflection,
}) {
  const { C } = useTheme();
  const dpnl = useDpnlStyles();
  const bookNotes = notes;

  const hasGoals = goals.length > 0;
  const hasBooks = books.length > 0;
  // The reflection section ALWAYS shows (with empty-state prompt when empty)
  // so the "rest day" empty state only fires when no goals + no books.
  const allEmpty = !hasGoals && !hasBooks;

  const notesByBookId = bookNotes.reduce((acc, n) => {
    (acc[n.bookId] = acc[n.bookId] || []).push(n);
    return acc;
  }, {});

  return (
    <View style={dpnl.section}>
      <View style={dpnl.sectionHeader}>
        <Text style={dpnl.sectionLabel}>{label}</Text>
        <Text style={dpnl.sectionDate}>{dateLine}</Text>
      </View>

      <DailyReflectionSection
        reflection={reflection}
        onSave={(text) => onSaveReflection(dKey, text)}
      />

      {allEmpty && (
        <View style={dpnl.emptyDay}>
          <Text style={dpnl.emptyDayTxt}>Nothing logged for this day yet.</Text>
        </View>
      )}

      {hasGoals && (
        <View style={{ marginBottom: 22 }}>
          <View style={dpnl.subsectionHeader}>
            <Text style={dpnl.subsectionTitle}>Goals</Text>
            {onManageGoals && (
              <TouchableOpacity onPress={onManageGoals} activeOpacity={0.6}>
                <Text style={dpnl.manageLink}>Edit goals</Text>
              </TouchableOpacity>
            )}
          </View>
          {goals.map(g => {
            const completed = isGoalCompletedOn(g.id, dKey);
            return (
              <TouchableOpacity
                key={g.id}
                style={dpnl.goalRow}
                onPress={() => toggleGoalCompletion(g.id, dKey)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={completed ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={completed ? C.sage : C.inkFaint}
                />
                <Text style={[dpnl.goalLabel, completed && dpnl.goalLabelDone]}>
                  {g.label}
                </Text>
                <View style={dpnl.goalTag}>
                  <Text style={dpnl.goalTagTxt}>{g.tag}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {hasBooks && (
        <View>
          <View style={dpnl.subsectionHeader}>
            <Text style={dpnl.subsectionTitle}>
              Books read today · {books.length}
            </Text>
          </View>
          {books.map(book => (
            <ExpandableBookCard
              key={book.id}
              book={book}
              bookNotes={notesByBookId[book.id] || []}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export function DayPanel({ visible, day, data, onClose, onManageGoals }) {
  const { C } = useTheme();
  const dpnl = useDpnlStyles();
  const drag = useDragToDismiss({ onClose });
  const {
    notes, books,
    goals, addGoal, toggleGoalCompletion, isGoalCompletedOn, goalsForDate,
    reflectionForDate, upsertReflection,
  } = useStore();

  const [selectedDate, setSelectedDate] = useState(day || new Date());
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (visible && day) {
      setSelectedDate(day);
      drag.open();
    }
  }, [visible, day]);

  const handleClose = () => drag.dismiss(() => onClose());

  const selectedKey = dateKey(selectedDate);
  const todayKey    = dateKey(new Date());
  const isToday     = selectedKey === todayKey;

  const weekDays = useMemo(() => {
    const startOfWeek = new Date(selectedDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const key = dateKey(d);
      const hasContent = notes.some(n => (n.date || '').slice(0, 10) === key);
      return { date: d, key, hasContent };
    });
  }, [selectedDate, notes]);

  const notesForDate = (key) =>
    notes.filter(n => (n.date || '').slice(0, 10) === key);

  const booksForDate = (key) => {
    const ns = notesForDate(key);
    const bookIds = [...new Set(ns.map(n => n.bookId))];
    return bookIds.map(id => books.find(b => b.id === id)).filter(Boolean);
  };

  const formatDayHeader = (d) => {
    return d.toLocaleDateString('en-AU', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleAddGoal = (data) => {
    addGoal({
      id: `g_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label:      data.label,
      tag:        data.tag,
      recurrence: data.recurrence,
      weekday:    data.weekday,
      monthDay:   data.monthDay,
      dueDate:    data.dueDate,
      created:    new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={dpnl.overlay}>
        <Animated.View style={[dpnl.backdrop, { opacity: drag.backdropOpacity }]} pointerEvents="none" />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />

        <Animated.View style={[dpnl.sheet, { transform: [{ translateY: drag.translateY }], height: SH * 0.92 }]}>
          <View style={{ position: 'relative' }}>
            <View {...drag.overlayHandlers} style={dpnl.dragOverlay} pointerEvents="box-none" />

            <View {...drag.panHandlers} style={dpnl.handleWrap}>
              <View style={dpnl.handle} />
            </View>

            <View style={dpnl.topBar}>
              <TouchableOpacity style={dpnl.monthBtn} onPress={handleClose} activeOpacity={0.6}>
                <Text style={dpnl.monthTxt}>
                  {MONTH_NAMES_SHORT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </Text>
                <Text style={dpnl.monthChev}> ⌄</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goToToday} activeOpacity={0.6} disabled={isToday}>
                <Text style={[dpnl.todayTxt, isToday && { opacity: 0.4 }]}>Today</Text>
              </TouchableOpacity>
            </View>

            <View style={dpnl.weekStrip}>
              {weekDays.map(({ date, key, hasContent }) => {
                const isSel = key === selectedKey;
                const isTodayCell = key === todayKey;
                return (
                  <TouchableOpacity
                    key={key}
                    style={dpnl.weekCell}
                    onPress={() => setSelectedDate(date)}
                    activeOpacity={0.6}
                  >
                    <Text style={dpnl.weekDayLabel}>
                      {['S','M','T','W','T','F','S'][date.getDay()]}
                    </Text>
                    <Text style={[
                      dpnl.weekDayNum,
                      isSel && dpnl.weekDayNumSelected,
                      !isSel && isTodayCell && dpnl.weekDayNumToday,
                    ]}>
                      {date.getDate()}
                    </Text>
                    {isSel && <View style={dpnl.weekUnderline} />}
                    {hasContent && !isSel && <View style={dpnl.weekDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 140 }}
            showsVerticalScrollIndicator={false}
          >
            <DaySection
              label={isToday ? 'Today' : 'Selected'}
              dateLine={formatDayHeader(selectedDate)}
              notes={notesForDate(selectedKey)}
              books={booksForDate(selectedKey)}
              goals={goalsForDate(selectedKey)}
              dateKey={selectedKey}
              isGoalCompletedOn={isGoalCompletedOn}
              toggleGoalCompletion={toggleGoalCompletion}
              onManageGoals={onManageGoals}
              reflection={reflectionForDate(selectedKey)}
              onSaveReflection={upsertReflection}
            />
          </ScrollView>

          <TouchableOpacity
            style={dpnl.fab}
            onPress={() => setEditorOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={26} color={C.white} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <GoalEditor
        visible={editorOpen}
        goal={null}
        onSave={handleAddGoal}
        onClose={() => setEditorOpen(false)}
        defaultRecurrence="daily"
        defaultDueDate={selectedKey}
      />
    </Modal>
  );
}
