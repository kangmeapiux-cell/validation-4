'use strict';

/**
 * Builds a standardized API Gateway response object with CORS headers.
 *
 * @param {number} statusCode - HTTP status code
 * @param {boolean} success - Whether the operation succeeded
 * @param {*} data - Response payload (object, array, or null)
 * @param {string|null} error - Error message or null
 * @returns {{ statusCode: number, headers: Object, body: string }}
 */
function buildResponse(statusCode, success, data, error) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };

  const body = JSON.stringify({
    success,
    data: data !== undefined ? data : null,
    error: error !== undefined ? error : null,
  });

  return {
    statusCode,
    headers,
    body,
  };
}

module.exports = { buildResponse };
