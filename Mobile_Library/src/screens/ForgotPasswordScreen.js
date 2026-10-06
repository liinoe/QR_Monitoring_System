import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';
import { BRAND } from '../theme/brand';

const DEFAULT_COOLDOWN = 120; // seconds before "Resend" works again (the server says the same)

// "juan.delacruz@cvsu.edu.ph" → "ju***@cvsu.edu.ph" (so it's not fully shown on screen).
const maskEmail = (email) => {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};

// 125 → "2:05".
const formatCountdown = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Forgot password: the student enters their CvSU email and we email a one-time reset link.
// Plain white page with a back button (no green header), same inputs/buttons as Login.
export default function ForgotPasswordScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const isFocused = useIsFocused(); // dark status-bar icons only while this white screen is showing

  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState(''); // email the link was sent to ('' = form still showing)
  const [errorText, setErrorText] = useState('');
  const [cooldown, setCooldown] = useState(0); // seconds left before "Resend" works
  const timerRef = useRef(null);

  // Counts the "Resend in 1:59" timer down to 0.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    timerRef.current = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [cooldown]);

  // Asks the server to email a reset link. The reply is the same whether or not the
  // email is registered (so this can't be used to check who has an account).
  const requestLink = async (address) => {
    setLoading(true);
    setErrorText('');
    try {
      const response = await fetch(`${API_URL}/api/student/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });
      const data = await response.json().catch(() => ({}));
      setSentTo(address);
      setCooldown(data.retry_after_seconds || DEFAULT_COOLDOWN);
    } catch (error) {
      console.error('Forgot password error:', error);
      setErrorText("Can't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // "Send Reset Link": checks the email, then sends the request.
  const handleSubmit = () => {
    const address = email.trim().toLowerCase();
    if (!address) return setErrorText('Please enter your CvSU email address.');
    if (!/^[^\s@]+@cvsu\.edu\.ph$/i.test(address)) {
      return setErrorText('Use your CvSU email, e.g. juan.delacruz@cvsu.edu.ph');
    }
    requestLink(address);
  };

  // "Use a different email": goes back to the form.
  const changeEmail = () => {
    setSentTo('');
    setCooldown(0);
    setErrorText('');
  };

  return (
    <View style={styles.root}>
      {isFocused && <StatusBar style="dark" />}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
          {/* TOP BAR: back button only */}
          <SafeAreaView edges={['top']}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={20} color={BRAND.green} />
            </TouchableOpacity>
          </SafeAreaView>

          {/* CONTENT */}
          <View style={[styles.card, { paddingHorizontal: layout.cardPadding }]}>
            <View style={{ width: '100%', maxWidth: 480, alignSelf: 'center' }}>
              {!sentTo ? (
                <>
                  {/* FORM */}
                  <View style={styles.iconWrap}>
                    <Ionicons name="key-outline" size={26} color={BRAND.green} />
                  </View>
                  <Text style={styles.title}>Forgot your password?</Text>
                  <Text style={styles.sub}>
                    Enter your CvSU email and we'll send you a link to set a new password.
                  </Text>

                  <Text style={styles.fieldLabel}>CvSU Email</Text>
                  <View style={[styles.inputRow, focused && styles.inputRowFocused, !!errorText && styles.inputRowError]}>
                    <Ionicons name="mail-outline" size={18} color={focused ? BRAND.green : colors.gray} style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="name@cvsu.edu.ph"
                      placeholderTextColor={colors.gray}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="send"
                      value={email}
                      onChangeText={(t) => { setEmail(t); if (errorText) setErrorText(''); }}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setFocused(false)}
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                  {!!errorText && (
                    <View style={styles.errorRow}>
                      <Ionicons name="alert-circle" size={14} color="#B3261E" />
                      <Text style={styles.errorText}>{errorText}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.88}
                  >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.linkBtn} hitSlop={8}>
                    <Text style={styles.linkText}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* LINK SENT */}
                  <View style={[styles.iconWrap, styles.iconWrapBig]}>
                    <Ionicons name="mail-open-outline" size={32} color={BRAND.green} />
                  </View>
                  <Text style={styles.title}>Check your email</Text>
                  <Text style={styles.sub}>
                    If <Text style={styles.strong}>{maskEmail(sentTo)}</Text> is registered, we sent it a link to reset your password.
                  </Text>

                  <View style={styles.tipBox}>
                    <View style={styles.tipRow}>
                      <Ionicons name="time-outline" size={15} color="#946800" />
                      <Text style={styles.tipText}>The link works once and expires in 30 minutes.</Text>
                    </View>
                    <View style={styles.tipRow}>
                      <Ionicons name="folder-open-outline" size={15} color="#946800" />
                      <Text style={styles.tipText}>Don't see it? Check your Spam or Promotions folder.</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate('Login')}
                    activeOpacity={0.88}
                  >
                    <Text style={styles.buttonText}>Back to Login</Text>
                  </TouchableOpacity>

                  {/* Resend (only after the cooldown) */}
                  <TouchableOpacity
                    style={[styles.secondaryBtn, (cooldown > 0 || loading) && styles.secondaryBtnDisabled]}
                    onPress={() => requestLink(sentTo)}
                    disabled={cooldown > 0 || loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color={BRAND.green} />
                    ) : (
                      <Text style={[styles.secondaryText, cooldown > 0 && { color: colors.gray }]}>
                        {cooldown > 0 ? `Resend link in ${formatCountdown(cooldown)}` : 'Resend link'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  {!!errorText && <Text style={[styles.errorText, { textAlign: 'center', marginTop: 10 }]}>{errorText}</Text>}

                  <TouchableOpacity onPress={changeEmail} style={styles.linkBtn} hitSlop={8}>
                    <Text style={styles.linkText}>Use a different email</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: BRAND.mint,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 16, marginTop: 8,
  },

  card: {
    flex: 1,
    paddingTop: 28, // content starts near the top, under the back button
    paddingBottom: 36,
  },

  iconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: BRAND.mint,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  iconWrapBig: { width: 68, height: 68, borderRadius: 34 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, textAlign: 'center', marginBottom: 8 },
  sub: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 20, textAlign: 'center', marginBottom: 26, paddingHorizontal: 6 },
  strong: { fontWeight: '700', color: colors.textPrimary },

  fieldLabel: {
    fontSize: 10.5, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    height: 52, borderRadius: 14, paddingHorizontal: 14,
    backgroundColor: '#F7F8F7', borderWidth: 1.2, borderColor: 'transparent',
  },
  inputRowFocused: { backgroundColor: '#fff', borderColor: BRAND.green },
  inputRowError: { borderColor: '#B3261E', backgroundColor: '#fff' },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary, paddingVertical: 0 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  errorText: { color: '#B3261E', fontSize: 12.5, flexShrink: 1 },

  tipBox: { backgroundColor: BRAND.goldSoft, borderRadius: 16, padding: 14, gap: 8, marginBottom: 6 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipText: { flex: 1, fontSize: 12.5, color: '#946800', lineHeight: 18 },

  button: {
    width: '100%', height: 54, borderRadius: 16,
    backgroundColor: BRAND.green,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15.5, letterSpacing: 0.3 },

  secondaryBtn: {
    width: '100%', height: 50, borderRadius: 16,
    backgroundColor: BRAND.mint,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 12,
  },
  secondaryBtnDisabled: { backgroundColor: '#F4F5F4' },
  secondaryText: { color: BRAND.green, fontWeight: '700', fontSize: 14.5 },

  linkBtn: { alignSelf: 'center', marginTop: 18 },
  linkText: { fontSize: 13, fontWeight: '700', color: BRAND.green },
});
