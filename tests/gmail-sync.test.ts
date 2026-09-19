import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncSingleGmailAccount } from '../supabase/functions/scan-gmail/sync-account.ts';

const connection = { user_id: 'u', email: 'me@example.com', refresh_token: 'test', last_synced_at: '2026-09-18T00:00:00Z' };
function database() {
  const rows = new Map<string, any>();
  const stats: any[] = [];
  const db = { rows, stats, from(table: string) {
    const query: any = {
      select() { return this; }, eq() { return this; }, in() { return this; },
      maybeSingle() { return Promise.resolve({ data: null, error: null }); },
      upsert(row: any) { rows.set(row.message_id, row); return Promise.resolve({ error: null }); },
      update(row: any) { stats.push(row); return this; },
      then(resolve: any) { return Promise.resolve({ data: table === 'gmail_message_results' ? [...rows.values()] : [], error: null }).then(resolve); },
    }; return query;
  } };
  return db;
}
function mail(body: string) {
  return { internalDate: String(Date.parse('2026-09-18T12:00:00Z')), payload: {
    headers: [{ name: 'Subject', value: 'Application update' }], mimeType: 'text/plain',
    body: { data: Buffer.from(body).toString('base64url') },
  } };
}
const classification = { eventType: 'Unrelated', company: '', role: '', interviewDate: '', reason: 'Confirmation only', evidence: '', confidence: .99, ambiguous: false };
async function withNetwork(handler: (url: string) => Response, run: () => Promise<void>) {
  const original = globalThis.fetch;
  (globalThis as any).Deno = { env: { get: () => 'test' } };
  globalThis.fetch = async url => handler(String(url));
  try { await run(); } finally { globalThis.fetch = original; delete (globalThis as any).Deno; }
}
test('ignored emails persist and do not call AI or fetch full message on next run', async () => {
  const db = database(); let modelCalls = 0, messageCalls = 0;
  await withNetwork(url => {
    if (url.includes('oauth2')) return Response.json({ access_token: 'token' });
    if (url.includes('/messages?')) return Response.json({ messages: [{ id: 'm' }] });
    if (url.includes('/messages/m')) { messageCalls++; return Response.json(mail('Thank you for your application.')); }
    modelCalls++; return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(classification) }] }] });
  }, async () => {
    assert.equal((await syncSingleGmailAccount(db, connection)).success, true);
    assert.ok(db.stats[0].last_synced_at);
    await syncSingleGmailAccount(db, connection);
    assert.equal(modelCalls, 1); assert.equal(messageCalls, 1);
    assert.equal(db.rows.get('m').outcome, 'ignored');
  });
});
test('failed Gmail fetch does not advance checkpoint', async () => {
  const db = database();
  await withNetwork(url => url.includes('oauth2') ? Response.json({ access_token: 'token' })
    : url.includes('/messages?') ? Response.json({ messages: [{ id: 'm' }] })
    : new Response('', { status: 503 }), async () => {
    const result = await syncSingleGmailAccount(db, connection);
    assert.equal(result.success, false); assert.equal(db.stats[0].last_synced_at, undefined);
    assert.equal(db.rows.size, 0);
  });
});
test('failed AI call does not advance checkpoint or cache unrelated outcome', async () => {
  const db = database();
  await withNetwork(url => url.includes('oauth2') ? Response.json({ access_token: 'token' })
    : url.includes('/messages?') ? Response.json({ messages: [{ id: 'm' }] })
    : url.includes('/messages/m') ? Response.json(mail('We have decided to pursue other candidates.'))
    : new Response('', { status: 429 }), async () => {
    const result = await syncSingleGmailAccount(db, connection);
    assert.equal(result.success, false); assert.equal(db.stats[0].last_synced_at, undefined);
    assert.equal(db.rows.size, 0);
  });
});
test('ambiguous candidate is durably queued for review without application mutation', async () => {
  const db = database();
  const body = 'We would like to invite you to interview.';
  await withNetwork(url => url.includes('oauth2') ? Response.json({ access_token: 'token' })
    : url.includes('/messages?') ? Response.json({ messages: [{ id: 'm' }] })
    : url.includes('/messages/m') ? Response.json(mail(body))
    : Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ ...classification, eventType: 'Interview', evidence: body }) }] }] }), async () => {
    const result = await syncSingleGmailAccount(db, connection);
    assert.equal(result.applications_updated, 0);
    assert.equal(db.rows.get('m').outcome, 'needs_review');
    assert.ok(db.stats[0].last_synced_at);
  });
});
