import React, { useState, useEffect } from 'react';
import { useUtenti } from '../hook/useUtenti';
import { useSquadre } from '../hook/useSquadre';
import { useGiocatori } from '../hook/useGiocatori';
import { auth, db } from '../firebase/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, setDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { Modal, Button } from 'react-bootstrap';
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
  }, [utenti, squadre, loadingUtenti, loadingSquadre]);

  useEffect(() => {
    updateNotificheCount();
  }, [richiesteScambio]);

  const fetchRichiesteScambio = async (squadraId) => {
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
      const squadraRichiedente = await getDoc(doc(db, 'Squadre', data.squadraRichiedente));
      const giocatoriOfferti = await Promise.all(data.giocatoriOfferti.map(id => getDoc(doc(db, 'Giocatori', id))));
      const giocatoriRichiesti = await Promise.all(data.giocatoriRichiesti.map(id => getDoc(doc(db, 'Giocatori', id))));
      return {
        id: docSnapshot.id,
        ...data,
        squadraRichiedenteNome: squadraRichiedente.data().nome,
        giocatoriOfferti: giocatoriOfferti.map(g => ({ id: g.id, ...g.data() })),
        giocatoriRichiesti: giocatoriRichiesti.map(g => ({ id: g.id, ...g.data() }))
      };
    }));
    setRichiesteScambio(richieste);
  };

  const fetchStoricoScambi = async (squadraId) => {
    try {
      const scambiRef = collection(db, 'RichiesteScambio');
      const scambiSnap = await getDocs(scambiRef);
      const scambiList = scambiSnap.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            dataScambio: data.dataScambio || 'Data non disponibile',
            dataRichiesta: data.dataRichiesta || 'Data non disponibile'
          };
        })
        .filter(scambio =>
          scambio.squadraRichiedente === squadraId ||
          scambio.squadraAvversaria === squadraId
        );
      scambiList.sort((a, b) => new Date(b.dataScambio) - new Date(a.dataScambio));
      setStoricoScambi(scambiList);
    } catch (error) {
      console.error('Errore nel recupero dello storico scambi:', error);
    }
  };

  const updateNotificheCount = () => {
    setNotificheCount(richiesteScambio.length);
  };

  const scambiaGiocatori = async (squadraRichiedenteId, squadraAvversariaId, giocatoriOfferti, giocatoriRichiesti) => {
    for (const giocatore of giocatoriOfferti) {
      await aggiornaSquadraGiocatore(giocatore.id, squadraRichiedenteId, squadraAvversariaId);
    }
    for (const giocatore of giocatoriRichiesti) {
      await aggiornaSquadraGiocatore(giocatore.id, squadraAvversariaId, squadraRichiedenteId);
    }
    await aggiornaRosaSquadra(squadraRichiedenteId);
    await aggiornaRosaSquadra(squadraAvversariaId);
  };

  const aggiornaSquadraGiocatore = async (giocatoreId, vecchiaSquadraId, nuovaSquadraId) => {
    const giocatoreRef = doc(db, 'Giocatori', giocatoreId);
    await updateDoc(giocatoreRef, { squadra: nuovaSquadraId });
    const vecchiaSquadraGiocatoreRef = doc(db, 'Squadre', vecchiaSquadraId, 'giocatori', giocatoreId);
    await deleteDoc(vecchiaSquadraGiocatoreRef);
    const giocatoreSnap = await getDoc(giocatoreRef);
    const giocatoreData = giocatoreSnap.data();
    const nuovaSquadraGiocatoreRef = doc(db, 'Squadre', nuovaSquadraId, 'giocatori', giocatoreId);
    await setDoc(nuovaSquadraGiocatoreRef, giocatoreData);
  };

  const aggiornaRosaSquadra = async (squadraId) => {
    const giocatoriRef = collection(db, 'Squadre', squadraId, 'giocatori');
    const snapshot = await getDocs(giocatoriRef);
    const giocatori = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const valoreRosa = giocatori.reduce((acc, g) => acc + (g.valoreAttuale || 0), 0);
    const squadraRef = doc(db, 'Squadre', squadraId);
    await updateDoc(squadraRef, {
      numeroGiocatori: giocatori.length,
      valoreRosa: valoreRosa
    });
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
    const rinnovoRef = collection(db, 'RinnoviContratti');
    await setDoc(doc(rinnovoRef), {
      squadraId: squadraId,
      giocatori: giocatori.map(g => g.id),
      stato: 'In attesa',
      dataCreazione: new Date().toISOString().split('T')[0]
    });
  };

  const handleAccettaScambio = async (richiesta) => {
    if (richiesteElaborate.has(richiesta.id)) {
      console.warn("Richiesta già elaborata:", richiesta.id);
      return;
    }

    try {
      // Aggiungi la richiesta al Set "in elaborazione"
      setRichiesteElaborate(prev => new Set(prev).add(richiesta.id));

      // Verifica lo stato della richiesta nel database
      const richiestaRef = doc(db, 'RichiesteScambio', richiesta.id);
      const richiestaSnap = await getDoc(richiestaRef);

      if (!richiestaSnap.exists()) {
        console.warn("Richiesta di scambio non trovata:", richiesta.id);
        alert("La richiesta di scambio non è più disponibile.");
        return;
      }

      const datiRichiesta = richiestaSnap.data();
      if (datiRichiesta.stato === 'Completato') {
        console.warn("Lo scambio è già stato completato:", richiesta.id);
        alert("Questo scambio è già stato completato.");
        return;
      }

      // Procedi con l'accettazione dello scambio
      await updateDoc(richiestaRef, {
        stato: 'Completato',
        accettataAvversario: true,
        dataScambio: new Date().toISOString().split('T')[0]
      });

      await scambiaGiocatori(
        richiesta.squadraRichiedente,
        richiesta.squadraAvversaria,
        richiesta.giocatoriOfferti,
        richiesta.giocatoriRichiesti
      );

      await creaRichiestaRinnovo(richiesta.squadraRichiedente, richiesta.giocatoriRichiesti);
      await creaRichiestaRinnovo(richiesta.squadraAvversaria, richiesta.giocatoriOfferti);

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

  if (loadingUtenti || loadingSquadre || loadingGiocatori) {
    return <div>Caricamento...</div>;
  }
  if (!utenteCorrente) {
    return <div>Utente non trovato.</div>;
  }

  return (
    <div className="container mt-5">
      <h2>Profilo Utente</h2>
      <p><strong>Email:</strong> {utenteCorrente.email}</p>
      <p><strong>Ruolo:</strong> {utenteCorrente.ruolo}</p>
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
              <h5 className="card-title">Richiesta di Scambio da {richiesta.squadraRichiedenteNome}</h5>
              <p><strong>Giocatori offerti:</strong></p>
              <ul>
                {richiesta.giocatoriOfferti.map(g => (
                  <li key={g.id}>{g.nome} (Valore attuale: {g.valoreAttuale || 'N/A'}€)</li>
                ))}
              </ul>
              <p><strong>Giocatori richiesti:</strong></p>
              <ul>
                {richiesta.giocatoriRichiesti.map(g => (
                  <li key={g.id}>{g.nome} (Valore attuale: {g.valoreAttuale || 'N/A'}€)</li>
                ))}
              </ul>
              {richiesta.clausola && <p><strong>Clausola:</strong> {richiesta.clausola}</p>}
              <button
                className="btn btn-success me-2"
                onClick={() => handleAccettaScambio(richiesta)}
              >
                Accetta
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleRifiutaScambio(richiesta.id)}
              >
                Rifiuta
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
              <h5 className="card-title">Data Proposta: {new Date(scambio.dataRichiesta).toLocaleDateString()}</h5>
              <p>Squadra Richiedente: {scambio.squadraRichiedente}</p>
              <p>Squadra Avversaria: {scambio.squadraAvversaria}</p>
              <div>
                <strong>Giocatori Offerti:</strong>
                <ul>
                  {Array.isArray(scambio.giocatoriOfferti) && scambio.giocatoriOfferti.length > 0 ? (
                    scambio.giocatoriOfferti.map((giocatore, idx) => (
                      <li key={idx}>{giocatore}</li>
                    ))
                  ) : (
                    <li>Nessun giocatore offerto</li>
                  )}
                </ul>
              </div>
              <div>
                <strong>Giocatori Richiesti:</strong>
                <ul>
                  {Array.isArray(scambio.giocatoriRichiesti) && scambio.giocatoriRichiesti.length > 0 ? (
                    scambio.giocatoriRichiesti.map((giocatore, idx) => (
                      <li key={idx}>{giocatore}</li>
                    ))
                  ) : (
                    <li>Nessun giocatore richiesto</li>
                  )}
                </ul>
              </div>
              <p>Stato: {scambio.stato}</p>
              {scambio.stato === 'Completato' && (
                <p>Data Scambio: {new Date(scambio.dataScambio).toLocaleDateString()}</p>
              )}
              {scambio.clausola && <p><strong>Clausola:</strong> {scambio.clausola}</p>}
              {scambio.valoriGiocatori && (
                <div>
                  <strong>Valori Giocatori:</strong>
                  <ul>
                    {Object.entries(scambio.valoriGiocatori).map(([giocatoreId, valore]) => (
                      <li key={giocatoreId}>{giocatoreId}: {valore} €</li>
                    ))}
                  </ul>
                </div>
              )}
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