"use client";

import { Globe2 } from "lucide-react";
import { languages, useLang } from "@/contexts/LanguageContext";

const nav = [
  { href: "/", labelKey: "nav.home" },
  { href: "/symptoms", labelKey: "nav.symptoms" },
  { href: "/upload", labelKey: "nav.reports" },
  { href: "/analysis", labelKey: "nav.analysis" },
  { href: "/hospitals", labelKey: "nav.hospitals" },
  { href: "/dashboard", labelKey: "nav.live" },
];

export function PatientHeader() {
  const { lang, setLang, t } = useLang();

  return (
    <header className="app-header">
      <div className="site-container app-header-inner">
        <a href="/" className="app-brand" aria-label="MediRoute AI home">
          <span className="app-brand-mark">M</span>
          <span className="app-brand-name">MediRoute AI</span>
        </a>

        <nav className="app-nav" aria-label="Primary navigation">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="app-nav-link">
              {t(item.labelKey)}
            </a>
          ))}
        </nav>

        <div className="app-header-actions">
          <label className="language-select" aria-label={t("common.language")}>
            <Globe2 size={15} />
            <select value={lang} onChange={(event) => setLang(event.target.value as typeof lang)}>
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.nativeName}
                </option>
              ))}
            </select>
          </label>

          <a href="tel:112" className="btn btn-danger btn-sm">
            {t("common.emergency112")}
          </a>

          <details className="app-mobile-menu">
            <summary aria-label="Open navigation menu">
              <span />
              <span />
              <span />
            </summary>
            <div className="app-mobile-panel">
              {nav.map((item) => (
                <a key={item.href} href={item.href}>
                  {t(item.labelKey)}
                </a>
              ))}
              <a href="tel:112" className="app-mobile-emergency">
                {t("common.emergencyCall112")}
              </a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
