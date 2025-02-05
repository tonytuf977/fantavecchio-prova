import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../firebase/firebase';
import { collection, doc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import './ImportExel.css'
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

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleImport = async () => {
    setProgress(0);
    setProgressPercentage(0);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        const giocatori = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

          if (jsonData.length > 1) {
            for (let i = 2; i < jsonData.length; i++) {
              const row = jsonData[i];
              const nome = row[3];
              if (!nome) {
                console.warn(`Riga ${i + 1} saltata: nome giocatore mancante`);
                continue;
              }

              const giocatore = {
                nome: nome,
                posizione: row[2],
                squadraSerieA: row[4],
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

              giocatori.push(giocatore);
            }
          } else {
            console.warn(`Foglio "${sheetName}" vuoto o non valido. Saltato.`);
          }
        }

        const totalGiocatori = giocatori.length;
        const batchSize = 20;
        const totalBatches = Math.ceil(totalGiocatori / batchSize);

        const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
        const squadre = squadreSnapshot.docs.map(doc => doc.id);

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batch = writeBatch(db);
          const start = batchIndex * batchSize;
          const end = Math.min((batchIndex + 1) * batchSize, totalGiocatori);

          for (let i = start; i < end; i++) {
            const giocatore = giocatori[i];
            
            const giocatoreRef = doc(db, 'Giocatori', giocatore.nome);
            const giocatoreDoc = await getDoc(giocatoreRef);
            
            let valoreIniziale, valoreAttuale;

            if (giocatoreDoc.exists()) {
              const giocatoreEsistente = giocatoreDoc.data();
              valoreIniziale = giocatoreEsistente.valoreIniziale;
              valoreAttuale = giocatoreEsistente.valoreAttuale || valoreIniziale;

              if (giocatore.presenze === 0) {
                // Se le presenze sono 0, il valore iniziale diventa uguale al valore attuale precedente
                valoreIniziale = valoreAttuale;
              } else {
                // Altrimenti, manteniamo il valore iniziale originale e calcoliamo il nuovo valore attuale
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
              }
            } else {
              // Se il giocatore non esiste, usiamo i valori dall'Excel
              valoreIniziale = giocatore.valoreIniziale;
              valoreAttuale = valoreIniziale;
            }

            // Controllo finale per tutti i giocatori
            if (valoreAttuale < valoreIniziale) {
              valoreAttuale = valoreIniziale;
            }

            // Arrotondamento del valoreAttuale
            valoreAttuale = Math.ceil(valoreAttuale);

            giocatore.valoreIniziale = valoreIniziale;
            giocatore.valoreAttuale = valoreAttuale;

            batch.set(giocatoreRef, giocatore, { merge: true });

            const squadraAttuale = squadre.find(squadraId => 
              giocatore.squadraSerieA === squadraId || 
              (giocatoreDoc.exists() && giocatoreDoc.data().squadra === squadraId)
            );
            if (squadraAttuale) {
              const giocatoreSquadraRef = doc(db, `Squadre/${squadraAttuale}/giocatori`, giocatore.nome);
              batch.set(giocatoreSquadraRef, giocatore, { merge: true });
            }
          }

          try {
            await batch.commit();
          } catch (error) {
            if (error.code === 'resource-exhausted') {
              console.warn('Quota exceeded, retrying after delay...');
              await delay(30000); // 30 secondi di attesa
              await batch.commit(); // Riprova dopo la pausa
            } else {
              throw error;
            }
          }

          const currentProgress = end;
          const percentage = Math.round((currentProgress / totalGiocatori) * 100);
          setProgress(currentProgress);
          setProgressPercentage(percentage);

          await delay(1000); // Attesa di 1 secondo tra i batch
        }

        setMessage('Importazione completata con successo!');
      } catch (error) {
        console.error("Errore durante l'importazione:", error);
        setMessage('Errore durante l\'importazione dei dati: ' + error.message);
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
                    style={{width: `${progressPercentage}%`}} 
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