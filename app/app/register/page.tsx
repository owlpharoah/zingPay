"use client"

import Image from "next/image";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppNav from "@/components/AppNav";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { BACKEND_URL } from "@/lib/constants";
import { normalizeToE164, getDialOption, DialOption } from "@/lib/phone";
import { CountryCodeSelect } from "@/components/CountryCodeSelect";
import ErrorModal from "@/components/ErrorModal";
import { toFriendlyError } from "@/lib/errors";

// --- Types ---
type Step = 0 | 1 | 2;

type RegisterState =
  | "idle"
  | "sending_otp"
  | "otp_sent"
  | "verifying"
  | "submitting"
  | "success"
  | "error";

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

// --- Modal Component ---
interface WalletCreatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  txSig: string;
}

function WalletCreatedModal({ isOpen, onClose, txSig }: WalletCreatedModalProps) {
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
              className="bg-white w-full max-w-[480px] rounded-[40px] max-sm:rounded-3xl flex flex-col items-center justify-center p-10 max-sm:p-6 shadow-2xl relative pointer-events-auto"
            >
              <div className="w-[110px] h-[110px] max-sm:w-[80px] max-sm:h-[80px] bg-[#0B2818] rounded-full flex items-center justify-center mb-8 max-sm:mb-6">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 max-sm:w-8 max-sm:h-8">
                  <path d="M20 6L9 17L4 12" stroke="#B8FF4F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h2 className="font-[fraunces] text-[40px] max-sm:text-3xl leading-none font-black text-[#0B2818] mb-4 max-sm:mb-3 text-center">
                Wallet Created
              </h2>

              <p className="text-gray-500 text-sm text-center mb-8 max-sm:mb-6 font-[outfit]">
                Registration complete. Payments to this mobile now settle instantly.
              </p>

              {txSig && (
                <a
                  href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-[85%] max-sm:w-full bg-[#0B2818] text-[#B8FF4F] font-[outfit] font-bold text-base max-sm:text-sm py-3.5 max-sm:py-3 rounded-2xl text-center mb-4 block"
                >
                  View on Explorer
                </a>
              )}

              <button
                onClick={onClose}
                className="w-[85%] max-sm:w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-[outfit] font-bold text-lg max-sm:text-base py-3.5 max-sm:py-3 rounded-2xl hover:bg-gray-50 transition-all"
              >
                Go back
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// --- Main Page Component ---
export default function Register() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [step, setStep] = useState<Step>(0);
  const [direction, setDirection] = useState(1);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Form state
  const [selectedCountry, setSelectedCountry] = useState<DialOption>(getDialOption("IN"));
  const [phoneInput, setPhoneInput] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Logic state
  const [registerState, setRegisterState] = useState<RegisterState>("idle");
  const [phoneE164, setPhoneE164] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  // Headline for the error modal. Empty for plain validation messages (a generic
  // heading is used); set to a mapped title on transaction/network failures.
  const [errorTitle, setErrorTitle] = useState("");
  const [txSig, setTxSig] = useState("");

  const nextStep = () => {
    if (step < 2) {
      setDirection(1);
      setIsDropdownOpen(false);
      setStep((prev) => (prev + 1) as Step);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setDirection(-1);
      setIsDropdownOpen(false);
      setStep((prev) => (prev - 1) as Step);
    }
  };

  async function handleSendOtp() {
    setErrorTitle("");
    if (!publicKey) {
      setErrorMessage("Connect your wallet first");
      setRegisterState("error");
      return;
    }

    const fullPhone = `${selectedCountry.dial}${phoneInput.replace(/\D/g, "")}`;
    const e164 = normalizeToE164(fullPhone, selectedCountry.code);
    if (!e164) {
      setErrorMessage("Enter a valid phone number");
      setRegisterState("error");
      return;
    }

    setPhoneE164(e164);
    setRegisterState("sending_otp");
    setErrorMessage("");

    try {
      const resp = await fetch(`${BACKEND_URL}/otp/send-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: e164 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to send OTP");
      setRegisterState("otp_sent");
      nextStep();
    } catch (err: any) {
      const friendly = toFriendlyError(err, { title: "Couldn't send code" });
      setErrorTitle(friendly.title);
      setErrorMessage(friendly.hint);
      setRegisterState("error");
    }
  }

  async function handleVerifyAndRegister() {
    setErrorTitle("");
    if (!publicKey || !signTransaction) {
      setErrorMessage("Connect your wallet first");
      setRegisterState("error");
      return;
    }

    if (otpCode.length !== 6) {
      setErrorMessage("Enter the 6-digit code");
      setRegisterState("error");
      return;
    }

    setRegisterState("verifying");
    setErrorMessage("");

    try {
      const resp = await fetch(`${BACKEND_URL}/otp/verify-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneE164,
          code: otpCode,
          wallet: publicKey.toString(),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Verification failed");

      setRegisterState("submitting");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signedTx = await signTransaction(tx);

      const sig = await connection.sendRawTransaction(signedTx.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxSig(sig);
      setRegisterState("success");
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error("Register failed:", err);
      const friendly = toFriendlyError(err, { title: "Registration failed" });
      setErrorTitle(friendly.title);
      setErrorMessage(friendly.hint);
      setRegisterState("error");
    }
  }

  async function handleResendOtp() {
    if (!phoneE164) return;
    setErrorTitle("");
    setRegisterState("sending_otp");
    try {
      const resp = await fetch(`${BACKEND_URL}/otp/send-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneE164 }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to resend OTP");
      setRegisterState("otp_sent");
    } catch (err: any) {
      const friendly = toFriendlyError(err, { title: "Couldn't resend code" });
      setErrorTitle(friendly.title);
      setErrorMessage(friendly.hint);
      setRegisterState("error");
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* header */}
      <AppHeader />

      <AppNav/>

      {/* main content */}
      <div className="grow flex flex-col bg-white">
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-10 max-sm:p-4 font-[outfit] flex-grow">
          <div className="bg-white border-2 border-[#0B2818] rounded-[40px] max-sm:rounded-[28px] w-full max-w-[900px] min-h-[600px] max-sm:min-h-[420px] p-8 max-sm:p-5 relative shadow-sm flex flex-col z-0">

            {/* Progress Bar */}
            <div className="flex justify-center space-x-4 max-sm:space-x-2 w-full mb-12 max-sm:mb-6 z-10 relative">
              <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${step === 0 ? "bg-[#192FFD]" : "bg-[#0B2818]"}`} />
              <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${step === 0 ? "bg-gray-200" : step === 1 ? "bg-[#192FFD]" : "bg-[#0B2818]"}`} />
              <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${step === 2 ? "bg-[#192FFD]" : "bg-gray-200"}`} />
            </div>

            {/* Sliding Content */}
            <div className={`relative flex-grow w-full rounded-[32px] z-0 ${isDropdownOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
                  className="absolute inset-0 w-full h-full flex flex-col"
                >
                  {step === 0 && <WelcomeView />}
                  {step === 1 && (
                    <PhoneView
                      isDropdownOpen={isDropdownOpen}
                      setIsDropdownOpen={setIsDropdownOpen}
                      selectedCountry={selectedCountry}
                      setSelectedCountry={setSelectedCountry}
                      phoneInput={phoneInput}
                      setPhoneInput={setPhoneInput}
                      onEnter={handleSendOtp}
                    />
                  )}
                  {step === 2 && (
                    <OtpView
                      phoneE164={phoneE164}
                      otpCode={otpCode}
                      setOtpCode={setOtpCode}
                      onResend={handleResendOtp}
                      registerState={registerState}
                      onSubmit={handleVerifyAndRegister}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-[800px] mt-6 max-sm:mt-4 flex flex-col space-y-4 max-sm:space-y-3">
            {step === 0 && (
              <button
                onClick={nextStep}
                className="w-full bg-[#192FFD] border-2 border-[#0B2818] text-white font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all"
              >
                Get Started
              </button>
            )}

            {step === 1 && (
              <>
                <button
                  onClick={handleSendOtp}
                  disabled={registerState === "sending_otp" || !publicKey}
                  className="w-full bg-[#192FFD] border-2 border-[#0B2818] text-white font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all disabled:opacity-50"
                >
                  {!publicKey ? "Connect wallet first" : registerState === "sending_otp" ? "Sending code..." : "Send verification code"}
                </button>
                <button
                  onClick={prevStep}
                  className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl hover:bg-gray-50 transition-all"
                >
                  Back
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <button
                  onClick={handleVerifyAndRegister}
                  disabled={registerState === "verifying" || registerState === "submitting" || otpCode.length !== 6}
                  className="w-full bg-[#B8FF4F] border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all disabled:opacity-50"
                >
                  {registerState === "verifying" ? "Verifying OTP..." : registerState === "submitting" ? "Submitting registration..." : "Verify"}
                </button>
                <button
                  onClick={prevStep}
                  disabled={registerState === "verifying" || registerState === "submitting"}
                  className="w-full bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-4 rounded-2xl hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <AppFooter />

      <WalletCreatedModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} txSig={txSig} />

      <ErrorModal
        isOpen={registerState === "error"}
        onClose={() => setRegisterState("idle")}
        title={errorTitle || "Check your details"}
        message={errorMessage}
      />
    </div>
  );
}

// --- Sub Views ---

function WelcomeView() {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full mt-2 max-sm:mt-0">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 mb-6 max-sm:mb-4">
        <div className="w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#192FFD]"></div>
        <span className="text-[#0B2818]">WELCOME TO ZINGPAY</span>
      </div>
      <h1 className="font-[fraunces] text-5xl max-sm:text-3xl max-sm:leading-[1.1] font-black text-[#0B2818] mb-4 max-sm:mb-3">
        Money that moves <br /><span className="italic font-light">like a message.</span>
      </h1>
      <p className="text-gray-500 max-w-xl text-lg max-sm:text-sm px-2">
        Send money anywhere in the world using just a phone number. No bank accounts, no wallet addresses, no complicated setup.
      </p>
      <div className="relative w-full max-w-2xl flex flex-col items-center justify-center lg:-mt-2">
        <Image alt="solana coin" src="/sol_coin.svg" width={200} height={200} className="max-sm:w-[150px] max-sm:h-[150px]"/>
        <p className="relative text-black text-lg max-sm:text-base lg:-mt-5">Type a number. Hit send. Done.</p>
      </div>
    </div>
  );
}

function PhoneView({
  isDropdownOpen, setIsDropdownOpen, selectedCountry, setSelectedCountry, phoneInput, setPhoneInput, onEnter,
}: {
  isDropdownOpen: boolean;
  setIsDropdownOpen: (val: boolean) => void;
  selectedCountry: DialOption;
  setSelectedCountry: (val: DialOption) => void;
  phoneInput: string;
  setPhoneInput: (val: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="flex flex-col h-full text-left px-8 max-sm:px-2 py-4 max-sm:py-0 max-sm:mt-5">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 w-fit mb-8 max-sm:mb-4 max-sm:mt-2">
        <div className="w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#192FFD]"></div>
        <span className="text-[#0B2818]">STEP 1 OF 2</span>
      </div>
      <h1 className="font-jersey font-normal text-5xl max-sm:text-3xl max-sm:leading-[1.1] max-sm:text-center text-[#0B2818] mb-2 max-sm:mb-1">
        What's your number?
      </h1>
      <p className="text-gray-500 mb-10 max-sm:mb-6 text-lg max-sm:text-sm max-sm:text-center">
        We'll verify it with a one-time code. This is your identity on ZingPay, no username or email required.
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
            placeholder="Enter phone number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="grow w-full px-4 max-sm:px-3 text-lg max-sm:text-xs outline-none bg-transparent rounded-r-2xl font-[outfit]"
            onFocus={() => setIsDropdownOpen(false)}
            onKeyDown={(e) => e.key === "Enter" && onEnter()}
          />
        </div>
        <p className="text-xs max-sm:text-[10px] text-gray-400 mt-3 max-sm:mt-2 font-[outfit]">
          By continuing you agree to ZingPay's Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

function OtpView({
  phoneE164,
  otpCode,
  setOtpCode,
  onResend,
  registerState,
  onSubmit,
}: {
  phoneE164: string;
  otpCode: string;
  setOtpCode: (val: string) => void;
  onResend: () => void;
  registerState: RegisterState;
  onSubmit: () => void;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter" && otpCode.length === 6) {
      onSubmit();
    }
  };

  const handleChange = (value: string, index: number) => {
    // Allow only numeric input
    if (!/^[0-9]*$/.test(value)) return;

    const newOtp = otpCode.split("").slice(0, 6);
    // Pad array if shorter than 6 to avoid out of bounds
    while (newOtp.length < 6) newOtp.push(""); 

    newOtp[index] = value.substring(value.length - 1);
    const combined = newOtp.join("");
    setOtpCode(combined);

    // Automatically move focus to the next input if a number was typed
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
    
    // Jump focus to the end or the next available empty slot
    if (pastedData.length === 6) {
      inputRefs.current[5]?.focus();
    } else if (pastedData.length > 0) {
      inputRefs.current[pastedData.length]?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full text-left max-sm:text-center max-sm:items-center px-7 max-sm:px-1 py-4 max-sm:py-0">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 w-fit mb-8 max-sm:mb-4">
        <div className="w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#192FFD]"></div>
        <span className="text-[#0B2818]">STEP 2 OF 2</span>
      </div>
      
      <h1 className="font-jersey font-normal text-5xl mt-8 max-sm:text-4xl max-sm:leading-[1.1] text-[#0B2818] mb-2 max-sm:mb-1">
        Check your messages.
      </h1>
      
      <p className="text-gray-500 mb-10 max-sm:mb-6 text-lg max-sm:text-sm">
        We sent a 6-digit code to {phoneE164 || "your number"}
        <span className="max-sm:hidden"> via SMS.</span>
        <span className="hidden max-sm:inline">.<br />The code expires shortly, so enter it soon.</span>
      </p>

      <div className="w-full max-w-xl max-sm:flex max-sm:flex-col max-sm:items-center">
        <label className="text-sm max-sm:text-xs font-bold text-gray-700 mb-4 max-sm:mb-3 block tracking-wider uppercase">
          6-Digit Verification Code
        </label>

        {/* Input container wrapped to allow "Resend Code" to center correctly below it */}
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
                className="w-[60px] h-[60px] max-sm:w-[35px] max-sm:h-[35px] max-sm:rounded-xl border-2 border-gray-200 focus:border-[#192FFD] rounded-2xl text-center text-2xl max-sm:text-xl font-bold text-[#0B2818] outline-none transition-colors"
              />
            ))}
          </div>

          <div className="md:absolute md:bottom-0  flex justify-center w-full">
            <button
              type="button"
              onClick={onResend}
              disabled={registerState === "sending_otp"}
              className="text-[#192FFD] font-bold text-lg max-sm:text-base hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              {registerState === "sending_otp" ? "Sending..." : "Resend Code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}