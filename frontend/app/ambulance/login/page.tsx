"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Truck, Lock, Mail, User, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function AmbulanceLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [hospitals, setHospitals] = useState<{_id: string, hospitalName: string}[]>([]);
  
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!isLogin) {
      // Fetch hospitals for registration dropdown
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/hospitals`)
        .then(res => res.json())
        .then(data => setHospitals(data))
        .catch(err => console.error("Failed to fetch hospitals", err));
    }
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/ambulance/login" : "/api/auth/ambulance/register";
    const body = isLogin 
      ? { email, password }
      : { email, password, driverName, vehicleNumber, hospitalId: hospitalId || undefined };

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
      localStorage.setItem("driver_token", data.token);
      localStorage.setItem("driver_id", data.user.id);
      localStorage.setItem("driver_name", data.user.driverName);
      localStorage.setItem("is_independent", String(data.user.isIndependent));
      
      router.push("/ambulance");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-red-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border p-8">
        <div className="text-center mb-8">
          <div className="bg-red-600 text-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Truck size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isLogin ? "Driver Portal" : "Register Driver"}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {isLogin 
              ? "Access your live mission dashboard" 
              : "Join a hospital's ambulance fleet"}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="e.g. John Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none uppercase"
                    placeholder="e.g. MH-01-AB-1234"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Hospital</label>
                <select
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none bg-white"
                >
                  <option value="">Independent Driver (No Hospital)</option>
                  {hospitals.map(h => (
                    <option key={h._id} value={h._id}>{h.hospitalName}</option>
                  ))}
                </select>
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
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="driver@example.com"
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
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50 mt-6"
          >
            {loading ? "Please wait..." : isLogin ? "Login to Dashboard" : "Register Driver Account"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-red-600 hover:underline font-medium"
          >
            {isLogin 
              ? "New driver? Register here" 
              : "Already registered? Login"}
          </button>
        </div>
      </div>
    </main>
  );
}
