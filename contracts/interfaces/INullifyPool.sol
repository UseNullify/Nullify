// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INullifyPool {
    event Deposit(bytes32 indexed commitment, uint32 leafIndex, bytes32 root, uint256 timestamp);
    event Withdrawal(bytes32 indexed nullifierHash, address indexed recipient, address relayer, uint256 fee);

    function deposit(bytes32 commitment) external payable;
    function isKnownRoot(bytes32 root) external view returns (bool);
    function isSpent(bytes32 nullifierHash) external view returns (bool);
    function processWithdraw(bytes32 nullifierHash, address payable recipient, address payable relayer, uint256 fee) external;
}
