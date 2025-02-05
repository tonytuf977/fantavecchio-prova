import React, { useState } from 'react';
import { useSquadre } from '../hook/useSquadre';
import { useUtenti } from '../hook/useUtenti';
import { db } from '../firebase/firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { Modal, Button } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

function AssociaSquadreUtenti() {
  const { squadre, fetchSquadre } = useSquadre();
  const { utenti, loading, error, fetchUtenti } = useUtenti();
  const [selectedSquadra, setSelectedSquadra] = useState('');
  const [selectedUtente, setSelectedUtente] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const handleAssociazione = async () => {
    if (!selectedSquadra || !selectedUtente) {
      setModalMessage('Seleziona sia una squadra che un utente');
      setShowModal(true);
      return;
    }

    try {
      console.log(`Tentativo di associare: Squadra ID ${selectedSquadra}, Utente ID ${selectedUtente}`);

      const squadraRef = doc(db, 'Squadre', selectedSquadra);
      const squadraSnap = await getDoc(squadraRef);
      if (!squadraSnap.exists()) {
        throw new Error("Squadra non trovata");
      }
      const squadraData = squadraSnap.data();

      const utenteRef = doc(db, 'Utenti', selectedUtente);
      const utenteSnap = await getDoc(utenteRef);
      const utenteData = utenteSnap.exists() ? utenteSnap.data() : null;

      if (utenteData && utenteData.idSquadra && utenteData.idSquadra !== selectedSquadra) {
        throw new Error("L'utente è già associato a un'altra squadra");
      }

      // Aggiorna o crea il documento utente
      if (utenteSnap.exists()) {
        await updateDoc(utenteRef, { idSquadra: selectedSquadra });
      } else {
        const utenteSelezionato = utenti.find(u => u.id === selectedUtente);
        if (!utenteSelezionato) {
          throw new Error("Dati utente non trovati");
        }
        await setDoc(utenteRef, {
          email: utenteSelezionato.email,
          id: selectedUtente,
          ruolo: utenteSelezionato.ruolo || 'user',
          idSquadra: selectedSquadra
        });
      }

      // Aggiorna la squadra
      const utentiSquadra = squadraData.utenti || [];
      if (!utentiSquadra.includes(selectedUtente)) {
        utentiSquadra.push(selectedUtente);
        await updateDoc(squadraRef, { utenti: utentiSquadra });
      }

      console.log('Associazione completata con successo');
      setModalMessage('Associazione completata con successo');
      setShowModal(true);
      setSelectedSquadra('');
      setSelectedUtente('');

      await fetchUtenti();
      await fetchSquadre();
    } catch (error) {
      console.error("Errore durante l'associazione:", error);
      setModalMessage("Errore durante l'associazione: " + error.message);
      setShowModal(true);
    }
  };

  if (loading) {
    return <div className="text-center mt-5">Caricamento in corso...</div>;
  }

  if (error) {
    return <div className="alert alert-danger mt-5">{error}</div>;
  }

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Associa Squadre a Utenti</h2>
      <div className="row">
        <div className="col-md-6 mb-3">
          <select 
            className="form-select"
            value={selectedSquadra}
            onChange={(e) => setSelectedSquadra(e.target.value)}
          >
            <option value="">Seleziona una squadra</option>
            {squadre.map(squadra => (
              <option key={squadra.id} value={squadra.id}>{squadra.nome}</option>
            ))}
          </select>
        </div>
        <div className="col-md-6 mb-3">
          <select 
            className="form-select"
            value={selectedUtente}
            onChange={(e) => setSelectedUtente(e.target.value)}
          >
            <option value="">Seleziona un utente</option>
            {utenti.map(utente => (
              <option key={utente.id} value={utente.id}>{utente.email}</option>
            ))}
          </select>
        </div>
      </div>
      <button className="btn btn-primary" onClick={handleAssociazione}>Associa</button>

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

      <div className="mt-4">
        <h3>Debug Info:</h3>
        <p>Numero di squadre: {squadre.length}</p>
        <p>Numero di utenti: {utenti.length}</p>
      </div>
    </div>
  );
}

export default AssociaSquadreUtenti;