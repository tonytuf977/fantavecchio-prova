import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './components/HomePage';
import ListaGiocatori from './components/ListaGiocatori';
import ListaSquadre from './components/ListaSquadre';
import ImportExcel from './components/ImportExcel';
import AggiungiGiocatoreSquadra from './components/AggiungiGiocatoreSquadra';
import ModificaGiocatore from './components/ModificaGiocatore';
import Navbar from './components/Navbar';
import RipristinoRoseSquadre from './components/RipristinoRoseSquadre';
import Registrazione from './components/Registrazione';
import Login from './components/Login';
import { auth } from './firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useUtenti } from './hook/useUtenti';
import Profili from './components/Profili';
import AssociaSquadreUtenti from './components/AssociaSquadreUtenti';
import RichiestaScambio from './components/RichiestaScambio';
import GestioneScambiAdmin from './components/GestioneScambiAdmin';
import StoricoScambi from './components/StoricoScambi';
import { NotificheProvider } from './components/NotificheContext';
import EmailNotification from './components/EmailNotification';
import ValutazioneScambio from './components/ValutazioneScambio';
import DownloadBackup from './components/DownloadBackup';
import Dado from './components/dado';
import ImportRoseExcel from './components/ImportRoseExcel';

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { utenti, loading: utentiLoading } = useUtenti();
  const [emailNotification, setEmailNotification] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !utentiLoading) {
      const userRecord = utenti.find(u => u.email === user.email);
      setIsAdmin(userRecord?.ruolo === 'admin');
      setLoading(false);
    }
  }, [user, utenti, utentiLoading]);

  const handleEmailNotification = (message, isSuccess) => {
    setEmailNotification({ message, isSuccess });
    setTimeout(() => setEmailNotification(null), 5000);
  };

  if (loading || utentiLoading) {
    return <div>Caricamento...</div>;
  }

  return (
    <Router>
      <NotificheProvider>
        <Navbar user={user} isAdmin={isAdmin} />
        {emailNotification && (
          <EmailNotification 
            message={emailNotification.message} 
            isSuccess={emailNotification.isSuccess} 
          />
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/giocatori" element={<ListaGiocatori />} />
          <Route path="/squadre" element={<ListaSquadre />} />
          <Route path="/Dado" element={<Dado />} />
          {isAdmin && (
            <>
              <Route path="/import" element={<ImportExcel />} />
              <Route path="/ripristinoRose" element={<RipristinoRoseSquadre />} />
              <Route path="/aggiungi-giocatore" element={<AggiungiGiocatoreSquadra />} />
            </>
          )}
          <Route path="/modifica-giocatore" element={<ModificaGiocatore />} />
          <Route path="/registrazione" element={<Registrazione />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profilo" element={<Profili />} />
          <Route path="/associa" element={<AssociaSquadreUtenti />} />
          <Route 
            path="/richiestaScambio" 
            element={<RichiestaScambio onEmailSent={handleEmailNotification} />} 
          />
          <Route path="/accettaScambi" element={<GestioneScambiAdmin />} />
          <Route path="/storicoScambi" element={<StoricoScambi />} />
          <Route path="/valutazioneScambio" element={<ValutazioneScambio />} />
          <Route path="/download-backup" element={<DownloadBackup />} />
          <Route path="/import-rose-excel" element={<ImportRoseExcel />} />
        </Routes>
      </NotificheProvider>
    </Router>
  );
}

export default App;