/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { JournalArticle } from "../../lib/api";
import { CinematicVideo } from "../CinematicVideo";
import styles from "../../HomePage.module.css";

const standards = [
  ["۰۱", "انتخاب با وسواس", "هر ویلا پیش از انتشار از نظر کیفیت، اطلاعات و تجربه اقامت بررسی می‌شود."],
  ["۰۲", "رزرو روشن", "قیمت، شرایط پرداخت و قوانین اقامت پیش از ثبت درخواست شفاف هستند."],
  ["۰۳", "همراهی انسانی", "از انتخاب تا پایان سفر، یک تیم واقعی برای هماهنگی و پشتیبانی کنار شماست."],
] as const;

type HomeEditorialProps = {
  journal: JournalArticle | null;
  journalState: "loading" | "ready" | "error";
  onRetry: () => void;
};

export function HomeEditorial({ journal, journalState, onRetry }: HomeEditorialProps) {
  return (
    <>
      <section className={`${styles.story} ${styles.shell}`} aria-labelledby="story-title">
        <p className={styles.verticalLabel}>داستان ویلاوان</p>
        <div className={styles.storyStatement}>
          <p className={styles.kickerDark}><span /> سفر، با یک انتخاب خوب آغاز می‌شود</p>
          <h2 id="story-title">نه فقط جایی برای ماندن؛<br />فضایی برای به‌یاد آوردن.</h2>
        </div>
        <div className={styles.storyCopy}>
          <p>ویلاوان مجموعه‌ای از اقامتگاه‌های اتفاقی نیست. ما جزئیاتی را انتخاب می‌کنیم که سفر شما را آرام‌تر، زیباتر و قابل اعتمادتر می‌کنند.</p>
          <Link href="/support">آشنایی با شیوه همراهی ما <span aria-hidden="true">←</span></Link>
        </div>
      </section>

      <section className={styles.conciergeSection} id="concierge" aria-labelledby="concierge-title">
        <CinematicVideo
          className={styles.conciergeMedia}
          poster="/images/villas/experience.jpg"
          label="صبحانه محلی در تراس"
          sources={[{ src: "/media/home/concierge-breakfast.mp4", type: "video/mp4" }]}
        />
        <div className={styles.conciergePanel}>
          <p className={styles.kickerLight}><span /> فراتر از اقامت</p>
          <h2 id="concierge-title">شما سفر کنید؛<br />جزئیات با ما.</h2>
          <p>از صبحانه محلی و آشپز خصوصی تا ترانسفر و تجربه‌های شخصی‌سازی‌شده؛ خدمات موردنیازتان را هنگام رزرو به سفر اضافه کنید.</p>
          <Link href="/services">کشف خدمات سفر <span aria-hidden="true">←</span></Link>
        </div>
      </section>

      <section className={`${styles.standards} ${styles.shell}`} aria-labelledby="standards-title">
        <header><p className={styles.kickerDark}><span /> استاندارد ویلاوان</p><h2 id="standards-title">آرامش، بخشی از<br />رزرو شماست.</h2></header>
        <div className={styles.standardList}>
          {standards.map(([number, title, description]) => (
            <article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>
          ))}
        </div>
      </section>

      <section className={`${styles.journalSection} ${styles.shell}`} id="journal" aria-labelledby="journal-title">
        <div className={styles.journalIntro}>
          <p className={styles.kickerDark}><span /> مجله ویلاوان</p>
          <h2 id="journal-title">روایت‌هایی برای<br />بهتر سفر کردن</h2>
          <p>راهنمای مقصد، معماری و تجربه‌های محلی؛ نوشته‌هایی آرام برای شناخت عمیق‌تر شمال.</p>
          <Link href="/journal">ورود به مجله <span aria-hidden="true">←</span></Link>
        </div>
        {journalState === "loading" && <div className={styles.journalState} aria-busy="true"><i /><div><span /><b /></div></div>}
        {journalState === "error" && <div className={styles.journalState} role="alert"><div><p>دریافت تازه‌ترین مقاله ممکن نبود.</p><button type="button" onClick={onRetry}>تلاش دوباره</button></div></div>}
        {journalState === "ready" && !journal && <div className={styles.journalState}><div><p>نخستین شماره مجله در حال آماده‌سازی است.</p><Link href="/journal">مشاهده مجله</Link></div></div>}
        {journalState === "ready" && journal && (
          <Link className={styles.journalFeature} href={`/journal/${journal.slug}`}>
            <span className={styles.journalImage}>{journal.cover_image ? <img src={journal.cover_image} alt={journal.cover_alt || journal.title} width={1200} height={820} loading="lazy" decoding="async" /> : <i>تصویر مقاله ثبت نشده است</i>}</span>
            <span className={styles.journalCaption}><small>{journal.category}</small><strong>{journal.title}</strong><i aria-hidden="true">←</i></span>
          </Link>
        )}
      </section>
    </>
  );
}
