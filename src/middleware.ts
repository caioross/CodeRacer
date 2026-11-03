// `?lang=xx` → cookie de preferência + cabeçalho interno para o layout renderizar já no
// idioma pedido (links com idioma e hreflang funcionam no PRIMEIRO pedido, sem piscar).
// Sem `?lang`, não faz nada. Não toca em /api, nos estáticos nem nas salas em si.
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, LOCALE_HEADER, matchLocale } from "./i18n/config";

export function middleware(req: NextRequest) {
  const asked = req.nextUrl.searchParams.get("lang");
  if (!asked) return NextResponse.next();
  const locale = matchLocale(asked);
  if (!locale) return NextResponse.next();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return res;
}

export const config = {
  matcher: ["/((?!api/|_next/|icons/|banners/|favicon|icon\\.svg|apple-icon|opengraph-image|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest).*)"]
};
