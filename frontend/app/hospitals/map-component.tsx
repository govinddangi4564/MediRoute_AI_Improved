"use client";

interface MapProps {
  targetLat: number;
  targetLng: number;
  ambLat: number | null;
  ambLng: number | null;
}

export default function MapComponent({ targetLat, targetLng, ambLat, ambLng }: MapProps) {
  const mapUrl = ambLat && ambLng
    ? `https://maps.google.com/maps?saddr=${ambLat},${ambLng}&daddr=${targetLat},${targetLng}&dirflg=d&output=embed`
    : `https://maps.google.com/maps?q=${targetLat},${targetLng}&z=15&output=embed`;

  const externalMapUrl = ambLat && ambLng
    ? `https://www.google.com/maps/dir/?api=1&origin=${ambLat},${ambLng}&destination=${targetLat},${targetLng}&travelmode=driving`
    : `https://www.google.com/maps/search/?api=1&query=${targetLat},${targetLng}`;

  return (
    <div className="relative w-full h-full group">
      <iframe 
        src={mapUrl} 
        className="w-full h-full border-0" 
        title="Google Map Route"
        loading="lazy"
      />
      <a 
        href={externalMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 bg-white/95 hover:bg-white text-blue-700 px-4 py-2 rounded-lg shadow-md text-sm font-semibold flex items-center gap-2 border border-gray-200 transition-all z-10 opacity-90 hover:opacity-100"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Full View
      </a>
    </div>
  );
}
