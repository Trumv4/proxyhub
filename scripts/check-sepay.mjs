// Read-only probe: never print tokens, response bodies, bank details or balances.
export async function checkSePay(token, fetcher=fetch) {
  if (!token?.trim()) throw new Error("Missing SEPAY_API_TOKEN secret.");
  let response;
  try {
    response=await fetcher("https://userapi.sepay.vn/v2/bank-accounts?active=1&per_page=100", {
      headers:{Authorization:`Bearer ${token.trim()}`,Accept:"application/json"},
      redirect:"manual",signal:AbortSignal.timeout(15000)
    });
  } catch { throw new Error("SePay network/TLS connection failed or timed out."); }
  if (response.status!==200) throw new Error(`SePay returned HTTP ${response.status}.`);
  let body;
  try { body=await response.json(); } catch { throw new Error("SePay returned invalid JSON."); }
  if(body.status!=="success"||!Array.isArray(body.data)) throw new Error("SePay response schema does not match API v2.");
  return body.data.length;
}
if(process.argv[1]?.endsWith("check-sepay.mjs")) {
  try { const count=await checkSePay(process.env.SEPAY_API_TOKEN); console.log(`PASS: SePay API reachable; ${count} active bank account(s). No financial data printed or changed.`); }
  catch(error) { console.error(error.message); process.exitCode=1; }
}
