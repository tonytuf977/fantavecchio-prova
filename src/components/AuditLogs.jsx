// components/AuditLogs.jsx
import React, { useState, useEffect } from 'react';
import { Container, Table, Spinner, Alert, Form, Row, Col, Button, Badge, Card } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useUtenti } from '../hook/useUtenti';
import useAuditLogs from '../hook/useAuditLogs';
import { logAction, AUDIT_ACTIONS } from '../service/AuditService';
import './AuditLogs.css';

const AuditLogs = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { utenti } = useUtenti();

  // Filtri
  const [filters, setFilters] = useState({
    action: '',
    userEmail: '',
    startDate: null,
    endDate: null,
  });

  const { logs, loading, error, loadMore, hasMore } = useAuditLogs(filters);

  // Verifica autenticazione
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Verifica ruolo admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user || utenti.length === 0) {
        return;
      }

      try {
        const userRecord = utenti.find(u => u.id === user.uid);

        if (userRecord && userRecord.ruolo === 'admin') {
          setIsAdmin(true);
          // Registra accesso agli audit logs
          await logAction({
            action: AUDIT_ACTIONS.VIEW_AUDIT_LOGS,
            userEmail: user.email,
            userId: user.uid,
            description: 'Accesso al pannello Audit Logs',
            status: 'SUCCESS',
          });
        } else {
          alert('Accesso negato: solo gli amministratori possono visualizzare gli audit logs');
          navigate('/home');
        }
      } catch (error) {
        console.error('Errore verifica ruolo:', error);
        navigate('/home');
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAdminRole();
  }, [user, utenti, navigate]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value || null,
    }));
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value ? new Date(value) : null,
    }));
  };

  const resetFilters = () => {
    setFilters({
      action: '',
      userEmail: '',
      startDate: null,
      endDate: null,
    });
  };

  const getActionBadge = (action) => {
    const actionColors = {
      LOGIN: 'success',
      LOGOUT: 'secondary',
      LOGIN_FAILED: 'danger',
      CREATE_PLAYER: 'primary',
      UPDATE_PLAYER: 'info',
      DELETE_PLAYER: 'danger',
      CREATE_TEAM: 'primary',
      UPDATE_TEAM: 'info',
      DELETE_TEAM: 'danger',
      APPROVE_TRADE: 'success',
      REJECT_TRADE: 'warning',
      REQUEST_TRADE: 'info',
      ERROR: 'danger',
    };

    return (
      <Badge bg={actionColors[action] || 'secondary'}>
        {action}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    return (
      <Badge bg={status === 'SUCCESS' ? 'success' : 'danger'}>
        {status}
      </Badge>
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const exportToCSV = () => {
    const headers = ['Data/Ora', 'Utente', 'Azione', 'Descrizione', 'Stato', 'IP Address'];
    const rows = logs.map(log => [
      formatDate(log.timestamp),
      log.userEmail,
      log.action,
      log.description,
      log.status,
      log.ipAddress || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (checkingAuth) {
    return (
      <Container className="text-center mt-5">
        <Spinner animation="border" />
        <p>Verifica autorizzazioni...</p>
      </Container>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Container fluid className="audit-logs-container mt-4">
      <Card className="mb-4">
        <Card.Header as="h2" className="bg-primary text-white">
          📋 Audit Logs - Registro Attività Sistema
        </Card.Header>
        <Card.Body>
          <Form className="mb-4">
            <Row>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Azione</Form.Label>
                  <Form.Select
                    name="action"
                    value={filters.action}
                    onChange={handleFilterChange}
                  >
                    <option value="">Tutte le azioni</option>
                    {Object.keys(AUDIT_ACTIONS).map(action => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Utente</Form.Label>
                  <Form.Control
                    type="text"
                    name="userEmail"
                    placeholder="Email utente"
                    value={filters.userEmail}
                    onChange={handleFilterChange}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Data Inizio</Form.Label>
                  <Form.Control
                    type="date"
                    name="startDate"
                    onChange={handleDateChange}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Data Fine</Form.Label>
                  <Form.Control
                    type="date"
                    name="endDate"
                    onChange={handleDateChange}
                  />
                </Form.Group>
              </Col>
              <Col md={2} className="d-flex align-items-end">
                <Button variant="secondary" onClick={resetFilters} className="me-2">
                  Reset
                </Button>
                <Button variant="success" onClick={exportToCSV} disabled={logs.length === 0}>
                  Esporta CSV
                </Button>
              </Col>
            </Row>
          </Form>

          {error && (
            <Alert variant="danger">
              Errore nel caricamento dei logs: {error}
            </Alert>
          )}

          {loading && logs.length === 0 ? (
            <div className="text-center">
              <Spinner animation="border" />
              <p>Caricamento audit logs...</p>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead className="table-dark">
                    <tr>
                      <th>Data/Ora</th>
                      <th>Utente</th>
                      <th>Azione</th>
                      <th>Descrizione</th>
                      <th>Stato</th>
                      <th>IP Address</th>
                      <th>Dettagli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center">
                          Nessun log trovato con i filtri selezionati
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id}>
                          <td className="text-nowrap">{formatDate(log.timestamp)}</td>
                          <td>{log.userEmail}</td>
                          <td>{getActionBadge(log.action)}</td>
                          <td>{log.description}</td>
                          <td>{getStatusBadge(log.status)}</td>
                          <td>{log.ipAddress || '-'}</td>
                          <td>
                            {log.details && Object.keys(log.details).length > 0 ? (
                              <small className="text-muted">
                                {JSON.stringify(log.details, null, 2).substring(0, 100)}...
                              </small>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>

              {hasMore && (
                <div className="text-center mt-3">
                  <Button variant="primary" onClick={loadMore} disabled={loading}>
                    {loading ? 'Caricamento...' : 'Carica altri logs'}
                  </Button>
                </div>
              )}

              <div className="mt-3 text-muted">
                <small>Totale logs visualizzati: {logs.length}</small>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AuditLogs;
