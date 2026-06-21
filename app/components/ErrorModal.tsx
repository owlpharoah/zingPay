"use client";

import { AnimatePresence, motion } from "framer-motion";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";

interface ErrorModalProps {
  /** Whether the modal is shown. */
  isOpen: boolean;
  /** Close handler — wired to the backdrop, the ✕, and the dismiss button. */
  onClose: () => void;

  // --- Content: provide EITHER an explicit title/message, OR a raw `error`. ---
  /** Headline. Defaults to the mapped title, or "Something went wrong". */
  title?: string;
  /** Body copy. Defaults to the mapped hint. */
  message?: string;
  /**
   * A raw thrown value. When `title`/`message` aren't given, this is run through
   * {@link toFriendlyError} so callers can pass a caught error straight in.
   */
  error?: unknown;
  /** Overrides the generic fallback copy when mapping a raw `error`. */
  fallback?: Partial<FriendlyError>;

  // --- Actions ---
  /** When provided, renders a primary "try again" button. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Label for the secondary dismiss button. */
  dismissLabel?: string;
}

/**
 * Reusable error dialog for the app surfaces (send, register, claim, modify, …).
 *
 * Shares the visual language of the other modals (dark blurred backdrop, white
 * rounded card, spring entrance) but with a red accent. It never shows raw error
 * text: either pass friendly `title`/`message`, or hand it the caught `error`
 * and it derives intuitive copy via {@link toFriendlyError}.
 */
export default function ErrorModal({
  isOpen,
  onClose,
  title,
  message,
  error,
  fallback,
  onRetry,
  retryLabel = "Try again",
  dismissLabel = "Dismiss",
}: ErrorModalProps) {
  // Resolve copy: explicit props win; otherwise map the raw error.
  const resolved = title && message ? null : toFriendlyError(error, fallback);
  const heading = title ?? resolved?.title ?? "Something went wrong";
  const body = message ?? resolved?.hint ?? "Please try again.";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0B2818]/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
            <motion.div
              role="alertdialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-[460px] rounded-[40px] max-sm:rounded-3xl flex flex-col items-center justify-center p-10 max-sm:p-6 shadow-2xl relative pointer-events-auto"
            >
              {/* Close ✕ */}
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-5 right-5 max-sm:top-4 max-sm:right-4 w-9 h-9 flex items-center justify-center rounded-full text-[#0B2818] hover:bg-[#0B2818]/5 transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor">
                  <path d="M6 6l12 12M18 6L6 18" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </button>

              {/* Red alert badge */}
              <div className="w-[110px] h-[110px] max-sm:w-[80px] max-sm:h-[80px] bg-[#FF4D4D] rounded-full flex items-center justify-center mb-8 max-sm:mb-6">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 max-sm:w-8 max-sm:h-8">
                  <path d="M12 8v5" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="12" cy="17" r="1.6" fill="white" />
                </svg>
              </div>

              <h2 className="font-[fraunces] text-[34px] max-sm:text-2xl leading-tight font-black text-[#0B2818] mb-3 max-sm:mb-2 text-center">
                {heading}
              </h2>

              <p className="text-gray-500 text-sm max-sm:text-xs text-center mb-8 max-sm:mb-6 font-[outfit] leading-relaxed">
                {body}
              </p>

              {onRetry && (
                <button
                  onClick={onRetry}
                  className="w-[85%] max-sm:w-full bg-[#192FFD] border-2 border-[#0B2818] text-white font-[outfit] font-bold text-base max-sm:text-sm py-3.5 max-sm:py-3 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all text-center mb-4 max-sm:mb-3"
                >
                  {retryLabel}
                </button>
              )}

              <button
                onClick={onClose}
                className="w-[85%] max-sm:w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-[outfit] font-bold text-base max-sm:text-sm py-3.5 max-sm:py-3 rounded-2xl hover:bg-gray-50 transition-all"
              >
                {dismissLabel}
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
