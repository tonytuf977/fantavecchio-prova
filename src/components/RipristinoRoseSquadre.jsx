import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { db } from '../firebase/firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ProgressBar } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './RipristinoRoseSquadre.css';

function RipristinoRoseSquadre() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState(0);

  // Funzione per caricare la mappa ID dai giocatori esistenti nel database
  const caricaMappaIdDaDatabase = async () => {
    try {
      console.log('🔍 Caricamento mappa ID dal database...');
      const giocatoriSnapshot = await getDocs(collection(db, 'Giocatori'));
      
      console.log(`✅ Trovati ${giocatoriSnapshot.docs.length} giocatori nel database`);
      
      // Debug: mostra alcuni ID della collezione
      const primiId = giocatoriSnapshot.docs.slice(0, 10).map(doc => doc.id);
      console.log('🔍 Primi 10 ID nella collezione:', primiId);
      
      return giocatoriSnapshot.docs.length;
    } catch (error) {
      console.error('❌ Errore nel caricamento dal database:', error);
      return 0;
    }
  };

  // Funzione per normalizzare i nomi per il matching
  const normalizzaNome = (nome) => {
    return nome.toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalizza spazi multipli
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Rimuove accenti
  };

  // Funzione per convertire data Excel in formato ISO
  const formatScadenza = (scadenza) => {
    console.log(`🔍 Input scadenza: "${scadenza}" (tipo: ${typeof scadenza})`);
    
    // Solo se è veramente vuoto restituisce null
    if (scadenza === null || scadenza === undefined || scadenza === '' || scadenza === 'N/A' || scadenza === 'null') {
      console.log('❌ Scadenza veramente vuota, restituisco null');
      return null;
    }

    // Converti sempre a stringa prima
    const scadenzaStr = scadenza.toString().trim();
    console.log(`📝 Scadenza come stringa: "${scadenzaStr}"`);
    
    // Solo se è ESATTAMENTE "0" considera come null
    if (scadenzaStr === '0') {
      console.log('❄️ Scadenza è esattamente "0", restituisco null (contratto congelato)');
      return null;
    }
    
    // Se è già in formato YYYY-MM-DD, restituisce così com'è
    if (/^\d{4}-\d{2}-\d{2}$/.test(scadenzaStr)) {
      console.log(`✅ Data già in formato corretto: ${scadenzaStr}`);
      return scadenzaStr;
    }
    
    // ✅ MIGLIORAMENTO: Gestione numeri seriali Excel più precisa
    if (!isNaN(scadenzaStr) && parseFloat(scadenzaStr) > 0) {
      const numero = parseFloat(scadenzaStr);
      
      // Se è un numero grande (>1000), probabilmente è un numero seriale Excel
      if (numero > 1000) {
        try {
          // Formula corretta per numeri seriali Excel
          const excelDate = new Date((numero - 25569) * 86400 * 1000);
          if (!isNaN(excelDate.getTime()) && excelDate.getFullYear() > 1900 && excelDate.getFullYear() < 2100) {
            const formattedDate = excelDate.toISOString().split('T')[0];
            console.log(`✅ Numero seriale Excel ${scadenzaStr} -> ${formattedDate}`);
            return formattedDate;
          }
        } catch (e) {
          console.warn(`⚠️ Errore conversione numero seriale: ${scadenzaStr}`, e);
        }
      }
      
      // Se è un numero tra 25-99, interpreta come anno 2025-2099
      if (numero >= 25 && numero <= 99) {
        const anno = 2000 + numero;
        const scadenzaAnno = new Date(anno, 5, 30); // 30 giugno dell'anno
        const formattedDate = scadenzaAnno.toISOString().split('T')[0];
        console.log(`✅ Numero come anno: ${scadenzaStr} -> anno ${anno} -> ${formattedDate}`);
        return formattedDate;
      }
      
      // Se è un numero piccolo (1-24), interpreta come mesi da oggi
      if (numero >= 1 && numero <= 24) {
        const oggi = new Date();
        oggi.setMonth(oggi.getMonth() + numero);
        const formattedDate = oggi.toISOString().split('T')[0];
        console.log(`✅ Numero come mesi da oggi: ${scadenzaStr} mesi -> ${formattedDate}`);
        return formattedDate;
      }
      
      // FALLBACK: Se non rientra in nessuna categoria, crea una data di default
      const dataDefault = new Date();
      dataDefault.setFullYear(dataDefault.getFullYear() + 1); // +1 anno da oggi
      const formattedDefault = dataDefault.toISOString().split('T')[0];
      console.log(`⚠️ Numero non categorizzato ${scadenzaStr}, uso default: ${formattedDefault}`);
      return formattedDefault;
    }
    
    // ✅ MIGLIORAMENTO: Gestione formati data più flessibile
    if (scadenzaStr.includes('/') || scadenzaStr.includes('-') || scadenzaStr.includes('.')) {
      try {
        let dateObj;
        
        // Sostituisci punti con slash per uniformità
        let dateStr = scadenzaStr.replace(/\./g, '/');
        
        if (dateStr.includes('/') && dateStr.split('/').length === 3) {
          const parts = dateStr.split('/');
          
          // Determina il formato basandosi sulla lunghezza delle parti
          if (parts[2].length === 4) {
            // Anno a 4 cifre alla fine: DD/MM/YYYY o MM/DD/YYYY
            if (parseInt(parts[0]) <= 12 && parseInt(parts[1]) > 12) {
              // Primo numero ≤ 12 e secondo > 12 → MM/DD/YYYY
              dateObj = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
            } else if (parseInt(parts[0]) > 12 && parseInt(parts[1]) <= 12) {
              // Primo numero > 12 e secondo ≤ 12 → DD/MM/YYYY
              dateObj = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            } else {
              // Ambiguo, assume DD/MM/YYYY (formato europeo)
              dateObj = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            }
          } else if (parts[0].length === 4) {
            // Anno a 4 cifre all'inizio: YYYY/MM/DD
            dateObj = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
          }
        } else if (dateStr.includes('-')) {
          dateObj = new Date(dateStr);
        }
        
        if (dateObj && !isNaN(dateObj.getTime()) && dateObj.getFullYear() > 1900 && dateObj.getFullYear() < 2100) {
          const formattedDate = dateObj.toISOString().split('T')[0];
          console.log(`✅ Formato data con separatori ${scadenzaStr} -> ${formattedDate}`);
          return formattedDate;
        }
      } catch (e) {
        console.warn(`⚠️ Errore parsing data: ${scadenzaStr}`, e);
      }
    }

    // ULTIMATE FALLBACK: Crea sempre una data di default invece di restituire null
    const dataFallback = new Date();
    dataFallback.setFullYear(dataFallback.getFullYear() + 2); // +2 anni da oggi
    const formattedFallback = dataFallback.toISOString().split('T')[0];
    console.log(`🚨 FALLBACK per "${scadenzaStr}": uso data di default ${formattedFallback}`);
    return formattedFallback;
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Seleziona un file prima di caricare.');
      return;
    }

    setProgress(0);
    setMessage('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const totalSheets = workbook.SheetNames.length;
      let sheetsProcessed = 0;

      for (const sheetName of workbook.SheetNames) {
        console.log(`\n📋 Processando foglio: ${sheetName}`);
        const sheet = workbook.Sheets[sheetName];
        
        // Forza la lettura come testo per evitare conversioni automatiche delle date
        const jsonData = XLSX.utils.sheet_to_json(sheet, { 
          header: 1, 
          defval: null,
          raw: false,  // ✅ Forza tutto come testo
          dateNF: 'yyyy-mm-dd'  // ✅ Formato data preferito
        });

        if (jsonData.length < 3) {
          sheetsProcessed++;
          setProgress(Math.round((sheetsProcessed / totalSheets) * 100));
          continue;
        }

        // ✅ ESTRAZIONE NOME SQUADRA pulito da A1 (rimuovi "Squadra:" se presente)
        let nomeSquadra = jsonData[0][0]?.toString() || sheetName; // A1 - Nome squadra
        if (nomeSquadra.toLowerCase().startsWith('squadra:')) {
          nomeSquadra = nomeSquadra.substring(8).trim(); // Rimuove "squadra:" (8 caratteri)
        }
        
        // ✅ ESTRAZIONE CORRETTA CREDITI dalla sintassi "Crediti:[numero]"
        const creditiRaw = jsonData[0][2]?.toString() || '';
        const crediti = parseFloat(creditiRaw.replace(/^Crediti:/i, '').trim()) || 0;
        
        // ✅ ESTRAZIONE ID SQUADRA dalla colonna R1 - FORZA lettura diretta dalla cella
        let idSquadra = sheetName; // Default al nome del foglio se non trovato
        
        console.log('🔍 DEBUG R1: Cerco ID squadra in R1...');
        console.log('📊 Prima riga jsonData:', jsonData[0]);
        
        // ✅ LETTURA CORRETTA: L'ID squadra è in R1 (riga 1, colonna R = indice 17)
        if (jsonData.length > 0 && jsonData[0] && jsonData[0][17]) {
          const cellR1 = jsonData[0][17]?.toString().trim();
          console.log('📊 Contenuto cella R1:', cellR1);
          
          // Estrai solo l'ID dalla stringa "ID Squadra: XXXXX" o "ID: XXXXX"
          if (cellR1.includes('ID Squadra:')) {
            idSquadra = cellR1.replace('ID Squadra:', '').trim();
          } else if (cellR1.includes('ID:')) {
            idSquadra = cellR1.replace('ID:', '').trim();
          } else {
            idSquadra = cellR1; // Usa direttamente il valore se non ha prefissi
          }
          console.log('✅ ID Squadra estratto da R1:', idSquadra);
        } else {
          // Se jsonData non funziona, prova lettura diretta dalla cella
          const cellR1 = sheet[XLSX.utils.encode_cell({r: 0, c: 17})]; // Riga 1 (indice 0), Colonna R (indice 17)
          console.log('📊 Cella R1 diretta:', cellR1);
          if (cellR1 && cellR1.v !== undefined && cellR1.v !== null) {
            const cellValue = cellR1.v.toString().trim();
            if (cellValue.includes('ID Squadra:')) {
              idSquadra = cellValue.replace('ID Squadra:', '').trim();
            } else if (cellValue.includes('ID:')) {
              idSquadra = cellValue.replace('ID:', '').trim();
            } else {
              idSquadra = cellValue;
            }
            console.log('✅ ID Squadra dalla cella diretta R1:', idSquadra);
          } else {
            console.warn('⚠️ ID Squadra non trovato in R1 per il foglio', sheetName, 'uso nome foglio come fallback');
            idSquadra = sheetName;
          }
        }
        
        console.log('📋 DOCUMENTO:', idSquadra, '| CAMPO nome:', nomeSquadra, '| CAMPO crediti:', crediti);

        const squadraRef = doc(db, 'Squadre', idSquadra); // ✅ USA L'ID SQUADRA da R1 come nome documento
        const giocatoriSquadraRef = collection(squadraRef, 'giocatori');

        // ✅ PULISCI COMPLETAMENTE LA SQUADRA PRIMA DI RIEMPIRLA
        console.log('🧹 Pulizia completa squadra', idSquadra);
        
        // Elimina tutti i giocatori principali esistenti
        const giocatoriEsistenti = await getDocs(giocatoriSquadraRef);
        for (const docSnapshot of giocatoriEsistenti.docs) {
          await deleteDoc(docSnapshot.ref);
        }
        
        // Elimina tutti i giovani esistenti
        const listaGiovaniRef = collection(squadraRef, 'listaGiovani');
        const giovaniEsistenti = await getDocs(listaGiovaniRef);
        for (const docSnapshot of giovaniEsistenti.docs) {
          await deleteDoc(docSnapshot.ref);
        }

        let valoreRosaTotale = 0;
        let giocatoriAggiunti = 0;
        let giocatoriCreati = 0;
        let giocatoriAggiornati = 0;
        let scadenzeImportate = 0;
        let scadenzeNull = 0;
        let idTrovati = 0;
        let idMancanti = 0;

        // ✅ INIZIA DALLA RIGA 3 (indice 2) perché le prime 2 righe sono intestazioni
        for (let i = 2; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row[0]) continue; // Salta se non c'è ID/nome nella colonna A

          // ✅ MAPPATURA CORRETTA SECONDO LA TUA STRUTTURA:
          // A3 = ID/Nome (row[0])
          // C3 = Posizione (row[2]) 
          // D3 = Competizione (row[3])
          // E3 = Tipo (row[4]) - NUOVO CAMPO
          // F3 = Gol (row[5])
          // G3 = Presenze (row[6])
          // H3 = Valore Iniziale (row[7])
          // I3 = Valore Attuale (row[8])
          // J3 = Scadenza (row[9])
          // K3 = Ammonizioni (row[10])
          // L3 = Assist (row[11])
          // M3 = Autogol (row[12])
          // N3 = Espulsioni (row[13])
          // O3 = Gol Subiti (row[14])
          // P3 = Media Voto (row[15])
          // Q3 = Rigori Parati (row[16])
          // R3 = Squadra Serie A (row[17])

          // Leggi direttamente dalla cella Excel per la scadenza (colonna J)
          const cellScadenza = sheet[XLSX.utils.encode_cell({r: i, c: 9})]; // Colonna J (indice 9)
          let scadenzaRaw = null;
          
          if (cellScadenza) {
            if (cellScadenza.w) {
              scadenzaRaw = cellScadenza.w;  // Valore formattato
            } else if (cellScadenza.v) {
              scadenzaRaw = cellScadenza.v;  // Valore grezzo
            }
          }

          // ✅ NUOVA LOGICA: La colonna A dell'Excel FantaVecchio_squadre contiene l'ID UNIVOCO
          // L'ID è sia il nome del documento che il campo id del giocatore
          const idGiocatore = row[0]?.toString(); // ID dalla colonna A dell'Excel
          const nomeGiocatoreExcel = row[1]?.toString(); // Nome dalla colonna B dell'Excel (se presente)
          
          if (!idGiocatore) {
            console.log('⚠️ Saltando riga', i, ': ID mancante nella colonna A');
            idMancanti++;
            continue;
          } else {
            idTrovati++;
          }

          // ✅ CERCA IL GIOCATORE NEL DATABASE USANDO L'ID COME CHIAVE
          let nomeGiocatoreReale = nomeGiocatoreExcel || idGiocatore; // Default: nome da Excel o ID come fallback
          let giocatoreEsistente = null;
          
          try {
            // Cerca il giocatore nella collezione principale usando l'ID come chiave documento
            const giocatoreRef = doc(db, 'Giocatori', idGiocatore);
            const giocatoreDoc = await getDoc(giocatoreRef);
            
            if (giocatoreDoc.exists()) {
              giocatoreEsistente = giocatoreDoc.data();
              // ✅ Priorità: Nome dall'Excel > Nome dal DB > ID come fallback
              nomeGiocatoreReale = nomeGiocatoreExcel || giocatoreEsistente.nome || idGiocatore;
              console.log('🔗 Giocatore esistente trovato: ID', idGiocatore, '-> Nome', nomeGiocatoreReale);
            } else {
              // ✅ Nuovo giocatore: usa nome dall'Excel se presente, altrimenti ID
              nomeGiocatoreReale = nomeGiocatoreExcel || idGiocatore;
              console.log('🆕 Nuovo giocatore: ID', idGiocatore, '-> Nome', nomeGiocatoreReale, '(verrà creato)');
            }
          } catch (error) {
            console.error('❌ Errore nella ricerca per ID', idGiocatore, ':', error);
          }

          console.log('\n👤 Processando giocatore: ID', idGiocatore, '-> Nome', nomeGiocatoreReale);
          console.log('📊 Dati Excel:', {
            posizione: row[2],
            competizione: row[3], 
            tipo: row[4],         // ✅ NUOVO: Legge il tipo dalla colonna E
            gol: row[5],         // ✅ AGGIORNATO: Gol dalla colonna F
            presenze: row[6],    // ✅ AGGIORNATO: Presenze dalla colonna G
            scadenzaRaw: scadenzaRaw,
            valoreIniziale: row[7],
            valoreAttuale: row[8],
            assist: row[11],     // ✅ AGGIORNATO: Assist dalla colonna L
            ammonizioni: row[10], // ✅ AGGIORNATO: Ammonizioni dalla colonna K
            espulsioni: row[13],  // ✅ AGGIORNATO: Espulsioni dalla colonna N
            autogol: row[12],     // ✅ AGGIORNATO: Autogol dalla colonna M
            voto: row[15],        // ✅ AGGIORNATO: Voto dalla colonna P
            golSubiti: row[14],   // ✅ AGGIORNATO: Gol Subiti dalla colonna O
            rigoriParati: row[16], // ✅ AGGIORNATO: Rigori Parati dalla colonna Q
            squadraSerieA: row[17] // ✅ AGGIORNATO: Squadra Serie A dalla colonna R
          });
          
          const scadenzaProcessata = formatScadenza(scadenzaRaw);
          console.log('📅 Scadenza finale per', nomeGiocatoreReale, ':', scadenzaProcessata);
          
          // Conta le scadenze
          if (scadenzaProcessata === null) {
            scadenzeNull++;
          } else {
            scadenzeImportate++;
          }

          const giocatore = {
            id: idGiocatore,
            nome: nomeGiocatoreReale,
            posizione: row[2]?.toString() || '',
            competizioni: row[3]?.toString() || '',
            tipo: row[4]?.toString() || 'Principale', // ✅ NUOVO: Legge il tipo dalla colonna E
            gol: Number(row[5]) || 0,        // ✅ AGGIORNATO: Gol dalla colonna F
            presenze: Number(row[6]) || 0,   // ✅ AGGIORNATO: Presenze dalla colonna G
            scadenza: scadenzaProcessata,
            valoreIniziale: Number(row[7]) || 0,
            valoreAttuale: Number(row[8]) || 0,
            assist: Number(row[11]) || 0,    // ✅ AGGIORNATO: Assist dalla colonna L
            ammonizioni: Number(row[10]) || 0, // ✅ AGGIORNATO: Ammonizioni dalla colonna K
            espulsioni: Number(row[13]) || 0,  // ✅ AGGIORNATO: Espulsioni dalla colonna N
            autogol: Number(row[12]) || 0,     // ✅ AGGIORNATO: Autogol dalla colonna M
            voto: Number(row[15]) || 0,        // ✅ AGGIORNATO: Voto dalla colonna P
            golSubiti: Number(row[14]) || 0,   // ✅ AGGIORNATO: Gol Subiti dalla colonna O
            rigoriParati: Number(row[16]) || 0, // ✅ AGGIORNATO: Rigori Parati dalla colonna Q
            squadra: idSquadra,  // ✅ IMPORTANTE: Usa l'ID squadra dal foglio, non il nome
            squadraSerieA: row[17]?.toString() || null, // ✅ AGGIORNATO: Squadra Serie A dalla colonna R
            tempoCongelamento: row[18] ? Number(row[18]) : null // ✅ AGGIORNATO: Tempo Congelamento dalla colonna S
          };

          // ✅ Aggiungi al totale valore rosa
          valoreRosaTotale += giocatore.valoreAttuale;

          console.log('💾 Salvando giocatore:');
          console.log('   📝 Nome:', giocatore.nome);
          console.log('   🆔 ID:', giocatore.id);
          console.log('   📋 Tipo:', giocatore.tipo); // ✅ NUOVO LOG
          console.log('   🏠 Squadra ID:', giocatore.squadra); // ✅ AGGIORNATO: Mostra ID squadra
          console.log('🔍 Path documento: Squadre/', idSquadra, '/giocatori/', giocatore.id);

          // ✅ SALVA: documento con ID dalla colonna A come chiave, dati corretti dentro
          const giocatoreRef = doc(giocatoriSquadraRef, giocatore.id); // Chiave documento = ID dalla colonna A
          await setDoc(giocatoreRef, giocatore, { merge: false }); // ✅ merge: false sovrascrive completamente

          // ✅ Aggiorna/Crea anche nella collezione principale - FORZA SOVRASCRITTURA COMPLETA
          const giocatorePrincipaleRef = doc(db, 'Giocatori', giocatore.id); // Chiave documento = ID dalla colonna A
          await setDoc(giocatorePrincipaleRef, giocatore, { merge: false }); // ✅ merge: false sovrascrive completamente

          // ✅ NUOVO: GESTIONE LISTA GIOVANI BASATA SUL CAMPO "TIPO"
          if (giocatore.tipo === 'Giovane') {
            console.log('👶 Aggiungendo', giocatore.nome, 'alla lista giovani...');
            const giocatoreGiovaneRef = doc(listaGiovaniRef, giocatore.id);
            await setDoc(giocatoreGiovaneRef, giocatore, { merge: false });
            console.log('✅', giocatore.nome, 'aggiunto alla lista giovani');
          } else {
            console.log('👥', giocatore.nome, 'aggiunto alla lista giocatori principali');
          }

          if (giocatoreEsistente) {
            giocatoriAggiornati++;
          } else {
            giocatoriCreati++;
          }

          giocatoriAggiunti++;
        }

        // ✅ SALVA I DATI DELLA SQUADRA aggiornati con il valore rosa calcolato
        await setDoc(squadraRef, {
          nome: nomeSquadra,
          crediti: crediti,
          valoreRosa: valoreRosaTotale
        }, { merge: true });

        console.log('\n📊 RIEPILOGO FOGLIO', sheetName, ':');
        console.log('🏟️ Squadra:', nomeSquadra, '(ID:', idSquadra, ')');
        console.log('💰 Crediti:', crediti, '€');
        console.log('💎 Valore Rosa Totale:', valoreRosaTotale, '€');
        console.log('👥 Giocatori aggiunti:', giocatoriAggiunti);
        console.log('🔄 Giocatori aggiornati:', giocatoriAggiornati);
        console.log('🆕 Giocatori creati:', giocatoriCreati);
        console.log('📅 Scadenze importate:', scadenzeImportate);
        console.log('❄️ Contratti congelati:', scadenzeNull);
        console.log('🆔 ID trovati:', idTrovati);
        console.log('⚠️ ID mancanti:', idMancanti);

        sheetsProcessed++;
        setProgress(Math.round((sheetsProcessed / totalSheets) * 100));
      }

      setMessage('✅ Caricamento completato con successo!');
    } catch (error) {
      console.error('❌ Errore durante il caricamento:', error);
      setMessage('❌ Errore durante il caricamento: ' + error.message);
    }
  };

  return (
    <div className="container mt-5">
      <h2>📊 Ripristino Rose Squadre da Excel</h2>
      
      <div className="mb-3">
        <label className="form-label">Seleziona file Excel (.xlsx/.xls):</label>
        <input
          type="file"
          className="form-control"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
        />
      </div>

      <button
        onClick={handleUpload}
        className="btn btn-primary"
        disabled={!file}
      >
        🚀 Carica e Ripristina Rose
      </button>

      {progress > 0 && (
        <div className="mt-3">
          <div className="progress">
            <div
              className="progress-bar"
              role="progressbar"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {progress}%
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className={`alert mt-3 ${message.includes('✅') ? 'alert-success' : message.includes('❌') ? 'alert-danger' : 'alert-info'}`}>
          {message}
        </div>
      )}
    </div>
  );
}

export default RipristinoRoseSquadre;