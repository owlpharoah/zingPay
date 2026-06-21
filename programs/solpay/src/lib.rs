use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

declare_id!("3mxRLcYoNynggNLDtpe9iZXMBoomYXQQPFHVAapzc3iZ");

// ============================================================
// AUTHORITY
// ============================================================
pub const CLAIM_AUTHORITY: Pubkey = pubkey!("5JWiQfGELyHtntzkiDgs57PGTHgAFQ3D5ia5S6RdJjpz");

// ============================================================
// PROVIDER WALLETS
// ============================================================
pub const PROVIDER_NATIVE: Pubkey = pubkey!("5JWiQfGELyHtntzkiDgs57PGTHgAFQ3D5ia5S6RdJjpz");
pub const PROVIDER_USDC: Pubkey   = pubkey!("DbQYAzzdGajKZPJV4brtGy6d9UWbDEUjpDTeWyxCKrtg");

// ============================================================
// ALLOWED TOKEN MINTS
// ============================================================
pub const USDC_MINT: Pubkey = pubkey!("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
// ============================================================
// MISC
// ============================================================
const ESCROW_EXPIRY_SECONDS: i64 = 72 * 3600;

// ============================================================
// HELPERS
// ============================================================

pub fn is_allowed_mint(mint: &Pubkey) -> bool {
    *mint == USDC_MINT
}

// ============================================================
// PROGRAM
// ============================================================

#[program]
pub mod solpay {
    use super::*;

    // ----------------------------------------------------------
    // NATIVE SOL INSTRUCTIONS (unchanged)
    // ----------------------------------------------------------

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
    pub fn send_direct(ctx: Context<SendDirect>, _phone_hash: [u8; 32], amount: u64) -> Result<()> {
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
    pub fn send_escrow(ctx: Context<SendEscrow>, phone_hash: [u8; 32], amount: u64) -> Result<()> {
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
    pub fn claim_escrow(ctx: Context<ClaimEscrow>, _phone_hash: [u8; 32]) -> Result<()> {
        let escrow = &ctx.accounts.escrow;
        let amount = escrow.amount;

        let escrow_info = ctx.accounts.escrow.to_account_info();
        let claimant_info = ctx.accounts.claimant.to_account_info();

        **escrow_info.try_borrow_mut_lamports()? -= amount;
        **claimant_info.try_borrow_mut_lamports()? += amount;

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

    /// Delete a phone registration. Only the owner can delete their own registry.
    pub fn delete_phone(ctx: Context<DeletePhone>, _phone_hash: [u8; 32]) -> Result<()> {
        msg!("deleted_phone:{}", ctx.accounts.registry.key());
        Ok(())
    }

    // ----------------------------------------------------------
    // SPL TOKEN INSTRUCTIONS
    // ----------------------------------------------------------

    /// Send tokens directly to a registered phone's canonical ATA.
    /// Auto-creates recipient ATA if missing (payer = sender).
    pub fn send_direct_token(
        ctx: Context<SendDirectToken>,
        _phone_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, SolpayError::ZeroAmount);
        require!(
            is_allowed_mint(&ctx.accounts.mint.key()),
            SolpayError::InvalidMint
        );

        let decimals = ctx.accounts.mint.decimals;

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.sender_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_token.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
            decimals,
        )?;

        msg!(
            "direct_transfer_token:{}:{}:{}",
            ctx.accounts.recipient_token.key(),
            amount,
            ctx.accounts.mint.key()
        );
        Ok(())
    }

    /// Send tokens to an unregistered phone.
    /// Creates escrow state PDA + vault ATA owned by that PDA.
    pub fn send_escrow_token(
        ctx: Context<SendEscrowToken>,
        phone_hash: [u8; 32],
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, SolpayError::ZeroAmount);
        require!(
            is_allowed_mint(&ctx.accounts.mint.key()),
            SolpayError::InvalidMint
        );

        let mint_key = ctx.accounts.mint.key();
        let decimals = ctx.accounts.mint.decimals;

        let escrow = &mut ctx.accounts.escrow_token_state;
        escrow.sender = ctx.accounts.sender.key();
        escrow.phone_hash = phone_hash;
        escrow.amount = amount;
        escrow.created_at = Clock::get()?.unix_timestamp;
        escrow.bump = ctx.bumps.escrow_token_state;
        escrow.mint = mint_key;

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.sender_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.escrow_token.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
            decimals,
        )?;

        msg!("escrow_token:{}:{}", escrow.key(), mint_key);
        Ok(())
    }

    /// Claim escrowed tokens. Requires claim_authority co-sign (post-OTP).
    ///
    /// Flow:
    ///   1. Server computes swap_amount_tokens off-chain via Pyth REST API (trusted via claim_authority).
    ///   2. Transfer net tokens (amount - swap_amount_tokens) escrow vault → claimant ATA.
    ///   3. Transfer swap_amount_tokens escrow vault → provider token account.
    ///   4. Transfer SOL (registry_rent + tx4_fee) provider_native → claimant.
    ///   5. Close escrow vault ATA + state PDA, rent → sender.
    pub fn claim_escrow_token(
        ctx: Context<ClaimEscrowToken>,
        _phone_hash: [u8; 32],
        swap_amount_tokens: u64, // server-computed via Pyth REST API, trusted via claim_authority
        tx4_fee: u64,
    ) -> Result<()> {
        require!(
            is_allowed_mint(&ctx.accounts.mint.key()),
            SolpayError::InvalidMint
        );

        let escrow = &ctx.accounts.escrow_token_state;
        let amount = escrow.amount;
        let decimals = ctx.accounts.mint.decimals;

        // On-chain rent for SOL-to-claimant calculation
        let rent = Rent::get()?;
        let registry_rent = rent.minimum_balance(RegistryAccount::LEN);
        let wallet_rent = rent.minimum_balance(0); // claimant wallet must stay rent-exempt after register_phone

        require!(
            amount > swap_amount_tokens,
            SolpayError::InsufficientEscrowAmount
        );

        let net_claimant_tokens = amount
            .checked_sub(swap_amount_tokens)
            .ok_or(error!(SolpayError::MathOverflow))?;

        // SOL claimant needs: registry rent + wallet rent-exemption + tx4 fee
        let sol_to_claimant = registry_rent
            .checked_add(wallet_rent)
            .and_then(|n| n.checked_add(tx4_fee))
            .ok_or(error!(SolpayError::MathOverflow))?;

        // PDA signer seeds
        let sender_key = escrow.sender;
        let phone_hash = escrow.phone_hash;
        let mint_key = escrow.mint;
        let bump = escrow.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"escrow_token",
            sender_key.as_ref(),
            phone_hash.as_ref(),
            mint_key.as_ref(),
            &[bump],
        ]];

        // 1. Escrow vault → claimant ATA (net tokens)
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.claimant_token.to_account_info(),
                    authority: ctx.accounts.escrow_token_state.to_account_info(),
                },
                signer_seeds,
            ),
            net_claimant_tokens,
            decimals,
        )?;

        // 2. Escrow vault → provider token account (swap fee carve-out)
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.provider_token.to_account_info(),
                    authority: ctx.accounts.escrow_token_state.to_account_info(),
                },
                signer_seeds,
            ),
            swap_amount_tokens,
            decimals,
        )?;

        // 3. Provider native → claimant (SOL for registry_rent + tx4_fee)
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.provider_native.to_account_info(),
                    to: ctx.accounts.claimant.to_account_info(),
                },
            ),
            sol_to_claimant,
        )?;

        // 4. Close escrow vault ATA — rent → sender
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_token.to_account_info(),
                    destination: ctx.accounts.sender.to_account_info(),
                    authority: ctx.accounts.escrow_token_state.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        // escrow_token_state closed via `close = sender` constraint.

        msg!(
            "claimed_token:{}:{}:{}",
            ctx.accounts.claimant_token.key(),
            amount,
            mint_key
        );
        Ok(())
    }

    /// Refund expired token escrow. Permissionless — program enforces 72h check.
    /// Closes vault ATA and state PDA, all rent returned to original sender.
    pub fn refund_escrow_token(ctx: Context<RefundEscrowToken>) -> Result<()> {
        let escrow = &ctx.accounts.escrow_token_state;
        let now = Clock::get()?.unix_timestamp;

        require!(
            now > escrow.created_at + ESCROW_EXPIRY_SECONDS,
            SolpayError::NotExpiredYet
        );
        require!(is_allowed_mint(&escrow.mint), SolpayError::InvalidMint);

        let amount = escrow.amount;
        let decimals = ctx.accounts.mint.decimals;

        let sender_key = escrow.sender;
        let phone_hash = escrow.phone_hash;
        let mint_key = escrow.mint;
        let bump = escrow.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"escrow_token",
            sender_key.as_ref(),
            phone_hash.as_ref(),
            mint_key.as_ref(),
            &[bump],
        ]];

        // 1. Escrow vault → sender token account
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.sender_token.to_account_info(),
                    authority: ctx.accounts.escrow_token_state.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            decimals,
        )?;

        // 2. Close escrow vault ATA — rent → sender
        token::close_account(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                CloseAccount {
                    account: ctx.accounts.escrow_token.to_account_info(),
                    destination: ctx.accounts.sender.to_account_info(),
                    authority: ctx.accounts.escrow_token_state.to_account_info(),
                },
                signer_seeds,
            ),
        )?;

        // escrow_token_state closed via `close = sender` constraint.

        msg!("refunded_token:{}:{}:{}", escrow.sender, amount, escrow.mint);
        Ok(())
    }
}

// ============================================================
// ACCOUNT STRUCTS
// ============================================================

#[account]
pub struct RegistryAccount {
    pub owner: Pubkey,
    pub wallet: Pubkey,
    pub bump: u8,
}

impl RegistryAccount {
    pub const LEN: usize = 8 + 32 + 32 + 1;
}

#[account]
pub struct EscrowAccount {
    pub sender: Pubkey,
    pub phone_hash: [u8; 32],
    pub amount: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl EscrowAccount {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct EscrowTokenState {
    pub sender: Pubkey,
    pub phone_hash: [u8; 32],
    pub amount: u64,
    pub created_at: i64,
    pub mint: Pubkey,
    pub bump: u8,
}

impl EscrowTokenState {
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 32 + 1;
}

// ============================================================
// INSTRUCTION CONTEXTS — NATIVE
// ============================================================

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32])]
pub struct RegisterPhone<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(address = CLAIM_AUTHORITY @ SolpayError::Unauthorized)]
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

    /// CHECK: Validated by address constraint — must match registry.wallet
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
    #[account(address = CLAIM_AUTHORITY @ SolpayError::Unauthorized)]
    pub claim_authority: Signer<'info>,

    #[account(mut)]
    pub claimant: Signer<'info>,

    /// CHECK: Validated by escrow.sender
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

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundEscrow<'info> {
    #[account(mut, close = sender)]
    pub escrow: Account<'info, EscrowAccount>,

    /// CHECK: Validated by escrow.sender
    #[account(
        mut,
        address = escrow.sender @ SolpayError::InvalidSender
    )]
    pub sender: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32])]
pub struct DeletePhone<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"registry", phone_hash.as_ref()],
        bump = registry.bump,
        close = owner,
        constraint = registry.owner == owner.key() @ SolpayError::Unauthorized,
    )]
    pub registry: Account<'info, RegistryAccount>,

    pub system_program: Program<'info, System>,
}

// ============================================================
// INSTRUCTION CONTEXTS — TOKEN
// ============================================================

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32], amount: u64)]
pub struct SendDirectToken<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        seeds = [b"registry", phone_hash.as_ref()],
        bump = registry.bump,
    )]
    pub registry: Account<'info, RegistryAccount>,

    /// Mint — used for allowlist check, decimals, and ATA derivation
    pub mint: Account<'info, Mint>,

    /// Sender's token account
    #[account(
        mut,
        token::mint = mint,
        token::authority = sender,
        token::token_program = token_program,
    )]
    pub sender_token: Account<'info, TokenAccount>,

    /// Recipient's wallet — must match registry.wallet
    /// CHECK: Validated by address constraint against registry.wallet
    #[account(address = registry.wallet @ SolpayError::InvalidRecipient)]
    pub recipient_wallet: UncheckedAccount<'info>,

    /// Recipient's canonical ATA — auto-created if missing, payer = sender
    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = recipient_wallet,
        associated_token::token_program = token_program,
    )]
    pub recipient_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32], amount: u64)]
pub struct SendEscrowToken<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    /// Mint — allowlist check, decimals, ATA derivation
    pub mint: Account<'info, Mint>,

    /// Sender's token account (source)
    #[account(
        mut,
        token::mint = mint,
        token::authority = sender,
        token::token_program = token_program,
    )]
    pub sender_token: Account<'info, TokenAccount>,

    /// Escrow state PDA — created here, acts as authority over escrow_token
    #[account(
        init,
        payer = sender,
        space = EscrowTokenState::LEN,
        seeds = [b"escrow_token", sender.key().as_ref(), phone_hash.as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub escrow_token_state: Account<'info, EscrowTokenState>,

    /// Escrow vault ATA — created here, owned by escrow_token_state PDA
    #[account(
        init,
        payer = sender,
        associated_token::mint = mint,
        associated_token::authority = escrow_token_state,
        associated_token::token_program = token_program,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(phone_hash: [u8; 32])]
pub struct ClaimEscrowToken<'info> {
    /// OTP verification co-signer
    #[account(address = CLAIM_AUTHORITY @ SolpayError::Unauthorized)]
    pub claim_authority: Signer<'info>,

    /// New claimant — must sign to receive tokens and SOL
    #[account(mut)]
    pub claimant: Signer<'info>,

    /// Original sender — receives rent from both closed accounts
    /// CHECK: Validated by escrow_token_state.sender
    #[account(
        mut,
        address = escrow_token_state.sender @ SolpayError::InvalidSender
    )]
    pub sender: UncheckedAccount<'info>,

    /// Escrow state PDA — closed here, rent → sender
    #[account(
        mut,
        seeds = [
            b"escrow_token",
            escrow_token_state.sender.as_ref(),
            phone_hash.as_ref(),
            escrow_token_state.mint.as_ref(),
        ],
        bump = escrow_token_state.bump,
        close = sender,
    )]
    pub escrow_token_state: Account<'info, EscrowTokenState>,

    /// Mint — decimals + allowlist check
    #[account(address = escrow_token_state.mint)]
    pub mint: Account<'info, Mint>,

    /// Escrow vault ATA — source, closed in instruction body, rent → sender
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_token_state,
        associated_token::token_program = token_program,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    /// Claimant's canonical ATA — created here if missing, payer = provider_native
    #[account(
        init_if_needed,
        payer = provider_native,
        associated_token::mint = mint,
        associated_token::authority = claimant,
        associated_token::token_program = token_program,
    )]
    pub claimant_token: Account<'info, TokenAccount>,

    /// Provider USDC token account — receives swap fee carve-out
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
    )]
    pub provider_token: Account<'info, TokenAccount>,

    /// Provider native wallet — sends SOL to claimant
    #[account(
        mut,
        address = PROVIDER_NATIVE @ SolpayError::Unauthorized
    )]
    pub provider_native: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RefundEscrowToken<'info> {
    /// Anyone can call — pays tx fee
    #[account(mut)]
    pub payer: Signer<'info>,

    /// Original sender — receives tokens + all rent
    /// CHECK: Validated by escrow_token_state.sender
    #[account(
        mut,
        address = escrow_token_state.sender @ SolpayError::InvalidSender
    )]
    pub sender: UncheckedAccount<'info>,

    /// Escrow state PDA — closed here, rent → sender
    #[account(
        mut,
        seeds = [
            b"escrow_token",
            escrow_token_state.sender.as_ref(),
            escrow_token_state.phone_hash.as_ref(),
            escrow_token_state.mint.as_ref(),
        ],
        bump = escrow_token_state.bump,
        close = sender,
    )]
    pub escrow_token_state: Account<'info, EscrowTokenState>,

    /// Mint — decimals
    #[account(address = escrow_token_state.mint)]
    pub mint: Account<'info, Mint>,

    /// Escrow vault ATA — source, closed in instruction body, rent → sender
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = escrow_token_state,
        associated_token::token_program = token_program,
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    /// Sender's canonical ATA — receives refunded tokens
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = sender,
        associated_token::token_program = token_program,
    )]
    pub sender_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// ============================================================
// ERRORS
// ============================================================

#[error_code]
pub enum SolpayError {
    #[msg("Unauthorized: invalid claim authority or provider")]
    Unauthorized,
    #[msg("Escrow has not expired yet (72h)")]
    NotExpiredYet,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Invalid sender account")]
    InvalidSender,
    #[msg("Recipient wallet does not match registry")]
    InvalidRecipient,
    #[msg("Token mint not allowed (must be USDC)")]
    InvalidMint,
    #[msg("Math overflow in calculation")]
    MathOverflow,
    #[msg("Escrow amount too small to cover swap fees")]
    InsufficientEscrowAmount,
}
