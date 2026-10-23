import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system'; // already part of Expo (no extra install)
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';

// Photo size sent to the server: about 1400 px wide, JPEG quality 0.6
// (usually 150–300 KB) — still clear enough for staff to read the COR.
const MAX_WIDTH = 1400;
const QUALITY = 0.6;
// A PDF can't be made smaller on the phone, so big ones are refused (the server allows about 2 MB).
const MAX_PDF_BYTES = 2 * 1024 * 1024;

// "1.2 MB" / "340 KB"
const formatSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// Makes a smaller copy of the photo and returns { uri, base64 }.
async function shrinkPhoto(uri) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_WIDTH, height: null }); // height follows the photo's shape
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY, base64: true });
  return { uri: saved.uri, base64: saved.base64 };
}

// "Registration Form" field: take a photo, pick one from the gallery, or
// upload a PDF (for students who already have the file). Then shows a preview
// with "Change" and "Remove".
// value = { uri, base64 } for a photo, { uri, base64, kind: 'pdf', name, size } for a PDF, or null. onError(message) shows a pop-up on the screen.
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

  // Picks a PDF from the phone's files and reads it (no shrinking possible).
  const pickPdf = async () => {
    try {
      // Opens the phone's file picker, showing PDFs only
      const picked = await File.pickFileAsync({ mimeTypes: 'application/pdf' });
      if (picked.canceled || !picked.result) return;
      const file = picked.result;
      if (file.size && file.size > MAX_PDF_BYTES) {
        onError?.(`This PDF is ${formatSize(file.size)}. The limit is 2 MB. Please take a photo of your registration form instead.`);
        return;
      }
      setBusy(true);
      const base64 = await file.base64();
      onChange({ uri: file.uri, base64, kind: 'pdf', name: file.name || 'Registration Form.pdf', size: file.size || 0 });
    } catch (err) {
      console.error('COR PDF error:', err);
      onError?.('Could not use that PDF. Please try again, or take a photo instead.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>Registration Form<Text style={{ color: '#DC2626' }}> *</Text></Text>
      <Text style={styles.hint}>
        A clear photo or PDF (2 MB max) of this semester's registration form, showing your name and student number.
        Library staff use it to verify your enrollment, and it is deleted after review.
      </Text>

      {busy ? (
        <View style={[styles.box, styles.center]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.busyText}>Preparing file...</Text>
        </View>
      ) : value?.kind === 'pdf' ? (
        // Chosen PDF: file name and size (no picture preview for PDFs)
        <View style={styles.previewWrap}>
          <View style={styles.pdfInfo}>
            <Text style={styles.pdfTag}>PDF</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.pdfName} numberOfLines={1}>{value.name}</Text>
              {!!value.size && <Text style={styles.pdfSize}>{formatSize(value.size)}</Text>}
            </View>
          </View>
          <View style={styles.previewActions}>
            <TouchableOpacity onPress={pickPdf} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => pick(true)} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onChange(null)} style={styles.smallBtn}>
              <Text style={[styles.smallBtnText, { color: '#B3261E' }]}>Remove</Text>
            </TouchableOpacity>
          </View>
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
      {/* For students who already have their registration form as a PDF */}
      {!busy && !value && (
        <TouchableOpacity onPress={pickPdf} style={styles.pdfLink} hitSlop={8}>
          <Text style={styles.pdfLinkText}>Have it as a PDF? Upload PDF</Text>
        </TouchableOpacity>
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
  pdfInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  pdfTag: {
    fontSize: 11, fontWeight: '800', color: '#B3261E', backgroundColor: '#FDF3F2',
    borderWidth: 1, borderColor: '#F5CFC9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden',
  },
  pdfName: { fontSize: 13.5, fontWeight: '600', color: colors.textPrimary },
  pdfSize: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  pdfLink: { alignSelf: 'flex-start', marginTop: 10 },
  pdfLinkText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  smallBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
});
