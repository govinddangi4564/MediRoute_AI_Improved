"use client";

import { usePathname } from "next/navigation";

export function HospitalFooter() {
  const pathname = usePathname();

  if (!pathname.startsWith("/hospital/") && pathname !== "/hospital") return null;
  if (pathname === "/hospital/login") return null;

  return (
    <footer className="bg-white border-t py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
        <p>© 2026 MediRoute AI Hospital Portal. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="#" className="hover:text-gray-900 transition-colors">Support</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Documentation</a>
          <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
        </div>
      </div>
    </footer>
  );
}
