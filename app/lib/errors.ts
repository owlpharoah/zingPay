// Centralised, user-facing error mapping.
//
// Wallets, the Solana runtime and our backend all surface failures as raw,
// developer-oriented strings ("AccountNotInitialized", "0x1770", "User rejected
// the request", a 200-line transaction log, …). Showing those verbatim is the
// "ugly raw format" we want to avoid. `toFriendlyError` collapses any thrown
// value into a short { title, hint } pair that's safe to put in front of a user.
//
// This is the single source of truth — pages should not hand-roll their own
// error copy. Pair it with <ErrorModal /> for a consistent presentation.

export type FriendlyError = {
  /** Short headline, e.g. "Transaction cancelled". */
  title: string;
  /** One or two sentences telling the user what to do next. */
  hint: string;
};

/** Pull any transaction logs hiding on a thrown error, wherever they live. */
function extractLogs(err: any): string[] | undefined {
  return err?.logs ?? err?.error?.logs ?? err?.transactionError?.logs;
}

/** Best-effort string form of whatever was thrown. */
function extractMessage(err: unknown): string {
  if (typeof err === "string") return err;
  const e = err as any;
  return String(e?.message ?? e?.error?.message ?? e?.toString?.() ?? "");
}

/**
 * Map an arbitrary thrown value to friendly, user-facing copy.
 *
 * @param err      Anything caught in a `catch` block (Error, string, wallet
 *                 error, anchor error, fetch failure, …).
 * @param fallback Optional override for the generic case — pass a domain title
 *                 like "Couldn't send" / "Registration failed" so the catch-all
 *                 still reads naturally for that flow.
 */
export function toFriendlyError(
  err: unknown,
  fallback?: Partial<FriendlyError>,
): FriendlyError {
  const msg = extractMessage(err);
  const logs = extractLogs(err);
  const inMsg = (s: string) => msg.toLowerCase().includes(s.toLowerCase());
  const inLogs = (s: string) =>
    logs?.some((l) => l.toLowerCase().includes(s.toLowerCase())) ?? false;
  const has = (s: string) => inMsg(s) || inLogs(s);

  // ── User-initiated cancellation ───────────────────────────────────────────
  if (has("User rejected") || has("rejected the request") || has("WalletSignTransaction") || has("user denied"))
    return { title: "Transaction cancelled", hint: "You declined the request in your wallet. Try again when you're ready." };

  // ── Connectivity ──────────────────────────────────────────────────────────
  if (inMsg("Failed to fetch") || inMsg("NetworkError") || inMsg("network request failed") || inMsg("ERR_NETWORK"))
    return { title: "Connection problem", hint: "We couldn't reach the network. Check your internet connection and try again." };

  // ── On-chain / program errors ─────────────────────────────────────────────
  if (has("AccountNotInitialized"))
    return {
      title: "Phone not found on-chain",
      hint: "No registration exists for that number. Double-check the number and make sure the registration flow was completed.",
    };

  if (has("Unauthorized") || has("0x1770"))
    return {
      title: "Wallet doesn't own this registration",
      hint: "The connected wallet isn't the owner of this phone registration. Switch to the wallet you registered with.",
    };

  if (has("ConstraintSeeds") || has("ConstraintRaw"))
    return {
      title: "Phone number mismatch",
      hint: "The number you entered doesn't match your on-chain registration. Enter the exact number you registered.",
    };

  if (has("InsufficientFunds") || has("insufficient lamports") || has("insufficient funds"))
    return { title: "Not enough SOL", hint: "Your wallet doesn't have enough SOL to cover the amount plus the network fee." };

  if (has("Attempt to debit an account but found no record"))
    return { title: "Sponsor wallet unavailable", hint: "The gas sponsor wallet is missing or unfunded. Please contact support." };

  if (has("unknown signer") || has("signature verification"))
    return { title: "Wallet mismatch", hint: "The signing wallet didn't match. Reconnect your wallet and try again." };

  // ── Stale transaction / timing ────────────────────────────────────────────
  if (has("Blockhash not found") || has("block height exceeded") || has("TransactionExpired"))
    return { title: "Transaction expired", hint: "The network took too long to confirm. Please try again." };

  if (has("already in use") || has("already been processed"))
    return { title: "Already submitted", hint: "This transaction was already processed. Refresh the page to see the latest state." };

  // ── Generic fallback ──────────────────────────────────────────────────────
  return {
    title: fallback?.title ?? "Something went wrong",
    // Prefer a caller-supplied hint; then a short raw message if it looks
    // human-readable; otherwise a safe generic line. We avoid dumping long
    // multi-line logs or hex codes at the user.
    hint:
      fallback?.hint ??
      (msg && msg.length <= 140 && !msg.includes("\n") && !/0x[0-9a-f]+/i.test(msg)
        ? msg
        : "An unexpected error occurred. Please try again."),
  };
}
