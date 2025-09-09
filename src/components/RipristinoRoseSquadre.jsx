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
        
        // ✅ ESTRAZIONE ID SQUADRA dalla colonna Q3 - FORZA lettura diretta dalla cella
        let idSquadra = sheetName; // Default al nome del foglio se non trovato
        
        // ✅ DEBUGGING COMPLETO per trovare l'ID squadra in Q3
        console.log(`🔍 DEBUG Q3: Cerco ID squadra in Q3...`);
        console.log(`📊 Lunghezza jsonData: ${jsonData.length}`);
        console.log(`📊 Prima riga jsonData:`, jsonData[0]);
        if (jsonData.length > 2) {
          console.log(`📊 Terza riga jsonData (indice 2):`, jsonData[2]);
          console.log(`📊 Valore in jsonData[2][16] (colonna Q):`, jsonData[2] ? jsonData[2][16] : 'undefined');
        }
        
        // Prova prima con jsonData dalla riga 3 (indice 2)
        if (jsonData.length > 2 && jsonData[2] && jsonData[2][16]) {
          idSquadra = jsonData[2][16]?.toString().trim();
          console.log(`✅ ID Squadra trovato in jsonData[2][16]: "${idSquadra}"`);
        } else {
          // Se jsonData non funziona, prova lettura diretta dalla cella
          const cellQ3 = sheet[XLSX.utils.encode_cell({r: 2, c: 16})]; // Riga 3 (indice 2), Colonna Q (indice 16)
          console.log(`📊 Cella Q3 diretta:`, cellQ3);
          if (cellQ3 && cellQ3.v !== undefined && cellQ3.v !== null) {
            idSquadra = cellQ3.v.toString().trim();
            console.log(`✅ ID Squadra trovato in cella Q3: "${idSquadra}"`);
          } else {
            console.warn(`⚠️ Q3 vuota in entrambi i metodi, uso nome foglio: "${idSquadra}"`);
            // Prova anche altre celle vicine per debug
            const cellP3 = sheet[XLSX.utils.encode_cell({r: 2, c: 15})]; // Colonna P
            const cellR3 = sheet[XLSX.utils.encode_cell({r: 2, c: 17})]; // Colonna R
            console.warn(`🔍 Debug celle vicine - P3:`, cellP3, 'R3:', cellR3);
          }
        }
        
        console.log(`📋 DOCUMENTO: "${idSquadra}" | CAMPO nome: "${nomeSquadra}" | CAMPO crediti: ${crediti}`);

        const squadraRef = doc(db, 'Squadre', idSquadra); // ✅ USA L'ID SQUADRA da Q3 come nome documento
        const giocatoriSquadraRef = collection(squadraRef, 'giocatori');

        const giocatoriEsistenti = await getDocs(giocatoriSquadraRef);
        for (const docSnapshot of giocatoriEsistenti.docs) {
          await deleteDoc(docSnapshot.ref);
        }

        let giocatoriAggiunti = 0;
        let scadenzeImportate = 0;
        let scadenzeNull = 0;
        let giocatoriAggiornati = 0;
        let giocatoriCreati = 0;
        let valoreRosaTotale = 0; // Calcola il valore totale della rosa
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
          // E3 = Gol (row[4])
          // F3 = Presenze (row[5])
          // G3 = Scadenza (row[6])
          // H3 = Valore Iniziale (row[7])
          // I3 = Valore Attuale (row[8])
          // J3 = Assist (row[9])
          // K3 = Ammonizioni (row[10])
          // L3 = Espulsioni (row[11])
          // M3 = Autogol (row[12])
          // N3 = Media Voto (row[13])
          // O3 = Gol Subiti (row[14])
          // P3 = Rigori Parati (row[15])
          // Q3 = ID Squadra (row[16])

          // Leggi direttamente dalla cella Excel per la scadenza (colonna G)
          const cellScadenza = sheet[XLSX.utils.encode_cell({r: i, c: 6})]; // Colonna G (indice 6)
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
            console.log(`⚠️ Saltando riga ${i}: ID mancante nella colonna A`);
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
              console.log(`🔗 Giocatore esistente trovato: ID "${idGiocatore}" -> Nome "${nomeGiocatoreReale}"`);
            } else {
              // ✅ Nuovo giocatore: usa nome dall'Excel se presente, altrimenti ID
              nomeGiocatoreReale = nomeGiocatoreExcel || idGiocatore;
              console.log(`🆕 Nuovo giocatore: ID "${idGiocatore}" -> Nome "${nomeGiocatoreReale}" (verrà creato)`);
            }
          } catch (error) {
            console.error(`❌ Errore nella ricerca per ID ${idGiocatore}:`, error);
          }

          console.log(`\n👤 Processando giocatore: ID "${idGiocatore}" -> Nome "${nomeGiocatoreReale}"`);
          console.log(`📊 Dati Excel:`, {
            posizione: row[2],
            competizione: row[3], 
            gol: row[4],
            presenze: row[5],
            scadenzaRaw: scadenzaRaw,
            valoreIniziale: row[7],
            valoreAttuale: row[8],
            assist: row[9],
            ammonizioni: row[10],
            espulsioni: row[11],
            autogol: row[12],
            voto: row[13],
            golSubiti: row[14],
            rigoriParati: row[15]
          });
          
          const scadenzaProcessata = formatScadenza(scadenzaRaw);
          console.log(`📅 Scadenza finale per "${nomeGiocatoreReale}": "${scadenzaProcessata}"`);
          
          // Conta le scadenze
          if (scadenzaProcessata === null) {
            scadenzeNull++;
          } else {
            scadenzeImportate++;
          }

          const giocatore = {
            id: idGiocatore, // ✅ ID dalla colonna A dell'Excel (es: "4431", "Vlahovic", etc.)
            nome: nomeGiocatoreReale, // ✅ Nome del giocatore (preso dal DB o default all'ID)
            posizione: row[2]?.toString() || '', // C3 - Posizione
            competizioni: row[3]?.toString() || '', // D3 - Competizione  
            gol: Number(row[4]) || 0, // E3 - Gol
            presenze: Number(row[5]) || 0, // F3 - Presenze
            scadenza: scadenzaProcessata, // G3 - Scadenza (processata)
            valoreIniziale: Number(row[7]) || 0, // H3 - Valore Iniziale
            valoreAttuale: Number(row[8]) || 0, // I3 - Valore Attuale
            assist: Number(row[9]) || 0, // J3 - Assist
            ammonizioni: Number(row[10]) || 0, // K3 - Ammonizioni
            espulsioni: Number(row[11]) || 0, // L3 - Espulsioni
            autogol: Number(row[12]) || 0, // M3 - Autogol
            voto: Number(row[13]) || 0, // N3 - Media Voto
            golSubiti: Number(row[14]) || 0, // O3 - Gol Subiti
            rigoriParati: Number(row[15]) || 0, // P3 - Rigori Parati
            squadra: idSquadra, // ✅ USA L'ID SQUADRA estratto da Q3
            // ✅ Campo aggiuntivo per compatibilità
            squadraSerieA: row[17]?.toString() || null,
            tempoCongelamento: row[18] ? Number(row[18]) : null
          };

          // ✅ Aggiungi al totale valore rosa
          valoreRosaTotale += giocatore.valoreAttuale;

          console.log(`💾 Salvando giocatore:`);
          console.log(`   📝 Nome: "${giocatore.nome}"`);
          console.log(`   🆔 ID: "${giocatore.id}"`);
          console.log(`   🏠 Squadra: "${giocatore.squadra}"`);
          console.log(`🔍 Path documento: Squadre/${idSquadra}/giocatori/${giocatore.id}`);

          // ✅ SALVA: documento con ID dalla colonna A come chiave, dati corretti dentro
          const giocatoreRef = doc(giocatoriSquadraRef, giocatore.id); // Chiave documento = ID dalla colonna A
          await setDoc(giocatoreRef, giocatore, { merge: false }); // ✅ merge: false sovrascrive completamente

          // ✅ Aggiorna/Crea anche nella collezione principale - FORZA SOVRASCRITTURA COMPLETA
          const giocatorePrincipaleRef = doc(db, 'Giocatori', giocatore.id); // Chiave documento = ID dalla colonna A
          await setDoc(giocatorePrincipaleRef, giocatore, { merge: false }); // ✅ merge: false sovrascrive completamente

          console.log(`✅ Documento salvato/aggiornato:`);
          console.log(`   🗂️  Chiave documento: "${giocatore.id}" (ID dalla colonna A dell'Excel)`);
          console.log(`   📋 Campo nome: "${giocatore.nome}" (nome del giocatore)`);
          console.log(`   🆔 Campo id: "${giocatore.id}" (ID dalla colonna A dell'Excel)`);
          console.log(`   📅 Scadenza: "${giocatore.scadenza}"`);
          console.log(`   💰 Valore iniziale: ${giocatore.valoreIniziale}`);
          console.log(`   💰 Valore attuale: ${giocatore.valoreAttuale}`);
          console.log(`   ${giocatoreEsistente ? '🔄 AGGIORNATO' : '🆕 CREATO'} in Lista Giocatori\n`);

          // ✅ Conta se è stato aggiornato o creato
          if (giocatoreEsistente) {
            giocatoriAggiornati++;
          } else {
            giocatoriCreati++;
          }

          giocatoriAggiunti++;
        }
        
        console.log(`\n📊 RIEPILOGO SQUADRA ${sheetName}:`);
        console.log(`👥 Giocatori aggiunti: ${giocatoriAggiunti}`);
        console.log(`🔄 Giocatori aggiornati: ${giocatoriAggiornati}`);
        console.log(`🆕 Giocatori creati: ${giocatoriCreati}`);
        console.log(`✅ Scadenze importate: ${scadenzeImportate}`);
        console.log(`❌ Scadenze null: ${scadenzeNull}`);
        console.log(`🔗 ID trovati nel database: ${idTrovati}`);
        console.log(`⚠️ ID mancanti (temporanei): ${idMancanti}`);
        console.log(`💰 Valore rosa totale: ${valoreRosaTotale}€`);
        console.log(`💳 Crediti estratti: ${crediti}€`);
        console.log(`📄 Documento creato: "Squadre/${idSquadra}" con nome="${nomeSquadra}" e crediti=${crediti}`);
        console.log(`📈 Percentuale successo scadenze: ${Math.round((scadenzeImportate / (scadenzeImportate + scadenzeNull)) * 100)}%`);
        console.log(`🆔 Percentuale ID trovati: ${Math.round((idTrovati / (idTrovati + idMancanti)) * 100)}%`);

        await setDoc(squadraRef, { 
          nome: nomeSquadra, // ✅ Nome dalla cella A1
          valoreRosa: valoreRosaTotale, // ✅ Valore calcolato dalla somma giocatori
          crediti: crediti, // ✅ Crediti dalla cella C1
          numeroGiocatori: giocatoriAggiunti
        }, { merge: true });

        sheetsProcessed++;
        setProgress(Math.round((sheetsProcessed / totalSheets) * 100));
      }

      setMessage('Ripristino rose completato con successo');
    } catch (error) {
      console.error('Errore durante il caricamento dei dati da Excel:', error);
      setMessage('Errore durante il caricamento dei dati da Excel: ' + error.message);
    }
  };

  // Funzione per verificare e correggere ID temporanei dopo l'import
  const verificaECorreggiIdTemporanei = async () => {
    try {
      console.log('🔧 Inizio verifica e correzione ID temporanei...');
      
      const giocatoriSnapshot = await getDocs(collection(db, 'Giocatori'));
      const giocatoriTemporanei = [];
      
      giocatoriSnapshot.docs.forEach(doc => {
        if (doc.id.startsWith('TEMP_')) {
          giocatoriTemporanei.push({
            id: doc.id,
            ...doc.data()
          });
        }
      });
      
      if (giocatoriTemporanei.length === 0) {
        console.log('✅ Nessun ID temporaneo trovato');
        return;
      }
      
      console.log(`⚠️ Trovati ${giocatoriTemporanei.length} giocatori con ID temporanei:`);
      giocatoriTemporanei.forEach(g => {
        console.log(`   - ${g.nome} (ID temporaneo: ${g.id})`);
      });
      
      // Mostra suggerimenti per la correzione manuale
      setMessage(`⚠️ Trovati ${giocatoriTemporanei.length} giocatori con ID temporanei. Controlla la console per i dettagli.`);
      
    } catch (error) {
      console.error('❌ Errore nella verifica ID temporanei:', error);
    }
  };

  // Funzione per ripristinare le statistiche di tutti i giocatori di TUTTE le squadre
  const ripristinaStatisticheTutteSquadre = async () => {
    try {
      setMessage('Ripristino statistiche di tutte le squadre in corso...');
      console.log('🔄 Inizio ripristino statistiche di tutte le squadre');
      
      let totalePlayers = 0;
      let successPlayers = 0;
      let errorPlayers = 0;
      
      // Ottieni tutte le squadre
      const squadreSnapshot = await getDocs(collection(db, 'Squadre'));
      const tutteSquadre = squadreSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`📊 Trovate ${tutteSquadre.length} squadre da processare`);
      
      for (const squadra of tutteSquadre) {
        console.log(`\n🏟️ Processando squadra: ${squadra.nome} (ID: ${squadra.id})`);
        
        try {
          // Ottieni tutti i giocatori della squadra corrente
          const giocatoriRef = collection(db, `Squadre/${squadra.id}/giocatori`);
          const giocatoriSnapshot = await getDocs(giocatoriRef);
          const giocatoriSquadra = giocatoriSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          console.log(`👥 Trovati ${giocatoriSquadra.length} giocatori in ${squadra.nome}`);
          
          for (const giocatore of giocatoriSquadra) {
            totalePlayers++;
            try {
              const aggiornamenti = {
                // ✅ Azzera tutte le statistiche di gioco
                gol: 0,
                assist: 0,
                ammonizioni: 0,
                espulsioni: 0,
                autogol: 0,
                presenze: 0,
                voto: 0,
                golSubiti: 0,
                rigoriParati: 0,
                // ✅ Imposta valore iniziale uguale al valore attuale
                valoreIniziale: giocatore.valoreAttuale || 0
                // ⚠️ NON tocchiamo la scadenza!
              };
              
              console.log(`🔄 Ripristinando ${giocatore.nome}: valoreIniziale ${giocatore.valoreIniziale || 0} -> ${giocatore.valoreAttuale || 0}`);
              
              // Aggiorna il giocatore nella sottocollezione della squadra
              const giocatoreSquadraRef = doc(db, `Squadre/${squadra.id}/giocatori`, giocatore.id);
              await updateDoc(giocatoreSquadraRef, aggiornamenti);
              
              // Aggiorna anche il giocatore nella collezione principale
              const giocatorePrincipaleRef = doc(db, 'Giocatori', giocatore.id);
              await updateDoc(giocatorePrincipaleRef, aggiornamenti);
              
              console.log(`✅ Statistiche ripristinate per ${giocatore.nome} (${squadra.nome})`);
              successPlayers++;
              
            } catch (playerError) {
              console.error(`❌ Errore ripristino per ${giocatore.nome}:`, playerError);
              errorPlayers++;
            }
          }
          
        } catch (teamError) {
          console.error(`❌ Errore processando squadra ${squadra.nome}:`, teamError);
        }
      }
      
      console.log(`\n📊 RIEPILOGO RIPRISTINO GLOBALE:`);
      console.log(`👥 Totale giocatori processati: ${totalePlayers}`);
      console.log(`✅ Successi: ${successPlayers}`);
      console.log(`❌ Errori: ${errorPlayers}`);
      console.log(`📈 Percentuale successo: ${Math.round((successPlayers / totalePlayers) * 100)}%`);
      console.log(`🔄 Operazioni eseguite:`);
      console.log(`   📊 Statistiche azzerate: gol, assist, ammonizioni, espulsioni, autogol, presenze, voto, golSubiti, rigoriParati`);
      console.log(`   💰 Valore iniziale = valore attuale per tutti i giocatori`);
      console.log(`   📅 Scadenze: NON MODIFICATE`);
      
      setMessage(`Ripristino globale completato! ✅ ${successPlayers} giocatori ripristinati su ${totalePlayers} totali. Statistiche azzerate e valori iniziali aggiornati.`);
      
    } catch (error) {
      console.error('❌ Errore generale nel ripristino statistiche:', error);
      setMessage('Errore nel ripristino delle statistiche: ' + error.message);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">Ripristino Rose Squadre</h2>
            
              
              <div className="mb-3">
                <label className="form-label">Seleziona il file Excel delle squadre:</label>
                <input type="file" className="form-control" onChange={handleFileChange} accept=".xlsx, .xls" />
              </div>
              
              <button onClick={handleUpload} className="btn btn-primary w-100 mb-3">
                Importa Rose
              </button>
              
        
            
              
              {message && (
                <div className="alert alert-info text-center mb-3">
                  {message}
                  {message.includes('successo') && (
                    <div className="mt-2">
                      <small>✅ Controlla la console per i dettagli sui collegamenti automatici</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RipristinoRoseSquadre;