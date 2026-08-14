"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HomeEditorial } from "./components/home/HomeEditorial";
import { HomeFooter } from "./components/home/HomeFooter";
import { HomeHero } from "./components/home/HomeHero";
import { HomeVillaShowcase } from "./components/home/HomeVillaShowcase";
import {
  type BusinessSettings,
  type City,
  type JournalArticle,
  fetchArticles,
  fetchBusinessSettings,
  fetchCities,
  fetchFavoriteVillas,
  fetchVillas,
  hasAuthenticatedSession,
  toggleVillaFavorite,
} from "./lib/api";
import type { VillaListing } from "./types/villa";
import styles from "./HomePage.module.css";

type ContentState = "loading" | "ready" | "error";

export default function Home() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteBusy, setFavoriteBusy] = useState("");
  const [searchNote, setSearchNote] = useState("");
  const [destination, setDestination] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [villas, setVillas] = useState<VillaListing[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [journal, setJournal] = useState<JournalArticle | null>(null);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [catalogState, setCatalogState] = useState<ContentState>("loading");
  const [journalState, setJournalState] = useState<ContentState>("loading");

  const loadContent = useCallback(async () => {
    setCatalogState("loading");
    setJournalState("loading");
    const [catalogResult, citiesResult, articlesResult, businessResult] = await Promise.allSettled([
      fetchVillas(), fetchCities(), fetchArticles(), fetchBusinessSettings(),
    ]);

    if (catalogResult.status === "fulfilled" && catalogResult.value !== null) {
      const featured = catalogResult.value.filter((item) => item.badge === "منتخب ویلاوان");
      setVillas((featured.length ? featured : catalogResult.value).slice(0, 3));
      setCatalogState("ready");
    } else {
      setVillas([]);
      setCatalogState("error");
    }

    if (citiesResult.status === "fulfilled") setCities(citiesResult.value ?? []);
    if (articlesResult.status === "fulfilled" && articlesResult.value !== null) {
      setJournal(articlesResult.value[0] ?? null);
      setJournalState("ready");
    } else {
      setJournal(null);
      setJournalState("error");
    }
    if (businessResult.status === "fulfilled") setBusiness(businessResult.value ?? null);
  }, []);

  useEffect(() => {
    const today = new Date();
    const addDays = (amount: number) => {
      const value = new Date(today);
      value.setDate(value.getDate() + amount);
      return value.toISOString().slice(0, 10);
    };
    setCheckin(addDays(1));
    setCheckout(addDays(3));
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    if (!hasAuthenticatedSession()) return;
    void fetchFavoriteVillas()
      .then((items) => setFavorites((items ?? []).map((item) => item.slug)))
      .catch(() => setFavorites([]));
  }, []);

  async function handleFavorite(slug: string) {
    if (!hasAuthenticatedSession()) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    if (favoriteBusy) return;
    setFavoriteBusy(slug);
    try {
      const result = await toggleVillaFavorite(slug);
      if (result) setFavorites((current) => result.saved ? [...new Set([...current, slug])] : current.filter((item) => item !== slug));
    } finally {
      setFavoriteBusy("");
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkinDate = checkin ? new Date(`${checkin}T12:00:00`) : null;
    const checkoutDate = checkout ? new Date(`${checkout}T12:00:00`) : null;
    const nights = checkinDate && checkoutDate ? Math.round((checkoutDate.getTime() - checkinDate.getTime()) / 86_400_000) : 0;
    if (!checkinDate || !checkoutDate || checkinDate < today || nights < 2) {
      setSearchNote("برای رزرو، تاریخ ورود معتبر و حداقل دو شب اقامت را انتخاب کنید.");
      return;
    }
    setSearchNote("");
    const query = new URLSearchParams({ checkin, checkout, guests: guestCount });
    if (destination) query.set("city", destination);
    router.push(`/villas?${query.toString()}`);
  }

  return (
    <main className={styles.page} dir="rtl">
      <HomeHero
        cities={cities}
        destination={destination}
        checkin={checkin}
        checkout={checkout}
        guestCount={guestCount}
        searchNote={searchNote}
        onDestinationChange={setDestination}
        onCheckinChange={setCheckin}
        onCheckoutChange={setCheckout}
        onGuestCountChange={setGuestCount}
        onSearch={handleSearch}
      />
      <HomeVillaShowcase
        villas={villas}
        state={catalogState}
        favorites={favorites}
        favoriteBusy={favoriteBusy}
        onFavorite={(slug) => void handleFavorite(slug)}
        onRetry={() => void loadContent()}
      />
      <HomeEditorial journal={journal} journalState={journalState} onRetry={() => void loadContent()} />
      <HomeFooter business={business} />
    </main>
  );
}
