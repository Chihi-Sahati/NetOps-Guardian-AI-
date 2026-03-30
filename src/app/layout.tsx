import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const interSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Net's AI Security Agent | Multi-Vendor NOC Platform",
  description: "Advanced Network Operations Center with Zero Trust Security. Multi-vendor support for Cisco, Huawei, Nokia, Juniper, Ericsson. AI-powered network management.",
  keywords: ["NOC", "Network Operations", "Zero Trust", "Cisco", "Huawei", "Security", "AI Agent", "Network Management"],
  authors: [{ name: "NOC Team - Dr. Houda Chihi" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Net's AI Security Agent",
    description: "Multi-Vendor Network Operations Center with Zero Trust Security",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${interSans.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
