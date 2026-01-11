// firebase/backupFirebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configurazione Firebase per il progetto di backup
const backupFirebaseConfig = {
  apiKey: "AIzaSyBu1t_A0tIOsTIsqyFOlHxVS_D0OPkAHUA",
  authDomain: "restore-tavecchio.firebaseapp.com",
  projectId: "restore-tavecchio",
  storageBucket: "restore-tavecchio.firebasestorage.app",
  messagingSenderId: "367804433274",
  appId: "1:367804433274:web:b60d359696854426050cc3",
  measurementId: "G-WCMJ9E0L0P"
};

// Inizializza l'app di backup con un nome diverso
const backupApp = initializeApp(backupFirebaseConfig, 'backupApp');

// Inizializza Firestore per il backup
const backupDb = getFirestore(backupApp);

// Inizializza Auth per il backup (opzionale, se serve)
const backupAuth = getAuth(backupApp);

console.log("Firebase Backup App inizializzato:", backupApp.name);

export { backupDb, backupAuth, backupApp };
