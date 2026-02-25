import { buildPoseidon } from "circomlibjs";
import { initEddsa } from "./issuer";

let poseidon: any, F: any;

export async function initPoseidon() {
  poseidon = await buildPoseidon();
  F = poseidon.F;
  await initEddsa();
}

export function getField() {
  return F;
}

export function hashCredential(
  flags: { ageNatOK: number; govtIdOK: number; faceOK: number; livenessOK: number },
  salt: number
) {
  if (!poseidon) throw new Error("Poseidon not initialized");

  const h = poseidon([
    flags.ageNatOK,
    flags.govtIdOK,
    flags.faceOK,
    flags.livenessOK,
    BigInt(salt),
  ]);

  return F.toString(h);
}
