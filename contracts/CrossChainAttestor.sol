// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CrossChainAttestor
/// @notice Mirrors committed Merkle roots from source chains to this chain via an M-of-N
///         signer set. Roadmap: replace signers with light-client / storage proofs.
contract CrossChainAttestor {
    mapping(address => bool) public isSigner;
    uint256 public threshold;

    // sourceChainId => root => attested
    mapping(uint256 => mapping(bytes32 => bool)) public attested;

    event RootAttested(uint256 indexed sourceChainId, bytes32 root);

    constructor(address[] memory signers, uint256 _threshold) {
        require(_threshold > 0 && _threshold <= signers.length, "bad threshold");
        for (uint256 i = 0; i < signers.length; i++) isSigner[signers[i]] = true;
        threshold = _threshold;
    }

    /// @param signatures M signatures over keccak256(sourceChainId, root)
    function submitRoot(uint256 sourceChainId, bytes32 root, bytes[] calldata signatures) external {
        require(signatures.length >= threshold, "not enough signatures");
        // TODO: recover signers from signatures, ensure distinct & authorized, count >= threshold
        attested[sourceChainId][root] = true;
        emit RootAttested(sourceChainId, root);
    }

    function isAttested(uint256 sourceChainId, bytes32 root) external view returns (bool) {
        return attested[sourceChainId][root];
    }
}
