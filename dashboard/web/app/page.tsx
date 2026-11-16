import { NetworkChart } from "@/components/charts/NetworkChart";
import { PageHeader } from "@/components/layout/PageHeader";
import { SensorMap } from "@/components/map/SensorMap";
import { AlertList } from "@/components/ringkasan/AlertList";
import { CameraCard } from "@/components/ringkasan/CameraCard";
import { HotspotTable } from "@/components/ringkasan/HotspotTable";
import { KpiRow } from "@/components/ringkasan/KpiRow";
import { LevelDistribution } from "@/components/ringkasan/LevelDistribution";
import { ReplayControl } from "@/components/ringkasan/ReplayControl";
import { SensorSearch } from "@/components/ringkasan/SensorSearch";

export default function RingkasanPage() {
  return (
    <>
      <PageHeader eyebrow="Ringkasan Kota · Bay Area, California" title="Kondisi lalu lintas saat ini">
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <ReplayControl />
          <SensorSearch />
        </div>
      </PageHeader>

      <KpiRow />

      <div className="flex flex-wrap items-stretch gap-4">
        <SensorMap />
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <AlertList />
          <LevelDistribution />
        </div>
      </div>

      <NetworkChart />

      <div className="flex flex-wrap items-stretch gap-4">
        <HotspotTable />
        <CameraCard />
      </div>
    </>
  );
}
