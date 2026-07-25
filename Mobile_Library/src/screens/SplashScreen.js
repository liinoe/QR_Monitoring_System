import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function SplashScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <View style={styles.imagePlaceholder} />

      <View style={styles.overlay} />

      <SafeAreaView style={styles.content}>
        <View style={{ flex: 1 }} />

        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons name="library-outline" size={34} color="#fff" />
          </View>
          <Text style={styles.wordmark}>eDiwa</Text>
          <Text style={styles.wordmarkSub}>CvSU Library Companion</Text>
        </View>

        <View style={{ flex: 1 }} />

        <Text style={styles.tagline}>
          Access and monitor your library visits with ease.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>CREATE ACCOUNT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={{ marginTop: 16, marginBottom: 8 }}
        >
          <Text style={styles.loginLink}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F2E1A' },
  imagePlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: '#16382399' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6, 31, 17, 0.55)' },

  content: { flex: 1, paddingHorizontal: 32, paddingBottom: 24 },

  logoWrap: { alignItems: 'center' },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  wordmark: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  wordmarkSub: { color: '#CFE3D4', fontSize: 12, letterSpacing: 1, marginTop: 6, textTransform: 'uppercase' },

  tagline: {
    color: '#E8F5E9',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 28,
  },

  primaryBtn: {
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 1 },

  loginLink: { color: '#CFE3D4', fontSize: 13, textAlign: 'center', fontWeight: '600' },
});