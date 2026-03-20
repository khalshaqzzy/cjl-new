import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, DM_Sans } from "next/font/google"
import "./globals.css"
import { FONT_DISPLAY, FONT_BODY } from "@/lib/fonts"

// Google Fonts: "${FONT_DISPLAY}" for headings, "${FONT_BODY}" for body

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
})

const fontBody = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "CJ Laundry — Self Service Laundry Modern",
  description:
    "Laundry mandiri modern dengan program stamp reward dan portal pelanggan. Kunjungi CJ Laundry untuk pengalaman laundry terbaik.",
  keywords: ["laundry", "self service", "cuci baju", "CJ Laundry", "stamp reward"],
  openGraph: {
    title: "CJ Laundry — Self Service Laundry Modern",
    description: "Laundry mandiri modern dengan program stamp reward dan portal pelanggan.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#f04e94",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${fontDisplay.variable} ${fontBody.variable}`}
      data-scroll-behavior="smooth"
    >
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  )
}
