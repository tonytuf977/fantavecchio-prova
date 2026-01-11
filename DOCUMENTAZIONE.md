# 📚 DOCUMENTAZIONE COMPLETA FANTAVECCHIO APP

## 📋 Indice
1. [Panoramica del Progetto](#panoramica-del-progetto)
2. [Architettura del Sistema](#architettura-del-sistema)
3. [Struttura del Database Firebase](#struttura-del-database-firebase)
4. [Componenti React](#componenti-react)
5. [Hook Personalizzati](#hook-personalizzati)
6. [Sistema di Autenticazione](#sistema-di-autenticazione)
7. [Sistema di Scambi](#sistema-di-scambi)
8. [Sistema di Rinnovi](#sistema-di-rinnovi)
9. [Import/Export Dati](#importexport-dati)
10. [Configurazione Firebase](#configurazione-firebase)

---

## 🎯 Panoramica del Progetto

**FantaVecchio App** è un'applicazione web React per la gestione di un fantacalcio personalizzato. Permette di:
- Gestire squadre e giocatori
- Effettuare scambi tra utenti
- Rinnovare contratti dei giocatori
- Importare/esportare dati da Excel
- Sistema di notifiche email
- Gestione amministrativa completa

### Tecnologie Utilizzate
- **Frontend**: React 18, React Router, Bootstrap 5
- **Backend**: Firebase (Firestore, Authentication)
- **Database**: Cloud Firestore
- **Email**: EmailJS
- **File Processing**: XLSX (SheetJS)
- **Animazioni**: AOS (Animate On Scroll)

---

## 🏗️ Architettura del Sistema

```
FantaVecchio App
├── Frontend (React)
│   ├── Components/
│   ├── Hooks/
│   └── Firebase Config
├── Backend (Firebase)
│   ├── Firestore Database
│   ├── Authentication
│   └── Storage
└── External Services
    └── EmailJS
```

---

## 🗄️ Struttura del Database Firebase

### 📊 Collezioni Principali

#### **1. Utenti**
```javascript
{
  id: "uid_firebase",
  email: "user@example.com",
  nome: "Nome Utente",
  ruolo: "admin" | "utente",
  idSquadra: "squadra_id",
  isDado: boolean // Per il dado eliminazione
}
```

#### **2. Squadre**
```javascript
{
  id: "squadra_id",
  nome: "Nome Squadra",
  crediti: 1000,
  valoreRosa: 25000,
  numeroGiocatori: 28,
  
  // Sottocollezioni:
  giocatori: {
    giocatore_id: { ...datiGiocatore }
  },
  listaGiovani: {
    giocatore_id: { ...datiGiocatore }
  }
}
```

#### **3. Giocatori**
```javascript
{
  id: "giocatore_id",
  nome: "Nome Giocatore",
  posizione: "A" | "C" | "M" | "D" | "Por",
  squadra: "squadra_id",
  squadraSerieA: "squadra_serie_a_id",
  
  // Statistiche
  gol: 5,
  presenze: 20,
  assist: 3,
  ammonizioni: 2,
  espulsioni: 0,
  autogol: 0,
  voto: 6.5,
  rigoriParati: 0,
  golSubiti: 0,
  
  // Valori economici
  valoreIniziale: 100,
  valoreAttuale: 120,
  scadenza: "2025-06-30", // null se congelato
  tempoCongelamento: 12, // mesi di congelamento
  
  // Altri campi
  competizioni: "Serie A, Champions",
  tipo: "Principale" | "Giovane"
}
```

#### **4. RichiesteScambio**
```javascript
{
  id: "richiesta_id",
  squadraRichiedente: "squadra_id",
  squadraAvversaria: "squadra_id",
  tipoScambio: "giocatori" | "crediti",
  
  // Per scambi giocatori
  giocatoriOfferti: ["giocatore_id1", "giocatore_id2"],
  giocatoriRichiesti: ["giocatore_id3", "giocatore_id4"],
  
  // Per scambi crediti
  giocatoreRichiesto: "giocatore_id",
  creditiOfferti: 500,
  
  // Stato e date
  stato: "In attesa" | "Approvata da admin" | "Completato" | "Rifiutata",
  dataRichiesta: "2024-01-15",
  dataScambio: "2024-01-16",
  accettataAdmin: boolean,
  accettataAvversario: boolean,
  
  clausola: "Eventuali clausole aggiuntive"
}
```

#### **5. RinnoviContratti**
```javascript
{
  id: "rinnovo_id",
  squadraId: "squadra_id",
  giocatori: ["giocatore_id1", "giocatore_id2"],
  stato: "In attesa" | "Completato",
  dataCreazione: "2024-01-15",
  tipo: "post-scambio" | "manuale"
}
```

#### **6. Impostazioni**
```javascript
// Documento: finestraScambi
{
  aperta: boolean,
  dataApertura: "2024-01-15",
  oraApertura: "10:00",
  dataChiusura: "2024-01-20",
  oraChiusura: "18:00"
}

// Documento: sessioneRinnovi
{
  aperta: boolean,
  dataApertura: "2024-01-15",
  oraApertura: "10:00",
  dataChiusura: "2024-01-20",
  oraChiusura: "18:00"
}
```

#### **7. BackupRose**
```javascript
{
  id: "backup_id",
  fileName: "FantaVecchio_squadre_2024-01-15_10-30-45.xlsx",
  data: "base64_excel_data",
  timestamp: FirebaseTimestamp
}
```

---

## 🧩 Componenti React

### 📱 Componenti Principali

#### **Home.jsx / HomePage.jsx**
- **Funzione**: Pagina principale dell'applicazione
- **Caratteristiche**:
  - Dashboard con link a tutte le sezioni
  - Animazioni AOS
  - Contatore notifiche per admin
  - Download documenti (regolamento, albo d'oro, ecc.)
  - Accesso condizionato basato sui ruoli

```javascript
// Funzionalità principali
- Controllo autenticazione utente
- Visualizzazione condizionale per admin
- Contatore notifiche scambi in attesa
- Links dinamici ai vari componenti
```

#### **ListaGiocatori.jsx**
- **Funzione**: Visualizza tutti i giocatori del database
- **Caratteristiche**:
  - Ricerca per nome giocatore
  - Tabella responsive con tutte le statistiche
  - Conversione ID squadra → Nome squadra

```javascript
// Funzioni principali
const fetchGiocatori = async () => {
  // Carica tutti i giocatori da Firestore
}

const handleSearchChange = (e) => {
  // Filtra giocatori in base al termine di ricerca
}

const getNomeSquadra = (squadraId) => {
  // Converte ID squadra in nome leggibile
}
```

#### **ListaSquadre.jsx**
- **Funzione**: Gestione completa delle squadre (solo admin)
- **Caratteristiche**:
  - Visualizzazione dettagliata di ogni squadra
  - Modifica inline dei giocatori
  - Gestione liste giovani
  - Filtri per scadenze e competizioni
  - Export Excel per squadre filtrate
  - Gestione tempi congelamento contratti

```javascript
// Funzioni principali
const handleSquadraClick = (squadra) => {
  // Carica giocatori della squadra selezionata
}

const handleEdit = (giocatoreId, field, value) => {
  // Modifica campo giocatore in tempo reale
}

const verificaScadenze = async () => {
  // Controlla e corregge scadenze errate
}

const exportFilteredSquadre = async () => {
  // Esporta squadre filtrate in Excel
}
```

#### **RichiestaScambio.jsx**
- **Funzione**: Interfaccia per creare richieste di scambio
- **Caratteristiche**:
  - Due tipi di scambio: giocatori e solo crediti
  - Validazione crediti disponibili
  - Controllo duplicati
  - Sistema finestra scambi automatica
  - Invio email notifiche

```javascript
// Funzioni principali
const handleSubmit = async (e) => {
  // Crea e invia richiesta di scambio
}

const verificaRichiestaDuplicata = async () => {
  // Previene richieste duplicate
}

const toggleFinestraScambi = async (nuovoStato) => {
  // Apre/chiude finestra scambi con notifica email
}
```

#### **Profili.jsx**
- **Funzione**: Profilo utente e gestione scambi ricevuti
- **Caratteristiche**:
  - Visualizzazione dati utente e squadra
  - Accettazione/rifiuto scambi ricevuti
  - Gestione rinnovi post-scambio
  - Storico scambi personale
  - Impostazioni account (nome squadra, email, password)

```javascript
// Funzioni principali
const handleAccettaScambio = async (richiesta) => {
  // Elabora scambio accettato
  // Crea automaticamente richieste di rinnovo
}

const scambiaGiocatori = async (...params) => {
  // Esegue trasferimento giocatori tra squadre
}

const creaRichiestaRinnovo = async (squadraId, giocatori) => {
  // Crea richieste rinnovo automatiche post-scambio
}
```

#### **GestioneScambiAdmin.jsx**
- **Funzione**: Pannello admin per approvare/rifiutare scambi
- **Caratteristiche**:
  - Lista richieste in attesa
  - Approvazione con invio email automatico
  - Gestione sessione rinnovi
  - Programmazione apertura/chiusura automatica

```javascript
// Funzioni principali
const handleApprova = async (richiesta) => {
  // Approva scambio e invia notifica email
}

const toggleSessioneRinnovi = async (nuovoStato) => {
  // Gestisce apertura/chiusura sessione rinnovi
}
```

#### **StoricoScambi.jsx**
- **Funzione**: Visualizza storico completo scambi
- **Caratteristiche**:
  - Filtri per categoria (completati, rifiutati, in attesa)
  - Conversione ID → nomi reali
  - Eliminazione scambi (solo admin)
  - Ordinamento per data

```javascript
// Funzioni principali
const filtraPerCategoria = (scambi) => {
  // Filtra scambi per stato
}

const handleDeleteScambio = async () => {
  // Elimina scambio dallo storico (solo admin)
}
```

### 📊 Componenti di Import/Export

#### **ImportExcel.jsx**
- **Funzione**: Import giocatori da Excel (Gazzetta formato)
- **Processo**:
  1. Backup automatico delle rose attuali
  2. Lettura primo foglio Excel
  3. Aggiornamento batch giocatori esistenti
  4. Calcolo automatico valori attuali

#### **ImportRoseExcel.jsx**
- **Funzione**: Import rose complete da file leghe
- **Processo**:
  1. Parsing struttura complessa Excel (10 squadre)
  2. Associazione giocatori tramite nome
  3. Creazione/aggiornamento squadre
  4. Report dettagliato associazioni

#### **RipristinoRoseSquadre.jsx**
- **Funzione**: Ripristino completo da backup Excel
- **Caratteristiche**:
  - Pulizia completa squadre esistenti
  - Ripristino dati da ogni foglio Excel
  - Gestione scadenze e valori
  - Creazione giocatori mancanti

### 🔄 Componenti di Gestione

#### **RinnovoContratto.jsx**
- **Funzione**: Gestisce rinnovi contratti giocatori
- **Logica rinnovo**:
  - 12 mesi: valore / 2
  - 18 mesi: valore * 0.75
  - Soglie minime: 100€ e 200€

#### **ValutazioneScambio.jsx**
- **Funzione**: Suggerisce scambi compatibili
- **Algoritmo compatibilità**:
  - Peso posizione: 25%
  - Peso presenze: 15%
  - Peso gol: 15%
  - Altri parametri: 45%

#### **Dado.jsx**
- **Funzione**: Sistema eliminazione casuale
- **Caratteristiche**:
  - Solo utenti con flag `isDado` possono utilizzarlo
  - Lista nomi hardcoded
  - Animazione 3D dado

---

## 🎣 Hook Personalizzati

### **useUtenti.js**
```javascript
// Gestisce stato globale utenti
const { utenti, loading, addUtente } = useUtenti();
```

### **useSquadre.js**
```javascript
// Gestisce stato globale squadre
const { squadre, isLoading, setSquadre } = useSquadre();
```

### **useGiocatori.js**
```javascript
// Gestisce stato globale giocatori
const { giocatori, loading, error } = useGiocatori();
```

### **useStoricoScambi.js**
```javascript
// Gestisce storico scambi con refresh
const { storicoScambi, loading, refreshStoricoScambi } = useStoricoScambi();
```

### **useRinnovi.js**
```javascript
// Gestisce sistema rinnovi
const { loading, aggiornaStatoRinnovo } = useRinnovi();
```

---

## 🔐 Sistema di Autenticazione

### Flusso di Autenticazione
1. **Registrazione**: Crea utente Firebase + documento Firestore
2. **Login**: Verifica credenziali + ruolo utente
3. **Persistenza**: LocalStorage per ruolo e email
4. **Auto-logout**: Timer 1 ora per sicurezza

### Livelli di Accesso
- **Utente**: Visualizzazione, richieste scambio, profilo
- **Admin**: Tutte le funzioni + gestione, import/export
- **Dittatore**: Accesso speciale al dado eliminazione

---

## 🔄 Sistema di Scambi

### Tipi di Scambio
1. **Scambio Giocatori**: 1 o più giocatori ↔ 1 o più giocatori (+ crediti opzionali)
2. **Offerta Crediti**: Solo crediti → 1 giocatore

### Flusso Scambio
1. **Richiesta**: Utente crea richiesta
2. **Approvazione Admin**: Admin approva/rifiuta
3. **Accettazione**: Squadra destinataria accetta/rifiuta
4. **Esecuzione**: Trasferimento automatico giocatori/crediti
5. **Rinnovi**: Creazione automatica richieste rinnovo

### Stati Scambio
- `In attesa`: In attesa approvazione admin
- `Approvata da admin`: Approvata, in attesa accettazione
- `Completato`: Scambio eseguito
- `Rifiutata`: Rifiutata da admin o utente

---

## 📝 Sistema di Rinnovi

### Logica Rinnovi
```javascript
// Calcolo nuovo valore
if (durata === 12) nuovoValore = Math.ceil(valoreAttuale / 2);
if (durata === 18) nuovoValore = Math.ceil(valoreAttuale * 0.75);

// Soglie minime
if (valoreAttuale >= 200 && nuovoValore <= 200) nuovoValore = 200;
if (valoreAttuale >= 100 && nuovoValore <= 100) nuovoValore = 100;
```

### Creazione Automatica
- **Post-scambio**: Ogni giocatore ricevuto genera richiesta rinnovo
- **Scadenze**: Sistema verifica e notifica scadenze imminenti

---

## 📧 Sistema Email (EmailJS)

### Configurazione
```javascript
const EMAILJS_SERVICE_ID = 'service_0knpeti';
const EMAILJS_TEMPLATE_ID = 'template_8eoqu2a';
const EMAILJS_PUBLIC_KEY = '1P283n6VVbx-OeBKb';
```

### Eventi Email
- Finestra scambi aperta/chiusa
- Sessione rinnovi aperta/chiusa
- Scambio approvato da admin
- Notifiche sistema

---

## 📁 Import/Export Dati

### Formati Supportati
- **Excel XLSX/XLS**: Import/export completo
- **Base64**: Storage backup in Firestore

### Strutture Excel

#### Import Giocatori (Gazzetta)
```
A: ID | B: Nome | C: Posizione | D: Squadra Serie A | ...
```

#### Import Rose (Leghe)
```
Struttura 10 squadre disposte in 2x5:
- Righe 5,37,69,101,133 = Nomi squadre
- Colonne A-D = Prime 5 squadre
- Colonne F-I = Seconde 5 squadre
```

---

## ⚙️ Configurazione Firebase

### Configurazione Progetto
```javascript
//produzione
const firebaseConfig = {
  apiKey: "AIzaSyD5UU84jDRwEBVgcwqmx13dPdOFQgw6kFU",
  authDomain: "fantavecchio-bf3a7.firebaseapp.com",
  projectId: "fantavecchio-bf3a7",
  storageBucket: "fantavecchio-bf3a7.firebasestorage.app",
  messagingSenderId: "214231639753",
  appId: "1:214231639753:web:98b65149b1e0d828584f18"
};
//testing 
const firebaseConfig = {
  apiKey: "AIzaSyARdAe3_15_Ny4tjbg9tdadCJo0BPImIM4",
  authDomain: "fantavecchio-manager.firebaseapp.com",
  projectId: "fantavecchio-manager",
  storageBucket: "fantavecchio-manager.firebasestorage.app",
  messagingSenderId: "1087765312837",
  appId: "1:1087765312837:web:06741c3f2b6f89efcaba2c"
};
```


### Regole Firestore
```javascript
// Lettura: tutti gli utenti autenticati
// Scrittura: solo admin per modifiche critiche
// Utenti: solo propri dati modificabili
```

---

## 🚀 Deployment e Performance

### Ottimizzazioni
- **Lazy Loading**: Componenti caricati on-demand
- **Batch Operations**: Scritture multiple raggruppate
- **Caching**: Hook personalizzati con stato persistente
- **Debouncing**: Input fields per evitare chiamate eccessive

### Monitoraggio
- Console logging estensivo
- Error boundaries per gestione errori
- Progress bars per operazioni lunghe
- Loading states per UX ottimale

---

## 📝 Note Sviluppo

### Pattern Utilizzati
- **Context Pattern**: Per stato globale notifiche
- **Custom Hooks**: Per logica riutilizzabile
- **Compound Components**: Per componenti complessi
- **Error Boundaries**: Per gestione errori robusta

### Convenzioni
- **Naming**: camelCase per variabili, PascalCase per componenti
- **File Structure**: Componenti in `/components`, hooks in `/hooks`
- **Comments**: Commenti estensivi per logica complessa
- **Error Handling**: Try/catch con logging dettagliato

### Sicurezza
- **Validazioni**: Client-side e server-side
- **Sanitizzazione**: Input utente sempre validato
- **Autorizzazioni**: Controlli ruolo multipli
- **Rate Limiting**: Prevenzione spam richieste

---

## 🔧 Manutenzione

### Backup Automatici
- Backup rose prima di ogni import maggiore
- Storage in Firestore come base64
- Download backup disponibile via interfaccia

### Monitoring
- Log estensivi in console
- Tracking errori e performance
- Notifiche email per eventi critici

### Updates
- Versioning semantico
- Migrazioni database documentate
- Testing prima di deploy produzione

---

*Documentazione aggiornata: Settembre 2025*
*Versione App: 2.0*