"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FocusEvent, KeyboardEvent } from "react";
import styles from "./PublicSelect.module.css";

export type PublicSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type PublicSelectProps = {
  label: string;
  value: string;
  options: readonly PublicSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  placement?: "top" | "bottom";
};

export function PublicSelect({ label, value, options, onChange, className = "", disabled = false, placement = "bottom" }: PublicSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const selected = options[selectedIndex];

  const focusOption = (index: number) => {
    requestAnimationFrame(() => {
      const optionButtons = rootRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']:not(:disabled)");
      if (!optionButtons?.length) return;
      const boundedIndex = Math.max(0, Math.min(index, optionButtons.length - 1));
      optionButtons[boundedIndex]?.focus();
    });
  };

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    setOpen(true);
    focusOption(event.key === "ArrowDown" ? selectedIndex : Math.max(selectedIndex - 1, 0));
  };

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusOption(event.key === "Home" ? 0 : options.length - 1);
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  };

  return (
    <div className={`${styles.field} ${className}`.trim()} ref={rootRef} onBlur={handleBlur}>
      <span className={styles.label}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <strong>{selected?.label ?? "انتخاب کنید"}</strong>
        <span aria-hidden="true" className={styles.chevron}>⌄</span>
      </button>
      {open && (
        <div className={`${styles.menu} ${placement === "top" ? styles.menuTop : ""}`} id={listId} role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              disabled={option.disabled}
              aria-selected={option.value === value}
              className={option.value === value ? styles.optionActive : styles.option}
              onClick={() => {
                onChange(option.value);
                close(true);
              }}
              onKeyDown={(event) => handleOptionKeyDown(event, index)}
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
