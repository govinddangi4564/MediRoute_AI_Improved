"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { Navigation, CheckCircle2, AlertTriangle, Truck, MapPin, Activity, LogOut } from "lucide-react";
import dynamic from "next/dynamic";
import { playAlertSound } from "@/lib/utils";

const MapComponent = dynamic(() => import("../hospitals/map-component"), { ssr: false });

interface Mission {
  _id: string;
  symptoms: string;
  severity: string;
  emergencyLevel: string;
  location?: { coordinates: [number, number] };
  requestedHospital?: { hospitalName: string };
  createdAt: string;
}

export default function AmbulanceDriverView() {
  const router = useRouter();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [mission, setMission] = useState<Mission | null>(null);
  const [openMissions, setOpenMissions] = useState<Mission[]>([]);
  const [driverName, setDriverName] = useState("");
  const [isIndependent, setIsIndependent] = useState(false);
  
  const [isDriving, setIsDriving] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    const token = localStorage.getItem("driver_token");
    const driverId = localStorage.getItem("driver_id");
    if (!token || !driverId) {
      router.push("/ambulance/login");
      return;
    }

    setDriverName(localStorage.getItem("driver_name") || "Driver");
    const independentFlag = localStorage.getItem("is_independent") === "true";
    setIsIndependent(independentFlag);

    // Fetch active mission
    fetch(`${apiUrl}/api/ambulance/mission`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Session expired");
        return res.json();
      })
      .then(data => {
        if (data && data._id) {
          setMission(data);
        }
      })
      .catch(() => {
        localStorage.removeItem("driver_token");
        router.push("/ambulance/login");
      });

    const newSocket = io(apiUrl);
    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("join_driver_room", driverId, independentFlag);
    });

    newSocket.on("new_mission", (newMission: Mission) => {
      setMission(newMission);
      setArrived(false);
      
      // Play alert sound for new mission
      playAlertSound();
    });

    newSocket.on("independent_mission_broadcast", (newMission: Mission) => {
      setOpenMissions(prev => {
        if (prev.some(m => m._id === newMission._id)) return prev;
        return [newMission, ...prev];
      });
      playAlertSound();
    });

    newSocket.on("independent_mission_claimed", ({ patientId }: { patientId: string }) => {
      setOpenMissions(prev => prev.filter(m => m._id !== patientId));
    });

    return () => {
      newSocket.disconnect();
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [apiUrl, router]);

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

        if (socket && mission) {
          socket.emit("update_ambulance_location", {
            patientId: mission._id,
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
    if (socket && mission) {
      socket.emit("ambulance_arrived", mission._id);
      setArrived(true);
      stopDriving();
      // Optional: Clear mission after some time or let backend clear it
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("driver_token");
    localStorage.removeItem("driver_id");
    localStorage.removeItem("driver_name");
    localStorage.removeItem("is_independent");
    router.push("/ambulance/login");
  };

  const claimMission = async (patientId: string) => {
    const token = localStorage.getItem("driver_token");
    try {
      const res = await fetch(`${apiUrl}/api/emergency/${patientId}/driver-claim`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setOpenMissions(prev => prev.filter(m => m._id !== patientId));
      setMission(data.patient);
    } catch (err: any) {
      alert(err.message || "Failed to claim mission");
    }
  };

  const targetLat = mission?.location?.coordinates[1] || null;
  const targetLng = mission?.location?.coordinates[0] || null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 pt-12">
      <div className="w-full max-w-md flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="text-red-600" />
          Hi, {driverName}
        </h1>
        <button onClick={handleLogout} className="text-gray-500 hover:text-red-600 p-2">
          <LogOut size={20} />
        </button>
      </div>

      <div className="bg-white border rounded-2xl p-6 shadow-xl max-w-md w-full">
        {!mission ? (
          <div className="py-6">
            <div className="text-center mb-6">
              <Activity className="mx-auto text-gray-300 mb-2 animate-pulse" size={40} />
              <h2 className="text-xl font-bold text-gray-900 mb-1">Standby</h2>
              <p className="text-gray-500 text-sm">
                {isIndependent ? "Waiting for nearby emergency broadcasts..." : "Waiting for hospital dispatch..."}
              </p>
            </div>

            {isIndependent && openMissions.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 border-b pb-2">Nearby Open Requests</h3>
                {openMissions.map((openMission) => (
                  <div key={openMission._id} className="bg-red-50 border border-red-100 rounded-xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">
                        {openMission.emergencyLevel || "Emergency"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(openMission.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">{openMission.symptoms}</p>
                    {openMission.requestedHospital && (
                      <p className="text-xs text-gray-600 mb-3">
                        Destination: <span className="font-semibold">{openMission.requestedHospital.hospitalName}</span>
                      </p>
                    )}
                    <button 
                      onClick={() => claimMission(openMission._id)}
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
                    >
                      Accept Mission
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b">
              <div className="bg-red-100 p-3 rounded-full text-red-600">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">New Mission</h2>
                <p className="text-sm text-red-600 font-semibold">{mission.emergencyLevel}</p>
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
                <button 
                  onClick={() => { setMission(null); setArrived(false); }}
                  className="mt-6 text-red-600 hover:underline font-medium"
                >
                  Return to Standby
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-xl p-4 border text-sm space-y-3">
                  <div>
                    <span className="text-gray-500 block mb-0.5">Patient Details</span>
                    <span className="font-medium text-gray-900">{mission.symptoms}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block mb-0.5">Destination</span>
                    <span className="font-medium text-gray-900 flex items-center gap-1">
                      <MapPin size={14} className="text-red-500" />
                      Lat: {targetLat?.toFixed(4)}, Lng: {targetLng?.toFixed(4)}
                    </span>
                  </div>
                </div>

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
                        <span className="text-gray-600">Pending Start</span>
                      )}
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
          </>
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
