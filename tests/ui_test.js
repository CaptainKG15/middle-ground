// Browser checks for the Middle Ground demo page. Needs playwright and a local web server on port 8126 serving this folder:
//   python3 -m http.server 8126   (from the project root), then   node tests/ui_test.js
// It runs the page against a simulated chain that follows the contract's rules, and a pretend wallet. It does not use a real network.
const { chromium } = require("playwright");
const STUB = `
const S = globalThis.__mg = globalThis.__mg || { cases: [], failBefore: 0, notFound: 0, hard: null, proposeFail: 0, paid: [], deployed: false };
const shareFor = (c) => c.round > 1 ? 60 : /Flat/.test(c.title) ? 85 : /Pitch|late drop/.test(c.title) ? 55 : /Ticket/.test(c.title) ? 45 : 50;
const view = (i) => { const c = S.cases[i]; return new Map(Object.entries({ id: BigInt(i), holder: c.holder, claimant: c.claimant, title: c.title, amount: c.amount, state: c.state, round: BigInt(c.round), waive: c.waive, holder_text: c.h_text, claimant_text: c.c_text, holder_url: c.h_url, claimant_url: c.c_url,
  holder_done: c.h_done, claimant_done: c.c_done, share: BigInt(c.share), reason: c.reason, rejected_by: c.rej, proposals: BigInt(c.proposals), holder_response: c.h_resp, claimant_response: c.c_resp, holder_due: c.h_due, claimant_due: c.c_due, paid: c.paid, outcome: c.outcome, last: c.last })); };
const meOf = (o) => !o || !o.account ? null : (typeof o.account === "string" ? o.account : o.account.address);
const eq = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
export function generatePrivateKey() { return "0x" + [...crypto.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, "0")).join(""); }
export function createAccount(pk) { return { address: "0x" + pk.slice(2, 42) }; }
export function createClient(o) { const me = meOf(o); return {
  connect: async () => {}, initializeConsensusSmartContract: async () => {},
  deployContract: async () => { S.deployed = true; return "0x" + "8".repeat(64); }, waitForTransactionReceipt: async () => ({ data: { contract_address: "0x" + "e".repeat(40) } }),
  readContract: async ({ functionName: f, args }) => { if (S.notFound > 0) { S.notFound--; throw new Error("Requested resource not found."); } if (f === "count") return BigInt(S.cases.length); if (!S.cases[Number(args[0])]) throw new Error("[EXPECTED] unknown case"); return view(Number(args[0])); },
  writeContract: async ({ functionName: f, args, value }) => {
    if (S.failBefore > 0) { S.failBefore--; throw new Error("An unknown RPC error occurred."); }
    if (S.hard && S.hard.fn === f && S.hard.times > 0) { S.hard.times--; throw new Error("boom: the contract refused this"); }
    if (f === "open_case") { const v = BigInt(value || 0); if (v < 200000000000000n) return "0x" + "6".repeat(64); S.cases.push({ holder: me, claimant: args[0], title: args[1], amount: v, state: "gathering", round: 1, waive: !!args[2], h_text: "", c_text: "", h_url: "", c_url: "", h_done: false, c_done: false, share: 0, reason: "", rej: "", proposals: 0, h_resp: "", c_resp: "", h_due: 0n, c_due: 0n, paid: 0n, outcome: "", last: "" }); return "0x" + "7".repeat(64); }
    const c = S.cases[Number(args[0])]; if (!c) throw new Error("[EXPECTED] unknown case");
    const who = eq(me, c.holder) ? "holder" : eq(me, c.claimant) ? "claimant" : null;
    const settle = (share, oc) => { const cd = c.amount * BigInt(share) / 100n; c.c_due = cd; c.h_due = c.amount - cd; c.state = "settled"; c.outcome = oc; };
    if (f === "submit_statement") { if (!who) throw new Error("[EXPECTED] only the two parties can do this"); if (c.state !== "gathering") throw new Error("[EXPECTED] this case is not collecting statements"); const mark = c.round > 1 ? "\\n[Reply in round 2] " : ""; if (who === "holder") { if (c.h_done) throw new Error("[EXPECTED] already written"); c.h_text += mark + args[1]; c.h_done = true; c.h_url = args[2] || c.h_url; } else { if (c.c_done) throw new Error("[EXPECTED] already written"); c.c_text += mark + args[1]; c.c_done = true; c.c_url = args[2] || c.c_url; } if (c.h_done && c.c_done) c.state = "ready"; }
    else if (f === "propose") { if (!(c.state === "ready" || (c.state === "gathering" && c.waive && c.c_done && !c.h_done && c.round === 1))) throw new Error("[EXPECTED] the case is not ready for a proposal"); c.proposals++; if (S.proposeFail > 0) { S.proposeFail--; c.last = "invalid"; return "0x" + "7".repeat(64); } c.share = shareFor(c); c.reason = "A fair middle for these two."; c.state = "proposed"; c.h_resp = ""; c.c_resp = ""; c.last = "proposed"; }
    else if (f === "respond") { if (!who) throw new Error("[EXPECTED] only the two parties can do this"); if (c.state !== "proposed") throw new Error("[EXPECTED] there is no proposal to answer"); const m = args[1] ? "accept" : "reject"; if (who === "holder") { if (c.h_resp) throw new Error("[EXPECTED] already answered"); c.h_resp = m; } else { if (c.c_resp) throw new Error("[EXPECTED] already answered"); c.c_resp = m; }
      if (c.h_resp && c.c_resp) { if (c.h_resp === "accept" && c.c_resp === "accept") settle(c.share, "agreed"); else { c.rej = c.h_resp === "reject" && c.c_resp === "reject" ? "both parties" : c.h_resp === "reject" ? "the holder" : "the claimant"; if (c.round < 2) { c.round = 2; c.state = "gathering"; c.h_done = false; c.c_done = false; c.h_resp = ""; c.c_resp = ""; } else settle(50, "fallback"); } } }
    else if (f === "cancel") { if (who !== "holder" || c.state !== "gathering" || c.c_done || c.proposals > 0) throw new Error("[EXPECTED] a case can only be cancelled before the claimant has written anything"); settle(0, "cancelled"); }
    else if (f === "withdraw") { if (!who || c.state !== "settled") throw new Error("[EXPECTED] the case has not been settled"); const a = who === "holder" ? c.h_due : c.c_due; if (a <= 0n) throw new Error("[EXPECTED] nothing to withdraw"); if (who === "holder") c.h_due = 0n; else c.c_due = 0n; c.paid += a; S.paid.push([me, a]); }
    return "0x" + "7".repeat(64); } }; }
export const studionet = {}; export const testnetBradbury = {}; export const TransactionStatus = { ACCEPTED: "ACCEPTED" };`;
const WALLET = "0xa82b922E107b75f374D36946Cd446613bF38f522"; const balances = {};
async function open(b, { wallet = false, w = 1280, h = 900, preload = null } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); await ctx.addInitScript(() => { window.__fastSleep = true; });
  if (preload) await ctx.addInitScript((c) => { c.amount = BigInt(c.amount); c.h_due = 0n; c.c_due = 0n; c.paid = 0n; globalThis.__mg = { cases: [c], failBefore: 0, notFound: 0, hard: null, proposeFail: 0, paid: [], deployed: false }; }, preload);
  if (wallet) await ctx.addInitScript((addr) => { const L = {}; window.__calls = []; window.__sent = []; window.__chain = "0x107d"; window.ethereum = { request: async ({ method, params }) => { window.__calls.push(method); if (method === "eth_requestAccounts") return [addr]; if (method === "eth_chainId") return window.__chain; if (method === "wallet_switchEthereumChain") { window.__chain = params[0].chainId; return null; }
    if (method === "eth_sendTransaction") { window.__sent.push(params[0]); await window.__credit(params[0].to, params[0].value); return "0x" + "9".repeat(64); } if (method === "eth_getTransactionReceipt") return { status: "0x1" }; return null; }, on: (e, cb) => { (L[e] = L[e] || []).push(cb); } }; window.__emit = (e, p) => (L[e] || []).forEach((cb) => cb(p)); }, WALLET);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message)); await p.exposeFunction("__credit", (to, hex) => { const k = to.toLowerCase(); balances[k] = (balances[k] || 0n) + BigInt(hex); });
  await p.route(/esm\.sh\/genlayer-js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: STUB })); await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.route("https://rpc-bradbury.genlayer.com/**", (r) => { const a = String(JSON.parse(r.request().postData()).params[0]).toLowerCase(); const v = a === WALLET.toLowerCase() ? 5n * 10n ** 18n : (balances[a] || 0n); r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x" + v.toString(16) }) }); });
  return p;
}
let bad = 0; const ok = (n, c, x = "") => { console.log((c ? "PASS " : "FAIL ") + n + (x ? "  -> " + x : "")); if (!c) bad++; };
(async () => {
  const b = await chromium.launch(); const url = "http://localhost:8126/app/index.html"; const txt = async (p, s) => ((await p.textContent(s)) || "").replace(/\s+/g, " ").trim();
  const studio = async () => { const p = await open(b); await p.goto(url + "?network=studionet"); await p.waitForTimeout(700); return p; };
  const deploy = async (p) => { await p.click("#bDeploy"); await p.waitForTimeout(500); };
  const S = (p, f, a) => p.evaluate(f, a); const GEN = (n) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;  // exact: whole millionths of a GEN
  // Studio: the whole mediation, alone
  let p = await studio(); ok("Studio connects a test key by itself", (await txt(p, "#chipNet")) === "Studio test key"); ok("the four disputes load as buttons", (await p.locator("#presets button").count()) === 4);
  await p.click("#bRun"); await p.waitForTimeout(500); ok("running before a mediator exists says what to do", (await txt(p, "#alertTitle")).includes("Set up the mediator first"));
  await deploy(p); ok("deploying fills in the address", /^0x[0-9a-f]{40}$/i.test(await p.inputValue("#addr")));
  await p.click("#bRun"); await p.waitForTimeout(2500);
  ok("every step of the mediation finished", (await p.locator("#runProg li.done").count()) === 6, (await p.locator("#runProg li.done").count()) + " of 6");
  ok("the case is settled and the bar shows the split", (await txt(p, "#cPill")) === "settled" && (await txt(p, "#lC")).startsWith("85%") && (await txt(p, "#lH")).startsWith("15%"), await txt(p, "#lC") + " | " + await txt(p, "#lH"));
  ok("exactly one case was opened", (await S(p, () => globalThis.__mg.cases.length)) === 1);
  const paid = await S(p, () => globalThis.__mg.paid.map((x) => x[1].toString())); ok("both sides withdrew, and the two payments add up to the deposit exactly", paid.length === 2 && paid.reduce((a, x) => a + BigInt(x), 0n) === GEN(0.02), paid.join(","));
  ok("the winning share went to the claimant", paid.map(BigInt).sort((a, c) => (a < c ? -1 : 1)).join() === [GEN(0.003), GEN(0.017)].join());
  ok("no page errors (simple run)", p.errs.length === 0, p.errs.join("; "));
  await p.screenshot({ path: "/tmp/shots/mg_settled.png", fullPage: true });
  // the claimant rejects, then both accept
  p = await studio(); await deploy(p); await p.selectOption("#mode", "second"); await p.click("#bRun"); await p.waitForTimeout(3000);
  ok("a rejection leads to a second proposal and an agreement", (await txt(p, "#cPill")) === "settled" && (await txt(p, "#lC")).startsWith("60%") && (await S(p, () => globalThis.__mg.cases[0].outcome)) === "agreed", await txt(p, "#lC"));
  ok("the progress line says the second proposal followed the replies", (await txt(p, "#runProg")).includes("after the replies"));
  ok("round 2 replies were added to the statements", (await S(p, () => globalThis.__mg.cases[0].h_text)).includes("[Reply in round 2]"));
  // both reject twice
  p = await studio(); await deploy(p); await p.selectOption("#mode", "fallback"); await p.click("#bRun"); await p.waitForTimeout(3000);
  ok("two rejections end in an even split", (await S(p, () => globalThis.__mg.cases[0].outcome)) === "fallback" && (await txt(p, "#lC")).startsWith("50%") && (await txt(p, "#lH")).startsWith("50%"));
  ok("an even split pays each side half", (await S(p, () => globalThis.__mg.paid.map((x) => x[1].toString()))).every((x) => BigInt(x) === GEN(0.01)));
  // a failed proposal, then the run resumes the same case
  p = await studio(); await deploy(p); await S(p, () => { globalThis.__mg.proposeFail = 1; }); await p.click("#bRun"); await p.waitForTimeout(2000);
  ok("a failed proposal is explained, and the step is marked stopped", (await txt(p, "#alertTitle")).includes("could not produce a usable proposal") && (await p.locator("#runProg li.fail").count()) === 1, await txt(p, "#alertTitle"));
  await p.click("#bRun"); await p.waitForTimeout(2500);
  ok("pressing Run again continues the SAME case and finishes it", (await S(p, () => globalThis.__mg.cases.length)) === 1 && (await txt(p, "#cPill")) === "settled");
  // a hard stop mid-way, then resume
  p = await studio(); await deploy(p); await S(p, () => { globalThis.__mg.hard = { fn: "respond", times: 1 }; }); await p.click("#bRun"); await p.waitForTimeout(2000);
  ok("a hard failure stops the run with a message", (await p.locator("#runProg li.fail").count()) === 1 && (await S(p, () => globalThis.__mg.cases[0].state)) === "proposed");
  await p.click("#bRun"); await p.waitForTimeout(2500); ok("the run resumes without opening a second case or answering twice", (await S(p, () => globalThis.__mg.cases.length)) === 1 && (await txt(p, "#cPill")) === "settled");
  // flaky network
  p = await studio(); await deploy(p); await S(p, () => { globalThis.__mg.failBefore = 3; }); await p.click("#bRun"); await p.waitForTimeout(3500);
  ok("three network errors in a row are retried and the case still settles", (await txt(p, "#cPill")) === "settled" && (await txt(p, "#log")).includes("hiccuped") && (await S(p, () => globalThis.__mg.cases.length)) === 1);
  p = await studio(); await S(p, () => { globalThis.__mg.notFound = 2; }); await p.click("#bDeploy"); await p.waitForTimeout(1500); ok("a brand-new contract that cannot be read yet is retried with no error shown", !(await txt(p, "#log")).includes("ERROR"));
  // all four disputes
  p = await studio(); await deploy(p); await p.evaluate(() => { document.getElementById("exWrap").open = true; }); await p.click("#bEx"); await p.waitForTimeout(6000);
  const v = await p.locator("#exBody tr td:last-child").allTextContents(); ok("all four disputes run and are compared with the design", v.length === 4 && v.every((x) => x === "yes"), v.join(","));
  ok("the results text is ready to copy", (await p.inputValue("#exOut")).includes("4 of 4 run") && (await S(p, () => globalThis.__mg.cases.length)) === 4);
  // a real second person: the claimant opens a link with their own wallet
  p = await open(b, { wallet: true, preload: { holder: "0x" + "1".repeat(40), claimant: "0xa82b922E107b75f374D36946Cd446613bF38f522", title: "Flat deposit after move-out", amount: "20000000000000000", state: "gathering", round: 1, waive: false, h_text: "", c_text: "", h_url: "", c_url: "", h_done: false, c_done: false, share: 0, reason: "", rej: "", proposals: 0, h_resp: "", c_resp: "", outcome: "", last: "" } });
  await p.goto(url + "?network=bradbury&address=0x" + "e".repeat(40) + "&case=0"); await p.waitForTimeout(700); ok("a visitor who is not connected sees the case and is told to connect", (await txt(p, "#acts")).includes("Connect the holder's or the claimant's wallet"));
  await p.click("#bConnect"); await p.waitForTimeout(700); ok("after connecting as the claimant, only the claimant's statement form appears", (await p.locator("#acts textarea").count()) === 1 && (await txt(p, "#acts")).includes("Claimant: write your statement"));
  await p.locator("#acts button", { hasText: "Use the example text" }).click(); await p.locator("#acts button", { hasText: "Submit" }).click(); await p.waitForTimeout(800);
  ok("the claimant's statement is written on the chain", (await S(p, () => globalThis.__mg.cases[0].c_done)) === true && (await txt(p, "#tC")).includes("signed move-in inventory"));
  await S(p, () => { const c = globalThis.__mg.cases[0]; c.h_done = true; c.h_text = "The holder's side of it, written elsewhere."; c.state = "ready"; });
  await p.locator("#clist button", { hasText: "Open" }).first().click(); await p.waitForTimeout(500); ok("once both have written, anyone can ask for a proposal", (await p.locator("#acts button", { hasText: "Ask the validators for a proposal" }).count()) === 1);
  await p.locator("#acts button", { hasText: "Ask the validators for a proposal" }).click(); await p.waitForTimeout(1000);
  ok("the proposal appears on the split bar with its reason", (await txt(p, "#cPill")) === "proposal waiting for answers" && (await txt(p, "#lC")).startsWith("85%") && (await txt(p, "#cReason")).includes("fair middle"));
  ok("the claimant is offered Accept and Reject, but not the holder's buttons", (await p.locator("#acts button", { hasText: "Accept" }).count()) === 1 && (await txt(p, "#acts")).includes("Claimant: do you accept") && !(await txt(p, "#acts")).includes("Holder: do you accept"));
  await p.locator("#acts button", { hasText: "Accept" }).click(); await p.waitForTimeout(800); ok("one acceptance leaves the case waiting for the other side", (await txt(p, "#cPill")) === "proposal waiting for answers" && (await txt(p, "#cNext")).includes("Claimant: accept"));
  await S(p, () => { const c = globalThis.__mg.cases[0]; c.h_resp = "accept"; c.share = 85; c.c_due = c.amount * 85n / 100n; c.h_due = c.amount - c.c_due; c.state = "settled"; c.outcome = "agreed"; });
  await p.locator("#clist button", { hasText: "Open" }).first().click(); await p.waitForTimeout(500); ok("when both have agreed the claimant can withdraw their share", (await p.locator("#acts button", { hasText: "Claimant: withdraw 0.017 GEN" }).count()) === 1);
  await p.locator("#acts button", { hasText: "Claimant: withdraw" }).click(); await p.waitForTimeout(800); ok("the withdrawal pays the claimant's wallet exactly their share", (await S(p, () => globalThis.__mg.paid.map((x) => x[0].toLowerCase() + ":" + x[1]))).join() === "0xa82b922e107b75f374d36946cd446613bf38f522:17000000000000000");
  ok("the case offers a link to share with the other person", (await p.locator("#acts button", { hasText: "Copy a link for the other person" }).count()) === 1);
  // Bradbury with a wallet, playing both sides
  p = await open(b, { wallet: true }); await p.goto(url + "?network=bradbury"); await p.waitForTimeout(600);
  ok("Bradbury is the default and offers Connect wallet", (await txt(p, "[data-net].on")) === "Bradbury" && (await p.isVisible("#bConnectTop")));
  await p.click("#bConnect"); await p.waitForTimeout(600); ok("connecting shows the address, network and balance", (await txt(p, "#chipAddr")) === "0xa82b...f522" && (await txt(p, "#chipNet")) === "Bradbury" && /GEN/.test(await txt(p, "#chipBal")));
  await deploy(p); await p.click("#bRun"); await p.waitForTimeout(3000);
  const sent = await p.evaluate(() => window.__sent); ok("the demo claimant is funded once with 0.004 test GEN for gas", sent.length === 1 && sent[0].value === "0x" + (4n * 10n ** 15n).toString(16), JSON.stringify(sent.map((t) => t.value)));
  ok("the Bradbury mediation settles and both sides are paid", (await txt(p, "#cPill")) === "settled" && (await S(p, () => globalThis.__mg.paid.length)) === 2);
  await p.evaluate(() => { window.__chain = "0x1"; window.__emit("chainChanged", "0x1"); }); await p.waitForTimeout(500); ok("a wrong network is explained, with a fix", (await txt(p, "#alertTitle")).includes("different network"));
  p = await open(b); await p.goto(url); await p.waitForTimeout(500); await p.click("#bConnect"); await p.waitForTimeout(300); ok("with no wallet installed the page explains what to do", (await txt(p, "#alertTitle")).includes("No wallet found"));
  p = await open(b, { wallet: true }); await p.goto(url); await p.waitForTimeout(500); await p.click("#bDeploy"); await p.waitForTimeout(400); ok("deploying before connecting says to connect first", (await txt(p, "#alertTitle")).includes("Connect your wallet first"));
  // phone
  const m = await open(b, { wallet: true, w: 390, h: 844 }); await m.goto(url); await m.waitForTimeout(700); await m.click("#bConnect"); await m.waitForTimeout(500); await deploy(m); await m.click("#bRun"); await m.waitForTimeout(3000);
  ok("phone: no sideways scrolling", await m.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)); await m.screenshot({ path: "/tmp/shots/mg_mobile.png", fullPage: true });
  // the copy-able results text must name the network and the mediator that are actually in use
  const r = await studio(); const t0 = await r.inputValue("#exOut"); await deploy(r); const addr = await r.inputValue("#addr"); const t1 = await r.inputValue("#exOut");
  ok("the results text names Studio before a mediator exists", t0.includes("on Studio"), t0.split("\n")[0]);
  ok("the results text names the mediator once it is deployed", t1.includes("mediator " + addr), t1.split("\n")[0]);
  await r.click('[data-net="bradbury"]'); await r.waitForTimeout(500); ok("the results text follows a switch to Bradbury", (await r.inputValue("#exOut")).includes("on Bradbury"), (await r.inputValue("#exOut")).split("\n")[0]);
  console.log(bad ? "\n" + bad + " FAILED" : "\nall checks passed"); await b.close(); process.exit(bad ? 1 : 0);
})();
