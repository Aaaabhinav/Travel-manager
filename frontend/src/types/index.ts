export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string;
  homeCity?: string;
  travelPreferences?: string;
  avatarUrl?: string;
  roles?: string[];
}

export interface AuthResponse {
  token: string;
  type: string;
  userId: number;
  email: string;
  roles: string[];
}

export interface Trip {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  budget: number;
  status: 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  destinations?: Destination[];
  created_at?: string;
}

export interface Destination {
  id: number;
  destination_id?: number; // FK when returned as part of trip_destinations JOIN
  name: string;
  country: string;
  state?: string;
  category: string;
  description: string;
  image_url?: string;
  daily_cost?: number;      // legacy alias
  avg_daily_cost?: number;  // canonical field from DB
  best_season?: string;
  latitude?: number;
  longitude?: number;
}

export interface Booking {
  id: number;
  user_id: number;
  trip_id?: number;
  booking_type: 'HOTEL' | 'TRANSPORT' | 'ACTIVITY';
  title: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLING' | 'CANCELLED' | 'FAILED';
  total_price: number;
  created_at: string;
}

export interface SagaStep {
  step_name: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'COMPENSATED' | 'CANCELLED' | string;
  attempt: number;
  error?: string;
}

export interface SagaTimeline {
  saga_id: string;
  booking_id: number;
  type: string;
  status: 'STARTED' | 'COMPENSATING' | 'COMPLETED' | 'COMPENSATED' | 'COMPENSATION_FAILED' | 'CANCELLED' | 'FAILED' | string;
  current_step: string;
  retry_count: number;
  steps: SagaStep[];
}

export interface Recommendation {
  destination_id: number;
  destination_name: string;
  category: string;
  country: string;
  daily_cost: number;
  score: number;
  reason: string;
  description: string;
}

export interface RouteOptimizationResult {
  optimizedRoute: string[];
  totalDistance: number;
  estimatedTravelTime: number;
  cached: boolean;
}
