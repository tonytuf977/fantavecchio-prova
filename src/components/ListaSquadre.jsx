import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useSquadre } from '../hook/useSquadre';
import './ListaSquadre.css';
import * as XLSX from 'xlsx';

function ListaSquadre() {
  const { squadre, setSquadre, isLoading: squadreLoading, error: squadreError } = useSquadre();
  const [selectedSquadra, setSelectedSquadra] = useState(null);
  const [giocatori, setGiocatori] = useState([]);
  const [listaGiovani, setListaGiovani] = useState([]);
  const [giocatoriSelezionatiGiovani, setGiocatoriSelezionatiGiovani] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({});
  const [crediti, setCrediti] = useState('');
  const [rinnoviPendenti, setRinnoviPendenti] = useState({});
  const [modifiedPlayers, setModifiedPlayers] = useState({});
  const [tempoCongelamento, setTempoCongelamento] = useState({});

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const fetchCurrentUser = async () => {
          try {
            const utentiRef = collection(db, 'Utenti');
            const utentiSnap = await getDocs(utentiRef);
            const utentiList = utentiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const currentUserData = utentiList.find(u => u.email === user.email);
            setCurrentUser(currentUserData);
          } catch (err) {
            console.error("Errore nel recupero dell'utente corrente:", err);
          }
        };
        fetchCurrentUser();
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchRinnoviPendenti = useCallback(async () => {
    if (!selectedSquadra) return;
    try {
      const rinnoviRef = collection(db, 'RinnoviContratti');
      const q = query(rinnoviRef, 
        where('squadraId', '==', selectedSquadra.id),
        where('stato', '==', 'In attesa')
      );
      const querySnapshot = await getDocs(q);
      const rinnoviMap = {};
      querySnapshot.forEach(doc => {
        const rinnovoData = doc.data();
        rinnovoData.giocatori.forEach(giocatoreId => {
          rinnoviMap[giocatoreId] = true;
        });
      });
      console.log("Rinnovi pendenti:", rinnoviMap);
      setRinnoviPendenti(rinnoviMap);
    } catch (error) {
      console.error("Errore nel recupero dei rinnovi pendenti:", error);
    }
  }, [selectedSquadra]);

  useEffect(() => {
    if (selectedSquadra) {
      const fetchGiocatori = async () => {
        setIsLoading(true);
        try {
          const giocatoriRef = collection(db, `Squadre/${selectedSquadra.id}/giocatori`);
          const giocatoriSnap = await getDocs(giocatoriRef);
          const giocatoriList = giocatoriSnap.docs.map(doc => {
            const data = { id: doc.id, ...doc.data() };
            // Imposta "campionato" come default se non c'è nessuna competizione
            if (!data.competizione || (Array.isArray(data.competizione) && data.competizione.length === 0)) {
              data.competizione = ['campionato'];
            }
            // Converte competizione singola in array per retrocompatibilità
            if (data.competizione && !Array.isArray(data.competizione)) {
              data.competizione = [data.competizione];
            }
            return data;
          });
          setGiocatori(giocatoriList);

          // Fetch lista giovani
          const listaGiovaniRef = collection(db, `Squadre/${selectedSquadra.id}/listaGiovani`);
          const listaGiovaniSnap = await getDocs(listaGiovaniRef);
          const listaGiovaniList = listaGiovaniSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setListaGiovani(listaGiovaniList);

          await updateValoreRosa(selectedSquadra.id);
          setFilters(giocatoriList.reduce((acc, giocatore) => {
            acc[giocatore.id] = giocatore.currentFilter || null;
            return acc;
          }, {}));
          setCrediti(selectedSquadra.crediti || '');
          await fetchRinnoviPendenti();
        } catch (err) {
          console.error("Errore nel recupero dei giocatori:", err);
          setError("Errore nel caricamento dei giocatori");
        } finally {
          setIsLoading(false);
        }
      };
      fetchGiocatori();
    }
  }, [selectedSquadra, fetchRinnoviPendenti]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (selectedSquadra) {
        fetchRinnoviPendenti();
      }
    }, 5000); // Aggiorna ogni 5 secondi
    return () => clearInterval(intervalId);
  }, [selectedSquadra, fetchRinnoviPendenti]);

  const updateValoreRosa = async (squadraId) => {
    try {
      const giocatoriRef = collection(db, `Squadre/${squadraId}/giocatori`);
      const giocatoriSnap = await getDocs(giocatoriRef);
      const giocatoriList = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const valoreTotaleRosa = giocatoriList.reduce((acc, giocatore) => acc + (parseFloat(giocatore.valoreAttuale) || 0), 0);
      const squadraRef = doc(db, 'Squadre', squadraId);
      await setDoc(squadraRef, { valoreRosa: valoreTotaleRosa, giocatori: giocatoriList.length }, { merge: true });
    } catch (err) {
      console.error("Errore nell'aggiornamento del valore della rosa:", err);
    }
  };

  const handleSquadraClick = (squadra) => {
    setSelectedSquadra(squadra);
  };

  const handleEdit = (giocatoreId, field, value) => {
    setGiocatori(prevGiocatori =>
      prevGiocatori.map(giocatore =>
        giocatore.id === giocatoreId ? { ...giocatore, [field]: value } : giocatore
      )
    );
    setModifiedPlayers(prev => ({
      ...prev,
      [giocatoreId]: { ...(prev[giocatoreId] || {}), [field]: value }
    }));
  };

  // Funzione per ottenere l'emoji della competizione
  const getCompetizioneEmoji = (competizioni) => {
    if (!competizioni || !Array.isArray(competizioni)) return '';
    
    const emojiMap = {
      'campionato': '🏆',
      'champions': '⭐',
      'coppecoppe': '🏅'
    };
    
    return competizioni.map(comp => emojiMap[comp] || '').join(' ');
  };

  // Funzione per gestire il cambio competizione
  const handleCompetizioneChange = (giocatoreId, selectedOptions) => {
    const competizioni = Array.from(selectedOptions, option => option.value);
    handleEdit(giocatoreId, 'competizione', competizioni);
  };

  const handleUpdateCrediti = async () => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }
    try {
      const squadraRef = doc(db, 'Squadre', selectedSquadra.id);
      const newCrediti = Number(crediti) || 0;
      await setDoc(squadraRef, { crediti: newCrediti }, { merge: true });
      setSelectedSquadra(prev => ({ ...prev, crediti: newCrediti }));
      setGiocatori(prevGiocatori => {
        const updatedSquadra = squadre.find(s => s.id === selectedSquadra.id);
        return prevGiocatori.map(giocatore => ({
          ...giocatore,
          squadraCrediti: updatedSquadra.crediti
        }));
      });
      alert("Crediti aggiornati con successo!");
    } catch (err) {
      console.error("Errore nell'aggiornamento dei crediti:", err);
      alert(`Errore nell'aggiornamento dei crediti: ${err.message}`);
    }
  };

const applyFilter = (giocatore, filter) => {
  const baseDate = new Date(giocatore.dataPartenza || giocatore.scadenza);
  const baseValueAttuale = parseFloat(giocatore.valoreAttuale);
  let newDate = new Date(baseDate);
  let newValueAttuale = baseValueAttuale;

  // Calcolo dell'aumento percentuale diretto sul valore attuale
  switch (filter) {
    case '+6':
      newDate.setMonth(newDate.getMonth() + 6);
      newValueAttuale = baseValueAttuale * 1.25; // +25%
      break;
    case '+12':
      newDate.setMonth(newDate.getMonth() + 12);
      newValueAttuale = baseValueAttuale * 1.50; // +50%
      break;
    case '+18':
      newDate.setMonth(newDate.getMonth() + 18);
      newValueAttuale = baseValueAttuale * 1.75; // +75%
      break;
    default:
      return giocatore; // Nessun cambiamento se il filtro non è valido
  }

  // Arrotondamento del valore attuale
  newValueAttuale = Math.ceil(newValueAttuale);

  // Il valore iniziale diventa uguale al nuovo valore attuale
  const newValueIniziale = newValueAttuale;

  // Restituire il giocatore aggiornato
  return {
    ...giocatore,
    valoreIniziale: newValueIniziale.toFixed(2),
    valoreAttuale: newValueAttuale.toFixed(2),
    scadenza: newDate.toISOString().split('T')[0],
    currentFilter: filter,
    valoreInizialeOriginale: parseFloat(giocatore.valoreInizialeOriginale || giocatore.valoreIniziale),
    valoreAttualeOriginale: parseFloat(giocatore.valoreAttualeOriginale || giocatore.valoreAttuale),
    dataPartenza: baseDate.toISOString().split('T')[0]
  };
};

const handleApplyFilter = (giocatoreId, filter) => {
  setGiocatori(prevGiocatori =>
    prevGiocatori.map(giocatore => {
      if (giocatore.id === giocatoreId) {
        if (giocatore.currentFilter === filter) {
          return giocatore; // Nessun cambiamento se il filtro è già applicato
        }
        const updatedGiocatore = applyFilter(giocatore, filter);
        setFilters(prevFilters => ({
          ...prevFilters,
          [giocatoreId]: filter
        }));
        setModifiedPlayers(prev => ({
          ...prev,
          [giocatoreId]: updatedGiocatore
        }));
        return updatedGiocatore;
      }
      return giocatore;
    })
  );
};

  const getMesiRimanenti = (scadenza) => {
    if (!scadenza) return null;
    const oggi = new Date();
    const fine = new Date(scadenza);
    const anni = fine.getFullYear() - oggi.getFullYear();
    const mesi = fine.getMonth() - oggi.getMonth();
    return anni * 12 + mesi;
  };

  const isSerieA = (giocatore) => {
    return giocatore.squadraSerieA && giocatore.squadraSerieA !== 'Svincolato *';
  };



  const handleSaveAll = async () => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }
    try {
      for (const [giocatoreId, modifications] of Object.entries(modifiedPlayers)) {
        const giocatore = giocatori.find(g => g.id === giocatoreId);
        if (!giocatore) continue;
        const updatedGiocatore = { ...giocatore, ...modifications };
        const giocatoreDati = {
          valoreAttuale: Number(updatedGiocatore.valoreAttuale) || 0,
          valoreIniziale: Number(updatedGiocatore.valoreIniziale) || 0,
          valoreInizialeOriginale: Number(updatedGiocatore.valoreInizialeOriginale) || Number(updatedGiocatore.valoreIniziale) || 0,
          valoreAttualeOriginale: Number(updatedGiocatore.valoreAttualeOriginale) || Number(updatedGiocatore.valoreAttuale) || 0,
          scadenza: updatedGiocatore.scadenza || null,
          dataPartenza: updatedGiocatore.dataPartenza || new Date().toISOString().split('T')[0],
          nome: updatedGiocatore.nome || '',
          posizione: updatedGiocatore.posizione || '',
          gol: Number(updatedGiocatore.gol) || 0,
          presenze: Number(updatedGiocatore.presenze) || 0,
          ammonizioni: Number(updatedGiocatore.ammonizioni) || 0,
          assist: Number(updatedGiocatore.assist) || 0,
          autogol: Number(updatedGiocatore.autogol) || 0,
          espulsioni: Number(updatedGiocatore.espulsioni) || 0,
          golSubiti: Number(updatedGiocatore.golSubiti) || 0,
          voto: Number(updatedGiocatore.voto) || 0,
          currentFilter: updatedGiocatore.currentFilter || null,
          competizione: Array.isArray(updatedGiocatore.competizione) ? updatedGiocatore.competizione : (updatedGiocatore.competizione ? [updatedGiocatore.competizione] : ['campionato']),
          squadra: selectedSquadra.nome
        };
        const giocatoreSquadraRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
        await setDoc(giocatoreSquadraRef, giocatoreDati, { merge: true });
        const giocatoreRef = doc(db, 'Giocatori', giocatoreId);
        await setDoc(giocatoreRef, giocatoreDati, { merge: true });
      }
      await updateValoreRosa(selectedSquadra.id);
      alert("Tutti i giocatori modificati sono stati aggiornati con successo!");
      setModifiedPlayers({});
    } catch (err) {
      console.error("Errore nell'aggiornamento dei giocatori:", err);
      alert(`Errore nell'aggiornamento dei giocatori: ${err.message}`);
    }
  };

  const handleDelete = async (giocatoreId) => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }
    const confirmDelete = window.confirm("Sei sicuro di voler eliminare questo giocatore?");
    if (confirmDelete) {
      try {
        const giocatoreRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
        await deleteDoc(giocatoreRef);
        const giocatoreGeneraleRef = doc(db, 'Giocatori', giocatoreId);
        await updateDoc(giocatoreGeneraleRef, { squadra: null });
        setGiocatori(prevGiocatori => prevGiocatori.filter(giocatore => giocatore.id !== giocatoreId));
        await updateValoreRosa(selectedSquadra.id);
        alert("Giocatore eliminato con successo!");
      } catch (err) {
        console.error("Errore nell'eliminazione del giocatore:", err);
        alert(`Errore nell'eliminazione del giocatore: ${err.message}`);
      }
    }
  };

  const exportFilteredSquadre = async () => {
    const workbook = XLSX.utils.book_new();
    for (const squadra of squadre) {
      const squadraData = [
        ['Squadra:' + squadra.nome || 'N/A','Valore Rosa:' + squadra.valoreRosa || 'N/A','Crediti:' + squadra.crediti || 'N/A'],
        ['Id','Nome', 'Posizione', 'Competizione', 'Gol', 'Presenze', 'Scadenza', 'ValoreIniziale', 'ValoreAttuale', 'Assist', 'Ammonizioni', 'Espulsioni', 'Autogol', 'MediaVoto', 'GolSubiti', 'RigoriParati', 'IdSquadra']
      ];
      
      // Dati Lista Giovani
      const listaGiovaniData = [
        ['Lista Giovani - ' + squadra.nome || 'N/A'],
        ['Id','Nome', 'Posizione', 'Gol', 'Presenze', 'ValoreIniziale', 'ValoreAttuale', 'DataInserimento', 'Assist', 'Ammonizioni', 'Espulsioni', 'Autogol', 'MediaVoto', 'GolSubiti', 'RigoriParati', 'IdSquadra']
      ];
      
      try {
        const giocatoriRef = collection(db, `Squadre/${squadra.id}/giocatori`);
        const giocatoriSnap = await getDocs(giocatoriRef);
        const giocatori = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Recupera lista giovani
        const listaGiovaniRef = collection(db, `Squadre/${squadra.id}/listaGiovani`);
        const listaGiovaniSnap = await getDocs(listaGiovaniRef);
        const listaGiovani = listaGiovaniSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filtra giocatori principali (escludi quelli in lista giovani)
        const giocatoriPrincipali = giocatori.filter(g => !listaGiovani.find(lg => lg.id === g.id));
        
        giocatoriPrincipali.sort(sortGiocatoriByRuolo);
        giocatoriPrincipali.forEach(giocatore => {
          const competizioniString = Array.isArray(giocatore.competizione) 
            ? giocatore.competizione.join(', ') 
            : (giocatore.competizione || 'campionato');
            
          squadraData.push([
            giocatore.id || 'N/A',
            giocatore.nome || 'N/A',
            giocatore.posizione || 'N/A',
            competizioniString,
            giocatore.gol || 0,
            giocatore.presenze || 0,
            giocatore.scadenza || 'N/A',
            giocatore.valoreIniziale || 0,
            giocatore.valoreAttuale || 0,
            giocatore.assist || 0,
            giocatore.ammonizioni || 0,
            giocatore.espulsioni || 0,
            giocatore.autogol || 0,
            giocatore.voto || 0,
            giocatore.golSubiti || 0,
            giocatore.rigoriParati || 0,
            squadra.id || 'N/A'
          ]);
        });
        
        // Aggiungi lista giovani se presente
        if (listaGiovani.length > 0) {
          listaGiovani.sort(sortGiocatoriByRuolo);
          listaGiovani.forEach(giocatore => {
            listaGiovaniData.push([
              giocatore.id || 'N/A',
              giocatore.nome || 'N/A',
              giocatore.posizione || 'N/A',
              giocatore.gol || 0,
              giocatore.presenze || 0,
              giocatore.valoreIniziale || 0,
              giocatore.valoreAttuale || 0,
              giocatore.dataInserimentoGiovani || 'N/A',
              giocatore.assist || 0,
              giocatore.ammonizioni || 0,
              giocatore.espulsioni || 0,
              giocatore.autogol || 0,
              giocatore.voto || 0,
              giocatore.golSubiti || 0,
              giocatore.rigoriParati || 0,
              squadra.id || 'N/A'
            ]);
          });
        }
        
        const worksheet = XLSX.utils.aoa_to_sheet(squadraData);
        XLSX.utils.book_append_sheet(workbook, worksheet, squadra.nome || `Squadra ${squadra.id}`);
        
        // Aggiungi foglio lista giovani se ci sono giocatori
        if (listaGiovani.length > 0) {
          const worksheetGiovani = XLSX.utils.aoa_to_sheet(listaGiovaniData);
          XLSX.utils.book_append_sheet(workbook, worksheetGiovani, `${squadra.nome}_Giovani` || `Squadra_${squadra.id}_Giovani`);
        }
        
      } catch (error) {
        console.error(`Errore nel recupero dei giocatori per la squadra ${squadra.id}:`, error);
        const errorWorksheet = XLSX.utils.aoa_to_sheet([['Errore nel recupero dei dati per questa squadra']]);
        XLSX.utils.book_append_sheet(workbook, errorWorksheet, `Errore Squadra ${squadra.id}`);
      }
    }
    const generateExcelFileName = () => {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      return `FantaVecchio_squadre_${date}_${time}.xlsx`;
    };
    XLSX.writeFile(workbook, generateExcelFileName());
  };

  const getValoreRosaClass = (valoreRosa) => {
    if (valoreRosa < 50) return 'text-success';
    if (valoreRosa < 100) return 'text-warning';
    return 'text-danger';
  };

  const getScadenzaClass = (scadenza) => {
    if (!scadenza) return '';
    const now = new Date();
    const dataScadenza = new Date(scadenza);
    const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    if (dataScadenza < now) {
      return 'text-danger'; // Past due
    } else if (dataScadenza <= sixMonthsFromNow) {
      return 'text-danger'; // Less than 3 months away
    }
    return 'text-success'; // More than 3 months away
  };

  const isAdmin = currentUser?.ruolo === 'admin';
  const isAdminOrUtente = isAdmin || currentUser?.ruolo === 'utente';

  if (squadreLoading) return <div>Caricamento squadre...</div>;
  if (squadreError) return <div>Errore nel caricamento delle squadre: {squadreError.message}</div>;

  const orderRuoli = [
    "Por", "Ds", "Dc", "Dd", "Dd;Dc", "B;Dd;Dc","B;Dd;Ds", "B;Ds;Dc", "B;Dc", "Ds;Dc", 
    "Dd;Ds", "Dd;Ds;Dc", "Dd;Ds;E", "Dd;E", "B;Ds;E", "B;Dd;E", "Ds;E", "E", "E;M", "E;C", "M", "C", "C;T", "M;C", "C;W;T",
    "E;W", "W", "W;T", "W;T;A", "T", "T;A", "W;A", "A", "Pc"
  ];

  const sortGiocatoriByRuolo = (a, b) => {
    const indexA = orderRuoli.indexOf(a.posizione);
    const indexB = orderRuoli.indexOf(b.posizione);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  };

  const handleSaveTempoCongelamento = async (giocatoreId, value) => {
    try {
      const giocatoreRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
      await setDoc(giocatoreRef, { tempoCongelamento: value }, { merge: true });

      const giocatoreGeneraleRef = doc(db, 'Giocatori', giocatoreId);
      await setDoc(giocatoreGeneraleRef, { tempoCongelamento: value }, { merge: true });

      setTempoCongelamento(prev => ({ ...prev, [giocatoreId]: value }));
      alert("Tempo di congelamento salvato con successo!");
    } catch (err) {
      console.error("Errore nel salvataggio del tempo di congelamento:", err);
      alert(`Errore nel salvataggio del tempo di congelamento: ${err.message}`);
    }
  };

  const handleAggiungiGiovane = async () => {
    if (!giocatoriSelezionatiGiovani.length || !selectedSquadra) {
      alert("Seleziona almeno un giocatore da aggiungere alla lista giovani");
      return;
    }

    try {
      let aggiunti = 0;
      let giaSalvati = 0;

      for (const giocatoreId of giocatoriSelezionatiGiovani) {
        const giocatore = giocatori.find(g => g.id === giocatoreId);
        if (!giocatore) {
          console.warn(`Giocatore con ID ${giocatoreId} non trovato`);
          continue;
        }

        // Verifica se il giocatore è già nella lista giovani
        const giocatoreGiaPresente = listaGiovani.find(g => g.id === giocatoreId);
        if (giocatoreGiaPresente) {
          giaSalvati++;
          continue;
        }

        // Aggiungi alla sottocollection listaGiovani
        const listaGiovaniRef = doc(db, `Squadre/${selectedSquadra.id}/listaGiovani`, giocatoreId);
        await setDoc(listaGiovaniRef, {
          ...giocatore,
          isGiovane: true,
          dataInserimentoGiovani: new Date().toISOString().split('T')[0]
        });

        // Aggiorna lo stato locale
        setListaGiovani(prev => [...prev, {
          ...giocatore,
          isGiovane: true,
          dataInserimentoGiovani: new Date().toISOString().split('T')[0]
        }]);

        aggiunti++;
      }

      setGiocatoriSelezionatiGiovani([]);
      
      let messaggio = "";
      if (aggiunti > 0) {
        messaggio += `${aggiunti} giocatore${aggiunti > 1 ? 'i' : ''} aggiunt${aggiunti > 1 ? 'i' : 'o'} alla lista giovani con successo!`;
      }
      if (giaSalvati > 0) {
        if (messaggio) messaggio += " ";
        messaggio += `${giaSalvati} giocatore${giaSalvati > 1 ? 'i' : ''} era${giaSalvati > 1 ? 'no' : ''} già present${giaSalvati > 1 ? 'i' : 'e'} nella lista.`;
      }
      
      alert(messaggio || "Nessun giocatore è stato aggiunto.");

    } catch (err) {
      console.error("Errore nell'aggiunta dei giocatori alla lista giovani:", err);
      alert(`Errore nell'aggiunta dei giocatori alla lista giovani: ${err.message}`);
    }
  };

  const handleRimuoviGiovane = async (giocatoreId) => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }

    const confirmDelete = window.confirm("Sei sicuro di voler rimuovere questo giocatore dalla lista giovani?");
    if (confirmDelete) {
      try {
        const listaGiovaniRef = doc(db, `Squadre/${selectedSquadra.id}/listaGiovani`, giocatoreId);
        await deleteDoc(listaGiovaniRef);

        setListaGiovani(prev => prev.filter(giocatore => giocatore.id !== giocatoreId));
        alert("Giocatore rimosso dalla lista giovani con successo!");
      } catch (err) {
        console.error("Errore nella rimozione del giocatore dalla lista giovani:", err);
        alert(`Errore nella rimozione del giocatore dalla lista giovani: ${err.message}`);
      }
    }
  };

  // Filtra i giocatori principali escludendo quelli in lista giovani
  const giocatoriPrincipali = giocatori.filter(g => 
    !listaGiovani.find(lg => lg.id === g.id)
  );

  // Filtra i giocatori che non sono già nella lista giovani
  const giocatoriDisponibiliPerGiovani = giocatoriPrincipali.filter(g => 
    !listaGiovani.find(lg => lg.id === g.id)
  );

  return (
    <div className="container-fluid p-3">
      <h2 className="my-4 text-center">Lista Squadre</h2>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {squadre.map((squadra) => (
          <button
            key={squadra.id}
            onClick={() => handleSquadraClick(squadra)}
            className={`btn ${selectedSquadra === squadra ? 'btn-primary' : 'btn-outline-primary'} mb-2`}
          >
            {squadra.nome || squadra.id}
          </button>
        ))}
        {isAdminOrUtente && (
          <button onClick={exportFilteredSquadre} className="btn btn-info mb-2">
            Esporta Excel
          </button>
        )}
      </div>
      {selectedSquadra && (
        <div>
          <h3>Dettagli Squadra</h3>
          <p className={getValoreRosaClass(selectedSquadra.valoreRosa)}>
            Valore Rosa: {selectedSquadra.valoreRosa || 'N/A'}
          </p>
          <p>
            Crediti:
            <input
              type="number"
              value={crediti}
              onChange={(e) => setCrediti(e.target.value)}
              className="form-control"
              min="0"
              disabled={!isAdmin}
            />
            <button
              className="btn btn-primary mt-2"
              onClick={handleUpdateCrediti}
              disabled={!isAdmin || crediti === ''}
            >
              Salva
            </button>
          </p>
          <p>
            Numero Giocatori: {giocatoriPrincipali.length || 'N/A'}
          </p>
          <p>
            Numero Giovani: {listaGiovani.length || 'N/A'}
          </p>
          <h3>Giocatori di {selectedSquadra.nome || selectedSquadra.id}</h3>
          {isAdmin && (
            <button
              className="btn btn-success mb-3"
              onClick={handleSaveAll}
              disabled={Object.keys(modifiedPlayers).length === 0}
            >
              Salva Tutto
            </button>
          )}
          <table className="table table-striped table-bordered table-hover">
            <thead className="table-primary">
              <tr>
                <th>Nome</th>
                <th>Posizione</th>
                <th>Competizione</th>
                <th>Gol</th>
                <th>Presenze</th>
                <th>Valore Iniziale</th>
                <th>Valore Attuale</th>
                <th>Scadenza</th>
                <th>Ammonizioni</th>
                <th>Assist</th>
                <th>Autogol</th>
                <th>Espulsioni</th>
                <th>Gol Subiti</th>
                <th>Media Voto</th>
                {isAdmin && <th>Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {giocatoriPrincipali.sort(sortGiocatoriByRuolo).map((giocatore) => (
                <tr 
                  key={giocatore.id} 
                  style={{ 
                    backgroundColor: rinnoviPendenti[giocatore.id] ? '#ffcccc' : '',
                    ...(modifiedPlayers[giocatore.id] ? { outline: '2px solid #007bff' } : {})
                  }}
                >
                  <td>{giocatore.nome}</td>
                  <td>{giocatore.posizione}</td>
                  <td>
                    {isAdmin ? (
                      <select
                        multiple
                        value={Array.isArray(giocatore.competizione) ? giocatore.competizione : (giocatore.competizione ? [giocatore.competizione] : ['campionato'])}
                        onChange={(e) => handleCompetizioneChange(giocatore.id, e.target.selectedOptions)}
                        className="form-select form-select-sm"
                        style={{ height: '80px' }}
                        size="3"
                      >
                        <option value="campionato">🏆 Campionato</option>
                        <option value="champions">⭐ Champions</option>
                        <option value="coppecoppe">🏅 Coppe delle Coppe</option>
                      </select>
                    ) : (
                      <span style={{ fontSize: '1.2rem' }}>
                        {getCompetizioneEmoji(Array.isArray(giocatore.competizione) ? giocatore.competizione : (giocatore.competizione ? [giocatore.competizione] : ['campionato']))}
                      </span>
                    )}
                  </td>
                  <td>{giocatore.gol}</td>
                  <td>{giocatore.presenze}</td>
                  <td>
                    <input
                      type="number"
                      value={giocatore.valoreIniziale}
                      onChange={(e) => handleEdit(giocatore.id, 'valoreIniziale', e.target.value)}
                      className="form-control"
                      min="0"
                      disabled={!isAdmin}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={giocatore.valoreAttuale}
                      onChange={(e) => handleEdit(giocatore.id, 'valoreAttuale', e.target.value)}
                      className="form-control"
                      min="0"
                      disabled={!isAdmin}
                    />
                  </td>
                  <td>
                    {!isSerieA(giocatore) ? (
                      <>
                        <input
                          type="text"
                          className="form-control"
                          value=""
                          disabled
                          placeholder="Data bloccata"
                        />
                        {isAdmin ? (
                          <>
                            <input
                              type="text"
                              className="form-control mt-2"
                              placeholder="Inserisci tempo rimanente (es. 1 anno)"
                              value={tempoCongelamento[giocatore.id] || giocatore.tempoCongelamento || ''}
                              onChange={(e) => setTempoCongelamento(prev => ({ ...prev, [giocatore.id]: e.target.value }))}
                            />
                            <button
                              className="btn btn-sm btn-primary mt-2"
                              onClick={() => handleSaveTempoCongelamento(giocatore.id, tempoCongelamento[giocatore.id])}
                              disabled={!tempoCongelamento[giocatore.id]}
                            >
                              Salva Tempo Congelamento
                            </button>
                          </>
                        ) : (
                          <div className="text-date small mt-1">
                            Tempo rimanente contratto: {giocatore.tempoCongelamento || 'N/A'}
                          </div>
                        )}
                      </>
                    ) : (
                      <input
                        type="date"
                        value={giocatore.scadenza || ''}
                        onChange={(e) => handleEdit(giocatore.id, 'scadenza', e.target.value)}
                        className={`form-control ${getScadenzaClass(giocatore.scadenza)}`}
                        disabled={!isAdmin}
                      />
                    )}
                  </td>
                  <td>{giocatore.ammonizioni}</td>
                  <td>{giocatore.assist}</td>
                  <td>{giocatore.autogol}</td>
                  <td>{giocatore.espulsioni}</td>
                  <td>{giocatore.golSubiti}</td>
                  <td>{giocatore.voto}</td>
                  {isAdmin && (
                    <td>
                      <div className="btn-group" role="group">
                        {['+6', '+12', '+18'].map((filter) => (
                          <button
                            key={filter}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleApplyFilter(giocatore.id, filter)}
                            disabled={!isSerieA(giocatore)}
                          >
                            {filter}
                          </button>
                        ))}
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(giocatore.id)}
                        >
                          Elimina
                        </button>
                      </div>
                      {rinnoviPendenti[giocatore.id] && (
                        <span className="badge bg-danger ms-2">Da Rinnovare sul profilo</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sezione Lista Giovani */}
          <div className="mt-5">
            <h3>Lista Giovani - {selectedSquadra.nome || selectedSquadra.id}</h3>
            
            {isAdmin && (
              <div className="mb-3">
                <div className="row">
                  <div className="col-md-8">
                    <select
                      className="form-select"
                      multiple
                      value={giocatoriSelezionatiGiovani}
                      onChange={(e) => setGiocatoriSelezionatiGiovani(Array.from(e.target.selectedOptions, option => option.value))}
                      style={{ height: '150px' }}
                    >
                      {giocatoriDisponibiliPerGiovani.map(giocatore => (
                        <option key={giocatore.id} value={giocatore.id}>
                          {giocatore.nome} - {giocatore.posizione}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-4">
                    <button
                      className="btn btn-success"
                      onClick={handleAggiungiGiovane}
                      disabled={giocatoriSelezionatiGiovani.length === 0}
                    >
                      Aggiungi alla Lista Giovani
                      {giocatoriSelezionatiGiovani.length > 0 && (
                        <span className="badge bg-light text-dark ms-2">
                          {giocatoriSelezionatiGiovani.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {listaGiovani.length > 0 ? (
              <table className="table table-striped table-bordered table-hover">
                <thead className="table-warning">
                  <tr>
                    <th>Nome</th>
                    <th>Posizione</th>
                    <th>Gol</th>
                    <th>Presenze</th>
                    <th>Valore Iniziale</th>
                    <th>Valore Attuale</th>
                    <th>Data Inserimento</th>
                    <th>Ammonizioni</th>
                    <th>Assist</th>
                    <th>Autogol</th>
                    <th>Espulsioni</th>
                    <th>Gol Subiti</th>
                    <th>Media Voto</th>
                    {isAdmin && <th>Azioni</th>}
                  </tr>
                </thead>
                <tbody>
                  {listaGiovani.sort(sortGiocatoriByRuolo).map((giocatore) => (
                    <tr key={giocatore.id}>
                      <td>{giocatore.nome}</td>
                      <td>{giocatore.posizione}</td>
                      <td>{giocatore.gol}</td>
                      <td>{giocatore.presenze}</td>
                      <td>{giocatore.valoreIniziale}</td>
                      <td>{giocatore.valoreAttuale}</td>
                      <td>{giocatore.dataInserimentoGiovani || 'N/A'}</td>
                      <td>{giocatore.ammonizioni}</td>
                      <td>{giocatore.assist}</td>
                      <td>{giocatore.autogol}</td>
                      <td>{giocatore.espulsioni}</td>
                      <td>{giocatore.golSubiti}</td>
                      <td>{giocatore.voto}</td>
                      {isAdmin && (
                        <td>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleRimuoviGiovane(giocatore.id)}
                          >
                            Rimuovi da Lista Giovani
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted">Nessun giocatore presente nella lista giovani.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ListaSquadre;