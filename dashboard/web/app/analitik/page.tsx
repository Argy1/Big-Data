import type { Metadata } from "next";

import { LambdaDiagram } from "@/components/analitik/LambdaDiagram";
import { ModelCards } from "@/components/analitik/ModelCards";
import { StatCards } from "@/components/analitik/StatCards";
import { DailyTrend } from "@/components/charts/DailyTrend";
import { Heatmap } from "@/components/charts/Heatmap";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = { title: "Analitik & Model" };

export default function AnalitikPage() {
  return (
    <>
      <PageHeader eyebrow="Batch layer · analitik historis" title="Pola kemacetan Januari–Juni 2017" />
      <StatCards />
      <Heatmap />
      <DailyTrend />
      <ModelCards />
      <LambdaDiagram />
    </>
  );
}
