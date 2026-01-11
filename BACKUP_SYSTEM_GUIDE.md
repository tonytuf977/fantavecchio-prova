# 🔄 SISTEMA DI BACKUP AUTOMATICO - GUIDA COMPLETA

## 📋 Indice
1. [Panoramica](#panoramica)
2. [Architettura](#architettura)
3. [Configurazione Firebase](#configurazione-firebase)
4. [Componenti del Sistema](#componenti-del-sistema)
5. [Backup Automatici](#backup-automatici)
6. [Gestione Backup](#gestione-backup)
7. [Ripristino](#ripristino)
8. [Pulizia Automatica](#pulizia-automatica)

---

## 📖 Panoramica

Il sistema di backup automatico salva una copia completa del database su un progetto Firebase separato ogni volta che vengono effettuate operazioni critiche:

- ✅ **Importazione Excel** di giocatori
- ✅ **Scambi tra giocatori** (approvazione/rifiuto)
- ✅ **Rinnovi di contratto**
- ✅ **Modifiche manuali** a giocatori/squadre
- ✅ **Backup manuali** on-demand

### Vantaggi:
- 🔒 **Sicurezza**: Backup su database separato (isolato da errori sul DB principale)
- ⏰ **Automatico**: Nessun intervento manuale richiesto
- 📅 **Retention 6 mesi**: Backup vecchi vengono eliminati automaticamente
- 🔄 **Ripristino completo**: Possibilità di tornare a qualsiasi versione precedente
- 📊 **Tracciabilità**: Ogni backup include metadati dettagliati

---

## 🏗️ Architettura

### Database Principale (`fantavecchio-testing`)
```
Collezioni:
├── Giocatori/
├── Squadre/
│   └── {squadraId}/
│       └── giocatori/
├── Utenti/
└── RichiesteScambio/
```

### Database Backup (`restore-tavecchio`)
```
Collezioni:
└── Backups/
    └── {backupId}/
        ├── backupType: string
        ├── description: string
        ├── timestamp: Timestamp
        ├── createdBy: string
        ├── userId: string
        ├── metadata: Object
        └── data: Object
            ├── giocatori: Array
            ├── squadre: Array (con giocatori nested)
            ├── utenti: Array
            └── richiesteScambio: Array
```

---

## ⚙️ Configurazione Firebase

### 1. Progetto Backup Firebase

Il sistema si connette a un secondo progetto Firebase dedicato esclusivamente ai backup:

**File**: `src/firebase/backupFirebase.js`

```javascript
const backupFirebaseConfig = {
  apiKey: "AIzaSyBu1t_A0tIOsTIsqyFOlHxVS_D0OPkAHUA",
  authDomain: "restore-tavecchio.firebaseapp.com",
  projectId: "restore-tavecchio",
  storageBucket: "restore-tavecchio.firebasestorage.app",
  messagingSenderId: "367804433274",
  appId: "1:367804433274:web:b60d359696854426050cc3",
  measurementId: "G-WCMJ9E0L0P"
};
```

### 2. Regole Firestore per Database Backup

Configurare le regole in Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /Backups/{backupId} {
      // Solo utenti autenticati possono leggere
      allow read: if request.auth != null;
      
      // Solo utenti autenticati possono creare backup
      allow create: if request.auth != null;
      
      // Solo admin possono eliminare backup
      allow delete: if request.auth != null && 
                       get(/databases/$(database)/documents/Utenti/$(request.auth.uid)).data.ruolo == 'admin';
    }
  }
}
```

---

## 🛠️ Componenti del Sistema

### 1. BackupService.js

Servizio principale per la gestione dei backup.

**Funzioni principali**:

#### `createBackup(backupType, description, metadata)`
Crea un nuovo backup completo del database.

```javascript
import { createBackup, BACKUP_TYPES } from '../service/BackupService';

await createBackup(
  BACKUP_TYPES.BEFORE_IMPORT,
  'Backup prima importazione Excel',
  { fileName: 'giocatori.xlsx' }
);
```

**Parametri**:
- `backupType`: Tipo di backup (vedi BACKUP_TYPES)
- `description`: Descrizione leggibile
- `metadata`: Oggetto con metadati aggiuntivi (opzionale)

**Ritorna**: `{ success: true, backupId: string, message: string }`

#### `getBackups()`
Recupera la lista di tutti i backup disponibili.

```javascript
const backups = await getBackups();
// Ritorna array di backup ordinati per data (più recenti prima)
```

#### `restoreBackup(backupId)`
Ripristina un backup specifico.

```javascript
await restoreBackup(backupId);
// ATTENZIONE: crea automaticamente un backup di sicurezza prima del ripristino
```

#### `cleanOldBackups()`
Elimina backup più vecchi di 6 mesi (eseguita automaticamente).

#### `deleteBackup(backupId)`
Elimina manualmente un backup specifico.

---

### 2. BACKUP_TYPES

Tipi di backup predefiniti:

```javascript
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
```

---

### 3. BackupManager Component

Interfaccia amministratore per visualizzare, creare e ripristinare backup.

**Rotta**: `/backup-manager` (solo admin)

**Funzionalità**:
- 📊 **Visualizza tutti i backup** con statistiche
- ➕ **Crea backup manuali**
- 🔄 **Ripristina backup** con conferma
- 🗑️ **Elimina backup** singoli
- 🔍 **Dettagli backup** con metadati completi
- 📥 **Esporta CSV** (opzionale)

---

## 🤖 Backup Automatici

I backup vengono creati automaticamente nei seguenti punti del codice:

### 1. ImportExcel.jsx

**Prima di importazione automatica da Fantacalcio.it**:
```javascript
await createBackup(
  BACKUP_TYPES.BEFORE_IMPORT,
  'Backup automatico prima import da Fantacalcio.it',
  { source: 'fantacalcio.it', importType: 'automatic' }
);
```

**Prima di importazione manuale Excel**:
```javascript
await createBackup(
  BACKUP_TYPES.BEFORE_IMPORT,
  `Backup automatico prima import manuale Excel: ${file.name}`,
  { fileName: file.name, importType: 'manual' }
);
```

---

### 2. GestioneScambiAdmin.jsx

**Prima di approvare uno scambio**:
```javascript
await createBackup(
  BACKUP_TYPES.BEFORE_TRADE,
  `Backup automatico prima dello scambio tra ${squadraRichiedenteNome} e ${squadraAvversariaNome}`,
  { 
    richiestaId,
    squadraRichiedente,
    squadraAvversaria,
    tipoScambio 
  }
);
```

---

### 3. RinnovoContratto.jsx

**Prima di ogni rinnovo contratto**:
```javascript
await createBackup(
  BACKUP_TYPES.BEFORE_CONTRACT,
  `Backup automatico prima rinnovo contratto giocatore: ${giocatore.nome}`,
  { giocatoreId, giocatoreNome: giocatore.nome, durata, squadraId }
);
```

---

### 4. AggiungiGiocatoreSquadra.jsx

**Prima di aggiungere/modificare giocatore**:
```javascript
await createBackup(
  BACKUP_TYPES.MANUAL,
  `Backup automatico prima di aggiungere giocatore ${giocatoreNome} alla squadra`,
  { giocatoreNome, squadraId, operation: 'add_player' }
);
```

---

## 🔄 Gestione Backup

### Accesso al Backup Manager

1. **Login come admin**
2. Vai a **HomePage** → **Backup Manager** (card nella sezione admin)
3. Oppure accedi direttamente a: `/backup-manager`

### Creare un Backup Manuale

1. Click su **"Crea Backup"**
2. Inserisci una descrizione (obbligatoria)
3. Click su **"Crea Backup"**
4. Attendi conferma di successo

### Visualizzare Dettagli Backup

1. Nella tabella backup, click sull'icona **👁️ (occhio)**
2. Visualizza:
   - Data/Ora creazione
   - Tipo backup
   - Creato da (email utente)
   - Statistiche (n° giocatori, squadre, utenti, richieste)
   - Metadati completi (JSON)

---

## 🔄 Ripristino

### ⚠️ IMPORTANTE - Procedura di Ripristino

Il ripristino è un'operazione **IRREVERSIBILE** che sostituisce tutti i dati correnti.

### Passaggi:

1. **Seleziona backup** nella tabella
2. Click su **🔄 (icona ripristino)**
3. **Leggi attentamente l'avviso**:
   - Tutti i dati correnti verranno sostituiti
   - Verrà creato un backup di sicurezza automatico prima del ripristino
4. **Conferma ripristino**
5. Attendi completamento (può richiedere alcuni minuti)
6. **La pagina verrà ricaricata automaticamente**

### Cosa Viene Ripristinato:

✅ Tutti i **Giocatori** (con statistiche, valori, contratti)  
✅ Tutte le **Squadre** (con rose complete)  
✅ Tutti gli **Utenti** (associazioni squadre)  
✅ Tutte le **RichiesteScambio** (in attesa, approvate, rifiutate)

### Backup di Sicurezza:

Prima di ogni ripristino, viene automaticamente creato un backup con tipo `BEFORE_RESTORE`:

```javascript
await createBackup(
  'BEFORE_RESTORE', 
  `Backup automatico prima del ripristino ${backupId}`,
  { restoringBackupId: backupId }
);
```

Questo permette di annullare il ripristino se necessario.

---

## 🗑️ Pulizia Automatica

### Retention Policy: 6 Mesi

I backup più vecchi di **6 mesi** vengono eliminati automaticamente:

- ✅ **Quando**: Ogni volta che viene creato un nuovo backup
- ✅ **Come**: Funzione `cleanOldBackups()` eseguita automaticamente
- ✅ **Log**: Eliminazioni registrate in console

```javascript
const sixMonthsAgo = new Date();
sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

// Trova e elimina backup più vecchi
const oldBackups = backupsSnapshot.docs.filter(doc => {
  const timestamp = doc.data().timestamp?.toDate();
  return timestamp && timestamp < sixMonthsAgo;
});
```

### Eliminazione Manuale

Gli admin possono eliminare manualmente qualsiasi backup:

1. Click su **🗑️ (icona cestino)** nella tabella
2. Conferma eliminazione
3. Il backup viene rimosso permanentemente

---

## 📊 Monitoraggio e Logging

### Audit Logs

Tutte le operazioni sui backup vengono registrate in **Audit Logs**:

- ✅ `DOWNLOAD_BACKUP`: Quando viene creato un backup
- ✅ `RESTORE_BACKUP`: Quando viene ripristinato un backup
- ✅ Dettagli: backupId, tipo, timestamp, utente

### Error Logs

Eventuali errori durante backup/ripristino vengono registrati in **Error Logs**:

- ❌ Errore creazione backup → `DATABASE_WRITE_ERROR` (CRITICAL)
- ❌ Errore ripristino backup → `DATABASE_WRITE_ERROR` (CRITICAL)

---

## 🔐 Sicurezza

### Accesso Limitato

- 🔒 Solo utenti **autenticati** possono visualizzare backup
- 🔒 Solo **admin** possono creare/ripristinare/eliminare backup
- 🔒 Verifica ruolo sia lato client che lato Firebase Rules

### Isolamento Database

- 🏢 Database backup **completamente separato** dal database principale
- 🛡️ In caso di corruzione database principale, i backup rimangono intatti
- 🌐 Diverso progetto Firebase con credenziali separate

---

## 🚀 Best Practices

### Quando Creare Backup Manuali

- 📅 **Prima di manutenzioni programmate**
- 🔧 **Prima di modifiche massive** (es: modifiche bulk a molti giocatori)
- 🧪 **Prima di testare nuove funzionalità** in produzione
- 📊 **Fine stagione** (backup storico)

### Cosa Controllare Prima di Ripristinare

1. ✅ **Data del backup**: È la versione corretta?
2. ✅ **Statistiche**: Numero giocatori/squadre corrisponde?
3. ✅ **Descrizione**: Conferma il contesto del backup
4. ✅ **Utenti informati**: Avvisa altri utenti del ripristino imminente

### Mantenimento Backup Strategici

Anche se i backup più vecchi di 6 mesi vengono eliminati automaticamente, considera di:

- 🏆 Scaricare backup di **fine stagione** esternamente
- 📸 Salvare backup prima di **eventi importanti** (es: asta iniziale)

---

## 🆘 Troubleshooting

### Problema: "Backup non trovato"

**Causa**: Il backup potrebbe essere stato eliminato o l'ID non esiste.

**Soluzione**:
1. Ricarica la pagina
2. Verifica che il backup sia ancora nella lista
3. Controlla la console Firebase (`restore-tavecchio` → Firestore → Backups)

---

### Problema: "Errore nella creazione del backup"

**Causa**: Problemi di connessione o permessi Firebase.

**Soluzione**:
1. Verifica connessione internet
2. Controlla credenziali Firebase (`backupFirebase.js`)
3. Verifica regole Firestore per collezione `Backups`
4. Controlla **Error Logs** per dettagli

---

### Problema: "Ripristino bloccato/lento"

**Causa**: Grandi quantità di dati da ripristinare.

**Soluzione**:
1. **NON ricaricare la pagina** durante il ripristino
2. Attendi completamento (può richiedere 2-5 minuti)
3. Se dopo 10 minuti non si completa, contatta supporto
4. Verifica in Firebase Console se i dati sono stati ripristinati

---

### Problema: "Backup troppo vecchi non vengono eliminati"

**Causa**: La funzione `cleanOldBackups()` potrebbe non essere eseguita.

**Soluzione**:
1. Crea un nuovo backup (la pulizia è automatica)
2. Oppure elimina manualmente i backup vecchi
3. Verifica console per eventuali errori

---

## 📈 Statistiche e Metriche

### Cosa Viene Salvato nei Metadata

Ogni backup include:

```javascript
metadata: {
  totalGiocatori: 500,        // Numero totale giocatori
  totalSquadre: 20,           // Numero totale squadre
  totalUtenti: 25,            // Numero totale utenti
  totalRichiesteScambio: 12,  // Numero richieste scambio
  // + metadati custom passati alla funzione
}
```

---

## 🔗 Link Utili

- **HomePage**: `/` → Card "Backup Manager" (solo admin)
- **Backup Manager**: `/backup-manager`
- **Audit Logs**: `/audit-logs`
- **Error Logs**: `/error-logs`
- **Firebase Console Backup**: https://console.firebase.google.com/project/restore-tavecchio

---

## 📝 Note Finali

- ✅ Il sistema è **completamente automatico** per le operazioni critiche
- ✅ I backup sono **incrementali** (salvano sempre lo stato completo)
- ✅ Nessun limite di numero backup (solo limite temporale di 6 mesi)
- ✅ Ogni ripristino crea un backup di sicurezza automatico
- ✅ Sistema testato e integrato con Audit/Error Logs esistenti

---

**Sistema di Backup v1.0**  
*Ultima modifica: 11 gennaio 2026*
