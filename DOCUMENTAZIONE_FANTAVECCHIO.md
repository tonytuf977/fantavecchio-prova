# Documentazione FantaVecchio 2.0

## Descrizione dell'App

**FantaVecchio 2.0** è un'applicazione web React completa per la gestione di un campionato di fantacalcio. L'app permette agli utenti di gestire squadre, giocatori, scambi e rinnovi di contratto in un ambiente digitale moderno e intuitivo.

### Caratteristiche Principali
- **Gestione Squadre**: Visualizzazione e gestione di squadre di fantacalcio con rose complete
- **Sistema di Scambi**: Meccanismo completo per proporre, approvare e gestire scambi tra squadre
- **Rinnovi Contratti**: Sistema automatizzato per la gestione dei rinnovi dei contratti dei giocatori
- **Autenticazione Utenti**: Sistema di login/registrazione con controllo ruoli (utente/admin)
- **Import/Export Dati**: Funzionalità per importare ed esportare dati tramite file Excel
- **Notifiche Real-time**: Sistema di notifiche per richieste di scambio e rinnovi
- **Backup e Ripristino**: Funzionalità di backup automatico e ripristino delle rose

---

## Struttura Database Firebase

L'applicazione utilizza **Firebase Firestore** come database NoSQL con la seguente struttura:

### 🗂️ **Collezioni Principali**

#### **1. Squadre**
```
Squadre/
├── [squadraId]/
│   ├── nome: string
│   ├── valoreRosa: number
│   ├── crediti: number
│   ├── numeroGiocatori: number
│   ├── utenti: array
│   └── giocatori/  (sottocollezione)
│       └── [giocatoreId]/
│           ├── nome: string
│           ├── posizione: string
│           ├── gol: number
│           ├── presenze: number
│           ├── scadenza: string
│           ├── valoreIniziale: number
│           ├── valoreAttuale: number
│           ├── assist: number
│           ├── ammonizioni: number
│           ├── espulsioni: number
│           ├── autogol: number
│           ├── mediaVoto: number
│           ├── golSubiti: number
│           └── rigoriParati: number
```

#### **2. Giocatori** (Collezione principale)
```
Giocatori/
└── [giocatoreId]/
    ├── nome: string
    ├── posizione: string
    ├── gol: number
    ├── presenze: number
    ├── scadenza: string
    ├── valoreIniziale: number
    ├── valoreAttuale: number
    ├── assist: number
    ├── ammonizioni: number
    ├── espulsioni: number
    ├── autogol: number
    ├── mediaVoto: number
    ├── golSubiti: number
    ├── rigoriParati: number
    └── squadra: string (ID squadra di appartenenza)
```

#### **3. Utenti**
```
Utenti/
└── [utenteId]/
    ├── id: string
    ├── email: string
    ├── nome: string
    ├── cognome: string
    ├── ruolo: string (admin/utente)
    └── idSquadra: string (riferimento a Squadre)
```

#### **4. RichiesteScambio**
```
RichiesteScambio/
└── [richiestaId]/
    ├── squadraRichiedente: string
    ├── squadraAvversaria: string
    ├── giocatoriOfferti: array[string]
    ├── giocatoriRichiesti: array[string]
    ├── clausola: string
    ├── stato: string (In attesa/Approvata da admin/Completato/Rifiutato)
    ├── accettataAdmin: boolean
    ├── dataRichiesta: timestamp
    ├── dataScambio: timestamp (opzionale)
    └── valoriGiocatori: object
```

#### **5. RinnoviContratti**
```
RinnoviContratti/
└── [rinnovoId]/
    ├── squadraId: string
    ├── giocatori: array[string]
    ├── stato: string (In attesa/Completato)
    └── dataCreazione: timestamp
```

#### **6. BackupRose**
```
BackupRose/
└── [backupId]/
    ├── data: string (file Excel in base64)
    ├── timestamp: timestamp
    └── fileName: string
```

#### **7. Impostazioni**
```
Impostazioni/
└── [impostazioneId]/
    ├── nome: string
    └── valore: boolean/string/number
```

---

## 🚀 **Lista Funzionalità**

### **Autenticazione e Gestione Utenti**

#### **1. Login (`Login.js`)**
- **Descrizione**: Sistema di autenticazione utenti
- **Funzionalità**:
  - Login con email e password
  - Integrazione con Firebase Authentication
  - Reindirizzamento basato su ruolo utente
  - Gestione errori di autenticazione

#### **2. Registrazione (`Registrazione.js`)**
- **Descrizione**: Registrazione nuovi utenti
- **Funzionalità**:
  - Creazione account con email/password
  - Salvataggio dati utente in Firestore
  - Validazione campi
  - Assegnazione ruolo predefinito

#### **3. Profilo Utente (`Profili.js`)**
- **Descrizione**: Dashboard personale dell'utente
- **Funzionalità**:
  - Visualizzazione rosa squadra
  - Gestione richieste di scambio ricevute
  - Accettazione/Rifiuto scambi
  - Visualizzazione storico scambi
  - Gestione rinnovi contratti
  - Sistema notifiche

### **Gestione Squadre e Giocatori**

#### **4. Lista Squadre (`ListaSquadre.js`)**
- **Descrizione**: Visualizzazione e gestione squadre
- **Funzionalità**:
  - Tabella completa squadre con statistiche
  - Visualizzazione rosa giocatori per squadra
  - Filtri e ordinamento
  - Export Excel squadre
  - Eliminazione giocatori da rosa (solo admin)
  - Visualizzazione stato rinnovi pendenti

#### **5. Lista Giocatori (`ListaGiocatori.js`)**
- **Descrizione**: Database completo giocatori
- **Funzionalità**:
  - Visualizzazione tutti i giocatori
  - Filtri per posizione, squadra, stato
  - Ricerca per nome
  - Ordinamento per vari parametri
  - Statistiche dettagliate giocatori

#### **6. Modifica Giocatore (`ModificaGiocatore.js`)**
- **Descrizione**: Aggiornamento dati giocatori
- **Funzionalità**:
  - Modifica statistiche giocatore
  - Aggiornamento valori di mercato
  - Modifica scadenze contratti
  - Validazione dati inseriti

### **Sistema Scambi**

#### **7. Richiesta Scambio (`RichiestaScambio.js`)**
- **Descrizione**: Creazione nuove richieste di scambio
- **Funzionalità**:
  - Selezione squadra avversaria
  - Scelta giocatori da offrire/richiedere
  - Aggiunta clausole personalizzate
  - Controllo finestra scambi aperta/chiusa
  - Verifica richieste duplicate
  - Invio email notifica automatica

#### **8. Gestione Scambi Admin (`GestioneScambiAdmin.js`)**
- **Descrizione**: Approvazione scambi da parte admin
- **Funzionalità**:
  - Visualizzazione richieste in attesa
  - Approvazione/Rifiuto scambi
  - Invio notifiche email automatiche
  - Controllo validità scambi

#### **9. Valutazione Scambio (`ValutazioneScambio.jsx`)**
- **Descrizione**: Algoritmo intelligente per suggerimenti scambi
- **Funzionalità**:
  - Calcolo compatibilità giocatori
  - Analisi statistica avanzata
  - Suggerimenti scambi ottimali
  - Filtri per posizione e caratteristiche
  - Ricerca giocatori specifici

#### **10. Storico Scambi (`StoricoScambi.js`)**
- **Descrizione**: Cronologia completa scambi
- **Funzionalità**:
  - Visualizzazione tutti gli scambi effettuati
  - Ordinamento cronologico
  - Dettagli scambi con valori
  - Filtri per stato e data

### **Gestione Contratti**

#### **11. Rinnovo Contratto (`RinnovoContratto.js`)**
- **Descrizione**: Sistema automatizzato rinnovi
- **Funzionalità**:
  - Rinnovo contratti +12/+18 mesi
  - Aggiornamento automatico valori
  - Gestione scadenze
  - Controllo stato giocatori
  - Prevenzione rinnovi duplicati

### **Amministrazione**

#### **12. Import Excel (`ImportExcel.js`)**
- **Descrizione**: Importazione massiva dati da Excel
- **Funzionalità**:
  - Upload file Excel multipli fogli
  - Backup automatico rose esistenti
  - Parsing dati giocatori
  - Progress bar importazione
  - Validazione dati importati
  - Aggiornamento database Firestore

#### **13. Ripristino Rose Squadre (`RipristinoRoseSquadre.js`)**
- **Descrizione**: Gestione backup e ripristino
- **Funzionalità**:
  - Upload file backup
  - Ripristino rose da backup
  - Cancellazione dati esistenti
  - Progress bar ripristino
  - Validazione integrità dati

#### **14. Download Backup (`DownloadBackup.js`)**
- **Descrizione**: Scaricamento backup salvati
- **Funzionalità**:
  - Lista backup disponibili
  - Download file Excel backup
  - Visualizzazione data backup
  - Gestione file base64

#### **15. Aggiungi Giocatore Squadra (`AggiungiGiocatoreSquadra.js`)**
- **Descrizione**: Assegnazione giocatori alle squadre
- **Funzionalità**:
  - Selezione giocatore e squadra
  - Rimozione da squadra precedente
  - Aggiornamento rose squadre
  - Validazione trasferimenti

#### **16. Associa Squadre Utenti (`AssociaSquadreUtenti.js`)**
- **Descrizione**: Collegamento utenti alle squadre
- **Funzionalità**:
  - Assegnazione utenti a squadre
  - Controllo associazioni esistenti
  - Gestione permessi utente
  - Validazione associazioni

### **Funzionalità Speciali**

#### **17. Dado (`dado.js`)**
- **Descrizione**: Simulatore dado 3D per sorteggi
- **Funzionalità**:
  - Animazione dado 3D CSS
  - Estrazione casuale nomi utenti
  - Controllo permessi lancio
  - Effetti visivi e sonori

#### **18. Home Page (`HomePage.js`)**
- **Descrizione**: Dashboard principale applicazione
- **Funzionalità**:
  - Menu navigazione principale
  - Accesso rapido funzioni utente
  - Menu amministrazione (solo admin)
  - Visualizzazione notifiche

#### **19. Sistema Notifiche (`NotificheContext.js`)**
- **Descrizione**: Context React per notifiche real-time
- **Funzionalità**:
  - Conteggio scambi in attesa
  - Notifiche rinnovi pendenti
  - Aggiornamento automatico (ogni minuto)
  - Badge notifiche su navbar
  - Differenziazione notifiche per ruolo

#### **20. Navbar (`Navbar.js`)**
- **Descrizione**: Barra navigazione principale
- **Funzionalità**:
  - Menu utente con avatar
  - Badge notifiche
  - Logout sicuro
  - Navigazione responsive
  - Accesso rapido profilo

#### **21. Email Notification (`EmailNotification.js`)**
- **Descrizione**: Sistema notifiche email
- **Funzionalità**:
  - Integrazione EmailJS
  - Invio automatico email scambi
  - Template email personalizzati
  - Gestione errori invio

### **Custom Hooks**

#### **22. useSquadre (`useSquadre.js`)**
- **Descrizione**: Hook per gestione squadre
- **Funzionalità**:
  - Fetch squadre da Firestore
  - Stato loading e errori
  - Cache dati squadre
  - Auto-refresh dati

#### **23. useGiocatori (`useGiocatori.js`)**
- **Descrizione**: Hook per gestione giocatori
- **Funzionalità**:
  - Fetch giocatori da collezioni multiple
  - Gestione dati giocatori
  - Stato loading
  - Fallback su sottocollezioni

#### **24. useUtenti (`useUtenti.js`)**
- **Descrizione**: Hook per gestione utenti
- **Funzionalità**:
  - CRUD utenti completo
  - Gestione associazioni squadre
  - Validazione dati utente
  - Gestione errori

#### **25. useStoricoScambi (`useStoricoScambi.js`)**
- **Descrizione**: Hook per storico scambi
- **Funzionalità**:
  - Fetch storico scambi
  - Ordinamento cronologico
  - Gestione stato loading
  - Cache dati scambi

#### **26. useRinnovi (`useRinnovi.js`)**
- **Descrizione**: Hook per gestione rinnovi
- **Funzionalità**:
  - Aggiornamento stato rinnovi
  - Gestione operazioni asincrone
  - Controllo esistenza documenti

#### **27. useFirestore (`useFirestore.js`)**
- **Descrizione**: Hook generico per Firestore
- **Funzionalità**:
  - Accesso dati Firestore
  - Gestione squadre specifiche
  - Fetch giocatori squadra
  - Gestione errori generici

---

## 🔧 **Configurazione Firebase**

### **Configurazione Autenticazione**
- Email/Password Authentication abilitata
- Registrazione utenti gestita manualmente
- Controllo ruoli tramite campo `ruolo` in Firestore

### **Regole Firestore** (Consigliate)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Lettura pubblica per giocatori e squadre
    match /Giocatori/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /Squadre/{document} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Utenti possono leggere/modificare solo i propri dati
    match /Utenti/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Scambi leggibili da tutti gli autenticati
    match /RichiesteScambio/{document} {
      allow read, write: if request.auth != null;
    }
    
    // Rinnovi e backup solo per utenti autenticati
    match /RinnoviContratti/{document} {
      allow read, write: if request.auth != null;
    }
    
    match /BackupRose/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📋 **Tecnologie Utilizzate**

- **Frontend**: React 18, React Router, React Bootstrap
- **Backend**: Firebase (Firestore, Authentication)
- **Styling**: Bootstrap 5, CSS Custom
- **Icons**: React Bootstrap Icons
- **Excel**: SheetJS (xlsx)
- **Email**: EmailJS
- **Build**: Create React App

---

## 🚀 **Deployment**

L'applicazione è configurata per il deployment su:
- **Frontend**: Firebase Hosting (build/ directory)
- **Backend**: Firebase Firestore + Authentication
- **File di configurazione**: `firebase.json` presente nel progetto

---

## 📝 **Note Tecniche**

### **Gestione Stato**
- Context API per notifiche globali
- Custom hooks per gestione dati
- Local state per componenti UI

### **Performance**
- Lazy loading componenti
- Memoization nei custom hooks
- Batched updates Firestore

### **Sicurezza**
- Validazione lato client e server
- Controllo ruoli per funzioni admin
- Sanitizzazione input utente

### **Backup e Affidabilità**
- Backup automatico prima import/export
- Gestione errori robusta
- Recovery da stati inconsistenti

---

*Documentazione generata automaticamente per FantaVecchio 2.0 - Versione 2.0.0*
