/**
 * mockData.js — dev-only scenarios for frontend testing.
 *
 * Each scenario returns a full store snapshot:
 *   { user, books, notes, goals, goalCompletions, activeDays, reflections }
 *
 * Shapes mirror the typedefs in src/schema.js exactly, so when the backend
 * lands (Supabase) the same objects will map straight to table rows. We use
 * the factories from schema.js wherever possible so default fields stay in
 * sync with the canonical model.
 *
 * Load via the dev section at the bottom of SettingsScreen — which calls
 * `loadScenario(snapshot)` on the store. Gated behind __DEV__ so it never
 * ships to production.
 *
 * Scenarios:
 *   empty       — logged-in user with zero of everything. Tests empty states.
 *   normal      — realistic library: ~8 books, ~25 notes, 4 goals, history.
 *   edgeCases   — long strings, unicode, missing fields, legacy shapes,
 *                 broken image URIs, weird goal recurrences.
 *   stress      — 1000 books + 2000 notes + 500 active days. Perf check
 *                 against the ScrollView-not-FlatList caveat in CLAUDE.md.
 */

import {
  newBook, newNote as _newNote, newGoal, newGoalCompletion, newReflection, newUser,
  BOOK_STATUS, BOOK_FORMAT, NOTE_TYPE, GOAL_RECURRENCE, COVER_KEYS,
} from './schema';
import { blocksToText } from './components/editor/shared';

// Local alias — schema.newNote() leaves `text` as '' unless a flatten function
// is supplied, which breaks consumers that read `n.text` directly (TrashView
// body preview, backlinkIndex's wiki-link scan over `${title} ${text}`). The
// real editor passes blocksToText at save time; we mirror that here so mock
// notes match the production on-disk shape.
const newNote = (patch) => _newNote(patch, blocksToText);

// ── Date helpers ─────────────────────────────────────────────────────────
// Mirror store.js's fmtLocalKey — must use local date (not UTC) so the
// scenario dates align with what activeDays/goalCompletions write at runtime.
const fmtLocalKey = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const todayKey = () => fmtLocalKey(new Date());
const daysAgoKey = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtLocalKey(d);
};
const daysAgoIso = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

// ── Block factory (kept local; editor/shared owns the real one) ──────────
const block = (type, text, extra = {}) => ({
  id: `blk_${Math.random().toString(36).slice(2, 8)}`,
  type,
  text,
  ...extra,
});

// ────────────────────────────────────────────────────────────────────────
// EMPTY — logged-in user, no data.
// ────────────────────────────────────────────────────────────────────────
function empty() {
  return {
    user: newUser({ name: 'Demo', email: 'demo@bookwise.app', avatarSeed: 'sage', hasOnboarded: true }),
    books: [],
    notes: [],
    goals: [],
    goalCompletions: [],
    activeDays: [],
    reflections: [],
  };
}

// ────────────────────────────────────────────────────────────────────────
// NORMAL — realistic library and reading history.
// ────────────────────────────────────────────────────────────────────────
function normal() {
  // Books — mix of statuses + formats, deterministic IDs so notes can link.
  const books = [
    newBook({
      id: 'bk_norm_1', title: 'The Death of Ivan Ilyich', author: 'Leo Tolstoy',
      cover: 'sage', pageCount: 86, currentPage: 86, genres: ['Fiction', 'Classic'],
      description: 'A judge confronts the meaning of his life as he dies.',
      status: BOOK_STATUS.FINISHED, rating: 5, format: BOOK_FORMAT.BOOK, year: 1886,
      dateAdded: daysAgoIso(60), finishedAt: daysAgoIso(14),
    }),
    newBook({
      id: 'bk_norm_2', title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman',
      cover: 'amber', pageCount: 499, currentPage: 211, genres: ['Psychology', 'Nonfiction'],
      description: 'Two systems that drive the way we think.',
      status: BOOK_STATUS.READING, rating: 0, format: BOOK_FORMAT.BOOK, year: 2011,
      dateAdded: daysAgoIso(20),
    }),
    newBook({
      id: 'bk_norm_3', title: 'The Pragmatic Programmer', author: 'David Thomas, Andrew Hunt',
      cover: 'navy', pageCount: 352, currentPage: 88, genres: ['Programming', 'Career'],
      description: 'Practical advice for the working software developer.',
      status: BOOK_STATUS.READING, rating: 0, format: BOOK_FORMAT.BOOK, year: 1999,
      dateAdded: daysAgoIso(10),
    }),
    newBook({
      id: 'bk_norm_4', title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann',
      cover: 'plum', pageCount: 611, currentPage: 0, genres: ['Programming', 'Systems'],
      description: 'The big ideas behind reliable, scalable, maintainable systems.',
      status: BOOK_STATUS.WANT, rating: 0, format: BOOK_FORMAT.BOOK, year: 2017,
      dateAdded: daysAgoIso(5),
    }),
    newBook({
      id: 'bk_norm_5', title: 'On the design of stable diffusion samplers', author: '',
      cover: 'slate', pageCount: 0, currentPage: 0, genres: ['ML'],
      description: 'Conference paper on noise schedule choices.',
      status: BOOK_STATUS.READING, rating: 0, format: BOOK_FORMAT.ARTICLE,
      url: 'https://example.com/paper', dateAdded: daysAgoIso(3),
    }),
    newBook({
      id: 'bk_norm_6', title: 'Acquired: Costco', author: 'Ben Gilbert, David Rosenthal',
      cover: 'rose', pageCount: 0, currentPage: 0, genres: ['Business'],
      description: 'Deep-dive podcast on Costco’s flywheel.',
      status: BOOK_STATUS.FINISHED, rating: 4, format: BOOK_FORMAT.PODCAST,
      url: 'https://acquired.fm/episodes/costco',
      dateAdded: daysAgoIso(45), finishedAt: daysAgoIso(40),
    }),
    newBook({
      id: 'bk_norm_7', title: 'Sapiens', author: 'Yuval Noah Harari',
      cover: 'amber', pageCount: 443, currentPage: 50, genres: ['History', 'Anthropology'],
      description: 'A brief history of humankind.',
      status: BOOK_STATUS.ABANDONED, rating: 2, format: BOOK_FORMAT.BOOK, year: 2011,
      dateAdded: daysAgoIso(120),
    }),
    newBook({
      id: 'bk_norm_8', title: 'Just enough Rust', author: 'Steve Klabnik',
      cover: 'sage', pageCount: 0, currentPage: 0, genres: ['Programming'],
      description: 'Long-form essay on what to learn first.',
      status: BOOK_STATUS.WANT, rating: 0, format: BOOK_FORMAT.WEBSITE,
      url: 'https://example.com/rust-essay', dateAdded: daysAgoIso(2),
    }),
  ];

  // Notes — varied types, attached to most books.
  const notes = [
    newNote({
      id: 'n_norm_1', bookId: 'bk_norm_1', bookTitle: 'The Death of Ivan Ilyich',
      title: 'On living a life you didn’t choose',
      blocks: [
        block('paragraph', 'Tolstoy frames the entire collapse around this one realization: that propriety can substitute for meaning for decades, and the bill comes due only at the end.'),
        block('quote', '"It occurred to him that what had appeared utterly impossible before, namely that he had not lived his life as he should have done, might after all be true."', { attribution: 'Ch. XI' }),
      ],
      types: [NOTE_TYPE.INSIGHT], starred: true, tags: ['MORTALITY', 'MEANING'],
      page: '142', date: daysAgoKey(14),
    }),
    newNote({
      id: 'n_norm_2', bookId: 'bk_norm_1', bookTitle: 'The Death of Ivan Ilyich',
      title: 'Gerasim',
      blocks: [block('paragraph', 'The peasant servant is the only character who treats Ivan as a dying man rather than as a man who must pretend not to be dying. Tolstoy makes him the moral center by omission — he never speechifies.')],
      types: [NOTE_TYPE.INSIGHT, NOTE_TYPE.CONNECTION], linkedNoteIds: ['n_norm_1'],
      tags: ['CHARACTER'], date: daysAgoKey(16),
    }),
    newNote({
      id: 'n_norm_3', bookId: 'bk_norm_2', bookTitle: 'Thinking, Fast and Slow',
      title: 'System 1 vs System 2',
      blocks: [
        block('heading', 'The two systems'),
        block('paragraph', 'Fast/intuitive vs slow/deliberate. The book’s core frame is that we *narrate* using System 2 but most behavior is driven by System 1.'),
        block('bullet', 'System 1: automatic, emotional, fast'),
        block('bullet', 'System 2: effortful, logical, slow'),
      ],
      types: [NOTE_TYPE.SUMMARY], tags: ['COGNITION'], page: 'pp. 19-30', date: daysAgoKey(8),
    }),
    newNote({
      id: 'n_norm_4', bookId: 'bk_norm_2', bookTitle: 'Thinking, Fast and Slow',
      blocks: [block('thought', 'Worth re-reading after I finish — the chapter on prospect theory probably maps onto how I price risk in side projects.')],
      types: [NOTE_TYPE.QUESTION], thinking: 'Come back to this once I get to ch. 26.', date: daysAgoKey(7),
    }),
    newNote({
      id: 'n_norm_5', bookId: 'bk_norm_3', bookTitle: 'The Pragmatic Programmer',
      title: 'The broken-windows theory of code',
      blocks: [
        block('quote', '"Don’t live with broken windows."'),
        block('paragraph', 'One bad pattern tolerated invites the next. The recommendation is small: at minimum, board it up (a comment, a TODO, a flag).'),
      ],
      types: [NOTE_TYPE.INSIGHT, NOTE_TYPE.ACTION], starred: true,
      tags: ['CODE QUALITY', 'CRAFT'], page: '7', date: daysAgoKey(5),
    }),
    newNote({
      id: 'n_norm_6', bookId: 'bk_norm_3', bookTitle: 'The Pragmatic Programmer',
      blocks: [block('paragraph', 'DRY isn’t about textual duplication — it’s about *every piece of knowledge having a single authoritative representation*. The line is subtle.')],
      types: [NOTE_TYPE.INSIGHT], tags: ['DRY', 'CRAFT'], date: daysAgoKey(4),
    }),
    newNote({
      id: 'n_norm_7', bookId: 'bk_norm_5', bookTitle: 'On the design of stable diffusion samplers',
      title: 'Noise schedules',
      blocks: [block('paragraph', 'Cosine schedules dominate at the high-quality end; linear is fine for small step counts and is cheaper to reason about. Author’s claim: the schedule matters more than the sampler.')],
      types: [NOTE_TYPE.SUMMARY], tags: ['DIFFUSION', 'ML'], date: daysAgoKey(2),
    }),
    newNote({
      id: 'n_norm_8', bookId: 'bk_norm_6', bookTitle: 'Acquired: Costco',
      blocks: [
        block('quote', '"Costco doesn’t price up to what the market will bear. They price down to what their cost will allow."'),
        block('thought', 'Mental model for any subscription product: price as a function of cost-of-service, not willingness to pay. The relationship is the moat.'),
      ],
      types: [NOTE_TYPE.QUOTE, NOTE_TYPE.INSIGHT], starred: true,
      tags: ['BUSINESS MODEL', 'PRICING'], date: daysAgoKey(40),
    }),
    newNote({
      id: 'n_norm_9', bookId: 'bk_norm_6', bookTitle: 'Acquired: Costco',
      blocks: [block('paragraph', 'Kirkland is ~33% of revenue. The brand is the flywheel, not the warehouses.')],
      types: [NOTE_TYPE.INSIGHT], tags: ['BUSINESS MODEL'], date: daysAgoKey(41),
    }),
    newNote({
      id: 'n_norm_10', bookId: 'bk_norm_2', bookTitle: 'Thinking, Fast and Slow',
      title: 'Anchoring',
      blocks: [block('paragraph', 'Even random anchors that you *know* are random still pull your answer. The bias survives awareness — which is the part that should worry you.')],
      types: [NOTE_TYPE.INSIGHT], tags: ['BIAS', 'COGNITION'], page: '119', date: daysAgoKey(6),
    }),
    newNote({
      id: 'n_norm_11', bookId: 'bk_norm_1', bookTitle: 'The Death of Ivan Ilyich',
      blocks: [block('paragraph', 'The funeral chapter is *first*. Tolstoy spoils the ending so we read the whole novella inside the frame of how the others responded.')],
      types: [NOTE_TYPE.INSIGHT, NOTE_TYPE.CONNECTION], linkedNoteIds: ['n_norm_1', 'n_norm_2'],
      tags: ['STRUCTURE'], date: daysAgoKey(13),
    }),
    newNote({
      id: 'n_norm_12', bookId: 'bk_norm_3', bookTitle: 'The Pragmatic Programmer',
      blocks: [block('action', 'Try the "stone soup" technique on the migration project — show up with a partial fix and let the rest accrete.')],
      types: [NOTE_TYPE.ACTION], tags: ['WORK'], date: daysAgoKey(3),
    }),
    newNote({
      id: 'n_norm_13', bookId: '', bookTitle: '',
      title: 'Unattached idea',
      blocks: [block('paragraph', 'Random thought caught while away from my desk — no book to attach it to yet. The capture FAB should accept these without forcing a book.')],
      types: [NOTE_TYPE.INSIGHT], tags: ['META'], date: daysAgoKey(1),
    }),
    newNote({
      id: 'n_norm_14', bookId: 'bk_norm_2', bookTitle: 'Thinking, Fast and Slow',
      blocks: [block('quote', '"Nothing in life is as important as you think it is, while you are thinking about it."', { attribution: 'Kahneman' })],
      types: [NOTE_TYPE.QUOTE], starred: true, tags: ['ATTENTION'], page: '402', date: daysAgoKey(9),
    }),
    newNote({
      id: 'n_norm_15', bookId: 'bk_norm_7', bookTitle: 'Sapiens',
      blocks: [block('thought', 'I bounced off this around page 50. The "myths bind societies" thesis is interesting but the prose felt too confident for the strength of the evidence.')],
      types: [NOTE_TYPE.QUESTION], date: daysAgoKey(80),
    }),
    newNote({
      id: 'n_norm_16', bookId: 'bk_norm_5', bookTitle: 'On the design of stable diffusion samplers',
      title: 'Open questions',
      blocks: [
        block('heading', 'Things to dig into'),
        block('bullet', 'How does the trained model couple to the schedule?'),
        block('bullet', 'Is there a closed-form optimum given a fixed step budget?'),
      ],
      types: [NOTE_TYPE.QUESTION], tags: ['ML', 'DIFFUSION'], date: daysAgoKey(2),
    }),
    newNote({
      id: 'n_norm_17', bookId: 'bk_norm_1', bookTitle: 'The Death of Ivan Ilyich',
      blocks: [block('quote', '"Caius is a man, men are mortal, therefore Caius is mortal."', { attribution: 'Ch. VI' })],
      types: [NOTE_TYPE.QUOTE], tags: ['MORTALITY'], page: '89', date: daysAgoKey(15),
    }),
    newNote({
      id: 'n_norm_18', bookId: 'bk_norm_6', bookTitle: 'Acquired: Costco',
      blocks: [block('paragraph', 'Membership renewal rate ~90% in mature markets — that’s the number to remember. Most subscription businesses would kill for it.')],
      types: [NOTE_TYPE.INSIGHT], tags: ['BUSINESS MODEL', 'METRICS'], date: daysAgoKey(43),
    }),
    newNote({
      id: 'n_norm_19', bookId: 'bk_norm_3', bookTitle: 'The Pragmatic Programmer',
      blocks: [block('paragraph', 'The "tracer bullets vs prototypes" distinction is the part of the book I keep coming back to. Tracer bullets are real code shipping end-to-end; prototypes are throwaway. Treating one as the other is where projects die.')],
      types: [NOTE_TYPE.INSIGHT, NOTE_TYPE.CONNECTION], linkedNoteIds: ['n_norm_12'],
      tags: ['PROJECT', 'CRAFT'], date: daysAgoKey(2),
    }),
    newNote({
      id: 'n_norm_20', bookId: 'bk_norm_2', bookTitle: 'Thinking, Fast and Slow',
      blocks: [block('thought', 'There’s a thread connecting anchoring, availability, and the planning fallacy: in every case System 2 *accepts* what System 1 hands it.')],
      types: [NOTE_TYPE.CONNECTION], linkedNoteIds: ['n_norm_3', 'n_norm_10'],
      tags: ['SYNTHESIS'], date: daysAgoKey(5),
    }),
  ];

  // Goals — one of each recurrence.
  const todayK = todayKey();
  const goals = [
    newGoal({
      id: 'g_norm_1', label: 'Read 20 pages', recurrence: GOAL_RECURRENCE.DAILY,
      tag: 'READING', created: daysAgoKey(30),
    }),
    newGoal({
      id: 'g_norm_2', label: 'Write one note', recurrence: GOAL_RECURRENCE.DAILY,
      tag: 'WRITING', created: daysAgoKey(30),
    }),
    newGoal({
      id: 'g_norm_3', label: 'Sunday review', recurrence: GOAL_RECURRENCE.WEEKLY,
      weekday: 0, tag: 'REVIEW', created: daysAgoKey(30),
    }),
    newGoal({
      id: 'g_norm_4', label: 'Pick next month’s book', recurrence: GOAL_RECURRENCE.MONTHLY,
      monthDay: 1, tag: 'PLANNING', created: daysAgoKey(60),
    }),
    newGoal({
      id: 'g_norm_5', label: 'Finish Pragmatic Programmer', recurrence: GOAL_RECURRENCE.ONCE,
      dueDate: daysAgoKey(-14), tag: 'READING', created: daysAgoKey(10),
    }),
  ];

  // Completions — 'Read 20 pages' completed most days last 14, 'Write one note' less consistent.
  const goalCompletions = [];
  for (let i = 0; i < 14; i++) {
    if (i % 7 !== 5) goalCompletions.push(newGoalCompletion('g_norm_1', daysAgoKey(i)));
    if (i % 3 === 0) goalCompletions.push(newGoalCompletion('g_norm_2', daysAgoKey(i)));
  }

  // Activity — last 21 days, a couple gaps so streak math is non-trivial.
  const activeDays = [];
  for (let i = 0; i < 21; i++) {
    if (i !== 4 && i !== 10) activeDays.push(daysAgoKey(i));
  }

  const reflections = [
    newReflection(daysAgoKey(0), 'Slow morning. Got two chapters of Pragmatic Programmer in before the day pulled me elsewhere. Need to keep the streak going tomorrow.'),
    newReflection(daysAgoKey(2), 'Finally cracked the noise-schedule paper. The author’s framing is cleaner than I expected — the diagrams alone are worth saving.'),
    newReflection(daysAgoKey(5), 'Broken-windows quote keeps coming back to me. Going to apply it to the codebase this week before adding anything new.'),
    newReflection(daysAgoKey(7), 'Skipped reading. Tired. Not going to let one missed day spiral.'),
    newReflection(daysAgoKey(14), 'Finished Ivan Ilyich. Wrote three notes about it and immediately wanted to start over.'),
  ];

  return {
    user: newUser({
      name: 'Bryan',
      email: 'bp.learn123@gmail.com',
      avatarSeed: 'amber',
      hasOnboarded: true,
    }),
    books, notes, goals, goalCompletions, activeDays, reflections,
  };
}

// ────────────────────────────────────────────────────────────────────────
// EDGE CASES — long strings, unicode, missing fields, legacy shapes.
// ────────────────────────────────────────────────────────────────────────
function edgeCases() {
  const LONG_TITLE = 'A Very Long Book Title That Exceeds Reasonable Display Width And Will Almost Certainly Need Truncation Or Wrapping In Any Sensible UI ' + '— And Then Some More After That To Really Test The Boundary'.repeat(1);
  const LONG_PARAGRAPH = 'Lorem ipsum '.repeat(80).trim();

  const books = [
    newBook({
      id: 'bk_edge_1', title: LONG_TITLE, author: 'A Suspiciously Long Author Name That Almost Certainly Has Two Co-Authors Smashed Together',
      cover: 'plum', pageCount: 0, currentPage: 0, genres: [],
      description: '', status: BOOK_STATUS.READING, rating: 0,
      format: BOOK_FORMAT.BOOK, year: undefined, dateAdded: undefined,
    }),
    newBook({
      id: 'bk_edge_2', title: '不可思議 \u{1F4D6}', author: 'ムラカミ',
      cover: 'sage', pageCount: 250, currentPage: 250, genres: ['フィクション'],
      description: 'Unicode + emoji to verify rendering across views.',
      status: BOOK_STATUS.FINISHED, rating: 5, format: BOOK_FORMAT.BOOK,
      dateAdded: daysAgoIso(30), finishedAt: daysAgoIso(1),
    }),
    newBook({
      id: 'bk_edge_3', title: 'Untitled draft', author: '',
      cover: 'navy', pageCount: 0, currentPage: 0, genres: [],
      description: '', status: BOOK_STATUS.WANT, rating: 0,
      format: BOOK_FORMAT.OTHER, dateAdded: daysAgoIso(1),
    }),
    // Legacy book — missing dateAdded, missing finishedAt, finished status anyway.
    {
      id: 'bk_edge_4', title: 'Pre-migration book', author: 'Old Author',
      cover: 'amber', pageCount: 100, currentPage: 100, genres: ['Legacy'],
      description: '', status: BOOK_STATUS.FINISHED, rating: 3,
      format: BOOK_FORMAT.BOOK,
    },
    newBook({
      id: 'bk_edge_5', title: 'Zero-page article', author: '',
      cover: 'rose', pageCount: 0, currentPage: 0, genres: ['Web'],
      url: 'https://example.com/article-without-known-length',
      status: BOOK_STATUS.READING, format: BOOK_FORMAT.ARTICLE,
      dateAdded: daysAgoIso(7),
    }),
    newBook({
      id: 'bk_edge_6', title: 'Three Genres Maximum, We Said', author: 'Genre Stress',
      cover: 'slate', pageCount: 320, currentPage: 12,
      genres: ['Philosophy', 'History', 'Religion', 'Anthropology', 'Sociology', 'Politics'],
      status: BOOK_STATUS.READING, format: BOOK_FORMAT.BOOK,
      dateAdded: daysAgoIso(4),
    }),
  ];

  const notes = [
    // Note with empty blocks but a title — should render gracefully.
    newNote({
      id: 'n_edge_1', bookId: 'bk_edge_1', bookTitle: LONG_TITLE,
      title: 'Title-only note (empty blocks)',
      blocks: [], types: [NOTE_TYPE.INSIGHT], date: daysAgoKey(1),
    }),
    // Note with very long paragraph.
    newNote({
      id: 'n_edge_2', bookId: 'bk_edge_1', bookTitle: LONG_TITLE,
      title: 'Long-form rambling',
      blocks: [block('paragraph', LONG_PARAGRAPH)],
      types: [NOTE_TYPE.SUMMARY], date: daysAgoKey(2),
    }),
    // Note with unicode/emoji throughout.
    newNote({
      id: 'n_edge_3', bookId: 'bk_edge_2', bookTitle: '不可思議 \u{1F4D6}',
      title: 'Emoji-heavy \u{1F4DA}\u{1F58B}\u{FE0F}\u{2728}',
      blocks: [
        block('paragraph', 'Mixed scripts 中文 日本語 العربية עברית work alongside emoji \u{1F4D6}\u{1F4DA}.'),
        block('quote', '"Quote with \u{1F4AC} emoji + curly “smart quotes”"', { attribution: 'Anonymous' }),
      ],
      types: [NOTE_TYPE.QUOTE], tags: ['UNICODE', '\u{1F4D6}'], date: daysAgoKey(3),
    }),
    // Note with broken image URI (cache evicted).
    newNote({
      id: 'n_edge_4', bookId: 'bk_edge_2', bookTitle: '不可思議 \u{1F4D6}',
      title: 'Image with stale URI',
      blocks: [
        block('image', 'Caption only — the file behind this URI no longer exists', {
          uri: 'file:///private/var/mobile/Containers/Data/Application/DEAD-CACHE-PATH/tmp/note-images/old-image.jpg',
          width: 600, height: 400,
        }),
        block('paragraph', 'NoteCard / ImageBlock should render the "Image unavailable" placeholder via onError.'),
      ],
      types: [NOTE_TYPE.INSIGHT], date: daysAgoKey(4),
    }),
    // Legacy note — uses singular `type` only, missing `types[]`, missing `blocks`.
    {
      id: 'n_edge_5', bookId: 'bk_edge_4', bookTitle: 'Pre-migration book',
      type: 'insight',
      text: 'Legacy note with only the singular type and a flat text field. Older views read these.',
      tags: ['LEGACY'], date: daysAgoKey(50), starred: false,
    },
    // Quote without attribution.
    newNote({
      id: 'n_edge_6', bookId: 'bk_edge_3', bookTitle: 'Untitled draft',
      blocks: [block('quote', '"No attribution — orphan quote."')],
      types: [NOTE_TYPE.QUOTE], date: daysAgoKey(5),
    }),
    // Note with a connection link to a non-existent note.
    newNote({
      id: 'n_edge_7', bookId: 'bk_edge_1', bookTitle: LONG_TITLE,
      blocks: [block('paragraph', 'Linked to a note that doesn’t exist any more.')],
      types: [NOTE_TYPE.CONNECTION], linkedNoteIds: ['n_does_not_exist'],
      date: daysAgoKey(6),
    }),
    // Wiki-link to a non-existent note title.
    newNote({
      id: 'n_edge_8', bookId: '', bookTitle: '',
      title: 'Dangling wiki-link',
      blocks: [block('paragraph', 'See [[A note that never was]] for more context.')],
      types: [NOTE_TYPE.INSIGHT], date: daysAgoKey(1),
    }),
    // Lots of tags with special characters.
    newNote({
      id: 'n_edge_9', bookId: 'bk_edge_6', bookTitle: 'Three Genres Maximum, We Said',
      blocks: [block('paragraph', 'Tag normalization stress.')],
      types: [NOTE_TYPE.INSIGHT],
      tags: ['VERY-LONG-TAG-NAME-THAT-WILL-WRAP-OR-OVERFLOW', 'A&B', '#HASHED', '   SPACED   ', 'WITH/SLASH'],
      date: daysAgoKey(2),
    }),
    // Trashed note — should not appear in normal views, only in Trash.
    {
      ...newNote({
        id: 'n_edge_10', bookId: 'bk_edge_2', bookTitle: '不可思議 \u{1F4D6}',
        title: 'Currently in trash',
        blocks: [block('paragraph', 'Soft-deleted note. Trash view should show it; everything else should hide it.')],
        types: [NOTE_TYPE.INSIGHT], date: daysAgoKey(8),
      }),
      trashed: true, deletedAt: daysAgoIso(2),
    },
  ];

  const goals = [
    // Weekday: Sunday (0) — edge of the range.
    newGoal({
      id: 'g_edge_1', label: 'Sunday-only goal', recurrence: GOAL_RECURRENCE.WEEKLY,
      weekday: 0, created: daysAgoKey(60),
    }),
    // Monthly: day 31 — must "spill" onto last day of shorter months.
    newGoal({
      id: 'g_edge_2', label: 'Last-day-of-month (uses 31)', recurrence: GOAL_RECURRENCE.MONTHLY,
      monthDay: 31, created: daysAgoKey(120),
    }),
    // Past-due once goal — should still show on its dueDate but not after.
    newGoal({
      id: 'g_edge_3', label: 'Already past due', recurrence: GOAL_RECURRENCE.ONCE,
      dueDate: daysAgoKey(30), created: daysAgoKey(45),
    }),
    // Future-dated once goal.
    newGoal({
      id: 'g_edge_4', label: 'Far-future deadline', recurrence: GOAL_RECURRENCE.ONCE,
      dueDate: daysAgoKey(-365), created: daysAgoKey(1),
    }),
    // Legacy goal with no `recurrence` field — store treats as daily.
    { id: 'g_edge_5', label: 'Legacy daily (no recurrence)', tag: '', created: daysAgoKey(200) },
    // Long label.
    newGoal({
      id: 'g_edge_6',
      label: 'A goal label that goes on for a really unreasonable length and should still render without breaking the row layout',
      recurrence: GOAL_RECURRENCE.DAILY, created: daysAgoKey(10),
    }),
  ];

  const goalCompletions = [
    newGoalCompletion('g_edge_1', daysAgoKey(0)),
    newGoalCompletion('g_edge_5', daysAgoKey(1)),
  ];

  // Sparse activity — one streak, one gap.
  const activeDays = [
    todayKey(),
    daysAgoKey(1),
    daysAgoKey(2),
    // gap on day 3
    daysAgoKey(4),
    daysAgoKey(5),
    daysAgoKey(40),  // ancient day
  ];

  const reflections = [
    newReflection(daysAgoKey(0), 'Short reflection.'),
    newReflection(daysAgoKey(1), 'A '.repeat(500).trim() + ' end.'),  // very long reflection
    newReflection(daysAgoKey(2), '中文内容 + emoji \u{1F4D6} mixed reflection.'),
  ];

  return {
    user: newUser({
      name: 'Björn \u{1F4DA}',  // unicode in name
      email: 'edge+case@example.co.uk',
      avatarSeed: 'plum',
      hasOnboarded: true,
    }),
    books, notes, goals, goalCompletions, activeDays, reflections,
  };
}

// ────────────────────────────────────────────────────────────────────────
// STRESS — large datasets to find perf cliffs.
// CLAUDE.md flags that lists use ScrollView (not FlatList) — this scenario
// surfaces that. Don't be surprised if scrolling NotesScreen / Library
// drops frames once this is loaded; that's exactly what we want to find.
// ────────────────────────────────────────────────────────────────────────
function stress() {
  const STATUSES = Object.values(BOOK_STATUS);
  const FORMATS = Object.values(BOOK_FORMAT);
  const TYPES = Object.values(NOTE_TYPE);
  const COVERS = COVER_KEYS;

  const books = [];
  for (let i = 0; i < 1000; i++) {
    const status = STATUSES[i % STATUSES.length];
    books.push(newBook({
      id: `bk_stress_${i}`,
      title: `Stress Book #${i + 1}`,
      author: `Author ${i % 200}`,
      cover: COVERS[i % COVERS.length],
      pageCount: 100 + (i % 500),
      currentPage: status === BOOK_STATUS.READING ? Math.floor((i % 500) / 2) : (status === BOOK_STATUS.FINISHED ? 100 + (i % 500) : 0),
      genres: [`Genre ${i % 20}`],
      status,
      rating: status === BOOK_STATUS.FINISHED ? (i % 5) + 1 : 0,
      format: FORMATS[i % FORMATS.length],
      dateAdded: daysAgoIso(i % 500),
      finishedAt: status === BOOK_STATUS.FINISHED ? daysAgoIso(i % 200) : null,
    }));
  }

  const notes = [];
  for (let i = 0; i < 2000; i++) {
    const b = books[i % books.length];
    const type = TYPES[i % TYPES.length];
    notes.push(newNote({
      id: `n_stress_${i}`,
      bookId: b.id, bookTitle: b.title,
      title: i % 5 === 0 ? `Note #${i + 1}` : '',
      blocks: [block('paragraph', `Stress note body ${i + 1}. ` + 'Lorem ipsum dolor sit amet. '.repeat((i % 4) + 1))],
      types: [type],
      tags: [`TAG${i % 30}`],
      starred: i % 17 === 0,
      date: daysAgoKey(i % 365),
    }));
  }

  const goals = [
    newGoal({ id: 'g_stress_1', label: 'Daily read', recurrence: GOAL_RECURRENCE.DAILY, created: daysAgoKey(365) }),
    newGoal({ id: 'g_stress_2', label: 'Weekly review', recurrence: GOAL_RECURRENCE.WEEKLY, weekday: 0, created: daysAgoKey(365) }),
  ];
  const goalCompletions = [];
  for (let i = 0; i < 200; i++) goalCompletions.push(newGoalCompletion('g_stress_1', daysAgoKey(i)));

  const activeDays = [];
  for (let i = 0; i < 500; i++) activeDays.push(daysAgoKey(i));

  const reflections = [];
  for (let i = 0; i < 50; i++) {
    reflections.push(newReflection(daysAgoKey(i * 3), `Reflection ${i + 1}. Some text to fill the row.`));
  }

  return {
    user: newUser({
      name: 'Stress Test',
      email: 'stress@example.com',
      avatarSeed: 'slate',
      hasOnboarded: true,
    }),
    books, notes, goals, goalCompletions, activeDays, reflections,
  };
}

export const scenarios = { empty, normal, edgeCases, stress };

// Convenience metadata for the dev-only loader UI.
export const SCENARIO_META = [
  { key: 'empty',     label: 'Empty',       hint: 'Logged in, no data — empty states' },
  { key: 'normal',    label: 'Normal',      hint: '~8 books, ~20 notes, goals + history' },
  { key: 'edgeCases', label: 'Edge cases',  hint: 'Long strings, unicode, missing fields, legacy' },
  { key: 'stress',    label: 'Stress test', hint: '1000 books + 2000 notes — perf check' },
];
