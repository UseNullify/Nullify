import { randomBytes } from "crypto";

/** A spendable note. Keep `nullifier` and `secret` SECRET — they are the only way to withdraw. */
export interface Note {
  nullifier: bigint;
  secret: bigint;
  commitment: bigint;
  leafIndex?: number;
  sourceChain: string;
}

const rand = (): bigint => BigInt("0x" + randomBytes(31).toString("hex"));

/** Create a fresh note. `poseidon` is injected from circomlibjs. */
export function createNote(poseidon: (xs: bigint[]) => bigint, sourceChain: string): Note {
  const nullifier = rand();
  const secret = rand();
  const commitment = poseidon([nullifier, secret]);
  return { nullifier, secret, commitment, sourceChain };
}

export function nullifierHash(poseidon: (xs: bigint[]) => bigint, note: Note): bigint {
  return poseidon([note.nullifier]);
}
