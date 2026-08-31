import type { ReactNode } from "react";
import type { BusinessSettings } from "../lib/api";
import { PublicFooter } from "./PublicFooter";
import { PublicHeader } from "./PublicHeader";

export function PublicShell({ children, business, headerVariant = "surface", footer = true }: { children: ReactNode; business?: BusinessSettings | null; headerVariant?: "surface" | "overlay"; footer?: boolean }) {
  return <><PublicHeader variant={headerVariant} />{children}{footer && <PublicFooter business={business} />}</>;
}
