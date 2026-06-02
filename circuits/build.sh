#!/usr/bin/env bash
set -euo pipefail
# Build the withdrawal circuit and run the PLONK setup, end to end.
# Prereqs:
#   - circom >= 2.1   (cargo install circom)
#   - snarkjs          (npm i -g snarkjs)  — or use npx
#   - circomlib         (npm install, it's a dependency)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/circuits/build"
PTAU="$ROOT/circuits/pot.ptau"
mkdir -p "$OUT"

# 1. powers-of-tau. For LOCAL/TESTNET dev you may download a public one.
#    For MAINNET you MUST run/participate in a real multi-party ceremony.
if [ ! -f "$PTAU" ]; then
  echo "› no pot.ptau found."
  echo "  Dev option (download a public Hermez ptau, ~2^16 constraints):"
  echo "    curl -L -o circuits/pot.ptau https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau"
  echo "  Then re-run this script. (Bump to _17/_18 if circom reports more constraints.)"
  exit 1
fi

echo "› compiling circuit"
# -l node_modules lets circom resolve  include "circomlib/circuits/..."
circom "$ROOT/circuits/nullify.circom" --r1cs --wasm --sym -l "$ROOT/node_modules" -o "$OUT"

echo "› constraint count:"; snarkjs r1cs info "$OUT/nullify.r1cs"

echo "› plonk setup"
snarkjs plonk setup "$OUT/nullify.r1cs" "$PTAU" "$OUT/nullify.zkey"
snarkjs zkey export verificationkey "$OUT/nullify.zkey" "$OUT/vkey.json"

echo "› exporting on-chain verifier -> contracts/PlonkVerifier.sol"
# IMPORTANT: this is a SEPARATE contract. NullifyVerifier.sol wraps it via IPlonkVerifier.
snarkjs zkey export solidityverifier "$OUT/nullify.zkey" "$ROOT/contracts/PlonkVerifier.sol"

echo "✓ done. wasm: $OUT/nullify_js/nullify.wasm   zkey: $OUT/nullify.zkey"
