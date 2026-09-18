import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';

export default function LoginScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your school email');
      return;
    }
    if (!password) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await response.json();
      console.log('LOGIN RESPONSE:', response.status, data);

      if (!response.ok) {
        Alert.alert('Login Failed', data.message);
        return;
      }

      await AsyncStorage.setItem('student', JSON.stringify(data.student));
      navigation.replace('HomeScreen');

    } catch (error) {
      console.error('Network Error:', error);
      Alert.alert('Connection Error', 'Ensure phone and laptop are on the same Wi-Fi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={{ flex: 1 }}
      >
        {/* HERO */}
        <View style={[styles.hero, { height: layout.heroHeight }]}>
          <View style={styles.heroGradientTop} />
          <View style={styles.heroOverlay} />
          <SafeAreaView edges={['top']} />
        </View>

        {/* CARD */}
        <ScrollView
          style={[styles.card, { marginTop: -layout.cardOverlap }]}
          contentContainerStyle={[styles.cardContent, { paddingHorizontal: layout.cardPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <Text style={styles.title}>eDiwa</Text>
            <Text style={styles.subtitle}>Library App</Text>
          </View>

          {/* TAB SWITCHER */}
          <View style={styles.tabRow}>
            <View style={styles.tabItem}>
              <Text style={styles.tabTextActive}>Login</Text>
              <View style={styles.tabUnderline} />
            </View>
            <TouchableOpacity
              style={styles.tabItem}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.7}
            >
              <Text style={styles.tabText}>Signup</Text>
              <View style={styles.tabUnderlineHidden} />
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.fieldLabel}>E-mail Address</Text>
            <View style={[styles.inputRow, emailFocused && styles.inputRowFocused]}>
              <Ionicons
                name="mail-outline"
                size={17}
                color={emailFocused ? colors.primary : colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="name@cvsu.edu.ph"
                placeholderTextColor={colors.gray}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
              />
            </View>

            <View style={{ height: 22 }} />

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={[styles.inputRow, passwordFocused && styles.inputRowFocused]}>
              <Ionicons
                name="lock-closed-outline"
                size={17}
                color={passwordFocused ? colors.primary : colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.gray}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotLink}
              hitSlop={8}
            >
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Log In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>New here? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')} hitSlop={6}>
              <Text style={styles.footerLink}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Logo badge */}
      <View
        pointerEvents="none"
        style={[
          styles.logoBadgeWrapper,
          { top: layout.heroHeight - layout.cardOverlap - BADGE_SIZE / 2 },
        ]}
      >
        <View style={styles.logoBadge}>
          <Ionicons name="library-outline" size={34} color={colors.primary} />
        </View>
      </View>
    </View>
  );
}

const BADGE_SIZE = 80;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  hero: { backgroundColor: colors.primaryDark || '#163823' },
  heroGradientTop: { ...StyleSheet.absoluteFillObject },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 31, 17, 0.35)',
  },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardContent: {
    paddingTop: 44,
    paddingBottom: 36,
    alignItems: 'center',
    flexGrow: 1,
  },

  logoBadgeWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  logoBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },

  brandBlock: { alignItems: 'center', marginBottom: 30 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12.5,
    color: colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  tabRow: {
    flexDirection: 'row',
    gap: 32,
    marginBottom: 32,
    width: '100%',
    justifyContent: 'center',
  },
  tabItem: { alignItems: 'center' },
  tabText: { fontSize: 14.5, fontWeight: '500', color: colors.textSecondary },
  tabTextActive: { fontSize: 14.5, fontWeight: '700', color: colors.textPrimary },
  tabUnderline: {
    marginTop: 7,
    width: 32,
    height: 2.5,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  tabUnderlineHidden: { marginTop: 7, width: 32, height: 2.5, backgroundColor: 'transparent' },

  form: { width: '100%' },
  fieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  inputRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted || '#F7F8F7',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    height: 52,
  },
  inputRowFocused: {
    borderColor: colors.primary,
    backgroundColor: '#fff',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },

  forgotLink: { alignSelf: 'flex-end', marginTop: 12 },
  forgotLinkText: { fontSize: 12.5, fontWeight: '600', color: colors.primary },

  button: {
    width: '100%',
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  buttonDisabled: { opacity: 0.7, shadowOpacity: 0 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15.5, letterSpacing: 0.4 },

  footerRow: { flexDirection: 'row', marginTop: 22 },
  footerText: { fontSize: 13, color: colors.textSecondary },
  footerLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },
});