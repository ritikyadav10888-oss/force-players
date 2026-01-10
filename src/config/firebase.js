import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { Platform } from 'react-native';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// TODO: User must replace these with real keys
const firebaseConfig = {
    apiKey: "AIzaSyBkvinaYO0DqQPcTm3FGDPE_O7KADBreVQ",
    authDomain: "force-player-register-ap-ade3a.firebaseapp.com",
    projectId: "force-player-register-ap-ade3a",
    storageBucket: "force-player-register-ap-ade3a.firebasestorage.app",
    messagingSenderId: "1099168561002",
    appId: "1:1099168561002:web:328ea1db5b2fb41f465713",
    measurementId: "G-83LGLFN70E"
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
let auth;
if (Platform.OS === 'web') {
    auth = getAuth(app);
} else {
    try {
        auth = initializeAuth(app, {
            persistence: getReactNativePersistence(ReactNativeAsyncStorage)
        });
    } catch (e) {
        // Fallback to getAuth if already initialized
        auth = getAuth(app);
    }
}

// Initialize Firestore
let db;
try {
    const cacheConfig = Platform.OS === 'web'
        ? { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }
        : {}; // Standard mobile config

    db = initializeFirestore(app, cacheConfig);
} catch (error) {
    // Fallback to getFirestore if already initialized
    db = getFirestore(app);
}

const storage = getStorage(app);
const functions = getFunctions(app);

export { auth, db, storage, functions, firebaseConfig };
