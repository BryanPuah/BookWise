import CONFIG from '../config';

const KEY = CONFIG.GEMINI_KEY;

export async function generateFlashcard(noteText, bookTitle, bookAuthor) {

  console.log('=== generateFlashcard called ===');
  console.log('Key present:', KEY ? `YES (length ${KEY.length})` : 'NO - ADD KEY TO src/config.js');
  console.log('Book:', bookTitle);
  console.log('Note:', noteText.slice(0, 80));

  if (!KEY || KEY.trim() === '') {
    console.log('→ SKIPPING API — no key in config.js');
    return buildFallbackCard(noteText, bookTitle);
  }

  // Try models in order until one works
  const MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-pro',
  ];

  const prompt = `Create a study flashcard for this note.

Book: "${bookTitle}" by ${bookAuthor}
Note: "${noteText}"

Rules:
- Question must be SPECIFIC to this exact note — not generic
- Do NOT write "What is the key insight" or "Explain the concept"
- Instead ask about the specific idea, person, statistic, or argument in the note
- Answer should be 2-3 sentences

Reply with ONLY this JSON and nothing else:
{"question": "...", "answer": "..."}`;

  for (const model of MODELS) {
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;

    try {
      console.log(`→ Trying model: ${model}`);

      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
        }),
      });

      console.log(`→ Status: ${res.status}`);

      if (!res.ok) {
        const errText = await res.text();
        console.log(`→ Error: ${errText.slice(0, 200)}`);
        continue; // try next model
      }

      const data = await res.json();
      const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('→ Raw response:', raw.slice(0, 150));

      const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const card  = JSON.parse(clean);

      if (!card.question || !card.answer) throw new Error('Missing fields');

      console.log('→ SUCCESS! Question:', card.question);
      return { question: card.question, answer: card.answer };

    } catch (e) {
      console.log(`→ Model ${model} failed:`, e.message);
      continue;
    }
  }

  // All models failed
  console.log('→ All models failed — using fallback');
  return buildFallbackCard(noteText, bookTitle);
}

function buildFallbackCard(noteText, bookTitle) {
  const text     = noteText.trim();
  const isQuote  = text.startsWith('"') || text.startsWith('\u201c');
  const hasNum   = /\d+%|\d+x|\d+\s*times|\d+\s*days/i.test(text);
  const hasCause = /because|therefore|as a result|which means|leads to/i.test(text);

  let question;
  if (isQuote)
    question = `What does this passage from "${bookTitle}" mean, and why is it significant?`;
  else if (hasNum)
    question = `What does the figure in this note from "${bookTitle}" demonstrate?`;
  else if (hasCause)
    question = `Explain the cause-and-effect relationship in this note from "${bookTitle}".`;
  else
    question = `Explain the concept from "${bookTitle}" in your own words — what is it and why does it matter?`;

  return { question, answer: text };
}

// ── Generate a deck from multiple notes ────────────────────────────────
// Sends all notes in one API call, gets back an array of cards.
// Falls back to per-note generation if batch fails.
export async function generateDeck(notes, books) {
  console.log('=== generateDeck called — ', notes.length, 'notes ===');

  if (!KEY || KEY.trim() === '') {
    console.log('→ No key — using fallback for all notes');
    return notes.map(n => {
      const book = books.find(b => b.id === n.bookId);
      const fb   = buildFallbackCard(n.text, book?.title || 'Unknown');
      return {
        id:        `card-${n.id}-${Date.now()}`,
        noteId:    n.id,
        bookId:    n.bookId,
        bookTitle: book?.title || 'Unknown',
        question:  fb.question,
        answer:    fb.answer,
        due:       new Date().toISOString(),
        interval:  1,
      };
    });
  }

  // Build a condensed prompt with all notes
  const noteLines = notes.map((n, i) => {
    const book = books.find(b => b.id === n.bookId);
    return `${i + 1}. [${book?.title || 'Unknown'} — ${n.type}] ${n.text}${n.thinking ? ` (My thinking: ${n.thinking})` : ''}`;
  }).join('\n');

  const prompt = `You are a study flashcard generator. Create one flashcard per note below.

NOTES:
${noteLines}

RULES:
- Each question must be specific to that exact note — probe the actual idea, not the topic
- Never write generic questions like "What is the main idea" or "Explain the concept"
- Instead, ask about a specific claim, mechanism, statistic, person, or implication in the note
- Answer: 1-3 sentences that directly answer the question
- Use the reader's own thinking where provided

Return ONLY a JSON array, no markdown, no explanation:
[{"q":"...","a":"..."},{"q":"...","a":"..."}]`;

  const MODELS = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro'];

  for (const model of MODELS) {
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`;
    try {
      const res = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.6 },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const clean = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const arr   = JSON.parse(clean);

      if (!Array.isArray(arr)) throw new Error('Not an array');

      return arr.map((item, i) => {
        const note = notes[i] || notes[0];
        const book = books.find(b => b.id === note.bookId);
        return {
          id:        `card-${note.id}-${Date.now()}-${i}`,
          noteId:    note.id,
          bookId:    note.bookId,
          bookTitle: book?.title || 'Unknown',
          question:  item.q || item.question || '',
          answer:    item.a || item.answer || note.text,
          due:       new Date().toISOString(),
          interval:  1,
        };
      }).filter(c => c.question);

    } catch (e) {
      console.log('Batch failed on', model, e.message);
      continue;
    }
  }

  // Fallback — individual cards
  return notes.map(n => {
    const book = books.find(b => b.id === n.bookId);
    const fb   = buildFallbackCard(n.text, book?.title || 'Unknown');
    return {
      id:        `card-${n.id}-${Date.now()}`,
      noteId:    n.id,
      bookId:    n.bookId,
      bookTitle: book?.title || 'Unknown',
      question:  fb.question,
      answer:    fb.answer,
      due:       new Date().toISOString(),
      interval:  1,
    };
  });
}