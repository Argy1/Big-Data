/** Indonesian descriptions of Model B features (model_b_config.json "features"), for ReasonPanel. */
export const FEATURE_LABELS: Record<string, string> = {
  v_now: "kecepatan sekarang",
  v_lag5m: "5 menit lalu",
  v_lag15m: "15 menit lalu",
  v_lag30m: "30 menit lalu",
  v_lag60m: "1 jam lalu",
  v_roll30m: "rata-rata 30 menit",
  v_roll60m: "rata-rata 1 jam",
  v_std60m: "gejolak 1 jam terakhir",
  v_yesterday: "kemarin, jam sama",
  v_lastweek: "minggu lalu, jam sama",
  prof_target: "normal di jam target",
  dev_now: "beda sekarang vs normal",
  ratio_now: "rasio sekarang / v_ff",
  nb_ratio_now: "5 sensor tetangga",
  hour_target: "jam yang diprediksi",
  dow_target: "hari yang diprediksi",
  weekend_target: "akhir pekan atau bukan",
  holiday_target: "hari libur atau bukan",
  lanes: "jumlah lajur",
  vff: "kecepatan arus bebas",
  fwy: "ruas jalan tol",
  rain_now_mm: "hujan sekarang",
  rain_3h_mm: "hujan 3 jam terakhir",
};

export function featureLabel(name: string): string {
  return FEATURE_LABELS[name] ?? name;
}
