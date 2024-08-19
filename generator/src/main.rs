use rand::Rng;
use tokio;
use postgrest::Postgrest;
use serde::{Deserialize, Serialize};
use serde_json::{self, json};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Point {
    id: i32,
    capacity: f32,
    lat: Option<f32>,
    long: Option<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Delivery {
    id: i32,
    unit: i32,
    lat: f32,
    long: f32,
    target_point_id: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct NearbyDelivery {
    id: i32,
    name: i32,
    lat: f32,
    long: f32,
    dist_meters: f32,
}

impl Point {
    fn update_capacity(&mut self) {
        let mut rng = rand::thread_rng();
        self.capacity = ((self.capacity + rng.gen_range(-2.0..0.0)).clamp(0.0, 100.0) * 100.0).round() / 100.0;
    }

    fn restore_capacity(&mut self) {
        self.capacity = 100.0;
    }
}



impl Delivery {
    fn move_towards(&mut self, target: &Point, speed: f32) {
        println!("Moving towards target Father: {}",  self.id);
        if let (Some(target_long), Some(target_lat)) = (target.long, target.lat) {
            println!("Entered if let for id {}", self.id);
            let dx = target_long - self.long;
            let dy = target_lat - self.lat;
            let distance = (dx * dx + dy * dy).sqrt();

            if distance > speed {
                println!("Moving towards target: {} {} {}", target_long, target_lat, self.id);
                // Compute new position
                self.long += dx * speed / distance;
                self.lat += dy * speed / distance;
            } else {
                println!("Reached target: {} {} {}", target_long, target_lat, self.id);
                // Assign target position
                self.long = target_long;
                self.lat = target_lat;
            }
        }
    }

    fn random_move(&mut self) {
        let mut rng = rand::thread_rng();
        self.lat += rng.gen_range(-0.002..0.002);
        self.long += rng.gen_range(-0.002..0.002);
    }
    fn assign_target(&mut self, target: &Point) {
        self.target_point_id = Some(target.id);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv()?;

    let client = Postgrest::new(format!("{}/rest/v1", dotenvy::var("NEXT_PUBLIC_SUPABASE_URL").unwrap()))
        .insert_header("apikey", dotenvy::var("SUPABASE_PUBLIC_API_KEY").unwrap());

    let resp = client.rpc("points", "{}").execute().await?;
    let mut points: Vec<Point> =  serde_json::from_str(&resp.text().await?)?;
    let resp = client.rpc("delivery_units", "{}").execute().await?;
    let mut deliveries: Vec<Delivery> = serde_json::from_str(&resp.text().await?)?;
   
    let mut assigned_deliveries: HashMap<i32, i32> = HashMap::new();

    loop {
        // Update points
        
        
        

        for point in &mut points {
            point.update_capacity();
            
            if point.capacity < 20.0 && !assigned_deliveries.contains_key(&point.id) {
                
                let nearby_resp = client
                    .rpc("nearby_delivery", json!({ "id": point.id }).to_string())
                    .execute()
                    .await?;
                let nearby_deliveries: Vec<NearbyDelivery> = serde_json::from_str(&nearby_resp.text().await?)?;
                
                
                if let Some(nearest) = nearby_deliveries.into_iter().find(|d| !assigned_deliveries.values().any(|&v| v == d.id)) {
                    
                    assigned_deliveries.insert(point.id, nearest.id);
                    println!("Assigned deliveries: {:?}", assigned_deliveries);
                    
                    if let Some(delivery) = deliveries.iter_mut().find(|d| d.id == nearest.id) {
                        
                        delivery.assign_target(point);
                        println!("Deliveries: {:?}", deliveries);
                    } else {
                        println!("Delivery {} not found", nearest.id);
                    }
                }
            }
        }

        
        

        for delivery in &mut deliveries {
            if let Some(target_point_id) = delivery.target_point_id {
                println!("Target point id: {}", target_point_id);
                if let Some(target) = points.iter().find(|p| p.id == target_point_id) {
                    println!("Before move: Delivery {} at ({}, {}), Target at ({}, {})", 
                             delivery.id, delivery.lat, delivery.long, target.lat.unwrap(), target.long.unwrap());
                    
                    delivery.move_towards(target, 0.01);
                    
                    println!("After move: Delivery {} at ({}, {})", 
                             delivery.id, delivery.lat, delivery.long);
                    
                    // Increased tolerance from 1e-5 to 1e-4
                    if (delivery.lat - target.lat.unwrap()).abs() <= 0.0001 && (delivery.long - target.long.unwrap()).abs() <= 0.0001 {
                        println!("Delivery {} reached target point {}", delivery.id, target_point_id);
                        if let Some(point) = points.iter_mut().find(|p| p.id == target_point_id) {
                            point.restore_capacity();
                            
                            // Update the database immediately
                            let update_result = client
                                .from("points")
                                .update(json!({ "capacity": 100.0 }).to_string())
                                .eq("id", point.id.to_string())
                                .execute()
                                .await;
                            
                            match update_result {
                                Ok(_) => println!("Point {} capacity updated to 100%", point.id),
                                Err(e) => eprintln!("Failed to update point {} capacity: {:?}", point.id, e),
                            }
                        }
                        assigned_deliveries.remove(&target_point_id);
                        delivery.target_point_id = None;
                    }
                }
            } else {
                // If the delivery has no target, move randomly

                delivery.random_move()
            }
        }

        // Update database
        for point in &points {
            client
                .from("points")
                .update(json!({ "capacity": point.capacity }).to_string())
                .eq("id", point.id.to_string())
                .execute()
                .await?;
        }

        for delivery in &deliveries {
            client
                .rpc("update_delivery_location", json!({ "loc_id": delivery.id, "lat": delivery.lat, "long": delivery.long }).to_string())
                .execute()
                .await?;
        }

        //println!("Updated Points: {:?}", points);
        //println!("Updated Deliveries: {:?}", deliveries);

        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    }
}