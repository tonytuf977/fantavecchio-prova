# Guida all'Integrazione Audit Logging

## Sistema di Audit Logging Implementato

È stato creato un sistema completo di audit logging per monitorare tutte le attività nell'applicazione. Il sistema comprende:

### File Creati

1. **`src/hook/useAuditLogs.js`** - Hook React per recuperare e filtrare i log
2. **`src/service/AuditService.js`** - Servizio per registrare le azioni
3. **`src/components/AuditLogs.jsx`** - Componente UI per visualizzare i log (solo admin)
4. **`src/components/AuditLogs.css`** - Stili per il componente

### Accesso

- Il componente AuditLogs è accessibile solo agli utenti con ruolo `admin`
- URL: `/audit-logs`
- Link aggiunto nella HomePage per gli amministratori

### Funzionalità

1. **Visualizzazione Log**: Tabella con tutti i log ordinati per data
2. **Filtri**: 
   - Per tipo di azione
   - Per email utente
   - Per intervallo di date
3. **Esportazione**: Possibilità di esportare i log in formato CSV
4. **Paginazione**: Caricamento progressivo dei log

## Come Integrare il Logging nei Componenti

### 1. Importare il servizio

```javascript
import { logAction, AUDIT_ACTIONS } from '../service/AuditService';
```

### 2. Registrare un'azione

```javascript
await logAction({
  action: AUDIT_ACTIONS.CREATE_PLAYER,
  userEmail: user.email,
  userId: user.uid,
  description: 'Creato nuovo giocatore: Mario Rossi',
  details: {
    playerName: 'Mario Rossi',
    team: 'Juventus',
    role: 'Centrocampista'
  },
  status: 'SUCCESS',
});
```

### 3. Parametri della funzione logAction

- **action** (obbligatorio): Tipo di azione da AUDIT_ACTIONS
- **userEmail** (obbligatorio): Email dell'utente
- **userId** (obbligatorio): ID Firebase dell'utente
- **description** (obbligatorio): Descrizione leggibile dell'azione
- **details** (opzionale): Oggetto con dettagli aggiuntivi
- **status** (opzionale): 'SUCCESS' o 'FAILURE' (default: 'SUCCESS')
- **ipAddress** (opzionale): Indirizzo IP dell'utente

### 4. Azioni Predefinite (AUDIT_ACTIONS)

#### Autenticazione
- `LOGIN` - Accesso utente
- `LOGOUT` - Disconnessione utente
- `REGISTER` - Registrazione nuovo utente
- `LOGIN_FAILED` - Tentativo di login fallito

#### Giocatori
- `CREATE_PLAYER` - Creazione giocatore
- `UPDATE_PLAYER` - Modifica giocatore
- `DELETE_PLAYER` - Eliminazione giocatore
- `IMPORT_PLAYERS` - Importazione giocatori da Excel
- `EXPORT_PLAYERS` - Esportazione giocatori

#### Squadre
- `CREATE_TEAM` - Creazione squadra
- `UPDATE_TEAM` - Modifica squadra
- `DELETE_TEAM` - Eliminazione squadra
- `IMPORT_TEAMS` - Importazione squadre
- `RESTORE_TEAMS` - Ripristino rose squadre

#### Scambi
- `REQUEST_TRADE` - Richiesta scambio
- `APPROVE_TRADE` - Approvazione scambio
- `REJECT_TRADE` - Rifiuto scambio
- `EVALUATE_TRADE` - Valutazione scambio

#### Contratti
- `RENEW_CONTRACT` - Rinnovo contratto
- `EXPIRE_CONTRACT` - Scadenza contratto

#### Associazioni
- `ASSOCIATE_USER_TEAM` - Associazione utente-squadra
- `REMOVE_USER_TEAM` - Rimozione associazione

#### Amministrazione
- `VIEW_AUDIT_LOGS` - Accesso ai log di audit
- `DOWNLOAD_BACKUP` - Download backup
- `RESTORE_BACKUP` - Ripristino backup

## Esempi di Implementazione

### Esempio 1: Login (già implementato in Login.jsx)

```javascript
// Login con successo
await logAction({
  action: AUDIT_ACTIONS.LOGIN,
  userEmail: user.email,
  userId: user.uid,
  description: `Login effettuato con successo - Ruolo: ${utenteDB.ruolo}`,
  details: { ruolo: utenteDB.ruolo },
  status: 'SUCCESS',
});

// Login fallito
await logAction({
  action: AUDIT_ACTIONS.LOGIN_FAILED,
  userEmail: email,
  userId: 'unknown',
  description: `Login fallito: ${error.message}`,
  details: { errorCode: error.code },
  status: 'FAILURE',
});
```

### Esempio 2: Creazione Giocatore

```javascript
// In AggiungiGiocatoreSquadra.jsx
import { logAction, AUDIT_ACTIONS } from '../service/AuditService';
import { auth } from '../firebase/firebase';

const handleAddPlayer = async (playerData) => {
  try {
    // Codice per aggiungere il giocatore...
    
    await logAction({
      action: AUDIT_ACTIONS.CREATE_PLAYER,
      userEmail: auth.currentUser?.email || 'unknown',
      userId: auth.currentUser?.uid || 'unknown',
      description: `Aggiunto giocatore: ${playerData.nome}`,
      details: {
        nome: playerData.nome,
        ruolo: playerData.ruolo,
        squadra: playerData.squadra,
      },
      status: 'SUCCESS',
    });
  } catch (error) {
    await logAction({
      action: AUDIT_ACTIONS.CREATE_PLAYER,
      userEmail: auth.currentUser?.email || 'unknown',
      userId: auth.currentUser?.uid || 'unknown',
      description: `Errore nell'aggiunta del giocatore: ${error.message}`,
      status: 'FAILURE',
    });
  }
};
```

### Esempio 3: Importazione Excel

```javascript
// In ImportExcel.jsx
const handleImport = async (excelData) => {
  try {
    // Codice per importare i dati...
    
    await logAction({
      action: AUDIT_ACTIONS.IMPORT_PLAYERS,
      userEmail: auth.currentUser?.email,
      userId: auth.currentUser?.uid,
      description: `Importati ${excelData.length} giocatori da Excel`,
      details: {
        numeroGiocatori: excelData.length,
        nomeFile: file.name,
      },
      status: 'SUCCESS',
    });
  } catch (error) {
    // Log errore...
  }
};
```

### Esempio 4: Scambio Giocatori

```javascript
// In RichiestaScambio.jsx
const handleTradeRequest = async (tradeData) => {
  try {
    // Codice per richiedere lo scambio...
    
    await logAction({
      action: AUDIT_ACTIONS.REQUEST_TRADE,
      userEmail: auth.currentUser?.email,
      userId: auth.currentUser?.uid,
      description: `Richiesta scambio tra ${tradeData.squadraA} e ${tradeData.squadraB}`,
      details: {
        squadraA: tradeData.squadraA,
        squadraB: tradeData.squadraB,
        giocatoriA: tradeData.giocatoriA,
        giocatoriB: tradeData.giocatoriB,
      },
      status: 'SUCCESS',
    });
  } catch (error) {
    // Log errore...
  }
};
```

## Componenti da Aggiornare

Per avere un sistema di audit completo, aggiungi il logging a questi componenti:

1. **Registrazione.jsx** - REGISTER
2. **AggiungiGiocatoreSquadra.jsx** - CREATE_PLAYER
3. **ModificaGiocatore.jsx** - UPDATE_PLAYER, DELETE_PLAYER
4. **ImportExcel.jsx** - IMPORT_PLAYERS
5. **ImportRoseExcel.jsx** - IMPORT_TEAMS
6. **RipristinoRoseSquadre.jsx** - RESTORE_TEAMS
7. **RichiestaScambio.jsx** - REQUEST_TRADE
8. **GestioneScambiAdmin.jsx** - APPROVE_TRADE, REJECT_TRADE
9. **ValutazioneScambio.jsx** - EVALUATE_TRADE
10. **RinnovoContratto.jsx** - RENEW_CONTRACT
11. **AssociaSquadreUtenti.jsx** - ASSOCIATE_USER_TEAM
12. **DownloadBackup.jsx** - DOWNLOAD_BACKUP
13. **ListaGiocatori.jsx** - DELETE_PLAYER (se presente)
14. **ListaSquadre.jsx** - UPDATE_TEAM, DELETE_TEAM (se presente)

## Note Importanti

1. Il logging è **asincrono** e non bloccante - anche se fallisce, l'operazione principale continua
2. Tutti i log vengono salvati nella collezione Firebase **`AuditLogs`**
3. I log includono automaticamente **timestamp**, **userAgent**, e altri metadati
4. La funzione `logAction` gestisce automaticamente gli errori senza propagarli
5. È importante loggare sia i successi che i fallimenti delle operazioni critiche

## Struttura Database Firebase

I log vengono salvati nella collezione `AuditLogs` con questa struttura:

```javascript
{
  action: "LOGIN",
  userEmail: "user@example.com",
  userId: "firebase-uid",
  description: "Login effettuato con successo",
  details: { ruolo: "admin" },
  status: "SUCCESS",
  timestamp: Timestamp,
  userAgent: "Mozilla/5.0...",
  ipAddress: null
}
```

## Best Practices

1. **Descrizioni chiare**: Scrivi descrizioni comprensibili per gli amministratori
2. **Dettagli rilevanti**: Includi solo informazioni utili nell'oggetto `details`
3. **Non loggare dati sensibili**: Evita password, token, dati personali sensibili
4. **Log tempestivi**: Registra l'azione immediatamente dopo che avviene
5. **Gestione errori**: Usa try-catch e logga anche i fallimenti
