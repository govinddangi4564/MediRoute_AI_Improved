"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Clock, MapPin, Hospital, Truck, FileText, CalendarDays } from "lucide-react";

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
  assignedAmbulance?: {
    driverName: string;
    vehicleNumber: string;
  } | null;
}

export default function HospitalHistory() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  const router = useRouter();
  const [hospitalName, setHospitalName] = useState("Hospital Command Center");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  useEffect(() => {
    const token = localStorage.getItem("hospital_token");
    if (!token) {
      router.push("/hospital/login");
      return;
    }

    const storedName = localStorage.getItem("hospital_name");
    if (storedName) setHospitalName(storedName);

    // Fetch historical patients
    fetch(`${apiUrl}/api/dashboard/history`, {
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
      .catch((err) => setError("Failed to fetch patient history"));
  }, [apiUrl, router]);

  const severityColors = {
    low: "bg-green-100 text-green-800 border-green-200",
    moderate: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-orange-100 text-orange-800 border-orange-200",
    critical: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-6 pt-24 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-purple-600" />
              Patient History
            </h1>
            <p className="text-gray-500 mt-1">Records of all admitted patients</p>
          </div>
          <div className="flex items-center gap-4">
             <div className="bg-white px-4 py-2 rounded-lg shadow-sm border flex items-center gap-3">
              <CalendarDays className="text-gray-400" size={20} />
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Total Admitted</p>
                <p className="text-xl font-bold text-gray-900">{patients.length}</p>
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-2">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="font-semibold text-lg text-gray-700">Historical Records</h2>
          </div>
          
          {patients.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300 opacity-50" />
              <p>No patient history found.</p>
              <p className="text-sm mt-1">Patients you mark as "Admitted" will appear here.</p>
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
                        {new Date(patient.createdAt).toLocaleTimeString()} on {new Date(patient.createdAt).toLocaleDateString()}
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
                      {patient.assignedAmbulance && (
                        <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          <Truck size={12} />
                          Driver: {patient.assignedAmbulance.driverName} ({patient.assignedAmbulance.vehicleNumber})
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex shrink-0 w-full md:w-auto mt-2 md:mt-0">
                    <button 
                      onClick={() => setSelectedPatient(patient)}
                      className="w-full md:w-auto px-4 py-2 bg-white border hover:bg-gray-50 text-gray-700 text-sm font-medium rounded transition-colors"
                    >
                      View Details
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
                  <FileText className="text-purple-600" size={20} />
                  Historical Record
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
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize border bg-purple-50 text-purple-700 border-purple-200">
                      Admitted (Resolved)
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
                  
                  {selectedPatient.assignedAmbulance && (
                     <div className="col-span-2">
                       <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1">Assigned Ambulance</p>
                       <p className="text-gray-900 flex items-center gap-1.5 bg-gray-50 p-2 rounded border border-gray-100">
                         <Truck size={16} className="text-gray-500" />
                         {selectedPatient.assignedAmbulance.driverName} (Vehicle: {selectedPatient.assignedAmbulance.vehicleNumber})
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
