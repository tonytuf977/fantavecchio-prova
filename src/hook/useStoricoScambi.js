// useStoricoScambi.js
import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const useStoricoScambi = () => {
  const [storicoScambi, setStoricoScambi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStoricoScambi = async () => {
    setLoading(true);
    try {
      const scambiRef = collection(db, 'RichiesteScambio');
      const scambiSnap = await getDocs(scambiRef);
      const scambiList = scambiSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dataScambio: data.dataScambio || 'Data non disponibile'
        };
      });

      scambiList.sort((a, b) => new Date(b.dataScambio) - new Date(a.dataScambio));

      setStoricoScambi(scambiList);
      setError(null);
    } catch (err) {
      console.error("Errore nel caricamento dello storico scambi:", err);
      setError("Errore nel caricamento dello storico scambi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoricoScambi();
  }, []);

  return {
    storicoScambi,
    loading,
    error,
    fetchStoricoScambi
  };
};