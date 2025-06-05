import React, { useState, useEffect } from 'react';
import { db } from '../firebase/firebase'; // Assicurati che il percorso sia corretto
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const ValutazioneScambio = () => {
  const [squadre, setSquadre] = useState([]); // Tutte le squadre
  const [miaSquadra, setMiaSquadra] = useState(null); // Squadra dell'utente corrente
  const [squadraConfronto, setSquadraConfronto] = useState(''); // ID della squadra selezionata
  const [giocatoriCompatibili, setGiocatoriCompatibili] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Recupera tutte le squadre dal database
          const squadreRef = collection(db, 'Squadre');
          const squadreSnapshot = await getDocs(squadreRef);
          const listaSquadre = squadreSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSquadre(listaSquadre);

          // Recupera i dati dell'utente corrente
          const utentiRef = collection(db, 'Utenti');
          const utentiSnapshot = await getDocs(utentiRef);
          const utentiList = utentiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const currentUserData = utentiList.find(u => u.email === user.email);

          if (!currentUserData || !currentUserData.idSquadra) {
            console.warn("Nessuna squadra associata all'utente corrente.");
            setIsLoading(false);
            return;
          }

          // Trova la squadra dell'utente corrente
          const squadraUtente = listaSquadre.find(s => s.id === currentUserData.idSquadra);
          if (!squadraUtente) {
            console.error("Squadra non trovata per l'utente corrente.");
            setIsLoading(false);
            return;
          }

          // Recupera i giocatori della squadra dell'utente corrente
          const giocatoriRef = collection(db, `Squadre/${squadraUtente.id}/giocatori`);
          const giocatoriSnapshot = await getDocs(giocatoriRef);
          const listaGiocatori = giocatoriSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Imposta la squadra dell'utente corrente
          setMiaSquadra({ id: squadraUtente.id, ...squadraUtente, giocatori: listaGiocatori });
        } catch (error) {
          console.error('Errore nel recupero delle squadre:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        console.warn("Nessun utente autenticato.");
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Funzione per calcolare la compatibilità tra due giocatori
  const calcolaCompatibilita = (g1, g2) => {
    const pesoPosizione = 0.3; // Importanza della posizione
    const pesoPresenze = 0.2; // Importanza delle presenze
    const pesoGol = 0.2; // Importanza dei gol
    const pesoGolPerPresenza = 0.15; // Importanza del rapporto gol/presenze
    const pesoAssist = 0.15; // Importanza degli assist

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

    return punteggio * 100; // Percentuale
  };

  // Gestisce la selezione della squadra da confrontare
  const handleSquadraSelezionata = (e) => {
    const idSquadra = e.target.value; // ID univoco della squadra
    console.log("ID squadra selezionata:", idSquadra); // Debugging
    setSquadraConfronto(idSquadra);
  };

  // Genera suggerimenti di scambio
  const generaSuggerimenti = async () => {
    if (!miaSquadra || !squadraConfronto) {
      alert('Seleziona una squadra da confrontare.');
      return;
    }

    try {
      // Recupera la squadra avversaria
      const squadraRef = doc(db, 'Squadre', squadraConfronto);
      const squadraSnap = await getDoc(squadraRef);

      if (!squadraSnap.exists()) {
        console.error("Squadra avversaria non trovata.");
        alert('Squadra avversaria non trovata.');
        return;
      }

      const squadraAvversariaData = squadraSnap.data();

      // Recupera i giocatori della squadra avversaria
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

      // Ordina per compatibilità decrescente
      risultati.sort((a, b) => b.compatibilita - a.compatibilita);
      console.log("Risultati suggeriti:", risultati); // Debugging
      setGiocatoriCompatibili(risultati);
    } catch (error) {
      console.error("Errore nel recupero della squadra avversaria:", error);
      alert("Si è verificato un errore durante il confronto delle squadre.");
    }
  };

  return (
    <div className="container mt-5">
      <h2>Valutazione Scambio</h2>

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
            .filter(s => s.id !== miaSquadra?.id) // Escludi la mia squadra
            .map(s => (
              <option key={s.id} value={s.id}> {/* Usa l'ID univoco */}
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
              {giocatoriCompatibili.map((pair, index) => (
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