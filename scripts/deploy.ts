/**
 * Multi-chain deployment (run via hardhat):
 *   npm run deploy -- --network base-sepolia
 *
 * Deploys Poseidon hasher -> NullifyPool -> PLONK verifier -> NullifyVerifier,
 * wires them, and writes addresses to deployments.json.
 */
import hre, { ethers } from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "fs";
// @ts-ignore
import { poseidonContract } from "circomlibjs";

const LEVELS = 32;
const DENOMINATION = ethers.parseEther("0.1");

async function main() {
  const net = hre.network.name;
  const [deployer] = await ethers.getSigners();
  console.log(`deploying to ${net} as ${deployer.address}`);

  const Hasher = new ethers.ContractFactory(
    poseidonContract.generateABI(2),
    poseidonContract.createCode(2),
    deployer,
  );
  const hasher = await Hasher.deploy();
  await hasher.waitForDeployment();

  const Pool = await ethers.getContractFactory("NullifyPool");
  const pool = await Pool.deploy(LEVELS, await hasher.getAddress(), DENOMINATION);
  await pool.waitForDeployment();

  // NOTE: deploy the snarkjs-generated PLONK verifier here and pass its address.
  const plonk = process.env.PLONK_VERIFIER ?? ethers.ZeroAddress;
  const attestor = process.env.ATTESTOR ?? ethers.ZeroAddress;

  const Verifier = await ethers.getContractFactory("NullifyVerifier");
  const verifier = await Verifier.deploy(await pool.getAddress(), plonk, attestor);
  await verifier.waitForDeployment();

  await (await pool.setVerifier(await verifier.getAddress())).wait();

  const out = existsSync("deployments.json")
    ? JSON.parse(readFileSync("deployments.json", "utf8"))
    : {};
  out[net] = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    hasher: await hasher.getAddress(),
    pool: await pool.getAddress(),
    verifier: await verifier.getAddress(),
    attestor,
    denomination: DENOMINATION.toString(),
  };
  writeFileSync("deployments.json", JSON.stringify(out, null, 2));
  console.log("wrote deployments.json:", out[net]);
}

main().catch((e) => { console.error(e); process.exit(1); });
