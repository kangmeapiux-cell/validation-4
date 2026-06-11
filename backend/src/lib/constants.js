'use strict';

/**
 * Reads the TASKS_TABLE environment variable and exports it as TABLE_NAME.
 * Throws an Error at module load time if the variable is not defined.
 *
 * @type {string}
 */
const TABLE_NAME = process.env.TASKS_TABLE;

if (TABLE_NAME === undefined) {
  throw new Error('TASKS_TABLE environment variable is not set');
}

module.exports = { TABLE_NAME };
