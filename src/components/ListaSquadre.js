import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useSquadre } from '../hook/useSquadre';
import './ListaSquadre.css';
import * as XLSX from 'xlsx';

function ListaSquadre() {
  const { squadre, setSquadre, isLoading: squadreLoading, error: squadreError } = useSquadre();
  const [selectedSquadra, setSelectedSquadra] = useState(null);
  const [giocatori, setGiocatori] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filters, setFilters] = useState({});
  const [crediti, setCrediti] = useState('');
  const [rinnoviPendenti, setRinnoviPendenti] = useState({});
  const [modifiedPlayers, setModifiedPlayers] = useState({});

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const fetchCurrentUser = async () => {
          try {
            const utentiRef = collection(db, 'Utenti');
            const utentiSnap = await getDocs(utentiRef);
            const utentiList = utentiSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const currentUserData = utentiList.find(u => u.email === user.email);
            setCurrentUser(currentUserData);
          } catch (err) {
            console.error("Errore nel recupero dell'utente corrente:", err);
          }
        };

        fetchCurrentUser();
      } else {
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchRinnoviPendenti = useCallback(async () => {
    if (!selectedSquadra) return;
    
    try {
      const rinnoviRef = collection(db, 'RinnoviContratti');
      const q = query(rinnoviRef, 
        where('squadraId', '==', selectedSquadra.id),
        where('stato', '==', 'In attesa')
      );
      const querySnapshot = await getDocs(q);
      const rinnoviMap = {};
      querySnapshot.forEach(doc => {
        const rinnovoData = doc.data();
        rinnovoData.giocatori.forEach(giocatoreId => {
          rinnoviMap[giocatoreId] = true;
        });
      });
      console.log("Rinnovi pendenti:", rinnoviMap);
      setRinnoviPendenti(rinnoviMap);
    } catch (error) {
      console.error("Errore nel recupero dei rinnovi pendenti:", error);
    }
  }, [selectedSquadra]);

  useEffect(() => {
    if (selectedSquadra) {
      const fetchGiocatori = async () => {
        setIsLoading(true);
        try {
          const giocatoriRef = collection(db, `Squadre/${selectedSquadra.id}/giocatori`);
          const giocatoriSnap = await getDocs(giocatoriRef);
          const giocatoriList = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setGiocatori(giocatoriList);

          await updateValoreRosa(selectedSquadra.id);
          setFilters(giocatoriList.reduce((acc, giocatore) => {
            acc[giocatore.id] = giocatore.currentFilter || null;
            return acc;
          }, {}));
          setCrediti(selectedSquadra.crediti || '');
          await fetchRinnoviPendenti();
        } catch (err) {
          console.error("Errore nel recupero dei giocatori:", err);
          setError("Errore nel caricamento dei giocatori");
        } finally {
          setIsLoading(false);
        }
      };

      fetchGiocatori();
    }
  }, [selectedSquadra, fetchRinnoviPendenti]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (selectedSquadra) {
        fetchRinnoviPendenti();
      }
    }, 5000); // Aggiorna ogni 5 secondi

    return () => clearInterval(intervalId);
  }, [selectedSquadra, fetchRinnoviPendenti]);

  const updateValoreRosa = async (squadraId) => {
    try {
      const giocatoriRef = collection(db, `Squadre/${squadraId}/giocatori`);
      const giocatoriSnap = await getDocs(giocatoriRef);
      const giocatoriList = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const valoreTotaleRosa = giocatoriList.reduce((acc, giocatore) => acc + (parseFloat(giocatore.valoreAttuale) || 0), 0);

      const squadraRef = doc(db, 'Squadre', squadraId);
      await setDoc(squadraRef, { valoreRosa: valoreTotaleRosa, giocatori: giocatoriList.length }, { merge: true });
    } catch (err) {
      console.error("Errore nell'aggiornamento del valore della rosa:", err);
    }
  };

  const handleSquadraClick = (squadra) => {
    setSelectedSquadra(squadra);
  };

  const handleEdit = (giocatoreId, field, value) => {
    setGiocatori(prevGiocatori =>
      prevGiocatori.map(giocatore =>
        giocatore.id === giocatoreId ? { ...giocatore, [field]: value } : giocatore
      )
    );
    setModifiedPlayers(prev => ({
      ...prev,
      [giocatoreId]: { ...(prev[giocatoreId] || {}), [field]: value }
    }));
  };

  const handleUpdateCrediti = async () => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }
  
    try {
      const squadraRef = doc(db, 'Squadre', selectedSquadra.id);
      const newCrediti = Number(crediti) || 0;
      await setDoc(squadraRef, { crediti: newCrediti }, { merge: true });
      
      // Update the local state
      setSelectedSquadra(prev => ({ ...prev, crediti: newCrediti }));
      
      // Update the squadre array locally
      const updatedSquadre = squadre.map(squadra => 
        squadra.id === selectedSquadra.id ? { ...squadra, crediti: newCrediti } : squadra
      );
      // Instead of using setSquadre, we'll update the local state
      // This won't persist across component remounts, but it will work for the current session
      setGiocatori(prevGiocatori => {
        const updatedSquadra = updatedSquadre.find(s => s.id === selectedSquadra.id);
        return prevGiocatori.map(giocatore => ({
          ...giocatore,
          squadraCrediti: updatedSquadra.crediti
        }));
      });
  
      alert("Crediti aggiornati con successo!");
    } catch (err) {
      console.error("Errore nell'aggiornamento dei crediti:", err);
      alert(`Errore nell'aggiornamento dei crediti: ${err.message}`);
    }
  };
  const applyFilter = (giocatore, filter) => {
    const baseDate = new Date(giocatore.dataPartenza || giocatore.scadenza);
    const baseValueIniziale = parseFloat(giocatore.valoreInizialeOriginale || giocatore.valoreIniziale);
    const baseValueAttuale = parseFloat(giocatore.valoreAttualeOriginale || giocatore.valoreAttuale);
    let newDate = new Date(baseDate);
    let newValueIniziale = baseValueIniziale;
    let newValueAttuale = baseValueAttuale;

    const calculateIncrease = (value, percentage) => {
      return value * percentage;
    };

    switch (filter) {
      case '+6':
        newDate.setMonth(newDate.getMonth() + 6);
        newValueIniziale += calculateIncrease(baseValueAttuale, 0.25);
        break;
      case '+12':
        newDate.setMonth(newDate.getMonth() + 12);
        newValueIniziale += calculateIncrease(baseValueAttuale, 0.50);
        break;
      case '+18':
        newDate.setMonth(newDate.getMonth() + 18);
        newValueIniziale += calculateIncrease(baseValueAttuale, 0.75);
        break;
      default:
        return giocatore;
    }

    newValueIniziale = Math.ceil(newValueIniziale);
    newValueAttuale = newValueIniziale;
    newValueAttuale += 0.4 * giocatore.presenze;
    newValueAttuale += 1 * giocatore.gol;
    newValueAttuale += 0.5 * giocatore.assist;
    newValueAttuale -= 0.5 * giocatore.ammonizioni;
    newValueAttuale -= 1 * giocatore.espulsioni;

    if (giocatore.posizione === 'P') {
      const mediaVotoEffect = (giocatore.voto - 6) * 50;
      newValueAttuale += mediaVotoEffect;
    }

    if (newValueAttuale < newValueIniziale) {
      newValueAttuale = newValueIniziale;
    }

    newValueAttuale = Math.ceil(newValueAttuale);

    return {
      ...giocatore,
      valoreIniziale: newValueIniziale.toFixed(2),
      valoreAttuale: newValueAttuale.toFixed(2),
      scadenza: newDate.toISOString().split('T')[0],
      currentFilter: filter,
      valoreInizialeOriginale: baseValueIniziale,
      valoreAttualeOriginale: baseValueAttuale,
      dataPartenza: baseDate.toISOString().split('T')[0]
    };
  };

const getMesiRimanenti = (scadenza) => {
    if (!scadenza) return null;
    const oggi = new Date();
    const fine = new Date(scadenza);
    const anni = fine.getFullYear() - oggi.getFullYear();
    const mesi = fine.getMonth() - oggi.getMonth();
    return anni * 12 + mesi;
  };

  const isSerieA = (giocatore) => {
    return giocatore.squadraSerieA && giocatore.squadraSerieA !== 'Svincolato *';
  };

  const handleApplyFilter = (id, filter) => {
    setGiocatori(prev => prev.map(g => {
      if (g.id !== id || !isSerieA(g)) return g; // applica solo se Serie A
      const newDate = new Date(g.scadenza || new Date());
      if (filter === '+6') newDate.setMonth(newDate.getMonth() + 6);
      if (filter === '+12') newDate.setMonth(newDate.getMonth() + 12);
      if (filter === '+18') newDate.setMonth(newDate.getMonth() + 18);
      return { ...g, scadenza: newDate.toISOString().split('T')[0] };
    }));
  };
  const handleSaveAll = async () => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }

    try {
      for (const [giocatoreId, modifications] of Object.entries(modifiedPlayers)) {
        const giocatore = giocatori.find(g => g.id === giocatoreId);
        if (!giocatore) continue;

        const updatedGiocatore = { ...giocatore, ...modifications };

        const giocatoreDati = {
          valoreAttuale: Number(updatedGiocatore.valoreAttuale) || 0,
          valoreIniziale: Number(updatedGiocatore.valoreIniziale) || 0,
          valoreInizialeOriginale: Number(updatedGiocatore.valoreInizialeOriginale) || Number(updatedGiocatore.valoreIniziale) || 0,
          valoreAttualeOriginale: Number(updatedGiocatore.valoreAttualeOriginale) || Number(updatedGiocatore.valoreAttuale) || 0,
          scadenza: updatedGiocatore.scadenza || null,
          dataPartenza: updatedGiocatore.dataPartenza || new Date().toISOString().split('T')[0],
          nome: updatedGiocatore.nome || '',
          posizione: updatedGiocatore.posizione || '',
          gol: Number(updatedGiocatore.gol) || 0,
          presenze: Number(updatedGiocatore.presenze) || 0,
          ammonizioni: Number(updatedGiocatore.ammonizioni) || 0,
          assist: Number(updatedGiocatore.assist) || 0,
          autogol: Number(updatedGiocatore.autogol) || 0,
          espulsioni: Number(updatedGiocatore.espulsioni) || 0,
          golSubiti: Number(updatedGiocatore.golSubiti) || 0,
          voto: Number(updatedGiocatore.voto) || 0,
          currentFilter: updatedGiocatore.currentFilter || null,
          squadra: selectedSquadra.nome
        };

        const giocatoreSquadraRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
        await setDoc(giocatoreSquadraRef, giocatoreDati, { merge: true });

        const giocatoreRef = doc(db, 'Giocatori', giocatoreId);
        await setDoc(giocatoreRef, giocatoreDati, { merge: true });
      }

      await updateValoreRosa(selectedSquadra.id);
      alert("Tutti i giocatori modificati sono stati aggiornati con successo!");
      setModifiedPlayers({});
    } catch (err) {
      console.error("Errore nell'aggiornamento dei giocatori:", err);
      alert(`Errore nell'aggiornamento dei giocatori: ${err.message}`);
    }
  };

  const handleDelete = async (giocatoreId) => {
    if (!selectedSquadra) {
      alert("Nessuna squadra selezionata");
      return;
    }

    const confirmDelete = window.confirm("Sei sicuro di voler eliminare questo giocatore?");
    if (confirmDelete) {
      try {
        const giocatoreRef = doc(db, `Squadre/${selectedSquadra.id}/giocatori`, giocatoreId);
        await deleteDoc(giocatoreRef);

        const giocatoreGeneraleRef = doc(db, 'Giocatori', giocatoreId);
        await updateDoc(giocatoreGeneraleRef, { squadra: null });

        setGiocatori(prevGiocatori => prevGiocatori.filter(giocatore => giocatore.id !== giocatoreId));

        await updateValoreRosa(selectedSquadra.id);

        alert("Giocatore eliminato con successo!");
      } catch (err) {
        console.error("Errore nell'eliminazione del giocatore:", err);
        alert(`Errore nell'eliminazione del giocatore: ${err.message}`);
      }
    }
  };

  const exportFilteredSquadre = async () => {
    const workbook = XLSX.utils.book_new();
  
    for (const squadra of squadre) {
      const squadraData = [
        ['Squadra:' + squadra.nome || 'N/A','Valore Rosa:' + squadra.valoreRosa || 'N/A','Crediti:' + squadra.crediti || 'N/A'],
        ['Id','Nome', 'Posizione', 'Gol', 'Presenze', 'Scadenza', 'ValoreIniziale', 'ValoreAttuale', 'Assist', 'Ammonizioni', 'Espulsioni', 'Autogol', 'MediaVoto', 'GolSubiti', 'RigoriParati', 'IdSquadra']
      ];
  
      try {
        const giocatoriRef = collection(db, `Squadre/${squadra.id}/giocatori`);
        const giocatoriSnap = await getDocs(giocatoriRef);
        const giocatori = giocatoriSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        giocatori.sort(sortGiocatoriByRuolo);
        
        giocatori.forEach(giocatore => {
          squadraData.push([
            giocatore.id || 'N/A',
            giocatore.nome || 'N/A',
            giocatore.posizione || 'N/A',
            giocatore.gol || 0,
            giocatore.presenze || 0,
            giocatore.scadenza || 'N/A',
            giocatore.valoreIniziale || 0,
            giocatore.valoreAttuale || 0,
            giocatore.assist || 0,
            giocatore.ammonizioni || 0,
            giocatore.espulsioni || 0,
            giocatore.autogol || 0,
            giocatore.voto || 0,
            giocatore.golSubiti || 0,
            giocatore.rigoriParati || 0,
            squadra.id || 'N/A'
          ]);
        });
  
        const worksheet = XLSX.utils.aoa_to_sheet(squadraData);
        XLSX.utils.book_append_sheet(workbook, worksheet, squadra.nome || `Squadra ${squadra.id}`);
      } catch (error) {
        console.error(`Errore nel recupero dei giocatori per la squadra ${squadra.id}:`, error);
        const errorWorksheet = XLSX.utils.aoa_to_sheet([['Errore nel recupero dei dati per questa squadra']]);
        XLSX.utils.book_append_sheet(workbook, errorWorksheet, `Errore Squadra ${squadra.id}`);
      }
    }
  
    const generateExcelFileName = () => {
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      return `FantaVecchio_squadre_${date}_${time}.xlsx`;
    };
    
    XLSX.writeFile(workbook, generateExcelFileName());
  };

  const getValoreRosaClass = (valoreRosa) => {
    if (valoreRosa < 50) return 'text-success';
    if (valoreRosa < 100) return 'text-warning';
    return 'text-danger';
  };

  const getScadenzaClass = (scadenza) => {
    if (!scadenza) return '';
    
    const now = new Date();
    const dataScadenza = new Date(scadenza);
    const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
    
    if (dataScadenza < now) {
      return 'text-danger'; // Past due
    } else if (dataScadenza <= sixMonthsFromNow) {
      return 'text-danger'; // Less than 3 months away
    }
    return 'text-success'; // More than 3 months away
  };

  const isAdmin = currentUser?.ruolo === 'admin';
  const isAdminOrUtente = isAdmin || currentUser?.ruolo === 'utente';

  if (squadreLoading) return <div>Caricamento squadre...</div>;
  if (squadreError) return <div>Errore nel caricamento delle squadre: {squadreError.message}</div>;

  const orderRuoli = [
    "Por", "Ds", "Dc", "Dd", "Dd;Dc", "B;Dd;Dc","B;Dd;Ds", "B;Ds;Dc", "B;Dc", "Ds;Dc", 
    "Dd;Ds", "Dd;Ds;Dc", "Dd;Ds;E", "Dd;E", "B;Ds;E", "B;Dd;E", "Ds;E", "E", "E;M", "E;C", "M", "C", "C;T", "M;C", "C;W;T",
    "E;W", "W", "W;T", "W;T;A", "T", "T;A", "W;A", "A", "Pc"
  ];

  const sortGiocatoriByRuolo = (a, b) => {
    const indexA = orderRuoli.indexOf(a.posizione);
    const indexB = orderRuoli.indexOf(b.posizione);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  };

  return (
    <div className="container-fluid p-3">
      <h2 className="my-4 text-center">Lista Squadre</h2>
      <div className="d-flex flex-wrap gap-2 mb-4">
        {squadre.map((squadra) => (
          <button
            key={squadra.id}
            onClick={() => handleSquadraClick(squadra)}
            className={`btn ${selectedSquadra === squadra ? 'btn-primary' : 'btn-outline-primary'} mb-2`}
          >
            {squadra.nome || squadra.id}
          </button>
        ))}
        {isAdminOrUtente && (
          <button onClick={exportFilteredSquadre} className="btn btn-info mb-2">
            Esporta Excel
          </button>
        )}
      </div>
      {selectedSquadra && (
        <div>
          <h3>Dettagli Squadra</h3>
          <p className={getValoreRosaClass(selectedSquadra.valoreRosa)}>
            Valore Rosa: {selectedSquadra.valoreRosa || 'N/A'}
          </p>
          <p>
            Crediti:
            <input
              type="number"
              value={crediti}
              onChange={(e) => setCrediti(e.target.value)}
              className="form-control"
              min="0"
              disabled={!isAdmin}
            />
            <button
              className="btn btn-primary mt-2"
              onClick={handleUpdateCrediti}
              disabled={!isAdmin || crediti === ''}
            >
              Salva
            </button>
          </p>
          <p>
            Numero Giocatori: {giocatori.length || 'N/A'}
          </p>
          <h3>Giocatori di {selectedSquadra.nome || selectedSquadra.id}</h3>
          {isAdmin && (
            <button
              className="btn btn-success mb-3"
              onClick={handleSaveAll}
              disabled={Object.keys(modifiedPlayers).length === 0}
            >
              Salva Tutto
            </button>
          )}
          <table className="table table-striped table-bordered table-hover">
            <thead className="table-primary">
              <tr>
                <th>Nome</th>
                <th>Posizione</th>
                <th>Gol</th>
                <th>Presenze</th>
                <th>Valore Iniziale</th>
                <th>Valore Attuale</th>
                <th>Scadenza</th>
                <th>Ammonizioni</th>
                <th>Assist</th>
                <th>Autogol</th>
                <th>Espulsioni</th>
                <th>Gol Subiti</th>
                <th>Media Voto</th>
                {isAdmin && <th>Azioni</th>}
              </tr>
            </thead>
            <tbody>
  {giocatori.sort(sortGiocatoriByRuolo).map((giocatore) => (
    <tr 
      key={giocatore.id} 
      style={{ 
        backgroundColor: rinnoviPendenti[giocatore.id] ? '#ffcccc' : '',
        ...(modifiedPlayers[giocatore.id] ? { outline: '2px solid #007bff' } : {})
      }}
    >
      <td>{giocatore.nome}</td>
      <td>{giocatore.posizione}</td>
      <td>{giocatore.gol}</td>
      <td>{giocatore.presenze}</td>
      <td>
        <input
          type="number"
          value={giocatore.valoreIniziale}
          onChange={(e) => handleEdit(giocatore.id, 'valoreIniziale', e.target.value)}
          className="form-control"
          min="0"
          disabled={!isAdmin}
        />
      </td>
      <td>
        <input
          type="number"
          value={giocatore.valoreAttuale}
          onChange={(e) => handleEdit(giocatore.id, 'valoreAttuale', e.target.value)}
          className="form-control"
          min="0"
          disabled={!isAdmin}
        />
      </td>
      <td>
        {!isSerieA(giocatore) ? (
  <>
    <input
      type="text"
      className="form-control"
      value=""
      disabled
      placeholder="Data bloccata"
    />
    {giocatore.scadenza && (
      <div className="text-date small mt-1">
        Tempo rimanente contratto: {getMesiRimanenti(giocatore.scadenza)} mesi
      </div>
    )}
  </>
) : (
  <input
    type="date"
    value={giocatore.scadenza || ''}
    onChange={(e) => handleEdit(giocatore.id, 'scadenza', e.target.value)}
    className={`form-control ${getScadenzaClass(giocatore.scadenza)}`}
    disabled={!isAdmin}
  />
)}

      </td>
      <td>{giocatore.ammonizioni}</td>
      <td>{giocatore.assist}</td>
      <td>{giocatore.autogol}</td>
      <td>{giocatore.espulsioni}</td>
      <td>{giocatore.golSubiti}</td>
      <td>{giocatore.voto}</td>
      {isAdmin && (
        <td>
          <div className="btn-group" role="group">
         {['+6', '+12', '+18'].map((filter) => (
     <button
       key={filter}
       className="btn btn-secondary btn-sm"
      onClick={() => handleApplyFilter(giocatore.id, filter)}
       disabled={!isSerieA(giocatore)}
     >
       {filter}
     </button>
   ))}
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleDelete(giocatore.id)}
            >
              Elimina
            </button>
          </div>
          {rinnoviPendenti[giocatore.id] && (
            <span className="badge bg-danger ms-2">Da Rinnovare sul profilo</span>
          )}
        </td>
      )}
    </tr>
  ))}
</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default ListaSquadre;