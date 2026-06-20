"use client"

import Image from "next/image";
import Link from "next/link";
import FadeIn from "@/components/FadeInView";
import { useState, useEffect, useRef } from "react";

export default function LandingPage() {

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    }
  }, []);

  return (
    <div className="w-full overflow-x-hidden font-[outfit]">
      <header className="bg-[#0B2818]">
        <div className="mx-auto flex max-w-7xl max-lg:justify-between gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <Link href="/">
            <Image alt="zingpay logo" src="/zingpay.svg" width={75.7} height={26.5} />
          </Link>

          <ul className="hidden lg:flex flex-wrap items-center gap-x-6 gap-y-2 text-sm sm:text-base lg:text-xl">
            <li><a href="#how-it-works" className="text-[#F7F4EE] hover:text-[#B8FF4F]">How it works</a></li>
            <li><a href="#features" className="text-[#F7F4EE] hover:text-[#B8FF4F]">Features</a></li>
            <li><a href="#security" className="text-[#F7F4EE] hover:text-[#B8FF4F]">Security</a></li>
            <li><a href="https://zingpay-docs.vercel.app" target="_blank" rel="noreferrer" className="text-[#F7F4EE] hover:text-[#B8FF4F]">Documentation</a></li>
          </ul>

          <Link href="/waitlist" className="hidden lg:block w-full rounded-3xl bg-[#192FFD] px-5 py-2 text-center sm:w-auto">
            <p className="text-lg font-semibold text-white">Join waitlist</p>
          </Link>

          <div className="relative inline-block lg:hidden" ref={menuRef}>
            <button aria-label="Toggle menu" aria-expanded={isMenuOpen} className="flex items-center justify-center mr-2" onClick={() => { setIsMenuOpen(!isMenuOpen) }}>
              <Image
                alt="hamburger menu"
                src={!isMenuOpen ? "/hammenu.svg" : "/hammenu_sel.svg"}
                width={31}
                height={16}
              />
            </button>
            {isMenuOpen && (
              <div className="absolute -right-2 top-9 z-50 w-56">
                <div className="absolute -top-6 left-43">
                  <Image alt="upward arrow" src="/arrow-head.svg" width={35} height={28} />
                </div>
                <nav className="rounded-2xl border-2 border-white bg-[#0B2818] overflow-hidden shadow-xl">
                  <a href="#how-it-works" onClick={() => setIsMenuOpen(false)} className="block px-6 py-4 text-center text-lg text-[#F7F4EE] hover:text-[#B8FF4F] hover:bg-[#122e1e] transition-colors">How it works</a>
                  <div className="border-t border-[#1a3d28]" />
                  <a href="#features" onClick={() => setIsMenuOpen(false)} className="block px-6 py-4 text-center text-lg text-[#F7F4EE] hover:text-[#B8FF4F] hover:bg-[#122e1e] transition-colors">Features</a>
                  <div className="border-t border-[#1a3d28]" />
                  <a href="#security" onClick={() => setIsMenuOpen(false)} className="block px-6 py-4 text-center text-lg text-[#F7F4EE] hover:text-[#B8FF4F] hover:bg-[#122e1e] transition-colors">Security</a>
                  <div className="border-t border-[#1a3d28]" />
                  <a href="https://zingpay-docs.vercel.app" target="_blank" rel="noreferrer" className="block px-6 py-4 text-center text-lg text-[#F7F4EE] hover:text-[#B8FF4F] hover:bg-[#122e1e] transition-colors">Documentation</a>
                </nav>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="relative z-0 bg-[url(/verticalGrid.svg)] bg-cover pb-16 lg:pb-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:pt-16">
          <div>
            <FadeIn>
              <ul className="mb-5 mx-auto flex w-fit items-center gap-2 rounded-4xl sm:mx-0  bg-[#0B2818] px-2 py-2 text-[10px] text-[#B8FF4F] lg:text-s">
                <li>On-chain escrow</li>
                <li><Image alt="dot" src="/dot.svg" width={10} height={10} /></li>
                <li>Non-custodial</li>
                <li><Image alt="dot" src="/dot.svg" width={10} height={10} /></li>
                <li>OTP-secured claims</li>
              </ul>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="font-jersey max-sm:ml-2 text-5xl text-[#0B2818] sm:text-6xl md:text-7xl">
                Send money<br />
                globally just with<br />
                a phone number.
              </p>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/waitlist" className="flex h-12 items-center justify-center rounded-3xl border-2 border-[#0B2818] bg-[#192FFD] px-6 shadow-[0px_4px_0px_0px_#0B2818]">
                  <p className="text-lg font-semibold text-white">Join waitlist</p>
                </Link>
                <Link href="#how-it-works" className="flex h-12 items-center justify-center rounded-3xl border-2 border-[#0B2818] bg-white px-6 shadow-[0px_4px_0px_0px_#0B2818]">
                  <p className="text-lg font-semibold text-[#0B2818]">See how it works</p>
                </Link>
              </div>
            </FadeIn>
          </div>
          <FadeIn>
            <div className="mx-auto w-full sm:mx-0 sm:w-auto lg:flex lg:justify-end">
              <Image alt="zingpay hero logo" src="/zingPay_hero.svg" width={341} height={324.75} className="h-auto w-full lg:w-[553.37px] lg:h-131.75" />
            </div>
          </FadeIn>
        </div>

        <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-5 px-4 sm:px-6 lg:mt-16 lg:px-10">
          <FadeIn direction="left" className="rounded-[36px] border-2 border-[#0B2818] bg-[#F7F4EE] p-5 sm:p-7">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 z-1">
              <div className="relative flex min-h-24 items-center justify-center rounded-3xl bg-[#0B2818] px-5 text-center">
                <p className="text-base font-semibold text-white sm:text-lg">Wallet addresses are hard to share and easy to mistype.</p>
              </div>
              <div className="relative flex min-h-24 items-center justify-center rounded-3xl bg-[#0B2818] px-5 text-center">
                <p className="text-base font-semibold text-white sm:text-lg">New users cannot receive funds without setup.</p>
              </div>
              <div className="relative flex min-h-24 items-center justify-center rounded-3xl bg-[#0B2818] px-5 text-center">
                <p className="text-base font-semibold text-white sm:text-lg">One mistake can permanently lose funds.</p>
              </div>
            </div>
          </FadeIn>

          <FadeIn direction="down" delay={0.2}>
            <div>
              <Image alt="downward-arrow" src="/downward-arrow.svg" width={32} height={32} className="mx-auto sm:hidden -mt-5" />
            </div>
          </FadeIn>

          <FadeIn direction="down" delay={0.3} className="rounded-[30px] border-2 border-[#0B2818] bg-[#F7F4EE] p-5 shadow-[-8px_8px_0px_0px_#0B2818] sm:p-7 max-sm:-mt-5">
            <p className="font-[outfit] text-2xl font-bold text-[#0B2818] sm:text-3xl md:text-4xl">Zingpay got you covered!</p>
            <p className="mt-2 text-base text-[#0B2818] sm:text-lg">Send using a phone number. Receiver verifies with OTP and claims instantly.</p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[#0B2818] bg-[url(/tiltGrid.svg)] bg-cover py-14 sm:py-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10 lg:-mt-8">
          <h2 className="text-center font-jersey text-4xl font-black text-[#B8FF4F] sm:text-5xl md:text-6xl" id="how-it-works">
            How it works
          </h2>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 max-lg:flex max-lg:flex-col max-lg:gap-0">
            <FadeIn direction="right" className="rounded-3xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center z-2">
              <div className="flex items-center justify-center gap-2">
                <Image alt="step one" src="/one.svg" height={28} width={28} />
                <p className="font-jersey font-medium text-2xl text-[#0B2818] sm:text-3xl">Enter Details</p>
              </div>
              <p className="mt-4 text-lg text-[#0B2818]">Add a phone number and amount. No wallet required.</p>
            </FadeIn>

            <FadeIn delay={0.2} direction="right" className="max-lg:rounded-b-3xl lg:rounded-r-3xl lg:-ml-5 border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center max-lg:border-t-0 max-lg:-mt-5 z-1">
              <div className="flex items-center justify-center gap-2 max-lg:mt-3">
                <Image alt="step two" src="/two.png" height={28} width={28} />
                <p className="font-jersey font-medium text-2xl text-[#0B2818] sm:text-3xl">Funds Locked</p>
              </div>
              <p className="mt-4 text-lg text-[#0B2818]">Funds are transferred to a secure escrow contract.</p>
            </FadeIn>

            <FadeIn delay={0.4} direction="right" className="max-lg:rounded-b-3xl lg:rounded-r-3xl lg:-ml-5 border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center max-lg:border-t-0 max-lg:-mt-5 max-lg:z-0">
              <div className="flex items-center justify-center gap-2 max-lg:mt-3">
                <Image alt="step three" src="/three.svg" height={28} width={28} />
                <p className="font-jersey font-medium text-2xl text-[#0B2818] sm:text-3xl">Receiver Claims</p>
              </div>
              <p className="mt-4 text-lg text-[#0B2818]">Receiver verifies with OTP and claims instantly.</p>
            </FadeIn>
          </div>

          <h2 className="mt-14 text-center font-jersey text-4xl font-black text-[#B8FF4F] sm:text-5xl md:text-6xl" id="features">
            Features
          </h2>
        </div>
      </section>

      <section className="relative mx-auto -mt-9 max-w-7xl px-4 pb-12 sm:-mt-10 sm:px-6 lg:px-10">
        <div className="flex flex-col lg:grid lg:gap-5 lg:grid-cols-3">
          <FadeIn className="rounded-4xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center md:mx-auto lg:w-75 lg:h-92.5 lg:-mt-5 max-lg:z-3">
            <Image alt="features image" src="/map.svg" width={100} height={100} className="mx-auto" />
            <p className="mt-3 font-jersey text-3xl font-black text-[#0B2818]">Simple and Accessible</p>
            <p className="mt-4 text-lg text-[#0B2818]">Send money using just a phone number. No wallet, no addresses, no setup. OTP verification ensures the right person claims it.</p>
          </FadeIn>

          <FadeIn delay={0.2} className="rounded-b-4xl -mt-8 max-lg:z-2 lg:rounded-4xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center md:mx-auto lg:w-75 lg:h-92.5 lg:-mt-25">
            <Image alt="features image" src="/secure.svg" width={100} height={100} className="mx-auto mt-5" />
            <p className="mt-3 font-jersey text-3xl font-black text-[#0B2818]">Secure by Design</p>
            <p className="mt-4 text-lg text-[#0B2818]">Funds are locked in on-chain escrow until claimed. If unclaimed, they are automatically refunded. No risk of loss.</p>
          </FadeIn>

          <FadeIn delay={0.4} className="rounded-b-4xl -mt-8 max-lg:z-1 lg:rounded-4xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center md:mx-auto lg:w-75 lg:h-92.5 lg:-mt-5">
            <Image alt="features image" src="/fast.svg" width={100} height={100} className="mx-auto mt-5" />
            <p className="mt-3 font-jersey text-3xl font-black text-[#0B2818]">Fast and Transparent</p>
            <p className="mt-4 text-lg text-[#0B2818]">Payments move quickly on-chain, and both sender and receiver can track every stage with confidence.</p>
          </FadeIn>
        </div>

        <div className="relative mt-5 lg:-mt-2 z-0">
          <Image alt="hand" src="/hand.svg" width={500} height={900} className="relative mx-auto mt-6 h-auto w-full max-w-md z-0 max-sm:w-60 max-sm:mt-0" />
        </div>
      </section>

      <section className="relative -top-130 sm:-top-200 space-y-4 pb-12 z-1 md:-top-210">
        <div className="h-14 max-w-[90%] ml-auto overflow-hidden rounded-l-[99px] border-y-2 border-l-2 border-[#0B2818] bg-[#B8FF4F] sm:ml-auto sm:h-22.75 sm:max-w-[90%]">
          <div className="animate-marquee-left flex h-full w-max items-center text-[#0B2818]">
            <ul className="font-jersey flex items-center gap-8 whitespace-nowrap px-5 text-sm font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>OTP verification</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Fast, low-cost</li>
            </ul>
            <ul className="font-jersey flex items-center gap-8 whitespace-nowrap px-5 text-sm font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>OTP verification</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Fast, low-cost</li>
            </ul>
          </div>
        </div>

        <div className="h-14 max-w-[90%] mr-auto overflow-hidden rounded-r-[99px] border-y-2 border-r-2 border-[#0B2818] bg-[#B8FF4F] sm:mr-auto sm:h-22.75 sm:max-w-[95%]">
          <div className="animate-marquee-right flex h-full w-max items-center text-[#0B2818]">
            <ul className="font-jersey flex items-center gap-8 whitespace-nowrap px-5 text-sm font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Fast, low-cost</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>OTP verification</li>
            </ul>
            <ul className="font-jersey flex items-center gap-8 whitespace-nowrap px-5 text-sm font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Fast, low-cost</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} className="max-sm:w-3.5 max-sm:h-3.5"/></li><li>OTP verification</li>
            </ul>
          </div>
        </div>

        <div className="relative left-1/2 right-1/2 top-26 sm:top-60 md:top-50">
          <Image alt="star" src="/favicon.svg" width={109} height={109} className="relative right-20 sm:right-30 top-8 block rotate-12 w-15.25 h-15.25 sm:w-25 sm:h-25" />
          <Link href="/waitlist" className="relative -top-8 text-sm sm:-top-15 sm:left-3 w-fit rotate-6 items-center justify-center rounded-3xl  bg-[#192FFD] px-5 py-3 sm:text-xl font-semibold text-white shadow-[0px_4px_0px_0px_#0B2818] flex">
            <p>Join waitlist</p>
          </Link>
        </div>
      </section>

      <FadeIn className="mx-auto -mt-108 sm:-mt-140 grid max-w-7xl grid-cols-1 gap-4 px-4 pb-12 sm:px-6 lg:grid-cols-2 lg:px-10">
        <Image alt="new users" src="/newUsers.svg" width={600} height={120} className="h-auto w-full" />
        <Image alt="crypto users" src="/cryptoUsers.svg" width={600} height={120} className="h-auto w-full" />
      </FadeIn>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-10" id="security">
        <FadeIn>
          <Image alt="Security without compromise" src="/security.svg" width={1000} height={550} className="mx-auto h-auto w-fullinline-block hidden sm:block" />
          <Image alt="Security without compromise" src="/secure_mobile.svg" width={370} height={240} className="mx-auto h-auto w-fullinline-block block sm:hidden" />
          <div className="flex -mb-8 relative -top-18 left-4 sm:left-45 sm:-top-44">
            <Link href="/waitlist" className="font-outfit flex w-fit items-center justify-center rounded-3xl border-white bg-[#192FFD] px-3 py-1 text-xs sm:text-xl sm:px-10 sm:py-4 font-semibold text-white shadow-[0px_4px_0px_0px_#0B2818]">
              <p>Join waitlist</p>
            </Link>
          </div>
        </FadeIn>

        <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="flex min-h-10 items-center justify-center rounded-4xl bg-[#0B2818] px-2 text-center text-xs font-semibold text-white sm:text-lg">
            <p>You stay in control, non-custodial, on-chain escrow.</p>
          </div>
          <div className="hidden min-h-14 items-center justify-center rounded-4xl bg-[#0B2818] px-5 text-center text-base font-semibold text-white sm:text-lg lg:flex">
            <p>Safe from errors: OTP secured claims, auto-expiry refunds.</p>
          </div>
        </div>
      </section>

      <footer className="bg-[#0B2818] px-4 py-10 text-center sm:px-6 lg:px-10">
        <Image alt="zingpay" src="/zingpay.svg" width={130} height={37} className="mx-auto" />
        <p className="mt-4 text-xs font-[outfit] font-semibold text-white sm:text-lg">
          No downloads, No signups, Just open the app and go!
        </p>
        <Link href="/waitlist" className="mt-8 inline-flex rounded-3xl bg-[#192FFD] px-6 py-3 border-white border">
          <p className="text-xl font-semibold text-white">Join waitlist</p>
        </Link>
      </footer>
    </div>
  );
}
