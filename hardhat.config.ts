import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const accounts = process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    "base-sepolia": { url: process.env.RPC_BASE_SEPOLIA ?? "", accounts },
    base: { url: process.env.RPC_BASE ?? "", accounts },
    ethereum: { url: process.env.RPC_ETHEREUM ?? "", accounts },
    arbitrum: { url: process.env.RPC_ARBITRUM ?? "", accounts },
  },
};

export default config;
