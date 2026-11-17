import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { PrefsSync } from "@/components/Prefs";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  variable: "--font-plex",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "3bdu.lifts",
  description: "Workout and nutrition coaching.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0e0f",
};

// Runs before first paint: applies the saved theme and language direction from cookies,
// so the page never flashes the wrong theme or flips direction after loading.
const prefsScript = `(function(){try{var c=document.cookie,h=document.documentElement,t=c.match(/(?:^|; )theme=([^;]*)/),l=c.match(/(?:^|; )locale=([^;]*)/);if(t&&t[1]==="light")h.setAttribute("data-theme","light");if(l&&l[1]==="en"){h.setAttribute("lang","en");h.setAttribute("dir","ltr")}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme="dark"
      className={`${plex.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body className="min-h-full">
        <PrefsSync />
        {children}
      </body>
    </html>
  );
}
