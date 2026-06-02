import { buildPoseidon } from "circomlibjs";
import { ethers } from "ethers";
import { createNote, Note, nullifierHash } from "./note.js";
import { proveWithdrawal } from "./prover.js";
import { RelayerClient, RelayerInfo } from "./relayer.js";
import { PoolIndexer } from "./indexer.js";

const ZERO_VALUE =
  21663839004416932945382355908790599225266501822907911457504978515578255421292n;
const toHex32 = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");

export interface ChainConfig {
  rpc: string;
  pool: string;
  denomination: bigint;
  levels: number;
  chainId: number;
}

export interface NullifyConfig {
  chain: string;
  chains: Record<string, ChainConfig>;
  relayers?: RelayerInfo[];
  wasmPath?: string;
  zkeyPath?: string;
}

export class Nullify {
  private poseidon!: (xs: bigint[]) => bigint;
  private relayerClient: RelayerClient;

  constructor(private readonly cfg: NullifyConfig) {
    this.relayerClient = new RelayerClient(cfg.relayers ?? []);
  }

  private async ready() {
    if (!this.poseidon) {
      const p = await buildPoseidon();
      this.poseidon = (xs: bigint[]) => BigInt(p.F.toString(p(xs)));
    }
  }

  /** Create a note for a fixed-denomination deposit. Submit note.commitment via your wallet. */
  async deposit(opts: { chain?: string }): Promise<Note> {
    await this.ready();
    return createNote(this.poseidon, opts.chain ?? this.cfg.chain);
  }

  /** Build a proof for `note` and submit the withdrawal on `toChain` via a relayer. */
  async withdraw(opts: {
    note: Note;
    toChain: string;
    recipient: string;
    relayer?: string;
    fee?: bigint;
  }): Promise<string> {
    await this.ready();
    const src = this.cfg.chains[opts.note.sourceChain];
    const provider = new ethers.JsonRpcProvider(src.rpc);

    const indexer = new PoolIndexer(src.pool, provider, src.levels, ZERO_VALUE,
      (a, b) => this.poseidon([a, b]));
    const path = await indexer.buildPath(opts.note.commitment);

    const relayer = opts.relayer ?? ethers.ZeroAddress;
    const fee = opts.fee ?? 0n;

    const proof = await proveWithdrawal(
      {
        note: opts.note,
        poseidon: this.poseidon,
        root: path.root,
        recipient: BigInt(opts.recipient),
        relayer: BigInt(relayer),
        fee,
        pathElements: path.pathElements,
        pathIndices: path.pathIndices,
      },
      this.cfg.wasmPath ?? "circuits/build/nullify_js/nullify.wasm",
      this.cfg.zkeyPath ?? "circuits/build/nullify.zkey",
    );

    return this.relayerClient.submit({
      chain: opts.toChain,
      proofBytes: proof.calldata.proofBytes,
      root: toHex32(path.root),
      nullifierHash: toHex32(nullifierHash(this.poseidon, opts.note)),
      recipient: opts.recipient,
      relayer,
      fee: fee.toString(),
      sourceChainId: src.chainId,
    });
  }
}

export { Note } from "./note.js";
export { PoolIndexer } from "./indexer.js";
export type { RelayerInfo } from "./relayer.js";
