/**
 * GoalsScreen — manage goal templates (any recurrence).
 *
 * Each goal has a recurrence: 'daily' | 'weekly' | 'monthly' | 'once'.
 *   daily   — shows every day
 *   weekly  — shows on a chosen weekday (e.g. every Sunday)
 *   monthly — shows on a chosen day of the month (e.g. the 15th)
 *   once    — shows only on a specific date
 *
 * Accessible from the "Manage" link in the DayPanel's Goals section.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, Modal,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Swipeable } from 'react-native-gesture-handler';
import { useStore, todayKey } from '../store';
import { genId } from '../schema';
import { C, useTheme } from '../theme';

// Suggested tags
const TAG_SUGGESTIONS = ['READING', 'WRITING', 'ADMIN', 'STUDY', 'HEALTH', 'CREATIVE'];

// Tag tints are built from the *active* palette so they re-theme along with
// the rest of the chrome. Call `useTagTint()` inside a component to get a
// `getTagTint(tag)` that's already bound to the current C.
function useTagTint() {
  const { C, themeVersion } = useTheme();
  return useMemo(() => {
    const map = {
      READING:  { bg: C.sagePale,  fg: C.ink },
      WRITING:  { bg: C.amberPale, fg: C.ink },
      ADMIN:    { bg: C.cream,     fg: C.inkSoft },
      STUDY:    { bg: C.sagePale,  fg: C.ink },
      HEALTH:   { bg: C.amberPale, fg: C.ink },
      CREATIVE: { bg: C.cream,     fg: C.inkSoft },
    };
    return (tag) => map[String(tag).toUpperCase()] || { bg: C.cream, fg: C.inkSoft };
  }, [themeVersion]);
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_FULL    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Format a goal's recurrence in human-readable form
export function formatRecurrence(goal) {
  switch (goal.recurrence) {
    case 'daily':   return 'Daily';
    case 'weekly':  return goal.weekday != null ? `Weekly · ${WEEKDAY_FULL[goal.weekday]}` : 'Weekly';
    case 'monthly': return goal.monthDay != null ? `Monthly · Day ${goal.monthDay}` : 'Monthly';
    case 'once':    return goal.dueDate
      ? new Date(goal.dueDate + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'One-off';
    default:        return 'Daily';
  }
}

// ── Goal editor modal — used for Add and Edit ─────────────────────────
export function GoalEditor({ visible, goal, onSave, onClose, defaultRecurrence = 'daily', defaultDueDate = null }) {
  const { C, F, themeVersion } = useTheme();
  const [label, setLabel]           = useState('');
  const [tag, setTag]               = useState('');
  const [recurrence, setRecurrence] = useState('daily');
  const [weekday, setWeekday]       = useState(0);
  const [monthDay, setMonthDay]     = useState('1');
  const [dueDate, setDueDate]       = useState(todayKey());

  const ge = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: 20, borderBottomWidth: 1, borderBottomColor: C.border,
    },
    cancel: { fontFamily: F.serif, fontSize: 14, color: C.inkMuted },
    title:  { fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
    save:   { fontFamily: F.serif, fontSize: 14, color: C.ink, fontWeight: '700' },
    label:  { fontFamily: F.sans, fontSize: 10, fontWeight: '700', color: C.inkMuted, letterSpacing: 1, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
    hint:   { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginHorizontal: 20, marginTop: 6, fontStyle: 'italic' },
    mainInput: {
      fontFamily: F.sans,
      marginHorizontal: 20,
      backgroundColor: C.white,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 14, fontSize: 16, color: C.ink,
    },
    numInput: {
      fontFamily: F.sans,
      marginHorizontal: 20,
      backgroundColor: C.white,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 14, fontSize: 15, color: C.ink,
    },
    tagInput: {
      fontFamily: F.sans,
      marginHorizontal: 20,
      backgroundColor: C.white,
      borderRadius: 12, borderWidth: 1, borderColor: C.border,
      padding: 14, fontSize: 13, color: C.ink, letterSpacing: 1,
    },
    recurrenceRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 6,
    },
    recurrenceBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
      alignItems: 'center',
    },
    recurrenceBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
    recurrenceBtnTxt: { fontFamily: F.serif, fontSize: 12, fontWeight: '600', color: C.inkSoft },
    recurrenceBtnTxtActive: { fontFamily: F.serif, color: C.white, fontWeight: '700' },
    weekdayRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: 6,
    },
    weekdayBtn: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 16,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
      alignItems: 'center', justifyContent: 'center',
    },
    weekdayBtnActive: { backgroundColor: C.ink, borderColor: C.ink },
    weekdayBtnTxt: { fontFamily: F.serif, fontSize: 13, fontWeight: '600', color: C.inkSoft },
    weekdayBtnTxtActive: { fontFamily: F.serif, color: C.white, fontWeight: '800' },
    suggestionsRow: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      paddingHorizontal: 20, marginTop: 10,
    },
    suggestion: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: C.cream,
      borderWidth: 1, borderColor: C.border,
    },
    suggestionActive: { backgroundColor: C.ink, borderColor: C.ink },
    suggestionTxt: { fontFamily: F.serif, fontSize: 10, fontWeight: '700', color: C.inkSoft, letterSpacing: 0.6 },
    suggestionTxtActive: { fontFamily: F.serif, color: C.white },
  }), [themeVersion]);

  useEffect(() => {
    if (visible) {
      setLabel(goal?.label || '');
      setTag(goal?.tag || '');
      setRecurrence(goal?.recurrence || defaultRecurrence);
      setWeekday(goal?.weekday != null ? goal.weekday : new Date().getDay());
      setMonthDay(String(goal?.monthDay || new Date().getDate()));
      setDueDate(goal?.dueDate || defaultDueDate || todayKey());
    }
  }, [visible, goal]);

  // A 'once' goal needs a parseable YYYY-MM-DD — anything else makes the
  // goal silently never match in goalsForDate. Validate before letting
  // the user save so they get explicit feedback in the form.
  const dueDateValid = (() => {
    if (recurrence !== 'once') return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return false;
    const parsed = new Date(dueDate + 'T00:00:00');
    if (isNaN(parsed.getTime())) return false;
    const [y, m, d] = dueDate.split('-').map(Number);
    return parsed.getFullYear() === y && parsed.getMonth() + 1 === m && parsed.getDate() === d;
  })();

  const canSave = label.trim().length > 0 && dueDateValid;

  const handleSave = () => {
    if (!canSave) return;
    const md = parseInt(monthDay, 10);
    onSave({
      label: label.trim(),
      tag: tag.trim() ? tag.trim().toUpperCase() : 'GENERAL',
      recurrence,
      weekday:  recurrence === 'weekly'  ? weekday : null,
      monthDay: recurrence === 'monthly' ? (isNaN(md) ? 1 : Math.min(31, Math.max(1, md))) : null,
      dueDate:  recurrence === 'once'    ? dueDate : null,
    });
    onClose();
  };

  const ordinalSuffix = (n) => {
    if (!n) return 'st';
    if (n % 10 === 1 && n !== 11) return 'st';
    if (n % 10 === 2 && n !== 12) return 'nd';
    if (n % 10 === 3 && n !== 13) return 'rd';
    return 'th';
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ge.safe}>
        <View style={ge.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={ge.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={ge.title}>{goal ? 'Edit Goal' : 'New Goal'}</Text>
          <TouchableOpacity onPress={handleSave} disabled={!canSave}>
            <Text style={[ge.save, !canSave && { opacity: 0.3 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Label */}
          <Text style={ge.label}>GOAL</Text>
          <TextInput
            style={ge.mainInput}
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Read 20 pages"
            placeholderTextColor={C.inkFaint}
            autoFocus
          />

          {/* Recurrence */}
          <Text style={ge.label}>REPEATS</Text>
          <View style={ge.recurrenceRow}>
            {[
              { key: 'daily',   label: 'Daily' },
              { key: 'weekly',  label: 'Weekly' },
              { key: 'monthly', label: 'Monthly' },
              { key: 'once',    label: 'Once' },
            ].map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[ge.recurrenceBtn, recurrence === opt.key && ge.recurrenceBtnActive]}
                onPress={() => setRecurrence(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[ge.recurrenceBtnTxt, recurrence === opt.key && ge.recurrenceBtnTxtActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Conditional secondary control */}
          {recurrence === 'weekly' && (
            <>
              <Text style={ge.label}>ON</Text>
              <View style={ge.weekdayRow}>
                {WEEKDAY_LETTERS.map((letter, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[ge.weekdayBtn, weekday === i && ge.weekdayBtnActive]}
                    onPress={() => setWeekday(i)}
                    activeOpacity={0.7}
                  >
                    <Text style={[ge.weekdayBtnTxt, weekday === i && ge.weekdayBtnTxtActive]}>
                      {letter}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={ge.hint}>Every {WEEKDAY_FULL[weekday]}</Text>
            </>
          )}

          {recurrence === 'monthly' && (
            <>
              <Text style={ge.label}>DAY OF MONTH</Text>
              <TextInput
                style={ge.numInput}
                value={monthDay}
                onChangeText={t => setMonthDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={C.inkFaint}
              />
              <Text style={ge.hint}>
                Repeats on the {monthDay || '1'}{ordinalSuffix(parseInt(monthDay, 10))} of every month
              </Text>
            </>
          )}

          {recurrence === 'once' && (
            <>
              <Text style={ge.label}>DATE</Text>
              <TextInput
                style={ge.numInput}
                value={dueDate}
                onChangeText={t => setDueDate(t.replace(/[^0-9-]/g, '').slice(0, 10))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.inkFaint}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
              />
              <Text style={[ge.hint, !dueDateValid && { color: C.rose, fontStyle: 'normal' }]}>
                {dueDateValid
                  ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-AU', {
                      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                    })
                  : 'Enter a real date as YYYY-MM-DD (e.g. 2026-08-12)'}
              </Text>
            </>
          )}

          {/* Tag */}
          <Text style={ge.label}>CATEGORY TAG</Text>
          <TextInput
            style={ge.tagInput}
            value={tag}
            onChangeText={setTag}
            placeholder="e.g. READING"
            placeholderTextColor={C.inkFaint}
            autoCapitalize="characters"
          />
          <View style={ge.suggestionsRow}>
            {TAG_SUGGESTIONS.map(s => (
              <TouchableOpacity
                key={s}
                style={[ge.suggestion, tag.toUpperCase() === s && ge.suggestionActive]}
                onPress={() => setTag(s)}
                activeOpacity={0.7}
              >
                <Text style={[ge.suggestionTxt, tag.toUpperCase() === s && ge.suggestionTxtActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main GoalsScreen ──────────────────────────────────────────────────
export function GoalsScreen({ navigation }) {
  const { C, F, themeVersion } = useTheme();
  const getTagTint = useTagTint();
  const { goals, addGoal, updateGoal, removeGoal } = useStore();
  const [editorOpen, setEditorOpen]     = useState(false);
  const [editingGoal, setEditingGoal]   = useState(null);

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      minHeight: 56,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
    },
    topBarTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2 },

    intro: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
    introTitle: { fontFamily: F.serif, fontSize: 22, color: C.ink, letterSpacing: -0.3, marginBottom: 4 },
    introSub:   { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, lineHeight: 19 },

    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 16, paddingVertical: 14,
      marginBottom: 10,
      gap: 12,
    },
    goalLabel: { fontFamily: F.serif, fontSize: 15, color: C.ink, fontWeight: '500', marginBottom: 3 },
    goalMeta:  { fontFamily: F.serif, fontSize: 11, color: C.inkMuted },
    tagPill:   { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 6 },
    tagTxt:    { fontFamily: F.serif, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },

    deleteAction: { justifyContent: 'center', alignItems: 'flex-end', marginBottom: 10 },
    deleteBtn: {
      backgroundColor: C.rose, borderRadius: 12,
      width: 90, height: '100%',
      alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    deleteTxt: { fontFamily: F.serif, color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
    hint: { fontFamily: F.serif, fontSize: 11, color: C.inkFaint, textAlign: 'center', marginTop: 8 },
    empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub:   { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center' },
  }), [themeVersion]);

  const openNew = () => {
    setEditingGoal(null);
    setEditorOpen(true);
  };

  const openEdit = (goal) => {
    setEditingGoal(goal);
    setEditorOpen(true);
  };

  const handleSave = (data) => {
    if (editingGoal) {
      updateGoal(editingGoal.id, data);
    } else {
      addGoal({
        id: genId('g'),
        label:      data.label,
        tag:        data.tag,
        recurrence: data.recurrence,
        weekday:    data.weekday,
        monthDay:   data.monthDay,
        dueDate:    data.dueDate,
        created:    todayKey(),
      });
    }
    setEditingGoal(null);
  };

  const renderRightActions = (goal) => (
    <View style={s.deleteAction}>
      <TouchableOpacity
        style={s.deleteBtn}
        onPress={() => removeGoal(goal.id)}
        activeOpacity={0.85}
      >
        <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
        <Text style={s.deleteTxt}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={22} color={C.ink} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Goals</Text>
        <TouchableOpacity onPress={openNew} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={22} color={C.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={s.intro}>
          <Text style={s.introTitle}>Your goals</Text>
          <Text style={s.introSub}>
            Daily habits, weekly rhythms, monthly checkpoints, or one-off targets.
          </Text>
        </View>

        {goals.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🎯</Text>
            <Text style={s.emptyTitle}>No goals yet</Text>
            <Text style={s.emptySub}>Set one — daily reading, a weekly walk, a one-off finish line.</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20 }}>
            {goals.map(g => {
              const tint = getTagTint(g.tag);
              return (
                <Swipeable
                  key={g.id}
                  renderRightActions={() => renderRightActions(g)}
                  friction={2}
                  rightThreshold={40}
                  overshootRight={false}
                >
                  <TouchableOpacity
                    style={s.goalRow}
                    onPress={() => openEdit(g)}
                    activeOpacity={0.85}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.goalLabel}>{g.label}</Text>
                      <Text style={s.goalMeta}>{formatRecurrence(g)}</Text>
                    </View>
                    <View style={[s.tagPill, { backgroundColor: tint.bg }]}>
                      <Text style={[s.tagTxt, { color: tint.fg }]}>{g.tag}</Text>
                    </View>
                  </TouchableOpacity>
                </Swipeable>
              );
            })}
          </View>
        )}

        <Text style={s.hint}>Tap a goal to edit · swipe left to delete</Text>
      </ScrollView>

      <GoalEditor
        visible={editorOpen}
        goal={editingGoal}
        onSave={handleSave}
        onClose={() => { setEditorOpen(false); setEditingGoal(null); }}
      />
    </SafeAreaView>
  );
}
