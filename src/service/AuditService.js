// service/AuditService.js
import { db } from '../firebase/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

/**
 * Registra un'azione nell'audit log
 * @param {Object} logData - Dati del log
 * @param {string} logData.action - Tipo di azione (es: 'LOGIN', 'CREATE_PLAYER', 'DELETE_TEAM', etc.)
 * @param {string} logData.userEmail - Email dell'utente che ha eseguito l'azione
 * @param {string} logData.userId - ID dell'utente
 * @param {string} logData.description - Descrizione dell'azione
 * @param {Object} logData.details - Dettagli aggiuntivi (opzionale)
 * @param {string} logData.ipAddress - Indirizzo IP (opzionale)
 * @param {string} logData.status - Stato dell'operazione ('SUCCESS' o 'FAILURE')
 */
export const logAction = async (logData) => {
  try {
    const auditLog = {
      action: logData.action,
      userEmail: logData.userEmail || 'anonymous',
      userId: logData.userId || 'unknown',
      description: logData.description,
      details: logData.details || {},
      ipAddress: logData.ipAddress || null,
      status: logData.status || 'SUCCESS',
      timestamp: Timestamp.now(),
      userAgent: navigator.userAgent,
    };

    await addDoc(collection(db, 'AuditLogs'), auditLog);
    console.log('Audit log registrato:', auditLog);
  } catch (error) {
    console.error('Errore nella registrazione audit log:', error);
    // Non lanciare errore per non bloccare l'operazione principale
  }
};

// Azioni predefinite
export const AUDIT_ACTIONS = {
  // Autenticazione
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  LOGIN_FAILED: 'LOGIN_FAILED',

  // Giocatori
  CREATE_PLAYER: 'CREATE_PLAYER',
  UPDATE_PLAYER: 'UPDATE_PLAYER',
  DELETE_PLAYER: 'DELETE_PLAYER',
  IMPORT_PLAYERS: 'IMPORT_PLAYERS',
  EXPORT_PLAYERS: 'EXPORT_PLAYERS',

  // Squadre
  CREATE_TEAM: 'CREATE_TEAM',
  UPDATE_TEAM: 'UPDATE_TEAM',
  DELETE_TEAM: 'DELETE_TEAM',
  IMPORT_TEAMS: 'IMPORT_TEAMS',
  RESTORE_TEAMS: 'RESTORE_TEAMS',

  // Scambi
  REQUEST_TRADE: 'REQUEST_TRADE',
  APPROVE_TRADE: 'APPROVE_TRADE',
  REJECT_TRADE: 'REJECT_TRADE',
  EVALUATE_TRADE: 'EVALUATE_TRADE',

  // Contratti
  RENEW_CONTRACT: 'RENEW_CONTRACT',
  EXPIRE_CONTRACT: 'EXPIRE_CONTRACT',

  // Associazioni
  ASSOCIATE_USER_TEAM: 'ASSOCIATE_USER_TEAM',
  REMOVE_USER_TEAM: 'REMOVE_USER_TEAM',

  // Amministrazione
  VIEW_AUDIT_LOGS: 'VIEW_AUDIT_LOGS',
  DOWNLOAD_BACKUP: 'DOWNLOAD_BACKUP',
  RESTORE_BACKUP: 'RESTORE_BACKUP',

  // Notifiche
  SEND_EMAIL: 'SEND_EMAIL',
  SEND_NOTIFICATION: 'SEND_NOTIFICATION',

  // Altri
  VIEW_PROFILE: 'VIEW_PROFILE',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  ERROR: 'ERROR',
};

export default logAction;
