import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const ACCENT = '#D4A017';

export default function StepIndicator({ number, active, isLast }) {
  return (
    <View style={styles.col}>
      <View style={[styles.circle, { backgroundColor: active ? ACCENT : colors.grayLight }]}>
        <Text style={[styles.circleText, { color: active ? '#fff' : colors.textSecondary }]}>
          {number}
        </Text>
      </View>
      {!isLast && <View style={styles.line} />}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'center', width: 40 },
  circle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  circleText: { fontWeight: '700', fontSize: 14 },
  line: { width: 2, flex: 1, minHeight: 60, backgroundColor: colors.grayLight, marginVertical: 6 },
});