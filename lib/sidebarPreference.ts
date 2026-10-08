// Preferência "sidebar recolhida" do desktop, salva no navegador.
// O armazenamento pode não existir (servidor) ou estar bloqueado (modo privado restrito).

export const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readSidebarCollapsed(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean, storage: StorageLike | null) {
  try {
    storage?.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {}
}
