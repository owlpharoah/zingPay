import "@fontsource/fraunces";
import "@fontsource/outfit";
import Image from "next/image";
import Link from "next/link";
import FadeIn from "@/components/FadeInView";

export default function LandingPage() {
  return (
    <div className="max-w-screen overflow-x-hidden">
      {/* navbar */}
      <div className="flex w-screen font-[outfit] bg-[#0B2818] justify-between h-31 p-10 items-center">
        <Link href="#"><Image alt="zingpay logo" src="/zingpay.svg" width={130} height={37} /></Link>
        <ul className="flex space-x-10">
          <li><a href="#how-it-works" className="text-[#F7F4EE] hover:text-[#B8FF4F] text-xl">How it works</a></li>
          <li><a href="#features" className="text-[#F7F4EE] hover:text-[#B8FF4F] text-xl">Features</a></li>
          <li><a href="#security" className="text-[#F7F4EE] hover:text-[#B8FF4F] text-xl">Security</a></li>
        </ul>
        <Link href="/register" className="bg-[#B8FF4F] rounded-3xl p-3">
          <p className="text-[#0B2818] font-semibold w-35 text-align text-center text-xl">OpenApp</p>
        </Link>
      </div>

      {/* hero-section */}

      <div className="bg-[url(/verticalGrid.svg)] pb-50 relative z-0 bg-cover">
        <div className="flex justify-center p-4 pt-25 items-center space-x-20">
          <div className="flex flex-col">
            <FadeIn>
              <ul className="flex items-center space-x-3 text-[#B8FF4F] bg-[#0B2818] font-[outfit] rounded-4xl p-3 w-fit mb-5">
                <li>On-chain escrow</li>
                <li><Image alt="dot" src="/dot.svg" width={10} height={10} /></li>
                <li>Non-custodial</li>
                <li><Image alt="dot" src="/dot.svg" width={10} height={10} /></li>
                <li>OTP-secured claims</li>
              </ul>
            </FadeIn>

            <FadeIn delay={0.2} >
              <div>
                <p className="font-[fraunces] text-8xl text-[#0B2818]">
                  <span className="font-black">Send money <br /> globally with just <br /> a </span><span className="font-[fraunces] italic font-extralight">phone number</span>
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="flex items-center space-x-5 mt-5">
                <Link href="#" className="bg-[#B8FF4F] rounded-3xl p-3 border-2 border-[#0B2818] h-[43px] flex items-center shadow-[0px_4px_0px_0px_#0B2818]">
                  <p className="text-[#0B2818] font-semibold w-35 text-align text-center text-xl">Try it now</p>
                </Link>
                <Link href="#" className="rounded-3xl bg-white border-2 border-[#0B2818] p-5 h-[43px] flex items-center shadow-[0px_4px_0px_0px_#0B2818]">
                  <p className="text-[#0B2818] font-semibold w-80 text-align text-center text-xl">See how it works</p>
                </Link>
              </div>
            </FadeIn>
          </div>
          <FadeIn>
            <div className="w-[387px] h-[366px] rounded-[65px] bg-[#0B2818] ">
              <Image alt="out mascot zingy" src="/Zingy.svg" width={387} height={366} className="inline-block" />
            </div>
          </FadeIn>
        </div>

        {/* --- BOX 1 WITH LINE --- */}
        <div className="flex items-center w-full mt-30 relative z-10">
          <div className="h-[3px] bg-[#0B2818] flex-grow"></div>
          {/* Solid line expanding from the left edge */}
          <FadeIn direction="left" className="bg-[#F7F4EE] rounded-l-[64px] h-[175px] border-3 border-[#0B2818] flex items-center justify-around w-400 shrink-0">
            <div className="bg-[#0B2818] rounded-4xl relative w-80 h-20 text-center flex items-center justify-center">
              <Image alt="dot" src="/bigDot.svg" width={32} height={32} className="absolute -top-2 -left-2" />
              <p className="text-[#B8FF4F] text-xl font-semibold">Wallet addresses are hard to<br /> share and easy to mistype.</p>
            </div>

            <div className="bg-[#0B2818] rounded-4xl relative w-80 h-20 text-center flex items-center justify-center">
              <Image alt="dot" src="/bigDot.svg" width={32} height={32} className="absolute -top-2 -left-2" />
              <p className="text-[#B8FF4F] text-xl font-semibold">New users can't recieve funds without setup</p>
            </div>

            <div className="bg-[#0B2818] rounded-4xl relative w-80 h-20 text-center flex items-center justify-center">
              <Image alt="dot" src="/bigDot.svg" width={32} height={32} className="absolute -top-2 -left-2" />
              <p className="text-[#B8FF4F] text-xl font-semibold">One mistake can permanently loose funds</p>
            </div>
          </FadeIn>
        </div>

        {/* --- BOX 2 WITH ARROW LINE --- */}
        <div className="flex items-center w-full mt-30 relative z-10">
          {/* Solid line expanding from the left edge with arrowhead SVG */}
          <div className="h-[3px] bg-[#0B2818] flex-grow relative" style={{ transform: 'translateX(-2px)' }}>
            <svg
              className="absolute -right-[2px] top-1/2 -translate-y-1/2"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 4L18 12L8 20"
                stroke="#0B2818"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <FadeIn direction="right" delay={0.2} className="rounded-l-[38px] border-3 border-[#0B2818] shadow-[-8px_8px_0px_0px_#0B2818] h-[120px] w-[800px] bg-[#F7F4EE] p-4 flex flex-col justify-center shrink-0">
            <p className="font-[outfit] text-[#0B2818] font-bold text-4xl ml-10">Zingpay got you covered!</p>
            <p className="font-[outfit] text-[#0B2818] text-lg ml-10 mt-1">Send using a phone number. Reciever verifies with OTP and claims instantly.</p>
          </FadeIn>
        </div>
      </div>

      <div className="relative z-10">
        <div className="bg-[url(/tiltGrid.svg)] p-30 bg-[#0B2818] bg-cover flex flex-col">
          <p className="font-[fraunces] text-6xl text-[#B8FF4F] text-center">
            <span className="font-black" id="how-it-works">How it works</span>
          </p>

          <div className="flex mt-20 w-400 mx-auto justify-center">
            <FadeIn direction="right" className="flex flex-col bg-[#F7F4EE] border-2 border-[#0B2818] rounded-3xl p-8 z-30 px-20 relative left-10">
              <div className="flex items-center justify-center space-x-2">
                <Image alt="step one" src="/one.svg" height={28} width={28} />
                <p className="text-[#0B2818] font-[fraunces] font-black text-3xl">Enter Details</p>
              </div>
              <p className="text-center text-align mt-5 text-xl">Add a phone number and amount.<br /> No wallet required.</p>
            </FadeIn>

            <FadeIn delay={0.2} direction="right" className="flex flex-col shrink-0 bg-[#F7F4EE] border-2 border-[#0B2818] rounded-3xl p-8 z-20 px-20 relative -left-5">
              <div className="flex items-center justify-center space-x-2">
                <Image alt="step one" src="/two.png" height={28} width={28} />
                <p className="text-[#0B2818] font-[fraunces] font-black text-3xl">Enter Details</p>
              </div>
              <p className="text-center text-align mt-5 text-xl">Funds are transferred to a secure <br />escrow contract.</p>
            </FadeIn>

            <FadeIn delay={0.4} direction="right" className="flex flex-col bg-[#F7F4EE] border-2 border-[#0B2818] rounded-3xl p-8 z-10 px-20 relative -left-20">
              <div className="flex items-center justify-center space-x-2">
                <Image alt="step one" src="/three.svg" height={28} width={28} />
                <p className="text-[#0B2818] font-[fraunces] font-black text-3xl">Reciever Claims</p>
              </div>
              <p className="text-center text-align mt-5 text-xl">Reciever verifies with OTP<br /> and claims instantly.</p>
            </FadeIn>

          </div>
          <p className="font-[fraunces] text-6xl text-[#B8FF4F] text-center mt-30 mb-50">
            <span className="font-black" id="features">Features</span>
          </p>
        </div>

        {/*features*/}
        <div className="flex relative min-w-screen">
          <FadeIn className="flex flex-col border-3 bg-[#F7F4EE] border-[#0B2818] items-center rounded-4xl p-4 w-80 relative -top-20 z-30 left-[10%]">
            <Image
              alt="features image"
              src="/map.svg"
              width={100}
              height={100}
            />
            <p className="font-[fraunces] text-[#0B2818] font-black text-4xl text-center mt-2">Simple & Accessible</p>
            <p className="font-[outfit] text-[#0B2818] text-wrap text-xl text-center mt-5">Send money using just a phone number. No wallet, no addresses, no setup. OTP verification ensures the right person claims it.</p>
          </FadeIn>

          <FadeIn delay={0.2} className="flex flex-col border-3 bg-[#F7F4EE] border-[#0B2818] items-center rounded-4xl p-4 w-80 relative -top-50 z-30 mx-auto">
            <Image
              alt="features image"
              src="/secure.svg"
              width={100}
              height={100}
            />
            <p className="font-[fraunces] text-[#0B2818] font-black text-4xl text-center mt-2">Secure by Design</p>
            <p className="font-[outfit] text-[#0B2818] text-wrap text-xl text-center mt-5">Funds are locked in on-chain escrow until claimed. If unclaimed, they are automatically refunded. No risk of loss.</p>
          </FadeIn>


          <FadeIn className="flex flex-col border-3 bg-[#F7F4EE] border-[#0B2818] items-center rounded-4xl p-4 w-80 relative -top-20 z-30 -left-[10%]">
            <Image
              alt="features image"
              src="/fast.svg"
              width={100}
              height={100}
            />
            <p className="font-[fraunces] text-[#0B2818] font-black text-4xl text-center mt-2">Fast & Transparent</p>
            <p className="font-[outfit] text-[#0B2818] text-wrap text-xl text-center mt-5">Send money using just a phone number. No wallet, no addresses, no setup. OTP verification ensures the right person claims it.</p>
          </FadeIn>
        </div>

        <div className="relative">
          <Link href="/features" className="bg-[#B8FF4F] border-2 border-[#0B2818] font-[outfit] text-[#0B2818] font-semibold text-2xl p-4 rounded-3xl w-60 flex items-center justify-center mx-auto shadow-[0px_4px_0px_0px_#0B2818] relative -top-40 z-40">
            <p>View Full Flow</p>
          </Link>
          <Image
            alt="hand"
            src="/hand.svg"
            width={500}
            height={900}
            className="mx-auto relative -top-39 z-10"
          />
          <Image
            alt="star"
            src="/star.svg"
            width={109}
            height={109}
            className="relative -top-130 left-170 rotate-12"
          />
          <Link href="/features" className="bg-[#B8FF4F] border-2 border-[#0B2818] font-[outfit] text-[#0B2818] font-semibold text-2xl p-4 rounded-3xl w-fit flex items-center justify-center mx-auto shadow-[0px_4px_0px_0px_#0B2818] relative -top-155 left-35 rotate-12">
            <p>Try it now</p>
          </Link>
        </div>

        {/* TOP BAND: Scrolling Right to Left */}
        <div className="bg-[#B8FF4F] ml-auto rounded-l-[99px] h-[91px] relative bottom-310 overflow-hidden w-full max-w-[95%] z-20 border-y-2 border-l-2 border-[#0B2818]">
          <div className="flex animate-marquee-left w-max items-center h-full text-[#0B2818]">
            <ul className="flex items-center space-x-10 px-5 whitespace-nowrap">
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Send by phone number</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Secure escrow</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">OTP verification</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Refund if unclaimed</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Live status tracking</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Fast, low-cost</p></li>
            </ul>
            <ul className="flex items-center space-x-10 px-5 whitespace-nowrap">
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Send by phone number</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Secure escrow</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">OTP verification</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Refund if unclaimed</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Live status tracking</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Fast, low-cost</p></li>
            </ul>
          </div>
        </div>

        {/* BOTTOM BAND: Scrolling Left to Right */}
        <div className="bg-[#B8FF4F] mr-auto rounded-r-[99px] h-[91px] relative bottom-290 overflow-hidden w-full max-w-[95%] z-20 border-y-2 border-r-2 border-[#0B2818]">
          <div className="flex animate-marquee-right w-max items-center h-full text-[#0B2818]">
            <ul className="flex items-center space-x-10 px-5 whitespace-nowrap">
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Refund if unclaimed</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Live status tracking</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Fast, low-cost</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Send by phone number</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Secure escrow</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">OTP verification</p></li>
            </ul>
            <ul className="flex items-center space-x-10 px-5 whitespace-nowrap">
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Refund if unclaimed</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Live status tracking</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Fast, low-cost</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Send by phone number</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">Secure escrow</p></li>
              <li><Image alt="dot" src="/cardDot.svg" width={28} height={28} /></li>
              <li><p className="font-[fraunces] font-black text-3xl">OTP verification</p></li>
            </ul>
          </div>
        </div>

      </div>

      <FadeIn className="flex flex-wrap justify-around relative -top-140">
        <Image alt="nwe-users" src="/newUsers.svg" width={600} height={120} />
        <Image alt="crypto-users" src="/cryptoUsers.svg" width={600} height={120} />
      </FadeIn>

      <div className="flex flex-col">
        <FadeIn className="relative">
          <Image
            alt="Security without compromise"
            src="/security.svg"
            width={931}
            height={538}
            id="security"
            className="block mx-auto -top-100 relative"
          />
          <Link href="/features" className="bg-[#B8FF4F] border-2 border-[#0B2818] font-[outfit] text-[#0B2818] font-semibold text-2xl p-4 rounded-3xl w-60 flex items-center justify-center shadow-[0px_4px_0px_0px_#0B2818] relative -top-130 mr-auto left-110">
            <p>Try it now</p>
          </Link>        </FadeIn>
        <div className="flex space-x-20 mx-auto relative -top-100">
          <div className="flex flex-col items-center justify-center w-fit h-[50px] bg-[#0B2818] rounded-4xl p-5 text-white text-xl font-semibold">
            <p>You stay in control, non-custodial, on-chain escrow.</p>
          </div>
          <div className="flex flex-col items-center justify-center w-fit h-[50px] bg-[#0B2818] rounded-4xl p-5 text-white text-xl font-semibold">
            <p>Safe from errors: OTP secured claims, auto-expiry refunds.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-[#0B2818] -mt-60 p-10 flex flex-col items-center justify-center ">
        <Image
          alt="zingpay"
          src="/zingpay.svg"
          width={130}
          height={37}
          className="block mx-auto"
        />
        <p className="text-white text-lg font-normal mt-4 font-[outfit] font-semibold">
          No downloads, No signups, Just open the app and go!
        </p>
        <Link href="#" className="bg-[#B8FF4F] rounded-3xl p-3 mt-10">
          <p className="text-[#0B2818] font-semibold w-35 text-align text-center text-xl">OpenApp</p>
        </Link>
      </div>

    </div>
  );
}