"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Navigation, CheckCircle2 } from "lucide-react";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("./map-component"), { ssr: false });

interface AmbulanceTrackingProps {
  targetLat: number;
  targetLng: number;
}

export default function AmbulanceTracking({ targetLat, targetLng }: AmbulanceTrackingProps) {
  const [ambLat, setAmbLat] = useState<number | null>(null);
  const [ambLng, setAmbLng] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [distance, setDistance] = useState(5.0);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    const socket: Socket = io(apiUrl);

    socket.on("connect", () => {
      const savedAnalysis = localStorage.getItem("lifelineAnalysis");
      if (savedAnalysis) {
        try {
          const parsed = JSON.parse(savedAnalysis);
          if (parsed.patientId) {
            socket.emit("join_patient_room", parsed.patientId);
          }
        } catch (e) {}
      }
    });

    socket.on("ambulance_dispatched", () => {
      setDispatched(true);
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
        ) : dispatched ? (
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full animate-pulse">
            En Route
          </span>
        ) : (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-sm font-medium rounded-full animate-pulse">
            Waiting for Dispatch
          </span>
        )}
      </div>

      <div className="bg-gray-100 rounded-lg h-80 flex items-center justify-center relative overflow-hidden mb-4 border">
        <MapComponent 
          targetLat={targetLat} 
          targetLng={targetLng} 
          ambLat={ambLat} 
          ambLng={ambLng} 
        />
        
        {arrived && (
          <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-50">
            <CheckCircle2 size={48} className="text-green-500 mb-2" />
            <p className="font-semibold text-gray-800 text-lg">Ambulance has arrived!</p>
          </div>
        )}
      </div>

      {!arrived && dispatched && (
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
