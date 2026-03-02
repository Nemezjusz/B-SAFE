# B-SAFE — Biometric Solana-based Access Framework with Fuzzy Extractors

This work is part of my master’s thesis at AGH University of Science and Technology

A decentralized biometric access control system built on Solana using fuzzy extractors and zero-knowledge proofs. Users authenticate with their biometric data (fingerprint/face) without ever revealing it to the blockchain or any central authority.

---

## 🏗️ Architecture

### How This Works in Web2 (Traditional Approach)

In a typical Web2 biometric access system:

1. **Centralized Database** — All biometric templates are stored in a central server/database
2. **Single Point of Failure** — If the database is breached, all biometric data is compromised
3. **Trust Required** — Users must trust the organization to:
   - Store their biometric data securely
   - Not misuse or sell their data
   - Properly delete data when requested
4. **No Auditability** — Access logs can be modified or deleted by admins
5. **Vendor Lock-in** — Switching providers requires migrating sensitive biometric data

**Flow:**
```
User scans fingerprint → Sent to server → Server compares with stored template
→ Server grants/denies access → Logs stored in private database
```

### How This Works on Solana (Decentralized Approach)

B-SAFE eliminates centralized trust using blockchain and cryptographic commitments:

1. **Fuzzy Extractor** — Converts noisy biometric data (fingerprint/face) into a stable 32-byte cryptographic key
   - Same biometric → same key (even with slight variations)
   - Different biometric → completely different key
   
2. **Commitment Scheme** — User creates a cryptographic commitment to their biometric key:
   ```
   commitment = SHA-256(biometric_key || "biometric-commitment")
   ```
   - Commitment is stored on-chain (public)
   - Original biometric key never leaves the user's device
   
3. **Zero-Knowledge Proof** — During access attempt:
   ```
   proof = SHA-256(commitment XOR nonce)
   ```
   - User proves they know the biometric key without revealing it
   - On-chain program verifies the proof matches the stored commitment
   
4. **Immutable Audit Trail** — All access attempts are logged on-chain:
   - Cannot be deleted or modified
   - Publicly auditable
   - Timestamped with blockchain slot

**Flow:**
```
User enrollment:
  Device: biometric → fuzzy_extractor → key → commitment
  Admin: stores commitment on-chain (not the biometric!)

Access attempt:
  Device: biometric → fuzzy_extractor → key → generates proof
  Blockchain: verifies proof against commitment → grants/denies
  Blockchain: logs attempt immutably
```

### Key Differences

| Aspect | Web2 | Solana (B-SAFE) |
|--------|------|-----------------|
| **Biometric Storage** | Centralized database | Never stored (only commitment) |
| **Trust Model** | Trust the company | Trustless (cryptography + blockchain) |
| **Data Breach Risk** | High (single point of failure) | Low (no biometric data on-chain) |
| **Auditability** | Private, mutable logs | Public, immutable logs |
| **Censorship Resistance** | Admin can revoke arbitrarily | On-chain rules enforced by code |
| **Privacy** | Company sees all data | Zero-knowledge (biometric never revealed) |
| **Vendor Lock-in** | High | Low (open protocol) |

---

## ⚖️ Tradeoffs & Constraints

### Advantages 

- **Privacy-Preserving** — Biometric data never leaves the user's device
- **Decentralized** — No single point of failure or control
- **Immutable Audit Trail** — All access logs are permanent and publicly verifiable
- **Transparent** — Access rules are enforced by open-source smart contracts
- **Censorship-Resistant** — No central authority can arbitrarily deny access
- **Interoperable** — Standard Solana accounts work across all apps

### Limitations 

1. **Fuzzy Extractor Dependency**
   - Requires high-quality biometric sensors for consistent key extraction
   - Environmental factors (lighting, finger moisture) can affect reliability
   - Current implementation is a placeholder — production needs battle-tested fuzzy extractor library

2. **Device Security**
   - User's device must securely store the derived keypair
   - Compromised device = compromised access (same as losing a physical key)
   - Requires secure enclave/TEE for production (iOS Secure Enclave, Android StrongBox)

3. **Transaction Costs**
   - Each access attempt costs ~0.000005 SOL 
   - Acceptable for high-security doors, may be expensive for high-frequency access
   - Mitigation: batch access logs or use state compression

4. **Latency**
   - Blockchain confirmation takes ~400-600ms (Solana block time)
   - Slower than centralized database (<50ms)

5. **Key Management**
   - Users must back up their derived keypair (seed phrase)
   - Lost biometric key = lost access (no "forgot password" recovery)
   - Mitigation: multi-factor recovery mechanisms (social recovery, time-locked admin override)

6. **Scalability**
   - On-chain storage costs grow linearly with users and logs
   - Current design: ~200 bytes per grant, ~100 bytes per log
   - Mitigation: use Solana state compression for logs (1000x cheaper)

7. **Regulatory Compliance**
   - GDPR "right to be forgotten" conflicts with immutable blockchain
   - Mitigation: only store cryptographic commitments (not personal data)
   - May still face legal challenges in some jurisdictions

8. **Biometric Revocation**
   - If biometric is compromised (e.g., fingerprint copied), cannot "change" it
   - Traditional passwords can be reset; biometrics cannot
   - Mitigation: multi-factor authentication, time-limited grants

### When to Use B-SAFE

**Good fit:**
- High-security facilities (data centers, labs, vaults)
- Transparent access control (government buildings, shared spaces)
- Decentralized organizations (DAOs managing physical spaces)
- Audit-critical environments (compliance, forensics)

**Poor fit:**
- High-frequency access (subway turnstiles, office buildings with 1000+ daily entries)
- Low-security scenarios (gym lockers, shared bikes)
- Environments with unreliable internet connectivity
- Jurisdictions with strict biometric data regulations

---

## 🚀 Setup Instructions

### Prerequisites

- **Rust** 1.70+ — [Install Rust](https://rustup.rs/)
- **Solana CLI** 1.18+ — [Install Solana](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor** 0.32.1 — Install with `cargo install --git https://github.com/coral-xyz/anchor avm --locked && avm install 0.32.1 && avm use 0.32.1`
- **Node.js** 18+ — [Install Node](https://nodejs.org/)
- **Yarn** — `npm install -g yarn`

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd biometric_access

# Install Node dependencies
yarn install

# Install web app dependencies
cd app && npm install && cd ..
```

### 2. Build the Solana Program

```bash
anchor build
```

This generates:
- Program binary: `target/deploy/biometric_access.so`
- IDL: `target/idl/biometric_access.json`
- Program ID in `target/deploy/biometric_access-keypair.json`

### 3. Local Testing (Recommended for Development)

#### Start Local Validator

```bash
solana-test-validator
```

Keep this running in a separate terminal.

#### Deploy to Local Validator

```bash
anchor deploy
```

Note the deployed **Program ID** (e.g., `8s6t3cCw56UjzijNk31FijSMA6NjESUYqrBNX6MAzceh`).

#### Update Program ID in Code

If the program ID changed, update it in:
- `programs/biometric_access/src/lib.rs` — `declare_id!("YOUR_PROGRAM_ID")`
- `Anchor.toml` — `[programs.localnet]` section
- `app/src/program.ts` — `export const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID")`
- `scripts/config.ts` — `export const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID")`

Then rebuild: `anchor build && anchor deploy`

#### Run Tests

```bash
anchor test --skip-local-validator
```

### 4. Using the CLI Scripts

The `scripts/` folder contains TypeScript scripts for admin operations:

#### Register a Door

Edit `scripts/register-door.ts` (bottom of file):
```typescript
registerDoor(1, "Server Room A", "Building A, Floor 2").catch(console.error);
```

Run:
```bash
npx ts-node scripts/register-door.ts
```

#### Grant Access to a User

Edit `scripts/grant-access.ts`:
```typescript
grantAccess(
  1,                                    // door ID
  "USER_PUBLIC_KEY_BASE58",            // from user's mobile app
  "a3f1bc2d...",                       // 64-char hex commitment from user
  90                                    // expires in 90 days (or undefined for permanent)
).catch(console.error);
```

Run:
```bash
npx ts-node scripts/grant-access.ts
```

#### Revoke Access

Edit `scripts/revoke-access.ts`:
```typescript
revokeAccess(1, "USER_PUBLIC_KEY_BASE58").catch(console.error);
```

Run:
```bash
npx ts-node scripts/revoke-access.ts
```

#### List All Doors and Grants

```bash
npx ts-node scripts/list-doors.ts
```

#### Query Access Logs

```bash
npx ts-node scripts/query-logs.ts
```

### 5. Using the Web Dashboard

#### Start the Dev Server

```bash
cd app
npm run dev
```

Open **http://localhost:5173/** in your browser.

#### Connect Your Wallet

1. Install [Phantom](https://phantom.app/) or [Backpack](https://backpack.app/) wallet extension
2. Import your local keypair:
   ```bash
   cat ~/.config/solana/id.json
   ```
   Copy the JSON array and import it into Phantom (Settings → Import Private Key)
3. Switch Phantom to **Localhost** network (Settings → Developer Settings → Change Network → Localhost)
4. Click **Connect Wallet** in the top-right of the web app

#### Use the Dashboard

- **Doors** page — View all registered doors (public, no wallet needed)
- **History** page — View all access logs (public, no wallet needed)
- **Admin** page — Register doors, grant/revoke access (requires connected wallet)

### 6. Devnet Deployment (Optional)

#### Configure Devnet

```bash
solana config set --url devnet
```

#### Airdrop SOL for Deployment

```bash
solana airdrop 2
```

#### Deploy to Devnet

```bash
anchor deploy --provider.cluster devnet
```

#### Update Configuration

In `app/src/program.ts`, change:
```typescript
export const CONNECTION = new Connection("https://api.devnet.solana.com", "confirmed");
```

In `scripts/config.ts`, set:
```bash
export CLUSTER=devnet
```

Switch your wallet to **Devnet** in Phantom settings.

---

## 📁 Project Structure

```
biometric_access/
├── programs/
│   └── biometric_access/
│       ├── src/
│       │   └── lib.rs              # Solana program (smart contract)
│       └── Cargo.toml
├── scripts/
│   ├── config.ts                   # Shared config (program ID, RPC, PDAs)
│   ├── biometric-access.ts         # SDK for admin and user operations
│   ├── register-door.ts            # CLI: register a door
│   ├── grant-access.ts             # CLI: grant user access
│   ├── revoke-access.ts            # CLI: revoke user access
│   ├── list-doors.ts               # CLI: list all doors and grants
│   └── query-logs.ts               # CLI: query access logs
├── app/                            # Web dashboard (React + Vite)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DoorsPage.tsx       # Public: view all doors
│   │   │   ├── HistoryPage.tsx     # Public: view access logs
│   │   │   └── AdminPage.tsx       # Admin: register doors, grant/revoke
│   │   ├── program.ts              # Solana program integration
│   │   ├── WalletProvider.tsx      # Wallet adapter setup
│   │   └── App.tsx                 # Main app with routing
│   └── package.json
├── tests/
│   └── biometric_access.js         # Anchor tests
├── Anchor.toml                     # Anchor configuration
└── README.md                       # This file
```

---

## 🔐 Security Considerations

### Current Implementation (Prototype)

1. **Production-Grade Fuzzy Extractor**
   - Current implementation uses a placeholder
   - Use battle-tested libraries like [Fuzzy Extractors](https://eprint.iacr.org/2003/235.pdf) with error correction
   - Integrate with hardware secure enclaves (iOS Secure Enclave, Android StrongBox)

2. **Secure Key Storage**
   - Store derived keypairs in device secure storage (Keychain, Keystore)
   - Never log or transmit the biometric key
   - Implement key rotation mechanisms

3. **Replay Attack Prevention**
   - Current nonce is client-generated (vulnerable to replay)
   - Production: use on-chain nonce or timestamp validation
   - Implement challenge-response protocol

4. **Rate Limiting**
   - Add on-chain rate limiting to prevent brute-force attacks
   - Implement exponential backoff for failed attempts
   - Consider account-level throttling

5. **Multi-Factor Authentication**
   - Combine biometric with additional factors (PIN, hardware token)
   - Implement social recovery for lost biometric keys
   - Add time-locked admin override for emergencies

6. **Audit and Penetration Testing**
   - Full security audit by reputable firm
   - Penetration testing of mobile app and smart contract
   - Bug bounty program

### Threat Model

**Protected against:**
- Centralized database breaches
- Admin tampering with access logs
- Unauthorized access without valid biometric
- Biometric data leakage (never stored)

**Vulnerable to:**
- Device compromise (malware stealing keypair)
- Sophisticated biometric spoofing (3D-printed fingerprints)
- Physical coercion (forcing user to authenticate)
- Quantum computing (future threat to SHA-256)

---

## 🧪 Testing

### Unit Tests

```bash
anchor test
```

### Integration Tests

```bash
# Start local validator
solana-test-validator

# Run tests
anchor test --skip-local-validator
```

### Manual Testing Flow

1. Register a door: `npx ts-node scripts/register-door.ts`
2. Generate a test user keypair:
   ```bash
   solana-keygen new --outfile test-user.json
   ```
3. Get user public key:
   ```bash
   solana-keygen pubkey test-user.json
   ```
4. Generate mock biometric commitment:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. Grant access: Edit `scripts/grant-access.ts` with user pubkey and commitment
6. View in dashboard: Open http://localhost:5173/



