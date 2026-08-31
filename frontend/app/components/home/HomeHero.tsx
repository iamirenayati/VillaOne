"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import Link from "next/link";
import type { City } from "../../lib/api";
import { CinematicVideo } from "../CinematicVideo";
import { PublicHeader } from "../PublicHeader";
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

type HomeSelectOption = {
  value: string;
  label: string;
};

function HomeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: HomeSelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const focusOption = (index: number) => {
    requestAnimationFrame(() => {
      const optionButtons = rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']");
      optionButtons?.[Math.max(0, Math.min(index, options.length - 1))]?.focus();
    });
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true);
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    focusOption(event.key === "ArrowDown" ? selectedIndex : Math.max(selectedIndex - 1, 0));
  };

  return (
    <div className={styles.customSelect} ref={rootRef}>
      <button
        type="button"
        className={styles.selectTrigger}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <strong>{selected.label}</strong>
        <span aria-hidden="true" className={styles.selectChevron}>⌄</span>
      </button>
      {open && (
        <div className={styles.selectMenu} id={listId} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? styles.selectOptionActive : styles.selectOption}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  focusOption(index + (event.key === "ArrowDown" ? 1 : -1));
                }
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <div className={styles.searchField}>
          <span>مقصد</span>
          <HomeSelect
            label="انتخاب مقصد"
            value={props.destination}
            onChange={props.onDestinationChange}
            options={[
              { value: "", label: "همه مازندران" },
              ...props.cities.map((city) => ({ value: city.name, label: city.name })),
            ]}
          />
        </div>
        <label className={styles.searchField}>
          <span>ورود</span>
          <ShamsiDateField className="home-date-field" value={props.checkin} onChange={props.onCheckinChange} label="تاریخ ورود" />
        </label>
        <label className={styles.searchField}>
          <span>خروج</span>
          <ShamsiDateField className="home-date-field" value={props.checkout} minValue={props.checkin} onChange={props.onCheckoutChange} label="تاریخ خروج" />
        </label>
        <div className={`${styles.searchField} ${styles.guestField}`}>
          <span>مهمان</span>
          <HomeSelect
            label="تعداد مهمان"
            value={props.guestCount}
            onChange={props.onGuestCountChange}
            options={[2, 4, 6, 8].map((count) => ({ value: String(count), label: `${count.toLocaleString("fa-IR")} نفر` }))}
          />
        </div>
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
