const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const tradeRequestRoutes = require('./tradeRequestRoute');

require('dotenv').config();

const app = express();
app.use(cors({
  origin: 'http://localhost:3000' // Sostituisci con l'URL del tuo frontend
}));
app.use(express.json());

const CLIENT_ID = '784829397468-s8g04r8tm0cvkc3qhdu33fhglu7tjd72.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

async function sendMail(options) {
  try {
    const accessToken = await oAuth2Client.getAccessToken();
    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: 'fantavecchio@gmail.com',
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken,
      },
    });

    const mailOptions = {
      from: 'FantaVecchio <fantavecchio@gmail.com>',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    };

    const result = await transport.sendMail(mailOptions);
    console.log('Email inviata con successo:', result);
    return result;
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    throw error;
  }
}

app.use('/api', tradeRequestRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { sendMail };