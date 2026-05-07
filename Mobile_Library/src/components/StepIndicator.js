import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

export default function StepIndicator({ steps, currentStep }) {
  return (
    <View style={styles.wrap}>
      {steps.map((label, idx) => {
        const isDone = idx < currentStep;
        const isActive = idx === currentStep;
        const circleStyle = [
          styles.circle,
          isDone && styles.done,
          isActive && styles.active,
        ];
        return (
          <View key={label} style={styles.row}>
            <View style={styles.left}>
              <View style={circleStyle}>
                {isDone ? (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                ) : (
                  <Text style={[styles.num, isActive && { color: '#fff' }]}>{idx + 1}</Text>
                )}
              </View>
              {idx < steps.length - 1 && (
                <View style={[styles.line, (isDone || isActive) && styles.lineActive]} />
              )}
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.label, (isActive || isDone) && styles.labelActive]}>
                Step {idx + 1}
              </Text>
              <Text style={[styles.title, (isActive || isDone) && styles.titleActive]}>
                {label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  left: { alignItems: 'center', width: 40 },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.grayLight,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: colors.primary, borderColor: colors.primary },
  done: { backgroundColor: colors.primary, borderColor: colors.primary },
  num: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  line: { width: 2, flex: 1, minHeight: 32, backgroundColor: colors.grayLight, marginVertical: 4 },
  lineActive: { backgroundColor: colors.primary },
  textWrap: { flex: 1, paddingLeft: 12, paddingBottom: 24 },
  label: { fontSize: 11, color: colors.gray, fontWeight: '600' },
  labelActive: { color: colors.primary },
  title: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
  titleActive: { color: colors.textPrimary },
});
