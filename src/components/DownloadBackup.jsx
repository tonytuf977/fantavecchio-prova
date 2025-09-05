import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';
import 'bootstrap/dist/css/bootstrap.min.css';

function DownloadBackup() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBackups = async () => {
      try {
        const backupRef = collection(db, 'BackupRose');
        const snapshot = await getDocs(backupRef);

        // Estrai i dati dei backup
        const backupList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setBackups(backupList);
        setLoading(false);
      } catch (err) {
        console.error('Errore nel recupero dei backup:', err);
        setError('Errore durante il recupero dei backup.');
        setLoading(false);
      }
    };

    fetchBackups();
  }, []);

  const downloadBackup = (backup) => {
    try {
      // Leggi il file Excel dal dato base64
      const workbook = XLSX.read(backup.data, { type: 'base64' });

      // Salva il file localmente
      XLSX.writeFile(workbook, backup.fileName);
    } catch (error) {
      console.error('Errore durante il download del backup:', error);
      setError('Errore durante il download del backup.');
    }
  };

  return (
    <div className="container mt-5">
      <h2 className="text-center mb-4">Scarica Backup Rose</h2>

      {/* Messaggio di errore */}
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Visualizzazione dei backup */}
      {loading ? (
        <p className="text-center">Caricamento in corso...</p>
      ) : backups.length > 0 ? (
        <div className="list-group">
          {backups.map((backup, index) => (
            <div key={index} className="list-group-item d-flex justify-content-between align-items-center">
              <span>{backup.fileName}</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => downloadBackup(backup)}
              >
                Scarica
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center">Nessun backup disponibile.</p>
      )}
    </div>
  );
}

export default DownloadBackup;