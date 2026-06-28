import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Toaster } from "sonner";
import "../globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5 };
export const metadata: Metadata = {
  title: "Smartmove · Agent",
  robots: { index: false, follow: false, nocache: true },
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="antialiased" style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
