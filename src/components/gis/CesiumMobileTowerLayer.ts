/**
 * CesiumMobileTowerLayer
 *
 * Dedicated 3D Digital Twin visualization layer for Mobile Network Communication Towers.
 * Features:
 * - Real 3D communication mast models (lattice mast cylinder + antenna tip)
 * - Ground-clamped base anchor with vertical mast elevation up to accurate tower height (30m-60m)
 * - Recognizable 3D billboard with mobile mast icon, radio waves, and operator badge
 * - Strict flood-risk coloring: Green (Low), Yellow (Moderate), Orange (High), Red (Critical)
 * - Native Cesium Entity Clustering for 60fps performance on large tower datasets
 * - Custom entity properties (_towerData) for instant click detection & HUD card display
 * - Camera fly-to helper for smooth 3D inspection
 */

import type { MobileTower, TowerOperator, TowerFloodRisk } from "@/lib/types";
import { TOWER_RISK_COLORS, OPERATOR_COLORS } from "@/services/towerService";

declare const Cesium: any;

const RISK_LEVEL_ORDER: Record<string, number> = {
  Critical: 4,
  High: 3,
  Moderate: 2,
  Low: 1,
};

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

// Generate SVG data-URL for recognizable tower billboard
export function getTowerBillboardUri(riskHex: string, operator: string): string {
  const op = operator || "Unknown";
  const opLetter =
    op === "Jio" ? "J" : op === "Airtel" ? "A" : op === "Vi" ? "V" : op === "BSNL" ? "B" : "?";
  const opColor =
    op === "Jio"
      ? "#2563EB"
      : op === "Airtel"
      ? "#DC2626"
      : op === "Vi"
      ? "#7C3AED"
      : op === "BSNL"
      ? "#D97706"
      : "#64748B";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <!-- Outer Glow Circle -->
    <circle cx="40" cy="40" r="34" fill="#090D16" stroke="${riskHex}" stroke-width="4.5"/>
    <circle cx="40" cy="40" r="38" fill="none" stroke="${riskHex}" stroke-width="1.5" opacity="0.4"/>
    
    <!-- Radio Transmission Waves -->
    <path d="M22 22 A 25 25 0 0 1 58 22" fill="none" stroke="${riskHex}" stroke-width="3" stroke-linecap="round" stroke-dasharray="3 3"/>
    <path d="M28 28 A 16 16 0 0 1 52 28" fill="none" stroke="${riskHex}" stroke-width="3" stroke-linecap="round"/>
    
    <!-- Lattice Communication Mast Geometry -->
    <line x1="40" y1="18" x2="40" y2="62" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>
    <line x1="28" y1="62" x2="40" y2="24" stroke="#FFFFFF" stroke-width="2.5"/>
    <line x1="52" y1="62" x2="40" y2="24" stroke="#FFFFFF" stroke-width="2.5"/>
    <line x1="31" y1="52" x2="49" y2="52" stroke="#FFFFFF" stroke-width="2.5"/>
    <line x1="34" y1="40" x2="46" y2="40" stroke="#FFFFFF" stroke-width="2.5"/>
    <line x1="36" y1="30" x2="44" y2="30" stroke="#FFFFFF" stroke-width="2"/>
    <circle cx="40" cy="20" r="4" fill="${riskHex}" stroke="#FFFFFF" stroke-width="1.5"/>

    <!-- Network Operator Badge Pill -->
    <circle cx="60" cy="60" r="14" fill="${opColor}" stroke="#090D16" stroke-width="3"/>
    <text x="60" y="65" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" fill="#FFFFFF" text-anchor="middle">${opLetter}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Generate SVG data-URL for cluster billboard
export function getClusterBillboardUri(count: number, riskHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
    <circle cx="44" cy="44" r="38" fill="#090D16" stroke="${riskHex}" stroke-width="5"/>
    <circle cx="44" cy="44" r="42" fill="none" stroke="${riskHex}" stroke-width="2" opacity="0.35"/>
    <!-- Small Tower Icon at top -->
    <path d="M36 24 L44 14 L52 24 M38 24 L50 24 M44 14 L44 32" stroke="${riskHex}" stroke-width="2" stroke-linecap="round"/>
    <!-- Cluster count text -->
    <text x="44" y="56" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="900" fill="#FFFFFF" text-anchor="middle">${count}</text>
    <text x="44" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="700" fill="#94A3B8" text-anchor="middle" letter-spacing="1">TOWERS</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export class CesiumMobileTowerLayer {
  private viewer: any;
  private dataSource: any = null;
  private towers: MobileTower[] = [];
  private visible: boolean = true;
  private operatorFilter: TowerOperator | "All" = "All";
  private riskFilter: TowerFloodRisk | "All" = "All";
  private onTowerClickCallback?: (tower: MobileTower | null) => void;

  constructor(viewer: any, onTowerClick?: (tower: MobileTower | null) => void) {
    this.viewer = viewer;
    this.onTowerClickCallback = onTowerClick;
    this.initDataSource();
  }

  private initDataSource() {
    if (!this.viewer || this.viewer.isDestroyed()) return;

    // Create a CustomDataSource dedicated to mobile network towers
    this.dataSource = new Cesium.CustomDataSource("mobile-network-towers");

    // Enable native clustering for large tower datasets
    this.dataSource.clustering.enabled = true;
    this.dataSource.clustering.pixelRange = 40;
    this.dataSource.clustering.minimumClusterSize = 3;

    this.dataSource.clustering.clusterEvent.addEventListener(
      (clusteredEntities: any[], cluster: any) => {
        cluster.label.show = false;
        cluster.billboard.show = true;

        // Extract towers in cluster to compute dominant flood risk
        const clusterTowers: MobileTower[] = clusteredEntities
          .map((e) => e._towerData)
          .filter(Boolean);

        const dominantRisk = getDominantRisk(clusterTowers);
        const riskHex = TOWER_RISK_COLORS[dominantRisk]?.hex || "#10B981";

        cluster.billboard.image = getClusterBillboardUri(clusteredEntities.length, riskHex);
        cluster.billboard.scale = 0.65;
        cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
      }
    );

    this.viewer.dataSources.add(this.dataSource);
  }

  public setTowers(towers: MobileTower[]) {
    this.towers = towers;
    this.rebuildEntities();
  }

  public setVisible(visible: boolean) {
    this.visible = visible;
    if (this.dataSource) {
      this.dataSource.show = visible;
    }
  }

  public setFilters(operator: TowerOperator | "All", risk: TowerFloodRisk | "All") {
    this.operatorFilter = operator;
    this.riskFilter = risk;
    this.rebuildEntities();
  }

  private rebuildEntities() {
    if (!this.dataSource) return;
    this.dataSource.entities.removeAll();

    if (!this.visible) return;

    const filtered = this.towers.filter((t) => {
      if (this.operatorFilter !== "All" && t.operator !== this.operatorFilter) return false;
      if (this.riskFilter !== "All" && t.flood_risk_level !== this.riskFilter) return false;
      return true;
    });

    filtered.forEach((tower) => {
      const risk = (tower.flood_risk_level || "Low") as TowerFloodRisk;
      const riskColorData = TOWER_RISK_COLORS[risk] || TOWER_RISK_COLORS.Low;
      const riskHex = riskColorData.hex;
      const cesiumColor = Cesium.Color.fromCssColorString(riskHex);
      const height = tower.height && tower.height > 10 ? tower.height : 42.0;

      const basePosition = Cesium.Cartesian3.fromDegrees(tower.lng, tower.lat, 0);
      const topPosition = Cesium.Cartesian3.fromDegrees(tower.lng, tower.lat, height);
      const billboardPosition = Cesium.Cartesian3.fromDegrees(tower.lng, tower.lat, height + 8.0);

      // 1. 3D Lattice Mast (Ground-clamped 3D Cylinder)
      const mastEntity = this.dataSource.entities.add({
        id: `tower-${tower.id}`,
        name: `🗼 ${tower.name || "Mobile Communication Tower"}`,
        position: Cesium.Cartesian3.fromDegrees(tower.lng, tower.lat, height / 2),
        cylinder: {
          length: height,
          topRadius: 1.1,
          bottomRadius: 3.2,
          material: cesiumColor.withAlpha(0.85),
          outline: true,
          outlineColor: Cesium.Color.WHITE.withAlpha(0.7),
          heightReference: Cesium.HeightReference.NONE,
        },
        // Ground anchor pad
        point: {
          pixelSize: 12,
          color: cesiumColor,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        // 3D Billboard Icon at top of mast with antenna & operator badge
        billboard: {
          image: getTowerBillboardUri(riskHex, tower.operator),
          scale: 0.55,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.NONE,
        },
        // Label with Tower Name & Risk
        label: {
          text: `${tower.operator} • ${tower.flood_risk_level} Risk`,
          font: "bold 22px system-ui, -apple-system, sans-serif",
          scale: 0.45,
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#090D16").withAlpha(0.9),
          backgroundPadding: new Cesium.Cartesian2(6, 4),
          pixelOffset: new Cesium.Cartesian2(0, -32),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 8000.0),
        },
      });

      // Attach tower data for quick inspection picking
      (mastEntity as any)._towerData = tower;
    });
  }

  // Fly camera to a specific tower
  public flyToTower(tower: MobileTower) {
    if (!this.viewer || this.viewer.isDestroyed()) return;

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        tower.lng,
        tower.lat - 0.0035, // slight south offset for 3D perspective
        180.0
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-25),
        roll: 0.0,
      },
      duration: 1.5,
    });
  }

  public destroy() {
    if (this.dataSource && this.viewer && !this.viewer.isDestroyed()) {
      this.viewer.dataSources.remove(this.dataSource, true);
      this.dataSource = null;
    }
  }
}

