"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hospital, Lock, Mail, MapPin } from "lucide-react";
import Link from "next/link";

export default function HospitalLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const body = isLogin 
      ? { email, password }
      : { email, password, hospitalName, address };

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[var(--accent)] outline-none"
                    placeholder="e.g. 123 Main St, Mumbai"
                  />
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
