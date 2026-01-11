import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db, auth } from '../firebase/firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { logAction, AUDIT_ACTIONS } from '../service/AuditService';
import { captureError, ERROR_TYPES, SEVERITY } from '../service/ErrorLogger';
import { createBackup, BACKUP_TYPES } from '../service/BackupService';
import './ImportExel.css';
import 'bootstrap/dist/css/bootstrap.min.css';

function ImportExcel() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    setFile(file);
  };

  // Funzione per creare il backup delle rose
  const createRosaBackup = async () => {
    try {
      // Recupera tutte le squadre dal database
      const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
      const workbook = XLSX.utils.book_new();

      for (const squadraDoc of squadreSnapshot.docs) {
        const squadraData = squadraDoc.data();
        const squadraId = squadraDoc.id;

        try {
          // Recupera i giocatori principali della squadra corrente
          const giocatoriRef = collection(db, `Squadre/${squadraId}/giocatori`);
          const giocatoriSnap = await getDocs(giocatoriRef);
          const giocatoriPrincipali = giocatoriSnap.docs.map((doc) => ({ 
            id: doc.id, 
            ...doc.data(),
            tipo: 'Principale'
          }));

          // Recupera i giocatori della lista giovani
          const giocatoriGiovaniRef = collection(db, `Squadre/${squadraId}/listaGiovani`);
          const giocatoriGiovaniSnap = await getDocs(giocatoriGiovaniRef);
          const giocatoriGiovani = giocatoriGiovaniSnap.docs.map((doc) => ({ 
            id: doc.id, 
            ...doc.data(),
            tipo: 'Giovane'
          }));

          // Unisci i due array
          const giocatoriArray = [...giocatoriPrincipali, ...giocatoriGiovani];

          // Crea i dati per il foglio Excel
          const worksheetData = [
             
        ['Squadra:' + squadraData.nome || 'N/A','Valore Rosa:' + squadraData.valoreRosa || 'N/A','Crediti:' + squadraData.crediti || 'N/A'],
        ['Id','Nome', 'Posizione', 'Competizioni', 'Tipo', 'Gol', 'Presenze', 'Scadenza', 'ValoreIniziale', 'ValoreAttuale', 'Assist', 'Ammonizioni', 'Espulsioni', 'Autogol', 'MediaVoto', 'GolSubiti', 'RigoriParati', 'IdSquadra'],
            ...giocatoriArray.map((g) => {
              // Normalizza competizioni: rimuovi duplicati e sostituisci "champions" con "coppe"
              let competizioni = Array.isArray(g.competizione) ? [...g.competizione] : [g.competizione || 'campionato'];
              competizioni = competizioni
                .map(c => c === 'champions' ? 'coppe' : c) // Sostituisci champions con coppe
                .filter((c, index, self) => self.indexOf(c) === index); // Rimuovi duplicati
              
              return [
                g.id || 'N/A',
                g.nome || 'N/A',
                g.posizione || 'N/A',
                competizioni.join(';'),
                g.tipo || 'N/A',
                g.gol || 0,
                g.presenze || 0,
                g.scadenza || 'N/A',
                g.valoreIniziale || 0,
                g.valoreAttuale || 0,
                g.assist || 0,
                g.ammonizioni || 0,
                g.espulsioni || 0,
                g.autogol || 0,
                g.voto || 0,
                g.golSubiti || 0,
                g.rigoriParati || 0,
                squadraId || 'N/A',
              ];
            }),
          ];

          // Debug: Stampa i dati che verranno aggiunti al foglio Excel
          console.log('Dati da aggiungere al foglio Excel:', worksheetData);

          // Aggiungi il foglio al workbook
          const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
          if (!worksheet) {
            throw new Error(`Errore durante la creazione del foglio Excel per la squadra ${squadraId}`);
          }
          XLSX.utils.book_append_sheet(workbook, worksheet, squadraData.nome || `Squadra-${squadraId}`);
        } catch (error) {
          console.error(`Errore nel recupero dei giocatori per la squadra ${squadraId}:`, error);
          const errorWorksheet = XLSX.utils.aoa_to_sheet([['Errore nel recupero dei dati per questa squadra']]);
          XLSX.utils.book_append_sheet(workbook, errorWorksheet, `Errore Squadra ${squadraId}`);
        }
      }

      // Genera il nome del file
      const generateExcelFileName = () => {
        const now = new Date();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        return `FantaVecchio_squadre_${date}_${time}.xlsx`;
      };

      // Salva il file Excel come base64 nel database Firestore
      const fileName = generateExcelFileName();
      const fileData = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

      console.log('File Excel convertito in base64:', fileData);

      const backupRef = doc(db, 'BackupRose', fileName);
      await setDoc(backupRef, {
        data: fileData,
        timestamp: new Date(),
        fileName: fileName,
      });

      console.log('Backup salvato nel database Firestore con successo.');
    } catch (error) {
      console.error('Errore durante il backup delle rose:', error);
      setMessage('Errore durante il backup delle rose: ' + error.message);
    }
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ✅ Funzione per importazione automatica da Fantacalcio.it
  const handleImportFromFantacalcio = async () => {
    setProgress(0);
    setProgressPercentage(0);
    setMessage(' Scaricamento Excel da Fantacalcio.it...');

    try {
      // Crea backup prima dell'importazione
      setMessage('Creazione backup...');
      await createBackup(
        BACKUP_TYPES.BEFORE_IMPORT,
        'Backup automatico prima import da Fantacalcio.it',
        { source: 'fantacalcio.it', importType: 'automatic' }
      );
      
      setMessage(' Scaricamento Excel da Fantacalcio.it...');
      const response = await fetch('http://localhost:3001/api/giocatori');
      
      if (!response.ok) {
        throw new Error(`Errore nel download: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log('✅ Excel scaricato con successo');

      await processExcelData(arrayBuffer);

    } catch (error) {
      console.error('❌ Errore durante l\'import automatico:', error);
      setMessage('❌ Errore: ' + error.message);
    }
  };

  // ✅ Funzione condivisa per processare Excel
  const processExcelData = async (arrayBuffer) => {
    try {
      await createRosaBackup();
    } catch (backupError) {
      console.error("Errore durante il backup:", backupError);
      setMessage('Errore durante il backup: ' + backupError.message);
      return;
    }

    try {
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      const giocatori = [];
      for (let i = 2; i < jsonData.length; i++) {
        const row = jsonData[i];
        const id = row[0];
        if (!id) continue;

        giocatori.push({
          id: id.toString(),
          nome: row[3] || 'Nome non disponibile',
          posizione: row[2] || 'N/A',
          squadraSerieA: row[4] || null,
          gol: Number(row[8]) || 0,
          presenze: Number(row[5]) || 0,
          assist: Number(row[14]) || 0,
          ammonizioni: Number(row[15]) || 0,
          espulsioni: Number(row[16]) || 0,
          autogol: Number(row[17]) || 0,
          voto: Number(row[6]) || 0,
          rigoriParati: Number(row[10]) || 0,
          golSubiti: Number(row[9]) || 0,
          valoreIniziale: Number(row[18]) || 0,
        });
      }

      const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
      const giocatoriSnapshot = await getDocs(collection(db, 'Giocatori'));
      const squadre = squadreSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const giocatoriEsistenti = new Map();
      giocatoriSnapshot.docs.forEach(doc => giocatoriEsistenti.set(doc.id, doc.data()));

      // Carica TUTTI i giocatori di TUTTE le squadre (sia giocatori che listaGiovani)
      const giocatoriPerSquadra = new Map(); // squadraId -> Set di giocatoriId
      const giocatoriInListaGiovani = new Set(); // squadraId_giocatoreId

      for (const squadra of squadre) {
        const giocatoriIds = new Set();
        
        try {
          // Carica giocatori normali
          const giocatoriSnapshot = await getDocs(collection(db, `Squadre/${squadra.id}/giocatori`));
          giocatoriSnapshot.docs.forEach(doc => giocatoriIds.add(doc.id));
        } catch (error) {
          console.warn(`Errore caricamento giocatori squadra ${squadra.id}:`, error);
        }
        
        try {
          // Carica lista giovani
          const listaGiovaniSnapshot = await getDocs(collection(db, `Squadre/${squadra.id}/listaGiovani`));
          listaGiovaniSnapshot.docs.forEach(doc => {
            giocatoriIds.add(doc.id);
            giocatoriInListaGiovani.add(`${squadra.id}_${doc.id}`);
          });
        } catch (error) {
          console.warn(`Errore lista giovani squadra ${squadra.id}:`, error);
        }
        
        giocatoriPerSquadra.set(squadra.id, giocatoriIds);
      }

      const totalGiocatori = giocatori.length;
      const batchSize = 400;
      const totalBatches = Math.ceil(totalGiocatori / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = writeBatch(db);
        const start = batchIndex * batchSize;
        const end = Math.min((batchIndex + 1) * batchSize, totalGiocatori);

        for (let i = start; i < end; i++) {
          const giocatore = giocatori[i];
          const giocatoreEsistente = giocatoriEsistenti.get(giocatore.id);

          let valoreIniziale, valoreAttuale;
          if (giocatoreEsistente) {
            valoreIniziale = giocatoreEsistente.valoreIniziale;
            valoreAttuale = giocatoreEsistente.valoreAttuale || valoreIniziale;

            if (giocatore.presenze > 0) {
              valoreAttuale = valoreIniziale;
              const mediaVoto = giocatore.voto;
              const differenzaMediaVoto = (mediaVoto - 6) * 50;

              if (giocatore.posizione.toLowerCase() === 'por' && mediaVoto > 1) {
                valoreAttuale += Math.round(differenzaMediaVoto);
                if (giocatore.rigoriParati > 0) valoreAttuale += giocatore.rigoriParati * 5;
              }

              if (giocatore.gol > 0) valoreAttuale += giocatore.gol;
              if (giocatore.espulsioni > 0) valoreAttuale -= giocatore.espulsioni;
              if (giocatore.assist > 0) valoreAttuale += Math.round(giocatore.assist * 0.5);
              if (giocatore.ammonizioni > 0) valoreAttuale -= Math.round(giocatore.ammonizioni * 0.5);
              valoreAttuale += Math.round(giocatore.presenze * 0.4);

              if (valoreAttuale < valoreIniziale) valoreAttuale = valoreIniziale;
            }
          } else {
            valoreIniziale = giocatore.valoreIniziale;
            valoreAttuale = valoreIniziale;
          }

          giocatore.valoreIniziale = valoreIniziale;
          giocatore.valoreAttuale = valoreAttuale;

          batch.set(doc(db, 'Giocatori', giocatore.id), giocatore, { merge: true });

          // Aggiorna il giocatore in TUTTE le squadre dove si trova
          for (const [squadraId, giocatoriIds] of giocatoriPerSquadra.entries()) {
            if (giocatoriIds.has(giocatore.id)) {
              // Determina se è in listaGiovani o giocatori
              const isInListaGiovani = giocatoriInListaGiovani.has(`${squadraId}_${giocatore.id}`);
              const targetRef = isInListaGiovani
                ? doc(db, `Squadre/${squadraId}/listaGiovani`, giocatore.id)
                : doc(db, `Squadre/${squadraId}/giocatori`, giocatore.id);
              
              batch.set(targetRef, giocatore, { merge: true });
            }
          }
        }

        await batch.commit();
        const percentage = Math.round((end / totalGiocatori) * 100);
        setProgress(end);
        setProgressPercentage(percentage);
        if (batchIndex < totalBatches - 1) await delay(500);
      }

      setMessage(`✅ Importazione completata! ${totalGiocatori} giocatori aggiornati`);
      
      // Log successo
      await logAction({
        action: AUDIT_ACTIONS.IMPORT_PLAYERS,
        userEmail: auth.currentUser?.email || 'unknown',
        userId: auth.currentUser?.uid || 'unknown',
        description: `Importazione automatica da Fantacalcio.it completata: ${totalGiocatori} giocatori aggiornati`,
        details: {
          numeroGiocatori: totalGiocatori,
          fonte: 'Fantacalcio.it',
          metodo: 'automatico'
        },
        status: 'SUCCESS',
      });
    } catch (error) {
      console.error("❌ Errore importazione:", error);
      setMessage('❌ Errore: ' + error.message);
      
      // Log errore audit
      await logAction({
        action: AUDIT_ACTIONS.IMPORT_PLAYERS,
        userEmail: auth.currentUser?.email || 'unknown',
        userId: auth.currentUser?.uid || 'unknown',
        description: `Errore importazione automatica: ${error.message}`,
        details: { errorMessage: error.message },
        status: 'FAILURE',
      });
      
      // Log errore tecnico
      await captureError(error, {
        errorType: ERROR_TYPES.API_ERROR,
        component: 'ImportExcel',
        action: 'Importazione Automatica da Fantacalcio.it',
        severity: SEVERITY.HIGH,
        userEmail: auth.currentUser?.email,
        userId: auth.currentUser?.uid,
        additionalInfo: {
          fonte: 'Fantacalcio.it',
        }
      });
    }
  };

  const handleImport = async () => {
    setProgress(0);
    setProgressPercentage(0);

    if (!file) {
      setMessage('⚠️ Seleziona un file Excel');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Crea backup prima dell'importazione manuale
        setMessage('Creazione backup...');
        await createBackup(
          BACKUP_TYPES.BEFORE_IMPORT,
          `Backup automatico prima import manuale Excel: ${file.name}`,
          { fileName: file.name, importType: 'manual' }
        );
        
        await processExcelData(e.target.result);
        
        // Log successo importazione manuale
        await logAction({
          action: AUDIT_ACTIONS.IMPORT_PLAYERS,
          userEmail: auth.currentUser?.email || 'unknown',
          userId: auth.currentUser?.uid || 'unknown',
          description: `Importazione manuale da Excel completata: ${file.name}`,
          details: {
            nomeFile: file.name,
            dimensione: file.size,
            metodo: 'manuale'
          },
          status: 'SUCCESS',
        });
      } catch (error) {
        // Log errore audit
        await logAction({
          action: AUDIT_ACTIONS.IMPORT_PLAYERS,
          userEmail: auth.currentUser?.email || 'unknown',
          userId: auth.currentUser?.uid || 'unknown',
          description: `Errore importazione manuale: ${error.message}`,
          details: { nomeFile: file.name, errorMessage: error.message },
          status: 'FAILURE',
        });
        
        // Log errore tecnico
        await captureError(error, {
          errorType: ERROR_TYPES.FILE_PARSE_ERROR,
          component: 'ImportExcel',
          action: 'Importazione Manuale da Excel',
          severity: SEVERITY.HIGH,
          userEmail: auth.currentUser?.email,
          userId: auth.currentUser?.uid,
          additionalInfo: {
            nomeFile: file.name,
            dimensione: file.size,
          }
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Importa Excel</h2>
              
              {/* Importazione Automatica */}
              <div className="mb-4 p-3 bg-light border rounded">
                <h5 className="mb-3"> Importazione Automatica</h5>
                <p className="text-muted small mb-3">
                  Scarica e importa automaticamente le statistiche aggiornate da Fantacalcio.it
                </p>
                <button 
                  onClick={handleImportFromFantacalcio} 
                  className="btn btn-success w-100"
                  disabled={progress > 0}
                >
                  Importa Automaticamente da Fantacalcio.it
                </button>
              </div>

              <hr className="my-4" />

              {/* Importazione Manuale */}
              <div className="mb-3">
                <h5 className="mb-3">📁 Importazione Manuale</h5>
                <p className="text-muted small mb-3">
                  Carica un file Excel locale
                </p>
                <input 
                  type="file" 
                  className="form-control mb-3" 
                  onChange={handleFileUpload} 
                  accept=".xlsx, .xls"
                  disabled={progress > 0}
                />
                <button 
                  onClick={handleImport} 
                  className="btn btn-primary w-100"
                  disabled={progress > 0 || !file}
                >
                   Importa File
                </button>
              </div>

              {progress > 0 && (
                <div className="progress mb-3">
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${progressPercentage}%` }}
                    aria-valuenow={progressPercentage}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {progressPercentage}%
                  </div>
                </div>
              )}

              {message && <div className="alert alert-info text-center">{message}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportExcel;