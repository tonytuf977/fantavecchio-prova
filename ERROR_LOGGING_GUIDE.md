# Sistema Error Logging - Guida Rapida

## File Creati

1. **src/service/ErrorLogger.js** - Servizio per registrare errori
2. **src/hook/useErrorLogs.js** - Hook per recuperare error logs
3. **src/components/ErrorLogs.jsx** - Interfaccia per visualizzare gli errori (solo admin)
4. **src/components/ErrorLogs.css** - Stili per il componente
5. **src/components/ErrorBoundary.jsx** - Cattura errori React globalmente

## Funzionalità

### 1. Cattura Automatica Errori React
L'ErrorBoundary cattura automaticamente tutti gli errori che si verificano nel rendering dei componenti React.

### 2. Logging Manuale Errori
Usa `captureError` per loggare errori specifici nei blocchi catch:

```javascript
import { captureError, ERROR_TYPES, SEVERITY } from '../service/ErrorLogger';
import { auth } from '../firebase/firebase';

try {
  // codice che può generare errori
} catch (error) {
  await captureError(error, {
    errorType: ERROR_TYPES.DATABASE_WRITE_ERROR,
    component: 'NomeComponente',
    action: 'Descrizione azione',
    severity: SEVERITY.HIGH,
    userEmail: auth.currentUser?.email,
    userId: auth.currentUser?.uid,
    additionalInfo: {
      // dati aggiuntivi utili
    }
  });
}
```

### 3. Tipi di Errore Disponibili

```javascript
ERROR_TYPES = {
  // Runtime
  RUNTIME_ERROR, UNDEFINED_ERROR, NULL_REFERENCE, TYPE_ERROR,
  
  // Network/API
  NETWORK_ERROR, API_ERROR, TIMEOUT_ERROR,
  
  // Database
  FIREBASE_ERROR, DATABASE_READ_ERROR, DATABASE_WRITE_ERROR, PERMISSION_DENIED,
  
  // Auth
  AUTH_ERROR, UNAUTHORIZED, SESSION_EXPIRED,
  
  // File
  FILE_UPLOAD_ERROR, FILE_PARSE_ERROR, INVALID_FILE_FORMAT,
  
  // Validazione
  VALIDATION_ERROR, INVALID_INPUT,
  
  // Email
  EMAIL_ERROR, EMAIL_SEND_FAILED,
  
  // Altri
  UNKNOWN_ERROR, CONFIGURATION_ERROR
}
```

### 4. Livelli di Severità

- **CRITICAL**: App non funziona, serve intervento immediato
- **HIGH**: Funzionalità importante compromessa
- **MEDIUM**: Errore gestibile, funzionalità parzialmente compromessa
- **LOW**: Errore minore, non impatta funzionalità

## Accesso Error Logs

- **URL**: `/error-logs`
- **Permessi**: Solo amministratori
- **Link**: Aggiunto nella HomePage nella sezione admin

## Visualizzazione Error Logs

Il pannello Error Logs mostra:
- Data/ora dell'errore
- Tipo di errore
- Severità (con badge colorato)
- Componente dove è avvenuto
- Messaggio di errore
- Stack trace completo
- Utente che ha incontrato l'errore
- URL della pagina
- Informazioni aggiuntive
- Stato (risolto/non risolto)

## Filtri Disponibili

- Tipo di errore
- Severità
- Componente
- Intervallo di date
- Solo errori non risolti

## Funzionalità Aggiuntive

1. **Esportazione CSV**: Esporta tutti gli errori in formato CSV
2. **Segna come Risolto**: Marca errori dopo averli corretti
3. **Paginazione**: Caricamento progressivo (50 errori alla volta)
4. **Accordion**: Visualizzazione compatta con dettagli espandibili

## Componenti già Integrati

Il logging degli errori è già attivo in:
- ImportExcel.jsx
- RichiestaScambio.jsx
- GestioneScambiAdmin.jsx
- AggiungiGiocatoreSquadra.jsx
- ErrorBoundary (cattura globale)

## Struttura Dati nel Database

Collection: **ErrorLogs**

```javascript
{
  errorType: "DATABASE_WRITE_ERROR",
  errorMessage: "Failed to update document",
  component: "ImportExcel",
  action: "Importazione Automatica",
  errorStack: "Error: ...\n  at ...",
  additionalInfo: { ... },
  userEmail: "user@example.com",
  userId: "firebase-uid",
  severity: "HIGH",
  timestamp: Timestamp,
  userAgent: "Mozilla/5.0...",
  url: "http://localhost:3000/import",
  resolved: false
}
```

## Best Practices

1. **Usa il tipo di errore appropriato** per facilitare il debugging
2. **Specifica la severità corretta** per prioritizzare gli interventi
3. **Includi informazioni contestuali** in additionalInfo
4. **Non loggare dati sensibili** (password, token, etc.)
5. **Marca errori come risolti** dopo averli corretti per monitorare i progressi

## Benefici

✅ Monitoraggio completo degli errori senza backend
✅ Debugging più facile con stack trace e contesto
✅ Identificazione rapida di problemi ricorrenti
✅ Tracciabilità degli errori per utente
✅ Statistiche su errori critici vs minori
✅ Nessun errore perso, tutto viene registrato
