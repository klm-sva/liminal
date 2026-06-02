import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import DevNavLoader from "@/components/dev/DevNavLoader";

const dmSerifDisplay = DM_Serif_Display({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-dm-serif",
  display: "swap",
});

const dmSans = DM_Sans({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LIMINALsva — LEED & WELL Certification Documentation Platform",
    template: "%s | LIMINALsva",
  },
  description:
    "Documentation platform for LEED BD+C v4.1, WELL v2, and WELL Health-Safety Rating certifications. Streamline credit tracking, narrative generation, and submission.",
  keywords: [
    "LEED certification",
    "WELL certification",
    "green building",
    "certification documentation",
    "LEED BD+C",
    "WELL v2",
    "sustainability",
  ],
  authors: [{ name: "LIMINALsva" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://liminalsva.com",
    siteName: "LIMINALsva",
    title: "LIMINALsva — LEED & WELL Certification Documentation Platform",
    description:
      "Streamline your path to LEED BD+C v4.1, WELL v2, and WELL Health-Safety Rating certification.",
  },
  twitter: {
    card: "summary_large_image",
    title: "LIMINALsva — Certification Documentation Platform",
    description:
      "LEED & WELL certification documentation. Faster. Smarter. Certified.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#12424a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${dmSans.variable}`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === "development" && <DevNavLoader />}
      </body>
    </html>
  );
}
