# Nulify — Solana (SVM)

**Status: work in progress / testnet scaffold.**

This is the account model and instruction surface for the Solana shielded pool. It does **not**
yet implement Groth16 verification or the on-chain Merkle tree. EVM chains (Base, Ethereum,
Arbitrum) are the production targets today.

Planned: integrate `groth16-solana` for proof verification (Solana lacks the PLONK-friendly
precompiles EVM has, so the SVM path wraps a Groth16 proof), and a syscall-efficient Poseidon
Merkle tree.
