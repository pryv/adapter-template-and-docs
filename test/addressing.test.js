/**
 * @license
 * [BSD-3-Clause](https://github.com/pryv/adapter-template-and-docs/blob/master/LICENSE)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addressedAccount, resourceUrl, requireAccount } from '../examples/addressing.mjs';

const BASE = 'https://alice.example.com/adapter/calendar/';
const PLATFORM = 'https://reg.example.com/adapter/calendar/';

function nodeReq (headers) {
  return { headers };
}

function fakeRes () {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead (status, headers) { this.status = status; this.headers = headers; },
    end (body) { this.body = body; }
  };
}

const addressed = nodeReq({ host: 'alice.example.com', 'x-adapter-name': 'alice', 'x-adapter-base': BASE });
const platform = nodeReq({ host: 'reg.example.com' });

test('[ADDR2] addressedAccount returns the pair on an addressed request', () => {
  assert.deepEqual(addressedAccount(addressed), { name: 'alice', base: BASE });
});

test('[ADDR3] addressedAccount reads a Fetch API Request too', () => {
  const req = new Request('https://alice.example.com/adapter/calendar/x', {
    headers: { 'X-Adapter-Name': 'alice', 'X-Adapter-Base': BASE }
  });
  assert.deepEqual(addressedAccount(req), { name: 'alice', base: BASE });
});

test('[ADDR4] addressedAccount is null at a platform address, and never reads Host', () => {
  assert.equal(addressedAccount(platform), null);
  assert.equal(addressedAccount(nodeReq({ host: 'alice.example.com' })), null);
  assert.equal(addressedAccount(nodeReq({ 'x-adapter-name': 'alice' })), null, 'name without base');
  assert.equal(addressedAccount(nodeReq({ 'x-adapter-base': BASE })), null, 'base without name');
});

test('[ADDR5] a malformed pair is read as absent', () => {
  const bad = [
    { 'x-adapter-name': 'Alice', 'x-adapter-base': BASE },
    { 'x-adapter-name': 'alice, bob', 'x-adapter-base': BASE },
    { 'x-adapter-name': 'alice', 'x-adapter-base': 'https://alice.example.com/adapter/calendar' },
    { 'x-adapter-name': 'alice', 'x-adapter-base': 'not a url/' },
    { 'x-adapter-name': 'alice', 'x-adapter-base': 'javascript:alert(1)/' },
    { 'x-adapter-name': 'alice', 'x-adapter-base': 'https://u:p@alice.example.com/adapter/calendar/' },
    { 'x-adapter-name': 'alice', 'x-adapter-base': BASE + ', ' + PLATFORM }
  ];
  for (const headers of bad) assert.equal(addressedAccount(nodeReq(headers)), null, JSON.stringify(headers));
});

test('[ADDR6] a base with an explicit port is kept as sent', () => {
  const base = 'https://alice.example.com:8443/adapter/calendar/';
  assert.deepEqual(addressedAccount(nodeReq({ 'x-adapter-name': 'alice', 'x-adapter-base': base })), { name: 'alice', base });
});

test('[ADDR7] resourceUrl uses the account base, else the configured platform base', () => {
  assert.equal(resourceUrl(addressed, 'r4/metadata', PLATFORM), BASE + 'r4/metadata');
  assert.equal(resourceUrl(addressed, '/r4/metadata', PLATFORM), BASE + 'r4/metadata');
  assert.equal(resourceUrl(platform, 'r4/metadata', PLATFORM), PLATFORM + 'r4/metadata');
  assert.equal(resourceUrl(nodeReq({ host: 'alice.example.com' }), 'x', PLATFORM), PLATFORM + 'x', 'Host is never used');
});

test('[ADDR8] requireAccount answers 404 JSON at a platform address', () => {
  const res = fakeRes();
  assert.equal(requireAccount(platform, res), null);
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /application\/json/);
  assert.equal(JSON.parse(res.body).error.id, 'unknown-resource');
  assert.ok(!res.body.includes('reg.example.com'), 'reflects nothing from the request');
});

test('[ADDR9] requireAccount returns the account and writes nothing on an addressed request', () => {
  const res = fakeRes();
  assert.deepEqual(requireAccount(addressed, res), { name: 'alice', base: BASE });
  assert.equal(res.status, null);
  assert.equal(res.body, null);
});
