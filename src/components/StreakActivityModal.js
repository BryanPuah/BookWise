/**
 * StreakActivityModal — GitHub-style activity grid for the past 12 months.
 *
 * Renders a 7-row (weekday) × ~53-column (week) grid of cells. Each cell
 * is sage-filled if that date is in the user's activeDays array, light
 * grey otherwise. Month labels run along the top, weekday labels run down
 * the left (only Mon, Wed, Fri are shown — matches GitHub).
 *
 * Tapped from the Active Day Streak card on the home screen.
 */

import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { useTheme } from '../theme';

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEKDAY_LABELS = ['Mon', 'Wed', 'Fri'];  // GitHub only labels these three
const CELL = 12;       // cell size in px
const CELL_GAP = 3;    // gap between cells
const COL_WIDTH = CELL + CELL_GAP;

function ymdKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Build a 7×N grid of date objects spanning the past 52 weeks ending today.
// Each column = a Sunday-to-Saturday week (matches GitHub layout).
function buildYearGrid() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // GitHub anchors weeks on Sunday. Find the Sunday at or before today.
  const endSunday = new Date(today);
  endSunday.setDate(endSunday.getDate() - endSunday.getDay() + 7); // upcoming Sun for end-cap
  // Walk back 53 weeks
  const startSunday = new Date(endSunday);
  startSunday.setDate(startSunday.getDate() - 53 * 7);

  const weeks = [];
  const cursor = new Date(startSunday);
  while (cursor < endSunday) {
    const week = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(cursor);
      week.push(d);
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return { weeks, today };
}

// Decide where to put each month label along the top. We want the label
// above the first week of each month so the columns under it roughly
// correspond to that month.
function getMonthLabels(weeks) {
  const labels = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIdx) => {
    // Use the *first day of the week* as the anchor for "is this a new month"
    const m = week[0].getMonth();
    if (m !== lastMonth) {
      labels.push({ month: m, weekIdx });
      lastMonth = m;
    }
  });
  return labels;
}

export function StreakActivityModal({ visible, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  title: { fontFamily: F.serif, fontSize: 18, color: C.ink, letterSpacing: -0.2 },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },

  // Grid
  gridKicker: {
    fontSize: 10,
    fontWeight: '700',
    color: C.inkMuted,
    letterSpacing: 1.4,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 14,
  },
  gridScroll: { paddingHorizontal: 20, paddingBottom: 8 },
  monthRow: {
    height: 18,
    position: 'relative',
    marginBottom: 6,
  },
  monthLabel: {
    position: 'absolute',
    fontSize: 11,
    color: C.inkMuted,
    fontWeight: '600',
  },
  weekdayCol: {
    width: 28,
    paddingRight: 4,
  },
  weekdayLabel: { fontSize: 10, color: C.inkMuted, fontWeight: '500' },
  weekCol: { width: COL_WIDTH, gap: 0 },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
    marginBottom: CELL_GAP,
  },
  cellEmpty: { backgroundColor: C.cream },
  cellActive: { backgroundColor: C.sage },
  cellFuture: { backgroundColor: 'transparent' },
  cellToday: {
    // subtle outline on today's cell so it's findable
    borderWidth: 1,
    borderColor: C.ink,
  },

  // Legend
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingLeft: 28,
    gap: 4,
  },
  legendCell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
  },
  legendTxt: { fontSize: 11, color: C.inkMuted, marginHorizontal: 6 },

  // Caption
  caption: {
    paddingHorizontal: 24,
    paddingTop: 18,
  },
  captionTxt: {
    fontSize: 12,
    color: C.inkMuted,
    lineHeight: 18,
  },
  }), [themeVersion]);
  const { activeDays } = useStore();
  const activeSet = useMemo(() => new Set(activeDays || []), [activeDays]);

  const { weeks, today } = useMemo(buildYearGrid, []);
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks]);
  const todayKey = ymdKey(today);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        {/* Top bar */}
        <View style={s.topBar}>
          <Text style={s.title}>Active Day Streak</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={s.closeBtn}
          >
            <Ionicons name="close" size={22} color={C.ink} />
          </TouchableOpacity>
        </View>

        {/* Activity grid — horizontal scroll on small screens */}
        <Text style={s.gridKicker}>ACTIVITY · LAST 12 MONTHS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.gridScroll}
        >
          <View>
            {/* Month labels row */}
            <View style={[s.monthRow, { paddingLeft: 28 }]}>
              {monthLabels.map(({ month, weekIdx }) => (
                <Text
                  key={`${month}-${weekIdx}`}
                  style={[
                    s.monthLabel,
                    { left: weekIdx * COL_WIDTH },
                  ]}
                >
                  {MONTH_SHORT[month]}
                </Text>
              ))}
            </View>

            {/* Grid body — weekdays + cells */}
            <View style={{ flexDirection: 'row' }}>
              {/* Weekday labels — only Mon, Wed, Fri */}
              <View style={s.weekdayCol}>
                {[0,1,2,3,4,5,6].map(dow => (
                  <View
                    key={dow}
                    style={{ height: CELL, marginBottom: CELL_GAP, justifyContent: 'center' }}
                  >
                    {dow === 1 || dow === 3 || dow === 5 ? (
                      <Text style={s.weekdayLabel}>
                        {dow === 1 ? 'Mon' : dow === 3 ? 'Wed' : 'Fri'}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>

              {/* Week columns */}
              {weeks.map((week, weekIdx) => (
                <View key={weekIdx} style={s.weekCol}>
                  {week.map((d, dowIdx) => {
                    const key = ymdKey(d);
                    const isFuture = d > today;
                    const isActive = activeSet.has(key);
                    const isToday = key === todayKey;
                    return (
                      <View
                        key={`${weekIdx}-${dowIdx}`}
                        style={[
                          s.cell,
                          isFuture && s.cellFuture,
                          !isFuture && !isActive && s.cellEmpty,
                          !isFuture && isActive && s.cellActive,
                          isToday && s.cellToday,
                        ]}
                      />
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Legend */}
            <View style={s.legendRow}>
              <Text style={s.legendTxt}>Less</Text>
              <View style={[s.legendCell, s.cellEmpty]} />
              <View style={[s.legendCell, s.cellActive, { opacity: 0.5 }]} />
              <View style={[s.legendCell, s.cellActive]} />
              <Text style={s.legendTxt}>More</Text>
            </View>
          </View>
        </ScrollView>

        {/* Caption */}
        <View style={s.caption}>
          <Text style={s.captionTxt}>
            Each square represents one day. Sage cells mark days you were active —
            reading, writing notes, or adding a reflection.
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

