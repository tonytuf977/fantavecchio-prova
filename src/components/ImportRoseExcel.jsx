import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Button, Alert, ProgressBar, Modal, Card } from 'react-bootstrap';

function ImportRoseExcel() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [risultati, setRisultati] = useState([]);
  const [showRisultati, setShowRisultati] = useState(false);
  const [message, setMessage] = useState('');
  const [previewData, setPreviewData] = useState(null);

  const normalizzaNome = (nome) => {
    if (!nome) return '';
    return nome.toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Rimuove accenti
  };

  const trovaGiocatorePerNome = (nomeGiocatore, listaGiocatori) => {
    const nomeNormalizzato = normalizzaNome(nomeGiocatore);
    
    // Prima prova: match esatto del nome normalizzato
    let giocatoreTrovato = listaGiocatori.find(g => 
      normalizzaNome(g.nome) === nomeNormalizzato
    );
    
    if (giocatoreTrovato) return giocatoreTrovato;
    
    // Seconda prova: match parziale (contiene il nome)
    giocatoreTrovato = listaGiocatori.find(g => 
      normalizzaNome(g.nome).includes(nomeNormalizzato) ||
      nomeNormalizzato.includes(normalizzaNome(g.nome))
    );
    
    if (giocatoreTrovato) return giocatoreTrovato;
    
    // Terza prova: match delle prime lettere del cognome
    const cognomeExcel = nomeNormalizzato.split(' ').pop();
    if (cognomeExcel && cognomeExcel.length >= 3) {
      giocatoreTrovato = listaGiocatori.find(g => {
        const cognomeDb = normalizzaNome(g.nome).split(' ').pop();
        return cognomeDb && cognomeDb.startsWith(cognomeExcel.substring(0, 3));
      });
    }
    
    return giocatoreTrovato;
  };

  const previewFileExcel = async () => {
    if (!file) {
      setMessage('Seleziona un file Excel prima di procedere');
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      // Prende il primo foglio (dato che c'è un solo foglio con multiple tabelle)
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { 
        header: 1, 
        defval: '',
        raw: false
      });

      const previewSquadre = [];
      
      // ✅ LOGICA CORRETTA BASATA SULLA STRUTTURA COMPLETA:
      // Ci sono 10 squadre totali disposte in 2 gruppi di colonne:
      // - Prime 5 squadre: Colonne A-D (righe 5, 37, 69, 101, 133)
      // - Seconde 5 squadre: Colonne F-I (righe 5, 37, 69, 101, 133)
      // Ogni riga contiene 2 squadre: una in A-D e una in F-I
      
      console.log('🔍 Scansionando file Excel con logica a righe e colonne multiple...');
      console.log(`📊 Totale righe nel file: ${jsonData.length}`);
      
      // Righe specifiche per i nomi squadra
      const righeSquadre = [4, 36, 68, 100, 132]; // Righe 5, 37, 69, 101, 133 (indici 0-based)
      
      // Gruppi di colonne per le squadre
      const gruppiColonne = [
        { nome: 'A-D', colonne: [0, 1, 2, 3], colonnaGiocatori: 1 }, // Colonne A-D, giocatori in B
        { nome: 'F-I', colonne: [5, 6, 7, 8], colonnaGiocatori: 6 }  // Colonne F-I, giocatori in G
      ];
      
      for (let i = 0; i < righeSquadre.length; i++) {
        const rigaSquadra = righeSquadre[i];
        
        // Verifica che la riga esista
        if (rigaSquadra >= jsonData.length) {
          console.log(`⚠️ Riga ${rigaSquadra + 1} non esiste nel file, saltando...`);
          continue;
        }
        
        // Processa entrambi i gruppi di colonne per ogni riga
        for (let gruppoIndex = 0; gruppoIndex < gruppiColonne.length; gruppoIndex++) {
          const gruppo = gruppiColonne[gruppoIndex];
          const squadraNumero = (i * 2) + gruppoIndex + 1; // Numerazione sequenziale 1-10
          
          console.log(`\n📊 Analizzando squadra ${squadraNumero} alla riga ${rigaSquadra + 1}, colonne ${gruppo.nome}...`);
          
          // ✅ 1. ESTRAI NOME SQUADRA (rigaSquadra, colonne del gruppo)
          const nomeSquadraRow = jsonData[rigaSquadra];
          
          if (!nomeSquadraRow) {
            console.log(`⚠️ Riga ${rigaSquadra + 1} vuota, saltando...`);
            continue;
          }
          
          // Il nome della squadra può essere in una delle colonne del gruppo
          let nomeSquadra = '';
          for (const col of gruppo.colonne) {
            if (nomeSquadraRow[col] && nomeSquadraRow[col].toString().trim()) {
              nomeSquadra = nomeSquadraRow[col].toString().trim();
              console.log(`🔍 Trovato nome squadra nella colonna ${String.fromCharCode(65 + col)}: "${nomeSquadra}"`);
              break;
            }
          }
          
          if (!nomeSquadra || nomeSquadra.length < 3) {
            console.log(`⚠️ Nome squadra non trovato alla riga ${rigaSquadra + 1}, colonne ${gruppo.nome}, saltando...`);
            continue;
          }
          
          // Verifica che non sia un header
          if (nomeSquadra.toLowerCase().includes('ruolo') ||
              nomeSquadra.toLowerCase().includes('calciatore') ||
              nomeSquadra.toLowerCase().includes('squadra') ||
              nomeSquadra.toLowerCase().includes('costo')) {
            console.log(`⚠️ "${nomeSquadra}" sembra essere un header, saltando...`);
            continue;
          }
          
          console.log(`🏟️ Nome squadra trovato: "${nomeSquadra}" alla riga ${rigaSquadra + 1}, colonne ${gruppo.nome}`);
          
          // ✅ 2. ESTRAI GIOCATORI (colonna specifica del gruppo, righe da +2 a +29 rispetto al nome squadra)
          const giocatori = [];
          const rigaInizioGiocatori = rigaSquadra + 2; // +2 righe dal nome squadra
          const rigaFineGiocatori = rigaSquadra + 29; // +29 righe dal nome squadra
          
          for (let riga = rigaInizioGiocatori; riga <= rigaFineGiocatori && riga < jsonData.length; riga++) {
            const playerRow = jsonData[riga];
            
            if (playerRow && playerRow[gruppo.colonnaGiocatori]) { // Colonna specifica del gruppo
              const nomeGiocatore = playerRow[gruppo.colonnaGiocatori].toString().trim();
              
              // Verifica che sia un nome giocatore valido
              if (nomeGiocatore && 
                  nomeGiocatore.length > 1 &&
                  !nomeGiocatore.toLowerCase().includes('calciatore') &&
                  !nomeGiocatore.toLowerCase().includes('ruolo') &&
                  !nomeGiocatore.toLowerCase().includes('crediti')) {
                giocatori.push(nomeGiocatore);
                console.log(`  👤 Giocatore: ${nomeGiocatore} (riga ${riga + 1}, colonna ${String.fromCharCode(65 + gruppo.colonnaGiocatori)})`);
              }
            }
          }
          
          // ✅ 3. ESTRAI CREDITI (riga +30 rispetto al nome squadra, colonne del gruppo)
          let crediti = 0;
          const rigaCrediti = rigaSquadra + 30; // +30 righe dal nome squadra
          
          if (rigaCrediti < jsonData.length) {
            const creditiRow = jsonData[rigaCrediti];
            
            if (creditiRow) {
              // Cerca "Crediti Residui:" e il numero nelle colonne del gruppo
              for (const col of gruppo.colonne) {
                if (creditiRow[col]) {
                  const cellValue = creditiRow[col].toString().toLowerCase();
                  
                  if (cellValue.includes('crediti') && cellValue.includes('residui')) {
                    console.log(`💰 Trovata riga crediti: "${creditiRow[col]}" alla riga ${rigaCrediti + 1}, colonna ${String.fromCharCode(65 + col)}`);
                    
                    // Estrai il numero dai crediti
                    const numeroCrediti = cellValue.match(/\d+/);
                    if (numeroCrediti) {
                      crediti = parseInt(numeroCrediti[0]);
                      console.log(`💰 Crediti estratti: ${crediti}`);
                      break;
                    }
                  }
                }
              }
            }
          }
          
          // ✅ 4. VALIDAZIONE E AGGIUNTA SQUADRA
          if (giocatori.length > 3) { // Almeno 3 giocatori per essere considerata una squadra valida
            previewSquadre.push({
              nomeSquadra: nomeSquadra,
              riga: rigaSquadra + 1,
              colonne: gruppo.nome,
              giocatori: giocatori,
              crediti: crediti
            });
            
            console.log(`✅ Squadra confermata: "${nomeSquadra}" con ${giocatori.length} giocatori e ${crediti} crediti`);
          } else {
            console.log(`⚠️ Squadra "${nomeSquadra}" ha solo ${giocatori.length} giocatori, potrebbe non essere valida`);
          }
        }
      }

      setPreviewData(previewSquadre);
      setMessage(`File caricato! Trovate ${previewSquadre.length} squadre con ${previewSquadre.reduce((acc, s) => acc + s.giocatori.length, 0)} giocatori totali.`);

    } catch (error) {
      console.error('Errore nel preview:', error);
      setMessage('Errore nella lettura del file: ' + error.message);
    }
  };

  const processaImport = async () => {
    if (!previewData) {
      setMessage('Fai prima l\'anteprima del file');
      return;
    }

    setLoading(true);
    setProgress(0);
    setMessage('');
    setRisultati([]);

    try {
      // Carica tutti i giocatori dal database
      console.log('🔍 Caricamento giocatori dal database...');
      const giocatoriSnapshot = await getDocs(collection(db, 'Giocatori'));
      const tuttiGiocatori = giocatoriSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));

      // Carica tutte le squadre dal database
      const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
      const tutteSquadre = squadreSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));

      console.log(`📊 Trovati ${tuttiGiocatori.length} giocatori e ${tutteSquadre.length} squadre nel database`);

      const risultatiImport = [];
      const totalSquadre = previewData.length;

      // Processa ogni squadra
      for (let squadraIndex = 0; squadraIndex < previewData.length; squadraIndex++) {
        const squadraExcel = previewData[squadraIndex];
        
        console.log(`\n📋 Processando squadra: ${squadraExcel.nomeSquadra}`);
        
        // Trova la squadra corrispondente nel database con matching flessibile
        const squadraCorrispondente = tutteSquadre.find(s => {
          const nomeSquadraDb = normalizzaNome(s.nome);
          const nomeSquadraExcel = normalizzaNome(squadraExcel.nomeSquadra);
          
          // Match esatto
          if (nomeSquadraDb === nomeSquadraExcel) return true;
          
          // Match parziale (una contiene l'altra)
          if (nomeSquadraDb.includes(nomeSquadraExcel) || nomeSquadraExcel.includes(nomeSquadraDb)) return true;
          
          // Match per parole chiave (primi 3 caratteri)
          if (nomeSquadraDb.length >= 3 && nomeSquadraExcel.length >= 3) {
            if (nomeSquadraDb.substring(0, 3) === nomeSquadraExcel.substring(0, 3)) return true;
          }
          
          // Match per parole separate
          const paroleDb = nomeSquadraDb.split(' ');
          const paroleExcel = nomeSquadraExcel.split(' ');
          
          for (const parolaDb of paroleDb) {
            for (const parolaExcel of paroleExcel) {
              if (parolaDb.length > 2 && parolaExcel.length > 2) {
                if (parolaDb.includes(parolaExcel) || parolaExcel.includes(parolaDb)) {
                  return true;
                }
              }
            }
          }
          
          return false;
        });

        if (!squadraCorrispondente) {
          console.log(`❌ Squadra "${squadraExcel.nomeSquadra}" non trovata nel database`);
          risultatiImport.push({
            squadraExcel: squadraExcel.nomeSquadra,
            riga: squadraExcel.riga,
            squadraDb: null,
            status: 'SQUADRA_NON_TROVATA',
            giocatori: []
          });
          continue;
        }

        console.log(`✅ Squadra trovata: "${squadraExcel.nomeSquadra}" -> "${squadraCorrispondente.nome}" (${squadraCorrispondente.id})`);

        // ✅ AGGIORNA I CREDITI DELLA SQUADRA
        try {
          await updateDoc(doc(db, 'Squadre', squadraCorrispondente.id), {
            crediti: squadraExcel.crediti
          });
          console.log(`💰 Crediti aggiornati per squadra "${squadraCorrispondente.nome}": ${squadraExcel.crediti}`);
        } catch (error) {
          console.error(`❌ Errore nell'aggiornamento crediti per ${squadraCorrispondente.nome}:`, error);
        }

        const giocatoriProcessati = [];

        // Processa ogni giocatore della squadra
        for (const nomeGiocatoreExcel of squadraExcel.giocatori) {
          console.log(`🔍 Cercando giocatore: "${nomeGiocatoreExcel}"`);
          
          // Trova il giocatore nel database
          const giocatoreTrovato = trovaGiocatorePerNome(nomeGiocatoreExcel, tuttiGiocatori);
          
          if (giocatoreTrovato) {
            console.log(`✅ Giocatore trovato: "${nomeGiocatoreExcel}" -> "${giocatoreTrovato.nome}" (${giocatoreTrovato.id})`);
            
            // Associa il giocatore alla squadra nel database
            try {
              // Aggiorna il giocatore nella collezione principale
              await updateDoc(doc(db, 'Giocatori', giocatoreTrovato.id), {
                squadra: squadraCorrispondente.id
              });

              // Aggiungi il giocatore alla sottocollection della squadra
              const giocatoreSquadraRef = doc(db, `Squadre/${squadraCorrispondente.id}/giocatori`, giocatoreTrovato.id);
              await setDoc(giocatoreSquadraRef, {
                ...giocatoreTrovato,
                squadra: squadraCorrispondente.id
              });

              giocatoriProcessati.push({
                nomeExcel: nomeGiocatoreExcel,
                giocatoreDb: giocatoreTrovato,
                status: 'ASSOCIATO'
              });

            } catch (error) {
              console.error(`❌ Errore nell'associazione di ${giocatoreTrovato.nome}:`, error);
              giocatoriProcessati.push({
                nomeExcel: nomeGiocatoreExcel,
                giocatoreDb: giocatoreTrovato,
                status: 'ERRORE_ASSOCIAZIONE',
                errore: error.message
              });
            }
          } else {
            console.log(`❌ Giocatore non trovato: "${nomeGiocatoreExcel}"`);
            giocatoriProcessati.push({
              nomeExcel: nomeGiocatoreExcel,
              giocatoreDb: null,
              status: 'GIOCATORE_NON_TROVATO'
            });
          }
        }

        risultatiImport.push({
          squadraExcel: squadraExcel.nomeSquadra,
          riga: squadraExcel.riga,
          squadraDb: squadraCorrispondente,
          status: 'PROCESSATA',
          giocatori: giocatoriProcessati
        });

        // Aggiorna progress
        setProgress(Math.round(((squadraIndex + 1) / totalSquadre) * 100));
      }

      setRisultati(risultatiImport);
      setShowRisultati(true);
      setMessage('✅ Import completato! Controlla i risultati dettagliati.');

    } catch (error) {
      console.error('❌ Errore durante l\'import:', error);
      setMessage('❌ Errore durante l\'import: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getRiepilogoRisultati = () => {
    if (!risultati.length) return null;

    const totaleSquadre = risultati.length;
    const squadreTrovate = risultati.filter(r => r.status === 'PROCESSATA').length;
    const totaleGiocatori = risultati.reduce((acc, r) => acc + r.giocatori.length, 0);
    const giocatoriAssociati = risultati.reduce((acc, r) => 
      acc + r.giocatori.filter(g => g.status === 'ASSOCIATO').length, 0);
    const giocatoriNonTrovati = risultati.reduce((acc, r) => 
      acc + r.giocatori.filter(g => g.status === 'GIOCATORE_NON_TROVATO').length, 0);

    return {
      totaleSquadre,
      squadreTrovate,
      totaleGiocatori,
      giocatoriAssociati,
      giocatoriNonTrovati
    };
  };

  const riepilogo = getRiepilogoRisultati();

  return (
    <div className="container mt-5">
      <h2>📊 Import Rose Squadre da Excel</h2>
      

      <Card className="mb-4">
        <Card.Header>
          <h5>📁 Step 1: Carica File Excel</h5>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <label className="form-label">Seleziona file Excel (.xlsx/.xls):</label>
            <input
              type="file"
              className="form-control"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files[0]);
                setPreviewData(null);
                setMessage('');
              }}
              disabled={loading}
            />
          </div>

          <Button
            onClick={previewFileExcel}
            disabled={!file || loading}
            variant="outline-primary"
            className="me-2"
          >
            👁️ Anteprima File
          </Button>
        </Card.Body>
      </Card>

      {previewData && (
        <Card className="mb-4">
          <Card.Header>
            <h5>👁️ Anteprima Squadre Trovate</h5>
          </Card.Header>
          <Card.Body>
            <div className="row">
              {previewData.map((squadra, index) => (
                <div key={index} className="col-md-6 mb-3">
                  <div className="border p-3 rounded">
                    <h6 className="text-primary">🏟️ {squadra.nomeSquadra}</h6>
                    <small className="text-muted">Riga: {squadra.riga}, Colonne: {squadra.colonne}</small>
                    <p className="mb-1"><strong>Giocatori:</strong> {squadra.giocatori.length}</p>
                    <p className="mb-1"><strong>💰 Crediti:</strong> {squadra.crediti}</p>
                    {squadra.giocatori.length > 0 && (
                      <small className="text-muted">
                        {squadra.giocatori.slice(0, 3).join(', ')}
                        {squadra.giocatori.length > 3 && '...'}
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={processaImport}
              disabled={loading}
              variant="success"
              size="lg"
              className="mt-3"
            >
              {loading ? '🔄 Importando...' : '🚀 Avvia Import Completo'}
            </Button>
          </Card.Body>
        </Card>
      )}

      {loading && (
        <div className="mb-3">
          <ProgressBar now={progress} label={`${progress}%`} animated />
          <small className="text-muted">Processando squadre e associando giocatori...</small>
        </div>
      )}

      {message && (
        <Alert variant={message.includes('❌') || message.includes('Errore') ? 'danger' : 'success'}>
          {message}
        </Alert>
      )}

      {/* Riepilogo risultati */}
      {riepilogo && (
        <Alert variant="info">
          <h5>📊 Riepilogo Import:</h5>
          <div className="row">
            <div className="col-md-3">
              <strong>🏟️ Squadre:</strong> {riepilogo.squadreTrovate}/{riepilogo.totaleSquadre}
            </div>
            <div className="col-md-3">
              <strong>👥 Giocatori Totali:</strong> {riepilogo.totaleGiocatori}
            </div>
            <div className="col-md-3">
              <strong>✅ Associati:</strong> {riepilogo.giocatoriAssociati}
            </div>
            <div className="col-md-3">
              <strong>❌ Non Trovati:</strong> {riepilogo.giocatoriNonTrovati}
            </div>
          </div>
        </Alert>
      )}

      {/* Modal risultati dettagliati */}
      <Modal show={showRisultati} onHide={() => setShowRisultati(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>📊 Risultati Import Dettagliati</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {risultati.map((squadra, index) => (
            <Card key={index} className="mb-3">
              <Card.Header>
                <h5>
                  🏟️ {squadra.squadraExcel}
                  <small className="text-muted"> (Riga: {squadra.riga})</small>
                  {squadra.squadraDb ? (
                    <span className="badge bg-success ms-2">→ {squadra.squadraDb.nome}</span>
                  ) : (
                    <span className="badge bg-danger ms-2">❌ Non trovata</span>
                  )}
                </h5>
              </Card.Header>
              
              {squadra.giocatori.length > 0 && (
                <Card.Body>
                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Nome Excel</th>
                          <th>Nome Database</th>
                          <th>Stato</th>
                        </tr>
                      </thead>
                      <tbody>
                        {squadra.giocatori.map((giocatore, gIndex) => (
                          <tr key={gIndex}>
                            <td>{giocatore.nomeExcel}</td>
                            <td>{giocatore.giocatoreDb?.nome || '-'}</td>
                            <td>
                              <span className={`badge ${
                                giocatore.status === 'ASSOCIATO' ? 'bg-success' :
                                giocatore.status === 'GIOCATORE_NON_TROVATO' ? 'bg-warning text-dark' : 'bg-danger'
                              }`}>
                                {giocatore.status === 'ASSOCIATO' ? '✅ Associato' :
                                 giocatore.status === 'GIOCATORE_NON_TROVATO' ? '❌ Non trovato' : '⚠️ Errore'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card.Body>
              )}
            </Card>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRisultati(false)}>
            Chiudi
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default ImportRoseExcel;