import { redirect } from "next/navigation";

/** Menu "Prediksi Sensor" opens the demo sensor (Airport Blvd, PLAN §16). */
const DEFAULT_SENSOR_ID = 403225;

export default function PrediksiIndex() {
  redirect(`/prediksi/${DEFAULT_SENSOR_ID}`);
}
