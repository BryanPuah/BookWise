/**
 * CalendarModal — bottom-sheet date picker with a draggable handle.
 *
 * Compact mode shows the current month's day grid; tapping the title
 * swaps the grid for a YearMonthPicker. Dragging the handle up grows the
 * sheet to nearly full-screen; dragging it down past a threshold either
 * collapses (if expanded) or dismisses (if compact).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, TouchableOpacity, ScrollView, StyleSheet,
  Modal, Animated, PanResponder,
} from 'react-native';
import { AppText as Text } from '../AppText';
import { useTheme } from '../../theme';
import {
  SH, SW,
  MONTH_NAMES_FULL, MONTH_NAMES_SHORT,
  dateKey, useDragToDismiss,
} from './hooks';

// ── Year + Month picker — two vertical scroll columns, taps to confirm ──
const PICKER_PAD_TOP = 12;

function YearMonthPicker({ selectedYear, selectedMonth, onPickYear, onPickMonth, onCenterChange, height }) {
  const { C, F, themeVersion } = useTheme();
  const ymp = useMemo(() => StyleSheet.create({
    wrap: { paddingHorizontal: 20, paddingTop: PICKER_PAD_TOP, position: 'relative' },
    columns: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    column: { flex: 1 },
    row: { alignItems: 'center', justifyContent: 'center' },
    rowTxt: { fontFamily: F.serif, fontSize: 16, color: C.inkFaint, fontWeight: '500' },
    rowTxtActive: { fontFamily: F.serif, color: C.ink, fontWeight: '700', fontSize: 18 },
    divider: { width: 0.5, height: '100%', backgroundColor: C.border },
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
  const PICKER_HEIGHT = height ?? 264;

  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr = [];
    for (let y = thisYear - 60; y <= thisYear + 60; y++) arr.push(y);
    return arr;
  }, [thisYear]);

  const [centeredYearIdx,  setCenteredYearIdx]  = useState(years.indexOf(selectedYear));
  const [centeredMonthIdx, setCenteredMonthIdx] = useState(selectedMonth);

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
          Offsets include PICKER_PAD_TOP because the lines are absolutely positioned
          relative to the wrap's padding box, while the ScrollView rows sit *inside* the paddingTop. */}
      <View style={[ymp.centreLine, { top: PICKER_PAD_TOP + PICKER_HEIGHT / 2 - ROW_HEIGHT / 2 }]} pointerEvents="none" />
      <View style={[ymp.centreLine, { top: PICKER_PAD_TOP + PICKER_HEIGHT / 2 + ROW_HEIGHT / 2 }]} pointerEvents="none" />
    </View>
  );
}

export function CalendarModal({ visible, notesByKey, onClose, onSelectDay }) {
  const { C, F, themeVersion } = useTheme();
  const cal = useMemo(() => StyleSheet.create({
    overlay:  { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim },
    sheetOuter: {
      shadowColor: C.shadow,
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 20,
    },
    sheet: {
      backgroundColor: C.paper,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      paddingBottom: 8,
      overflow: 'hidden',
    },

    dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
    handleWrap:  { paddingTop: 10, paddingBottom: 8, alignItems: 'center' },
    handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },
    headerArea:  { position: 'relative' },

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

    sep: { height: 0.5, backgroundColor: C.border, marginHorizontal: 0 },

    monthBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 8,
    },
    monthLbl: { fontFamily: F.serif, fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
    chevronRow: { flexDirection: 'row', gap: 4 },
    chevron: {
      width: 32, height: 32,
      alignItems: 'center', justifyContent: 'center',
      borderRadius: 16,
    },
    chevronTxt: { fontFamily: F.serif, fontSize: 22, color: C.ink, lineHeight: 26 },

    dowRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 4,
    },
    dowTxt: {
      flex: 1, textAlign: 'center',
      fontFamily: F.serif, fontSize: 11, fontWeight: '600',
      color: C.inkMuted, letterSpacing: 0.4,
    },

    grid: {
      flexDirection: 'row', flexWrap: 'wrap',
      paddingHorizontal: 16, paddingBottom: 12,
    },
    cell: { alignItems: 'center', justifyContent: 'center' },
    selectedCircle: { position: 'absolute', backgroundColor: C.ink },
    todayCircle:    { position: 'absolute', backgroundColor: C.amberPale },
    dayNum: {
      fontFamily: F.serif, fontSize: 15,
      color: C.ink, fontWeight: '500', zIndex: 1,
    },
    dayNumSelected: { fontFamily: F.serif, color: C.white, fontWeight: '700' },
    dayNumToday:    { fontFamily: F.serif, color: C.ink, fontWeight: '800' },
    dayNumFuture:   { fontFamily: F.serif, color: C.inkFaint },
  }), [themeVersion]);
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingYear,  setPendingYear]  = useState(today.getFullYear());
  const [pendingMonth, setPendingMonth] = useState(today.getMonth());
  const [expanded, setExpanded] = useState(false);
  const drag = useDragToDismiss({ onClose });

  // Sheet height — animated between compact and expanded values.
  const COMPACT_HEIGHT  = SH * 0.62;
  const EXPANDED_HEIGHT = SH * 0.92;
  const sheetHeight = useRef(new Animated.Value(COMPACT_HEIGHT)).current;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const springTo = (toValue) => {
    Animated.spring(sheetHeight, {
      toValue, useNativeDriver: false, tension: 80, friction: 13,
    }).start();
  };

  // Custom pan responder on the drag handle.
  //
  // CRITICAL: capture the start height once on grant, then compute the
  // target height from (startHeight - g.dy) on each move. Doing
  // (sheetHeight.__getValue() - g.dy) on every move drifts catastrophically
  // because the value updates each tick — that was the source of the jank.
  const dragStartHeight = useRef(COMPACT_HEIGHT);
  const lastMoveTime    = useRef(0);

  const handlePR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderGrant: () => {
      dragStartHeight.current = sheetHeight.__getValue();
      lastMoveTime.current = 0;
    },
    onPanResponderMove: (_, g) => {
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

  const handleClose = () => drag.dismiss(() => onClose());

  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const openPicker = () => {
    setPendingYear(viewYear);
    setPendingMonth(viewMonth);
    setPickerOpen(true);
  };

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
    setTimeout(() => {
      drag.dismiss(() => {});
      onSelectDay(key);
    }, 120);
  };

  const MIN_CELL_SIZE = Math.floor((SW - 32) / 7);
  const GRID_OVERHEAD = 200;
  const [cellSize, setCellSize] = useState(MIN_CELL_SIZE);

  useEffect(() => {
    const id = sheetHeight.addListener(({ value }) => {
      const available = value - GRID_OVERHEAD;
      const newCell = Math.max(MIN_CELL_SIZE, Math.floor(available / 6));
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

        <Animated.View
          style={[
            cal.sheetOuter,
            { transform: [{ translateY: drag.translateY }] },
          ]}
        >
          <Animated.View style={[cal.sheet, { height: sheetHeight }]}>
            <View {...handlePR.panHandlers} style={cal.headerArea}>
              <View style={cal.handleWrap}>
                <View style={cal.handle} />
              </View>

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

            <View style={cal.dowRow}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <Text key={i} style={cal.dowTxt}>{d}</Text>
              ))}
            </View>
          </View>

          {pickerOpen ? (
            <YearMonthPicker
              selectedYear={viewYear}
              selectedMonth={viewMonth}
              height={expanded ? SH * 0.7 : 264}
              onPickYear={(y) => {
                setPendingYear(y);
              }}
              onPickMonth={(m) => {
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
                const circleSize = Math.min(MIN_CELL_SIZE, CELL_SIZE) - 12;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[cal.cell, { width: MIN_CELL_SIZE, height: CELL_SIZE }]}
                    onPress={() => handleDayPress(key)}
                    activeOpacity={0.6}
                  >
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
