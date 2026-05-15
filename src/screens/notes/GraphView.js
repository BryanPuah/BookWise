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
  View, TouchableOpacity, StyleSheet, Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import Svg, { Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { AppText as Text } from '../../components/AppText';
import { useTheme, NOTE_TYPE_COLORS } from '../../theme';
import { NoteCard } from './NoteCard';
import { NT, noteHasType } from './shared';

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

export function GraphView({ notes, books, onEdit }) {
  const { C, F, themeVersion } = useTheme();
  const [groupBy, setGroupBy] = useState('book'); // 'book' | 'type'
  const [previewNote, setPreviewNote] = useState(null); // tapped node → overlay card

  const win = Dimensions.get('window');
  const [size, setSize] = useState({ W: win.width, H: Math.max(420, win.height - 360) });

  const onCanvasLayout = (ev) => {
    const { width, height } = ev.nativeEvent.layout;
    if (width > 0 && height > 0 && (width !== size.W || height !== size.H)) {
      setSize({ W: width, H: height });
    }
  };

  const gv = useMemo(() => StyleSheet.create({
    toggleStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
    toggle: {
      flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
      borderColor: C.border, backgroundColor: C.cream, alignItems: 'center',
    },
    toggleActive: { backgroundColor: C.ink, borderColor: C.ink },
    toggleTxt: { fontFamily: F.serif, fontSize: 13, fontWeight: '600', color: C.inkSoft },
    toggleTxtActive: { color: C.white },

    legend: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 10,
      paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, justifyContent: 'center',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    legendTxt: { fontFamily: F.serif, fontSize: 10, color: C.inkMuted, fontWeight: '600' },

    previewBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(20, 22, 30, 0.45)',
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    previewCardWrap: { maxWidth: 460, width: '100%', alignSelf: 'center' },

    canvasWrap: {
      flex: 1, marginHorizontal: 12, marginTop: 4,
      borderRadius: 14, overflow: 'hidden',
      backgroundColor: C.cream,
      borderWidth: 0.5, borderColor: C.border,
    },

    hud: {
      position: 'absolute', top: 10, right: 10,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    },
    hudTxt: { color: C.white, fontFamily: F.serif, fontSize: 11, fontWeight: '600' },

    resetBtn: {
      position: 'absolute', top: 10, left: 10,
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: C.white,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 8, borderWidth: 0.5, borderColor: C.border,
    },
    resetTxt: { fontFamily: F.serif, fontSize: 11, color: C.ink, fontWeight: '600' },

    empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 30 },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: F.serif, fontSize: 18, color: C.ink, marginBottom: 6 },
    emptySub: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
  }), [themeVersion]);

  const typeColor = NOTE_TYPE_COLORS;

  const { nodes, edges } = useMemo(() => {
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
    }
    const N = [], E = [];
    groups.forEach(g => {
      N.push({ id: g.id, kind: 'hub', label: g.label, count: g.notes.length });
      g.notes.forEach(n => {
        const nid = `${g.id}::n:${n.id}`;
        N.push({ id: nid, kind: 'note', note: n, label: noteShortLabel(n) });
        E.push({ s: g.id, t: nid });
      });
    });
    return { nodes: N, edges: E };
  }, [notes, books, groupBy]);

  // ── Live force-directed simulation ──────────────────────────────────
  // Positions live in a ref so the rAF loop can mutate them at 60fps
  // without churning React state. A small tick counter forces re-renders
  // when something actually moved.
  const positionsRef = useRef({});
  const draggingRef  = useRef(null);
  const rafRef       = useRef(0);
  const [, setTick]  = useState(0);
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

  const beginRef = useRef({ x: 0, y: 0 });
  const panG = useMemo(() => Gesture.Pan()
    .minDistance(4)
    .onBegin(e => { beginRef.current = { x: e.x, y: e.y }; })
    .onStart(() => {
      savedRef.current = txRef.current;
      const t = txRef.current;
      const bx = beginRef.current.x, by = beginRef.current.y;
      const gx = (bx - t.x) / t.k;
      const gy = (by - t.y) / t.k;
      let bestId = null, bestD = Infinity;
      for (const n of nodes) {
        const p = positionsRef.current[n.id];
        if (!p) continue;
        const d = Math.hypot(gx - p.x, gy - p.y);
        const baseR = n.kind === 'hub' ? 18 : noteRadius(n.note);
        const hitR  = baseR + 16 / Math.max(0.4, t.k);
        if (d < hitR && d < bestD) { bestD = d; bestId = n.id; }
      }
      if (bestId) {
        const p = positionsRef.current[bestId];
        draggingRef.current = { id: bestId, ox: gx - p.x, oy: gy - p.y, gx: p.x, gy: p.y };
        wakeLoop();
      } else {
        draggingRef.current = null;
      }
    })
    .onUpdate(e => {
      const drag = draggingRef.current;
      const t = txRef.current;
      if (drag) {
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
      draggingRef.current = null;
      wakeLoop();
    })
    .onFinalize(() => {
      draggingRef.current = null;
    }),
  [nodes]);

  const pinchG = useMemo(() => Gesture.Pinch()
    .onStart(e => {
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
    .maxDistance(8)
    .onEnd((e, success) => {
      if (!success) return;
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

  const gesture = useMemo(
    () => Gesture.Simultaneous(tapG, panG, pinchG),
    [tapG, panG, pinchG]
  );

  const resetView = () => {
    const r = { x: 0, y: 0, k: 1 };
    setTx(r); savedRef.current = r;
  };

  if (nodes.length === 0) {
    return (
      <View style={{ flex: 1 }}>
        <View style={gv.toggleStrip}>
          <TouchableOpacity style={[gv.toggle, groupBy === 'book' && gv.toggleActive]}
            onPress={() => setGroupBy('book')} activeOpacity={0.8}>
            <Text style={[gv.toggleTxt, groupBy === 'book' && gv.toggleTxtActive]}>By Book</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[gv.toggle, groupBy === 'type' && gv.toggleActive]}
            onPress={() => setGroupBy('type')} activeOpacity={0.8}>
            <Text style={[gv.toggleTxt, groupBy === 'type' && gv.toggleTxtActive]}>By Type</Text>
          </TouchableOpacity>
        </View>
        <View style={gv.empty}>
          <Text style={gv.emptyIcon}>🌐</Text>
          <Text style={gv.emptyTitle}>Nothing to graph yet</Text>
          <Text style={gv.emptySub}>Capture a few notes and they'll appear here as a constellation around their books.</Text>
        </View>
      </View>
    );
  }

  const edgeStroke = Math.max(0.3, 0.9 / Math.max(0.5, tx.k));
  const showNoteLabels = tx.k >= 0.9;
  const showHubLabels  = tx.k >= 0.55;

  return (
    <View style={{ flex: 1 }}>
      <View style={gv.toggleStrip}>
        <TouchableOpacity style={[gv.toggle, groupBy === 'book' && gv.toggleActive]}
          onPress={() => setGroupBy('book')} activeOpacity={0.8}>
          <Text style={[gv.toggleTxt, groupBy === 'book' && gv.toggleTxtActive]}>By Book</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[gv.toggle, groupBy === 'type' && gv.toggleActive]}
          onPress={() => setGroupBy('type')} activeOpacity={0.8}>
          <Text style={[gv.toggleTxt, groupBy === 'type' && gv.toggleTxtActive]}>By Type</Text>
        </TouchableOpacity>
      </View>

      <View style={gv.legend}>
        {Object.entries(NT).map(([k, v]) => (
          <View key={k} style={gv.legendItem}>
            <View style={[gv.legendDot, { backgroundColor: typeColor[k] || C.inkMuted }]} />
            <Text style={gv.legendTxt}>{v.label}</Text>
          </View>
        ))}
      </View>

      <View style={gv.canvasWrap} onLayout={onCanvasLayout}>
        <GestureDetector gesture={gesture}>
          <View style={{ width: size.W, height: size.H }} collapsable={false}>
            <Svg width={size.W} height={size.H}>
              <G transform={`translate(${tx.x}, ${tx.y}) scale(${tx.k})`}>
                {edges.map((e, i) => {
                  const a = positionsRef.current[e.s], b = positionsRef.current[e.t];
                  if (!a || !b) return null;
                  return (
                    <Line
                      key={`e${i}`}
                      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={C.border}
                      strokeWidth={edgeStroke}
                      opacity={0.7}
                    />
                  );
                })}

                {nodes.filter(n => n.kind === 'hub').map(h => {
                  const p = positionsRef.current[h.id];
                  if (!p) return null;
                  return (
                    <G key={h.id}>
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
                          x={p.x} y={p.y + 34}
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
                    || n.note.type || 'insight';
                  const fill = typeColor[typeKey] || C.inkMuted;
                  const r = noteRadius(n.note);
                  return (
                    <G key={n.id}>
                      <Circle
                        cx={p.x} cy={p.y} r={r}
                        fill={fill} stroke={C.paper} strokeWidth={1.5}
                      />
                      {showNoteLabels && (
                        <SvgText
                          x={p.x} y={p.y + r + 9}
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
          <Text style={gv.hudTxt}>{Math.round(tx.k * 100)}%</Text>
        </View>
        <TouchableOpacity style={gv.resetBtn} onPress={resetView} activeOpacity={0.85}>
          <Ionicons name="contract-outline" size={12} color={C.ink} />
          <Text style={gv.resetTxt}>Reset</Text>
        </TouchableOpacity>
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
              onEdit={() => setPreviewNote(null)}
              onDelete={() => setPreviewNote(null)}
              showBook
            />
          </View>
        </View>
      )}
    </View>
  );
}
