import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { isDevelopmentEnvironment } from "./utils/pathUtils";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Log Firebase config (with sensitive parts redacted) for debugging
console.log("Firebase initialization with config:", {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? "[REDACTED]" : "MISSING",
    appId: firebaseConfig.appId ? "[REDACTED]" : "MISSING"
});

// Check if config seems valid
const isMissingCriticalConfig = !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.appId;

if (isMissingCriticalConfig) {
    console.error("⚠️ Firebase config appears to be missing critical values. Check .env file.");
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// In development, connect to emulator if environment variable is set
// For local testing only - disable in production
if (isDevelopmentEnvironment() && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
    try {
        connectFirestoreEmulator(db, "localhost", 8080);
        console.log("Connected to Firestore emulator on localhost:8080");
    } catch (error) {
        console.error("Failed to connect to Firestore emulator:", error);
    }
}

export { db };