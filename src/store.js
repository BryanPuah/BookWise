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

export function StoreProvider({ children }) {
  const [books, setBooks] = useState(DEMO_BOOKS);
  const [notes, setNotes] = useState(DEMO_NOTES);
  const [cards, setCards] = useState(DEMO_CARDS);

  const addBook    = (book)  => setBooks(b => [book, ...b]);
  const updateBook = (id, patch) => setBooks(b => b.map(x => x.id===id ? {...x,...patch} : x));
  const removeBook = (id)    => setBooks(b => b.filter(x => x.id!==id));

  const addNote    = (note)  => setNotes(n => [note, ...n]);
  const updateNote = (id, patch) => setNotes(n => n.map(x => x.id===id ? {...x,...patch} : x));
  const deleteNote = (id)    => setNotes(n => n.filter(x => x.id!==id));

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

  const dueCards     = cards.filter(c => new Date(c.due) <= new Date());
  const bookNotes    = (bookId) => notes.filter(n => n.bookId===bookId);
  const bookCards    = (bookId) => cards.filter(c => c.bookId===bookId);
  const readingBooks = books.filter(b => b.status==='reading');
  // Keep currentBook for backward compat — first reading book
  const currentBook  = readingBooks[0] || null;

  return (
    <StoreContext.Provider value={{
      books, notes, cards, dueCards, currentBook, readingBooks,
      addBook, updateBook, removeBook,
      addNote, updateNote, deleteNote,
      addCard, updateCard, dismissCard,
      bookNotes, bookCards,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);