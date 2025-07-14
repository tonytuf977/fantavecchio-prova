import React, { useState, useEffect,getDocs,where,query,db,collection,doc,getDoc } from 'react';
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


function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { utenti, loading: utentiLoading } = useUtenti();
  const [emailNotification, setEmailNotification] = useState(null);

  // Stati aggiuntivi per gestire richieste di scambio, notifiche e rinnovi
  const [richiesteScambio, setRichiesteScambio] = useState([]);
  const [notificheCount, setNotificheCount] = useState(0);
  const [giocatoriDaRinnovare, setGiocatoriDaRinnovare] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRecord = utenti.find(u => u.email === currentUser.email);
        setIsAdmin(userRecord?.ruolo === 'admin');
        setLoading(false);
      } else {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [utenti]);

  // Funzione per caricare le richieste di scambio in sospeso
  const fetchRichiesteScambio = async () => {
    if (!user) return;
    try {
      const richiesteRef = collection(db, 'RichiesteScambio');
      const q = query(
        richiesteRef,
        where('squadraAvversaria', '==', user.uid),
        where('stato', '==', 'In attesa')
      );
      const querySnapshot = await getDocs(q);
      const richieste = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRichiesteScambio(richieste);
    } catch (error) {
      console.error('Errore nel recupero delle richieste di scambio:', error);
    }
  };

  // Funzione per caricare i giocatori da rinnovare
  const fetchGiocatoriDaRinnovare = async () => {
    if (!user) return;
    try {
      const rinnoviRef = collection(db, 'RinnoviContratti');
      const q = query(
        rinnoviRef,
        where('squadraId', '==', user.uid),
        where('stato', '==', 'In attesa')
      );
      const querySnapshot = await getDocs(q);
      const giocatoriIds = querySnapshot.docs.flatMap(doc => doc.data().giocatori);
      const giocatoriPromises = giocatoriIds.map(id => getDoc(doc(db, 'Giocatori', id)));
      const giocatoriDocs = await Promise.all(giocatoriPromises);
      const giocatori = giocatoriDocs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGiocatoriDaRinnovare(giocatori);
    } catch (error) {
      console.error('Errore nel recupero dei giocatori da rinnovare:', error);
    }
  };

  // Funzione per aggiornare il conteggio delle notifiche
  const updateNotificheCount = async () => {
    if (!user) return;
    try {
      const richiesteRef = collection(db, 'RichiesteScambio');
      const q = query(
        richiesteRef,
        where('squadraAvversaria', '==', user.uid),
        where('stato', '==', 'In attesa')
      );
      const querySnapshot = await getDocs(q);
      setNotificheCount(querySnapshot.size);
    } catch (error) {
      console.error('Errore nell\'aggiornamento del conteggio delle notifiche:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRichiesteScambio();
      fetchGiocatoriDaRinnovare();
      updateNotificheCount();
    }
  }, [user]);

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
          <Route 
            path="/profilo" 
            element={
              <Profili 
                user={user} 
                richiesteScambio={richiesteScambio} 
                notificheCount={notificheCount} 
                giocatoriDaRinnovare={giocatoriDaRinnovare} 
                onUpdate={() => {
                  fetchRichiesteScambio();
                  fetchGiocatoriDaRinnovare();
                  updateNotificheCount();
                }} 
              /> 
            } 
          />
          <Route path="/associa" element={<AssociaSquadreUtenti />} />
          <Route 
            path="/richiestaScambio" 
            element={<RichiestaScambio onEmailSent={handleEmailNotification} />} 
          />
          <Route path="/accettaScambi" element={<GestioneScambiAdmin />} />
          <Route path="/storicoScambi" element={<StoricoScambi />} />
          <Route path="/valutazioneScambio" element={<ValutazioneScambio />} />
          <Route path="/download-backup" element={<DownloadBackup />} />
        </Routes>
      </NotificheProvider>
    </Router>
  );
}

export default App;