import express, { Request, Response } from "express";
import { hashCredential } from "../utils/poseidon";
import { signCredentialHash } from "../utils/issuer";
import { generateProof } from "../utils/prover";

const router = express.Router();

router.post("/submit", async (req: Request, res: Response) => {
  try {
    const { ageNatOK, govtIdOK, faceOK, livenessOK } = req.body;
    const salt = Math.floor(Math.random() * 1e6);

    const flags = {
      ageNatOK: Number(ageNatOK),
      govtIdOK: Number(govtIdOK),
      faceOK: Number(faceOK),
      livenessOK: Number(livenessOK),
    };

    const hash = hashCredential(flags, salt);
    const sig = signCredentialHash(hash, process.env.ISSUER_PRIVATE_KEY || "");

    const input = {
      ageNatOK: ageNatOK.toString(),
      govtIdOK: govtIdOK.toString(),
      faceOK: faceOK.toString(),
      livenessOK: livenessOK.toString(),
      salt: salt.toString(),
      sigR8x: sig.sigR8x.toString(),
      sigR8y: sig.sigR8y.toString(),
      sigS: sig.sigS.toString(),
      issuerPubKey: sig.pubKey.map((x: any) => x.toString()),
    };

    const proofData = await generateProof(input);
    res.json({ ...proofData, credentialHash: hash });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
