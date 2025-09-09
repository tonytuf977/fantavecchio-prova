import React, { useState, useEffect } from 'react';
import { auth } from '../firebase/firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { useUtenti } from '../hook/useUtenti';
import { useNavigate } from 'react-router-dom';
import { Modal, Button } from 'react-bootstrap';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Stati per reset password
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
  const navigate = useNavigate();
  const { utenti } = useUtenti();

  useEffect(() => {
    // Controllo se c'è già un timer di logout impostato
    const logoutTime = localStorage.getItem('logoutTime');
    if (logoutTime) {
      const now = new Date().getTime();
      const timeLeft = parseInt(logoutTime) - now;
      if (timeLeft > 0) {
        // Se il timer non è ancora scaduto, lo reimpostiamo
        setLogoutTimer(timeLeft);
      } else {
        // Se il timer è scaduto, eseguiamo il logout
        handleLogout();
      }
    }
  }, []);

  const setLogoutTimer = (duration) => {
    const timer = setTimeout(handleLogout, duration);
    localStorage.setItem('logoutTime', new Date().getTime() + duration);
    return timer;
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('logoutTime');
      console.log('Logout eseguito');
      navigate('/login');
    } catch (error) {
      console.error("Errore durante il logout:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const utenteDB = utenti.find(u => u.id === user.uid);

      if (utenteDB) {
        localStorage.setItem('userRole', utenteDB.ruolo);
        localStorage.setItem('userEmail', user.email);

        console.log('Accesso eseguito');

        // Imposta il timer per il logout automatico dopo 1 ora
        setLogoutTimer(3600000); // 3600000 ms = 1 ora

        navigate('/home');
      } else {
        setError("Utente non trovato nel database");
      }
    } catch (error) {
      console.error("Errore di login:", error);
      setError(error.message);
    }
  };

  // Funzione per gestire il reset della password
  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setError('Inserisci un indirizzo email valido');
      return;
    }

    setResetLoading(true);
    setError('');
    
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setSuccess('Email di reset password inviata! Controlla la tua casella di posta.');
      setShowResetModal(false);
      setResetEmail('');
    } catch (error) {
      console.error('Errore nel reset password:', error);
      let errorMessage = 'Errore nell\'invio dell\'email di reset: ';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage += 'Nessun utente trovato con questo indirizzo email.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage += 'Indirizzo email non valido.';
      } else {
        errorMessage += error.message;
      }
      
      setError(errorMessage);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <h2>Login</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label htmlFor="password" className="form-label">Password</label>
          <input
            type="password"
            className="form-control"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Accedi</button>
      </form>
      
      {/* Pulsante "Ho dimenticato la password" */}
      <div className="mt-3">
        <button 
          type="button" 
          className="btn btn-link text-decoration-none" 
          onClick={() => setShowResetModal(true)}
        >
          📧 Ho dimenticato la password
        </button>
      </div>

      {/* Modal per reset password */}
      <Modal show={showResetModal} onHide={() => setShowResetModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Reset Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Inserisci il tuo indirizzo email per ricevere un link di reset password.</p>
          <div className="mb-3">
            <label htmlFor="resetEmail" className="form-label">Email</label>
            <input
              type="email"
              className="form-control"
              id="resetEmail"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="Inserisci la tua email"
              disabled={resetLoading}
            />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowResetModal(false);
              setResetEmail('');
              setError('');
            }}
            disabled={resetLoading}
          >
            Annulla
          </Button>
          <Button 
            variant="primary" 
            onClick={handleResetPassword}
            disabled={resetLoading || !resetEmail.trim()}
          >
            {resetLoading ? 'Invio in corso...' : 'Invia Email Reset'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Login;