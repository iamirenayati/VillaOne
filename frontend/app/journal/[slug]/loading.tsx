import { InnerHeader } from "../../components/InnerHeader";
import { PublicFooter } from "../../components/PublicFooter";

export default function Loading() {
  return <main dir="rtl" className="inner-page article-page"><InnerHeader /><article className="article-loading"><div className="journal-skeleton journal-skeleton-label" /><div className="journal-skeleton journal-skeleton-title" /><div className="journal-skeleton journal-skeleton-cover" /><div className="journal-skeleton journal-skeleton-body" /></article><PublicFooter /></main>;
}
