"use client";

// Notice the new import path for the modern package
import { ReactLenis } from "lenis/react";
import React, { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (lenisRef.current?.lenis) {
      lenisRef.current.lenis.scrollTo(0, { immediate: true });
    }
  }, [pathname]);

  // Intercept anchor clicks for smooth scrolling
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (!anchor) return;
      
      const href = anchor.getAttribute("href");
      // Check if it's an internal anchor link (e.g. #how-it-works, not #)
      if (href && href.startsWith("#") && href.length > 1) {
        const element = document.querySelector(href);
        if (element && lenisRef.current?.lenis) {
          e.preventDefault();
          lenisRef.current.lenis.scrollTo(element, { offset: -50 });
        }
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => {
      document.removeEventListener("click", handleAnchorClick);
    };
  }, []);

  return (
    // 'root' tells Lenis to hijack the native scrollbar of the entire page
    <ReactLenis ref={lenisRef} root options={{ lerp: 0.08, duration: 1.5, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}