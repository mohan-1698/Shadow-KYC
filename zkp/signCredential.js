import * as circomlib from "circomlibjs";
import { Buffer } from "buffer";

const eddsa = await circomlib.buildEddsa();
const poseidon = await circomlib.buildPoseidon();
const babyJub = await circomlib.buildBabyjub();

// USER FLAGS (same as circuit)
const inputs = [1n, 1n, 1n, 0n, 123456n];

// PRIVATE KEY (hex from keygen)
const prvKey = Buffer.from("080f380be362d79a3d9ead92e55bb601df6a079c813432bc137f276689585e72", "hex");

// Poseidon hash
const msg = poseidon(inputs);

// Sign - pass the poseidon hash output directly
const sig = eddsa.signPoseidon(prvKey, msg);

console.log("credentialHash =", babyJub.F.toObject(msg).toString());
console.log("sigR8x =", babyJub.F.toObject(sig.R8[0]).toString());
console.log("sigR8y =", babyJub.F.toObject(sig.R8[1]).toString());
console.log("sigS =", sig.S.toString());