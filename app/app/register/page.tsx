"use client"
import "@fontsource/fraunces";
import "@fontsource/outfit";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppNav from "@/components/AppNav";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { CountryCode } from "libphonenumber-js";
import { BACKEND_URL } from "@/lib/constants";
import { normalizeToE164 } from "@/lib/phone";
import { WalletDropdown } from "@/components/WalletDropdown";

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

// --- Country Codes Data ---
const COUNTRY_CODES = [
  { code: "AE" as CountryCode, dial: "+971" },
  { code: "AU" as CountryCode, dial: "+61" },
  { code: "BR" as CountryCode, dial: "+55" },
  { code: "CA" as CountryCode, dial: "+1" },
  { code: "CN" as CountryCode, dial: "+86" },
  { code: "DE" as CountryCode, dial: "+49" },
  { code: "ES" as CountryCode, dial: "+34" },
  { code: "FR" as CountryCode, dial: "+33" },
  { code: "GB" as CountryCode, dial: "+44" },
  { code: "IN" as CountryCode, dial: "+91" },
  { code: "JP" as CountryCode, dial: "+81" },
  { code: "KR" as CountryCode, dial: "+82" },
  { code: "MX" as CountryCode, dial: "+52" },
  { code: "NG" as CountryCode, dial: "+234" },
  { code: "RU" as CountryCode, dial: "+7" },
  { code: "US" as CountryCode, dial: "+1" },
  { code: "ZA" as CountryCode, dial: "+27" },
];

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
  const [selectedCountry, setSelectedCountry] = useState({ code: "IN" as CountryCode, dial: "+91" });
  const [phoneInput, setPhoneInput] = useState("");
  const [otpCode, setOtpCode] = useState("");

  // Logic state
  const [registerState, setRegisterState] = useState<RegisterState>("idle");
  const [phoneE164, setPhoneE164] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
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
      setErrorMessage(err.message);
      setRegisterState("error");
    }
  }

  async function handleVerifyAndRegister() {
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
      setErrorMessage(err.message || "Registration failed");
      setRegisterState("error");
    }
  }

  async function handleResendOtp() {
    if (!phoneE164) return;
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
      setErrorMessage(err.message);
      setRegisterState("error");
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* header */}
      <div className="bg-[#0B2818] flex items-center justify-around h-[131px] max-sm:h-[80px] p-4 max-sm:px-2 shrink-0">
        <Link href="/">
          <div className="flex items-center">
            <Image alt="back" src="/back.svg" width={12} height={23} className="inline-block mr-4 max-sm:mr-2 max-sm:w-2 max-sm:h-[14px]" />
            <p className="text-white font-[outfit] font-semibold text-xl max-sm:text-sm">Back</p>
          </div>
        </Link>
        <Image alt="zingpay" src="/zingpay.svg" width={172} height={57} className="w-[172px] h-auto max-sm:w-[110px]" />
        <WalletDropdown />
      </div>

      <AppNav/>

      {/* main content */}
      <div className="flex-grow flex flex-col bg-white">
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-10 max-sm:p-4 font-[outfit] flex-grow">
          <div className="bg-white border-2 border-[#0B2818] rounded-[40px] max-sm:rounded-[28px] w-full max-w-[900px] min-h-[600px] max-sm:min-h-[420px] p-8 max-sm:p-5 relative shadow-sm flex flex-col z-0">

            {/* Progress Bar */}
            <div className="flex justify-center space-x-4 max-sm:space-x-2 w-full mb-12 max-sm:mb-6 z-10 relative">
              <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${step === 0 ? "bg-[#B8FF4F]" : "bg-[#0B2818]"}`} />
              <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${step === 0 ? "bg-gray-200" : step === 1 ? "bg-[#B8FF4F]" : "bg-[#0B2818]"}`} />
              <div className={`h-3 max-sm:h-2.5 w-32 max-sm:w-16 rounded-full transition-colors duration-300 ${step === 2 ? "bg-[#B8FF4F]" : "bg-gray-200"}`} />
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
                    />
                  )}
                  {step === 2 && (
                    <OtpView
                      phoneE164={phoneE164}
                      otpCode={otpCode}
                      setOtpCode={setOtpCode}
                      onResend={handleResendOtp}
                      registerState={registerState}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {errorMessage && registerState === "error" && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-[outfit] z-10 relative">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full max-w-[800px] mt-6 max-sm:mt-4 flex flex-col space-y-4 max-sm:space-y-3">
            {step === 0 && (
              <button
                onClick={nextStep}
                className="w-full bg-[#B8FF4F] border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all"
              >
                Get Started
              </button>
            )}

            {step === 1 && (
              <>
                <button
                  onClick={handleSendOtp}
                  disabled={registerState === "sending_otp" || !publicKey}
                  className="w-full bg-[#B8FF4F] border-2 border-[#0B2818] text-[#0B2818] font-bold text-xl max-sm:text-lg py-4 max-sm:py-3.5 rounded-2xl shadow-[0px_4px_0px_0px_#0B2818] hover:translate-y-[2px] hover:shadow-[0px_2px_0px_0px_#0B2818] transition-all disabled:opacity-50"
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

      <div className="bg-[#0B2818] p-10 max-sm:p-6 flex flex-col items-center justify-center shrink-0">
        <Image alt="zingpay" src="/zingpay.svg" width={130} height={37} className="block mx-auto max-sm:w-[100px] h-auto" />
        <p className="text-white text-lg max-sm:text-sm font-normal mt-4 max-sm:mt-2 font-[outfit] font-semibold text-center max-w-sm">
          No downloads, No signups, Just open the app and go!
        </p>
      </div>

      <WalletCreatedModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} txSig={txSig} />
    </div>
  );
}

// --- Sub Views ---

function WelcomeView() {
  return (
    <div className="flex flex-col items-center justify-center text-center h-full mt-2 max-sm:mt-0">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 mb-6 max-sm:mb-4">
        <div className="w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#B8FF4F]"></div>
        <span className="text-[#0B2818]">WELCOME TO ZINGPAY</span>
      </div>
      <h1 className="font-[fraunces] text-5xl max-sm:text-3xl max-sm:leading-[1.1] font-black text-[#0B2818] mb-4 max-sm:mb-3">
        Money that moves <br /><span className="italic font-light">like a message.</span>
      </h1>
      <p className="text-gray-500 mb-8 max-sm:mb-5 max-w-xl text-lg max-sm:text-sm px-2">
        Send money anywhere in the world using just a phone number. No bank accounts, no wallet addresses, no complicated setup.
      </p>
      <div className="bg-[#0B2818] w-full max-w-2xl rounded-[40px] max-sm:rounded-3xl flex flex-col items-center justify-center p-10 max-sm:p-6 mt-auto">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-4 max-sm:mb-2 w-16 h-16 max-sm:w-10 max-sm:h-10">
          <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="#B8FF4F" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-white text-lg max-sm:text-base font-semibold">Type a number. Hit send. Done.</p>
      </div>
    </div>
  );
}

function PhoneView({
  isDropdownOpen, setIsDropdownOpen, selectedCountry, setSelectedCountry, phoneInput, setPhoneInput,
}: {
  isDropdownOpen: boolean;
  setIsDropdownOpen: (val: boolean) => void;
  selectedCountry: { code: CountryCode; dial: string };
  setSelectedCountry: (val: { code: CountryCode; dial: string }) => void;
  phoneInput: string;
  setPhoneInput: (val: string) => void;
}) {
  return (
    <div className="flex flex-col h-full text-left px-8 max-sm:px-2 py-4 max-sm:py-0">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 w-fit mb-8 max-sm:mb-4">
        <div className="w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#B8FF4F]"></div>
        <span className="text-[#0B2818]">STEP 1 OF 2</span>
      </div>
      <h1 className="font-[fraunces] text-5xl max-sm:text-3xl max-sm:leading-[1.1] font-black text-[#0B2818] mb-2 max-sm:mb-1">
        What's your <br /><span className="italic font-light">number?</span>
      </h1>
      <p className="text-gray-500 mb-10 max-sm:mb-6 text-lg max-sm:text-sm">
        We'll verify it with a one-time code. This is your identity on ZingPay, no username or email required.
      </p>
      <div className="w-full max-w-xl">
        <label className="text-sm max-sm:text-xs font-bold text-gray-700 mb-2 max-sm:mb-1.5 block tracking-wider">PHONE NUMBER</label>
        <div className="flex border-2 border-[#0B2818] rounded-2xl h-16 max-sm:h-14 relative bg-white z-20">
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="relative flex items-center justify-center px-6 max-sm:px-4 border-r-2 border-[#0B2818] bg-white font-[outfit] font-semibold text-lg max-sm:text-base text-[#0B2818] hover:bg-gray-50 cursor-pointer rounded-l-2xl shrink-0"
          >
            {selectedCountry.code} <span className="ml-2 max-sm:ml-1">{selectedCountry.dial}</span>
            <svg className={`w-4 h-4 max-sm:w-3 max-sm:h-3 ml-2 max-sm:ml-1 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          {isDropdownOpen && (
            <div className="absolute z-[100] top-[68px] max-sm:top-[60px] left-[-2px] w-[180px] max-sm:w-[150px] max-h-[220px] max-sm:max-h-[180px] overflow-y-auto bg-white border-2 border-[#0B2818] rounded-xl shadow-[0px_4px_0px_0px_#0B2818] flex flex-col">
              {COUNTRY_CODES.map((country) => (
                <div
                  key={country.code + country.dial}
                  className="px-5 max-sm:px-4 py-3 max-sm:py-2.5 cursor-pointer hover:bg-[#B8FF4F] hover:text-[#0B2818] text-[#0B2818] transition-colors border-b border-gray-100 last:border-b-0 font-[outfit] font-semibold text-lg max-sm:text-base flex items-center justify-between"
                  onClick={() => { setSelectedCountry(country); setIsDropdownOpen(false); }}
                >
                  <span>{country.code}</span>
                  <span className="text-gray-500 text-base max-sm:text-sm">{country.dial}</span>
                </div>
              ))}
            </div>
          )}
          <input
            type="tel"
            placeholder="Enter phone number"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="flex-grow w-full px-4 max-sm:px-3 text-lg max-sm:text-base outline-none bg-transparent rounded-r-2xl font-[outfit]"
            onFocus={() => setIsDropdownOpen(false)}
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
  phoneE164, otpCode, setOtpCode, onResend, registerState,
}: {
  phoneE164: string;
  otpCode: string;
  setOtpCode: (val: string) => void;
  onResend: () => void;
  registerState: RegisterState;
}) {
  return (
    <div className="flex flex-col h-full text-left px-8 max-sm:px-2 py-4 max-sm:py-0">
      <div className="border border-[#0B2818] rounded-full px-4 max-sm:px-3 py-1 max-sm:py-0.5 text-sm max-sm:text-[10px] font-semibold flex items-center space-x-2 w-fit mb-8 max-sm:mb-4">
        <div className="w-2 h-2 max-sm:w-1.5 max-sm:h-1.5 rounded-full bg-[#B8FF4F]"></div>
        <span className="text-[#0B2818]">STEP 2 OF 2</span>
      </div>
      <h1 className="font-[fraunces] text-5xl max-sm:text-3xl max-sm:leading-[1.1] font-black text-[#0B2818] mb-2 max-sm:mb-1">
        Check your <br /><span className="italic font-light">messages.</span>
      </h1>
      <p className="text-gray-500 mb-10 max-sm:mb-6 text-lg max-sm:text-sm">
        We sent a 6-digit code to {phoneE164 || "your number"} via SMS.
      </p>
      <div className="w-full max-w-xl">
        <label className="text-sm max-sm:text-xs font-bold text-gray-700 mb-2 max-sm:mb-1.5 block tracking-wider">VERIFICATION CODE</label>
        <div className="flex border-2 border-[#0B2818] rounded-2xl overflow-hidden h-16 max-sm:h-14">
          <input
            type="text"
            placeholder="OXXXXX"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="flex-grow px-6 max-sm:px-4 text-xl max-sm:text-lg tracking-[0.5em] max-sm:tracking-[0.3em] outline-none font-[outfit] font-semibold"
            maxLength={6}
            autoFocus
          />
        </div>
        <div className="flex justify-center mt-6 max-sm:mt-4">
          <button
            type="button"
            onClick={onResend}
            disabled={registerState === "sending_otp"}
            className="flex items-center text-gray-500 hover:text-[#0B2818] text-sm max-sm:text-xs font-semibold space-x-2 transition-colors disabled:opacity-50"
          >
            <div className="w-8 h-8 max-sm:w-6 max-sm:h-6 rounded-full border border-gray-300 flex items-center justify-center">
              <span className="text-xs max-sm:text-[10px]">&#x221e;</span>
            </div>
            <span>{registerState === "sending_otp" ? "Sending..." : "Resend Code"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
