import { apiDelete } from "@/lib/api";

export async function deleteArea(id: string, name: string) {
  await apiDelete(`/areas/${id}`);
  // A deleted area must not be resurrected by the saved-area picker on remount.
  try {
    const areas = JSON.parse(localStorage.getItem("cached_custom_areas") || "[]");
    localStorage.setItem("cached_custom_areas", JSON.stringify(areas.filter((area: { id: string }) => area.id !== id)));
  } catch { localStorage.removeItem("cached_custom_areas"); }
  const safeName = name.replace(/\s+/g, "_");
  for (const key of Object.keys(localStorage)) {
    if (key === `dt_mesh_nodes_${safeName}` || key === `dt_user_activity_${safeName}` ||
        key === `dt_networks_${safeName}` || (key.startsWith("dt_networks_v") && key.includes(`_${safeName}_`))) {
      localStorage.removeItem(key);
    }
  }
  window.dispatchEvent(new CustomEvent("area-deleted", { detail: id }));
}
