import type { Metadata } from "next";

import { PrediksiView } from "@/components/prediksi/PrediksiView";

type Props = { params: Promise<{ sensorId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sensorId } = await params;
  return { title: `Prediksi sensor ${sensorId}` };
}

export default async function PrediksiPage({ params }: Props) {
  const { sensorId } = await params;
  return <PrediksiView sensorId={Number.parseInt(sensorId, 10)} />;
}
