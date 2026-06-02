import { Proof } from "./prover.js";

export interface RelayerInfo {
  url: string;
  feeBps: number;
  chains: string[];
}

export interface WithdrawRequest {
  chain: string;
  proofBytes: string;
  root: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  fee: string;
  sourceChainId: number;
}

/** Minimal client for submitting a withdrawal to a relayer node. */
export class RelayerClient {
  constructor(private readonly relayers: RelayerInfo[]) {}

  async submit(req: WithdrawRequest): Promise<string> {
    const candidates = this.relayers
      .filter((r) => r.chains.includes(req.chain))
      .sort((a, b) => a.feeBps - b.feeBps);

    let lastErr: unknown;
    for (const r of candidates) {
      try {
        const res = await fetch(`${r.url}/withdraw`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(req),
        });
        if (!res.ok) throw new Error(`relayer ${r.url} -> ${res.status}`);
        const { txHash } = (await res.json()) as { txHash: string };
        return txHash;
      } catch (e) {
        lastErr = e; // proof is reusable until the nullifier is spent on-chain
      }
    }
    throw new Error(`all relayers failed: ${String(lastErr)}`);
  }
}
export type { Proof };
