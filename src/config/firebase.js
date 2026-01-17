import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// For more information on how to access Firebase in your project,
// see the Firebase documentation: https://firebase.google.com/docs/web/setup#access-firebase

const firebaseConfig = {
    apiKey: "AIzaSyBkvinaYO0DqQPcTm3FGDPE_O7KADBreVQ",
    authDomain: "force-player-register-ap-ade3a.firebaseapp.com",
    databaseURL: "https://force-player-register-ap-ade3a-default-rtdb.firebaseio.com",
    projectId: "force-player-register-ap-ade3a",
    storageBucket: "force-player-register-ap-ade3a.firebasestorage.app",
    messagingSenderId: "1099168561002",
    appId: "1:1099168561002:web:328ea1db5b2fb41f465713",
    measurementId: "G-83LGLFN70E"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence for Firestore
if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db, {
        synchronizeTabs: true // Enable multi-tab sync
    }).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Persistence failed: Multiple tabs open');
        } else if (err.code === 'unimplemented') {
            console.warn('Persistence not available in this browser');
        }
    });
}

const storage = getStorage(app);
const functions = getFunctions(app);

export { app, auth, db, storage, functions };
