import React, { createContext, useContext, useState } from 'react';
import { genId } from './schema';

const StoreContext = createContext(null);

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

export function StoreProvider({ children }) {
  const [books, setBooks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [goals, setGoals] = useState([]);
  const [goalCompletions, setGoalCompletions] = useState([]);
  const [activeDays, setActiveDays] = useState([]);
  const [reflections, setReflections] = useState([]);
  const [user, setUser] = useState(DEFAULT_USER);

  // ── Books ────────────────────────────────────────────────────────
  const addBook    = (book)  => setBooks(b => [book, ...b]);
  const updateBook = (id, patch) => setBooks(b => b.map(x => x.id===id ? {...x,...patch} : x));
  const removeBook = (id)    => setBooks(b => b.filter(x => x.id!==id));

  // ── Notes ────────────────────────────────────────────────────────
  const addNote    = (note)  => setNotes(n => [note, ...n]);
  const updateNote = (id, patch) => setNotes(n => n.map(x => x.id===id ? {...x,...patch} : x));
  const deleteNote = (id)    => setNotes(n => n.filter(x => x.id!==id));

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
  const bookNotes    = (bookId) => notes.filter(n => n.bookId===bookId);
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

  // ── User profile + auth ──────────────────────────────────────────
  // Patch the user object (e.g. updateUser({ name: 'Julian' }))
  const updateUser = (patch) => setUser(u => ({ ...u, ...patch }));

  // Logout — instantly clears user identity. Library/notes/reflections
  // are preserved (per user choice — no wipe on logout). App.js routes
  // back to the LoginScreen when user.name becomes empty.
  const logout = () => setUser(DEFAULT_USER);

  return (
    <StoreContext.Provider value={{
      books, notes, goals, goalCompletions, reflections,
      activeDays, currentStreak,
      currentBook, readingBooks,
      user, updateUser, logout,
      addBook, updateBook, removeBook,
      addNote, updateNote, deleteNote,
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