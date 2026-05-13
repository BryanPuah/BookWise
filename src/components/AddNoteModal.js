/**
 * AddNoteModal — 2-step modal: pick book → write note
 *
 * Extracted from NotesScreen so it can be opened from anywhere
 * (e.g. the bottom-tab "+" capture button in App.js).
 *
 * Props:
 *   visible  — bool, controls modal
 *   books    — full books array from useStore() (filters internally)
 *   onSave   — ({ bookId, bookTitle, type, text, thinking, page, chapter }) => void
 *   onClose  — () => void
 */

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCover } from './BookCover';
import { useTheme } from '../theme';

// ── Note type definitions (local copy — kept in sync with NotesScreen) ──
const NT = {
  quote:      { label: 'Quote',      icon: '💬', color: '#6B5B95', bg: '#F0EDF8', desc: 'Direct words from the author' },
  insight:    { label: 'Insight',    icon: '💡', color: '#2874A6', bg: '#EAF4FB', desc: 'Your own interpretation or realisation' },
  question:   { label: 'Question',   icon: '🔍', color: '#A04000', bg: '#FDF0E6', desc: 'Something you want to investigate further' },
  action:     { label: 'Action',     icon: '✅', color: '#1E8449', bg: '#E9F7EF', desc: 'Something you will apply or do' },
  summary:    { label: 'Summary',    icon: '📌', color: '#76448A', bg: '#F5EEF8', desc: 'Distilled key idea from a chapter' },
  connection: { label: 'Connection', icon: '🔗', color: '#17A589', bg: '#E8F8F5', desc: 'This idea connects to another book or note' },
};

export function AddNoteModal({ visible, books, onSave, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const mo = useMemo(() => StyleSheet.create({
    safe:        { flex: 1, backgroundColor: C.paper },
    header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
    title:       { fontFamily: F.serif, fontSize: 16, fontWeight: '700', color: C.ink },
    cancel:      { fontFamily: F.serif, fontSize: 15, color: C.inkMuted },
    save:        { fontFamily: F.serif, fontSize: 15, color: C.amber, fontWeight: '700' },
    saveOff:     { opacity: 0.3 },
    scroll:      { flex: 1 },
    label:       { fontFamily: F.serif, fontSize: 10, fontWeight: '700', color: C.inkMuted, letterSpacing: 1, marginHorizontal: 20, marginTop: 20, marginBottom: 8 },
    optional:    { fontFamily: F.serif, fontWeight: '400', color: C.inkFaint },
    typePill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.creamDark, borderWidth: 1, borderColor: C.border },
    typePillIcon:{ fontSize: 13, color: C.inkMuted },
    typePillTxt: { fontFamily: F.serif, fontSize: 12, fontWeight: '600', color: C.inkMuted },
    typeHint:    { fontFamily: F.serif, fontSize: 12, marginHorizontal: 20, marginTop: 6, marginBottom: 2, fontStyle: 'italic' },
    mainInput:   { fontFamily: F.serif, marginHorizontal: 20, backgroundColor: C.white, borderRadius: 12, borderWidth: 1.5, padding: 14, fontSize: 14, color: C.ink, minHeight: 100, textAlignVertical: 'top', lineHeight: 22 },
    thinkInput:  { fontFamily: F.serif, marginHorizontal: 20, backgroundColor: '#FFFEF5', borderRadius: 12, borderWidth: 1, borderColor: '#D4C870', padding: 14, fontSize: 14, color: C.ink, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
    step1Strip:  { backgroundColor: C.cream, borderBottomWidth: 1, borderBottomColor: C.border, paddingHorizontal: 20, paddingVertical: 14 },
    step1StripTxt: { fontFamily: F.serif, fontSize: 15, fontWeight: '600', color: C.inkSoft, letterSpacing: -0.2 },
    emptyBooks:  { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyBooksIcon: { fontSize: 40, marginBottom: 12 },
    emptyBooksTxt:  { fontFamily: F.serif, fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 6 },
    emptyBooksSub:  { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20 },
    bookRow:         { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
    bookRowActive:   { borderColor: C.amber, backgroundColor: C.amberPale },
    bookRowInfo:     { flex: 1 },
    bookRowTitle:    { fontFamily: F.serif, fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 20, marginBottom: 3 },
    bookRowAuthor:   { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginBottom: 8 },
    bookRowStatus:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    bookRowStatusTxt:{ fontFamily: F.serif, fontSize: 11, fontWeight: '600' },
    bookRowArrow:    { fontFamily: F.serif, fontSize: 20, color: C.inkFaint },
    selectedBookBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.cream, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
    selectedBookTitle:  { fontFamily: F.serif, fontSize: 13, fontWeight: '700', color: C.ink },
    selectedBookAuthor: { fontFamily: F.serif, fontSize: 11, color: C.inkMuted, marginTop: 2 },
    selectedBookChange: { fontFamily: F.serif, fontSize: 12, color: C.amber, fontWeight: '600' },
    locRow:      { flexDirection: 'row', marginHorizontal: 20, gap: 10 },
    locLabel:    { fontFamily: F.serif, fontSize: 10, color: C.inkMuted, fontWeight: '600', marginBottom: 5 },
    locInput:    { fontFamily: F.serif, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 13, color: C.ink },
  }), [themeVersion]);
  const [step, setStep]         = useState(1);
  const [bookId, setBookId]     = useState('');
  const [type, setType]         = useState('insight');
  const [text, setText]         = useState('');
  const [thinking, setThinking] = useState('');
  const [page, setPage]         = useState('');
  const [chapter, setChapter]   = useState('');

  const activeBooks  = books.filter(b => b.status !== 'want_to_read');
  const selectedBook = books.find(b => b.id === bookId);

  const reset = () => {
    setStep(1); setBookId(''); setType('insight');
    setText(''); setThinking(''); setPage(''); setChapter('');
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSave = () => {
    if (!text.trim() || !bookId) return;
    onSave({
      bookId,
      bookTitle: selectedBook?.title || '',
      type,
      text: text.trim(),
      thinking: thinking.trim(),
      page: String(page || '').trim(),
      chapter: String(chapter || '').trim(),
    });
    reset(); onClose();
  };

  const t = NT[type] || NT.insight;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={mo.safe}>

        {/* ── STEP 1: Book picker ── */}
        {step === 1 && (
          <>
            <View style={mo.header}>
              <TouchableOpacity onPress={handleClose}>
                <Text style={mo.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={mo.title}>New Note</Text>
              <View style={{ width: 52 }} />
            </View>

            <View style={mo.step1Strip}>
              <Text style={mo.step1StripTxt}>Which book is this note about?</Text>
            </View>

            {activeBooks.length === 0 && (
              <View style={mo.emptyBooks}>
                <Text style={mo.emptyBooksIcon}>📚</Text>
                <Text style={mo.emptyBooksTxt}>No books in progress</Text>
                <Text style={mo.emptyBooksSub}>
                  Add a book from Discover and start reading to attach notes.
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 20, gap: 10 }}>
              {activeBooks.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[mo.bookRow, bookId === b.id && mo.bookRowActive]}
                  onPress={() => { setBookId(b.id); setStep(2); }}
                  activeOpacity={0.8}
                >
                  <BookCover title={b.title} author={b.author} cover={b.cover}
                    coverId={b.coverId} width={48} height={68} />
                  <View style={mo.bookRowInfo}>
                    <Text style={mo.bookRowTitle} numberOfLines={2}>{b.title}</Text>
                    <Text style={mo.bookRowAuthor}>{b.author}</Text>
                    <View style={[mo.bookRowStatus, {
                      backgroundColor: b.status === 'reading' ? C.amberPale
                        : b.status === 'finished' ? '#E9F7EF' : C.cream
                    }]}>
                      <Text style={[mo.bookRowStatusTxt, {
                        color: b.status === 'reading' ? C.amber
                          : b.status === 'finished' ? '#1E8449' : C.inkMuted
                      }]}>
                        {b.status === 'reading' ? '📖 Reading'
                          : b.status === 'finished' ? '✓ Finished'
                          : 'Want to read'}
                      </Text>
                    </View>
                  </View>
                  <Text style={mo.bookRowArrow}>›</Text>
                </TouchableOpacity>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </>
        )}

        {/* ── STEP 2: Note editor ── */}
        {step === 2 && (
          <>
            <View style={mo.header}>
              <TouchableOpacity onPress={() => setStep(1)}>
                <Text style={mo.cancel}>← Back</Text>
              </TouchableOpacity>
              <Text style={mo.title}>New Note</Text>
              <TouchableOpacity onPress={handleSave} disabled={!text.trim()}>
                <Text style={[mo.save, !text.trim() && mo.saveOff]}>Save</Text>
              </TouchableOpacity>
            </View>

            {selectedBook && (
              <TouchableOpacity style={mo.selectedBookBanner} onPress={() => setStep(1)} activeOpacity={0.8}>
                <BookCover title={selectedBook.title} author={selectedBook.author}
                  cover={selectedBook.cover} coverId={selectedBook.coverId} width={32} height={44} />
                <View style={{ flex: 1 }}>
                  <Text style={mo.selectedBookTitle} numberOfLines={1}>{selectedBook.title}</Text>
                  <Text style={mo.selectedBookAuthor}>{selectedBook.author}</Text>
                </View>
                <Text style={mo.selectedBookChange}>Change</Text>
              </TouchableOpacity>
            )}

            <ScrollView style={mo.scroll} keyboardShouldPersistTaps="handled">
              <Text style={mo.label}>NOTE TYPE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
                {Object.entries(NT).map(([key, val]) => (
                  <TouchableOpacity key={key}
                    style={[mo.typePill, type === key && { backgroundColor: val.color, borderColor: val.color }]}
                    onPress={() => setType(key)} activeOpacity={0.8}>
                    <Text style={[mo.typePillIcon, type === key && { color: '#fff' }]}>{val.icon}</Text>
                    <Text style={[mo.typePillTxt, type === key && { color: '#fff' }]}>{val.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[mo.typeHint, { color: t.color }]}>{t.desc}</Text>

              <Text style={mo.label}>
                {type === 'quote' ? 'QUOTE' : type === 'question' ? 'QUESTION' :
                 type === 'action' ? 'ACTION' : type === 'summary' ? 'SUMMARY' :
                 type === 'connection' ? 'CONNECTING IDEA' : 'INSIGHT'}
              </Text>
              <TextInput style={[mo.mainInput, { borderColor: t.color + '55' }]}
                value={text} onChangeText={setText} multiline numberOfLines={4}
                textAlignVertical="top" placeholderTextColor={C.inkFaint}
                autoFocus
                placeholder={
                  type === 'quote'      ? 'Paste or type the exact words...' :
                  type === 'question'   ? 'What do you want to investigate?' :
                  type === 'action'     ? 'What will you specifically do?' :
                  type === 'summary'    ? 'Distil the chapter to its core idea...' :
                  type === 'connection' ? 'What idea connects across books?' :
                  'What did you realise or understand?'
                } />

              <Text style={mo.label}>
                MY THINKING <Text style={mo.optional}>— why this matters to you</Text>
              </Text>
              <TextInput style={mo.thinkInput}
                value={thinking} onChangeText={setThinking} multiline numberOfLines={3}
                textAlignVertical="top" placeholderTextColor={C.inkFaint}
                placeholder="How does this change how you think or act?" />

              <Text style={mo.label}>LOCATION</Text>
              <View style={mo.locRow}>
                <View style={{ flex: 1 }}>
                  <Text style={mo.locLabel}>Page</Text>
                  <TextInput style={mo.locInput} value={page} onChangeText={setPage}
                    keyboardType="numeric" placeholder="e.g. 148" placeholderTextColor={C.inkFaint} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={mo.locLabel}>Chapter / Section</Text>
                  <TextInput style={mo.locInput} value={chapter} onChangeText={setChapter}
                    placeholder="e.g. Chapter 4" placeholderTextColor={C.inkFaint} />
                </View>
              </View>

              <View style={{ height: 48 }} />
            </ScrollView>
          </>
        )}

      </SafeAreaView>
    </Modal>
  );
}

