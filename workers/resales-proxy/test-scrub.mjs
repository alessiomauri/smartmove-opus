/**
 * Credential-scrub tests for the resales-proxy worker.
 * Run: npx tsx workers/resales-proxy/test-scrub.mjs
 */
const { scrubCredentials } = await import('./src/scrub.ts');

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('  ✗', msg);
  } else {
    console.log('  ✓', msg);
  }
}

const P1 = '1234567';
const P2 = 'f9fe74f5822a04af7e4d5c399e8972474e1c3d15';

// The exact shape the probe captured from a live error response.
const errorBody = JSON.stringify({
  transaction: {
    status: 'error',
    incomingIp: '188.114.111.99',
    errordescription: { '001': 'the IP does not match with your API key' },
    parsedmethod: '',
    parsedparameters: {
      p_pagesize: '1',
      p_sandbox: 'true',
      p1: P1,
      p2: P2,
      p_agency_filterid: '1',
    },
  },
});

console.log('— error envelope —');
{
  const out = scrubCredentials(errorBody, [P1, P2]);
  assert(!out.includes(P1), 'p1 value absent from scrubbed body');
  assert(!out.includes(P2), 'p2 value absent from scrubbed body');
  const parsed = JSON.parse(out);
  assert(parsed.transaction.parsedparameters.p1 === '[redacted]', 'p1 key redacted');
  assert(parsed.transaction.parsedparameters.p2 === '[redacted]', 'p2 key redacted');
  assert(parsed.transaction.parsedparameters.p_pagesize === '1', 'non-sensitive params untouched');
  assert(parsed.transaction.errordescription['001'].includes('IP'), 'error text preserved');
}

console.log('— key pass without matching values (caller-smuggled creds) —');
{
  const smuggled = JSON.stringify({
    transaction: { status: 'error', parsedparameters: { p1: 'SOMEONE-ELSES-KEY', p2: 'another-secret' } },
  });
  const out = scrubCredentials(smuggled, [P1, P2]);
  const parsed = JSON.parse(out);
  assert(parsed.transaction.parsedparameters.p1 === '[redacted]', 'unknown p1 value still redacted by key');
  assert(parsed.transaction.parsedparameters.p2 === '[redacted]', 'unknown p2 value still redacted by key');
}

console.log('— value pass outside known keys —');
{
  const sneaky = JSON.stringify({ transaction: { status: 'error', note: `url was ?p1=${P1}&p2=${P2}` } });
  const out = scrubCredentials(sneaky, [P1, P2]);
  assert(!out.includes(P1) && !out.includes(P2), 'secret values scrubbed from arbitrary strings');
}

console.log('— success envelope untouched —');
{
  const success = JSON.stringify({
    transaction: { status: 'success' },
    QueryInfo: { QueryId: 'abc', PropertyCount: 42 },
    Property: [{ Reference: 'R123', Price: '92000' }],
  });
  const out = scrubCredentials(success, [P1, P2]);
  assert(out === success, 'success body passes through byte-identical');
}

console.log('— non-JSON body survives —');
{
  const html = `<html>maintenance ${P2} page</html>`;
  const out = scrubCredentials(html, [P1, P2]);
  assert(!out.includes(P2), 'value pass works on non-JSON');
  assert(out.includes('<html>'), 'non-JSON body otherwise intact');
}

console.log(failures === 0 ? '\nAll scrub tests passed ✓' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
