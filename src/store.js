import React, { createContext, useContext, useState } from 'react';

const StoreContext = createContext(null);

const DEMO_BOOKS = [
  { id:'1', title:'Thinking, Fast and Slow', author:'Daniel Kahneman',
    description:'A groundbreaking tour of the mind explaining the two systems that drive the way we think. System 1 is fast and intuitive; System 2 is slow and deliberate.',
    pageCount:400, currentPage:248, status:'reading', cover:'sage',
    genres:['Psychology','Economics'], year:'2011', rating:4,
    added:'2025-03-01' },
  { id:'2', title:'Atomic Habits', author:'James Clear',
    description:'Tiny changes, remarkable results. A proven framework for building good habits and breaking bad ones through the power of compounding.',
    pageCount:320, currentPage:320, status:'finished', cover:'navy',
    genres:['Self-Development'], year:'2018', rating:5,
    added:'2025-01-10' },
  { id:'3', title:'Deep Work', author:'Cal Newport',
    description:'Rules for focused success in a distracted world. The ability to focus without distraction on cognitively demanding tasks.',
    pageCount:304, currentPage:0, status:'want_to_read', cover:'plum',
    genres:['Productivity'], year:'2016', added:'2025-04-01' },
];

const DEMO_NOTES = [
  { id:'n1', bookId:'1', bookTitle:'Thinking, Fast and Slow',
    text:'"The confidence people have in their intuitions is not a reliable guide to their validity."',
    isQuote:true, page:148, date:'2025-05-03' },
  { id:'n2', bookId:'1', bookTitle:'Thinking, Fast and Slow',
    text:'System 1 is fast and automatic. System 2 is slow and deliberate. Most errors come from System 1 overriding System 2.',
    isQuote:false, page:24, date:'2025-04-28' },
  { id:'n3', bookId:'2', bookTitle:'Atomic Habits',
    text:'A 1% improvement every day compounds to 37x better in a year. Small habits matter enormously over time.',
    isQuote:false, page:37, date:'2025-04-18' },
];

const DEMO_CARDS = [];

// ── Goals (with flexible recurrence) ─────────────────────────────────
// recurrence: 'daily' | 'weekly' | 'monthly' | 'once'
//   daily    — show every day
//   weekly   — show on weekday N (0=Sun..6=Sat)
//   monthly  — show on day-of-month N (1..31)
//   once     — show only on dueDate (YYYY-MM-DD)
const DEMO_GOALS = [
  { id:'g1', label:'Read 20 pages',         tag:'READING', recurrence:'daily',  weekday:null, monthDay:null, dueDate:null, created:'2025-01-01' },
  { id:'g2', label:'Write daily reflection', tag:'WRITING', recurrence:'daily', weekday:null, monthDay:null, dueDate:null, created:'2025-01-01' },
  { id:'g3', label:'Weekly book review',     tag:'STUDY',   recurrence:'weekly', weekday:0,   monthDay:null, dueDate:null, created:'2025-01-01' },
];

// Completion log — { goalId, date (YYYY-MM-DD), completedAt (ISO) }
const DEMO_COMPLETIONS = [];

// ── Active days (for streak tracking) ─────────────────────────────────
// Each entry is a YYYY-MM-DD string. Persistence is not yet implemented;
// this resets to the seed on every app restart. When you add AsyncStorage
// or SQLite, replace DEMO_ACTIVE_DAYS with an empty array and load saved
// dates instead — the rest of the streak logic stays the same.
const todayKey = () => new Date().toISOString().slice(0, 10);
const daysAgoKey = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
// Seed with the last 5 consecutive days (including today) so the streak
// pill shows "🔥 5" out of the box during development.
const DEMO_ACTIVE_DAYS = [
  daysAgoKey(4), daysAgoKey(3), daysAgoKey(2), daysAgoKey(1), todayKey(),
];

export function StoreProvider({ children }) {
  const [books, setBooks] = useState(DEMO_BOOKS);
  const [notes, setNotes] = useState(DEMO_NOTES);
  const [cards, setCards] = useState(DEMO_CARDS);
  const [goals, setGoals] = useState(DEMO_GOALS);
  const [goalCompletions, setGoalCompletions] = useState(DEMO_COMPLETIONS);
  const [activeDays, setActiveDays] = useState(DEMO_ACTIVE_DAYS);

  // ── Books ────────────────────────────────────────────────────────
  const addBook    = (book)  => setBooks(b => [book, ...b]);
  const updateBook = (id, patch) => setBooks(b => b.map(x => x.id===id ? {...x,...patch} : x));
  const removeBook = (id)    => setBooks(b => b.filter(x => x.id!==id));

  // ── Notes ────────────────────────────────────────────────────────
  const addNote    = (note)  => setNotes(n => [note, ...n]);
  const updateNote = (id, patch) => setNotes(n => n.map(x => x.id===id ? {...x,...patch} : x));
  const deleteNote = (id)    => setNotes(n => n.filter(x => x.id!==id));

  // ── Cards ────────────────────────────────────────────────────────
  const addCard    = (card)  => setCards(c => [card, ...c]);
  const updateCard = (id, patch) => setCards(c => c.map(x => x.id===id ? {...x,...patch} : x));
  const dismissCard = (id)   => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    setCards(c => {
      const card = c.find(x => x.id===id);
      if (!card) return c;
      return [...c.filter(x => x.id!==id), {...card, due: tomorrow}];
    });
  };

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

    return goals.filter(g => {
      // Don't show goals dated before they were created
      if (g.created && dateKey < g.created) return false;

      switch (g.recurrence) {
        case 'daily':   return true;
        case 'weekly':  return g.weekday === weekday;
        case 'monthly': return g.monthDay === monthDay;
        case 'once':    return g.dueDate === dateKey;
        default:        return true; // legacy goals (no recurrence) treat as daily
      }
    });
  };

  // ── Derived ──────────────────────────────────────────────────────
  const dueCards     = cards.filter(c => new Date(c.due) <= new Date());
  const bookNotes    = (bookId) => notes.filter(n => n.bookId===bookId);
  const bookCards    = (bookId) => cards.filter(c => c.bookId===bookId);
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

    // Walk backward from start, counting consecutive days
    let count = 0;
    let d = new Date(start + 'T00:00:00');
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (!set.has(key)) break;
      count++;
      d.setDate(d.getDate() - 1);
    }
    return count;
  })();

  return (
    <StoreContext.Provider value={{
      books, notes, cards, goals, goalCompletions,
      activeDays, currentStreak,
      dueCards, currentBook, readingBooks,
      addBook, updateBook, removeBook,
      addNote, updateNote, deleteNote,
      addCard, updateCard, dismissCard,
      addGoal, updateGoal, removeGoal,
      toggleGoalCompletion, isGoalCompletedOn, goalCompletionsOn,
      goalsForDate, markDayActive,
      bookNotes, bookCards,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);