'use strict';
/**
 * seed-data.js — Populates DynamoDB TasksTable with mock tasks.
 * Usage: TASKS_TABLE=<table-name> AWS_REGION=<region> node scripts/seed-data.js
 *
 * For local dev with SAM local:
 *   TASKS_TABLE=validation-4-tasks-local AWS_REGION=us-east-1 \
 *   AWS_ENDPOINT_URL=http://localhost:8000 node scripts/seed-data.js
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.TASKS_TABLE;
if (!TABLE_NAME) {
  console.error('ERROR: TASKS_TABLE environment variable is not set.');
  process.exit(1);
}

const region = process.env.AWS_REGION || 'us-east-1';
const endpoint = process.env.AWS_ENDPOINT_URL || undefined;

const clientConfig = { region };
if (endpoint) {
  clientConfig.endpoint = endpoint;
}

const ddbClient = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

const MOCK_TASKS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    titulo: 'Comprar leche',
    completada: false,
    createdAt: '2024-01-15T08:00:00.000Z',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    titulo: 'Revisar correos del trabajo',
    completada: false,
    createdAt: '2024-01-15T09:00:00.000Z',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    titulo: 'Llamar al médico para cita',
    completada: true,
    createdAt: '2024-01-15T10:00:00.000Z',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    titulo: 'Preparar presentación del proyecto',
    completada: false,
    createdAt: '2024-01-15T11:00:00.000Z',
  },
];

async function seedData() {
  console.log(`Seeding ${MOCK_TASKS.length} tasks into table: ${TABLE_NAME}`);
  console.log(`Region: ${region}${endpoint ? ` | Endpoint: ${endpoint}` : ''}`);
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (const task of MOCK_TASKS) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: task,
          ConditionExpression: 'attribute_not_exists(id)',
        })
      );
      console.log(`  ✅  Inserted: [${task.id}] "${task.titulo}"`);
      successCount++;
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        console.log(`  ⏭️   Skipped (already exists): [${task.id}] "${task.titulo}"`);
        successCount++;
      } else {
        console.error(`  ❌  Failed: [${task.id}] "${task.titulo}" — ${err.message}`);
        errorCount++;
      }
    }
  }

  console.log('');
  console.log(`Seed complete: ${successCount} succeeded, ${errorCount} failed.`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

seedData().catch((err) => {
  console.error('Unexpected error during seed:', err);
  process.exit(1);
});
