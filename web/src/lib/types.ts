export type Role = "customer" | "driver" | "admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone?: string | null;
  photo?: string | null;
  rating?: number;
  vehicle?: string | null;
  plate?: string | null;
  color?: string | null;
  online?: boolean;
  approval_status?: string;
  email_verified?: boolean;
  vehicle_class?: string | null;
  vehicle_class_label?: string | null;
}

export interface Place {
  label: string;
  lat: number;
  lng: number;
  airport?: boolean;
  iata?: string;
}

export interface Offer {
  id: string;
  ride_id: string;
  driver: any;
  fare: number;
  eta_minutes: number;
}

export interface Ride {
  id: string;
  status: string;
  pickup: Place;
  destination: Place;
  stops: Place[];
  when: string;
  scheduled_time?: string | null;
  passengers: number;
  bags: number;
  required_class?: string;
  required_class_label?: string;
  recommended_fare: number;
  fare_min: number;
  fare_max: number;
  distance_miles?: number;
  duration_min?: number;
  assigned_driver?: any;
  final_fare?: number | null;
  tip?: number;
  start_pin?: string;
  cancellation_fee?: number;
  customer_name?: string;
  customer_rating?: number;
  created_at?: number;
}
