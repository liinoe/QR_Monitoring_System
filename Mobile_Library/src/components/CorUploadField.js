import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';

// Photo size sent to the server: about 1400 px wide, JPEG quality 0.6
// (usually 150–300 KB) — still clear enough for staff to read the COR.
const MAX_WIDTH = 1400;
const QUALITY = 0.6;

// Makes a smaller copy of the photo and returns { uri, base64 }.
async function shrinkPhoto(uri) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_WIDTH, height: null }); // height follows the photo's shape
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  return { uri: saved.uri, base64: saved.base64 };
}

// "Registration Form" field: take a photo or pick one from the
// gallery, then shows a preview with "Change" and "Remove".
// value = { uri, base64 } or null. onError(message) shows a pop-up on the screen.
export default function CorUploadField({ value, onChange, onError, invalid }) {
  const [busy, setBusy] = useState(false);

  // Opens the camera or the gallery, then shrinks the chosen photo.
  const pick = async (fromCamera) => {
    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onError?.(fromCamera
          ? 'Please allow camera access in your phone settings to take a photo of your registration form.'
          : 'Please allow photo access in your phone settings to choose your registration form.');
        return;
      }
      const options = { mediaTypes: ['images'], quality: 1 };
      const result = fromCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.length) return;

      setBusy(true);
      onChange(await shrinkPhoto(result.assets[0].uri));
    } catch (err) {
      console.error('COR photo error:', err);
      onError?.('Could not use that photo. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>Registration Form<Text style={{ color: '#DC2626' }}> *</Text></Text>
      <Text style={styles.hint}>
        A clear photo of this semester's registration form, showing your name and student number. Library staff use it to
        verify your enrollment, and it is deleted after review.
      </Text>

      {busy ? (
        <View style={[styles.box, styles.center]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.busyText}>Preparing photo...</Text>
        </View>
      ) : value ? (
        // Preview of the chosen photo
        <View style={styles.previewWrap}>
          <Image source={{ uri: value.uri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewActions}>
            <TouchableOpacity onPress={() => pick(true)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => pick(false)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(null)} style={styles.smallBtn}>
              <Text style={[styles.smallBtnText, { color: '#B3261E' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // No photo yet: two buttons
        <View style={[styles.box, invalid && styles.boxInvalid]}>
          <TouchableOpacity onPress={() => pick(true)} style={styles.bigBtn} activeOpacity={0.8}>
            <Text style={styles.bigBtnText}>Take Photo</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity onPress={() => pick(false)} style={styles.bigBtn} activeOpacity={0.8}>
            <Text style={styles.bigBtnText}>Choose from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  hint: { fontSize: 11.5, lineHeight: 16, color: colors.textSecondary, marginBottom: 10 },
  box: {
    flexDirection: 'row', borderWidth: 1, borderStyle: 'dashed', borderColor: '#B9C9BC',
    borderRadius: 8, backgroundColor: '#FAFAFA', minHeight: 64,
  },
  boxInvalid: { borderColor: '#DC2626' },
  center: { alignItems: 'center', justifyContent: 'center', gap: 6, flexDirection: 'column' },
  busyText: { fontSize: 12, color: colors.textSecondary },
  bigBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 4 },
  bigBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  divider: { width: 1, backgroundColor: '#DDE5DE', marginVertical: 12 },
  previewWrap: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff' },
  preview: { width: '100%', height: 180, backgroundColor: BRAND.mint },
  // Three plain text buttons under the photo
  previewActions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E4E4E7' },
  smallBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  smallBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
});
