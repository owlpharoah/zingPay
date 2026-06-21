"use client"

import Image from "next/image";
import Link from "next/link";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppNav from "@/components/AppNav";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { getDialOption, DialOption, normalizeToE164 } from "@/lib/phone";
import { CountryCodeSelect } from "@/components/CountryCodeSelect";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { useRegistration, isLocalhost } from "@/lib/useRegistration";
import { WalletDropdown } from "@/components/WalletDropdown";
import { hashPhone, toHex } from "@/lib/hash";
import { BACKEND_URL } from "@/lib/constants";
import ErrorModal from "@/components/ErrorModal";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";

// --- Types ---
type Action = "change" | "delete";

type Screen =
  | "manage"
  | "verify-identity"
  | "new-phone"
  | "verify-otp-new"
  | "delete-confirm";

// --- Animation Variants ---
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

// --- Success Modal ---
interface NumberUpdatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: Action;
  newPhone?: string;
}

function NumberUpdatedModal({ isOpen, onClose, action, newPhone }: NumberUpdatedModalProps) {
  const isDelete = action === "delete";
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
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-150 max-sm:max-w-120 rounded-[40px] max-sm:w-[267px] max-sm:rounded-3xl flex flex-col items-center justify-center p-10 max-sm:p-6 shadow-2xl relative pointer-events-auto"
            >
              {isDelete ? (
                <Image
                  alt="deleted"
                  src="/delete.svg"
                  width={110}
                  height={110}
                  className="w-[110px] h-[110px] max-sm:w-[80px] max-sm:h-[80px] mb-8 max-sm:mb-6"
                />
              ) : (
                <div className="w-[110px] h-[110px] max-sm:w-[80px] max-sm:h-[80px] bg-[#0B2818] rounded-full flex items-center justify-center mb-8 max-sm:mb-6">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 max-sm:w-8 max-sm:h-8">
                    <path d="M20 6L9 17L4 12" stroke="#B8FF4F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}

              <h2 className="font-jersey text-[40px] max-sm:text-3xl leading-none font-normal text-[#0B2818] mb-4 max-sm:mb-3 text-center">
                {isDelete ? "Number Removed" : "Number Changed"}
              </h2>

              <p className="text-gray-500 text-sm text-center mb-8 max-sm:mb-6 font-[outfit]">
                {isDelete
                  ? "Your phone number has been removed from your account."
                  : "Your phone number has been successfully updated."}
              </p>

              {!isDelete ? (
                    <div className="w-[85%] max-sm:w-full bg-[#192FFD]/10 border-2 border-[#192FFD] rounded-2xl py-3.5 max-sm:py-3 text-center mb-4">
                    <p className="text-xs font-bold tracking-wider text-gray-500 font-[outfit]">NEW NUMBER</p>
                    <p className="text-lg max-sm:text-base font-bold text-[#0B2818] font-[outfit]">{newPhone || "your new number"}</p>
                    </div>
                ) : (
                    <div className="w-[85%] max-sm:w-full bg-[#192FFD]/10 rounded-2xl py-3.5 max-sm:p-3 text-center mb-4">
                        <p className="text-md sm:text-xl md:text-2xl font-outfit">You can add a new phone number anytime from your account settings.</p>
                    </div>
                )
               }

              <button
                onClick={onClose}
                className="w-[85%] max-sm:w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-[outfit] font-bold text-lg max-sm:text-base py-3.5 max-sm:py-3 rounded-2xl hover:bg-gray-50 transition-all"
              >
                Back
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Leave-flow Warning Modal ---
interface LeaveFlowWarningModalProps {
  isOpen: boolean;
  isDelete: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function LeaveFlowWarningModal({ isOpen, isDelete, onConfirm, onCancel }: LeaveFlowWarningModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#0B2818]/70 backdrop-blur-sm"
            onClick={onCancel}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-150 max-sm:max-w-120 rounded-[40px] max-sm:w-[267px] max-sm:rounded-3xl flex flex-col items-center justify-center p-10 max-sm:p-6 shadow-2xl relative pointer-events-auto"
            >
              <div className="w-[110px] h-[110px] max-sm:w-[80px] max-sm:h-[80px] bg-amber-100 rounded-full flex items-center justify-center mb-8 max-sm:mb-6">
                <span className="text-5xl max-sm:text-4xl">⚠️</span>
              </div>

              <h2 className="font-jersey text-[40px] max-sm:text-3xl leading-none font-normal text-[#0B2818] mb-4 max-sm:mb-3 text-center">
                Verification will be lost
              </h2>

              <p className="text-gray-500 text-sm text-center mb-8 max-sm:mb-6 font-[outfit]">
                If you go back now, you&apos;ll need to verify your identity with your
                wallet again before you can {isDelete ? "delete" : "change"} your phone number.
              </p>

              <button
                onClick={onConfirm}
                className="w-[85%] max-sm:w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-[outfit] font-bold text-lg max-sm:text-base py-3.5 max-sm:py-3 rounded-2xl hover:bg-gray-50 transition-all mb-3"
              >
                Go back anyway
              </button>
              <button
                onClick={onCancel}
                className="w-[85%] max-sm:w-full bg-[#192FFD] border-2 border-[#0B2818] text-white font-[outfit] font-bold text-lg max-sm:text-base py-3.5 max-sm:py-3 rounded-2xl hover:translate-y-[2px] transition-all"
              >
                Stay here
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Main Page Component ---
export default function Modify() {
  // The modify route is only meant for wallets that have a registered number.
  // Anyone else is bounced to /register — except on localhost, where it stays
  // open for development.
  const { registered, loading: registrationLoading } = useRegistration();
  const allowed = isLocalhost() || registered === true;

  if (!allowed) {
    return <ModifyGuard loading={registrationLoading} />;
  }

  return <ModifyInner />;
}

function ModifyGuard({ loading }: { loading: boolean }) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <AppHeader />
      <AppNav />
      <div className="grow flex flex-col items-center justify-center bg-white px-6 text-center font-[outfit]">
        {loading ? (
          <p className="text-gray-500 text-lg">Checking your registration…</p>
        ) : (
          <>
            <h1 className="font-jersey font-normal text-5xl max-sm:text-3xl text-[#0B2818] mb-3">
              Register first
            </h1>
            <p className="text-gray-500 max-w-md text-lg max-sm:text-sm mb-8">
              You need a registered phone number before you can manage it.
              Connect the wallet you registered with, or register a number to
              get started.
            </p>
            <Link
              href="/register"
              className="bg-[#192FFD] border-2 border-[#0B2818] text-white font-bold text-lg py-3.5 px-8 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all"
            >
              Go to ID Register
            </Link>
          </>
        )}
      </div>
      <AppFooter />
    </div>
  );
}

// Friendly error copy is centralised in lib/errors. Local alias kept for the
// existing call sites below.
type ActionErrorInfo = FriendlyError;

function ModifyInner() {
  const [screen, setScreen] = useState<Screen>("manage");
  const [action, setAction] = useState<Action>("change");
  const [direction, setDirection] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showBackWarning, setShowBackWarning] = useState(false);

  const { connection } = useConnection();
  const { publicKey, signMessage, signTransaction } = useWallet();
  const walletLabel = publicKey
    ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`
    : null;

  // Phone identity state
  const [currentPhone, setCurrentPhone] = useState("");
  const [currentPhoneHashHex, setCurrentPhoneHashHex] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [actionError, setActionError] = useState<ActionErrorInfo | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Form state
  const [selectedCountry, setSelectedCountry] = useState<DialOption>(getDialOption("IN"));
  const [phoneInput, setPhoneInput] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Verify-identity country selector state
  const [verifyCountry, setVerifyCountry] = useState<DialOption>(getDialOption("IN"));
  const [isVerifyCountryOpen, setIsVerifyCountryOpen] = useState(false);

  const isDelete = action === "delete";

  // Accent classes driven by the chosen action
  const accentBtn = isDelete
    ? "bg-[#FF4D4D] text-white"
    : "bg-[#192FFD] text-white";
  const accentDot = isDelete ? "bg-[#FF4D4D]" : "bg-[#192FFD]";
  const accentLink = isDelete ? "text-[#FF4D4D]" : "text-[#192FFD]";
  const accentBox = isDelete
    ? "border-[#FF4D4D] bg-[#FF4D4D]/10"
    : "border-[#192FFD] bg-[#192FFD]/10";
  const accentFocus = isDelete ? "focus:border-[#FF4D4D]" : "focus:border-[#192FFD]";

  // Navigation helpers
  const go = (next: Screen, dir: number) => {
    setDirection(dir);
    setIsDropdownOpen(false);
    setVerifyError(null);
    setScreen(next);
  };

  const resetFlow = () => {
    setShowSuccessModal(false);
    setOtpCode("");
    setPhoneInput("");
    go("manage", -1);
  };

  // Leaving a post-verification screen (new number / delete confirm) discards
  // the verified session, so warn the user before sending them all the way
  // back to the manage view where they'll have to verify again.
  const confirmLeaveFlow = () => {
    setShowBackWarning(false);
    setOtpCode("");
    setPhoneInput("");
    go("manage", -1);
  };

  // Trigger an action on the connected wallet to verify identity.
  // The user can only advance once the wallet has actually signed the
  // verification request — no wallet (or a rejected/failed signature)
  // means they stay on this screen.
  const verifyWithWallet = async () => {
    if (isVerifying) return;

    if (!publicKey || !signMessage) {
      setVerifyError("Connect a wallet that can sign messages to verify your identity.");
      return;
    }
    if (!currentPhone.trim()) {
      setVerifyError("Enter your registered phone number first.");
      return;
    }

    const fullPhone = `${verifyCountry.dial}${currentPhone.replace(/\D/g, "")}`;
    const e164 = normalizeToE164(fullPhone, verifyCountry.code);
    if (!e164) {
      setVerifyError("Enter a valid phone number in the selected country format.");
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);
    try {
      const phoneHash = await hashPhone(e164);
      setCurrentPhoneHashHex(toHex(phoneHash));
      setCurrentPhone(e164);

      const message = new TextEncoder().encode(
        `ZingPay: verify identity to ${isDelete ? "remove" : "change"} your phone number`,
      );
      await signMessage(message);
      go(isDelete ? "delete-confirm" : "new-phone", 1);
    } catch {
      setVerifyError("Verification was not completed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeletePhone = async () => {
    if (!publicKey || !signTransaction || !currentPhoneHashHex || isActionSubmitting) return;
    setIsActionSubmitting(true);
    setActionError(null);
    try {
      const resp = await fetch(`${BACKEND_URL}/phone/build-delete-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_hash_hex: currentPhoneHashHex, wallet: publicKey.toString() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to build delete transaction");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      setShowSuccessModal(true);
    } catch (err: any) {
      setActionError(toFriendlyError(err));
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleSendOtpForNewPhone = async () => {
    if (isActionSubmitting) return;
    const e164 = normalizeToE164(
      `${selectedCountry.dial}${phoneInput.replace(/\D/g, "")}`,
      selectedCountry.code,
    );
    if (!e164) {
      setActionError({ title: "Invalid phone number", hint: "Enter a valid number for the selected country." });
      return;
    }
    setIsActionSubmitting(true);
    setActionError(null);
    try {
      const resp = await fetch(`${BACKEND_URL}/otp/send-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to send OTP");
      setNewPhone(e164);
      setOtpCode("");
      go("verify-otp-new", 1);
    } catch (err: any) {
      setActionError({ title: "Failed to send OTP", hint: err.message || "Please try again." });
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleVerifyChangePhone = async () => {
    if (!publicKey || !signTransaction || otpCode.length !== 6 || isActionSubmitting) return;
    setIsActionSubmitting(true);
    setActionError(null);
    try {
      const resp = await fetch(`${BACKEND_URL}/otp/verify-change`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          old_phone_hash_hex: currentPhoneHashHex,
          new_phone: newPhone,
          code: otpCode,
          wallet: publicKey.toString(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Verification failed");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      setShowSuccessModal(true);
    } catch (err: any) {
      setActionError(toFriendlyError(err));
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Progress bar visibility / state (change flow only)
  const showProgress = ["new-phone", "verify-otp-new"].includes(screen);
  const onFirstStep = screen === "new-phone";

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* header */}
      <AppHeader />

      <AppNav />

      {/* main content */}
      <div className="grow flex flex-col bg-white">
        <div className="flex flex-col items-center w-full max-w-3xl mx-auto p-10 max-sm:p-8 font-[outfit] flex-grow">
          <div className="bg-white border-2 border-[#0B2818] rounded-[40px] max-sm:rounded-[28px] w-full max-w-[900px] max-sm:min-h-100 min-h-130 p-8 max-sm:p-5 relative shadow-sm flex flex-col z-0">

            {/* Progress Bar (animated like register/page.tsx) */}
            {showProgress && (
              <div className="flex justify-center space-x-4 max-sm:space-x-2 w-full mb-12 max-sm:mb-6 z-10 relative">
                <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${onFirstStep ? accentDot : "bg-[#0B2818]"}`} />
                <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${onFirstStep ? "bg-gray-200" : accentDot}`} />
              </div>
            )}

            {/* Sliding Content */}
            <div className={`relative grow w-full rounded-[32px] z-0 ${isDropdownOpen || isVerifyCountryOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={screen}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                  className="absolute inset-0 w-full h-full flex flex-col"
                >
                  {screen === "manage" && <ManageView accentDot="bg-[#192FFD]" accentBox="bg-[#192FFD]/8" />}

                  {screen === "verify-identity" && (
                    <VerifyIdentityView
                      isDelete={isDelete}
                      accentBox={accentBox}
                      walletLabel={walletLabel}
                      currentPhone={currentPhone}
                      setCurrentPhone={setCurrentPhone}
                      accentFocus={accentFocus}
                      verifyCountry={verifyCountry}
                      setVerifyCountry={setVerifyCountry}
                      isVerifyCountryOpen={isVerifyCountryOpen}
                      setIsVerifyCountryOpen={setIsVerifyCountryOpen}
                      onEnter={verifyWithWallet}
                    />
                  )}

                  {screen === "verify-otp-new" && (
                    <OtpView
                      step={2}
                      phone={newPhone}
                      otpCode={otpCode}
                      setOtpCode={setOtpCode}
                      accentDot={accentDot}
                      accentLink={accentLink}
                      accentFocus={accentFocus}
                      onSubmit={handleVerifyChangePhone}
                    />
                  )}

                  {screen === "new-phone" && (
                    <NewPhoneView
                      isDropdownOpen={isDropdownOpen}
                      setIsDropdownOpen={setIsDropdownOpen}
                      selectedCountry={selectedCountry}
                      setSelectedCountry={setSelectedCountry}
                      phoneInput={phoneInput}
                      setPhoneInput={setPhoneInput}
                      accentDot={accentDot}
                      onEnter={handleSendOtpForNewPhone}
                    />
                  )}

                  {screen === "delete-confirm" && <DeletePhoneView phone={currentPhone} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-[800px] mt-6 max-sm:mt-4 flex flex-col space-y-4 max-sm:space-y-3">
            {screen === "manage" && (
              <>
                <button
                  onClick={() => { setAction("change"); go("verify-identity", 1); }}
                  className="w-full bg-[#192FFD] border-2 border-[#0B2818] text-white font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all"
                >
                  Change Phone Number
                </button>
                <button
                  onClick={() => { setAction("delete"); go("verify-identity", 1); }}
                  className="w-full bg-white border-2 border-[#FF4D4D] text-[#FF4D4D] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl hover:bg-[#FF4D4D]/5 transition-all"
                >
                  Delete Phone Number
                </button>
              </>
            )}

            {screen === "verify-identity" && (
              <>
                {verifyError && (
                  <p className="text-[#FF4D4D] text-sm max-sm:text-xs text-center font-[outfit] -mb-1">
                    {verifyError}
                  </p>
                )}
                <button
                  onClick={verifyWithWallet}
                  disabled={isVerifying || !publicKey || !signMessage}
                  className={`w-full border-2 border-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-[0px_4px_0px_0px_#0B2818] ${accentBtn}`}
                >
                  {isVerifying
                    ? "Confirm in your wallet…"
                    : !publicKey || !signMessage
                      ? "Connect a wallet to verify"
                      : "Verify with wallet"}
                </button>
                <button
                  onClick={() => go("manage", -1)}
                  className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
              </>
            )}

            {screen === "new-phone" && (
              <>
                <button
                  onClick={handleSendOtpForNewPhone}
                  disabled={isActionSubmitting}
                  className="w-full bg-[#192FFD] border-2 border-[#0B2818] text-white font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all disabled:opacity-60"
                >
                  {isActionSubmitting ? "Sending…" : "Send verification code"}
                </button>
                <button
                  onClick={() => setShowBackWarning(true)}
                  className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
              </>
            )}

            {screen === "verify-otp-new" && (
              <>
                <button
                  onClick={handleVerifyChangePhone}
                  disabled={otpCode.length !== 6 || isActionSubmitting}
                  className="w-full bg-[#192FFD] border-2 border-[#0B2818] text-white font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all disabled:opacity-60"
                >
                  {isActionSubmitting ? "Submitting…" : "Verify"}
                </button>
                <button
                  onClick={() => { setOtpCode(""); go("new-phone", -1); }}
                  className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
              </>
            )}

            {screen === "delete-confirm" && (
              <>
                <button
                  onClick={handleDeletePhone}
                  disabled={isActionSubmitting}
                  className="w-full bg-[#FF4D4D] border-2 border-[#0B2818] text-white font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all disabled:opacity-60"
                >
                  {isActionSubmitting ? "Processing…" : "Yes, Delete Number"}
                </button>
                <button
                  onClick={() => setShowBackWarning(true)}
                  className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <AppFooter />

      <NumberUpdatedModal isOpen={showSuccessModal} onClose={resetFlow} action={action} newPhone={newPhone} />

      <LeaveFlowWarningModal
        isOpen={showBackWarning}
        isDelete={isDelete}
        onConfirm={confirmLeaveFlow}
        onCancel={() => setShowBackWarning(false)}
      />

      <ErrorModal
        isOpen={!!actionError}
        onClose={() => setActionError(null)}
        title={actionError?.title}
        message={actionError?.hint}
      />
    </div>
  );
}

// --- Sub Views ---

function ManageView({ accentDot, accentBox }: { accentDot: string; accentBox: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full mt-2 max-sm:mt-0 px-4">
      <div className="border border-[#0B2818] bg-[#F7F4EE] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 mb-6 max-sm:mb-6">
        <div className={`w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full ${accentDot}`}></div>
        <span className="text-[#0B2818]">WELCOME TO ZINGPAY</span>
      </div>
      <h1 className="font-jersey text-5xl max-sm:text-4xl max-sm:leading-[1.1] font-normal text-[#0B2818] mb-4 max-sm:mb-3">
        Manage your number
      </h1>
      <p className="text-gray-500 max-w-xl text-lg max-sm:text-sm px-2 mb-8 max-sm:mb-6">
        Your registered phone number is linked to your ID. You can change or remove it anytime.
      </p>
      <div className={`flex flex-col items-center justify-center w-[280px] h-[100px] lg:w-100 lg:h-31 ${accentBox} rounded-2xl py-5 max-sm:py-4 px-6`}>
        <div className="flex flex-row w-full gap-2 justify-center">
            <Image alt="a phone icon" src="/phone-manage.svg" width={20} height={20}/>
            <p className="text-2xl max-sm:text-xl font-bold text-[#0B2818] font-[outfit]">Your registered number</p>
        </div>
        <p className="text-sm max-sm:text-xs text-gray-500 mt-1 font-[outfit]">Registered &amp; Verified</p>
      </div>
    </div>
  );
}

function VerifyIdentityView({
  isDelete,
  accentBox,
  walletLabel,
  currentPhone,
  setCurrentPhone,
  accentFocus,
  verifyCountry,
  setVerifyCountry,
  isVerifyCountryOpen,
  setIsVerifyCountryOpen,
  onEnter,
}: {
  isDelete: boolean;
  accentBox: string;
  walletLabel: string | null;
  currentPhone: string;
  setCurrentPhone: (v: string) => void;
  accentFocus: string;
  verifyCountry: DialOption;
  setVerifyCountry: (v: DialOption) => void;
  isVerifyCountryOpen: boolean;
  setIsVerifyCountryOpen: (v: boolean) => void;
  onEnter: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-8 max-sm:px-2">
      <h1 className="font-jersey font-normal text-6xl max-sm:text-4xl max-sm:leading-[1.1] text-[#0B2818] mb-3 max-sm:mb-2">
        Verify your identity
      </h1>
      <p className="text-gray-500 max-w-xl text-lg max-sm:text-sm mb-6 max-sm:mb-4">
        Enter your registered phone number, then confirm in your wallet before you can{" "}
        {isDelete ? "remove" : "change"} it.
      </p>

      {/* Phone input with country selector */}
      <div className="w-full max-w-md mb-4 text-left relative">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block font-[outfit]">
          Your registered phone number
        </label>
        {isVerifyCountryOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setIsVerifyCountryOpen(false)} />
        )}
        <div className={`flex border-2 border-gray-200 ${accentFocus} rounded-2xl h-[52px] bg-white relative ${isVerifyCountryOpen ? "z-50" : "z-10"}`}>
          <CountryCodeSelect
            value={verifyCountry.code}
            onChange={setVerifyCountry}
            open={isVerifyCountryOpen}
            onOpenChange={setIsVerifyCountryOpen}
            className="relative shrink-0 flex"
            triggerClassName="flex items-center justify-center h-full px-4 border-r-2 border-gray-200 bg-white font-[outfit] font-semibold text-base text-[#0B2818] hover:bg-gray-50 cursor-pointer rounded-l-2xl gap-1"
            menuClassName="absolute z-[100] top-full mt-2 left-0 w-[200px] bg-white border-2 border-[#0B2818] rounded-xl shadow-lg flex flex-col overflow-hidden"
            optionClassName={(active) =>
              `w-full px-4 py-2.5 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 font-[outfit] font-semibold text-sm flex items-center justify-between gap-2 ${active ? "bg-[#B8FF4F] text-[#0B2818]" : "text-[#0B2818] hover:bg-[#B8FF4F]/50"}`
            }
            renderTrigger={(opt, open) => (
              <>
                <span className="text-sm font-bold text-[#0B2818]">{opt.code} {opt.dial}</span>
                <svg className={`w-3 h-3 text-[#0B2818] transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 10 6">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )}
            renderOption={(opt) => (
              <>
                <span className="truncate text-sm">{opt.code} <span className="text-gray-500 font-normal">{opt.name}</span></span>
                <span className="shrink-0 text-gray-500 text-xs">{opt.dial}</span>
              </>
            )}
          />
          <input
            type="tel"
            value={currentPhone}
            onChange={(e) => setCurrentPhone(e.target.value)}
            placeholder="Enter phone number"
            className="flex-1 px-3 text-base font-medium font-[outfit] text-[#0B2818] focus:outline-none placeholder:text-gray-400 placeholder:font-normal bg-transparent rounded-r-2xl"
            onFocus={() => setIsVerifyCountryOpen(false)}
            onKeyDown={(e) => e.key === "Enter" && onEnter()}
          />
        </div>
      </div>

      <div className={`flex items-center justify-center gap-3 w-full max-w-md ${accentBox} rounded-2xl py-5 max-sm:py-4 px-6 mb-4`}>
        <Image alt="wallet" src="/wallet.svg" width={22} height={22} className="max-sm:w-4 max-sm:h-4" />
        <div className="flex flex-col">
          <p className="text-2xl max-sm:text-xl font-bold text-[#0B2818] font-[outfit]">
            {walletLabel ?? "No wallet connected"}
          </p>
          <p className="text-sm max-sm:text-xs text-gray-500 mt-1 font-[outfit]">
            {walletLabel ? "Connected wallet" : "Connect a wallet to continue"}
          </p>
        </div>
      </div>
      <p className="text-sm max-sm:text-xs text-gray-400 font-[outfit]">
        We&apos;ll ask your wallet to sign a verification request.
      </p>
    </div>
  );
}

function NewPhoneView({
  isDropdownOpen, setIsDropdownOpen, selectedCountry, setSelectedCountry, phoneInput, setPhoneInput, accentDot, onEnter,
}: {
  isDropdownOpen: boolean;
  setIsDropdownOpen: (val: boolean) => void;
  selectedCountry: DialOption;
  setSelectedCountry: (val: DialOption) => void;
  phoneInput: string;
  setPhoneInput: (val: string) => void;
  accentDot: string;
  onEnter: () => void;
}) {
  return (
    <div className="flex flex-col h-full text-left px-8 max-sm:px-2 py-4 max-sm:py-0 max-sm:mt-5">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 w-fit mb-8 max-sm:mb-4 max-sm:mt-2">
        <div className={`w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full ${accentDot}`}></div>
        <span className="text-[#0B2818]">STEP 1 OF 2</span>
      </div>
      <h1 className="font-jersey font-normal text-5xl max-sm:text-3xl max-sm:leading-[1.1] max-sm:text-center text-[#0B2818] mb-2 max-sm:mb-1">
        What&apos;s your new number?
      </h1>
      <p className="text-gray-500 mb-10 max-sm:mb-6 text-lg max-sm:text-sm max-sm:text-center">
        We will send a verification code to verify your new phone number via OTP (One-Time Password).
      </p>
      <div className="w-full max-w-xl">
        <label className="text-sm max-sm:text-xs font-bold text-gray-700 mb-2 max-sm:mb-1.5 block tracking-wider">PHONE NUMBER</label>
        <div className="flex border-2 border-[#0B2818] rounded-2xl h-16 max-sm:h-14 relative bg-white z-20">
          <CountryCodeSelect
            value={selectedCountry.code}
            onChange={setSelectedCountry}
            open={isDropdownOpen}
            onOpenChange={setIsDropdownOpen}
            className="relative shrink-0 flex"
            triggerClassName="flex items-center justify-center h-full px-6 max-sm:px-4 border-r-2 border-[#0B2818] bg-white font-[outfit] font-semibold text-lg max-sm:text-base text-[#0B2818] hover:bg-gray-50 cursor-pointer rounded-l-2xl"
            menuClassName="absolute z-[100] top-full mt-2 left-[-2px] w-[220px] max-sm:w-[190px] bg-white border-2 border-[#0B2818] rounded-xl shadow-[0px_4px_0px_0px_#0B2818] flex flex-col overflow-hidden"
            optionClassName={(active) =>
              `w-full px-5 max-sm:px-4 py-3 max-sm:py-2.5 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 font-[outfit] font-semibold text-lg max-sm:text-base flex items-center justify-between gap-2 ${active ? "bg-[#B8FF4F] text-[#0B2818]" : "text-[#0B2818] hover:bg-[#B8FF4F]"}`
            }
            renderTrigger={(opt, open) => (
              <>
                {opt.code} <span className="ml-2 max-sm:ml-1">{opt.dial}</span>
                <svg className={`w-4 h-4 max-sm:w-3 max-sm:h-3 ml-2 max-sm:ml-1 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
            renderOption={(opt) => (
              <>
                <span className="truncate">{opt.code} <span className="text-gray-500 text-base max-sm:text-sm font-normal">{opt.name}</span></span>
                <span className="text-gray-500 text-base max-sm:text-sm shrink-0">{opt.dial}</span>
              </>
            )}
          />
          <input
            type="tel"
            placeholder="Enter your number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="grow w-full px-4 max-sm:px-3 text-lg max-sm:text-xs outline-none bg-transparent rounded-r-2xl font-[outfit]"
            onFocus={() => setIsDropdownOpen(false)}
            onKeyDown={(e) => e.key === "Enter" && onEnter()}
          />
        </div>
        <p className="text-xs max-sm:text-[10px] text-gray-400 mt-3 max-sm:mt-2 font-[outfit]">
          By continuing you agree to ZingPay&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function DeletePhoneView({ phone }: { phone: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full px-8 max-sm:px-2">
      <h1 className="font-jersey font-normal text-5xl max-sm:text-3xl max-sm:leading-[1.1] text-[#0B2818] mb-3 max-sm:mb-2">
        Delete phone number?
      </h1>
      <p className="text-gray-500 max-w-xl text-lg max-sm:text-sm mb-8 max-sm:mb-6">
        Are you sure you want to remove your phone number? You won&apos;t be able to receive OTP-verified codes.
      </p>
      <div className="w-full max-w-md bg-[#FF4D4D]/10 rounded-2xl py-5 max-sm:py-4 px-6 mb-6 max-sm:mb-4">
        <p className="text-2xl max-sm:text-xl font-bold text-[#0B2818] font-[outfit]">{phone || "your registered number"}</p>
        <p className="text-sm max-sm:text-xs text-[#FF4D4D] font-semibold mt-1 font-[outfit]">Will be removed</p>
      </div>
      <div className="w-full max-w-md bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-left">
        <p className="text-xs max-sm:text-[11px] text-amber-700 font-[outfit]">
          ⚠<span className="font-bold"> Warning:</span> You&apos;ll need to register a new number later to receive verified codes.
        </p>
      </div>
    </div>
  );
}

function OtpView({
  step,
  phone,
  otpCode,
  setOtpCode,
  accentDot,
  accentLink,
  accentFocus,
  onSubmit,
}: {
  step: 1 | 2;
  phone: string;
  otpCode: string;
  setOtpCode: (val: string) => void;
  accentDot: string;
  accentLink: string;
  accentFocus: string;
  onSubmit?: () => void;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && otpCode.length === 6) {
      onSubmit?.();
    }
  };

  const handleChange = (value: string, index: number) => {
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = otpCode.split("").slice(0, 6);
    while (newOtp.length < 6) newOtp.push("");

    newOtp[index] = value.substring(value.length - 1);
    setOtpCode(newOtp.join(""));

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData
      .getData("text/plain")
      .replace(/\D/g, "")
      .slice(0, 6);

    setOtpCode(pastedData);

    if (pastedData.length === 6) {
      inputRefs.current[5]?.focus();
    } else if (pastedData.length > 0) {
      inputRefs.current[pastedData.length]?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full text-left max-sm:text-center max-sm:items-center px-7 max-sm:px-1 py-4 max-sm:py-0">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 w-fit mb-5 max-sm:mb-4">
        <div className={`w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full ${accentDot}`}></div>
        <span className="text-[#0B2818]">STEP {step} OF 2</span>
      </div>

      <h1 className="font-jersey font-normal text-5xl mt-8 max-sm:text-4xl max-sm:leading-[1.1] text-[#0B2818] mb-1 max-sm:mb-1">
        Check your messages.
      </h1>

      <p className="text-gray-500 mb-8 max-sm:mb-6 text-lg max-sm:text-sm">
        We sent a 6-digit code to {phone}
        <span className="max-sm:hidden">. The code expires shortly, so enter it soon.</span>
        <span className="hidden max-sm:inline">.<br />The code expires shortly, so enter it soon.</span>
      </p>

      <div className="w-full max-w-xl max-sm:flex max-sm:flex-col max-sm:items-center">
        <label className="text-sm max-sm:text-xs font-bold text-gray-700 mb-4 max-sm:mb-3 block tracking-wider uppercase">
          6-Digit Verification Code
        </label>

        <div className="inline-block max-sm:flex max-sm:flex-col max-sm:items-center">
          <div className="flex gap-4 max-sm:gap-1 mb-8 max-sm:mb-6">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otpCode[index] || ""}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                onPaste={handlePaste}
                className={`w-[60px] h-[60px] max-sm:w-[35px] max-sm:h-[35px] max-sm:rounded-xl border-2 border-gray-200 ${accentFocus} rounded-2xl text-center text-2xl max-sm:text-xl font-bold text-[#0B2818] outline-none transition-colors`}
              />
            ))}
          </div>

          <div className="md:absolute md:bottom-0 flex justify-center w-full">
            <button
              type="button"
              className={`${accentLink} font-bold text-lg max-sm:text-base hover:opacity-80 transition-opacity`}
            >
              Resend Code
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
