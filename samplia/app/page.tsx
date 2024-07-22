"use client"
import Image from "next/image";
import Samplia from "./../components/Samplia.svg"
import { createClient } from "@/utils/supabase/client";

import Header from "@/components/Header";
import Map, { Marker, Popup } from 'react-map-gl'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { default as layers } from 'protomaps-themes-base'
import { Protocol } from 'pmtiles'
import { useEffect, useState } from "react";
import wkx from 'wkx';


export default function Index() {

  interface Point {
    
    id: number;
    name: string;
    address: string;
    latitude: number; 
    longitude: number;
    capacity: number;
  }
  const [points, setPoints] = useState<Point[]>([])
  const supabase = createClient()
 
  useEffect(() => {
    let protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    return () => {
      maplibregl.removeProtocol('pmtiles')
    }

    
  }, [])

  useEffect(() => {
    console.log("Fetching data")
      supabase.from('points').select('*').then(({data, error}) => {
        if (error) {
          console.error("Error fetching data:", error);
        } else {
          console.log(data)
          const formattedPoints = data?.map(point => {
            const geometry = wkx.Geometry.parse(Buffer.from(point.location, 'hex')) as wkx.Point;
            return {
              ...point,
              longitude: geometry.x,
              latitude: geometry.y
            };
          }) || [];
          setPoints(formattedPoints);
        }
      })
      
}, []);

  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);

  const handleMarkerClick = (point: Point) => {
    setSelectedPoint(point);
  };

  const getCapacityColor = (capacity: number) => {
    return capacity < 15 ? 'text-red-500 font-bold' : 'text-green-500';
  };

  const CustomMarker = ({ onClick }: { onClick: () => void }) => (
    <div onClick={onClick} className="cursor-pointer">
      <Image
        src="/samplia_logo.png"
        width={30}
        height={30}
        alt="Marker"
      />
    </div>
  );

  return (
    <div className="flex-1 w-full flex flex-col gap-20 items-center">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-4xl flex justify-between items-center p-3 text-sm">
        <Image src={Samplia} height={100} width={100} alt="Samplia" />
        </div>
      </nav>

      <div className="flex-1 flex flex-col  max-w-4xl px-3">
        <Header />
        <main className="flex-1 flex flex-col gap-6">
        <Map
        style={{ width: 800, height: 600 }}
        
        initialViewState={{
          longitude: -3.7038,  // Madrid's longitude
          latitude: 40.4168,   // Madrid's latitude
          zoom: 11             // Adjust zoom level as needed
        }}
        maxBounds={[
          
          [-3.949585,40.267476],  // Southwest coordinates
          [-3.251266,40.611867]   // Northeast coordinates
        ]}
        mapStyle={{
          version: 8,
          glyphs:
            'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
          sources: {
            protomaps: {
              attribution:
                '<a href="https://github.com/protomaps/basemaps">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
              type: 'vector',
              url: 'pmtiles://https://ndzndxkibueqnrwarjlu.supabase.co/storage/v1/object/public/madrid/madrid.pmtiles?t=2024-07-22T12%3A02%3A02.740Z',
            },
          },
          // @ts-ignore
          layers: layers('protomaps', 'light'),
        }}
        // @ts-ignore
        mapLib={maplibregl}
        >
          {points.map((point) => (
            <Marker 
              key={point.id} 
              longitude={point.longitude} 
              latitude={point.latitude} 
              color={point.capacity < 15 ? "red" : "blue"} 
              onClick={() => handleMarkerClick(point)}   
            >
              <CustomMarker onClick={() => handleMarkerClick(point)} />
            </Marker>
          ))}
          
          {selectedPoint && (
            <Popup
              longitude={selectedPoint.longitude}
              latitude={selectedPoint.latitude}
              onClose={() => setSelectedPoint(null)}
              closeOnClick={false}
            >
              <div>
                <h3 className="font-bold">{selectedPoint.name}</h3>
                <p>{selectedPoint.address}</p>
                <p className={getCapacityColor(selectedPoint.capacity)}>
                  Capacity: {selectedPoint.capacity}%
                </p>
              </div>
            </Popup>
          )}
        </Map>

    

        </main>
      </div>

      <footer className="w-full border-t border-t-foreground/10 p-8 flex justify-center text-center text-xs">
        <p>
          Powered by{" "}
          <a
            href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
            target="_blank"
            className="font-bold hover:underline"
            rel="noreferrer"
          >
            Supabase
          </a>
        </p>
      </footer>
    </div>
  );
}
       