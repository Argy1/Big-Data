import type { Metadata } from "next";

import { KameraView } from "@/components/kamera/KameraView";

export const metadata: Metadata = { title: "Kamera Live" };

export default function KameraPage() {
  return <KameraView />;
}
