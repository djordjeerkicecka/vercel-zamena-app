import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TENZIA — Zamene i refundacije",
  description: "Forma za podnošenje zahteva za zamenu artikla ili refundaciju novca.",
};

// Explicit viewport so the page always fits the device width (initial-scale 1). User zoom stays
// enabled for accessibility; the 16px input font-size (globals.css) is what prevents iOS auto-zoom.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>{children}</body>
    </html>
  );
}
