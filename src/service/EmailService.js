const nodemailer = require('nodemailer');
require('dotenv').config(); // Per gestire le variabili d'ambiente

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Solo per debug, rimuovi in produzione
  }
});

async function sendEmail(to, subject, text) {
  try {
    let info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: to,
      subject: subject,
      text: text
    });
    console.log('Email inviata:', info.messageId);
    console.log('Anteprima URL:', nodemailer.getTestMessageUrl(info));
    return true;
  } catch (error) {
    console.error('Errore nell\'invio dell\'email:', error);
    return false;
  }
}

module.exports = { sendEmail };