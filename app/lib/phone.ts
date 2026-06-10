import {
  CountryCode,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

export type CountryOption = {
  code: CountryCode;
  label: string;
};

/**
 * Canonical country dial-code option. This is the single source of truth for
 * country codes across the app — derived from libphonenumber-js, never hardcoded.
 */
export type DialOption = {
  code: CountryCode; // ISO country code, e.g. "IN"
  dial: string; // calling code with leading "+", e.g. "+91"
  name: string; // localized country name, e.g. "India"
  flag: string; // emoji flag, e.g. "🇮🇳"
};

export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

let dialOptionsCache: DialOption[] | null = null;

/**
 * The full, alphabetically-sorted list of country dial options.
 * Computed once from libphonenumber-js and cached.
 */
export function getDialOptions(): DialOption[] {
  if (dialOptionsCache) return dialOptionsCache;

  const display =
    typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames(["en"], { type: "region" })
      : null;

  dialOptionsCache = getCountries()
    .map((code) => ({
      code,
      dial: `+${getCountryCallingCode(code)}`,
      name: display?.of(code) || code,
      flag: countryFlag(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return dialOptionsCache;
}

/** Look up a single dial option by ISO country code (defaults to India). */
export function getDialOption(code: CountryCode): DialOption {
  return getDialOptions().find((o) => o.code === code) ?? getDialOptions().find((o) => o.code === "IN")!;
}

export function getCountryOptions(): CountryOption[] {
  const display =
    typeof Intl !== "undefined" && "DisplayNames" in Intl
      ? new Intl.DisplayNames(["en"], { type: "region" })
      : null;

  return getCountries().map((code) => {
    const name = display?.of(code) || code;
    const dial = getCountryCallingCode(code);

    return {
      code,
      label: `${countryFlag(code)} ${name} (+${dial})`,
    };
  });
}

export function normalizeToE164(input: string, country: CountryCode): string | null {
  const value = input.trim();
  if (!value) return null;

  const parsed = value.startsWith("+")
    ? parsePhoneNumberFromString(value)
    : parsePhoneNumberFromString(value, country);

  if (!parsed?.isValid()) return null;
  return parsed.number;
}
