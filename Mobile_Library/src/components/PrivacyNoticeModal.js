import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { BRAND } from '../theme/brand';

// Library email students can write to about their personal data.
export const LIBRARY_EMAIL = 'cvsulibrary@cvsu.edu.ph';

// The notice text, as sections: a heading plus bullet points (or a paragraph).
// Edit the wording here — the Register screen and Settings both show this.
const PRIVACY_SECTIONS = [
  {
    text:
      'QLess is used by the Ladislao N. Diwa Memorial Library, Cavite State University, ' +
      'to manage library entry and exit. In line with the Data Privacy Act of 2012 (RA 10173), ' +
      'this notice explains how we handle your personal information.',
  },
  {
    heading: 'What we collect',
    bullets: [
      'Your name, student number, CvSU email, phone number, sex and address.',
      'Your college, program and year level.',
      'A photo of your Registration Form, to verify your enrollment.',
      'The date and time of each library entry and exit.',
    ],
  },
  {
    heading: 'Why we collect it',
    bullets: [
      'To verify that you are an enrolled CvSU student (using your registration form) and create your QR pass.',
      'To record your library visits.',
      'To produce library usage statistics, such as peak hours and visits per college.',
    ],
  },
  {
    heading: 'Who can see it',
    bullets: [
      'Only authorized library staff, through the admin website.',
      'The scanner screen shows only your student number and program.',
      'Your information is not sold or shared with outside parties.',
    ],
  },
  {
    heading: 'How it is protected',
    bullets: [
      'Data is sent over secure connections (HTTPS) and stored in a protected database.',
      'Passwords are encrypted and are never visible to library staff.',
      'Registration form photos are stored privately and can only be opened by signed-in library staff.',
    ],
  },
  {
    heading: 'How long it is kept',
    text:
      'Your information is kept while you are an active library user. Your registration form photo is deleted ' +
      'as soon as library staff approve or reject your registration.',
  },
  {
    heading: 'Your rights',
    text:
      'You may request access to or correction of your information, or ask for your account ' +
      `to be deactivated, by emailing the library at ${LIBRARY_EMAIL}.`,
  },
];

const TERMS_BULLETS = [
  'Your QR pass is personal. Do not share it or let others use it.',
  'Keep your password private.',
  'Misuse of the system may lead to deactivation of your account.',
];

// One section: optional heading, then a paragraph and/or bullet points.
function Section({ heading, text, bullets }) {
  return (
    <View style={styles.section}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      {text ? <Text style={styles.body}>{text}</Text> : null}
      {bullets?.map((b) => (
        <View key={b} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={[styles.body, { flex: 1 }]}>{b}</Text>
        </View>
      ))}
    </View>
  );
}

// Pop-up with the Privacy Notice and Terms of Use.
// The text scrolls inside the pop-up when it doesn't fit; Close is always visible.
export default function PrivacyNoticeModal({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { paddingTop: 20 + insets.top, paddingBottom: 20 + insets.bottom }]}>
        <View style={[styles.card, { maxHeight: height * 0.85 }]}>
          {/* Title */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>Privacy Notice and Terms of Use</Text>
          </View>

          {/* Scrolling text */}
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator>
            <Text style={styles.part}>Privacy Notice</Text>
            {PRIVACY_SECTIONS.map((s, i) => <Section key={i} {...s} />)}

            <Text style={[styles.part, { marginTop: 8 }]}>Terms of Use</Text>
            <Section bullets={TERMS_BULLETS} />
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E4E4E7', padding: 20, width: '100%', maxWidth: 480, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: BRAND.mint, alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  scroll: { flexGrow: 0 },
  part: { fontSize: 15, fontWeight: '700', color: BRAND.green, marginBottom: 8 },
  section: { marginBottom: 12 },
  heading: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  body: { fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  bulletRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  bulletDot: { fontSize: 13.5, lineHeight: 20, color: colors.textSecondary },
  closeBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
