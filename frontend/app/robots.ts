import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_VILLAONE_SITE_URL || "http://localhost:3001";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/checkout", "/payment"] }], sitemap: `${siteUrl}/sitemap.xml` };
}
