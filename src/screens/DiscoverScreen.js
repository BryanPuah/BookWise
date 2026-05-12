import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Image, Animated,
  Dimensions, KeyboardAvoidingView, Platform, PanResponder, Modal,
  TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store';
import { C, F, covers } from '../theme';

const { width: SW } = Dimensions.get('window');
const PAGE_SIZE = 20;
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
  return coverId ? (
    <Image
      source={{ uri: getImageUrl(coverId, 'M') }}
      style={{ width, height, borderRadius: 6, backgroundColor: C.creamDark }}
      resizeMode="cover"
    />
  ) : (
    <LinearGradient
      colors={[C.heroTop, C.heroBot]}
      style={{ width, height, borderRadius: 6, alignItems: 'center', justifyContent: 'center', padding: 6 }}
    >
      <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 13 }}
        numberOfLines={4}>{title}</Text>
    </LinearGradient>
  );
}

// ── Result row ──────────────────────────────────────────────────────────
function ResultRow({ book, added, onPress }) {
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

  useEffect(() => {
    if (!topGenres.length) {
      setRecommended([]);
      return;
    }
    // Use top 2 genres if available, joined with OR — gives more variety
    const queryGenres = topGenres.slice(0, 2);
    const cacheKey = queryGenres.join('|');
    if (recoCacheRef.current.key === cacheKey) {
      setRecommended(recoCacheRef.current.books);
      return;
    }
    let cancelled = false;
    setRecoLoading(true);
    (async () => {
      try {
        const q = queryGenres.map(g => `subject:"${g}"`).join(' OR ');
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,first_publish_year,cover_i,subject&limit=12`;
        const res = await fetch(url);
        const data = await res.json();
        const docs = (data.docs || [])
          .filter(r => r.key && r.title && r.author_name?.length && r.cover_i);
        // Dedupe against user's library
        const libKeys = new Set(books.map(b => b.olKey).filter(Boolean));
        const filtered = docs.filter(d => !libKeys.has(d.key)).slice(0, 4);
        if (!cancelled) {
          recoCacheRef.current = { key: cacheKey, books: filtered };
          setRecommended(filtered);
        }
      } catch {
        if (!cancelled) setRecommended([]);
      } finally {
        if (!cancelled) setRecoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topGenres.join('|')]); // intentionally stringified to compare values not refs

  const addedKeys = new Set(books.map(b => b.olKey).filter(Boolean));

  const fetchResults = useCallback(async (q, pageIndex = 0, append = false) => {
    const offset = pageIndex * PAGE_SIZE;
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=key,title,author_name,first_publish_year,number_of_pages_median,subject,cover_i&limit=${PAGE_SIZE}&offset=${offset}`;
    const res  = await fetch(url);
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
    try { await fetchResults(q, 0, false); }
    catch { setResults([]); }
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
    id: Date.now().toString(),
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
      // Fire search with combined genres
      const q = next.length > 0 ? next.join(' ') : '';
      if (q) {
        setQuery(q);
        handleSearch(q);
      } else {
        clear();
      }
      return next;
    });
  };

  const handleAddManualItem = useCallback(({ title, author, pages, genre, format, url }, status = 'want_to_read') => {
    addBook({
      id: Date.now().toString(),
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
          <Text style={s.searchIconTxt}>🔍</Text>
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
            <TouchableOpacity onPress={clear} style={s.searchClearBtn}>
              <Text style={s.searchClearTxt}>✕</Text>
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

      {/* ── Genre pill + active genre chips below search ── */}
      <View style={s.genreBar}>
        <TouchableOpacity
          style={[s.filterChip, activeGenres.length > 0 && s.filterChipActive]}
          onPress={() => setShowGenreSheet(true)}
          activeOpacity={0.8}
        >
          <Text style={s.filterChipIcon}>≡</Text>
          <Text style={[s.filterChipTxt, activeGenres.length > 0 && s.filterChipTxtActive]}>
            Genre
          </Text>
        </TouchableOpacity>

        {activeGenres.length > 0 && (
          <View style={s.activeGenreWrap}>
            {activeGenres.map(g => (
              <View key={g} style={s.activeGenrePill}>
                <Text style={s.activeGenrePillTxt}>{g}</Text>
                <TouchableOpacity
                  onPress={() => handleGenreSelect(g)}
                  hitSlop={{ top: 6, bottom: 6, left: 4, right: 6 }}
                >
                  <Text style={s.activeGenrePillX}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={s.clearAllPill} onPress={clear} activeOpacity={0.8}>
              <Text style={s.clearAllPillTxt}>Clear all</Text>
            </TouchableOpacity>
          </View>
        )}
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
                  onPress={() => {
                    // Tap "View All" — run a search for the top genre
                    handleGenreSelect(topGenres[0]);
                  }}
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
            ) : recommended.length === 0 ? (
              <Text style={s.recoEmpty}>No recommendations yet</Text>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
              >
                {recommended.map((book, i) => (
                  <TouchableOpacity
                    key={book.key || i}
                    style={s.recoCard}
                    onPress={() => setSelectedBook(book)}
                    activeOpacity={0.85}
                  >
                    {book.cover_i ? (
                      <Image
                        source={{ uri: getImageUrl(book.cover_i, 'L') }}
                        style={s.recoCover}
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

        {/* ── Search state — results, empty, or initial prompt ── */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={C.amber} />
            <Text style={s.loadingTxt}>Searching...</Text>
          </View>
        ) : searched && results.length === 0 ? (
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
              <Text style={{ fontSize: 13, color: C.inkMuted, fontWeight: '500' }}>Clear and try again</Text>
            </TouchableOpacity>
          </View>
        ) : !searched && topGenres.length === 0 ? (
          // Initial prompt only when library is empty (otherwise sections fill the page)
          <View style={s.promptWrap}>
            <Text style={s.promptIcon}>🔍</Text>
            <Text style={s.promptTxt}>Find what you're reading</Text>
            <Text style={s.promptSub}>Search above, browse by genre, or tap + Add to enter anything manually</Text>
          </View>
        ) : searched ? (
          // Results list
          <View>
            <View style={s.resultsHeader}>
              <Text style={s.resultsCount}>
                {totalFound.toLocaleString()} results · showing {results.length}
              </Text>
              <TouchableOpacity onPress={clear}>
                <Text style={s.clearTxt}>Clear</Text>
              </TouchableOpacity>
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
        ) : null}
      </ScrollView>

      {/* ── Genre sheet ── */}
      {showGenreSheet && (
        <GenreSheet
          onSelect={handleGenreSelect}
          onClose={() => setShowGenreSheet(false)}
          activeGenres={activeGenres}
        />
      )}

      {showAddOwn && (
        <AddReadingItemSheet
          onAdd={handleAddManualItem}
          onClose={() => setShowAddOwn(false)}
        />
      )}

      {/* ── Book detail sheet ── */}
      {selectedBook && (
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

// ── Styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },

  // Header
  header:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:    { fontSize: 30, fontWeight: '700', color: C.ink, letterSpacing: -0.6 },
  subtitle: { fontSize: 13, color: C.inkMuted, marginTop: 3, lineHeight: 19 },

  // Search row
  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  searchWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.cream, borderRadius: 14, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  searchIconTxt:  { fontSize: 14 },
  searchInput:    { flex: 1, fontSize: 15, color: C.ink },
  searchClearBtn: { padding: 4 },
  searchClearTxt: { fontSize: 13, color: C.inkFaint, fontWeight: '500' },

  // Filter bar
  genreBar:           { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  activeGenreWrap:    { flexDirection: 'row', flexWrap: 'wrap', flex: 1, gap: 6 },
  filterBar:          { borderBottomWidth: 0.5, borderBottomColor: C.border, backgroundColor: C.paper },
  filterBarContent:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  activeGenrePill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: C.amberPale, borderWidth: 1, borderColor: C.amber },
  activeGenrePillTxt: { fontSize: 13, fontWeight: '600', color: C.amber },
  activeGenrePillX:   { fontSize: 11, color: C.amber, fontWeight: '700' },
  clearAllPill:       { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
  clearAllPillTxt:    { fontSize: 13, fontWeight: '500', color: C.inkMuted },
  genreItemActive:    { backgroundColor: C.ink, borderColor: C.ink },
  genreItemTxtActive: { color: C.white, fontWeight: '600' },
  filterChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
  filterChipActive:   { backgroundColor: C.ink, borderColor: C.ink },
  filterChipIcon:     { fontSize: 13, color: C.inkMuted },
  filterChipTxt:      { fontSize: 13, fontWeight: '500', color: C.inkMuted },
  filterChipTxtActive:{ color: C.white, fontWeight: '600' },
  filterChipClear:    { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginLeft: 2 },
  filterSep:          { width: 0.5, height: 20, backgroundColor: C.border },
  addOwnPill:         { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: C.amber, backgroundColor: C.amberPale },
  addOwnPillTxt:      { fontSize: 13, fontWeight: '600', color: C.amber },
  filtersContent:     { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },

  // Genre sheet
  genreSheet:       { maxHeight: '85%' },
  genreSheetTitle:  { fontSize: 18, fontWeight: '700', color: C.ink, paddingHorizontal: 20, paddingBottom: 16, letterSpacing: -0.3 },
  genreGroup:       { paddingHorizontal: 20, marginBottom: 20 },
  genreGroupLabel:  { fontSize: 11, fontWeight: '700', color: C.inkFaint, letterSpacing: 0.8, marginBottom: 10 },
  genreGroupItems:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreItem:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.cream, borderWidth: 1, borderColor: C.border },
  genreItemTxt:     { fontSize: 13, fontWeight: '500', color: C.ink },

  // Add reading item sheet
  ownOverlay:       { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  ownSheet:         { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
  ownHandle:        { alignItems: 'center', paddingVertical: 14 },
  ownHandleBar:     { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },
  ownScrollContent: { paddingHorizontal: 20, paddingBottom: 320 },
  ownBookHeader:    { paddingHorizontal: 20, paddingBottom: 20 },
  ownBookTitle:     { fontSize: 22, fontWeight: '700', color: C.ink, letterSpacing: -0.4, marginBottom: 6 },
  ownBookSub:       { fontSize: 13, color: C.inkMuted, marginBottom: 22, lineHeight: 19 },
  ownBookForm:      { gap: 16, marginBottom: 16 },
  ownBookField:     { gap: 6 },
  ownBookFieldLabel:{ fontSize: 11, fontWeight: '700', color: C.inkMuted, letterSpacing: 0.5 },
  ownBookInput:     { backgroundColor: C.cream, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink },

  // Format chips inside the manual-add sheet
  formatChipsRow:   { gap: 6, paddingTop: 8, paddingRight: 4 },
  formatChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  formatChipActive: { backgroundColor: C.amberPale, borderColor: C.amber },
  formatChipIcon:   { fontSize: 12 },
  formatChipTxt:    { fontSize: 12, fontWeight: '500', color: C.inkSoft },
  formatChipTxtActive: { color: C.amber, fontWeight: '700' },

  promptWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80, paddingHorizontal: 40 },
  promptIcon: { fontSize: 40, marginBottom: 14 },
  promptTxt:  { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
  promptSub:  { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 19 },

  // Loading
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingTxt:  { fontSize: 13, color: C.inkMuted },

  // Empty search
  emptyWrap:    { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon:    { fontSize: 40, marginBottom: 16 },
  emptyTxt:     { fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'center', marginBottom: 8 },
  emptySub:     { fontSize: 13, color: C.inkMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  tryClearBtn:  { backgroundColor: C.ink, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  tryClearTxt:  { fontSize: 14, color: C.white, fontWeight: '600' },

  // Empty state (not yet searched)
  emptyState:        { padding: 20 },
  emptyStateCard:    { backgroundColor: C.cream, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.border, marginBottom: 28 },
  emptyStateIcon:    { fontSize: 32, marginBottom: 12 },
  emptyStateHeading: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 16 },
  steps:     { gap: 16 },
  step:      { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNum:   { width: 28, height: 28, borderRadius: 14, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt:{ fontSize: 13, fontWeight: '700', color: C.white },
  stepTitle: { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 2 },
  stepSub:   { fontSize: 12, color: C.inkMuted, lineHeight: 18 },
  orBrowse:  { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 14 },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  genreCard: { backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: C.border },
  genreCardTxt: { fontSize: 13, fontWeight: '500', color: C.ink },

  // Results
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  resultsCount:  { fontSize: 12, color: C.inkMuted },
  clearTxt:      { fontSize: 12, color: C.amber, fontWeight: '600' },
  resultsList:   { paddingHorizontal: 16 },

  row:          { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: C.border },
  rowCover:     { position: 'relative' },
  rowAddedDot:  { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: C.amber, alignItems: 'center', justifyContent: 'center' },
  rowAddedDotTxt: { color: C.white, fontSize: 9, fontWeight: '800' },
  rowInfo:      { flex: 1 },
  rowTitle:     { fontSize: 14, fontWeight: '600', color: C.ink, lineHeight: 20, marginBottom: 3 },
  rowAuthor:    { fontSize: 12, color: C.inkMuted, marginBottom: 3 },
  rowGenre:     { fontSize: 11, color: C.inkFaint, marginBottom: 2 },
  rowPages:     { fontSize: 11, color: C.inkFaint },
  rowChevron:   { fontSize: 20, color: C.inkFaint },

  loadMoreBtn:        { marginHorizontal: 20, marginVertical: 16, backgroundColor: C.ink, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  loadMoreBtnLoading: { opacity: 0.6 },
  loadMoreTxt:        { fontSize: 14, color: C.white, fontWeight: '600' },

  bookSheetOverlay:   { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  bookSheet:          { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
  bookSheetHandle:    { alignItems: 'center', paddingVertical: 14 },
  bookSheetHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark },
  sheetOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end', zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:         { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 44, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 20 },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: C.creamDark, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  sheetTop:      { flexDirection: 'row', gap: 16, paddingHorizontal: 20, marginBottom: 16 },
  sheetCoverShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 6 },
  sheetTitle:    { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3, lineHeight: 24, marginBottom: 6, flex: 1 },
  sheetTopInfo:  { flex: 1, justifyContent: 'center' },
  sheetAuthor:   { fontSize: 13, color: C.inkMuted, marginBottom: 10 },
  sheetPills:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill:          { backgroundColor: C.cream, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  pillTxt:       { fontSize: 11, color: C.inkMuted, fontWeight: '500' },
  genrePill:     { backgroundColor: C.creamDark, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  genrePillTxt:  { fontSize: 11, color: C.inkSoft, fontWeight: '500' },
  sheetActions:  { paddingHorizontal: 20, paddingTop: 8, gap: 8 },
  addBtn:        { backgroundColor: C.ink, borderRadius: 16, paddingVertical: 15, alignItems: 'center' },
  addBtnTxt:     { fontSize: 16, fontWeight: '700', color: C.white, letterSpacing: -0.2 },
  addBtnSub:     { fontSize: 11, color: C.inkFaint, textAlign: 'center' },
  wantBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.cream, borderRadius: 16, paddingVertical: 13, borderWidth: 1, borderColor: C.border },
  wantBtnIcon:   { fontSize: 15 },
  wantBtnTxt:    { fontSize: 14, fontWeight: '600', color: C.ink },
  alreadyAdded:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#E9F7EF', borderRadius: 14, padding: 14 },
  alreadyAddedIcon: { fontSize: 20, color: '#1E8449' },
  alreadyAddedTxt:  { fontSize: 14, fontWeight: '600', color: '#1E8449' },
  alreadyAddedSub:  { fontSize: 11, color: '#27AE60', marginTop: 2 },
  closeBtn:      { paddingVertical: 12, alignItems: 'center' },
  closeBtnTxt:   { fontSize: 14, color: C.inkMuted, fontWeight: '500' },

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
    color: '#fff',
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
    fontSize: 9,
    fontWeight: '700',
    color: C.sage,
    letterSpacing: 0.5,
  },
});