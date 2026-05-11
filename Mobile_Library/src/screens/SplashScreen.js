import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import SplashScreenLogo from '../components/SplashScreenLogo';

export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <SplashScreenLogo />
      </View>

      <Text style={styles.title}>LDMLM APP</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B651B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 186,
    height: 186,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 25,
    color: 'white',
    fontSize: 40,
    fontWeight: '500',
  },
});