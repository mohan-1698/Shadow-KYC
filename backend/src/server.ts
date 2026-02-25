import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import kycRoutes from "./routes/kyc";
import bankRoutes from "./routes/bank";
import { initPoseidon } from "./utils/poseidon";

dotenv.config();

async function startServer() {
  await initPoseidon(); // ensures Poseidon + EdDSA ready

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "OK" });
  });

  app.use("/kyc", kycRoutes);
  app.use("/bank", bankRoutes);

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

startServer();