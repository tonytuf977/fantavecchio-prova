import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase/firebase';
import { collection, addDoc, query, where, getDocs, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useSquadre } from '../hook/useSquadre';
import { useGiocatori } from '../hook/useGiocatori';
import { useUtenti } from '../hook/useUtenti';
import { Modal, Button, Form, Collapse } from 'react-bootstrap';
import emailjs from 'emailjs-com';
import { logAction, AUDIT_ACTIONS } from '../service/AuditService';
import { captureError, ERROR_TYPES, SEVERITY } from '../service/ErrorLogger';

// Valori di EmailJS hardcoded
const EMAILJS_SERVICE_ID = 'service_0knpeti';
const EMAILJS_TEMPLATE_ID = 'template_8eoqu2a';
const EMAILJS_PUBLIC_KEY = '1P283n6VVbx-OeBKb';

function RichiestaScambio() {
  const [squadraUtente, setSquadraUtente] = useState(null);
  const [squadreAvversarie, setSquadreAvversarie] = useState([]);
  const [giocatoriUtente, setGiocatoriUtente] = useState([]);
  const [giocatoriAvversari, setGiocatoriAvversari] = useState([]);
  const [squadraSelezionata, setSquadraSelezionata] = useState('');
  const [giocatoriSelezionatiUtente, setGiocatoriSelezionatiUtente] = useState([]);
  const [giocatoriSelezionatiAvversario, setGiocatoriSelezionatiAvversario] = useState([]);
  const [clausola, setClausola] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [finestraScambiAperta, setFinestraScambiAperta] = useState(true);
  
  // Nuovi stati per scambi a crediti
  const [tipoScambio, setTipoScambio] = useState('giocatori'); // 'giocatori', 'crediti', o 'giocatori_crediti'
  const [giocatoreRichiesto, setGiocatoreRichiesto] = useState('');
  const [creditiOfferti, setCreditiOfferti] = useState('');
  
  // Stati per gestione automatica finestra scambi
  const [showImpostazioni, setShowImpostazioni] = useState(false);
  const [dataApertura, setDataApertura] = useState('');
  const [oraApertura, setOraApertura] = useState('');
  const [dataChiusura, setDataChiusura] = useState('');
  const [oraChiusura, setOraChiusura] = useState('');

  // Stati per invio email finestra scambi
  const [ultimoInvioEmail, setUltimoInvioEmail] = useState(null);
  const [emailInCorso, setEmailInCorso] = useState(false);
  
  const { squadre } = useSquadre();
  const { giocatori, loading: loadingGiocatori, error: errorGiocatori } = useGiocatori();
  const { utenti } = useUtenti();

  useEffect(() => {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }, []);

  const fetchSquadraUtente = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setModalMessage("Per effettuare uno scambio devi prima accedere (regola anti D'avino)");
      setShowModal(true);
      return;
    }
    if (user) {
      try {
        const squadraQuery = query(collection(db, 'Squadre'), where('utenti', 'array-contains', user.uid));
        const squadraSnapshot = await getDocs(squadraQuery);
        if (!squadraSnapshot.empty) {
          const squadraData = { id: squadraSnapshot.docs[0].id, ...squadraSnapshot.docs[0].data() };
          setSquadraUtente(squadraData);
          const altreSquadre = squadre.filter(s => s.id !== squadraData.id);
          setSquadreAvversarie(altreSquadre);
        } else {
          setSquadraUtente(null);
          setSquadreAvversarie([]);
        }
        
        // Check if the user is an admin
        const userDoc = utenti.find(u => u.id === user.uid);
        setIsAdmin(userDoc?.ruolo === 'admin');
        
        // Fetch the current state of "finestra scambi"
        const finestraScambiDoc = await getDocs(query(collection(db, 'Impostazioni'), where('nome', '==', 'finestraScambi')));
        if (!finestraScambiDoc.empty) {
          const finestraData = finestraScambiDoc.docs[0].data();
          
          // Carica le impostazioni di apertura/chiusura automatica se esistono
          if (finestraData.dataApertura) setDataApertura(finestraData.dataApertura);
          if (finestraData.oraApertura) setOraApertura(finestraData.oraApertura);
          if (finestraData.dataChiusura) setDataChiusura(finestraData.dataChiusura);
          if (finestraData.oraChiusura) setOraChiusura(finestraData.oraChiusura);
          
          // NON controllare toggle automatici al mount, solo aggiorna lo stato UI
          // I toggle automatici saranno gestiti solo dal controllo periodico
          setFinestraScambiAperta(finestraData.aperta);
        } else {
          // If the document doesn't exist, create it with a default value
          await setDoc(doc(db, 'Impostazioni', 'finestraScambi'), { nome: 'finestraScambi', aperta: true });
          setFinestraScambiAperta(true);
        }
      } catch (error) {
        console.error('Errore nel recupero della squadra utente:', error);
      }
    }
  }, [squadre, utenti]);

  // Funzione per controllare se è il momento di aprire/chiudere automaticamente
  // NOTA: Questa funzione viene chiamata SOLO dal controllo periodico useEffect
  // NON invia MAI email, aggiorna solo lo stato nel database
  const checkAutomaticToggle = async (finestraData) => {
    const now = new Date();
    const currentDateTime = now.getTime();
    
    // Controlla prima la chiusura, poi l'apertura
    if (finestraData.dataChiusura && finestraData.oraChiusura) {
      const chiusuraDateTime = new Date(`${finestraData.dataChiusura}T${finestraData.oraChiusura}`).getTime();
      if (currentDateTime >= chiusuraDateTime && finestraData.aperta) {
        console.log('⏰ Attivazione chiusura automatica programmata (SENZA EMAIL)');
        // skipEmail=true: NON inviare email nei toggle automatici
        await toggleFinestraScambi(false, true, true);
        return;
      }
    }
    
    // Controlla l'apertura solo se siamo nello stesso giorno dell'apertura programmata
    // e l'orario attuale è tra apertura e chiusura
    if (finestraData.dataApertura && finestraData.oraApertura) {
      const aperturaDateTime = new Date(`${finestraData.dataApertura}T${finestraData.oraApertura}`).getTime();
      
      // Verifica se siamo nel giorno dell'apertura
      const aperturaDate = new Date(finestraData.dataApertura);
      const currentDate = new Date();
      const isSameDay = aperturaDate.toDateString() === currentDate.toDateString();
      
      // Solo se siamo nello stesso giorno e l'orario è arrivato
      if (isSameDay && currentDateTime >= aperturaDateTime && !finestraData.aperta) {
        // Verifica che non sia già passato l'orario di chiusura dello stesso giorno
        if (finestraData.dataChiusura && finestraData.oraChiusura) {
          const chiusuraDateTime = new Date(`${finestraData.dataChiusura}T${finestraData.oraChiusura}`).getTime();
          // Se l'orario di chiusura è già passato, non aprire
          if (currentDateTime >= chiusuraDateTime) {
            return;
          }
        }
        
        console.log('⏰ Attivazione apertura automatica programmata (SENZA EMAIL)');
        // skipEmail=true: NON inviare email nei toggle automatici
        await toggleFinestraScambi(true, true, true);
        return;
      }
    }
  };

  useEffect(() => {
    fetchSquadraUtente();
  }, [fetchSquadraUtente]);

  useEffect(() => {
    if (squadraUtente) {
      const giocatoriSquadraUtente = giocatori.filter(g => g.squadra === squadraUtente.id);
      setGiocatoriUtente(giocatoriSquadraUtente);
    }
    if (squadraSelezionata) {
      const giocatoriSquadraAvversaria = giocatori.filter(g => g.squadra === squadraSelezionata);
      setGiocatoriAvversari(giocatoriSquadraAvversaria);
    }
  }, [squadraUtente, squadraSelezionata, giocatori]);

  const handleSquadraSelezionata = (e) => {
    setSquadraSelezionata(e.target.value);
    setGiocatoriSelezionatiAvversario([]);
    setGiocatoreRichiesto('');
  };

  const formatDate = (date) => {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  // Funzione per gestire il toggle manuale dall'admin con conferme
  const handleAdminToggle = async (nuovoStato) => {
    const azioneText = nuovoStato ? 'aprire' : 'chiudere';
    const azioneTextCaps = nuovoStato ? 'APRIRE' : 'CHIUDERE';
    
    // Prima conferma: sei sicuro?
    const conferma = window.confirm(
      `Sei sicuro di voler ${azioneText.toUpperCase()} la finestra scambi?\n\n` +
      `Questa azione cambier\u00e0 lo stato per tutti gli utenti.`
    );
    
    if (!conferma) {
      // Ripristina lo stato dello switch
      setFinestraScambiAperta(!nuovoStato);
      return;
    }
    
    // Seconda conferma: vuoi inviare l'email?
    const inviaEmail = window.confirm(
      `Finestra scambi verr\u00e0 ${nuovoStato ? 'aperta' : 'chiusa'}.\n\n` +
      `Vuoi inviare una EMAIL di notifica a tutti gli utenti?\n\n` +
      `\u26a0\ufe0f Clicca OK per inviare l'email\n` +
      `\u26a0\ufe0f Clicca Annulla per NON inviare email`
    );
    
    // Esegui il toggle con o senza email in base alla scelta
    await toggleFinestraScambi(nuovoStato, false, !inviaEmail);
  };

  const toggleFinestraScambi = async (nuovoStato, isAutomatic = false, skipEmail = false) => {
    console.log(`Richiesta di cambio stato finestra: ${nuovoStato}, automatico: ${isAutomatic}, skipEmail: ${skipEmail}`);
    
    try {
      const finestraScambiRef = doc(db, 'Impostazioni', 'finestraScambi');
      
      // Leggi lo stato corrente prima di aggiornare
      const finestraDoc = await getDoc(finestraScambiRef);
      const statoCorrente = finestraDoc.exists() ? finestraDoc.data().aperta : null;
      const ultimaEmailInviata = finestraDoc.exists() ? finestraDoc.data().ultimaEmailInviata : null;
      
      // Se lo stato non è cambiato, non fare nulla
      if (statoCorrente === nuovoStato) {
        console.log('Stato già impostato, nessuna azione necessaria');
        setFinestraScambiAperta(nuovoStato);
        return;
      }
      
      // Aggiorna lo stato locale immediatamente
      setFinestraScambiAperta(nuovoStato);
      
      // Aggiorna il database
      await updateDoc(finestraScambiRef, { aperta: nuovoStato });
      
      console.log(`Stato finestra aggiornato nel database: ${nuovoStato}`);
      
      // Controlla se dobbiamo inviare l'email
      let shouldSendEmail = !skipEmail;
      
      // Evita email duplicate: non inviare se l'ultima email è stata inviata meno di 5 minuti fa
      if (shouldSendEmail && ultimaEmailInviata) {
        const now = new Date().getTime();
        const lastEmailTime = new Date(ultimaEmailInviata).getTime();
        const minutesSinceLastEmail = (now - lastEmailTime) / (1000 * 60);
        
        if (minutesSinceLastEmail < 5) {
          console.log(`Email non inviata: ultima email inviata ${minutesSinceLastEmail.toFixed(1)} minuti fa`);
          shouldSendEmail = false;
        }
      }
      
      // Prepara il contenuto dell'email
      const statoText = nuovoStato ? 'aperta' : 'chiusa';
      const automaticText = isAutomatic ? ' automaticamente' : '';
      
      let soggetto, messaggio;
      
      if (nuovoStato) {
        // Finestra aperta
        soggetto = `🚨 MERCATO APERTO! Finestra Scambi ${automaticText ? 'Automaticamente ' : ''}Spalancata! 🚨`;
        messaggio = `🎉 ATTENZIONE FANTASISTI! 🎉

La finestra scambi è stata UFFICIALMENTE APERTA${automaticText}! 

⚡ È ora di scatenare la vostra fantasia manageriale! ⚡
💰 Contrattazioni, trattative e colpi di genio vi aspettano!
🔥 Chi farà l'affare del secolo? Chi si pentirà amaramente?

Il mercato è BOLLENTE e le vostre rose tremano di paura! 
Non perdete tempo: ogni minuto può essere quello decisivo per costruire la squadra dei vostri sogni... o per rovinare tutto! 😈

Che le contrattazioni abbiano inizio! 
Accedete subito alla piattaforma e date il via alla vostra strategia!

In bocca al lupo (e che vinca il migliore)! 🍀
- Il Team FantaVecchio 🏆`;
      } else {
        // Finestra chiusa
        soggetto = `🔒 MERCATO CHIUSO! Finestra Scambi ${automaticText ? 'Automaticamente ' : ''}Serrata! 🔒`;
        messaggio = `😱 STOP ALLE DANZE! 😱

La finestra scambi è stata UFFICIALMENTE CHIUSA${automaticText}!

⏰ Il tempo è scaduto! Non ci sono più trattative possibili!
📊 Ora è tempo di vedere chi ha fatto gli affari migliori...
🤔 Chi ha costruito la rosa perfetta? Chi si morderà le mani per l'occasione persa?

Le rose sono CONGELATE fino alla prossima apertura del mercato!
Non resta che aspettare e vedere all'opera i vostri acquisti... 
Speriamo abbiate scelto bene! 😅

Tutte le richieste in corso rimangono valide e possono ancora essere completate.

Ora rilassatevi e godetevi il campionato! 
(O iniziate già a pianificare la prossima sessione di mercato...) 😏

Buona fortuna a tutti! 🍀
- Il Team FantaVecchio 🏆`;
      }
      
      // Invia email solo se non è skipEmail e shouldSendEmail è true
      if (shouldSendEmail) {
        console.log(`\ud83d\udce7 Invio email per ${statoText} finestra...`);
        await inviaEmailTuttiUtenti(soggetto, messaggio);
        
        // Salva il timestamp dell'invio email nel database
        await updateDoc(finestraScambiRef, { 
          ultimaEmailInviata: new Date().toISOString() 
        });
        
        console.log('\u2705 Email inviata con successo!');
        setModalMessage(`La finestra scambi \u00e8 stata ${statoText}${automaticText} e tutti gli utenti sono stati notificati via email!`);
      } else {
        const motivoSkip = skipEmail ? '(email non richiesta)' : '(email recente)';
        console.log(`\u26a0\ufe0f Email NON inviata ${motivoSkip}`);
        setModalMessage(`La finestra scambi è stata ${statoText}${automaticText}.`);
      }
      
      // Mostra modal solo se richiesto manualmente dall'admin
      if (!isAutomatic) {
        setShowModal(true);
      }
      
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato della finestra scambi:', error);
      setModalMessage('Si è verificato un errore nell\'aggiornamento dello stato della finestra scambi: ' + error.message);
      setShowModal(true);
    }
  };

  const inviaEmailTuttiUtenti = async (soggetto, messaggio) => {
    try {
      console.log('=== INIZIO INVIO EMAIL ===');
      console.log('Soggetto:', soggetto);
      
      // Recupera tutti gli utenti
      const tuttiUtentiSnapshot = await getDocs(collection(db, 'Utenti'));
      const tuttiUtenti = tuttiUtentiSnapshot.docs.map(doc => doc.data());
      
      console.log('Utenti recuperati dal database:', tuttiUtenti.length);
      
      if (tuttiUtenti.length === 0) {
        console.warn('Nessun utente trovato nel database');
        return;
      }
      
      // Filtra solo gli utenti con email valide
      const utentiConEmail = tuttiUtenti.filter(u => u.email && u.email.includes('@'));
      
      console.log('Utenti con email valide:', utentiConEmail.length);
      console.log('Liste email:', utentiConEmail.map(u => u.email));
      
      if (utentiConEmail.length === 0) {
        console.warn('Nessun utente con email valida trovato');
        return;
      }
      
      const [primoUtente, ...altriUtenti] = utentiConEmail;
      const emailParams = {
        to_email: primoUtente.email,
        to_name: primoUtente.nome || 'FantaVecchio',
        from_name: "Sistema FantaVecchio",
        subject: soggetto,
        message: messaggio,
        cc_email: altriUtenti.map(u => u.email).join(', ')
      };

      console.log('Parametri email che saranno inviati:', emailParams);

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams,
        EMAILJS_PUBLIC_KEY
      );
      
      console.log('✅ Email inviata con successo! Risposta:', response);
      console.log('=== FINE INVIO EMAIL ===');
      
    } catch (error) {
      console.error('❌ ERRORE nell\'invio dell\'email:', error);
      console.log('=== ERRORE INVIO EMAIL ===');
      throw error; // Rilancia l'errore per farlo vedere nel modal
    }
  };

  const handleSalvaImpostazioni = async () => {
    try {
      // Validazione degli orari
      if (dataApertura && oraApertura && dataChiusura && oraChiusura) {
        const aperturaDateTime = new Date(`${dataApertura}T${oraApertura}`);
        const chiusuraDateTime = new Date(`${dataChiusura}T${oraChiusura}`);
        
        // Se sono nello stesso giorno, verifica che l'apertura sia prima della chiusura
        if (dataApertura === dataChiusura && aperturaDateTime >= chiusuraDateTime) {
          setModalMessage('Errore: l\'orario di apertura deve essere precedente a quello di chiusura nello stesso giorno!');
          setShowModal(true);
          return;
        }
      }

      const finestraScambiRef = doc(db, 'Impostazioni', 'finestraScambi');
      await updateDoc(finestraScambiRef, {
        dataApertura,
        oraApertura,
        dataChiusura,
        oraChiusura
      });
      setModalMessage('Impostazioni di apertura/chiusura automatica salvate con successo!');
      setShowModal(true);
      setShowImpostazioni(false);
    } catch (error) {
      console.error('Errore nel salvataggio delle impostazioni:', error);
      setModalMessage('Errore nel salvataggio delle impostazioni');
      setShowModal(true);
    }
  };

  const verificaRichiestaDuplicata = async () => {
    if (!squadraUtente || !squadraSelezionata) return false;
    
    if (tipoScambio === 'giocatori') {
      if (giocatoriSelezionatiUtente.length === 0 || giocatoriSelezionatiAvversario.length === 0) return false;
      
      const richiesteRef = collection(db, 'RichiesteScambio');
      const q = query(
        richiesteRef,
        where('squadraRichiedente', '==', squadraUtente.id),
        where('squadraAvversaria', '==', squadraSelezionata),
        where('giocatoriOfferti', '==', giocatoriSelezionatiUtente),
        where('giocatoriRichiesti', '==', giocatoriSelezionatiAvversario),
        where('stato', 'in', ['In attesa', 'Approvata da admin'])
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } else if (tipoScambio === 'crediti') {
      if (!giocatoreRichiesto || !creditiOfferti) return false;
      
      const richiesteRef = collection(db, 'RichiesteScambio');
      const q = query(
        richiesteRef,
        where('squadraRichiedente', '==', squadraUtente.id),
        where('squadraAvversaria', '==', squadraSelezionata),
        where('giocatoreRichiesto', '==', giocatoreRichiesto),
        where('creditiOfferti', '==', Number(creditiOfferti)),
        where('stato', 'in', ['In attesa', 'Approvata da admin'])
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } else if (tipoScambio === 'giocatori_crediti') {
      if (giocatoriSelezionatiUtente.length === 0 || giocatoriSelezionatiAvversario.length === 0) return false;
      
      const richiesteRef = collection(db, 'RichiesteScambio');
      const q = query(
        richiesteRef,
        where('squadraRichiedente', '==', squadraUtente.id),
        where('squadraAvversaria', '==', squadraSelezionata),
        where('giocatoriOfferti', '==', giocatoriSelezionatiUtente),
        where('giocatoriRichiesti', '==', giocatoriSelezionatiAvversario),
        where('creditiOfferti', '==', Number(creditiOfferti) || 0),
        where('stato', 'in', ['In attesa', 'Approvata da admin'])
      );
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    }
    
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!finestraScambiAperta) {
      setModalMessage('La finestra scambi è chiusa. Non è possibile effettuare richieste di scambio al momento.');
      setShowModal(true);
      return;
    }

    if (!squadraUtente || !squadraSelezionata) {
      setModalMessage('Seleziona tutti i campi necessari');
      setShowModal(true);
      return;
    }

    if (tipoScambio === 'giocatori') {
      if (giocatoriSelezionatiUtente.length === 0 || giocatoriSelezionatiAvversario.length === 0) {
        setModalMessage('Seleziona almeno un giocatore da offrire e uno da richiedere');
        setShowModal(true);
        return;
      }
    } else if (tipoScambio === 'crediti') {
      if (!giocatoreRichiesto || !creditiOfferti) {
        setModalMessage('Seleziona un giocatore da richiedere e inserisci i crediti da offrire');
        setShowModal(true);
        return;
      }
      
      const creditiDisponibili = squadraUtente.crediti || 0;
      if (Number(creditiOfferti) > creditiDisponibili) {
        setModalMessage(`Non hai abbastanza crediti. Crediti disponibili: ${creditiDisponibili}, Crediti richiesti: ${creditiOfferti}`);
        setShowModal(true);
        return;
      }
    } else if (tipoScambio === 'giocatori_crediti') {
      if (giocatoriSelezionatiUtente.length === 0 || giocatoriSelezionatiAvversario.length === 0) {
        setModalMessage('Seleziona almeno un giocatore da offrire e uno da richiedere');
        setShowModal(true);
        return;
      }
      
      // Crediti sono opzionali per giocatori_crediti, ma se inseriti devono essere validi
      if (creditiOfferti && Number(creditiOfferti) > 0) {
        const creditiDisponibili = squadraUtente.crediti || 0;
        if (Number(creditiOfferti) > creditiDisponibili) {
          setModalMessage(`Non hai abbastanza crediti. Crediti disponibili: ${creditiDisponibili}, Crediti richiesti: ${creditiOfferti}`);
          setShowModal(true);
          return;
        }
      }
    }

    // Verifica se la richiesta è duplicata
    const isDuplicata = await verificaRichiestaDuplicata();
    if (isDuplicata) {
      setModalMessage('Hai già inviato una richiesta di scambio identica. Non puoi inviarne un\'altra.');
      setShowModal(true);
      return;
    }

    try {
      let richiestaScambio;
      
      if (tipoScambio === 'giocatori') {
        // Scambio giocatori (con crediti opzionali)
        richiestaScambio = {
          squadraRichiedente: squadraUtente.id,
          squadraAvversaria: squadraSelezionata,
          giocatoriOfferti: giocatoriSelezionatiUtente,
          giocatoriRichiesti: giocatoriSelezionatiAvversario,
          creditiOfferti: creditiOfferti ? parseInt(creditiOfferti) : 0, // ✅ CREDITI OPZIONALI
          tipoScambio: 'giocatori',
          stato: 'In attesa',
          dataRichiesta: formatDate(),
          clausola: clausola,
          accettataAdmin: false,
          accettataAvversario: false
        };
      } else {
        // Offerta solo crediti
        richiestaScambio = {
          squadraRichiedente: squadraUtente.id,
          squadraAvversaria: squadraSelezionata,
          giocatoreRichiesto: giocatoreRichiesto,
          creditiOfferti: parseInt(creditiOfferti),
          tipoScambio: 'crediti',
          stato: 'In attesa',
          dataRichiesta: formatDate(),
          clausola: clausola,
          accettataAdmin: false,
          accettataAvversario: false
        };
      }
      
      const docRef = await addDoc(collection(db, 'RichiesteScambio'), richiestaScambio);
      console.log('Richiesta di scambio inviata con successo, ID:', docRef.id);

      // Trova tutti gli admin
      const adminQuery = query(collection(db, 'Utenti'), where('ruolo', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      if (adminSnapshot.empty) {
        throw new Error('Nessun admin trovato');
      }
      const adminEmails = adminSnapshot.docs.map(doc => doc.data().email);
      const [primaryAdminEmail, ...ccAdminEmails] = adminEmails;

      let emailContent = `È stata creata una nuova richiesta di scambio che richiede la tua approvazione come Admin.
          Dettagli della richiesta:
          Squadra richiedente: ${squadraUtente.nome}
          Squadra avversaria: ${squadreAvversarie.find(s => s.id === squadraSelezionata).nome}
          Tipo scambio: ${tipoScambio === 'giocatori' ? 'Giocatori' : 'Crediti'}`;

      if (tipoScambio === 'giocatori') {
        emailContent += `
          Giocatori offerti:
          ${giocatoriSelezionatiUtente.map(id => {
            const giocatore = giocatoriUtente.find(g => g.id === id);
            return `- ${giocatore.nome} (Valore: ${giocatore.valoreAttuale || 'N/A'}€)`;
          }).join('\n')}
          Giocatori richiesti:
          ${giocatoriSelezionatiAvversario.map(id => {
            const giocatore = giocatoriAvversari.find(g => g.id === id);
            return `- ${giocatore.nome} (Valore: ${giocatore.valoreAttuale || 'N/A'}€)`;
          }).join('\n')}`;
        
        // ✅ AGGIUNGI CREDITI SE PRESENTI
        if (creditiOfferti && parseInt(creditiOfferti) > 0) {
          emailContent += `\n          Crediti aggiuntivi offerti: ${creditiOfferti}€`;
        }
      } else {
        const giocatore = giocatoriAvversari.find(g => g.id === giocatoreRichiesto);
        emailContent += `
          Giocatore richiesto: ${giocatore?.nome || 'N/A'} (Valore: ${giocatore?.valoreAttuale || 'N/A'}€)
          Crediti offerti: ${creditiOfferti}€`;
      }

      emailContent += `
          Clausola: ${clausola || 'Nessuna'}
          Per favore, accedi alla piattaforma per approvare o rifiutare questa richiesta.`;

      const emailParams = {
        to_email: primaryAdminEmail,
        from_name: "Sistema FantaVecchio",
        subject: `Nuova Richiesta di Scambio ${tipoScambio === 'giocatori' ? 'Giocatori' : 'Crediti'} da Approvare`,
        message: emailContent,
        cc_email: ccAdminEmails.join(', ')
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams,
        EMAILJS_PUBLIC_KEY
      );
      console.log('Email inviata con successo:', response);

      // Log successo richiesta scambio
      const squadraAvversariaNome = squadreAvversarie.find(s => s.id === squadraSelezionata)?.nome || squadraSelezionata;
      await logAction({
        action: AUDIT_ACTIONS.REQUEST_TRADE,
        userEmail: auth.currentUser?.email || 'unknown',
        userId: auth.currentUser?.uid || 'unknown',
        description: `Richiesta scambio tra ${squadraUtente.nome} e ${squadraAvversariaNome}`,
        details: {
          squadraRichiedente: squadraUtente.nome,
          squadraAvversaria: squadraAvversariaNome,
          tipoScambio: tipoScambio,
          giocatoriOfferti: giocatoriSelezionatiUtente.length || 0,
          giocatoriRichiesti: giocatoriSelezionatiAvversario.length || 0,
          creditiOfferti: creditiOfferti || 0,
        },
        status: 'SUCCESS',
      });

      // Reset form
      setSquadraSelezionata('');
      setGiocatoriSelezionatiUtente([]);
      setGiocatoriSelezionatiAvversario([]);
      setGiocatoreRichiesto('');
      setCreditiOfferti('');
      setClausola('');
      setModalMessage('Richiesta di scambio inviata con successo e notifica inviata agli admin');
      setShowModal(true);
    } catch (error) {
      console.error('Errore nell\'invio della richiesta:', error);
      setModalMessage('Si è verificato un errore nell\'invio della richiesta: ' + error.message);
      setShowModal(true);
      
      // Log errore audit
      await logAction({
        action: AUDIT_ACTIONS.REQUEST_TRADE,
        userEmail: auth.currentUser?.email || 'unknown',
        userId: auth.currentUser?.uid || 'unknown',
        description: `Errore richiesta scambio: ${error.message}`,
        details: { errorMessage: error.message },
        status: 'FAILURE',
      });
      
      // Log errore tecnico
      await captureError(error, {
        errorType: error.message?.includes('email') ? ERROR_TYPES.EMAIL_ERROR : ERROR_TYPES.DATABASE_WRITE_ERROR,
        component: 'RichiestaScambio',
        action: 'Invio Richiesta Scambio',
        severity: SEVERITY.MEDIUM,
        userEmail: auth.currentUser?.email,
        userId: auth.currentUser?.uid,
        additionalInfo: {
          tipoScambio: tipoScambio,
        }
      });
    }
  };

  // Controllo periodico per apertura/chiusura automatica
  // ATTENZIONE: Questo sistema client-side ha limiti perché funziona solo quando
  // qualcuno ha il componente aperto. Per una soluzione completa, servono Cloud Functions.
  useEffect(() => {
    if (!isAdmin) return;
    
    console.log('🔄 Avviato controllo periodico finestra scambi (ogni minuto)');
    
    const intervalId = setInterval(async () => {
      try {
        const finestraScambiDoc = await getDocs(query(collection(db, 'Impostazioni'), where('nome', '==', 'finestraScambi')));
        if (!finestraScambiDoc.empty) {
          const finestraData = finestraScambiDoc.docs[0].data();
          
          // Chiama checkAutomaticToggle che gestisce l'invio email
          await checkAutomaticToggle(finestraData);
          
          // Sincronizza lo stato UI se è cambiato senza nostro intervento
          if (finestraData.aperta !== finestraScambiAperta) {
            console.log('📊 Sincronizzazione stato UI con database');
            setFinestraScambiAperta(finestraData.aperta);
          }
        }
      } catch (error) {
        console.error('❌ Errore nel controllo automatico della finestra scambi:', error);
      }
    }, 60000); // Controlla ogni minuto
    
    return () => {
      console.log('🛑 Fermato controllo periodico finestra scambi');
      clearInterval(intervalId);
    };
  }, [isAdmin, finestraScambiAperta]);

  if (loadingGiocatori) {
    return <div>Caricamento giocatori...</div>;
  }
  if (errorGiocatori) {
    return <div>Errore nel caricamento dei giocatori: {errorGiocatori}</div>;
  }

  return (
    <div className="container mt-5">
      <h2>Richiesta di Scambio</h2>
      
      {isAdmin && (
        <div className="mb-4">
          <div className="d-flex gap-2 mb-3">
            <Form.Check 
              type="switch"
              id="finestraScambiSwitch"
              label="Finestra Scambi Aperta"
              checked={finestraScambiAperta}
              onChange={(e) => handleAdminToggle(e.target.checked)}
            />
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => setShowImpostazioni(!showImpostazioni)}
            >
              ⚙️ Impostazioni Auto
            </Button>
          </div>
          
          <Collapse in={showImpostazioni}>
            <div className="card p-3 mb-3">
              <h5>Impostazioni Apertura/Chiusura Automatica</h5>
              <div className="row">
                <div className="col-md-6">
                  <h6>Apertura Automatica</h6>
                  <div className="mb-2">
                    <label className="form-label">Data Apertura</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dataApertura}
                      onChange={(e) => setDataApertura(e.target.value)}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Ora Apertura</label>
                    <input
                      type="time"
                      className="form-control"
                      value={oraApertura}
                      onChange={(e) => setOraApertura(e.target.value)}
                    />
                  </div>
                </div>
                <div className="col-md-6">
                  <h6>Chiusura Automatica</h6>
                  <div className="mb-2">
                    <label className="form-label">Data Chiusura</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dataChiusura}
                      onChange={(e) => setDataChiusura(e.target.value)}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Ora Chiusura</label>
                    <input
                      type="time"
                      className="form-control"
                      value={oraChiusura}
                      onChange={(e) => setOraChiusura(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <Button variant="success" onClick={handleSalvaImpostazioni}>
                Salva Impostazioni
              </Button>
            </div>
          </Collapse>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Tipo di Scambio:</label>
          <div>
            <Form.Check
              type="radio"
              id="scambioGiocatori"
              name="tipoScambio"
              label="Scambio Giocatori (con crediti opzionali)"
              checked={tipoScambio === 'giocatori'}
              onChange={() => setTipoScambio('giocatori')}
            />
            <Form.Check
              type="radio"
              id="scambioCrediti"
              name="tipoScambio"
              label="Offerta Solo Crediti"
              checked={tipoScambio === 'crediti'}
              onChange={() => setTipoScambio('crediti')}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label">Seleziona Squadra Avversaria:</label>
          <select 
            className="form-select"
            value={squadraSelezionata}
            onChange={handleSquadraSelezionata}
          >
            <option value="">Seleziona una squadra</option>
            {squadreAvversarie.map(squadra => (
              <option key={squadra.id} value={squadra.id}>{squadra.nome}</option>
            ))}
          </select>
        </div>

        {tipoScambio === 'giocatori' ? (
          <>
            <div className="mb-3">
              <label className="form-label">Seleziona i tuoi giocatori da offrire:</label>
              <select 
                className="form-select" 
                multiple
                value={giocatoriSelezionatiUtente}
                onChange={(e) => setGiocatoriSelezionatiUtente(Array.from(e.target.selectedOptions, option => option.value))}
              >
                {giocatoriUtente.map(giocatore => (
                  <option key={giocatore.id} value={giocatore.id}>{giocatore.nome}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">Seleziona i giocatori che vuoi ricevere:</label>
              <select 
                className="form-select"
                multiple
                value={giocatoriSelezionatiAvversario}
                onChange={(e) => setGiocatoriSelezionatiAvversario(Array.from(e.target.selectedOptions, option => option.value))}
              >
                {giocatoriAvversari.map(giocatore => (
                  <option key={giocatore.id} value={giocatore.id}>{giocatore.nome}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">
                Crediti aggiuntivi da offrire (Disponibili: {squadraUtente?.crediti || 0}€):
              </label>
              <input
                type="number"
                className="form-control"
                value={creditiOfferti}
                onChange={(e) => setCreditiOfferti(e.target.value)}
                min="0"
                max={squadraUtente?.crediti || 0}
                placeholder="Inserisci crediti aggiuntivi da offrire (opzionale)"
              />
              <small className="form-text text-muted">
                Puoi aggiungere crediti alla tua offerta per renderla più appetibile
              </small>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3">
              <label className="form-label">Seleziona il giocatore che vuoi acquistare:</label>
              <select 
                className="form-select"
                value={giocatoreRichiesto}
                onChange={(e) => setGiocatoreRichiesto(e.target.value)}
              >
                <option value="">Seleziona un giocatore</option>
                {giocatoriAvversari.map(giocatore => (
                  <option key={giocatore.id} value={giocatore.id}>
                    {giocatore.nome} - Valore: {giocatore.valoreAttuale || 'N/A'}€
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label">
                Crediti da offrire (Disponibili: {squadraUtente?.crediti || 0}€):
              </label>
              <input
                type="number"
                className="form-control"
                value={creditiOfferti}
                onChange={(e) => setCreditiOfferti(e.target.value)}
                min="1"
                max={squadraUtente?.crediti || 0}
                placeholder="Inserisci l'offerta in crediti"
              />
            </div>
          </>
        )}

        <div className="mb-3">
          <label className="form-label">Clausole:</label>
          <textarea 
            className="form-control"
            value={clausola}
            onChange={(e) => setClausola(e.target.value)}
            placeholder="Inserisci eventuali clausole per lo scambio"
          ></textarea>
        </div>
        
        <button type="submit" className="btn btn-primary" disabled={!finestraScambiAperta}>
          {tipoScambio === 'crediti' ? 'Invia Offerta Crediti' : 'Invia Richiesta di Scambio'}
        </button>
      </form>

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

export default RichiestaScambio;