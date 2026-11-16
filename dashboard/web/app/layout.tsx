import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { ApiStatusBanner } from "@/components/layout/ApiStatusBanner";
import { Attribution } from "@/components/layout/Attribution";
import { Providers } from "@/components/layout/Providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

import "@/styles/globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "Arus", template: "%s · Arus" },
  description: "Pemantauan & prediksi kemacetan lalu lintas kota berbasis Lambda Architecture",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes sets data-theme on <html> before React hydrates
    <html lang="id" suppressHydrationWarning className={`${jakarta.variable} ${jetbrains.variable}`}>
      <body>
        <ThemeProvider>
          <Providers>
            <div className="flex min-h-dvh flex-col bg-bg text-text min-[900px]:flex-row">
              <Sidebar />
              <main className="flex min-w-0 flex-1 flex-col gap-6 px-[clamp(16px,3vw,40px)] pt-7 pb-12">
                <ApiStatusBanner />
                {children}
                <Attribution />
              </main>
            </div>
            <Toaster position="bottom-right" />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
