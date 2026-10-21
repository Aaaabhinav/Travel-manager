# Database Schemas & Isolation Matrix

## Database-per-Service Architecture

```
User Service           --> MySQL (`user_service_db`)
Trip Service           --> PostgreSQL (`trip_db`)
Booking Service        --> PostgreSQL (`booking_db`)
Recommendation Service --> Apache Cassandra (`travel_recommendations`)
Route Service          --> Redis Cache (In-Memory Key-Value)
```

---

## 1. MySQL Schema (User Service)
- **`users`**: `id`, `email`, `password_hash`, `full_name`, `phone`, `home_city`, `travel_preferences`, `avatar_url`, `created_at`
- **`roles`**: `id`, `name` (`ROLE_USER`, `ROLE_ADMIN`)
- **`user_roles`**: `user_id`, `role_id`

---

## 2. PostgreSQL Schema (Trip Service)
- **`trips`**: `id`, `user_id`, `title`, `description`, `start_date`, `end_date`, `budget`, `status`
- **`destinations`**: `id`, `name`, `country`, `category`, `description`, `image_url`, `daily_cost`
- **`trip_destinations`**: `trip_id`, `destination_id`
- **`trip_reservations`**: `id`, `trip_id`, `booking_id` (UNIQUE), `status` (`RESERVED`, `RELEASED`)

---

## 3. PostgreSQL Schema (Booking Service & Saga Log)
- **`bookings`**: `id`, `user_id`, `trip_id`, `booking_type`, `title`, `status` (`PENDING`, `CONFIRMED`, `CANCELLING`, `CANCELLED`, `FAILED`), `total_price`
- **`saga_instances`**: `id`, `type`, `booking_id`, `status` (`STARTED`, `COMPENSATING`, `COMPLETED`, `COMPENSATED`), `current_step`, `payload`, `retry_count`
- **`saga_steps`**: `saga_id`, `step_name`, `status`, `attempt`, `error`
- **`outbox_events`**: `id`, `event_type`, `payload`, `status` (`PENDING`, `SENT`, `FAILED`), `saga_id`
- **`processed_messages`**: `message_id`, `consumer_id`, `processed_at`

---

## 4. Cassandra CQL Schema (Recommendation Service)
- **`user_preferences`**: Partition Key (`user_id`), set of preferred categories, avg budget.
- **`destination_popularity`**: Partition Key (`destination_id`), counter `booking_count`.
- **`recommendation_history`**: Partition Key (`user_id`), Clustering Key (`recommended_at DESC`).
