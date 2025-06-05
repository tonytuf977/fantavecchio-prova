// src/firebase/firebase.js

import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";



// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyARdAe3_15_Ny4tjbg9tdadCJo0BPImIM4",
  authDomain: "fantavecchio-manager.firebaseapp.com",
  projectId: "fantavecchio-manager",
  storageBucket: "fantavecchio-manager.firebasestorage.app",
  messagingSenderId: "1087765312837",
  appId: "1:1087765312837:web:06741c3f2b6f89efcaba2c"
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