import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Animated,
  Keyboard,
  TouchableWithoutFeedback,
  Easing,
  useWindowDimensions,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { API_URL } from '../config';
import { getResponsive } from '../theme/responsive';
import { BRAND } from '../theme/brand';
import { QLessMark, BrandPattern } from '../components/QLessLogo';
import { useAppDialog } from '../components/AppDialog';

/**
 * LoginScreen — students log in with their CvSU email OR 9-digit student
 * number, plus the password they set when registering.
 *
 *   - Errors use the QLess pop-up (AppDialog) instead of the phone's plain alert,
 *     with helpful next steps (Create Account, Forgot Password, Try Again).
 *   - A small side-to-side "shake" of the card also marks an error.
 *   - The white card isn't scrollable: when the keyboard opens it slides up over
 *     the green area, and slides back down when the keyboard closes.
 *   - Entrance animation: the green area, card, logo and fields fade/rise in, in order.
 */

const EASE = Easing.bezier(0.4, 0, 0.2, 1); // standard "material" ease-out

// Shortcut for a simple timed animation of one value.
const timing = (value, toValue, duration, easing = EASE, native = true) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: native });

// Run an animation at an absolute time offset inside a parallel timeline.
const at = (ms, ...anims) => Animated.sequence([Animated.delay(ms), ...anims]);

// Heavily damped spring — settles without overshoot.
const settle = (value, toValue) =>
  Animated.spring(value, {
    toValue,
    friction: 10,
    tension: 90,
    useNativeDriver: true,
  });

// Login accepts either a CvSU email or a 9-digit student number.
const CVSU_EMAIL_REGEX = /^[^\s@]+@cvsu\.edu\.ph$/i;
const STUDENT_NUMBER_REGEX = /^\d{9}$/;

// CvSU emails never start with a number, so if the first character is a
// digit, treat it as a student number: keep only digits, max 9.
// Anything starting with a letter is an email and has no limit.
const limitStudentNumber = (value) =>
  /^\d/.test(value) ? value.replace(/\D/g, '').slice(0, 9) : value;

// True if what was typed looks like a CvSU email or a student number.
const isValidIdentifier = (value) => CVSU_EMAIL_REGEX.test(value) || STUDENT_NUMBER_REGEX.test(value);

// The Login screen itself.
export default function LoginScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [identifier, setIdentifier] = useState(''); // CvSU email OR student number
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const insets = useSafeAreaInsets();

  // Styled pop-up used for every login error (see components/AppDialog.js).
  const { dialog, showDialog } = useAppDialog();
  // Lets us put the cursor back in a field after an error.
  const identifierRef = useRef(null);
  const passwordRef = useRef(null);

  // ---- Keyboard slide-up ----
  // keyboardY is how far (negative = up) the card is lifted while typing.
  const keyboardY = useRef(new Animated.Value(0)).current;
  const contentBottom = useRef(0); // bottom of the Log In button, inside the card

  // ---- Entrance timeline ----
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(18)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  const badgeScale = useRef(new Animated.Value(0.85)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;


  const tabsOpacity = useRef(new Animated.Value(0)).current;
  const tabsTranslateY = useRef(new Animated.Value(6)).current;

  const emailFieldOpacity = useRef(new Animated.Value(0)).current;
  const emailFieldTranslateY = useRef(new Animated.Value(8)).current;

  const passwordFieldOpacity = useRef(new Animated.Value(0)).current;
  const passwordFieldTranslateY = useRef(new Animated.Value(8)).current;

  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const buttonTranslateY = useRef(new Animated.Value(8)).current;

  // ---- Interaction feedback ----
  const emailFocusAnim = useRef(new Animated.Value(0)).current; // 0 -> 1
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;
  const buttonPressScale = useRef(new Animated.Value(1)).current;

  // Small, restrained horizontal correction used for validation / login errors.
  const cardShift = useRef(new Animated.Value(0)).current;

  // Plays the entrance animation once when the screen opens.
  useEffect(() => {
    const entrance = Animated.parallel([
      timing(heroOpacity, 1, 420),

      at(
        80,
        Animated.parallel([
          timing(cardOpacity, 1, 420),
          timing(cardTranslateY, 0, 420),
        ])
      ),

      at(
        240,
        Animated.parallel([timing(badgeOpacity, 1, 320), settle(badgeScale, 1)])
      ),

      at(370, Animated.parallel([timing(tabsOpacity, 1, 300), timing(tabsTranslateY, 0, 320)])),
      at(
        450,
        Animated.parallel([
          timing(emailFieldOpacity, 1, 320),
          timing(emailFieldTranslateY, 0, 340),
        ])
      ),
      at(
        530,
        Animated.parallel([
          timing(passwordFieldOpacity, 1, 320),
          timing(passwordFieldTranslateY, 0, 340),
        ])
      ),
      at(
        630,
        Animated.parallel([timing(buttonOpacity, 1, 320), timing(buttonTranslateY, 0, 340)])
      ),
    ]);

    entrance.start();

    return () => entrance.stop();
  }, []);

  // Slides the card up when the keyboard opens (so the fields stay visible)
  // and back down when it closes.
  useEffect(() => {
    const cardTop = layout.heroHeight - layout.cardOverlap; // card's resting y
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    // Animates the card to a new height.
    const slide = (toValue, duration) =>
      Animated.timing(keyboardY, {
        toValue,
        duration: duration || 260,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }).start();

    // Keyboard opened: lift the card.
    const onShow = (e) => {
      // 1) cover the green hero: move the card's top up to the status bar
      const coverHero = Math.max(0, cardTop - insets.top);
      // 2) if the button would still sit under the keyboard, lift a bit more
      const keyboardTop = e.endCoordinates.screenY - 16;
      const buttonBottomAfterCover = cardTop - coverHero + contentBottom.current;
      const extra = Math.max(0, buttonBottomAfterCover - keyboardTop);
      slide(-(coverHero + extra), e.duration);
    };
    // Keyboard closed: put the card back.
    const onHide = (e) => slide(0, e?.duration);

    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, [layout.heroHeight, layout.cardOverlap, insets.top]);

  // Badge fades away as the card starts lifting, so it never overlaps the status bar.
  const badgeKeyboardFade = keyboardY.interpolate({
    inputRange: [-60, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Small side-to-side shake of the card to show something went wrong.
  const runErrorCue = () => {
    cardShift.setValue(0);
    Animated.sequence([
      timing(cardShift, -6, 60, Easing.linear),
      timing(cardShift, 6, 90, Easing.linear),
      timing(cardShift, 0, 90, Easing.linear),
    ]).start();
  };

  // Highlights the email/student-number box while it's being typed in.
  const handleEmailFocus = () => {
    setEmailFocused(true);
    timing(emailFocusAnim, 1, 180).start();
  };
  // Removes the highlight when the box loses focus.
  const handleEmailBlur = () => {
    setEmailFocused(false);
    timing(emailFocusAnim, 0, 180).start();
  };
  // Highlights the password box while it's being typed in.
  const handlePasswordFocus = () => {
    setPasswordFocused(true);
    timing(passwordFocusAnim, 1, 180).start();
  };
  // Removes the password highlight.
  const handlePasswordBlur = () => {
    setPasswordFocused(false);
    timing(passwordFocusAnim, 0, 180).start();
  };

  const emailBorderColor = emailFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.primary],
  });
  const emailBackground = emailFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceMuted || '#F7F8F7', '#FFFFFF'],
  });
  const passwordBorderColor = passwordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', colors.primary],
  });
  const passwordBackground = passwordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.surfaceMuted || '#F7F8F7', '#FFFFFF'],
  });

  // Button shrinks a tiny bit while pressed...
  const handleButtonPressIn = () => {
    Animated.timing(buttonPressScale, {
      toValue: 0.985,
      duration: 90,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  };
  // ...and returns to normal size when released.
  const handleButtonPressOut = () => {
    Animated.timing(buttonPressScale, {
      toValue: 1,
      duration: 140,
      easing: EASE,
      useNativeDriver: true,
    }).start();
  };

  // Puts the cursor back in the email/student number box.
  const focusIdentifier = () => identifierRef.current?.focus();
  // Clears the password and puts the cursor back in it.
  const retryPassword = () => {
    setPassword('');
    passwordRef.current?.focus();
  };

  // "Log In" button: checks the inputs, asks the server, then opens Home.
  const handleLogin = async () => {
    const id = identifier.trim();

    if (!id) {
      runErrorCue();
      showDialog({
        tone: 'warning',
        title: 'Enter Your Login',
        message: 'Please enter your CvSU email or student number.',
        buttons: [{ text: 'OK', style: 'primary', onPress: focusIdentifier }],
      });
      return;
    }
    if (!isValidIdentifier(id)) {
      runErrorCue();
      showDialog({
        tone: 'error',
        title: 'Check Your Login',
        message: 'Use your CvSU email (name@cvsu.edu.ph) or your 9-digit student number.',
        buttons: [{ text: 'Edit', style: 'primary', onPress: focusIdentifier }],
      });
      return;
    }
    if (!password) {
      runErrorCue();
      showDialog({
        tone: 'warning',
        title: 'Enter Your Password',
        message: 'Please enter your password.',
        buttons: [{ text: 'OK', style: 'primary', onPress: () => passwordRef.current?.focus() }],
      });
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: id.toLowerCase(), password }),
      });
      const data = await response.json();

      if (!response.ok) {
        runErrorCue();
        if (response.status === 404) {
          // No account with that email / student number.
          showDialog({
            tone: 'warning',
            title: 'Account Not Found',
            message: data.message || 'No account matches that email or student number.',
            buttons: [
              { text: 'Try Again', style: 'secondary', onPress: focusIdentifier },
              { text: 'Create Account', style: 'primary', onPress: () => navigation.navigate('Register') },
            ],
          });
        } else if (response.status === 401) {
          // Right account, wrong password.
          showDialog({
            tone: 'error',
            title: 'Incorrect Password',
            message: 'The password you entered is incorrect.',
            buttons: [
              { text: 'Forgot Password', style: 'secondary', onPress: () => navigation.navigate('ForgotPassword') },
              { text: 'Try Again', style: 'primary', onPress: retryPassword },
            ],
          });
        } else {
          showDialog({ tone: 'error', title: 'Login Failed', message: data.message || 'Something went wrong. Please try again.' });
        }
        return;
      }

      // Save the student and their login pass (token) on the phone, then open Home.
      // They stay logged in (even offline) until they log out.
      await AsyncStorage.setItem('student', JSON.stringify(data.student));
      if (data.token) await AsyncStorage.setItem('student_token', data.token);
      navigation.replace('HomeScreen');

    } catch (error) {
      console.error('Network Error:', error);
      runErrorCue();
      showDialog({
        tone: 'error',
        title: "Can't Reach the Server",
        message: 'Check that your phone and the server are on the same Wi-Fi, then try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>
        {/* HERO */}
        <Animated.View
          style={[styles.hero, { height: layout.heroHeight, opacity: heroOpacity }]}
        >
          <BrandPattern size={layout.heroHeight * 1.25} opacity={0.07} style={{ top: -layout.heroHeight * 0.2, right: -layout.heroHeight * 0.35 }} />
          <BrandPattern size={layout.heroHeight * 0.8} opacity={0.05} style={{ bottom: -layout.heroHeight * 0.15, left: -layout.heroHeight * 0.3 }} />
          <SafeAreaView edges={['top']} />

          {/* Logo, centered in the visible green area (between the status bar
              and the top of the white card). */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroLogoWrap,
              {
                top: insets.top,
                bottom: layout.cardOverlap,
                opacity: Animated.multiply(badgeOpacity, badgeKeyboardFade),
                transform: [{ scale: badgeScale }],
              },
            ]}
          >
            {/* Logo with the app name and library under it */}
            <QLessMark
              tone="dark"
              size={Math.min(LOGO_SIZE, Math.max(44, layout.heroHeight - layout.cardOverlap - insets.top - 78))}
            />
            <Text style={styles.heroTitle}>
              <Text style={{ color: BRAND.goldLight }}>Q</Text>Less
            </Text>
            <Text style={styles.heroCaption}>Ladislao N. Diwa Memorial Library</Text>
          </Animated.View>
        </Animated.View>

        {/* CARD */}
        <Animated.View
          style={{
            flex: 1,
            marginTop: -layout.cardOverlap,
            opacity: cardOpacity,
            transform: [
              { translateY: Animated.add(cardTranslateY, keyboardY) },
              { translateX: cardShift },
            ],
          }}
        >
          <View style={[styles.card, styles.cardContent, { paddingHorizontal: layout.cardPadding }]}>
            {/* TAB SWITCHER */}
            <Animated.View
              style={[
                styles.tabRow,
                { opacity: tabsOpacity, transform: [{ translateY: tabsTranslateY }] },
              ]}
            >
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
            </Animated.View>

            <View style={styles.form}>
              <Animated.View
                style={{
                  opacity: emailFieldOpacity,
                  transform: [{ translateY: emailFieldTranslateY }],
                }}
              >
                <Text style={styles.fieldLabel}>Email or Student Number</Text>
                <Animated.View
                  style={[
                    styles.inputRow,
                    { borderColor: emailBorderColor, backgroundColor: emailBackground },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={17}
                    color={emailFocused ? colors.primary : colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={identifierRef}
                    style={styles.input}
                    placeholder="name@cvsu.edu.ph or 202300001"
                    placeholderTextColor={colors.gray}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    value={identifier}
                    onChangeText={(v) => setIdentifier(limitStudentNumber(v))}
                    onFocus={handleEmailFocus}
                    onBlur={handleEmailBlur}
                  />
                </Animated.View>
              </Animated.View>

              <View style={{ height: 22 }} />

              <Animated.View
                style={{
                  opacity: passwordFieldOpacity,
                  transform: [{ translateY: passwordFieldTranslateY }],
                }}
              >
                <Text style={styles.fieldLabel}>Password</Text>
                <Animated.View
                  style={[
                    styles.inputRow,
                    { borderColor: passwordBorderColor, backgroundColor: passwordBackground },
                  ]}
                >
                  <Ionicons
                    name="lock-closed-outline"
                    size={17}
                    color={passwordFocused ? colors.primary : colors.textSecondary}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={passwordRef}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor={colors.gray}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                    <Ionicons
                      name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotLink}
                  hitSlop={8}
                >
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            <Animated.View
              onLayout={(e) => {
                const { y, height: h } = e.nativeEvent.layout;
                contentBottom.current = y + h;
              }}
              style={{
                width: '100%',
                opacity: buttonOpacity,
                transform: [{ translateY: buttonTranslateY }, { scale: buttonPressScale }],
              }}
            >
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                onPressIn={handleButtonPressIn}
                onPressOut={handleButtonPressOut}
                disabled={loading}
                activeOpacity={0.88}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Log In</Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
      </TouchableWithoutFeedback>


      {/* Styled pop-up for login errors */}
      {dialog}
    </View>
  );
}

const LOGO_SIZE = 76; // biggest the logo gets in the green header

const styles = StyleSheet.create({
  // White root so nothing grey peeks out below the card while it's lifted.
  root: { flex: 1, backgroundColor: '#fff' },

  hero: { backgroundColor: BRAND.deep, overflow: 'hidden' },

  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardContent: {
    paddingTop: 32,
    paddingBottom: 36,
    alignItems: 'center',
  },

  // "QLess" and the library name under the logo (in the green header)
  heroTitle: { color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: 0.5, marginTop: 8 },
  heroCaption: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 3 },

  heroLogoWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    height: 52,
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