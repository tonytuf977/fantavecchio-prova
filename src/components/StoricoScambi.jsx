import React, { useState, useEffect } from 'react';
import { useStoricoScambi } from '../hook/useStoricoScambi';
import { useUtenti } from '../hook/useUtenti';
import { useSquadre } from '../hook/useSquadre';
import { useGiocatori } from '../hook/useGiocatori';
import { auth, db } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { Modal, Button } from 'react-bootstrap';

function StoricoScambi() {
  const { storicoScambi, loading, error, refreshStoricoScambi } = useStoricoScambi();
  const { utenti, loading: utentiLoading } = useUtenti();
  const { squadre, loading: squadreLoading } = useSquadre();
  const { giocatori, loading: giocatoriLoading } = useGiocatori();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [scambioToDelete, setScambioToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [storicoProcessato, setStoricoProcessato] = useState([]);
  
  // Stati per filtri categoria
  const [categoriaSelezionata, setCategoriaSelezionata] = useState('tutti');
  const [conteggioCategorie, setConteggioCategorie] = useState({
    completati: 0,
    rifiutati: 0,
    inAttesa: 0,
    tutti: 0
  });

  // Autenticazione e controllo admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !utentiLoading) {
      const userRecord = utenti.find(u => u.email === user.email);
      setIsAdmin(userRecord?.ruolo === 'admin');
    } else {
      setIsAdmin(false);
    }
  }, [user, utenti, utentiLoading]);

  // ✅ PROCESSA STORICO SCAMBI: Sostituisce ID con nomi reali
  useEffect(() => {
    if (!loading && !squadreLoading && !giocatoriLoading && storicoScambi.length > 0) {
      const processaStoricoScambi = async () => {
        const storicoConNomi = await Promise.all(storicoScambi.map(async (scambio) => {
          try {
            // Trova nomi squadre
            const squadraRichiedenteNome = squadre.find(s => s.id === scambio.squadraRichiedente)?.nome || scambio.squadraRichiedente;
            const squadraAvversariaNome = squadre.find(s => s.id === scambio.squadraAvversaria)?.nome || scambio.squadraAvversaria;

            let scambioProcessato = {
              ...scambio,
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
            console.error('Errore nel processare scambio:', scambio.id, error);
            return scambio; // Ritorna il scambio originale in caso di errore
          }
        }));

        setStoricoProcessato(storicoConNomi);
        
        // ✅ Calcola conteggi per categorie
        const conteggi = {
          completati: storicoConNomi.filter(s => s.stato === 'Completato').length,
          rifiutati: storicoConNomi.filter(s => s.stato === 'Rifiutata' || s.stato === 'Rifiutato').length,
          inAttesa: storicoConNomi.filter(s => s.stato === 'Approvata da admin').length,
          tutti: storicoConNomi.length
        };
        setConteggioCategorie(conteggi);
      };

      processaStoricoScambi();
    }
  }, [storicoScambi, squadre, giocatori, loading, squadreLoading, giocatoriLoading]);

  // Funzione per eliminare scambio
  const handleDeleteScambio = async () => {
    if (!scambioToDelete || !isAdmin) return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'RichiesteScambio', scambioToDelete.id));
      console.log(`✅ Scambio ${scambioToDelete.id} eliminato con successo`);
      
      // Refresh della lista
      if (refreshStoricoScambi) {
        await refreshStoricoScambi();
      }
      
      setShowDeleteModal(false);
      setScambioToDelete(null);
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione dello scambio:', error);
      alert('Errore nell\'eliminazione dello scambio: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Conferma eliminazione
  const confirmDelete = (scambio) => {
    setScambioToDelete(scambio);
    setShowDeleteModal(true);
  };

  if (loading || utentiLoading || squadreLoading || giocatoriLoading) {
    return <div>Caricamento storico scambi...</div>;
  }
  if (error) return <div>Errore nel caricamento dello storico scambi: {error}</div>;

  // ✅ FILTRO PER CATEGORIA
  const filtraPerCategoria = (scambi) => {
    switch (categoriaSelezionata) {
      case 'completati':
        return scambi.filter(s => s.stato === 'Completato');
      case 'rifiutati':
        return scambi.filter(s => s.stato === 'Rifiutata' || s.stato === 'Rifiutato');
      case 'inAttesa':
        return scambi.filter(s => s.stato === 'Approvata da admin');
      default:
        return scambi; // 'tutti'
    }
  };

  // ✅ ORDINAMENTO MIGLIORATO: Usa storico processato con nomi reali E APPLICA FILTRO
  const storicoFiltrato = filtraPerCategoria(storicoProcessato);
  const storicoScambiOrdinati = [...storicoFiltrato].sort((a, b) => {
    // Priorità: dataScambio > dataRichiesta
    const dataA = a.dataScambio || a.dataRichiesta;
    const dataB = b.dataScambio || b.dataRichiesta;
    
    if (!dataA && !dataB) return 0;
    if (!dataA) return 1; // Metti in fondo quelli senza data
    if (!dataB) return -1;
    
    // Converte le date in timestamp per confronto preciso
    const timestampA = new Date(dataA).getTime();
    const timestampB = new Date(dataB).getTime();
    
    return timestampB - timestampA; // Ordine decrescente (più recenti prima)
  });

  return (
    <div className="container mt-5">
      <h2>Storico Scambi</h2>
      
      {/* ✅ FILTRI PER CATEGORIA */}
      <div className="mb-4">
        <h5>Filtra per categoria:</h5>
        <div className="btn-group" role="group" aria-label="Filtri categoria">
          <button
            type="button"
            className={`btn ${categoriaSelezionata === 'tutti' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setCategoriaSelezionata('tutti')}
          >
            🌍 Tutti ({conteggioCategorie.tutti})
          </button>
          <button
            type="button"
            className={`btn ${categoriaSelezionata === 'completati' ? 'btn-success' : 'btn-outline-success'}`}
            onClick={() => setCategoriaSelezionata('completati')}
          >
            ✅ Completati ({conteggioCategorie.completati})
          </button>
          <button
            type="button"
            className={`btn ${categoriaSelezionata === 'rifiutati' ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => setCategoriaSelezionata('rifiutati')}
          >
            ❌ Rifiutati ({conteggioCategorie.rifiutati})
          </button>
          <button
            type="button"
            className={`btn ${categoriaSelezionata === 'inAttesa' ? 'btn-warning' : 'btn-outline-warning'}`}
            onClick={() => setCategoriaSelezionata('inAttesa')}
          >
            ⏳ In Attesa ({conteggioCategorie.inAttesa})
          </button>
        </div>
      </div>
      {storicoScambiOrdinati.length === 0 ? (
        <p>Nessuno scambio trovato.</p>
      ) : (
        storicoScambiOrdinati.map((scambio, index) => (
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
                  
                  {/* ✅ Badge stato scambio */}
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
                {isAdmin && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => confirmDelete(scambio)}
                    title="Elimina scambio (solo admin)"
                  >
                    🗑️ Elimina
                  </button>
                )}
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
              <p>Stato: {scambio.stato || 'N/A'}</p>
              {scambio.stato === 'Completato' && (
                <p>
                  Data Scambio:{' '}
                  {scambio.dataScambio
                    ? new Date(scambio.dataScambio).toLocaleDateString()
                    : 'Data non disponibile'}
                </p>
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
      )}

      {/* Modal di conferma eliminazione */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Conferma Eliminazione</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Sei sicuro di voler eliminare questo scambio dallo storico?</p>
          {scambioToDelete && (
            <div className="alert alert-warning">
              <strong>Scambio da eliminare:</strong><br/>
              <strong>Data:</strong> {scambioToDelete.dataRichiesta ? new Date(scambioToDelete.dataRichiesta).toLocaleDateString() : 'N/A'}<br/>
              <strong>Tipo:</strong> {scambioToDelete.tipoScambio === 'crediti' ? 'Offerta Crediti' : 'Scambio Giocatori'}<br/>
              <strong>Squadre:</strong> {scambioToDelete.squadraRichiedenteNome || scambioToDelete.squadraRichiedente} ↔ {scambioToDelete.squadraAvversariaNome || scambioToDelete.squadraAvversaria}
            </div>
          )}
          <p className="text-danger">
            <strong>⚠️ Attenzione:</strong> Questa azione non può essere annullata!
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Annulla
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteScambio}
            disabled={isDeleting}
          >
            {isDeleting ? 'Eliminando...' : 'Elimina Definitivamente'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default StoricoScambi;