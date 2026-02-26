import * as circomlib from "circomlibjs";
import { randomBytes } from "crypto";

const eddsa = await circomlib.buildEddsa();
const babyJub = await circomlib.buildBabyjub();

// Generate 32-byte seed
const seed = randomBytes(32);

// Derive EdDSA private key properly
const prvKey = eddsa.pruneBuffer(seed);

// Public key
const pubKey = eddsa.prv2pub(prvKey);

console.log("ISSUER_PRIVATE_KEY_HEX =", Buffer.from(prvKey).toString("hex"));
console.log("ISSUER_PUBLIC_KEY_X =", babyJub.F.toObject(pubKey[0]).toString());
console.log("ISSUER_PUBLIC_KEY_Y =", babyJub.F.toObject(pubKey[1]).toString());