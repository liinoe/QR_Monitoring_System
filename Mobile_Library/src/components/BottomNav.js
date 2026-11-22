import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, HEADER_RADIUS } from '../theme/brand';

// The two places a signed-in person can go from the bottom of the screen.
const ITEMS = [
  { route: 'HomeScreen', label: 'Home', icon: 'home', iconOff: 'home-outline' },
  { route: 'Settings', label: 'Settings', icon: 'settings', iconOff: 'settings-outline' },
];

/**
 * BottomNav — footer navigation (Home | Settings), shown on both screens.
 * Deep green like the header, with the same rounded corners turned upside down
 * (rounded at the top), so the two bars frame the page.
 *   active       which tab is highlighted ('HomeScreen' or 'Settings')
 *   current      the route name of the screen showing the footer (defaults to `active`).
 *                A screen that belongs to a tab but isn't the tab itself (My Visits belongs to
 *                Home) passes its own name, so tapping its highlighted tab still goes there.
 *   navigation   the screen's navigation object
 * Tapping the screen you are already on does nothing.
 */
export default function BottomNav({ active, current = active, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {ITEMS.map((item) => {
        const isActive = item.route === active;
        const color = isActive ? BRAND.goldLight : 'rgba(255,255,255,0.65)';
        return (
          <TouchableOpacity
            key={item.route}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => { if (item.route !== current) navigation.navigate(item.route); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={item.label}
          >
            {/* The current tab gets a soft pill behind its icon */}
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Ionicons name={isActive ? item.icon : item.iconOff} size={22} color={color} />
            </View>
            <Text style={[styles.label, { color }, isActive && styles.labelActive]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: BRAND.deep,
    borderTopLeftRadius: HEADER_RADIUS,
    borderTopRightRadius: HEADER_RADIUS,
    paddingTop: 10,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: { width: 58, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11.5, fontWeight: '600' },
  labelActive: { fontWeight: '800' },
});