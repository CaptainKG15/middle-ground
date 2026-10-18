# Mutation test for Middle Ground. Run: python3 tests/mutation_test.py
# Each mutant is a small deliberate bug in contracts/middle_ground.py. The test suite should FAIL for every mutant ("killed").
# A mutant that still passes ("survived") shows something the tests cannot see. A hang counts as caught.
import os, shutil, subprocess, sys, tempfile
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "contracts", "middle_ground.py")
source = open(SRC).read()
EQUIVALENT = {
    "holder's own statement not required to be absent": "a case with both statements is already in the ready state, so this condition can never be the one that decides",
    "cancel does not check the round": "once a proposal exists the proposal-count check also blocks cancelling, so the two checks back each other up",
    "cancel does not check the proposal count": "once a proposal exists the round or the state check also blocks cancelling, so the checks back each other up",
}
MUTANTS = [
    ("minimum amount lowered", "MIN_AMOUNT = 2 * 10**14", "MIN_AMOUNT = 10**14"),
    ("maximum amount raised", "MAX_AMOUNT = 10**18", "MAX_AMOUNT = 10**19"),
    ("tolerance narrowed", "TOLERANCE = 5", "TOLERANCE = 4"),
    ("tolerance widened", "TOLERANCE = 5", "TOLERANCE = 6"),
    ("a third round allowed", "MAX_ROUNDS = 2", "MAX_ROUNDS = 3"),
    ("no second round", "MAX_ROUNDS = 2", "MAX_ROUNDS = 1"),
    ("the minimum amount is excluded", "MIN_AMOUNT <= v <= MAX_AMOUNT", "MIN_AMOUNT < v <= MAX_AMOUNT"),
    ("the maximum amount is excluded", "MIN_AMOUNT <= v <= MAX_AMOUNT", "MIN_AMOUNT <= v < MAX_AMOUNT"),
    ("titles of 2 characters allowed", "3 <= len(t) <= 80", "2 <= len(t) <= 80"),
    ("title length limit raised", "3 <= len(t) <= 80", "3 <= len(t) <= 800"),
    ("claimant addresses not checked", 're.fullmatch(r"0x[0-9a-fA-F]{40}", claimant) is not None', "True"),
    ("claimant address length loosened", r'r"0x[0-9a-fA-F]{40}"', r'r"0x[0-9a-fA-F]{3,}"'),
    ("the holder can be the claimant", "if not ok or other == s:", "if not ok:"),
    ("a refund is sent even when no money came", "      if v > 0:\n        Payee(s).emit_transfer(value=u256(v))\n      return -1", "      if True:\n        Payee(s).emit_transfer(value=u256(v))\n      return -1"),
    ("a refused case refunds the wrong amount", "emit_transfer(value=u256(v))", "emit_transfer(value=u256(v - 1))"),
    ("the advance agreement is not stored", "waive=waive,", "waive=False,"),
    ("statements accepted in the wrong state", 'if c.state != "gathering":\n      raise gl.vm.UserError("[EXPECTED] this case is not collecting statements")', 'if c.state == "gathering":\n      raise gl.vm.UserError("[EXPECTED] this case is not collecting statements")'),
    ("statements of 19 characters accepted", "not 20 <= len(t) <= 800", "not 19 <= len(t) <= 800"),
    ("statement length limit raised", "not 20 <= len(t) <= 800", "not 20 <= len(t) <= 8000"),
    ("instructions in statements allowed", "or INJ.search(t) is not None or", "or False or"),
    ("evidence links not checked", "or not valid_url(url):", "or False:"),
    ("round 1 text is marked as a reply", 'if int(c.rnd) > 1 else ""', 'if int(c.rnd) > 0 else ""'),
    ("the holder can write twice", "      if c.h_done:\n        raise", "      if False:\n        raise"),
    ("the claimant can write twice", "      if c.c_done:\n        raise", "      if False:\n        raise"),
    ("a reply link wipes the holder's link", "c.h_url = url if url else c.h_url", "c.h_url = url"),
    ("a reply link wipes the claimant's link", "c.c_url = url if url else c.c_url", "c.c_url = url"),
    ("the case is ready when either has written", "if c.h_done and c.c_done:", "if c.h_done or c.c_done:"),
    ("a proposal can be requested in any state", 'c.state == "ready" or (', 'True or ('),
    ("the advance agreement is ignored", "c.state == \"gathering\" and c.waive and c.c_done", "c.state == \"gathering\" and True and c.c_done"),
    ("the advance agreement works with nothing written", "and c.waive and c.c_done and", "and c.waive and True and"),
    ("the advance agreement works in round 2", "and int(c.rnd) == 1)", "and True)"),
    ("holder's own statement not required to be absent", "and not c.h_done and", "and True and"),
    ("proposals are not counted", "c.proposals = u256(int(c.proposals) + 1)\n    if not r", "c.proposals = u256(int(c.proposals) + 0)\n    if not r"),
    ("a failed proposal is treated as a success", 'if not r["ok"]:', 'if r["ok"]:'),
    ("the stored share is not the proposed one", 'u256(r["share"]), r["reason"]', 'u256(50), r["reason"]'),
    ("answers accepted with no proposal", 'if c.state != "proposed":\n      raise gl.vm.UserError("[EXPECTED] there is no proposal to answer")', 'if c.state == "proposed":\n      raise gl.vm.UserError("[EXPECTED] there is no proposal to answer")'),
    ("accept and reject are swapped", 'mine = "accept" if accept else "reject"', 'mine = "reject" if accept else "accept"'),
    ("the holder can answer twice", "      if c.h_resp:\n        raise", "      if False:\n        raise"),
    ("the claimant can answer twice", "      if c.c_resp:\n        raise", "      if False:\n        raise"),
    ("one answer settles the case", "if not (c.h_resp and c.c_resp):", "if not (c.h_resp or c.c_resp):"),
    ("one acceptance settles the case", 'if c.h_resp == "accept" and c.c_resp == "accept":', 'if c.h_resp == "accept" or c.c_resp == "accept":'),
    ("agreement settles at an even split", 'self._settle(c, int(c.share), "agreed")', 'self._settle(c, 50, "agreed")'),
    ("rejection by only one is recorded as both", 'c.rej = "both parties" if c.h_resp == "reject" and c.c_resp == "reject"', 'c.rej = "both parties" if c.h_resp == "reject" or c.c_resp == "reject"'),
    ("a third round is reached", "if int(c.rnd) < MAX_ROUNDS:", "if int(c.rnd) <= MAX_ROUNDS:"),
    ("round 2 keeps the written flags", "u256(int(c.rnd) + 1), \"gathering\", False, False,", "u256(int(c.rnd) + 1), \"gathering\", True, True,"),
    ("the fallback is not even", 'self._settle(c, 50, "fallback")', 'self._settle(c, 40, "fallback")'),
    ("the claimant's share is calculated wrongly", "cd = int(c.amount) * share // 100", "cd = int(c.amount) * share // 99"),
    ("the holder's remainder is wrong", "u256(int(c.amount) - cd)", "u256(int(c.amount) - cd - 1)"),
    ("a settled case is not marked settled", 'c.state, c.outcome = "settled", outcome', 'c.state, c.outcome = "gathering", outcome'),
    ("anyone but the holder can cancel", 'if self._who(c) != "holder":', 'if self._who(c) == "holder":'),
    ("cancelling is allowed after the claimant wrote", "or c.c_done or", "or False or"),
    ("cancel does not check the round", 'or int(c.rnd) != 1 or', "or False or"),
    ("cancel does not check the proposal count", "or int(c.proposals) > 0:", "or False:"),
    ("cancelling is allowed in any state", 'if c.state != "gathering" or int(c.rnd) != 1', 'if False or int(c.rnd) != 1'),
    ("cancelling gives the claimant the money", "self._settle(c, 0, \"cancelled\")", "self._settle(c, 100, \"cancelled\")"),
    ("money can be withdrawn before settlement", 'if c.state != "settled":', 'if c.state == "settled":'),
    ("the parties' dues are swapped", 'a = int(c.h_due) if who == "holder" else int(c.c_due)', 'a = int(c.c_due) if who == "holder" else int(c.h_due)'),
    ("a zero withdrawal is allowed", "if a <= 0:", "if a < 0:"),
    ("the holder can withdraw twice", "      c.h_due = u256(0)", "      pass"),
    ("the claimant can withdraw twice", "      c.c_due = u256(0)", "      pass"),
    ("withdrawals are not counted", "c.paid = u256(int(c.paid) + a)", "c.paid = u256(int(c.paid) + 0)"),
    ("withdrawals are paid to the holder", "Payee(gl.message.sender_address)", "Payee(c.holder)"),
    ("shares above 100 accepted", 'not 0 <= d["claimant_share"] <= 100', 'not 0 <= d["claimant_share"] <= 1000'),
    ("negative shares accepted", 'not 0 <= d["claimant_share"] <= 100', 'not -100 <= d["claimant_share"] <= 100'),
    ("reasons of one character accepted", "len(reason) >= 5", "len(reason) >= 1"),
    ("a long reason is required", "len(reason) >= 5", "len(reason) >= 50"),
    ("reasons are not cut", "[:300]", "[:3000]"),
    ("reasons are not tidied", 'reason = " ".join(d["reason"].split())[:300]', 'reason = d["reason"][:300]'),
    ("shares are compared with a stricter limit", "<= TOLERANCE", "< TOLERANCE"),
    ("two failed proposals disagree", 'return a["ok"] == b["ok"]', "return False"),
    ("a failed proposal agrees with a proposal", 'return a["ok"] == b["ok"]', "return True"),
    ("the prompt drops the neutrality rule", "You do not decide who is right.", ""),
    ("the prompt drops the untrusted warning", "UNTRUSTED", "text"),
    ("the first prompt always mentions a rejection", "  if prev:", "  if True:"),
    ("round 2 prompt is also used in round 1", "if rnd > 1 else None", "if rnd > 0 else None"),
    ("evidence is not cut", "[:1500]", "[:15000]"),
    ("evidence that gives orders is passed on", "if INJ.search(t) is not None else t", "if False else t"),
    ("empty evidence links are fetched", "  if not url:\n    return \"\"", "  if False:\n    return \"\""),
    ("any link is accepted", 'u.startswith("https://")', 'u.startswith("http")'),
    ("empty links are refused", 'u == "" or (', 'False or ('),
    ("link length limit raised", "len(u) <= 200", "len(u) <= 2000"),
    ("links with spaces accepted", "not any(c.isspace() for c in u)", "True"),
    ("the parties' roles are swapped", '    if s == c.holder:\n      return "holder"\n    if s == c.claimant:\n      return "claimant"', '    if s == c.holder:\n      return "claimant"\n    if s == c.claimant:\n      return "holder"'),
    ("the case id check is off by one", "cid >= int(self.n)", "cid > int(self.n)"),
]

def run(contract_path):
    tmp = tempfile.mkdtemp()
    try:
        os.makedirs(os.path.join(tmp, "contracts")); shutil.copy(contract_path, os.path.join(tmp, "contracts", "middle_ground.py"))
        shutil.copytree(HERE, os.path.join(tmp, "tests"), ignore=shutil.ignore_patterns("__pycache__"))
        try:
            return subprocess.run([sys.executable, os.path.join(tmp, "tests", "test_middle_ground.py")], capture_output=True, text=True, timeout=30).returncode
        except subprocess.TimeoutExpired:
            return 99
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def main():
    assert run(SRC) == 0, "the unmodified contract must pass the tests first"
    killed, survived, skipped = [], [], []
    for name, old, new in MUTANTS:
        if name in EQUIVALENT: skipped.append((name, "equivalent: " + EQUIVALENT[name])); continue
        if source.count(old) != 1: skipped.append((name, "pattern found %d times" % source.count(old))); continue
        tmp = tempfile.mkdtemp(); m = os.path.join(tmp, "m.py"); open(m, "w").write(source.replace(old, new, 1))
        if subprocess.run([sys.executable, "-m", "py_compile", m], capture_output=True).returncode != 0: skipped.append((name, "does not compile"))
        elif run(m) != 0: killed.append(name)
        else: survived.append(name)
        shutil.rmtree(tmp, ignore_errors=True)
    print("mutants killed: %d of %d" % (len(killed), len(killed) + len(survived)))
    for n in survived: print("  SURVIVED:", n)
    for n, why in skipped: print("  not counted (%s): %s" % (why, n))
    return 0 if not survived else 1

if __name__ == "__main__":
    sys.exit(main())
