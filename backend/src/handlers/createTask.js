'use strict';

const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../lib/dynamoClient');
const { buildResponse } = require('../lib/response');
const { TABLE_NAME } = require('../lib/constants');

/**
 * Lambda handler: POST /tareas
 * Creates a new task in DynamoDB.
 *
 * @param {Object} event - API Gateway event
 * @returns {Object} API Gateway response
 */
exports.handler = async (event) => {
  let body;

  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch (_parseError) {
    body = {};
  }

  const titulo = body && typeof body.titulo === 'string' ? body.titulo.trim() : null;

  if (!titulo) {
    return buildResponse(400, false, null, 'titulo is required');
  }

  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const completada = false;

  const task = {
    id,
    titulo,
    completada,
    createdAt,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: task,
      })
    );

    console.log(JSON.stringify({ level: 'INFO', handler: 'createTask', taskId: id }));

    return buildResponse(201, true, task, null);
  } catch (err) {
    console.log(JSON.stringify({ level: 'ERROR', handler: 'createTask', message: err.message }));
    return buildResponse(500, false, null, 'Internal server error');
  }
};
