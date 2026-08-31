"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { type ApiUser, fetchCurrentUser, hasAuthenticatedSession } from "../lib/api";
import { BrandLogo } from "./BrandLogo";
import styles from "./PublicHeader.module.css";

const links = [
  ["/map", "نقشه"],
  ["/3d", "3D"],
  ["/villas", "ویلاها"],
  ["/real-estate", "املاک"],
  ["/contractors", "پیمانکاران"],
  ["/services", "خدمات سفر"],
  ["/journal", "مجله"],
] as const;

type PublicHeaderProps = {
  variant?: "surface" | "overlay";
};

export function PublicHeader({ variant = "surface" }: PublicHeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const lastScroll = useRef(0);

  const profileName = currentUser ? (`${currentUser.first_name} ${currentUser.last_name}`.trim() || currentUser.phone) : "";
  const accountHref = currentUser ? "/account" : `/login?next=${encodeURIComponent(pathname || "/")}`;
  const accountLabel = currentUser ? profileName : "ورود / ثبت‌نام";
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  useEffect(() => closeMenu(), [pathname]);

  useEffect(() => {
    let active = true;
    if (!hasAuthenticatedSession()) {
      setCurrentUser(null);
      return () => { active = false; };
    }
    // Route changes can overlap a slow profile request. Ignore stale results
    // so an older request cannot repaint a signed-out or newer session.
    void fetchCurrentUser().then((user) => {
      if (active) setCurrentUser(user);
    }).catch(() => {
      if (active) setCurrentUser(null);
    });
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    const handleExpired = () => setCurrentUser(null);
    window.addEventListener("villaone-session-expired", handleExpired);
    return () => window.removeEventListener("villaone-session-expired", handleExpired);
  }, []);

  useEffect(() => {
    const updateHeader = () => {
      const nextY = Math.max(window.scrollY, 0);
      setScrolled(nextY > 12);
      if (open || nextY < 96 || nextY < lastScroll.current - 8) setHidden(false);
      else if (nextY > lastScroll.current + 12) setHidden(true);
      lastScroll.current = nextY;
    };
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    const focusHandle = window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>("a[href]")?.focus(), 80);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      window.clearTimeout(focusHandle);
    };
  }, [open]);

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !menuRef.current) return;
    const focusable = [...menuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      triggerRef.current?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      triggerRef.current?.focus();
    }
  }

  const headerClass = [
    styles.header,
    variant === "overlay" ? styles.overlay : styles.surface,
    variant === "overlay" && scrolled ? styles.scrolled : "",
    hidden && !open ? styles.hidden : "",
    open ? styles.menuOpen : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <header className={headerClass}>
        <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="VillaOne — صفحه اصلی">
          <BrandLogo />
        </Link>
        <nav ref={menuRef} id="public-navigation" className={`${styles.nav} ${open ? styles.navOpen : ""}`} aria-label="منوی اصلی" onKeyDown={handleMenuKeyDown}>
          {links.map(([href, label]) => <Link key={href} className={isActive(href) ? styles.active : ""} href={href} aria-current={isActive(href) ? "page" : undefined} onClick={() => closeMenu()}>{label}</Link>)}
          <Link className={styles.mobileAccount} href={accountHref} onClick={() => closeMenu()}>{accountLabel}</Link>
        </nav>
        <div className={styles.actions}>
          <Link className={styles.account} href={accountHref} aria-label={currentUser ? "مشاهده حساب کاربری" : "ورود یا ثبت‌نام"}>
            {currentUser && <span className={styles.avatar}>{profileName.slice(0, 1)}</span>}
            <span>{accountLabel}</span>
          </Link>
          {variant === "overlay" && <Link className={styles.cta} href="/villas">مشاهده ویلاها</Link>}
          <button ref={triggerRef} type="button" className={styles.menuButton} aria-label={open ? "بستن منو" : "نمایش منو"} aria-controls="public-navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            <span /><span />
          </button>
        </div>
        </div>
        {open && <button className={styles.scrim} type="button" aria-label="بستن منو" onClick={() => closeMenu(true)} />}
      </header>
      {variant === "surface" && <div className={styles.spacer} aria-hidden="true" />}
    </>
  );
}
