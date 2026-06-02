# Circuits

`nullify.circom` is the PLONK withdrawal circuit. It proves membership of a commitment in the
Merkle tree and correct derivation of the nullifier hash, while binding the recipient, relayer,
and fee into the proof.

## Build

```bash
# fetch a powers-of-tau file once (BN254, supports up to ~2^N constraints)
# e.g. from a public ceremony, saved as circuits/pot.ptau
npm run circuits:build
```

This compiles the circuit, runs the PLONK setup, and regenerates
`contracts/NullifyVerifier.sol`.

> The powers-of-tau file must come from a trusted ceremony. See `docs/architecture.md` §7.
