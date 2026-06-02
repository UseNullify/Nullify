//! Nullify shielded pool for Solana (SVM).
//!
//! STATUS: WORK IN PROGRESS — testnet scaffold only.
//! The account model and instruction surface mirror the EVM pool, but the
//! Groth16 proof verification and the on-chain incremental Merkle tree are
//! NOT yet implemented. Do not deploy to mainnet.
use anchor_lang::prelude::*;

declare_id!("Nu11ify1111111111111111111111111111111111111");

#[program]
pub mod nullify_solana {
    use super::*;

    /// Initialise a fixed-denomination pool.
    pub fn initialize(ctx: Context<Initialize>, denomination: u64, levels: u8) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.denomination = denomination;
        pool.levels = levels;
        pool.next_index = 0;
        // TODO: precompute zero subtrees, set initial root
        Ok(())
    }

    /// Deposit `denomination` lamports and insert `commitment` as a leaf.
    pub fn deposit(_ctx: Context<Deposit>, _commitment: [u8; 32]) -> Result<()> {
        // TODO: transfer lamports into the pool vault
        // TODO: insert commitment into the incremental Merkle tree, push new root
        err!(NullifyError::NotImplemented)
    }

    /// Withdraw after verifying a Groth16 proof; marks the nullifier spent.
    pub fn withdraw(
        _ctx: Context<Withdraw>,
        _proof: Vec<u8>,
        _root: [u8; 32],
        _nullifier_hash: [u8; 32],
        _fee: u64,
    ) -> Result<()> {
        // TODO: groth16-solana verify(proof, public_inputs)
        // TODO: check root known/attested, reject spent nullifier
        // TODO: pay recipient (denomination - fee), pay relayer fee
        err!(NullifyError::NotImplemented)
    }
}

#[account]
pub struct Pool {
    pub authority: Pubkey,
    pub denomination: u64,
    pub levels: u8,
    pub next_index: u32,
    pub current_root: [u8; 32],
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + 32 + 8 + 1 + 4 + 32)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: recipient receives lamports; validated against proof public inputs
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
}

#[error_code]
pub enum NullifyError {
    #[msg("not implemented yet (WIP scaffold)")]
    NotImplemented,
}
