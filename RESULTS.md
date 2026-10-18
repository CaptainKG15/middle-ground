# Results

Only what was observed is listed. Open items are marked open.

## Off-chain (contract SHA-256 starting `11bce457cd72b745`, 11,220 bytes)
- 151 checks pass. 81 of 81 countable mutants killed, with three equivalents documented.
- 32 fixture checks: the four invented disputes are accepted by the contract's own rules, and the trap evidence page really contains an instruction.
- 44 browser checks of the demo page against a simulated chain and a pretend wallet.
- The mutation test found four weak spots in the first version of the tests, all now fixed: two limits were checked against the contract's own constants instead of literal numbers, the claimant writing twice was never tried, and a holder's reply without a link was never tried.
- A real Studio run showed the copy-able "Results as text" box still naming Bradbury and a blank mediator after the user had switched to Studio. It now follows the network and the mediator in use, and three browser checks cover it.
- A test written for the cancel rule showed that the state check there is what stops a holder cancelling a settled case a second time and being paid twice. It is covered by a test.
- While testing the page, the run was rewritten as a state machine that looks at the case and does only what is missing. Pressing Run again after a stop continues the same case instead of opening a second one and locking a second deposit.

## Studio: one case with real validators (worked)
Mediator `0x2307efF3BeAe3023FB3BA9cC33EAccf003A4a0B3`, deployed from the page with a Studio test key (11,220 bytes, SHA-256 starting `11bce457cd72b745`). One dispute was run: **A flat deposit** (case #0, "Flat deposit after move-out", 0.02 GEN locked), with the demo claimant key on the other side and "Both accept the first proposal". Times are the page's clock.

| Time | Event |
|---|---|
| 7:21:51 | mediator deployed |
| 7:22:01 | case opened and 0.02 GEN locked |
| 7:22:08 | holder's statement accepted |
| 7:22:14 | claimant's statement accepted |
| 7:22:18 to 7:23:06 | the validators wrote a proposal (about 48 seconds) |
| 7:23:16 and 7:23:23 | holder accepted, then claimant accepted |
| 7:23:29 and 7:23:34 | holder withdrew, then claimant withdrew |

**The proposal: 75% to the claimant.** The design had predicted 70 to 100% before the run, so it is inside the range. The mediator's reason, as recorded: "The signed move-in inventory shows a scratch on the table edge was already present, so the landlord has not clearly shown this damage was caused during the tenancy. Since the claimed repair matches that same area, a reasonable outcome is that most of the deposit should be returned to the tenant."

What this shows and does not show:
- The validators reached consensus on a proposal, and the reason refers to the signed move-in inventory, which is in the claimant's evidence page, so the evidence page was read and used.
- The whole case, from opening to the last withdrawal, took about a minute and a half (7:21:57 to 7:23:34).
- The page reported 0.02 GEN paid out in total. **Each side's balance was not checked on the network.** The split that follows from 75% (0.015 GEN to the claimant, 0.005 GEN to the holder) is the contract's arithmetic, which is tested off-chain.
- It is **one case and one run**. The prediction range was written by the design's author before the run. It says nothing about how the mediator behaves on the other three disputes, on a rejection, or on real disputes.
- Not run: the other three invented disputes, the rejection and fallback paths, a real second person using the share link, and anything on Bradbury.

## Bradbury: open
Not run yet. This section will record a real run on Bradbury with a wallet, with failures included.
