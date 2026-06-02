/**
 * Local end-to-end proof: deposit -> build Merkle path -> PLONK prove -> withdraw.
 *
 *   PREREQUISITE: run `npm run circuits:build` first, so these exist:
 *     circuits/build/nullify_js/nullify.wasm
 *     circuits/build/nullify.zkey
 *     contracts/PlonkVerifier.sol   (generated)
 *
 *   Then:  npx hardhat run scripts/local-e2e.ts
 *
 * If this prints "✓ E2E OK" your proof verifies on-chain. Only then is testnet worth it.
 */
import hre, { ethers } from "hardhat";
import { readFileSync } from "fs";
import { resolve } from "path";
// @ts-ignore
import { poseidonContract, buildPoseidon } from "circomlibjs";
// @ts-ignore
import * as snarkjs from "snarkjs";

const LEVELS = 32;
const DENOM = ethers.parseEther("0.1");
const ZERO_VALUE =
  21663839004416932945382355908790599225266501822907911457504978515578255421292n;

const WASM = resolve("circuits/build/nullify_js/nullify.wasm");
const ZKEY = resolve("circuits/build/nullify.zkey");

function rand(): bigint {
  return BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));
}

async function main() {
  const [deployer, depositor, recipient, relayer] = await ethers.getSigners();
  const poseidon = await buildPoseidon();
  const H = (xs: bigint[]) => BigInt(poseidon.F.toString(poseidon(xs)));

  // --- deploy Poseidon hasher, pool, generated PLONK verifier, NullifyVerifier ---
  const Hasher = new ethers.ContractFactory(
    poseidonContract.generateABI(2), poseidonContract.createCode(2), deployer);
  const hasher = await Hasher.deploy(); await hasher.waitForDeployment();

  const Pool = await ethers.getContractFactory("NullifyPool");
  const pool = await Pool.deploy(LEVELS, await hasher.getAddress(), DENOM);
  await pool.waitForDeployment();

  // the generated verifier contract is named `PlonkVerifier` by snarkjs
  const Plonk = await ethers.getContractFactory("PlonkVerifier");
  const plonk = await Plonk.deploy(); await plonk.waitForDeployment();

  const Verifier = await ethers.getContractFactory("NullifyVerifier");
  const verifier = await Verifier.deploy(
    await pool.getAddress(), await plonk.getAddress(), ethers.ZeroAddress);
  await verifier.waitForDeployment();
  await (await pool.setVerifier(await verifier.getAddress())).wait();

  // --- 1. deposit ---
  const nullifier = rand();
  const secret = rand();
  const commitment = H([nullifier, secret]);
  const commitmentHex = "0x" + commitment.toString(16).padStart(64, "0");
  await (await pool.connect(depositor).deposit(commitmentHex, { value: DENOM })).wait();
  console.log("deposited; root =", await pool.getLastRoot());

  // --- 2. rebuild the Merkle path off-chain (single leaf at index 0) ---
  const zeros: bigint[] = [ZERO_VALUE];
  for (let i = 1; i < LEVELS; i++) zeros[i] = H([zeros[i - 1], zeros[i - 1]]);
  let cur = commitment;
  const pathElements: bigint[] = [];
  const pathIndices: number[] = [];
  for (let i = 0; i < LEVELS; i++) {
    pathElements.push(zeros[i]); // leaf 0 -> sibling is always the zero subtree
    pathIndices.push(0);
    cur = H([cur, zeros[i]]);
  }
  const root = cur;
  if (!(await pool.isKnownRoot("0x" + root.toString(16).padStart(64, "0")))) {
    throw new Error("off-chain root != on-chain root (hasher mismatch!)");
  }

  // --- 3. PLONK prove ---
  const nullifierHash = H([nullifier]);
  const witness = {
    root, nullifierHash,
    recipient: BigInt(recipient.address),
    relayer: BigInt(relayer.address),
    fee: 0n,
    nullifier, secret, pathElements, pathIndices,
  };
  console.log("proving...");
  const { proof, publicSignals } = await snarkjs.plonk.fullProve(witness, WASM, ZKEY);
  const raw: string = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  const proofArr = JSON.parse("[" + raw.replace(/\]\[/g, "],[") + "]")[0];

  // --- 4. withdraw on-chain ---
  const before = await ethers.provider.getBalance(recipient.address);
  await (await verifier.connect(relayer).withdraw(
    proofArr,
    "0x" + root.toString(16).padStart(64, "0"),
    "0x" + nullifierHash.toString(16).padStart(64, "0"),
    recipient.address, relayer.address, 0n, 31337,
  )).wait();
  const after = await ethers.provider.getBalance(recipient.address);

  if (after - before !== DENOM) throw new Error(`payout mismatch: ${after - before}`);
  console.log("✓ E2E OK — proof verified on-chain, recipient received", ethers.formatEther(DENOM), "ETH");
}

main().catch((e) => { console.error(e); process.exit(1); });
