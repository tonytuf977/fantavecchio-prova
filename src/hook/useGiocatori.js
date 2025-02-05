import { useState, useEffect } from 'react';
import { collection, getDocs, query, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const useGiocatori = () => {
  const [giocatori, setGiocatori] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGiocatori = async () => {
      setLoading(true);
      try {
        let giocatoriRef = collection(db, 'Giocatori');
        let giocatoriSnap = await getDocs(giocatoriRef);
        let giocatoriList = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (giocatoriList.length === 0) {
          giocatoriRef = collectionGroup(db, 'giocatori');
          giocatoriSnap = await getDocs(giocatoriRef);
          giocatoriList = giocatoriSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            squadra: doc.ref.parent.parent.id
          }));
        }

        setGiocatori(giocatoriList);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGiocatori();
  }, []);

  return { giocatori, loading, error };
};