"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogOut, PlusSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function HospitalHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [hospitalName, setHospitalName] = useState("");

  useEffect(() => {
    setHospitalName(localStorage.getItem("hospital_name") || "");
  }, [pathname]);

  if (!pathname.startsWith("/hospital/") && pathname !== "/hospital") return null;

  // Don't show header on login page
  if (pathname === "/hospital/login") return null;

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/hospital/dashboard" className="flex items-center gap-2">
          <PlusSquare className="text-red-600" />
          <span className="font-bold text-gray-900 text-lg">Hospital Portal</span>
        </Link>
        <div className="flex items-center gap-6">
          <Link href="/hospital/dashboard" className={`text-sm font-semibold transition-colors ${pathname === '/hospital/dashboard' ? 'text-red-600' : 'text-gray-500 hover:text-gray-900'}`}>
            Live Feed
          </Link>
          <Link href="/hospital/history" className={`text-sm font-semibold transition-colors ${pathname === '/hospital/history' ? 'text-red-600' : 'text-gray-500 hover:text-gray-900'}`}>
            History
          </Link>
        </div>

        <div className="flex items-center gap-4 text-sm font-medium">
          {hospitalName && (
            <span className="text-gray-600 mr-2">{hospitalName}</span>
          )}
          <button 
            onClick={() => {
              localStorage.removeItem("hospital_token");
              localStorage.removeItem("hospital_name");
              localStorage.removeItem("hospital_id");
              router.push("/hospital/login");
            }}
            className="flex items-center gap-1.5 text-red-600 hover:text-red-700"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
