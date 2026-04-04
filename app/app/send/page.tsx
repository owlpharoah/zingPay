"use client"
import { useEffect, useState } from "react"
import "@fontsource/fraunces"
import "@fontsource/outfit"
import Image from "next/image"
import Link from "next/link"
import AppNav from "@/components/AppNav"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js"
import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js"
import { hashPhone, toHex } from "@/lib/hash"
import { getRegistryPda, getEscrowPda } from "@/lib/program"
import { PROGRAM_ID, BACKEND_URL } from "@/lib/constants"
import * as anchor from "@coral-xyz/anchor"
import { WalletDropdown } from "@/components/WalletDropdown"

const ESCROW_EXPIRY_SECONDS = 72 * 3600

// Country dropdown maps dial code to CountryCode for libphonenumber-js
const countries = [
  { code: "+91", label: "IN +91", country: "IN" as CountryCode },
  { code: "+1", label: "US +1", country: "US" as CountryCode },
  { code: "+44", label: "UK +44", country: "GB" as CountryCode },
  { code: "+61", label: "AU +61", country: "AU" as CountryCode },
  { code: "+971", label: "AE +971", country: "AE" as CountryCode },
  { code: "+65", label: "SG +65", country: "SG" as CountryCode },
  { code: "+81", label: "JP +81", country: "JP" as CountryCode },
]

const currencies = ["SOL", "USD", "INR", "EUR", "GBP", "JPY", "AED", "SGD"]

type PendingEscrow = {
  escrow: string
  phone: string
  phoneHashHex: string
  amountSol: number
  createdAt: number
  expiresAt: number
}

export default function Send() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  // Form State
  const [phone, setPhone] = useState("")
  const [amount, setAmount] = useState("")
  const [countryCode, setCountryCode] = useState("+91")
  const [currency, setCurrency] = useState("SOL")

  // UI State
  const [isCountryOpen, setIsCountryOpen] = useState(false)
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false)

  // Transaction State
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "partial_success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [txSig, setTxSig] = useState("")
  const [pendingEscrow, setPendingEscrow] = useState<PendingEscrow | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [sendMode, setSendMode] = useState<"direct" | "escrow" | null>(null)

  // Rate conversion
  const [solRate, setSolRate] = useState<number>(1)
  const [rateLoading, setRateLoading] = useState(false)
  const [rateError, setRateError] = useState("")

  const enteredAmount = Number(amount || 0)
  const solAmount = currency === "SOL" ? enteredAmount : solRate > 0 ? enteredAmount / solRate : 0

  // Fetch SOL rate when currency changes
  useEffect(() => {
    let cancelled = false
    async function loadRate() {
      if (currency === "SOL") {
        setSolRate(1)
        setRateError("")
        setRateLoading(false)
        return
      }
      setRateLoading(true)
      setRateError("")
      try {
        const resp = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=${currency.toLowerCase()}`
        )
        const data = await resp.json()
        const nextRate = Number(data?.solana?.[currency.toLowerCase()])
        if (!nextRate || Number.isNaN(nextRate)) throw new Error("Rate unavailable")
        if (!cancelled) {
          setSolRate(nextRate)
          setRateError("")
        }
      } catch {
        if (!cancelled) setRateError(`Could not fetch SOL/${currency} rate.`)
      } finally {
        if (!cancelled) setRateLoading(false)
      }
    }
    loadRate()
    return () => { cancelled = true }
  }, [currency])

  function getCountryForDial(dial: string): CountryCode {
    return countries.find(c => c.code === dial)?.country || "IN"
  }

  function appendHistoryRecord(record: {
    txSig: string
    phone: string
    amountSol: string
    mode: "direct" | "escrow"
    createdAt: number
  }) {
    const historyKey = publicKey
      ? `solpay_sent_history_${publicKey.toString()}`
      : "solpay_sent_history_guest"
    try {
      const raw = localStorage.getItem(historyKey)
      const current = raw ? JSON.parse(raw) : []
      const next = [record, ...(Array.isArray(current) ? current : [])].slice(0, 50)
      localStorage.setItem(historyKey, JSON.stringify(next))
    } catch {
      localStorage.setItem(historyKey, JSON.stringify([record]))
    }
  }

  function readEscrowDetails(accountData: Uint8Array) {
    const amountLamports = Number(
      new DataView(accountData.buffer, accountData.byteOffset + 72, 8).getBigUint64(0, true)
    )
    const createdAt = Number(
      new DataView(accountData.buffer, accountData.byteOffset + 80, 8).getBigInt64(0, true)
    )
    return {
      amountSol: amountLamports / LAMPORTS_PER_SOL,
      createdAt,
      expiresAt: createdAt + ESCROW_EXPIRY_SECONDS,
    }
  }

  function formatTimeLeft(seconds: number): string {
    if (seconds <= 0) return "Expired (refund available)"
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hrs}h ${mins}m left`
  }

  async function resendClaimSms() {
    if (!pendingEscrow) return
    setIsResending(true)
    try {
      const notifyResp = await fetch(`${BACKEND_URL}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: pendingEscrow.phone,
          phone_hash: pendingEscrow.phoneHashHex,
          escrow_address: pendingEscrow.escrow,
        }),
      })
      const notifyData = await notifyResp.json().catch(() => ({ error: "Unknown error" }))
      if (!notifyResp.ok) throw new Error(notifyData.error || "Failed to resend SMS")
      setStatus("success")
      setMessage(`Reminder SMS sent again to ${pendingEscrow.phone}.`)
    } catch {
      setStatus("partial_success")
      setMessage(`Escrow exists, but SMS resend failed. Share claim link manually.`)
    } finally {
      setIsResending(false)
    }
  }

  async function copyClaimLink() {
    if (!pendingEscrow) return
    const claimUrl = `${window.location.origin}/claim?escrow=${pendingEscrow.escrow}&phone=${encodeURIComponent(pendingEscrow.phone)}`
    await navigator.clipboard.writeText(claimUrl)
    setStatus("success")
    setMessage("Claim link copied. Share it with the recipient.")
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()

    if (!publicKey) {
      setMessage("Connect your wallet first")
      setStatus("error")
      return
    }

    const computedSolAmount = currency === "SOL"
      ? parseFloat(amount)
      : solRate > 0 ? parseFloat(amount) / solRate : NaN

    if (!computedSolAmount || computedSolAmount <= 0) {
      setMessage(currency === "SOL" ? "Enter a valid SOL amount" : `Enter a valid ${currency} amount`)
      setStatus("error")
      return
    }

    if (currency !== "SOL" && (!solRate || rateError)) {
      setMessage(`Cannot convert ${currency} to SOL right now. Try again.`)
      setStatus("error")
      return
    }

    // Validate phone
    let phoneE164: string
    try {
      const country = getCountryForDial(countryCode)
      const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`
      const parsed = fullPhone.startsWith("+")
        ? parsePhoneNumberFromString(fullPhone)
        : parsePhoneNumberFromString(phone.trim(), country)
      if (!parsed?.isValid()) throw new Error("Invalid")
      phoneE164 = parsed.number
    } catch {
      setMessage("Enter a valid phone number")
      setStatus("error")
      return
    }

    setStatus("sending")
    setMessage("")
    setTxSig("")
    setPendingEscrow(null)
    setSendMode(null)

    try {
      const phoneHash = await hashPhone(phoneE164)
      const phoneHashArray = Array.from(phoneHash)
      const lamports = Math.round(computedSolAmount * LAMPORTS_PER_SOL)

      // Check if phone is registered
      const [registryPda] = getRegistryPda(phoneHash)
      const registryInfo = await connection.getAccountInfo(registryPda)
      const isRegistered = registryInfo !== null

      const [escrowPda] = getEscrowPda(publicKey, phoneHash)

      if (!isRegistered) {
        const existingEscrowInfo = await connection.getAccountInfo(escrowPda)
        if (existingEscrowInfo) {
          const details = readEscrowDetails(existingEscrowInfo.data)
          setPendingEscrow({
            escrow: escrowPda.toString(),
            phone: phoneE164,
            phoneHashHex: toHex(phoneHash),
            amountSol: details.amountSol,
            createdAt: details.createdAt,
            expiresAt: details.expiresAt,
          })
          setStatus("partial_success")
          setMessage(`A pending escrow already exists for ${phoneE164}. Resend claim link instead of creating a new escrow.`)
          return
        }
      }

      // Load IDL
      const idlResp = await fetch("/idl/solpay.json")
      const idl = await idlResp.json()

      const dummyWallet = {
        publicKey,
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any) => txs,
      }
      const provider = new anchor.AnchorProvider(connection, dummyWallet as any, { commitment: "confirmed" })
      const program = new anchor.Program(idl, provider)

      let ix
      if (isRegistered) {
        const registryAccount = await (program.account as any).registryAccount.fetch(registryPda)
        const recipientWallet = registryAccount.wallet as PublicKey

        ix = await program.methods
          .sendDirect(phoneHashArray, new anchor.BN(lamports))
          .accounts({
            sender: publicKey,
            registry: registryPda,
            recipientWallet: recipientWallet,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      } else {
        ix = await program.methods
          .sendEscrow(phoneHashArray, new anchor.BN(lamports))
          .accounts({
            sender: publicKey,
            escrow: escrowPda,
            systemProgram: SystemProgram.programId,
          })
          .instruction()
      }

      const tx = new Transaction().add(ix)
      tx.feePayer = publicKey
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

      const sig = await sendTransaction(tx, connection)
      await connection.confirmTransaction(sig, "confirmed")

      setTxSig(sig)
      setSendMode(isRegistered ? "direct" : "escrow")
      appendHistoryRecord({
        txSig: sig,
        phone: phoneE164,
        amountSol: computedSolAmount.toFixed(6),
        mode: isRegistered ? "direct" : "escrow",
        createdAt: Date.now(),
      })

      if (!isRegistered) {
        try {
          const notifyResp = await fetch(`${BACKEND_URL}/notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phoneE164,
              phone_hash: toHex(phoneHash),
              escrow_address: escrowPda.toString(),
            }),
          })
          const notifyData = await notifyResp.json().catch(() => ({ error: "Unknown error" }))
          if (!notifyResp.ok) throw new Error(notifyData.error || "Failed to send SMS")
          setMessage(`Escrow created! SMS sent to ${phoneE164}. They have 72h to claim.`)
          setStatus("success")
        } catch {
          setMessage(`Escrow created, but SMS could not be sent. Share the claim link manually.`)
          setPendingEscrow({
            escrow: escrowPda.toString(),
            phone: phoneE164,
            phoneHashHex: toHex(phoneHash),
            amountSol: computedSolAmount,
            createdAt: Math.floor(Date.now() / 1000),
            expiresAt: Math.floor(Date.now() / 1000) + ESCROW_EXPIRY_SECONDS,
          })
          setStatus("partial_success")
        }
      } else {
        setMessage("SOL sent directly to registered wallet!")
        setStatus("success")
      }
    } catch (err: any) {
      console.error("Send failed:", err)
      setMessage(err.message || "Transaction failed")
      setStatus("error")
    }
  }

  const resetForm = () => {
    setPhone("")
    setAmount("")
    setStatus("idle")
    setMessage("")
    setTxSig("")
    setPendingEscrow(null)
    setSendMode(null)
  }

  const currencySymbol = (c: string) => {
    const map: Record<string, string> = { INR: "\u20b9", USD: "$", EUR: "\u20ac", GBP: "\u00a3", JPY: "\u00a5", AED: "AED ", SGD: "S$", SOL: "SOL " }
    return map[c] || c + " "
  }

  return (
    <div className="bg-[#F6F5F0] min-h-screen relative font-[outfit]">

      {/*header*/}
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

      <AppNav />

      {/* --- MAIN MIDDLE SECTION --- */}
      <main className="max-w-3xl mx-auto px-6 max-sm:px-4 py-12 max-sm:py-6 z-10 relative">
        <h1 className="text-5xl max-sm:text-3xl text-[#0B2818] font-[fraunces] font-black mb-2 tracking-tight">
          Send money <span className="italic font-normal">Instantly.</span>
        </h1>
        <p className="text-[#6B7280] text-sm md:text-base max-sm:text-xs mb-8 max-sm:mb-6 font-medium">
          Phone number only. No wallet needed on their end.
        </p>

        {/* Form Card */}
        <div className="bg-[#F6F5F0] rounded-[2rem] max-sm:rounded-2xl border-2 border-[#0B2818] p-8 max-sm:p-5 shadow-sm relative z-20">
          <form onSubmit={handleSend}>

            {/* Invisible overlay moved inside the form to respect stacking context */}
            {(isCountryOpen || isCurrencyOpen) && (
              <div
                className="fixed inset-0 z-40"
                onClick={() => {
                  setIsCountryOpen(false)
                  setIsCurrencyOpen(false)
                }}
              />
            )}

            {/* Phone Number Input - Dynamic z-index so only active dropdown stays above overlay */}
            <div className={`mb-8 max-sm:mb-5 relative ${isCountryOpen ? 'z-50' : 'z-20'}`}>
              <label className="block text-xs max-sm:text-[10px] font-bold text-[#4B5563] mb-3 max-sm:mb-2 tracking-wide">
                PHONE NUMBER
              </label>
              <div className="flex bg-white border-2 border-[#0B2818] rounded-2xl max-sm:rounded-xl overflow-visible h-[60px] max-sm:h-[50px]">

                {/* Custom Country Dropdown */}
                <div className="relative flex items-center border-r-2 border-[#0B2818] bg-white rounded-l-2xl max-sm:rounded-l-xl">
                  <div
                    onClick={() => {
                      setIsCountryOpen(!isCountryOpen)
                      setIsCurrencyOpen(false)
                    }}
                    className="flex items-center justify-between w-[110px] max-sm:w-[90px] h-full px-4 max-sm:px-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-bold text-[#0B2818] text-base max-sm:text-sm font-[outfit]">
                      {countries.find(c => c.code === countryCode)?.label}
                    </span>
                    <svg className={`w-2.5 h-2.5 text-[#0B2818] transition-transform duration-200 ${isCountryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* Dropdown Menu */}
                  {isCountryOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-0 w-[140px] bg-white border-2 border-[#0B2818] rounded-xl shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                      {countries.map((c) => (
                        <div
                          key={c.code}
                          onClick={() => {
                            setCountryCode(c.code)
                            setIsCountryOpen(false)
                          }}
                          className={`px-4 py-3 max-sm:py-2.5 text-sm max-sm:text-xs font-bold font-[outfit] cursor-pointer transition-colors border-b last:border-b-0 border-[#0B2818]/10
                            ${countryCode === c.code ? 'bg-[#B8FF4F] text-[#0B2818]' : 'text-[#0B2818] hover:bg-[#B8FF4F]/50'}
                          `}
                        >
                          {c.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="flex-1 px-4 max-sm:px-3 w-full text-base max-sm:text-sm font-medium font-[outfit] text-[#0B2818] focus:outline-none placeholder:text-gray-400 placeholder:font-normal bg-transparent rounded-r-2xl max-sm:rounded-r-xl"
                />
              </div>
            </div>

            {/* Amount Input - Dynamic z-index */}
            <div className={`mb-4 relative ${isCurrencyOpen ? 'z-50' : 'z-20'}`}>
              <label className="block text-xs max-sm:text-[10px] font-bold text-[#4B5563] mb-3 max-sm:mb-2 tracking-wide">
                AMOUNT
              </label>
              <div className="flex items-center bg-white border-2 border-[#0B2818] rounded-2xl max-sm:rounded-xl overflow-visible h-[60px] max-sm:h-[50px] px-3 max-sm:px-2">

                {/* Custom Currency Dropdown */}
                <div className="relative flex items-center h-full py-2">
                  <div
                    onClick={() => {
                      setIsCurrencyOpen(!isCurrencyOpen)
                      setIsCountryOpen(false)
                    }}
                    className="flex items-center justify-between bg-[#0B2818] hover:bg-[#0B2818]/90 rounded-full w-[85px] max-sm:w-[75px] h-full px-4 max-sm:px-3 cursor-pointer transition-colors"
                  >
                    <span className="font-semibold text-white text-sm max-sm:text-xs font-[outfit]">
                      {currency}
                    </span>
                    <svg className={`w-2 h-2 text-white transition-transform duration-200 ${isCurrencyOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 10 6" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* Dropdown Menu */}
                  {isCurrencyOpen && (
                    <div className="absolute top-[calc(100%+4px)] left-0 w-[100px] bg-white border-2 border-[#0B2818] rounded-xl shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150 z-50 max-h-[200px] overflow-y-auto">
                      {currencies.map((curr) => (
                        <div
                          key={curr}
                          onClick={() => {
                            setCurrency(curr)
                            setIsCurrencyOpen(false)
                          }}
                          className={`px-4 py-2.5 max-sm:py-2 text-sm max-sm:text-xs font-bold font-[outfit] cursor-pointer transition-colors border-b last:border-b-0 border-[#0B2818]/10
                            ${currency === curr ? 'bg-[#B8FF4F] text-[#0B2818]' : 'text-[#0B2818] hover:bg-[#B8FF4F]/50'}
                          `}
                        >
                          {curr}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={currency === "SOL" ? "0.05" : "100"}
                  className="flex-1 px-4 max-sm:px-2 w-full text-base max-sm:text-sm font-medium font-[outfit] text-[#0B2818] focus:outline-none placeholder:text-gray-400 placeholder:font-normal bg-transparent"
                />
              </div>

              {/* Helper Texts - Live rate info */}
              <div className="flex justify-between mt-3 max-sm:mt-2 text-[13px] max-sm:text-[11px] font-medium px-1 relative z-30">
                <span className="text-[#D39B82]">
                  {currency === "SOL"
                    ? `${enteredAmount.toFixed(6)} SOL`
                    : `~ ${solAmount.toFixed(6)} SOL`}
                </span>
                <span className="text-[#D39B82]">
                  {currency === "SOL"
                    ? "Recipient receives exact SOL amount"
                    : rateLoading
                      ? `Loading SOL/${currency} rate...`
                      : rateError
                        ? rateError
                        : `1 SOL = ${solRate.toFixed(2)} ${currency}`}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={status === "sending" || !publicKey || (currency !== "SOL" && (!!rateError || rateLoading))}
              className="w-full mt-8 max-sm:mt-6 bg-[#B8FF4F] hover:bg-[#a6f03e] text-[#0B2818] text-lg max-sm:text-base font-bold py-4 max-sm:py-3.5 rounded-2xl border-2 border-[#0B2818] shadow-[0_4px_0_0_#0B2818] active:shadow-none active:translate-y-1 transition-all duration-150 relative z-30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {!publicKey
                ? "Connect wallet to send"
                : status === "sending"
                  ? "Processing payment..."
                  : "Send now"}
            </button>
          </form>
        </div>

        {/* Status Messages */}
        {message && status !== "success" && (
          <div className={`mt-6 rounded-2xl border-2 p-4 text-sm font-medium font-[outfit] ${
            status === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-yellow-300 bg-yellow-50 text-yellow-800"
          }`}>
            {message}
          </div>
        )}

        {/* Explorer Link */}
        {txSig && status !== "success" && (
          <a
            href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-[#0B2818] underline font-[outfit]"
          >
            View transaction on Solana Explorer
          </a>
        )}

        {/* Pending Escrow Actions */}
        {pendingEscrow && status === "partial_success" && (
          <div className="mt-6 bg-white rounded-2xl border-2 border-[#0B2818] p-6 space-y-3 font-[outfit]">
            <h3 className="text-sm font-bold text-[#0B2818]">Pending escrow found</h3>
            <div className="text-xs text-[#4B5563] space-y-1">
              <p>Phone: {pendingEscrow.phone}</p>
              <p>Escrow amount: {pendingEscrow.amountSol.toFixed(4)} SOL</p>
              <p>Created: {new Date(pendingEscrow.createdAt * 1000).toLocaleString()}</p>
              <p>Refund timer: {formatTimeLeft(pendingEscrow.expiresAt - Math.floor(Date.now() / 1000))}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={resendClaimSms}
                disabled={isResending}
                className="bg-[#0B2818] text-white font-bold py-3 rounded-xl text-sm disabled:opacity-50"
              >
                {isResending ? "Resending SMS..." : "Resend claim SMS"}
              </button>
              <button
                onClick={copyClaimLink}
                className="bg-white border-2 border-[#0B2818] text-[#0B2818] font-bold py-3 rounded-xl text-sm"
              >
                Copy claim link
              </button>
            </div>
          </div>
        )}
      </main>
      {/* --- END MAIN MIDDLE SECTION --- */}

      {/* BOTTOM BAND: Scrolling Left */}
      <div className="bg-[#B8FF4F] ml-auto rounded-l-[99px] max-sm:rounded-l-full h-[91px] max-sm:h-[60px] relative mt-12 max-sm:mt-6 overflow-hidden w-full max-w-[95%] z-20 border-y-2 border-l-2 border-[#0B2818]">
        <div className="flex animate-marquee-left w-max items-center h-full text-[#0B2818]">
          <ul className="flex items-center space-x-10 max-sm:space-x-6 px-5 max-sm:px-3 whitespace-nowrap">
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Send by phone number</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Secure escrow</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">OTP verification</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Refund if unclaimed</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Live status tracking</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Fast, low-cost</p></li>
          </ul>
        </div>
      </div>

      {/* BOTTOM BAND: Scrolling Right */}
      <div className="bg-[#B8FF4F] mr-auto rounded-r-[99px] max-sm:rounded-r-full h-[91px] max-sm:h-[60px] relative mt-6 max-sm:mt-4 mb-16 max-sm:mb-10 overflow-hidden w-full max-w-[95%] z-20 border-y-2 border-r-2 border-[#0B2818]">
        <div className="flex animate-marquee-right w-max items-center h-full text-[#0B2818]">
          <ul className="flex items-center space-x-10 max-sm:space-x-6 px-5 max-sm:px-3 whitespace-nowrap">
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Refund if unclaimed</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Live status tracking</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Fast, low-cost</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Send by phone number</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">Secure escrow</p></li>
            <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} className="max-sm:w-5 max-sm:h-5" /></li>
            <li><p className="font-[fraunces] font-black text-3xl max-sm:text-xl">OTP verification</p></li>
          </ul>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#0B2818] p-10 max-sm:p-6 flex flex-col items-center justify-center shrink-0">
        <Image alt="zingpay" src="/zingpay.svg" width={130} height={37} className="block mx-auto max-sm:w-[100px] h-auto" />
        <p className="text-white text-lg max-sm:text-sm font-normal mt-4 max-sm:mt-2 font-[outfit] font-semibold text-center max-w-sm">
          No downloads, No signups, Just open the app and go!
        </p>
      </div>

      {/* --- SUCCESS MODAL OVERLAY --- */}
      {status === "success" && (
        <div className="fixed inset-0 bg-[#0B2818]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#F6F5F0] w-full max-w-md rounded-[2rem] max-sm:rounded-3xl border-2 border-[#0B2818] p-8 max-sm:p-6 flex flex-col items-center shadow-2xl relative animate-in fade-in zoom-in duration-200">

            {/* Top decorative drag handle */}
            <div className="w-12 h-1.5 bg-[#0B2818]/20 rounded-full mb-8 max-sm:mb-6"></div>

            {/* Checkmark Icon */}
            <div className="w-[72px] h-[72px] max-sm:w-[60px] max-sm:h-[60px] bg-[#0B2818] rounded-full flex items-center justify-center mb-6 shadow-md">
              <svg className="w-8 h-8 max-sm:w-6 max-sm:h-6 text-[#B8FF4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            {/* Heading */}
            <h2 className="text-4xl max-sm:text-3xl text-[#0B2818] font-[fraunces] font-black mb-8 max-sm:mb-6 tracking-tight">
              Money <span className="italic font-normal">Sent!</span>
            </h2>

            {/* Details Table */}
            <div className="w-full bg-white border-2 border-[#0B2818] rounded-2xl max-sm:rounded-xl mb-8 max-sm:mb-6 overflow-hidden font-[outfit]">
              <div className="flex items-center justify-between p-4 max-sm:p-3 border-b-2 border-[#0B2818]">
                <span className="text-[#6B7280] font-medium text-sm max-sm:text-xs">To</span>
                <span className="font-bold text-[#0B2818] text-base max-sm:text-sm">{countryCode}-{phone}</span>
              </div>
              <div className="flex items-center justify-between p-4 max-sm:p-3 border-b-2 border-[#0B2818]">
                <span className="text-[#6B7280] font-medium text-sm max-sm:text-xs">Amount</span>
                <span className="font-bold text-[#0B2818] text-base max-sm:text-sm">
                  {currency === "SOL" ? `${amount} SOL` : `${currencySymbol(currency)}${amount} (${solAmount.toFixed(6)} SOL)`}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 max-sm:p-3 border-b-2 border-[#0B2818]">
                <span className="text-[#6B7280] font-medium text-sm max-sm:text-xs">Mode</span>
                <span className="font-bold text-[#0B2818] text-base max-sm:text-sm capitalize">{sendMode || "—"}</span>
              </div>
              <div className="flex items-center justify-between p-4 max-sm:p-3">
                <span className="text-[#6B7280] font-medium text-sm max-sm:text-xs">Status</span>
                <span className="font-bold text-[#0CA750] text-base max-sm:text-sm">Confirmed</span>
              </div>
            </div>

            {/* Explorer Link */}
            {txSig && (
              <a
                href={`https://explorer.solana.com/tx/${txSig}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-white border-2 border-[#0B2818] text-[#0B2818] text-sm font-bold py-3 rounded-2xl mb-4 max-sm:mb-3 block"
              >
                View on Solana Explorer
              </a>
            )}

            {/* Modal Actions */}
            <button
              onClick={resetForm}
              className="w-full bg-[#B8FF4F] hover:bg-[#a6f03e] text-[#0B2818] text-base max-sm:text-sm font-bold py-3.5 max-sm:py-3 rounded-2xl max-sm:rounded-xl border-2 border-[#0B2818] shadow-[0_4px_0_0_#0B2818] max-sm:shadow-[0_3px_0_0_#0B2818] active:shadow-none active:translate-y-1 transition-all duration-150 mb-4 max-sm:mb-3"
            >
              Send another
            </button>

            {/* Message */}
            {message && (
              <p className="text-xs text-[#4B5563] text-center font-[outfit]">{message}</p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
