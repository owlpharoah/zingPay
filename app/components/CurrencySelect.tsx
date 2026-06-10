"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface CurrencySelectProps {
  /** Currently selected currency code, e.g. "SOL". */
  value: string;
  /** Fired when the user picks a currency. */
  onChange: (currency: string) => void;
  /** Full list of selectable currency codes. */
  options: string[];

  /** Controlled open state, coordinated with the page's other dropdowns. */
  open: boolean;
  onOpenChange: (open: boolean) => void;

  searchPlaceholder?: string;
}

/**
 * The amount field's currency picker: a dark pill trigger with a searchable,
 * keyboard-navigable menu (↑/↓ to move, Enter to select, Esc to close). The
 * menu is portalled to <body> so it escapes the form card's stacking/overflow.
 *
 * Mirrors the behaviour of {@link CountryCodeSelect}, scoped to plain string
 * currency codes.
 */
export function CurrencySelect({
  value,
  onChange,
  options,
  open,
  onOpenChange,
  searchPlaceholder = "Search currency…",
}: CurrencySelectProps) {
  const [query, setQuery] = useState("");
  // Index of the keyboard-highlighted option within the filtered list.
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
  }, []);

  // Keep the portalled menu pinned to the trigger while open.
  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close on outside click — ignore the trigger wrapper and the portalled menu.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      onOpenChange(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.toLowerCase().includes(q));
  }, [query, options]);

  // Reset + focus search each time the menu opens, and highlight the current
  // selection so Up/Down start from the right place.
  useEffect(() => {
    if (open) {
      setQuery("");
      const selectedIdx = options.findIndex((c) => c === value);
      setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Typing narrows the list — keep the highlight on the first match.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted option scrolled into view as it moves.
  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const choose = (currency: string) => {
    onChange(currency);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const option = filtered[activeIndex];
        if (option) choose(option);
        break;
      }
      case "Escape":
        e.preventDefault();
        onOpenChange(false);
        triggerRef.current?.focus();
        break;
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      onOpenChange(true);
    }
  };

  return (
    <div className="relative flex items-center h-full py-2" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        onKeyDown={handleTriggerKeyDown}
        className="flex items-center justify-between bg-[#0B2818] hover:bg-[#0B2818]/90 rounded-full w-[85px] max-sm:w-[75px] h-full px-4 max-sm:px-3 cursor-pointer transition-colors"
      >
        <span className="font-semibold text-white text-sm max-sm:text-xs font-[outfit] truncate">
          {value}
        </span>
        <svg
          className={`w-2 h-2 shrink-0 text-white transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 10 6"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted && open &&
        createPortal(
          <div
            ref={menuRef}
            onKeyDown={handleKeyDown}
            className="w-[160px] bg-white border-2 border-[#0B2818] rounded-xl shadow-lg flex flex-col overflow-hidden z-50"
            style={{
              position: "fixed",
              top: menuPos?.top ?? -9999,
              left: menuPos?.left ?? -9999,
              margin: 0,
              visibility: menuPos ? "visible" : "hidden",
            }}
          >
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="m-2 mb-1 px-3 py-2 text-sm max-sm:text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-[#B8FF4F] focus:ring-2 focus:ring-[#B8FF4F]/40 text-[#0B2818] font-[outfit]"
            />
            <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
              {filtered.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400 font-[outfit]">No match</p>
              )}
              {filtered.map((currency, index) => {
                const active = currency === value;
                const highlighted = index === activeIndex;
                return (
                  <button
                    key={currency}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => choose(currency)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full text-left px-4 py-2.5 max-sm:py-2 text-sm max-sm:text-xs font-bold font-[outfit] cursor-pointer transition-colors border-b last:border-b-0 border-[#0B2818]/10 ${
                      active
                        ? "bg-[#B8FF4F] text-[#0B2818]"
                        : highlighted
                          ? "bg-[#B8FF4F]/50 text-[#0B2818]"
                          : "text-[#0B2818] hover:bg-[#B8FF4F]/50"
                    }`}
                  >
                    {currency}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
