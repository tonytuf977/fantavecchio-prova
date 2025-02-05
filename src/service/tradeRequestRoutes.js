const express = require('express');
const { createTradeRequest } = require('./tradeRequestService');

const router = express.Router();

router.post('/trade-request', async (req, res) => {
  try {
    const { squadraRichiedente, squadraAvversaria, giocatoriOfferti, giocatoriRichiesti } = req.body;
    
    const result = await createTradeRequest(squadraRichiedente, squadraAvversaria, giocatoriOfferti, giocatoriRichiesti);
    
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Errore nella gestione della richiesta:', error);
    res.status(500).json({ message: 'Si è verificato un errore interno del server', error: error.message });
  }
});

module.exports = router;