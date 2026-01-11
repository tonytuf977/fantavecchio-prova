// service/ErrorLogger.js
import { db } from '../firebase/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

/**
 * Registra un errore nella collezione ErrorLogs
 * @param {Object} errorData - Dati dell'errore
 * @param {string} errorData.errorType - Tipo di errore (RUNTIME_ERROR, API_ERROR, DATABASE_ERROR, etc.)
 * @param {string} errorData.errorMessage - Messaggio dell'errore
 * @param {string} errorData.component - Componente dove è avvenuto l'errore
 * @param {string} errorData.action - Azione che stava eseguendo l'utente
 * @param {Object} errorData.errorStack - Stack trace dell'errore
 * @param {Object} errorData.additionalInfo - Informazioni aggiuntive
 * @param {string} errorData.userEmail - Email dell'utente (se loggato)
 * @param {string} errorData.userId - ID dell'utente (se loggato)
 * @param {string} errorData.severity - Severità: CRITICAL, HIGH, MEDIUM, LOW
 */
export const logError = async (errorData) => {
  try {
    const errorLog = {
      errorType: errorData.errorType || 'UNKNOWN_ERROR',
      errorMessage: errorData.errorMessage || 'Unknown error occurred',
      component: errorData.component || 'Unknown Component',
      action: errorData.action || 'Unknown Action',
      errorStack: errorData.errorStack || null,
      additionalInfo: errorData.additionalInfo || {},
      userEmail: errorData.userEmail || 'anonymous',
      userId: errorData.userId || 'unknown',
      severity: errorData.severity || 'MEDIUM',
      timestamp: Timestamp.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      resolved: false, // Campo per marcare errori risolti
    };

    await addDoc(collection(db, 'ErrorLogs'), errorLog);
    console.error('Error logged to database:', errorLog);
  } catch (error) {
    // Se fallisce il logging, almeno logga in console
    console.error('Failed to log error to database:', error);
    console.error('Original error:', errorData);
  }
};

// Tipi di errore predefiniti
export const ERROR_TYPES = {
  // Errori Runtime
  RUNTIME_ERROR: 'RUNTIME_ERROR',
  UNDEFINED_ERROR: 'UNDEFINED_ERROR',
  NULL_REFERENCE: 'NULL_REFERENCE',
  TYPE_ERROR: 'TYPE_ERROR',
  
  // Errori API/Network
  NETWORK_ERROR: 'NETWORK_ERROR',
  API_ERROR: 'API_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  
  // Errori Database/Firebase
  FIREBASE_ERROR: 'FIREBASE_ERROR',
  DATABASE_READ_ERROR: 'DATABASE_READ_ERROR',
  DATABASE_WRITE_ERROR: 'DATABASE_WRITE_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  
  // Errori Autenticazione
  AUTH_ERROR: 'AUTH_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Errori File/Upload
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  FILE_PARSE_ERROR: 'FILE_PARSE_ERROR',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  
  // Errori Validazione
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Errori Email
  EMAIL_ERROR: 'EMAIL_ERROR',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  
  // Altri
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
};

// Livelli di severità
export const SEVERITY = {
  CRITICAL: 'CRITICAL', // App non funziona, serve intervento immediato
  HIGH: 'HIGH',         // Funzionalità importante compromessa
  MEDIUM: 'MEDIUM',     // Errore gestibile, funzionalità parzialmente compromessa
  LOW: 'LOW',           // Errore minore, non impatta funzionalità
};

/**
 * Helper per catturare e loggare errori in modo consistente
 * @param {Error} error - Oggetto errore
 * @param {Object} context - Contesto dove è avvenuto l'errore
 */
export const captureError = async (error, context = {}) => {
  const errorData = {
    errorType: context.errorType || ERROR_TYPES.RUNTIME_ERROR,
    errorMessage: error.message || 'Unknown error',
    component: context.component || 'Unknown',
    action: context.action || 'Unknown action',
    errorStack: error.stack || null,
    additionalInfo: {
      errorName: error.name,
      errorCode: error.code,
      ...context.additionalInfo,
    },
    userEmail: context.userEmail,
    userId: context.userId,
    severity: context.severity || SEVERITY.MEDIUM,
  };

  await logError(errorData);
};

export default logError;
