import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Mon, Oct 20" (done by hand so it looks the same on every phone)
export const formatVisitDate = (value) => {
  const d = new Date(value);
  if (isNaN(d)) return '—';
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

// "9:05 AM"
export const formatVisitTime = (value) => {
  const d = new Date(value);
  if (isNaN(d)) return '—';
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
};

// Time between entry and exit: "2h 28m" or "45m"
export const formatDuration = (timeIn, timeOut) => {
  const mins = Math.max(0, Math.round((new Date(timeOut) - new Date(timeIn)) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

// One visit: date on top, then "In 9:12 AM · Out 11:40 AM", and on the right
// how long they stayed — or "Inside now" / "Auto logout" (exit time not real).
export default function VisitRow({ visit, divider }) {
  const inside = visit.status === 'inside';
  const forced = !inside && !!visit.forced_exit;

  let badge;
  if (inside) {
    badge = (
      <View style={[styles.badge, { backgroundColor: BRAND.mint }]}>
        <View style={styles.liveDot} />
        <Text style={[styles.badgeText, { color: BRAND.green }]}>Inside now</Text>
      </View>
    );
  } else if (forced) {
    badge = (
      <View style={[styles.badge, { backgroundColor: '#F1F3F1' }]}>
        <Text style={[styles.badgeText, { color: colors.textSecondary }]}>Auto logout</Text>
      </View>
    );
  } else {
    badge = <Text style={styles.duration}>{formatDuration(visit.time_in, visit.time_out)}</Text>;
  }

  return (
    <View style={[styles.row, divider && styles.divider]}>
      <View style={styles.iconWrap}>
        <Ionicons name={inside ? 'enter-outline' : 'exit-outline'} size={16} color={BRAND.green} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.date}>{formatVisitDate(visit.time_in || visit.visit_date)}</Text>
        <Text style={styles.times}>
          In {formatVisitTime(visit.time_in)}
          {'  ·  '}
          {inside ? 'Not yet out' : `Out ${formatVisitTime(visit.time_out)}`}
        </Text>
      </View>
      {badge}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#F1F3F1' },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: BRAND.mint, alignItems: 'center', justifyContent: 'center',
  },
  date: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
  times: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  duration: { fontSize: 12.5, fontWeight: '700', color: colors.textPrimary },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND.green },
});
