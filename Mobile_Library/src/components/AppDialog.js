import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Modal, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur'; // install once: npx expo install expo-blur
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';

/**
 * AppDialog — QLess-styled replacement for the phone's plain Alert.alert().
 * It opens full-screen, centered, with the screen behind it blurred and faded.
 *
 * How to use in a screen:
 *   const { dialog, showDialog } = useAppDialog();
 *   showDialog({ tone: 'error', title: 'Oops', message: 'Something went wrong.' });
 *   ...and put {dialog} anywhere inside the screen's JSX.
 *
 * Buttons (optional): [{ text: 'Cancel', style: 'secondary' }, { text: 'OK', style: 'primary', onPress: fn }]
 * style can be 'primary' (green), 'secondary' (gray) or 'destructive' (red).
 */

// Title color for each kind of message (no icons — the title and color say it).
const TONES = {
  error:   { color: '#B3261E' },
  warning: { color: '#8A5A00' },
  success: { color: BRAND.green },
  info:    { color: colors.textPrimary },
};

// Draws the dialog. Normally you don't use this directly — use useAppDialog() below.
export function AppDialog({ visible, tone = 'info', title, message, buttons, onButton }) {
  const fade = useRef(new Animated.Value(0)).current;
  const look = TONES[tone] || TONES.info;
  const list = buttons && buttons.length ? buttons : [{ text: 'OK', style: 'primary' }];
  // Android's back button acts like the gray (cancel) button, or the only button.
  const cancelBtn = list.find((b) => b.style === 'secondary') || list[list.length - 1];

  // Fade + slight grow in when opening.
  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      Animated.timing(fade, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }
  }, [visible]);

  const scale = fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => onButton(cancelBtn)}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        {/* Blur the screen behind, then a light green-black tint so the card stands out */}
        <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.dim]} />

        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          {!!title && <Text style={[styles.title, { color: look.color }]}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}

          <View style={[styles.buttonRow, list.length > 2 && { flexDirection: 'column' }]}>
            {list.map((btn, i) => (
              <TouchableOpacity
                key={`${btn.text}-${i}`}
                style={[
                  styles.button,
                  list.length > 2 && { flex: 0, width: '100%' },
                  btn.style === 'secondary' && styles.buttonSecondary,
                  btn.style === 'destructive' && styles.buttonDestructive,
                ]}
                onPress={() => onButton(btn)}
                activeOpacity={0.85}
              >
                <Text style={[styles.buttonText, btn.style === 'secondary' && styles.buttonTextSecondary]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Hook that gives a screen a showDialog() function plus the dialog to render.
export function useAppDialog() {
  const [config, setConfig] = useState(null); // null = hidden

  // Opens the dialog (hides the keyboard first so it doesn't cover the card).
  const showDialog = useCallback((options) => {
    Keyboard.dismiss();
    setConfig(options);
  }, []);

  // Closes the dialog, then runs the tapped button's action (if it has one).
  // The short wait lets the dialog finish closing before e.g. scrolling or navigating.
  const handleButton = useCallback((btn) => {
    setConfig(null);
    if (btn.onPress) setTimeout(btn.onPress, 250);
  }, []);

  const dialog = (
    <AppDialog
      visible={!!config}
      tone={config?.tone}
      title={config?.title}
      message={config?.message}
      buttons={config?.buttons}
      onButton={handleButton}
    />
  );

  return { dialog, showDialog };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  dim: { backgroundColor: 'rgba(7, 26, 15, 0.25)' },
  // Plain card: title and message on the left, buttons at the bottom right.
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    padding: 20,
    elevation: 8,
  },
  title: { fontSize: 16.5, fontWeight: '700', color: colors.textPrimary },
  message: { fontSize: 13.5, color: colors.textSecondary, lineHeight: 20, marginTop: 6 },
  buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  button: {
    minWidth: 84,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: BRAND.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Secondary = outlined (white with a gray border), like Cancel buttons.
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4E4E7' },
  buttonDestructive: { backgroundColor: '#B3261E' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  buttonTextSecondary: { color: colors.textPrimary },
});