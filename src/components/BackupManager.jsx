// components/BackupManager.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useUtenti } from '../hook/useUtenti';
import { 
  createBackup, 
  getBackups, 
  restoreBackup, 
  deleteBackup,
  BACKUP_TYPES 
} from '../service/BackupService';
import './BackupManager.css';

const BackupManager = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { utenti } = useUtenti();
  const [isAdmin, setIsAdmin] = useState(false);

  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  
  const [description, setDescription] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsBackup, setDetailsBackup] = useState(null);

  // Verifica autenticazione e ruolo admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && utenti.length > 0) {
      const utenteCorrente = utenti.find((u) => u.email === user.email);
      setIsAdmin(utenteCorrente?.ruolo === 'admin');
    }
  }, [user, utenti]);

  // Carica backups
  useEffect(() => {
    if (isAdmin) {
      loadBackups();
    }
  }, [isAdmin]);

  const loadBackups = async () => {
    try {
      setLoadingBackups(true);
      const data = await getBackups();
      setBackups(data);
    } catch (error) {
      console.error('Errore caricamento backup:', error);
      alert('Errore nel caricamento dei backup');
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!description.trim()) {
      alert('Inserisci una descrizione per il backup');
      return;
    }

    try {
      setCreating(true);
      await createBackup(BACKUP_TYPES.MANUAL, description);
      setDescription('');
      setShowCreateModal(false);
      await loadBackups();
      alert('Backup creato con successo!');
    } catch (error) {
      console.error('Errore creazione backup:', error);
      alert('Errore nella creazione del backup: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;

    try {
      setRestoring(true);
      await restoreBackup(selectedBackup.id);
      setShowRestoreModal(false);
      setSelectedBackup(null);
      alert('Backup ripristinato con successo! La pagina verrà ricaricata.');
      window.location.reload();
    } catch (error) {
      console.error('Errore ripristino backup:', error);
      alert('Errore nel ripristino del backup: ' + error.message);
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo backup?')) {
      return;
    }

    try {
      await deleteBackup(backupId);
      await loadBackups();
      alert('Backup eliminato con successo');
    } catch (error) {
      console.error('Errore eliminazione backup:', error);
      alert('Errore nell\'eliminazione del backup: ' + error.message);
    }
  };

  const openRestoreModal = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  const openDetailsModal = (backup) => {
    setDetailsBackup(backup);
    setShowDetailsModal(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBackupTypeLabel = (type) => {
    const labels = {
      MANUAL: 'Manuale',
      AUTO: 'Automatico',
      BEFORE_IMPORT: 'Pre-Import',
      BEFORE_TRADE: 'Pre-Scambio',
      BEFORE_CONTRACT: 'Pre-Contratto',
      BEFORE_DELETE: 'Pre-Eliminazione',
      BEFORE_RESTORE: 'Pre-Ripristino',
      DAILY: 'Giornaliero',
    };
    return labels[type] || type;
  };

  const getBackupTypeBadgeClass = (type) => {
    const classes = {
      MANUAL: 'bg-primary',
      AUTO: 'bg-info',
      BEFORE_IMPORT: 'bg-warning',
      BEFORE_TRADE: 'bg-success',
      BEFORE_CONTRACT: 'bg-secondary',
      BEFORE_DELETE: 'bg-danger',
      BEFORE_RESTORE: 'bg-dark',
      DAILY: 'bg-info',
    };
    return classes[type] || 'bg-secondary';
  };

  if (loading) {
    return <div className="text-center p-5">Caricamento...</div>;
  }

  if (!user) {
    return <div className="alert alert-warning m-3">Devi effettuare il login per accedere a questa pagina.</div>;
  }

  if (!isAdmin) {
    return <div className="alert alert-danger m-3">Accesso negato. Solo gli amministratori possono gestire i backup.</div>;
  }

  return (
    <div className="backup-manager-container">
      <div className="container-fluid p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>
            <i className="fas fa-database me-2"></i>
            Gestione Backup
          </h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={creating}
          >
            <i className="fas fa-plus me-2"></i>
            Crea Backup
          </button>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <h5 className="card-title">
              <i className="fas fa-info-circle me-2"></i>
              Informazioni
            </h5>
            <p className="mb-2">
              <strong>Backup automatici:</strong> Vengono creati automaticamente prima di importazioni, scambi e altre operazioni critiche.
            </p>
            <p className="mb-2">
              <strong>Conservazione:</strong> I backup più vecchi di 6 mesi vengono eliminati automaticamente.
            </p>
            <p className="mb-0">
              <strong>Ripristino:</strong> Prima di ogni ripristino viene creato un backup di sicurezza dello stato corrente.
            </p>
          </div>
        </div>

        {loadingBackups ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Caricamento backup...</span>
            </div>
          </div>
        ) : backups.length === 0 ? (
          <div className="alert alert-info">
            <i className="fas fa-info-circle me-2"></i>
            Nessun backup disponibile. Crea il primo backup!
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Data/Ora</th>
                  <th>Tipo</th>
                  <th>Descrizione</th>
                  <th>Creato da</th>
                  <th>Statistiche</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>{formatDate(backup.timestamp)}</td>
                    <td>
                      <span className={`badge ${getBackupTypeBadgeClass(backup.backupType)}`}>
                        {getBackupTypeLabel(backup.backupType)}
                      </span>
                    </td>
                    <td>{backup.description || 'Nessuna descrizione'}</td>
                    <td>{backup.createdBy}</td>
                    <td>
                      <small>
                        <i className="fas fa-users me-1"></i>{backup.metadata?.totalGiocatori || 0} Giocatori
                        <span className="ms-2">
                          <i className="fas fa-shield-alt me-1"></i>{backup.metadata?.totalSquadre || 0} Squadre
                        </span>
                      </small>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-info me-2"
                        onClick={() => openDetailsModal(backup)}
                        title="Dettagli"
                      >
                        <i className="fas fa-eye me-1"></i>
                        Dettagli
                      </button>
                      <button
                        className="btn btn-sm btn-success me-2"
                        onClick={() => openRestoreModal(backup)}
                        disabled={restoring}
                        title="Ripristina"
                      >
                        <i className="fas fa-undo me-1"></i>
                        Ripristina
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteBackup(backup.id)}
                        title="Elimina"
                      >
                        <i className="fas fa-trash me-1"></i>
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Creazione Backup */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Crea Nuovo Backup</h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Descrizione</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Es: Backup prima della manutenzione..."
                  />
                </div>
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Il backup includerà tutti i giocatori, squadre, utenti e richieste di scambio.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Annulla
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCreateBackup}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Creazione...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-save me-2"></i>
                      Crea Backup
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ripristino */}
      {showRestoreModal && selectedBackup && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header bg-warning">
                <h5 className="modal-title">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  Conferma Ripristino
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowRestoreModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-danger">
                  <strong>ATTENZIONE!</strong> Questa operazione sostituirà tutti i dati correnti con quelli del backup selezionato.
                </div>
                <p><strong>Backup da ripristinare:</strong></p>
                <ul>
                  <li><strong>Data:</strong> {formatDate(selectedBackup.timestamp)}</li>
                  <li><strong>Tipo:</strong> {getBackupTypeLabel(selectedBackup.backupType)}</li>
                  <li><strong>Descrizione:</strong> {selectedBackup.description || 'Nessuna'}</li>
                  <li><strong>Giocatori:</strong> {selectedBackup.metadata?.totalGiocatori || 0}</li>
                  <li><strong>Squadre:</strong> {selectedBackup.metadata?.totalSquadre || 0}</li>
                </ul>
                <p className="text-muted">
                  <i className="fas fa-shield-alt me-2"></i>
                  Verrà creato un backup di sicurezza dello stato corrente prima del ripristino.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRestoreModal(false)}>
                  Annulla
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleRestoreBackup}
                  disabled={restoring}
                >
                  {restoring ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Ripristino in corso...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-undo me-2"></i>
                      Ripristina
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dettagli */}
      {showDetailsModal && detailsBackup && (
        <div className="modal show d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-info-circle me-2"></i>
                  Dettagli Backup
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowDetailsModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <strong>Data/Ora:</strong><br />
                    {formatDate(detailsBackup.timestamp)}
                  </div>
                  <div className="col-md-6 mb-3">
                    <strong>Tipo:</strong><br />
                    <span className={`badge ${getBackupTypeBadgeClass(detailsBackup.backupType)}`}>
                      {getBackupTypeLabel(detailsBackup.backupType)}
                    </span>
                  </div>
                  <div className="col-md-6 mb-3">
                    <strong>Creato da:</strong><br />
                    {detailsBackup.createdBy}
                  </div>
                  <div className="col-md-6 mb-3">
                    <strong>ID Backup:</strong><br />
                    <small className="text-muted">{detailsBackup.id}</small>
                  </div>
                  <div className="col-12 mb-3">
                    <strong>Descrizione:</strong><br />
                    {detailsBackup.description || 'Nessuna descrizione'}
                  </div>
                </div>

                <hr />

                <h6>Statistiche</h6>
                <div className="row">
                  <div className="col-md-3 mb-2">
                    <div className="card text-center">
                      <div className="card-body">
                        <i className="fas fa-users fa-2x text-primary mb-2"></i>
                        <h4>{detailsBackup.metadata?.totalGiocatori || 0}</h4>
                        <small>Giocatori</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-2">
                    <div className="card text-center">
                      <div className="card-body">
                        <i className="fas fa-shield-alt fa-2x text-success mb-2"></i>
                        <h4>{detailsBackup.metadata?.totalSquadre || 0}</h4>
                        <small>Squadre</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-2">
                    <div className="card text-center">
                      <div className="card-body">
                        <i className="fas fa-user fa-2x text-info mb-2"></i>
                        <h4>{detailsBackup.metadata?.totalUtenti || 0}</h4>
                        <small>Utenti</small>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-3 mb-2">
                    <div className="card text-center">
                      <div className="card-body">
                        <i className="fas fa-exchange-alt fa-2x text-warning mb-2"></i>
                        <h4>{detailsBackup.metadata?.totalRichiesteScambio || 0}</h4>
                        <small>Richieste</small>
                      </div>
                    </div>
                  </div>
                </div>

                {detailsBackup.metadata && Object.keys(detailsBackup.metadata).length > 4 && (
                  <>
                    <hr />
                    <h6>Metadati Aggiuntivi</h6>
                    <pre className="bg-light p-3 rounded">
                      {JSON.stringify(detailsBackup.metadata, null, 2)}
                    </pre>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>
                  Chiudi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop per modali */}
      {(showCreateModal || showRestoreModal || showDetailsModal) && (
        <div className="modal-backdrop show"></div>
      )}
    </div>
  );
};

export default BackupManager;
