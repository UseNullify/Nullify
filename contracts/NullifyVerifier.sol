// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {INullifyPool} from "./interfaces/INullifyPool.sol";

interface IPlonkVerifier {
    function verifyProof(uint256[24] calldata proof, uint256[5] calldata pubSignals) external view returns (bool);
}

interface IAttestor {
    function isAttested(uint256 sourceChainId, bytes32 root) external view returns (bool);
}

contract NullifyVerifier {
    INullifyPool public immutable pool;
    IPlonkVerifier public immutable plonk;
    IAttestor public immutable attestor;

    constructor(address _pool, address _plonk, address _attestor) {
        pool = INullifyPool(_pool);
        plonk = IPlonkVerifier(_plonk);
        attestor = IAttestor(_attestor);
    }

    function withdraw(
        uint256[24] calldata proof,
        bytes32 root,
        bytes32 nullifierHash,
        address payable recipient,
        address payable relayer,
        uint256 fee,
        uint256 sourceChainId
    ) external {
        require(!pool.isSpent(nullifierHash), "note already spent");
        require(
            pool.isKnownRoot(root) ||
                (address(attestor) != address(0) && attestor.isAttested(sourceChainId, root)),
            "unknown/unattested root"
        );

        uint256[5] memory pub;
        pub[0] = uint256(root);
        pub[1] = uint256(nullifierHash);
        pub[2] = uint256(uint160(address(recipient)));
        pub[3] = uint256(uint160(address(relayer)));
        pub[4] = fee;
        require(plonk.verifyProof(proof, pub), "invalid proof");

        pool.processWithdraw(nullifierHash, recipient, relayer, fee);
    }
}
