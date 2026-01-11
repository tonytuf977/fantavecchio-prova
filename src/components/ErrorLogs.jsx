// components/ErrorLogs.jsx
import React, { useState, useEffect } from 'react';
import { Container, Table, Spinner, Alert, Form, Row, Col, Button, Badge, Card, Accordion } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useUtenti } from '../hook/useUtenti';
import useErrorLogs from '../hook/useErrorLogs';
import { ERROR_TYPES, SEVERITY } from '../service/ErrorLogger';
import './ErrorLogs.css';

const ErrorLogs = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const { utenti } = useUtenti();

  // Filtri
  const [filters, setFilters] = useState({
    errorType: '',
    severity: '',
    component: '',
    resolved: false,
    startDate: null,
    endDate: null,
  });

  const { logs, loading, error, loadMore, hasMore, markAsResolved } = useErrorLogs(filters);

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
        } else {
          alert('Accesso negato: solo gli amministratori possono visualizzare i log degli errori');
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
    const { name, value, type, checked } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (value || null),
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
      errorType: '',
      severity: '',
      component: '',
      resolved: false,
      startDate: null,
      endDate: null,
    });
  };

  const getSeverityBadge = (severity) => {
    const colors = {
      CRITICAL: 'danger',
      HIGH: 'warning',
      MEDIUM: 'info',
      LOW: 'secondary',
    };
    return <Badge bg={colors[severity] || 'secondary'}>{severity}</Badge>;
  };

  const getErrorTypeBadge = (errorType) => {
    return <Badge bg="dark">{errorType}</Badge>;
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

  const handleMarkAsResolved = async (logId) => {
    try {
      await markAsResolved(logId);
    } catch (error) {
      alert('Errore nel marcare come risolto: ' + error.message);
    }
  };

  const exportToCSV = () => {
    const headers = ['Data/Ora', 'Severità', 'Tipo Errore', 'Componente', 'Messaggio', 'Utente', 'Risolto'];
    const rows = logs.map(log => [
      formatDate(log.timestamp),
      log.severity,
      log.errorType,
      log.component,
      log.errorMessage,
      log.userEmail,
      log.resolved ? 'Sì' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `error_logs_${new Date().toISOString().split('T')[0]}.csv`;
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
    <Container fluid className="error-logs-container mt-4">
      <Card className="mb-4">
        <Card.Header as="h2" className="bg-danger text-white">
          🚨 Error Logs - Registro Errori Sistema
        </Card.Header>
        <Card.Body>
          <Form className="mb-4">
            <Row>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Tipo Errore</Form.Label>
                  <Form.Select
                    name="errorType"
                    value={filters.errorType}
                    onChange={handleFilterChange}
                  >
                    <option value="">Tutti i tipi</option>
                    {Object.keys(ERROR_TYPES).map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Severità</Form.Label>
                  <Form.Select
                    name="severity"
                    value={filters.severity}
                    onChange={handleFilterChange}
                  >
                    <option value="">Tutte</option>
                    {Object.keys(SEVERITY).map(sev => (
                      <option key={sev} value={sev}>
                        {sev}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Componente</Form.Label>
                  <Form.Control
                    type="text"
                    name="component"
                    placeholder="Nome componente"
                    value={filters.component}
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
                <Form.Check
                  type="checkbox"
                  label="Solo non risolti"
                  name="resolved"
                  checked={!filters.resolved}
                  onChange={(e) => setFilters(prev => ({ ...prev, resolved: !e.target.checked }))}
                />
              </Col>
            </Row>
            <Row className="mt-3">
              <Col>
                <Button variant="secondary" onClick={resetFilters} className="me-2">
                  Reset Filtri
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
              <p>Caricamento error logs...</p>
            </div>
          ) : (
            <>
              <Accordion>
                {logs.length === 0 ? (
                  <Alert variant="info">
                    Nessun errore trovato con i filtri selezionati 🎉
                  </Alert>
                ) : (
                  logs.map((log, index) => (
                    <Accordion.Item eventKey={index.toString()} key={log.id}>
                      <Accordion.Header>
                        <div className="w-100 d-flex justify-content-between align-items-center pe-3">
                          <div>
                            {getSeverityBadge(log.severity)}
                            {' '}
                            {getErrorTypeBadge(log.errorType)}
                            {' '}
                            <strong>{log.component}</strong>
                            {' - '}
                            <span className="text-muted small">{formatDate(log.timestamp)}</span>
                          </div>
                          {log.resolved && <Badge bg="success">Risolto</Badge>}
                        </div>
                      </Accordion.Header>
                      <Accordion.Body>
                        <Table bordered size="sm">
                          <tbody>
                            <tr>
                              <td><strong>Messaggio</strong></td>
                              <td className="text-danger">{log.errorMessage}</td>
                            </tr>
                            <tr>
                              <td><strong>Azione</strong></td>
                              <td>{log.action}</td>
                            </tr>
                            <tr>
                              <td><strong>Utente</strong></td>
                              <td>{log.userEmail}</td>
                            </tr>
                            <tr>
                              <td><strong>URL</strong></td>
                              <td><small>{log.url}</small></td>
                            </tr>
                            {log.errorStack && (
                              <tr>
                                <td><strong>Stack Trace</strong></td>
                                <td>
                                  <pre className="error-stack">{log.errorStack}</pre>
                                </td>
                              </tr>
                            )}
                            {log.additionalInfo && Object.keys(log.additionalInfo).length > 0 && (
                              <tr>
                                <td><strong>Info Aggiuntive</strong></td>
                                <td>
                                  <pre>{JSON.stringify(log.additionalInfo, null, 2)}</pre>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </Table>
                        {!log.resolved && (
                          <Button 
                            variant="success" 
                            size="sm"
                            onClick={() => handleMarkAsResolved(log.id)}
                          >
                            Segna come Risolto
                          </Button>
                        )}
                      </Accordion.Body>
                    </Accordion.Item>
                  ))
                )}
              </Accordion>

              {hasMore && (
                <div className="text-center mt-3">
                  <Button variant="primary" onClick={loadMore} disabled={loading}>
                    {loading ? 'Caricamento...' : 'Carica altri logs'}
                  </Button>
                </div>
              )}

              <div className="mt-3 text-muted">
                <small>
                  Totale errori visualizzati: {logs.length}
                  {' | '}
                  Non risolti: {logs.filter(l => !l.resolved).length}
                  {' | '}
                  Critici: {logs.filter(l => l.severity === 'CRITICAL').length}
                </small>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ErrorLogs;
