import { useState, useCallback } from 'react';
import { db } from '../firebase/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export const useRinnovi = () => {
  const [loading, setLoading] = useState(false);

  const aggiornaStatoRinnovo = useCallback(async (giocatoreId, stato) => {
    setLoading(true);
    try {
      const rinnovoRef = doc(db, 'RinnoviContratti', giocatoreId);
      const rinnovoDoc = await getDoc(rinnovoRef);
      if (rinnovoDoc.exists()) {
        await updateDoc(rinnovoRef, { stato });
      } else {
        console.error('Il documento RinnoviContratti non esiste per questo giocatore.');
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato del rinnovo:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, aggiornaStatoRinnovo };
};