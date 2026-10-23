import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRAND } from './src/theme/brand';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import SplashScreen from './src/screens/SplashScreen';
import HomeScreenComponent from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import LoginScreen from './src/screens/LoginScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import MyVisitsScreen from './src/screens/MyVisitsScreen';
import LaunchSplash from './src/components/LaunchSplash';

// Coming back after the app was in the background this long shows the
// opening animation again (like opening the app fresh).
const SPLASH_AFTER_AWAY_MS = 30 * 60 * 1000; // 30 minutes

const Stack = createNativeStackNavigator();

export default function App() {
  // Which screen to open first. null = still checking (takes a split second).
  //   logged in on this phone        → Home
  //   Welcome screen already seen    → Login
  //   first time opening the app     → Welcome (Splash), shown only once per install
  const [firstScreen, setFirstScreen] = useState(null);
  // Short opening animation (LaunchSplash). Shown every time the app starts,
  // except the very first time (the full Welcome intro plays then).
  const [showLaunch, setShowLaunch] = useState(false);
  const [launchKey, setLaunchKey] = useState(0); // new key = animation plays again from the start
  const leftAt = useRef(null); // when the app went to the background

  // Reads the saved login (from LoginScreen) and the "welcome seen" flag.
  // A student stays logged in until they log out (or their login pass expires /
  // is rejected — then Home sends them to Login).
  useEffect(() => {
    AsyncStorage.multiGet(['student', 'student_token', 'welcome_seen'])
      .then(([[, student], [, token], [, welcomeSeen]]) => {
        if (student && token) { setFirstScreen('HomeScreen'); setShowLaunch(true); }
        else if (welcomeSeen) { setFirstScreen('Login'); setShowLaunch(true); }
        else {
          setFirstScreen('Splash');
          AsyncStorage.setItem('welcome_seen', '1').catch(() => {}); // next time, skip it
        }
      })
      .catch(() => setFirstScreen('Splash'));
  }, []);

  // Remembers when the app was left, and plays the opening animation again
  // if the student comes back after a long time.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        leftAt.current = Date.now();
      } else if (state === 'active' && leftAt.current) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away >= SPLASH_AFTER_AWAY_MS) {
          setLaunchKey((k) => k + 1);
          setShowLaunch(true);
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Plain green screen while checking, so nothing flashes.
  if (!firstScreen) return <View style={{ flex: 1, backgroundColor: BRAND.deep }} />;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator initialRouteName={firstScreen} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash" component={SplashScreen} />

          {/* Auth Screens */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

          {/* Main Dashboard */}
          <Stack.Screen name="HomeScreen" component={HomeScreenComponent} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="MyVisits" component={MyVisitsScreen} />
        </Stack.Navigator>
      </NavigationContainer>

      {/* Opening animation on top of everything; the real screen loads underneath */}
      {showLaunch && <LaunchSplash key={launchKey} onDone={() => setShowLaunch(false)} />}
    </SafeAreaProvider>
  );
}