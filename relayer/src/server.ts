import Fastify from "fastify";
import { ethers } from "ethers";

export interface RelayerOpts {
  feeBps: number;
  signers: Record<string, ethers.Wallet>;     // chain -> wallet
  verifiers: Record<string, string>;            // chain -> NullifyVerifier address
}

const ABI = [
  "function withdraw(bytes proof, bytes32 root, bytes32 nullifierHash, address recipient, address relayer, uint256 fee, uint256 sourceChainId)",
];

interface Body {
  chain: string;
  proofBytes: string;
  root: string;
  nullifierHash: string;
  recipient: string;
  relayer: string;
  fee: string;
  sourceChainId: number;
}

export function buildServer(opts: RelayerOpts) {
  const app = Fastify({ logger: true });

  app.post("/withdraw", async (req, reply) => {
    const b = req.body as Body;
    const wallet = opts.signers[b.chain];
    const verifierAddr = opts.verifiers[b.chain];
    if (!wallet || !verifierAddr) return reply.code(400).send({ error: "unsupported chain" });

    // the fee is bound inside the proof, so we only need to refuse if it is below our minimum
    // (denomination is enforced on-chain; we sanity-check fee is non-negative here)
    if (BigInt(b.fee) < 0n) return reply.code(400).send({ error: "bad fee" });

    const verifier = new ethers.Contract(verifierAddr, ABI, wallet);
    const tx = await verifier.withdraw(
      b.proofBytes, b.root, b.nullifierHash, b.recipient, b.relayer, b.fee, b.sourceChainId,
    );
    return reply.send({ txHash: tx.hash });
  });

  app.get("/health", async () => ({ ok: true, feeBps: opts.feeBps }));
  return app;
}
