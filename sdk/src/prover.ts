import { Note, nullifierHash } from "./note.js";

export interface WithdrawInputs {
  note: Note;
  poseidon: (xs: bigint[]) => bigint;
  root: bigint;
  recipient: bigint;
  relayer: bigint;
  fee: bigint;
  pathElements: bigint[];
  pathIndices: number[];
}

export interface Proof {
  proof: unknown;          // raw snarkjs proof object
  publicSignals: string[]; // [root, nullifierHash, recipient, relayer, fee]
  calldata: { proofBytes: string; pubSignals: string[] }; // formatted for the on-chain verifier
}

/** Generate a PLONK withdrawal proof and the calldata the contract expects. */
export async function proveWithdrawal(
  inputs: WithdrawInputs,
  wasmPath: string,
  zkeyPath: string,
): Promise<Proof> {
  const snarkjs = await import("snarkjs");
  const nh = nullifierHash(inputs.poseidon, inputs.note);

  const witness = {
    root: inputs.root,
    nullifierHash: nh,
    recipient: inputs.recipient,
    relayer: inputs.relayer,
    fee: inputs.fee,
    nullifier: inputs.note.nullifier,
    secret: inputs.note.secret,
    pathElements: inputs.pathElements,
    pathIndices: inputs.pathIndices,
  };

  const { proof, publicSignals } = await snarkjs.plonk.fullProve(witness, wasmPath, zkeyPath);

  // exportSolidityCallData returns: "0x<proof>,[\"sig0\",\"sig1\",...]"
  const raw: string = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  const proofBytes = raw.slice(0, raw.indexOf(",["));
  const pubSignals = JSON.parse(raw.slice(raw.indexOf(",[") + 1)) as string[];

  return { proof, publicSignals, calldata: { proofBytes, pubSignals } };
}
