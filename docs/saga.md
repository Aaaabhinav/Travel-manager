# Saga Pattern & Failure Recovery Documentation

## Overview

Because each microservice has its own isolated database, traditional ACID transactions cannot cross service boundaries. Distributed consistency is guaranteed via the **Saga Pattern**.

---

## 1. Booking Creation Saga (Orchestrated)

Coordinator: **Go Booking Service**

| Step # | Action Name | Participant | Forward Action | Compensating Action (on failure) |
|--------|-------------|-------------|----------------|----------------------------------|
| 1 | Create Pending Booking | Booking Service | Insert `bookings` (`PENDING`) + `saga_instances` | Update status to `FAILED` |
| 2 | Reserve Trip Slot | Trip Service | Insert `trip_reservations` (`RESERVED`) | Publish `ReleaseTripSlot` command → status `RELEASED` |
| 3 | Process Payment | Booking Service | Record payment attempt (`SUCCESS`) | Record refund entry (`REFUNDED`) |
| 4 | Confirm Booking | Booking Service | Update booking `CONFIRMED`, saga `COMPLETED` | N/A (Retry until terminal) |

---

## 2. Failure & Compensation Flow (Payment Failure Scenario)

```
[Client] ---> POST /api/bookings
[Booking Service] ---> [DB] Status PENDING, Saga STARTED
[Booking Service] ---ReserveTripSlot command---> [RabbitMQ] ---> [Trip Service]
[Trip Service]    ---> [DB] Reservation RESERVED
[Trip Service]    ---TripSlotReserved reply---> [RabbitMQ] ---> [Booking Service]
[Booking Service] ---> Payment FAILED (or header X-Simulate-Failure: payment)
[Booking Service] ---> Saga Status set to COMPENSATING
[Booking Service] ---ReleaseTripSlot command---> [RabbitMQ] ---> [Trip Service]
[Trip Service]    ---> [DB] Reservation RELEASED
[Trip Service]    ---TripSlotReleased reply---> [RabbitMQ] ---> [Booking Service]
[Booking Service] ---> [DB] Booking status FAILED, Saga status COMPENSATED
```

---

## 3. Demonstration & Failure Injection Instructions

1. **Happy Path Testing:**
   - Create a booking via UI or `POST /api/bookings`.
   - Observe real-time status transitions: `PENDING` → `CONFIRMED`.
   - Click "Saga Timeline" to view execution steps.

2. **Simulated Payment Failure Compensation:**
   - In Bookings UI, select "Simulate Payment Failure" in the failure injection dropdown (or pass header `X-Simulate-Failure: payment`).
   - The Trip Service will reserve the slot, payment will fail, and the compensator will automatically issue `ReleaseTripSlot`.
   - Booking ends as `FAILED`, Saga ends as `COMPENSATED`, and slot is released.

3. **Trip Deletion Saga (Choreographed):**
   - Delete a trip from the UI.
   - Trip Service publishes `TripDeleted`.
   - Booking Service consumes `TripDeleted` and automatically cancels all active bookings tied to that trip.
