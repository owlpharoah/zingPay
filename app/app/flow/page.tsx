import Link from "next/link";
import Image from "next/image";

const FLOW_IMAGE_PATH = "/image.png";

export default function FlowPage() {
  return (
    <main className="min-h-screen bg-[#F7F4EE] px-6 py-12 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <h1 className="font-[fraunces] text-5xl font-black text-[#0B2818]">
          ZingPay User Flow
        </h1>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={FLOW_IMAGE_PATH}
            target="_blank"
            rel="noreferrer"
            className="rounded-3xl border-2 border-[#0B2818] bg-[#B8FF4F] px-6 py-3 font-[outfit] text-lg font-semibold text-[#0B2818] shadow-[0px_4px_0px_0px_#0B2818]"
          >
            Open Flow Image
          </Link>
          <Link
            href="/send"
            className="rounded-3xl border-2 border-[#0B2818] bg-white px-6 py-3 font-[outfit] text-lg font-semibold text-[#0B2818] shadow-[0px_4px_0px_0px_#0B2818]"
          >
            Continue to Send
          </Link>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border-2 border-[#0B2818] bg-white p-3 shadow-[0px_8px_0px_0px_#0B2818]">
          <Image
            src={FLOW_IMAGE_PATH}
            alt="ZingPay user flow"
            width={1600}
            height={1460}
            className="h-auto w-full rounded-2xl"
          />
        </div>

        <p className="mt-6 font-[outfit] text-base text-[#103e28]">
          If you need a closer look, use the "Open Flow Image" button above.
        </p>
      </div>
    </main>
  );
}
