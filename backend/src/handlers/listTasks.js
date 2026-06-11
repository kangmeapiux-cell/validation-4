'use strict';

const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { docClient } = require('../lib/dynamoClient');
const { buildResponse } = require('../lib/response');
const { TABLE_NAME } = require('../lib/constants');

/**
 * Lambda handler: GET /tareas
 * Scans all tasks from DynamoDB and returns them as an array.
 *
 * @param {Object} event - API Gateway event
 * @returns {Object} API Gateway response
 */
exports.handler = async (event) => {
  try {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
      })
    );

    const items = result.Items || [];

    console.log(JSON.stringify({ level: 'INFO', handler: 'listTasks', count: items.length }));

    return buildResponse(200, true, items, null);
  } catch (err) {
    console.log(JSON.stringify({ level: 'ERROR', handler: 'listTasks', message: err.message }));
    return buildResponse(500, false, null, 'Internal server error');
  }
};
