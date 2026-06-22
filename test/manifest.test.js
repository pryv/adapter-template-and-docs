/**
 * @license
 * [BSD-3-Clause](https://github.com/pryv/adapter-template-and-docs/blob/master/LICENSE)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

function readJson (relative) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8'));
}

const schema = readJson('../manifest.schema.json');
const ajv = new Ajv2020({ allErrors: true });
const validate = ajv.compile(schema);

test('the calendar example manifest validates against the schema', () => {
  const example = readJson('../examples/calendar.manifest.json');
  const ok = validate(example);
  assert.ok(ok, 'expected example to be valid: ' + JSON.stringify(validate.errors));
});

test('name, type and version are required', () => {
  assert.equal(validate({ name: 'x', type: 'y' }), false);
  assert.equal(validate({ name: 'x', type: 'y', version: '1.0.0' }), true);
});

test('typed array fields reject wrong item types', () => {
  assert.equal(validate({ name: 'x', type: 'y', version: '1', auth: ['ok'] }), true);
  assert.equal(validate({ name: 'x', type: 'y', version: '1', auth: [42] }), false);
});
