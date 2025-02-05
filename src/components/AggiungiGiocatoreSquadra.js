import React, { useState, useEffect } from 'react';
import { useGiocatori } from '../hook/useGiocatori';
import { useSquadre } from '../hook/useSquadre';
import { db } from '../firebase/firebase';
import { collection, getDocs, query, where, doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Modal, Button } from 'react-bootstrap';

function AggiungiGiocatoreASquadra() {
  const [giocatoreNome, setGiocatoreNome] = useState('');
  const [squadraId, setSquadraId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredGiocatori, setFilteredGiocatori] = useState([]);
  const { giocatori } = useGiocatori();
  const { squadre } = useSquadre();
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  useEffect(() => {
    const filtered = giocatori.filter(g => 
      g.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredGiocatori(filtered);
  }, [searchTerm, giocatori]);

  const aggiungiGiocatoreASquadra = async (giocatoreNome, squadraId) => {
    try {
      console.log(`Tentativo di aggiungere giocatore ${giocatoreNome} alla squadra ${squadraId}`);
      
      const giocatoriRef = collection(db, 'Giocatori');
      const giocatoreQuery = query(giocatoriRef, where('nome', '==', giocatoreNome));
      const giocatoreSnapshot = await getDocs(giocatoreQuery);
      
      if (giocatoreSnapshot.empty) {
        throw new Error('Giocatore non trovato');
      }
      
      console.log('Giocatore trovato:', giocatoreNome);
      const giocatoreDoc = giocatoreSnapshot.docs[0];
      const giocatoreData = giocatoreDoc.data();
      
      const squadraRef = doc(db, 'Squadre', squadraId);
      const squadraSnap = await getDoc(squadraRef);
      
      if (!squadraSnap.exists()) {
        throw new Error('Squadra non trovata');
      }
      console.log('Squadra trovata:', squadraSnap.data());
      
      const squadreRef = collection(db, 'Squadre');
      const squadreSnapshot = await getDocs(squadreRef);
      for (const squadraDoc of squadreSnapshot.docs) {
        const giocatoreRef = doc(db, `Squadre/${squadraDoc.id}/giocatori`, giocatoreNome);
        const giocatoreSnap = await getDoc(giocatoreRef);
        if (giocatoreSnap.exists()) {
          await deleteDoc(giocatoreRef);
          console.log(`Giocatore rimosso dalla squadra ${squadraDoc.id}`);
        }
      }
      
      const nuovoGiocatoreRef = doc(db, `Squadre/${squadraId}/giocatori`, giocatoreNome);
      await setDoc(nuovoGiocatoreRef, giocatoreData);
      console.log('Giocatore aggiunto alla sottocollezione della squadra con successo');

      // Update the squadra field in the Giocatori collection
      await updateDoc(giocatoreDoc.ref, {
        squadra: squadraSnap.data().nome // Assuming the squadra document has a 'nome' field
      });
      console.log('Campo squadra aggiornato nella collezione Giocatori');
      
      setModalMessage('Giocatore aggiunto alla squadra e aggiornato con successo');
      setShowModal(true);
     
    } catch (error) {
      console.error("Errore durante l'aggiunta del giocatore alla squadra:", error);
      setModalMessage(`Errore durante l'aggiunta del giocatore alla squadra: ${error.message}`);
      setShowModal(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (giocatoreNome && squadraId) {
      aggiungiGiocatoreASquadra(giocatoreNome, squadraId);
    } else {
      setModalMessage("Seleziona sia un giocatore che una squadra");
      setShowModal(true);
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="mb-4">Aggiungi Giocatore a Squadra</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="giocatoreSearch" className="form-label">Cerca Giocatore</label>
          <input
            type="text"
            className="form-control"
            id="giocatoreSearch"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Inserisci il nome del giocatore"
          />
        </div>
        <div className="mb-3">
          <label htmlFor="giocatoreSelect" className="form-label">Seleziona Giocatore</label>
          <select
            className="form-select"
            id="giocatoreSelect"
            value={giocatoreNome}
            onChange={(e) => setGiocatoreNome(e.target.value)}
            required
          >
            <option value="">Seleziona Giocatore</option>
            {filteredGiocatori.map((g) => (
              <option key={g.id} value={g.nome}>{g.nome}</option>
            ))}
          </select>
        </div>
        <div className="mb-3">
          <label htmlFor="squadraSelect" className="form-label">Seleziona Squadra</label>
          <select
            className="form-select"
            id="squadraSelect"
            value={squadraId}
            onChange={(e) => setSquadraId(e.target.value)}
            required
          >
            <option value="">Seleziona Squadra</option>
            {squadre.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">Aggiungi</button>
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

export default AggiungiGiocatoreASquadra;