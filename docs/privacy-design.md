# Privacy design

Privacy claims are easy to make and easy to get wrong, so this document is deliberately blunt about
what Nulify hides, what it does not, and where it can leak. If you only read one doc before
trusting the design, read this one.

## The goal, stated narrowly

Break the on-chain link between a deposit and a later withdrawal, and keep that break even when the
two happen on different chains. An observer who can see every transaction on every chain should not
be able to tell which deposit funded a given withdrawal, beyond what timing and amount give away.

That is the whole claim. It is not "untraceable money." It is unlinkability between two specific
events, nothing more.

## What is public, what is hidden

Everything below is visible on-chain: the set of commitments, the current Merkle root, each
nullifier hash at the moment it is spent, the recipient, the relayer, the fee, and the amount.

What stays hidden: which commitment a withdrawal corresponds to, the nullifier and secret behind
it, and any link between the depositor and the recipient.

## Where the privacy comes from

It comes from the anonymity set, which is just the group of deposits any given withdrawal could
plausibly have come from. A withdrawal proves membership in that set without naming the member.
Bigger set, stronger privacy. Two choices push the set larger:

- Fixed denominations, so amount stops being a fingerprint.
- The cross-chain design (when it lands), so deposits from several chains share one set instead of
  splitting into a small pool per chain.

The blunt version: your privacy is never better than the size of the set at the moment you
withdraw. Withdraw from a near-empty pool and you have effectively deanonymized yourself.

## How double-spends are stopped without leaking

Each note carries a nullifier. Spending it publishes `Poseidon(nullifier)`, which the verifier
records and refuses to accept twice. Because the published value is a hash of a secret and not the
commitment, it proves "this note is now spent" without revealing which commitment was spent. That
is the trick that lets you prevent reuse and stay private at the same time.

## Where it leaks

No honest privacy doc skips this part.

- Timing. Deposit and immediately withdraw, and you narrow the set to whoever else moved in that
  window. Waiting helps.
- Amounts, in any variable-amount pool. A unique amount is a label. Fixed denominations exist for
  exactly this reason.
- Network metadata. Your IP at the relayer can deanonymize you at a layer the chain never sees.
  Route proofs over something like Tor.
- Re-linking. Send withdrawn funds straight to a labeled exchange deposit address and you have
  re-tied the knot yourself. Privacy ends where the user ends it.

## What the attestor can and cannot do

In the cross-chain design, the attestor only ever handles roots, which are aggregate hashes of the
tree. It never sees a nullifier, a secret, or which leaf belongs to whom. A dishonest attestor
majority could forge a root and threaten funds, which is a soundness problem to be closed by an
audit and, later, light-client proofs. It cannot deanonymize anyone, because the information that
would let it simply never reaches it.

## Self-disclosure, on the user's terms

A planned viewing key lets a user voluntarily prove their own history to someone they choose, an
auditor or a counterparty, without weakening privacy against everyone else. It is opt-in and held
by the user. It is not a backdoor and cannot be triggered by the protocol or its operators.

## A note on responsible use

Financial privacy is a normal thing to want; cash has it offline. Nulify is built for that. It is
not built to launder criminal proceeds or evade sanctions, and the people working on it do not
support that use. If you run or integrate it, the legal obligations in your jurisdiction are yours
to meet.
