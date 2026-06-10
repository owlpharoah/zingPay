import Image from "next/image";
import Link from "next/link";
import { WalletDropdown } from "@/components/WalletDropdown";

/**
 * The standard in-app top bar: a "Back" link home, the ZingPay logo, and the
 * wallet dropdown. Shared across every app page (everything except the landing
 * page, which has its own marketing header).
 */
export default function AppHeader() {
  return (
    <div className="bg-[#0B2818] flex items-center justify-around h-[131px] max-sm:h-[80px] p-4 max-sm:px-2 shrink-0">
      <Link href="/">
        <div className="flex items-center">
          <Image alt="back" src="/back.svg" width={12} height={23} className="inline-block mr-4 max-sm:mr-2 max-sm:w-2 max-sm:h-[14px]" />
          <Image alt="zingpay" src="/zingpay.svg" width={172} height={57} className="w-[110px] h-auto sm:hidden" />
          <p className="text-white font-[outfit] font-semibold text-xl max-sm:hidden">Back</p>
        </div>
      </Link>
      <Image alt="zingpay" src="/zingpay.svg" width={172} height={57} className="w-[172px] h-auto max-sm:hidden" />
      <WalletDropdown />
    </div>
  );
}
