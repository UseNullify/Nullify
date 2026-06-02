# Workflow

How a deposit becomes a private withdrawal, step by step. This follows the path the code actually
takes today on a local chain. Where something is not wired yet, it says so.

## Depositing

1. Your wallet generates `nullifier` and `secret` locally. They never leave your device.
2. It computes `commitment = Poseidon(nullifier, secret)`.
3. It calls `deposit(commitment)` on the pool, sending exactly the pool's denomination.
4. The pool inserts the commitment as a Merkle leaf and emits a `Deposit` event with the leaf index
   and the new root.
5. You keep the note (`nullifier`, `secret`). It is the only way to withdraw later. Lose it and the
   funds are gone.

The amount is fixed, so nothing about the deposit distinguishes you from anyone else in the pool.

## Withdrawing

This is where the privacy actually happens.

1. The SDK reads every `Deposit` event from the pool and rebuilds the Merkle tree off-chain, then
   extracts the authentication path for your commitment. (This is the `PoolIndexer` in the SDK.)
2. It generates a PLONK proof binding the recipient address, the relayer address, and the fee, so
   none of them can be changed after the fact.
3. It hands the proof to a relayer.
4. The relayer calls `withdraw(...)` on the verifier. The verifier:
   - rejects a nullifier that has already been used,
   - rejects a root it does not recognise,
   - rejects a proof that does not verify,
   and only then asks the pool to pay.
5. The pool sends `denomination - fee` to the recipient and `fee` to the relayer. The recipient
   pays no gas and needs no prior balance.

After this, the nullifier is marked spent. The same note cannot be used twice.

## Where the relayer fits

The relayer exists so the recipient never has to touch the chain with a funded, linkable address.
It fronts the gas and is paid back from the withdrawn amount, in the same transaction. Because the
recipient, relayer, and fee are all baked into the proof, the relayer cannot redirect funds or take
more than the agreed fee. The worst it can do is refuse, and then you try another one.

Right now the relayer is a single Fastify service. A permissionless, staked relayer set is on the
roadmap, partly for liveness and partly so no single operator carries the whole thing.

## Cross-chain (planned)

The intended flow is: deposit on chain A, and an attestor mirrors chain A's root onto chain B, so
you can withdraw on chain B against the same anonymity set. This is not wired between live chains
yet. Today everything runs on one local chain end to end.

## If something fails

- Relayer times out or refuses: retry with another relayer. The proof is good until the nullifier
  is spent on-chain.
- Root rotated out: the pool keeps a window of recent roots. If yours fell out of the window, the
  SDK rebuilds the path against a current root and re-proves.
- Nullifier already spent: the note was already used. There is nothing to withdraw.
