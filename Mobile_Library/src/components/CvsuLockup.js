import React from 'react';
import { View, Text, Image, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme/colors';

// The CvSU seal (same file the Welcome slide already uses).
const CVSU_LOGO = require('../../assets/cvsu_logo.png');

/**
 * CvsuSeal — the CvSU logo on a small white circle, so it stays readable on the
 * deep green screens as well as on white ones.
 *   size   diameter of the circle
 *   glass  see-through circle with a thin light ring instead of solid white
 */
export function CvsuSeal({ size = 40, glass = false, style }) {
  const inner = Math.round(size * 0.82);
  return (
    <View style={[styles.seal, glass && styles.sealGlass, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Image source={CVSU_LOGO} style={{ width: inner, height: inner }} resizeMode="contain" />
    </View>
  );
}

// Offsets (in border widths) for the 8 copies that draw the border around the logo's own shape.
const OUTLINE_STEPS = [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]];

/**
 * CvsuLogoMark — the CvSU logo by itself (no circle or backdrop) with a thin light border that
 * follows the logo's own shape, plus a soft shadow so it floats on the deep green headers.
 * The border is made by drawing the logo several times behind itself in a light color.
 *   size         size of the logo
 *   border       border thickness
 *   borderColor  border color (keep it a solid color, so the overlaps stay even)
 */
export function CvsuLogoMark({ size = 60, border = 1.5, borderColor = '#F2F7F3', style }) {
  const box = size + border * 2;
  return (
    <View style={[styles.logoMark, { width: box, height: box }, style]}>
      {OUTLINE_STEPS.map(([dx, dy], i) => (
        <Image
          key={i}
          source={CVSU_LOGO}
          resizeMode="contain"
          style={{ position: 'absolute', width: size, height: size, left: border + dx * border, top: border + dy * border, tintColor: borderColor }}
        />
      ))}
      <Image source={CVSU_LOGO} resizeMode="contain" style={{ position: 'absolute', width: size, height: size, left: border, top: border }} />
    </View>
  );
}

/**
 * CvsuLockup — "Made for Cavite State University": the seal with the university and
 * library names beside it. Shown on the opening screens so it's clear who the app is for.
 *   tone          'dark' (white text, for the deep green screens) | 'light' (for white screens)
 *   size          size of the seal
 *   showLibrary   also show the library name on a second line
 *   progress      optional Animated value 0 → 1 that plays an entrance: the whole badge slides up
 *                 and fades in, and the seal pops in with a tiny bounce. Without it the badge is static.
 */
export default function CvsuLockup({ tone = 'dark', size = 40, showLibrary = true, progress, style }) {
  const dark = tone === 'dark';
  const enter = progress
    ? {
        opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }],
      }
    : null;
  const sealPop = progress
    ? { transform: [{ scale: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.6, 1.08, 1] }) }] }
    : null;
  return (
    <Animated.View style={[styles.row, enter, style]}>
      <Animated.View style={sealPop}>
        <CvsuSeal size={size} />
      </Animated.View>
      <View style={styles.texts}>
        <Text style={[styles.kicker, { color: dark ? 'rgba(255,255,255,0.55)' : colors.textSecondary }]}>MADE FOR</Text>
        <Text style={[styles.name, { color: dark ? '#fff' : colors.textPrimary }]}>Cavite State University - Main Campus Library</Text>
        {showLibrary && (
          <Text style={[styles.library, { color: dark ? 'rgba(255,255,255,0.7)' : colors.textSecondary }]}>
            Indang, Cavite
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  seal: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sealGlass: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  // Soft shadow under the logo (shows on iPhone; Android has no shadow without a background).
  logoMark: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  texts: { flexShrink: 1 },
  kicker: { fontSize: 9.5, fontWeight: '700', letterSpacing: 1.6 },
  name: { fontSize: 14.5, fontWeight: '700', marginTop: 1 },
  library: { fontSize: 11.5, marginTop: 1 },
});