use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("DJBNMKMALGKKncXBPvy9NDeFactR5pgJ6bpU3qbMEddm");

pub const CLAIM_AUTHORITY: Pubkey = pubkey!("Ga5Xonhi7vWhhgmRcBbdRCeeVM5PCu1FiEThf6BEGt1x");

const ESCROW_EXPIRY_SECONDS: i64 = 72 * 3600;

#[program]
pub mod solpay {
    use super::*;

    /// Register a phone number to a wallet. Requires claim_authority co-sign (post-OTP).
    pub fn register_phone(
        ctx: Context<RegisterPhone>,
        _phone_hash: [u8; 32],
        wallet_pubkey: Pubkey,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.owner = ctx.accounts.owner.key();
        registry.wallet = wallet_pubkey;
        registry.bump = ctx.bumps.registry;
        msg!("registered:{}", registry.key());
        Ok(())
    }

    /// Send SOL directly to a registered phone's wallet.
    pub fn send_direct(
        ctx: Context<SendDirect>,
        _phone_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, SolpayError::ZeroAmount);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.sender.to_account_info(),
                    to: ctx.accounts.recipient_wallet.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!(
            "direct_transfer:{}:{}",
            ctx.accounts.registry.wallet,
            amount
        );
        Ok(())
    }

    /// Send SOL to an unregistered phone. Creates escrow for them to claim.
    pub fn send_escrow(
        ctx: Context<SendEscrow>,
        phone_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, SolpayError::ZeroAmount);

        let escrow = &mut ctx.accounts.escrow;
        escrow.sender = ctx.accounts.sender.key();
        escrow.phone_hash = phone_hash;
        escrow.amount = amount;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.bump = ctx.bumps.escrow;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.sender.to_account_info(),
                    to: escrow.to_account_info(),
                },
            ),
            amount,
        )?;

        msg!("escrow:{}", escrow.key());
        Ok(())
    }

    /// Claim escrowed SOL. Requires claim_authority co-sign (post-OTP).
    /// Also auto-registers the phone for future direct transfers.
    pub fn claim_escrow(
        ctx: Context<ClaimEscrow>,
        _phone_hash: [u8; 32],
    ) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let amount = escrow.amount;

        // Transfer SOL from escrow to claimant
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let claimant_info = ctx.accounts.claimant.to_account_info();

        **escrow_info.try_borrow_mut_lamports()? -= amount;
        **claimant_info.try_borrow_mut_lamports()? += amount;

        // Auto-register: set up the registry account for this phone
        let registry = &mut ctx.accounts.registry;
        registry.owner = ctx.accounts.claimant.key();
        registry.wallet = ctx.accounts.claimant.key();
        registry.bump = ctx.bumps.registry;

        msg!("claimed:{}:{}", ctx.accounts.claimant.key(), amount);
        Ok(())
    }

    /// Refund expired escrow. Permissionless — anyone can call, program enforces 72h check.
    pub fn refund_escrow(ctx: Context<RefundEscrow>) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let now = Clock::get()?.unix_timestamp;

        require!(
            now > escrow.created_at + ESCROW_EXPIRY_SECONDS,
            SolpayError::NotExpiredYet
        );

        let amount = escrow.amount;
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let sender_info = ctx.accounts.sender.to_account_info();

        **escrow_info.try_borrow_mut_lamports()? -= amount;
        **sender_info.try_borrow_mut_lamports()? += amount;

        msg!("refunded:{}:{}", escrow.sender, amount);
        Ok(())
    }
}

// ============================================================
// Account structs
// ============================================================

#[account]
pub struct RegistryAccount {
    pub owner: Pubkey,   // who registered
    pub wallet: Pubkey,  // where incoming SOL goes
    pub bump: u8,
}

impl RegistryAccount {
    pub const LEN: usize = 8 + 32 + 32 + 1; // discriminator + fields
}

#[account]
pub struct EscrowAccount {
    pub sender: Pubkey,       // refund target if unclaimed
    pub phone_hash: [u8; 32], // sha256 of receiver phone
    pub amount: u64,          // lamports locked
    pub created_at: i64,      // unix timestamp
    pub bump: u8,
}

impl EscrowAccount {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1; // discriminator + fields
}

// ============================================================
// Instruction contexts
// ============================================================

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32])]
pub struct RegisterPhone<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        address = CLAIM_AUTHORITY @ SolpayError::Unauthorized
    )]
    pub claim_authority: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = RegistryAccount::LEN,
        seeds = [b"registry", phone_hash.as_ref()],
        bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32], amount: u64)]
pub struct SendDirect<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        seeds = [b"registry", phone_hash.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    /// CHECK: Must match registry.wallet — validated below
    #[account(
        mut,
        address = registry.wallet @ SolpayError::InvalidRecipient,
    )]
    pub recipient_wallet: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32], amount: u64)]
pub struct SendEscrow<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        init,
        payer = sender,
        space = EscrowAccount::LEN,
        seeds = [b"escrow", sender.key().as_ref(), phone_hash.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32])]
pub struct ClaimEscrow<'info> {
    #[account(
        address = CLAIM_AUTHORITY @ SolpayError::Unauthorized
    )]
    pub claim_authority: Signer<'info>,

    #[account(mut)]
    pub claimant: Signer<'info>,

    /// CHECK: Original sender, receives rent from closed escrow. Validated by escrow.sender.
    #[account(
        mut,
        address = escrow.sender @ SolpayError::InvalidSender
    )]
    pub sender: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.sender.as_ref(), phone_hash.as_ref()],
        bump = escrow.bump,
        close = sender,
    )]
    pub escrow: Account<'info, EscrowAccount>,

    #[account(
        init,
        payer = claimant,
        space = RegistryAccount::LEN,
        seeds = [b"registry", phone_hash.as_ref()],
        bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(
        mut,
        close = sender,
    )]
    pub escrow: Account<'info, EscrowAccount>,












    /// CHECK: Validated by matching escrow.sender
    #[account(
        mut,
        address = escrow.sender @ SolpayError::InvalidSender
    )]
    pub sender: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================
// Errors
// ============================================================

#[error_code]
pub enum SolpayError {
    #[msg("Unauthorized: invalid claim authority")]
    Unauthorized,
    #[msg("Escrow has not expired yet (72h)")]
    NotExpiredYet,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Invalid sender account")]
    InvalidSender,
    #[msg("Recipient wallet does not match registry")]
    InvalidRecipient,
}
