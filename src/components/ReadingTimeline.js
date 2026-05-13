import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated, Dimensions, FlatList, ScrollView,
  PanResponder, TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { GoalEditor } from '../screens/GoalsScreen';
import { useTheme } from '../theme';

const { width: SW, height: SH } = Dimensions.get('window');
const DAY_WIDTH  = 50;
const DAY_GAP    = 5;
const DAYS_BACK  = 365;
const DAYS_AHEAD = 365;
const TOTAL_DAYS = DAYS_BACK + DAYS_AHEAD + 1;

const DAY_NAMES_FULL   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES_FULL = ['January','February','March','April','May','June',
                           'July','August','September','October','November','December'];
const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                            'Jul','Aug','Sep','Oct','Nov','Dec'];

function dateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function activityScore(noteCount) {
  if (noteCount === 0) return 0;
  if (noteCount === 1) return 1;
  if (noteCount <= 3)  return 2;
  if (noteCount <= 6)  return 3;
  return 4;
}

const HEAT_COLORS = [
  'transparent',
  'rgba(217,119,6,0.15)',
  'rgba(217,119,6,0.30)',
  'rgba(217,119,6,0.50)',
  'rgba(217,119,6,0.75)',
];

// ── Drag-to-dismiss hook ───────────────────────────────────────────────
function useDragToDismiss({ onClose }) {
  const translateY  = useRef(new Animated.Value(SH)).current;
  const isScrolled  = useRef(false);
  const dragging    = useRef(false);
  const dragStart   = useRef(0);

  const open = () => {
    translateY.setValue(SH);
    Animated.spring(translateY, {
      toValue: 0, useNativeDriver: true, tension: 58, friction: 12,
    }).start();
  };

  const dismiss = (onDone) => {
    Animated.timing(translateY, {
      toValue: SH, duration: 240, useNativeDriver: true,
    }).start(() => {
      if (onDone) onDone();
    });
  };

  const snapBack = () => {
    Animated.spring(translateY, {
      toValue: 0, useNativeDriver: true, tension: 120, friction: 18,
    }).start();
  };

  const onGrant = () => {
    dragging.current = true;
    translateY.stopAnimation(val => {
      dragStart.current = val;
    });
  };

  const onMove = (_, g) => {
    if (!dragging.current) return;
    const next = dragStart.current + g.dy;
    if (next <= 0) {
      translateY.setValue(0);
    } else if (next > 80) {
      translateY.setValue(80 + (next - 80) * 0.35);
    } else {
      translateY.setValue(next);
    }
  };

  const onRelease = (_, g) => {
    dragging.current = false;
    const currentVal = dragStart.current + g.dy;
    if (currentVal > 80 || g.vy > 0.4) {
      dismiss();
    } else {
      snapBack();
    }
  };

  const onTerminate = () => {
    dragging.current = false;
    snapBack();
  };

  const overlayPR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      !isScrolled.current && g.dy > 4 && g.dy > Math.abs(g.dx),
    onMoveShouldSetPanResponderCapture: (_, g) =>
      !isScrolled.current && g.dy > 8 && g.dy > Math.abs(g.dx),
    onPanResponderGrant: onGrant,
    onPanResponderMove: onMove,
    onPanResponderRelease: onRelease,
    onPanResponderTerminate: onTerminate,
  })).current;

  const handlePR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: onGrant,
    onPanResponderMove: onMove,
    onPanResponderRelease: onRelease,
    onPanResponderTerminate: onTerminate,
  })).current;

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, SH * 0.5],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return {
    translateY,
    open,
    dismiss,
    panHandlers:     handlePR.panHandlers,
    overlayHandlers: overlayPR.panHandlers,
    backdropOpacity,
    setScrolled: v => { isScrolled.current = v; },
  };
}

// ── Calendar Modal — clean iOS-style date picker ─────────────────────
// ── Year + Month picker — two vertical scroll columns, taps to confirm ──
// Used inside CalendarModal. When the user taps the calendar's title, the
// day grid is replaced by this component. Tapping a year updates the year
// in the parent (and the picker stays open so they can pick a month).
// Tapping a month commits the change and dismisses the picker.
function YearMonthPicker({ selectedYear, selectedMonth, onPickYear, onPickMonth, onCenterChange, height }) {
  const { C, F, themeVersion } = useTheme();
  const ymp = useMemo(() => StyleSheet.create({
    wrap: {
      paddingHorizontal: 20,
      paddingTop: 12,
      position: 'relative',
    },
    columns: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    column: {
      flex: 1,
    },
    row: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTxt: {
      fontFamily: F.serif,
      fontSize: 16,
      color: C.inkFaint,
      fontWeight: '500',
    },
    rowTxtActive: {
      fontFamily: F.serif,
      color: C.ink,
      fontWeight: '700',
      fontSize: 18,
    },
    divider: {
      width: 0.5,
      height: '100%',
      backgroundColor: C.border,
    },
    centreLine: {
      position: 'absolute',
      left: 20, right: 20,
      height: 0.5,
      backgroundColor: C.borderMid,
    },
  }), [themeVersion]);
  const yearScrollRef = useRef(null);
  const monthScrollRef = useRef(null);
  const ROW_HEIGHT = 44;
  // Default to ~6 rows visible; caller can pass a taller value when the
  // calendar sheet is expanded so more rows are visible at once.
  const PICKER_HEIGHT = height ?? 264;

  // Build a year range — 60 back through 60 forward — generous but not unwieldy.
  // The current year sits in the middle so scrolling either way works.
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = thisYear - 60; y <= thisYear + 60; y++) arr.push(y);
    return arr;
  }, [thisYear]);

  // Which row is currently centred in each scroll view (visual highlight only).
  // Starts at the committed selection so the initial paint shows the right row.
  const [centeredYearIdx,  setCenteredYearIdx]  = useState(years.indexOf(selectedYear));
  const [centeredMonthIdx, setCenteredMonthIdx] = useState(selectedMonth);

  // Convert a scroll offset to the index of the row centred in the viewport.
  const offsetToIndex = (offset, maxIdx) => {
    const idx = Math.round(offset / ROW_HEIGHT);
    return Math.max(0, Math.min(maxIdx, idx));
  };

  const onYearScroll = (e) => {
    const idx = offsetToIndex(e.nativeEvent.contentOffset.y, years.length - 1);
    if (idx !== centeredYearIdx) {
      setCenteredYearIdx(idx);
      onCenterChange?.(years[idx], centeredMonthIdx);
    }
  };
  const onMonthScroll = (e) => {
    const idx = offsetToIndex(e.nativeEvent.contentOffset.y, 11);
    if (idx !== centeredMonthIdx) {
      setCenteredMonthIdx(idx);
      onCenterChange?.(years[centeredYearIdx], idx);
    }
  };

  // Auto-scroll to selections when the picker opens, and re-centre whenever
  // the picker height changes (e.g. when the sheet expands)
  useEffect(() => {
    const idx = years.indexOf(selectedYear);
    if (idx >= 0 && yearScrollRef.current) {
      const offset = idx * ROW_HEIGHT;
      setTimeout(() => yearScrollRef.current?.scrollTo({ y: offset, animated: false }), 30);
    }
    if (monthScrollRef.current) {
      const offset = selectedMonth * ROW_HEIGHT;
      setTimeout(() => monthScrollRef.current?.scrollTo({ y: offset, animated: false }), 30);
    }
  }, [PICKER_HEIGHT]);

  return (
    <View style={ymp.wrap}>
      <View style={ymp.columns}>
        {/* Years */}
        <ScrollView
          ref={yearScrollRef}
          showsVerticalScrollIndicator={false}
          style={[ymp.column, { height: PICKER_HEIGHT }]}
          contentContainerStyle={{ paddingVertical: PICKER_HEIGHT / 2 - ROW_HEIGHT / 2 }}
          onScroll={onYearScroll}
          scrollEventThrottle={16}
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast"
        >
          {years.map((y, i) => (
            <TouchableOpacity
              key={y}
              style={[ymp.row, { height: ROW_HEIGHT }]}
              onPress={() => onPickYear(y)}
              activeOpacity={0.6}
            >
              <Text style={[
                ymp.rowTxt,
                i === centeredYearIdx && ymp.rowTxtActive,
              ]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={ymp.divider} />

        {/* Months */}
        <ScrollView
          ref={monthScrollRef}
          showsVerticalScrollIndicator={false}
          style={[ymp.column, { height: PICKER_HEIGHT }]}
          contentContainerStyle={{ paddingVertical: PICKER_HEIGHT / 2 - ROW_HEIGHT / 2 }}
          onScroll={onMonthScroll}
          scrollEventThrottle={16}
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast"
        >
          {MONTH_NAMES_FULL.map((name, i) => (
            <TouchableOpacity
              key={name}
              style={[ymp.row, { height: ROW_HEIGHT }]}
              onPress={() => onPickMonth(i)}
              activeOpacity={0.6}
            >
              <Text style={[
                ymp.rowTxt,
                i === centeredMonthIdx && ymp.rowTxtActive,
              ]}>
                {name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Centre indicator — two thin horizontal lines bracketing the centred row.
          Classic iOS UIPickerView pattern. Lines span the full picker width
          (both columns) so the centred year and month are visually paired. */}
      <View style={[ymp.centreLine, {
        top: PICKER_HEIGHT / 2 - ROW_HEIGHT / 2,
      }]} pointerEvents="none" />
      <View style={[ymp.centreLine, {
        top: PICKER_HEIGHT / 2 + ROW_HEIGHT / 2,
      }]} pointerEvents="none" />
    </View>
  );
}



function CalendarModal({ visible, notesByKey, onClose, onSelectDay }) {
  const { C, F, themeVersion } = useTheme();
  const cal = useMemo(() => StyleSheet.create({
    // Sheet container
    overlay:  { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    // Outer wrapper — owns shadow + native-driven translateY (open/dismiss anim).
    // Height is NOT set here; it lives on the inner wrapper which is JS-animated.
    sheetOuter: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 20,
    },
    // Inner wrapper — owns visual chrome + animated height.
    sheet: {
      backgroundColor: C.paper,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingBottom: 8,
      overflow: 'hidden',
    },

    // Drag
    dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
    handleWrap:  { paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
    handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },
    headerArea:  { position: 'relative' },

    // Top bar — Cancel · Select a Date · Today
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    cancel: { fontFamily: F.serif, fontSize: 15, color: C.inkMuted, fontWeight: '500' },
    title:  { fontFamily: F.serif, fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
    titleBtn: { flexDirection: 'row', alignItems: 'center' },
    titleChev: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted, marginLeft: 1, marginTop: -2 },
    today:  { fontFamily: F.serif, fontSize: 15, color: C.ink, fontWeight: '600' },
    done:   { fontFamily: F.serif, fontSize: 15, color: C.ink, fontWeight: '700' },

    // Separator
    sep: { height: 0.5, backgroundColor: C.border, marginHorizontal: 0 },

    // Month bar — "Apr 2020" on left, chevrons on right
    monthBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 8,
    },
    monthLbl: {
      fontFamily: F.serif,
      fontSize: 16,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: -0.2,
    },
    chevronRow: { flexDirection: 'row', gap: 4 },
    chevron: {
      width: 32, height: 32,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 16,
    },
    chevronTxt: { fontFamily: F.serif, fontSize: 22, color: C.ink, lineHeight: 26 },

    // Weekday headers
    dowRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 4,
    },
    dowTxt: {
      flex: 1,
      textAlign: 'center',
      fontFamily: F.serif,
      fontSize: 11,
      fontWeight: '600',
      color: C.inkMuted,
      letterSpacing: 0.4,
    },

    // Grid + cells
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    cell: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedCircle: {
      position: 'absolute',
      backgroundColor: C.ink,
    },
    // Light shade marker for today's cell when not selected. Uses amberPale
    // so today reads as "current" without competing with the ink selection.
    todayCircle: {
      position: 'absolute',
      backgroundColor: C.amberPale,
    },
    dayNum: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.ink,
      fontWeight: '500',
      zIndex: 1,
    },
    dayNumSelected: {
      fontFamily: F.serif,
      color: C.white,
      fontWeight: '700',
    },
    dayNumToday: {
      fontFamily: F.serif,
      color: C.ink,
      fontWeight: '800',
    },
    dayNumFuture: {
      fontFamily: F.serif,
      color: C.inkFaint,
    },
  }), [themeVersion]);
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(null);
  // When true, the day grid swaps out for the year + month picker.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Tracks the row currently centred in the picker (driven by scrolling).
  // Done button commits these values; abandon picker without committing
  // by tapping the title again.
  const [pendingYear,  setPendingYear]  = useState(today.getFullYear());
  const [pendingMonth, setPendingMonth] = useState(today.getMonth());
  // Expanded state — when true, calendar sheet grows to ~92% screen height.
  // Toggled by dragging the handle up (to expand) or down (to collapse).
  const [expanded, setExpanded] = useState(false);
  const drag = useDragToDismiss({ onClose });

  // Sheet height — animated between compact and expanded values.
  // Driven entirely by the drag handler (no useEffect animation) to avoid
  // running animations on non-attached nodes during mount/visibility flips.
  const COMPACT_HEIGHT  = SH * 0.62;
  const EXPANDED_HEIGHT = SH * 0.92;
  const sheetHeight = useRef(new Animated.Value(COMPACT_HEIGHT)).current;
  // Keep `expanded` in a ref so the PanResponder (created once) can read the
  // latest value without stale-closure bugs.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  // Animate height to the compact/expanded value. Used by gesture release.
  const springTo = (toValue) => {
    Animated.spring(sheetHeight, {
      toValue,
      useNativeDriver: false,
      tension: 80,
      friction: 13,
    }).start();
  };

  // Custom pan responder on the drag handle.
  // - Drag UP past threshold  → expand (or stay expanded)
  // - Drag DOWN past threshold while EXPANDED → collapse to compact
  // - Drag DOWN past threshold while COMPACT  → dismiss the modal
  //
  // CRITICAL: we capture the start height once on grant, then compute the
  // target height from (startHeight - g.dy) on each move. g.dy is cumulative
  // from the start of the gesture, so this gives a consistent reading. Doing
  // (sheetHeight.__getValue() - g.dy) on every move drifts catastrophically
  // because the value updates each tick — that was the source of the jank.
  const dragStartHeight = useRef(COMPACT_HEIGHT);
  const lastMoveTime    = useRef(0);

  const handlePR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderGrant: () => {
      // Snapshot the height at the moment the gesture starts
      dragStartHeight.current = sheetHeight.__getValue();
      lastMoveTime.current = 0;
    },
    onPanResponderMove: (_, g) => {
      // Throttle to ~60fps so we don't flood the JS-native bridge
      const now = Date.now();
      if (now - lastMoveTime.current < 16) return;
      lastMoveTime.current = now;

      const next = Math.max(
        COMPACT_HEIGHT * 0.5,
        Math.min(EXPANDED_HEIGHT, dragStartHeight.current - g.dy),
      );
      sheetHeight.setValue(next);
    },
    onPanResponderRelease: (_, g) => {
      // Decide using actual finger displacement, not animated value drift
      if (g.dy < -50) {
        setExpanded(true);
        springTo(EXPANDED_HEIGHT);
      } else if (g.dy > 80) {
        if (expandedRef.current) {
          setExpanded(false);
          springTo(COMPACT_HEIGHT);
        } else {
          drag.dismiss(() => onClose());
        }
      } else {
        // Small drag — snap back to whichever state we were in
        springTo(expandedRef.current ? EXPANDED_HEIGHT : COMPACT_HEIGHT);
      }
    },
  })).current;

  useEffect(() => {
    if (visible) {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
      setSelectedKey(null);
      setPickerOpen(false);
      setExpanded(false);
      sheetHeight.setValue(COMPACT_HEIGHT);
      drag.open();
    }
  }, [visible]);

  const handleClose = () => {
    drag.dismiss(() => onClose());
  };

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  // Open the picker — seed pending values from current view
  const openPicker = () => {
    setPendingYear(viewYear);
    setPendingMonth(viewMonth);
    setPickerOpen(true);
  };

  // Commit the pending year/month and return to day grid
  const handlePickerDone = () => {
    setViewYear(pendingYear);
    setViewMonth(pendingMonth);
    setPickerOpen(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build the calendar grid for the current month
  const calDays = useMemo(() => {
    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const grid = [];
    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date    = new Date(viewYear, viewMonth, d);
      const key     = dateKey(date);
      const isToday = key === dateKey(today);
      const isFuture = date > today;
      grid.push({ date, key, isToday, isFuture });
    }
    return grid;
  }, [viewYear, viewMonth]);

  const handleDayPress = (key) => {
    setSelectedKey(key);
    // Brief moment so the user sees the selection highlight, then dismiss
    // and notify the parent. We start the dismiss animation but also call
    // onSelectDay on a timer so the parent navigates regardless of whether
    // the animation's completion callback fires.
    setTimeout(() => {
      drag.dismiss(() => {});
      onSelectDay(key);
    }, 120);
  };

  // Width-derived minimum cell size — keeps cells square at minimum.
  const MIN_CELL_SIZE = Math.floor((SW - 32) / 7);

  // Dynamic cell size that grows with the sheet height. We listen to the
  // animated sheetHeight value and track its current value in React state.
  // The grid below subtracts fixed overhead (handle, top bar, weekday row,
  // bottom padding) and splits the remainder across 6 rows.
  const GRID_OVERHEAD = 200; // ≈ handle 22 + topBar 56 + sep 1 + monthBar 44 + dowRow 28 + bottomPad 24 + buffer
  const [cellSize, setCellSize] = useState(MIN_CELL_SIZE);

  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      // Available height for the 6-row grid
      const available = value - GRID_OVERHEAD;
      const newCell = Math.max(MIN_CELL_SIZE, Math.floor(available / 6));
      // Update only on meaningful change to avoid render thrash
      setCellSize(prev => Math.abs(prev - newCell) >= 1 ? newCell : prev);
    });
    return () => sheetHeight.removeListener(id);
  }, []);

  const CELL_SIZE = cellSize;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={cal.overlay}>
        <Animated.View style={[cal.backdrop, { opacity: drag.backdropOpacity }]} pointerEvents="none" />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />

        {/* Outer wrapper handles native-driven translateY (used for the
            open/dismiss animations). Inner wrapper handles JS-driven height
            (used for the drag-up expand). Splitting these prevents the
            "native + non-native driver on same node" runtime error. */}
        <Animated.View
          style={[
            cal.sheetOuter,
            { transform: [{ translateY: drag.translateY }] },
          ]}
        >
          <Animated.View style={[cal.sheet, { height: sheetHeight }]}>
            {/* Header block — handle + topBar + monthBar + weekday row.
                The pan responder sits on this wrapper so the user can grab
                anywhere in the header to drag the sheet up or down. Taps on
                inner buttons (Cancel, title, Today, chevrons) still work
                because the pan only activates after >4px of motion. */}
            <View {...handlePR.panHandlers} style={cal.headerArea}>
              {/* Drag handle — visual grip indicator */}
              <View style={cal.handleWrap}>
                <View style={cal.handle} />
              </View>

              {/* Top bar — Cancel · Select a Date (tap to open year/month picker) · Today/Done */}
              <View style={cal.topBar}>
                <TouchableOpacity onPress={handleClose} activeOpacity={0.6}>
                <Text style={cal.cancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => pickerOpen ? setPickerOpen(false) : openPicker()}
                activeOpacity={0.6}
                hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
                style={cal.titleBtn}
              >
                <Text style={cal.title}>
                  {pickerOpen ? 'Pick a Month' : 'Select a Date'}
                </Text>
                <Text style={cal.titleChev}>{pickerOpen ? ' ⌃' : ' ⌄'}</Text>
              </TouchableOpacity>
              {pickerOpen ? (
                <TouchableOpacity onPress={handlePickerDone} activeOpacity={0.6}>
                  <Text style={cal.done}>Done</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={goToday} activeOpacity={0.6}>
                  <Text style={cal.today}>Today</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={cal.sep} />

            {/* Month label + chevrons */}
            <View style={cal.monthBar}>
              <Text style={cal.monthLbl}>
                {MONTH_NAMES_SHORT[viewMonth]} {viewYear}
              </Text>
              <View style={cal.chevronRow}>
                <TouchableOpacity onPress={prevMonth} style={cal.chevron} activeOpacity={0.5}>
                  <Text style={cal.chevronTxt}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={nextMonth} style={cal.chevron} activeOpacity={0.5}>
                  <Text style={cal.chevronTxt}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Weekday headers */}
            <View style={cal.dowRow}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <Text key={i} style={cal.dowTxt}>{d}</Text>
              ))}
            </View>
          </View>

          {/* Day grid OR Year+Month picker (toggled by tapping the title) */}
          {pickerOpen ? (
            <YearMonthPicker
              selectedYear={viewYear}
              selectedMonth={viewMonth}
              // Grow picker when the sheet is expanded so more rows visible
              height={expanded ? SH * 0.7 : 264}
              onPickYear={(y) => {
                // Tap a year row: commit immediately and stay in picker so
                // the user can also adjust month. (Equivalent to scroll+Done.)
                setPendingYear(y);
              }}
              onPickMonth={(m) => {
                // Tap a month row: commit year + month and exit picker.
                setPendingMonth(m);
                setViewYear(pendingYear);
                setViewMonth(m);
                setPickerOpen(false);
              }}
              onCenterChange={(y, m) => {
                setPendingYear(y);
                setPendingMonth(m);
              }}
            />
          ) : (
            <View style={cal.grid}>
              {calDays.map((item, i) => {
                if (!item) return <View key={`e-${i}`} style={[cal.cell, { width: MIN_CELL_SIZE, height: CELL_SIZE }]} />;
                const { date, key, isToday, isFuture } = item;
                const isSelected = selectedKey === key;
                // Selected circle stays round — uses the smaller of width/height
                // so it doesn't stretch into an oval when cells get tall.
                const circleSize = Math.min(MIN_CELL_SIZE, CELL_SIZE) - 12;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[cal.cell, { width: MIN_CELL_SIZE, height: CELL_SIZE }]}
                    onPress={() => handleDayPress(key)}
                    activeOpacity={0.6}
                  >
                    {/* Light tinted circle on today when not selected — a
                        visual anchor so the user can spot the current date
                        without it being mistaken for the selected one. */}
                    {isToday && !isSelected && (
                      <View style={[cal.todayCircle, {
                        width: circleSize, height: circleSize,
                        borderRadius: circleSize / 2,
                      }]} />
                    )}
                    {isSelected && (
                      <View style={[cal.selectedCircle, {
                        width: circleSize, height: circleSize,
                        borderRadius: circleSize / 2,
                      }]} />
                    )}
                    <Text style={[
                      cal.dayNum,
                      isSelected && cal.dayNumSelected,
                      !isSelected && isToday && cal.dayNumToday,
                      !isSelected && !isToday && isFuture && cal.dayNumFuture,
                    ]}>
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ height: 24 }} />
        </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}


// ── DayPanel shared styles ───────────────────────────────────────────
// The DayPanel and all its inner sections (DaySection, DailyReflectionSection,
// ExpandableBookCard, NestedNoteRow) consume the same `dpnl` style set.
// Each component calls useDpnlStyles independently so theme changes
// propagate everywhere via the shared useTheme subscription.
function useDpnlStyles() {
  const { C, F, themeVersion } = useTheme();
  return useMemo(() => StyleSheet.create({
    overlay:  { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      backgroundColor: C.paper,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 20,
    },
    dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
    handleWrap:  { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
    handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },

    // Top bar — month/year on left, Today on right
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

    // Week strip
    weekStrip: {
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingBottom: 14,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
    },
    weekCell: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 4,
      paddingBottom: 6,
      position: 'relative',
    },
    weekDayLabel: {
      fontFamily: F.serif,
      fontSize: 10,
      color: C.inkMuted,
      fontWeight: '600',
      letterSpacing: 0.4,
      marginBottom: 6,
    },
    weekDayNum: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.ink,
      fontWeight: '500',
    },
    weekDayNumSelected: {
      fontFamily: F.serif,
      color: C.ink,
      fontWeight: '700',
    },
    weekDayNumToday: {
      fontFamily: F.serif,
      color: C.ink,
      fontWeight: '800',
    },
    weekUnderline: {
      position: 'absolute',
      bottom: 2,
      height: 2,
      width: 18,
      borderRadius: 1,
      backgroundColor: C.ink,
    },
    weekDot: {
      position: 'absolute',
      bottom: 3,
      width: 3, height: 3,
      borderRadius: 1.5,
      backgroundColor: C.inkMuted,
    },

    // Section
    section: { paddingHorizontal: 20, paddingTop: 18 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginBottom: 10,
    },
    sectionLabel: {
      fontFamily: F.serif,
      fontSize: 16,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: -0.2,
    },
    sectionDate: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      fontWeight: '500',
    },
    emptyDay: {
      paddingVertical: 18,
    },
    emptyDayTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkFaint,
      fontStyle: 'italic',
    },

    // Icon tile — used in book cards and reflection rows
    activityIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: C.cream,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityTag: {
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: 6,
    },
    activityTagTxt: {
      fontFamily: F.serif,
      fontSize: 9,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: 0.6,
    },

    // ── Daily Reflection section ──
    // Empty-state prompt — single-line CTA to start writing
    reflectionPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      borderStyle: 'dashed',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    reflectionPromptTxt: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 14,
      color: C.inkSoft,
      fontWeight: '500',
      letterSpacing: -0.1,
    },
    // Read-mode card — shows saved reflection text + "tap to edit" hint
    reflectionCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    reflectionBody: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      lineHeight: 21,
      letterSpacing: -0.1,
    },
    reflectionMeta: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.inkFaint,
      marginTop: 6,
    },
    // Edit-mode container
    reflectionEditor: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.amberPale,
      padding: 14,
    },
    reflectionInput: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      lineHeight: 21,
      minHeight: 80,
      padding: 0,
    },
    reflectionActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: 14,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 0.5,
      borderTopColor: C.border,
    },
    reflectionCancel: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      fontWeight: '500',
    },
    reflectionSaveBtn: {
      backgroundColor: C.ink,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 10,
    },
    reflectionSaveTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.white,
      fontWeight: '700',
      letterSpacing: 0.2,
    },

    // ── Book card (expandable) ──
    bookCard: {
      backgroundColor: C.white,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      marginBottom: 10,
      overflow: 'hidden',
    },
    bookCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    bookCardTitle: {
      fontFamily: F.serif,
      fontSize: 18,
      color: C.ink,
      letterSpacing: -0.3,
      lineHeight: 24,
    },
    bookCardSub: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      marginTop: 2,
    },
    bookCardRight: {
      alignItems: 'flex-end',
      gap: 8,
    },
    bookCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    bookCardCount: {
      fontFamily: F.serif,
      fontSize: 11,
      color: C.inkMuted,
      fontWeight: '600',
    },

    // ── Progress bar ──
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    progressTrack: {
      flex: 1,
      height: 3,
      backgroundColor: C.cream,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: C.sage,
      borderRadius: 2,
    },
    progressPct: {
      fontFamily: F.serif,
      fontSize: 10,
      color: C.inkMuted,
      fontWeight: '600',
      minWidth: 28,
      textAlign: 'right',
    },

    // ── Nested notes inside expanded book card ──
    notesNested: {
      backgroundColor: C.paper,
      paddingHorizontal: 14,
      paddingTop: 6,
      paddingBottom: 6,
      borderTopWidth: 0.5,
      borderTopColor: C.border,
    },
    nestedNoteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 0.5,
      borderBottomColor: C.border,
    },
    nestedNoteDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: C.sage,
    },
    nestedNoteTitle: {
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    nestedNoteBody: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      marginTop: 2,
    },

    // Subsection header — Goals / Books read today / Daily Reflection
    subsectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 10,
    },
    subsectionTitle: {
      fontFamily: F.serif,
      fontSize: 13,
      fontWeight: '700',
      color: C.inkMuted,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },

    // Goals section (legacy alias kept for safety)
    goalsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
    },
    goalsTitle: {
      fontFamily: F.serif,
      fontSize: 14,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: -0.2,
    },
    manageLink: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkSoft,
      fontWeight: '600',
    },
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.white,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 8,
      gap: 12,
    },
    goalLabel: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 14,
      color: C.ink,
      fontWeight: '500',
    },
    goalLabelDone: {
      fontFamily: F.serif,
      color: C.inkFaint,
      textDecorationLine: 'line-through',
    },
    goalTag: {
      backgroundColor: C.sagePale,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 6,
    },
    goalTagTxt: {
      fontFamily: F.serif,
      fontSize: 9,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: 0.5,
    },

    // FAB
    fab: {
      position: 'absolute',
      right: 24, bottom: 32,
      width: 54, height: 54,
      borderRadius: 27,
      backgroundColor: C.ink,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 10,
      elevation: 10,
    },
  }), [themeVersion]);
}

// ── Day Panel — bottom-sheet agenda for selected day ─────────────────
//
// Replaces the old SessionModal with a richer two-day agenda showing:
//  - Functional week strip (tap to switch day)
//  - "Today · [date]" section: notes + reflections + daily goals
//  - "Tomorrow · [date]" section: same shape
//  - FAB to add a new goal (opens an in-panel GoalEditor)
//  - Optional "Manage" link to navigate to GoalsScreen
//
// Props match the old SessionModal interface: { visible, day, data, onClose }
// Plus optional: onManageGoals — fired when user taps the Manage link
function DayPanel({ visible, day, data, onClose, onManageGoals }) {
  const { C } = useTheme();
  const dpnl = useDpnlStyles();
  const drag = useDragToDismiss({ onClose });
  const {
    notes, books,
    goals, addGoal, toggleGoalCompletion, isGoalCompletedOn, goalsForDate,
    reflectionForDate, upsertReflection,
  } = useStore();

  // Selected day state — initialised from prop, can change via week strip
  const [selectedDate, setSelectedDate] = useState(day || new Date());
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (visible && day) {
      setSelectedDate(day);
      drag.open();
    }
  }, [visible, day]);

  const handleClose = () => drag.dismiss(() => onClose());

  // Selected date metadata
  const selectedKey = dateKey(selectedDate);
  const todayKey    = dateKey(new Date());
  const isToday     = selectedKey === todayKey;

  // Week strip — 7 days centred on the week of the selected date
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

  // Notes filtered by date
  const notesForDate = (key) =>
    notes.filter(n => (n.date || '').slice(0, 10) === key);

  // Books read on a date (derived from notes)
  const booksForDate = (key) => {
    const ns = notesForDate(key);
    const bookIds = [...new Set(ns.map(n => n.bookId))];
    return bookIds.map(id => books.find(b => b.id === id)).filter(Boolean);
  };

  // Format date as "Tue Apr 28"
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

            {/* Drag handle */}
            <View {...drag.panHandlers} style={dpnl.handleWrap}>
              <View style={dpnl.handle} />
            </View>

            {/* Top bar — month/year + Today */}
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

            {/* Week strip */}
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

          {/* Scrollable agenda — selected day only */}
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

          {/* Floating "+ New goal" FAB */}
          <TouchableOpacity
            style={dpnl.fab}
            onPress={() => setEditorOpen(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={26} color={C.white} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* New-goal modal */}
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

// ── Single day section inside DayPanel ────────────────────────────────
// Layout (hierarchical, all collapsed by default):
//   1. Goals (with Manage link + completion toggles)
//   2. Daily Reflection (small section, only if reflections exist)
//   3. Books read today — collapsed cards showing summary; tap to expand
//      and reveal nested notes for that book.
//
// At scale (many books + many notes), this stays scannable because the
// default state is a small set of summary rows. Drilling in happens on tap.
function DaySection({
  label, dateLine,
  notes, books,
  goals, dateKey, isGoalCompletedOn, toggleGoalCompletion,
  onManageGoals,
  reflection, onSaveReflection,
}) {
  const { C } = useTheme();
  const dpnl = useDpnlStyles();
  const bookNotes = notes; // all notes are book notes now; reflections live in their own store slice

  const hasGoals       = goals.length > 0;
  const hasBooks       = books.length > 0;
  // The reflection section ALWAYS shows (with empty-state prompt when empty)
  // so the "rest day" empty state only fires when no goals + no books.
  const allEmpty       = !hasGoals && !hasBooks;

  // Group book notes by bookId for expand-on-tap
  const notesByBookId = bookNotes.reduce((acc, n) => {
    (acc[n.bookId] = acc[n.bookId] || []).push(n);
    return acc;
  }, {});

  return (
    <View style={dpnl.section}>
      {/* Section header — "Today · Tue May 11" */}
      <View style={dpnl.sectionHeader}>
        <Text style={dpnl.sectionLabel}>{label}</Text>
        <Text style={dpnl.sectionDate}>{dateLine}</Text>
      </View>

      {/* ── Daily Reflection (above Goals) ── */}
      <DailyReflectionSection
        reflection={reflection}
        onSave={(text) => onSaveReflection(dateKey, text)}
      />

      {allEmpty && (
        <View style={dpnl.emptyDay}>
          <Text style={dpnl.emptyDayTxt}>A rest day — nothing on the agenda.</Text>
        </View>
      )}

      {/* ── Goals ── */}
      {hasGoals && (
        <View style={{ marginBottom: 22 }}>
          <View style={dpnl.subsectionHeader}>
            <Text style={dpnl.subsectionTitle}>Goals</Text>
            {onManageGoals && (
              <TouchableOpacity onPress={onManageGoals} activeOpacity={0.6}>
                <Text style={dpnl.manageLink}>Manage</Text>
              </TouchableOpacity>
            )}
          </View>
          {goals.map(g => {
            const completed = isGoalCompletedOn(g.id, dateKey);
            return (
              <TouchableOpacity
                key={g.id}
                style={dpnl.goalRow}
                onPress={() => toggleGoalCompletion(g.id, dateKey)}
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

      {/* ── Books read today (expandable cards) ── */}
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

// ── Daily Reflection section ──────────────────────────────────────────
// Inline editor for the day's reflection. Always visible — when empty,
// shows a "Write today's reflection" prompt. When tapped, expands to a
// text area + Save button. Editing an existing reflection works the same
// way: tap the text → edit mode.
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
        // Edit mode — text area + Save/Cancel
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
        // Read mode — show the saved reflection, tap to edit
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
        // Empty state — prompt to write
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
      {/* Header row — always visible */}
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

      {/* Notes — only visible when expanded */}
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


// ── Day Pill ───────────────────────────────────────────────────────────
function DayPill({ day, isToday, isFuture, data, onPress }) {
  const { C, F, themeVersion } = useTheme();
  const dpil = useMemo(() => StyleSheet.create({
    pill:         { width: DAY_WIDTH, paddingVertical: 5, borderRadius: 12, alignItems: 'center', gap: 1, overflow: 'hidden', backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
    pillToday:    { borderWidth: 0, shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 6 },
    dayNameToday: { fontFamily: F.serif, fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
    dateNumToday: { fontFamily: F.serif, fontSize: 15, fontWeight: '800', color: C.white },
    todayDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: C.white, opacity: 0.8 },
    monthLblToday:{ fontFamily: F.serif, fontSize: 7, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.3, height: 11, textAlign: 'center' },
    dayName:      { fontFamily: F.serif, fontSize: 8, fontWeight: '600', color: C.inkSoft, letterSpacing: 0.3 },
    dayNameWknd:  { fontFamily: F.serif, color: C.inkMuted },
    dateNum:      { fontFamily: F.serif, fontSize: 15, fontWeight: '700', color: C.ink },
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
export function ReadingTimeline({ notes, cards, books, onManageGoals, openDateKey, onDatePanelClosed }) {
  const { C, F, themeVersion } = useTheme();
  const t = useMemo(() => StyleSheet.create({
    wrap:      { marginBottom: 16 },
    header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
    monthTxt:  { fontFamily: F.serif, fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
    // "+ Goals" pill — tap navigates to GoalsScreen
    goalsPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 14,
      backgroundColor: C.cream,
      borderWidth: 1,
      borderColor: C.border,
    },
    goalsPillTxt: {
      fontFamily: F.serif,
      fontSize: 12,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: -0.1,
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
    // If the user opened this session from the calendar, re-open the
    // calendar so they can pick another date or continue browsing.
    if (cameFromCalendar) {
      setCameFromCalendar(false);
      // Brief delay so the day panel's dismiss animation completes first
      setTimeout(() => setShowCalendar(true), 100);
    }
    // Notify parent so it can clear its openDateKey state and allow the
    // user to open the same date again later
    onDatePanelClosed?.();
  }, [cameFromCalendar, onDatePanelClosed]);

  const handleCalendarSelect = useCallback((key) => {
    // Close the calendar, but remember the user came from it. When they
    // dismiss the day panel, the calendar will re-open at the same state.
    setShowCalendar(false);
    setCameFromCalendar(true);

    const idx = days.findIndex(d => d.key === key);
    if (idx === -1) {
      // Date is outside the timeline range (>1 year back or forward).
      // Nothing to scroll to. Bail out cleanly.
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
          <Ionicons name="add" size={14} color={C.ink} />
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



