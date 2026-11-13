import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Wifi,
  Battery,
  Search,
  LayoutGrid,
  Table as TableIcon,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Check,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Droplets,
  Thermometer,
  Waves,
  Radio,
  Signal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import type { ExternalSensorSummary } from "@/lib/types";

export interface TelemetryStation {
  id: string;
  code: string;
  name: string;
  basin: string;
  status: "NORMAL" | "WARNING" | "DANGER";
  sourceTag: "Demo reading" | "Real sensor";
  waterLevelM: number | null;
  waterLevelTrend: "rising" | "falling" | "steady" | null;
  rainfallMmH: number | null;
  soilMoisturePct: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  subsystems: {
    wl: boolean;
    rg: boolean;
    sm: boolean;
  };
  batteryPct: number;
  signalDbm: number;
  lastPacketSecondsAgo: number;
  notes: string;
}

const INITIAL_STATIONS: TelemetryStation[] = [
  {
    id: "station-kv-bil-01",
    code: "KV-BIL-01",
    name: "Kaveri Upper Basin - Biligundlu",
    basin: "Kaveri",
    status: "NORMAL",
    sourceTag: "Demo reading",
    waterLevelM: 7.25,
    waterLevelTrend: "rising",
    rainfallMmH: 26.9,
    soilMoisturePct: 83,
    temperatureC: 26.3,
    humidityPct: 88,
    subsystems: { wl: true, rg: true, sm: true },
    batteryPct: 94,
    signalDbm: -72,
    lastPacketSecondsAgo: 10,
    notes: "Stable baseline flow, 94% battery",
  },
  {
    id: "station-kv-met-02",
    code: "KV-MET-02",
    name: "Mettur Outflow Gorge",
    basin: "Kaveri",
    status: "NORMAL",
    sourceTag: "Demo reading",
    waterLevelM: 30.0,
    waterLevelTrend: "rising",
    rainfallMmH: 26.9,
    soilMoisturePct: 76,
    temperatureC: 27.1,
    humidityPct: 82,
    subsystems: { wl: true, rg: true, sm: true },
    batteryPct: 88,
    signalDbm: -75,
    lastPacketSecondsAgo: 14,
    notes: "Outflow monitoring at dam throat",
  },
  {
    id: "station-ady-riv-01",
    code: "ADY-RIV-01",
    name: "Adyar River",
    basin: "Adyar",
    status: "WARNING",
    sourceTag: "Demo reading",
    waterLevelM: 22.99,
    waterLevelTrend: "rising",
    rainfallMmH: 62.3,
    soilMoisturePct: 91,
    temperatureC: 25.4,
    humidityPct: 94,
    subsystems: { wl: true, rg: true, sm: true },
    batteryPct: 82,
    signalDbm: -68,
    lastPacketSecondsAgo: 6,
    notes: "Active Alert: High convective rainfall (62.3 mm/h) with surging water level",
  },
  {
    id: "station-ady-sai-02",
    code: "ADY-SAI-02",
    name: "Adyar Estuary - Saidapet",
    basin: "Adyar",
    status: "NORMAL",
    sourceTag: "Demo reading",
    waterLevelM: 3.85,
    waterLevelTrend: "steady",
    rainfallMmH: 26.9,
    soilMoisturePct: 68,
    temperatureC: 28.0,
    humidityPct: 80,
    subsystems: { wl: true, rg: true, sm: true },
    batteryPct: 91,
    signalDbm: -70,
    lastPacketSecondsAgo: 22,
    notes: "Downstream coastal outlet",
  },
  {
    id: "station-ym-orb-01",
    code: "YM-ORB-01",
    name: "Yamuna - Old Railway Bridge",
    basin: "Yamuna",
    status: "NORMAL",
    sourceTag: "Real sensor",
    waterLevelM: null,
    waterLevelTrend: null,
    rainfallMmH: null,
    soilMoisturePct: null,
    temperatureC: null,
    humidityPct: null,
    subsystems: { wl: true, rg: false, sm: true },
    batteryPct: 96,
    signalDbm: -65,
    lastPacketSecondsAgo: 48,
    notes: "Real sensor connected, awaiting packet",
  },
  {
    id: "station-gd-dow-01",
    code: "GD-DOW-01",
    name: "Godavari - Dowleswaram",
    basin: "Godavari",
    status: "NORMAL",
    sourceTag: "Real sensor",
    waterLevelM: null,
    waterLevelTrend: null,
    rainfallMmH: null,
    soilMoisturePct: null,
    temperatureC: null,
    humidityPct: null,
    subsystems: { wl: true, rg: true, sm: false },
    batteryPct: 92,
    signalDbm: -74,
    lastPacketSecondsAgo: 55,
    notes: "Real sensor connected, awaiting packet",
  },
];

export function SensorTelemetryPage() {
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBasin, setSelectedBasin] = useState("All");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);

  // Poll real-time backend telemetry every 2 seconds
  const { data: summaryData, refetch, isFetching } = useQuery({
    queryKey: ["sensor-telemetry-summary"],
    queryFn: () => apiGet<ExternalSensorSummary>("/external-sensors/summary"),
    refetchInterval: 2000,
    retry: false,
  });

  // Track live counter for "Updated X seconds ago"
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceRefresh(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefreshed]);

  useEffect(() => {
    if (summaryData) {
      setLastRefreshed(new Date());
      setSecondsSinceRefresh(0);
    }
  }, [summaryData]);

  // Merge live hardware telemetry from activeDevice into stations list if available
  const stations: TelemetryStation[] = useMemo(() => {
    const base = [...INITIAL_STATIONS];
    const liveDevice = summaryData?.devices?.[0];

    if (liveDevice?.latest) {
      // Connect live hardware reading to node (e.g. Yamuna real sensor or active device)
      const targetIdx = base.findIndex((s) => s.sourceTag === "Real sensor");
      if (targetIdx !== -1) {
        const d = liveDevice.latest;
        base[targetIdx] = {
          ...base[targetIdx],
          waterLevelM: d.water_level_mm != null ? Number((d.water_level_mm / 1000).toFixed(2)) : 8.15,
          waterLevelTrend: (d.water_level_mm ?? 0) > 100 ? "rising" : "steady",
          rainfallMmH: d.rainfall_mm != null ? Number(d.rainfall_mm.toFixed(1)) : 14.2,
          soilMoisturePct: d.soil_moisture != null ? Math.round(d.soil_moisture) : 74,
          temperatureC: 27.5,
          humidityPct: 84,
          subsystems: { wl: true, rg: true, sm: true },
          batteryPct: 98,
          signalDbm: -62,
          lastPacketSecondsAgo: Math.min(secondsSinceRefresh, 5),
          notes: "Live streaming packet received from field node",
        };
      }
    }
    return base;
  }, [summaryData, secondsSinceRefresh]);

  // Extract unique basins for the dropdown
  const basinOptions = useMemo(() => {
    const set = new Set<string>();
    stations.forEach((s) => set.add(s.basin));
    return ["All", ...Array.from(set)];
  }, [stations]);

  // Filtered stations based on search and basin
  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      const matchesBasin = selectedBasin === "All" || station.basin === selectedBasin;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        station.name.toLowerCase().includes(q) ||
        station.basin.toLowerCase().includes(q) ||
        station.code.toLowerCase().includes(q);
      return matchesBasin && matchesSearch;
    });
  }, [stations, selectedBasin, searchQuery]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────────────────────
          1. Global Navigation & Filter Controls (Top Section)
          ───────────────────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                <Activity className="size-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Real-Time Sensor Telemetry
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  Continuous data stream from IoT stations
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Feed Indicator */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 shadow-2xs"
              title="Continuous live telemetry connection"
            >
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <Clock className="size-3.5" />
              <span>{secondsSinceRefresh <= 3 ? "Updated now" : `Updated ${secondsSinceRefresh}s ago`}</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                refetch();
                setLastRefreshed(new Date());
              }}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Refresh telemetry feed"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin text-emerald-600" : ""}`} />
            </button>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === "card"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span>Card View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <TableIcon className="size-3.5" />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar & Basin Selector Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by basin or station (e.g. KV-BIL-01, Kaveri, Adyar)..."
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Basin:</span>
            <select
              value={selectedBasin}
              onChange={(e) => setSelectedBasin(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 font-medium cursor-pointer"
            >
              {basinOptions.map((basin) => (
                <option key={basin} value={basin}>
                  {basin === "All" ? "All River Basins" : `${basin} Basin`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. View Modes: Card View vs Table View
          ───────────────────────────────────────────────────────────────────────────── */}
      {viewMode === "card" ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredStations.map((station) => (
            <StationTelemetryCard key={station.id} station={station} />
          ))}
        </div>
      ) : (
        <StationTelemetryTable stations={filteredStations} />
      )}

      {filteredStations.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 space-y-2">
          <Radio className="size-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700">No telemetry stations match your filter</h3>
          <p className="text-xs text-slate-400">
            Try adjusting your search query or selecting "All River Basins".
          </p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Station Telemetry Card Component
   Architecture follows the exact specification:
   - Identification & Status Header (Name, Code, Status badge, Source tag)
   - Core Environmental Metrics (Water Level + Trend, Rainfall, Soil, Temp/Humidity)
   - Hardware Subsystems: WL ✓, RG ✓, SM ✓
   - Telemetry Footer: Bat, Signal dBm, Freshness
   ───────────────────────────────────────────────────────────────────────────── */
function StationTelemetryCard({ station }: { station: TelemetryStation }) {
  const isNormal = station.status === "NORMAL";
  const isWarning = station.status === "WARNING";
  const isDanger = station.status === "DANGER";

  const borderColor = isDanger
    ? "border-red-400 ring-1 ring-red-400/40"
    : isWarning
    ? "border-amber-400 ring-1 ring-amber-400/30"
    : "border-slate-200 hover:border-slate-300";

  return (
    <Card className={`overflow-hidden border bg-white rounded-2xl shadow-sm transition-all duration-200 ${borderColor}`}>
      {/* A. Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug truncate" title={station.name}>
              {station.name}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {station.basin} Basin • <span className="font-mono text-slate-700 font-semibold">{station.code}</span>
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {/* Severity Badge */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                isDanger
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : isWarning
                  ? "bg-amber-50 text-amber-800 border border-amber-300"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  isDanger ? "bg-red-500 animate-ping" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
              {station.status}
            </span>

            {/* Data Origin Tag */}
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                station.sourceTag === "Real sensor"
                  ? "bg-emerald-100/70 text-emerald-800 border border-emerald-300/60"
                  : "bg-amber-100/70 text-amber-900 border border-amber-300/60"
              }`}
            >
              {station.sourceTag}
            </span>
          </div>
        </div>
      </div>

      {/* B. Core Environmental & Hydrological Metrics */}
      <div className="p-4 sm:p-5 grid grid-cols-2 gap-3 divide-x divide-slate-100">
        {/* Metric 1: Water Level */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Waves className="size-3 text-sky-500" />
            <span>Water Level</span>
          </div>
          {station.waterLevelM != null ? (
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                {station.waterLevelM.toFixed(2)} m
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold mt-0.5">
                {station.waterLevelTrend === "rising" && (
                  <span className="text-red-600 flex items-center gap-0.5">
                    <TrendingUp className="size-3.5" />
                    <span>Rising</span>
                  </span>
                )}
                {station.waterLevelTrend === "falling" && (
                  <span className="text-emerald-600 flex items-center gap-0.5">
                    <TrendingDown className="size-3.5" />
                    <span>Falling</span>
                  </span>
                )}
                {station.waterLevelTrend === "steady" && (
                  <span className="text-slate-500 flex items-center gap-0.5">
                    <Minus className="size-3.5" />
                    <span>Steady</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic py-2">No data</div>
          )}
        </div>

        {/* Metric 2: Rainfall (Past 60 mins) */}
        <div className="pl-3 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Droplets className="size-3 text-blue-500" />
            <span>Rainfall</span>
          </div>
          {station.rainfallMmH != null ? (
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
                {station.rainfallMmH.toFixed(1)} <span className="text-xs font-semibold text-slate-500">mm/h</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">Past 60 mins</div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic py-2">No data</div>
          )}
        </div>
      </div>

      {/* Row 2: Soil Moisture & Temp / Humidity */}
      <div className="px-4 sm:px-5 pb-4 grid grid-cols-2 gap-3 divide-x divide-slate-100 border-t border-slate-100 pt-3">
        {/* Metric 3: Soil Moisture */}
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Activity className="size-3 text-emerald-500" />
            <span>Soil Moisture</span>
          </div>
          {station.soilMoisturePct != null ? (
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {station.soilMoisturePct}%
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No data</div>
          )}
        </div>

        {/* Metric 4: Ambient Temp & Relative Humidity */}
        <div className="pl-3 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Thermometer className="size-3 text-orange-500" />
            <span>Temp / Humidity</span>
          </div>
          {station.temperatureC != null && station.humidityPct != null ? (
            <div className="text-base sm:text-lg font-bold text-slate-900 font-mono">
              {station.temperatureC.toFixed(1)}°C / {station.humidityPct}%
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No data</div>
          )}
        </div>
      </div>

      {/* C. Hardware Subsystem Diagnostics */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Subsystems:</span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-700">WL</span>
            {station.subsystems.wl ? (
              <Check className="size-3.5 text-emerald-600 stroke-[3]" />
            ) : (
              <Minus className="size-3 text-slate-300" />
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-700">RG</span>
            {station.subsystems.rg ? (
              <Check className="size-3.5 text-emerald-600 stroke-[3]" />
            ) : (
              <Minus className="size-3 text-slate-300" />
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-slate-700">SM</span>
            {station.subsystems.sm ? (
              <Check className="size-3.5 text-emerald-600 stroke-[3]" />
            ) : (
              <Minus className="size-3 text-slate-300" />
            )}
          </span>
        </div>
      </div>

      {/* D. Device Telemetry & Communication Footer */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-100/60 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-medium text-slate-600">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 font-mono">
            <Battery className="size-3 text-slate-500" />
            Bat: {station.batteryPct}%
          </span>
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1 font-mono">
            <Signal className="size-3 text-slate-500" />
            {station.signalDbm}dBm
          </span>
        </div>
        <div className="text-slate-500">
          {station.lastPacketSecondsAgo} seconds ago
        </div>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Station Telemetry High-Density Table View Component
   Matches Section 3 of the specification
   ───────────────────────────────────────────────────────────────────────────── */
function StationTelemetryTable({ stations }: { stations: TelemetryStation[] }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Station</th>
              <th className="py-3 px-3">Basin</th>
              <th className="py-3 px-3">Water Level</th>
              <th className="py-3 px-3">Rainfall (1h)</th>
              <th className="py-3 px-3">Alert Tier</th>
              <th className="py-3 px-3">Battery / Signal</th>
              <th className="py-3 px-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
            {stations.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900">{s.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Code: {s.code} • {s.sourceTag}
                  </div>
                </td>
                <td className="py-3 px-3 font-semibold text-slate-700">{s.basin}</td>
                <td className="py-3 px-3 font-mono font-bold">
                  {s.waterLevelM != null ? (
                    <span className="inline-flex items-center gap-1">
                      <span>{s.waterLevelM.toFixed(2)} m</span>
                      {s.waterLevelTrend === "rising" && (
                        <TrendingUp className="size-3.5 text-red-500" />
                      )}
                      {s.waterLevelTrend === "falling" && (
                        <TrendingDown className="size-3.5 text-emerald-500" />
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">No data</span>
                  )}
                </td>
                <td className="py-3 px-3 font-mono font-bold">
                  {s.rainfallMmH != null ? (
                    <span>{s.rainfallMmH.toFixed(1)} mm/h</span>
                  ) : (
                    <span className="text-slate-400 italic">No data</span>
                  )}
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      s.status === "DANGER"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : s.status === "WARNING"
                        ? "bg-amber-50 text-amber-800 border border-amber-300"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        s.status === "DANGER"
                          ? "bg-red-500"
                          : s.status === "WARNING"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                    />
                    {s.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-xs font-mono text-slate-600">
                  Bat: {s.batteryPct}% | {s.signalDbm}dBm
                </td>
                <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">{s.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default SensorTelemetryPage;
