import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../firebase/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { ProgressBar } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './RipristinoRoseSquadre.css';

function RipristinoRoseSquadre() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Seleziona un file prima di caricare.');
      return;
    }

    setProgress(0);
    setMessage('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const totalSheets = workbook.SheetNames.length;
      let sheetsProcessed = 0;

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        if (jsonData.length < 3) {
          sheetsProcessed++;
          setProgress(Math.round((sheetsProcessed / totalSheets) * 100));
          continue;
        }

        const nomeSquadra = (jsonData[0][0]?.toString() || sheetName).replace(/^Squadra:\s*/i, '');
        const valoreRosa = Number(jsonData[1][0]) || 0;
        
        // Extract crediti value from cell C1 (index [0][2])
        let crediti = 0;
        if (jsonData[0][2]) {
          const creditiMatch = jsonData[0][2].toString().match(/crediti:(\d+)/i);
          crediti = creditiMatch ? Number(creditiMatch[1]) : 0;
        }

        const squadraRef = doc(db, 'Squadre', sheetName);
        const giocatoriSquadraRef = collection(squadraRef, 'giocatori');

        const giocatoriEsistenti = await getDocs(giocatoriSquadraRef);
        for (const docSnapshot of giocatoriEsistenti.docs) {
          await deleteDoc(docSnapshot.ref);
        }

        let giocatoriAggiunti = 0;
        for (let i = 2; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[1]) continue;

          const giocatore = {
            id: row[1]?.toString(),
            nome: row[1]?.toString() || '',
            posizione: row[2]?.toString() || '',
            gol: Number(row[3]) || 0,
            presenze: Number(row[4]) || 0,
            scadenza: row[5]?.toString() || '',
            valoreIniziale: Number(row[6]) || 0,
            valoreAttuale: Number(row[7]) || 0,
            assist: Number(row[8]) || 0,
            ammonizioni: Number(row[9]) || 0,
            espulsioni: Number(row[10]) || 0,
            autogol: Number(row[11]) || 0,
            voto: Number(row[12]) || 0,
            golSubiti: Number(row[13]) || 0,
            rigoriParati: Number(row[14]) || 0,
            idSquadra: row[15]?.toString(),
            squadra: sheetName
          };

          const giocatoreRef = doc(giocatoriSquadraRef, giocatore.id);
          await setDoc(giocatoreRef, giocatore);

          const giocatorePrincipaleRef = doc(db, 'Giocatori', giocatore.id);
          await setDoc(giocatorePrincipaleRef, giocatore, { merge: true });

          giocatoriAggiunti++;
        }

        await setDoc(squadraRef, { 
          nome: nomeSquadra,
          valoreRosa: valoreRosa,
          crediti: crediti,
          numeroGiocatori: giocatoriAggiunti
        }, { merge: true });

        sheetsProcessed++;
        setProgress(Math.round((sheetsProcessed / totalSheets) * 100));
      }

      setMessage('Ripristino rose completato con successo');
    } catch (error) {
      console.error('Errore durante il caricamento dei dati da Excel:', error);
      setMessage('Errore durante il caricamento dei dati da Excel: ' + error.message);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Ripristino Rose Squadre</h2>
              <div className="mb-3">
                <input type="file" className="form-control" onChange={handleFileChange} accept=".xlsx, .xls" />
              </div>
              <button onClick={handleUpload} className="btn btn-primary w-100 mb-3">Carica File</button>
              
              {progress > 0 && progress < 100 && (
                <ProgressBar now={progress} label={`${progress}%`} className="mb-3" />
              )}
              
              {message && <div className="alert alert-info text-center mb-3">{message}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RipristinoRoseSquadre;