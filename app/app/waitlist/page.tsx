"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">("idle");
  const [error, setError] = useState("");

  const submitted = status === "submitted";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim();

    if (!value) {
      setError("Please enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Hmm, that doesn't look like a valid email.");
      return;
    }

    setError("");
    setStatus("submitting");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Something went wrong. Please try again.");
      }

      setEmail(value);
      setStatus("submitted");
    } catch (err) {
      setStatus("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  function reset() {
    setStatus("idle");
    setEmail("");
    setError("");
  }

  return (
    <div className="w-full overflow-x-hidden font-[outfit] text-[#0B2818] bg-[#F7F4EE]">
      {/* ===== HEADER ===== */}
      <header className="bg-[#0B2818]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-[18px] sm:px-6 lg:px-10">
          <Link href="/" className="flex flex-none items-center">
            <Image alt="ZingPay" src="/zingpay.svg" width={118} height={41} className="block h-auto w-[118px]" />
          </Link>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section
        id="top"
        className="relative bg-[url(/verticalGrid.svg)] bg-cover bg-center pt-9 pb-12 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-24"
      >
        <div
          id="join"
          className="mx-auto flex max-w-7xl flex-wrap items-center gap-8 px-4 sm:px-6 lg:gap-16 lg:px-10"
        >
          {/* LEFT: copy + form */}
          <div className="min-w-[300px] flex-1 basis-[440px]">
            <div className="mb-[22px] inline-flex items-center gap-2.5 rounded-[40px] bg-[#0B2818] px-4 py-2">
              <span className="inline-block h-2 w-2 rounded-full bg-[#B8FF4F]" />
              <span className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[#B8FF4F]">
                Early access: waitlist open
              </span>
            </div>

            <h1 className="font-jersey mb-[18px] text-5xl leading-[0.95] text-[#0B2818] sm:text-6xl md:text-7xl lg:text-[86px]">
              Be first to send money like a message.
            </h1>

            <p className="mb-[30px] max-w-[540px] text-base leading-[1.5] text-[#3c5a48] sm:text-lg lg:text-xl">
              ZingPay lets you send money anywhere with just a phone number, no wallet addresses, no
              setup. Join the waitlist for early access and founding-member perks.
            </p>

            {/* FORM */}
            {!submitted && (
              <form onSubmit={onSubmit} className="max-w-[560px]">
                <div className="flex flex-wrap items-stretch gap-3">
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="you@email.com"
                    autoComplete="email"
                    disabled={status === "submitting"}
                    className="h-[60px] min-w-0 flex-1 basis-[240px] rounded-[18px] border-2 border-[#0B2818] bg-white px-5 text-lg text-[#0B2818] outline-none focus:border-[#192FFD]"
                  />
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="h-[60px] flex-none whitespace-nowrap rounded-[18px] border-2 border-[#0B2818] bg-[#192FFD] px-7 text-lg font-bold text-white shadow-[0px_4px_0px_0px_#0B2818] transition-transform duration-150 hover:translate-y-0.5 hover:shadow-[0px_2px_0px_0px_#0B2818] active:translate-y-1 active:shadow-[0px_0px_0px_0px_#0B2818] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {status === "submitting" ? "Joining..." : "Join waitlist"}
                  </button>
                </div>
                {error && (
                  <p className="mx-1 mt-3 text-sm font-semibold text-[#c0392b]">{error}</p>
                )}
                <p className="mx-1 mt-3.5 text-[13px] text-[#6b8275]">
                  No spam, ever. We&rsquo;ll only email you about your spot and launch.
                </p>
              </form>
            )}

            {/* SUCCESS */}
            {submitted && (
              <div className="max-w-[560px] rounded-[28px] border-2 border-[#0B2818] bg-white p-7 shadow-[-8px_8px_0px_0px_#0B2818]">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[#0B2818]">
                    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                      <path
                        d="M20 6L9 17L4 12"
                        stroke="#B8FF4F"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-jersey mb-1.5 text-[32px] leading-none text-[#0B2818]">
                      You&rsquo;re on the list!
                    </p>
                    <p className="text-[15px] text-[#3c5a48]">
                      We saved <strong className="text-[#0B2818]">{email}</strong>. We&rsquo;ll be in
                      touch before launch.
                    </p>
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="mt-5 text-[15px] font-bold text-[#192FFD]"
                >
                  Use a different email
                </button>
              </div>
            )}

            {/* SOCIAL PROOF */}
            <div className="mt-7 flex items-center gap-3.5">
              <div className="flex">
                <span className="h-[34px] w-[34px] rounded-full border-2 border-[#F7F4EE] bg-[#192FFD]" />
                <span className="-ml-3 h-[34px] w-[34px] rounded-full border-2 border-[#F7F4EE] bg-[#B8FF4F]" />
                <span className="-ml-3 h-[34px] w-[34px] rounded-full border-2 border-[#F7F4EE] bg-[#0B2818]" />
                <span className="-ml-3 h-[34px] w-[34px] rounded-full border-2 border-[#F7F4EE] bg-[#6b8275]" />
              </div>
              <p className="text-[15px] text-[#3c5a48]">
                <strong className="text-[#0B2818]">2,400+</strong> people already in line
              </p>
            </div>
          </div>

          {/* RIGHT: hero art */}
          <div className="relative flex min-w-[280px] flex-1 basis-[360px] justify-center">
            <Image
              alt=""
              src="/favicon.svg"
              width={84}
              height={84}
              className="animate-hover-up-down absolute -top-1.5 right-[8%] z-[2] h-auto w-12 rotate-[8deg] sm:w-[84px]"
            />
            <Image
              alt="ZingPay"
              src="/zingPay_hero.svg"
              width={480}
              height={456}
              className="block h-auto w-full max-w-[480px]"
            />
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#0B2818] px-4 py-10 text-center sm:px-6 lg:px-10">
        <Image alt="ZingPay" src="/zingpay.svg" width={130} height={45} className="mx-auto h-auto w-[130px]" />
        <p className="mx-auto mt-[18px] max-w-[440px] text-sm font-semibold text-white sm:text-base lg:text-lg">
          No downloads, no signups, just open the app and go.
        </p>
      </footer>
    </div>
  );
}
