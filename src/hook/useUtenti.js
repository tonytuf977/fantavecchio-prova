import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const useUtenti = () => {
  const [utenti, setUtenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUtenti = async () => {
    setLoading(true);
    try {
      const utentiRef = collection(db, 'Utenti');
      const utentiSnap = await getDocs(utentiRef);
      const utentiList = utentiSnap.docs.map(doc => {
        const userData = doc.data();
        return { 
          id: doc.id, 
          ...userData,
          idSquadra: userData.idSquadra || null
        };
      });
      setUtenti(utentiList);
      setError(null);
    } catch (err) {
      console.error("Errore nel recupero degli utenti:", err);
      setError("Errore nel caricamento degli utenti");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtenti();
  }, []);

  const addUtente = async (utenteData) => {
    try {
      const nuovoUtenteRef = doc(collection(db, 'Utenti'));
      await setDoc(nuovoUtenteRef, utenteData);
      await fetchUtenti();
    } catch (err) {
      console.error("Errore nell'aggiunta dell'utente:", err);
      throw err;
    }
  };

  const updateUtente = async (utenteId, utenteData) => {
    try {
      const utenteRef = doc(db, 'Utenti', utenteId);
      await updateDoc(utenteRef, utenteData);
      await fetchUtenti();
    } catch (err) {
      console.error("Errore nell'aggiornamento dell'utente:", err);
      throw err;
    }
  };

  const deleteUtente = async (utenteId) => {
    try {
      const utenteRef = doc(db, 'Utenti', utenteId);
      await deleteDoc(utenteRef);
      await fetchUtenti();
    } catch (err) {
      console.error("Errore nell'eliminazione dell'utente:", err);
      throw err;
    }
  };

  return {
    utenti,
    loading,
    error,
    fetchUtenti,
    addUtente,
    updateUtente,
    deleteUtente
  };
};