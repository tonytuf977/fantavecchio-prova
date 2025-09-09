import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../firebase/firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
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
          // Recupera i giocatori della squadra corrente
          const giocatoriRef = collection(db, `Squadre/${squadraId}/giocatori`);
          const giocatoriSnap = await getDocs(giocatoriRef);
          const giocatoriArray = giocatoriSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

          // Crea i dati per il foglio Excel
          const worksheetData = [
             
        ['Squadra:' + squadraData.nome || 'N/A','Valore Rosa:' + squadraData.valoreRosa || 'N/A','Crediti:' + squadraData.crediti || 'N/A'],
        ['Id','Nome', 'Posizione', 'Gol', 'Presenze', 'Scadenza', 'ValoreIniziale', 'ValoreAttuale', 'Assist', 'Ammonizioni', 'Espulsioni', 'Autogol', 'MediaVoto', 'GolSubiti', 'RigoriParati', 'IdSquadra'],
            ...giocatoriArray.map((g) => [
              g.id || 'N/A',
              g.nome || 'N/A',
              g.posizione || 'N/A',
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
            ]),
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

  const handleImport = async () => {
    setProgress(0);
    setProgressPercentage(0);

    try {
      // Esegui il backup prima dell'import
      await createRosaBackup();
    } catch (backupError) {
      console.error("Errore durante il backup:", backupError);
      setMessage('Errore durante il backup delle rose: ' + backupError.message);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // ✅ IMPORTA SOLO IL PRIMO FOGLIO
        const firstSheetName = workbook.SheetNames[0];
        console.log(`📊 Importando solo il primo foglio: "${firstSheetName}"`);
        
        if (!firstSheetName) {
          throw new Error('Nessun foglio trovato nel file Excel');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (jsonData.length <= 2) {
          throw new Error('Il foglio Excel non contiene dati sufficienti (minimo 3 righe)');
        }

        const giocatori = [];

        // Processa le righe del primo foglio
        for (let i = 2; i < jsonData.length; i++) {
          const row = jsonData[i];
          const id = row[0]; // ID univoco dalla colonna A
          const nome = row[3]; // Nome dalla colonna D (row[3])
          
          if (!id) {
            console.warn(`Riga ${i + 1} saltata: ID giocatore mancante (colonna A)`);
            continue;
          }

          const giocatore = {
            id: id.toString(), // ✅ ID UNIVOCO dalla colonna A
            nome: nome || 'Nome non disponibile', // Nome dalla colonna D
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
          };

          console.log(`✅ Giocatore processato: ID=${giocatore.id}, Nome=${giocatore.nome}`);
          giocatori.push(giocatore);
        }

        console.log(`📊 Totale giocatori da processare: ${giocatori.length}`);

        // ✅ OTTIMIZZAZIONE: Carica tutte le squadre e giocatori esistenti UNA SOLA VOLTA
        console.log('🔍 Caricamento dati esistenti dal database...');
        const [squadreSnapshot, giocatoriSnapshot] = await Promise.all([
          getDocs(collection(db, 'Squadre')),
          getDocs(collection(db, 'Giocatori'))
        ]);

        const squadre = squadreSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const giocatoriEsistenti = new Map();
        
        giocatoriSnapshot.docs.forEach(doc => {
          giocatoriEsistenti.set(doc.id, doc.data());
        });

        console.log(`📊 Trovate ${squadre.length} squadre e ${giocatoriEsistenti.size} giocatori esistenti`);

        // ✅ BATCH OTTIMIZZATO: Processa tutti i giocatori con batch più grandi
        const totalGiocatori = giocatori.length;
        const batchSize = 400; // ✅ Batch più grande per ridurre le richieste
        const totalBatches = Math.ceil(totalGiocatori / batchSize);

        console.log(`🚀 Processando ${totalGiocatori} giocatori in ${totalBatches} batch di massimo ${batchSize} elementi`);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batch = writeBatch(db);
          const start = batchIndex * batchSize;
          const end = Math.min((batchIndex + 1) * batchSize, totalGiocatori);

          console.log(`📦 Batch ${batchIndex + 1}/${totalBatches}: processando giocatori ${start + 1}-${end}`);

          for (let i = start; i < end; i++) {
            const giocatore = giocatori[i];

            // ✅ USA I DATI GIÀ CARICATI invece di fare nuove query
            const giocatoreEsistente = giocatoriEsistenti.get(giocatore.id);

            let valoreIniziale, valoreAttuale;

            if (giocatoreEsistente) {
              // ✅ GIOCATORE ESISTENTE: Aggiorna tutti i dati basandosi sull'ID
              console.log(`🔄 Aggiornamento giocatore esistente: ID=${giocatore.id}, Nome=${giocatore.nome}`);
              
              valoreIniziale = giocatoreEsistente.valoreIniziale;
              valoreAttuale = giocatoreEsistente.valoreAttuale || valoreIniziale;

              if (giocatore.presenze === 0) {
                valoreIniziale = valoreAttuale;
              } else {
                valoreAttuale = valoreIniziale;

                const mediaVoto = giocatore.voto;
                const differenzaMediaVoto = (mediaVoto - 6) * 50;

                if (giocatore.posizione.toLowerCase() === 'por' && mediaVoto > 1) {
                  valoreAttuale += Math.round(differenzaMediaVoto);
                  if (giocatore.rigoriParati > 0) {
                    valoreAttuale += giocatore.rigoriParati * 5;
                  }
                }

                if (giocatore.gol > 0) valoreAttuale += giocatore.gol;
                if (giocatore.espulsioni > 0) valoreAttuale -= giocatore.espulsioni;
                if (giocatore.assist > 0) valoreAttuale += Math.round(giocatore.assist * 0.5);
                if (giocatore.ammonizioni > 0) valoreAttuale -= Math.round(giocatore.ammonizioni * 0.5);
                valoreAttuale += Math.round(giocatore.presenze * 0.4);

                // ✅ CONTROLLO VALORE MINIMO: Il valore attuale non può mai essere inferiore al valore iniziale
                if (valoreAttuale < valoreIniziale) {
                  console.log(`⚠️ Correzione valore per ${giocatore.nome} (ID: ${giocatore.id}): 
                    Valore calcolato: ${valoreAttuale}€ → Corretto a valore iniziale: ${valoreIniziale}€`);
                  valoreAttuale = valoreIniziale;
                }
              }
            } else {
              // ✅ GIOCATORE NUOVO: Crea con tutti i dati dall'Excel
              console.log(`🆕 Creazione nuovo giocatore: ID=${giocatore.id}, Nome=${giocatore.nome}`);
              
              valoreIniziale = giocatore.valoreIniziale;
              valoreAttuale = valoreIniziale;
            }

            giocatore.valoreIniziale = valoreIniziale;
            giocatore.valoreAttuale = valoreAttuale;

            // ✅ Aggiorna il giocatore nella collezione generale usando l'ID come chiave
            const giocatoreRef = doc(db, 'Giocatori', giocatore.id);
            batch.set(giocatoreRef, giocatore, { merge: true });

            // ✅ Trova la squadra corretta per il giocatore usando i dati già caricati
            const squadraAttuale = squadre.find(squadra =>
              giocatore.squadraSerieA === squadra.id ||
              (giocatoreEsistente && giocatoreEsistente.squadra === squadra.id)
            );

            if (squadraAttuale) {
              const giocatoreSquadraRef = doc(db, `Squadre/${squadraAttuale.id}/giocatori`, giocatore.id);
              batch.set(giocatoreSquadraRef, giocatore, { merge: true });
            }
          }

          // ✅ COMMIT BATCH CON RETRY LOGIC
          try {
            await batch.commit();
            console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} completato con successo`);
          } catch (error) {
            if (error.code === 'resource-exhausted') {
              console.warn(`⚠️ Quota exceeded per batch ${batchIndex + 1}, attendo 30 secondi...`);
              await delay(30000); // 30 secondi di attesa
              await batch.commit(); // Riprova dopo la pausa
              console.log(`✅ Batch ${batchIndex + 1}/${totalBatches} completato dopo retry`);
            } else {
              throw error;
            }
          }

          // ✅ Aggiorna progress
          const currentProgress = end;
          const percentage = Math.round((currentProgress / totalGiocatori) * 100);
          setProgress(currentProgress);
          setProgressPercentage(percentage);

          // ✅ Delay più breve tra i batch
          if (batchIndex < totalBatches - 1) {
            await delay(500); // 0.5 secondi tra i batch invece di 1 secondo
          }
        }

        setMessage(`✅ Importazione completata con successo! Processati ${totalGiocatori} giocatori dal foglio "${firstSheetName}"`);
      } catch (error) {
        console.error("❌ Errore durante l'importazione:", error);
        setMessage('❌ Errore durante l\'importazione dei dati: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Importa Excel</h2>
              <div className="mb-3">
                <input type="file" className="form-control" onChange={handleFileUpload} accept=".xlsx, .xls" />
              </div>
              <button onClick={handleImport} className="btn btn-primary w-100 mb-3">Importa</button>

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