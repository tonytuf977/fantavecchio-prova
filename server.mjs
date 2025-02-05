import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const port = 3001;

app.use(cors());

app.get('/api/giocatori', async (req, res) => {
  try {
    const response = await fetch('https://www.fantacalcio.it/api/v1/Excel/stats/19/1');
    const data = await response.arrayBuffer();
    res.send(data);
  } catch (error) {
    res.status(500).send('Errore durante il fetch dei dati');
  }
});

app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
