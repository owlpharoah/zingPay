import Image from "next/image";

/**
 * The standard in-app footer: the ZingPay logo plus the tagline. Shared across
 * every app page (everything except the landing page, which has its own footer).
 *
 * Pages that lay out with `flex flex-col min-h-screen` can pass
 * `className="mt-auto"` to pin the footer to the bottom.
 */
export default function AppFooter({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-[#0B2818] p-10 max-sm:p-6 flex flex-col items-center justify-center shrink-0 ${className}`}>
      <Image alt="zingpay" src="/zingpay.svg" width={130} height={37} className="block mx-auto max-sm:w-[100px] h-auto" />
      <p className="text-white text-lg max-sm:text-sm mt-4 max-sm:mt-2 font-[outfit] font-semibold text-center max-w-sm">
        No downloads, No signups, Just open the app and go!
      </p>
    </div>
  );
}
