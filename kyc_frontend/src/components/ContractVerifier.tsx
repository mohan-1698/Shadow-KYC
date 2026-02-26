import { useState } from "react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Wallet, Copy, Database, ExternalLink } from "lucide-react";

interface EthereumProvider {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    on?(event: string, handler: (...args: unknown[]) => void): void;
}
import {
  ZK_STORAGE_ADDRESS,
  storeProofOnChain,
  getMyProofFromChain,
  buildStorageInput,
  swapPiB,
  transformProofFromReport,
  buildVerifierInput,
  type StorageProofResult,
  type StoredProof,
} from "@/services/contractStorageService";

// Contract ABI
const VERIFIER_ABI = [
    {
        "inputs": [
            {
                "internalType": "uint256[2]",
                "name": "_pA",
                "type": "uint256[2]"
            },
            {
                "internalType": "uint256[2][2]",
                "name": "_pB",
                "type": "uint256[2][2]"
            },
            {
                "internalType": "uint256[2]",
                "name": "_pC",
                "type": "uint256[2]"
            },
            {
                "internalType": "uint256[3]",
                "name": "_pubSignals",
                "type": "uint256[3]"
            }
        ],
        "name": "verifyProof",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

const CONTRACT_ADDRESS = "0x650Aa741F233b4A38Dd6a481f584AECf20ec55b5";
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

interface VerificationResult {
    valid: boolean;
    blockNumber?: number;
    message: string;
}

interface ProofInputs {
    pA: string;
    pB: string;
    pC: string;
    pubSignals: string;
}

export function ContractVerifier() {
    const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [connected, setConnected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<VerificationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [inputErrors, setInputErrors] = useState<Record<string, string>>({});

    // ── Store Proof state ──────────────────────────────────────────────────
    const [storeLoading, setStoreLoading] = useState(false);
    const [storeError, setStoreError] = useState<string | null>(null);
    const [storeResult, setStoreResult] = useState<StorageProofResult | null>(null);
    const [storedProof, setStoredProof] = useState<StoredProof | null>(null);
    const [fetchingStored, setFetchingStored] = useState(false);

    interface StoreInputs {
        piAFull: string;  // uint256[3]
        piBFull: string;  // uint256[2][3]  — 3 pairs
        piCFull: string;  // uint256[3]
        pubSignals: string; // uint256[3]
        credentialHash: string;
        timestamp: string;
        algorithm: string;
        curve: string;
    }
    const [storeInputs, setStoreInputs] = useState<StoreInputs>({
        piAFull: '["0","0","1"]',
        piBFull: '[["0","0"],["0","0"],["0","0"]]',
        piCFull: '["0","0","1"]',
        pubSignals: '["0","0","0"]',
        credentialHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        timestamp: String(Math.floor(Date.now() / 1000)),
        algorithm: "groth16",
        curve: "bn128",
    });
    const [storeInputErrors, setStoreInputErrors] = useState<Record<string, string>>({});

    // ── Report JSON import state ───────────────────────────────────────────
    const [reportJson, setReportJson] = useState("");
    const [reportImportError, setReportImportError] = useState<string | null>(null);

    // ── Verifier report import state ─────────────────────────────────────
    const [verifierReportJson, setVerifierReportJson] = useState("");
    const [verifierImportError, setVerifierImportError] = useState<string | null>(null);

    /**
     * Flexible JSON parser — tries multiple strategies so users can paste:
     *   1. Full report JSON  { "zkProof": { ... } }
     *   2. Just the zkProof subtree
     *   3. Flat proof object { "pi_a":[...], "pi_b":[...], "pi_c":[...], "publicSignals":[...] }
     *   4. Bare key-value paste (missing outer braces) — auto-wraps in {}
     *
     * Always returns a normalised shape:
     *   { pi_a, pi_b, pi_c, publicSignals }  — ready for buildVerifierInput / transformProofFromReport
     */
    const flexParseProof = (raw: string): {
        pi_a: string[];
        pi_b: string[][];
        pi_c: string[];
        publicSignals: string[];
        credentialHash?: string;
        protocol?: string;
        curve?: string;
    } => {
        // strategy 1 & 4: try direct parse, then auto-wrap
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch {
            const trimmed = raw.trim();
            // If it looks like bare key:value pairs, wrap in {}
            const wrapped = (trimmed.startsWith("{") ? trimmed : `{${trimmed}}`);
            try {
                parsed = JSON.parse(wrapped);
            } catch {
                throw new Error("Could not parse JSON. Make sure the pasted text is valid JSON or wrap it in { }.");
            }
        }

        const obj = parsed as Record<string, unknown>;

        // strategy 2: full report  { walletAddress, zkProof, ... }
        if (obj.zkProof) {
            const zk = obj.zkProof as Record<string, unknown>;
            const inner = (zk.proof as Record<string, unknown>)?.proof as Record<string, unknown>;
            const sigs = ((zk.publicSignals as Record<string, unknown>)?.publicSignals as string[]);
            return {
                pi_a: inner.pi_a as string[],
                pi_b: inner.pi_b as string[][],
                pi_c: inner.pi_c as string[],
                publicSignals: sigs,
                credentialHash: (zk.proof as Record<string, unknown>)?.credentialHash as string,
                protocol: inner.protocol as string,
                curve: inner.curve as string,
            };
        }

        // strategy 3: zkProof subtree  { proof: { proof: {...} }, publicSignals: {...} }
        if (obj.proof && (obj.proof as Record<string, unknown>).proof) {
            const inner = (obj.proof as Record<string, unknown>).proof as Record<string, unknown>;
            const sigs = ((obj.publicSignals as Record<string, unknown>)?.publicSignals as string[]);
            return {
                pi_a: inner.pi_a as string[],
                pi_b: inner.pi_b as string[][],
                pi_c: inner.pi_c as string[],
                publicSignals: sigs,
                credentialHash: (obj.proof as Record<string, unknown>).credentialHash as string,
                protocol: inner.protocol as string,
                curve: inner.curve as string,
            };
        }

        // strategy 4: flat  { pi_a, pi_b, pi_c, publicSignals }
        if (obj.pi_a && obj.pi_b && obj.pi_c) {
            const sigs = (obj.publicSignals ?? obj.pubSignals) as string[] | { publicSignals: string[] };
            const sigArray = Array.isArray(sigs) ? sigs : (sigs as { publicSignals: string[] }).publicSignals;
            return {
                pi_a: obj.pi_a as string[],
                pi_b: obj.pi_b as string[][],
                pi_c: obj.pi_c as string[],
                publicSignals: sigArray,
                credentialHash: obj.credentialHash as string | undefined,
                protocol: obj.protocol as string | undefined,
                curve: obj.curve as string | undefined,
            };
        }

        throw new Error(
            "Unrecognised format. Paste the full report JSON, the zkProof section, " +
            "or a flat object with pi_a / pi_b / pi_c / publicSignals keys."
        );
    };

    // Import proof from report into verifier fields
    const handleImportVerifierFromReport = () => {
        setVerifierImportError(null);
        try {
            const proof = flexParseProof(verifierReportJson);

            // pA: first 2 elements (drop projective "1")
            const pA: [string, string] = [proof.pi_a[0], proof.pi_a[1]];
            // pB: swap pair[0] and pair[1]; drop pair[2] (projective)
            const pB: [[string, string], [string, string]] = [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]],
            ];
            // pC: first 2 elements
            const pC: [string, string] = [proof.pi_c[0], proof.pi_c[1]];
            const pubSigs: [string, string, string] = [
                proof.publicSignals[0], proof.publicSignals[1], proof.publicSignals[2],
            ];

            setInputs({
                pA: JSON.stringify(pA),
                pB: JSON.stringify(pB),
                pC: JSON.stringify(pC),
                pubSignals: JSON.stringify(pubSigs),
            });
            setInputErrors({});
            setVerifierReportJson("");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to parse";
            setVerifierImportError(msg);
        }
    };

    // Import proof from KYC verification report JSON (for Store section)
    const handleImportFromReport = () => {
        setReportImportError(null);
        try {
            const proof = flexParseProof(reportJson);

            // credentialHash: decimal bigint → 0x-padded bytes32 hex
            let credHash = proof.credentialHash ?? "0x" + "0".repeat(64);
            if (!credHash.startsWith("0x")) {
                credHash = "0x" + BigInt(credHash).toString(16).padStart(64, "0");
            }

            // pi_b full (3 pairs): swap pair[0] and [1], keep pair[2] as-is
            const rawPiB = proof.pi_b;
            const piBFull: [[string,string],[string,string],[string,string]] = [
                [rawPiB[0][1], rawPiB[0][0]],
                [rawPiB[1][1], rawPiB[1][0]],
                rawPiB[2] ? [rawPiB[2][0], rawPiB[2][1]] : ["1", "0"],
            ];

            setStoreInputs({
                piAFull: JSON.stringify([proof.pi_a[0], proof.pi_a[1], proof.pi_a[2] ?? "1"]),
                piBFull: JSON.stringify(piBFull),
                piCFull: JSON.stringify([proof.pi_c[0], proof.pi_c[1], proof.pi_c[2] ?? "1"]),
                pubSignals: JSON.stringify([proof.publicSignals[0], proof.publicSignals[1], proof.publicSignals[2]]),
                credentialHash: credHash,
                timestamp: String(Math.floor(Date.now() / 1000)),
                algorithm: proof.protocol ?? "groth16",
                curve: proof.curve ?? "bn128",
            });

            setReportJson("");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to parse report JSON";
            setReportImportError(msg);
        }
    };
    const [inputs, setInputs] = useState<ProofInputs>({
        pA: '["9145378444307675700604608785609512456551660761728279953972235841585655667766","20073329690138798698505289440597358629433265538981431097759303133475963710104"]',
        pB: '[["2034775962211501271100480579549775321877788201658822461916990234715157422090","12682102588970756874931896038273943141643204748335675794279497992220824762582"],["11288082119370304188105598595519095581033256072925531892983511610903093971646","17467515397705288659240659303323431748189185015510142105485827260507189332175"]]',
        pC: '["18506012845387674367722072265909360059531078101195487711669128058869184422563","19215015753438403558892779254994082004683676895319429721878854314560347360275"]',
        pubSignals: '["14","3","10578768231764529663015952240682172370053316410649887121895911169028814849661"]',
    });

    // Connect wallet
    const connectWallet = async () => {
        try {
            const ethereum = window.ethereum as EthereumProvider | undefined;
            if (!ethereum) {
                throw new Error("MetaMask not installed");
            }

            // Request account access
            const accounts = await ethereum.request({ method: "eth_requestAccounts" }) as string[];

            // Check network — enforce Sepolia only
            const chainIdHex = await ethereum.request({ method: "eth_chainId" }) as string;
            const chainId = parseInt(chainIdHex, 16);

            if (chainId !== SEPOLIA_CHAIN_ID) {
                // Try to switch automatically
                try {
                    await ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: "0xaa36a7" }], // Sepolia
                    });
                } catch {
                    throw new Error("Please switch MetaMask to Sepolia testnet (Chain ID 11155111)");
                }
            }

            // Create provider + signer
            const ethProvider = new ethers.providers.Web3Provider(ethereum as never);
            const ethSigner = ethProvider.getSigner();
            setProvider(ethProvider);
            setSigner(ethSigner);
            setConnected(true);
            setError(null);
            console.log("✅ Connected to Sepolia wallet:", accounts[0]);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Failed to connect";
            setError(errorMsg);
            setConnected(false);
        }
    };

    // Validate and parse JSON input
    const validateAndParse = (key: string, value: string) => {
        try {
            const parsed = JSON.parse(value);
            const newErrors = { ...inputErrors };
            delete newErrors[key];
            setInputErrors(newErrors);
            return parsed;
        } catch {
            setInputErrors(prev => ({
                ...prev,
                [key]: `Invalid JSON format for ${key}`
            }));
            return null;
        }
    };

    // Handle input change
    const handleInputChange = (key: keyof ProofInputs, value: string) => {
        setInputs(prev => ({ ...prev, [key]: value }));
        // Clear error on change
        setInputErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[key];
            return newErrors;
        });
    };

    // Verify proof on contract
    const handleVerifyProof = async () => {
        if (!provider) {
            setError("Wallet not connected");
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);
        const errors: Record<string, string> = {};

        try {
            // Parse all inputs
            const pA = validateAndParse("pA", inputs.pA);
            const pB = validateAndParse("pB", inputs.pB);
            const pC = validateAndParse("pC", inputs.pC);
            const pubSignals = validateAndParse("pubSignals", inputs.pubSignals);

            if (!pA || !pB || !pC || !pubSignals) {
                setLoading(false);
                return;
            }

            // Validate array lengths
            if (!Array.isArray(pA) || pA.length !== 2) {
                errors.pA = "pA must be an array of 2 elements";
            }
            if (!Array.isArray(pB) || pB.length !== 2 || !Array.isArray(pB[0]) || pB[0].length !== 2) {
                errors.pB = "pB must be a 2x2 array";
            }
            if (!Array.isArray(pC) || pC.length !== 2) {
                errors.pC = "pC must be an array of 2 elements";
            }
            if (!Array.isArray(pubSignals) || pubSignals.length !== 3) {
                errors.pubSignals = "pubSignals must be an array of 3 elements";
            }

            if (Object.keys(errors).length > 0) {
                setInputErrors(errors);
                setLoading(false);
                return;
            }

            console.log("🔗 Creating contract instance...");
            const contract = new ethers.Contract(
                CONTRACT_ADDRESS,
                VERIFIER_ABI,
                provider
            );

            console.log("📝 Proof data:");
            console.log("pA:", pA);
            console.log("pB:", pB);
            console.log("pC:", pC);
            console.log("pubSignals:", pubSignals);

            console.log("🔄 Calling verifyProof...");
            const isValid = await contract.verifyProof(pA, pB, pC, pubSignals);

            const block = await provider.getBlockNumber();

            console.log("✅ Verification result:", isValid);

            setResult({
                valid: isValid,
                blockNumber: block,
                message: isValid
                    ? "✅ Proof verified successfully on Sepolia!"
                    : "❌ Proof verification failed",
            });
        } catch (err) {
            const errorMsg =
                err instanceof Error
                    ? err.message
                    : "Verification failed";
            console.error("Error:", errorMsg);
            setError(errorMsg);
            setResult({
                valid: false,
                message: "Verification error",
            });
        } finally {
            setLoading(false);
        }
    };

    // Copy to clipboard
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    // ── Store proof on Sepolia ─────────────────────────────────────────────
    const handleStoreProof = async () => {
        if (!signer) { setStoreError("Wallet not connected"); return; }

        setStoreLoading(true);
        setStoreError(null);
        setStoreResult(null);
        const errs: Record<string, string> = {};

        try {
            // Parse JSON fields
            const piAFull = JSON.parse(storeInputs.piAFull);
            const piBFull = JSON.parse(storeInputs.piBFull);
            const piCFull = JSON.parse(storeInputs.piCFull);
            const pubSigs  = JSON.parse(storeInputs.pubSignals);

            if (!Array.isArray(piAFull) || piAFull.length !== 3)
                errs.piAFull = "pi_a must be uint256[3] — array of 3 elements";
            if (!Array.isArray(piBFull) || piBFull.length !== 3 ||
                !piBFull.every((p: unknown) => Array.isArray(p) && (p as unknown[]).length === 2))
                errs.piBFull = "pi_b must be uint256[2][3] — array of 3 pairs";
            if (!Array.isArray(piCFull) || piCFull.length !== 3)
                errs.piCFull = "pi_c must be uint256[3] — array of 3 elements";
            if (!Array.isArray(pubSigs) || pubSigs.length !== 3)
                errs.pubSignals = "publicSignals must be uint256[3] — array of 3";

            if (Object.keys(errs).length > 0) {
                setStoreInputErrors(errs);
                setStoreLoading(false);
                return;
            }
            setStoreInputErrors({});

            const ts = parseInt(storeInputs.timestamp) || Math.floor(Date.now() / 1000);

            const result = await storeProofOnChain(signer, {
                pi_a_full: piAFull as [string, string, string],
                pi_b_full: piBFull as [[string, string],[string, string],[string, string]],
                pi_c_full: piCFull as [string, string, string],
                publicSignals: pubSigs as [string, string, string],
                credentialHash: storeInputs.credentialHash,
                timestamp: ts,
                algorithm: storeInputs.algorithm,
                curve: storeInputs.curve,
            });

            setStoreResult(result);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "storeProof failed";
            console.error("storeProof error:", msg);
            setStoreError(msg);
        } finally {
            setStoreLoading(false);
        }
    };

    // Fetch stored proof for current account
    const handleFetchMyProof = async () => {
        // Must use signer, not provider — contract reads msg.sender internally
        if (!signer) { setStoreError("Wallet not connected"); return; }
        setFetchingStored(true);
        setStoreError(null);
        try {
            const proof = await getMyProofFromChain(signer);
            setStoredProof(proof);
            if (!proof) setStoreError("No proof stored for this address yet.");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Fetch failed";
            setStoreError(msg);
        } finally {
            setFetchingStored(false);
        }
    };

    // Auto-fill store inputs from the current verifier proof fields
    const autoFillFromVerifier = () => {
        try {
            const pA = JSON.parse(inputs.pA) as string[];
            const pB = JSON.parse(inputs.pB) as string[][];
            const pC = JSON.parse(inputs.pC) as string[];

            // Extend affine to projective (append "1")
            const piAFull: [string, string, string] = [pA[0], pA[1], "1"];
            const piCFull: [string, string, string] = [pC[0], pC[1], "1"];
            // pi_b from the verifier is already [2][2] affine; add a third dummy row for storage
            const swapped = swapPiB([...pB, ["1", "0"]]);
            const piBFull = swapped;

            setStoreInputs(prev => ({
                ...prev,
                piAFull: JSON.stringify(piAFull),
                piBFull: JSON.stringify(piBFull),
                piCFull: JSON.stringify(piCFull),
                pubSignals: inputs.pubSignals,
                timestamp: String(Math.floor(Date.now() / 1000)),
            }));
        } catch {
            setStoreError("Failed to auto-fill: ensure verifier fields have valid JSON.");
        }
    };

    // Transform proof with element reordering (pi_b reversal)
    const transformProofFormat = () => {
        try {
            const pA = validateAndParse("pA", inputs.pA);
            const pB = validateAndParse("pB", inputs.pB);
            const pC = validateAndParse("pC", inputs.pC);

            if (!pA || !pB || !pC) {
                setError("Invalid JSON in one or more fields");
                return;
            }

            // Transform: reorder pi_b elements
            const transformedA = [pA[0], pA[1]];
            const transformedB = [
                [pB[0][1], pB[0][0]],
                [pB[1][1], pB[1][0]]
            ];
            const transformedC = [pC[0], pC[1]];

            // Update inputs with transformed values
            setInputs(prev => ({
                ...prev,
                pA: JSON.stringify(transformedA),
                pB: JSON.stringify(transformedB),
                pC: JSON.stringify(transformedC)
            }));

            console.log("✅ Proof format transformed");
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : "Transform failed";
            setError(errorMsg);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Smart Contract Proof Verifier
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Wallet Connection */}
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-sm">
                                Network: <span className="text-blue-600">Sepolia Testnet</span>
                            </h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Contract: <code className="bg-white dark:bg-gray-800 px-2 py-1 rounded text-xs">{CONTRACT_ADDRESS}</code>
                            </p>
                        </div>
                        <Button
                            onClick={connectWallet}
                            disabled={connected}
                            variant={connected ? "default" : "outline"}
                        >
                            {connected ? "✅ Connected" : "Connect Wallet"}
                        </Button>
                    </div>
                </div>

                {/* ── Import from KYC Report (Verifier) ── */}
                <div className="space-y-2 bg-purple-50 dark:bg-purple-950 p-3 rounded">
                    <p className="text-xs font-semibold text-purple-800 dark:text-purple-200">
                        Import Proof from KYC Verification Report
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Paste your report JSON. pB is automatically transformed:
                        pair[0] &amp; pair[1] swapped <code>[x,y]→[y,x]</code>, projective pair[2] dropped.
                        Accepts: full report, zkProof section, flat object, or bare <code>"pi_a":[...]</code> fields.
                    </p>
                    <textarea
                        value={verifierReportJson}
                        onChange={e => { setVerifierReportJson(e.target.value); setVerifierImportError(null); }}
                        className="w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 border-gray-300 focus:ring-purple-500 bg-white dark:bg-gray-900"
                        rows={4}
                        placeholder={`Accepts any of:\n• Full report JSON  { "walletAddress": "", "zkProof": { ... } }\n• zkProof section   { "proof": { "proof": {...} }, "publicSignals": {...} }\n• Flat object       { "pi_a":[...], "pi_b":[...], "pi_c":[...], "publicSignals":[...] }\n• Bare fields       "pi_a":[...], "pi_b":[...], "pi_c":[...], "publicSignals":[...]`}
                    />
                    {verifierImportError && (
                        <p className="text-xs text-red-500">{verifierImportError}</p>
                    )}
                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleImportVerifierFromReport}
                        disabled={!verifierReportJson.trim() || loading}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                    >
                        Import &amp; Fill Verifier Fields
                    </Button>
                </div>

                {/* Proof Input Fields */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Proof Data (JSON Format)</h3>

                    {/* pA Input */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">pA (uint256[2])</label>
                        <textarea
                            value={inputs.pA}
                            onChange={(e) => handleInputChange("pA", e.target.value)}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${
                                inputErrors.pA
                                    ? "border-red-500 focus:ring-red-500"
                                    : "border-gray-300 focus:ring-blue-500"
                            }`}
                            rows={2}
                            placeholder='["value1", "value2"]'
                        />
                        {inputErrors.pA && <p className="text-xs text-red-500">{inputErrors.pA}</p>}
                        <p className="text-xs text-gray-500">Array of 2 elements</p>
                    </div>

                    {/* pB Input */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">pB (uint256[2][2])</label>
                        <textarea
                            value={inputs.pB}
                            onChange={(e) => handleInputChange("pB", e.target.value)}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${
                                inputErrors.pB
                                    ? "border-red-500 focus:ring-red-500"
                                    : "border-gray-300 focus:ring-blue-500"
                            }`}
                            rows={3}
                            placeholder='[["value1", "value2"], ["value3", "value4"]]'
                        />
                        {inputErrors.pB && <p className="text-xs text-red-500">{inputErrors.pB}</p>}
                        <p className="text-xs text-gray-500">2x2 nested array</p>
                    </div>

                    {/* pC Input */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">pC (uint256[2])</label>
                        <textarea
                            value={inputs.pC}
                            onChange={(e) => handleInputChange("pC", e.target.value)}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${
                                inputErrors.pC
                                    ? "border-red-500 focus:ring-red-500"
                                    : "border-gray-300 focus:ring-blue-500"
                            }`}
                            rows={2}
                            placeholder='["value1", "value2"]'
                        />
                        {inputErrors.pC && <p className="text-xs text-red-500">{inputErrors.pC}</p>}
                        <p className="text-xs text-gray-500">Array of 2 elements</p>
                    </div>

                    {/* pubSignals Input */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">Public Signals (uint256[3])</label>
                        <textarea
                            value={inputs.pubSignals}
                            onChange={(e) => handleInputChange("pubSignals", e.target.value)}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${
                                inputErrors.pubSignals
                                    ? "border-red-500 focus:ring-red-500"
                                    : "border-gray-300 focus:ring-blue-500"
                            }`}
                            rows={2}
                            placeholder='["value1", "value2", "value3"]'
                        />
                        {inputErrors.pubSignals && <p className="text-xs text-red-500">{inputErrors.pubSignals}</p>}
                        <p className="text-xs text-gray-500">Array of 3 elements</p>
                    </div>
                </div>

                {/* Verify Button */}
                <Button
                    onClick={handleVerifyProof}
                    disabled={!connected || loading || Object.keys(inputErrors).length > 0}
                    className="w-full"
                    size="lg"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Verifying...
                        </>
                    ) : (
                        "Verify Proof on Contract"
                    )}
                </Button>

                {/* Transform Button */}
                <Button
                    onClick={transformProofFormat}
                    variant="outline"
                    className="w-full"
                    disabled={loading}
                >
                    Transform Proof Format
                </Button>

                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive">
                        <XCircle className="w-4 h-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Result Alert */}
                {result && (
                    <Alert
                        className={
                            result.valid
                                ? "border-green-500 bg-green-50 dark:bg-green-950"
                                : "border-red-500 bg-red-50 dark:bg-red-950"
                        }
                    >
                        <div className="flex items-start gap-3">
                            {result.valid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            )}
                            <div>
                                <h4 className="font-semibold">{result.message}</h4>
                                {result.blockNumber && (
                                    <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                                        Block: {result.blockNumber}
                                    </p>
                                )}
                            </div>
                        </div>
                    </Alert>
                )}

                {/* Instructions */}
                <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded text-sm space-y-2">
                    <h4 className="font-semibold">📋 How to use</h4>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Install MetaMask and switch to Sepolia testnet</li>
                        <li>Click "Connect Wallet"</li>
                        <li>Paste your proof data as JSON in each field</li>
                        <li>Click "Verify Proof on Contract"</li>
                        <li>Result will show if proof is valid</li>
                    </ol>
                </div>

                {/* Info */}
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs space-y-1">
                    <p>
                        <strong>Contract:</strong> Groth16Verifier
                    </p>
                    <p>
                        <strong>Function:</strong> verifyProof(_pA, _pB, _pC, _pubSignals)
                    </p>
                    <p>
                        <strong>Network:</strong> Sepolia (Chain ID: 11155111)
                    </p>
                </div>

                {/* ── Store Proof on Sepolia ───────────────────────────────── */}
                <div className="border-t pt-6 space-y-4">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Store Proof on Sepolia
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Calls <code>storeProof()</code> on <strong>ZKProofStorage</strong> and persists
                        your groth16 proof on-chain.
                        Contract:&nbsp;
                        <a
                            href={`${SEPOLIA_EXPLORER}/address/${ZK_STORAGE_ADDRESS}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-500 underline break-all"
                        >
                            {ZK_STORAGE_ADDRESS}
                        </a>
                    </p>

                    {/* ── Import from KYC Report JSON ── */}
                    <div className="space-y-2 bg-indigo-50 dark:bg-indigo-950 p-3 rounded">
                        <p className="text-xs font-semibold">Paste KYC Verification Report JSON</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Paste the full report JSON (or just the <code>zkProof</code> section, or bare proof fields).
                            pi_b is transformed automatically: pairs 0 &amp; 1 are swapped [y,x], pair 2 kept as-is.
                        </p>
                        <textarea
                            value={reportJson}
                            onChange={e => { setReportJson(e.target.value); setReportImportError(null); }}
                            className="w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 border-gray-300 focus:ring-indigo-500 bg-white dark:bg-gray-900"
                            rows={4}
                            placeholder={`Accepts any of:\n• Full report JSON  { "walletAddress": "", "zkProof": { ... } }\n• zkProof section   { "proof": { "proof": {...} }, "publicSignals": {...} }\n• Flat object       { "pi_a":[...], "pi_b":[...], "pi_c":[...], "publicSignals":[...] }\n• Bare fields       "pi_a":[...], "pi_b":[...], "pi_c":[...], "publicSignals":[...]`}
                        />
                        {reportImportError && (
                            <p className="text-xs text-red-500">{reportImportError}</p>
                        )}
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleImportFromReport}
                            disabled={!reportJson.trim() || storeLoading}
                            className="w-full"
                        >
                            Import &amp; Transform from Report
                        </Button>
                    </div>

                    {/* Auto-fill helper */}
                    <Button variant="outline" size="sm" onClick={autoFillFromVerifier} disabled={storeLoading}>
                        ↑ Auto-fill from Verifier fields above
                    </Button>

                    {/* pi_a_full */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">pi_a_full (uint256[3])</label>
                        <textarea
                            value={storeInputs.piAFull}
                            onChange={e => setStoreInputs(p => ({ ...p, piAFull: e.target.value }))}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${storeInputErrors.piAFull ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                            rows={2}
                            placeholder='["x","y","1"]'
                        />
                        {storeInputErrors.piAFull && <p className="text-xs text-red-500">{storeInputErrors.piAFull}</p>}
                        <p className="text-xs text-gray-500">Full projective point — 3 elements (append "1")</p>
                    </div>

                    {/* pi_b_full */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">pi_b_full (uint256[2][3]) — 3 pairs, G2 swapped</label>
                        <textarea
                            value={storeInputs.piBFull}
                            onChange={e => setStoreInputs(p => ({ ...p, piBFull: e.target.value }))}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${storeInputErrors.piBFull ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                            rows={3}
                            placeholder='[["y0","x0"],["y1","x1"],["y2","x2"]]'
                        />
                        {storeInputErrors.piBFull && <p className="text-xs text-red-500">{storeInputErrors.piBFull}</p>}
                        <p className="text-xs text-gray-500">3 pairs — each pair is [y,x] (G2 element swap applied)</p>
                    </div>

                    {/* pi_c_full */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">pi_c_full (uint256[3])</label>
                        <textarea
                            value={storeInputs.piCFull}
                            onChange={e => setStoreInputs(p => ({ ...p, piCFull: e.target.value }))}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${storeInputErrors.piCFull ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                            rows={2}
                            placeholder='["x","y","1"]'
                        />
                        {storeInputErrors.piCFull && <p className="text-xs text-red-500">{storeInputErrors.piCFull}</p>}
                        <p className="text-xs text-gray-500">Full projective point — 3 elements (append "1")</p>
                    </div>

                    {/* publicSignals */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">Public Signals (uint256[3])</label>
                        <textarea
                            value={storeInputs.pubSignals}
                            onChange={e => setStoreInputs(p => ({ ...p, pubSignals: e.target.value }))}
                            className={`w-full p-2 rounded border text-xs font-mono resize-none focus:outline-none focus:ring-2 ${storeInputErrors.pubSignals ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`}
                            rows={2}
                            placeholder='["s0","s1","s2"]'
                        />
                        {storeInputErrors.pubSignals && <p className="text-xs text-red-500">{storeInputErrors.pubSignals}</p>}
                    </div>

                    {/* credentialHash */}
                    <div className="space-y-1">
                        <label className="text-xs font-semibold">Credential Hash (bytes32)</label>
                        <input
                            type="text"
                            value={storeInputs.credentialHash}
                            onChange={e => setStoreInputs(p => ({ ...p, credentialHash: e.target.value }))}
                            className="w-full p-2 rounded border text-xs font-mono focus:outline-none focus:ring-2 border-gray-300 focus:ring-blue-500"
                            placeholder="0x..."
                        />
                    </div>

                    {/* timestamp + algorithm + curve (row) */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold">Timestamp (unix)</label>
                            <input
                                type="number"
                                value={storeInputs.timestamp}
                                onChange={e => setStoreInputs(p => ({ ...p, timestamp: e.target.value }))}
                                className="w-full p-2 rounded border text-xs font-mono focus:outline-none focus:ring-2 border-gray-300 focus:ring-blue-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold">Algorithm</label>
                            <input
                                type="text"
                                value={storeInputs.algorithm}
                                onChange={e => setStoreInputs(p => ({ ...p, algorithm: e.target.value }))}
                                className="w-full p-2 rounded border text-xs font-mono focus:outline-none focus:ring-2 border-gray-300 focus:ring-blue-500"
                                placeholder="groth16"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold">Curve</label>
                            <input
                                type="text"
                                value={storeInputs.curve}
                                onChange={e => setStoreInputs(p => ({ ...p, curve: e.target.value }))}
                                className="w-full p-2 rounded border text-xs font-mono focus:outline-none focus:ring-2 border-gray-300 focus:ring-blue-500"
                                placeholder="bn128"
                            />
                        </div>
                    </div>

                    {/* Store button */}
                    <Button
                        onClick={handleStoreProof}
                        disabled={!connected || storeLoading}
                        className="w-full"
                        size="lg"
                    >
                        {storeLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Storing on Sepolia…
                            </>
                        ) : (
                            "Store Proof on Sepolia"
                        )}
                    </Button>

                    {/* Fetch my proof button */}
                    <Button
                        onClick={handleFetchMyProof}
                        disabled={!connected || fetchingStored}
                        variant="outline"
                        className="w-full"
                    >
                        {fetchingStored ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Fetching…</>
                        ) : (
                            "Fetch My Stored Proof"
                        )}
                    </Button>

                    {/* Store error */}
                    {storeError && (
                        <Alert variant="destructive">
                            <XCircle className="w-4 h-4" />
                            <AlertDescription>{storeError}</AlertDescription>
                        </Alert>
                    )}

                    {/* Store success */}
                    {storeResult && (
                        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <div className="ml-2 space-y-1">
                                <p className="font-semibold text-sm">Proof stored on Sepolia!</p>
                                <p className="text-xs text-gray-600 dark:text-gray-300">Block: {storeResult.blockNumber}</p>
                                <a
                                    href={`${SEPOLIA_EXPLORER}/tx/${storeResult.txHash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-blue-600 underline flex items-center gap-1"
                                >
                                    View on Etherscan <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </Alert>
                    )}

                    {/* Fetched proof display */}
                    {storedProof && (
                        <div className="bg-gray-50 dark:bg-gray-900 rounded p-4 text-xs font-mono space-y-1 border">
                            <p className="font-semibold text-sm mb-2">Your On-Chain Proof</p>
                            <p><strong>Algorithm:</strong> {storedProof.algorithm} | <strong>Curve:</strong> {storedProof.curve}</p>
                            <p><strong>Timestamp:</strong> {new Date(storedProof.timestamp * 1000).toLocaleString()}</p>
                            <p><strong>Credential Hash:</strong> <span className="break-all">{storedProof.credentialHash}</span></p>
                            <p><strong>Public Signals:</strong> {storedProof.publicSignals.join(", ")}</p>
                        </div>
                    )}

                    {/* Info row */}
                    <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs space-y-1">
                        <p><strong>Contract:</strong> ZKProofStorage</p>
                        <p><strong>Function:</strong> storeProof(_pi_a_full, _pi_b_full, _pi_c_full, _publicSignals, _credentialHash, _timestamp, _algorithm, _curve)</p>
                        <p><strong>Network:</strong> Sepolia (Chain ID: 11155111)</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}


