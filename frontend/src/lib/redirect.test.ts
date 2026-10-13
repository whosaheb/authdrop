import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyRedirect } from './redirect';
import { emailProblem, parseUid, redirectUriListProblems, redirectUriProblem, sanitiseOtp } from './validators';
import { describeUserAgent, eventLabel } from './format';

const ORIGIN = 'http://localhost:5173';

test('relative paths stay internal', () => {
  assert.deepEqual(classifyRedirect('/account/settings', ORIGIN), { kind: 'internal', path: '/account/settings' });
});
test('absolute foreign URLs are external', () => {
  assert.deepEqual(classifyRedirect('https://app.example.com/cb?code=1', ORIGIN), { kind: 'external', url: 'https://app.example.com/cb?code=1' });
});
test('same-origin absolute URLs become internal', () => {
  assert.deepEqual(classifyRedirect('http://localhost:5173/oauth/auth/abc?x=1', ORIGIN), { kind: 'internal', path: '/oauth/auth/abc?x=1' });
});
test('dangerous targets are rejected', () => {
  for (const bad of ['//evil.com', '/\\evil.com', 'javascript:alert(1)', 'data:text/html,hi', 'https://u:p@evil.com', '', null, 'https://a.com/\n']) {
    assert.equal(classifyRedirect(bad, ORIGIN), null, String(bad));
  }
});
test('uid parsing', () => {
  assert.equal(parseUid('abcDEF_123-xyz'), 'abcDEF_123-xyz');
  assert.equal(parseUid('short'), undefined);
  assert.equal(parseUid('a'.repeat(65)), undefined);
  assert.equal(parseUid('bad uid with spaces'), undefined);
});
test('redirect uri policy mirrors backend', () => {
  assert.equal(redirectUriProblem('https://a.example/cb'), null);
  assert.equal(redirectUriProblem('http://localhost:3000/cb'), null);
  assert.notEqual(redirectUriProblem('http://example.com/cb'), null);
  assert.notEqual(redirectUriProblem('https://a.example/*'), null);
  assert.notEqual(redirectUriProblem('https://a.example/cb#x'), null);
  assert.notEqual(redirectUriProblem('https://u:p@a.example/cb'), null);
  assert.notEqual(redirectUriProblem('/relative'), null);
});
test('redirect uri list flags duplicates and emptiness', () => {
  assert.equal(redirectUriListProblems([], 10).list !== null, true);
  assert.deepEqual(redirectUriListProblems(['https://a.io/x', 'https://a.io/x']).rows.map((r) => r !== null), [false, true]);
});
test('email and otp helpers', () => {
  assert.equal(emailProblem('ada@example.com'), null);
  assert.notEqual(emailProblem('nope'), null);
  assert.equal(sanitiseOtp('12 34-56789'), '123456');
});
test('format helpers', () => {
  assert.equal(describeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120 Safari/537'), 'Chrome on macOS');
  assert.equal(eventLabel('oidc.token.granted'), 'Token granted');
});
