import "dotenv/config";
import { ethers } from "ethers";
import { buildServer } from "./server.js";

const port = Number(process.env.RELAYER_PORT ?? 4000);
const feeBps = Number(process.env.RELAYER_FEE_BPS ?? 50);
const key = process.env.RELAYER_PRIVATE_KEY;
if (!key) throw new Error("RELAYER_PRIVATE_KEY is required");

const providers: Record<string, string> = {
  base: process.env.RPC_BASE!,
  ethereum: process.env.RPC_ETHEREUM!,
  arbitrum: process.env.RPC_ARBITRUM!,
};

const signers: Record<string, ethers.Wallet> = {};
for (const [chain, rpc] of Object.entries(providers)) {
  if (rpc) signers[chain] = new ethers.Wallet(key, new ethers.JsonRpcProvider(rpc));
}

const verifiers: Record<string, string> = {
  // filled by scripts/deploy.ts output
  base: process.env.VERIFIER_BASE ?? "",
  ethereum: process.env.VERIFIER_ETHEREUM ?? "",
  arbitrum: process.env.VERIFIER_ARBITRUM ?? "",
};

buildServer({ feeBps, signers, verifiers })
  .listen({ port, host: "0.0.0.0" })
  .then(() => console.log(`relayer listening on :${port} (fee ${feeBps}bps)`));
