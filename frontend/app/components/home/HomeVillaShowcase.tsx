/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { VillaListing } from "../../types/villa";
import styles from "../../HomePage.module.css";

type HomeVillaShowcaseProps = {
  villas: VillaListing[];
  state: "loading" | "ready" | "error";
  favorites: string[];
  favoriteBusy: string;
  onFavorite: (slug: string) => void;
  onRetry: () => void;
};

function VillaStage({ villa, index, selected, busy, onFavorite }: {
  villa: VillaListing;
  index: number;
  selected: boolean;
  busy: boolean;
  onFavorite: () => void;
}) {
  const number = (index + 1).toLocaleString("fa-IR", { minimumIntegerDigits: 2 });
  return (
    <article className={styles.villaCinematicCard}>
      <Link className={styles.villaCinematicVisual} href={`/villas/${villa.slug}`} aria-label={`مشاهده ${villa.title}`}>
        {villa.image ? (
          <img src={villa.image} alt={`${villa.title} در ${villa.city}`} width="1600" height="1000" loading="lazy" decoding="async" />
        ) : <span className={styles.villaCinematicPlaceholder}>تصویر این ویلا هنوز ثبت نشده است</span>}
        <span className={styles.villaCinematicShade} aria-hidden="true" />
      </Link>

      <div className={styles.villaCinematicTopline}>
        <span>{number}</span>
        <span>{villa.badge}</span>
      </div>

      <button
        type="button"
        className={`${styles.favorite} ${selected ? styles.favoriteSelected : ""}`}
        aria-label={selected ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
        aria-pressed={selected}
        disabled={busy}
        onClick={onFavorite}
      >
        <span aria-hidden="true">{selected ? "♥" : "♡"}</span>
      </button>

      <div className={styles.villaCinematicContent}>
        <p>{villa.city}<span />{villa.setting}</p>
        <h3 className={styles.villaDisplayTitle}><Link href={`/villas/${villa.slug}`}>{villa.title}</Link></h3>
        <div className={styles.villaCinematicFooter}>
          <div><span>تا {villa.guests.toLocaleString("fa-IR")} مهمان</span><span>{villa.rooms.toLocaleString("fa-IR")} اتاق خواب</span></div>
          <p><strong>{villa.priceLabel}</strong><small>تومان / شب</small></p>
          <Link href={`/villas/${villa.slug}`} aria-label={`ورود به صفحه ${villa.title}`}>مشاهده ویلا <span aria-hidden="true">←</span></Link>
        </div>
      </div>
    </article>
  );
}

export function HomeVillaShowcase(props: HomeVillaShowcaseProps) {
  return (
    <section className={styles.villasSection} id="villas" aria-labelledby="featured-villas-title">
      <div className={styles.shell}>
        <header className={styles.sectionHeader}>
          <div><p className={styles.kickerDark}><span /> مجموعه ویلاوان</p><h2 id="featured-villas-title">اقامت‌های<br />شاخص مازندران</h2></div>
          <div><p>فضاهای خاص با معماری، طبیعت و میزبانی متمایز؛ بزرگ‌تر ببینید و دقیق‌تر انتخاب کنید.</p><Link href="/villas">مشاهده همه ویلاها <span aria-hidden="true">←</span></Link></div>
        </header>

        {props.state === "loading" && <div className={styles.villaSkeletons} aria-busy="true" aria-label="در حال دریافت ویلاها"><i /><i /><i /></div>}
        {props.state === "error" && <div className={styles.inlineState} role="alert"><p>در حال حاضر دریافت اقامتگاه‌ها ممکن نیست.</p><button type="button" onClick={props.onRetry}>تلاش دوباره</button></div>}
        {props.state === "ready" && props.villas.length === 0 && <div className={styles.inlineState}><p>هنوز ویلای منتشرشده‌ای برای نمایش وجود ندارد.</p><Link href="/support">ارتباط با پشتیبانی</Link></div>}
        {props.villas.length > 0 && (
          <div className={styles.villaCinematicList}>
            {props.villas.map((villa, index) => (
              <VillaStage key={villa.slug} villa={villa} index={index} selected={props.favorites.includes(villa.slug)} busy={props.favoriteBusy === villa.slug} onFavorite={() => props.onFavorite(villa.slug)} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
