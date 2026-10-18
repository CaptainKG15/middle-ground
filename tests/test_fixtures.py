# Checks the invented disputes against the contract's own rules (no network, no model).
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "stub")); sys.path.insert(0, os.path.join(HERE, "..", "contracts"))
import middle_ground as M
C = os.path.join(HERE, "..", "cases"); man = json.load(open(os.path.join(C, "manifest.json"))); n = 0
def check(name, cond):
    global n; assert cond, "FAILED: " + name; n += 1; print("PASS", name)
for s in man["scenarios"]:
    for k in ("holder_text", "claimant_text", "holder_reply", "claimant_reply"):
        t = s[k]; check("scenario %d: %s is accepted by the contract's own rules (20 to 800 characters, no instructions)" % (s["id"], k), 20 <= len(t) <= 800 and M.INJ.search(t) is None)
    for k in ("holder_url", "claimant_url"):
        text = M.html_to_text(open(os.path.join(C, s[k])).read()); trap = s["id"] == 4 and k == "claimant_url"
        check("scenario %d: the %s is %s" % (s["id"], k, "ignored by the contract because it gives orders" if trap else "readable and clean"), (M.INJ.search(text) is not None) == trap and len(text) > 60)
    check("scenario %d: the amount is within the contract's limits" % s["id"], M.MIN_AMOUNT <= int(float(s["amount"]) * 10**18) <= M.MAX_AMOUNT)
    check("scenario %d: the predicted band is a sensible range" % s["id"], 0 <= s["band"][0] < s["band"][1] <= 100)
print("\n%d fixture checks passed" % n)
