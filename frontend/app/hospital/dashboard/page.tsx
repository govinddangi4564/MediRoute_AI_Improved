"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import { AlertTriangle, Clock, Activity, ExternalLink, Hospital, MapPin, LogOut, Truck } from "lucide-react";

interface Patient {
  _id: string;
  symptoms: string;
  severity: "low" | "moderate" | "high" | "critical";
  emergencyLevel: string;
  possibleDisease: string;
  department: string;
  status: string;
  createdAt: string;
  requestedHospital?: {
    _id: string;
    hospitalName: string;
  } | null;
  requestedHospitalName?: string;
  location?: {
    coordinates: [number, number];
  };
}

export default function HospitalDashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  const router = useRouter();
  const [hospitalName, setHospitalName] = useState("Hospital Command Center");
  const [availableBeds, setAvailableBeds] = useState(0);
  const [isUpdatingBeds, setIsUpdatingBeds] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    const token = localStorage.getItem("hospital_token");
    if (!token) {
      router.push("/hospital/login");
      return;
    }

    const storedName = localStorage.getItem("hospital_name");
    if (storedName) setHospitalName(storedName);

    // Fetch hospital details
    fetch(`${apiUrl}/api/auth/me`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.availableBeds !== undefined) {
          setAvailableBeds(data.availableBeds);
        }
      })
      .catch(err => console.error("Failed to fetch hospital details", err));

    // Fetch initial patients
    fetch(`${apiUrl}/api/dashboard/patients`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem("hospital_token");
          router.push("/hospital/login");
          throw new Error("Session expired");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setPatients(data);
        }
      })
      .catch((err) => setError("Failed to fetch patients"));

    // Connect socket
    const socket: Socket = io(apiUrl);

    socket.on("connect", () => {
      setIsConnected(true);
      const hospitalId = localStorage.getItem("hospital_id");
      if (hospitalId) {
        socket.emit("join_hospital_room", hospitalId);
      }
    });
    
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("new_emergency", (patient: Patient) => {
      setPatients((prev) => [patient, ...prev]);
      
      // Play alert sound for critical/high severity
      if (patient.severity === "critical" || patient.severity === "high") {
        try {
          const audio = new Audio("/alert.mp3");
          audio.play().catch(e => console.log("Audio play blocked", e));
        } catch (e) {
          // Ignore audio errors
        }
      }
    });

    socket.on("emergency_accepted", ({ patientId, hospitalId: acceptedByHospitalId }) => {
      const myHospitalId = localStorage.getItem("hospital_id");
      
      setSelectedPatient(prev => {
        if (prev && prev._id === patientId && myHospitalId !== acceptedByHospitalId) {
          // Patient was accepted by someone else, close the modal
          return null; 
        }
        // If it was accepted by us, we might want to update the status in the modal
        if (prev && prev._id === patientId && myHospitalId === acceptedByHospitalId) {
          return { ...prev, status: 'assigned' };
        }
        return prev;
      });

      setPatients((prev) => {
        if (myHospitalId === acceptedByHospitalId) {
          return prev.map(p => p._id === patientId ? { ...p, status: 'assigned' } : p);
        } else {
          return prev.filter(p => p._id !== patientId);
        }
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [apiUrl, router]);

  const handleLogout = () => {
    localStorage.removeItem("hospital_token");
    localStorage.removeItem("hospital_name");
    router.push("/hospital/login");
  };

  const updateBeds = async (newCount: number) => {
    if (newCount < 0) return;
    setIsUpdatingBeds(true);
    const token = localStorage.getItem("hospital_token");
    try {
      const res = await fetch(`${apiUrl}/api/auth/beds`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ availableBeds: newCount })
      });
      if (res.ok) {
        setAvailableBeds(newCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingBeds(false);
    }
  };

  const acceptEmergency = async (patientId: string) => {
    const token = localStorage.getItem("hospital_token");
    try {
      const res = await fetch(`${apiUrl}/api/emergency/${patientId}/accept`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.message === 'Emergency already claimed') {
          // Someone else got it just before us
          setPatients(prev => prev.filter(p => p._id !== patientId));
          setSelectedPatient(prev => (prev?._id === patientId ? null : prev));
          setError("This emergency was just claimed by another hospital.");
          return;
        }
        throw new Error(data.message);
      }
      // The socket event will update the UI for success
    } catch (err: any) {
      setError(err.message || "Failed to accept emergency");
    }
  };

  const ambulanceDispatchUrl = (patient: Patient) => {
    const coords = patient.location?.coordinates;
    const target = coords ? `&targetLat=${coords[1]}&targetLng=${coords[0]}` : "";
    return `/ambulance?patientId=${patient._id}${target}`;
  };

  const severityColors = {
    low: "bg-green-100 text-green-800 border-green-200",
    moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    critical: "bg-red-100 text-red-800 border-red-200 animate-pulse",
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 pt-24 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="text-blue-600" />
              {hospitalName}
            </h1>
            <p className="text-gray-500 mt-1">Live incoming patient triage feed</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white p-2 rounded-lg shadow-sm border text-center flex items-center gap-3">
              <div className="text-left">
                <p className="text-xs text-gray-500 uppercase font-semibold">ICU Beds</p>
                <p className="text-xl font-bold text-green-600">{availableBeds}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button 
                  onClick={() => updateBeds(availableBeds + 1)}
                  disabled={isUpdatingBeds}
                  className="bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded text-gray-700 text-xs font-bold disabled:opacity-50"
                >+</button>
                <button 
                  onClick={() => updateBeds(availableBeds - 1)}
                  disabled={isUpdatingBeds || availableBeds <= 0}
                  className="bg-gray-100 hover:bg-gray-200 px-2 py-0.5 rounded text-gray-700 text-xs font-bold disabled:opacity-50"
                >-</button>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-2 ${isConnected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              {isConnected ? "Live Connected" : "Disconnected"}
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100 border-l-4 border-l-red-500">
            <h3 className="text-red-800 font-semibold mb-1">Critical / High</h3>
            <p className="text-3xl font-bold">{patients.filter(p => p.severity === 'critical' || p.severity === 'high').length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-yellow-100 border-l-4 border-l-yellow-500">
            <h3 className="text-yellow-800 font-semibold mb-1">Moderate</h3>
            <p className="text-3xl font-bold">{patients.filter(p => p.severity === 'moderate').length}</p>
          </div>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-green-100 border-l-4 border-l-green-500">
            <h3 className="text-green-800 font-semibold mb-1">Low</h3>
            <p className="text-3xl font-bold">{patients.filter(p => p.severity === 'low').length}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="font-semibold text-lg">Active Emergencies</h2>
            <span className="text-sm text-gray-500">{patients.length} total patients</span>
          </div>
          
          {patients.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <Activity size={48} className="mx-auto mb-4 text-gray-300 opacity-50" />
              <p>No active emergencies at the moment.</p>
              <p className="text-sm mt-1">Waiting for incoming triage requests...</p>
            </div>
          ) : (
            <div className="divide-y">
              {patients.map((patient) => (
                <div key={patient._id} className="p-5 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border ${severityColors[patient.severity]}`}>
                        {patient.severity}
                      </span>
                      <span className="font-semibold text-gray-900">{patient.emergencyLevel}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(patient.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-gray-700 text-sm line-clamp-2">
                      <span className="font-medium text-gray-900">Symptoms:</span> {patient.symptoms}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Activity size={14} className="text-blue-500" />
                        {patient.possibleDisease}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={14} className="text-red-400" />
                        {patient.department}
                      </span>
                    </div>
                    {(patient.requestedHospital?.hospitalName || patient.requestedHospitalName) && (
                      <div className="inline-flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                        <Hospital size={13} />
                        Patient requested: {patient.requestedHospital?.hospitalName || patient.requestedHospitalName}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex shrink-0 gap-2 w-full md:w-auto mt-2 md:mt-0">
                    {patient.status === 'pending' ? (
                      <button 
                        onClick={() => acceptEmergency(patient._id)}
                        className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                      >
                        Accept & Dispatch
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2 min-w-[120px]">
                        <button 
                          disabled
                          className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded opacity-80 cursor-not-allowed"
                        >
                          Accepted
                        </button>
                        <a
                          href={ambulanceDispatchUrl(patient)}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full px-4 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-sm font-medium rounded transition-colors text-center flex items-center justify-center gap-1"
                        >
                          <Truck size={14} />
                          Open Ambulance Dispatch
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                    <button 
                      onClick={() => setSelectedPatient(patient)}
                      className="flex-1 md:flex-none px-4 py-2 bg-white border hover:bg-gray-50 text-gray-700 text-sm font-medium rounded transition-colors"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Patient Details Modal */}
        {selectedPatient && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="text-blue-600" size={20} />
                  Emergency Details
                </h2>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Patient ID</p>
                    <p className="text-gray-900 text-sm font-mono truncate" title={selectedPatient._id}>{selectedPatient._id}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Status</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize border ${selectedPatient.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                      {selectedPatient.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Severity</p>
                    <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border ${severityColors[selectedPatient.severity]}`}>
                      {selectedPatient.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Emergency Level</p>
                    <p className="text-gray-900 font-medium">{selectedPatient.emergencyLevel}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Department</p>
                    <p className="text-gray-900 flex items-center gap-1.5">
                      <MapPin size={16} className="text-red-400" />
                      {selectedPatient.department}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Possible Disease</p>
                    <p className="text-gray-900 flex items-center gap-1.5">
                      <Activity size={16} className="text-blue-500" />
                      {selectedPatient.possibleDisease}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Symptoms</p>
                    <p className="text-gray-900 bg-gray-50 p-3 rounded-lg border border-gray-100">{selectedPatient.symptoms}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Reported At</p>
                    <p className="text-gray-900 flex items-center gap-1.5">
                      <Clock size={16} className="text-gray-400" />
                      {new Date(selectedPatient.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedPatient.location?.coordinates && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Location Coordinates</p>
                      <p className="text-gray-900 font-mono text-sm bg-gray-50 p-2 rounded border border-gray-100 inline-block">
                        Lat: {selectedPatient.location.coordinates[1]}, Lng: {selectedPatient.location.coordinates[0]}
                      </p>
                    </div>
                  )}
                  {(selectedPatient.requestedHospital?.hospitalName || selectedPatient.requestedHospitalName) && (
                     <div className="col-span-2">
                       <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Requested Hospital</p>
                       <p className="text-gray-900 flex items-center gap-1.5 bg-blue-50/50 p-2 rounded border border-blue-100">
                         <Hospital size={16} className="text-blue-500" />
                         {selectedPatient.requestedHospital?.hospitalName || selectedPatient.requestedHospitalName}
                       </p>
                     </div>
                  )}
                </div>
              </div>
              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
                <button 
                  onClick={() => setSelectedPatient(null)}
                  className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-sm font-medium rounded transition-colors"
                >
                  Close
                </button>
                {selectedPatient.status === 'pending' && (
                  <button 
                    onClick={() => {
                      acceptEmergency(selectedPatient._id);
                      setSelectedPatient(null);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
                  >
                    Accept & Dispatch
                  </button>
                )}
                {selectedPatient.status !== 'pending' && (
                  <a
                    href={ambulanceDispatchUrl(selectedPatient)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
                  >
                    <Truck size={16} />
                    Ambulance Dispatch
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
