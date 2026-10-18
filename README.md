# Middle Ground

**A mediator that proposes, never imposes.** Two people dispute a sum of money. GenLayer validators propose a fair split and say why. Money moves only if **both** people accept, and if they cannot agree after two rounds it splits evenly.

Testnet only. Every person, club and amount in the demo is invented.

## How it works
1. **Open a case.** The *holder* (who is holding the disputed money) calls `open_case`, naming the *claimant* and attaching the sum (0.0002 to 1 GEN). The money is locked in the contract. A bad request sends the money straight back; a payable call never reverts with money attached.
2. **Both sides write.** Each writes a statement (20 to 800 characters) and may add one https evidence page. The holder may agree in advance that a proposal can go ahead on the claimant's statement alone, so a silent holder cannot freeze a case.
3. **A proposal.** Anyone can ask for one. The validators each propose the claimant's share as a whole percentage (0 to 100) with a short reason, and reach consensus when their numbers are within **five points** of each other. The leader's number and reason are stored.
4. **Both answer.** If both accept, the claimant is due that share of the deposit and the holder the rest. If either rejects there is **one reply round**: both can add a reply, a second proposal is made (told of the first and who rejected it), and both answer again. If it is rejected again, the money is split **evenly**.
5. **Withdraw.** Each side withdraws their share, once. Together the withdrawals equal the deposit exactly.

The holder can cancel and take the deposit back only **before the claimant has written anything**.

## Why a mediator and not a judge
A judge's mistake is binding. A mediator's is not: nobody is bound by a proposal until they accept it, so a model error costs a retry, never someone's money. That is the safety property the design is built around. The worst a bad proposal can do is be rejected, and the fallback (an even split) is fixed in code, so it cannot be gamed.

## How consensus is used
- **What the validators decide:** one number and one sentence. Each validator reads both statements and any evidence and proposes the claimant's share.
- **The custom equivalence check** (`same_proposal`): two proposals agree if their shares are **within five percentage points**. The wording of the reason is ignored. The leader's number is what is stored. Two failed proposals agree with each other; a failure never agrees with a proposal. A validator that disagrees blocks the call and nothing changes.
- **What plain code decides:** who may act, every state change, the arithmetic (`deposit * share // 100`, the remainder to the holder), the even-split fallback, that withdrawals happen once and add up to the deposit, and the limits on amounts, lengths and links.
- **Untrusted text:** a statement that contains instructions to the mediator is refused. An evidence page that contains instructions is replaced by a note saying it was ignored. Everything the parties wrote is fenced in the prompt as data.
- **Round 2** puts the first proposal and who rejected it in front of the validators, so the second proposal responds to the replies.

## State and rules
`cases` (holder, claimant, title, amount, state, round, statements, evidence links, proposal, responses, dues) and a counter. There is **no owner and no admin**: no one can change a case except its two parties, and no one can move money except by the rules above.

| State | Meaning |
|---|---|
| `gathering` | waiting for statements |
| `ready` | both statements in; anyone can ask for a proposal |
| `proposed` | a proposal waits for both answers |
| `settled` | agreed, split evenly, or cancelled; each side can withdraw |

## Testing
- `python3 tests/test_middle_ground.py`: 151 off-chain checks, including the money: for every share and several awkward amounts, the two dues add up to exactly the deposit, and however often each party tries to withdraw, exactly the deposit is paid out and never more. A stand-in network replaces the real one, so these test the contract's logic and accounting, not the model.
- `python3 tests/mutation_test.py`: breaks the contract in 84 small ways and confirms the tests fail each time. **81 of 81 countable mutants killed.** Three more are genuine equivalents (checks that back each other up), listed in the script with the reason for each. The mutation test found four weak spots in the first version of the tests (two used the contract's own constants instead of literal limits, and two cases were never tried); all four are fixed.
- `python3 tests/test_fixtures.py`: 32 checks that the invented disputes are accepted by the contract's own rules and that the trap evidence page really does contain an instruction.
- `tests/ui_test.js`: 44 browser checks of the demo page against a simulated chain and a pretend wallet, including a real second person acting as the claimant through a link. It does not use a real network.

## Observed so far
One real case on Studio with real validators: a flat-deposit dispute was proposed at 75% to the claimant (the design predicted 70 to 100%), both sides accepted and withdrew, and the proposal's reason cites the evidence page. One case is not a rate. See `RESULTS.md`, including what was not checked.

## Honest limits
- **There is no clock in a contract.** A party who simply disappears can stall a case after the claimant has written. The advance agreement helps when the *holder* is the one who might disappear; nothing here forces a silent claimant to answer. Never put in more than you can leave stuck.
- **A proposal can be wrong**, and a model tends to drift towards the middle. That is why proposals are not binding. How good the proposals are on real disputes is something only the real runs show (see `RESULTS.md`); one run is not a rate.
- **Statements and evidence are claims, not facts.** A page can be read, but a false statement is not detected. The mediator weighs what it is given.
- **The holder chooses the claimant's address** and locks the money, so this suits two people who already agree to try mediation. It is not a way to compel anyone.
- **The demo plays both sides** with a second throwaway key so one person can see everything. The two-wallet path is covered by tests against a simulated chain; see `RESULTS.md` for what has been done on a real network.
- Money moves when a transaction finalizes: about a minute and a half on Studio, up to about 40 minutes on Bradbury.

## Run it
Host the folder on GitHub Pages and open `app/index.html`. See **`REVIEW.md`** for a ten-minute path with what to expect at each step. `build_app.py` rebuilds the page with the contract embedded; `cases/generate.py` regenerates the invented disputes.

## Files
- `contracts/middle_ground.py`: the contract, 11,220 bytes, SHA-256 `11bce457cd72b745892ed0607787e884427f77d24a52c1b639ae257724bde3f8`
- `cases/`: the invented disputes and evidence pages
- `tests/`: the tests and the mutation test
- `app/`: the demo page
- `REVIEW.md`: a reviewer's guide; `RESULTS.md`: what was observed, failures included
