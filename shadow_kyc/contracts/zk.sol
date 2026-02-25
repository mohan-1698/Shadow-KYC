    // SPDX-License-Identifier: MIT
    pragma solidity ^0.8.20;

    /**
    * @title ZKProofStorage
    * @dev Stores and manages ZK proofs for KYC verification on Sepolia testnet
    * After proof generation, the proof is hashed and stored with retrieval capabilities
    */

    interface IGruth16Verifier {
        function verifyProof(
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[3] memory input
        ) external view returns (bool);
    }

    interface IUserCredentials {
        function getCredentialHash(address user) external view returns (bytes32);
    }

    contract ZKProofStorage {
        // ==================== STATE VARIABLES ====================
        
        /// @dev Groth16 verifier contract reference
        IGruth16Verifier public groth16Verifier;
        
        /// @dev User credentials contract reference
        IUserCredentials public userCredentials;

        /// @dev Stores proof hash for each user
        /// mapping(userAddress => proofHash)
        mapping(address => bytes32) public proofHashes;

        /// @dev Stores proof metadata for auditing
        /// mapping(userAddress => nonce => proofData)
        mapping(address => mapping(uint256 => ProofRecord)) public proofRecords;

        /// @dev Counter for number of proofs submitted by a user
        mapping(address => uint256) public proofCountByUser;

        /// @dev Stores mapping of proof hash to proof data for retrieval
        /// mapping(proofHash => proofDetails)
        mapping(bytes32 => ProofDetails) public proofDetails;

        /// @dev All proof hashes stored (for auditing/tracking)
        bytes32[] public allProofHashes;

        /// @dev KYC Level mapping
        mapping(address => uint8) public userKYCLevel;

        /// @dev Proof information structure
        struct ProofRecord {
            bytes32 proofHash;
            uint256 timestamp;
            bool verified;
            uint8 kycLevel;
            bytes32 credentialHash;
            uint256[3] publicSignals;
        }

        /// @dev Detailed proof information
        struct ProofDetails {
            address user;
            bytes32 credentialHash;
            uint256[3] publicSignals;
            uint256 timestamp;
            bool isVerified;
            uint8 kycLevel; // 0-4 based on flags (ageNatOK, govtIdOK, faceOK, livenessOK)
            string proofMetadata; // JSON metadata
        }

        /// @dev Proof submission data
        struct ProofSubmission {
            uint[2] a;
            uint[2][2] b;
            uint[2] c;
            uint256[3] publicSignals;
            bytes32 credentialHash;
        }

        // ==================== EVENTS ====================
        
        /// @dev Emitted when a proof is submitted
        event ProofSubmitted(
            indexed address user,
            bytes32 indexed proofHash,
            bytes32 credentialHash,
            uint8 kycLevel,
            uint256 timestamp
        );

        /// @dev Emitted when a proof is verified
        event ProofVerified(
            indexed address user,
            bytes32 indexed proofHash,
            bool isValid,
            uint256 timestamp
        );

        /// @dev Emitted when proof hash is retrieved
        event ProofRetrieved(
            indexed address user,
            bytes32 indexed proofHash,
            uint256 timestamp
        );

        /// @dev Emitted when KYC level is updated
        event KYCLevelUpdated(
            indexed address user,
            uint8 newLevel,
            uint8 previousLevel
        );

        /// @dev Emitted when verifier address is updated
        event VerifierUpdated(
            address indexed oldVerifier,
            address indexed newVerifier
        );

        // ==================== MODIFIERS ====================

        modifier proofExists(address user) {
            require(proofHashes[user] != bytes32(0), "No proof found for user");
            _;
        }

        modifier onlyValidProof(bytes32 _proofHash) {
            require(
                proofDetails[_proofHash].user != address(0),
                "Proof does not exist"
            );
            _;
        }

        // ==================== CONSTRUCTOR ====================

        /**
        * @dev Initialize ZKProofStorage with verifier contract
        * @param _verifierAddress Address of the Groth16Verifier contract
        * @param _credentialsAddress Address of the UserCredentials contract
        */
        constructor(address _verifierAddress, address _credentialsAddress) {
            require(
                _verifierAddress != address(0),
                "Invalid verifier address"
            );
            require(
                _credentialsAddress != address(0),
                "Invalid credentials address"
            );
            
            groth16Verifier = IGruth16Verifier(_verifierAddress);
            userCredentials = IUserCredentials(_credentialsAddress);
        }

        // ==================== PROOF SUBMISSION ====================

        /**
        * @dev Submit and store a ZK proof with its hash
        * @param _a Groth16 proof component a
        * @param _b Groth16 proof component b
        * @param _c Groth16 proof component c
        * @param _publicSignals Public signals from the proof
        * @param _credentialHash Credential hash from backend
        * @param _proofMetadata JSON metadata about the proof
        * @return proofHash The computed hash of the proof
        */
        function submitProof(
            uint[2] memory _a,
            uint[2][2] memory _b,
            uint[2] memory _c,
            uint256[3] memory _publicSignals,
            bytes32 _credentialHash,
            string memory _proofMetadata
        ) external returns (bytes32) {
            require(_publicSignals[0] > 0, "Invalid public signals");
            require(_credentialHash != bytes32(0), "Invalid credential hash");

            // Compute proof hash
            bytes32 proofHash = keccak256(
                abi.encodePacked(
                    _a,
                    _b,
                    _c,
                    _publicSignals,
                    msg.sender,
                    block.timestamp
                )
            );

            // Calculate KYC level from public signals (status bits)
            uint8 kycLevel = calculateKYCLevel(_publicSignals[0]);

            // Store proof hash for user
            proofHashes[msg.sender] = proofHash;

            // Increment proof counter
            uint256 nonce = proofCountByUser[msg.sender];
            proofCountByUser[msg.sender]++;

            // Store proof record
            proofRecords[msg.sender][nonce] = ProofRecord({
                proofHash: proofHash,
                timestamp: block.timestamp,
                verified: false,
                kycLevel: kycLevel,
                credentialHash: _credentialHash,
                publicSignals: _publicSignals
            });

            // Store detailed proof information
            proofDetails[proofHash] = ProofDetails({
                user: msg.sender,
                credentialHash: _credentialHash,
                publicSignals: _publicSignals,
                timestamp: block.timestamp,
                isVerified: false,
                kycLevel: kycLevel,
                proofMetadata: _proofMetadata
            });

            // Add to all proofs list
            allProofHashes.push(proofHash);

            // Update user KYC level
            uint8 prevLevel = userKYCLevel[msg.sender];
            userKYCLevel[msg.sender] = kycLevel;
            if (prevLevel != kycLevel) {
                emit KYCLevelUpdated(msg.sender, kycLevel, prevLevel);
            }

            // Emit event
            emit ProofSubmitted(
                msg.sender,
                proofHash,
                _credentialHash,
                kycLevel,
                block.timestamp
            );

            return proofHash;
        }

        /**
        * @dev Verify a submitted proof on-chain using Groth16Verifier
        * @param _proofHash The hash of the proof to verify
        * @param _a Groth16 proof component a
        * @param _b Groth16 proof component b
        * @param _c Groth16 proof component c
        * @return isValid Whether the proof is valid
        */
        function verifyProof(
            bytes32 _proofHash,
            uint[2] memory _a,
            uint[2][2] memory _b,
            uint[2] memory _c
        ) external onlyValidProof(_proofHash) returns (bool) {
            ProofDetails storage proof = proofDetails[_proofHash];
            require(proof.user != address(0), "Proof does not exist");

            // Verify proof using Groth16Verifier
            bool isValid = groth16Verifier.verifyProof(
                _a,
                _b,
                _c,
                proof.publicSignals
            );

            // Update verification status
            if (isValid) {
                proof.isVerified = true;
                
                // Update proof record
                uint256 nonce = proofCountByUser[proof.user] - 1;
                proofRecords[proof.user][nonce].verified = true;
            }

            emit ProofVerified(msg.sender, _proofHash, isValid, block.timestamp);
            return isValid;
        }

        // ==================== RETRIEVAL FUNCTIONS ====================

        /**
        * @dev Get the latest proof hash for a user
        * @param _user Address of the user
        * @return The latest proof hash
        */
        function getProofHash(address _user)
            external
            view
            proofExists(_user)
            returns (bytes32)
        {
            emit ProofRetrieved(_user, proofHashes[_user], block.timestamp);
            return proofHashes[_user];
        }

        /**
        * @dev Get proof details by hash
        * @param _proofHash The hash of the proof to retrieve
        * @return Proof details struct
        */
        function getProofDetails(bytes32 _proofHash)
            external
            view
            onlyValidProof(_proofHash)
            returns (ProofDetails memory)
        {
            return proofDetails[_proofHash];
        }

        /**
        * @dev Get a specific proof record for a user
        * @param _user Address of the user
        * @param _nonce Index of the proof record
        * @return Proof record
        */
        function getProofRecord(address _user, uint256 _nonce)
            external
            view
            returns (ProofRecord memory)
        {
            require(
                _nonce < proofCountByUser[_user],
                "Invalid nonce"
            );
            return proofRecords[_user][_nonce];
        }

        /**
        * @dev Get all proof hashes (for auditing)
        * @return Array of all proof hashes
        */
        function getAllProofHashes() external view returns (bytes32[] memory) {
            return allProofHashes;
        }

        /**
        * @dev Get number of proofs submitted by a user
        * @param _user Address of the user
        * @return Number of proofs
        */
        function getProofCount(address _user) external view returns (uint256) {
            return proofCountByUser[_user];
        }

        /**
        * @dev Get user's KYC level
        * @param _user Address of the user
        * @return KYC level (0-4)
        */
        function getUserKYCLevel(address _user)
            external
            view
            returns (uint8)
        {
            return userKYCLevel[_user];
        }

        /**
        * @dev Check if a proof is verified
        * @param _proofHash The hash of the proof
        * @return Whether the proof is verified
        */
        function isProofVerified(bytes32 _proofHash)
            external
            view
            onlyValidProof(_proofHash)
            returns (bool)
        {
            return proofDetails[_proofHash].isVerified;
        }

        // ==================== HELPER FUNCTIONS ====================

        /**
        * @dev Calculate KYC level from status bits
        * Status bits: bit 0 = ageNatOK, bit 1 = govtIdOK, bit 2 = faceOK, bit 3 = livenessOK
        * KYC Levels:
        *   0 = No verification
        *   1 = Age/Nationality verified
        *   2 = + Government ID verified
        *   3 = + Face verified
        *   4 = + Liveness verified (complete)
        * @param _statusBits The status bits from public signals
        * @return kycLevel The calculated KYC level (0-4)
        */
        function calculateKYCLevel(uint256 _statusBits)
            public
            pure
            returns (uint8)
        {
            uint8 level = 0;
            
            if ((_statusBits & 1) != 0) level++; // ageNatOK
            if ((_statusBits & 2) != 0) level++; // govtIdOK
            if ((_statusBits & 4) != 0) level++; // faceOK
            if ((_statusBits & 8) != 0) level++; // livenessOK
            
            return level;
        }

        /**
        * @dev Compute proof hash (matches backend computation)
        * Used for verification and retrieval
        * @param _a Proof component a
        * @param _b Proof component b
        * @param _c Proof component c
        * @param _publicSignals Public signals
        * @param _user User address
        * @param _timestamp Block timestamp
        * @return Computed proof hash
        */
        function computeProofHash(
            uint[2] memory _a,
            uint[2][2] memory _b,
            uint[2] memory _c,
            uint256[3] memory _publicSignals,
            address _user,
            uint256 _timestamp
        ) external pure returns (bytes32) {
            return keccak256(
                abi.encodePacked(_a, _b, _c, _publicSignals, _user, _timestamp)
            );
        }

        /**
        * @dev Decode KYC flags from status bits
        * @param _statusBits The status bits from public signals
        * @return ageNatOK Age and nationality check
        * @return govtIdOK Government ID check
        * @return faceOK Face verification
        * @return livenessOK Liveness verification
        */
        function decodeFlags(uint256 _statusBits)
            external
            pure
            returns (
                bool ageNatOK,
                bool govtIdOK,
                bool faceOK,
                bool livenessOK
            )
        {
            ageNatOK = (_statusBits & 1) != 0;
            govtIdOK = (_statusBits & 2) != 0;
            faceOK = (_statusBits & 4) != 0;
            livenessOK = (_statusBits & 8) != 0;
        }

        // ==================== ADMIN FUNCTIONS ====================

        /**
        * @dev Update the Groth16Verifier contract address (admin only)
        * @param _newVerifier New verifier contract address
        */
        function setVerifier(address _newVerifier) external {
            require(_newVerifier != address(0), "Invalid verifier address");
            address oldVerifier = address(groth16Verifier);
            groth16Verifier = IGruth16Verifier(_newVerifier);
            emit VerifierUpdated(oldVerifier, _newVerifier);
        }

        /**
        * @dev Get stats about stored proofs
        * @return totalProofs Total number of proofs stored
        * @return uniqueUsers Number of unique users with proofs
        */
        function getStats()
            external
            view
            returns (uint256 totalProofs, uint256 uniqueUsers)
        {
            totalProofs = allProofHashes.length;
            uniqueUsers = totalProofs; // In this simple implementation
            // Note: Actual unique users would require tracking separately
        }
    }
