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
  interface Delivery {
    id: number,
    name: string,
    latitude: number,
    longitude: number,
  }
  const [points, setPoints] = useState<Point[]>([])
  const [delivery, setDelivery] = useState<Delivery[]>([])
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const supabase = createClient()
 
  useEffect(() => {
    let protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)
    return () => {
      maplibregl.removeProtocol('pmtiles')
    }



    
  }, [])

  useEffect(() => {
    console.log("Fetching points")
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
              latitude: geometry.y,
              capacity: point.capacity
            };
          }) || [];
          setPoints(formattedPoints);
        }
      })

      


      supabase.from('delivery_location').select(`unit, delivery_unit(name), location`).then(({data, error}) => {
        if (error) {
          console.error("Error fetching data:", error);
        } else {
          console.log("Delivery data:", data)
          const formattedDelivery = data?.map(delivery => {
            const geometry = wkx.Geometry.parse(Buffer.from(delivery.location, 'hex')) as wkx.Point;
            return {
              id: delivery.unit,
              name: (delivery.delivery_unit as any).name,
              capacity: delivery.unit,
              longitude: geometry.x,
              latitude: geometry.y
            };
          }) || [];
          setDelivery(formattedDelivery);
        }
      })

      const subs = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'delivery_location',
        },
        (payload) => {
          

          const geometry = wkx.Geometry.parse(Buffer.from(payload.new.location, 'hex')) as wkx.Point;

          setDelivery(prevDeliveries => prevDeliveries.map(prevDelivery => {
            if (prevDelivery.id === payload.new.id) {
              return {
                ...prevDelivery,
                longitude: geometry.x,
                latitude: geometry.y
              };
            }
            return prevDelivery;
          }));
          

        
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'points',
        },
        (payload) => {
          
          setPoints(prevPoints => prevPoints.map(prevPoint => {
            if (prevPoint.id === payload.new.id) {
              return {
                ...prevPoint,
                capacity: payload.new.capacity
              };
            }
            return prevPoint;
          })); 
        }
      )
      .subscribe()
    

    return () => {
      subs.unsubscribe()
      
    }
      
}, []);

  const handleMarkerClick = (point: Point) => {
    setSelectedPointId(point.id);
  };

  const handleDeliveryClick = (delivery: Delivery) => {
    setSelectedDelivery(delivery);
  };

  const getCapacityColor = (capacity: number) => {
    return capacity < 15 ? 'text-red-500 font-bold' : 'text-green-500';
  };

  const CustomMarker = ({ onClick, isDelivery }: { onClick: () => void, isDelivery: boolean }) => (
    <div onClick={onClick} className="cursor-pointer">
      <Image
        src={isDelivery ? "/truck.svg" : "/samplia_logo.png"}
        width={30}
        height={30}
        alt={isDelivery ? "Delivery Marker" : "Point Marker"}
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

      <div className="flex-1 flex flex-col w-full max-w-4xl px-3">
        <Header />
        <main className="flex-1 flex flex-col gap-6">
        <div className="w-full h-[70vh] md:h-[80vh] lg:h-[600px] rounded-lg overflow-hidden">
          <Map
          style={{ width: '100%', height: '100%' }}
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
              >
                <CustomMarker onClick={() => handleMarkerClick(point)} isDelivery={false} />
              </Marker>
            ))}
            
            {selectedPointId && (
              <Popup
                longitude={points.find(p => p.id === selectedPointId)?.longitude || 0}
                latitude={points.find(p => p.id === selectedPointId)?.latitude || 0}
                onClose={() => setSelectedPointId(null)}
                closeOnClick={false}
                closeButton={false}
                anchor="bottom"
                offset={[0, -15]}
                className="bg-transparent shadow-none"
              >
                <div className="bg-white/90 p-4 rounded-lg max-w-[200px] backdrop-blur-sm">
                  <h3 className="font-bold text-lg mb-2">{points.find(p => p.id === selectedPointId)?.name || ''}</h3>
                  <p className="text-sm mb-2">{points.find(p => p.id === selectedPointId)?.address || ''}</p>
                  <p className={`text-sm ${getCapacityColor(points.find(p => p.id === selectedPointId)?.capacity || 0)}`}>
                    Capacity: {points.find(p => p.id === selectedPointId)?.capacity || 0}%
                  </p>
                  <button 
                    className="mt-3 text-xs text-blue-500 hover:text-blue-700"
                    onClick={() => setSelectedPointId(null)}
                  >
                    Close
                  </button>
                </div>
              </Popup>
            )}
            {delivery.map((del) => (
              <Marker 
                key={del.id} 
                longitude={del.longitude} 
                latitude={del.latitude}
              >
                <CustomMarker onClick={() => handleDeliveryClick(del)} isDelivery={true} />
              </Marker>
            ))}
            {selectedDelivery && (
              <Popup
                longitude={selectedDelivery.longitude}
                latitude={selectedDelivery.latitude}
                onClose={() => setSelectedDelivery(null)}
                closeOnClick={false}
                closeButton={false}
                anchor="bottom"
                offset={[0, -15]}
                className="bg-transparent shadow-none"
              >
                <div className="bg-white/90 p-4 rounded-lg max-w-[200px] backdrop-blur-sm">
                  <h3 className="font-bold text-lg mb-2">{selectedDelivery.name}</h3>
                  <p className="text-sm">Delivery Unit ID: {selectedDelivery.id}</p>
                  <button 
                    className="mt-3 text-xs text-blue-500 hover:text-blue-700"
                    onClick={() => setSelectedDelivery(null)}
                  >
                    Close
                  </button>
                </div>
              </Popup>
            )}
          </Map>
        </div>

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
       