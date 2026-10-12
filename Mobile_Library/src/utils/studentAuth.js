import AsyncStorage from '@react-native-async-storage/async-storage';

// Headers that carry the student's login pass (saved on this phone at login).
export async function authHeaders() {
  const token = await AsyncStorage.getItem('student_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The server said the login pass is missing or no longer valid:
// forget the saved login (including the cached profile/QR) so the student logs in again.
export async function clearSavedLogin() {
  await AsyncStorage.multiRemove(['student', 'student_token', 'cached_profile']);
}
