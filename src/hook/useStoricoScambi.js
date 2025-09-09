// useStoricoScambi.js
import { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export const useStoricoScambi = () => {
  const [storicoScambi, setStoricoScambi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStoricoScambi = async () => {
    try {
      setLoading(true);
      const richiesteRef = collection(db, 'RichiesteScambio');
      const q = query(
        richiesteRef,
        where('stato', 'in', ['Completato', 'Rifiutata'])
      );
      const querySnapshot = await getDocs(q);
      
      const scambi = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dataScambio: doc.data().dataScambio || 'Data non disponibile'
      }));
      
      scambi.sort((a, b) => new Date(b.dataScambio) - new Date(a.dataScambio));

      setStoricoScambi(scambi);
      setError(null);
    } catch (err) {
      console.error("Errore nel caricamento dello storico scambi:", err);
      setError("Errore nel caricamento dello storico scambi");
    } finally {
      setLoading(false);
    }
  };

  // Funzione refresh per ricaricare i dati dopo eliminazione
  const refreshStoricoScambi = () => {
    return fetchStoricoScambi();
  };

  useEffect(() => {
    fetchStoricoScambi();
  }, []);

  return { 
    storicoScambi, 
    loading, 
    error, 
    refreshStoricoScambi 
  };
};