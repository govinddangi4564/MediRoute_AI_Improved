"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Navigation, CheckCircle2, AlertTriangle, Truck } from "lucide-react";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("../hospitals/map-component"), { ssr: false });

export default function AmbulanceDriverView() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patientId");
  const targetLatParam = searchParams.get("targetLat");
  const targetLngParam = searchParams.get("targetLng");
  
  const targetLat = targetLatParam ? parseFloat(targetLatParam) : null;
  const targetLng = targetLngParam ? parseFloat(targetLngParam) : null;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [isDriving, setIsDriving] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!patientId) {
      setError("No patient ID provided in URL.");
      return;
    }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const newSocket = io(apiUrl);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [patientId]);

  const startDriving = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsDriving(true);
    setError("");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });

        if (socket && patientId) {
          socket.emit("update_ambulance_location", {
            patientId,
            lat: latitude,
            lng: longitude,
          });
        }
      },
      (err) => {
        setError(`Location error: ${err.message}`);
        setIsDriving(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  };

  const stopDriving = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsDriving(false);
  };

  const markArrived = () => {
    if (socket && patientId) {
      socket.emit("ambulance_arrived", patientId);
      setArrived(true);
      stopDriving();
    }
  };

  if (!patientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-xl shadow text-center max-w-sm w-full">
          <AlertTriangle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid Link</h2>
          <p className="text-gray-500 text-sm">Please make sure you accessed this page from the Hospital Dashboard dispatch link.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white border rounded-2xl p-6 shadow-xl max-w-md w-full">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <div className="bg-red-100 p-3 rounded-full text-red-600">
            <Truck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Driver Dashboard</h1>
            <p className="text-sm text-gray-500">Broadcasting live location to patient</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {arrived ? (
          <div className="text-center py-8">
            <div className="bg-green-100 text-green-600 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Mission Complete</h2>
            <p className="text-gray-500">You have successfully arrived at the destination.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 border flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <p className="font-semibold flex items-center gap-2">
                  {isDriving ? (
                    <span className="text-blue-600 flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                      </span>
                      Broadcasting Location
                    </span>
                  ) : (
                    <span className="text-gray-600">Standby</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Coordinates</p>
                <p className="font-mono text-xs text-gray-700">
                  {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Unknown"}
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {!isDriving ? (
                <button
                  onClick={startDriving}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-lg"
                >
                  <Navigation size={20} />
                  Start Driving
                </button>
              ) : (
                <>
                  <button
                    onClick={markArrived}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    <CheckCircle2 size={24} />
                    Mark as Arrived
                  </button>
                  <button
                    onClick={stopDriving}
                    className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-xl transition-all"
                  >
                    Pause Broadcasting
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Map Section for Driver */}
      {location && targetLat && targetLng && !arrived && (
        <div className="w-full max-w-md mt-6 h-80 rounded-2xl overflow-hidden border shadow-xl relative bg-gray-100">
          <MapComponent 
            targetLat={targetLat} 
            targetLng={targetLng} 
            ambLat={location.lat} 
            ambLng={location.lng} 
          />
        </div>
      )}
    </div>
  );
}
