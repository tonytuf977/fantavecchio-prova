import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';
import { useUtenti } from '../hook/useUtenti';
import { auth } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useNotifiche } from './NotificheContext';

import { 
  FaUsers, FaRegListAlt, FaExchangeAlt, FaFileExcel, FaUndo, 
  FaUserPlus, FaLink, FaSync, FaSignInAlt, FaSignOutAlt, FaHistory, FaFileDownload,
  FaFileExport,
  FaFileArchive,
  FaFileAlt,
  FaDownload
} from 'react-icons/fa';
import { GiSoccerBall, GiWizardStaff, GiSoccerField, GiPerspectiveDiceSixFacesSix } from 'react-icons/gi';
import regolamentoPDF from '../Regolamenti/Regolamento ufficiale.pdf';
import classificaRanking from '../Regolamenti/classifica ranking 23.24.pdf';
import alboDoro from '../Regolamenti/ALBO D ORO AGGIORNATO 2024.pdf';
import resocontoStagione from '../Regolamenti/RESOCONTO STAGIONE 2025.pdf';
import { GrAnalytics } from 'react-icons/gr';

function HomePage() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { utenti, loading } = useUtenti();
  const { scambiDaAccettareCount } = useNotifiche();

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: true,
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      console.log("HomePage: User auth state changed, currentUser =", currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && !loading) {
      const userRecord = utenti.find(u => u.email === user.email);
      const adminStatus = userRecord?.ruolo === 'admin';
      setIsAdmin(adminStatus);
      console.log("HomePage: isAdmin set to", adminStatus);
    } else {
      setIsAdmin(false);
      console.log("HomePage: isAdmin set to false (no user or loading)");
    }
  }, [user, utenti, loading]);

  if (loading) {
    return <div className="loading">Caricamento<span>.</span><span>.</span><span>.</span></div>;
  }

  return (
    <div className="home-wrapper">
      <div className="background-animation">
        <GiSoccerField className="field-icon" />
      </div>
      <header className="home-header">
        <div className="logo-container" data-aos="zoom-in">
          <GiSoccerBall className="logo-ball" />
          <GiWizardStaff className="logo-wand" />
        </div>
        <h1 data-aos="fade-right">FantaVecchio App</h1>
        <p data-aos="fade-left">Gestisci la tua squadra con facilità</p>
      </header>

      <div className="home-buttons">
        <Link to="/giocatori" className="home-card" data-aos="flip-left">
          <FaRegListAlt />
          <h3>Lista Giocatori</h3>
        </Link>
        <Link to="/squadre" className="home-card" data-aos="flip-right">
          <FaUsers />
          <h3>Squadre</h3>
        </Link>
        <Link to="/richiestaScambio" className="home-card" data-aos="flip-up">
          <FaExchangeAlt />
          <h3>Richiedi Scambio</h3>
        </Link>
        <Link to="/storicoScambi" className="home-card" data-aos="flip-down">
          <FaHistory />
          <h3>Storico Scambi</h3>
        </Link>
<Link to="/valutazioneScambio" className="home-card" data-aos="flip-down">
  <GrAnalytics />
  <h3>Statistiche Scambi</h3>
</Link>
<Link to="/download-backup" className="home-card" data-aos="flip-down">
  <FaDownload />
  <h3>Download Backup</h3>
</Link>
        {isAdmin && (
          <>
            <Link to="/import" className="home-card admin-card" data-aos="zoom-in-up">
              <FaFileExcel />
              <h3>Importa Excel</h3>
            </Link>
            <Link to="/ripristinoRose" className="home-card admin-card" data-aos="zoom-in-down">
              <FaUndo />
              <h3>Ripristina Rose</h3>
            </Link>
            <Link to="/aggiungi-giocatore" className="home-card admin-card" data-aos="zoom-in-left">
              <FaUserPlus />
              <h3>Aggiungi Giocatore</h3>
            </Link>
            <Link to="/associa" className="home-card admin-card" data-aos="zoom-in-right">
              <FaLink />
              <h3>Associa a Squadra</h3>
            </Link>
            <Link to="/accettaScambi" className="home-card admin-card" data-aos="zoom-in">
              <FaSync />
              <h3>Pannello Admin</h3>
              {scambiDaAccettareCount > 0 && (
                <span className="notification-badge">{scambiDaAccettareCount}</span>
              )}
            </Link>
            <Link to="/import-rose-excel" className="home-card admin-card" data-aos="zoom-in-left">
              <FaFileExcel />
              <h3>Import Rose Excel di Leghe</h3>
            </Link>
          </>
        )}
        <a href={regolamentoPDF} className="home-card" download data-aos="fade-up">
          <FaFileDownload />
          <h3>Regolamento</h3>
        </a>
        <a href={classificaRanking} className="home-card" download data-aos="fade-up">
          <FaFileAlt />
          <h3>Classifica Ranking</h3>
        </a>
        <a href={alboDoro} className="home-card" download data-aos="fade-up">
          <FaFileArchive />
          <h3>Albo D'Oro</h3>
        </a>
        <a href={resocontoStagione} className="home-card" download data-aos="fade-up">
          <FaFileExport />
          <h3>Resoconto Stagione</h3>
        </a>
              <Link to="/Dado" className="home-card" data-aos="flip-down">
          {/* Icona dado */}
          <GiPerspectiveDiceSixFacesSix />
          <h3>Dado Eliminazione</h3>
        </Link>
      </div>

      <div className="home-footer">
        {!user ? (
          <>
            <Link to="/registrazione" className="home-button" data-aos="fade-up">
              <FaSignInAlt /> Registrati
            </Link>
            <Link to="/login" className="home-button" data-aos="fade-up" data-aos-delay="200">
              <FaSignInAlt /> Login
            </Link>
          </>
        ) : (
          <button onClick={() => auth.signOut()} className="home-button" data-aos="fade-up">
            <FaSignOutAlt /> Logout
          </button>
        )}
      </div>
    </div>
  );
}

export default HomePage;
