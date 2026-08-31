import type { Metadata } from "next";
import { PublicHeader } from "../components/PublicHeader";
import { DioramaExperience } from "./DioramaExperience";
import styles from "./Diorama.module.css";

export const metadata: Metadata = {
  title: "تجربه سه‌بعدی جنگل هیرکانی | ویلاوان",
  description: "یک ویلای مفهومی در میان جنگل هیرکانی؛ تجربه‌ای تعاملی از معماری و طبیعت ویلاوان.",
};

export default function HyrcanianDioramaPage() {
  return (
    <main className={styles.page} dir="rtl">
      <PublicHeader variant="overlay" />
      <DioramaExperience />
    </main>
  );
}
