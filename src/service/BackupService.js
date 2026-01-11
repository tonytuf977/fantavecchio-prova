// service/BackupService.js
import { db, auth } from '../firebase/firebase';
import { backupDb } from '../firebase/backupFirebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query,
  where,
  deleteDoc,
  doc,
  Timestamp,
  writeBatch 
} from 'firebase/firestore';
import { logAction, AUDIT_ACTIONS } from './AuditService';
import { captureError, ERROR_TYPES, SEVERITY } from './ErrorLogger';

/**
 * Crea un backup completo dello stato corrente del database
 * @param {string} backupType - Tipo di backup (AUTO, MANUAL, BEFORE_IMPORT, BEFORE_TRADE, etc.)
 * @param {string} description - Descrizione del backup
 * @param {Object} metadata - Metadati aggiuntivi
 */
export const createBackup = async (backupType = 'MANUAL', description = '', metadata = {}) => {
  try {
    console.log('Inizio creazione backup...');
    
    // 1. Recupera tutti i dati dal database principale
    const giocatoriSnapshot = await getDocs(collection(db, 'Giocatori'));
    const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
    const utentiSnapshot = await getDocs(collection(db, 'Utenti'));
    const richiesteScambioSnapshot = await getDocs(collection(db, 'RichiesteScambio'));

    // 2. Converti in array di oggetti
    const giocatori = giocatoriSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const squadre = [];
    for (const squadraDoc of squadreSnapshot.docs) {
      const squadraData = { id: squadraDoc.id, ...squadraDoc.data() };
      
      // Recupera i giocatori della squadra
      const giocatoriSquadraRef = collection(db, `Squadre/${squadraDoc.id}/giocatori`);
      const giocatoriSquadraSnap = await getDocs(giocatoriSquadraRef);
      squadraData.giocatori = giocatoriSquadraSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      squadre.push(squadraData);
    }

    const utenti = utentiSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const richiesteScambio = richiesteScambioSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 3. Crea l'oggetto backup
    const backupData = {
      backupType,
      description,
      timestamp: Timestamp.now(),
      createdBy: auth.currentUser?.email || 'system',
      userId: auth.currentUser?.uid || 'system',
      metadata: {
        ...metadata,
        totalGiocatori: giocatori.length,
        totalSquadre: squadre.length,
        totalUtenti: utenti.length,
        totalRichiesteScambio: richiesteScambio.length,
      },
      data: {
        giocatori,
        squadre,
        utenti,
        richiesteScambio,
      }
    };

    // 4. Salva nel database di backup
    const backupRef = await addDoc(collection(backupDb, 'Backups'), backupData);
    
    console.log('Backup creato con successo:', backupRef.id);

    // 5. Log audit
    await logAction({
      action: AUDIT_ACTIONS.DOWNLOAD_BACKUP,
      userEmail: auth.currentUser?.email || 'system',
      userId: auth.currentUser?.uid || 'system',
      description: `Backup creato: ${backupType} - ${description}`,
      details: {
        backupId: backupRef.id,
        backupType,
        totalGiocatori: giocatori.length,
        totalSquadre: squadre.length,
      },
      status: 'SUCCESS',
    });

    // 6. Pulizia backup vecchi
    await cleanOldBackups();

    return {
      success: true,
      backupId: backupRef.id,
      message: 'Backup creato con successo'
    };

  } catch (error) {
    console.error('Errore nella creazione del backup:', error);
    
    await captureError(error, {
      errorType: ERROR_TYPES.DATABASE_WRITE_ERROR,
      component: 'BackupService',
      action: 'Creazione Backup',
      severity: SEVERITY.CRITICAL,
      userEmail: auth.currentUser?.email,
      userId: auth.currentUser?.uid,
      additionalInfo: { backupType, description }
    });

    throw error;
  }
};

/**
 * Recupera tutti i backup disponibili
 */
export const getBackups = async () => {
  try {
    const backupsSnapshot = await getDocs(collection(backupDb, 'Backups'));
    const backups = backupsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date()
    }));

    // Ordina per data decrescente
    return backups.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Errore nel recupero dei backup:', error);
    throw error;
  }
};

/**
 * Ripristina un backup specifico
 * @param {string} backupId - ID del backup da ripristinare
 */
export const restoreBackup = async (backupId) => {
  try {
    console.log('Inizio ripristino backup:', backupId);

    // 1. Prima crea un backup di sicurezza dello stato corrente
    await createBackup('BEFORE_RESTORE', `Backup automatico prima del ripristino ${backupId}`, {
      restoringBackupId: backupId
    });

    // 2. Recupera il backup da ripristinare
    const backupSnapshot = await getDocs(
      query(collection(backupDb, 'Backups'), where('__name__', '==', backupId))
    );

    if (backupSnapshot.empty) {
      throw new Error('Backup non trovato');
    }

    const backupData = backupSnapshot.docs[0].data();
    const { data } = backupData;

    // 3. Ripristina Giocatori
    const giocatoriRef = collection(db, 'Giocatori');
    const batch1 = writeBatch(db);
    
    // Elimina giocatori esistenti
    const existingGiocatori = await getDocs(giocatoriRef);
    existingGiocatori.docs.forEach(doc => {
      batch1.delete(doc.ref);
    });
    await batch1.commit();

    // Ripristina giocatori dal backup
    const batch2 = writeBatch(db);
    data.giocatori.forEach(giocatore => {
      const { id, ...giocatoreData } = giocatore;
      const giocatoreRef = doc(db, 'Giocatori', id);
      batch2.set(giocatoreRef, giocatoreData);
    });
    await batch2.commit();

    // 4. Ripristina Squadre e i loro giocatori
    const squadreRef = collection(db, 'Squadre');
    const existingSquadre = await getDocs(squadreRef);
    
    // Elimina squadre esistenti
    for (const squadraDoc of existingSquadre.docs) {
      // Elimina prima i giocatori della squadra
      const giocatoriSquadraRef = collection(db, `Squadre/${squadraDoc.id}/giocatori`);
      const giocatoriSquadra = await getDocs(giocatoriSquadraRef);
      const batch = writeBatch(db);
      giocatoriSquadra.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      
      // Poi elimina la squadra
      await deleteDoc(squadraDoc.ref);
    }

    // Ripristina squadre dal backup
    for (const squadra of data.squadre) {
      const { id, giocatori, ...squadraData } = squadra;
      
      // Crea la squadra
      const squadraRef = doc(db, 'Squadre', id);
      await writeBatch(db).set(squadraRef, squadraData).commit();

      // Ripristina i giocatori della squadra
      if (giocatori && giocatori.length > 0) {
        const batchGiocatori = writeBatch(db);
        giocatori.forEach(giocatore => {
          const { id: gId, ...gData } = giocatore;
          const gRef = doc(db, `Squadre/${id}/giocatori`, gId);
          batchGiocatori.set(gRef, gData);
        });
        await batchGiocatori.commit();
      }
    }

    // 5. Ripristina Utenti
    const utentiRef = collection(db, 'Utenti');
    const existingUtenti = await getDocs(utentiRef);
    const batch3 = writeBatch(db);
    existingUtenti.docs.forEach(doc => {
      batch3.delete(doc.ref);
    });
    await batch3.commit();

    const batch4 = writeBatch(db);
    data.utenti.forEach(utente => {
      const { id, ...utenteData } = utente;
      const utenteRef = doc(db, 'Utenti', id);
      batch4.set(utenteRef, utenteData);
    });
    await batch4.commit();

    // 6. Ripristina Richieste Scambio
    const richiesteRef = collection(db, 'RichiesteScambio');
    const existingRichieste = await getDocs(richiesteRef);
    const batch5 = writeBatch(db);
    existingRichieste.docs.forEach(doc => {
      batch5.delete(doc.ref);
    });
    await batch5.commit();

    const batch6 = writeBatch(db);
    data.richiesteScambio.forEach(richiesta => {
      const { id, ...richiestaData } = richiesta;
      const richiestaRef = doc(db, 'RichiesteScambio', id);
      batch6.set(richiestaRef, richiestaData);
    });
    await batch6.commit();

    console.log('Ripristino completato con successo');

    // 7. Log audit
    await logAction({
      action: AUDIT_ACTIONS.RESTORE_BACKUP,
      userEmail: auth.currentUser?.email || 'system',
      userId: auth.currentUser?.uid || 'system',
      description: `Backup ripristinato: ${backupId}`,
      details: {
        backupId,
        backupType: backupData.backupType,
        backupTimestamp: backupData.timestamp?.toDate?.()?.toISOString(),
      },
      status: 'SUCCESS',
    });

    return {
      success: true,
      message: 'Backup ripristinato con successo'
    };

  } catch (error) {
    console.error('Errore nel ripristino del backup:', error);
    
    await captureError(error, {
      errorType: ERROR_TYPES.DATABASE_WRITE_ERROR,
      component: 'BackupService',
      action: 'Ripristino Backup',
      severity: SEVERITY.CRITICAL,
      userEmail: auth.currentUser?.email,
      userId: auth.currentUser?.uid,
      additionalInfo: { backupId }
    });

    throw error;
  }
};

/**
 * Elimina backup più vecchi di 6 mesi
 */
export const cleanOldBackups = async () => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const backupsSnapshot = await getDocs(collection(backupDb, 'Backups'));
    const oldBackups = backupsSnapshot.docs.filter(doc => {
      const timestamp = doc.data().timestamp?.toDate();
      return timestamp && timestamp < sixMonthsAgo;
    });

    console.log(`Trovati ${oldBackups.length} backup da eliminare (più vecchi di 6 mesi)`);

    for (const backupDoc of oldBackups) {
      await deleteDoc(backupDoc.ref);
      console.log(`Backup eliminato: ${backupDoc.id}`);
    }

    return {
      deleted: oldBackups.length,
      message: `${oldBackups.length} backup vecchi eliminati`
    };
  } catch (error) {
    console.error('Errore nella pulizia dei backup vecchi:', error);
    // Non lanciare errore per non bloccare il processo principale
    return { deleted: 0, error: error.message };
  }
};

/**
 * Elimina un backup specifico
 */
export const deleteBackup = async (backupId) => {
  try {
    await deleteDoc(doc(backupDb, 'Backups', backupId));
    
    await logAction({
      action: AUDIT_ACTIONS.DOWNLOAD_BACKUP,
      userEmail: auth.currentUser?.email || 'admin',
      userId: auth.currentUser?.uid || 'unknown',
      description: `Backup eliminato manualmente: ${backupId}`,
      status: 'SUCCESS',
    });

    return { success: true, message: 'Backup eliminato' };
  } catch (error) {
    console.error('Errore nell\'eliminazione del backup:', error);
    throw error;
  }
};

// Tipi di backup
export const BACKUP_TYPES = {
  MANUAL: 'MANUAL',                     // Backup manuale
  AUTO: 'AUTO',                         // Backup automatico programmato
  BEFORE_IMPORT: 'BEFORE_IMPORT',       // Prima di importazione Excel
  BEFORE_TRADE: 'BEFORE_TRADE',         // Prima di scambio
  BEFORE_CONTRACT: 'BEFORE_CONTRACT',   // Prima di rinnovo contratto
  BEFORE_DELETE: 'BEFORE_DELETE',       // Prima di eliminazione
  BEFORE_RESTORE: 'BEFORE_RESTORE',     // Prima di ripristino
  DAILY: 'DAILY',                       // Backup giornaliero
};

export default createBackup;
