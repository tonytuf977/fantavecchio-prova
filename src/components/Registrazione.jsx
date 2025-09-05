import React, { useState } from 'react';
import { auth } from '../firebase/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useUtenti } from '../hook/useUtenti';
import { useNavigate } from 'react-router-dom';

function Registrazione() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { addUtente } = useUtenti();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Aggiungi l'utente al database usando useUtenti
      await addUtente({
        id: user.uid,
        email: user.email,
        ruolo: 'utente' // Ruolo predefinito
      });

      navigate('/login'); // Reindirizza alla pagina di login dopo la registrazione
    } catch (error) {
      setError(error.message);
    }
  };

  return (
    <div className="container mt-5">
      <h2>Registrazione</h2>
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
        <button type="submit" className="btn btn-primary">Registrati</button>
      </form>
    </div>
  );
}

export default Registrazione;