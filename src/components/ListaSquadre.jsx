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
  const [verificaRisultati, setVerificaRisultati] = useState(null);
  const [showVerificaRisultati, setShowVerificaRisultati] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  // ✅ Modifico la funzione handleSquadraClick per caricare anche i tempi di congelamento
  const handleSquadraClick = (squadra) => {
    setSelectedSquadra(squadra);
    setGiocatori([]);
    setIsLoading(true);
    setError(null);
    setModifiedPlayers({});
    setTempoCongelamento({}); // Reset tempo congelamento
    
    const fetchGiocatori = async () => {
      try {
        const giocatoriRef = collection(db, `Squadre/${squadra.id}/giocatori`);
        const snapshot = await getDocs(giocatoriRef);
        const giocatoriData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGiocatori(giocatoriData);
        
        // ✅ Carica i tempi di congelamento esistenti
        const tempiCongelamento = {};
        giocatoriData.forEach(giocatore => {
          if (giocatore.tempoCongelamento) {
            tempiCongelamento[giocatore.id] = giocatore.tempoCongelamento;
          }
        });
        setTempoCongelamento(tempiCongelamento);
        
        console.log(`✅ Caricati ${giocatoriData.length} giocatori per squadra ${squadra.nome}`);
        console.log(`✅ Caricati ${Object.keys(tempiCongelamento).length} tempi di congelamento`);
        
      } catch (error) {
        console.error('Errore nel recupero dei giocatori:', error);
        setError('Errore nel caricamento dei giocatori');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGiocatori();
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
    // Un giocatore è in una squadra se ha il campo squadra valorizzato (diverso da null, undefined o stringa vuota)
    const squadra = giocatore.squadra;
    return squadra !== null && 
           squadra !== undefined && 
           squadra !== '';
  };

  // Funzione per verificare lo stato delle scadenze
  const verificaScadenze = async () => {
    if (!selectedSquadra) {
      alert('Seleziona prima una squadra');
      return;
    }

    try {
      console.log('Inizio verifica stato scadenze...');
      
      // Recupera tutti i giocatori dalla collezione generale Giocatori
      const giocatoriSnapshot = await getDocs(collection(db, 'Giocatori'));
      let giocatoriConSquadra = [];
      let giocatoriSenzaSquadra = [];
      let giocatoriIncorretti = [];

      for (const giocatoreDoc of giocatoriSnapshot.docs) {
        const giocatore = giocatoreDoc.data();
        const squadra = giocatore.squadra; // Campo che indica se il giocatore ha una squadra
        
        // Determina se il giocatore ha una squadra
        const haSquadra = squadra !== null && squadra !== undefined && squadra !== '';
        
        if (haSquadra) {
          // Il giocatore ha una squadra
          giocatoriConSquadra.push({
            id: giocatoreDoc.id,
            nome: giocatore.nome || 'N/A',
            squadra: squadra,
            scadenza: giocatore.scadenza,
            corretto: giocatore.scadenza !== null && giocatore.scadenza !== undefined && giocatore.scadenza !== ''
          });
          
          // Se ha squadra ma non ha scadenza, è incorretto
          if (!giocatore.scadenza || giocatore.scadenza === '') {
            giocatoriIncorretti.push({
              id: giocatoreDoc.id,
              nome: giocatore.nome || 'N/A',
              squadra: squadra,
              scadenza: giocatore.scadenza || 'Mancante',
              problema: 'Ha squadra ma manca la scadenza (contratto congelato)',
              tipo: 'Con Squadra'
            });
          }
        } else {
          // Il giocatore non ha una squadra
          giocatoriSenzaSquadra.push({
            id: giocatoreDoc.id,
            nome: giocatore.nome || 'N/A',
            squadra: squadra || 'null/vuoto',
            scadenza: giocatore.scadenza,
            corretto: !giocatore.scadenza || giocatore.scadenza === ''
          });
          
          // Se non ha squadra ma ha scadenza, è incorretto
          if (giocatore.scadenza && giocatore.scadenza !== '') {
            giocatoriIncorretti.push({
              id: giocatoreDoc.id,
              nome: giocatore.nome || 'N/A',
              squadra: squadra || 'null/vuoto',
              scadenza: giocatore.scadenza,
              problema: 'Non ha squadra ma ha scadenza (dovrebbe essere congelato)',
              tipo: 'Senza Squadra'
            });
          }
        }
      }

      const risultati = {
        totaleGiocatori: giocatoriSnapshot.docs.length,
        giocatoriConSquadra: giocatoriConSquadra.length,
        giocatoriSenzaSquadra: giocatoriSenzaSquadra.length,
        giocatoriIncorretti: giocatoriIncorretti.length,
        dettagliIncorretti: giocatoriIncorretti,
        giocatoriConSquadraCorretti: giocatoriConSquadra.filter(g => g.corretto).length,
        giocatoriSenzaSquadraCorretti: giocatoriSenzaSquadra.filter(g => g.corretto).length
      };

      setVerificaRisultati(risultati);
      setShowVerificaRisultati(true);
      
      console.log('Verifica scadenze completata:', risultati);
      
    } catch (error) {
      console.error('Errore nella verifica stato scadenze:', error);
      alert(`Errore nella verifica: ${error.message}`);
    }
  };

  // Funzione per correggere automaticamente le scadenze
  const correggiScadenze = async () => {
    if (!selectedSquadra) {
      alert('Seleziona prima una squadra');
      return;
    }

    try {
      let giocatoriSbloccati = 0;
      let giocatoriCongelati = 0;
      
      // Recupera tutti i giocatori dalla collezione generale
      const giocatoriSnapshot = await getDocs(collection(db, 'Giocatori'));
      
      for (const giocatoreDoc of giocatoriSnapshot.docs) {
        const giocatore = giocatoreDoc.data();
        const squadra = giocatore.squadra;
        
        // Determina se il giocatore ha una squadra
        const haSquadra = squadra !== null && squadra !== undefined && squadra !== '';
        
        let needsUpdate = false;
        let updateData = {};
        
        if (haSquadra) {
          // Il giocatore ha squadra -> deve avere scadenza
          if (!giocatore.scadenza || giocatore.scadenza === '') {
            // Sblocca: assegna una scadenza di default (es. +1 anno)
            const defaultScadenza = new Date();
            defaultScadenza.setFullYear(defaultScadenza.getFullYear() + 1);
            updateData.scadenza = defaultScadenza.toISOString().split('T')[0];
            needsUpdate = true;
            giocatoriSbloccati++;
          }
        } else {
          // Il giocatore non ha squadra -> deve essere congelato
          if (giocatore.scadenza && giocatore.scadenza !== '') {
            // Congela: rimuovi la scadenza
            updateData.scadenza = null;
            needsUpdate = true;
            giocatoriCongelati++;
          }
        }
        
        if (needsUpdate) {
          // Aggiorna nella collezione generale
          const giocatoreGeneraleRef = doc(db, 'Giocatori', giocatoreDoc.id);
          await updateDoc(giocatoreGeneraleRef, updateData);
          
          // Se il giocatore ha una squadra, aggiorna anche nella sottocollection della squadra
          if (haSquadra) {
            const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
            for (const squadraDoc of squadreSnapshot.docs) {
              try {
                const giocatoreSquadraRef = doc(db, `Squadre/${squadraDoc.id}/giocatori`, giocatoreDoc.id);
                await updateDoc(giocatoreSquadraRef, updateData);
                break; // Trovato e aggiornato, esci dal loop
              } catch (err) {
                // Giocatore non trovato in questa squadra, continua
                continue;
              }
            }
          }
        }
      }
      
      // Ricarica i giocatori della squadra selezionata per vedere le modifiche
      if (selectedSquadra) {
        const giocatoriRef = collection(db, `Squadre/${selectedSquadra.id}/giocatori`);
        const giocatoriSnap = await getDocs(giocatoriRef);
        const giocatoriList = giocatoriSnap.docs.map(doc => {
          const data = { id: doc.id, ...doc.data() };
          if (!data.competizione || (Array.isArray(data.competizione) && data.competizione.length === 0)) {
            data.competizione = ['campionato'];
          }
          if (data.competizione && !Array.isArray(data.competizione)) {
            data.competizione = [data.competizione];
          }
          return data;
        });
        setGiocatori(giocatoriList);
      }
      
      alert(`Correzione completata!\n\n✅ Giocatori sbloccati (con squadra): ${giocatoriSbloccati}\n❄️ Giocatori congelati (senza squadra): ${giocatoriCongelati}\n\nOra tutti i giocatori hanno lo stato scadenza corretto.`);
      
      // Aggiorna la verifica
      verificaScadenze();
      
    } catch (error) {
      console.error('Errore nella correzione automatica:', error);
      alert(`Errore durante la correzione automatica: ${error.message}`);
    }
  };

  // Funzione per ripristinare le statistiche di tutti i giocatori di TUTTE le squadre
  const ripristinaStatistiche = async () => {
    if (!window.confirm('⚠️ ATTENZIONE: Questa operazione ripristinerà le statistiche di TUTTI i giocatori di TUTTE le squadre!\n\n✅ Cosa farà:\n- Azzererà tutte le statistiche (gol, assist, presenze, ammonizioni, ecc.)\n- Imposterà valore iniziale = valore attuale per tutti i giocatori\n- NON toccherà le scadenze\n\nSei sicuro di voler continuare? Questa azione non può essere annullata.')) {
      return;
    }

    try {
      console.log('🔄 Inizio ripristino statistiche globale...');
      
      let totalePlayers = 0;
      let successPlayers = 0;
      let errorPlayers = 0;
      
      // Ottieni tutte le squadre
      const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
      const tutteSquadre = squadreSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`📊 Trovate ${tutteSquadre.length} squadre da processare`);
      
      // Processa ogni squadra
      for (const squadra of tutteSquadre) {
        console.log(`\n🏟️ Processando squadra: ${squadra.nome} (ID: ${squadra.id})`);
        
        try {
          // Ottieni tutti i giocatori della squadra dalla sottoraccolta
          const giocatoriRef = collection(db, `Squadre/${squadra.id}/giocatori`);
          const giocatoriSnapshot = await getDocs(giocatoriRef);
          const giocatoriSquadra = giocatoriSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          console.log(`👥 Trovati ${giocatoriSquadra.length} giocatori nella squadra ${squadra.nome}`);
          totalePlayers += giocatoriSquadra.length;
          
          // Processa ogni giocatore della squadra
          for (const giocatore of giocatoriSquadra) {
            try {
              const statisticheReset = {
                gol: 0,
                assist: 0,
                ammonizioni: 0,
                espulsioni: 0,
                autogol: 0,
                presenze: 0,
                voto: 0,
                golSubiti: 0,
                rigoriParati: 0,
                valoreIniziale: giocatore.valoreAttuale || giocatore.valoreIniziale || 0
              };
              
              // ✅ Aggiorna nella collezione generale Giocatori
              const giocatoreRef = doc(db, 'Giocatori', giocatore.id);
              await updateDoc(giocatoreRef, statisticheReset);
              
              // ✅ Aggiorna nella sottoraccolta della squadra
              const giocatoreSquadraRef = doc(db, `Squadre/${squadra.id}/giocatori`, giocatore.id);
              await updateDoc(giocatoreSquadraRef, statisticheReset);
              
              console.log(`✅ Statistiche ripristinate per: ${giocatore.nome} (${squadra.nome})`);
              successPlayers++;
              
            } catch (playerError) {
              console.error(`❌ Errore per giocatore ${giocatore.nome} in ${squadra.nome}:`, playerError);
              errorPlayers++;
            }
          }
          
        } catch (teamError) {
          console.error(`❌ Errore nel processare squadra ${squadra.nome}:`, teamError);
          // In caso di errore nella squadra, incrementa solo i giocatori che erano stati contati
        }
      }
      
      console.log(`\n📊 RIEPILOGO RIPRISTINO GLOBALE:`);
      console.log(`👥 Totale giocatori processati: ${totalePlayers}`);
      console.log(`✅ Successi: ${successPlayers}`);
      console.log(`❌ Errori: ${errorPlayers}`);
      console.log(`📈 Percentuale successo: ${Math.round((successPlayers / totalePlayers) * 100)}%`);
      console.log(`🔄 Operazioni eseguite:`);
      console.log(`   📊 Statistiche azzerate: gol, assist, ammonizioni, espulsioni, autogol, presenze, voto, golSubiti, rigoriParati`);
      console.log(`   💰 Valore attuale = valore iniziale per tutti i giocatori`);
      console.log(`   📅 Scadenze: NON MODIFICATE`);
      
      alert(`🎉 Ripristino globale completato!\n\n📊 Risultati:\n✅ ${successPlayers} giocatori ripristinati con successo\n❌ ${errorPlayers} errori\n👥 ${totalePlayers} giocatori totali processati\n\n🔄 Tutte le statistiche sono state azzerate e i valori iniziali sono stati sincronizzati con quelli attuali.\nLe scadenze sono rimaste invariate.`);
      
      // Se c'è una squadra selezionata, ricarica i suoi dati
      if (selectedSquadra) {
        handleSquadraClick(selectedSquadra);
      }
      
    } catch (error) {
      console.error('❌ Errore generale nel ripristino statistiche:', error);
      alert('Si è verificato un errore generale durante il ripristino delle statistiche: ' + error.message);
    }
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
    try {
      const workbook = XLSX.utils.book_new();
      let totalGiocatoriEsportati = 0;
      let squadreEsportate = 0;

      console.log(`📊 Inizio export di tutte le squadre...`);

      // ✅ ESPORTA TUTTE LE SQUADRE in un singolo file con fogli separati
      for (const squadraData of squadre) {
        try {
          console.log(`\n📋 Processando squadra: ${squadraData.nome} (${squadraData.id})`);

          // Carica giocatori principali della squadra corrente
          const giocatoriRef = collection(db, `Squadre/${squadraData.id}/giocatori`);
          const giocatoriSnapshot = await getDocs(giocatoriRef);
          const giocatoriPrincipali = giocatoriSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Carica lista giovani della squadra corrente
          const giovaniRef = collection(db, `Squadre/${squadraData.id}/listaGiovani`);
          const giovaniSnapshot = await getDocs(giovaniRef);
          const giovaniArray = giovaniSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Combina tutti i giocatori con indicazione del tipo
          const tuttiGiocatori = [
            ...giocatoriPrincipali.map(g => ({ ...g, tipo: 'Principale' })),
            ...giovaniArray.map(g => ({ ...g, tipo: 'Giovane' }))
          ];

          console.log(`👥 Giocatori principali: ${giocatoriPrincipali.length}`);
          console.log(`👶 Giovani: ${giovaniArray.length}`);
          console.log(`📋 Totale squadra: ${tuttiGiocatori.length}`);

          // ✅ FORMATO COMPLETO con tutti i campi necessari per RipristinoRoseSquadre
          const worksheetData = [
            // Prima riga: Nome squadra, vuoto, Crediti, vuoti fino alla colonna R con ID squadra
            [`Squadra: ${squadraData.nome}`, '', `Crediti: ${squadraData.crediti || 0}`, '', '', '', '', '', '', '', '', '', '', '', '', '', '', `ID Squadra: ${squadraData.id}`],
            // Seconda riga: intestazioni colonne - AGGIUNGO "Tipo" in colonna E
            ['ID', 'Nome', 'Posizione', 'Competizione', 'Tipo', 'Gol', 'Presenze', 'Valore Iniziale', 'Valore Attuale', 'Scadenza', 'Ammonizioni', 'Assist', 'Autogol', 'Espulsioni', 'Gol Subiti', 'Media Voto', 'Rigori Parati', 'Squadra Serie A'],
            // Dati giocatori
            ...tuttiGiocatori.map(g => [
              g.id || 'N/A',                                                           // A = ID
              g.nome || 'N/A',                                                         // B = Nome
              g.posizione || 'N/A',                                                    // C = Posizione
              Array.isArray(g.competizione) ? g.competizione.join(';') : (g.competizione || 'campionato'), // D = Competizione
              g.tipo || 'Principale',                                                  // E = Tipo (NUOVO CAMPO)
              g.gol || 0,                                                             // F = Gol
              g.presenze || 0,                                                        // G = Presenze
              g.valoreIniziale || 0,                                                  // H = Valore Iniziale
              g.valoreAttuale || 0,                                                   // I = Valore Attuale
              g.scadenza || null,                                                     // J = Scadenza
              g.ammonizioni || 0,                                                     // K = Ammonizioni
              g.assist || 0,                                                          // L = Assist
              g.autogol || 0,                                                         // M = Autogol
              g.espulsioni || 0,                                                      // N = Espulsioni
              g.golSubiti || 0,                                                       // O = Gol Subiti
              g.voto || 0,                                                            // P = Media Voto
              g.rigoriParati || 0,                                                    // Q = Rigori Parati
              g.squadraSerieA || ''                                   // R = Squadra Serie A
            ])
          ];

          // Crea il foglio per questa squadra
          const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
          XLSX.utils.book_append_sheet(workbook, worksheet, squadraData.nome);

          totalGiocatoriEsportati += tuttiGiocatori.length;
          squadreEsportate++;

        } catch (squadraError) {
          console.error(`❌ Errore nell'export della squadra ${squadraData.nome}:`, squadraError);
          // Crea un foglio di errore per questa squadra
          const errorWorksheet = XLSX.utils.aoa_to_sheet([
            [`Errore nell'export della squadra: ${squadraData.nome}`],
            [`Errore: ${squadraError.message}`]
          ]);
          XLSX.utils.book_append_sheet(workbook, errorWorksheet, `ERRORE_${squadraData.nome}`);
        }
      }

      // Genera il nome file con timestamp
      const now = new Date();
      const timestamp = now.toISOString().split('T')[0];
      const fileName = `FantaVecchio_Squadre_${timestamp}.xlsx`;

      // Scarica il file
      XLSX.writeFile(workbook, fileName);
      
      alert(`✅ Export completato! File salvato: ${fileName}\n📊 Riepilogo:\n🏟️ Squadre esportate: ${squadreEsportate} `);
      
    } catch (error) {
      console.error('Errore durante l\'export:', error);
      alert('Errore durante l\'export: ' + error.message);
    }
  };

  const getValoreRosaClass = (valoreRosa) => {
    if (valoreRosa < 50) return 'text-success';
    if (valoreRosa < 100) return 'text-warning';
    return 'text-danger';
  };

  // Aggiorno la funzione getScadenzaClass per supportare giocatori congelati
  const getScadenzaClass = (scadenza, squadraSerieA = null) => {
    // Se il giocatore non ha squadra Serie A (congelato), usa stile diverso
    if (!squadraSerieA || squadraSerieA === null) {
      return 'text-muted'; // Grigio per giocatori congelati
    }
    
    // Logica originale per giocatori con squadra Serie A
    if (!scadenza) return 'text-danger';
    
    const oggi = new Date();
    const dataScadenza = new Date(scadenza);
    const differenzaMesi = (dataScadenza.getFullYear() - oggi.getFullYear()) * 12 + dataScadenza.getMonth() - oggi.getMonth();
    
    if (differenzaMesi <= 6) return 'text-danger';
    if (differenzaMesi <= 12) return 'text-warning';
    return 'text-success';
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
    if (!isAdmin) return; // Solo admin può modificare
    
    try {
      console.log(`Salvando tempo congelamento per giocatore ${giocatoreId}: "${value}"`);
      
      // Salva nella collezione generale Giocatori
      const giocatoreRef = doc(db, 'Giocatori', giocatoreId);
      await updateDoc(giocatoreRef, { 
        tempoCongelamento: value 
      });
      
      // Salva nella sottocollection della squadra
      if (selectedSquadra) {
        const giocatoreSquadraRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
        await updateDoc(giocatoreSquadraRef, { 
          tempoCongelamento: value 
        });
      }
      
      console.log(`✅ Tempo congelamento salvato per giocatore ${giocatoreId}`);
      
    } catch (error) {
      console.error(`Errore salvando tempo congelamento per giocatore ${giocatoreId}:`, error);
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

        // Verifica se il giocatore è già nella lista giovani usando l'ID
        const giocatoreGiaPresente = listaGiovani.find(g => g.id === giocatoreId);
        if (giocatoreGiaPresente) {
          giaSalvati++;
          continue;
        }

        // ✅ RIMUOVI dalla lista giocatori principali (dalla sottocollection)
        const giocatoreRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
        await deleteDoc(giocatoreRef);

        // ✅ AGGIUNGI alla lista giovani SENZA MODIFICARE NESSUN CAMPO
        const listaGiovaniRef = doc(db, `Squadre/${selectedSquadra.id}/listaGiovani`, giocatoreId);
        await setDoc(listaGiovaniRef, {
          ...giocatore, // ✅ Mantieni tutti i dati originali
          // NON aggiungo isGiovane o dataInserimentoGiovani per non modificare i dati originali
        });

        // ✅ AGGIORNA anche nella collezione principale Giocatori per mantenere coerenza
        const giocatorePrincipaleRef = doc(db, 'Giocatori', giocatoreId);
        await setDoc(giocatorePrincipaleRef, giocatore, { merge: true });

        // ✅ Aggiorna gli stati locali - SPOSTA il giocatore (non duplicare)
        setGiocatori(prev => prev.filter(g => g.id !== giocatoreId)); // Rimuovi dalla lista principale
        setListaGiovani(prev => [...prev, giocatore]); // Aggiungi alla lista giovani

        aggiunti++;
      }

      setGiocatoriSelezionatiGiovani([]);
      
      let messaggio = "";
      if (aggiunti > 0) {
        messaggio += `${aggiunti} giocatore${aggiunti > 1 ? 'i' : ''} spostat${aggiunti > 1 ? 'i' : 'o'} alla lista giovani con successo!`;
      }
      if (giaSalvati > 0) {
        if (messaggio) messaggio += " ";
        messaggio += `${giaSalvati} giocatore${giaSalvati > 1 ? 'i' : ''} era${giaSalvati > 1 ? 'no' : ''} già present${giaSalvati > 1 ? 'i' : 'e'} nella lista.`;
      }
      
      alert(messaggio || "Nessun giocatore è stato spostato.");

    } catch (err) {
      console.error("Errore nello spostamento dei giocatori alla lista giovani:", err);
      alert(`Errore nello spostamento dei giocatori alla lista giovani: ${err.message}`);
    }
  };

  const handleRimuoviGiovane = async (giocatoreId) => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }

    const confirmMove = window.confirm("Vuoi spostare questo giocatore dalla lista giovani alla lista giocatori principali?");
    if (confirmMove) {
      try {
        // Trova il giocatore nella lista giovani
        const giocatore = listaGiovani.find(g => g.id === giocatoreId);
        if (!giocatore) {
          alert("Giocatore non trovato nella lista giovani");
          return;
        }

        // ✅ RIMUOVI dalla lista giovani
        const listaGiovaniRef = doc(db, `Squadre/${selectedSquadra.id}/listaGiovani`, giocatoreId);
        await deleteDoc(listaGiovaniRef);

        // ✅ PREPARA I DATI PULITI (rimuovi campi problematici senza impostare undefined)
        const { isGiovane, dataInserimentoGiovani, ...giocatorePulito } = giocatore;

        // ✅ AGGIUNGI alla lista giocatori principali con dati puliti
        const giocatoreRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
        await setDoc(giocatoreRef, giocatorePulito);

        // ✅ AGGIORNA anche nella collezione principale Giocatori per mantenere coerenza
        const giocatorePrincipaleRef = doc(db, 'Giocatori', giocatoreId);
        await setDoc(giocatorePrincipaleRef, giocatorePulito, { merge: true });

        // ✅ Aggiorna gli stati locali - SPOSTA il giocatore
        setListaGiovani(prev => prev.filter(g => g.id !== giocatoreId)); // Rimuovi dalla lista giovani
        setGiocatori(prev => [...prev, giocatorePulito]); // Aggiungi alla lista principale

        alert("Giocatore spostato dalla lista giovani alla lista principale con successo!");
      } catch (err) {
        console.error("Errore nello spostamento del giocatore:", err);
        alert(`Errore nello spostamento del giocatore: ${err.message}`);
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
            <div className="mb-3">
              <button
                className="btn btn-success me-2"
                onClick={handleSaveAll}
                disabled={Object.keys(modifiedPlayers).length === 0}
              >
                Salva Tutto
              </button>
              <button
                className="btn btn-warning me-2 mb-2"
                onClick={ripristinaStatistiche}
                title="⚠️ ATTENZIONE: Ripristina statistiche di TUTTI i giocatori di TUTTE le squadre! Azzera tutte le statistiche e sincronizza valore iniziale = valore attuale"
              >
                🌍 Ripristina Statistiche
              </button>
            </div>
          )}

          {/* Risultati della verifica */}
          {showVerificaRisultati && verificaRisultati && (
            <div className="mb-4">
              <div className="card">
                <div className="card-header">
                  <h6>📊 Risultati Verifica Stato Scadenze - {selectedSquadra.nome}</h6>
                </div>
                <div className="card-body">
                  <div className="row mb-3">
                    <div className="col-md-3">
                      <div className="text-center p-2 border rounded bg-light">
                        <small>Totale</small>
                        <div className="h5 text-primary">{verificaRisultati.totaleGiocatori}</div>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center p-2 border rounded bg-success text-white">
                        <small>Con Squadra</small>
                        <div className="h5">{verificaRisultati.giocatoriConSquadra}</div>
                        <small>Corretti: {verificaRisultati.giocatoriConSquadraCorretti}</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center p-2 border rounded bg-secondary text-white">
                        <small>Senza Squadra</small>
                        <div className="h5">{verificaRisultati.giocatoriSenzaSquadra}</div>
                        <small>Corretti: {verificaRisultati.giocatoriSenzaSquadraCorretti}</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center p-2 border rounded bg-danger text-white">
                        <small>Da Correggere</small>
                        <div className="h5">{verificaRisultati.giocatoriIncorretti}</div>
                      </div>
                    </div>
                  </div>

                  {verificaRisultati.giocatoriIncorretti > 0 && (
                    <div className="alert alert-warning">
                      <strong>⚠️ Trovati {verificaRisultati.giocatoriIncorretti} giocatori con scadenze incorrette.</strong>
                      <br/>
                      Usa il pulsante "🔧 Correggi Automaticamente" per risolvere i problemi.
                    </div>
                  )}

                  {verificaRisultati.giocatoriIncorretti === 0 && (
                    <div className="alert alert-success">
                      <strong>✅ Perfetto!</strong> Tutti i giocatori hanno lo stato scadenza corretto.
                    </div>
                  )}

                  <button
                    onClick={() => setShowVerificaRisultati(false)}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Nascondi Risultati
                  </button>
                </div>
              </div>
            </div>
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
                    {!giocatore.squadraSerieA || giocatore.squadraSerieA === null ? (
                      // Giocatore CONGELATO (squadraSerieA = null) -> Campo tempo congelamento
                      <div className="d-flex align-items-center">
                        {isAdmin ? (
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={tempoCongelamento[giocatore.id] || ''}
                            onChange={(e) => setTempoCongelamento({
                              ...tempoCongelamento,
                              [giocatore.id]: e.target.value
                            })}
                            onBlur={() => handleSaveTempoCongelamento(giocatore.id, tempoCongelamento[giocatore.id] || '')}
                            placeholder="Tempo congelamento"
                            style={{ width: '150px' }}
                          />
                        ) : (
                          <span className="text-muted">
                            {tempoCongelamento[giocatore.id] || 'Contratto congelato'}
                          </span>
                        )}
                        <span className="badge bg-secondary ms-2">❄️ Congelato</span>
                      </div>
                    ) : (
                      // Giocatore ATTIVO (squadraSerieA ≠ null) -> Logica scadenza normale
                      isAdminOrUtente ? (
                        <input
                          type="date"
                          className={`form-control form-control-sm ${getScadenzaClass(giocatore.scadenza, giocatore.squadraSerieA)}`}
                          value={giocatore.scadenza || ''}
                          onChange={(e) => handleEdit(giocatore.id, 'scadenza', e.target.value)}
                        />
                      ) : (
                        <span className={getScadenzaClass(giocatore.scadenza, giocatore.squadraSerieA)}>
                          {giocatore.scadenza || 'N/A'}
                        </span>
                      )
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
                      Sposta alla Lista Giovani
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
                  {listaGiovani.sort(sortGiocatoriByRuolo).map((giocatore) => (
                    <tr key={giocatore.id}>
                      <td>{giocatore.nome}</td>
                      <td>{giocatore.posizione}</td>
                      <td>{giocatore.gol}</td>
                      <td>{giocatore.presenze}</td>
                      <td>{giocatore.valoreIniziale}</td>
                      <td>{giocatore.valoreAttuale}</td>
                      <td>
                        {!giocatore.squadraSerieA || giocatore.squadraSerieA === null || giocatore.squadraSerieA === '' ? (
                          <span className="text-muted">❄️ Congelato</span>
                        ) : (
                          <span className={getScadenzaClass(giocatore.scadenza, giocatore.squadraSerieA)}>
                            {giocatore.scadenza || 'N/A'}
                          </span>
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
                          <button
                            className="btn btn-warning btn-sm"
                            onClick={() => handleRimuoviGiovane(giocatore.id)}
                          >
                            Sposta alla Lista Principale
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