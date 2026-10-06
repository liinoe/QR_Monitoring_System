import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Animated,
  Easing,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';
import { getResponsive } from '../theme/responsive';
import { QLessMark, QLessTile, ScanFrame, BrandPattern, TILE_RADIUS_RATIO } from '../components/QLessLogo';

/**
 * SplashScreen — animated intro that turns into the Welcome slides.
 *
 *  1. Intro (deep green, full screen): the logo builds itself —
 *     scan brackets lock on → magnifier ring draws → handle extends →
 *     book appears → a scan line sweeps the lens → "QLess" wordmark.
 *     A "Get Started" button then rises in at the bottom and waits.
 *     While waiting, the scan line sweeps the lens again every few seconds.
 *  2. Morph (on Get Started): the text and button fade away, then the green screen
 *     shrinks into the rounded app-icon tile (as one big rounded square, so it
 *     already looks like the icon) and lands exactly on the tile at the top of the
 *     Welcome slide. The tile gives a small "landed" bounce and the welcome text
 *     rises in one line after another.
 *     Everything in the morph moves with transforms on the native driver, so it
 *     stays smooth even on slow phones.
 *  3. Welcome slides (unchanged flow): QR tap-in, live headcount, then
 *     Create Account / Log In.
 *
 * Tapping anywhere during the intro finishes the drawing instantly and shows
 * the Get Started button. Navigation targets
 * ('Register' / 'Login') are unchanged.
 */

const CVSU_LOGO = require('../../assets/cvsu_logo.png');
const APP_NAME = 'QLess';
const WELCOME_TILE = 104;

const EASE = Easing.bezier(0.4, 0, 0.2, 1);
const EASE_MORPH = Easing.bezier(0.76, 0, 0.24, 1); // slow start, fast middle, soft landing

const SLIDES = [
  {
    key: 'welcome',
    title: `Welcome to ${APP_NAME}`,
    description: 'Your digital companion for the Ladislao N. Diwa Memorial Library — simple, fast, and always with you.',
    isBrand: true,
  },
  {
    key: 'qr',
    icon: 'qr-code-outline',
    title: 'Scan In With Your QR',
    description: "Show your personal QR pass at the entrance and you're checked in, automatically, every time.",
  },
  {
    key: 'live',
    icon: 'pulse-outline',
    title: "See What's Happening",
    description: "Check how many people are inside and the library's busiest hours before you even head over.",
  },
];

export default function SplashScreen({ navigation }) {
  const isFocused = useIsFocused(); // true while this screen is the one on top
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);
  const [index, setIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);

  // ---- intro state ----
  const rootRef = useRef(null);
  const tileRef = useRef(null);
  const [rootSize, setRootSize] = useState({ w: width, h: height });
  const [introDone, setIntroDone] = useState(false);
  const [target, setTarget] = useState(null); // where the welcome tile sits
  const morphStarted = useRef(false);

  const draw = useRef({
    brackets: new Animated.Value(0),
    ring: new Animated.Value(0),
    handle: new Animated.Value(0),
    book: new Animated.Value(0),
    scan: new Animated.Value(0),
  }).current;
  const wordmark = useRef(new Animated.Value(0)).current;
  const morph = useRef(new Animated.Value(0)).current; // 0 = full screen, 1 = on the welcome tile (native)
  const fadeOut = useRef(new Animated.Value(1)).current; // fallback if measuring fails (native)
  const chrome = useRef(new Animated.Value(1)).current; // wordmark + button, faded out before the morph (native)
  const reveal = useRef(new Animated.Value(0)).current; // welcome text rising in after the morph (native)
  const tilePop = useRef(new Animated.Value(1)).current; // small bounce when the logo lands (native)
  const idleScan = useRef(null); // repeating scan line while waiting for Get Started
  const [morphing, setMorphing] = useState(false);
  const introRef = useRef(null);
  const cta = useRef(new Animated.Value(0)).current; // Get Started button
  const ctaShown = useRef(false);
  const insets = useSafeAreaInsets();

  const isLast = index === SLIDES.length - 1;
  const introMarkSize = Math.min(200, rootSize.w * 0.5);

  const measureTile = () =>
    new Promise((resolve) => {
      if (!rootRef.current || !tileRef.current) return resolve(null);
      rootRef.current.measureInWindow((rx, ry) => {
        tileRef.current.measureInWindow((x, y, w) => {
          if (!w) return resolve(null);
          resolve({ x: x - rx, y: y - ry, size: w });
        });
      });
    });

  // Welcome text rises in, line by line (title → description → chip → buttons).
  const playReveal = (delay = 0) =>
    Animated.timing(reveal, { toValue: 1, duration: 620, delay, easing: EASE, useNativeDriver: true }).start();

  // The logo "lands" on the tile: quick grow, then springs back to normal size.
  const playLanding = () =>
    Animated.sequence([
      Animated.timing(tilePop, { toValue: 1.07, duration: 120, easing: EASE, useNativeDriver: true }),
      Animated.spring(tilePop, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]).start();

  // "Get Started": fade the text/button, then shrink the green screen into the welcome tile.
  const startMorph = async () => {
    if (morphStarted.current) return;
    morphStarted.current = true;
    idleScan.current?.stop();
    draw.scan.setValue(0);
    const t = await measureTile();
    setMorphing(true);

    const fadeChrome = Animated.timing(chrome, { toValue: 0, duration: 200, easing: EASE, useNativeDriver: true });

    if (!t) {
      // couldn't find the tile — just fade the intro away
      Animated.sequence([
        fadeChrome,
        Animated.timing(fadeOut, { toValue: 0, duration: 400, easing: EASE, useNativeDriver: true }),
      ]).start(() => setIntroDone(true));
      playReveal(250);
      return;
    }

    setTarget(t);
    Animated.sequence([
      fadeChrome,
      Animated.timing(morph, { toValue: 1, duration: 760, easing: EASE_MORPH, useNativeDriver: true }),
    ]).start(() => {
      setIntroDone(true);
      playLanding();
    });
    playReveal(200 + 760 * 0.55); // text starts rising while the tile is still settling
  };

  // Plays the logo drawing once when the screen opens.
  useEffect(() => {
    const step = (v, duration, delay, easing = EASE) =>
      Animated.timing(v, { toValue: 1, duration, delay, easing, useNativeDriver: false });

    introRef.current = Animated.parallel([
      step(draw.brackets, 520, 0),
      step(draw.ring, 680, 320),
      step(draw.handle, 240, 960),
      step(draw.book, 360, 1120),
      step(wordmark, 460, 1260),
      step(draw.scan, 820, 1320, Easing.inOut(Easing.quad)),
    ]);
    introRef.current.start(({ finished }) => {
      if (finished) showCta();
    });
    return () => {
      introRef.current?.stop();
      idleScan.current?.stop();
    };
  }, []);

  // Shows the Get Started button, then keeps the logo "alive" with a scan sweep every few seconds.
  const showCta = () => {
    if (ctaShown.current) return;
    ctaShown.current = true;
    Animated.timing(cta, { toValue: 1, duration: 420, delay: 120, easing: EASE, useNativeDriver: false }).start();
    draw.scan.setValue(0);
    idleScan.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1600),
        Animated.timing(draw.scan, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(draw.scan, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])
    );
    idleScan.current.start();
  };

  // Tap during the intro → jump to the finished logo + button (doesn't leave the splash).
  const skipIntro = () => {
    if (ctaShown.current) return;
    introRef.current?.stop();
    [...Object.values(draw), wordmark].forEach((v) => v.setValue(1));
    draw.scan.setValue(0);
    showCta();
  };

  // The button is invisible until the intro finishes, so an early tap there just skips ahead.
  const handleGetStarted = () => (ctaShown.current ? startMorph() : skipIntro());

  // ---- slides ----
  const goToSlide = (i) => listRef.current?.scrollToIndex({ index: i, animated: true });
  const handleNext = () => (isLast ? navigation.navigate('Register') : goToSlide(index + 1));
  const handleSkip = () => navigation.navigate('Login');

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false });
  const onMomentumScrollEnd = (e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width));

  // ---- intro overlay geometry ----
  // The green background is one big rounded square (same corner ratio as the app icon)
  // centred on the screen and big enough to cover it. Shrinking it with scale +
  // translate keeps it a perfect icon shape the whole way down to the welcome tile.
  const W = rootSize.w;
  const H = rootSize.h;
  const BG = Math.hypot(W, H);
  const markCenterY = H / 2 - 30; // the logo sits a little above centre
  const lerp = (from, to) => morph.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const tcx = target ? target.x + target.size / 2 : W / 2; // welcome tile centre
  const tcy = target ? target.y + target.size / 2 : markCenterY;

  const bgStyle = {
    left: W / 2 - BG / 2,
    top: H / 2 - BG / 2,
    width: BG,
    height: BG,
    borderRadius: BG * TILE_RADIUS_RATIO,
    transform: target
      ? [{ translateX: lerp(0, tcx - W / 2) }, { translateY: lerp(0, tcy - H / 2) }, { scale: lerp(1, target.size / BG) }]
      : [],
  };
  const markStyle = {
    left: W / 2 - introMarkSize / 2,
    top: markCenterY - introMarkSize / 2,
    transform: target
      ? [{ translateX: lerp(0, tcx - W / 2) }, { translateY: lerp(0, tcy - markCenterY) }, { scale: lerp(1, target.size / introMarkSize) }]
      : [],
  };

  const wordmarkRise = wordmark.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const chromeDrop = chrome.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  const ctaRise = cta.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  // One welcome line: fades in and rises 16px, starting a bit later than the line above it.
  const riseIn = (from, to) => ({
    opacity: reveal.interpolate({ inputRange: [0, from, to, 1], outputRange: [0, 0, 1, 1] }),
    transform: [{ translateY: reveal.interpolate({ inputRange: [0, from, to, 1], outputRange: [16, 16, 0, 0] }) }],
  });

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={(e) => setRootSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* Dark clock/battery only on the white Welcome slides, and only while this
          screen is showing. Every other screen keeps the white ones from App.js. */}
      <StatusBar style={isFocused && (morphing || introDone) ? 'dark' : 'light'} />
      <BrandPattern size={260} color={BRAND.deep} opacity={0.045} style={{ top: -40, right: -70 }} />
      <BrandPattern size={200} color={BRAND.deep} opacity={0.035} style={{ bottom: 120, left: -80 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {!isLast && (
          <Animated.View style={[styles.skipBtn, riseIn(0.4, 1)]}>
            <TouchableOpacity onPress={handleSkip} hitSlop={10} style={{ padding: 8 }}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <FlatList
          ref={listRef}
          data={SLIDES}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          renderItem={({ item, index: i }) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const scale = scrollX.interpolate({ inputRange, outputRange: [0.75, 1, 0.75], extrapolate: 'clamp' });
            const opacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });

            return (
              <View style={[styles.slide, { width, paddingHorizontal: layout.horizontalPadding }]}>
                {item.isBrand ? (
                  // The intro morph lands exactly on this tile.
                  <Animated.View style={[styles.brandTileWrap, { opacity, transform: [{ scale }] }]}>
                    <Animated.View style={{ transform: [{ scale: tilePop }] }}>
                      <View ref={tileRef} collapsable={false}>
                        <QLessTile size={WELCOME_TILE} />
                      </View>
                    </Animated.View>
                  </Animated.View>
                ) : (
                  <Animated.View style={[styles.featureWrap, { transform: [{ scale }], opacity }]}>
                    <ScanFrame size={148} arm={28} thickness={4} radius={14}>
                      <View style={styles.featureTile}>
                        <Ionicons name={item.icon} size={52} color={BRAND.green} />
                      </View>
                    </ScanFrame>
                  </Animated.View>
                )}

                <Animated.View style={{ opacity }}>
                  <Animated.View style={item.isBrand ? riseIn(0, 0.55) : null}>
                    <Text style={styles.slideTitle}>{item.title}</Text>
                  </Animated.View>
                  <Animated.View style={item.isBrand ? riseIn(0.15, 0.7) : null}>
                    <Text style={styles.slideDescription}>{item.description}</Text>
                  </Animated.View>
                  {item.isBrand && (
                    <Animated.View style={[styles.cvsuChip, riseIn(0.3, 0.85)]}>
                      <Image source={CVSU_LOGO} style={styles.cvsuLogo} resizeMode="contain" />
                      <Text style={styles.cvsuChipText}>Cavite State University</Text>
                    </Animated.View>
                  )}
                </Animated.View>
              </View>
            );
          }}
        />

        <Animated.View style={[styles.dotsRow, riseIn(0.4, 1)]}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 22, 8], extrapolate: 'clamp' });
            const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]} />;
          })}
        </Animated.View>

        <Animated.View style={[styles.footer, { paddingHorizontal: layout.horizontalPadding }, riseIn(0.45, 1)]}>
          {isLast ? (
            <>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Register')} activeOpacity={0.88}>
                <Text style={styles.primaryBtnText}>Create Account</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLinkWrap} hitSlop={8}>
                <Text style={styles.loginLinkText}>
                  Already have an account? <Text style={styles.loginLinkBold}>Log in</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleNext} activeOpacity={0.88}>
              <Text style={styles.primaryBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </SafeAreaView>

      {/* INTRO OVERLAY — big green rounded square that shrinks into the welcome tile */}
      {!introDone && (
        <TouchableWithoutFeedback onPress={skipIntro}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.introLayer, { opacity: fadeOut }]}>
            <Animated.View style={[styles.introBg, bgStyle]} />

            {/* the logo flies with the square and ends at the tile's size */}
            <Animated.View style={[styles.introMark, markStyle]}>
              <QLessMark size={introMarkSize} tone="dark" anim={draw} />
            </Animated.View>

            {/* wordmark + Get Started: fade out first when the morph starts */}
            <Animated.View
              pointerEvents="box-none"
              style={[StyleSheet.absoluteFill, { opacity: chrome, transform: [{ translateY: chromeDrop }] }]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.wordmarkWrap,
                  {
                    top: markCenterY + introMarkSize / 2 + 18,
                    opacity: wordmark,
                    transform: [{ translateY: wordmarkRise }],
                  },
                ]}
              >
                <Text style={styles.wordmark}>
                  Q<Text style={styles.wordmarkLess}>Less</Text>
                </Text>
                <Text style={styles.tagline}>Scan in. Skip the line.</Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.ctaWrap,
                  { bottom: insets.bottom + 36, opacity: cta, transform: [{ translateY: ctaRise }] },
                ]}
              >
                <TouchableOpacity style={styles.ctaBtn} onPress={handleGetStarted} activeOpacity={0.88}>
                  <Text style={styles.ctaText}>Get Started</Text>
                  <Ionicons name="arrow-forward" size={18} color={BRAND.deep} style={{ marginLeft: 8 }} />
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </Animated.View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  introLayer: { zIndex: 50, elevation: 50 },
  introBg: { position: 'absolute', backgroundColor: BRAND.deep },
  introMark: { position: 'absolute' },
  wordmarkWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wordmark: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: 0.5 },
  wordmarkLess: { color: BRAND.goldLight },
  ctaWrap: { position: 'absolute', left: 28, right: 28 },
  ctaBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: BRAND.deep, fontWeight: '700', fontSize: 15.5, letterSpacing: 0.4 },
  tagline: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 6, letterSpacing: 1.2 },

  skipBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  skipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  slide: { alignItems: 'center', justifyContent: 'center' },

  brandTileWrap: {
    marginBottom: 30,
    borderRadius: WELCOME_TILE * TILE_RADIUS_RATIO,
    elevation: 8,
    shadowColor: BRAND.deep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    backgroundColor: BRAND.deep,
  },

  featureWrap: { marginBottom: 28 },
  featureTile: {
    width: 108,
    height: 108,
    borderRadius: 28,
    backgroundColor: BRAND.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },

  slideTitle: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, textAlign: 'center', marginBottom: 12 },
  slideDescription: {
    fontSize: 14.5,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },

  cvsuChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 22,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#EFF1EF',
    gap: 8,
  },
  cvsuLogo: { width: 22, height: 22 },
  cvsuChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4, backgroundColor: BRAND.deep },

  footer: { paddingBottom: 20 },
  primaryBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15.5, letterSpacing: 0.4 },

  loginLinkWrap: { marginTop: 16, alignItems: 'center' },
  loginLinkText: { fontSize: 13, color: colors.textSecondary },
  loginLinkBold: { color: colors.primary, fontWeight: '700' },
});