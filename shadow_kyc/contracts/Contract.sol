// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UserCredentials {

    struct UserData {
        bytes32 credentialHash;     // hashed password or secret
        string encryptedIpfsHash;   // encrypted CID (not plain)
        bool exists;
    }

    mapping(address => UserData) private users;

    // Access control: who can view encrypted IPFS hash
    mapping(address => mapping(address => bool)) private accessGranted;

    event UserRegistered(address indexed user);
    event AccessGranted(address indexed owner, address indexed viewer);
    event AccessRevoked(address indexed owner, address indexed viewer);
    event IpfsHashUpdated(address indexed user);

    modifier onlyRegistered() {
        require(users[msg.sender].exists, "User not registered");
        _;
    }

    function register(bytes32 _credentialHash, string calldata _encryptedIpfsHash) external {
        require(!users[msg.sender].exists, "Already registered");

        users[msg.sender] = UserData({
            credentialHash: _credentialHash,
            encryptedIpfsHash: _encryptedIpfsHash,
            exists: true
        });

        emit UserRegistered(msg.sender);
    }

    function updateIpfsHash(string calldata _newEncryptedIpfsHash) external onlyRegistered {
        users[msg.sender].encryptedIpfsHash = _newEncryptedIpfsHash;
        emit IpfsHashUpdated(msg.sender);
    }

    function grantAccess(address viewer) external onlyRegistered {
        accessGranted[msg.sender][viewer] = true;
        emit AccessGranted(msg.sender, viewer);
    }

    function revokeAccess(address viewer) external onlyRegistered {
        accessGranted[msg.sender][viewer] = false;
        emit AccessRevoked(msg.sender, viewer);
    }

    function getCredentialHash(address user) external view returns (bytes32) {
        require(users[user].exists, "User not found");
        return users[user].credentialHash;
    }

    function getEncryptedIpfsHash(address user) external view returns (string memory) {
        require(
            msg.sender == user || accessGranted[user][msg.sender],
            "Access denied"
        );
        return users[user].encryptedIpfsHash;
    }
}