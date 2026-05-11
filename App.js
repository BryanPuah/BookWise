import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useFonts,
  DMSerifDisplay_400Regular,
  DMSerifDisplay_400Regular_Italic,
} from '@expo-google-fonts/dm-serif-display';
import { StoreProvider, useStore } from './src/store';
import { HomeScreen }          from './src/screens/HomeScreen';
import { FinishedBooksScreen } from './src/screens/FinishedBooksScreen';
import { BookDetailScreen }    from './src/screens/BookDetailScreen';
import { NotesScreen }         from './src/screens/NotesScreen';
import { ReviewScreen }        from './src/screens/ReviewScreen';
import { DiscoverScreen }      from './src/screens/DiscoverScreen';
import { AddNoteModal }        from './src/components/AddNoteModal';
import { C } from './src/theme';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function LibraryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LibraryHome"   component={HomeScreen} />
      <Stack.Screen name="BookDetail"    component={BookDetailScreen} />
      <Stack.Screen name="FinishedBooks" component={FinishedBooksScreen} />
      <Stack.Screen name="Profile"       component={ReviewScreen} />
    </Stack.Navigator>
  );
}

function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DiscoverHome" component={DiscoverScreen} />
      <Stack.Screen name="BookDetail"   component={BookDetailScreen} />
    </Stack.Navigator>
  );
}

// ── Tab icon — Figma uses sage-pale pill behind active icon ───────────
function TabIcon({ name, nameActive, active }) {
  const iconName  = active ? nameActive : name;
  const iconColor = active ? C.ink : C.inkMuted;

  return (
    <View style={ti.wrap}>
      {active && <View style={ti.pill} />}
      <View style={ti.iconWrap}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </View>
    </View>
  );
}

const ti = StyleSheet.create({
  wrap:     { alignItems: 'center', width: 52, paddingTop: 6 },
  pill:     {
    position: 'absolute', top: 2,
    width: 44, height: 30,
    backgroundColor: C.sagePale,
    borderRadius: 10,
  },
  iconWrap: { position: 'relative' },
});

// ── Tab navigator ──────────────────────────────────────────────────────
function Tabs() {
  const { books, addNote } = useStore();
  const [showCapture, setShowCapture] = useState(false);

  const handleSave = (data) => {
    addNote({
      id:        Date.now().toString(),
      bookId:    data.bookId,
      bookTitle: data.bookTitle,
      type:      data.type,
      text:      data.text,
      thinking:  data.thinking,
      page:      data.page,
      chapter:   data.chapter,
      isQuote:   data.type === 'quote',
      starred:   false,
      date:      new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <>
      <Tab.Navigator
        id="MainTabs"
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: C.white,
            borderTopWidth: 0.5,
            borderTopColor: C.border,
            height: 78,
            paddingBottom: 10,
            paddingTop: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 16,
          },
          tabBarShowLabel: false,
        }}
      >
        <Tab.Screen
          name="Library"
          component={LibraryStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="home-outline" nameActive="home" active={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Discover"
          component={DiscoverStack}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="search-outline" nameActive="search" active={focused} />
            ),
          }}
        />
        {/* Capture tab — opens AddNoteModal directly. ReviewScreen is a
            placeholder; the listener preventDefault stops it rendering. */}
        <Tab.Screen
          name="Capture"
          component={ReviewScreen}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setShowCapture(true);
            },
          }}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="add-outline" nameActive="add" active={focused} />
            ),
          }}
        />
        <Tab.Screen
          name="Notes"
          component={NotesScreen}
          options={{
            tabBarIcon: ({ focused }) => (
              <TabIcon name="create-outline" nameActive="create" active={focused} />
            ),
          }}
        />
      </Tab.Navigator>

      <AddNoteModal
        visible={showCapture}
        books={books}
        onSave={handleSave}
        onClose={() => setShowCapture(false)}
      />
    </>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
export default function App() {
  const [fontsLoaded] = useFonts({
    DMSerifDisplay_400Regular,
    DMSerifDisplay_400Regular_Italic,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper }}>
        <ActivityIndicator size="small" color={C.ink} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StoreProvider>
        <NavigationContainer>
          <Tabs />
        </NavigationContainer>
      </StoreProvider>
    </GestureHandlerRootView>
  );
}