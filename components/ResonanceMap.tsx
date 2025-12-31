
import React, { useEffect, useRef, useState } from 'react';
import { CircleRoom, LatLng } from '../types';

interface Props {
  circles: CircleRoom[];
  onSelectCircle: (circle: CircleRoom) => void;
  activeLatLng: LatLng;
  selectedCircleId?: string | null;
}

const ResonanceMap: React.FC<Props> = ({ circles, onSelectCircle, activeLatLng, selectedCircleId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const loadLeaflet = async () => {
      // @ts-ignore
      const L = await import('https://esm.sh/leaflet@1.9.4');
      if (!mapRef.current) return;

      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: true,
        fadeAnimation: true,
        zoomAnimation: true
      }).setView([activeLatLng.lat, activeLatLng.lng], 12);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        opacity: 0.95
      }).addTo(map);

      leafletRef.current = { L, map, markers: new Map() };
      setIsLoaded(true);
    };

    loadLeaflet();
    return () => {
      if (leafletRef.current?.map) leafletRef.current.map.remove();
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !leafletRef.current) return;
    const { L, map, markers } = leafletRef.current;

    markers.forEach((m: any) => m.remove());
    markers.clear();

    circles.forEach(circle => {
      if (!circle.location) return;
      const { lat, lng } = circle.location.latlng;
      const memberCount = circle.members.length;
      const isSelected = selectedCircleId === circle.id;
      
      const customIcon = L.divIcon({
        className: 'custom-resonance-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute w-14 h-14 bg-serene/10 rounded-full animate-pulse" style="animation-duration: 4s"></div>
            <div class="w-5 h-5 ${isSelected ? 'bg-white border-serene border-4 scale-125' : 'bg-serene'} rounded-full shadow-[0_0_20px_rgba(59,130,246,0.6)] transition-all duration-700"></div>
            ${memberCount > 0 ? `<span class="absolute -top-4 -right-4 bg-accent text-white text-[9px] font-mono px-2 py-1 border border-white/20 font-bold">${memberCount}</span>` : ''}
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
      marker.on('click', () => {
        onSelectCircle(circle);
      });
      markers.set(circle.id, marker);
    });
  }, [circles, isLoaded, selectedCircleId]);

  useEffect(() => {
    if (isLoaded && leafletRef.current) {
      leafletRef.current.map.flyTo([activeLatLng.lat, activeLatLng.lng], 13, {
        animate: true,
        duration: 2
      });
    }
  }, [activeLatLng, isLoaded]);

  return (
    <div className="relative h-[500px] w-full brutalist-border overflow-hidden bg-accent group shadow-2xl">
      <div ref={mapRef} className="w-full h-full z-10 grayscale-[0.2] hover:grayscale-0 transition-all duration-1000" />
      
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-2 pointer-events-none">
        <span className="font-mono text-[10px] uppercase tracking-[0.6em] bg-accent/95 backdrop-blur-md text-white px-5 py-3 border border-white/10 shadow-xl">
          Resonance Field: Active
        </span>
        <div className="flex gap-2 bg-serene/10 backdrop-blur-sm px-4 py-2 border border-serene/20">
          <div className="w-2 h-2 bg-serene rounded-full animate-ping"></div>
          <span className="text-[8px] font-mono text-serene uppercase tracking-widest font-bold">Synchronized Collective</span>
        </div>
      </div>

      <div className="absolute bottom-6 right-6 z-20 pointer-events-none opacity-40">
        <div className="text-right">
          <p className="text-[9px] font-mono text-white uppercase tracking-widest">Aura Density Tracking</p>
          <p className="text-[12px] font-mono text-serene font-bold tracking-tighter">COORD: {activeLatLng.lat.toFixed(4)}, {activeLatLng.lng.toFixed(4)}</p>
        </div>
      </div>

      <div className="absolute inset-0 z-0 pointer-events-none border-[1px] border-white/5"></div>
    </div>
  );
};

export default ResonanceMap;
