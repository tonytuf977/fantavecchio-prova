import React, { useState, useEffect, useCallback } from 'react';
import { useUtenti } from '../hook/useUtenti';
import { useSquadre } from '../hook/useSquadre';
import { useGiocatori } from '../hook/useGiocatori';
import { auth, db } from '../firebase/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, setDoc, deleteDoc, orderBy, writeBatch } from 'firebase/firestore';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { Modal, Button, Collapse, Form } from 'react-bootstrap';
import { useRinnovi } from '../hook/useRinnovi';
import RinnovoContratto from './RinnovoContratto';

function Profilo() {
  const { utenti, loading: loadingUtenti } = useUtenti();
  const { squadre, isLoading: loadingSquadre } = useSquadre();
  const { giocatori, loading: loadingGiocatori } = useGiocatori();
  const [utenteCorrente, setUtenteCorrente] = useState(null);
  const [squadraUtente, setSquadraUtente] = useState(null);
  const [richiesteScambio, setRichiesteScambio] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [notificheCount, setNotificheCount] = useState(0);
  const { loading: rinnovoLoading, aggiornaStatoRinnovo } = useRinnovi();
  const [storicoScambi, setStoricoScambi] = useState([]);
  const [richiesteElaborate, setRichiesteElaborate] = useState(new Set());

  // Stati per impostazioni utente
  const [showImpostazioni, setShowImpostazioni] = useState(false);
  const [nuovoNomeSquadra, setNuovoNomeSquadra] = useState('');
  const [nuovaEmail, setNuovaEmail] = useState('');
  const [vecchiaPassword, setVecchiaPassword] = useState('');
  const [nuovaPassword, setNuovaPassword] = useState('');
  const [confermaPassword, setConfermaPassword] = useState('');
  const [loadingAggiornamento, setLoadingAggiornamento] = useState(false);

  const fetchRichiesteScambio = useCallback(async (squadraId) => {
    try {
      const richiesteRef = collection(db, 'RichiesteScambio');
      const q = query(
        richiesteRef,
        where('squadraAvversaria', '==', squadraId),
        where('stato', '==', 'Approvata da admin'),
        where('accettataAdmin', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const richieste = await Promise.all(querySnapshot.docs.map(async docSnapshot => {
        const data = docSnapshot.data();
        
        console.log('🔍 DEBUG - Dati richiesta dal database:', {
          id: docSnapshot.id,
          tipoScambio: data.tipoScambio,
          creditiOfferti: data.creditiOfferti,
          dataCompleta: data
        });

        // Ottieni nome squadra richiedente
        let squadraRichiedenteNome = data.squadraRichiedente;
        try {
          const squadraDoc = await getDoc(doc(db, 'Squadre', data.squadraRichiedente));
          if (squadraDoc.exists()) {
            squadraRichiedenteNome = squadraDoc.data().nome;
          }
        } catch (error) {
          console.warn('Errore nel recupero nome squadra richiedente:', error);
        }

        if (data.tipoScambio === 'crediti') {
          // Gestione scambio a crediti
          if (!data.giocatoreRichiesto) {
            console.warn('ID giocatore richiesto mancante per richiesta crediti:', docSnapshot.id);
            return null;
          }
          
          const giocatoreRichiestoDoc = await getDoc(doc(db, 'Giocatori', data.giocatoreRichiesto));
          
          return {
            id: docSnapshot.id,
            ...data,
            squadraRichiedenteNome: squadraRichiedenteNome,
            creditiOfferti: data.creditiOfferti || 0, // ✅ ASSICURA CHE I CREDITI CI SIANO
            giocatoreRichiestoDettagli: giocatoreRichiestoDoc.exists() ? 
              { id: giocatoreRichiestoDoc.id, ...giocatoreRichiestoDoc.data() } : 
              { id: data.giocatoreRichiesto, nome: 'Giocatore non trovato', valoreAttuale: 0 }
          };
        } else {
          // Gestione scambio giocatori (con o senza crediti)
          const giocatoriOffertiPromises = (data.giocatoriOfferti || []).map(async id => {
            if (!id) return null;
            const doc_ref = await getDoc(doc(db, 'Giocatori', id));
            return doc_ref.exists() ? { id: doc_ref.id, ...doc_ref.data() } : null;
          });
          
          const giocatoriRichiestiPromises = (data.giocatoriRichiesti || []).map(async id => {
            if (!id) return null;
            const doc_ref = await getDoc(doc(db, 'Giocatori', id));
            return doc_ref.exists() ? { id: doc_ref.id, ...doc_ref.data() } : null;
          });
          
          const giocatoriOfferti = (await Promise.all(giocatoriOffertiPromises)).filter(g => g !== null);
          const giocatoriRichiesti = (await Promise.all(giocatoriRichiestiPromises)).filter(g => g !== null);
          
          return {
            id: docSnapshot.id,
            ...data,
            squadraRichiedenteNome: squadraRichiedenteNome,
            creditiOfferti: data.creditiOfferti || 0, // ✅ ASSICURA CHE I CREDITI CI SIANO
            giocatoriOfferti: giocatoriOfferti,
            giocatoriRichiesti: giocatoriRichiesti
          };
        }
      }));
      
      // Filtra le richieste null (quelle con errori)
      const richiesteValide = richieste.filter(r => r !== null);
      console.log('✅ Richieste caricate con crediti:', richiesteValide.map(r => ({
        id: r.id,
        tipo: r.tipoScambio,
        crediti: r.creditiOfferti
      })));
      setRichiesteScambio(richiesteValide);
    } catch (error) {
      console.error('Errore nel caricamento delle richieste di scambio:', error);
      setRichiesteScambio([]);
    }
  }, []);

  const fetchStoricoScambi = useCallback(async (squadraId) => {
    try {
      const scambiRef = collection(db, 'RichiesteScambio');
      const scambiSnap = await getDocs(scambiRef);
      
      // ✅ PROCESSA I DATI COME NELLO STORICO GENERALE
      const storicoProcessato = await Promise.all(scambiSnap.docs.map(async (docSnapshot) => {
        const scambio = docSnapshot.data();
        
        // Filtra solo gli scambi che coinvolgono la squadra corrente
        if (scambio.squadraRichiedente !== squadraId && scambio.squadraAvversaria !== squadraId) {
          return null;
        }

        try {
          // Trova nomi squadre
          const squadraRichiedenteNome = squadre.find(s => s.id === scambio.squadraRichiedente)?.nome || scambio.squadraRichiedente;
          const squadraAvversariaNome = squadre.find(s => s.id === scambio.squadraAvversaria)?.nome || scambio.squadraAvversaria;

          let scambioProcessato = {
            ...scambio,
            id: docSnapshot.id,
            dataScambio: scambio.dataScambio || 'Data non disponibile',
            dataRichiesta: scambio.dataRichiesta || 'Data non disponibile',
            squadraRichiedenteNome,
            squadraAvversariaNome
          };

          if (scambio.tipoScambio === 'crediti') {
            // Gestione scambio crediti: trova nome giocatore richiesto
            const giocatoreRichiesto = giocatori.find(g => g.id === scambio.giocatoreRichiesto);
            scambioProcessato.giocatoreRichiestoDettagli = giocatoreRichiesto || { 
              id: scambio.giocatoreRichiesto, 
              nome: 'Giocatore non trovato',
              valoreAttuale: 0 
            };
          } else {
            // Gestione scambio giocatori: trova nomi giocatori offerti e richiesti
            const giocatoriOffertiDettagli = (scambio.giocatoriOfferti || []).map(id => {
              const giocatore = giocatori.find(g => g.id === id);
              return giocatore || { id, nome: id, valoreAttuale: 0 }; // Fallback con ID se non trovato
            });

            const giocatoriRichiestiDettagli = (scambio.giocatoriRichiesti || []).map(id => {
              const giocatore = giocatori.find(g => g.id === id);
              return giocatore || { id, nome: id, valoreAttuale: 0 }; // Fallback con ID se non trovato
            });

            scambioProcessato.giocatoriOffertiDettagli = giocatoriOffertiDettagli;
            scambioProcessato.giocatoriRichiestiDettagli = giocatoriRichiestiDettagli;
          }

          return scambioProcessato;
        } catch (error) {
          console.error('Errore nel processare scambio:', docSnapshot.id, error);
          return null; // Ritorna null in caso di errore
        }
      }));

      // Filtra i risultati null e ordina per data
      const scambiValidi = storicoProcessato.filter(s => s !== null);
      scambiValidi.sort((a, b) => {
        const dataA = a.dataScambio || a.dataRichiesta;
        const dataB = b.dataScambio || b.dataRichiesta;
        
        if (!dataA && !dataB) return 0;
        if (!dataA) return 1;
        if (!dataB) return -1;
        
        return new Date(dataB).getTime() - new Date(dataA).getTime();
      });
      
      setStoricoScambi(scambiValidi);
    } catch (error) {
      console.error('Errore nel recupero dello storico scambi:', error);
      setStoricoScambi([]);
    }
  }, [squadre, giocatori]);

  const updateNotificheCount = useCallback(() => {
    setNotificheCount(richiesteScambio.length);
  }, [richiesteScambio]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async user => {
      if (user && !loadingUtenti && !loadingSquadre) {
        const utente = utenti.find(u => u.id === user.uid);
        setUtenteCorrente(utente);
        if (utente && utente.idSquadra) {
          const squadra = squadre.find(s => s.id === utente.idSquadra);
          setSquadraUtente(squadra);
          await fetchRichiesteScambio(utente.idSquadra);
          await fetchStoricoScambi(utente.idSquadra);
        } else {
          setSquadraUtente(null);
        }
      } else {
        setUtenteCorrente(null);
        setSquadraUtente(null);
      }
    });
    return () => unsubscribe();
  }, [utenti, squadre, loadingUtenti, loadingSquadre, giocatori, fetchRichiesteScambio, fetchStoricoScambi]);

  useEffect(() => {
    updateNotificheCount();
  }, [richiesteScambio, updateNotificheCount]);

  const aggiornaSquadraGiocatore = async (giocatoreId, daSquadraId, aSquadraId) => {
    try {
      // Rimuovi il giocatore dalla squadra di origine
      if (daSquadraId) {
        const giocatoreDaRef = doc(db, `Squadre/${daSquadraId}/giocatori`, giocatoreId);
        await deleteDoc(giocatoreDaRef);
      }

      // Ottieni i dati del giocatore dalla collezione principale
      const giocatoreRef = doc(db, 'Giocatori', giocatoreId);
      const giocatoreSnap = await getDoc(giocatoreRef);
      
      if (!giocatoreSnap.exists()) {
        throw new Error(`Giocatore con ID ${giocatoreId} non trovato`);
      }

      const giocatoreData = giocatoreSnap.data();

      // Aggiorna la squadra del giocatore nella collezione principale
      await updateDoc(giocatoreRef, { squadra: aSquadraId });

      // Aggiungi il giocatore alla nuova squadra
      const giocatoreARef = doc(db, `Squadre/${aSquadraId}/giocatori`, giocatoreId);
      await setDoc(giocatoreARef, {
        ...giocatoreData,
        squadra: aSquadraId
      });

      console.log(`Giocatore ${giocatoreId} spostato da ${daSquadraId} a ${aSquadraId}`);
    } catch (error) {
      console.error('Errore nell\'aggiornamento della squadra del giocatore:', error);
      throw error;
    }
  };

  const aggiornaRosaSquadra = async (squadraId) => {
    try {
      const giocatoriRef = collection(db, `Squadre/${squadraId}/giocatori`);
      const giocatoriSnap = await getDocs(giocatoriRef);
      const giocatoriList = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const valoreTotaleRosa = giocatoriList.reduce((acc, giocatore) => 
        acc + (parseFloat(giocatore.valoreAttuale) || 0), 0
      );
      
      const squadraRef = doc(db, 'Squadre', squadraId);
      await updateDoc(squadraRef, { 
        valoreRosa: valoreTotaleRosa,
        numeroGiocatori: giocatoriList.length
      });
      
      console.log(`Rosa aggiornata per squadra ${squadraId}: ${valoreTotaleRosa}€`);
    } catch (error) {
      console.error('Errore nell\'aggiornamento del valore della rosa:', error);
      throw error;
    }
  };

  const scambiaGiocatori = async (squadraRichiedenteId, squadraAvversariaId, giocatoriOfferti, giocatoriRichiesti, creditiOfferti = 0) => {
    if (giocatoriOfferti && Array.isArray(giocatoriOfferti)) {
      for (const giocatore of giocatoriOfferti) {
        await aggiornaSquadraGiocatore(giocatore.id, squadraRichiedenteId, squadraAvversariaId);
      }
    }
    if (giocatoriRichiesti && Array.isArray(giocatoriRichiesti)) {
      for (const giocatore of giocatoriRichiesti) {
        await aggiornaSquadraGiocatore(giocatore.id, squadraAvversariaId, squadraRichiedenteId);
      }
    }
    
    // ✅ CORRETTO: Se ci sono crediti offerti (per tipo giocatori con crediti), trasferiscili
    if (creditiOfferti > 0) {
      console.log(`💰 Trasferimento crediti: ${creditiOfferti}€ da ${squadraRichiedenteId} a ${squadraAvversariaId}`);
      
      const squadraRichiedenteRef = doc(db, 'Squadre', squadraRichiedenteId);
      const squadraAvversariaRef = doc(db, 'Squadre', squadraAvversariaId);
      
      const squadraRichiedenteSnap = await getDoc(squadraRichiedenteRef);
      const squadraAvversariaSnap = await getDoc(squadraAvversariaRef);
      
      const creditiAttualiRichiedente = squadraRichiedenteSnap.data().crediti || 0;
      const creditiAttualiAvversaria = squadraAvversariaSnap.data().crediti || 0;
      
      console.log(`💰 Crediti prima: Richiedente ${creditiAttualiRichiedente}€, Avversaria ${creditiAttualiAvversaria}€`);
      
      await updateDoc(squadraRichiedenteRef, { 
        crediti: creditiAttualiRichiedente - creditiOfferti 
      });
      await updateDoc(squadraAvversariaRef, { 
        crediti: creditiAttualiAvversaria + creditiOfferti 
      });
      
      console.log(`💰 Crediti dopo: Richiedente ${creditiAttualiRichiedente - creditiOfferti}€, Avversaria ${creditiAttualiAvversaria + creditiOfferti}€`);
    }
    
    await aggiornaRosaSquadra(squadraRichiedenteId);
    await aggiornaRosaSquadra(squadraAvversariaId);
  };

  const scambiaCrediti = async (squadraRichiedenteId, squadraAvversariaId, giocatoreRichiesto, creditiOfferti) => {
    // Sposta il giocatore dalla squadra avversaria a quella richiedente
    await aggiornaSquadraGiocatore(giocatoreRichiesto.id, squadraAvversariaId, squadraRichiedenteId);
    
    // Aggiorna i crediti delle squadre
    const squadraRichiedenteRef = doc(db, 'Squadre', squadraRichiedenteId);
    const squadraAvversariaRef = doc(db, 'Squadre', squadraAvversariaId);
    
    const squadraRichiedenteSnap = await getDoc(squadraRichiedenteRef);
    const squadraAvversariaSnap = await getDoc(squadraAvversariaRef);
    
    const creditiAttualiRichiedente = squadraRichiedenteSnap.data().crediti || 0;
    const creditiAttualiAvversaria = squadraAvversariaSnap.data().crediti || 0;
    
    await updateDoc(squadraRichiedenteRef, { 
      crediti: creditiAttualiRichiedente - creditiOfferti 
    });
    await updateDoc(squadraAvversariaRef, { 
      crediti: creditiAttualiAvversaria + creditiOfferti 
    });
    
    await aggiornaRosaSquadra(squadraRichiedenteId);
    await aggiornaRosaSquadra(squadraAvversariaId);
  };

  const ricaricaDatiSquadra = async () => {
    if (squadraUtente) {
      const squadraRef = doc(db, 'Squadre', squadraUtente.id);
      const squadraSnap = await getDoc(squadraRef);
      if (squadraSnap.exists()) {
        setSquadraUtente({ id: squadraSnap.id, ...squadraSnap.data() });
      }
    }
  };

  const creaRichiestaRinnovo = async (squadraId, giocatori) => {
    try {
      console.log(`🔄 Creazione richiesta rinnovo per squadra ${squadraId}:`, giocatori);
      
      // Verifica che i giocatori abbiano un ID valido
      const giocatoriValidi = giocatori.filter(g => g.id);
      
      if (giocatoriValidi.length === 0) {
        console.warn('Nessun giocatore valido per la creazione del rinnovo');
        return;
      }
      
      // Crea una nuova richiesta di rinnovo con un ID unico
      const rinnovoRef = doc(collection(db, 'RinnoviContratti'));
      await setDoc(rinnovoRef, {
        squadraId: squadraId,
        giocatori: giocatoriValidi.map(g => g.id), // ✅ Usa solo gli ID dei giocatori
        stato: 'In attesa',
        dataCreazione: new Date().toISOString().split('T')[0],
        tipo: 'post-scambio' // Identificativo per distinguere dai rinnovi manuali
      });
      
      console.log(`✅ Richiesta rinnovo creata con successo per squadra ${squadraId} con ${giocatoriValidi.length} giocatori`);
    } catch (error) {
      console.error('Errore nella creazione della richiesta di rinnovo:', error);
      throw error;
    }
  };

  const handleAccettaScambio = async (richiesta) => {
    if (richiesteElaborate.has(richiesta.id)) {
      console.warn('Richiesta già in elaborazione:', richiesta.id);
      return;
    }

    // Rimuovi la data di scadenza dai giocatori coinvolti nello scambio
    const rimuoviScadenza = async (giocatori) => {
      if (Array.isArray(giocatori)) {
        for (const giocatore of giocatori) {
          const giocatoreRef = doc(db, 'Giocatori', giocatore.id);
          await updateDoc(giocatoreRef, { scadenza: null });
        }
      }
    };

    try {
      setRichiesteElaborate(prev => new Set(prev).add(richiesta.id));

      // ✅ DEBUG: Logga sempre i crediti prima dell'elaborazione
      console.log('🔄 INIZIO ELABORAZIONE SCAMBIO:', {
        id: richiesta.id,
        tipo: richiesta.tipoScambio,
        creditiOfferti: richiesta.creditiOfferti,
        creditiType: typeof richiesta.creditiOfferti
      });

      if (richiesta.tipoScambio === 'crediti') {
        console.log('💰 ELABORAZIONE SCAMBIO CREDITI');
        await scambiaCrediti(
          richiesta.squadraRichiedente,
          richiesta.squadraAvversaria,
          richiesta.giocatoreRichiestoDettagli,
          richiesta.creditiOfferti
        );
        await rimuoviScadenza([richiesta.giocatoreRichiestoDettagli]);
      } else {
        console.log('👥 ELABORAZIONE SCAMBIO GIOCATORI CON CREDITI:', richiesta.creditiOfferti);
        
        // ✅ ASSICURATI CHE I CREDITI VENGANO PASSATI CORRETTAMENTE
        const creditiDaTrasferire = richiesta.creditiOfferti || 0;
        console.log('💰 Crediti che verranno trasferiti:', creditiDaTrasferire);
        
        await scambiaGiocatori(
          richiesta.squadraRichiedente,
          richiesta.squadraAvversaria,
          richiesta.giocatoriOfferti,
          richiesta.giocatoriRichiesti,
          creditiDaTrasferire // ✅ PASSA I CREDITI ESPLICITAMENTE
        );
        const tuttiGiocatori = [...(richiesta.giocatoriOfferti || []), ...(richiesta.giocatoriRichiesti || [])];
        await rimuoviScadenza(tuttiGiocatori);
      }

      // Procedi con l'accettazione dello scambio
      const richiestaRef = doc(db, 'RichiesteScambio', richiesta.id);
      await updateDoc(richiestaRef, {
        stato: 'Completato',
        accettataAvversario: true,
        dataScambio: new Date().toISOString().split('T')[0]
      });

      // ✅ CREA RICHIESTE DI RINNOVO PER ENTRAMBE LE SQUADRE
      if (richiesta.tipoScambio === 'crediti') {
        // Per scambio crediti: solo la squadra richiedente riceve il giocatore e deve rinnovarlo
        const giocatoreRicevuto = richiesta.giocatoreRichiestoDettagli;
        if (giocatoreRicevuto && giocatoreRicevuto.id) {
          console.log(`🔄 Creazione rinnovo per squadra richiedente: ${richiesta.squadraRichiedente} - Giocatore: ${giocatoreRicevuto.nome} (ID: ${giocatoreRicevuto.id})`);
          await creaRichiestaRinnovo(richiesta.squadraRichiedente, [giocatoreRicevuto]);
        }
      } else {
        // Per scambio giocatori: entrambe le squadre ricevono giocatori e devono rinnovarli
        
        // Rinnovi per la squadra richiedente (riceve i giocatori richiesti)
        if (richiesta.giocatoriRichiesti && richiesta.giocatoriRichiesti.length > 0) {
          const giocatoriRichiestiConId = richiesta.giocatoriRichiesti.filter(g => g.id);
          if (giocatoriRichiestiConId.length > 0) {
            console.log(`🔄 Creazione rinnovi per squadra richiedente: ${richiesta.squadraRichiedente} - ${giocatoriRichiestiConId.length} giocatori`);
            await creaRichiestaRinnovo(richiesta.squadraRichiedente, giocatoriRichiestiConId);
          }
        }
        
        // Rinnovi per la squadra avversaria (riceve i giocatori offerti)  
        if (richiesta.giocatoriOfferti && richiesta.giocatoriOfferti.length > 0) {
          const giocatoriOffertiConId = richiesta.giocatoriOfferti.filter(g => g.id);
          if (giocatoriOffertiConId.length > 0) {
            console.log(`🔄 Creazione rinnovi per squadra avversaria: ${richiesta.squadraAvversaria} - ${giocatoriOffertiConId.length} giocatori`);
            await creaRichiestaRinnovo(richiesta.squadraAvversaria, giocatoriOffertiConId);
          }
        }
      }

      setModalMessage('Scambio accettato e completato! Controlla i giocatori da rinnovare.');
      setShowModal(true);

      // Rimuovi la richiesta dalla lista locale
      setRichiesteScambio(prevRichieste => prevRichieste.filter(r => r.id !== richiesta.id));

      await fetchRichiesteScambio(squadraUtente.id);
      await fetchStoricoScambi(squadraUtente.id);
      await ricaricaDatiSquadra();
    } catch (error) {
      console.error('Errore nell\'accettazione dello scambio:', error);
      setModalMessage('Si è verificato un errore nell\'accettazione dello scambio: ' + error.message);
      setShowModal(true);
    } finally {
      // Rimuovi la richiesta dal Set "in elaborazione"
      setRichiesteElaborate(prev => {
        const newState = new Set(prev);
        newState.delete(richiesta.id);
        return newState;
      });
    }
  };

  const handleRifiutaScambio = async (richiestaId) => {
    if (richiesteElaborate.has(richiestaId)) {
      console.warn("Richiesta già elaborata:", richiestaId);
      return;
    }

    try {
      // Aggiungi la richiesta al Set "in elaborazione"
      setRichiesteElaborate(prev => new Set(prev).add(richiestaId));

      // Verifica lo stato della richiesta nel database
      const richiestaRef = doc(db, 'RichiesteScambio', richiestaId);
      const richiestaSnap = await getDoc(richiestaRef);

      if (!richiestaSnap.exists()) {
        console.warn("Richiesta di scambio non trovata:", richiestaId);
        alert("La richiesta di scambio non è più disponibile.");
        return;
      }

      const datiRichiesta = richiestaSnap.data();
      if (datiRichiesta.stato === 'Completato') {
        console.warn("Lo scambio è già stato completato:", richiestaId);
        alert("Questo scambio è già stato completato.");
        return;
      }

      // Procedi con il rifiuto dello scambio
      await updateDoc(richiestaRef, { stato: 'Rifiutato' });

      setModalMessage('Richiesta di scambio rifiutata.');
      setShowModal(true);

      // Rimuovi la richiesta dalla lista locale
      setRichiesteScambio(prevRichieste => prevRichieste.filter(r => r.id !== richiestaId));
    } catch (error) {
      console.error('Errore nel rifiuto dello scambio:', error);
      setModalMessage('Si è verificato un errore nel rifiuto dello scambio.');
      setShowModal(true);
    } finally {
      // Rimuovi la richiesta dal Set "in elaborazione"
      setRichiesteElaborate(prev => {
        const newState = new Set(prev);
        newState.delete(richiestaId);
        return newState;
      });
    }
  };

  useEffect(() => {
    // Inizializza i valori delle impostazioni
    if (squadraUtente) {
      setNuovoNomeSquadra(squadraUtente.nome || '');
    }
    if (utenteCorrente) {
      setNuovaEmail(utenteCorrente.email || '');
    }
  }, [utenti, squadre, loadingUtenti, loadingSquadre, squadraUtente, utenteCorrente]);

  const aggiornaRiferimentiSquadra = async (vecchioNome, nuovoNome, squadraId) => {
    try {
      const batch = writeBatch(db);

      // Aggiorna tutti i giocatori nella collezione principale
      const giocatoriRef = collection(db, 'Giocatori');
      const q = query(giocatoriRef, where('squadra', '==', squadraId));
      const giocatoriSnap = await getDocs(q);
      
      giocatoriSnap.docs.forEach(doc => {
        batch.update(doc.ref, { 
          squadraNome: nuovoNome,
          squadra: nuovoNome  // Aggiorna anche questo campo con il nuovo nome
        });
      });

      // Cerca anche per vecchio nome squadra nella collezione principale
      const qVecchioNome = query(giocatoriRef, where('squadra', '==', vecchioNome));
      const giocatoriVecchioNomeSnap = await getDocs(qVecchioNome);
      
      giocatoriVecchioNomeSnap.docs.forEach(doc => {
        batch.update(doc.ref, { 
          squadraNome: nuovoNome,
          squadra: nuovoNome  // Aggiorna il campo squadra con il nuovo nome
        });
      });

      // Aggiorna tutti i giocatori nella sottocollection della squadra
      const giocatoriSquadraRef = collection(db, `Squadre/${squadraId}/giocatori`);
      const giocatoriSquadraSnap = await getDocs(giocatoriSquadraRef);
      
      giocatoriSquadraSnap.docs.forEach(doc => {
        batch.update(doc.ref, { 
          squadraNome: nuovoNome,
          squadra: nuovoNome  // Aggiorna anche qui il campo squadra
        });
      });

      // Aggiorna la lista giovani
      const listaGiovaniRef = collection(db, `Squadre/${squadraId}/listaGiovani`);
      const listaGiovaniSnap = await getDocs(listaGiovaniRef);
      
      listaGiovaniSnap.docs.forEach(doc => {
        batch.update(doc.ref, { 
          squadraNome: nuovoNome,
          squadra: nuovoNome  // Aggiorna anche qui il campo squadra
        });
      });

      // Aggiorna le richieste di scambio
      const richiesteRef = collection(db, 'RichiesteScambio');
      const qRichiedente = query(richiesteRef, where('squadraRichiedente', '==', squadraId));
      const qAvversaria = query(richiesteRef, where('squadraAvversaria', '==', squadraId));
      
      const [richiedenteSnap, avversariaSnap] = await Promise.all([
        getDocs(qRichiedente),
        getDocs(qAvversaria)
      ]);

      richiedenteSnap.docs.forEach(doc => {
        batch.update(doc.ref, { squadraRichiedenteNome: nuovoNome });
      });

      avversariaSnap.docs.forEach(doc => {
        batch.update(doc.ref, { squadraAvversariaNome: nuovoNome });
      });

      // Aggiorna i rinnovi contratti
      const rinnoviRef = collection(db, 'RinnoviContratti');
      const qRinnovi = query(rinnoviRef, where('squadraId', '==', squadraId));
      const rinnoviSnap = await getDocs(qRinnovi);
      
      rinnoviSnap.docs.forEach(doc => {
        batch.update(doc.ref, { squadraNome: nuovoNome });
      });

      await batch.commit();
      console.log('Tutti i riferimenti alla squadra sono stati aggiornati, incluso il campo squadra nella lista generale');
    } catch (error) {
      console.error('Errore nell\'aggiornamento dei riferimenti della squadra:', error);
      throw error;
    }
  };

  const handleCambiaNomeSquadra = async () => {
    if (!nuovoNomeSquadra.trim() || !squadraUtente) {
      setModalMessage('Inserisci un nome valido per la squadra');
      setShowModal(true);
      return;
    }

    if (nuovoNomeSquadra === squadraUtente.nome) {
      setModalMessage('Il nuovo nome è uguale a quello attuale');
      setShowModal(true);
      return;
    }

    // ✅ Verifica che il nome non sia già in uso da un'altra squadra
    const nomeEsistente = squadre.find(s => 
      s.id !== squadraUtente.id && 
      s.nome.toLowerCase().trim() === nuovoNomeSquadra.toLowerCase().trim()
    );
    
    if (nomeEsistente) {
      setModalMessage(`Il nome "${nuovoNomeSquadra}" è già utilizzato da un'altra squadra. Scegli un nome diverso.`);
      setShowModal(true);
      return;
    }

    setLoadingAggiornamento(true);
    try {
      const vecchioNome = squadraUtente.nome;
      
      // Aggiorna il nome della squadra
      const squadraRef = doc(db, 'Squadre', squadraUtente.id);
      await updateDoc(squadraRef, { nome: nuovoNomeSquadra });

      // Aggiorna tutti i riferimenti nel database
      await aggiornaRiferimentiSquadra(vecchioNome, nuovoNomeSquadra, squadraUtente.id);

      // Aggiorna lo stato locale
      setSquadraUtente(prev => ({ ...prev, nome: nuovoNomeSquadra }));

      setModalMessage('Nome della squadra aggiornato con successo!');
      setShowModal(true);
    } catch (error) {
      console.error('Errore nel cambio del nome della squadra:', error);
      setModalMessage('Errore nel cambio del nome della squadra: ' + error.message);
      setShowModal(true);
    } finally {
      setLoadingAggiornamento(false);
    }
  };

  const aggiornaRiferimentiEmail = async (vecchiaEmail, nuovaEmail) => {
    try {
      const batch = writeBatch(db);

      // Aggiorna le richieste di scambio e altri documenti che potrebbero contenere l'email
      // Se necessario, aggiungi qui altri aggiornamenti per documenti che contengono l'email

      await batch.commit();
      console.log('Tutti i riferimenti email sono stati aggiornati');
    } catch (error) {
      console.error('Errore nell\'aggiornamento dei riferimenti email:', error);
      throw error;
    }
  };

  const handleCambiaEmail = async () => {
    if (!nuovaEmail.trim() || !utenteCorrente) {
      setModalMessage('Inserisci una email valida');
      setShowModal(true);
      return;
    }

    if (nuovaEmail === utenteCorrente.email) {
      setModalMessage('La nuova email è uguale a quella attuale');
      setShowModal(true);
      return;
    }

    if (!vecchiaPassword) {
      setModalMessage('Inserisci la password attuale per confermare il cambio email');
      setShowModal(true);
      return;
    }

    setLoadingAggiornamento(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, vecchiaPassword);
      
      // Riautentica l'utente
      await reauthenticateWithCredential(user, credential);
      
      const vecchiaEmail = user.email;
      
      // Aggiorna l'email in Firebase Auth
      await updateEmail(user, nuovaEmail);

      // Aggiorna l'email nel documento utente
      const utenteRef = doc(db, 'Utenti', utenteCorrente.id);
      await updateDoc(utenteRef, { email: nuovaEmail });

      // Aggiorna tutti i riferimenti nel database
      await aggiornaRiferimentiEmail(vecchiaEmail, nuovaEmail);

      // Aggiorna lo stato locale
      setUtenteCorrente(prev => ({ ...prev, email: nuovaEmail }));
      setVecchiaPassword('');

      setModalMessage('Email aggiornata con successo! Verifica la nuova email per confermare.');
      setShowModal(true);
    } catch (error) {
      console.error('Errore nel cambio email:', error);
      let messaggioErrore = 'Errore nel cambio email: ';
      
      if (error.code === 'auth/wrong-password') {
        messaggioErrore += 'Password attuale non corretta';
      } else if (error.code === 'auth/email-already-in-use') {
        messaggioErrore += 'Questa email è già in uso da un altro account';
      } else if (error.code === 'auth/invalid-email') {
        messaggioErrore += 'Email non valida';
      } else {
        messaggioErrore += error.message;
      }
      
      setModalMessage(messaggioErrore);
      setShowModal(true);
    } finally {
      setLoadingAggiornamento(false);
    }
  };

  const handleCambiaPassword = async () => {
    if (!vecchiaPassword || !nuovaPassword || !confermaPassword) {
      setModalMessage('Compila tutti i campi per cambiare la password');
      setShowModal(true);
      return;
    }

    if (nuovaPassword !== confermaPassword) {
      setModalMessage('La nuova password e la conferma non coincidono');
      setShowModal(true);
      return;
    }

    if (nuovaPassword.length < 6) {
      setModalMessage('La nuova password deve essere di almeno 6 caratteri');
      setShowModal(true);
      return;
    }

    setLoadingAggiornamento(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, vecchiaPassword);
      
      // Riautentica l'utente
      await reauthenticateWithCredential(user, credential);
      
      // Aggiorna la password
      await updatePassword(user, nuovaPassword);

      // Pulisci i campi
      setVecchiaPassword('');
      setNuovaPassword('');
      setConfermaPassword('');

      setModalMessage('Password aggiornata con successo!');
      setShowModal(true);
    } catch (error) {
      console.error('Errore nel cambio password:', error);
      let messaggioErrore = 'Errore nel cambio password: ';
      
      if (error.code === 'auth/wrong-password') {
        messaggioErrore += 'Password attuale non corretta';
      } else if (error.code === 'auth/weak-password') {
        messaggioErrore += 'La nuova password è troppo debole';
      } else {
        messaggioErrore += error.message;
      }
      
      setModalMessage(messaggioErrore);
      setShowModal(true);
    } finally {
      setLoadingAggiornamento(false);
    }
  };

  if (loadingUtenti || loadingSquadre || loadingGiocatori) {
    return <div>Caricamento...</div>;
  }
  if (!utenteCorrente) {
    return <div>Utente non trovato.</div>;
  }

  return (
    <div className="container mt-5">
      <h2>Profilo Utente</h2>
      
      {/* Sezione Impostazioni */}
      <div className="mb-4">
        <Button
          variant="outline-secondary"
          onClick={() => setShowImpostazioni(!showImpostazioni)}
          className="mb-3"
        >
          ⚙️ Impostazioni Account
        </Button>
        
        <Collapse in={showImpostazioni}>
          <div className="card p-4">
            <h4>Impostazioni Account</h4>
            
            {/* Cambio Nome Squadra */}
            {squadraUtente && (
              <div className="mb-4">
                <h5>Cambia Nome Squadra</h5>
                <div className="row">
                  <div className="col-md-8">
                    <Form.Group className="mb-3">
                      <Form.Label>Nome Attuale: <strong>{squadraUtente.nome}</strong></Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Nuovo nome squadra"
                        value={nuovoNomeSquadra}
                        onChange={(e) => setNuovoNomeSquadra(e.target.value)}
                        disabled={loadingAggiornamento}
                      />
                    </Form.Group>
                  </div>
                  <div className="col-md-4">
                    <Button
                      variant="primary"
                      onClick={handleCambiaNomeSquadra}
                      disabled={loadingAggiornamento || !nuovoNomeSquadra.trim()}
                      className="mt-4"
                    >
                      {loadingAggiornamento ? 'Aggiornando...' : 'Aggiorna Nome'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <hr />

            {/* Cambio Email */}
            <div className="mb-4">
              <h5>Cambia Email</h5>
              <div className="row">
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Email Attuale: <strong>{utenteCorrente?.email}</strong></Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="Nuova email"
                      value={nuovaEmail}
                      onChange={(e) => setNuovaEmail(e.target.value)}
                      disabled={loadingAggiornamento}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-6">
                  <Form.Group className="mb-3">
                    <Form.Label>Password Attuale (per conferma)</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Password attuale"
                      value={vecchiaPassword}
                      onChange={(e) => setVecchiaPassword(e.target.value)}
                      disabled={loadingAggiornamento}
                    />
                  </Form.Group>
                </div>
              </div>
              <Button
                variant="warning"
                onClick={handleCambiaEmail}
                disabled={loadingAggiornamento || !nuovaEmail.trim() || !vecchiaPassword}
              >
                {loadingAggiornamento ? 'Aggiornando...' : 'Aggiorna Email'}
              </Button>
            </div>

            <hr />

            {/* Cambio Password */}
            <div className="mb-4">
              <h5>Cambia Password</h5>
              <div className="row">
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Password Attuale</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Password attuale"
                      value={vecchiaPassword}
                      onChange={(e) => setVecchiaPassword(e.target.value)}
                      disabled={loadingAggiornamento}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Nuova Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Nuova password (min 6 caratteri)"
                      value={nuovaPassword}
                      onChange={(e) => setNuovaPassword(e.target.value)}
                      disabled={loadingAggiornamento}
                    />
                  </Form.Group>
                </div>
                <div className="col-md-4">
                  <Form.Group className="mb-3">
                    <Form.Label>Conferma Nuova Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Conferma nuova password"
                      value={confermaPassword}
                      onChange={(e) => setConfermaPassword(e.target.value)}
                      disabled={loadingAggiornamento}
                    />
                  </Form.Group>
                </div>
              </div>
              <Button
                variant="danger"
                onClick={handleCambiaPassword}
                disabled={loadingAggiornamento || !vecchiaPassword || !nuovaPassword || !confermaPassword}
              >
                {loadingAggiornamento ? 'Aggiornando...' : 'Aggiorna Password'}
              </Button>
            </div>
          </div>
        </Collapse>
      </div>

      <p><strong>Email:</strong> {utenteCorrente?.email}</p>
      <p><strong>Ruolo:</strong> {utenteCorrente?.ruolo}</p>
      <p><strong>Notifiche:</strong> {notificheCount}</p>
      {squadraUtente && (
        <div>
          <h3>Squadra Associata</h3>
          <p><strong>Nome Squadra:</strong> {squadraUtente.nome}</p>
          <p><strong>Valore Rosa:</strong> {squadraUtente.valoreRosa}€</p>
          <p><strong>Crediti:</strong> {squadraUtente.crediti}</p>
          <p><strong>Numero Giocatori:</strong> {squadraUtente.numeroGiocatori}</p>
        </div>
      )}
      <h3>Richieste di Scambio</h3>
      {richiesteScambio.length > 0 ? (
        richiesteScambio.map(richiesta => (
          <div key={richiesta.id} className="card mb-3">
            <div className="card-body">
              <h5 className="card-title">
                Richiesta di {richiesta.tipoScambio === 'crediti' ? 'Offerta Crediti' : 'Scambio Giocatori'} da {richiesta.squadraRichiedenteNome}
              </h5>
              
              {richiesta.tipoScambio === 'crediti' ? (
                <>
                  <p><strong>Giocatore richiesto:</strong></p>
                  <ul>
                    <li>{richiesta.giocatoreRichiestoDettagli?.nome || 'Nome non disponibile'} (Valore attuale: {richiesta.giocatoreRichiestoDettagli?.valoreAttuale || 'N/A'}€)</li>
                  </ul>
                  <p><strong>Crediti offerti:</strong> {richiesta.creditiOfferti || 0}€</p>
                </>
              ) : (
                <>
                  <p><strong>Giocatori offerti:</strong></p>
                  <ul>
                    {(richiesta.giocatoriOfferti || []).map(g => (
                      <li key={g.id}>{g.nome} (Valore attuale: {g.valoreAttuale || 'N/A'}€)</li>
                    ))}
                  </ul>
                  <p><strong>Giocatori richiesti:</strong></p>
                  <ul>
                    {(richiesta.giocatoriRichiesti || []).map(g => (
                      <li key={g.id}>{g.nome} (Valore attuale: {g.valoreAttuale || 'N/A'}€)</li>
                    ))}
                  </ul>
                  {richiesta.creditiOfferti && richiesta.creditiOfferti > 0 && (
                    <p><strong>💰 Crediti aggiuntivi offerti:</strong> <span style={{color: 'green', fontWeight: 'bold'}}>{richiesta.creditiOfferti}€</span></p>
                  )}
                </>
              )}
              
              {richiesta.clausola && <p><strong>Clausola:</strong> {richiesta.clausola}</p>}
              <button
                className="btn btn-success me-2"
                onClick={() => handleAccettaScambio(richiesta)}
                disabled={richiesteElaborate.has(richiesta.id)}
              >
                {richiesteElaborate.has(richiesta.id) ? 'Elaborando...' : 'Accetta'}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleRifiutaScambio(richiesta.id)}
                disabled={richiesteElaborate.has(richiesta.id)}
              >
                {richiesteElaborate.has(richiesta.id) ? 'Elaborando...' : 'Rifiuta'}
              </button>
            </div>
          </div>
        ))
      ) : (
        <p>Nessuna richiesta di scambio in attesa.</p>
      )}
      <h3>Giocatori da Rinnovare</h3>
      {squadraUtente && (
        <RinnovoContratto
          squadraId={squadraUtente.id}
          onRinnovoCompletato={() => fetchRichiesteScambio(squadraUtente.id)}
        />
      )}
      <h3 className="mt-4">Storico Scambi</h3>
      {storicoScambi.length > 0 ? (
        storicoScambi.map((scambio, index) => (
          <div key={index} className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h5 className="card-title">
                  Data Proposta:{' '}
                  {scambio.dataRichiesta
                    ? new Date(scambio.dataRichiesta).toLocaleDateString()
                    : 'Data non disponibile'}
                  {' - '}
                  {scambio.tipoScambio === 'crediti' ? 'Offerta Crediti' : 'Scambio Giocatori'}
                  
                  {/* Badge stato scambio */}
                  <span className={`badge ms-2 ${
                    scambio.stato === 'Completato' ? 'bg-success' :
                    scambio.stato === 'Rifiutata' || scambio.stato === 'Rifiutato' ? 'bg-danger' :
                    scambio.stato === 'Approvata da admin' ? 'bg-warning text-dark' : 'bg-secondary'
                  }`}>
                    {scambio.stato === 'Completato' ? '✅ Completato' :
                     scambio.stato === 'Rifiutata' || scambio.stato === 'Rifiutato' ? '❌ Rifiutato' :
                     scambio.stato === 'Approvata da admin' ? '⏳ In Attesa' : scambio.stato || 'N/A'}
                  </span>
                </h5>
              </div>
              <p><strong>Squadra Richiedente:</strong> {scambio.squadraRichiedenteNome || scambio.squadraRichiedente}</p>
              <p><strong>Squadra Avversaria:</strong> {scambio.squadraAvversariaNome || scambio.squadraAvversaria}</p>
              
              {scambio.tipoScambio === 'crediti' ? (
                <div>
                  <strong>Giocatore Richiesto:</strong>
                  <ul>
                    <li>{scambio.giocatoreRichiestoDettagli?.nome || 'Nome non disponibile'} 
                        (Valore: {scambio.giocatoreRichiestoDettagli?.valoreAttuale || 'N/A'}€)
                    </li>
                  </ul>
                  <strong>Crediti Offerti:</strong> {scambio.creditiOfferti || 0}€
                </div>
              ) : (
                <div>
                  <div>
                    <strong>Giocatori Offerti:</strong>
                    <ul>
                      {(scambio.giocatoriOffertiDettagli && scambio.giocatoriOffertiDettagli.length > 0) ? (
                        scambio.giocatoriOffertiDettagli.map((giocatore, idx) => (
                          <li key={idx}>
                            {giocatore.nome} (Valore: {giocatore.valoreAttuale || 'N/A'}€)
                          </li>
                        ))
                      ) : (
                        <li>Nessun giocatore offerto</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <strong>Giocatori Richiesti:</strong>
                    <ul>
                      {(scambio.giocatoriRichiestiDettagli && scambio.giocatoriRichiestiDettagli.length > 0) ? (
                        scambio.giocatoriRichiestiDettagli.map((giocatore, idx) => (
                          <li key={idx}>
                            {giocatore.nome} (Valore: {giocatore.valoreAttuale || 'N/A'}€)
                          </li>
                        ))
                      ) : (
                        <li>Nessun giocatore richiesto</li>
                      )}
                    </ul>
                  </div>
                  {scambio.creditiOfferti && scambio.creditiOfferti > 0 && (
                    <div><strong>💰 Crediti Aggiuntivi Offerti:</strong> <span style={{color: 'green', fontWeight: 'bold'}}>{scambio.creditiOfferti}€</span></div>
                  )}
                </div>
              )}
              <p><strong>Stato:</strong> {scambio.stato || 'N/A'}</p>
              {scambio.stato === 'Completato' && (
                <p>
                  <strong>Data Scambio:</strong>{' '}
                  {scambio.dataScambio && scambio.dataScambio !== 'Data non disponibile'
                    ? new Date(scambio.dataScambio).toLocaleDateString()
                    : 'Data non disponibile'}
                </p>
              )}
              {scambio.clausola && <p><strong>Clausola:</strong> {scambio.clausola}</p>}
            </div>
          </div>
        ))
      ) : (
        <p>Nessuno scambio completato.</p>
      )}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Notifica</Modal.Title>
        </Modal.Header>
        <Modal.Body>{modalMessage}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Chiudi
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Profilo;