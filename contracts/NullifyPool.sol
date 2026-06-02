// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {INullifyPool} from "./interfaces/INullifyPool.sol";
import {MerkleTreeWithHistory, IHasher} from "./MerkleTreeWithHistory.sol";

/// @title NullifyPool
/// @notice Fixed-denomination shielded pool. Deposits insert a commitment leaf;
///         withdrawals are authorised by the verifier after a valid ZK proof.
/// @dev Fixed-denomination keeps the anonymity set strong (see docs/privacy-design.md).
///      ERC20 support is a follow-up; v1 ships native-asset pools.
contract NullifyPool is INullifyPool, MerkleTreeWithHistory {
    uint256 public immutable denomination;
    address public verifier;
    address public immutable deployer;

    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifierSpent;

    constructor(uint32 _levels, IHasher _hasher, uint256 _denomination)
        MerkleTreeWithHistory(_levels, _hasher)
    {
        require(_denomination > 0, "zero denomination");
        denomination = _denomination;
        deployer = msg.sender;
    }

    function setVerifier(address _verifier) external {
        require(msg.sender == deployer && verifier == address(0), "verifier locked");
        verifier = _verifier;
    }

    function deposit(bytes32 commitment) external payable override {
        require(msg.value == denomination, "wrong denomination");
        require(!commitments[commitment], "duplicate commitment");
        commitments[commitment] = true;
        uint32 leafIndex = _insert(commitment);
        emit Deposit(commitment, leafIndex, getLastRoot(), block.timestamp);
    }

    function isKnownRoot(bytes32 root) public view override(INullifyPool, MerkleTreeWithHistory) returns (bool) {
        return MerkleTreeWithHistory.isKnownRoot(root);
    }

    function isSpent(bytes32 nullifierHash) external view override returns (bool) {
        return nullifierSpent[nullifierHash];
    }

    /// @notice Called only by the verifier after it has checked the proof.
    function processWithdraw(
        bytes32 nullifierHash,
        address payable recipient,
        address payable relayer,
        uint256 fee
    ) external override {
        require(msg.sender == verifier, "only verifier");
        require(!nullifierSpent[nullifierHash], "note already spent");
        require(fee <= denomination, "fee exceeds denomination");
        nullifierSpent[nullifierHash] = true;

        (bool okR, ) = recipient.call{value: denomination - fee}("");
        require(okR, "recipient transfer failed");
        if (fee > 0) {
            (bool okF, ) = relayer.call{value: fee}("");
            require(okF, "fee transfer failed");
        }
        emit Withdrawal(nullifierHash, recipient, relayer, fee);
    }
}
