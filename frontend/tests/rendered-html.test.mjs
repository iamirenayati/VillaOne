import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the VillaOne customer homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /VILLAONE/i);
  assert.match(html, /جست‌وجو|جست/);
  assert.match(html, /تاریخ ورود/);
  assert.match(html, /مشاهده ویلاها/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|Building your site/);
});

test("customer shell keeps the critical booking surfaces wired", async () => {
  const [page, hero, layout, api] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home/HomeHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8"),
  ]);
  assert.match(hero, /ShamsiDateField/);
  assert.match(page, /handleSearch/);
  assert.match(hero, /className="home-date-field"/);
  assert.match(layout, /generateMetadata/);
  assert.match(api, /NEXT_PUBLIC_VILLAONE_API_URL/);
  assert.match(api, /villaone-session-expired/);
});

test("homepage calendar is deliberately positioned above its search controls", async () => {
  const styles = await readFile(new URL("../app/HomePage.module.css", import.meta.url), "utf8");
  assert.match(styles, /:global\(\.shamsi-popover\)/);
  assert.match(styles, /bottom: calc\(100% \+ 1\.8rem\)/);
});

test("homepage cinematic media stays poster-first and accessible", async () => {
  const [home, hero, editorial, media] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home/HomeHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home/HomeEditorial.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CinematicVideo.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(home, /HomeHero/);
  assert.match(hero, /CinematicVideo/);
  assert.match(hero, /hero-forest/);
  assert.match(editorial, /concierge-breakfast/);
  assert.match(media, /preload="none"/);
  assert.match(media, /prefers-reduced-motion/);
  assert.match(media, /saveData/);
  assert.match(media, /requestIdleCallback/);
  assert.match(media, /aria-pressed/);
  assert.match(media, /poster=/);
  assert.match(media, /fetchPriority=\{eager/);
});

test("homepage presents real villas in a balanced two-column grid", async () => {
  const [showcase, styles] = await Promise.all([
    readFile(new URL("../app/components/home/HomeVillaShowcase.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HomePage.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(showcase, /villaCinematicList/);
  assert.match(showcase, /villaCinematicCard/);
  assert.match(showcase, /villaDisplayTitle/);
  assert.match(showcase, /villa\.image/);
  assert.match(styles, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /min-height:\s*clamp\(28rem,\s*38vw,\s*36rem\)/);
  assert.match(styles, /font-size:\s*clamp\(2rem,\s*3\.6vw,\s*4rem\)/);
});

test("public navigation has one accessible shared implementation", async () => {
  const [header, home, hero] = await Promise.all([
    readFile(new URL("../app/components/PublicHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home/HomeHero.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(header, /export function PublicHeader/);
  assert.match(header, /variant\?: "surface" \| "overlay"/);
  assert.match(header, /villaone-session-expired/);
  assert.match(header, /aria-expanded/);
  assert.match(header, /document\.body\.style\.overflow/);
  assert.match(hero, /PublicHeader variant="overlay"/);
  assert.doesNotMatch(home, /className="site-header"/);
});

test("contractor marketplace keeps the concierge lead flow wired", async () => {
  const [list, detail, inquiry, admin, api] = await Promise.all([
    readFile(new URL("../app/contractors/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/contractors/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/InquiryForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8"),
  ]);
  assert.match(list, /تلاش دوباره/);
  assert.match(list, /featured/);
  assert.match(detail, /درخواست برآورد پروژه|InquiryForm/);
  assert.match(inquiry, /createMarketplaceInquiry/);
  assert.match(inquiry, /هماهنگی با کانسیرج/);
  assert.match(detail, /contractor-catalog/);
  assert.match(detail, /catalog-card-image/);
  assert.match(detail, /catalog-report/);
  assert.match(detail, /formatBudget/);
  assert.match(list, /contractor-showcase/);
  assert.match(list, /contractor-directory-meta/);
  assert.match(detail, /contractor-profile-hero/);
  assert.match(detail, /contractor-catalog-nav/);
  assert.match(detail, /contractor-project-showcase/);
  assert.match(inquiry, /<form/);
  assert.match(inquiry, /onSubmit/);
  assert.match(inquiry, /aria-live/);
  assert.match(admin, /ContractorOperations/);
  assert.match(admin, /assigned_contractor_slug/);
  assert.match(admin, /SupportOperations/);
  assert.match(admin, /CancellationOperations/);
  assert.match(admin, /AuditOperations/);
  assert.doesNotMatch(admin, /V1-1405|villaListings|زرین‌پال|زیبال/);
  assert.doesNotMatch(api, /local_mock|completeLocalPayment|initiateBookingPayment/);
});

test("journal keeps a readable structured reader experience", async () => {
  const [article, reader, styles] = await Promise.all([
    readFile(new URL("../app/journal/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/journal/[slug]/ArticleReader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(article, /article-reading-layout/);
  assert.match(article, /article-toc/);
  assert.match(reader, /navigator\.clipboard/);
  assert.match(reader, /AbortError/);
  assert.match(styles, /\.article-reading-layout\.has-toc/);
  assert.match(styles, /font-size:16px/);
});

test("service marketplace is backend-driven and supports bookable service details", async () => {
  const [list, detail, checkout, villas, villaDetail, api] = await Promise.all([
    readFile(new URL("../app/services/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/services/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/checkout/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/villas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/villas/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8"),
  ]);
  assert.match(list, /fetchServices/);
  assert.match(list, /service-editorial/);
  assert.match(list, /تلاش دوباره/);
  assert.match(detail, /fetchService/);
  assert.match(detail, /service-detail-hero/);
  assert.match(detail, /InquiryForm/);
  assert.match(checkout, /fetchEligibleServices/);
  assert.match(checkout, /serviceItems/);
  assert.match(villas, /requestedService/);
  assert.match(villaDetail, /requestedServices/);
  assert.match(api, /\/marketplace\/services\/eligible\//);
  assert.match(api, /service_items/);
});

test("villa list defaults include the full published price range", async () => {
  const villas = await readFile(new URL("../app/villas/page.tsx", import.meta.url), "utf8");

  assert.match(villas, /const \[minPrice, setMinPrice\] = useState\(0\);/);
  assert.match(villas, /minPrice !== 0/);
});

test("villa catalogue uses truthful luxury discovery states", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("../app/villas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /villas-luxury-page/);
  assert.match(page, /villa-catalog-skeleton/);
  assert.match(page, /catalog-error-state/);
  assert.match(page, /villa\.gallery\.length/);
  assert.match(page, /href="\/map"/);
  assert.doesNotMatch(page, /className="results-map"/);
  assert.doesNotMatch(page, />۱ \/ ۵</);
  assert.match(styles, /\.luxury-villa-card/);
  assert.match(styles, /@media \(max-width:\s*720px\)/);
});

test("villa detail is driven by real villa content and production booking states", async () => {
  const [page, types, api, styles] = await Promise.all([
    readFile(new URL("../app/villas/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/types/villa.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(page, /villa-luxury-detail/);
  assert.match(page, /detail-page-skeleton/);
  assert.match(page, /villa\.description/);
  assert.match(page, /villa\.tags\.map/);
  assert.match(page, /depositPercentage/);
  assert.doesNotMatch(page, /۲۸۰/);
  assert.match(types, /description: string/);
  assert.match(api, /description: item\.description/);
  assert.match(styles, /\.luxury-booking-card/);
});

test("singular villa URLs redirect to the canonical catalogue", async () => {
  const [catalogAlias, detailAlias] = await Promise.all([
    readFile(new URL("../app/villa/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/villa/[slug]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(catalogAlias, /redirect\("\/villas"\)/);
  assert.match(detailAlias, /redirect\(`\/villas\/\$\{encodeURIComponent\(slug\)\}`\)/);
});

test("practical map remains API-driven, synchronized and keyless", async () => {
  const [mapPage, practicalMap, api, header, homeHero, homeFooter, logo, layout, styles] = await Promise.all([
    readFile(new URL("../app/map/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/map/PracticalMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home/HomeHero.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/home/HomeFooter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrandLogo.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(mapPage, /fetchMapVillas/);
  assert.match(mapPage, /PracticalMap/);
  assert.match(mapPage, /filteredVillas/);
  assert.match(mapPage, /map-villa-list/);
  assert.match(mapPage, /موقعیت تقریبی/);
  assert.match(mapPage, /aria-live="polite"/);
  assert.match(practicalMap, /maplibre-gl/);
  assert.match(practicalMap, /NEXT_PUBLIC_VILLAONE_MAP_STYLE_URL/);
  assert.match(practicalMap, /tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(practicalMap, /new maplibregl\.Marker/);
  assert.match(practicalMap, /fitBounds/);
  assert.match(practicalMap, /flyTo/);
  assert.match(practicalMap, /cooperativeGestures/);
  assert.match(practicalMap, /maplibregl\.NavigationControl/);
  assert.match(practicalMap, /getRTLTextPluginStatus/);
  assert.match(practicalMap, /setRTLTextPlugin\(RTL_PLUGIN_URL, false\)/);
  assert.match(practicalMap, /\/vendor\/mapbox-gl-rtl-text-0\.3\.0\.js/);
  assert.match(practicalMap, /removeNativeScriptLabels/);
  assert.match(practicalMap, /setLayoutProperty\(layer\.id, "text-field", LATIN_LABEL_FIELD\)/);
  assert.match(practicalMap, /"name:latin"/);
  assert.match(practicalMap, /"name_en"/);
  assert.match(practicalMap, /setAttribute\("dir", "rtl"\)/);
  assert.match(practicalMap, /setAttribute\("lang", "fa"\)/);
  assert.match(styles, /\.map-price-pin-label[^\n]*unicode-bidi:plaintext/);
  assert.doesNotMatch(`${mapPage}\n${practicalMap}`, /mazandaran-terrain|onPointerMove|originX|layoutVillaPins/);
  assert.match(api, /\/villas\/map\//);
  assert.match(header, /\["\/map", "نقشه"\]/);
  assert.match(homeHero, /PublicHeader variant="overlay"/);
  assert.match(header, /BrandLogo/);
  assert.match(homeFooter, /BrandLogo/);
  assert.match(logo, /villaone-logo-mark/);
  assert.match(logo, /viewBox="0 0 48 48"/);
  assert.match(layout, /\/brand\/villaone-mark\.svg/);
});

test("operations admin uses accessible production interaction primitives", async () => {
  const [admin, styles] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(admin, /window\.(?:alert|confirm|prompt)\s*\(/);
  assert.match(admin, /AdminConfirmationProvider/);
  assert.match(admin, /admin-sidebar-scrim/);
  assert.match(admin, /aria-current/);
  assert.match(admin, /aria-expanded/);
  assert.match(admin, /villaone-session-expired/);
  assert.match(admin, /history\.replaceState/);
  assert.match(admin, /admin-modal-title/);
  assert.match(admin, /trapDialogFocus/);
  assert.match(styles, /ADMIN OPERATIONS UI V2/);
  assert.match(styles, /\.admin-sidebar-scrim/);
  assert.match(styles, /@media \(max-width: 780px\)/);
});
