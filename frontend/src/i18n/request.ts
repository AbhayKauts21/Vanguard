import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/* Loads the correct message bundle per locale for server components. */
export default getRequestConfig(async ({ locale, requestLocale }) => {
  let resolvedLocale = locale ?? await requestLocale;

  if (
    !resolvedLocale ||
    !routing.locales.includes(resolvedLocale as typeof routing.locales[number])
  ) {
    resolvedLocale = routing.defaultLocale;
  }

  return {
    locale: resolvedLocale,
    messages: (await import(`@/messages/${resolvedLocale}.json`)).default,
  };
});
