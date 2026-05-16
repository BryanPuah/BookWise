import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated,
  Dimensions, KeyboardAvoidingView, Platform, PanResponder, Modal,
  TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { AppText as Text, AppTextInput as TextInput } from '../components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { genId } from '../schema';
import { useTheme, covers } from '../theme';
import { LoadingState, ErrorState, classifyFetchError } from '../components/StateView';

const { width: SW, height: SH } = Dimensions.get('window');
const PAGE_SIZE = 20;
// RN fetch has no default timeout — a stalled connection hangs forever and
// the user just sees a spinner. 8s is long enough for Open Library on a
// slow-but-working link, short enough to surface trouble before patience runs out.
const FETCH_TIMEOUT_MS = 8000;
async function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
// COVER_KEYS captures the initial covers keys; these are stable across all
// themes (sage/amber/navy/rose/plum/slate) so it's safe to read at module load.
const COVER_KEYS = Object.keys(covers);

// ── Format suggestions for the manual-add sheet ────────────────────────
// Free-text — these are tap-to-fill suggestions, not a fixed list.
const FORMAT_SUGGESTIONS = [
  { label: 'Book',      icon: '📖' },
  { label: 'Article',   icon: '📰' },
  { label: 'Website',   icon: '🌐' },
  { label: 'PDF',       icon: '📄' },
  { label: 'Newspaper', icon: '🗞️' },
  { label: 'Magazine',  icon: '📓' },
  { label: 'Podcast',   icon: '🎧' },
  { label: 'Other',     icon: '✦' },
];

// Formats that have a meaningful "length" — drives whether we show the length field
const FORMATS_WITH_LENGTH = ['book', 'pdf', 'magazine'];
// Formats that have a URL — drives whether we show the URL field
const FORMATS_WITH_URL = ['article', 'website', 'pdf', 'podcast'];

// ── All genres / categories ─────────────────────────────────────────────
const ALL_GENRES = [
  { group: 'Mind & Behaviour',     items: ['Psychology','Cognitive Science','Neuroscience','Philosophy','Mindfulness','Happiness'] },
  { group: 'Business & Finance',   items: ['Business','Entrepreneurship','Leadership','Management','Investing','Economics','Marketing'] },
  { group: 'Personal Growth',      items: ['Self-help','Productivity','Habits','Creativity','Communication','Motivation'] },
  { group: 'Science & Technology', items: ['Science','Physics','Biology','Mathematics','AI & Technology','Climate','Evolution'] },
  { group: 'History & Society',    items: ['History','Politics','Sociology','Anthropology','Religion','Journalism','Education'] },
  { group: 'Fiction & Literature', items: ['Fiction','Classic Literature','Science Fiction','Mystery','Fantasy','Thriller','Historical Fiction'] },
  { group: 'Health & Lifestyle',   items: ['Health','Nutrition','Exercise','Mental Health','Relationships','Parenting'] },
  { group: 'Biography & Memoir',   items: ['Biography','Memoir','Autobiography','True Crime','Essays'] },
];

function getImageUrl(id, size = 'L') {
  return `https://covers.openlibrary.org/b/id/${id}-${size}.jpg`;
}

// ── Book cover thumbnail ────────────────────────────────────────────────
function CoverThumb({ coverId, title, width = 56, height = 80 }) {
  const { C, F } = useTheme();
  return coverId ? (
    <Image
      source={getImageUrl(coverId, 'M')}
      style={{ width, height, borderRadius: 6, backgroundColor: C.creamDark }}
      contentFit="cover"
      cachePolicy="disk"
      transition={150}
    />
  ) : (
    <LinearGradient
      colors={[C.heroTop, C.heroBot]}
      style={{ width, height, borderRadius: 6, alignItems: 'center', justifyContent: 'center', padding: 6 }}
    >
      <Text style={{ fontFamily: F.serif, color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 13 }}
        numberOfLines={4}>{title}</Text>
    </LinearGradient>
  );
}

// ── Result row ──────────────────────────────────────────────────────────
function ResultRow({ book, added, onPress }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    row:          { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.border },
    rowCover:     { position: 'relative' },
    rowAddedDot:  { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center' },
    rowAddedDotTxt: { fontFamily: F.serif, color: C.white, fontSize: 9, fontWeight: '800' },
    rowInfo:      { flex: 1 },
    rowTitle:     { fontFamily: F.serif, fontSize: 14, fontWeight: '600', color: C.ink, lineHeight: 20, marginBottom: 3 },
    rowAuthor:    { fontFamily: F.serif, fontSize: 12, color: C.inkMuted, marginBottom: 3 },
    rowGenre:     { fontFamily: F.serif, fontSize: 11, color: C.inkFaint, marginBottom: 2 },
    rowPages:     { fontFamily: F.serif, fontSize: 11, color: C.inkFaint },
    rowChevron:   { fontFamily: F.serif, fontSize: 20, color: C.inkFaint },
  }), [themeVersion]);

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>
      <View style={s.rowCover}>
        <CoverThumb coverId={book.cover_i} title={book.title} width={52} height={74} />
        {added && (
          <View style={s.rowAddedDot}>
            <Text style={s.rowAddedDotTxt}>✓</Text>
          </View>
        )}
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowTitle} numberOfLines={2}>{book.title}</Text>
        <Text style={s.rowAuthor} numberOfLines={1}>
          {book.author_name?.[0] || 'Unknown author'}
          {book.first_publish_year ? `  ·  ${book.first_publish_year}` : ''}
        </Text>
        {book.subject?.length > 0 && (
          <Text style={s.rowGenre} numberOfLines={1}>
            {book.subject.slice(0, 2).join('  ·  ')}
          </Text>
        )}
        {book.number_of_pages_median > 0 && (
          <Text style={s.rowPages}>{book.number_of_pages_median} pages</Text>
        )}
      </View>
      <Text style={s.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}


// ── Genre filter sheet ──────────────────────────────────────────────────
function GenreSheet({ onSelect, onClose, activeGenres = [] }) {
  const { C, F, themeVersion } = useTheme();
  const insets = useSafeAreaInsets();
  // Cap sheet height so there's always a comfortable tap-to-dismiss area
  // above it. Smaller of ~78% of screen, or (screen - safe-area top - 60).
  const sheetMaxHeight = Math.min(SH * 0.78, SH - insets.top - 60);
  const s = useMemo(() => StyleSheet.create({
    bookSheetOverlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim },
    bookSheet:          { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: C.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
    bookSheetHandle:    { alignItems: 'center', paddingVertical: 14 },
    bookSheetHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },
    genreSheet:         { height: sheetMaxHeight },
    genreSheetTitle:    { fontFamily: F.serif, fontSize: 18, fontWeight: '700', color: C.ink, paddingHorizontal: 20, paddingBottom: 16, letterSpacing: -0.3 },
    genreGroup:         { paddingHorizontal: 20, marginBottom: 20 },
    genreGroupLabel:    { fontFamily: F.sans, fontSize: 11, fontWeight: '700', color: C.inkFaint, letterSpacing: 0.8, marginBottom: 10 },
    genreGroupItems:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    genreItem:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
    genreItemTxt:       { fontFamily: F.serif, fontSize: 13, fontWeight: '500', color: C.ink },
    genreItemActive:    { backgroundColor: C.sage, borderColor: C.sage },
    genreItemTxtActive: { fontFamily: F.serif, color: C.white, fontWeight: '700' },
  }), [themeVersion, sheetMaxHeight]);

  const translateY = useRef(new Animated.Value(700)).current;
  const dragStart  = useRef(0);

  React.useEffect(() => {
    translateY.setValue(700);
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 58, friction: 12 }).start();
  }, []);

  const close = (cb) => {
    Animated.timing(translateY, { toValue: 700, duration: 220, useNativeDriver: true }).start(() => {
      onClose(); if (cb) cb();
    });
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => {
      translateY.stopAnimation(v => { dragStart.current = v; });
    },
    onPanResponderMove: (_, g) => {
      translateY.setValue(Math.max(0, dragStart.current + g.dy));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100 || g.vy > 0.4) close();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 16 }).start();
    },
  })).current;

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => close()}>
      <View style={s.bookSheetOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => close()} activeOpacity={1} />
        <Animated.View style={[s.bookSheet, s.genreSheet, { transform: [{ translateY }] }]}>
          {/* Drag zone — handle + title */}
          <View {...panResponder.panHandlers}>
            <View style={s.bookSheetHandle}>
              <View style={s.bookSheetHandleBar} />
            </View>
            <Text style={s.genreSheetTitle}>Browse by genre</Text>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
            {ALL_GENRES.map(group => (
              <View key={group.group} style={s.genreGroup}>
                <Text style={s.genreGroupLabel}>{group.group}</Text>
                <View style={s.genreGroupItems}>
                  {group.items.map((item, j) => (
                    <TouchableOpacity
                      key={`${group.group}-${item}-${j}`}
                      style={[s.genreItem, activeGenres.includes(item) && s.genreItemActive]}
                      onPress={() => close(() => onSelect(item))}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.genreItemTxt, activeGenres.includes(item) && s.genreItemTxtActive]}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Add reading item sheet (format-agnostic) ───────────────────────────
function AddReadingItemSheet({ onAdd, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    ownOverlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim },
    ownSheet:         { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', shadowColor: C.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
    ownHandle:        { alignItems: 'center', paddingVertical: 14 },
    ownHandleBar:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },
    ownScrollContent: { paddingHorizontal: 20, paddingBottom: 320 },
    ownBookTitle:     { fontFamily: F.serif, fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4, marginBottom: 6 },
    ownBookSub:       { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, marginBottom: 22, lineHeight: 19 },
    ownBookForm:      { gap: 16, marginBottom: 16 },
    ownBookField:     { gap: 6 },
    ownBookFieldLabel:{ fontFamily: F.sans, fontSize: 11, fontWeight: '700', color: C.inkMuted, letterSpacing: 0.5 },
    ownBookInput:     { backgroundColor: C.cream, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontFamily: F.sans, fontSize: 15, color: C.ink },

    // Format chips inside the manual-add sheet
    formatChipsRow:   { gap: 6, paddingTop: 8, paddingRight: 4 },
    formatChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
    formatChipActive: { backgroundColor: C.sagePale, borderColor: C.sage },
    formatChipIcon:   { fontSize: 12 },
    formatChipTxt:    { fontFamily: F.serif, fontSize: 12, fontWeight: '500', color: C.inkSoft },
    formatChipTxtActive: { fontFamily: F.serif, color: C.sage, fontWeight: '700' },

    addBtn:        { backgroundColor: C.ink, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
    addBtnTxt:     { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.white, letterSpacing: -0.2 },
    wantBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.cream, borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: C.border },
    wantBtnIcon:   { fontSize: 15 },
    wantBtnTxt:    { fontFamily: F.serif, fontSize: 14, fontWeight: '600', color: C.ink },
    closeBtn:      { paddingVertical: 12, alignItems: 'center' },
    closeBtnTxt:   { fontFamily: F.serif, fontSize: 14, color: C.inkMuted, fontWeight: '500' },
  }), [themeVersion]);

  const translateY = useRef(new Animated.Value(700)).current;
  const dragStart  = useRef(0);

  // Form state
  const [format,    setFormat]    = useState('');     // free-text format
  const [title,     setTitle]     = useState('');
  const [author,    setAuthor]    = useState('');     // "Author / Source"
  const [genre,     setGenre]     = useState('');
  const [length,    setLength]    = useState('');     // pages OR minutes (smart)
  const [url,       setUrl]       = useState('');

  const formatRef = useRef(null);
  const titleRef  = useRef(null);
  const authorRef = useRef(null);
  const genreRef  = useRef(null);
  const lengthRef = useRef(null);
  const urlRef    = useRef(null);

  React.useEffect(() => {
    translateY.setValue(700);
    Animated.spring(translateY, {
      toValue: 0, useNativeDriver: true, tension: 58, friction: 12,
    }).start();
    // Auto-focus the first field as the sheet finishes rising.
    // Delay matches roughly the spring duration so the keyboard
    // animates up *with* the sheet, not before it.
    const t = setTimeout(() => formatRef.current?.focus(), 280);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    Animated.timing(translateY, {
      toValue: 700, duration: 220, useNativeDriver: true,
    }).start(() => onClose());
  };

  // Drag-to-dismiss
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) =>
      g.dy > 5 && g.dy > Math.abs(g.dx),
    onPanResponderGrant: () => {
      translateY.stopAnimation(v => { dragStart.current = v; });
    },
    onPanResponderMove: (_, g) => {
      const next = dragStart.current + g.dy;
      translateY.setValue(Math.max(0, next));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100 || g.vy > 0.4) {
        close();
      } else {
        Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true, tension: 100, friction: 16,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 100, friction: 16,
      }).start();
    },
  })).current;

  // Smart field visibility based on format keyword
  const formatKey   = format.trim().toLowerCase();
  const showLength  = !formatKey || FORMATS_WITH_LENGTH.includes(formatKey);
  const showUrl     = formatKey && FORMATS_WITH_URL.includes(formatKey);

  // Smart copy based on format
  const isPodcast       = formatKey === 'podcast' || formatKey === 'audio';
  const isArticleish    = ['article','website','newspaper','magazine','pdf'].includes(formatKey);
  const authorLabel     = isPodcast ? 'HOST OR PUBLISHER'
                        : isArticleish ? 'AUTHOR OR PUBLICATION'
                        : 'AUTHOR';
  const authorPlaceholder = isPodcast ? 'e.g. The Daily, NYT'
                          : isArticleish ? 'Author or publication name'
                          : 'Author name';
  const lengthLabel     = isPodcast ? 'LENGTH (MINUTES)' : 'PAGES';
  const lengthPlaceholder = isPodcast ? 'Episode length in minutes' : 'Number of pages';

  const canSave = title.trim().length > 0;

  const buildEntry = () => ({
    title:  title.trim(),
    author: author.trim(),
    pages:  parseInt(length) || 0,
    genre:  genre.trim(),
    format: format.trim() || 'Other',
    url:    url.trim(),
  });

  const pickFormat = (f) => {
    setFormat(f);
    // auto-advance focus to title if user hasn't typed yet
    if (!title) setTimeout(() => titleRef.current?.focus(), 50);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={s.ownOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={close}
          activeOpacity={1}
        />
        <Animated.View style={[s.ownSheet, { transform: [{ translateY }] }]}>
          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={s.ownHandle}>
            <View style={s.ownHandleBar} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.ownScrollContent}
          >
            {/* Header — tap to dismiss keyboard */}
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View>
                  <Text style={s.ownBookTitle}>Add reading item</Text>
                  <Text style={s.ownBookSub}>
                    Anything you read — books, articles, websites, PDFs. Add it manually if search can't find it.
                  </Text>
                </View>
              </TouchableWithoutFeedback>

              <View style={s.ownBookForm}>

                {/* ── Format ─────────────────────────────────────────── */}
                <View style={s.ownBookField}>
                  <Text style={s.ownBookFieldLabel}>FORMAT</Text>
                  <TextInput
                    ref={formatRef}
                    style={s.ownBookInput}
                    value={format}
                    onChangeText={setFormat}
                    placeholder="e.g. Book, Substack post, audiobook…"
                    placeholderTextColor={C.inkFaint}
                    returnKeyType="next"
                    onSubmitEditing={() => titleRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                  {/* Suggestion chips */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.formatChipsRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {FORMAT_SUGGESTIONS.map(f => {
                      const active = formatKey === f.label.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={f.label}
                          style={[s.formatChip, active && s.formatChipActive]}
                          onPress={() => pickFormat(f.label)}
                          activeOpacity={0.75}
                        >
                          <Text style={s.formatChipIcon}>{f.icon}</Text>
                          <Text style={[s.formatChipTxt, active && s.formatChipTxtActive]}>
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* ── Title ──────────────────────────────────────────── */}
                <View style={s.ownBookField}>
                  <Text style={s.ownBookFieldLabel}>TITLE *</Text>
                  <TextInput
                    ref={titleRef}
                    style={s.ownBookInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder={
                      formatKey === 'article' || formatKey === 'website'
                        ? 'Headline or page title'
                        : isPodcast
                        ? 'Episode or show title'
                        : 'Title'
                    }
                    placeholderTextColor={C.inkFaint}
                    returnKeyType="next"
                    onSubmitEditing={() => authorRef.current?.focus()}
                    blurOnSubmit={false}
                  />
                </View>

                {/* ── Author / Source ───────────────────────────────── */}
                <View style={s.ownBookField}>
                  <Text style={s.ownBookFieldLabel}>{authorLabel}</Text>
                  <TextInput
                    ref={authorRef}
                    style={s.ownBookInput}
                    value={author}
                    onChangeText={setAuthor}
                    placeholder={authorPlaceholder}
                    placeholderTextColor={C.inkFaint}
                    returnKeyType="next"
                    onSubmitEditing={() => {
                      if (showUrl) urlRef.current?.focus();
                      else genreRef.current?.focus();
                    }}
                    blurOnSubmit={false}
                  />
                </View>

                {/* ── URL (conditional) ─────────────────────────────── */}
                {showUrl && (
                  <View style={s.ownBookField}>
                    <Text style={s.ownBookFieldLabel}>LINK</Text>
                    <TextInput
                      ref={urlRef}
                      style={s.ownBookInput}
                      value={url}
                      onChangeText={setUrl}
                      placeholder="https://"
                      placeholderTextColor={C.inkFaint}
                      keyboardType="url"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                      onSubmitEditing={() => genreRef.current?.focus()}
                      blurOnSubmit={false}
                    />
                  </View>
                )}

                {/* ── Topic / Genre ─────────────────────────────────── */}
                <View style={s.ownBookField}>
                  <Text style={s.ownBookFieldLabel}>TOPIC</Text>
                  <TextInput
                    ref={genreRef}
                    style={s.ownBookInput}
                    value={genre}
                    onChangeText={setGenre}
                    placeholder="e.g. Psychology, Politics, Tech"
                    placeholderTextColor={C.inkFaint}
                    returnKeyType={showLength ? 'next' : 'done'}
                    onSubmitEditing={() => {
                      if (showLength) lengthRef.current?.focus();
                      else Keyboard.dismiss();
                    }}
                    blurOnSubmit={!showLength}
                  />
                </View>

                {/* ── Length (conditional) ──────────────────────────── */}
                {showLength && (
                  <View style={s.ownBookField}>
                    <Text style={s.ownBookFieldLabel}>{lengthLabel}</Text>
                    <TextInput
                      ref={lengthRef}
                      style={s.ownBookInput}
                      value={length}
                      onChangeText={setLength}
                      placeholder={lengthPlaceholder}
                      placeholderTextColor={C.inkFaint}
                      keyboardType="numeric"
                      returnKeyType="done"
                    />
                  </View>
                )}

              </View>

              {/* Submit */}
              <TouchableOpacity
                style={[s.addBtn, !canSave && { opacity: 0.4 }]}
                disabled={!canSave}
                onPress={() => { onAdd(buildEntry(), 'reading'); close(); }}
                activeOpacity={0.85}
              >
                <Text style={s.addBtnTxt}>Add to library</Text>
              </TouchableOpacity>

              <View style={{ height: 10 }} />

              <TouchableOpacity
                style={[s.wantBtn, !canSave && { opacity: 0.4 }]}
                disabled={!canSave}
                onPress={() => { onAdd(buildEntry(), 'want_to_read'); close(); }}
                activeOpacity={0.85}
              >
                <Text style={s.wantBtnIcon}>🔖</Text>
                <Text style={s.wantBtnTxt}>Save for later</Text>
              </TouchableOpacity>

              <TouchableOpacity style={s.closeBtn} onPress={close} activeOpacity={0.7}>
                <Text style={s.closeBtnTxt}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
      </View>
    </Modal>
  );
}

// ── Book detail sheet ───────────────────────────────────────────────────
function BookSheet({ book, added, onAdd, onAddWantToRead, onClose }) {
  const { C, F, themeVersion } = useTheme();
  const s = useMemo(() => StyleSheet.create({
    bookSheetOverlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: C.scrim },
    bookSheet:          { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: C.shadow, shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
    bookSheetHandle:    { alignItems: 'center', paddingVertical: 14 },
    bookSheetHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },
    sheetTop:      { flexDirection: 'row', gap: 16, paddingHorizontal: 20, marginBottom: 16 },
    sheetCoverShadow: { shadowColor: C.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
    sheetTitle:    { fontFamily: F.serif, fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3, lineHeight: 24, marginBottom: 6, flex: 1 },
    sheetTopInfo:  { flex: 1, justifyContent: 'center' },
    sheetAuthor:   { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, marginBottom: 10 },
    sheetPills:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    pill:          { backgroundColor: C.sagePale, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: C.sage },
    pillTxt:       { fontFamily: F.serif, fontSize: 11, color: C.sage, fontWeight: '700' },
    genrePill:     { backgroundColor: C.sagePale, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.sage },
    genrePillTxt:  { fontFamily: F.serif, fontSize: 11, color: C.sage, fontWeight: '700' },
    sheetActions:  { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
    addBtn:        { backgroundColor: C.ink, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
    addBtnTxt:     { fontFamily: F.sans, fontSize: 15, fontWeight: '700', color: C.white, letterSpacing: -0.2 },
    addBtnSub:     { fontFamily: F.serif, fontSize: 11, color: C.inkFaint, textAlign: 'center' },
    wantBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.cream, borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: C.border },
    wantBtnIcon:   { fontSize: 15 },
    wantBtnTxt:    { fontFamily: F.serif, fontSize: 14, fontWeight: '600', color: C.ink },
    alreadyAdded:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.sagePale, borderRadius: 14, padding: 14 },
    alreadyAddedIcon: { fontSize: 20, color: C.forest },
    alreadyAddedTxt:  { fontFamily: F.serif, fontSize: 14, fontWeight: '600', color: C.forest },
    alreadyAddedSub:  { fontFamily: F.serif, fontSize: 11, color: C.sage, marginTop: 2 },
    closeBtn:      { paddingVertical: 12, alignItems: 'center' },
    closeBtnTxt:   { fontFamily: F.serif, fontSize: 14, color: C.inkMuted, fontWeight: '500' },
  }), [themeVersion]);

  const translateY = useRef(new Animated.Value(700)).current;
  const dragStart  = useRef(0);

  React.useEffect(() => {
    translateY.setValue(700);
    Animated.spring(translateY, {
      toValue: 0, useNativeDriver: true, tension: 58, friction: 12,
    }).start();
  }, []);

  const close = () => {
    Animated.timing(translateY, {
      toValue: 700, duration: 220, useNativeDriver: true,
    }).start(() => onClose());
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => false,
    onPanResponderGrant: () => {
      translateY.stopAnimation(v => { dragStart.current = v; });
    },
    onPanResponderMove: (_, g) => {
      translateY.setValue(Math.max(0, dragStart.current + g.dy));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 100 || g.vy > 0.4) close();
      else Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 100, friction: 16,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 100, friction: 16,
      }).start();
    },
  })).current;

  if (!book) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={s.bookSheetOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={close} activeOpacity={1} />
        <Animated.View style={[s.bookSheet, { transform: [{ translateY }] }]}>

          {/* Drag zone — handle + cover row */}
          <View {...panResponder.panHandlers}>
            <View style={s.bookSheetHandle}>
              <View style={s.bookSheetHandleBar} />
            </View>

            {/* Cover + info */}
            <View style={s.sheetTop}>
              <View style={s.sheetCoverShadow}>
                <CoverThumb coverId={book.cover_i} title={book.title} width={88} height={126} />
              </View>
              <View style={s.sheetTopInfo}>
                <Text style={s.sheetTitle} numberOfLines={3}>{book.title}</Text>
                <Text style={s.sheetAuthor}>{book.author_name?.[0] || 'Unknown'}</Text>
                <View style={s.sheetPills}>
                  {book.first_publish_year > 0 && (
                    <View style={s.pill}><Text style={s.pillTxt}>{book.first_publish_year}</Text></View>
                  )}
                  {book.number_of_pages_median > 0 && (
                    <View style={s.pill}><Text style={s.pillTxt}>{book.number_of_pages_median} pages</Text></View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Genre tags — horizontal scroll */}
          {book.subject?.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 6, paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {book.subject.slice(0, 8).map((g, i) => (
                <View key={i} style={s.genrePill}>
                  <Text style={s.genrePillTxt}>{g}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Actions */}
          <View style={s.sheetActions}>
            {!added ? (
              <>
                <TouchableOpacity
                  style={s.addBtn}
                  onPress={() => { onAdd(book, 'reading'); close(); }}
                  activeOpacity={0.85}
                >
                  <Text style={s.addBtnTxt}>Add to library</Text>
                </TouchableOpacity>

                <View style={{ height: 10 }} />

                <TouchableOpacity
                  style={s.wantBtn}
                  onPress={() => { onAddWantToRead(book); close(); }}
                  activeOpacity={0.85}
                >
                  <Text style={s.wantBtnIcon}>🔖</Text>
                  <Text style={s.wantBtnTxt}>Save to Read Later</Text>
                </TouchableOpacity>

                <Text style={s.addBtnSub}>Start taking notes right after adding</Text>
              </>
            ) : (
              <View style={s.alreadyAdded}>
                <Text style={s.alreadyAddedIcon}>✓</Text>
                <View>
                  <Text style={s.alreadyAddedTxt}>Already in your library</Text>
                  <Text style={s.alreadyAddedSub}>Open the Library tab to add notes</Text>
                </View>
              </View>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={close} activeOpacity={0.7}>
              <Text style={s.closeBtnTxt}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────
// Deterministic background colour for a category tile. Hash the genre name
// into one of a few moody dark palette entries so colours feel curated.
const CATEGORY_PALETTE = [
  '#2C3E2D', // forest green
  '#3D4A5C', // slate
  '#5B4636', // warm brown
  '#3C3855', // muted indigo
  '#4A3F3F', // wine
  '#2F4A4F', // deep teal
];
function categoryColor(genre) {
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = (hash * 31 + genre.charCodeAt(i)) | 0;
  }
  return CATEGORY_PALETTE[Math.abs(hash) % CATEGORY_PALETTE.length];
}

export function DiscoverScreen() {
  const { C, F, themeVersion } = useTheme();
  const { addBook, books } = useStore();
  const [query, setQuery]             = useState('');
  const [activeGenres, setActiveGenres] = useState([]);
  const [results, setResults]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [hasMore, setHasMore]         = useState(false);
  const [totalFound, setTotalFound]   = useState(0);
  const [page, setPage]               = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [showGenreSheet, setShowGenreSheet] = useState(false);
  const [showAddOwn, setShowAddOwn]         = useState(false);

  // ── Top genres from user's library (drives Browse Categories + Recommended) ──
  const topGenres = useMemo(() => {
    const counts = {};
    books.forEach(b => {
      (b.genres || []).forEach(g => {
        const norm = (g || '').trim();
        if (!norm) return;
        counts[norm] = (counts[norm] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([genre]) => genre);
  }, [books]);

  // ── Recommended books (Open Library, based on top genre) ──
  // Memory cache: only re-fetch when topGenres actually changes
  const recoCacheRef = useRef({ key: null, books: [] });
  const [recommended, setRecommended] = useState([]);
  const [recoLoading, setRecoLoading] = useState(false);
  // null | 'offline' | 'server' — drives the ErrorState preset
  const [recoError, setRecoError] = useState(null);
  // Bumped by the Retry button to force a fresh fetch past the cache.
  const [recoRetryToken, setRecoRetryToken] = useState(0);

  useEffect(() => {
    if (!topGenres.length) {
      setRecommended([]);
      setRecoError(null);
      return;
    }
    // Use top 2 genres if available, joined with OR — gives more variety
    const queryGenres = topGenres.slice(0, 2);
    const cacheKey = queryGenres.join('|');
    if (recoRetryToken === 0 && recoCacheRef.current.key === cacheKey) {
      setRecommended(recoCacheRef.current.books);
      setRecoError(null);
      return;
    }
    let cancelled = false;
    setRecoLoading(true);
    setRecoError(null);
    (async () => {
      try {
        const q = queryGenres.map(g => `subject:"${g}"`).join(' OR ');
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i,subject&limit=24`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const docs = (data.docs || [])
          .filter(r => r.key && r.title && r.author_name?.length && r.cover_i);
        // Dedupe against user's library. Keep up to 20 so "View All" has a
        // worthwhile list; the horizontal preview slices to the first 4.
        const libKeys = new Set(books.map(b => b.olKey).filter(Boolean));
        const filtered = docs.filter(d => !libKeys.has(d.key)).slice(0, 20);
        if (!cancelled) {
          recoCacheRef.current = { key: cacheKey, books: filtered };
          setRecommended(filtered);
        }
      } catch (err) {
        if (!cancelled) {
          setRecommended([]);
          setRecoError(classifyFetchError(err));
        }
      } finally {
        if (!cancelled) setRecoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topGenres.join('|'), recoRetryToken]); // intentionally stringified to compare values not refs

  const addedKeys = new Set(books.map(b => b.olKey).filter(Boolean));

  // null | 'offline' | 'server' — drives the ErrorState preset
  const [searchError, setSearchError] = useState(null);

  const fetchResults = useCallback(async (q, pageIndex = 0, append = false) => {
    const offset = pageIndex * PAGE_SIZE;
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,first_publish_year,number_of_pages_median,subject,cover_i&limit=${PAGE_SIZE}&offset=${offset}`;
    const res  = await fetchWithTimeout(url);
    // fetch() resolves on HTTP errors — escalate to a throw so callers' catch
    // blocks can distinguish "server unhappy" from "zero matches".
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const docs = (data.docs || []).filter(r => r.key && r.title && r.author_name?.length);
    setTotalFound(data.numFound || 0);
    setHasMore(offset + PAGE_SIZE < (data.numFound || 0));
    if (append) setResults(prev => [...prev, ...docs]);
    else setResults(docs);
    return docs;
  }, []);

  const handleSearch = async (overrideQuery) => {
    const q = (overrideQuery ?? query).trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setCurrentQuery(q);
    setPage(0);
    setSearchError(null);
    try { await fetchResults(q, 0, false); }
    catch (err) {
      setResults([]);
      setSearchError(classifyFetchError(err));
    }
    finally { setLoading(false); }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    try { await fetchResults(currentQuery, nextPage, true); }
    finally { setLoadingMore(false); }
  };

  const buildBookEntry = (book, status = 'want_to_read') => ({
    id: genId('bk'),
    olKey: book.key,
    title: book.title,
    author: book.author_name?.[0] || 'Unknown',
    cover: COVER_KEYS[Math.floor(Math.random() * COVER_KEYS.length)],
    coverId: book.cover_i || null,
    pageCount: book.number_of_pages_median || 0,
    currentPage: 0,
    genres: book.subject?.slice(0, 3) || [],
    description: book.subject?.length
      ? `Subjects: ${book.subject.slice(0, 8).join(', ')}` : '',
    status,
    format: 'Book', // search results are always books from Open Library
  });

  const handleAdd = useCallback((book, status = 'reading') => {
    addBook(buildBookEntry(book, status));
  }, [addBook]);

  const handleAddWantToRead = useCallback((book) => {
    if (!addedKeys.has(book.key)) {
      addBook(buildBookEntry(book, 'want_to_read'));
    }
  }, [addBook, addedKeys]);

  const handleGenreSelect = (genre) => {
    setActiveGenres(prev => {
      const next = prev.includes(genre)
        ? prev.filter(g => g !== genre)      // deselect if already active
        : [...prev, genre];                  // add to selection
      // Fire search with combined genres — keep the search bar untouched
      // so the category acts as an immediate filter, not a text query.
      const q = next.length > 0 ? next.join(' ') : '';
      if (q) {
        handleSearch(q);
      } else {
        clear();
      }
      return next;
    });
  };

  // Show all cached recommended books in the results list. Used by the
  // "View All" button next to "Recommended for You".
  const showAllRecommended = () => {
    setActiveGenres([]);
    setQuery('');
    setResults(recommended);
    setTotalFound(recommended.length);
    setHasMore(false);
    setSearched(true);
    setCurrentQuery('Recommended for you');
    setPage(0);
  };

  const handleAddManualItem = useCallback(({ title, author, pages, genre, format, url }, status = 'want_to_read') => {
    addBook({
      id: genId('bk'),
      olKey: null,
      title,
      author: author || (format && format !== 'Book' ? '' : 'Unknown'),
      cover: COVER_KEYS[Math.floor(Math.random() * COVER_KEYS.length)],
      coverId: null,
      pageCount: pages || 0,
      currentPage: 0,
      genres: genre ? [genre] : [],
      description: '',
      status,
      // New fields — backwards-compatible additions
      format: format || 'Book',
      url:    url || '',
    });
  }, [addBook]);

  const clear = () => {
    setSearched(false); setResults([]);
    setQuery(''); setCurrentQuery(''); setPage(0);
    setActiveGenres([]);
  };

  const s = useMemo(() => StyleSheet.create({
    safe: { flex: 1, backgroundColor: C.paper },

    // Header
    header:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
    title:    { fontFamily: F.serif, fontSize: 30, fontWeight: '700', color: C.ink, letterSpacing: -0.6 },
    subtitle: { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, marginTop: 3, lineHeight: 19 },

    // Search row — matches NotesScreen.ev.searchWrap aesthetic:
    // cream pill, no border, smaller radius, Ionicons inside instead of emoji.
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 20,
      marginTop: 8,
      marginBottom: 14,
    },
    searchWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: C.cream,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    searchInput: { flex: 1, fontFamily: F.sans, fontSize: 15, color: C.ink },
    searchClearBtn: { padding: 2 },

    // + Add — same pill style with subtle ink accent
    addOwnPill: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: C.sage,
    },
    addOwnPillTxt: { fontFamily: F.serif, fontSize: 12, fontWeight: '700', color: C.white, letterSpacing: 0.2 },

    promptWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 40 },
    promptIcon: { fontSize: 40, marginBottom: 14 },
    promptTxt:  { fontFamily: F.serif, fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
    promptSub:  { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 19 },

    // Empty search
    emptyWrap:    { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyIcon:    { fontSize: 40, marginBottom: 16 },
    emptyTxt:     { fontFamily: F.serif, fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 8 },
    emptySub:     { fontFamily: F.serif, fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    tryClearBtn:  { backgroundColor: C.ink, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
    tryClearTxt:  { fontFamily: F.sans, fontSize: 15, color: C.white, fontWeight: '700' },

    // Results
    resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
    resultsCount:  { fontFamily: F.serif, fontSize: 12, color: C.inkMuted },
    clearTxt:      { fontFamily: F.serif, fontSize: 12, color: C.amber, fontWeight: '600' },
    resultsList:   { paddingHorizontal: 16 },

    loadMoreBtn:        { marginHorizontal: 20, marginVertical: 16, backgroundColor: C.ink, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center' },
    loadMoreBtnLoading: { opacity: 0.6 },
    loadMoreTxt:        { fontFamily: F.sans, fontSize: 15, color: C.white, fontWeight: '700' },

    // ── Browse Categories + Recommended sections ──
    sectionWrap: {
      marginTop: 20,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    sectionTitle: {
      fontFamily: F.serif,
      fontSize: 22,
      color: C.ink,
      letterSpacing: -0.3,
    },
    viewAllLink: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.sage,
      fontWeight: '700',
    },
    // Category grid — 2×2 dark tiles
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 20,
      gap: 10,
    },
    categoryTile: {
      width: (SW - 50) / 2,  // (screen - 20*2 padding - 10 gap) / 2
      height: 110,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    categoryTileTxt: {
      fontFamily: F.serif,
      fontSize: 20,
      color: C.white,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    // Recommended horizontal scroll
    recoLoadingWrap: {
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recoEmpty: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.inkMuted,
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    recoCard: {
      width: 140,
    },
    recoCover: {
      width: 140,
      height: 200,
      borderRadius: 10,
      backgroundColor: C.cream,
      marginBottom: 8,
    },
    recoCoverFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
    },
    recoCoverFallbackTxt: {
      fontFamily: F.serif,
      fontSize: 13,
      color: C.ink,
      textAlign: 'center',
    },
    recoTitle: {
      fontFamily: F.serif,
      fontSize: 15,
      color: C.ink,
      letterSpacing: -0.2,
      lineHeight: 19,
      marginBottom: 2,
    },
    recoAuthor: {
      fontFamily: F.serif,
      fontSize: 12,
      color: C.inkMuted,
      marginBottom: 6,
    },
    recoGenrePill: {
      alignSelf: 'flex-start',
      backgroundColor: C.sagePale,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    recoGenrePillTxt: {
      fontFamily: F.serif,
      fontSize: 9,
      fontWeight: '700',
      color: C.sage,
      letterSpacing: 0.5,
    },

    // ── Results overlay (pageSheet modal) ──
    overlayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 12,
      gap: 8,
    },
    overlayBackBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
    },
    overlayTitle: {
      flex: 1,
      fontFamily: F.serif,
      fontSize: 18,
      fontWeight: '700',
      color: C.ink,
      letterSpacing: -0.3,
    },
  }), [themeVersion]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Discover</Text>
        <Text style={s.subtitle}>Search the catalogue, or add anything you're reading manually</Text>
      </View>

      {/* ── Search bar + Add reading item on same row ── */}
      <View style={s.searchRow}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={C.inkMuted} />
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Title, author or ISBN..."
            placeholderTextColor={C.inkFaint}
            returnKeyType="search"
            onSubmitEditing={() => handleSearch()}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clear} style={s.searchClearBtn} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={16} color={C.inkMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={s.addOwnPill}
          onPress={() => setShowAddOwn(true)}
          activeOpacity={0.8}
        >
          <Text style={s.addOwnPillTxt}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* ── Content (single scroll) ──
          Browse Categories + Recommended for You always show at the top
          (when the library has at least 1 book). Below them comes search
          state — results, empty state, or the initial prompt. */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Browse Categories — top 4 genres from user's library */}
        {topGenres.length > 0 && (
          <View style={s.sectionWrap}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Browse Categories</Text>
              <TouchableOpacity
                onPress={() => setShowGenreSheet(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
              >
                <Text style={s.viewAllLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={s.categoryGrid}>
              {topGenres.map(g => (
                <TouchableOpacity
                  key={g}
                  style={[s.categoryTile, { backgroundColor: categoryColor(g) }]}
                  onPress={() => {
                    // Same behaviour as tapping a chip in the genre sheet
                    handleGenreSelect(g);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={s.categoryTileTxt} numberOfLines={2}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recommended for You */}
        {topGenres.length > 0 && (
          <View style={s.sectionWrap}>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Recommended for You</Text>
              {recommended.length > 0 && (
                <TouchableOpacity
                  onPress={showAllRecommended}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
                >
                  <Text style={s.viewAllLink}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            {recoLoading ? (
              <View style={s.recoLoadingWrap}>
                <ActivityIndicator size="small" color={C.inkMuted} />
              </View>
            ) : recoError ? (
              <ErrorState
                compact
                kind={recoError}
                title={recoError === 'offline' ? "You're offline" : "Couldn't reach Open Library"}
                sub={
                  recoError === 'offline'
                    ? 'Recommendations need a connection. Reconnect and retry.'
                    : 'Open Library is having a moment. Try again.'
                }
                onRetry={() => setRecoRetryToken(t => t + 1)}
              />
            ) : recommended.length === 0 ? (
              <Text style={s.recoEmpty}>No recommendations yet</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
              >
                {recommended.slice(0, 4).map((book, i) => (
                  <TouchableOpacity
                    key={book.key || i}
                    style={s.recoCard}
                    onPress={() => setSelectedBook(book)}
                    activeOpacity={0.85}
                  >
                    {book.cover_i ? (
                      <Image
                        source={getImageUrl(book.cover_i, 'L')}
                        style={s.recoCover}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={150}
                      />
                    ) : (
                      <View style={[s.recoCover, s.recoCoverFallback]}>
                        <Text style={s.recoCoverFallbackTxt} numberOfLines={3}>
                          {book.title}
                        </Text>
                      </View>
                    )}
                    <Text style={s.recoTitle} numberOfLines={2}>{book.title}</Text>
                    <Text style={s.recoAuthor} numberOfLines={1}>
                      {book.author_name?.[0] || 'Unknown'}
                    </Text>
                    {book.subject?.[0] && (
                      <View style={s.recoGenrePill}>
                        <Text style={s.recoGenrePillTxt} numberOfLines={1}>
                          {book.subject[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Initial prompt — only when library is empty (otherwise sections fill the page) */}
        {topGenres.length === 0 && (
          <View style={s.promptWrap}>
            <Text style={s.promptIcon}>🔍</Text>
            <Text style={s.promptTxt}>Find what you're reading</Text>
            <Text style={s.promptSub}>Search above, browse by genre, or tap + Add to enter anything manually</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Results overlay — page-sheet modal for search / category / recommended.
          pageSheet (vs fullScreen) leaves a comfortable gap under the notch so
          the back chevron sits well within thumb reach — matches the rest of
          the app's search/picker sheets. */}
      <Modal
        visible={searched}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={clear}
      >
        <SafeAreaView style={s.safe} edges={['top']}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>
              {/* Overlay header — back button + title */}
              <View style={s.overlayHeader}>
                <TouchableOpacity
                  onPress={clear}
                  style={s.overlayBackBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chevron-back" size={22} color={C.ink} />
                </TouchableOpacity>
                <Text style={s.overlayTitle} numberOfLines={1}>
                  {currentQuery}
                </Text>
              </View>

              {/* Search bar — refine query without leaving the overlay */}
              <View style={s.searchRow}>
                <View style={s.searchWrap}>
                  <Ionicons name="search" size={16} color={C.inkMuted} />
                  <TextInput
                    style={s.searchInput}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Title, author or ISBN..."
                    placeholderTextColor={C.inkFaint}
                    returnKeyType="search"
                    onSubmitEditing={() => handleSearch()}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setQuery('')}
                      style={s.searchClearBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close-circle" size={16} color={C.inkMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
              >
                {loading ? (
                  <LoadingState message="Searching..." />
                ) : searchError ? (
                  <ErrorState
                    kind={searchError}
                    title={
                      searchError === 'offline'
                        ? "You're offline"
                        : "Couldn't reach Open Library"
                    }
                    sub={
                      searchError === 'offline'
                        ? "Reconnect to search the catalog — or add this book manually for now."
                        : 'Check your connection and try again, or add this manually.'
                    }
                    onRetry={() => handleSearch(currentQuery)}
                    secondary={{ label: '+ Add it manually', onPress: () => setShowAddOwn(true) }}
                  />
                ) : results.length === 0 ? (
                  <View style={s.emptyWrap}>
                    <Text style={s.emptyIcon}>📭</Text>
                    <Text style={s.emptyTxt}>No results for "{currentQuery}"</Text>
                    <Text style={s.emptySub}>Try the full title or a keyword — or add it manually</Text>
                    <TouchableOpacity
                      style={s.tryClearBtn}
                      onPress={() => setShowAddOwn(true)}
                    >
                      <Text style={s.tryClearTxt}>+ Add it manually</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clear} style={{ marginTop: 14 }}>
                      <Text style={{ fontFamily: F.serif, fontSize: 13, color: C.inkMuted, fontWeight: '500' }}>Clear and try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <View style={s.resultsHeader}>
                      <Text style={s.resultsCount}>
                        {totalFound.toLocaleString()} results · showing {results.length}
                      </Text>
                    </View>

                    <View style={s.resultsList}>
                      {results.map((book, i) => (
                        <ResultRow
                          key={book.key || i}
                          book={book}
                          added={book.key ? addedKeys.has(book.key) : false}
                          onPress={() => setSelectedBook(book)}
                        />
                      ))}
                    </View>

                    {hasMore && (
                      <TouchableOpacity
                        style={[s.loadMoreBtn, loadingMore && s.loadMoreBtnLoading]}
                        onPress={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore
                          ? <ActivityIndicator color={C.white} />
                          : <Text style={s.loadMoreTxt}>Load more results</Text>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>

          {/* Sheets must live inside the fullScreen Modal so they can stack on top of it */}
          {showAddOwn && (
            <AddReadingItemSheet
              onAdd={handleAddManualItem}
              onClose={() => setShowAddOwn(false)}
            />
          )}
          {selectedBook && (
            <BookSheet
              book={selectedBook}
              added={selectedBook.key ? addedKeys.has(selectedBook.key) : false}
              onAdd={handleAdd}
              onAddWantToRead={handleAddWantToRead}
              onClose={() => setSelectedBook(null)}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Genre sheet ── */}
      {showGenreSheet && (
        <GenreSheet
          onSelect={handleGenreSelect}
          onClose={() => setShowGenreSheet(false)}
          activeGenres={activeGenres}
        />
      )}

      {/* These sheets are also rendered inside the results overlay Modal above —
          render here only when the overlay isn't open, to avoid double-mounting. */}
      {!searched && showAddOwn && (
        <AddReadingItemSheet
          onAdd={handleAddManualItem}
          onClose={() => setShowAddOwn(false)}
        />
      )}

      {/* ── Book detail sheet ── */}
      {!searched && selectedBook && (
        <BookSheet
          book={selectedBook}
          added={selectedBook.key ? addedKeys.has(selectedBook.key) : false}
          onAdd={handleAdd}
          onAddWantToRead={handleAddWantToRead}
          onClose={() => setSelectedBook(null)}
        />
      )}
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

