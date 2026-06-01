"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { MapPin, Navigation, CheckCircle2 } from "lucide-react";

interface AmbulanceTrackingProps {
  targetLat: number;
  targetLng: number;
}

export default function AmbulanceTracking({ targetLat, targetLng }: AmbulanceTrackingProps) {
  const [ambLat, setAmbLat] = useState<number | null>(null);
  const [ambLng, setAmbLng] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);
  const [distance, setDistance] = useState(5.0);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const socket: Socket = io(apiUrl);

    socket.on("connect", () => {
      socket.emit("request_ambulance", { targetLat, targetLng });
    });

    socket.on("ambulance_location", (data: { lat: number; lng: number }) => {
      setAmbLat(data.lat);
      setAmbLng(data.lng);
      
      // Calculate mock distance
      const latDiff = Math.abs(targetLat - data.lat);
      const lngDiff = Math.abs(targetLng - data.lng);
      const approxDist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // rough km
      setDistance(Math.max(0, approxDist));
    });

    socket.on("ambulance_arrived", () => {
      setArrived(true);
      setDistance(0);
    });

    return () => {
      socket.disconnect();
    };
  }, [targetLat, targetLng]);

  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Navigation className="text-blue-600" />
          Live Ambulance Tracking
        </h3>
        {arrived ? (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full flex items-center gap-1">
            <CheckCircle2 size={16} /> Arrived
          </span>
        ) : (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full animate-pulse">
            En Route
          </span>
        )}
      </div>

      <div className="bg-gray-100 rounded-lg h-64 flex items-center justify-center relative overflow-hidden mb-4 border">
        {/* Placeholder for actual Google Map. In a real app, use @react-google-maps/api */}
        <div className="absolute inset-0 bg-[#e5e3df] opacity-50 bg-[url('https://maps.gstatic.com/mapfiles/transparent.png')]"></div>
        
        {/* Destination Marker */}
        <div className="absolute" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <MapPin size={32} className="text-red-600 drop-shadow-md" />
        </div>

        {/* Ambulance Marker */}
        {!arrived && ambLat && ambLng && (
          <div 
            className="absolute transition-all duration-1000 ease-linear"
            style={{ 
              // Simple mapping from lat/lng diff to percentage for mock UI
              top: `${50 + (targetLat - ambLat) * 1000}%`, 
              left: `${50 + (ambLng - targetLng) * 1000}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="bg-white p-2 rounded-full shadow-lg border-2 border-blue-500 relative">
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <Navigation size={20} className="text-blue-600 transform rotate-45" />
            </div>
          </div>
        )}
        
        {arrived && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center">
            <CheckCircle2 size={48} className="text-green-500 mb-2" />
            <p className="font-semibold text-gray-800 text-lg">Ambulance has arrived!</p>
          </div>
        )}
      </div>

      {!arrived && (
        <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div>
            <p className="text-sm text-gray-500">Estimated Distance</p>
            <p className="font-semibold text-lg">{distance.toFixed(1)} km</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Estimated Time</p>
            <p className="font-semibold text-lg">{Math.ceil(distance * 3)} mins</p>
          </div>
        </div>
      )}
    </div>
  );
}
