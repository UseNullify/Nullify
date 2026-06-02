/**
 * Negative tests — things that MUST fail. If any prints ✗ FAIL, the pool is exploitable.
 *   Run: npx hardhat run scripts/negative-test.ts
 * Generates ONE real proof and reuses it (proving is slow), so expect one wait.
 */
import { ethers } from "hardhat";
import { resolve } from "path";
// @ts-ignore
import { poseidonContract, buildPoseidon } from "circomlibjs";
// @ts-ignore
import * as snarkjs from "snarkjs";

const LEVELS = 32;
const DENOM = ethers.parseEther("0.1");
const ZERO_VALUE = 21663839004416932945382355908790599225266501822907911457504978515578255421292n;
const WASM = resolve("circuits/build/nullify_js/nullify.wasm");
const ZKEY = resolve("circuits/build/nullify.zkey");
const h32 = (x: bigint) => "0x" + x.toString(16).padStart(64, "0");
const rand = () => BigInt("0x" + Buffer.from(ethers.randomBytes(31)).toString("hex"));

let pass = 0, fail = 0;
async function expectRevert(label: string, fn: () => Promise<any>, mustContain: string) {
  try {
    await fn();
    console.log(`✗ FAIL: ${label} — did NOT revert (this is a vulnerability!)`);
    fail++;
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (msg.includes(mustContain)) { console.log(`✓ PASS: ${label} — reverted ("${mustContain}")`); pass++; }
    else { console.log(`✗ FAIL: ${label} — reverted but wrong reason: ${msg.slice(0,120)}`); fail++; }
  }
}

async function main() {
  const [deployer, depositor, recipient, relayer] = await ethers.getSigners();
  const poseidon = await buildPoseidon();
  const H = (xs: bigint[]) => BigInt(poseidon.F.toString(poseidon(xs)));

  const Hasher = new ethers.ContractFactory(poseidonContract.generateABI(2), poseidonContract.createCode(2), deployer);
  const hasher = await Hasher.deploy(); await hasher.waitForDeployment();
  const Pool = await ethers.getContractFactory("NullifyPool");
  const pool = await Pool.deploy(LEVELS, await hasher.getAddress(), DENOM); await pool.waitForDeployment();
  const Plonk = await ethers.getContractFactory("PlonkVerifier");
  const plonk = await Plonk.deploy(); await plonk.waitForDeployment();
  const Verifier = await ethers.getContractFactory("NullifyVerifier");
  const verifier = await Verifier.deploy(await pool.getAddress(), await plonk.getAddress(), ethers.ZeroAddress);
  await verifier.waitForDeployment();
  await (await pool.setVerifier(await verifier.getAddress())).wait();

  const nullifier = rand(), secret = rand();
  const commitment = H([nullifier, secret]);
  await (await pool.connect(depositor).deposit(h32(commitment), { value: DENOM })).wait();

  const zeros = [ZERO_VALUE];
  for (let i = 1; i < LEVELS; i++) zeros[i] = H([zeros[i-1], zeros[i-1]]);
  let cur = commitment; const pathElements: bigint[] = [], pathIndices: number[] = [];
  for (let i = 0; i < LEVELS; i++) { pathElements.push(zeros[i]); pathIndices.push(0); cur = H([cur, zeros[i]]); }
  const root = cur, nh = H([nullifier]);

  console.log("proving (one time, be patient)...");
  const { proof, publicSignals } = await snarkjs.plonk.fullProve(
    { root, nullifierHash: nh, recipient: BigInt(recipient.address), relayer: BigInt(relayer.address), fee: 0n,
      nullifier, secret, pathElements, pathIndices }, WASM, ZKEY);
  const raw: string = await snarkjs.plonk.exportSolidityCallData(proof, publicSignals);
  const proofArr = JSON.parse("[" + raw.replace(/\]\[/g, "],[") + "]")[0];
  const args = [h32(root), h32(nh), recipient.address, relayer.address, 0n, 31337] as const;

  console.log("\n--- negative tests ---");
  // B: tampered proof
  const bad = [...proofArr]; bad[0] = h32(BigInt(bad[0]) ^ 1n);
  await expectRevert("tampered proof", () => verifier.connect(relayer).withdraw.staticCall(bad, ...args), "invalid proof");
  // C: unknown root
  await expectRevert("unknown root", () => verifier.connect(relayer).withdraw.staticCall(proofArr, h32(rand()), h32(nh), recipient.address, relayer.address, 0n, 31337), "unknown/unattested root");
  // A: double-spend (first real withdraw succeeds, second must fail)
  await (await verifier.connect(relayer).withdraw(proofArr, ...args)).wait();
  console.log("✓ (sanity) first withdraw succeeded");
  await expectRevert("double-spend", () => verifier.connect(relayer).withdraw.staticCall(proofArr, ...args), "note already spent");

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) { console.log("⚠️  DO NOT deploy — fix failures first."); process.exit(1); }
  else console.log("✓ All negative tests passed.");
}
main().catch((e) => { console.error(e); process.exit(1); });
