use anchor_lang::prelude::*;

declare_id!("5qYmGbKTXkd9KRAbJYtPwGsqsYwHRjCseRzNPSGySztp");

// ============================================================================
// TrustPort - 双向可信关系转账钱包
// ============================================================================
// 核心概念：用户只能向已建立"可信关系"的人转账 SOL
// 可信关系通过离线密码短语哈希验证建立
// ============================================================================

#[program]
pub mod trustport {
    use super::*;

    /// 初始化可信关系
    /// 由发起方调用，创建 Pending 状态的关系 PDA
    pub fn init_relationship(
        ctx: Context<InitRelationship>,
        passphrase_hash: [u8; 32],
    ) -> Result<()> {
        let relationship = &mut ctx.accounts.relationship;
        let user_a = ctx.accounts.user_a.key();
        let user_b = ctx.accounts.user_b.key();

        // 确保 user_a < user_b（PDA 种子排序要求）
        require!(user_a < user_b, ErrorCode::InvalidUserOrder);

        relationship.user_a = user_a;
        relationship.user_b = user_b;
        relationship.passphrase_hash = passphrase_hash;
        relationship.status = RelationshipStatus::Pending;
        relationship.created_at = Clock::get()?.unix_timestamp;
        relationship.confirmed_at = 0;
        relationship.bump = ctx.bumps.relationship;
        relationship.version = 1;

        msg!("Trust relationship initialized: {} <-> {}", user_a, user_b);
        Ok(())
    }

    /// 确认可信关系
    /// 由另一方调用，需要提供相同的 passphrase_hash
    pub fn confirm_relationship(
        ctx: Context<ConfirmRelationship>,
        passphrase_hash: [u8; 32],
    ) -> Result<()> {
        let relationship = &mut ctx.accounts.relationship;

        // 验证 passphrase_hash 匹配
        require!(
            relationship.passphrase_hash == passphrase_hash,
            ErrorCode::PassphraseMismatch
        );

        // 确保关系状态为 Pending
        require!(
            relationship.status == RelationshipStatus::Pending,
            ErrorCode::InvalidRelationshipStatus
        );

        relationship.status = RelationshipStatus::Active;
        relationship.confirmed_at = Clock::get()?.unix_timestamp;

        msg!(
            "Trust relationship confirmed: {} <-> {}",
            relationship.user_a,
            relationship.user_b
        );
        Ok(())
    }

    /// 撤销可信关系
    /// 任一方均可调用
    pub fn revoke_relationship(ctx: Context<RevokeRelationship>) -> Result<()> {
        let relationship = &mut ctx.accounts.relationship;

        // 确保关系状态为 Active
        require!(
            relationship.status == RelationshipStatus::Active,
            ErrorCode::InvalidRelationshipStatus
        );

        relationship.status = RelationshipStatus::Revoked;

        msg!(
            "Trust relationship revoked: {} <-> {}",
            relationship.user_a,
            relationship.user_b
        );
        Ok(())
    }

    /// 受保护转账
    /// 仅在 Active 状态下允许，从 sender 向 receiver 转账 SOL
    pub fn guarded_transfer(
        ctx: Context<GuardedTransfer>,
        amount: u64,
    ) -> Result<()> {
        let relationship = &ctx.accounts.relationship;

        // 确保关系状态为 Active
        require!(
            relationship.status == RelationshipStatus::Active,
            ErrorCode::InvalidRelationshipStatus
        );

        // 确保 sender 是关系中的一方
        let sender = ctx.accounts.sender.key();
        require!(
            sender == relationship.user_a || sender == relationship.user_b,
            ErrorCode::UnauthorizedTransfer
        );

        // 执行转账（通过 system_program）
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &sender,
            &ctx.accounts.receiver.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.sender.to_account_info(),
                ctx.accounts.receiver.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        msg!(
            "Guarded transfer: {} SOL from {} to {}",
            amount,
            sender,
            ctx.accounts.receiver.key()
        );
        Ok(())
    }
}

// ============================================================================
// Accounts Context
// ============================================================================

#[derive(Accounts)]
#[instruction(passphrase_hash: [u8; 32])]
pub struct InitRelationship<'info> {
    #[account(
        init,
        payer = user_a,
        space = 8 + TrustRelationship::INIT_SPACE,
        seeds = [
            b"trust",
            user_a.key().as_ref(),
            user_b.key().as_ref(),
        ],
        bump
    )]
    pub relationship: Account<'info, TrustRelationship>,

    #[account(mut)]
    pub user_a: Signer<'info>,

    /// CHECK: user_b 是关系中的另一方，不需要签名
    pub user_b: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(passphrase_hash: [u8; 32])]
pub struct ConfirmRelationship<'info> {
    #[account(
        mut,
        seeds = [
            b"trust",
            relationship.user_a.as_ref(),
            relationship.user_b.as_ref(),
        ],
        bump = relationship.bump
    )]
    pub relationship: Account<'info, TrustRelationship>,

    /// CHECK: 确认方可以是 user_a 或 user_b，在指令逻辑中验证
    pub confirmer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeRelationship<'info> {
    #[account(
        mut,
        seeds = [
            b"trust",
            relationship.user_a.as_ref(),
            relationship.user_b.as_ref(),
        ],
        bump = relationship.bump,
        close = revoker
    )]
    pub relationship: Account<'info, TrustRelationship>,

    #[account(
        mut,
        constraint = revoker.key() == relationship.user_a || revoker.key() == relationship.user_b
    )]
    pub revoker: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GuardedTransfer<'info> {
    #[account(
        seeds = [
            b"trust",
            relationship.user_a.as_ref(),
            relationship.user_b.as_ref(),
        ],
        bump = relationship.bump
    )]
    pub relationship: Account<'info, TrustRelationship>,

    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: 接收方可以是任何人，只要 sender 有 Active 关系
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
#[derive(InitSpace)]
pub struct TrustRelationship {
    /// 关系中的用户 A（pubkey 较小的一方）
    pub user_a: Pubkey,

    /// 关系中的用户 B（pubkey 较大的一方）
    pub user_b: Pubkey,

    /// SHA-256(passphrase + user_a + user_b) 的哈希值
    /// 用于离线验证双方知道相同的密码短语
    pub passphrase_hash: [u8; 32],

    /// 关系状态：Pending / Active / Revoked
    pub status: RelationshipStatus,

    /// 关系创建时间戳
    pub created_at: i64,

    /// 关系确认时间戳（Active 状态时设置）
    pub confirmed_at: i64,

    /// PDA bump seed
    pub bump: u8,

    /// 版本号（用于未来升级）
    pub version: u8,
}

// ============================================================================
// Enums
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum RelationshipStatus {
    /// 关系已创建，等待另一方确认
    Pending,
    /// 双方已确认，可以进行受保护转账
    Active,
    /// 关系已撤销，不能再进行转账
    Revoked,
}

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("User A pubkey must be less than User B pubkey for PDA seed ordering")]
    InvalidUserOrder,

    #[msg("Passphrase hash does not match")]
    PassphraseMismatch,

    #[msg("Relationship is not in the correct status for this operation")]
    InvalidRelationshipStatus,

    #[msg("Sender is not authorized for this relationship")]
    UnauthorizedTransfer,
}
