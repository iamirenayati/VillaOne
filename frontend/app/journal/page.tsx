/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { InnerHeader } from "../components/InnerHeader";
import { PublicFooter } from "../components/PublicFooter";
import { EmptyState, ErrorState } from "../components/ui/Feedback";
import { type JournalArticle, fetchArticles, formatPersianDate } from "../lib/api";
import styles from "./Journal.module.css";

const categories = [
  { code: "all", label: "همه مقاله‌ها" },
  { code: "guide", label: "راهنمای سفر" },
  { code: "stay", label: "اقامت و ویلا" },
  { code: "design", label: "معماری و بازسازی" },
  { code: "property", label: "ملک و سرمایه‌گذاری" },
  { code: "local", label: "تجربه و خدمات محلی" },
] as const;

type JournalPageProps = { searchParams?: Promise<{ category?: string | string[] | undefined }> };

function ArticleImage({ article, className = "" }: { article: JournalArticle; className?: string }) {
  return article.cover_image ? <img className={className} src={article.cover_image} alt={article.cover_alt || article.title} loading="lazy" /> : <div className={`${className} ${styles.imageFallback}`} aria-label="تصویر جلد در دسترس نیست"><span>ویلاوان</span></div>;
}

function ArticleMeta({ article, light = false }: { article: JournalArticle; light?: boolean }) {
  return <div className={`${styles.articleMeta} ${light ? styles.articleMetaLight : ""}`}><span>{article.author_name}</span>{article.published_at && <time dateTime={article.published_at}>{formatPersianDate(article.published_at)}</time>}{article.reading_time_minutes && <span>{article.reading_time_minutes.toLocaleString("fa-IR")} دقیقه مطالعه</span>}</div>;
}

function ArticleCard({ article, index }: { article: JournalArticle; index: number }) {
  return (
    <article className={styles.articleCard}>
      <Link className={styles.cardImage} href={`/journal/${article.slug}`} aria-label={`مطالعه ${article.title}`}><ArticleImage article={article} /><span>{(index + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 })}</span></Link>
      <div className={styles.cardCopy}>
        <span className={styles.category}>{article.category}</span>
        <h2><Link href={`/journal/${article.slug}`}>{article.title}</Link></h2>
        <p>{article.excerpt}</p>
        <ArticleMeta article={article} />
        <Link className={styles.cardLink} href={`/journal/${article.slug}`}>ادامه روایت <span aria-hidden="true">←</span></Link>
      </div>
    </article>
  );
}

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const params = await searchParams;
  const requestedCategory = Array.isArray(params?.category) ? params.category[0] : params?.category;
  const activeCategory = categories.some((item) => item.code === requestedCategory) ? requestedCategory : "all";
  const queryCategory = activeCategory === "all" ? undefined : activeCategory;
  let items: JournalArticle[] | null = null;
  let failed = false;

  try { items = await fetchArticles(queryCategory); } catch { failed = true; }

  const latest = items?.[0];
  const remaining = items?.slice(1) ?? [];

  return (
    <main dir="rtl" className={`${styles.page} inner-page`}>
      <InnerHeader />
      <section className={`${styles.masthead} section-shell`}>
        <div className={styles.mastheadCopy}>
          <p className="eyebrow dark"><span /> مجله ویلاوان</p>
          <h1>روایت‌هایی برای<br /><em>آرام‌تر دیدن.</em></h1>
          <p>راهنماهای کاربردی و روایت‌های دقیق درباره اقامت، معماری، سرمایه‌گذاری و زندگی در مازندران.</p>
          <div className={styles.issueNote}><span>انتشار ماهانه</span><strong>کم‌تعداد، اما ماندگار</strong></div>
        </div>
        <figure className={styles.mastheadArt}><img src="/images/editorial/forest-journey.webp" alt="جاده‌ای آرام میان جنگل سرسبز" width="1440" height="960" fetchPriority="high" /><figcaption><span>مازندران</span><p>سفر، خانه و زندگی محلی<br />از نگاه تحریریه ویلاوان</p></figcaption></figure>
      </section>

      <nav className={`${styles.categories} section-shell`} aria-label="دسته‌بندی مقاله‌ها">
        <span>موضوع‌ها</span>
        <div>{categories.map((category) => <Link key={category.code} className={activeCategory === category.code ? styles.activeCategory : ""} href={category.code === "all" ? "/journal" : `/journal?category=${category.code}`} aria-current={activeCategory === category.code ? "page" : undefined}>{category.label}</Link>)}</div>
      </nav>

      <div className={styles.stories}>
        {failed ? (
          <ErrorState className={`${styles.statePanel} section-shell`} title="دریافت مجله ممکن نیست" message="ارتباط با سرور برقرار نشد. مقاله جایگزین یا ساختگی نمایش داده نمی‌شود." retryLabel="تلاش دوباره" action={<Link href={activeCategory === "all" ? "/journal" : `/journal?category=${activeCategory}`}>تلاش دوباره</Link>} />
        ) : items === null ? (
          <section className={`${styles.statePanel} section-shell`} role="status"><span aria-hidden="true">◇</span><h2>مجله موقتاً در دسترس نیست</h2><p>مقاله‌های منتشرشده پس از اتصال سرویس از همین‌جا در دسترس خواهند بود.</p></section>
        ) : items.length === 0 ? (
          <EmptyState className={`${styles.statePanel} section-shell`} title="هنوز مقاله‌ای در این موضوع نیست" message="موضوع دیگری را ببینید یا برای روایت بعدی ویلاوان همراه ما باشید." action={<Link href="/journal">مشاهده همه مقاله‌ها</Link>} />
        ) : (
          <>
            {latest && <article className={`${styles.latestStory} section-shell`}><Link className={styles.latestImage} href={`/journal/${latest.slug}`}><ArticleImage article={latest} /></Link><div className={styles.latestCopy}><span className={styles.latestLabel}>آخرین روایت · {latest.category}</span><h2><Link href={`/journal/${latest.slug}`}>{latest.title}</Link></h2><p>{latest.excerpt}</p><ArticleMeta article={latest} light /><Link className={styles.latestLink} href={`/journal/${latest.slug}`}>مطالعه مقاله <span aria-hidden="true">←</span></Link></div></article>}
            {remaining.length > 0 && <section className={`${styles.archive} section-shell`} aria-labelledby="journal-archive"><header><div><p className="eyebrow dark"><span /> آرشیو</p><h2 id="journal-archive">روایت‌های دیگر</h2></div><span>{remaining.length.toLocaleString("fa-IR")} مقاله</span></header><div className={styles.articleGrid}>{remaining.map((article, index) => <ArticleCard key={article.slug} article={article} index={index} />)}</div></section>}
          </>
        )}
      </div>
      <PublicFooter />
    </main>
  );
}
