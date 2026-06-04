"use client";

import { Globe2, Hospital } from "lucide-react";
import { languages, useLang } from "@/contexts/LanguageContext";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  if (pathname.startsWith("/hospital/") || pathname === "/hospital" || pathname.startsWith("/ambulance")) {
    return null;
  }

  return (
    <header className="app-header">
      <div className="site-container app-header-inner">
        <a href="/" className="app-brand" aria-label="MediRoute AI home">
          <span className="app-brand-mark">M</span>
          <span className="app-brand-name">MediRoute AI</span>
        </a>

        <nav className="app-nav" aria-label="Primary navigation">
          {nav.map((item) => (
            <a 
              key={item.href} 
              href={item.href} 
              className={`app-nav-link ${pathname === item.href ? 'active' : ''}`}
              aria-current={pathname === item.href ? 'page' : undefined}
            >
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
                  {language.label}
                </option>
              ))}
            </select>
          </label>

          <a href="/hospital/login" className="btn btn-outline btn-sm" style={{ padding: "0.25rem 0.5rem", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
            <Hospital size={14} />
            Hospital Login
          </a>

          <a href="/ambulance/login" className="btn btn-outline btn-sm" style={{ padding: "0.25rem 0.5rem", border: "1px solid #ccc", borderRadius: "4px", fontSize: "13px", textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: "4px" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
            Driver Login
          </a>

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
              <a href="/hospital/login">
                Hospital Login
              </a>
              <a href="/ambulance/login">
                Driver Login
              </a>
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
