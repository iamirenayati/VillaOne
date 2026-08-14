import { redirect } from "next/navigation";

export default async function VillaDetailAlias({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/villas/${encodeURIComponent(slug)}`);
}
