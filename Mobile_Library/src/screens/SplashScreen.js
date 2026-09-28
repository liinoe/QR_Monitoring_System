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
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';
import { getResponsive } from '../theme/responsive';
import { QLessMark, QLessTile, ScanFrame, BrandPattern, TILE_RADIUS_RATIO } from '../components/QLessLogo';

const CVSU_LOGO = require('../../assets/cvsu_logo.png');
const APP_NAME = 'QLess';
const WELCOME_TILE = 104;

const EASE = Easing.bezier(0.4, 0, 0.2, 1);
const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

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
  const morph = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current; // fallback if measuring fails
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

  const startMorph = async () => {
    if (morphStarted.current) return;
    morphStarted.current = true;
    const t = await measureTile();
    const finish = () => setIntroDone(true);

    if (!t) {
      Animated.timing(fadeOut, { toValue: 0, duration: 400, easing: EASE, useNativeDriver: false }).start(finish);
      return;
    }
    setTarget(t);
    Animated.timing(morph, { toValue: 1, duration: 780, easing: EASE_IN_OUT, useNativeDriver: false }).start(finish);
  };

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
    return () => introRef.current?.stop();
  }, []);

  const showCta = () => {
    if (ctaShown.current) return;
    ctaShown.current = true;
    Animated.timing(cta, { toValue: 1, duration: 420, delay: 120, easing: EASE, useNativeDriver: false }).start();
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
  const lerp = (from, to) => morph.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
  const overlayStyle = target
    ? {
        left: lerp(0, target.x),
        top: lerp(0, target.y),
        width: lerp(rootSize.w, target.size),
        height: lerp(rootSize.h, target.size),
        borderRadius: lerp(0, target.size * TILE_RADIUS_RATIO),
      }
    : { left: 0, top: 0, width: rootSize.w, height: rootSize.h, opacity: fadeOut };
  const overlayMarkSize = target ? lerp(introMarkSize, target.size) : introMarkSize;
  const markLift = target ? lerp(-30, 0) : -30;
  const wordmarkOpacity = Animated.multiply(
    wordmark,
    morph.interpolate({ inputRange: [0, 0.25], outputRange: [1, 0], extrapolate: 'clamp' })
  );
  const wordmarkRise = wordmark.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const ctaOpacity = Animated.multiply(
    cta,
    morph.interpolate({ inputRange: [0, 0.2], outputRange: [1, 0], extrapolate: 'clamp' })
  );
  const ctaRise = cta.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const patternOpacity = morph.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={(e) => setRootSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <StatusBar style={introDone ? 'dark' : 'light'} />
      <BrandPattern size={260} color={BRAND.deep} opacity={0.045} style={{ top: -40, right: -70 }} />
      <BrandPattern size={200} color={BRAND.deep} opacity={0.035} style={{ bottom: 120, left: -80 }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {!isLast && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} hitSlop={10}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
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
                    <View ref={tileRef} collapsable={false}>
                      <QLessTile size={WELCOME_TILE} />
                    </View>
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
                  <Text style={styles.slideTitle}>{item.title}</Text>
                  <Text style={styles.slideDescription}>{item.description}</Text>
                  {item.isBrand && (
                    <View style={styles.cvsuChip}>
                      <Image source={CVSU_LOGO} style={styles.cvsuLogo} resizeMode="contain" />
                      <Text style={styles.cvsuChipText}>Cavite State University - Main Campus</Text>
                    </View>
                  )}
                </Animated.View>
              </View>
            );
          }}
        />

        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 22, 8], extrapolate: 'clamp' });
            const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: 'clamp' });
            return <Animated.View key={i} style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]} />;
          })}
        </View>

        <View style={[styles.footer, { paddingHorizontal: layout.horizontalPadding }]}>
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
        </View>
      </SafeAreaView>

      {/* INTRO OVERLAY — full-screen green that shrinks into the welcome tile */}
      {!introDone && (
        <TouchableWithoutFeedback onPress={skipIntro}>
          <Animated.View style={[styles.intro, overlayStyle]}>
            <Animated.View style={{ opacity: patternOpacity, ...StyleSheet.absoluteFillObject }}>
              <BrandPattern size={rootSize.w * 0.9} opacity={0.05} style={{ top: -rootSize.w * 0.2, right: -rootSize.w * 0.35 }} />
              <BrandPattern size={rootSize.w * 0.7} opacity={0.04} style={{ bottom: -rootSize.w * 0.1, left: -rootSize.w * 0.3 }} />
            </Animated.View>

            <Animated.View style={{ transform: [{ translateY: markLift }] }}>
              <QLessMark size={overlayMarkSize} tone="dark" anim={draw} />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.wordmarkWrap,
                {
                  top: rootSize.h / 2 - 30 + introMarkSize / 2 + 18,
                  opacity: wordmarkOpacity,
                  transform: [{ translateY: wordmarkRise }],
                },
              ]}
            >
              <Text style={styles.wordmark}>
                Q<Text style={styles.wordmarkLess}>Less</Text>
              </Text>
              <Text style={styles.tagline}>Scan in. Skip the line.</Text>
            </Animated.View>

            {/* GET STARTED — pressing it morphs the splash into the Welcome screen */}
            <Animated.View
              style={[
                styles.ctaWrap,
                { bottom: insets.bottom + 36, opacity: ctaOpacity, transform: [{ translateY: ctaRise }] },
              ]}
            >
              <TouchableOpacity style={styles.ctaBtn} onPress={handleGetStarted} activeOpacity={0.88}>
                <Text style={styles.ctaText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color={BRAND.deep} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </TouchableWithoutFeedback>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },

  intro: {
    position: 'absolute',
    backgroundColor: BRAND.deep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 50,
    elevation: 50,
  },
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

  skipBtn: { position: 'absolute', top: 12, right: 20, zIndex: 10, padding: 8 },
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