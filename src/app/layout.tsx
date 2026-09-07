import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import SplashGate from "@/components/SplashGate";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-display" });


// Applies the saved theme before first paint, so a dark-mode user never sees a
// white flash. Kept as a raw script for that reason: React runs too late.
const themeScript = `
(function () {
  var LIGHT = '#f6f5f1', DARK = '#121614';
  function apply(choice) {
    try {
      if (choice) localStorage.setItem('intake-theme', choice);
      var saved = localStorage.getItem('intake-theme') || 'system';
      var dark = saved === 'dark' ||
        (saved === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? DARK : LIGHT);
    } catch (e) {}
  }
  window.__setTheme = apply;
  apply();
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { apply(); });
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "Intake",
  description: "Intelligent, effortless nutrition tracking",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icons/apple-icon.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Intake",
  },
};

export const viewport = "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning: the theme script adds a `dark` class to <html>
  // before React hydrates, which is the whole point of running it that early.
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${outfit.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/icon.svg" />
        <link rel="apple-touch-icon" href="/icons/apple-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#f6f5f1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-slate-50 text-slate-900">
        <SplashGate>{children}</SplashGate>
      </body>
    </html>
  );
}
