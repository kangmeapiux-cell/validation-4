'use strict';

const { GetCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../lib/dynamoClient');
const { buildResponse } = require('../lib/response');
const { TABLE_NAME } = require('../lib/constants');

/**
 * Lambda handler: DELETE /tareas/{id}
 * Deletes an existing task from DynamoDB.
 *
 * @param {Object} event - API Gateway event
 * @returns {Object} API Gateway response
 */
exports.handler = async (event) => {
  const id =
    event.pathParameters && event.pathParameters.id
      ? event.pathParameters.id
      : null;

  if (!id) {
    return buildResponse(404, false, null, 'Task not found');
  }

  try {
    // Check existence first
    const getResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id },
      })
    );

    if (!getResult.Item) {
      return buildResponse(404, false, null, 'Task not found');
    }

    // Delete the item
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id },
      })
    );

    console.log(
      JSON.stringify({ level: 'INFO', handler: 'deleteTask', taskId: id })
    );

    return buildResponse(200, true, null, null);
  } catch (err) {
    console.log(
      JSON.stringify({
        level: 'ERROR',
        handler: 'deleteTask',
        message: err.message,
      })
    );
    return buildResponse(500, false, null, 'Internal server error');
  }
};
