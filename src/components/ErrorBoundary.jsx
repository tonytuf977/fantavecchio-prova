// components/ErrorBoundary.jsx
import React from 'react';
import { ERROR_TYPES, SEVERITY, captureError } from '../service/ErrorLogger';
import { auth } from '../firebase/firebase';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  async componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log l'errore nel database
    try {
      await captureError(error, {
        errorType: ERROR_TYPES.RUNTIME_ERROR,
        component: errorInfo.componentStack?.split('\n')[1]?.trim() || 'Unknown Component',
        action: 'Rendering',
        severity: SEVERITY.CRITICAL,
        userEmail: auth.currentUser?.email || 'anonymous',
        userId: auth.currentUser?.uid || 'unknown',
        additionalInfo: {
          componentStack: errorInfo.componentStack,
          errorBoundary: true,
        }
      });
    } catch (loggingError) {
      console.error('Failed to log error:', loggingError);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/home';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          maxWidth: '800px',
          margin: '50px auto',
          backgroundColor: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #f5c2c7'
        }}>
          <h1 style={{ color: '#dc3545', marginBottom: '20px' }}>
            🚨 Ops! Qualcosa è andato storto
          </h1>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '20px' }}>
            Si è verificato un errore imprevisto. L'errore è stato registrato automaticamente 
            e gli amministratori sono stati notificati.
          </p>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ 
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              border: '1px solid #dee2e6'
            }}>
              <summary style={{ 
                cursor: 'pointer', 
                fontWeight: 'bold',
                color: '#495057',
                marginBottom: '10px'
              }}>
                Dettagli Tecnici (visibili solo in sviluppo)
              </summary>
              <pre style={{
                backgroundColor: '#fff',
                padding: '10px',
                borderRadius: '4px',
                overflow: 'auto',
                fontSize: '12px',
                color: '#dc3545'
              }}>
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          
          <div style={{ marginTop: '30px' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 24px',
                backgroundColor: '#0d6efd',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer',
                marginRight: '10px'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#0b5ed7'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#0d6efd'}
            >
              Torna alla Home
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#5c636a'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#6c757d'}
            >
              Ricarica Pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
