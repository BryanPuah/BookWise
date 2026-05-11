import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Animated, Dimensions, FlatList, ScrollView,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C } from '../theme';

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

// ── Full Calendar Modal ────────────────────────────────────────────────
function CalendarModal({ visible, notesByKey, onClose, onSelectDay }) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const scrollRef = useRef(null);
  const drag = useDragToDismiss({ onClose });

  useEffect(() => {
    if (visible) {
      setViewYear(today.getFullYear());
      setViewMonth(today.getMonth());
      drag.open();
    }
  }, [visible]);

  const handleClose = () => {
    drag.dismiss(() => {
      onClose();
    });
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
      const count   = notesByKey[key] || 0;
      const isToday = key === dateKey(today);
      const isFuture = date > today;
      grid.push({ date, key, count, isToday, isFuture });
    }
    return grid;
  }, [viewYear, viewMonth, notesByKey]);

  const maxCount = useMemo(() =>
    Math.max(1, ...Object.values(notesByKey)), [notesByKey]);

  const RANGES = [
    { id: '7d',    label: '7D' },
    { id: '30d',   label: '30D' },
    { id: 'month', label: 'Month' },
    { id: 'ytd',   label: 'YTD' },
  ];
  const [activeRange, setActiveRange] = useState('month');

  const rangeFilter = useCallback((key) => {
    const d     = new Date(key);
    const now   = new Date();
    const start = new Date(now); start.setHours(0,0,0,0);
    if (activeRange === '7d') {
      start.setDate(start.getDate() - 6);
      return d >= start;
    }
    if (activeRange === '30d') {
      start.setDate(start.getDate() - 29);
      return d >= start;
    }
    if (activeRange === 'month') {
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    }
    if (activeRange === 'ytd') {
      return d.getFullYear() === now.getFullYear();
    }
    return false;
  }, [activeRange, viewYear, viewMonth]);

  const rangeNotes = useMemo(() =>
    Object.entries(notesByKey)
      .filter(([k]) => rangeFilter(k))
      .reduce((acc, [, v]) => acc + v, 0),
  [notesByKey, rangeFilter]);

  const activeDaysInRange = useMemo(() =>
    Object.keys(notesByKey).filter(k => notesByKey[k] > 0 && rangeFilter(k)).length,
  [notesByKey, rangeFilter]);

  const activeDaysThisWeek = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return Object.keys(notesByKey).filter(k => {
      const d = new Date(k);
      return d >= mon && d <= now && notesByKey[k] > 0;
    }).length;
  }, [notesByKey]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    const cursor = new Date(); cursor.setHours(0,0,0,0);
    if (!notesByKey[dateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (notesByKey[dateKey(cursor)]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [notesByKey]);

  const [showYearPicker, setShowYearPicker]   = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const yearScrollRef  = useRef(null);
  const swipeAnim      = useRef(new Animated.Value(0)).current;
  const years = [];
  for (let y = 1900; y <= today.getFullYear() + 10; y++) years.push(y);

  const swipeX = useRef(0);
  const swipePR = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderGrant: () => { swipeX.current = 0; },
    onPanResponderMove: (_, g) => {
      swipeAnim.setValue(g.dx);
    },
    onPanResponderRelease: (_, g) => {
      const THRESHOLD = SW * 0.25;
      if (g.dx < -THRESHOLD || (g.vx < -0.5 && g.dx < -20)) {
        Animated.timing(swipeAnim, { toValue: -SW, duration: 180, useNativeDriver: true }).start(() => {
          nextMonth();
          swipeAnim.setValue(SW);
          Animated.spring(swipeAnim, { toValue: 0, tension: 100, friction: 14, useNativeDriver: true }).start();
        });
      } else if (g.dx > THRESHOLD || (g.vx > 0.5 && g.dx > 20)) {
        Animated.timing(swipeAnim, { toValue: SW, duration: 180, useNativeDriver: true }).start(() => {
          prevMonth();
          swipeAnim.setValue(-SW);
          Animated.spring(swipeAnim, { toValue: 0, tension: 100, friction: 14, useNativeDriver: true }).start();
        });
      } else {
        Animated.spring(swipeAnim, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(swipeAnim, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }).start();
    },
  })).current;

  const CELL_SIZE = Math.floor((SW - 32) / 7);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={cal.overlay}>
        <Animated.View style={[cal.backdrop, { opacity: drag.backdropOpacity }]} pointerEvents="none" />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
        <Animated.View style={[cal.sheet, { transform: [{ translateY: drag.translateY }] }]}>

          <View style={{ position: 'relative' }}>
            <View {...drag.overlayHandlers} style={cal.dragOverlay} pointerEvents="box-none" />

            <View {...drag.panHandlers} style={cal.handleWrap}>
              <View style={cal.handle} />
            </View>

            <View style={cal.topBar}>
              <View style={cal.topBarLeft}>
                <TouchableOpacity
                  style={cal.monthYearBtn}
                  onPress={() => { setShowMonthPicker(v=>!v); setShowYearPicker(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={cal.monthBig}>{MONTH_NAMES_FULL[viewMonth]}</Text>
                  <Text style={cal.yearSmall}>{viewYear}  {showMonthPicker ? '▴' : '▾'}</Text>
                </TouchableOpacity>
              </View>

              <View style={cal.topBarRight}>
                <TouchableOpacity
                  style={cal.todayChip}
                  onPress={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setShowMonthPicker(false); setShowYearPicker(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={cal.todayChipTxt}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={prevMonth} style={cal.chevron} activeOpacity={0.6}>
                  <Text style={cal.chevronTxt}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={nextMonth} style={cal.chevron} activeOpacity={0.6}>
                  <Text style={cal.chevronTxt}>›</Text>
                </TouchableOpacity>
              </View>
            </View>

            {showMonthPicker && !showYearPicker && (
              <View style={cal.monthGrid}>
                {MONTH_NAMES_SHORT.map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[cal.monthCell, i === viewMonth && cal.monthCellOn]}
                    onPress={() => { setViewMonth(i); setShowMonthPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[cal.monthCellTxt, i === viewMonth && cal.monthCellTxtOn]}>{name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={cal.yearRow}
                  onPress={() => { setShowMonthPicker(false); setShowYearPicker(true); }}
                  activeOpacity={0.7}
                >
                  <Text style={cal.yearRowTxt}>Change year  ›</Text>
                </TouchableOpacity>
              </View>
            )}

            {showYearPicker && (
              <View style={cal.yearPickerWrap}>
                <ScrollView
                  ref={yearScrollRef}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 4 }}
                  onLayout={() => {
                    const idx = years.indexOf(viewYear);
                    if (idx !== -1 && yearScrollRef.current)
                      yearScrollRef.current.scrollTo({ y: Math.max(0, idx * 44 - 88), animated: false });
                  }}
                >
                  {years.map(y => (
                    <TouchableOpacity
                      key={y}
                      style={[cal.yearItem, y === viewYear && cal.yearItemOn]}
                      onPress={() => { setViewYear(y); setShowYearPicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[cal.yearItemTxt, y === viewYear && cal.yearItemTxtOn]}>{y}</Text>
                      {y === viewYear && <Text style={cal.yearCheck}>✓</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={cal.dowRow}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <Text key={i} style={[cal.dowTxt, (i===0||i===6) && cal.dowWknd]}>{d}</Text>
              ))}
            </View>
          </View>

          <View style={cal.sep} />

          <View style={cal.statsHeader}>
            <View style={cal.statsLeft}>
              <View style={cal.statBubble}>
                <Text style={cal.statBubbleIcon}>🔥</Text>
                <Text style={cal.statBubbleNum}>{currentStreak}</Text>
                <Text style={cal.statBubbleLbl}>day streak</Text>
              </View>
              <View style={cal.statBubble}>
                <Text style={cal.statBubbleIcon}>🗓</Text>
                <Text style={cal.statBubbleNum}>{activeDaysThisWeek}</Text>
                <Text style={cal.statBubbleLbl}>this week</Text>
              </View>
            </View>

            <View style={cal.rangeRow}>
              {RANGES.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[cal.rangePill, activeRange === r.id && cal.rangePillOn]}
                  onPress={() => setActiveRange(r.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[cal.rangePillTxt, activeRange === r.id && cal.rangePillTxtOn]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={cal.rangeStats}>
              <View style={cal.rangeStat}>
                <Text style={cal.rangeStatNum}>{rangeNotes}</Text>
                <Text style={cal.rangeStatLbl}>notes</Text>
              </View>
              <View style={cal.rangeStatDiv} />
              <View style={cal.rangeStat}>
                <Text style={cal.rangeStatNum}>{activeDaysInRange}</Text>
                <Text style={cal.rangeStatLbl}>active days</Text>
              </View>
            </View>
          </View>
          <View style={cal.sep} />

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            onScroll={e => drag.setScrolled(e.nativeEvent.contentOffset.y > 4)}
            scrollEventThrottle={16}
          >
            <Animated.View
              {...swipePR.panHandlers}
              style={[cal.grid, { transform: [{ translateX: swipeAnim }] }]}
            >
              {calDays.map((item, i) => {
                if (!item) return <View key={`e-${i}`} style={[cal.cell, { width: CELL_SIZE, height: CELL_SIZE }]} />;
                const { date, key, count, isToday, isFuture } = item;
                const isWknd = date.getDay() === 0 || date.getDay() === 6;

                const intensity = count === 0 ? 0
                  : count === 1 ? 0.25
                  : count <= 3 ? 0.50
                  : count <= 5 ? 0.75
                  : 1.0;
                const shadeFill = `rgba(217,119,6,${intensity})`;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[cal.cell, { width: CELL_SIZE, height: CELL_SIZE }]}
                    onPress={() => { handleClose(); onSelectDay(key); }}
                    activeOpacity={0.7}
                  >
                    {isToday && (
                      <View style={[cal.todayCircle, {
                        width: CELL_SIZE - 8, height: CELL_SIZE - 8,
                        borderRadius: (CELL_SIZE - 8) / 2,
                      }]} />
                    )}
                    {count > 0 && !isToday && (
                      <View style={{
                        position: 'absolute',
                        width: CELL_SIZE - 8, height: CELL_SIZE - 8,
                        borderRadius: (CELL_SIZE - 8) / 2,
                        backgroundColor: shadeFill,
                      }} />
                    )}
                    <Text style={[
                      cal.dayNum,
                      isToday && cal.dayNumToday,
                      !isToday && count > 0 && intensity >= 0.5 && { color: '#fff' },
                      !isToday && count > 0 && intensity < 0.5 && { color: C.ink, fontWeight: '700' },
                      !isToday && count === 0 && isWknd && cal.dayNumWknd,
                      !isToday && isFuture && count === 0 && cal.dayNumFuture,
                    ]}>
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>

            <TouchableOpacity style={cal.doneBtn} onPress={handleClose} activeOpacity={0.85}>
              <Text style={cal.doneTxt}>Done</Text>
            </TouchableOpacity>
            <View style={{ height: 36 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Session Modal ──────────────────────────────────────────────────────
function SessionModal({ visible, day, data, onClose }) {
  const scrollRef = useRef(null);
  const drag = useDragToDismiss({ onClose });

  useEffect(() => {
    if (visible && day) {
      drag.open();
    }
  }, [visible, day]);

  const handleClose = () => {
    drag.dismiss(() => onClose());
  };

  if (!visible || !day) return null;

  const today    = new Date();
  const isToday  = dateKey(day) === dateKey(today);
  const isFuture = day > today;
  const label    = day.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const noteList = data.notes || [];
  const books    = data.books || [];
  const score    = activityScore(noteList.length);

  const reflection = () => {
    if (isFuture) return "This day hasn't happened yet. Keep reading and capturing ideas.";
    if (noteList.length === 0) return 'A quiet day — no notes recorded. Sometimes rest is part of the process.';
    const bookNames = [...new Set(noteList.map(n => n.bookTitle))];
    if (bookNames.length === 1) {
      return `You captured ${noteList.length} note${noteList.length !== 1 ? 's' : ''} from "${bookNames[0]}". ${noteList.length >= 3 ? 'A productive reading session.' : 'Every note is a step toward retention.'}`;
    }
    return `You drew ideas from ${bookNames.length} books — connecting knowledge across your reading.`;
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={sm.overlay}>
        <Animated.View style={[sm.backdrop, { opacity: drag.backdropOpacity }]} pointerEvents="none" />
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />
        <Animated.View style={[sm.sheet, { transform: [{ translateY: drag.translateY }] }]}>

          {/* Header — gradient with drag overlay on top */}
          <View style={{ position: 'relative' }}>
            <View
              {...drag.overlayHandlers}
              style={sm.dragOverlay}
              pointerEvents="box-none"
            />
            <LinearGradient
              colors={score >= 3 ? [C.heroTop, C.heroBot] : ['#1A1A2E', '#16213E']}
              style={sm.headerGrad}
            >
              <View {...drag.panHandlers} style={sm.handleWrap}>
                <View style={sm.handle} />
              </View>
              <View style={sm.headerRow}>
                <View>
                  <Text style={sm.dateLabel}>
                    {isToday ? 'TODAY' : isFuture ? 'UPCOMING' : DAY_NAMES_FULL[day.getDay()].toUpperCase()}
                  </Text>
                  <Text style={sm.dateValue}>
                    {isToday ? `Today · ${label.split(', ').slice(1).join(', ')}` : label}
                  </Text>
                </View>
                {!isFuture && (
                  <View style={sm.badge}>
                    <Text style={sm.badgeTxt}>
                      {score === 0 ? 'Rest day' : score === 1 ? 'Light' : score === 2 ? 'Active' : score === 3 ? 'Productive' : '🔥 Peak'}
                    </Text>
                  </View>
                )}
              </View>
              {!isFuture && (
                <View style={sm.statsRow}>
                  {[
                    { num: noteList.length, lbl: 'Notes' },
                    { num: books.length,    lbl: 'Books' },
                  ].map(({ num, lbl }) => (
                    <View key={lbl} style={sm.stat}>
                      <Text style={sm.statNum}>{num}</Text>
                      <Text style={sm.statLbl}>{lbl}</Text>
                    </View>
                  ))}
                </View>
              )}
            </LinearGradient>
          </View>

          <ScrollView
            ref={scrollRef}
            style={sm.body}
            showsVerticalScrollIndicator={false}
            onScroll={e => drag.setScrolled(e.nativeEvent.contentOffset.y > 4)}
            scrollEventThrottle={16}
          >
            <View style={sm.reflCard}>
              <Text style={sm.reflLabel}>✦  Reflection</Text>
              <Text style={sm.reflText}>{reflection()}</Text>
            </View>
            {books.length > 0 && (
              <View style={sm.section}>
                <Text style={sm.sectionTitle}>BOOKS</Text>
                {books.map((b, i) => (
                  <View key={i} style={sm.bookRow}>
                    <View style={sm.bookDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={sm.bookTitle} numberOfLines={1}>{b.title}</Text>
                      <Text style={sm.bookAuthor}>{b.author}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {noteList.length > 0 && (
              <View style={sm.section}>
                <Text style={sm.sectionTitle}>NOTES  ·  {noteList.length}</Text>
                {noteList.map((n, i) => (
                  <View key={i} style={sm.noteRow}>
                    <Text style={sm.noteIcon}>{
                      n.type === 'quote' ? '💬' : n.type === 'insight' ? '💡' :
                      n.type === 'question' ? '🔍' : n.type === 'action' ? '✅' :
                      n.type === 'summary' ? '📌' : '🔗'
                    }</Text>
                    <Text style={sm.noteText}>{n.text}</Text>
                  </View>
                ))}
              </View>
            )}
            {!isFuture && noteList.length === 0 && books.length === 0 && (
              <View style={sm.empty}>
                <Text style={sm.emptyIcon}>🌙</Text>
                <Text style={sm.emptyTxt}>No activity recorded</Text>
                <Text style={sm.emptySub}>Every streak starts with the next note.</Text>
              </View>
            )}
            <TouchableOpacity style={sm.closeBtn} onPress={handleClose} activeOpacity={0.8}>
              <Text style={sm.closeBtnTxt}>Close</Text>
            </TouchableOpacity>
            <View style={{ height: 80 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Day Pill ───────────────────────────────────────────────────────────
function DayPill({ day, isToday, isFuture, data, onPress }) {
  const hasData   = data.noteCount > 0;
  const isWeekend = day.getDay() === 0 || day.getDay() === 6;

  if (isToday) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        <LinearGradient colors={[C.amberLight, C.amber]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={[dp.pill, dp.pillToday]}>
          <Text style={dp.dayNameToday}>{DAY_NAMES_FULL[day.getDay()]}</Text>
          <Text style={dp.dateNumToday}>{day.getDate()}</Text>
          <View style={dp.todayDot} />
          <Text style={dp.monthLblToday} numberOfLines={1}>
            {day.getDate() === 1 ? MONTH_NAMES_SHORT[day.getMonth()] : ' '}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <View style={dp.pill}>
        <Text style={[dp.dayName, isWeekend && dp.dayNameWknd]}>
          {DAY_NAMES_FULL[day.getDay()]}
        </Text>
        <Text style={dp.dateNum}>{day.getDate()}</Text>
        <View style={dp.dotsRow}>
          {hasData && <View style={dp.dotNote} />}
        </View>
        <Text style={dp.monthLbl} numberOfLines={1}>
          {day.getDate() === 1 ? MONTH_NAMES_SHORT[day.getMonth()] : ' '}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
export function ReadingTimeline({ notes, cards, books }) {
  const scrollRef       = useRef(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [sessionDay, setSessionDay]     = useState(null);
  const [sessionVisible, setSessionVisible] = useState(false);

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
  }, []);

  const handleCalendarSelect = useCallback((key) => {
    const idx = days.findIndex(d => d.key === key);
    if (idx !== -1) {
      if (scrollRef.current) {
        const offset = Math.max(0, idx * (DAY_WIDTH + DAY_GAP) - SW * 0.4);
        scrollRef.current.scrollToOffset({ offset, animated: true });
      }
      setTimeout(() => openSession(idx), 260);
    }
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
        <View style={t.legend}>
          <View style={[t.legendDot, { backgroundColor: C.amber }]} />
          <Text style={t.legendTxt}>Notes</Text>
        </View>
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

      <SessionModal
        visible={sessionVisible}
        day={selectedDay?.date}
        data={selectedDay || {}}
        onClose={closeSession}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────
const t = StyleSheet.create({
  wrap:      { marginBottom: 16 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 10 },
  monthTxt:  { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.2 },
  legend:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendTxt: { fontSize: 10, color: C.inkFaint },
});

const dp = StyleSheet.create({
  pill:         { width: DAY_WIDTH, paddingVertical: 5, borderRadius: 12, alignItems: 'center', gap: 1, overflow: 'hidden', backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
  pillToday:    { borderWidth: 0, shadowColor: C.amber, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 6 },
  dayNameToday: { fontSize: 8, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.3 },
  dateNumToday: { fontSize: 15, fontWeight: '800', color: C.white },
  todayDot:     { width: 4, height: 4, borderRadius: 2, backgroundColor: C.white, opacity: 0.8 },
  monthLblToday:{ fontSize: 7, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.3, height: 11, textAlign: 'center' },
  dayName:      { fontSize: 8, fontWeight: '600', color: C.inkSoft, letterSpacing: 0.3 },
  dayNameWknd:  { color: C.inkMuted },
  dateNum:      { fontSize: 15, fontWeight: '700', color: C.ink },
  dotsRow:      { height: 5, alignItems: 'center', justifyContent: 'center' },
  dotNote:      { width: 4, height: 4, borderRadius: 2, backgroundColor: C.amber },
  monthLbl:     { fontSize: 7, color: C.amber, fontWeight: '700', letterSpacing: 0.3, height: 11, textAlign: 'center' },
});

const cal = StyleSheet.create({
  overlay:   { flex: 1, justifyContent: 'flex-end' },
  backdrop:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:     { backgroundColor: '#FAFAFA', borderTopLeftRadius: 28, borderTopRightRadius: 28,
               maxHeight: SH * 0.88, shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
               shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },

  dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
  handleWrap:  { paddingVertical: 14, alignItems: 'center' },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D1D6' },

  topBar:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  topBarLeft:  { flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  monthYearBtn:{ gap: 2 },
  monthBig:    { fontSize: 26, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.8, lineHeight: 30 },
  yearSmall:   { fontSize: 14, fontWeight: '500', color: '#8E8E93', letterSpacing: -0.2 },
  todayChip:   { backgroundColor: '#F2F2F7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  todayChipTxt:{ fontSize: 13, fontWeight: '600', color: C.amber },
  chevron:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center' },
  chevronTxt:  { fontSize: 18, color: '#1C1C1E', lineHeight: 22 },

  monthGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingBottom: 8, gap: 8 },
  monthCell:   { width: (SW - 80) / 4, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: '#F2F2F7' },
  monthCellOn: { backgroundColor: '#1C1C1E' },
  monthCellTxt:{ fontSize: 13, fontWeight: '500', color: '#1C1C1E' },
  monthCellTxtOn: { color: '#FFFFFF', fontWeight: '700' },
  yearRow:     { width: '100%', paddingVertical: 10, alignItems: 'center' },
  yearRowTxt:  { fontSize: 13, color: C.amber, fontWeight: '600' },

  yearPickerWrap: { maxHeight: 200, marginHorizontal: 16, marginBottom: 8, borderRadius: 16,
                    backgroundColor: '#F2F2F7', overflow: 'hidden' },
  yearItem:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 44 },
  yearItemOn:  { backgroundColor: C.amberPale },
  yearItemTxt: { fontSize: 16, color: '#1C1C1E' },
  yearItemTxtOn: { color: C.amber, fontWeight: '700' },
  yearCheck:   { fontSize: 14, color: C.amber, fontWeight: '700' },

  dowRow:    { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 8 },
  dowTxt:    { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#8E8E93', letterSpacing: 0.5 },
  dowWknd:   { color: '#FF3B30' },

  sep: { height: 0.5, backgroundColor: '#E5E5EA', marginHorizontal: 16 },

  grid:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  cell:      { alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  todayCircle: { position: 'absolute', backgroundColor: C.amber },
  dayNum:    { fontSize: 16, fontWeight: '400', color: '#1C1C1E', zIndex: 1 },
  dayNumToday: { color: '#FFFFFF', fontWeight: '800' },
  dayNumWknd:  { color: '#FF3B30' },
  dayNumFuture:{ color: '#C7C7CC' },

  doneBtn:    { marginHorizontal: 16, marginTop: 14, backgroundColor: '#1C1C1E', borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  doneTxt:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },

  statsHeader:    { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  statsLeft:      { flexDirection: 'row', gap: 10 },
  statBubble:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F2F2F7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  statBubbleIcon: { fontSize: 16 },
  statBubbleNum:  { fontSize: 20, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  statBubbleLbl:  { fontSize: 10, color: '#8E8E93', fontWeight: '500' },
  rangeRow:       { flexDirection: 'row', gap: 6 },
  rangePill:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F2F2F7' },
  rangePillOn:    { backgroundColor: '#1C1C1E' },
  rangePillTxt:   { fontSize: 12, fontWeight: '600', color: '#8E8E93' },
  rangePillTxtOn: { color: '#FFFFFF' },
  rangeStats:     { flexDirection: 'row', backgroundColor: '#F2F2F7', borderRadius: 16, overflow: 'hidden' },
  rangeStat:      { flex: 1, alignItems: 'center', paddingVertical: 12 },
  rangeStatDiv:   { width: 0.5, backgroundColor: '#C7C7CC' },
  rangeStatNum:   { fontSize: 22, fontWeight: '800', color: '#1C1C1E', letterSpacing: -0.5 },
  rangeStatLbl:   { fontSize: 10, color: '#8E8E93', fontWeight: '500', marginTop: 2 },
});

const sm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
  // CHANGED: maxHeight → height, 0.82 → 0.92 — sheet now fills 92% of screen
  sheet:    { backgroundColor: C.paper, borderTopLeftRadius: 26, borderTopRightRadius: 26, height: SH * 0.92 },
  handle:    { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)', alignSelf: 'center' },
  handleWrap:{ paddingVertical: 16, alignItems: 'center' },
  dragOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 },
  headerGrad: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 4 },
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  dateLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600', letterSpacing: 1.5, marginBottom: 4 },
  dateValue:  { fontSize: 19, color: C.white, fontWeight: '700', letterSpacing: -0.3 },
  badge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)' },
  badgeTxt:   { fontSize: 11, color: C.white, fontWeight: '600' },
  statsRow:   { flexDirection: 'row', gap: 8 },
  stat:       { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingVertical: 10, borderRadius: 10 },
  statNum:    { fontSize: 22, fontWeight: '800', color: C.white },
  statLbl:    { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  // CHANGED: added flex: 1 — body fills remaining sheet space and scrolls
  body:       { flex: 1, paddingHorizontal: 20 },
  reflCard:   { backgroundColor: C.amberPale, borderRadius: 14, padding: 14, marginTop: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(217,119,6,0.12)' },
  reflLabel:  { fontSize: 11, fontWeight: '700', color: C.amber, letterSpacing: 0.5, marginBottom: 6 },
  reflText:   { fontSize: 14, color: C.inkSoft, lineHeight: 21 },
  section:    { marginBottom: 14 },
  sectionTitle:{ fontSize: 10, fontWeight: '700', color: C.inkFaint, letterSpacing: 1, marginBottom: 8 },
  bookRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  bookDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber },
  bookTitle:  { fontSize: 14, fontWeight: '600', color: C.ink },
  bookAuthor: { fontSize: 11, color: C.inkMuted },
  noteRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8, backgroundColor: C.cream, borderRadius: 10, padding: 12 },
  noteIcon:   { fontSize: 14, marginTop: 2 },
  // CHANGED: removed numberOfLines truncation (in JSX) and improved line height
  noteText:   { flex: 1, fontSize: 13, color: C.inkSoft, lineHeight: 20 },
  empty:      { alignItems: 'center', paddingTop: 28, paddingBottom: 12 },
  emptyIcon:  { fontSize: 34, marginBottom: 8 },
  emptyTxt:   { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 4 },
  emptySub:   { fontSize: 12, color: C.inkMuted, textAlign: 'center' },
  closeBtn:   { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 14 },
  closeBtnTxt:{ color: C.white, fontSize: 14, fontWeight: '600' },
});