/**
 * UTILITÀ PER IL MATCHING AUTOMATICO ID GIOCATORI
 * ================================================
 * 
 * Questo sistema risolve il problema di collegamento automatico tra:
 * - File Excel "statistiche_fantacalcio.xlsx" (con ID + nomi)
 * - File Excel "FantaVecchio_Squadre.xlsx" (con nomi senza ID)
 * 
 * COME FUNZIONA:
 * 1. Carica tutti i giocatori esistenti dal database Firestore
 * 2. Crea una mappa nome → ID normalizzata (rimuove accenti, spazi, etc.)
 * 3. Durante l'import delle squadre, per ogni giocatore:
 *    - Se ha già un ID nell'Excel → lo usa
 *    - Se non ha ID → cerca per nome nella mappa
 *    - Se trova match → collega l'ID esistente
 *    - Se non trova → crea ID temporaneo
 * 
 * ESEMPI DI MATCHING:
 * - "Vlahovic" nell'Excel squadre → trova "Vlahovic" nel database → usa il suo ID
 * - "Lautaro Martinez" → normalizza in "lautaro martinez" → trova match
 * - "Osimhen Victor" → fuzzy matching → trova "Victor Osimhen"
 * 
 * VANTAGGI:
 * ✅ Automatico - non devi aggiungere manualmente gli ID
 * ✅ Flessibile - gestisce variazioni di nome e accenti  
 * ✅ Sicuro - crea ID temporanei per i non trovati
 * ✅ Verificabile - mostra statistiche di successo
 * 
 * STATISTICHE MOSTRATE:
 * - ID trovati automaticamente
 * - ID mancanti (temporanei)
 * - Percentuale di successo matching
 * - Dettagli per ogni match/mancanza
 */

export const MATCHING_CONFIG = {
  // Configurazione per il matching fuzzy
  SIMILARITY_THRESHOLD: 0.7,
  
  // Prefisso per ID temporanei
  TEMP_ID_PREFIX: 'TEMP_',
  
  // Variazioni comuni nei nomi
  NAME_VARIATIONS: {
    'j': ['y'],
    'ph': ['f'],
    'ck': ['k']
  }
};

export default MATCHING_CONFIG;