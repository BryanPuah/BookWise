import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { genId } from './schema';

const StoreContext = createContext(null);

// ── Persistence ──────────────────────────────────────────────────────
// Hydrate from AsyncStorage on mount, debounced write-through on every
// mutation. Keys are versioned so a future schema change can migrate
// rather than silently break.
//
// Scope (chosen 2026-05-17): notes, books, goals, goalCompletions,
// reflections, activeDays, user. Tags are nested inside notes so they
// piggyback on the notes key. Toasts are ephemeral — not persisted.
const STORAGE_KEYS = {
  notes:           'bw.v1.notes',
  books:           'bw.v1.books',
  goals:           'bw.v1.goals',
  goalCompletions: 'bw.v1.goalCompletions',
  reflections:     'bw.v1.reflections',
  activeDays:      'bw.v1.activeDays',
  user:            'bw.v1.user',
};

async function loadJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`[store] failed to load ${key}`, e);
    return fallback;
  }
}

// Goal recurrence types:
//   'daily'   — show every day
//   'weekly'  — show on weekday N (0=Sun..6=Sat)
//   'monthly' — show on day-of-month N (1..31)
//   'once'    — show only on dueDate (YYYY-MM-DD)

// Local-date "YYYY-MM-DD" — must match the user's calendar day. Using
// toISOString() here would slice the UTC date, which is off by one for any
// timezone outside UTC (notes get saved under tomorrow's or yesterday's
// key, then never show up in today's timeline pill).
const fmtLocalKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const todayKey = () => fmtLocalKey(new Date());
const daysAgoKey = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtLocalKey(d);
};

// ── User profile ─────────────────────────────────────────────────────
// Single signed-in user (no multi-account). Shape:
//   { name: string, email: string, avatarSeed: string, hasOnboarded: bool }
// `avatarSeed` is a stable string we hand to the avatar source (DiceBear
// API) so the same user always gets the same rendered avatar. Empty user
// (`name === ''`) means "not logged in" — App.js routes to LoginScreen.
// `hasOnboarded` gates the post-login name-confirm screen; logout resets
// it so a new account on the same device walks through onboarding again.
const DEFAULT_USER = { name: '', email: '', avatarSeed: '', hasOnboarded: false };

// ── Trash ────────────────────────────────────────────────────────────
// Soft-delete window in milliseconds. A note that has been trashed for
// longer than this is auto-purged the next time the store hydrates.
// Surfaced as a constant so the Trash view can echo the same number in
// its hint copy without drift.
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function StoreProvider({ children }) {
  const [books, setBooks] = useState([]);
  // Internal `notes` state holds the full list including trashed items;
  // consumers read `notes` from context which is the live (non-trashed)
  // subset. This keeps the persisted shape identical for trashed +
  // active notes and lets retention purging happen with a single filter.
  const [notes, setNotes] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalCompletions, setGoalCompletions] = useState([]);
  const [activeDays, setActiveDays] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [user, setUser] = useState(DEFAULT_USER);
  const [toasts, setToasts] = useState([]);

  // `hydrated` flips true once the on-disk slices have been loaded into
  // state. Consumers (App.js) gate first paint on this so the empty default
  // state doesn't flash, and write-through effects key off it so the
  // initial defaults can't overwrite saved data before hydration finishes.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [n, b, g, gc, r, ad, u] = await Promise.all([
        loadJSON(STORAGE_KEYS.notes,           []),
        loadJSON(STORAGE_KEYS.books,           []),
        loadJSON(STORAGE_KEYS.goals,           []),
        loadJSON(STORAGE_KEYS.goalCompletions, []),
        loadJSON(STORAGE_KEYS.reflections,     []),
        loadJSON(STORAGE_KEYS.activeDays,      []),
        loadJSON(STORAGE_KEYS.user,            DEFAULT_USER),
      ]);
      if (cancelled) return;
      // Hydration-time purge: drop any trashed notes whose deletedAt
      // timestamp is older than the retention window. Notes without a
      // valid timestamp (legacy or corrupted entries) are kept as-is
      // so a missing field can't accidentally evict data — they'd be
      // visible in the Trash view and the user can purge them by hand.
      const loadedNotes = Array.isArray(n) ? n : [];
      const cutoff = Date.now() - TRASH_RETENTION_MS;
      const survivors = loadedNotes.filter(x => {
        if (!x?.trashed) return true;
        const t = Date.parse(x.deletedAt || '');
        if (Number.isNaN(t)) return true;
        return t >= cutoff;
      });
      setNotes(survivors);
      setBooks(Array.isArray(b) ? b : []);
      setGoals(Array.isArray(g) ? g : []);
      setGoalCompletions(Array.isArray(gc) ? gc : []);
      setReflections(Array.isArray(r) ? r : []);
      setActiveDays(Array.isArray(ad) ? ad : []);
      setUser(u && typeof u === 'object' ? { ...DEFAULT_USER, ...u } : DEFAULT_USER);
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced write-through. One timer per key — coalesces rapid mutations
  // (e.g. typing in the editor) into a single AsyncStorage write.
  const writeTimersRef = useRef({});
  const writeJSON = (key, value) => {
    clearTimeout(writeTimersRef.current[key]);
    writeTimersRef.current[key] = setTimeout(() => {
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(e => {
        console.warn(`[store] failed to write ${key}`, e);
      });
    }, 250);
  };

  useEffect(() => { if (hydrated) writeJSON(STORAGE_KEYS.notes,           notes);           }, [notes,           hydrated]);
  useEffect(() => { if (hydrated) writeJSON(STORAGE_KEYS.books,           books);           }, [books,           hydrated]);
  useEffect(() => { if (hydrated) writeJSON(STORAGE_KEYS.goals,           goals);           }, [goals,           hydrated]);
  useEffect(() => { if (hydrated) writeJSON(STORAGE_KEYS.goalCompletions, goalCompletions); }, [goalCompletions, hydrated]);
  useEffect(() => { if (hydrated) writeJSON(STORAGE_KEYS.reflections,     reflections);     }, [reflections,     hydrated]);
  useEffect(() => { if (hydrated) writeJSON(STORAGE_KEYS.activeDays,      activeDays);      }, [activeDays,      hydrated]);
  useEffect(() => { if (hydrated) writeJSON(STORAGE_KEYS.user,            user);            }, [user,            hydrated]);

  // ── Books ────────────────────────────────────────────────────────
  const addBook    = (book)  => setBooks(b => [book, ...b]);
  const updateBook = (id, patch) => setBooks(b => b.map(x => x.id===id ? {...x,...patch} : x));
  const removeBook = (id)    => setBooks(b => b.filter(x => x.id!==id));

  // ── Notes ────────────────────────────────────────────────────────
  // `addNote` normalizes the payload — fills in id/date/starred, derives the
  // primary `type` and `isQuote` from `types[]`, and defends array fields.
  // Callers (FAB, NotesScreen, BookDetailScreen) used to do this inline and
  // had drifted; centralizing here keeps the on-disk shape consistent.
  // Existing id/date are preserved so an "edit-of-deleted-note" re-add keeps
  // the original identity.
  const addNote = (data) => {
    const types = data.types?.length
      ? data.types
      : (data.type ? [data.type] : ['insight']);
    const primaryType = data.type || types[0];
    const note = {
      id:            data.id   || genId('n'),
      date:          data.date || todayKey(),
      bookId:        data.bookId,
      bookTitle:     data.bookTitle,
      title:         data.title || '',
      blocks:        data.blocks || [],
      types,
      type:          primaryType,
      text:          data.text || '',
      thinking:      data.thinking || '',
      page:          data.page || '',
      chapter:       data.chapter || '',
      tags:          Array.isArray(data.tags) ? data.tags : [],
      linkedNoteIds: Array.isArray(data.linkedNoteIds) ? data.linkedNoteIds : [],
      isQuote:       primaryType === 'quote',
      starred:       data.starred ?? false,
      // Defensive: re-adds from edit-mid-purge flows might spread an old
      // note object that still carries `trashed`/`deletedAt`. Explicitly
      // clear so a re-added note never lands invisible in the trash slice.
      trashed:       false,
      deletedAt:     undefined,
    };
    setNotes(n => [note, ...n]);
  };
  const updateNote = (id, patch) => setNotes(n => n.map(x => x.id===id ? {...x,...patch} : x));

  // Soft-delete. Sets `trashed: true` + a timestamp so the auto-purge on
  // the next hydration can drop the entry after the retention window.
  // Hard-deletion is intentionally separate (`purgeNote`) so the swipe
  // gesture can keep firing this without surprising the user.
  const deleteNote = (id) => setNotes(n => n.map(x => (
    x.id === id ? { ...x, trashed: true, deletedAt: new Date().toISOString() } : x
  )));

  // Restore a trashed note. Clears the trashed flag and timestamp so it
  // re-appears in the active list. No-op if the note doesn't exist.
  const restoreNote = (id) => setNotes(n => n.map(x => (
    x.id === id ? { ...x, trashed: false, deletedAt: undefined } : x
  )));

  // Hard-delete (skip trash). Used by the Trash view's "Delete forever"
  // affordance and the future auto-purge timer.
  const purgeNote = (id) => setNotes(n => n.filter(x => x.id !== id));

  // Hard-delete every trashed note. Surfaced via the Trash view's
  // "Empty Trash" affordance.
  const purgeAllTrashed = () => setNotes(n => n.filter(x => !x.trashed));

  // Delete-with-undo. Now routes through the soft-delete path: the note
  // stays in storage with `trashed: true`, and Undo just clears the
  // flag. Toast copy and gesture stay identical to the old hard-delete
  // flow so the user-facing contract is unchanged.
  const deleteNoteWithUndo = (id) => {
    const exists = notes.some(n => n.id === id);
    if (!exists) return;
    deleteNote(id);
    showToast({
      message: 'Note moved to Trash',
      action: {
        label: 'Undo',
        onPress: () => restoreNote(id),
      },
    });
  };

  // ── Notes — live + trashed views ─────────────────────────────────
  // `liveNotes` is what every screen renders; `trashedNotes` powers the
  // Trash pivot. The underlying state holds both so a single AsyncStorage
  // write keeps both subsets persistent.
  const liveNotes = useMemo(() => notes.filter(n => !n.trashed), [notes]);
  const trashedNotes = useMemo(
    () => notes
      .filter(n => n.trashed)
      .sort((a, b) => (Date.parse(b.deletedAt || '') || 0) - (Date.parse(a.deletedAt || '') || 0)),
    [notes],
  );

  // ── Notes — derived indexes ──────────────────────────────────────
  // `noteById` and `backlinkIndex` are memoized off `liveNotes` so NoteCard
  // can resolve references without scanning the whole array per render. The
  // backlink scan walks each note once and records every `[[title]]` mention,
  // so a render that touches K visible cards drops from O(K·N²) to O(K·1)
  // lookups against a precomputed Map. Trashed notes are intentionally
  // excluded so a recovered link doesn't point at a deleted note.
  const noteById = useMemo(() => {
    const m = new Map();
    for (const n of liveNotes) m.set(n.id, n);
    return m;
  }, [liveNotes]);

  const backlinkIndex = useMemo(() => {
    const m = new Map();
    const WIKI = /\[\[([^\]]+)\]\]/g;
    for (const n of liveNotes) {
      const hay = `${n.title || ''} ${n.text || ''}`;
      WIKI.lastIndex = 0;
      let match;
      while ((match = WIKI.exec(hay)) !== null) {
        const title = match[1].trim().toLowerCase();
        if (!title) continue;
        let set = m.get(title);
        if (!set) { set = new Set(); m.set(title, set); }
        set.add(n.id);
      }
    }
    return m;
  }, [liveNotes]);

  // ── Goals (templates) ────────────────────────────────────────────
  const addGoal    = (goal)  => setGoals(g => [goal, ...g]);
  const updateGoal = (id, patch) => setGoals(g => g.map(x => x.id===id ? {...x,...patch} : x));
  const removeGoal = (id)    => {
    setGoals(g => g.filter(x => x.id!==id));
    // Also remove all completion entries for this goal (orphan cleanup)
    setGoalCompletions(c => c.filter(x => x.goalId !== id));
  };

  // ── Goal completions ─────────────────────────────────────────────
  // Toggle completion of a goal on a specific date.
  const toggleGoalCompletion = (goalId, date) => {
    setGoalCompletions(c => {
      const existing = c.find(x => x.goalId === goalId && x.date === date);
      if (existing) return c.filter(x => x !== existing);
      return [...c, { goalId, date, completedAt: new Date().toISOString() }];
    });
  };

  // Check completion for a (goalId, date)
  const isGoalCompletedOn = (goalId, date) =>
    goalCompletions.some(x => x.goalId === goalId && x.date === date);

  // All completions for a given date — useful for the DayPanel
  const goalCompletionsOn = (date) =>
    goalCompletions.filter(x => x.date === date);

  // Return the goals that should appear on a given date (YYYY-MM-DD).
  // Filters by recurrence type — daily always shows, weekly matches weekday,
  // monthly matches day-of-month, once matches the explicit dueDate.
  // Also respects the goal's created date so it never appears before it existed.
  const goalsForDate = (dateKey) => {
    if (!dateKey) return [];
    const d = new Date(dateKey + 'T00:00:00');
    if (isNaN(d.getTime())) return [];
    const weekday  = d.getDay();
    const monthDay = d.getDate();

    // Days in this month — used to "spill" goals dated past the end of
    // shorter months onto the last day. A 31st-of-month goal should fire
    // on Feb 28 / Apr 30, not silently disappear in those months.
    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

    return goals.filter(g => {
      // Don't show goals dated before they were created
      if (g.created && dateKey < g.created) return false;

      switch (g.recurrence) {
        case 'daily':   return true;
        case 'weekly':  return g.weekday === weekday;
        case 'monthly': {
          if (typeof g.monthDay !== 'number') return false;
          const target = Math.min(g.monthDay, lastDayOfMonth);
          return monthDay === target;
        }
        case 'once':    return g.dueDate === dateKey;
        default:        return true; // legacy goals (no recurrence) treat as daily
      }
    });
  };

  // ── Derived ──────────────────────────────────────────────────────
  // Trashed notes are excluded so book detail screens don't surface them
  // until they're restored.
  const bookNotes    = (bookId) => liveNotes.filter(n => n.bookId===bookId);
  const readingBooks = books.filter(b => b.status==='reading');
  const currentBook  = readingBooks[0] || null;

  // ── Active days & streak ─────────────────────────────────────────────
  // Mark a date as active. No-op if already marked. Called once per app
  // launch from App.js to record that the user opened the app today.
  const markDayActive = (date = todayKey()) => {
    setActiveDays(days => (days.includes(date) ? days : [...days, date]));
  };

  // Current streak — consecutive days ending today or yesterday.
  // If user opened the app today, includes today. If they didn't open
  // today but did yesterday, the streak still counts from yesterday
  // (grace period — they can still extend it by opening today).
  // If neither today nor yesterday are active, streak is 0.
  const currentStreak = (() => {
    if (activeDays.length === 0) return 0;
    const set = new Set(activeDays);
    const today = todayKey();
    const yesterday = daysAgoKey(1);

    // Determine starting point — today if active, else yesterday if active
    let start;
    if (set.has(today))         start = today;
    else if (set.has(yesterday)) start = yesterday;
    else return 0;

    // Walk backward from start, counting consecutive days. Use local-date
    // keys so the comparison aligns with how markDayActive writes them.
    let count = 0;
    let d = new Date(start + 'T00:00:00');
    while (true) {
      const key = fmtLocalKey(d);
      if (!set.has(key)) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  // ── Reflections ──────────────────────────────────────────────────────
  // One reflection per date. Look up by date key.
  const reflectionForDate = (date) =>
    reflections.find(r => r.date === date) || null;

  // Upsert today's (or any date's) reflection. If text is empty after trim,
  // we delete the entry entirely so the section returns to "Write today's
  // reflection" prompt state.
  const upsertReflection = (date, text) => {
    const trimmed = (text || '').trim();
    const existing = reflections.find(r => r.date === date);

    if (!trimmed) {
      // Empty save → delete if it existed
      if (existing) {
        setReflections(rs => rs.filter(r => r.date !== date));
      }
      return;
    }

    if (existing) {
      setReflections(rs =>
        rs.map(r => r.date === date
          ? { ...r, text: trimmed, updatedAt: new Date().toISOString() }
          : r,
        ),
      );
    } else {
      setReflections(rs => [...rs, {
        id: genId('r'),
        date,
        text: trimmed,
        updatedAt: new Date().toISOString(),
      }]);
    }
  };

  const deleteReflection = (date) => {
    setReflections(rs => rs.filter(r => r.date !== date));
  };

  // ── Toasts ───────────────────────────────────────────────────────
  // Lightweight notification queue. `showToast` returns the id so callers
  // can dismiss early; auto-dismiss fires after `duration`. Multiple toasts
  // stack — the host renders only the most recent so they don't pile up.
  const showToast = ({ message, action, duration = 4500 } = {}) => {
    if (!message) return null;
    const id = genId('t');
    setToasts(t => [...t, { id, message, action }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, duration);
    return id;
  };
  const dismissToast = (id) => {
    setToasts(t => t.filter(x => x.id !== id));
  };

  // ── User profile + auth ──────────────────────────────────────────
  // Patch the user object (e.g. updateUser({ name: 'Julian' }))
  const updateUser = (patch) => setUser(u => ({ ...u, ...patch }));

  // Logout — instantly clears user identity. Library/notes/reflections
  // are preserved (per user choice — no wipe on logout). App.js routes
  // back to the LoginScreen when user.name becomes empty.
  const logout = () => setUser(DEFAULT_USER);

  return (
    <StoreContext.Provider value={{
      hydrated,
      books,
      // `notes` is intentionally the live (non-trashed) subset so every
      // existing consumer keeps reading the same shape it always has.
      // Callers that want the trash explicitly use `trashedNotes` and
      // the trash mutations below.
      notes: liveNotes, trashedNotes,
      goals, goalCompletions, reflections,
      activeDays, currentStreak,
      currentBook, readingBooks,
      user, updateUser, logout,
      addBook, updateBook, removeBook,
      addNote, updateNote, deleteNote, deleteNoteWithUndo,
      restoreNote, purgeNote, purgeAllTrashed,
      noteById, backlinkIndex,
      toasts, showToast, dismissToast,
      addGoal, updateGoal, removeGoal,
      toggleGoalCompletion, isGoalCompletedOn, goalCompletionsOn,
      goalsForDate, markDayActive,
      reflectionForDate, upsertReflection, deleteReflection,
      bookNotes,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);