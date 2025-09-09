// src/firebase/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";



// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB90jNBwzJTVF4zPEeO4NGaAe9XAlo11fg",
  authDomain: "fanta-cf97c.firebaseapp.com",
  projectId: "fanta-cf97c",
  storageBucket: "fanta-cf97c.firebasestorage.app",
  messagingSenderId: "946214530481",
  appId: "1:946214530481:web:5823c60dc6c7616ce3e190"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
console.log("Firebase App inizializzato:", app.name);

// Initialize Firestore
const db = getFirestore(app);
console.log("Firestore inizializzato:", db);

// Initialize Authentication
const auth = getAuth(app);
console.log("Firebase Auth inizializzato:", auth);

async function testFirestoreConnection() {
  try {
    console.log("Tentativo di recupero del documento 'Giocatori'...");
    const docRef = doc(db, "FantavecchioDB", "Giocatori");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      console.log("Documento 'Giocatori' trovato. Contenuto:", docSnap.data());
    } else {
      console.log("Nessun documento 'Giocatori' trovato nella collezione 'FantavecchioDB'");
    }
  } catch (error) {
    console.error("Errore nel recupero del documento 'Giocatori':", error);
  }
}

// Esegui il test di connessione
testFirestoreConnection();

export { db, auth };
export default app;