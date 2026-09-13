import type { Metadata } from "next";
import "./globals.css";
import { SALON_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${SALON_NAME} - Consultation Portal`,
  description: `Client consultation intake and records console for ${SALON_NAME}.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
