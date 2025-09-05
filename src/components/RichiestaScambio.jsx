import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase/firebase';
import { collection, addDoc, query, where, getDocs, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useSquadre } from '../hook/useSquadre';
import { useGiocatori } from '../hook/useGiocatori';
import { useUtenti } from '../hook/useUtenti';
import { Modal, Button, Form, Collapse } from 'react-bootstrap';
import emailjs from 'emailjs-com';

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
  const [tipoScambio, setTipoScambio] = useState('giocatori'); // 'giocatori' o 'crediti'
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
          
          // Controlla se è il momento di aprire/chiudere automaticamente
          await checkAutomaticToggle(finestraData);
          
          // Dopo aver controllato i toggle automatici, aggiorna lo stato del button
          // Rileggi i dati aggiornati dal database
          const updatedFinestraDoc = await getDocs(query(collection(db, 'Impostazioni'), where('nome', '==', 'finestraScambi')));
          if (!updatedFinestraDoc.empty) {
            const updatedFinestraData = updatedFinestraDoc.docs[0].data();
            setFinestraScambiAperta(updatedFinestraData.aperta);
          } else {
            setFinestraScambiAperta(finestraData.aperta);
          }
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

  const checkAutomaticToggle = async (finestraData) => {
    const now = new Date();
    const currentDateTime = now.getTime();
    
    // Controlla prima la chiusura, poi l'apertura
    if (finestraData.dataChiusura && finestraData.oraChiusura) {
      const chiusuraDateTime = new Date(`${finestraData.dataChiusura}T${finestraData.oraChiusura}`).getTime();
      if (currentDateTime >= chiusuraDateTime && finestraData.aperta) {
        await toggleFinestraScambi(false, true);
        return; // Esci dopo aver fatto il toggle automatico
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
        
        await toggleFinestraScambi(true, true);
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

  const toggleFinestraScambi = async (nuovoStato, isAutomatic = false) => {
    console.log(`Richiesta di cambio stato finestra: ${nuovoStato}, automatico: ${isAutomatic}`);
    
    try {
      // Aggiorna lo stato locale immediatamente
      setFinestraScambiAperta(nuovoStato);
      
      // Aggiorna il database
      const finestraScambiRef = doc(db, 'Impostazioni', 'finestraScambi');
      await updateDoc(finestraScambiRef, { aperta: nuovoStato });
      
      console.log(`Stato finestra aggiornato nel database: ${nuovoStato}`);
      
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
      
      // Invia sempre l'email, indipendentemente da altri controlli
      console.log(`Invio email per ${statoText} finestra...`);
      await inviaEmailTuttiUtenti(soggetto, messaggio);
      
      setModalMessage(`La finestra scambi è stata ${statoText}${automaticText} e tutti gli utenti sono stati notificati via email!`);
      setShowModal(true);
      
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
    } else {
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
    }
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
    } else {
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
        richiestaScambio = {
          squadraRichiedente: squadraUtente.id,
          squadraAvversaria: squadraSelezionata,
          giocatoriOfferti: giocatoriSelezionatiUtente,
          giocatoriRichiesti: giocatoriSelezionatiAvversario,
          tipoScambio: 'giocatori',
          stato: 'In attesa',
          dataRichiesta: formatDate(),
          clausola: clausola,
          accettataAdmin: false,
          accettataAvversario: false
        };
      } else {
        richiestaScambio = {
          squadraRichiedente: squadraUtente.id,
          squadraAvversaria: squadraSelezionata,
          giocatoreRichiesto: giocatoreRichiesto,
          creditiOfferti: Number(creditiOfferti),
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
    }
  };

  // Aggiungi un useEffect per controllare periodicamente i cambiamenti automatici
  useEffect(() => {
    if (!isAdmin) return;
    
    const intervalId = setInterval(async () => {
      try {
        const finestraScambiDoc = await getDocs(query(collection(db, 'Impostazioni'), where('nome', '==', 'finestraScambi')));
        if (!finestraScambiDoc.empty) {
          const finestraData = finestraScambiDoc.docs[0].data();
          
          // Controlla se è il momento di aprire/chiudere automaticamente
          const now = new Date();
          const currentDateTime = now.getTime();
          
          let needsUpdate = false;
          
          // Controlla prima la chiusura
          if (finestraData.dataChiusura && finestraData.oraChiusura && finestraData.aperta) {
            const chiusuraDateTime = new Date(`${finestraData.dataChiusura}T${finestraData.oraChiusura}`).getTime();
            if (currentDateTime >= chiusuraDateTime && finestraScambiAperta !== false) {
              console.log('Attivazione chiusura automatica...');
              await toggleFinestraScambi(false, true);
              needsUpdate = true;
            }
          }
          
          // Controlla l'apertura solo se non abbiamo già fatto la chiusura
          // e solo se siamo nel giorno programmato per l'apertura
          if (!needsUpdate && finestraData.dataApertura && finestraData.oraApertura && !finestraData.aperta) {
            const aperturaDateTime = new Date(`${finestraData.dataApertura}T${finestraData.oraApertura}`).getTime();
            
            // Verifica se siamo nel giorno dell'apertura
            const aperturaDate = new Date(finestraData.dataApertura);
            const currentDate = new Date();
            const isSameDay = aperturaDate.toDateString() === currentDate.toDateString();
            
            if (isSameDay && currentDateTime >= aperturaDateTime && finestraScambiAperta !== true) {
              // Verifica che non sia già passato l'orario di chiusura dello stesso giorno
              let canOpen = true;
              if (finestraData.dataChiusura && finestraData.oraChiusura) {
                const chiusuraDateTime = new Date(`${finestraData.dataChiusura}T${finestraData.oraChiusura}`).getTime();
                if (currentDateTime >= chiusuraDateTime) {
                  canOpen = false; // Non aprire se è già passato l'orario di chiusura
                }
              }
              
              if (canOpen) {
                console.log('Attivazione apertura automatica...');
                await toggleFinestraScambi(true, true);
                needsUpdate = true;
              }
            }
          }
          
          // Se non ci sono stati cambiamenti automatici, sincronizza comunque lo stato
          if (!needsUpdate && finestraData.aperta !== finestraScambiAperta) {
            console.log('Sincronizzazione stato finestra senza email...');
            setFinestraScambiAperta(finestraData.aperta);
          }
        }
      } catch (error) {
        console.error('Errore nel controllo automatico della finestra scambi:', error);
      }
    }, 60000); // Controlla ogni minuto
    
    return () => clearInterval(intervalId);
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
              onChange={(e) => toggleFinestraScambi(e.target.checked)}
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
              label="Scambio Giocatori"
              checked={tipoScambio === 'giocatori'}
              onChange={() => setTipoScambio('giocatori')}
            />
            <Form.Check
              type="radio"
              id="scambioCrediti"
              name="tipoScambio"
              label="Offerta Crediti"
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
          Invia Richiesta di Scambio
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