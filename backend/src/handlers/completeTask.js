'use strict';

const { GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../lib/dynamoClient');
const { buildResponse } = require('../lib/response');
const { TABLE_NAME } = require('../lib/constants');

/**
 * Lambda handler: PUT /tareas/{id}/completar
 * Marks an existing task as completada:true in DynamoDB.
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

    // Update completada to true
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id },
        UpdateExpression: 'SET completada = :val',
        ExpressionAttributeValues: {
          ':val': true,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const updatedTask = updateResult.Attributes;

    console.log(
      JSON.stringify({ level: 'INFO', handler: 'completeTask', taskId: id })
    );

    return buildResponse(200, true, updatedTask, null);
  } catch (err) {
    console.log(
      JSON.stringify({
        level: 'ERROR',
        handler: 'completeTask',
        message: err.message,
      })
    );
    return buildResponse(500, false, null, 'Internal server error');
  }
};
