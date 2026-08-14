import type { MetadataRoute } from "next";
import { fetchArticles } from "./lib/api";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_VILLAONE_SITE_URL || "http://localhost:3001";
  let articles = [];
  try {
    articles = (await fetchArticles()) || [];
  } catch {
    articles = [];
  }
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/journal`, changeFrequency: "monthly", priority: 0.7 },
    ...articles.map((article) => ({
      url: `${siteUrl}/journal/${article.slug}`,
      lastModified: article.updated_at || article.published_at || undefined,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...(article.cover_image ? { images: [article.cover_image] } : {}),
    })),
  ];
}
