# Results

Only what was observed is listed. Open items are marked open.

## Off-chain (contract SHA-256 starting `11bce457cd72b745`, 11,220 bytes)
- 151 checks pass. 81 of 81 countable mutants killed, with three equivalents documented.
- 32 fixture checks: the four invented disputes are accepted by the contract's own rules, and the trap evidence page really contains an instruction.
- 41 browser checks of the demo page against a simulated chain and a pretend wallet.
- The mutation test found four weak spots in the first version of the tests, all now fixed: two limits were checked against the contract's own constants instead of literal numbers, the claimant writing twice was never tried, and a holder's reply without a link was never tried.
- A test written for the cancel rule showed that the state check there is what stops a holder cancelling a settled case a second time and being paid twice. It is covered by a test.
- While testing the page, the run was rewritten as a state machine that looks at the case and does only what is missing. Pressing Run again after a stop continues the same case instead of opening a second one and locking a second deposit.

## On a real network: open
Not run yet when this was written. This section will record real runs on Studio and on Bradbury, with failures included: what the validators proposed for each invented dispute, whether they reached consensus, how the proposals compared with the predicted ranges, and whether the money arrived.
