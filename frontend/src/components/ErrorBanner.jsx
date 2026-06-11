import React from 'react';

/**
 * ErrorBanner component — displays a global error message.
 *
 * @param {{ error: string|null }} props
 * @returns {JSX.Element|null} null when error is falsy
 */
function ErrorBanner({ error }) {
  if (!error) {
    return null;
  }

  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <span className="error-banner__icon" aria-hidden="true">⚠️</span>
      <span className="error-banner__message">{error}</span>
    </div>
  );
}

export default ErrorBanner;
