/** Data & model credits (PLAN §15), shown under every page. */
const SOURCES = [
  { name: "PEMS-BAY", by: "Caltrans PeMS, via DCRNN / Zenodo" },
  { name: "UCSD Traffic Video Database", by: "Chan & Vasconcelos; video WSDOT" },
  { name: "Roboflow “Traffic Congestion Detection”", by: "CC BY 4.0" },
  { name: "Ultralytics YOLOv8", by: "AGPL-3.0" },
  { name: "Open-Meteo", by: "CC BY 4.0" },
  { name: "Peta", by: "© CARTO, © OpenStreetMap" },
  { name: "Video uji", by: "Pexels" },
];

export function Attribution() {
  return (
    <footer className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted">
      <p className="m-0">
        <b className="font-semibold text-text-2">Mode replay:</b> data sensor Juni 2017 diputar ulang sebagai &quot;sekarang&quot;; tidak ada
        sensor live. Proyek Akhir Teknologi Big Data · D4 TRPL, Sekolah Vokasi IPB.
      </p>
      <p className="m-0 mt-1">
        Sumber & lisensi:{" "}
        {SOURCES.map((s, i) => (
          <span key={s.name}>
            {s.name} ({s.by}){i < SOURCES.length - 1 ? " · " : "."}
          </span>
        ))}
      </p>
    </footer>
  );
}
