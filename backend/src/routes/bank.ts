import express, { Request, Response } from "express";
import * as snarkjs from "snarkjs";
import fs from "fs";
import path from "path";

const router = express.Router();

function loadVerificationKey() {
  // Try server/zk directory
  const paths = [
    path.join(__dirname, "..", "..", "..", "server", "zk", "verification_key.json"),
    path.join(process.cwd(), "zk/verification_key.json"),
  ];

  for (const vkPath of paths) {
    if (fs.existsSync(vkPath)) {
      return JSON.parse(fs.readFileSync(vkPath, "utf-8"));
    }
  }

  throw new Error(
    `Verification key not found. Checked: ${paths.join(", ")}`
  );
}

router.post("/verify-proof", async (req: Request, res: Response) => {
  try {
    const vk = loadVerificationKey();
    const { proof, publicSignals } = req.body;
    const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);

    const statusBits = BigInt(publicSignals[0]);
    const govtIdOK = (statusBits & 2n) !== 0n;
    const faceOK = (statusBits & 4n) !== 0n;

    res.json({ valid, govtIdOK, faceOK });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Verification failed" });
  }
});

export default router;
