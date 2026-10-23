import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { getResponsive } from '../theme/responsive';

export default function QRModal({ visible, onClose, value }) {
  const { width, height } = useWindowDimensions();
  const layout = getResponsive(width, height);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { maxWidth: layout.contentWidth, padding: layout.cardPadding, paddingTop: 48 }]} onPress={() => {}}>
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Your Library QR Code</Text>
          <Text style={styles.subtitle}>
            Present this code at the entrance scanner to log your visit
          </Text>
          <View style={styles.qrWrap}>
            <QRCode value={value || 'CVSU-LIB-USER'} size={layout.qrSize} color={colors.primary} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  qrWrap: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.grayLight,
  },
});