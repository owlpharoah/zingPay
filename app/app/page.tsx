import "@fontsource/fraunces";
import "@fontsource/outfit";
import Image from "next/image";
import Link from "next/link";
import FadeIn from "@/components/FadeInView";

export default function LandingPage() {
  return (
    <div className="w-full overflow-x-hidden font-[outfit]">
      <header className="bg-[#0B2818]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <Link href="/">
            <Image alt="zingpay logo" src="/zingpay.svg" width={130} height={37} />
          </Link>

          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm sm:text-base lg:text-xl">
            <li><a href="#how-it-works" className="text-[#F7F4EE] hover:text-[#B8FF4F]">How it works</a></li>
            <li><a href="#features" className="text-[#F7F4EE] hover:text-[#B8FF4F]">Features</a></li>
            <li><a href="#security" className="text-[#F7F4EE] hover:text-[#B8FF4F]">Security</a></li>
            <li><a href="https://zingpay-docs.vercel.app" target="_blank" rel="noreferrer" className="text-[#F7F4EE] hover:text-[#B8FF4F]">Documentation</a></li>
          </ul>

          <Link href="/register" className="w-full rounded-3xl bg-[#B8FF4F] px-5 py-2 text-center sm:w-auto">
            <p className="text-lg font-semibold text-[#0B2818]">OpenApp</p>
          </Link>
        </div>
      </header>

      <section className="relative z-0 bg-[url(/verticalGrid.svg)] bg-cover pb-16 lg:pb-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 lg:pt-16">
          <div>
            <FadeIn>
              <ul className="mb-5 flex w-fit flex-wrap items-center gap-2 rounded-4xl bg-[#0B2818] px-4 py-3 text-sm text-[#B8FF4F] sm:text-base">
                <li>On-chain escrow</li>
                <li><Image alt="dot" src="/dot.svg" width={10} height={10} /></li>
                <li>Non-custodial</li>
                <li><Image alt="dot" src="/dot.svg" width={10} height={10} /></li>
                <li>OTP-secured claims</li>
              </ul>
            </FadeIn>

            <FadeIn delay={0.2}>
              <p className="font-[fraunces] text-5xl leading-[1.05] text-[#0B2818] sm:text-6xl md:text-7xl xl:text-8xl">
                <span className="font-black">Global cash with a </span>
                <span className="italic font-extralight">Local</span>
                <span className="font-black"> feel</span>
              </p>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href="/send" className="flex h-12 items-center justify-center rounded-3xl border-2 border-[#0B2818] bg-[#B8FF4F] px-6 shadow-[0px_4px_0px_0px_#0B2818]">
                  <p className="text-lg font-semibold text-[#0B2818]">Try it now</p>
                </Link>
                <Link href="#how-it-works" className="flex h-12 items-center justify-center rounded-3xl border-2 border-[#0B2818] bg-white px-6 shadow-[0px_4px_0px_0px_#0B2818]">
                  <p className="text-lg font-semibold text-[#0B2818]">See how it works</p>
                </Link>
              </div>
            </FadeIn>
          </div>

          <FadeIn>
            <div className="mx-auto w-full max-w-105 rounded-[48px] bg-[#0B2818] p-3 sm:rounded-[60px]">
              <Image alt="our mascot zingy" src="/Zingy.svg" width={387} height={366} className="h-auto w-full" />
            </div>
          </FadeIn>
        </div>

        <div className="mx-auto mt-12 flex max-w-7xl flex-col gap-5 px-4 sm:px-6 lg:mt-16 lg:px-10">
          <FadeIn direction="left" className="rounded-[36px] border-2 border-[#0B2818] bg-[#F7F4EE] p-5 sm:p-7">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="relative flex min-h-24 items-center justify-center rounded-3xl bg-[#0B2818] px-5 text-center">
                <Image alt="dot" src="/bigDot.svg" width={32} height={32} className="absolute -left-2 -top-2" />
                <p className="text-base font-semibold text-[#B8FF4F] sm:text-lg">Wallet addresses are hard to share and easy to mistype.</p>
              </div>
              <div className="relative flex min-h-24 items-center justify-center rounded-3xl bg-[#0B2818] px-5 text-center">
                <Image alt="dot" src="/bigDot.svg" width={32} height={32} className="absolute -left-2 -top-2" />
                <p className="text-base font-semibold text-[#B8FF4F] sm:text-lg">New users cannot receive funds without setup.</p>
              </div>
              <div className="relative flex min-h-24 items-center justify-center rounded-3xl bg-[#0B2818] px-5 text-center">
                <Image alt="dot" src="/bigDot.svg" width={32} height={32} className="absolute -left-2 -top-2" />
                <p className="text-base font-semibold text-[#B8FF4F] sm:text-lg">One mistake can permanently lose funds.</p>
              </div>
            </div>
          </FadeIn>

          <FadeIn direction="right" delay={0.2} className="rounded-[30px] border-2 border-[#0B2818] bg-[#F7F4EE] p-5 shadow-[-8px_8px_0px_0px_#0B2818] sm:p-7">
            <p className="font-[outfit] text-2xl font-bold text-[#0B2818] sm:text-3xl md:text-4xl">Zingpay got you covered!</p>
            <p className="mt-2 text-base text-[#0B2818] sm:text-lg">Send using a phone number. Receiver verifies with OTP and claims instantly.</p>
          </FadeIn>
        </div>
      </section>

      <section className="bg-[#0B2818] bg-[url(/tiltGrid.svg)] bg-cover py-14 sm:py-18">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
          <h2 className="text-center font-[fraunces] text-4xl font-black text-[#B8FF4F] sm:text-5xl md:text-6xl" id="how-it-works">
            How it works
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <FadeIn direction="right" className="rounded-3xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center">
              <div className="flex items-center justify-center gap-2">
                <Image alt="step one" src="/one.svg" height={28} width={28} />
                <p className="font-[fraunces] text-2xl font-black text-[#0B2818] sm:text-3xl">Enter Details</p>
              </div>
              <p className="mt-4 text-lg text-[#0B2818]">Add a phone number and amount. No wallet required.</p>
            </FadeIn>

            <FadeIn delay={0.2} direction="right" className="rounded-3xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center">
              <div className="flex items-center justify-center gap-2">
                <Image alt="step two" src="/two.png" height={28} width={28} />
                <p className="font-[fraunces] text-2xl font-black text-[#0B2818] sm:text-3xl">Funds Locked</p>
              </div>
              <p className="mt-4 text-lg text-[#0B2818]">Funds are transferred to a secure escrow contract.</p>
            </FadeIn>

            <FadeIn delay={0.4} direction="right" className="rounded-3xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center">
              <div className="flex items-center justify-center gap-2">
                <Image alt="step three" src="/three.svg" height={28} width={28} />
                <p className="font-[fraunces] text-2xl font-black text-[#0B2818] sm:text-3xl">Receiver Claims</p>
              </div>
              <p className="mt-4 text-lg text-[#0B2818]">Receiver verifies with OTP and claims instantly.</p>
            </FadeIn>
          </div>

          <h2 className="mt-14 text-center font-[fraunces] text-4xl font-black text-[#B8FF4F] sm:text-5xl md:text-6xl" id="features">
            Features
          </h2>
        </div>
      </section>

      <section className="relative mx-auto -mt-8 max-w-7xl px-4 pb-12 sm:-mt-10 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <FadeIn className="rounded-4xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center">
            <Image alt="features image" src="/map.svg" width={100} height={100} className="mx-auto" />
            <p className="mt-3 font-[fraunces] text-3xl font-black text-[#0B2818]">Simple and Accessible</p>
            <p className="mt-4 text-lg text-[#0B2818]">Send money using just a phone number. No wallet, no addresses, no setup. OTP verification ensures the right person claims it.</p>
          </FadeIn>

          <FadeIn delay={0.2} className="rounded-4xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center">
            <Image alt="features image" src="/secure.svg" width={100} height={100} className="mx-auto" />
            <p className="mt-3 font-[fraunces] text-3xl font-black text-[#0B2818]">Secure by Design</p>
            <p className="mt-4 text-lg text-[#0B2818]">Funds are locked in on-chain escrow until claimed. If unclaimed, they are automatically refunded. No risk of loss.</p>
          </FadeIn>

          <FadeIn className="rounded-4xl border-2 border-[#0B2818] bg-[#F7F4EE] p-6 text-center">
            <Image alt="features image" src="/fast.svg" width={100} height={100} className="mx-auto" />
            <p className="mt-3 font-[fraunces] text-3xl font-black text-[#0B2818]">Fast and Transparent</p>
            <p className="mt-4 text-lg text-[#0B2818]">Payments move quickly on-chain, and both sender and receiver can track every stage with confidence.</p>
          </FadeIn>
        </div>

        <div className="relative mt-10">
          <Link href="/flow" className="mx-auto flex w-fit items-center justify-center rounded-3xl border-2 border-[#0B2818] bg-[#B8FF4F] px-6 py-3 text-xl font-semibold text-[#0B2818] shadow-[0px_4px_0px_0px_#0B2818]">
            <p>View Full Flow</p>
          </Link>
          <Image alt="hand" src="/hand.svg" width={500} height={900} className="mx-auto mt-6 h-auto w-full max-w-md" />
          <Image alt="star" src="/star.svg" width={109} height={109} className="absolute right-4 top-6 hidden rotate-12 md:block" />
          <Link href="/flow" className="absolute bottom-6 right-4 hidden w-fit rotate-6 items-center justify-center rounded-3xl border-2 border-[#0B2818] bg-[#B8FF4F] px-5 py-3 text-xl font-semibold text-[#0B2818] shadow-[0px_4px_0px_0px_#0B2818] md:flex">
            <p>Try it now</p>
          </Link>
        </div>
      </section>

      <section className="space-y-4 pb-12">
        <div className="h-19 w-full overflow-hidden rounded-l-[99px] border-y-2 border-l-2 border-[#0B2818] bg-[#B8FF4F] sm:ml-auto sm:h-22.75 sm:max-w-[95%]">
          <div className="animate-marquee-left flex h-full w-max items-center text-[#0B2818]">
            <ul className="font-[fraunces] flex items-center gap-8 whitespace-nowrap px-5 text-xl font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>OTP verification</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Fast, low-cost</li>
            </ul>
            <ul className="font-[fraunces] flex items-center gap-8 whitespace-nowrap px-5 text-xl font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>OTP verification</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Fast, low-cost</li>
            </ul>
          </div>
        </div>

        <div className="h-19 w-full overflow-hidden rounded-r-[99px] border-y-2 border-r-2 border-[#0B2818] bg-[#B8FF4F] sm:mr-auto sm:h-22.75 sm:max-w-[95%]">
          <div className="animate-marquee-right flex h-full w-max items-center text-[#0B2818]">
            <ul className="font-[fraunces] flex items-center gap-8 whitespace-nowrap px-5 text-xl font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Fast, low-cost</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>OTP verification</li>
            </ul>
            <ul className="font-[fraunces] flex items-center gap-8 whitespace-nowrap px-5 text-xl font-black sm:text-3xl">
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Refund if unclaimed</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Live status tracking</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Fast, low-cost</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Send by phone number</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>Secure escrow</li>
              <li><Image alt="dot" src="/cardDot.svg" width={24} height={24} /></li><li>OTP verification</li>
            </ul>
          </div>
        </div>
      </section>

      <FadeIn className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 pb-12 sm:px-6 lg:grid-cols-2 lg:px-10">
        <Image alt="new users" src="/newUsers.svg" width={600} height={120} className="h-auto w-full" />
        <Image alt="crypto users" src="/cryptoUsers.svg" width={600} height={120} className="h-auto w-full" />
      </FadeIn>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-10" id="security">
        <FadeIn>
          <Image alt="Security without compromise" src="/security.svg" width={931} height={538} className="mx-auto h-auto w-full" />
          <div className="mt-6 flex justify-center">
            <Link href="/flow" className="flex w-fit items-center justify-center rounded-3xl border-2 border-[#0B2818] bg-[#B8FF4F] px-6 py-3 text-xl font-semibold text-[#0B2818] shadow-[0px_4px_0px_0px_#0B2818]">
              <p>Try it now</p>
            </Link>
          </div>
        </FadeIn>

        <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex min-h-14 items-center justify-center rounded-4xl bg-[#0B2818] px-5 text-center text-base font-semibold text-white sm:text-lg">
            <p>You stay in control, non-custodial, on-chain escrow.</p>
          </div>
          <div className="flex min-h-14 items-center justify-center rounded-4xl bg-[#0B2818] px-5 text-center text-base font-semibold text-white sm:text-lg">
            <p>Safe from errors: OTP secured claims, auto-expiry refunds.</p>
          </div>
        </div>
      </section>

      <footer className="bg-[#0B2818] px-4 py-10 text-center sm:px-6 lg:px-10">
        <Image alt="zingpay" src="/zingpay.svg" width={130} height={37} className="mx-auto" />
        <p className="mt-4 text-base font-semibold text-white sm:text-lg">
          No downloads, No signups, Just open the app and go!
        </p>
        <Link href="/send" className="mt-8 inline-flex rounded-3xl bg-[#B8FF4F] px-6 py-3">
          <p className="text-xl font-semibold text-[#0B2818]">OpenApp</p>
        </Link>
      </footer>
    </div>
  );
}
