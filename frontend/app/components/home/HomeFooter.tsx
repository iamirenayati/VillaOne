import Link from "next/link";
import type { BusinessSettings } from "../../lib/api";
import { BrandLogo } from "../BrandLogo";
import styles from "../../HomePage.module.css";

export function HomeFooter({ business }: { business: BusinessSettings | null }) {
  const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date());
  return (
    <footer className={styles.footer} id="footer">
      <div className={`${styles.footerGrid} ${styles.shell}`}>
        <div className={styles.footerBrand}><Link href="#home" aria-label="ویلاوان — بازگشت به ابتدای صفحه"><BrandLogo /></Link><p>{business?.footer_description || "اطلاعات معرفی و تماس ویلاوان در حال تکمیل است."}</p></div>
        <nav aria-label="کشف ویلاوان"><h2>کشف کنید</h2><Link href="/villas">ویلاها</Link><Link href="/map">نقشه</Link><Link href="/services">خدمات سفر</Link><Link href="/journal">مجله</Link></nav>
        <nav aria-label="خدمات بازار"><h2>همراهی ما</h2><Link href="/real-estate">املاک</Link><Link href="/contractors">پیمانکاران</Link><Link href="/support">پشتیبانی</Link><Link href="/account">حساب کاربری</Link></nav>
        <div className={styles.footerContact}><h2>ارتباط</h2>{business?.support_phone ? <a href={`tel:${business.support_phone}`}>{business.support_phone}</a> : <span>شماره پشتیبانی در حال تکمیل است</span>}<p>{business?.operating_hours || "ساعات پاسخ‌گویی در حال تکمیل است."}</p></div>
      </div>
      <div className={`${styles.footerBottom} ${styles.shell}`}><span>© {year} ویلاوان</span><div><Link href="/terms">قوانین</Link><Link href="/privacy">حریم خصوصی</Link><Link href="/cancellation">لغو رزرو</Link></div></div>
    </footer>
  );
}
