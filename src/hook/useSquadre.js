import { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';

export function useSquadre() {
  const [squadre, setSquadre] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSquadre = async () => {
    setIsLoading(true);
    try {
      const squadreRef = collection(db, 'Squadre');
      const squadreSnap = await getDocs(squadreRef);
      const squadreList = squadreSnap.docs.map((doc) => {
        const squadraData = doc.data();
        return {
          id: doc.id,
          nome: squadraData.nome,
          valoreRosa: squadraData.valoreRosa || 0,
          crediti: squadraData.crediti || 0,
          giocatori: squadraData.numeroGiocatori || 0,
          utenti: squadraData.utenti || []
        };
      });
      setSquadre(squadreList);
      setError(null);
    } catch (err) {
      console.error("Errore nel recupero delle squadre:", err);
      setError("Errore nel caricamento delle squadre");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSquadre();
  }, []);

  return { squadre, isLoading, error, fetchSquadre };
}