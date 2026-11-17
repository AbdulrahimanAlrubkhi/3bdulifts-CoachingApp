"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

function apply() {
  const html = document.documentElement;
  const locale = readCookie("locale") === "en" ? "en" : "ar";
  html.setAttribute("data-theme", readCookie("theme") === "light" ? "light" : "dark");
  html.setAttribute("lang", locale);
  html.setAttribute("dir", locale === "ar" ? "rtl" : "ltr");
}

/** Re-applies theme and direction after React's dev-mode remount clears them. No-op in production. */
export function PrefsSync() {
  useLayoutEffect(apply, []);
  return null;
}

const pill =
  "h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-text transition-colors";

export function LocaleToggle() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={pill}
      onClick={() => {
        writeCookie("locale", readCookie("locale") === "en" ? "ar" : "en");
        apply();
        router.refresh();
      }}
    >
      <span className="only-en">العربية</span>
      <span className="only-ar">English</span>
    </button>
  );
}

export function ThemeToggle({ dark, light }: { dark: string; light: string }) {
  return (
    <button
      type="button"
      className={pill}
      onClick={() => {
        writeCookie("theme", readCookie("theme") === "light" ? "dark" : "light");
        apply();
      }}
    >
      <span className="only-dark">{light}</span>
      <span className="only-light">{dark}</span>
    </button>
  );
}
