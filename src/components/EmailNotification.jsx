import React from 'react';

function EmailNotification({ message, isSuccess }) {
  return (
    <div className={`alert ${isSuccess ? 'alert-success' : 'alert-danger'} position-fixed top-0 start-50 translate-middle-x`} style={{ zIndex: 1050 }}>
      {message}
    </div>
  );
}

export default EmailNotification;