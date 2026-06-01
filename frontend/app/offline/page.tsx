"use client";

import { AlertTriangle, PhoneCall, ShieldCheck, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-[#FAF7F0] p-6 text-[#1B2424] flex items-center justify-center font-sans">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-10">
          <WifiOff className="mx-auto text-gray-400 mb-6" size={64} />
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">No Internet Connection</h1>
          <p className="text-gray-600">You are currently offline. Mediroute AI's advanced features are disabled, but you can use this basic guide for emergencies.</p>
        </div>

        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="text-red-600 mt-1" size={28} />
            <div>
              <h2 className="text-xl font-bold text-red-800 mb-2">Is this a medical emergency?</h2>
              <p className="text-red-700 mb-4">Do not wait for the internet. Call emergency services immediately.</p>
              <a href="tel:112" className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-md font-bold hover:bg-red-700 transition">
                <PhoneCall size={20} /> Call 112 (India)
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white border p-6 rounded-lg shadow-sm">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-3">
            <ShieldCheck className="text-green-600" /> Offline First-Aid Quick Guide
          </h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Cardiac Arrest / Unconscious</h3>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 text-sm">
                <li>Check for breathing and pulse.</li>
                <li>If none, start CPR immediately (100-120 chest compressions per minute).</li>
                <li>Do not stop until help arrives.</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Severe Bleeding</h3>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 text-sm">
                <li>Apply firm, direct pressure to the wound with a clean cloth.</li>
                <li>Elevate the injured area above the heart if possible.</li>
                <li>Do not remove the cloth; add more on top if it soaks through.</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Heart Attack (Chest Pain)</h3>
              <ul className="list-disc pl-5 text-gray-600 space-y-1 text-sm">
                <li>Have the person sit down, rest, and try to keep calm.</li>
                <li>Loosen any tight clothing.</li>
                <li>If they are prescribed nitroglycerin or aspirin, help them take it.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
