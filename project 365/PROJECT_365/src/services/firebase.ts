// ============================================================
// PROJECT_365 — Firebase configuration
// ============================================================

import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, type Persistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBgvfW6h_MDNVwORzY_e-qYbnQxzE0jndY',
  authDomain: 'project-365-2a4ba.firebaseapp.com',
  projectId: 'project-365-2a4ba',
  storageBucket: 'project-365-2a4ba.firebasestorage.app',
  messagingSenderId: '204463940770',
  appId: '1:204463940770:web:ddb9fc75858e7fd0c4e3fb',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// getReactNativePersistence is in the React Native bundle at runtime but not in browser typings.
// Metro resolves the react-native conditional export; we access it via require to avoid the TS error.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence;
};

// initializeAuth throws if called twice (hot reload), so fall back to getAuth
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  auth = getAuth(app);
}

const db = getFirestore(app);

export { auth, db };
export default app;
