// src/populateDatabase.js

import { db } from './firebase/firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

// Funzione per generare dati casuali per un giocatore
function generatePlayerData(index) {
  const ruoli = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'];
  return {
    nome: `Giocatore ${index}`,
    ruolo: ruoli[Math.floor(Math.random() * ruoli.length)],
    presenze: Math.floor(Math.random() * 38),
    gol: Math.floor(Math.random() * 20),
    assist: Math.floor(Math.random() * 15),
    ammonizioni: Math.floor(Math.random() * 10),
    espulsioni: Math.floor(Math.random() * 3),
    valoreIniziale: Math.floor(Math.random() * 100) + 1,
    valoreAttuale: Math.floor(Math.random() * 100) + 1,
    mediaVoto: (Math.random() * 3 + 5).toFixed(2)
  };
}

// Funzione per generare dati casuali per una squadra
function generateTeamData(index) {
  return {
    nome: `Squadra ${index}`,
    presidente: `Presidente ${index}`,
    valoreRosa: Math.floor(Math.random() * 1000) + 500,
    creditiRimanenti: Math.floor(Math.random() * 100)
  };
}

// Funzione per popolare il database
async function populateDatabase() {
  try {
    const squadreRef = collection(db, "Squadre");

    for (let i = 1; i <= 10; i++) {
      const squadraDoc = doc(squadreRef);
      const squadraData = generateTeamData(i);
      await setDoc(squadraDoc, squadraData);

      const giocatoriRef = collection(squadraDoc, "Giocatori");
      for (let j = 1; j <= 30; j++) {
        const giocatoreDoc = doc(giocatoriRef);
        const giocatoreData = generatePlayerData(j);
        await setDoc(giocatoreDoc, giocatoreData);
      }

      console.log(`Squadra ${i} e i suoi giocatori aggiunti con successo.`);
    }

    console.log("Database popolato con successo!");
  } catch (error) {
    console.error("Errore durante la popolazione del database:", error);
  }
}

// Esegui la funzione per popolare il database
populateDatabase();