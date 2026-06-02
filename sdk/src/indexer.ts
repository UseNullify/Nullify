import { ethers } from "ethers";

const POOL_ABI = [
  "event Deposit(bytes32 indexed commitment, uint32 leafIndex, bytes32 root, uint256 timestamp)",
  "function isKnownRoot(bytes32 root) view returns (bool)",
  "function getLastRoot() view returns (bytes32)",
];

export interface MerklePath {
  root: bigint;
  pathElements: bigint[];
  pathIndices: number[];
  leafIndex: number;
}

/**
 * Reads all Deposit events from a pool, rebuilds the incremental Merkle tree
 * off-chain, and returns the authentication path for `commitment`.
 *
 * `poseidon2` must hash two field elements identically to the on-chain hasher.
 */
export class PoolIndexer {
  private pool: ethers.Contract;

  constructor(
    poolAddress: string,
    provider: ethers.Provider,
    private readonly levels: number,
    private readonly zeroValue: bigint,
    private readonly poseidon2: (a: bigint, b: bigint) => bigint,
  ) {
    this.pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
  }

  private async leaves(): Promise<bigint[]> {
    const logs = await this.pool.queryFilter(this.pool.filters.Deposit());
    return logs
      .map((l) => l as ethers.EventLog)
      .sort((a, b) => Number(a.args.leafIndex) - Number(b.args.leafIndex))
      .map((l) => BigInt(l.args.commitment));
  }

  async buildPath(commitment: bigint): Promise<MerklePath> {
    const leaves = await this.leaves();
    const leafIndex = leaves.findIndex((c) => c === commitment);
    if (leafIndex < 0) throw new Error("commitment not found in pool");

    // precompute zero subtrees
    const zeros: bigint[] = [this.zeroValue];
    for (let i = 1; i < this.levels; i++) zeros[i] = this.poseidon2(zeros[i - 1], zeros[i - 1]);

    let layer = leaves.slice();
    const pathElements: bigint[] = [];
    const pathIndices: number[] = [];
    let index = leafIndex;

    for (let level = 0; level < this.levels; level++) {
      const isRight = index % 2;
      const sibling = isRight ? layer[index - 1] : layer[index + 1] ?? zeros[level];
      pathElements.push(sibling);
      pathIndices.push(isRight);

      const next: bigint[] = [];
      for (let i = 0; i < layer.length; i += 2) {
        const left = layer[i];
        const right = layer[i + 1] ?? zeros[level];
        next.push(this.poseidon2(left, right));
      }
      layer = next.length ? next : [zeros[level + 1] ?? this.zeroValue];
      index = Math.floor(index / 2);
    }

    return { root: layer[0], pathElements, pathIndices, leafIndex };
  }
}
