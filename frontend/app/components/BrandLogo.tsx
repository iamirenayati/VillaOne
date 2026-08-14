type BrandLogoProps = {
  className?: string;
};

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`villaone-logo-mark ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <path className="logo-valley" d="M7.5 9.5 24 40 40.5 9.5" />
        <path className="logo-one" d="M24 8.5v31M24 8.5l-5.25 5.25" />
        <path className="logo-portal" d="M17.5 39.5V29.4a6.5 6.5 0 0 1 13 0v10.1" />
      </svg>
    </span>
  );
}

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <span className={`villaone-logo ${className}`.trim()}>
      <BrandMark />
      <span className="brand-copy">
        <strong>VILLAONE</strong>
        <small>ویلاوان</small>
      </span>
    </span>
  );
}
