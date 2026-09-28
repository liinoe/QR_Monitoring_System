import React, { useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, Rect, G, Defs, LinearGradient, Stop, ClipPath } from 'react-native-svg';
import { BRAND } from '../theme/brand';

/**
 * QLess logo.
 *
 *   Scan brackets  → QR scanning (how students tap in)
 *   Magnifier "Q"  → the Q in QLess / finding your way in the library
 *   Open book      → the library itself
 *
 * react-native-svg is already installed (react-native-qrcode-svg depends on it).
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

// ---- geometry (120×120 grid) ----
const BRACKETS = [
     'M10 32 L10 10 L32 10',
     'M88 10 L110 10 L110 32',
     'M110 88 L110 110 L88 110',
     'M32 110 L10 110 L10 88',
];
const BRACKET_LEN = 44;
const RING = { cx: 54, cy: 52, r: 24 };
const RING_LEN = 2 * Math.PI * RING.r;
const HANDLE = { x1: 71, y1: 69, x2: 88, y2: 86 };
const HANDLE_LEN = Math.hypot(17, 17);
const BOOK_L = 'M52.8 46.2 C48.6 42.4 44.6 41.2 40.5 41.8 L40.5 61.8 C44.6 61.3 48.6 62.4 52.8 65.4 Z';
const BOOK_R = 'M55.2 46.2 C59.4 42.4 63.4 41.2 67.5 41.8 L67.5 61.8 C63.4 61.3 59.4 62.4 55.2 65.4 Z';
// Magnifier is scaled up a touch around its own centre so it fills the frame.
const MAG_TRANSFORM = 'translate(-7.67 -7.41) scale(1.13)';

export const TILE_RADIUS_RATIO = 28 / 120;

const TONES = {
     // on dark green (splash, headers, app-icon tile)
     dark: { from: BRAND.goldLight, to: '#C99A22', book: '#FFFFFF', bracket: 'rgba(255,255,255,0.92)', scan: BRAND.goldLight },
     // on white / light backgrounds
     light: { from: '#D9AC2E', to: '#3F6A22', book: BRAND.green, bracket: BRAND.deep, scan: BRAND.gold },
};

let idCounter = 0;
const useStableId = () => {
     const ref = useRef(null);
     if (ref.current === null) ref.current = `qless${++idCounter}`;
     return ref.current;
};

// progress 0→1 turns into a stroke that "draws itself"
const dashOffset = (p, len) => (p ? p.interpolate({ inputRange: [0, 1], outputRange: [len, 0] }) : 0);
// hides the round-cap dot a zero-length dash would otherwise leave behind
const showWhen = (p) => (p ? p.interpolate({ inputRange: [0, 0.02, 1], outputRange: [0, 1, 1] }) : 1);

/**
 * QLessMark — the bare logo.
 *   size   number or Animated value
 *   tone   'dark' (for dark backgrounds) | 'light'
 *   anim   optional { brackets, ring, handle, book, scan } Animated values (0→1)
 *          — when provided the logo builds itself piece by piece (splash intro).
 */
export function QLessMark({ size = 64, tone = 'dark', anim, showBrackets = true, style }) {
     const id = useStableId();
     const t = TONES[tone] || TONES.dark;
     const grad = `url(#${id}g)`;

     const bookOpacity = anim ? anim.book : 1;
     const scanY = anim ? anim.scan.interpolate({ inputRange: [0, 1], outputRange: [30, 72] }) : 0;
     const scanOpacity = anim
     ? anim.scan.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] })
     : 0;

     return (
     <Animated.View style={[{ width: size, height: size }, style]}>
          <Svg width="100%" height="100%" viewBox="0 0 120 120">
          <Defs>
               <LinearGradient id={`${id}g`} x1="26" y1="24" x2="92" y2="90" gradientUnits="userSpaceOnUse">
               <Stop offset="0" stopColor={t.from} />
               <Stop offset="1" stopColor={t.to} />
               </LinearGradient>
               <ClipPath id={`${id}c`}>
               <Circle cx={RING.cx} cy={RING.cy} r={RING.r - 4.5} />
               </ClipPath>
          </Defs>

          {showBrackets &&
               BRACKETS.map((d) => (
               <AnimatedPath
               key={d}
               d={d}
               fill="none"
               stroke={t.bracket}
               strokeWidth={7}
               strokeLinecap="round"
               strokeLinejoin="round"
               strokeDasharray={`${BRACKET_LEN} ${BRACKET_LEN}`}
               strokeDashoffset={dashOffset(anim?.brackets, BRACKET_LEN)}
               opacity={showWhen(anim?.brackets)}
               />
               ))}

          <G transform={MAG_TRANSFORM}>
               {/* ring starts drawing where the handle attaches (45°), so the two read as one stroke */}
               <AnimatedCircle
               cx={RING.cx}
               cy={RING.cy}
               r={RING.r}
               fill="none"
               stroke={grad}
               strokeWidth={9}
               strokeLinecap="round"
               strokeDasharray={`${RING_LEN} ${RING_LEN}`}
               strokeDashoffset={dashOffset(anim?.ring, RING_LEN)}
               opacity={showWhen(anim?.ring)}
               rotation={45}
               origin={`${RING.cx}, ${RING.cy}`}
               />
               <AnimatedLine
               {...HANDLE}
               stroke={grad}
               strokeWidth={10}
               strokeLinecap="round"
               strokeDasharray={`${HANDLE_LEN} ${HANDLE_LEN}`}
               strokeDashoffset={dashOffset(anim?.handle, HANDLE_LEN)}
               opacity={showWhen(anim?.handle)}
               />
               <AnimatedPath d={BOOK_L} fill={t.book} opacity={bookOpacity} />
               <AnimatedPath d={BOOK_R} fill={t.book} opacity={bookOpacity} />

               {/* scan line — only visible while the intro plays */}
               {anim && (
               <G clipPath={`url(#${id}c)`}>
               <AnimatedRect x={28} y={scanY} width={52} height={2.6} rx={1.3} fill={t.scan} opacity={scanOpacity} />
               </G>
               )}
          </G>
          </Svg>
     </Animated.View>
     );
}

/** QLessTile — the app icon: mark on a rounded deep-green square. */
export function QLessTile({ size = 72, style, bordered = false }) {
     return (
     <View
          style={[
          {
               width: size,
               height: size,
               borderRadius: size * TILE_RADIUS_RATIO,
               backgroundColor: BRAND.deep,
               overflow: 'hidden',
          },
          bordered && { borderWidth: Math.max(3, size * 0.05), borderColor: '#fff' },
          style,
          ]}
     >
          <QLessMark size={bordered ? size - Math.max(3, size * 0.05) * 2 : size} tone="dark" />
     </View>
     );
}

/**
 * ScanFrame — four corner brackets around any content.
 */
export function ScanFrame({ size = 120, arm = 22, thickness = 3.5, color = BRAND.gold, radius = 10, children, style }) {
     const base = { position: 'absolute', width: arm, height: arm, borderColor: color };
     return (
     <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
          <View style={[base, { top: 0, left: 0, borderTopWidth: thickness, borderLeftWidth: thickness, borderTopLeftRadius: radius }]} />
          <View style={[base, { top: 0, right: 0, borderTopWidth: thickness, borderRightWidth: thickness, borderTopRightRadius: radius }]} />
          <View style={[base, { bottom: 0, right: 0, borderBottomWidth: thickness, borderRightWidth: thickness, borderBottomRightRadius: radius }]} />
          <View style={[base, { bottom: 0, left: 0, borderBottomWidth: thickness, borderLeftWidth: thickness, borderBottomLeftRadius: radius }]} />
          {children}
     </View>
     );
}

export function BrandPattern({ size = 240, color = '#FFFFFF', opacity = 0.07, style }) {
     return null;
}

const styles = StyleSheet.create({
  patternWrap: { position: 'absolute' },
});