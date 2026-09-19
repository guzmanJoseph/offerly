import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGmailQuery, currentMessage, isRecruitingCandidate } from '../supabase/functions/scan-gmail/filter.ts';
import { canAutoUpdate, classifyEmailWithAI, validateClassification } from '../supabase/functions/scan-gmail/classifier.ts';
import { findMatchingApplication, statusDecision, updateApplicationStatus } from '../supabase/functions/scan-gmail/applications.ts';
import { searchGmailMessages } from '../supabase/functions/scan-gmail/gmail.ts';
import type { ApplicationRecord, ClassificationResult, GmailEmail } from '../supabase/functions/scan-gmail/types.ts';

const app: ApplicationRecord = { id: '1', user_id: 'u', company: 'Disney', role: 'Software Engineering Intern', status: 'Applied', updated_at: null, gmail_event_at: null, gmail_status_updated_at: null };
const email: GmailEmail = { messageId: 'm', receivedAt: '2026-09-19T12:00:00Z', date: '', from: 'Disney Recruiting', subject: 'Software Engineering Intern', snippet: '', body: 'After careful consideration, we would like to invite you to interview.' };
const event: ClassificationResult = { eventType: 'Interview', company: 'Disney', role: app.role, confidence: .96, evidence: email.body, ambiguous: false, reason: '', interviewDate: '' };

test('vague rejection without old search phrases reaches classifier', () => {
  assert.ok(isRecruitingCandidate({ ...email, from: 'Hiring Team', subject: 'Your candidacy', body: 'We have decided to pursue other candidates.' }, []));
});
test('ordinary receipt avoids AI', () => {
  assert.equal(isRecruitingCandidate({ ...email, from: 'Grocery Store', subject: 'Receipt', body: 'Your total is $32.00' }, [app]), false);
});
test('quoted invitation cannot justify new event', () => {
  const body = 'Thank you.\nOn Monday, Recruiter wrote:\n' + email.body;
  assert.equal(currentMessage(body), 'Thank you.');
  assert.equal(canAutoUpdate(event, { ...email, body }), false);
});
test('only supported high-confidence nonambiguous events update', () => {
  assert.ok(canAutoUpdate(event, email));
  assert.equal(canAutoUpdate({ ...event, confidence: .6 }, email), false);
  assert.equal(canAutoUpdate({ ...event, ambiguous: true }, email), false);
  assert.equal(canAutoUpdate({ ...event, evidence: 'We are pleased to offer you this position.' }, email), false);
});
test('company-only match abstains even with one application', () => {
  assert.equal(findMatchingApplication([app], { ...event, role: '' }, email), null);
});
test('same company different jobs match only explicit full role', () => {
  const other = { ...app, id: '2', role: 'Data Science Intern' };
  assert.equal(findMatchingApplication([other, app], event, email)?.id, '1');
  assert.equal(findMatchingApplication([other, app], { ...event, role: 'Intern' }, email), null);
});
test('duplicate role titles abstain instead of picking first', () => {
  assert.equal(findMatchingApplication([app, { ...app, id: '2' }], event, email), null);
});
test('model-invented company and role are rejected', () => {
  assert.equal(findMatchingApplication([app], event, { ...email, from: 'Recruiting', subject: 'Update', body: 'We would like to invite you to interview.' }), null);
});
test('company substring collisions are rejected', () => {
  assert.equal(findMatchingApplication([{ ...app, company: 'Meta' }], { ...event, company: 'Metaverse' }, { ...email, from: 'Metaverse' }), null);
});
test('malformed model responses are retryable errors', () => {
  assert.throws(() => validateClassification({ ...event, confidence: '0.95' }));
  assert.throws(() => validateClassification({ ...event, eventType: 'Applied' }));
});
test('timestamps preserve newer events and manual edits', () => {
  assert.ok(statusDecision({ ...app, gmail_event_at: '2026-09-20T00:00:00Z' }, 'Rejected', email.receivedAt));
  assert.ok(statusDecision({ ...app, updated_at: '2026-09-20T00:00:00Z' }, 'Rejected', email.receivedAt));
  assert.equal(statusDecision({ ...app, updated_at: '2026-09-20T00:00:00Z', gmail_status_updated_at: '2026-09-20T00:00:00Z', gmail_event_at: '2026-09-18T00:00:00Z' }, 'Interview', email.receivedAt), null);
});
test('terminal states and stage regressions need review', () => {
  assert.ok(statusDecision({ ...app, status: 'Withdrawn' }, 'Interview', email.receivedAt));
  assert.ok(statusDecision({ ...app, status: 'Offer' }, 'Rejected', email.receivedAt));
  assert.ok(statusDecision({ ...app, status: 'Interview' }, 'Assessment', email.receivedAt));
});
test('search has overlap, bounded end, and no keyword gate', () => {
  const query = buildGmailQuery('2026-09-19T00:00:00Z', Date.parse(email.receivedAt));
  assert.ok(query.includes(`after:${Date.parse('2026-09-18T23:55:00Z') / 1000}`));
  assert.ok(query.includes('before:'));
  assert.equal(query.includes('interview'), false);
});
test('Gmail pagination retrieves beyond first page', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url) => {
    calls++;
    if (calls === 2) assert.ok(String(url).includes('pageToken=next'));
    return Response.json(calls === 1 ? { messages: [{ id: '1' }], nextPageToken: 'next' } : { messages: [{ id: '2' }] });
  };
  try { assert.deepEqual(await searchGmailMessages('token', 'query'), ['1', '2']); } finally { globalThis.fetch = original; }
});
test('keyword phrase does not bypass model extraction', async () => {
  const original = globalThis.fetch;
  (globalThis as any).Deno = { env: { get: () => 'test' } };
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls++;
    const request = JSON.parse(String(init?.body));
    assert.equal(request.text.format.type, 'json_schema');
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(event) }] }] });
  };
  try { assert.deepEqual(await classifyEmailWithAI(email), event); assert.equal(calls, 1); }
  finally { globalThis.fetch = original; delete (globalThis as any).Deno; }
});
test('classifier API failure is not labeled unrelated', async () => {
  const original = globalThis.fetch;
  (globalThis as any).Deno = { env: { get: () => 'test' } };
  globalThis.fetch = async () => new Response('', { status: 429 });
  try { await assert.rejects(classifyEmailWithAI(email), /429/); }
  finally { globalThis.fetch = original; delete (globalThis as any).Deno; }
});
test('concurrent application edit triggers retry without mutating in-memory state', async () => {
  const candidate = { ...app };
  const query = { eq() { return this; }, is() { return this; }, async select() { return { data: [], error: null }; } };
  const db = { from: () => ({ update: () => query }) };
  await assert.rejects(updateApplicationStatus(db, candidate, 'Interview', email.receivedAt), /changed during sync/);
  assert.equal(candidate.status, 'Applied');
});
