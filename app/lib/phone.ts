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

export function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
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
