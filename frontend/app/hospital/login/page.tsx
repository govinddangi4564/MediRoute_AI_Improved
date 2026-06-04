"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Hospital, LocateFixed, Lock, Mail, MapPin } from "lucide-react";
import Link from "next/link";

export default function HospitalLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const router = useRouter();

  const captureCurrentLocation = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      setLocating(true);
      setError("");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocating(false);
        },
        () => {
          setError("Please allow location access. Hospital registration needs live location for accurate emergency routing.");
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
      );
    } else {
      setError("Geolocation is not available in this browser.");
    }
  };

  useEffect(() => {
    if (!isLogin) captureCurrentLocation();
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLogin && !location) {
      setError("Capture current hospital location before registering.");
      return;
    }

    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const body = isLogin 
      ? { email, password }
      : { 
          email, 
          password, 
          hospitalName, 
          lat: location!.lat,
          lng: location!.lng
        };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      // Save token and redirect
      localStorage.setItem("hospital_token", data.token);
      localStorage.setItem("hospital_name", data.user.hospitalName);
      localStorage.setItem("hospital_id", data.user.id);
      
      router.push("/hospital/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--cream)] flex items-center justify-center p-6 pt-24">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border p-8">
        <div className="text-center mb-8">
          <div className="bg-[var(--accent)] text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Hospital size={32} />
          </div>
          <h1 className="text-2xl font-bold text-[var(--ink)]">
            {isLogin ? "Hospital Portal" : "Register Hospital"}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {isLogin 
              ? "Access the Live Emergency Command Center" 
              : "Join the Mediroute emergency network"}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name</label>
                <div className="relative">
                  <Hospital className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] outline-none"
                    placeholder="e.g. Apollo Hospital"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Hospital Location</label>
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-1 text-gray-400" size={18} />
                    <div className="min-w-0 flex-1">
                      {location ? (
                        <>
                          <p className="text-sm font-semibold text-gray-800">Live location captured</p>
                          <p className="mt-1 text-xs text-gray-500">
                            Lat {location.lat.toFixed(6)}, Lng {location.lng.toFixed(6)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-800">Location required</p>
                          <p className="mt-1 text-xs text-gray-500">
                            We store exact coordinates, not a typed address, for accurate routing.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={captureCurrentLocation}
                    disabled={locating}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-white px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent-light)] disabled:opacity-60"
                  >
                    <LocateFixed size={16} />
                    {locating ? "Capturing location..." : location ? "Refresh current location" : "Use current location"}
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] outline-none"
                placeholder="admin@hospital.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-lg hover:bg-[#155a50] transition disabled:opacity-50 mt-6"
          >
            {loading ? "Please wait..." : isLogin ? "Sign In to Dashboard" : "Register Hospital"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-[var(--accent)] hover:underline font-medium"
          >
            {isLogin 
              ? "Don't have an account? Register your hospital" 
              : "Already registered? Sign in instead"}
          </button>
        </div>
        
        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-500 text-sm hover:underline">
            &larr; Back to Mediroute Home
          </Link>
        </div>
      </div>
    </main>
  );
}
