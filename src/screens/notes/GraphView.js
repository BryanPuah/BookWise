/**
 * GraphView — Obsidian-style interactive force-directed graph.
 *
 * Pan + pinch-zoom over an SVG canvas; tap a node to open the note.
 * Layout is computed once via a force simulation (repulsion / spring /
 * gravity / damping) so the graph reads as an organic constellation
 * instead of a rigid ring.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Dimensions, AccessibilityInfo,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { AppText as Text } from '../../components/AppText';
import { useTheme, NOTE_TYPE_COLORS } from '../../theme';
import { NoteCard } from './NoteCard';
import { useNT, noteHasType, NotesEmptyState } from './shared';

// Visual catch-all for notes whose type isn't in `NT` (or is missing
// entirely). Surfaced in the legend + as the node fill so unclassified
// notes are obvious rather than silently miscoloured.
const OTHER_NOTE_COLOR = '#9CA3AF';
const OTHER_NOTE_LABEL = 'Other';

// Force simulation is O(N²) per tick × 220 settle iterations on layout.
// Past this many notes the initial layout blocks the UI thread long enough
// to feel broken on mid-tier devices. We gate the render and let the user
// opt in with eyes open.
const GRAPH_NOTE_LIMIT = 150;

// Total character count across all text-bearing fields of a note. Used to
// scale a note's node radius in the graph so longer notes read as bigger.
function noteTextLen(n) {
  let len = (n.title || '').length + (n.text || '').length + (n.thinking || '').length;
  if (Array.isArray(n.blocks)) {
    n.blocks.forEach(b => { if (b && typeof b.text === 'string') len += b.text.length; });
  }
  return len;
}

// Map text length → node radius. Log curve so a 50-char note is visibly
// larger than a 5-char one, but a 5000-char note doesn't blow up the
// canvas. Starred notes get a small bonus on top.
function noteRadius(n) {
  const len = noteTextLen(n);
  const base = 5 + Math.min(9, Math.log2(len / 30 + 1) * 2.2);
  return n.starred ? base + 1.5 : base;
}

function noteShortLabel(n) {
  const t = (n.title || '').trim();
  if (t) return t.length > 18 ? t.slice(0, 16) + '…' : t;
  let body = (n.text || '').trim();
  if (!body && Array.isArray(n.blocks)) {
    const para = n.blocks.find(b => b.type === 'paragraph' && b.text?.trim());
    body = (para?.text || '').trim();
  }
  body = body.replace(/[#*_`>\n]+/g, ' ').trim();
  if (!body) return '·';
  return body.length > 18 ? body.slice(0, 16) + '…' : body;
}

export function GraphView({ notes, books, onEdit, onDelete, onStar, onCapture, onSwitchToList, groupBy = 'book' }) {
  const { C, F, themeVersion } = useTheme();
  const NT = useNT();
  const [previewNote, setPreviewNote] = useState(null); // tapped node → overlay card
  // Screen-reader detection. The SVG canvas is unreachable via VoiceOver/
  // TalkBack — pan/pinch/tap gestures don't map to a11y actions — so when
  // a reader is on, swap the visualization for a structured list grouped
  // by hub. AccessibilityInfo emits change events while the app is open,
  // so we react to toggle-on-the-fly.
  const [srEnabled, setSrEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled?.().then(v => { if (mounted) setSrEnabled(!!v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('screenReaderChanged', v => setSrEnabled(!!v));
    return () => { mounted = false; sub?.remove?.(); };
  }, []);
  // Hint fades out the first time the user interacts (tap, pan, or pinch).
  // Persistent hints are noise once you know what they say.
  const [hintVisible, setHintVisible] = useState(true);
  // Per-mount opt-in for libraries past GRAPH_NOTE_LIMIT. Resets when the
  // user leaves and returns — we'd rather re-confirm than have the user
  // wonder why scrolling back to Graph froze the app a week from now.
  const [forceRender, setForceRender] = useState(false);

  const win = Dimensions.get('window');
  const [size, setSize] = useState({ W: win.width, H: Math.max(420, win.height - 360) });

  const onCanvasLayout = (ev) => {
    const { width, height } = ev.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size.W || height !== size.H)) {
      setSize({ W: width, H: height });
    }
  };

  const gv = useMemo(() => StyleSheet.create({
    legendWrap: {
      paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6,
    },
    legend: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 6,
      justifyContent: 'center',
    },
    legendItem: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingHorizontal: 9, paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: C.cream,
      borderWidth: 0.5, borderColor: C.border,
    },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendTxt: { fontFamily: F.serif, fontSize: 10, color: C.inkSoft, fontWeight: '600', letterSpacing: 0.2 },

    previewBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(20, 22, 30, 0.45)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    previewCardWrap: { maxWidth: 460, width: '100%', alignSelf: 'center' },

    canvasWrap: {
      flex: 1, marginHorizontal: 12, marginTop: 4, marginBottom: 4,
      borderRadius: 18, overflow: 'hidden',
      backgroundColor: C.cream,
      borderWidth: 0.5, borderColor: C.border,
      shadowColor: '#000', shadowOpacity: 0.04,
      shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1,
    },

    hud: {
      position: 'absolute', top: 12, right: 12,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: 'rgba(20, 22, 30, 0.62)',
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
    },
    // Overlay pills have a hardcoded dark scrim bg, so the text must stay
    // hardcoded white — `C.white` flips to near-black in dark mode and
    // would vanish against the scrim.
    hudTxt: { color: '#FFFFFF', fontFamily: F.serif, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },

    resetBtn: {
      position: 'absolute', top: 12, left: 12,
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: C.white,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 999, borderWidth: 0.5, borderColor: C.border,
      shadowColor: '#000', shadowOpacity: 0.06,
      shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 1,
    },
    resetTxt: { fontFamily: F.serif, fontSize: 11, color: C.ink, fontWeight: '600', letterSpacing: 0.2 },

    hint: {
      position: 'absolute', bottom: 10, alignSelf: 'center',
      backgroundColor: 'rgba(20, 22, 30, 0.48)',
      paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    },
    hintTxt: { color: '#FFFFFF', fontFamily: F.serif, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  }), [themeVersion]);

  const typeColor = NOTE_TYPE_COLORS;

  // Short-circuit the heavy graph build when the library is over the
  // soft cap and the user hasn't opted in. The interstitial render below
  // catches this case before paint; we also guard the memo so the
  // simulation effects don't fire on a partially-built node list.
  const isGated = notes.length > GRAPH_NOTE_LIMIT && !forceRender;

  const { nodes, edges } = useMemo(() => {
    if (isGated) return { nodes: [], edges: [] };
    let groups;
    if (groupBy === 'book') {
      const ids = [...new Set(notes.map(n => n.bookId))];
      groups = ids.map(id => {
        const book = books.find(b => b.id === id);
        return {
          id: `book:${id}`,
          label: book?.title || 'Unknown',
          notes: notes.filter(n => n.bookId === id),
        };
      }).filter(g => g.notes.length > 0 && g.label);
    } else {
      groups = Object.entries(NT).reduce((acc, [key, meta]) => {
        const ns = notes.filter(n => noteHasType(n, key));
        if (ns.length > 0) acc.push({ id: `type:${key}`, label: `${meta.icon} ${meta.label}`, notes: ns });
        return acc;
      }, []);
      const knownKeys = Object.keys(NT);
      const otherNotes = notes.filter(n => !knownKeys.some(k => noteHasType(n, k)));
      if (otherNotes.length > 0) {
        groups.push({ id: 'type:other', label: `· ${OTHER_NOTE_LABEL}`, notes: otherNotes });
      }
    }
    const N = [], E = [];
    // noteId → first synthetic node id (a note may appear under multiple
    // hubs in by_type mode; we anchor cross-note edges to the first copy).
    const firstNodeIdByNote = new Map();
    groups.forEach(g => {
      N.push({ id: g.id, kind: 'hub', label: g.label, count: g.notes.length });
      g.notes.forEach(n => {
        const nid = `${g.id}::n:${n.id}`;
        N.push({ id: nid, kind: 'note', note: n, label: noteShortLabel(n) });
        E.push({ s: g.id, t: nid, kind: 'hub' });
        if (!firstNodeIdByNote.has(n.id)) firstNodeIdByNote.set(n.id, nid);
      });
    });

    // Note→note edges. Two sources:
    //   1. `linkedNoteIds` — explicit connection links from Connection notes.
    //   2. `[[wiki-link]]` mentions parsed out of body text, matched against
    //      target note titles (case-insensitive).
    // Edges are deduped per unordered pair so two notes that link to each
    // other don't render as overlapping double lines.
    const titleIndex = new Map();   // lowercased title → noteId
    notes.forEach(n => {
      const t = (n.title || '').trim().toLowerCase();
      if (t && !titleIndex.has(t)) titleIndex.set(t, n.id);
    });
    const seen = new Set();
    const addPairEdge = (sourceNoteId, targetNoteId) => {
      if (!sourceNoteId || !targetNoteId || sourceNoteId === targetNoteId) return;
      const sNid = firstNodeIdByNote.get(sourceNoteId);
      const tNid = firstNodeIdByNote.get(targetNoteId);
      if (!sNid || !tNid) return;
      const key = sourceNoteId < targetNoteId
        ? `${sourceNoteId}|${targetNoteId}`
        : `${targetNoteId}|${sourceNoteId}`;
      if (seen.has(key)) return;
      seen.add(key);
      E.push({ s: sNid, t: tNid, kind: 'link' });
    };
    const wikiRe = /\[\[([^\]\n]+)\]\]/g;
    notes.forEach(n => {
      if (Array.isArray(n.linkedNoteIds)) {
        n.linkedNoteIds.forEach(tid => addPairEdge(n.id, tid));
      }
      const body = `${n.title || ''}\n${n.text || ''}`;
      let m;
      while ((m = wikiRe.exec(body)) !== null) {
        const targetId = titleIndex.get(m[1].trim().toLowerCase());
        if (targetId) addPairEdge(n.id, targetId);
      }
    });

    return { nodes: N, edges: E };
  }, [notes, books, groupBy, isGated]);

  // ── Live force-directed simulation ──────────────────────────────────
  // Positions live in a ref so the rAF loop can mutate them at 60fps
  // without churning React state. A small tick counter forces re-renders
  // when something actually moved.
  const positionsRef    = useRef({});
  const draggingRef     = useRef(null);
  // Set on touch-down if the finger landed on a node — the subsequent pan
  // (if it crosses minDistance) promotes this into an active drag. Lets us
  // grab nodes immediately like Obsidian, without a long-press gate.
  const pendingDragRef  = useRef(null);
  const rafRef          = useRef(0);
  const [, setTick]     = useState(0);
  const tickGraph = () => setTick(t => (t + 1) % 1000000);

  const SIM = {
    REPULSE: 2200, SPRING_K: 0.045, REST: 68, GRAVITY: 0.014,
    DAMP: 0.86, HUB_MASS: 3.2, MAX_F: 60,
  };

  const simulate = (iters) => {
    const pos = positionsRef.current;
    const { W, H } = size;
    const cx = W / 2, cy = H / 2;
    const drag = draggingRef.current;
    for (let it = 0; it < iters; it++) {
      for (let i = 0; i < nodes.length; i++) {
        const a = pos[nodes[i].id]; if (!a) continue;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = pos[nodes[j].id]; if (!b) continue;
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy + 1;
          let d  = Math.sqrt(d2);
          let f  = SIM.REPULSE / d2;
          if (f > SIM.MAX_F) f = SIM.MAX_F;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
      }
      edges.forEach(e => {
        const a = pos[e.s], b = pos[e.t];
        if (!a || !b) return;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d  = Math.sqrt(dx * dx + dy * dy + 1);
        const f = SIM.SPRING_K * (d - SIM.REST);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });
      nodes.forEach(n => {
        const p = pos[n.id]; if (!p) return;
        if (drag && drag.id === n.id) {
          p.x = drag.gx; p.y = drag.gy; p.vx = 0; p.vy = 0;
          return;
        }
        // Pinned nodes (dragged + released) hold their position but still act
        // as repulsion / spring sources, so the rest of the graph reflows
        // around them — matches Obsidian's "drag to fix" behaviour.
        if (p.pinned) { p.vx = 0; p.vy = 0; return; }
        p.vx += (cx - p.x) * SIM.GRAVITY;
        p.vy += (cy - p.y) * SIM.GRAVITY;
        const m = n.kind === 'hub' ? SIM.HUB_MASS : 1;
        p.x += p.vx / m;
        p.y += p.vy / m;
        p.vx *= SIM.DAMP;
        p.vy *= SIM.DAMP;
      });
    }
  };

  useEffect(() => {
    if (nodes.length === 0) { positionsRef.current = {}; tickGraph(); return; }
    const { W, H } = size;
    const cx = W / 2, cy = H / 2;
    const pos = positionsRef.current;
    const liveIds = new Set(nodes.map(n => n.id));
    Object.keys(pos).forEach(k => { if (!liveIds.has(k)) delete pos[k]; });

    const hubs = nodes.filter(n => n.kind === 'hub');
    const hubRadius = Math.min(W, H) * 0.22;
    hubs.forEach((h, i) => {
      if (pos[h.id]) return;
      const a = (i / Math.max(1, hubs.length)) * 2 * Math.PI - Math.PI / 2;
      pos[h.id] = { x: cx + hubRadius * Math.cos(a), y: cy + hubRadius * Math.sin(a), vx: 0, vy: 0 };
    });
    const childMap = {};
    edges.forEach(e => { (childMap[e.s] = childMap[e.s] || []).push(e.t); });
    hubs.forEach(h => {
      const kids = childMap[h.id] || [];
      const p = pos[h.id];
      kids.forEach((kid, j) => {
        if (pos[kid]) return;
        const r = 38 + (j % 5) * 6;
        const a = (j / Math.max(1, kids.length)) * 2 * Math.PI;
        pos[kid] = { x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a), vx: 0, vy: 0 };
      });
    });
    nodes.forEach(n => { if (!pos[n.id]) pos[n.id] = { x: cx, y: cy, vx: 0, vy: 0 }; });

    simulate(220);
    tickGraph();
  }, [nodes, edges, size.W, size.H]);

  const wakeLoop = () => {
    if (rafRef.current) return;
    const step = () => {
      simulate(1);
      let E = 0;
      const pos = positionsRef.current;
      for (const k in pos) { const p = pos[k]; E += p.vx * p.vx + p.vy * p.vy; }
      tickGraph();
      if (E > 0.05 || draggingRef.current) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };
  useEffect(() => {
    wakeLoop();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = 0; };
  }, [nodes, edges, size.W, size.H]);

  const [tx, setTx] = useState({ x: 0, y: 0, k: 1 });
  const txRef    = useRef({ x: 0, y: 0, k: 1 });
  const savedRef = useRef({ x: 0, y: 0, k: 1 });
  const focalRef = useRef({ x: 0, y: 0 });
  useEffect(() => { txRef.current = tx; }, [tx]);

  useEffect(() => {
    const r = { x: 0, y: 0, k: 1 };
    setTx(r); txRef.current = r; savedRef.current = r;
  }, [groupBy]);

  // Pan handles both canvas-drag and node-drag. The decision is made on
  // touch-down (`onBegin`): if the finger landed on a node, we stash it as
  // a pending drag; otherwise the gesture pans the canvas. The active
  // drag is only promoted once minDistance is exceeded — short touches
  // fall through to the tap gesture and open the preview card.
  const panG = useMemo(() => Gesture.Pan()
    .minDistance(2)
    .onBegin(e => {
      const t = txRef.current;
      const gx = (e.x - t.x) / t.k;
      const gy = (e.y - t.y) / t.k;
      let bestId = null, bestD = Infinity;
      for (const n of nodes) {
        const p = positionsRef.current[n.id];
        if (!p) continue;
        const d = Math.hypot(gx - p.x, gy - p.y);
        const baseR = n.kind === 'hub' ? 18 : noteRadius(n.note);
        const hitR  = baseR + 14 / Math.max(0.4, t.k);
        if (d < hitR && d < bestD) { bestD = d; bestId = n.id; }
      }
      if (bestId) {
        const p = positionsRef.current[bestId];
        pendingDragRef.current = { id: bestId, ox: gx - p.x, oy: gy - p.y };
      } else {
        pendingDragRef.current = null;
      }
      savedRef.current = txRef.current;
    })
    .onStart(() => {
      setHintVisible(false);
      const pending = pendingDragRef.current;
      if (pending) {
        const p = positionsRef.current[pending.id];
        if (p) {
          draggingRef.current = {
            id: pending.id, ox: pending.ox, oy: pending.oy, gx: p.x, gy: p.y,
          };
          wakeLoop();
        }
      }
    })
    .onUpdate(e => {
      const drag = draggingRef.current;
      const t = txRef.current;
      if (drag) {
        // Translate the finger position into world space and let the
        // simulation pin the node there. Other nodes react via the
        // ongoing force loop, so the whole graph stays alive.
        const gx = (e.x - t.x) / t.k - drag.ox;
        const gy = (e.y - t.y) / t.k - drag.oy;
        drag.gx = gx; drag.gy = gy;
        wakeLoop();
      } else {
        setTx({
          k: savedRef.current.k,
          x: savedRef.current.x + e.translationX,
          y: savedRef.current.y + e.translationY,
        });
      }
    })
    .onEnd(() => {
      const drag = draggingRef.current;
      if (drag) {
        const p = positionsRef.current[drag.id];
        if (p) { p.pinned = true; p.vx = 0; p.vy = 0; }
      }
      draggingRef.current = null;
      pendingDragRef.current = null;
      wakeLoop();
    })
    .onFinalize(() => {
      draggingRef.current = null;
      pendingDragRef.current = null;
    }),
  [nodes]);

  const pinchG = useMemo(() => Gesture.Pinch()
    .onStart(e => {
      setHintVisible(false);
      savedRef.current = txRef.current;
      focalRef.current = { x: e.focalX, y: e.focalY };
    })
    .onUpdate(e => {
      const prevK = savedRef.current.k;
      const nextK = Math.max(0.35, Math.min(4, prevK * e.scale));
      const fx = focalRef.current.x, fy = focalRef.current.y;
      const nextX = fx - ((fx - savedRef.current.x) / prevK) * nextK;
      const nextY = fy - ((fy - savedRef.current.y) / prevK) * nextK;
      setTx({ k: nextK, x: nextX, y: nextY });
    }),
  []);

  const tapG = useMemo(() => Gesture.Tap()
    .maxDuration(260)
    .maxDistance(6)
    .onEnd((e, success) => {
      if (!success) return;
      setHintVisible(false);
      const t = txRef.current;
      const gx = (e.x - t.x) / t.k;
      const gy = (e.y - t.y) / t.k;
      let bestNote = null, bestD = Infinity;
      for (const n of nodes) {
        if (n.kind !== 'note') continue;
        const p = positionsRef.current[n.id];
        if (!p) continue;
        const d = Math.hypot(gx - p.x, gy - p.y);
        const baseR = n.note.starred ? 9 : 7;
        const hitR  = baseR + 10 / Math.max(0.4, t.k);
        if (d < hitR && d < bestD) { bestD = d; bestNote = n.note; }
      }
      if (bestNote) setPreviewNote(bestNote);
    }),
  [nodes]);

  // Tap races against movement (pan/pinch). If the user moves past the
  // pan threshold, pan claims the gesture and tap is cancelled — so
  // dragging a node never accidentally pops its preview card.
  const gesture = useMemo(
    () => Gesture.Race(tapG, Gesture.Simultaneous(panG, pinchG)),
    [tapG, panG, pinchG]
  );

  const resetView = () => {
    // Clear pins so the layout re-settles to the organic constellation —
    // otherwise "Reset" only re-centers the camera, leaving the user's
    // hand-arranged nodes stuck where they were.
    const pos = positionsRef.current;
    for (const k in pos) { if (pos[k].pinned) pos[k].pinned = false; }
    const r = { x: 0, y: 0, k: 1 };
    setTx(r); savedRef.current = r;
    wakeLoop();
  };

  if (isGated) {
    return (
      <GraphGateInterstitial
        count={notes.length}
        limit={GRAPH_NOTE_LIMIT}
        onSwitchToList={onSwitchToList}
        onContinue={() => setForceRender(true)}
      />
    );
  }

  if (nodes.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <NotesEmptyState
          icon="🌐"
          title="Nothing to graph yet"
          sub="Capture a few notes and they'll appear here as a constellation around their books — links you make will draw the threads between them."
          onCapture={onCapture}
        />
      </View>
    );
  }

  const edgeStroke = Math.max(0.3, 0.9 / Math.max(0.5, tx.k));
  const showNoteLabels = tx.k >= 0.9;
  const showHubLabels  = tx.k >= 0.55;

  // Screen-reader fallback. Pan/pinch/tap on an SVG canvas aren't reachable
  // via VoiceOver/TalkBack, so when a reader is active we render a flat,
  // hub-grouped list of every note in the graph. Same node set, same tap
  // → preview behaviour, just navigable linearly.
  if (srEnabled) {
    return (
      <GraphAccessibleList
        nodes={nodes}
        edges={edges}
        notes={notes}
        onEdit={onEdit}
        onDelete={onDelete}
        onStar={onStar}
        onSwitchToList={onSwitchToList}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={gv.legendWrap}>
        <View style={gv.legend}>
          {Object.entries(NT).map(([k, v]) => (
            <View key={k} style={gv.legendItem}>
              <View style={[gv.legendDot, { backgroundColor: typeColor[k] || C.inkMuted }]} />
              <Text style={gv.legendTxt}>{v.label}</Text>
            </View>
          ))}
          <View style={gv.legendItem}>
            <View style={[gv.legendDot, { backgroundColor: OTHER_NOTE_COLOR }]} />
            <Text style={gv.legendTxt}>{OTHER_NOTE_LABEL}</Text>
          </View>
        </View>
      </View>

      <View
        style={gv.canvasWrap}
        onLayout={onCanvasLayout}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <GestureDetector gesture={gesture}>
          <View style={{ width: size.W, height: size.H }} collapsable={false}>
            <Svg width={size.W} height={size.H}>
              <G transform={`translate(${tx.x}, ${tx.y}) scale(${tx.k})`}>
                {edges.map((e, i) => {
                  const a = positionsRef.current[e.s], b = positionsRef.current[e.t];
                  if (!a || !b) return null;
                  // Note→note (linkedNoteIds + wiki-links) edges render in the
                  // accent colour so they read as a knowledge-graph layer
                  // sitting on top of the muted hub→note spokes.
                  const isLink = e.kind === 'link';
                  return (
                    <Line
                      key={`e${i}`}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={isLink ? C.sage : C.inkFaint}
                      strokeWidth={isLink ? edgeStroke + 0.4 : edgeStroke}
                      strokeLinecap="round"
                      opacity={isLink ? 0.7 : 0.55}
                    />
                  );
                })}

                {nodes.filter(n => n.kind === 'hub').map(h => {
                  const p = positionsRef.current[h.id];
                  if (!p) return null;
                  return (
                    <G key={h.id}>
                      <Circle cx={p.x} cy={p.y} r={28} fill={C.ink} opacity={0.06} />
                      <Circle cx={p.x} cy={p.y} r={22} fill={C.ink} opacity={0.09} />
                      <Circle
                        cx={p.x} cy={p.y} r={18}
                        fill={C.ink} stroke={C.paper} strokeWidth={2.5}
                      />
                      <SvgText
                        x={p.x} y={p.y + 4}
                        fill={C.white} fontSize="11" fontWeight="bold"
                        textAnchor="middle"
                      >
                        {h.count}
                      </SvgText>
                      {showHubLabels && (
                        <SvgText
                          x={p.x} y={p.y + 36}
                          fill={C.ink} fontSize="11" fontWeight="bold"
                          textAnchor="middle"
                        >
                          {h.label.length > 22 ? h.label.slice(0, 20) + '…' : h.label}
                        </SvgText>
                      )}
                    </G>
                  );
                })}

                {nodes.filter(n => n.kind === 'note').map(n => {
                  const p = positionsRef.current[n.id];
                  if (!p) return null;
                  const typeKey = (Array.isArray(n.note.types) && n.note.types[0])
                    || n.note.type;
                  const fill = (typeKey && typeColor[typeKey]) || OTHER_NOTE_COLOR;
                  const r = noteRadius(n.note);
                  return (
                    <G key={n.id}>
                      {n.note.starred && (
                        <Circle
                          cx={p.x} cy={p.y} r={r + 4}
                          fill={fill} opacity={0.18}
                        />
                      )}
                      <Circle
                        cx={p.x} cy={p.y} r={r}
                        fill={fill} stroke={C.paper} strokeWidth={1.5}
                      />
                      {showNoteLabels && (
                        <SvgText
                          x={p.x} y={p.y + r + 10}
                          fill={C.inkSoft} fontSize="8.5"
                          textAnchor="middle"
                        >
                          {n.label}
                        </SvgText>
                      )}
                    </G>
                  );
                })}
              </G>
            </Svg>
          </View>
        </GestureDetector>

        <View pointerEvents="none" style={gv.hud}>
          <Ionicons name="search-outline" size={11} color="#FFFFFF" />
          <Text style={gv.hudTxt}>{Math.round(tx.k * 100)}%</Text>
        </View>
        <TouchableOpacity style={gv.resetBtn} onPress={resetView} activeOpacity={0.85}>
          <Ionicons name="contract-outline" size={12} color={C.ink} />
          <Text style={gv.resetTxt}>Reset</Text>
        </TouchableOpacity>
        {hintVisible && (
          <View pointerEvents="none" style={gv.hint}>
            <Text style={gv.hintTxt}>Drag to pin · pinch · pan · Reset to unpin</Text>
          </View>
        )}
      </View>

      {previewNote && (
        <View style={gv.previewBackdrop}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setPreviewNote(null)}
          />
          <View style={gv.previewCardWrap}>
            <NoteCard
              note={previewNote}
              onEdit={(n) => {
                setPreviewNote(null);
                onEdit?.(n);
              }}
              onDelete={(id) => {
                setPreviewNote(null);
                onDelete?.(id);
              }}
              onStar={onStar}
              showBook
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ── Accessible fallback ────────────────────────────────────────────────
// Plain hub→notes list rendered when a screen reader is active. Each hub
// (book or type) becomes a section header; tapping a note row routes to
// the same `onEdit` handler the graph node tap would use, so the reader
// gets the full editing flow without ever touching the SVG canvas.
function GraphAccessibleList({ nodes, edges, notes, onEdit, onDelete, onStar, onSwitchToList }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: { flex: 1, backgroundColor: C.paper },
    banner: {
      paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6,
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    bannerTxt: {
      flex: 1, fontFamily: F.serif, fontSize: 12, color: C.inkMuted,
      lineHeight: 18,
    },
    switchBtn: {
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: 999, backgroundColor: C.cream,
      borderWidth: 0.5, borderColor: C.border,
    },
    switchTxt: { fontFamily: F.serif, fontSize: 12, color: C.ink, fontWeight: '600' },
    section: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
    hubLabel: {
      fontFamily: F.sans, fontSize: 11, fontWeight: '700',
      color: C.inkMuted, letterSpacing: 1.2,
    },
    hubCount: {
      fontFamily: F.sans, fontSize: 11, fontWeight: '700',
      color: C.inkFaint, letterSpacing: 0.6, marginTop: 2,
    },
    row: {
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    rowTitle: { fontFamily: F.serif, fontSize: 15, color: C.ink, letterSpacing: -0.2 },
    rowSub: { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginTop: 3 },
  }), [themeVersion]);

  // Group note nodes by their hub edge (kind:'hub').
  const groups = useMemo(() => {
    const hubs = nodes.filter(n => n.kind === 'hub');
    const childMap = {};
    edges.forEach(e => {
      if (e.kind === 'hub') (childMap[e.s] = childMap[e.s] || []).push(e.t);
    });
    return hubs.map(h => {
      const childIds = childMap[h.id] || [];
      const items = childIds
        .map(cid => nodes.find(n => n.id === cid))
        .filter(n => n && n.kind === 'note');
      return { hub: h, items };
    }).filter(g => g.items.length > 0);
  }, [nodes, edges]);

  return (
    <View style={s.wrap}>
      <View style={s.banner} accessibilityLiveRegion="polite">
        <Text style={s.bannerTxt}>
          Graph is shown as a list while a screen reader is active.
        </Text>
        {onSwitchToList ? (
          <TouchableOpacity
            style={s.switchBtn}
            onPress={onSwitchToList}
            accessibilityRole="button"
            accessibilityLabel="Switch to the list view"
            activeOpacity={0.7}
          >
            <Text style={s.switchTxt}>List view</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View
        style={{ flex: 1 }}
        accessibilityRole="list"
        accessibilityLabel="Notes grouped by hub"
      >
        {groups.map(g => (
          <View key={g.hub.id}>
            <View
              style={s.section}
              accessibilityRole="header"
              accessibilityLabel={`${g.hub.label}, ${g.items.length} note${g.items.length === 1 ? '' : 's'}`}
            >
              <Text style={s.hubLabel}>{g.hub.label.toUpperCase()}</Text>
              <Text style={s.hubCount}>{g.items.length} note{g.items.length === 1 ? '' : 's'}</Text>
            </View>
            {g.items.map(item => {
              const n = item.note;
              const head = (n.title?.trim()) || (n.text || '').split('\n')[0]?.slice(0, 80) || 'Untitled';
              const sub = [n.bookTitle, n.chapter ? `Ch. ${n.chapter}` : null].filter(Boolean).join(' · ');
              return (
                <TouchableOpacity
                  key={item.id}
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => onEdit?.(n)}
                  accessibilityRole="button"
                  accessibilityLabel={head + (sub ? `, ${sub}` : '')}
                  accessibilityHint="Opens the note"
                  accessibilityActions={[{ name: 'delete', label: 'Delete note' }]}
                  onAccessibilityAction={(e) => {
                    if (e.nativeEvent.actionName === 'delete') onDelete?.(n.id);
                  }}
                >
                  <Text style={s.rowTitle} numberOfLines={2}>{head}</Text>
                  {sub ? <Text style={s.rowSub} numberOfLines={1}>{sub}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// Interstitial shown when the library is larger than the soft note cap.
// Two-button choice: jump to List (safe default) or render the graph anyway
// (user accepts the layout pause). Reset is per-mount, not persisted —
// re-confirming costs one tap and avoids "why is the graph frozen" surprise
// next session.
function GraphGateInterstitial({ count, limit, onSwitchToList, onContinue }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    wrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: 30, gap: 14,
    },
    icon: { fontSize: 40, marginBottom: 4 },
    title: {
      fontFamily: F.serif, fontSize: 18, color: C.ink, textAlign: 'center',
    },
    sub: {
      fontFamily: F.serif, fontSize: 13, color: C.inkMuted,
      textAlign: 'center', lineHeight: 20,
    },
    primary: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: C.sage,
      paddingHorizontal: 18, paddingVertical: 11,
      borderRadius: 14,
      shadowColor: '#000', shadowOpacity: 0.1,
      shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2,
    },
    primaryTxt: {
      fontFamily: F.serif, fontSize: 14, color: '#FFFFFF',
      fontWeight: '700', letterSpacing: 0.2,
    },
    secondary: { paddingHorizontal: 14, paddingVertical: 8 },
    secondaryTxt: {
      fontFamily: F.serif, fontSize: 13, color: C.inkSoft, fontWeight: '600',
    },
  }), [themeVersion]);

  return (
    <View style={s.wrap}>
      <Text style={s.icon}>🌐</Text>
      <Text style={s.title}>Graph paused at {count} notes</Text>
      <Text style={s.sub}>
        Rendering the constellation past {limit} notes can briefly hang the app
        while the layout settles. List view is faster and easier to scan.
      </Text>
      {onSwitchToList && (
        <TouchableOpacity
          style={s.primary}
          onPress={onSwitchToList}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Switch to list view"
        >
          <Ionicons name="list" size={16} color="#FFFFFF" importantForAccessibility="no" />
          <Text style={s.primaryTxt}>Switch to list</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={s.secondary}
        onPress={onContinue}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Render the graph anyway"
      >
        <Text style={s.secondaryTxt}>Render anyway</Text>
      </TouchableOpacity>
    </View>
  );
}
