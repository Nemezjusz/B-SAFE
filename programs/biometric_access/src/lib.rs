use anchor_lang::prelude::*;

declare_id!("8s6t3cCw56UjzijNk31FijSMA6NjESUYqrBNX6MAzceh");

// ============================================================
// Biometric Door Access Control - Solana Program (Anchor)
// ============================================================
// Architecture:
//   - Admin registers doors (DoorAccount)
//   - Admin grants/revokes access rights to users (AccessGrant)
//   - Users authenticate off-chain via fingerprint → fuzzy extractor → keypair
//   - Users call `log_access_attempt` with a cryptographic proof (hash of key + nonce)
//   - The program verifies the proof and records the attempt on-chain
// ============================================================

#[program]
pub mod biometric_access {
    use super::*;

    /// Initialize a new door/room on-chain.
    /// Only the system admin (program authority) can do this.
    pub fn register_door(
        ctx: Context<RegisterDoor>,
        door_id: u64,
        name: String,
        location: String,
    ) -> Result<()> {
        require!(name.len() <= 64, AccessError::StringTooLong);
        require!(location.len() <= 128, AccessError::StringTooLong);

        let door = &mut ctx.accounts.door_account;
        door.door_id = door_id;
        door.name = name;
        door.location = location;
        door.authority = ctx.accounts.authority.key();
        door.is_active = true;
        door.total_accesses = 0;

        emit!(DoorRegistered {
            door_id,
            authority: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Grant a user access to a specific door.
    /// The `biometric_commitment` is a public hash that the user's mobile app
    /// derives from their fingerprint via the fuzzy extractor helper data.
    /// It is stored on-chain so the program can verify it during access.
    pub fn grant_access(
        ctx: Context<GrantAccess>,
        door_id: u64,
        biometric_commitment: [u8; 32], // SHA-256 of the derived biometric key
        expires_at: Option<i64>,        // Unix timestamp, None = permanent
    ) -> Result<()> {
        let grant = &mut ctx.accounts.access_grant;
        grant.user = ctx.accounts.user.key();
        grant.door_id = door_id;
        grant.biometric_commitment = biometric_commitment;
        grant.granted_by = ctx.accounts.authority.key();
        grant.granted_at = Clock::get()?.unix_timestamp;
        grant.expires_at = expires_at;
        grant.is_active = true;
        grant.access_count = 0;

        emit!(AccessGranted {
            user: ctx.accounts.user.key(),
            door_id,
            granted_by: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Revoke a user's access to a door.
    pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
        let grant = &mut ctx.accounts.access_grant;
        require!(grant.is_active, AccessError::AccessAlreadyRevoked);
        grant.is_active = false;

        emit!(AccessRevoked {
            user: grant.user,
            door_id: grant.door_id,
            revoked_by: ctx.accounts.authority.key(),
        });

        Ok(())
    }

    /// Log an access attempt. Called by the user's mobile app after biometric auth.
    ///
    /// The mobile app:
    ///   1. Captures fingerprint
    ///   2. Uses fuzzy extractor Rep() to reconstruct the biometric key K
    ///   3. Computes: proof = SHA-256(K || nonce || door_id || timestamp)
    ///   4. Sends the transaction signed with the user's Solana keypair
    ///      (the keypair itself can be *derived* from K using a KDF)
    ///
    /// The program:
    ///   - Verifies the access grant exists and is active
    ///   - Verifies proof matches: SHA-256(biometric_commitment XOR nonce_hash)
    ///     (simplified — real implementation uses a proper ZKP or signature scheme)
    ///   - Records the attempt on-chain
    pub fn log_access_attempt(
        ctx: Context<LogAccessAttempt>,
        door_id: u64,
        log_index: u64,  // Monotonic counter used as PDA seed; client tracks this
        nonce: [u8; 32],
        proof: [u8; 32], // SHA-256(biometric_commitment XOR nonce)
        granted: bool,   // Result of local biometric verification
    ) -> Result<()> {
        let clock = Clock::get()?;

        // Copy fields needed for validation before taking mutable borrows
        let is_active = ctx.accounts.access_grant.is_active;
        let expires_at = ctx.accounts.access_grant.expires_at;
        let biometric_commitment = ctx.accounts.access_grant.biometric_commitment;

        // Check grant is active
        require!(is_active, AccessError::AccessNotGranted);

        // Check expiry
        if let Some(exp) = expires_at {
            require!(
                clock.unix_timestamp < exp,
                AccessError::AccessExpired
            );
        }

        // Verify proof: proof must equal SHA-256(biometric_commitment XOR nonce)
        let expected_proof = compute_proof(&biometric_commitment, &nonce);
        require!(proof == expected_proof, AccessError::InvalidBiometricProof);

        // Record access log
        let log = &mut ctx.accounts.access_log;
        log.user = ctx.accounts.user.key();
        log.door_id = door_id;
        log.timestamp = clock.unix_timestamp;
        log.nonce = nonce;
        log.granted = granted;
        log.slot = clock.slot;

        // Update counters
        if granted {
            ctx.accounts.door_account.total_accesses += 1;
            ctx.accounts.access_grant.access_count += 1;
        }

        emit!(AccessAttemptLogged {
            user: ctx.accounts.user.key(),
            door_id,
            timestamp: clock.unix_timestamp,
            granted,
        });

        Ok(())
    }

    /// Update door active status (admin only)
    pub fn set_door_active(ctx: Context<UpdateDoor>, is_active: bool) -> Result<()> {
        ctx.accounts.door_account.is_active = is_active;
        Ok(())
    }
}

// ============================================================
// Proof Computation (on-chain helper)
// ============================================================
// Computes SHA-256(commitment XOR nonce) using Solana's syscall
fn compute_proof(commitment: &[u8; 32], nonce: &[u8; 32]) -> [u8; 32] {
    let mut xored = [0u8; 32];
    for i in 0..32 {
        xored[i] = commitment[i] ^ nonce[i];
    }
    // Use Solana's built-in SHA-256
    solana_sha256_hasher::hashv(&[&xored]).to_bytes()
}

// ============================================================
// Account Structs
// ============================================================

#[account]
pub struct DoorAccount {
    pub door_id: u64,
    pub name: String,       // max 64 chars
    pub location: String,   // max 128 chars
    pub authority: Pubkey,
    pub is_active: bool,
    pub total_accesses: u64,
}

#[account]
pub struct AccessGrant {
    pub user: Pubkey,
    pub door_id: u64,
    pub biometric_commitment: [u8; 32],
    pub granted_by: Pubkey,
    pub granted_at: i64,
    pub expires_at: Option<i64>,
    pub is_active: bool,
    pub access_count: u64,
}

#[account]
pub struct AccessLog {
    pub user: Pubkey,
    pub door_id: u64,
    pub timestamp: i64,
    pub nonce: [u8; 32],
    pub granted: bool,
    pub slot: u64,
}

// ============================================================
// Instruction Contexts
// ============================================================

#[derive(Accounts)]
#[instruction(door_id: u64, name: String)]
pub struct RegisterDoor<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 4 + 64 + 4 + 128 + 32 + 1 + 8,
        seeds = [b"door", door_id.to_le_bytes().as_ref()],
        bump
    )]
    pub door_account: Account<'info, DoorAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(door_id: u64)]
pub struct GrantAccess<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 32 + 32 + 8 + 9 + 1 + 8,
        seeds = [b"grant", user.key().as_ref(), door_id.to_le_bytes().as_ref()],
        bump
    )]
    pub access_grant: Account<'info, AccessGrant>,

    /// CHECK: the user receiving access — no signer needed
    pub user: AccountInfo<'info>,

    #[account(
        seeds = [b"door", door_id.to_le_bytes().as_ref()],
        bump,
        constraint = door_account.authority == authority.key() @ AccessError::Unauthorized,
        constraint = door_account.is_active @ AccessError::DoorInactive
    )]
    pub door_account: Account<'info, DoorAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    #[account(
        mut,
        constraint = access_grant.door_id == door_account.door_id,
    )]
    pub access_grant: Account<'info, AccessGrant>,

    #[account(
        constraint = door_account.authority == authority.key() @ AccessError::Unauthorized
    )]
    pub door_account: Account<'info, DoorAccount>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(door_id: u64, log_index: u64)]
pub struct LogAccessAttempt<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 32 + 1 + 8,
        seeds = [b"log", user.key().as_ref(), log_index.to_le_bytes().as_ref()],
        bump
    )]
    pub access_log: Account<'info, AccessLog>,

    #[account(
        mut,
        seeds = [b"grant", user.key().as_ref(), door_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub access_grant: Account<'info, AccessGrant>,

    #[account(
        mut,
        seeds = [b"door", door_id.to_le_bytes().as_ref()],
        bump,
        constraint = door_account.is_active @ AccessError::DoorInactive
    )]
    pub door_account: Account<'info, DoorAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateDoor<'info> {
    #[account(
        mut,
        constraint = door_account.authority == authority.key() @ AccessError::Unauthorized
    )]
    pub door_account: Account<'info, DoorAccount>,
    pub authority: Signer<'info>,
}

// ============================================================
// Events
// ============================================================

#[event]
pub struct DoorRegistered {
    pub door_id: u64,
    pub authority: Pubkey,
}

#[event]
pub struct AccessGranted {
    pub user: Pubkey,
    pub door_id: u64,
    pub granted_by: Pubkey,
}

#[event]
pub struct AccessRevoked {
    pub user: Pubkey,
    pub door_id: u64,
    pub revoked_by: Pubkey,
}

#[event]
pub struct AccessAttemptLogged {
    pub user: Pubkey,
    pub door_id: u64,
    pub timestamp: i64,
    pub granted: bool,
}

// ============================================================
// Errors
// ============================================================

#[error_code]
pub enum AccessError {
    #[msg("String exceeds maximum length")]
    StringTooLong,
    #[msg("Unauthorized: caller is not the door authority")]
    Unauthorized,
    #[msg("Door is inactive")]
    DoorInactive,
    #[msg("Access grant not found or not active")]
    AccessNotGranted,
    #[msg("Access grant has already been revoked")]
    AccessAlreadyRevoked,
    #[msg("Access grant has expired")]
    AccessExpired,
    #[msg("Invalid biometric proof — fingerprint verification failed")]
    InvalidBiometricProof,
}
