#!/usr/bin/env node
/**
 * System Initialization Script
 * 
 * This script initializes the system by:
 * 1. Checking if a super admin already exists
 * 2. Creating a super admin if none exists
 * 3. Setting up necessary permissions
 * 
 * Run with: npm run initialize-system
 * 
 * Note: This script should be run only once during initial setup.
 */

// Using CommonJS syntax
const { initializeApp } = require('firebase/app');
const { getAuth } = require('firebase/auth');
const { getFirestore, collection, doc, getDoc, getDocs, setDoc, query, where, serverTimestamp } = require('firebase/firestore');
const { createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
const readline = require('readline');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Check if required environment variables are set
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('Please ensure all required Firebase config variables are set in your .env file');
  process.exit(1);
}

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to validate password
function isValidPassword(password) {
  return password.length >= 8;
}

// Promisify readline question
function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

// Simple implementation of system setup service
const systemSetupService = {
  async isSystemInitialized() {
    try {
      const docRef = doc(db, 'system_config', 'system_status');
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().initialized) {
        return true;
      }

      // Also check if any super admin exists
      return await this.checkSuperAdminExists();
    } catch (error) {
      console.error('Error checking system initialization:', error);
      return false;
    }
  },

  async checkSuperAdminExists() {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'system-owner'));
      const querySnapshot = await getDocs(q);

      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking super admin existence:', error);
      return false;
    }
  },

  async resetSystemInitialization() {
    try {
      await setDoc(doc(db, 'system_config', 'system_status'), {
        initialized: false,
        updatedAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      console.error('Error resetting system initialization:', error);
      throw error;
    }
  },

  async createSuperAdmin(email, password, displayName) {
    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Update user profile
      await updateProfile(userCredential.user, {
        displayName: displayName
      });

      // Create user in Firestore
      await setDoc(doc(db, 'users', uid), {
        email,
        displayName,
        role: 'system-owner',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Set system as initialized
      await setDoc(doc(db, 'system_config', 'system_status'), {
        initialized: true,
        initializedBy: uid,
        initializedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return uid;
    } catch (error) {
      console.error('Error creating super admin:', error);
      throw error;
    }
  }
};

// Simple implementation of RBAC service
const rbacService = {
  async initializeSystemPermissions() {
    try {
      // Create default roles and permissions
      const roles = [
        {
          name: 'System Owner',
          description: 'Full access to all system features',
          systemRole: 'system-owner',
          permissions: ['*'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          name: 'Clinic Admin',
          description: 'Full access to clinic features',
          systemRole: 'clinic-admin',
          permissions: ['clinic:*', 'users:*', 'patients:*', 'appointments:*'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          name: 'Doctor',
          description: 'Access to patient and appointment features',
          systemRole: 'doctor',
          permissions: ['patients:read', 'patients:write', 'appointments:*'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          name: 'Nurse',
          description: 'Limited access to patient and appointment features',
          systemRole: 'nurse',
          permissions: ['patients:read', 'patients:write', 'appointments:read', 'appointments:write'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          name: 'Receptionist',
          description: 'Access to appointment scheduling',
          systemRole: 'receptionist',
          permissions: ['patients:read', 'appointments:read', 'appointments:write'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        {
          name: 'Staff',
          description: 'Basic access to system',
          systemRole: 'staff',
          permissions: ['patients:read', 'appointments:read'],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      ];

      // Save roles to Firestore
      for (const role of roles) {
        const { systemRole } = role;
        await setDoc(doc(db, 'roles', systemRole), role);
      }

      return true;
    } catch (error) {
      console.error('Error initializing system permissions:', error);
      throw error;
    }
  }
};

// Main initialization function
async function initializeSystem() {
  console.log('\n=== Procare Software System Initialization ===\n');

  try {
    // Check if system is already initialized
    const isInitialized = await systemSetupService.isSystemInitialized();

    if (isInitialized) {
      console.log('\n⚠️  System is already initialized and a super admin already exists.');

      const resetConfirmation = await question('Do you want to reset the initialization status? (This will NOT delete existing data) (y/N): ');

      if (resetConfirmation.toLowerCase() === 'y') {
        await systemSetupService.resetSystemInitialization();
        console.log('System initialization status has been reset.');
      } else {
        console.log('Operation cancelled. System initialization status remains unchanged.');
        rl.close();
        return;
      }
    }

    console.log('\n📋 Creating Super Admin Account');
    console.log('This account will have full access to manage the entire platform.\n');

    // Get super admin email
    let email = '';
    while (!isValidEmail(email)) {
      email = (await question('Enter Super Admin Email: ')).trim();

      if (!isValidEmail(email)) {
        console.log('❌ Invalid email format. Please enter a valid email.');
      }
    }

    // Get super admin password
    let password = '';
    while (!isValidPassword(password)) {
      password = (await question('Enter Super Admin Password (min 8 characters): ')).trim();

      if (!isValidPassword(password)) {
        console.log('❌ Password must be at least 8 characters long.');
      }
    }

    // Get display name
    let displayName = '';
    while (!displayName) {
      displayName = (await question('Enter Super Admin Name: ')).trim();

      if (!displayName) {
        console.log('❌ Name cannot be empty.');
      }
    }

    // Confirm details
    console.log('\n--- Please confirm the details ---');
    console.log(`Email: ${email}`);
    console.log(`Name: ${displayName}`);

    const confirmDetails = await question('\nIs this information correct? (Y/n): ');

    if (confirmDetails.toLowerCase() === 'n') {
      console.log('Operation cancelled by user.');
      rl.close();
      return;
    }

    console.log('\n🔄 Creating super admin account...');

    // Initialize system permissions
    console.log('🔄 Initializing system permissions...');
    await rbacService.initializeSystemPermissions();

    // Create super admin
    const superAdminId = await systemSetupService.createSuperAdmin(email, password, displayName);

    console.log(`\n✅ Super Admin created successfully with ID: ${superAdminId}`);
    console.log(`✅ System has been initialized successfully.`);
    console.log('\n🔐 You can now log in with the super admin credentials at the login page.');

  } catch (error) {
    console.error('\n❌ Error during system initialization:');
    console.error(error);
  } finally {
    rl.close();
    // Need to explicitly exit since Firebase keeps connections open
    setTimeout(() => process.exit(0), 1000);
  }
}

// Run the initialization
initializeSystem();
