/**
 * Mobile Network Tower Service: Client API communication for shared tower visualization,
 * spatial querying, GeoJSON import, and flood-risk integration.
 */
import { apiGet, apiPost } from "@/lib/api";
import type { MobileTower, TowerStats } from "@/lib/types";

export interface TowerQueryParams {
  minLat?: number;
  maxLat?: number;
  minLon?: number;
  maxLon?: number;
  lat?: number;
  lng?: number;
  radius_km?: number;
  operator?: string;
  flood_risk?: string;
  source?: string;
  limit?: number;
}

export async function fetchTowers(params?: TowerQueryParams): Promise<MobileTower[]> {
  const query = new URLSearchParams();
  if (params) {
    if (params.minLat !== undefined) query.set("minLat", params.minLat.toString());
    if (params.maxLat !== undefined) query.set("maxLat", params.maxLat.toString());
    if (params.minLon !== undefined) query.set("minLon", params.minLon.toString());
    if (params.maxLon !== undefined) query.set("maxLon", params.maxLon.toString());
    if (params.lat !== undefined) query.set("lat", params.lat.toString());
    if (params.lng !== undefined) query.set("lng", params.lng.toString());
    if (params.radius_km !== undefined) query.set("radius_km", params.radius_km.toString());
    if (params.operator && params.operator !== "All") query.set("operator", params.operator);
    if (params.flood_risk && params.flood_risk !== "All") query.set("flood_risk", params.flood_risk);
    if (params.source) query.set("source", params.source);
    if (params.limit !== undefined) query.set("limit", params.limit.toString());
  }

  const qs = query.toString();
  const path = qs ? `/towers?${qs}` : "/towers";
  return apiGet<MobileTower[]>(path);
}

export async function fetchTowerStats(): Promise<TowerStats> {
  return apiGet<TowerStats>("/towers/stats");
}

export async function fetchTowerById(id: string): Promise<MobileTower> {
  return apiGet<MobileTower>(`/towers/${encodeURIComponent(id)}`);
}

export async function importGeoJsonTowers(geojson: any): Promise<{
  status: string;
  imported: number;
  updated: number;
  skipped: number;
  total_processed: number;
}> {
  return apiPost<any>("/towers/import-geojson", geojson);
}

export async function recalculateTowerRisk(waterLevelM?: number): Promise<{
  status: string;
  total_towers: number;
  updated_count: number;
}> {
  return apiPost<any>("/towers/recalculate-risk", { water_level_m: waterLevelM });
}

// ── Color and Badge Constants ───────────────────────────────────────────
export const TOWER_RISK_COLORS: Record<string, { bg: string; text: string; hex: string; border: string }> = {
  Low: { bg: "bg-emerald-100", text: "text-emerald-800", hex: "#10B981", border: "border-emerald-500" },
  Moderate: { bg: "bg-yellow-100", text: "text-yellow-800", hex: "#FACC15", border: "border-yellow-500" },
  High: { bg: "bg-orange-100", text: "text-orange-800", hex: "#F97316", border: "border-orange-500" },
  Critical: { bg: "bg-red-100", text: "text-red-800", hex: "#EF4444", border: "border-red-500" },
};

export const OPERATOR_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Jio: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-400" },
  Airtel: { bg: "bg-red-100", text: "text-red-700", border: "border-red-400" },
  Vi: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-400" },
  BSNL: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-400" },
  Unknown: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-300" },
};

