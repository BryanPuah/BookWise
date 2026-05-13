import React, { useState, useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';

export function BookCover({ title, author, cover = 'sage', coverId, width = 88, height = 124 }) {
  const { covers, F, themeVersion } = useTheme();
  const [imgError, setImgError] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    wrap: { overflow: 'hidden' },
    shadow: {
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 12,
      elevation: 10,
    },
    image: {},
    grad: { padding: 8, justifyContent: 'flex-end', overflow: 'hidden' },
    spine: {
      position: 'absolute', left: 0, top: 6,
      width: 3, backgroundColor: 'rgba(0,0,0,0.2)',
    },
    titleTxt: {
      fontFamily: F.serif,
      color: 'rgba(255,255,255,0.92)',
      lineHeight: 13, marginBottom: 3, fontStyle: 'italic',
    },
    authorTxt: { fontFamily: F.serif, color: 'rgba(255,255,255,0.55)' },
  }), [themeVersion]);

  const cols  = covers[cover] || covers.sage;
  const fs    = width < 70 ? 7 : width < 90 ? 9 : 11;
  const rounding = 7;

  // Use real cover image if we have a coverId and it hasn't errored
  const showImage = coverId && !imgError;
  const imageUrl  = coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
    : null;

  return (
    <View style={[
      s.wrap,
      { width, height, borderRadius: rounding },
      s.shadow,
    ]}>
      {showImage ? (
        // Real book cover photo from Open Library
        <Image
          source={{ uri: imageUrl }}
          style={[s.image, { width, height, borderRadius: rounding }]}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        // Fallback gradient cover with title text
        <LinearGradient
          colors={cols}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.grad, { width, height, borderRadius: rounding }]}
        >
          <View style={[s.spine, { height: height - 12 }]} />
          <Text style={[s.titleTxt, { fontSize: fs }]} numberOfLines={4}>{title}</Text>
          <Text style={[s.authorTxt, { fontSize: Math.max(6, fs - 2) }]} numberOfLines={1}>{author}</Text>
        </LinearGradient>
      )}
    </View>
  );
}
