import React, { useState, useEffect, useCallback } from 'react';
import { db, auth } from '../firebase/firebase';
import { collection, addDoc, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { useSquadre } from '../hook/useSquadre';
import { useGiocatori } from '../hook/useGiocatori';
import { useUtenti } from '../hook/useUtenti';
import { Modal, Button, Form } from 'react-bootstrap';
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
  const { squadre } = useSquadre();
  const { giocatori, loading: loadingGiocatori, error: errorGiocatori } = useGiocatori();
  const { utenti } = useUtenti();

  useEffect(() => {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }, []);

  const fetchSquadraUtente = useCallback(async () => {
    const user = auth.currentUser;
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
          setFinestraScambiAperta(finestraScambiDoc.docs[0].data().aperta);
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
  };

  const formatDate = (date) => {
    const d = date || new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!finestraScambiAperta) {
      setModalMessage('La finestra scambi è chiusa. Non è possibile effettuare richieste di scambio al momento.');
      setShowModal(true);
      return;
    }
    if (!squadraUtente || !squadraSelezionata || giocatoriSelezionatiUtente.length === 0 || giocatoriSelezionatiAvversario.length === 0) {
      setModalMessage('Seleziona tutti i campi necessari');
      setShowModal(true);
      return;
    }

    try {
      const richiestaScambio = {
        squadraRichiedente: squadraUtente.id,
        squadraAvversaria: squadraSelezionata,
        giocatoriOfferti: giocatoriSelezionatiUtente,
        giocatoriRichiesti: giocatoriSelezionatiAvversario,
        stato: 'In attesa',
        dataRichiesta: formatDate(),
        clausola: clausola,
        accettataAdmin: false,
        accettataAvversario: false
      };

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

      const emailParams = {
        to_email: primaryAdminEmail,
        from_name: "Sistema FantaVecchio",
        subject: "Nuova Richiesta di Scambio da Approvare",
        message: `
          È stata creata una nuova richiesta di scambio che richiede la tua approvazione come Admin.
      
          Dettagli della richiesta:
          Squadra richiedente: ${squadraUtente.nome}
          Squadra avversaria: ${squadreAvversarie.find(s => s.id === squadraSelezionata).nome}
      
          Giocatori offerti:
          ${giocatoriSelezionatiUtente.map(id => {
            const giocatore = giocatoriUtente.find(g => g.id === id);
            return `- ${giocatore.nome} (Valore: ${giocatore.valoreAttuale || 'N/A'}€)`;
          }).join('\n    ')}
      
          Giocatori richiesti:
          ${giocatoriSelezionatiAvversario.map(id => {
            const giocatore = giocatoriAvversari.find(g => g.id === id);
            return `- ${giocatore.nome} (Valore: ${giocatore.valoreAttuale || 'N/A'}€)`;
          }).join('\n    ')}
      
          Clausola: ${clausola || 'Nessuna'}
      
          Per favore, accedi alla piattaforma per approvare o rifiutare questa richiesta.
        `,
        cc_email: ccAdminEmails.join(', ') // Aggiungiamo gli altri admin in CC
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        emailParams,
        EMAILJS_PUBLIC_KEY
      );

      console.log('Email inviata con successo:', response);

      setSquadraSelezionata('');
      setGiocatoriSelezionatiUtente([]);
      setGiocatoriSelezionatiAvversario([]);
      setClausola('');

      setModalMessage('Richiesta di scambio inviata con successo e notifica inviata agli admin');
      setShowModal(true);
    } catch (error) {
      console.error('Errore nell\'invio della richiesta:', error);
      setModalMessage('Si è verificato un errore nell\'invio della richiesta: ' + error.message);
      setShowModal(true);
    }
  };

  const handleFinestraScambiChange = async (e) => {
    const nuovoStato = e.target.checked;
    setFinestraScambiAperta(nuovoStato);
    try {
      const finestraScambiRef = doc(db, 'Impostazioni', 'finestraScambi');
      await setDoc(finestraScambiRef, { nome: 'finestraScambi', aperta: nuovoStato }, { merge: true });
      setModalMessage(`La finestra scambi è stata ${nuovoStato ? 'aperta' : 'chiusa'}`);
      setShowModal(true);
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato della finestra scambi:', error);
      setModalMessage('Si è verificato un errore nell\'aggiornamento dello stato della finestra scambi');
      setShowModal(true);
    }
  };

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
        <Form.Check 
          type="switch"
          id="finestraScambiSwitch"
          label="Finestra Scambi Aperta"
          checked={finestraScambiAperta}
          onChange={handleFinestraScambiChange}
          className="mb-3"
        />
      )}
      <form onSubmit={handleSubmit}>
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