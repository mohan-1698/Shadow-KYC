// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ZKProofStorage {

    // ================= STRUCT =================

    struct ZKProof {
        uint[2] pi_a;
        uint[2][2] pi_b;
        uint[2] pi_c;
        uint256[3] publicSignals;
        bytes32 credentialHash;
        uint256 timestamp;
        string algorithm;
        string curve;
        bool exists;
    }

    mapping(address => ZKProof) public userProofs;

    // ================= STORE FUNCTION =================

    /**
     * Accepts FULL Groth16 proof format:
     *
     * pi_a = [x,y,1]
     * pi_b = [[x,y],[x,y],[1,0]]
     * pi_c = [x,y,1]
     *
     * Automatically trims extra values.
     */

    function storeProof(

        uint[3] calldata _pi_a_full,
        uint[2][3] calldata _pi_b_full,   // ✅ CORRECT FORMAT
        uint[3] calldata _pi_c_full,

        uint256[3] calldata _publicSignals,

        bytes32 _credentialHash,
        uint256 _timestamp,
        string calldata _algorithm,
        string calldata _curve

    ) external {

        require(_credentialHash != bytes32(0), "Invalid credential hash");

        // ================= CONVERT GROTH16 → STRUCT FORMAT =================

        uint[2] memory pi_a = [
            _pi_a_full[0],
            _pi_a_full[1]
        ];

        uint[2][2] memory pi_b = [
            [_pi_b_full[0][0], _pi_b_full[0][1]],
            [_pi_b_full[1][0], _pi_b_full[1][1]]
        ];

        uint[2] memory pi_c = [
            _pi_c_full[0],
            _pi_c_full[1]
        ];

        // ================= STORE =================

        userProofs[msg.sender] = ZKProof({
            pi_a: pi_a,
            pi_b: pi_b,
            pi_c: pi_c,
            publicSignals: _publicSignals,
            credentialHash: _credentialHash,
            timestamp: _timestamp,
            algorithm: _algorithm,
            curve: _curve,
            exists: true
        });
    }

    // ================= READ =================

    function getMyProof() external view returns (ZKProof memory) {
        require(userProofs[msg.sender].exists, "No proof");
        return userProofs[msg.sender];
    }
}