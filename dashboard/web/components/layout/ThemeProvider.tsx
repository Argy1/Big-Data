"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Dark by default, OS preference ignored, choice persisted as `arus-theme` (PLAN §9.1–9.2). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      themes={["dark", "light"]}
      storageKey="arus-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
