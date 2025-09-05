import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useGiocatori } from '../hook/useGiocatori';
import { useSquadre } from '../hook/useSquadre';
import { Modal, Button } from 'react-bootstrap';
import emailjs from 'emailjs-com';

emailjs.init("1P283n6VVbx-OeBKb");

function GestioneScambiAdmin() {
  const [richiesteScambio, setRichiesteScambio] = useState([]);
  const { giocatori, loading: loadingGiocatori } = useGiocatori();
  const { squadre, isLoading: loadingSquadre } = useSquadre();
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

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
        "service_0knpeti",
        "template_8eoqu2a",
        emailParams,
        "1P283n6VVbx-OeBKb"
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

  if (loadingGiocatori || loadingSquadre) {
    return <div>Caricamento dati in corso...</div>;
  }

  return (
    <div className="container mt-5">
      <h2>Gestione Richieste di Scambio</h2>
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