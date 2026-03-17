import { defineRouting } from "next-intl/routing";

/* Central locale routing config — single source of truth. */
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
});
