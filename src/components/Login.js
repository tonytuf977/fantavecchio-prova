import React, { useState, useEffect } from 'react';
import { auth } from '../firebase/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useUtenti } from '../hook/useUtenti';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

  return (
    <div className="container mt-5">
      <h2>Login</h2>
      {error && <div className="alert alert-danger">{error}</div>}
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
    </div>
  );
}

export default Login;