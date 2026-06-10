"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { CountryCode } from "libphonenumber-js";
import { DialOption, getDialOption, getDialOptions } from "@/lib/phone";

export type { DialOption } from "@/lib/phone";

interface CountryCodeSelectProps {
  /** Selected ISO country code, e.g. "IN". */
  value: CountryCode;
  /** Fired with the full dial option when the user picks a country. */
  onChange: (option: DialOption) => void;

  /** Optional controlled open state. Omit to let the component manage its own. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** Theming hooks so each page can keep its existing look. */
  className?: string; // wrapper (positioning context for the menu)
  triggerClassName?: string | ((open: boolean) => string); // the clickable trigger
  menuClassName?: string; // the dropdown panel (width / border / rounding / bg)

  /** Content slots. Defaults render flag + code + dial. */
  renderTrigger?: (option: DialOption, open: boolean) => ReactNode;
  renderOption?: (option: DialOption, active: boolean) => ReactNode;
  optionClassName?: (active: boolean) => string;

  /** Search box inside the menu (the full list is ~240 countries). */
  searchable?: boolean;
  searchPlaceholder?: string;

  disabled?: boolean;
  /** Max height (px) of the scrollable option list. */
  menuMaxHeight?: number;
}

const defaultOptionClassName = (active: boolean) =>
  `w-full text-left px-4 max-sm:px-3 py-2.5 max-sm:py-2 flex items-center justify-between gap-2 transition-colors text-sm max-sm:text-xs font-[outfit] ${
    active ? "bg-[#B8FF4F]/20 text-[#0B2818]" : "text-[#0B2818] hover:bg-[#B8FF4F]/10"
  }`;

export function CountryCodeSelect({
  value,
  onChange,
  open,
  onOpenChange,
  className = "relative",
  triggerClassName,
  menuClassName = "w-[240px] bg-white border-2 border-[#0B2818] rounded-xl shadow-lg flex flex-col overflow-hidden",
  renderTrigger,
  renderOption,
  optionClassName = defaultOptionClassName,
  searchable = true,
  searchPlaceholder = "Search country…",
  disabled = false,
  menuMaxHeight = 260,
}: CountryCodeSelectProps) {
  const options = getDialOptions();
  const selected = getDialOption(value);

  // Support both controlled and uncontrolled open state.
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? open : internalOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const [query, setQuery] = useState("");
  // Index of the keyboard-highlighted option within the filtered list.
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // The menu is portalled to <body>, so it must be positioned manually against
  // the trigger. This keeps it free of any parent `overflow`/stacking context —
  // it can overflow the card and still sit above (and stay clickable over)
  // sibling content like the page's action buttons.
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: rect.bottom + 8, left: rect.left });
  }, []);

  // Position the menu and keep it pinned to the trigger while open. It stays
  // hidden (via `visibility`) until the first measurement lands, so there's no
  // flash at the wrong spot.
  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, updatePosition]);

  // Close on outside click — ignore the trigger wrapper and the portalled menu.
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.code.toLowerCase().includes(q) ||
        o.dial.includes(q)
    );
  }, [query, options]);

  // Reset + focus search each time the menu opens, and highlight the current
  // selection so Up/Down start from the right place.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      const selectedIdx = options.findIndex((o) => o.code === value);
      setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
      if (searchable) requestAnimationFrame(() => searchRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, searchable]);

  // Typing narrows the list — keep the highlight on the first match.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted option scrolled into view as it moves.
  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  const choose = (option: DialOption) => {
    onChange(option);
    setOpen(false);
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
        setOpen(false);
        triggerRef.current?.focus();
        break;
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className={className} ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        className={typeof triggerClassName === "function" ? triggerClassName(isOpen) : triggerClassName}
      >
        {renderTrigger ? (
          renderTrigger(selected, isOpen)
        ) : (
          <span className="flex items-center gap-2">
            <span>{selected.flag}</span>
            <span className="font-bold">{selected.code}</span>
            <span className="text-gray-500">{selected.dial}</span>
          </span>
        )}
      </button>

      {mounted && isOpen &&
        createPortal(
          <div
            ref={menuRef}
            onKeyDown={handleKeyDown}
            className={menuClassName}
            style={{
              position: "fixed",
              top: menuPos?.top ?? -9999,
              left: menuPos?.left ?? -9999,
              margin: 0,
              visibility: menuPos ? "visible" : "hidden",
            }}
          >
            {searchable && (
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="m-2 mb-1 px-3 py-2 text-sm max-sm:text-xs rounded-lg border border-gray-200 focus:outline-none focus:border-[#B8FF4F] focus:ring-2 focus:ring-[#B8FF4F]/40 text-[#0B2818] font-[outfit]"
              />
            )}
            <div className="overflow-y-auto" style={{ maxHeight: menuMaxHeight }}>
              {filtered.length === 0 && (
                <p className="px-4 py-3 text-sm text-gray-400 font-[outfit]">No match</p>
              )}
              {filtered.map((option, index) => {
                const active = option.code === value;
                const highlighted = index === activeIndex;
                return (
                  <button
                    key={option.code}
                    ref={(el) => {
                      optionRefs.current[index] = el;
                    }}
                    type="button"
                    onClick={() => choose(option)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`${optionClassName(active)} ${highlighted && !active ? "bg-[#B8FF4F]" : ""}`}
                  >
                    {renderOption ? (
                      renderOption(option, active)
                    ) : (
                      <>
                        <span className="flex items-center gap-2 min-w-0">
                          <span>{option.flag}</span>
                          <span className="font-bold">{option.code}</span>
                          <span className="text-gray-500 truncate">{option.name}</span>
                        </span>
                        <span className="text-gray-500 shrink-0">{option.dial}</span>
                      </>
                    )}
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
