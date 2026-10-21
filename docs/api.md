# API Documentation & Endpoint Specification

All client requests MUST be routed through the Kong API Gateway (`http://localhost:8000/api`).

---

## 1. User Service Endpoints (`/api/users/*`)

### Register User
- **Method:** `POST /api/users/register`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "phone": "+123456789",
    "homeCity": "New York"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com",
    "roles": ["ROLE_USER"]
  }
  ```

### Login
- **Method:** `POST /api/users/login`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "type": "Bearer",
    "userId": 1,
    "email": "john@example.com",
    "roles": ["ROLE_USER"]
  }
  ```

---

## 2. Trip Service Endpoints (`/api/trips/*`, `/api/destinations`)

### Create Trip
- **Method:** `POST /api/trips`
- **Auth:** Protected (JWT Header)
- **Request Body:**
  ```json
  {
    "title": "Golden Triangle Tour",
    "description": "Delhi, Agra, and Jaipur exploration",
    "startDate": "2026-11-01",
    "endDate": "2026-11-07",
    "budget": 1500.0
  }
  ```

### Destination Catalog Search
- **Method:** `GET /api/destinations?category=heritage&query=Taj`
- **Auth:** Public / Protected

---

## 3. Booking Service Endpoints (`/api/bookings/*`)

### Create Booking (Saga Trigger)
- **Method:** `POST /api/bookings`
- **Auth:** Protected (JWT Header)
- **Optional Failure Injection Header:** `X-Simulate-Failure: payment` or `trip-reservation`
- **Request Body:**
  ```json
  {
    "trip_id": 1,
    "booking_type": "HOTEL",
    "title": "Taj Mahal Palace Suite",
    "total_price": 450.0
  }
  ```
- **Response (202 Accepted):**
  ```json
  {
    "message": "Booking process initiated",
    "booking": { "id": 10, "status": "PENDING" },
    "saga_id": "saga-uuid-1234",
    "status": "PENDING"
  }
  ```

### Get Saga Timeline
- **Method:** `GET /api/bookings/{id}/saga`
- **Response (200 OK):**
  ```json
  {
    "saga_id": "saga-uuid-1234",
    "booking_id": 10,
    "status": "COMPLETED",
    "current_step": "CONFIRM_BOOKING",
    "steps": [
      { "step_name": "RESERVE_TRIP_SLOT", "status": "SUCCEEDED" },
      { "step_name": "PAYMENT", "status": "SUCCEEDED" },
      { "step_name": "CONFIRM_BOOKING", "status": "SUCCEEDED" }
    ]
  }
  ```

---

## 4. Recommendation Service (`/api/recommendations/*`)

### Get User Recommendations
- **Method:** `GET /api/recommendations/{userId}`
- **Response (200 OK):** Returns matched destinations with score and human-readable reason.

---

## 5. Route Optimization Service (`/api/routes/*`)

### Optimize Route
- **Method:** `POST /api/routes/optimize`
- **Request Body:**
  ```json
  {
    "source": "Ahmedabad",
    "destinations": ["Udaipur", "Jodhpur", "Jaipur", "Delhi"]
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "optimizedRoute": ["Ahmedabad", "Udaipur", "Jodhpur", "Jaipur", "Delhi"],
    "totalDistance": 850.5,
    "estimatedTravelTime": 14,
    "cached": false
  }
  ```
