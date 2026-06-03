# Nulify: A Cross-Chain Privacy Bridge

**Version 0.1 (draft) - June 2026**

-----

> **Status.** This is a design document for software that is still in active development. The
> protocol described here is implemented and tested on a local chain, but it is not deployed to any
> testnet or mainnet, the trusted setup is a development one and not a real ceremony, and the system
> has not been audited. Nothing here should be read as a claim that the system is live, secure for
> real funds, or finished. There is no token and no sale.

-----

## Abstract

On-chain privacy today is mostly a single-chain affair. Shielded pools and mixers can break the
link between a deposit and a withdrawal as long as both happen on the same chain, but the moment
value crosses a bridge that link tends to reappear. Nulify is a cross-chain privacy bridge that
aims to preserve unlinkability across chains. A user deposits into a shielded pool on one chain as a
cryptographic commitment, and later withdraws on another chain by producing a zero-knowledge proof
of membership in the pool, without revealing which deposit was theirs. This paper describes the
construction, the privacy it is meant to provide, the assumptions it rests on, and the parts that
are not finished yet.

## 1. Motivation

Public blockchains are, by default, public. Every transfer is visible, permanent, and trivially
linkable. Financial privacy, the same baseline that physical cash provides offline, is not the norm
on-chain; it is the exception, and it usually requires special tooling.

That tooling exists. Fixed-denomination mixers and shielded pools let a user deposit and later
withdraw to an unlinked address. But two problems remain. First, most of these systems work within a
single chain, so as soon as funds are bridged the privacy set is left behind and the trail resumes.
Second, privacy on its own has run into legitimate concerns about misuse, which has pushed the more
thoughtful designs toward privacy that can coexist with lawful compliance rather than privacy that
is absolute and indiscriminate.

Nulify targets the first problem directly and is designed with the second in mind. The goal is
unlinkability that holds across chains, built on a pool whose anonymity set spans chains instead of
fragmenting into a small, weak pool per chain.

## 2. Design goals and threat model

The single, narrow goal is this: break the on-chain link between a deposit and a later withdrawal,
and keep that break even when the two happen on different chains. An observer who can see every
transaction on every chain should not be able to determine which deposit funded a given withdrawal,
beyond whatever timing and amount happen to leak.

This is not a claim of untraceable money. It is unlinkability between two specific events.

The adversaries considered:

- A passive observer with full visibility of all chains. Should not be able to link a deposit to a
  withdrawal.
- A relayer that sees the proof and the recipient. Should not be able to tie either to a specific
  deposit, and should not be able to redirect funds.
- A malicious majority of the cross-chain attestor set. Could threaten fund safety by attesting a
  false root, but should not be able to deanonymize users.
- A global adversary correlating timing and amounts. Acknowledged as a partial leak, addressed by
  fixed denominations and by not withdrawing immediately.

## 3. Protocol overview

The protocol has three actions: deposit, prove, and withdraw.

On **deposit**, the user’s wallet picks two random field elements, a nullifier and a secret, and
computes a commitment as the Poseidon hash of the two. Only the commitment is published. It is
inserted as a leaf into an on-chain incremental Merkle tree. The deposit amount is fixed by the
pool, so deposits are indistinguishable by value.

To **prove**, the user reconstructs the Merkle authentication path for their commitment from the
chain’s deposit history and generates a PLONK proof. The proof attests, in zero knowledge, that the
user knows a nullifier and secret whose commitment is a leaf under a known tree root, and that a
given nullifier hash is the hash of that nullifier. It also binds the recipient, the relayer, and
the fee into the statement so they cannot be altered after the fact.

On **withdraw**, a relayer submits the proof to the verifier on the destination chain. The verifier
rejects a nullifier that has already been used, rejects a root it does not recognise, and rejects a
proof that does not verify. Only when all three pass does the pool release the funds, sending the
denomination minus the fee to the recipient and the fee to the relayer in the same transaction. The
nullifier is then recorded as spent, so the note cannot be used again.

## 4. Cryptographic construction

### 4.1 Commitments and nullifiers

A note is a pair of random field elements, `(nullifier, secret)`. Its commitment is

```
commitment = Poseidon(nullifier, secret)
```

Poseidon is chosen because it is efficient inside arithmetic circuits, which keeps proving practical.
When a note is spent, the user publishes

```
nullifierHash = Poseidon(nullifier)
```

The verifier keeps a set of spent nullifier hashes and refuses any repeat. Because the published
value is a hash of a secret rather than the commitment itself, it proves that some note has been
spent without revealing which one. This is what allows double-spend prevention and unlinkability to
hold at the same time.

### 4.2 Merkle accumulator

Commitments accumulate in an incremental Merkle tree of fixed depth (32 in the current
implementation), hashed with Poseidon. The on-chain contract and the in-circuit logic use the same
hash, which is what lets a proof built off-chain verify against the on-chain root. The contract
retains a rolling window of recent roots so that a proof built against a slightly stale root still
checks out while new deposits arrive.

### 4.3 The withdrawal circuit

The PLONK circuit takes five public inputs, `root`, `nullifierHash`, `recipient`, `relayer`, and
`fee`, and the following private inputs: the `nullifier`, the `secret`, and the Merkle path. It
enforces three things:

1. The commitment derived from the private note is a leaf reachable from `root`.
1. `nullifierHash` is the Poseidon hash of the note’s nullifier.
1. The public recipient, relayer, and fee are bound into the proof.

One constraint deserves explicit mention because it is a common and serious failure mode. Every
Merkle path-selector bit must be constrained to be zero or one. Without that constraint a prover can
choose arbitrary selector values, forge a path to a root, and withdraw without owning any note. The
constraint is present and is covered by the test suite.

### 4.4 Proof system

The system uses PLONK over the BN254 curve. PLONK relies on a universal trusted setup, which means a
single setup can be reused across circuit revisions rather than requiring a fresh ceremony for each.
The development build ships with a single-party powers-of-tau, which is adequate for testing and
unsafe for real value. A real deployment requires a public multi-party ceremony.

## 5. Cross-chain attestation

The cross-chain property is the reason Nulify exists, and it is also the least finished part, so
this section is explicit about both the intended design and the current state.

The intended design keeps a separate pool on each chain and mirrors a committed Merkle root from a
source chain to the destination chains, so that a withdrawal on chain B can prove membership against
deposits made on chain A. This unifies the anonymity set across chains instead of splitting it.

In the current implementation, this mirror is an M-of-N signer skeleton: a set of independent
signers attests a root, and the destination accepts it once a threshold of signatures is present. It
is not wired between live chains, and the tests exercise only the single-chain path. A dishonest
majority of signers could attest a false root, which is a fund-safety concern; it could not
deanonymize users, because the attestor only ever handles roots and never sees a nullifier, a
secret, or which leaf belongs to whom. The roadmap replaces signer trust with light-client or
storage proofs.

## 6. Relayers

A relayer exists so that the recipient never has to touch the destination chain with a funded,
linkable address. The relayer fronts the gas and is reimbursed from the withdrawn amount in the same
transaction. Because the recipient, the relayer, and the fee are all bound inside the proof, a
relayer cannot redirect funds or take more than the agreed fee. The only thing it can do is refuse,
in which case the proof remains valid until the nullifier is spent and the user simply tries another
relayer. The current implementation is a single service; a permissionless, staked relayer set is on
the roadmap, both for liveness and so that no single operator carries the whole system.

## 7. Privacy analysis

Privacy comes from the anonymity set, the group of deposits any given withdrawal could plausibly
have come from. A withdrawal proves membership in that set without naming the member, so the larger
the set, the stronger the privacy. Two choices widen it: fixed denominations, so amount stops being
a fingerprint, and the cross-chain design, so deposits from several chains share one set.

What is visible on-chain: the set of commitments, the current root, each nullifier hash at spend
time, the recipient, the relayer, the fee, and the amount. What stays hidden: which commitment a
withdrawal corresponds to, the note’s pre-images, and the link between depositor and recipient.

Known leakage, stated plainly:

- Timing. Depositing and withdrawing in quick succession narrows the set to whoever else moved in
  that window. Waiting helps.
- Amounts, in any variable-amount pool. Fixed denominations exist to remove this.
- Network metadata. An IP observed at the relayer can deanonymize a user at a layer the chain never
  sees. Proofs should be routed over a privacy-preserving transport.
- Re-linking. Sending withdrawn funds straight to a labeled, identity-bound address re-ties the link
  that the protocol broke. Privacy ends where the user ends it.

The blunt summary: privacy is never better than the size of the anonymity set at the moment of
withdrawal.

## 8. Security considerations and trust assumptions

These are deliberate and documented, not oversights.

- The trusted setup must be honest. The development setup is single-party and unsafe for real funds;
  a public multi-party ceremony is required before mainnet.
- For the cross-chain path, an honest attestor majority is assumed until light-client proofs replace
  it.
- Liveness assumes at least one honest, reachable relayer.
- The contracts and circuit are unaudited. An external audit covering both is required before any
  mainnet use.

## 9. Limitations

Nulify does not make funds untraceable; it breaks one specific link, and only as well as the
anonymity set and the user’s own behavior allow. The cross-chain attestation is not yet trust-
minimized. Solana support is an early scaffold and the production targets today are EVM chains. There
is no browser proving UI yet. None of the security properties have been independently verified.

## 10. Roadmap

The near-term path is: deploy to a public testnet (Base Sepolia), run a relayer against it, wire
cross-chain attestation between two real chains, and ship a browser proving experience. The
longer-term path, before any mainnet deployment, is a public multi-party trusted-setup ceremony and
an external audit. Each step is gated on the previous one working and being verifiable.

## 11. Responsible use

Financial privacy is a legitimate interest. Nulify is built for lawful, self-custodial use. It is
not intended to launder criminal proceeds or evade sanctions, and the people building it do not
support that use. Anyone who runs or integrates it is responsible for meeting the legal obligations
of their own jurisdiction, including any registration, screening, or reporting requirements that
apply. The design leans toward compliance-compatible privacy rather than indiscriminate anonymity,
and a future opt-in viewing key is intended to let users disclose their own activity when they
choose or are required to.

## 12. Conclusion

Cross-chain privacy is a hard, largely unsolved problem, and Nulify is an attempt at it built in
the open. The cryptographic core works end to end on a local chain and the basic security checks
hold. What remains is substantial: deployment, trust-minimized attestation, a real ceremony, and an
audit. The work is public on purpose. Privacy infrastructure should be something you can verify, not
something you have to trust.

## References

1. E. Ben-Sasson et al. Zerocash: Decentralized Anonymous Payments from Bitcoin. IEEE S&P, 2014.
1. A. Pertsev, R. Semenov, R. Storm. Tornado Cash: a non-custodial privacy solution. 2019.
1. V. Buterin, J. Illum, M. Nadler, F. Soleimani, A. Weinstein. Blockchain Privacy and Regulatory
   Compliance: Towards a Practical Equilibrium (Privacy Pools). 2023.
1. A. Gabizon, Z. Williamson, O. Ciobotaru. PLONK: Permutations over Lagrange-bases for Oecumenical
   Noninteractive arguments of Knowledge. 2019.
1. J. Groth. On the Size of Pairing-based Non-interactive Arguments. EUROCRYPT, 2016.
1. L. Grassi, D. Khovratovich, C. Rechberger, A. Roy, M. Schofnegger. Poseidon: A New Hash Function
   for Zero-Knowledge Proof Systems. USENIX Security, 2021.

*This document describes a work in progress and will change as the protocol develops.*