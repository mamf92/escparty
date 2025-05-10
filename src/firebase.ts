import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { isDevelopmentEnvironment, isProductionPreview } from "./utils/pathUtils";

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

// Log environment information and Firebase config for debugging
console.log(`App environment: ${import.meta.env.MODE} (${window.location.hostname})`);
console.log("Firebase initialization with config:", {
    ...firebaseConfig,
    apiKey: firebaseConfig.apiKey ? "[REDACTED]" : "MISSING",
    appId: firebaseConfig.appId ? "[REDACTED]" : "MISSING",
    projectId: firebaseConfig.projectId || "MISSING"
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

// Only connect to emulator in development mode (not in production preview)
// For local testing only - disable in production and production preview
if (isDevelopmentEnvironment() && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
    try {
        connectFirestoreEmulator(db, "localhost", 8080);
        console.log("Connected to Firestore emulator on localhost:8080");
    } catch (error) {
        console.error("Failed to connect to Firestore emulator:", error);
    }
}

// For production preview, ensure we're using the production Firebase instance
if (isProductionPreview()) {
    console.log("Running in production preview mode - using production Firebase configuration");
    // No special action needed, just log for debugging
}

export { db };