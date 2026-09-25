import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { getResponsive } from '../theme/responsive';

/**
 * SplashScreen — CvSU intro, green intro transition, then the eDiwa welcome content.
 *
 * Timeline:
 *    300 – 1100  GREEN screen, CvSU logo fades in + scales up
 *   1100 – 2100  Logo holds, centered
 *   2100 – 2900  Green intro panels split from center
 *                Green app background is revealed underneath.
 *   2800         eDiwa text
 *   3200         CvSU Library Companion
 *   3550         Tagline
 *   3900         CREATE ACCOUNT button
 *   4200         Login link
 *
 * UI-only file:
 * navigation targets ('Register' / 'Login') are unchanged.
 */

const CVSU_LOGO = require('../../assets/cvsu_logo.png');

// If your PNG is not already green and you want it tinted.
const TINT_LOGO_GREEN = false;
const CVSU_GREEN = '#053915';

// ---------- Timeline ----------
const T = {
  LOGO_START: 500,
  LOGO_IN: 1000,
  HOLD_END: 2300,
  SPLIT: 1000,
  

  BRAND: 2800,
  CIRCLE: 1700,
  ICON: 3400,

  WORDMARK: 4000,
  SUBTITLE: 4400,
  TAGLINE: 4750,
  BUTTON: 5100,
  LOGIN: 5400,
  DONE: 5900,
};

const GREEN = '#4b5b53';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const OUT = Easing.out(Easing.cubic);
const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);

const timing = (
  value,
  toValue,
  duration,
  easing = OUT,
  native = true
) =>
  Animated.timing(value, {
    toValue,
    duration,
    easing,
    useNativeDriver: native,
  });

const at = (ms, ...anims) =>
  Animated.sequence([
    Animated.delay(ms),
    ...anims,
  ]);

// ---------- Soft radial glow ----------
function RadialGlow({
  id,
  width,
  height,
  peak = 0.5,
}) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient
          id={id}
          cx="50%"
          cy="50%"
          rx="50%"
          ry="50%"
          fx="50%"
          fy="50%"
        >
          <Stop
            offset="0%"
            stopColor={GREEN}
            stopOpacity={peak}
          />

          <Stop
            offset="55%"
            stopColor={GREEN}
            stopOpacity={peak * 0.35}
          />

          <Stop
            offset="100%"
            stopColor={GREEN}
            stopOpacity={0}
          />
        </RadialGradient>

        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={`url(#${id})`}
        />
      </Defs>

      <Rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill={`url(#${id})`}
      />
    </Svg>
  );
}

export default function SplashScreen({ navigation }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);

  // ------------------------------------------------
  // STATES
  // ------------------------------------------------

  const [interactive, setInteractive] = useState(false);

  const [introGone, setIntroGone] = useState(false);

  // ------------------------------------------------
  // CvSU INTRO
  // ------------------------------------------------

  const logoOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const logoScale = useRef(
    new Animated.Value(0.12)
  ).current;

  const transitionScale = useRef(
    new Animated.Value(0.02)
  ).current;

  // ------------------------------------------------
  // SPLIT PANELS
  // ------------------------------------------------

  const split = useRef(
    new Animated.Value(0)
  ).current;

  const halfW = width / 2;

  const leftX = split.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(halfW + 2)],
  });

  const rightX = split.interpolate({
    inputRange: [0, 1],
    outputRange: [0, halfW + 2],
  });

  // ------------------------------------------------
  // WELCOME LOGO
  // ------------------------------------------------

  const brandOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const brandScale = useRef(
    new Animated.Value(0.7)
  ).current;

  const brandTranslateY = useRef(
    new Animated.Value(14)
  ).current;

  const spin = useRef(
    new Animated.Value(0)
  ).current;

  const drawProgress = useRef(
    new Animated.Value(0)
  ).current;

  const iconOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const iconScale = useRef(
    new Animated.Value(0.7)
  ).current;

  const glowReveal = useRef(
    new Animated.Value(0)
  ).current;

  const glowPulse = useRef(
    new Animated.Value(0.6)
  ).current;

  const glowOpacity = useRef(
    Animated.multiply(
      glowReveal,
      glowPulse
    )
  ).current;

  const spinDeg = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['-360deg', '0deg'],
  });

  // ------------------------------------------------
  // WELCOME CONTENT
  // ------------------------------------------------

  const wordmarkOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const wordmarkTranslateY = useRef(
    new Animated.Value(14)
  ).current;

  const wordmarkScale = useRef(
    new Animated.Value(0.9)
  ).current;

  const subtitleOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const subtitleTranslateY = useRef(
    new Animated.Value(10)
  ).current;

  const taglineOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const taglineTranslateY = useRef(
    new Animated.Value(18)
  ).current;

  const buttonOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const buttonTranslateY = useRef(
    new Animated.Value(24)
  ).current;

  const buttonScale = useRef(
    new Animated.Value(0.95)
  ).current;

  const buttonPressScale = useRef(
    new Animated.Value(1)
  ).current;

  const buttonScaleCombined = useRef(
    Animated.multiply(
      buttonScale,
      buttonPressScale
    )
  ).current;

  const loginOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const loginTranslateY = useRef(
    new Animated.Value(10)
  ).current;

  // ------------------------------------------------
  // SIZES
  // ------------------------------------------------

  const logoSize = layout.isCompact
    ? 190
    : 220;

  const transitionSize =
    Math.hypot(width, height) * 1.15;

  // ------------------------------------------------
  // CIRCLE LOGO GEOMETRY
  // ------------------------------------------------

  const brandSize = layout.isCompact
    ? 72
    : 84;

  const strokeWidth = 1.5;

  const radius =
    (brandSize - strokeWidth) / 2;

  const circumference =
    2 * Math.PI * radius;

  const glowSize =
    brandSize * 2.2;

  const dashOffset =
    drawProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [
        circumference - 0.1,
        0,
      ],
    });

  // ------------------------------------------------
  // ANIMATION
  // ------------------------------------------------

  useEffect(() => {
    // Glow loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        timing(
          glowPulse,
          1,
          1800,
          Easing.inOut(Easing.sin)
        ),

        timing(
          glowPulse,
          0.6,
          1800,
          Easing.inOut(Easing.sin)
        ),
      ])
    );

    glowLoop.start();

    // ------------------------------------------------
    // MAIN TIMELINE
    // ------------------------------------------------

    const timeline = Animated.parallel([
      // ----------------------------------------------
      // 1. CvSU LOGO
      // ----------------------------------------------

      at(
        T.LOGO_START,

        Animated.parallel([
          timing(
            logoOpacity,
            1,
            T.LOGO_IN,
            Easing.out(Easing.quad)
          ),

          timing(
            logoScale,
            1,
            T.LOGO_IN,
            Easing.out(Easing.back(1.4))
          ),
        ])
      ),

      // ----------------------------------------------
      // 2. GREEN INTRO TRANSITION
      // ----------------------------------------------

      at(
        T.HOLD_END,

        Animated.parallel([
          timing(
            transitionScale,
            1,
            T.SPLIT,
            IN_OUT
          ),

          timing(
            split,
            1,
            T.SPLIT,
            IN_OUT
          ),

          timing(
            logoOpacity,
            0,
            T.SPLIT * 0.6,
            Easing.in(Easing.quad)
          ),

          timing(
            logoScale,
            1.35,
            T.SPLIT * 0.45,
            Easing.out(Easing.quad)
          ),
        ])
      ),

      // ----------------------------------------------
      // 3. CIRCULAR WELCOME LOGO
      // ----------------------------------------------

      at(
        T.BRAND,

        Animated.parallel([
          timing(
            brandOpacity,
            1,
            600
          ),

          timing(
            brandTranslateY,
            0,
            700
          ),

          timing(
            brandScale,
            1,
            900
          ),

          timing(
            glowReveal,
            1,
            900
          ),

          timing(
            spin,
            1,
            T.CIRCLE,
            IN_OUT
          ),

          timing(
            drawProgress,
            1,
            T.CIRCLE,
            IN_OUT,
            false
          ),
        ])
      ),

      // ----------------------------------------------
      // 4. LIBRARY ICON
      // ----------------------------------------------

      at(
        T.ICON,

        Animated.parallel([
          timing(
            iconOpacity,
            1,
            450
          ),

          timing(
            iconScale,
            1,
            450
          ),
        ])
      ),

      // ----------------------------------------------
      // 5. EDIWA TEXT
      // ----------------------------------------------

      at(
        T.WORDMARK,

        Animated.parallel([
          timing(
            wordmarkOpacity,
            1,
            500
          ),

          timing(
            wordmarkTranslateY,
            0,
            500
          ),

          timing(
            wordmarkScale,
            1,
            500
          ),
        ])
      ),

      // ----------------------------------------------
      // 6. SUBTITLE
      // ----------------------------------------------

      at(
        T.SUBTITLE,

        Animated.parallel([
          timing(
            subtitleOpacity,
            1,
            400
          ),

          timing(
            subtitleTranslateY,
            0,
            400
          ),
        ])
      ),

      // ----------------------------------------------
      // 7. TAGLINE
      // ----------------------------------------------

      at(
        T.TAGLINE,

        Animated.parallel([
          timing(
            taglineOpacity,
            1,
            500
          ),

          timing(
            taglineTranslateY,
            0,
            500
          ),
        ])
      ),

      // ----------------------------------------------
      // 8. CREATE ACCOUNT
      // ----------------------------------------------

      at(
        T.BUTTON,

        Animated.parallel([
          timing(
            buttonOpacity,
            1,
            400
          ),

          timing(
            buttonTranslateY,
            0,
            500
          ),

          Animated.spring(
            buttonScale,
            {
              toValue: 1,
              friction: 6,
              tension: 120,
              useNativeDriver: true,
            }
          ),
        ])
      ),

      // ----------------------------------------------
      // 9. LOGIN
      // ----------------------------------------------

      at(
        T.LOGIN,

        Animated.parallel([
          timing(
            loginOpacity,
            1,
            400
          ),

          timing(
            loginTranslateY,
            0,
            400
          ),
        ])
      ),

      // ----------------------------------------------
      // 10. ENABLE INTERACTION
      // ----------------------------------------------

      Animated.delay(T.DONE),
    ]);

    // Remove intro overlay after transition
    const introTimer = setTimeout(
      () =>
        setIntroGone(true),
      T.HOLD_END +
        T.SPLIT +
        100
    );

    timeline.start(
      ({ finished }) => {
        if (finished) {
          setInteractive(true);
        }
      }
    );

    return () => {
      clearTimeout(introTimer);
      timeline.stop();
      glowLoop.stop();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------
  // BUTTON PRESS
  // ------------------------------------------------

  const handlePressIn = () => {
    Animated.spring(
      buttonPressScale,
      {
        toValue: 0.96,
        friction: 6,
        useNativeDriver: true,
      }
    ).start();
  };

  const handlePressOut = () => {
    Animated.spring(
      buttonPressScale,
      {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }
    ).start();
  };

  // ------------------------------------------------
  // RENDER
  // ------------------------------------------------

  return (
    <View style={styles.root}>

      {/* ============================================
          GREEN APP BACKGROUND
          ============================================ */}

      <View style={styles.imagePlaceholder} />

      <View style={styles.overlay} />

      {/* ============================================
          WELCOME CONTENT
          ============================================ */}

      <SafeAreaView
        pointerEvents={
          interactive
            ? 'auto'
            : 'none'
        }
        style={[
          styles.content,
          {
            paddingHorizontal:
              layout.horizontalPadding,
          },
        ]}
      >

        <View
          style={{
            flex: 1,
          }}
        />

        {/* ------------------------------------------
            LOGO + BRANDING
            ------------------------------------------ */}

        <View style={styles.logoWrap}>

          <Animated.View
            style={{
              opacity: brandOpacity,

              transform: [
                {
                  translateY:
                    brandTranslateY,
                },

                {
                  scale:
                    brandScale,
                },
              ],
            }}
          >

            {/* Glow */}

            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',

                left:
                  -(
                    (glowSize -
                      brandSize) /
                    2
                  ),

                top:
                  -(
                    (glowSize -
                      brandSize) /
                    2
                  ),

                width: glowSize,
                height: glowSize,

                opacity:
                  glowOpacity,
              }}
            >
              <RadialGlow
                id="logoGlow"
                width={glowSize}
                height={glowSize}
                peak={0.5}
              />
            </Animated.View>

            {/* Circular Logo */}

            <Animated.View
              style={[
                styles.logoCircle,

                {
                  width: brandSize,
                  height: brandSize,
                  borderRadius:
                    brandSize / 2,

                  transform: [
                    {
                      rotate: spinDeg,
                    },
                  ],
                },
              ]}
            >

              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,

                  {
                    borderRadius:
                      brandSize / 2,

                    backgroundColor:
                      'rgba(6, 41, 18, 0.4)',

                    opacity:
                      iconOpacity,
                  },
                ]}
              />

              <Svg
                width={brandSize}
                height={brandSize}
                style={
                  StyleSheet.absoluteFill
                }
              >

                <AnimatedCircle
                  cx={brandSize / 2}
                  cy={brandSize / 2}
                  r={radius}
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={
                    dashOffset
                  }
                  rotation="-90"
                  origin={`${brandSize / 2}, ${brandSize / 2}`}
                />

              </Svg>

              <Animated.View
                style={{
                  opacity:
                    iconOpacity,

                  transform: [
                    {
                      scale:
                        iconScale,
                    },
                  ],
                }}
              >
                <Ionicons
                  name="library-outline"
                  size={
                    layout.isCompact
                      ? 30
                      : 34
                  }
                  color="#fff"
                />
              </Animated.View>

            </Animated.View>

          </Animated.View>

          {/* eDiwa */}

          <Animated.Text
            style={[
              styles.wordmark,

              {
                fontSize:
                  layout.isCompact
                    ? 25
                    : 28,

                opacity:
                  wordmarkOpacity,

                transform: [
                  {
                    translateY:
                      wordmarkTranslateY,
                  },

                  {
                    scale:
                      wordmarkScale,
                  },
                ],
              },
            ]}
          >
            eDiwa
          </Animated.Text>

          {/* Subtitle */}

          <Animated.Text
            style={[
              styles.wordmarkSub,

              {
                opacity:
                  subtitleOpacity,

                transform: [
                  {
                    translateY:
                      subtitleTranslateY,
                  },
                ],
              },
            ]}
          >
            CvSU Library Companion
          </Animated.Text>

        </View>

        <View
          style={{
            flex: 1,
          }}
        />

        {/* ------------------------------------------
            TAGLINE
            ------------------------------------------ */}

        <Animated.Text
          style={[
            styles.tagline,

            {
              opacity:
                taglineOpacity,

              transform: [
                {
                  translateY:
                    taglineTranslateY,
                },
              ],
            },
          ]}
        >
          Access and monitor your library visits with ease.
        </Animated.Text>

        {/* ------------------------------------------
            CREATE ACCOUNT
            ------------------------------------------ */}

        <Animated.View
          style={{
            opacity:
              buttonOpacity,

            transform: [
              {
                translateY:
                  buttonTranslateY,
              },

              {
                scale:
                  buttonScaleCombined,
              },
            ],
          }}
        >

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() =>
              navigation.navigate(
                'Register'
              )
            }
            onPressIn={
              handlePressIn
            }
            onPressOut={
              handlePressOut
            }
            activeOpacity={0.85}
          >
            <Text
              style={
                styles.primaryBtnText
              }
            >
              CREATE ACCOUNT
            </Text>
          </TouchableOpacity>

        </Animated.View>

        {/* ------------------------------------------
            LOGIN
            ------------------------------------------ */}

        <Animated.View
          style={{
            opacity:
              loginOpacity,

            transform: [
              {
                translateY:
                  loginTranslateY,
              },
            ],
          }}
        >

          <TouchableOpacity
            onPress={() =>
              navigation.navigate(
                'Login'
              )
            }
            style={{
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            <Text
              style={
                styles.loginLink
              }
            >
              Already have an account? Log in
            </Text>
          </TouchableOpacity>

        </Animated.View>

      </SafeAreaView>

      {/* ============================================
          INTRO OVERLAY
          GREEN INSTEAD OF WHITE
          ============================================ */}

      {!introGone && (
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >

          {/* Green expanding circle */}

          <Animated.View
            style={{
              position: 'absolute',

              width:
                transitionSize,

              height:
                transitionSize,

              left:
                (width -
                  transitionSize) /
                2,

              top:
                (height -
                  transitionSize) /
                2,

              borderRadius:
                transitionSize / 2,

              backgroundColor:
                CVSU_GREEN,

              transform: [
                {
                  scale:
                    transitionScale,
                },
              ],
            }}
          />

          {/* LEFT GREEN PANEL */}

          <Animated.View
            style={[
              styles.panel,

              {
                left: 0,

                width:
                  Math.ceil(
                    halfW
                  ) + 1,

                transform: [
                  {
                    translateX:
                      leftX,
                  },
                ],
              },
            ]}
          />

          {/* RIGHT GREEN PANEL */}

          <Animated.View
            style={[
              styles.panel,

              {
                left:
                  Math.floor(
                    halfW
                  ),

                width:
                  Math.ceil(
                    halfW
                  ) + 1,

                transform: [
                  {
                    translateX:
                      rightX,
                  },
                ],
              },
            ]}
          />

          {/* CvSU Logo */}

          <View
            style={
              styles.introCenter
            }
          >

            <Animated.View
              style={{
                opacity:
                  logoOpacity,

                transform: [
                  {
                    scale:
                      logoScale,
                  },

                  {
                    translateY: 250,
                  },
                ],
              }}
            >

              <Image
                source={
                  CVSU_LOGO
                }
                style={[
                  {
                    width:
                      logoSize,

                    height:
                      logoSize,
                  },

                  TINT_LOGO_GREEN && {
                    tintColor:
                      CVSU_GREEN,
                  },
                ]}
                resizeMode="contain"
              />

            </Animated.View>

          </View>

        </View>
      )}

    </View>
  );
}

// ==================================================
// STYLES
// ==================================================

const styles = StyleSheet.create({

  // Main screen
  root: {
    flex: 1,
    backgroundColor:
      CVSU_GREEN,
  },

  // Green background
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      CVSU_GREEN,
  },

  // Green overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:
      'rgba(6, 31, 17, 0.55)',
  },

  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },

  // ================================================
  // INTRO
  // ================================================

  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,

    // CHANGED:
    // White → Green
    backgroundColor:
      CVSU_GREEN,
  },

  introCenter: {
    ...StyleSheet.absoluteFillObject,

    alignItems: 'center',
    justifyContent: 'center',
  },

  // ================================================
  // WELCOME LOGO
  // ================================================

  logoWrap: {
    alignItems: 'center',
  },

  logoCircle: {
    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 16,
  },

  // ================================================
  // WORDMARK
  // ================================================

  wordmark: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
  },

  wordmarkSub: {
    color: '#CFE3D4',
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 6,
    textTransform: 'uppercase',
  },

  // ================================================
  // TAGLINE
  // ================================================

  tagline: {
    color: '#E8F5E9',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 28,
  },

  // ================================================
  // CREATE ACCOUNT
  // ================================================

  primaryBtn: {
    borderWidth: 1.5,
    borderColor: '#fff',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 1,
  },

  // ================================================
  // LOGIN
  // ================================================

  loginLink: {
    color: '#CFE3D4',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
});