import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import {
  Radio,
  Filter,
  Layers,
  Upload,
  RefreshCw,
  X,
  MapPin,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Signal,
  Check,
  AlertTriangle,
  Info,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import type { MobileTower, TowerOperator, TowerFloodRisk, TowerStats } from "@/lib/types";
import {
  fetchTowers,
  fetchTowerStats,
  fetchOsmTowers,
  importGeoJsonTowers,
  TOWER_RISK_COLORS,
  OPERATOR_COLORS,
} from "@/services/towerService";

export interface MobileTowerLayerProps {
  map: L.Map | null;
  visible: boolean;
  onTowerSelect?: (tower: MobileTower | null) => void;
  selectedTowerId?: string | null;
  showFilterControls?: boolean;
}

const RISK_LEVEL_ORDER: Record<string, number> = {
  Critical: 4,
  High: 3,
  Moderate: 2,
  Low: 1,
};

// Helper: Determine highest risk level in a cluster
function getDominantRisk(towers: MobileTower[]): TowerFloodRisk {
  let highest = 0;
  let dominantRisk: TowerFloodRisk = "Low";
  for (const t of towers) {
    const r = (t.flood_risk_level || "Low") as TowerFloodRisk;
    const score = RISK_LEVEL_ORDER[r] || 1;
    if (score > highest) {
      highest = score;
      dominantRisk = r;
    }
  }
  return dominantRisk;
}

// Generate SVG icon for a single tower marker
function createTowerDivIcon(tower: MobileTower, isSelected: boolean): L.DivIcon {
  const towerGreen = "#22C55E";
  const op = tower.operator || "Unknown";
  const opLetter = op === "Jio" ? "J" : op === "Airtel" ? "A" : op === "Vi" ? "V" : op === "BSNL" ? "B" : "?";

  // Operator color for small badge
  const opBgColor =
    op === "Jio"
      ? "#2563EB"
      : op === "Airtel"
      ? "#DC2626"
      : op === "Vi"
      ? "#7C3AED"
      : op === "BSNL"
      ? "#D97706"
      : "#16A34A";

  const size = isSelected ? 44 : 36;
  const half = size / 2;

  const html = `
    <div class="tower-marker-container" style="
      position: relative;
      width: ${size}px;
      height: ${size + 8}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transform: translate(-${half}px, -${size}px);
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
      transition: transform 0.15s ease;
    ">
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        background: #022c22;
        border: 2.5px solid ${towerGreen};
        border-radius: 50% 50% 50% 4px;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 ${isSelected ? "14px" : "8px"} ${towerGreen};
      ">
        <div style="
          transform: rotate(45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        ">
          <!-- Recognizable Mobile Communication Mast SVG -->
          <svg width="${size * 0.6}" height="${size * 0.6}" viewBox="0 0 24 24" fill="none" stroke="${towerGreen}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Mast legs and lattices -->
            <path d="M12 2v20" stroke="#FFFFFF" stroke-width="2"/>
            <path d="M7 22l5-18 5 18" stroke="#FFFFFF" stroke-width="1.8"/>
            <path d="M8.5 16h7" stroke="#FFFFFF" stroke-width="1.5"/>
            <path d="M10 11h4" stroke="#FFFFFF" stroke-width="1.5"/>
            <circle cx="12" cy="3" r="1.5" fill="${towerGreen}" stroke="${towerGreen}"/>
            <!-- Radio broadcast arcs -->
            <path d="M4.93 4.93a10 10 0 0 1 14.14 0" stroke="${towerGreen}" stroke-width="1.5" stroke-dasharray="2 1"/>
            <path d="M7.76 7.76a6 6 0 0 1 8.48 0" stroke="${towerGreen}" stroke-width="1.5"/>
          </svg>
        </div>
      </div>

      <!-- Operator Mini Badge -->
      <div style="
        position: absolute;
        bottom: 2px;
        right: -2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: ${opBgColor};
        color: white;
        border: 1.5px solid #0F172A;
        font-family: 'IBM Plex Sans', sans-serif;
        font-size: 9px;
        font-weight: 800;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
      ">
        ${opLetter}
      </div>

      <!-- Ground Pin Point -->
      <div style="
        width: 6px;
        height: 6px;
        background: ${towerGreen};
        border-radius: 50%;
        margin-top: -3px;
        box-shadow: 0 0 4px ${towerGreen};
      "></div>
    </div>
  `;

  return L.divIcon({
    className: "custom-mobile-tower-icon",
    html,
    iconSize: [size, size + 8],
    iconAnchor: [half, size + 8],
    popupAnchor: [0, -(size + 10)],
  });
}

// Generate SVG cluster icon
function createClusterDivIcon(count: number, dominantRisk: TowerFloodRisk): L.DivIcon {
  const riskColor = TOWER_RISK_COLORS[dominantRisk]?.hex || "#10B981";
  const size = count >= 20 ? 48 : count >= 8 ? 42 : 36;
  const half = size / 2;

  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transform: translate(-${half}px, -${half}px);
    ">
      <!-- Pulsing radar glow in highest flood risk color -->
      <div style="
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        background: ${riskColor};
        opacity: 0.28;
        animation: pulse 2s infinite ease-in-out;
      "></div>

      <!-- Main cluster bubble -->
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size}px;
        background: #0F172A;
        border: 2.5px solid ${riskColor};
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.45);
        color: white;
      ">
        <div style="display:flex;align-items:center;gap:1px;font-size:10px;font-weight:700;color:${riskColor};line-height:1;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${riskColor}" stroke-width="2.5"><path d="M12 2v20M7 22l5-18 5 18M8.5 16h7"/></svg>
        </div>
        <span style="font-family:'IBM Plex Sans',sans-serif;font-size:${size > 40 ? "13px" : "11px"};font-weight:800;color:white;line-height:1.1;">
          ${count}
        </span>
      </div>
    </div>
  `;

  return L.divIcon({
    className: "custom-mobile-tower-cluster-icon",
    html,
    iconSize: [size, size],
    iconAnchor: [half, half],
  });
}

// Generate Leaflet popup HTML
function createTowerPopupHtml(tower: MobileTower): string {
  const risk = (tower.flood_risk_level || "Low") as TowerFloodRisk;
  const riskColor = TOWER_RISK_COLORS[risk]?.hex || "#10B981";
  const op = tower.operator || "Unknown";
  const heightStr = tower.height ? `${tower.height} m` : "Not specified";

  return `
    <div style="font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif;min-width:240px;max-width:290px;padding:4px 2px;color:#0F172A;">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:between;gap:8px;border-bottom:1px solid #E2E8F0;padding-bottom:8px;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:18px;">🗼</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#0F172A;line-height:1.2;">
              ${tower.name || "Mobile Communication Tower"}
            </div>
            <div style="font-size:10px;font-family:monospace;color:#64748B;">
              ID: ${tower.id}
            </div>
          </div>
        </div>
      </div>

      <!-- Attributes Grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
        <div style="background:#F8FAFC;padding:6px;border-radius:6px;border:1px solid #E2E8F0;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748B;">Network Operator</div>
          <div style="font-size:12px;font-weight:700;color:#0F172A;margin-top:2px;display:flex;align-items:center;gap:4px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${
              op === "Jio" ? "#2563EB" : op === "Airtel" ? "#DC2626" : op === "Vi" ? "#7C3AED" : op === "BSNL" ? "#D97706" : "#64748B"
            };"></span>
            ${op}
          </div>
        </div>

        <div style="background:#F8FAFC;padding:6px;border-radius:6px;border:1px solid #E2E8F0;">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#64748B;">Flood Risk Level</div>
          <div style="font-size:12px;font-weight:800;color:${riskColor};margin-top:2px;">
            ${risk} Risk
          </div>
        </div>
      </div>

      <!-- Coordinates & Height -->
      <div style="background:#F1F5F9;padding:6px 8px;border-radius:6px;font-size:11px;color:#334155;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
          <span style="color:#64748B;">Coordinates:</span>
          <span style="font-family:monospace;font-weight:600;">${tower.lat.toFixed(5)}°N, ${tower.lng.toFixed(5)}°E</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:#64748B;">Mast Height:</span>
          <span style="font-weight:600;">${heightStr}</span>
        </div>
      </div>

      <!-- Data Source & Note -->
      <div style="font-size:10px;color:#64748B;border-top:1px solid #E2E8F0;padding-top:6px;display:flex;justify-content:space-between;align-items:center;">
        <span>Source: <b>${tower.source || "OpenStreetMap"}</b></span>
        <span style="display:inline-block;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600;background:${riskColor}15;color:${riskColor};border:1px solid ${riskColor}40;">
          Live Spatial Sync
        </span>
      </div>
    </div>
  `;
}

export default function MobileTowerLayer({
  map,
  visible,
  onTowerSelect,
  selectedTowerId,
  showFilterControls = true,
}: MobileTowerLayerProps) {
  const [towers, setTowers] = useState<MobileTower[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<TowerStats | null>(null);

  // Filters
  const [operatorFilter, setOperatorFilter] = useState<TowerOperator | "All">("All");
  const [riskFilter, setRiskFilter] = useState<TowerFloodRisk | "All">("All");
  const [hudOpen, setHudOpen] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isFetchingOsm, setIsFetchingOsm] = useState(false);

  // Layer group refs
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Fetch towers & stats from shared backend API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [towersData, statsData] = await Promise.all([
        fetchTowers({
          operator: operatorFilter !== "All" ? operatorFilter : undefined,
          flood_risk: riskFilter !== "All" ? riskFilter : undefined,
        }),
        fetchTowerStats(),
      ]);
      setTowers(towersData);
      setStats(statsData);
    } catch (err: any) {
      console.error("Failed to load mobile network towers:", err);
      toast.error("Could not fetch mobile tower data from server.");
    } finally {
      setIsLoading(false);
    }
  }, [operatorFilter, riskFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Filtered list of towers
  const filteredTowers = useMemo(() => {
    return towers.filter((t) => {
      if (operatorFilter !== "All" && t.operator !== operatorFilter) return false;
      if (riskFilter !== "All" && t.flood_risk_level !== riskFilter) return false;
      return true;
    });
  }, [towers, operatorFilter, riskFilter]);

  // 3. Render Leaflet markers with spatial grid clustering
  const renderMarkers = useCallback(() => {
    if (!map) return;

    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }
    const lg = layerGroupRef.current;
    lg.clearLayers();

    if (!visible) return;

    const zoom = map.getZoom();
    const useClustering = zoom < 14;

    if (!useClustering || filteredTowers.length <= 1) {
      // Zoomed in: Render individual tower markers
      filteredTowers.forEach((tower) => {
        const isSelected = selectedTowerId === tower.id;
        const icon = createTowerDivIcon(tower, isSelected);
        const marker = L.marker([tower.lat, tower.lng], { icon });

        marker.bindPopup(createTowerPopupHtml(tower), {
          maxWidth: 320,
          className: "custom-tower-popup",
        });

        marker.on("click", () => {
          onTowerSelect?.(tower);
        });

        lg.addLayer(marker);
      });
      return;
    }

    // Zoomed out: Spatial grid clustering based on screen pixel distance
    const clusterPixelRadius = 55;
    interface Cluster {
      towers: MobileTower[];
      pixelPoint: L.Point;
      centerLat: number;
      centerLng: number;
    }

    const clusters: Cluster[] = [];

    filteredTowers.forEach((tower) => {
      const latlng = L.latLng(tower.lat, tower.lng);
      const pixelPoint = map.latLngToLayerPoint(latlng);

      // Find nearest cluster within pixel radius
      let nearestCluster: Cluster | null = null;
      let minDistance = clusterPixelRadius;

      for (const cl of clusters) {
        const d = pixelPoint.distanceTo(cl.pixelPoint);
        if (d < minDistance) {
          minDistance = d;
          nearestCluster = cl;
        }
      }

      if (nearestCluster) {
        nearestCluster.towers.push(tower);
        // Recalculate cluster centroid
        const count = nearestCluster.towers.length;
        nearestCluster.centerLat =
          (nearestCluster.centerLat * (count - 1) + tower.lat) / count;
        nearestCluster.centerLng =
          (nearestCluster.centerLng * (count - 1) + tower.lng) / count;
        nearestCluster.pixelPoint = map.latLngToLayerPoint(
          L.latLng(nearestCluster.centerLat, nearestCluster.centerLng)
        );
      } else {
        clusters.push({
          towers: [tower],
          pixelPoint,
          centerLat: tower.lat,
          centerLng: tower.lng,
        });
      }
    });

    // Render clusters and lone markers
    clusters.forEach((cluster) => {
      if (cluster.towers.length === 1) {
        const tower = cluster.towers[0];
        const isSelected = selectedTowerId === tower.id;
        const icon = createTowerDivIcon(tower, isSelected);
        const marker = L.marker([tower.lat, tower.lng], { icon });

        marker.bindPopup(createTowerPopupHtml(tower), {
          maxWidth: 320,
          className: "custom-tower-popup",
        });

        marker.on("click", () => {
          onTowerSelect?.(tower);
        });

        lg.addLayer(marker);
      } else {
        const dominantRisk = getDominantRisk(cluster.towers);
        const icon = createClusterDivIcon(cluster.towers.length, dominantRisk);
        const clusterMarker = L.marker([cluster.centerLat, cluster.centerLng], { icon });

        // On clicking cluster, zoom into bounds
        clusterMarker.on("click", () => {
          const bounds = L.latLngBounds(cluster.towers.map((t) => [t.lat, t.lng]));
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
        });

        // Hover tooltip on cluster
        clusterMarker.bindTooltip(
          `<div style="font-family:'IBM Plex Sans',sans-serif;font-size:11px;font-weight:600;padding:2px 4px;">
            <b>${cluster.towers.length} Towers</b><br/>
            Highest Flood Risk: <span style="color:${TOWER_RISK_COLORS[dominantRisk]?.hex};font-weight:700;">${dominantRisk}</span><br/>
            <span style="color:#64748B;font-size:10px;">Click to expand</span>
          </div>`,
          { direction: "top", offset: [0, -20] }
        );

        lg.addLayer(clusterMarker);
      }
    });
  }, [map, visible, filteredTowers, selectedTowerId, onTowerSelect]);

  // 4. Update markers on tower data changes and map view moves
  useEffect(() => {
    if (!map) return;

    renderMarkers();

    const handleMapChange = () => {
      renderMarkers();
    };

    map.on("zoomend", handleMapChange);
    map.on("moveend", handleMapChange);

    return () => {
      map.off("zoomend", handleMapChange);
      map.off("moveend", handleMapChange);
    };
  }, [map, renderMarkers]);

  // Clean up layer group on unmount
  useEffect(() => {
    return () => {
      if (layerGroupRef.current && map) {
        map.removeLayer(layerGroupRef.current);
        layerGroupRef.current = null;
      }
    };
  }, [map]);

  // Fetch OpenStreetMap Telecom Towers via Overpass API
  const handleFetchOsmTowers = async () => {
    setIsFetchingOsm(true);
    try {
      let params: { minLat?: number; minLon?: number; maxLat?: number; maxLon?: number; lat?: number; lng?: number; radius_km?: number } = {};
      if (map) {
        const bounds = map.getBounds();
        params = {
          minLat: bounds.getSouth(),
          minLon: bounds.getWest(),
          maxLat: bounds.getNorth(),
          maxLon: bounds.getEast(),
        };
      }
      const res = await fetchOsmTowers(params);
      toast.success(
        res.status === "fallback"
          ? `Overpass API: loaded ${res.count} cached mobile towers`
          : `Fetched and synced ${res.count} mobile towers from OpenStreetMap (Overpass API)`
      );
      loadData();
    } catch (err: any) {
      console.error("OSM tower fetch error:", err);
      toast.error(err.message || "Failed to fetch mobile towers from OpenStreetMap.");
    } finally {
      setIsFetchingOsm(false);
    }
  };

  // Handle GeoJSON File Upload
  const handleGeoJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const geojson = JSON.parse(text);
      const res = await importGeoJsonTowers(geojson);
      toast.success(
        `Imported ${res.imported} new towers (${res.updated} updated, ${res.skipped} skipped)`
      );
      loadData();
    } catch (err: any) {
      console.error("GeoJSON import error:", err);
      toast.error(err.message || "Failed to parse and import GeoJSON file.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!visible || !showFilterControls) return null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json"
        className="hidden"
        onChange={handleGeoJsonFileChange}
      />

      {/* Floating 2D Map Tower Controls HUD */}
      <div className="absolute bottom-6 left-3 z-[1000] flex flex-col gap-2 max-w-xs sm:max-w-sm pointer-events-auto">
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-3 text-white">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Radio className="size-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Mobile Towers</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-950 text-emerald-300 rounded font-mono border border-emerald-800">
                    {filteredTowers.length} active
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleFetchOsmTowers}
                disabled={isLoading || isFetchingOsm}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                title="Fetch Real Mobile Towers from OpenStreetMap (Overpass API)"
              >
                <Globe className={`size-3.5 ${isFetchingOsm ? "animate-spin text-emerald-400" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Import GeoJSON Towers"
              >
                <Upload className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={loadData}
                disabled={isLoading}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Refresh Towers Data"
              >
                <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => setHudOpen((p) => !p)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={hudOpen ? "Collapse Filter HUD" : "Expand Filter HUD"}
              >
                {hudOpen ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              </button>
            </div>
          </div>

          {hudOpen && (
            <div className="space-y-2.5 text-xs animate-in fade-in duration-150">
              {/* Operator Filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Operator Filter
                </label>
                <div className="flex flex-wrap gap-1">
                  {(["All", "Jio", "Airtel", "Vi", "BSNL", "Unknown"] as const).map((op) => {
                    const isActive = operatorFilter === op;
                    return (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setOperatorFilter(op)}
                        className={`text-[10px] font-bold px-2 py-0.8 rounded-md transition-all cursor-pointer ${
                          isActive
                            ? "bg-emerald-600 text-white shadow-xs"
                            : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60"
                        }`}
                      >
                        {op}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Flood Risk Filter */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Flood Risk Level
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {(["All", "Low", "Moderate", "High", "Critical"] as const).map((risk) => {
                    const isActive = riskFilter === risk;
                    const color =
                      risk === "Low"
                        ? "#10B981"
                        : risk === "Moderate"
                        ? "#FACC15"
                        : risk === "High"
                        ? "#F97316"
                        : risk === "Critical"
                        ? "#EF4444"
                        : "#94A3B8";

                    return (
                      <button
                        key={risk}
                        type="button"
                        onClick={() => setRiskFilter(risk)}
                        className={`text-[9px] font-bold px-1.5 py-1 rounded transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                          isActive
                            ? "bg-slate-800 text-white ring-1.5 shadow-xs"
                            : "bg-slate-950/60 hover:bg-slate-800 text-slate-400 border border-slate-800"
                        }`}
                        style={isActive ? { borderColor: color, boxShadow: `0 0 8px ${color}40` } : {}}
                      >
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: color }}
                        />
                        <span>{risk}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Risk Breakdown Bar */}
              {stats && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Risk distribution:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-emerald-400 font-bold" title="Low Risk Towers">
                      ● {stats.by_risk?.Low || 0}
                    </span>
                    <span className="text-yellow-400 font-bold" title="Moderate Risk Towers">
                      ● {stats.by_risk?.Moderate || 0}
                    </span>
                    <span className="text-orange-400 font-bold" title="High Risk Towers">
                      ● {stats.by_risk?.High || 0}
                    </span>
                    <span className="text-red-400 font-bold" title="Critical Risk Towers">
                      ● {stats.by_risk?.Critical || 0}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

