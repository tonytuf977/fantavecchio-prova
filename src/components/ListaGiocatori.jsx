import React, { useEffect, useState } from 'react';
import { db } from '../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';
import './ListaGiocatori.css';
import { useGiocatori } from '../hook/useGiocatori';
import { useSquadre } from '../hook/useSquadre'; // Aggiungiamo l'hook delle squadre

function ListaGiocatori() {
  const { giocatori, loading: giocatoriLoading, error: giocatoriError } = useGiocatori();
  const { squadre, isLoading: squadreLoading } = useSquadre(); // Carichiamo le squadre
  const [filteredGiocatori, setFilteredGiocatori] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchGiocatori = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'Giocatori'));
        const giocatoriList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFilteredGiocatori(giocatoriList);
      } catch (error) {
        console.error("Errore nel recupero dei giocatori: ", error);
      }
      setIsLoading(false);
    };

    fetchGiocatori();
  }, []);

  useEffect(() => {
    const filtered = giocatori.filter((giocatore) =>
      giocatore.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredGiocatori(filtered);
  }, [searchTerm, giocatori]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Funzione per formattare la data nel formato "giorno mese anno"
  const formatDate = (dateString) => {
    const options = { day: 'numeric', month: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('it-IT', options);
  };

  // Funzione per ottenere il nome della squadra dall'ID
  const getNomeSquadra = (squadraId) => {
    if (!squadraId) return 'Svincolato';
    const squadra = squadre.find(s => s.id === squadraId);
    return squadra ? squadra.nome : squadraId; // Fallback all'ID se non trovato
  };

  if (giocatoriLoading || squadreLoading) {
    return <div>Caricamento...</div>;
  }

  if (giocatoriError) {
    return <div>Errore nel caricamento dei giocatori: {giocatoriError}</div>;
  }

  return (
    <div className="lista-giocatori-container" style={{ width: '100%', padding: '10px', margin: '0' }}>
      <h3>Lista Giocatori</h3>
      <div className="search-container">
        <input
          type="text"
          placeholder="Cerca giocatore..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="search-input"
        />
      </div>
      {filteredGiocatori.length > 0 ? (
        <div className="giocatori-table-mobile" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Nome</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Posizione</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Gol</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Presenze</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Valore Attuale</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Media Voto</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Ammonizioni</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Assist</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Autogol</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Espulsioni</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Gol Subiti</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Scadenza</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Valore Iniziale</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Squadra</th>
                <th style={{ ...tableHeaderStyle, backgroundColor: '#0d6efd', color: 'white' }}>Squadra Serie A</th>
              </tr>
            </thead>
            <tbody>
              {filteredGiocatori.map((giocatore) => (
                <tr key={giocatore.id}>
                  <td data-label="Nome" style={tableCellStyle}>{giocatore.nome || 'N/A'}</td>
                  <td data-label="Posizione" style={tableCellStyle}>{giocatore.posizione || 'N/A'}</td>
                  <td data-label="Gol" style={tableCellStyle}>{giocatore.gol || 0}</td>
                  <td data-label="Presenze" style={tableCellStyle}>{giocatore.presenze || 0}</td>
                  <td data-label="Valore Attuale" style={tableCellStyle}>{giocatore.valoreAttuale || 0}</td>
                  <td data-label="Media Voto" style={tableCellStyle}>{giocatore.voto || 'N/A'}</td>
                  <td data-label="Ammonizioni" style={tableCellStyle}>{giocatore.ammonizioni || 0}</td>
                  <td data-label="Assist" style={tableCellStyle}>{giocatore.assist || 0}</td>
                  <td data-label="Autogol" style={tableCellStyle}>{giocatore.autogol || 0}</td>
                  <td data-label="Espulsioni" style={tableCellStyle}>{giocatore.espulsioni || 0}</td>
                  <td data-label="Gol Subiti" style={tableCellStyle}>{giocatore.golSubiti || 0}</td>
                  <td data-label="Scadenza" style={tableCellStyle}>{giocatore.scadenza ? formatDate(giocatore.scadenza) : 'N/A'}</td>
                  <td data-label="Valore Iniziale" style={tableCellStyle}>{giocatore.valoreIniziale || 0}</td>
                  <td data-label="Squadra" style={tableCellStyle}>{getNomeSquadra(giocatore.squadra) || 'Svincolato *'}</td>
                  <td data-label="Squadra Serie A" style={tableCellStyle}>{getNomeSquadra(giocatore.squadraSerieA) || 'Svincolato *'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>Nessun giocatore trovato</div>
      )}
    </div>
  );
}

const tableHeaderStyle = {
  padding: '12px',
  textAlign: 'left',
  borderBottom: '1px solid #ddd',
  color: 'white'
};

const tableCellStyle = {
  padding: '12px',
  borderBottom: '1px solid #ddd',
  color: 'white'
};

export default ListaGiocatori;
