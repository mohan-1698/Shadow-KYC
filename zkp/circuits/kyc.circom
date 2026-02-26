pragma circom 2.0.0;

include "circomlib/circuits/Poseidon.circom";
include "circomlib/circuits/eddsaposeidon.circom";

// Enforces that a signal is either 0 or 1
template BoolBit() {
    signal input in;
    in * (in - 1) === 0;
}

template KYCKycProgressiveWithIssuer() {

    // --------- PRIVATE INPUTS ----------
    signal input ageNatOK;
    signal input govtIdOK;
    signal input faceOK;
    signal input livenessOK;
    signal input salt;

    // Issuer signature over credentialHash
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;

    // --------- PUBLIC INPUT ----------
    signal input issuerPubKey[2];

    // --------- PUBLIC OUTPUTS ----------
    signal output statusBits;
    signal output level;
    signal output credentialHash;

    // --------- BOOLEAN ENFORCEMENT ----------
    component bAge  = BoolBit();
    component bGovt = BoolBit();
    component bFace = BoolBit();
    component bLive = BoolBit();

    bAge.in  <== ageNatOK;
    bGovt.in <== govtIdOK;
    bFace.in <== faceOK;
    bLive.in <== livenessOK;

    // --------- STATUS BITMASK ----------
    statusBits <== ageNatOK
                 + 2 * govtIdOK
                 + 4 * faceOK
                 + 8 * livenessOK;

    // --------- LEVEL ----------
    level <== ageNatOK + govtIdOK + faceOK + livenessOK;

    // --------- CREDENTIAL HASH ----------
    component hash = Poseidon(5);
    hash.inputs[0] <== ageNatOK;
    hash.inputs[1] <== govtIdOK;
    hash.inputs[2] <== faceOK;
    hash.inputs[3] <== livenessOK;
    hash.inputs[4] <== salt;

    credentialHash <== hash.out;

    // --------- ISSUER SIGNATURE VERIFICATION ----------
    component verifier = EdDSAPoseidonVerifier();

    verifier.enabled <== 1; 

    // Public key
    verifier.Ax <== issuerPubKey[0];
    verifier.Ay <== issuerPubKey[1];

    // Signature
    verifier.R8x <== sigR8x;
    verifier.R8y <== sigR8y;
    verifier.S   <== sigS;

    // Message
    verifier.M <== credentialHash;
}

component main = KYCKycProgressiveWithIssuer();