import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const ValutazioneScambio = () => {
  const [squadre, setSquadre] = useState([]);
  const [miaSquadra, setMiaSquadra] = useState(null);
  const [squadraConfronto, setSquadraConfronto] = useState('');
  const [giocatoriCompatibili, setGiocatoriCompatibili] = useState([]);
  const [termineRicerca, setTermineRicerca] = useState('');
  const [giocatoreRicerca, setGiocatoreRicerca] = useState(null); // Giocatore selezionato
  const [listaTuttiGiocatori, setListaTuttiGiocatori] = useState([]); // Tutti i giocatori per ricerca
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const squadreRef = collection(db, 'Squadre');
          const squadreSnapshot = await getDocs(squadreRef);
          const listaSquadre = squadreSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSquadre(listaSquadre);

          const utentiRef = collection(db, 'Utenti');
          const utentiSnapshot = await getDocs(utentiRef);
          const utentiList = utentiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const currentUserData = utentiList.find(u => u.email === user.email);

          if (!currentUserData || !currentUserData.idSquadra) {
            setIsLoading(false);
            return;
          }

          const squadraUtente = listaSquadre.find(s => s.id === currentUserData.idSquadra);
          const giocatoriRef = collection(db, `Squadre/${squadraUtente.id}/giocatori`);
          const giocatoriSnapshot = await getDocs(giocatoriRef);
          const listaGiocatori = giocatoriSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          setMiaSquadra({ id: squadraUtente.id, ...squadraUtente, giocatori: listaGiocatori });
          setListaTuttiGiocatori(listaGiocatori);
        } catch (error) {
          console.error('Errore nel recupero delle squadre:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

 const calcolaCompatibilita = (g1, g2) => {
  const pesoPosizione = 0.25;
  const pesoPresenze = 0.15;
  const pesoGol = 0.15;
  const pesoGolPerPresenza = 0.1;
  const pesoAssist = 0.1;
  const pesoAmmonizioni = 0.05; // Nuovo
  const pesoEspulsioni = 0.05;   // Nuovo
  const pesoMediaVoto = 0.15;    // Nuovo

  let punteggio = 0;

  // 1. Posizione
  const ruoliCompatibili = {
    "Por": ["Por"],
    "Ds": ["Ds", "Dc", "Dd"],
    "Dc": ["Dc", "Ds", "Dd"],
    "Dd": ["Dd", "Ds", "Dc"],
    "B;Dd;Dc": ["B;Dd;Dc", "Dd", "Dc"],
    "B;Ds;Dc": ["B;Ds;Dc", "Ds", "Dc"],
    "E": ["E", "W", "T"],
    "W": ["W", "E", "T"],
    "T": ["T", "W", "E"],
    "A": ["A", "Pc"],
    "Pc": ["Pc", "A"],
  };

  if (ruoliCompatibili[g1.posizione]?.includes(g2.posizione)) {
    punteggio += pesoPosizione;
  }

  // 2. Presenze
  const maxPresenze = Math.max(g1.presenze || 0, g2.presenze || 0);
  if (maxPresenze > 0) {
    const diffPresenze = 1 - Math.abs((g1.presenze || 0) - (g2.presenze || 0)) / maxPresenze;
    punteggio += diffPresenze * pesoPresenze;
  }

  // 3. Gol
  const maxGol = Math.max(g1.gol || 0, g2.gol || 0);
  if (maxGol > 0) {
    const diffGol = 1 - Math.abs((g1.gol || 0) - (g2.gol || 0)) / maxGol;
    punteggio += diffGol * pesoGol;
  }

  // 4. Rapporto Gol/Presenze
  const rapportoGolPresenze1 = g1.presenze > 0 ? (g1.gol || 0) / g1.presenze : 0;
  const rapportoGolPresenze2 = g2.presenze > 0 ? (g2.gol || 0) / g2.presenze : 0;
  const maxRapportoGolPresenze = Math.max(rapportoGolPresenze1, rapportoGolPresenze2);
  if (maxRapportoGolPresenze > 0) {
    const diffRapportoGolPresenze =
      1 - Math.abs(rapportoGolPresenze1 - rapportoGolPresenze2) / maxRapportoGolPresenze;
    punteggio += diffRapportoGolPresenze * pesoGolPerPresenza;
  }

  // 5. Assist
  const maxAssist = Math.max(g1.assist || 0, g2.assist || 0);
  if (maxAssist > 0) {
    const diffAssist = 1 - Math.abs((g1.assist || 0) - (g2.assist || 0)) / maxAssist;
    punteggio += diffAssist * pesoAssist;
  }

  // 6. Ammonizioni
  const maxAmmonizioni = Math.max(g1.ammonizioni || 0, g2.ammonizioni || 0);
  if (maxAmmonizioni > 0) {
    const diffAmmonizioni = 1 - Math.abs((g1.ammonizioni || 0) - (g2.ammonizioni || 0)) / maxAmmonizioni;
    punteggio += diffAmmonizioni * pesoAmmonizioni;
  }

  // 7. Espulsioni
  const maxEspulsioni = Math.max(g1.espulsioni || 0, g2.espulsioni || 0);
  if (maxEspulsioni > 0) {
    const diffEspulsioni = 1 - Math.abs((g1.espulsioni || 0) - (g2.espulsioni || 0)) / maxEspulsioni;
    punteggio += diffEspulsioni * pesoEspulsioni;
  }

  // 8. Media Voto
  const maxMediaVoto = Math.max(g1.voto || 0, g2.voto || 0);
  if (maxMediaVoto > 0) {
    const diffMediaVoto = 1 - Math.abs((g1.voto || 0) - (g2.voto || 0)) / maxMediaVoto;
    punteggio += diffMediaVoto * pesoMediaVoto;
  }
  return punteggio * 100; // Percentuale
};

  const handleSquadraSelezionata = (e) => {
    setSquadraConfronto(e.target.value);
  };

  const generaSuggerimenti = async () => {
    if (!miaSquadra || !squadraConfronto) {
      alert('Seleziona una squadra da confrontare.');
      return;
    }

    try {
      const squadraRef = doc(db, 'Squadre', squadraConfronto);
      const squadraSnap = await getDoc(squadraRef);

      if (!squadraSnap.exists()) {
        alert('Squadra avversaria non trovata.');
        return;
      }

      const squadraAvversariaData = squadraSnap.data();
      const giocatoriRef = collection(db, `Squadre/${squadraConfronto}/giocatori`);
      const giocatoriSnapshot = await getDocs(giocatoriRef);
      const listaGiocatoriAvversari = giocatoriSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const risultati = [];

      miaSquadra.giocatori.forEach(gMiei => {
        listaGiocatoriAvversari.forEach(gAvversario => {
          const compatibilita = calcolaCompatibilita(gMiei, gAvversario);
          if (compatibilita > 40) {
            risultati.push({
              giocatoreMio: gMiei.nome,
              giocatoreAvversario: gAvversario.nome,
              compatibilita: compatibilita.toFixed(2),
            });
          }
        });
      });

      risultati.sort((a, b) => b.compatibilita - a.compatibilita);
      setGiocatoriCompatibili(risultati);
    } catch (error) {
      console.error("Errore nel recupero della squadra avversaria:", error);
      alert("Si è verificato un errore durante il confronto delle squadre.");
    }
  };

  const filtraPerGiocatore = (elenco) => {
    if (!giocatoreRicerca) return elenco;

    return elenco.filter(pair =>
      pair.giocatoreMio === giocatoreRicerca ||
      pair.giocatoreAvversario === giocatoreRicerca
    );
  };

  const opzioniGiocatori = miaSquadra?.giocatori.map(g => g.nome) || [];

  return (
    <div className="container mt-5">
      <h2>Valutazione Scambio</h2>

      {/* Ricerca per giocatore */}
      <div className="form-group mb-3">
        <label htmlFor="giocatore">Cerca per giocatore:</label>
        <input
          list="giocatori-list"
          className="form-control"
          placeholder="Seleziona un giocatore"
          onChange={(e) => setGiocatoreRicerca(e.target.value)}
          value={giocatoreRicerca || ''}
        />
        <datalist id="giocatori-list">
          {opzioniGiocatori.map((nome, index) => (
            <option key={index} value={nome} />
          ))}
        </datalist>
      </div>

      {/* Seleziona squadra da confrontare */}
      <div className="form-group">
        <label htmlFor="squadra">Seleziona squadra da confrontare:</label>
        <select
          id="squadra"
          className="form-control"
          onChange={handleSquadraSelezionata}
          value={squadraConfronto}
        >
          <option value="">-- Seleziona --</option>
          {squadre
            .filter(s => s.id !== miaSquadra?.id)
            .map(s => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
        </select>
      </div>

      <button className="btn btn-primary" onClick={generaSuggerimenti}>
        Cerca Giocatori Compatibili
      </button>

      {/* Risultati */}
      {giocatoriCompatibili.length > 0 ? (
        <div className="mt-4">
          <h4>Suggerimenti di Scambio</h4>
          <table className="table table-striped">
            <thead>
              <tr>
                <th>Mio Giocatore</th>
                <th>Giocatore Avversario</th>
                <th>Compatibilità (%)</th>
              </tr>
            </thead>
            <tbody>
              {filtraPerGiocatore(giocatoriCompatibili).map((pair, index) => (
                <tr key={index}>
                  <td>{pair.giocatoreMio}</td>
                  <td>{pair.giocatoreAvversario}</td>
                  <td>{pair.compatibilita}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>Nessun suggerimento disponibile.</p>
      )}
    </div>
  );
};

export default ValutazioneScambio;