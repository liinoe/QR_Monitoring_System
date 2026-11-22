import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableWithoutFeedback, useWindowDimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { BRAND } from '../theme/brand';
import { QLessMark } from './QLessLogo';
import CvsuLockup from './CvsuLockup';

// Short opening animation shown when the app starts (after the first install),
// and when the student comes back after the app was in the background for a long time.
// Same logo drawing as the first-time intro, but quicker and with no button:
// the logo builds itself, "QLess" fades in, "Made for CvSU" slides up, then the whole screen fades away
// and shows the screen underneath (usually Home). Tap to skip.
//   onDone  called after it has faded out (App.js then removes it)

const EASE = Easing.bezier(0.4, 0, 0.2, 1);

export default function LaunchSplash({ onDone }) {
  const { width, height } = useWindowDimensions();
  // Scales with the screen (smaller on short phones) so the whole group always fits.
  const markSize = Math.min(180, width * 0.45, height * 0.22);

  const draw = useRef({
    brackets: new Animated.Value(0),
    ring: new Animated.Value(0),
    handle: new Animated.Value(0),
    book: new Animated.Value(0),
    scan: new Animated.Value(0),
  }).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const made = useRef(new Animated.Value(0)).current; // "Made for CvSU" slides up after the wordmark
  const fade = useRef(new Animated.Value(1)).current; // whole splash (1 = visible)
  const running = useRef(null);
  const leaving = useRef(false);

  // Fades the splash away, then tells App.js it's finished.
  const finish = () => {
    if (leaving.current) return;
    leaving.current = true;
    running.current?.stop();
    Animated.timing(fade, { toValue: 0, duration: 320, easing: EASE, useNativeDriver: true }).start(() => onDone?.());
  };

  useEffect(() => {
    const step = (v, duration, delay, easing = EASE) =>
      Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: false });

    // About 1.6 seconds in total, then it fades out by itself.
    running.current = Animated.sequence([
      Animated.parallel([
        step(draw.brackets, 380, 0),
        step(draw.ring, 480, 220),
        step(draw.handle, 180, 680),
        step(draw.book, 260, 800),
        step(wordmark, 340, 860),
        step(made, 440, 1150),
        step(draw.scan, 620, 900, Easing.inOut(Easing.quad)),
      ]),
      Animated.delay(150),
    ]);
    running.current.start(({ finished }) => { if (finished) finish(); });
    return () => running.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rise = wordmark.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <TouchableWithoutFeedback onPress={finish}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade, paddingBottom: height * 0.05 }]}>
        <StatusBar style="light" />
        <QLessMark size={markSize} tone="dark" anim={draw} />
        <Animated.View style={{ opacity: wordmark, transform: [{ translateY: rise }], alignItems: 'center' }}>
          <Text style={styles.wordmark}>
            Q<Text style={{ color: BRAND.goldLight }}>Less</Text>
          </Text>
          <Text style={styles.tagline}>Scan in. Skip the line.</Text>
        </Animated.View>
        {/* slides up and fades in after the QLess wordmark */}
        <CvsuLockup tone="dark" size={40} progress={made} style={{ marginTop: 26, paddingHorizontal: 24 }} />
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BRAND.deep, alignItems: 'center', justifyContent: 'center', zIndex: 100, elevation: 100 },
  wordmark: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: 0.5, marginTop: 18 },
  tagline: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 6, letterSpacing: 1.2 },
});