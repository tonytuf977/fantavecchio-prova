import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { db, auth } from '../firebase/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { logAction, AUDIT_ACTIONS } from '../service/AuditService';
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

        // Ordina i backup dal più recente al più vecchio
        backupList.sort((a, b) => {
          const dateA = a.timestamp?.toDate?.() || new Date(0);
          const dateB = b.timestamp?.toDate?.() || new Date(0);
          return dateB - dateA; // Decrescente (più recente prima)
        });

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

  const downloadBackup = async (backup) => {
    try {
      // Leggi il file Excel dal dato base64
      const workbook = XLSX.read(backup.data, { type: 'base64' });

      // Salva il file localmente
      XLSX.writeFile(workbook, backup.fileName);
      
      // Log successo
      await logAction({
        action: AUDIT_ACTIONS.DOWNLOAD_BACKUP,
        userEmail: auth.currentUser?.email || 'unknown',
        userId: auth.currentUser?.uid || 'unknown',
        description: `Download backup: ${backup.fileName}`,
        details: {
          fileName: backup.fileName,
          backupId: backup.id,
          timestamp: backup.timestamp || 'unknown',
        },
        status: 'SUCCESS',
      });
    } catch (error) {
      console.error('Errore durante il download del backup:', error);
      setError('Errore durante il download del backup.');
      
      // Log errore
      await logAction({
        action: AUDIT_ACTIONS.DOWNLOAD_BACKUP,
        userEmail: auth.currentUser?.email || 'unknown',
        userId: auth.currentUser?.uid || 'unknown',
        description: `Errore download backup: ${error.message}`,
        details: { fileName: backup.fileName, errorMessage: error.message },
        status: 'FAILURE',
      });
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
              <div>
                <span className="fw-bold">{backup.fileName}</span>
                {backup.timestamp && (
                  <small className="text-muted d-block">
                    {new Date(backup.timestamp.toDate()).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </small>
                )}
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => downloadBackup(backup)}
              >
                <i className="fas fa-download me-1"></i>
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