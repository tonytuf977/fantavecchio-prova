// src/hooks/useFirestore.js

import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

const useFirestore = (squadraNome = null) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (squadraNome) {
        // Recupera una squadra specifica
        const squadraRef = doc(db, 'Squadre', squadraNome);
        const squadraSnap = await getDoc(squadraRef);

        if (squadraSnap.exists()) {
          const squadraData = squadraSnap.data();
          
          // Recupera i giocatori della squadra
          const giocatoriRef = collection(squadraRef, 'Giocatori');
          const giocatoriSnap = await getDocs(giocatoriRef);
          const giocatori = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          setData({ ...squadraData, giocatori });
        } else {
          setError('Squadra non trovata');
        }
      } else {
        // Recupera tutte le squadre
        const squadreRef = collection(db, 'Squadre');
        const squadreSnap = await getDocs(squadreRef);
        const squadre = squadreSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setData(squadre);
      }
    } catch (err) {
      console.error("Errore nel recupero dei dati:", err);
      setError('Si è verificato un errore durante il recupero dei dati.');
    } finally {
      setIsLoading(false);
    }
  }, [squadraNome]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, fetchData };
};

export default useFirestore;