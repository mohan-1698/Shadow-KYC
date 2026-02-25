import { buildEddsa } from "circomlibjs";

let eddsa: any;
let F: any;

export async function initEddsa() {
  eddsa = await buildEddsa();
  F = eddsa.F;
}

export function getField() {
  return F;
}

export function signCredentialHash(hash: string, privateKeyHex: string) {
  if (!eddsa) throw new Error("Eddsa not initialized.");
  if (!privateKeyHex) throw new Error("ISSUER_PRIVATE_KEY missing in environment");

  const prv = Buffer.from(privateKeyHex, "hex");

  if (prv.length !== 32) {
    throw new Error(`Private key must be 32 bytes, got ${prv.length}`);
  }

  // Convert hash string back to field element for signPoseidon
  const hashNum = F.e(hash);

  const sig = eddsa.signPoseidon(prv, hashNum);

  return {
    sigR8x: eddsa.F.toString(sig.R8[0]),
    sigR8y: eddsa.F.toString(sig.R8[1]),
    sigS: sig.S.toString(),
    pubKey: eddsa.prv2pub(prv).map((x: any) => eddsa.F.toString(x)),
  };
}
