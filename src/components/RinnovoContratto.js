import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';

function RinnovoContratto({ squadraId, onRinnovoCompletato }) {
  const [giocatoriDaRinnovare, setGiocatoriDaRinnovare] = useState([]);

  useEffect(() => {
    const fetchGiocatoriDaRinnovare = async () => {
      const rinnoviRef = collection(db, 'RinnoviContratti');
      const q = query(rinnoviRef, 
        where('squadraId', '==', squadraId),
        where('stato', '==', 'In attesa')
      );
      const querySnapshot = await getDocs(q);
      const giocatoriIds = querySnapshot.docs.flatMap(doc => doc.data().giocatori);
      
      const giocatoriPromises = giocatoriIds.map(id => getDoc(doc(db, 'Giocatori', id)));
      const giocatoriDocs = await Promise.all(giocatoriPromises);
      const giocatoriData = giocatoriDocs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGiocatoriDaRinnovare(giocatoriData);
    };

    fetchGiocatoriDaRinnovare();
  }, [squadraId]);

  const handleRinnovoContratto = async (giocatoreId, durata) => {
    try {
      const giocatoreRef = doc(db, 'Giocatori', giocatoreId);
      const giocatoreDoc = await getDoc(giocatoreRef);

      if (!giocatoreDoc.exists()) throw new Error("Giocatore non trovato");

      const giocatore = giocatoreDoc.data();
      const oggi = new Date();
      const nuovaScadenza = new Date(oggi);
      nuovaScadenza.setMonth(oggi.getMonth() + durata);
      const scadenzaFormattata = nuovaScadenza.toISOString().split('T')[0];

      let nuovoValore;
      if (durata === 12) {
        nuovoValore = Math.ceil(giocatore.valoreAttuale / 2);
      } else if (durata === 18) {
        nuovoValore = Math.ceil(giocatore.valoreAttuale * 0.75);
      } else {
        throw new Error("Durata non valida");
      }

      if (giocatore.valoreAttuale > 200 && nuovoValore < 200) {
        nuovoValore = 200;
      } else if (giocatore.valoreAttuale > 100 && nuovoValore < 100) {
        nuovoValore = 100;
      }

      const datiAggiornati = {
        scadenza: scadenzaFormattata,
        valoreAttuale: nuovoValore,
        valoreIniziale: nuovoValore
      };

      // Aggiorna il documento del giocatore nella raccolta Giocatori
      await updateDoc(giocatoreRef, datiAggiornati);

      // Aggiorna il documento del giocatore nella sottoraccolta giocatori della squadra
      const giocatoreSquadraRef = doc(db, `Squadre/${squadraId}/giocatori`, giocatoreId);
      await setDoc(giocatoreSquadraRef, datiAggiornati, { merge: true });

      // Aggiorna lo stato del rinnovo
      const rinnoviRef = collection(db, 'RinnoviContratti');
      const q = query(rinnoviRef, 
        where('squadraId', '==', squadraId),
        where('giocatori', 'array-contains', giocatoreId)
      );
      const rinnoviSnapshot = await getDocs(q);
      if (!rinnoviSnapshot.empty) {
        const rinnovoDoc = rinnoviSnapshot.docs[0];
        await updateDoc(doc(db, 'RinnoviContratti', rinnovoDoc.id), { stato: 'Completato' });
      }

      alert(`Contratto rinnovato per ${giocatore.nome} fino al ${scadenzaFormattata}. Nuovo valore: ${nuovoValore}€`);
      onRinnovoCompletato();
      
      // Rimuovi il giocatore rinnovato dalla lista locale
      setGiocatoriDaRinnovare(prev => prev.filter(g => g.id !== giocatoreId));
    } catch (error) {
      console.error('Errore nel rinnovo del contratto:', error);
      alert('Si è verificato un errore nel rinnovo del contratto: ' + error.message);
    }
  };

  return (
    <div>
      {giocatoriDaRinnovare.length > 0 ? (
        giocatoriDaRinnovare.map(giocatore => (
          <div key={giocatore.id} className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">{giocatore.nome}</h5>
              <p>Valore attuale: {giocatore.valoreAttuale}€</p>
              <p>Scadenza attuale: {giocatore.scadenza}</p>
              <button className="btn btn-primary me-2" onClick={() => handleRinnovoContratto(giocatore.id, 12)}>Rinnova +12 mesi</button>
              <button className="btn btn-secondary" onClick={() => handleRinnovoContratto(giocatore.id, 18)}>Rinnova +18 mesi</button>
            </div>
          </div>
        ))
      ) : (
        <p>Nessun giocatore da rinnovare.</p>
      )}
    </div>
  );
}

export default RinnovoContratto;