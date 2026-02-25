import * as snarkjs from "snarkjs";
import fs from "fs";
import path from "path";

export async function generateProof(input: any) {
  // Use backend/src/zk directory
  const workDir = path.join(__dirname, "..", "zk");

  try {
    const zkeyPath = path.join(workDir, "kyc_final.zkey");
    const wasmPath = path.join(workDir, "kyc.wasm");

    console.log("Input for circuit:", JSON.stringify(input, null, 2));

    // Use snarkjs fullProve which handles witness generation internally
    // — no need for generate_witness.js or witness_calculator.js
    console.log("Generating proof with snarkjs.groth16.fullProve()...");

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      wasmPath,
      zkeyPath
    );

    console.log("Proof generated successfully");
    console.log("Public signals:", publicSignals);

    return { proof, publicSignals };
  } catch (error) {
    console.error("Full proof generation error:", error);
    throw new Error(
      `Proof generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
