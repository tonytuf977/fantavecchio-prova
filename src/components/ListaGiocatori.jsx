import React, { useEffect, useState } from 'react';
import { db } from '../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';
import './ListaGiocatori.css';

function ListaGiocatori() {
  const [giocatori, setGiocatori] = useState([]);
  const [filteredGiocatori, setFilteredGiocatori] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchGiocatori = async () => {
      setIsLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'Giocatori'));
        const giocatoriList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGiocatori(giocatoriList);
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

  if (isLoading) return <div>Caricamento giocatori...</div>;

  return (
    <div style={{ width: '100%', padding: '0', margin: '0', overflowX: 'auto' }}>
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
                <td style={tableCellStyle}>{giocatore.nome || 'N/A'}</td>
                <td style={tableCellStyle}>{giocatore.posizione || 'N/A'}</td>
                <td style={tableCellStyle}>{giocatore.gol || 0}</td>
                <td style={tableCellStyle}>{giocatore.presenze || 0}</td>
                <td style={tableCellStyle}>{giocatore.valoreAttuale || 0}</td>
                <td style={tableCellStyle}>{giocatore.voto || 'N/A'}</td>
                <td style={tableCellStyle}>{giocatore.ammonizioni || 0}</td>
                <td style={tableCellStyle}>{giocatore.assist || 0}</td>
                <td style={tableCellStyle}>{giocatore.autogol || 0}</td>
                <td style={tableCellStyle}>{giocatore.espulsioni || 0}</td>
                <td style={tableCellStyle}>{giocatore.golSubiti || 0}</td>
                <td style={tableCellStyle}>{giocatore.scadenza ? formatDate(giocatore.scadenza) : 'N/A'}</td>
                <td style={tableCellStyle}>{giocatore.valoreIniziale || 0}</td>
                <td style={tableCellStyle}>{giocatore.squadra || 'Svincolato *'}</td>
                <td style={tableCellStyle}>{giocatore.squadraSerieA || 'Svincolato *'}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
