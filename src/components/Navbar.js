import React, { useState, useEffect } from 'react';
import logoTavecchio from '../immagini/logoTavecchio.jpg';
import { auth } from '../firebase/firebase';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Navbar, Container, Nav, NavDropdown } from 'react-bootstrap';
import { PersonCircle } from 'react-bootstrap-icons';
import { useNotifiche } from './NotificheContext';

function CustomNavbar() {
  const [userEmail, setUserEmail] = useState(localStorage.getItem('userEmail') || null);
  const { notificheCount } = useNotifiche();
  const navigate = useNavigate();

  useEffect(() => {
    const userEmail = localStorage.getItem('userEmail');
    if (userEmail) {
      setUserEmail(userEmail);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      localStorage.removeItem('userEmail');
      setUserEmail(null);
      console.log('Logout effettuato');
      navigate('/home');
    } catch (error) {
      console.error('Errore durante la disconnessione:', error);
    }
  };

  const handleViewProfile = () => {
    navigate('/profilo');
  };

  return (
    <Navbar bg="primary" variant="light" expand="lg" className="sticky-top">
      <Container fluid>
        <Navbar.Brand href="/home" className="me-auto">
          <img
            src={logoTavecchio}
            alt="Logo"
            style={{ width: "40px", marginRight: "10px" }}
          />
          Gestione rose Fan-Tavecchio
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
          {userEmail && (
            <Nav>
              <NavDropdown
                title={
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <PersonCircle size={24} />
                    {notificheCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -10,
                          right: -10,
                          background: 'red',
                          borderRadius: '50%',
                          padding: '2px 6px',
                          fontSize: '12px',
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      >
                        {notificheCount}
                      </span>
                    )}
                  </div>
                }
                id="basic-nav-dropdown"
                align="end"
              >
                <NavDropdown.Item onClick={handleViewProfile}>
                  Visualizza Profilo
                  {notificheCount > 0 && (
                    <span className="ms-2 badge bg-danger">{notificheCount}</span>
                  )}
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
              </NavDropdown>
            </Nav>
          )}
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default CustomNavbar;