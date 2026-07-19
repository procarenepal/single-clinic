// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Function to validate environment variables
const validateEnvVars = () => {
  const requiredVars = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ];

  const missingVars = requiredVars.filter((varName) => {
    try {
      // Check import.meta.env (Vite) or process.env (Node)
      return !(
        (typeof import.meta !== "undefined" &&
          import.meta.env &&
          import.meta.env[varName]) ||
        process.env[varName]
      );
    } catch (e) {
      return !process.env[varName];
    }
  });

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}. ` +
      `Please add them to your .env file.`,
    );
  }
};

// Helper function to get environment variables
const getEnv = (name: string) => {
  try {
    return (
      (typeof import.meta !== "undefined" &&
        import.meta.env &&
        import.meta.env[name]) ||
      process.env[name]
    );
  } catch (e) {
    return process.env[name];
  }
};

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID"),
};

// Validate environment variables
validateEnvVars();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
// Initialize Firestore with persistent caching for multi-tab support
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
const storage = getStorage(app);
let analytics = null;

// Set default persistence to local storage for better UX across tabs
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Error setting Firebase persistence:", error);
});

// Configure custom action code settings for password reset
const getActionCodeSettings = () => {
  const customDomain = getEnv("VITE_PASSWORD_RESET_DOMAIN");
  let baseUrl = customDomain || "";

  if (!baseUrl && typeof window !== "undefined") {
    baseUrl = window.location.origin;
  }

  return {
    url: `${baseUrl}/reset-password`,
    handleCodeInApp: true,
  };
};

const actionCodeSettings = getActionCodeSettings();

// Export action code settings for use in password reset
export { actionCodeSettings };

// Initialize analytics safely
// isSupported() returns a promise that resolves to true if analytics is supported in the current environment
// and not blocked by browser settings or extensions.
isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  })
  .catch((err) => {
    // Gracefully handle blocking (e.g., ERR_BLOCKED_BY_CLIENT from ad-blockers)
    console.debug("Firebase Analytics could not be initialized:", err.message);
  });

export { app, auth, db, storage, analytics };
