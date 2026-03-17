import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/* Redirect root to default locale and negotiate Accept-Language. */
export default createMiddleware(routing);

export const config = {
  matcher: ["/", "/(en|es)/:path*"],
};
