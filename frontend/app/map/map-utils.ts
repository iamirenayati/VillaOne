const SETTING_LABELS: Record<string, string> = {
  forest: "جنگلی",
  mountain: "کوهستانی",
  beachfront: "ساحلی",
  countryside: "ییلاقی",
  garden: "باغ",
  riverside: "کنار رودخانه",
};

export function toman(value: string) {
  return Number(value).toLocaleString("fa-IR");
}

export function compactPrice(value: string) {
  const amount = Number(value);
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toLocaleString("fa-IR", { maximumFractionDigits: 1 })}م`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000).toLocaleString("fa-IR")}هزار`;
  return amount.toLocaleString("fa-IR");
}

export function settingLabel(tags: string[]) {
  return tags.slice(0, 2).map((tag) => SETTING_LABELS[tag] ?? tag).join(" · ");
}
