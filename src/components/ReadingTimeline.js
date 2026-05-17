/**
 * ReadingTimeline — horizontal strip of day pills + entry points to a
 * CalendarModal (full month grid) and a DayPanel (selected-day agenda).
 *
 * Each piece is a separate file under ./timeline/:
 *   - timeline/hooks.js         shared constants + useDragToDismiss
 *   - timeline/CalendarModal.js month picker
 *   - timeline/DayPanel.js      bottom-sheet agenda
 * This file is just the timeline strip + DayPill.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, TouchableOpacity, StyleSheet, FlatList,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText as Text } from './AppText';
import { useTheme } from '../theme';
import { CalendarModal } from './timeline/CalendarModal';
import { DayPanel } from './timeline/DayPanel';
import {
  SW,
  DAY_WIDTH, DAY_GAP, DAYS_BACK, TOTAL_DAYS,
  DAY_NAMES_FULL, MONTH_NAMES_SHORT,
  dateKey, dayOffset,
} from './timeline/hooks';

// ── Day Pill ───────────────────────────────────────────────────────────
function DayPill({ day, isToday, isFuture, data, onPress }) {
  const { C, F, themeVersion } = useTheme();
  const dpil = useMemo(() => StyleSheet.create({
    pill:         { width: DAY_WIDTH, paddingVertical: 5, borderRadius: 12, alignItems: 'center', gap: 1, overflow: 'hidden', backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
    pillToday:    { borderWidth: 0, shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 6 },
    dayNameToday: { fontFamily: F.serif, fontSize: 8, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
    dateNumToday: { fontFamily: F.serif, fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
    todayDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF', opacity: 0.8 },
    monthLblToday:{ fontFamily: F.serif, fontSize: 7, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.3, height: 11, textAlign: 'center' },
    dayName:      { fontFamily: F.serif, fontSize: 8, fontWeight: '800', color: C.inkSoft, letterSpacing: 0.3 },
    dayNameWknd:  { fontFamily: F.serif, color: C.inkMuted },
    dateNum:      { fontFamily: F.serif, fontSize: 15, fontWeight: '900', color: C.ink },
    dotsRow:      { height: 5, alignItems: 'center', justifyContent: 'center' },
    dotNote:      { width: 4, height: 4, borderRadius: 2, backgroundColor: C.amber },
    monthLbl:     { fontFamily: F.serif, fontSize: 7, color: C.amber, fontWeight: '700', letterSpacing: 0.3, height: 11, textAlign: 'center' },
  }), [themeVersion]);
  const hasData   = data.noteCount > 0;
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  if (isToday) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <LinearGradient colors={[C.amberLight, C.amber]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[dpil.pill, dpil.pillToday]}>
          <Text style={dpil.dayNameToday}>{DAY_NAMES_FULL[day.getDay()]}</Text>
          <Text style={dpil.dateNumToday}>{day.getDate()}</Text>
          <View style={dpil.todayDot} />
          <Text style={dpil.monthLblToday} numberOfLines={1}>
            {day.getDate() === 1 ? MONTH_NAMES_SHORT[day.getMonth()] : ' '}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={dpil.pill}>
        <Text style={[dpil.dayName, isWeekend && dpil.dayNameWknd]}>
          {DAY_NAMES_FULL[day.getDay()]}
        </Text>
        <Text style={dpil.dateNum}>{day.getDate()}</Text>
        <View style={dpil.dotsRow}>
          {hasData && <View style={dpil.dotNote} />}
        </View>
        <Text style={dpil.monthLbl} numberOfLines={1}>
          {day.getDate() === 1 ? MONTH_NAMES_SHORT[day.getMonth()] : ' '}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export function ReadingTimeline({ notes, books, onManageGoals, openDateKey, onDatePanelClosed }) {
  const { C, F, themeVersion } = useTheme();
  const t = useMemo(() => StyleSheet.create({
    wrap:      { marginBottom: 16 },
    header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
    monthTxt:  { fontFamily: F.serif, fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
    goalsPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: C.sage,
    },
    goalsPillTxt: {
      fontFamily: F.serif, fontSize: 12, fontWeight: '700',
      color: '#FFFFFF', letterSpacing: -0.1,
    },
  }), [themeVersion]);
  const scrollRef       = useRef(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [sessionDay, setSessionDay]     = useState(null);
  const [sessionVisible, setSessionVisible] = useState(false);
  // Tracks whether the current session was opened via the calendar.
  // When true, closing the session re-opens the calendar so the user
  // can pick another date or browse — preserves the "drag down → see
  // calendar again" UX without nesting modals.
  const [cameFromCalendar, setCameFromCalendar] = useState(false);

  // External request to open DayPanel for a specific date — e.g. tapping a
  // reflection in the Library's "Reflections" collection on HomeScreen.
  useEffect(() => {
    if (!openDateKey) return;
    const [y, m, d] = openDateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    setSessionDay(date);
    setSessionVisible(true);
    setCameFromCalendar(false);
  }, [openDateKey]);

  const today    = new Date();
  const todayKey = dateKey(today);

  const notesByKey = useMemo(() => {
    const map = {};
    notes.forEach(n => {
      const k = (n.date || '').slice(0, 10);
      if (k) map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [notes]);

  const days = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const offset   = i - DAYS_BACK;
      const d        = dayOffset(offset);
      const key      = dateKey(d);
      const dayNotes = notes.filter(n => (n.date || '').slice(0, 10) === key);
      const dayBooks = [...new Set(dayNotes.map(n => n.bookId))]
        .map(id => books.find(b => b.id === id)).filter(Boolean);
      return {
        date:      d,
        key,
        isToday:   key === todayKey,
        isFuture:  d > today,
        noteCount: dayNotes.length,
        notes:     dayNotes,
        books:     dayBooks,
      };
    });
  }, [notesByKey, notes, books]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (scrollRef.current) {
        const offset = Math.max(0, DAYS_BACK * (DAY_WIDTH + DAY_GAP) - SW * 0.5);
        scrollRef.current.scrollToOffset({ offset, animated: false });
      }
    }, 150);
    return () => clearTimeout(t);
  }, []);

  const openSession = useCallback((index) => {
    setSessionVisible(false);
    setSessionDay(null);
    setTimeout(() => {
      setSessionDay(index);
      setSessionVisible(true);
    }, 30);
  }, []);

  const closeSession = useCallback(() => {
    setSessionVisible(false);
    setSessionDay(null);
    if (cameFromCalendar) {
      setCameFromCalendar(false);
      // Brief delay so the day panel's dismiss animation completes first
      setTimeout(() => setShowCalendar(true), 100);
    }
    onDatePanelClosed?.();
  }, [cameFromCalendar, onDatePanelClosed]);

  const handleCalendarSelect = useCallback((key) => {
    setShowCalendar(false);
    setCameFromCalendar(true);

    const idx = days.findIndex(d => d.key === key);
    if (idx === -1) {
      // Date is outside the timeline range (>1 year back or forward).
      return;
    }

    if (scrollRef.current) {
      const offset = Math.max(0, idx * (DAY_WIDTH + DAY_GAP) - SW * 0.4);
      scrollRef.current.scrollToOffset({ offset, animated: true });
    }
    setTimeout(() => openSession(idx), 260);
  }, [days, openSession]);

  const selectedDay = sessionDay !== null ? days[sessionDay] : null;

  return (
    <View style={t.wrap}>
      <View style={t.header}>
        <TouchableOpacity onPress={() => setShowCalendar(true)} activeOpacity={0.6}>
          <Text style={t.monthTxt}>
            {today.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={t.goalsPill}
          onPress={onManageGoals}
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="add" size={14} color="#FFFFFF" />
          <Text style={t.goalsPillTxt}>Goals</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={scrollRef}
        horizontal
        data={days}
        keyExtractor={item => item.key}
        showsHorizontalScrollIndicator={false}
        snapToInterval={DAY_WIDTH + DAY_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20, gap: DAY_GAP }}
        renderItem={({ item, index }) => (
          <DayPill
            day={item.date}
            isToday={item.isToday}
            isFuture={item.isFuture}
            data={item}
            onPress={() => openSession(index)}
          />
        )}
        getItemLayout={(_, index) => ({
          length: DAY_WIDTH + DAY_GAP,
          offset: (DAY_WIDTH + DAY_GAP) * index,
          index,
        })}
        initialNumToRender={20}
        windowSize={10}
      />

      <CalendarModal
        visible={showCalendar}
        notesByKey={notesByKey}
        onClose={() => setShowCalendar(false)}
        onSelectDay={handleCalendarSelect}
      />

      <DayPanel
        visible={sessionVisible}
        day={selectedDay?.date}
        data={selectedDay || {}}
        onClose={closeSession}
        onManageGoals={onManageGoals}
      />
    </View>
  );
}
