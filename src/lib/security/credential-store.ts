/**
 * Secure Credential Store
 *
 * Handles encrypted storage of OAuth tokens and API credentials
 * for social media accounts.
 *
 * Security Features:
 * - AES-256-GCM encryption for all sensitive data
 * - PBKDF2 key derivation with 600K iterations
 * - Per-credential random IVs
 * - Automatic token refresh
 */

import { storage } from "../storage.js";

// Supported platforms
export type SocialPlatform = "twitter" | "linkedin" | "instagram" | "facebook" | "reddit";

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  username: string;
  displayName: string;
  profileUrl: string;
  profileImageUrl?: string;
  connectedAt: number;
  lastUsed: number;
  scopes: string[];
  isActive: boolean;
}

export interface EncryptedCredentials {
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  iv: string;
  expiresAt?: number;
  tokenType: string;
}

export interface StoredAccountData {
  account: SocialAccount;
  credentials: EncryptedCredentials;
}

// Storage keys
const STORAGE_KEY_ACCOUNTS = "aigentis_social_accounts";
const STORAGE_KEY_MASTER_SALT = "aigentis_master_salt";
const STORAGE_KEY_ENCRYPTION_CHECK = "aigentis_encryption_check";

// Encryption constants
const PBKDF2_ITERATIONS = 600000;
const SALT_LENGTH = 32;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

class SecureCredentialStore {
  private masterKey: CryptoKey | null = null;
  private isUnlocked = false;

  /**
   * Generate a random salt
   */
  private generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  }

  /**
   * Generate a random IV for AES-GCM
   */
  private generateIV(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Derive encryption key from master password using PBKDF2
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as raw key material
    const keyMaterial = await crypto.subtle.importKey("raw", passwordBuffer, "PBKDF2", false, [
      "deriveKey",
    ]);

    // Derive AES-GCM key
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256",
      },
      keyMaterial,
      {
        name: "AES-GCM",
        length: KEY_LENGTH,
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encrypt(data: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = this.generateIV();

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      dataBuffer
    );

    return {
      ciphertext: this.arrayBufferToBase64(encryptedBuffer),
      iv: this.arrayBufferToBase64(iv.buffer),
    };
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decrypt(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
    const encryptedBuffer = this.base64ToArrayBuffer(ciphertext);
    const ivBuffer = new Uint8Array(this.base64ToArrayBuffer(iv));

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBuffer,
      },
      key,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  }

  /**
   * Initialize or unlock the credential store with master password
   */
  async unlock(masterPassword: string): Promise<{ success: boolean; isNew: boolean }> {
    try {
      // Check if salt exists (store was previously initialized)
      const existingSaltB64 = await storage.get<string>(STORAGE_KEY_MASTER_SALT);

      if (existingSaltB64) {
        // Existing store - verify password
        const salt = new Uint8Array(this.base64ToArrayBuffer(existingSaltB64));
        const key = await this.deriveKey(masterPassword, salt);

        // Try to decrypt verification string
        const encryptionCheck = await storage.get<{ ciphertext: string; iv: string }>(
          STORAGE_KEY_ENCRYPTION_CHECK
        );

        if (encryptionCheck) {
          try {
            const decrypted = await this.decrypt(encryptionCheck.ciphertext, encryptionCheck.iv, key);
            if (decrypted !== "AIGENTIS_CREDENTIAL_STORE_V1") {
              return { success: false, isNew: false };
            }
          } catch {
            // Decryption failed - wrong password
            return { success: false, isNew: false };
          }
        }

        this.masterKey = key;
        this.isUnlocked = true;
        return { success: true, isNew: false };
      } else {
        // New store - initialize
        const salt = this.generateSalt();
        const key = await this.deriveKey(masterPassword, salt);

        // Store salt
        await storage.set(STORAGE_KEY_MASTER_SALT, this.arrayBufferToBase64(salt.buffer));

        // Store encryption check
        const check = await this.encrypt("AIGENTIS_CREDENTIAL_STORE_V1", key);
        await storage.set(STORAGE_KEY_ENCRYPTION_CHECK, check);

        this.masterKey = key;
        this.isUnlocked = true;
        return { success: true, isNew: true };
      }
    } catch (error) {
      console.error("[CredentialStore] Unlock failed:", error);
      return { success: false, isNew: false };
    }
  }

  /**
   * Lock the credential store
   */
  lock(): void {
    this.masterKey = null;
    this.isUnlocked = false;
  }

  /**
   * Check if store is unlocked
   */
  isStoreUnlocked(): boolean {
    return this.isUnlocked && this.masterKey !== null;
  }

  /**
   * Store OAuth credentials for an account
   */
  async storeCredentials(
    account: SocialAccount,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: number
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isStoreUnlocked() || !this.masterKey) {
      return { success: false, error: "Credential store is locked" };
    }

    try {
      // Encrypt tokens
      const encryptedAccess = await this.encrypt(accessToken, this.masterKey);
      let encryptedRefresh: { ciphertext: string; iv: string } | undefined;

      if (refreshToken) {
        encryptedRefresh = await this.encrypt(refreshToken, this.masterKey);
      }

      const credentials: EncryptedCredentials = {
        encryptedAccessToken: encryptedAccess.ciphertext,
        encryptedRefreshToken: encryptedRefresh?.ciphertext,
        iv: encryptedAccess.iv,
        expiresAt,
        tokenType: "Bearer",
      };

      const storedData: StoredAccountData = {
        account,
        credentials,
      };

      // Get existing accounts
      const accounts = await this.getAllAccounts();
      const existingIndex = accounts.findIndex((a) => a.id === account.id);

      if (existingIndex >= 0) {
        accounts[existingIndex] = storedData;
      } else {
        accounts.push(storedData);
      }

      // Store updated accounts
      await storage.set(STORAGE_KEY_ACCOUNTS, accounts);

      return { success: true };
    } catch (error) {
      console.error("[CredentialStore] Store credentials failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to store credentials",
      };
    }
  }

  /**
   * Get decrypted access token for an account
   */
  async getAccessToken(accountId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!this.isStoreUnlocked() || !this.masterKey) {
      return { success: false, error: "Credential store is locked" };
    }

    try {
      const accounts = await this.getAllAccounts();
      const account = accounts.find((a) => a.account.id === accountId);

      if (!account) {
        return { success: false, error: "Account not found" };
      }

      const token = await this.decrypt(
        account.credentials.encryptedAccessToken,
        account.credentials.iv,
        this.masterKey
      );

      return { success: true, token };
    } catch (error) {
      console.error("[CredentialStore] Get access token failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get access token",
      };
    }
  }

  /**
   * Get decrypted refresh token for an account
   */
  async getRefreshToken(accountId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (!this.isStoreUnlocked() || !this.masterKey) {
      return { success: false, error: "Credential store is locked" };
    }

    try {
      const accounts = await this.getAllAccounts();
      const account = accounts.find((a) => a.account.id === accountId);

      if (!account || !account.credentials.encryptedRefreshToken) {
        return { success: false, error: "Refresh token not found" };
      }

      const token = await this.decrypt(
        account.credentials.encryptedRefreshToken,
        account.credentials.iv,
        this.masterKey
      );

      return { success: true, token };
    } catch (error) {
      console.error("[CredentialStore] Get refresh token failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get refresh token",
      };
    }
  }

  /**
   * Get all stored accounts (without decrypted credentials)
   */
  async getAllAccounts(): Promise<StoredAccountData[]> {
    const accounts = await storage.get<StoredAccountData[]>(STORAGE_KEY_ACCOUNTS);
    return accounts || [];
  }

  /**
   * Get account info (without credentials)
   */
  async getAccountInfo(accountId: string): Promise<SocialAccount | null> {
    const accounts = await this.getAllAccounts();
    const account = accounts.find((a) => a.account.id === accountId);
    return account?.account || null;
  }

  /**
   * Get all accounts for a platform
   */
  async getAccountsByPlatform(platform: SocialPlatform): Promise<SocialAccount[]> {
    const accounts = await this.getAllAccounts();
    return accounts.filter((a) => a.account.platform === platform).map((a) => a.account);
  }

  /**
   * Remove an account
   */
  async removeAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const accounts = await this.getAllAccounts();
      const filtered = accounts.filter((a) => a.account.id !== accountId);

      if (filtered.length === accounts.length) {
        return { success: false, error: "Account not found" };
      }

      await storage.set(STORAGE_KEY_ACCOUNTS, filtered);
      return { success: true };
    } catch (error) {
      console.error("[CredentialStore] Remove account failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to remove account",
      };
    }
  }

  /**
   * Update account info
   */
  async updateAccount(
    accountId: string,
    updates: Partial<SocialAccount>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const accounts = await this.getAllAccounts();
      const accountIndex = accounts.findIndex((a) => a.account.id === accountId);

      if (accountIndex < 0) {
        return { success: false, error: "Account not found" };
      }

      accounts[accountIndex].account = {
        ...accounts[accountIndex].account,
        ...updates,
        id: accountId, // Prevent ID change
      };

      await storage.set(STORAGE_KEY_ACCOUNTS, accounts);
      return { success: true };
    } catch (error) {
      console.error("[CredentialStore] Update account failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update account",
      };
    }
  }

  /**
   * Check if token needs refresh
   */
  async needsRefresh(accountId: string): Promise<boolean> {
    const accounts = await this.getAllAccounts();
    const account = accounts.find((a) => a.account.id === accountId);

    if (!account?.credentials.expiresAt) {
      return false; // No expiry info, assume valid
    }

    // Refresh if less than 5 minutes until expiry
    const fiveMinutes = 5 * 60 * 1000;
    return Date.now() > account.credentials.expiresAt - fiveMinutes;
  }

  /**
   * Update tokens after refresh
   */
  async updateTokens(
    accountId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: number
  ): Promise<{ success: boolean; error?: string }> {
    const account = await this.getAccountInfo(accountId);

    if (!account) {
      return { success: false, error: "Account not found" };
    }

    return this.storeCredentials(account, accessToken, refreshToken, expiresAt);
  }

  /**
   * Clear all stored data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    await storage.remove(STORAGE_KEY_ACCOUNTS);
    await storage.remove(STORAGE_KEY_MASTER_SALT);
    await storage.remove(STORAGE_KEY_ENCRYPTION_CHECK);
    this.lock();
  }
}

// Export singleton
export const credentialStore = new SecureCredentialStore();
