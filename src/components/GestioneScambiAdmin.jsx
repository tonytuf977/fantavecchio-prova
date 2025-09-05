import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { useGiocatori } from '../hook/useGiocatori';
import { useSquadre } from '../hook/useSquadre';
import { Modal, Button, Collapse } from 'react-bootstrap';
import emailjs from 'emailjs-com';

// Valori di EmailJS hardcoded identici a RichiestaScambio
const EMAILJS_SERVICE_ID = 'service_0knpeti';
const EMAILJS_TEMPLATE_ID = 'template_8eoqu2a';
const EMAILJS_PUBLIC_KEY = '1P283n6VVbx-OeBKb';

emailjs.init(EMAILJS_PUBLIC_KEY);

function GestioneScambiAdmin() {
  const [richiesteScambio, setRichiesteScambio] = useState([]);
  const { giocatori, loading: loadingGiocatori } = useGiocatori();
  const { squadre, isLoading: loadingSquadre } = useSquadre();
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  // Nuovi stati per gestione rinnovi
  const [showImpostazioniRinnovi, setShowImpostazioniRinnovi] = useState(false);
  const [dataAperturaRinnovi, setDataAperturaRinnovi] = useState('');
  const [oraAperturaRinnovi, setOraAperturaRinnovi] = useState('');
  const [dataChiusuraRinnovi, setDataChiusuraRinnovi] = useState('');
  const [oraChiusuraRinnovi, setOraChiusuraRinnovi] = useState('');
  const [sessioneRinnoviAperta, setSessioneRinnoviAperta] = useState(false);

  useEffect(() => {
    const fetchRichiesteScambio = async () => {
      const q = query(collection(db, 'RichiesteScambio'), where('stato', '==', 'In attesa'));
      const querySnapshot = await getDocs(q);
      const richieste = await Promise.all(querySnapshot.docs.map(async (doc) => {
        const richiesta = { id: doc.id, ...doc.data() };

        if (richiesta.tipoScambio === 'crediti') {
          // Gestione scambio a crediti
          const giocatoreRichiesto = await getGiocatoreDetails(richiesta.giocatoreRichiesto);
          return {
            ...richiesta,
            giocatoreRichiestoDettagli: giocatoreRichiesto
          };
        } else {
          // Gestione scambio tradizionale a giocatori
          const giocatoriOfferti = await getGiocatoriDetails(richiesta.giocatoriOfferti || []);
          const giocatoriRichiesti = await getGiocatoriDetails(richiesta.giocatoriRichiesti || []);
          return {
            ...richiesta,
            giocatoriOfferti: giocatoriOfferti,
            giocatoriRichiesti: giocatoriRichiesti
          };
        }
      }));

      setRichiesteScambio(richieste);
    };

    fetchRichiesteScambio();
  }, [giocatori]);

  const getGiocatoriDetails = async (giocatoriIds) => {
    if (!giocatori || giocatori.length === 0 || !Array.isArray(giocatoriIds)) {
      return [];
    }
    const details = [];
    for (const id of giocatoriIds) {
      const giocatore = giocatori.find(g => g.id === id);
      if (giocatore) {
        details.push(giocatore);
      }
    }
    return details;
  };

  const getGiocatoreDetails = async (giocatoreId) => {
    if (!giocatori || giocatori.length === 0 || !giocatoreId) {
      return null;
    }
    return giocatori.find(g => g.id === giocatoreId) || null;
  };

  const handleApprova = async (richiesta) => {
    try {
      console.log('Inizio approvazione scambio:', richiesta);

      const richiestaRef = doc(db, 'RichiesteScambio', richiesta.id);
      await updateDoc(richiestaRef, { 
        accettataAdmin: true,
        stato: 'Approvata da admin'
      });

      // Recupero email degli utenti della squadra avversaria
      const utentiRef = collection(db, 'Utenti');
      const q = query(utentiRef, where('idSquadra', '==', richiesta.squadraAvversaria));
      const utentiSnap = await getDocs(q);
      if (utentiSnap.empty) {
        throw new Error('Nessun utente trovato per la squadra avversaria');
      }
      const utentiAvversari = utentiSnap.docs.map(doc => doc.data());
      console.log('Email destinatari:', utentiAvversari.map(u => u.email));

      // Prepara il contenuto dell'email
      let emailContent = `
        Hai una nuova richiesta di scambio approvata dall'admin

        Dettagli dello scambio:
        Squadra richiedente: ${richiesta.squadraRichiedente}
        Tipo scambio: ${richiesta.tipoScambio === 'crediti' ? 'Offerta Crediti' : 'Scambio Giocatori'}
      `;

      if (richiesta.tipoScambio === 'crediti') {
        emailContent += `
        Giocatore richiesto: ${richiesta.giocatoreRichiestoDettagli?.nome || 'N/A'} (Valore: ${richiesta.giocatoreRichiestoDettagli?.valoreAttuale || 'N/A'}€)
        Crediti offerti: ${richiesta.creditiOfferti}€
        
        IMPORTANTE: Se accetti questo scambio, il giocatore dovrà essere rinnovato dalla squadra che lo riceve.
        `;
      } else {
        emailContent += `
        Giocatori offerti:
        ${(richiesta.giocatoriOfferti || []).map(giocatore => 
          `- ${giocatore.nome || 'Sconosciuto'} (Valore: ${giocatore.valoreAttuale || 'N/A'}€)`
        ).join('\n    ')}

        Giocatori richiesti:
        ${(richiesta.giocatoriRichiesti || []).map(giocatore => 
          `- ${giocatore.nome || 'Sconosciuto'} (Valore: ${giocatore.valoreAttuale || 'N/A'}€)`
        ).join('\n    ')}
        
        IMPORTANTE: Se accetti questo scambio, tutti i giocatori dovranno essere rinnovati dalle rispettive nuove squadre.
        `;
      }

      emailContent += `
        Clausola: ${richiesta.clausola || 'Nessuna'}

        Accedi alla piattaforma per accettare o rifiutare lo scambio.
      `;

      // Invia l'email a tutti gli utenti della squadra avversaria
      const [primoUtente, ...altriUtenti] = utentiAvversari;
      const emailParams = {
        to_email: primoUtente.email,
        to_name: primoUtente.nome || 'FantaVecchio App',
        from_name: "FantaVecchio Admin",
        subject: `Richiesta ${richiesta.tipoScambio === 'crediti' ? 'Offerta Crediti' : 'Scambio Giocatori'} Approvata`,
        message: emailContent,
        cc_email: altriUtenti.map(u => u.email).join(', ')
      };

      console.log('Parametri email:', emailParams);

      // Invia l'email utilizzando EmailJS
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams,
        EMAILJS_PUBLIC_KEY
      );

      console.log('Risposta EmailJS:', response);
      setModalMessage('Scambio approvato dall\'admin e notifica inviata agli utenti. In attesa dell\'accettazione dell\'altro utente.');
      setShowModal(true);
      setRichiesteScambio(richiesteScambio.filter(r => r.id !== richiesta.id));
    } catch (error) {
      console.error('Errore nell\'approvazione dello scambio o nell\'invio dell\'email:', error);
      setModalMessage('Si è verificato un errore nell\'approvazione dello scambio o nell\'invio dell\'email: ' + error.message);
      setShowModal(true);
    }
  };

  const handleRifiuta = async (richiestaId) => {
    try {
      await updateDoc(doc(db, 'RichiesteScambio', richiestaId), { stato: 'Rifiutata' });
      setModalMessage('Richiesta di scambio rifiutata');
      setShowModal(true);
      setRichiesteScambio(richiesteScambio.filter(r => r.id !== richiestaId));
    } catch (error) {
      console.error('Errore nel rifiuto della richiesta:', error);
      setModalMessage('Si è verificato un errore nel rifiuto della richiesta: ' + error.message);
      setShowModal(true);
    }
  };

  // Nuovo useEffect per gestire i rinnovi automatici
  useEffect(() => {
    const loadImpostazioniRinnovi = async () => {
      try {
        const rinnoviDoc = await getDocs(query(collection(db, 'Impostazioni'), where('nome', '==', 'sessioneRinnovi')));
        if (!rinnoviDoc.empty) {
          const rinnoviData = rinnoviDoc.docs[0].data();
          setDataAperturaRinnovi(rinnoviData.dataApertura || '');
          setOraAperturaRinnovi(rinnoviData.oraApertura || '');
          setDataChiusuraRinnovi(rinnoviData.dataChiusura || '');
          setOraChiusuraRinnovi(rinnoviData.oraChiusura || '');
          setSessioneRinnoviAperta(rinnoviData.aperta || false);
          
          // La gestione automatica di apertura/chiusura è gestita nel useEffect successivo.
        }
      } catch (error) {
        console.error('Errore nel caricamento delle impostazioni rinnovi:', error);
      }
    };

    loadImpostazioniRinnovi();
  }, []);

  // Aggiungi un useEffect per controllare periodicamente i cambiamenti automatici dei rinnovi
  useEffect(() => {
    const intervalId = setInterval(async () => {
      try {
        const rinnoviDoc = await getDocs(query(collection(db, 'Impostazioni'), where('nome', '==', 'sessioneRinnovi')));
        if (!rinnoviDoc.empty) {
          const rinnoviData = rinnoviDoc.docs[0].data();
          
          // Controlla se è il momento di aprire/chiudere automaticamente
          const now = new Date();
          const currentDateTime = now.getTime();
          
          let needsUpdate = false;
          
          // Controlla prima la chiusura
          if (rinnoviData.dataChiusura && rinnoviData.oraChiusura && rinnoviData.aperta) {
            const chiusuraDateTime = new Date(`${rinnoviData.dataChiusura}T${rinnoviData.oraChiusura}`).getTime();
            if (currentDateTime >= chiusuraDateTime && sessioneRinnoviAperta !== false) {
              console.log('Attivazione chiusura automatica rinnovi...');
              await toggleSessioneRinnovi(false, true);
              needsUpdate = true;
            }
          }
          
          // Controlla l'apertura solo se non abbiamo già fatto la chiusura
          // e solo se siamo nel giorno programmato per l'apertura
          if (!needsUpdate && rinnoviData.dataApertura && rinnoviData.oraApertura && !rinnoviData.aperta) {
            const aperturaDateTime = new Date(`${rinnoviData.dataApertura}T${rinnoviData.oraApertura}`).getTime();
            
            // Verifica se siamo nel giorno dell'apertura
            const aperturaDate = new Date(rinnoviData.dataApertura);
            const currentDate = new Date();
            const isSameDay = aperturaDate.toDateString() === currentDate.toDateString();
            
            if (isSameDay && currentDateTime >= aperturaDateTime && sessioneRinnoviAperta !== true) {
              // Verifica che non sia già passato l'orario di chiusura dello stesso giorno
              let canOpen = true;
              if (rinnoviData.dataChiusura && rinnoviData.oraChiusura) {
                const chiusuraDateTime = new Date(`${rinnoviData.dataChiusura}T${rinnoviData.oraChiusura}`).getTime();
                if (currentDateTime >= chiusuraDateTime) {
                  canOpen = false; // Non aprire se è già passato l'orario di chiusura
                }
              }
              
              if (canOpen) {
                console.log('Attivazione apertura automatica rinnovi...');
                await toggleSessioneRinnovi(true, true);
                needsUpdate = true;
              }
            }
          }
          
          // Se non ci sono stati cambiamenti automatici, sincronizza comunque lo stato
          if (!needsUpdate && rinnoviData.aperta !== sessioneRinnoviAperta) {
            console.log('Sincronizzazione stato sessione rinnovi senza email...');
            setSessioneRinnoviAperta(rinnoviData.aperta);
          }
        }
      } catch (error) {
        console.error('Errore nel controllo automatico della sessione rinnovi:', error);
      }
    }, 60000); // Controlla ogni minuto
    
    return () => clearInterval(intervalId);
  }, [sessioneRinnoviAperta]);

  // Funzione per inviare email sui rinnovi - identica a quella di RichiestaScambio
  const inviaEmailRinnovi = async (soggetto, messaggio) => {
    try {
      console.log('=== INIZIO INVIO EMAIL RINNOVI ===');
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
        from_name: "Sistema FantaVecchio Rinnovi",
        subject: soggetto,
        message: messaggio,
        cc_email: altriUtenti.map(u => u.email).join(', ')
      };

      console.log('Parametri email rinnovi che saranno inviati:', emailParams);

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams,
        EMAILJS_PUBLIC_KEY
      );
      
      console.log('✅ Email rinnovi inviata con successo! Risposta:', response);
      console.log('=== FINE INVIO EMAIL RINNOVI ===');
      
    } catch (error) {
      console.error('❌ ERRORE nell\'invio dell\'email rinnovi:', error);
      console.log('=== ERRORE INVIO EMAIL RINNOVI ===');
      throw error; // Rilancia l'errore per farlo vedere nel modal
    }
  };

  // Toggle per apertura/chiusura sessione rinnovi
  const toggleSessioneRinnovi = async (nuovoStato, isAutomatic = false) => {
    console.log(`Richiesta di cambio stato sessione rinnovi: ${nuovoStato}, automatico: ${isAutomatic}`);
    
    try {
      // Aggiorna lo stato locale immediatamente
      setSessioneRinnoviAperta(nuovoStato);
      
      const rinnoviRef = doc(db, 'Impostazioni', 'sessioneRinnovi');
      
      // Usa setDoc con merge per creare il documento se non esiste
      await setDoc(rinnoviRef, { 
        nome: 'sessioneRinnovi',
        aperta: nuovoStato,
        dataApertura: dataAperturaRinnovi || '',
        oraApertura: oraAperturaRinnovi || '',
        dataChiusura: dataChiusuraRinnovi || '',
        oraChiusura: oraChiusuraRinnovi || ''
      }, { merge: true });
      
      console.log(`Stato sessione rinnovi aggiornato nel database: ${nuovoStato}`);
      
      // Prepara il contenuto dell'email
      const statoText = nuovoStato ? 'aperta' : 'chiusa';
      const automaticText = isAutomatic ? ' automaticamente' : '';
      
      let soggetto, messaggio;
      
      if (nuovoStato) {
        // Sessione rinnovi aperta
        soggetto = `🔄 SESSIONE RINNOVI APERTA! Iniziate i Rinnovi Contratti! 🔄`;
        messaggio = `🎯 ATTENZIONE MANAGER! 🎯

La sessione RINNOVI CONTRATTI è stata UFFICIALMENTE APERTA${automaticText}!

⚡ È ora di rinnovare i vostri giocatori preferiti! ⚡
💰 Contratti, estensioni e decisioni strategiche vi aspettano!
📝 Chi rinnoverà i propri campioni? Chi lascerà scadere i contratti?

🔥 Il tempo è prezioso: ogni giocatore che non rinnovate potrebbe diventare un'occasione per i vostri avversari!

Non perdete l'opportunità di:
✅ Prolungare i contratti dei vostri giocatori migliori
✅ Pianificare il futuro della vostra squadra
✅ Ottimizzare la vostra rosa per la prossima stagione

Inviate un messaggio whatsapp ai presidenti che procederanno ai rinnovi.

Buona fortuna con le vostre scelte strategiche! 🍀
- Il Team FantaVecchio 🏆`;
      } else {
        // Sessione rinnovi chiusa
        soggetto = `🔒 SESSIONE RINNOVI CHIUSA! Contratti Congelati! 🔒`;
        messaggio = `⏰ TEMPO SCADUTO! ⏰

La sessione RINNOVI CONTRATTI è stata UFFICIALMENTE CHIUSA${automaticText}!

🚫 Non è più possibile rinnovare contratti!
📊 Ora è tempo di vedere chi ha gestito meglio i propri rinnovi...
🤔 Chi ha rinnovato i giocatori chiave? Chi si ritroverà con la rosa decimata?

I contratti sono ora CONGELATI fino alla prossima sessione di rinnovi!
Tutti i giocatori non rinnovati potrebbero diventare occasioni di mercato... 💸

📋 Riassunto di ciò che è successo:
- I contratti rinnovati sono ora attivi
- I giocatori non rinnovati potrebbero essere disponibili per trasferimenti
- Le vostre rose sono ora definitive per questa fase

Preparatevi per la prossima fase del campionato!
(E magari iniziate già a pianificare i prossimi rinnovi...) 😏

Buona fortuna con le vostre rose finali! 🍀
- Il Team FantaVecchio 🏆`;
      }
      
      // Invia sempre l'email, indipendentemente da altri controlli
      console.log(`Invio email per ${statoText} sessione rinnovi...`);
      await inviaEmailRinnovi(soggetto, messaggio);
      
      setModalMessage(`La sessione rinnovi è stata ${statoText}${automaticText} e tutti gli utenti sono stati notificati via email! 🎉`);
      setShowModal(true);
      
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato della sessione rinnovi:', error);
      setModalMessage('Si è verificato un errore nell\'aggiornamento dello stato della sessione rinnovi: ' + error.message);
      setShowModal(true);
    }
  };

  // Salva impostazioni rinnovi
  const handleSalvaImpostazioniRinnovi = async () => {
    try {
      if (dataAperturaRinnovi && oraAperturaRinnovi && dataChiusuraRinnovi && oraChiusuraRinnovi) {
        const aperturaDateTime = new Date(`${dataAperturaRinnovi}T${oraAperturaRinnovi}`);
        const chiusuraDateTime = new Date(`${dataChiusuraRinnovi}T${oraChiusuraRinnovi}`);
        
        if (dataAperturaRinnovi === dataChiusuraRinnovi && aperturaDateTime >= chiusuraDateTime) {
          setModalMessage('Errore: l\'orario di apertura deve essere precedente a quello di chiusura nello stesso giorno!');
          setShowModal(true);
          return;
        }
      }

      const rinnoviRef = doc(db, 'Impostazioni', 'sessioneRinnovi');
      
      // Usa setDoc con merge per creare il documento se non esiste
      await setDoc(rinnoviRef, {
        nome: 'sessioneRinnovi',
        dataApertura: dataAperturaRinnovi,
        oraApertura: oraAperturaRinnovi,
        dataChiusura: dataChiusuraRinnovi,
        oraChiusura: oraChiusuraRinnovi,
        aperta: sessioneRinnoviAperta
      }, { merge: true });
      
      setModalMessage('Impostazioni di apertura/chiusura sessione rinnovi salvate con successo!');
      setShowModal(true);
      setShowImpostazioniRinnovi(false);
    } catch (error) {
      console.error('Errore nel salvataggio delle impostazioni rinnovi:', error);
      setModalMessage('Errore nel salvataggio delle impostazioni rinnovi');
      setShowModal(true);
    }
  };

  if (loadingGiocatori || loadingSquadre) {
    return <div>Caricamento dati in corso...</div>;
  }

  return (
    <div className="container mt-5">
      <h2>Gestione pannello Admin</h2>
      
      {/* Nuova sezione per gestione rinnovi */}
      <div className="mb-4">
        <div className="d-flex gap-2 mb-3">
          <Button
            variant="outline-success"
            size="sm"
            onClick={() => setShowImpostazioniRinnovi(!showImpostazioniRinnovi)}
          >
            ⚙️ Gestione Sessione Rinnovi
          </Button>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="sessioneRinnoviSwitch"
              checked={sessioneRinnoviAperta}
              onChange={(e) => toggleSessioneRinnovi(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="sessioneRinnoviSwitch">
              Sessione Rinnovi {sessioneRinnoviAperta ? 'Aperta' : 'Chiusa'}
            </label>
          </div>
        </div>
        
        <Collapse in={showImpostazioniRinnovi}>
          <div className="card p-3 mb-3">
            <h5>Impostazioni Apertura/Chiusura Sessione Rinnovi</h5>
            <div className="row">
              <div className="col-md-6">
                <h6>Apertura Automatica Rinnovi</h6>
                <div className="mb-2">
                  <label className="form-label">Data Apertura</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dataAperturaRinnovi}
                    onChange={(e) => setDataAperturaRinnovi(e.target.value)}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Ora Apertura</label>
                  <input
                    type="time"
                    className="form-control"
                    value={oraAperturaRinnovi}
                    onChange={(e) => setOraAperturaRinnovi(e.target.value)}
                  />
                </div>
              </div>
              <div className="col-md-6">
                <h6>Chiusura Automatica Rinnovi</h6>
                <div className="mb-2">
                  <label className="form-label">Data Chiusura</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dataChiusuraRinnovi}
                    onChange={(e) => setDataChiusuraRinnovi(e.target.value)}
                  />
                </div>
                <div className="mb-2">
                  <label className="form-label">Ora Chiusura</label>
                  <input
                    type="time"
                    className="form-control"
                    value={oraChiusuraRinnovi}
                    onChange={(e) => setOraChiusuraRinnovi(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button variant="success" onClick={handleSalvaImpostazioniRinnovi}>
              Salva Impostazioni Rinnovi
            </Button>
          </div>
        </Collapse>
      </div>

      {/* Sezione esistente per richieste di scambio */}
      {richiesteScambio.map(richiesta => (
        <div key={richiesta.id} className="card mb-3">
          <div className="card-body">
            <h5 className="card-title">
              Richiesta di {richiesta.tipoScambio === 'crediti' ? 'Offerta Crediti' : 'Scambio Giocatori'}
            </h5>
            <p>Da: {richiesta.squadraRichiedente}</p>
            <p>A: {richiesta.squadraAvversaria}</p>
            
            {richiesta.tipoScambio === 'crediti' ? (
              <>
                <p>Giocatore richiesto: {richiesta.giocatoreRichiestoDettagli?.nome || 'Nome non disponibile'} 
                   (Valore: {richiesta.giocatoreRichiestoDettagli?.valoreAttuale || 'N/A'}€)</p>
                <p>Crediti offerti: {richiesta.creditiOfferti}€</p>
              </>
            ) : (
              <>
                <p>Giocatori offerti: 
                  {(richiesta.giocatoriOfferti && richiesta.giocatoriOfferti.length > 0) ? 
                    richiesta.giocatoriOfferti.map(g =>
                      <span key={g.id}> {g.nome || 'Nome non disponibile'} (Valore: {g.valoreAttuale || 'N/A'}€)</span>
                    ).reduce((prev, curr) => [prev, ', ', curr]) : 'Nessuno'}
                </p>
                <p>Giocatori richiesti: 
                  {(richiesta.giocatoriRichiesti && richiesta.giocatoriRichiesti.length > 0) ? 
                    richiesta.giocatoriRichiesti.map(g =>
                      <span key={g.id}> {g.nome || 'Nome non disponibile'} (Valore: {g.valoreAttuale || 'N/A'}€)</span>
                    ).reduce((prev, curr) => [prev, ', ', curr]) : 'Nessuno'}
                </p>
              </>
            )}
            
            <p>Clausola: {richiesta.clausola || 'Nessuna'}</p>
            <button className="btn btn-success me-2" onClick={() => handleApprova(richiesta)}>Approva</button>
            <button className="btn btn-danger" onClick={() => handleRifiuta(richiesta.id)}>Rifiuta</button>
          </div>
        </div>
      ))}

      {/* Modal esistente */}
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

export default GestioneScambiAdmin;