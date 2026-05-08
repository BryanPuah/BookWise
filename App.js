import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StoreProvider, useStore } from './src/store';
import { HomeScreen }          from './src/screens/HomeScreen';
import { FinishedBooksScreen } from './src/screens/FinishedBooksScreen';
import { BookDetailScreen }    from './src/screens/BookDetailScreen';
import { NotesScreen }         from './src/screens/NotesScreen';
import { ReviewScreen }        from './src/screens/ReviewScreen';
import { DiscoverScreen }      from './src/screens/DiscoverScreen';
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

// ── Tab icon — Ionicons vector icon + label ────────────────────────────
function TabIcon({ name, nameActive, label, active, badgeCount }) {
  const iconName  = active ? nameActive : name;
  const iconColor = active ? C.amber : '#6B6560';
  const iconSize  = 24;

  return (
    <View style={ti.wrap}>
      {/* Subtle pill behind active icon */}
      {active && <View style={ti.pill} />}

      <View style={ti.iconWrap}>
        <Ionicons name={iconName} size={iconSize} color={iconColor} />
        {/* Badge for review count */}
        {badgeCount > 0 && (
          <View style={ti.badge}>
            <Text style={ti.badgeTxt}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        )}
      </View>

    </View>
  );
}

const ti = StyleSheet.create({
  wrap:       { alignItems: 'center', width: 52, paddingTop: 6 },
  pill:       {
    position: 'absolute', top: 2,
    width: 44, height: 30,
    backgroundColor: 'rgba(184,114,10,0.10)',
    borderRadius: 10,
  },
  iconWrap:   { position: 'relative' },

  badge:      {
    position: 'absolute', top: -5, right: -8,
    backgroundColor: C.amber,
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: C.white,
  },
  badgeTxt:   { fontSize: 9, color: C.white, fontWeight: '700' },
});

// ── Tab navigator ──────────────────────────────────────────────────────
function Tabs() {
  const { dueCards } = useStore();

  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.white,
          borderTopWidth: 0.5,
          borderTopColor: 'rgba(24,19,15,0.10)',
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
            <TabIcon
              name="home-outline"
              nameActive="home"
              label="Library"
              active={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Discover"
        component={DiscoverStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="search-outline"
              nameActive="search"
              label="Discover"
              active={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Notes"
        component={NotesScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="create-outline"
              nameActive="create"
              label="Notes"
              active={focused}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Review"
        component={ReviewScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="layers-outline"
              nameActive="layers"
              label="Review"
              active={focused}
              badgeCount={dueCards.length}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ── Root ───────────────────────────────────────────────────────────────
export default function App() {
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