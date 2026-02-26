export {
  connectWallet,
  disconnectWallet,
  restoreWalletConnection,
  getConnectedAddress,
  getPublicClient,
  getWalletClient,
  getStorageHubClient,
  getPolkadotApi,
  initPolkadotApi,
  disconnectPolkadotApi,
  buildGasTxOpts,
  isWalletConnected,
  isPolkadotApiReady,
} from './clientService';

export {
  connectToMsp,
  getMspClient,
  isMspConnected,
  getMspHealth,
  getMspInfo,
  authenticateUser,
  getValueProps,
  isAuthenticated,
  getUserProfile,
  disconnectMsp,
  clearSession,
  isAuthError,
} from './mspService';

export {
  initializeStorageServices,
  storeKycDataOnDataHaven,
  getKycDataFromDataHaven,
  testBucketAndFileUpload,
  uploadFileToDataHaven,
  getBucketInfo,
  listUserBuckets,
  downloadFileFromDataHaven,
} from './storageService';

export type { StorageResult, KYCDataToStore } from './storageService';

export {
  ZK_STORAGE_ADDRESS,
  ZK_STORAGE_ABI,
  getSepoliaSigner,
  storeProofOnChain,
  getMyProofFromChain,
  buildStorageInput,
  swapPiB,
  transformProofFromReport,
  buildVerifierInput,
} from './contractStorageService';

export type { StorageProofInput, StorageProofResult, StoredProof } from './contractStorageService';
