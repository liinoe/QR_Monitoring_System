import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
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

const Stack = createNativeStackNavigator();

export default function App() {
  // Which screen to open first. null = still checking (takes a split second).
  //   logged in on this phone        → Home
  //   Welcome screen already seen    → Login
  //   first time opening the app     → Welcome (Splash), shown only once per install
  const [firstScreen, setFirstScreen] = useState(null);

  // Reads the saved login (from LoginScreen) and the "welcome seen" flag.
  // A student stays logged in until they log out (or their login pass expires /
  // is rejected — then Home sends them to Login).
  useEffect(() => {
    AsyncStorage.multiGet(['student', 'student_token', 'welcome_seen'])
      .then(([[, student], [, token], [, welcomeSeen]]) => {
        if (student && token) setFirstScreen('HomeScreen');
        else if (welcomeSeen) setFirstScreen('Login');
        else {
          setFirstScreen('Splash');
          AsyncStorage.setItem('welcome_seen', '1').catch(() => {}); // next time, skip it
        }
      })
      .catch(() => setFirstScreen('Splash'));
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
    </SafeAreaProvider>
  );
}