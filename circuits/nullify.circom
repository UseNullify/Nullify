pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";

// Membership proof: leaf is reachable from `root` via the given path.
template MerkleProof(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    signal output root;

    component hashers[depth];
    signal cur[depth + 1];
    cur[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        // SECURITY: force the selector to be a bit. Without this a prover could
        // pick arbitrary pathIndices and forge a Merkle path (fake withdrawal).
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== cur[i] + pathIndices[i] * (pathElements[i] - cur[i]);
        hashers[i].inputs[1] <== pathElements[i] + pathIndices[i] * (cur[i] - pathElements[i]);
        cur[i + 1] <== hashers[i].out;
    }
    root <== cur[depth];
}

// Fixed-denomination withdrawal. The denomination + asset are enforced by the
// pool contract, so they are NOT circuit public inputs.
template Nullify(depth) {
    // public
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input fee;
    // private
    signal input nullifier;
    signal input secret;
    signal input pathElements[depth];
    signal input pathIndices[depth];

    // commitment = Poseidon(nullifier, secret)
    component commit = Poseidon(2);
    commit.inputs[0] <== nullifier;
    commit.inputs[1] <== secret;

    // nullifierHash = Poseidon(nullifier)
    component nh = Poseidon(1);
    nh.inputs[0] <== nullifier;
    nh.out === nullifierHash;

    // membership
    component mp = MerkleProof(depth);
    mp.leaf <== commit.out;
    for (var i = 0; i < depth; i++) {
        mp.pathElements[i] <== pathElements[i];
        mp.pathIndices[i] <== pathIndices[i];
    }
    mp.root === root;

    // bind recipient/relayer/fee so a relayer cannot tamper with them
    signal recipientSq <== recipient * recipient;
    signal relayerSq   <== relayer * relayer;
    signal feeSq       <== fee * fee;
}

component main {public [root, nullifierHash, recipient, relayer, fee]} = Nullify(32);
