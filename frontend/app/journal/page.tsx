import { InnerHeader } from "../components/InnerHeader";
import { type JournalArticle, fetchArticles, formatPersianDate } from "../lib/api";

const categories = [
  { code: "all", label: "همه مقاله‌ها" },
  { code: "guide", label: "راهنمای سفر" },
  { code: "stay", label: "اقامت و ویلا" },
  { code: "design", label: "معماری و بازسازی" },
  { code: "property", label: "ملک و سرمایه‌گذاری" },
  { code: "local", label: "تجربه و خدمات محلی" },
] as const;

type JournalPageProps = {
  searchParams?: Promise<{ category?: string | string[] | undefined }>;
};

function ArticleImage({ article, className = "" }: { article: JournalArticle; className?: string }) {
  return article.cover_image ? (
    <img className={className} src={article.cover_image} alt={article.cover_alt || article.title} />
  ) : (
    <div className={`${className} article-image-fallback`} aria-label="تصویر جلد در دسترس نیست"><span>ویلاوان</span></div>
  );
}

function ArticleMeta({ article }: { article: JournalArticle }) {
  return (
    <div className="journal-card-meta">
      <span>{article.author_name}</span>
      {article.published_at && <time dateTime={article.published_at}>{formatPersianDate(article.published_at)}</time>}
      {article.reading_time_minutes && <span>{article.reading_time_minutes} دقیقه مطالعه</span>}
    </div>
  );
}

function ArticleCard({ article }: { article: JournalArticle }) {
  return (
    <article className="journal-card">
      <a className="journal-card-image" href={`/journal/${article.slug}`} aria-label={`مطالعه ${article.title}`}>
        <ArticleImage article={article} />
      </a>
      <div className="journal-card-copy">
        <span className="journal-category">{article.category}</span>
        <h2><a href={`/journal/${article.slug}`}>{article.title}</a></h2>
        <p>{article.excerpt}</p>
        <ArticleMeta article={article} />
      </div>
    </article>
  );
}

export default async function JournalPage({ searchParams }: JournalPageProps) {
  const params = await searchParams;
  const requestedCategory = Array.isArray(params?.category) ? params?.category[0] : params?.category;
  const activeCategory = categories.some((item) => item.code === requestedCategory) ? requestedCategory : "all";
  const queryCategory = activeCategory === "all" ? undefined : activeCategory;

  let items: JournalArticle[] | null = null;
  let failed = false;
  try {
    items = await fetchArticles(queryCategory);
  } catch {
    failed = true;
  }

  const latest = items?.[0];
  const remaining = items?.slice(1) ?? [];

  return (
    <main dir="rtl" className="inner-page journal-page">
      <InnerHeader />
      <section className="journal-heading section-shell">
        <p className="eyebrow dark"><span /> مجله ویلاوان</p>
        <div className="journal-heading-layout">
          <div>
            <h1>خانه، سفر و<br />زندگی در شمال</h1>
            <p>راهنماهای کاربردی و روایت‌های دقیق برای انتخاب اقامتگاه، کشف مازندران و ساختن زندگی بهتر در شمال.</p>
          </div>
          <div className="journal-editorial-note"><span>ماهی یک روایت</span><strong>آرام، کاربردی، قابل اعتماد</strong><small>مقاله‌های ویلاوان با نگاه محلی و تجربه کانسیرج نوشته می‌شوند.</small></div>
        </div>
      </section>

      <nav className="journal-categories section-shell" aria-label="دسته‌بندی مقاله‌ها">
        {categories.map((category) => <a key={category.code} className={activeCategory === category.code ? "active" : ""} href={category.code === "all" ? "/journal" : `/journal?category=${category.code}`} aria-current={activeCategory === category.code ? "page" : undefined}>{category.label}</a>)}
      </nav>

      {failed ? (
        <section className="journal-state section-shell" role="alert"><strong>دریافت مجله ممکن نیست.</strong><p>ارتباط با سرور برقرار نشد. چند لحظه بعد دوباره تلاش کنید.</p><a href={activeCategory === "all" ? "/journal" : `/journal?category=${activeCategory}`}>تلاش دوباره</a></section>
      ) : items === null ? (
        <section className="journal-state section-shell" role="status"><strong>مجله موقتاً در دسترس نیست.</strong><p>به‌زودی مقاله‌های ویلاوان از همین‌جا در دسترس خواهند بود.</p></section>
      ) : items.length === 0 ? (
        <section className="journal-state section-shell" role="status"><strong>هنوز مقاله‌ای در این دسته منتشر نشده است.</strong><p>دسته دیگری را ببینید یا برای روایت بعدی ویلاوان همراه ما باشید.</p><a href="/journal">مشاهده همه مقاله‌ها</a></section>
      ) : (
        <>
          {latest && <section className="journal-latest section-shell"><a className="journal-latest-image" href={`/journal/${latest.slug}`}><ArticleImage article={latest} /></a><div className="journal-latest-copy"><span className="journal-category">آخرین روایت · {latest.category}</span><h2><a href={`/journal/${latest.slug}`}>{latest.title}</a></h2><p>{latest.excerpt}</p><ArticleMeta article={latest} /><a className="journal-read-link" href={`/journal/${latest.slug}`}>مطالعه مقاله <span>←</span></a></div></section>}
          {remaining.length > 0 && <section className="journal-grid section-shell">{remaining.map((article) => <ArticleCard key={article.slug} article={article} />)}</section>}
        </>
      )}
    </main>
  );
}
