import type { FormEvent } from "react";
import Link from "next/link";
import type { City } from "../../lib/api";
import { CinematicVideo } from "../CinematicVideo";
import { PublicHeader } from "../PublicHeader";
import { PublicSelect } from "../PublicSelect";
import { ShamsiDateField } from "../ShamsiDateField";
import styles from "../../HomePage.module.css";

type HomeHeroProps = {
  cities: City[];
  destination: string;
  checkin: string;
  checkout: string;
  guestCount: string;
  searchNote: string;
  onDestinationChange: (value: string) => void;
  onCheckinChange: (value: string) => void;
  onCheckoutChange: (value: string) => void;
  onGuestCountChange: (value: string) => void;
  onSearch: (event: FormEvent<HTMLFormElement>) => void;
};

export function HomeHero(props: HomeHeroProps) {
  return (
    <section className={styles.hero} id="home" aria-labelledby="home-hero-title">
      <PublicHeader variant="overlay" />
      <CinematicVideo
        className={styles.heroMedia}
        poster="/images/editorial/home-hero-poster.webp"
        label="چشم‌انداز ویلای جنگلی"
        eager
        sources={[
          { src: "/media/home/hero-forest-mobile.mp4", type: "video/mp4", media: "(max-width: 767px)" },
          { src: "/media/home/hero-forest-desktop.mp4", type: "video/mp4", media: "(min-width: 768px)" },
        ]}
      />
      <div className={styles.heroShade} aria-hidden="true" />

      <div className={styles.heroContent}>
        <p className={styles.kicker}><span /> ویلاهای منتخب مازندران</p>
        <h1 id="home-hero-title">ویلای خاص؛<br />سفرِ ماندگار</h1>
        <p className={styles.heroLead}>از ویلای جنگلی تا خانه‌های نزدیک دریا؛ اقامتگاه‌هایی که برای کیفیت، معماری و تجربه متفاوت انتخاب شده‌اند.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryAction} href="/villas">کشف ویلاها <span aria-hidden="true">←</span></Link>
          <Link className={styles.secondaryAction} href="/map">مشاهده روی نقشه</Link>
        </div>
      </div>

      <form className={styles.searchDock} onSubmit={props.onSearch} aria-label="جست‌وجوی اقامتگاه">
        <PublicSelect
            className={`${styles.searchField} ${styles.heroSelect}`}
            label="مقصد"
            value={props.destination}
            onChange={props.onDestinationChange}
            placement="top"
            options={[
              { value: "", label: "همه مازندران" },
              ...props.cities.map((city) => ({ value: city.name, label: city.name })),
            ]}
        />
        <label className={styles.searchField}>
          <span>ورود</span>
          <ShamsiDateField className="home-date-field" value={props.checkin} onChange={props.onCheckinChange} label="تاریخ ورود" />
        </label>
        <label className={styles.searchField}>
          <span>خروج</span>
          <ShamsiDateField className="home-date-field" value={props.checkout} minValue={props.checkin} onChange={props.onCheckoutChange} label="تاریخ خروج" />
        </label>
        <PublicSelect
            className={`${styles.searchField} ${styles.guestField} ${styles.heroSelect}`}
            label="مهمان"
            value={props.guestCount}
            onChange={props.onGuestCountChange}
            placement="top"
            options={[2, 4, 6, 8].map((count) => ({ value: String(count), label: `${count.toLocaleString("fa-IR")} نفر` }))}
        />
        <button className={styles.searchButton} type="submit">جست‌وجو <span aria-hidden="true">←</span></button>
      </form>
      {props.searchNote && <p className={styles.searchError} role="alert">{props.searchNote}</p>}

      <div className={styles.heroFootnote} aria-hidden="true">
        <span>مازندران، ایران</span>
        <span>رزرو با همراهی تیم ویلاوان</span>
      </div>
    </section>
  );
}
