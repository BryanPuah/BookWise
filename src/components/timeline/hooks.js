/**
 * Shared hooks + constants for ReadingTimeline and its subcomponents.
 *
 * Split out of ReadingTimeline.js so DayPanel / CalendarModal can import
 * the drag-to-dismiss behaviour and the date helpers without pulling in
 * the whole timeline file.
 */

import { useRef } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

export const { width: SW, height: SH } = Dimensions.get('window');

export const DAY_WIDTH  = 42;
export const DAY_GAP    = 5;
export const DAYS_BACK  = 365;
export const DAYS_AHEAD = 365;
export const TOTAL_DAYS = DAYS_BACK + DAYS_AHEAD + 1;

export const DAY_NAMES_FULL    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const MONTH_NAMES_FULL  = ['January','February','March','April','May','June',
                                   'July','August','September','October','November','December'];
export const MONTH_NAMES_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                                   'Jul','Aug','Sep','Oct','Nov','Dec'];

export function dateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function activityScore(noteCount) {
  if (noteCount === 0) return 0;
  if (noteCount === 1) return 1;
  if (noteCount <= 3)  return 2;
  if (noteCount <= 6)  return 3;
  return 4;
}

export const HEAT_COLORS = [
  'transparent',
  'rgba(217,119,6,0.15)',
  'rgba(217,119,6,0.30)',
  'rgba(217,119,6,0.50)',
  'rgba(217,119,6,0.75)',
];

// ── Drag-to-dismiss hook ───────────────────────────────────────────────
// Pan responder + animated translateY pair used by CalendarModal and
// DayPanel. The hook exposes:
//   - translateY        — driven by gesture, native-driver friendly
//   - open() / dismiss(cb) — spring/timing helpers for show/hide
//   - panHandlers       — for the handle grab area
//   - overlayHandlers   — for the rest of the sheet (declines once a
//     scroll view inside has scrolled — set via setScrolled(true/false))
//   - backdropOpacity   — interpolates fully opaque → transparent as the
//     sheet drags down so the backdrop fades together with the sheet
//   - setScrolled       — call from your inner ScrollView's scroll events
export function useDragToDismiss({ onClose }) {
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
      // Pass onClose so the parent's visible-state flips back when the
      // sheet finishes animating away. Without this the modal stays
      // semi-mounted with visible=true and can't be reopened.
      dismiss(onClose);
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
