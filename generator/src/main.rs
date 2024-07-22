use std::{thread, time::Duration};
use rand::Rng;

#[derive(Debug, Clone)]
struct GpsCoordinate {
    id: String,
    latitude: f64,
    longitude: f64,
}

impl GpsCoordinate {
    fn update_coordinate(&self) -> GpsCoordinate {
        let mut rng = rand::thread_rng();
        GpsCoordinate {
            id: self.id.clone(),
            latitude: (self.latitude + rng.gen_range(-0.0001..0.0001)).clamp(40.3, 40.5),
            longitude: (self.longitude + rng.gen_range(-0.0001..0.0001)).clamp(-3.8, -3.6),
        }
    }
}

fn main() {
    let mut users = vec![
        GpsCoordinate { id: "User1".to_string(), latitude: 40.4167, longitude: -3.7038 },
        GpsCoordinate { id: "User2".to_string(), latitude: 40.4200, longitude: -3.7100 },
        GpsCoordinate { id: "User3".to_string(), latitude: 40.4150, longitude: -3.6950 },
        GpsCoordinate { id: "User4".to_string(), latitude: 40.4300, longitude: -3.7200 },
        GpsCoordinate { id: "User5".to_string(), latitude: 40.4100, longitude: -3.6900 },
    ];

    loop {
        for user in &mut users {
            println!("{:?}", user);
            *user = user.update_coordinate();
        }
        println!("---");
        thread::sleep(Duration::from_secs(5));
    }
}