"use client"

import { useEffect, useState } from "react"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import bs58 from "bs58"
import { PROGRAM_ID } from "./constants"

// Anchor account discriminator for RegistryAccount (from public/idl/solpay.json).
const REGISTRY_DISCRIMINATOR = Uint8Array.from([113, 93, 106, 201, 100, 166, 146, 98])

// Byte offset of the `wallet` field inside RegistryAccount:
// 8 (discriminator) + 32 (owner pubkey) = 40.
const WALLET_FIELD_OFFSET = 40

/** True when the app is being served from a local dev host. */
export function isLocalhost(): boolean {
  if (typeof window === "undefined") return false
  const host = window.location.hostname
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
}

/**
 * Checks on-chain whether the connected wallet has a registered phone number.
 *
 * A wallet is "registered" if there's a RegistryAccount whose `wallet` field
 * matches it — covers both the register flow and auto-registration on claim.
 *
 * `registered` is `null` while unknown (no wallet connected, loading, or the
 * lookup failed) and a boolean once resolved.
 */
export function useRegistration() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [registered, setRegistered] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!publicKey) {
      setRegistered(null)
      setLoading(false)
      return
    }

    setLoading(true)
    connection
      .getProgramAccounts(PROGRAM_ID, {
        commitment: "confirmed",
        dataSlice: { offset: 0, length: 0 }, // we only need existence, not data
        filters: [
          { memcmp: { offset: 0, bytes: bs58.encode(REGISTRY_DISCRIMINATOR) } },
          { memcmp: { offset: WALLET_FIELD_OFFSET, bytes: publicKey.toBase58() } },
        ],
      })
      .then((accounts) => {
        if (cancelled) return
        setRegistered(accounts.length > 0)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRegistered(null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [connection, publicKey])

  return { registered, loading }
}
