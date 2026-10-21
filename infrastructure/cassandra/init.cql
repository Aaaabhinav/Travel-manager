-- Cassandra init script for Recommendation Service

CREATE KEYSPACE IF NOT EXISTS recommendation_service
WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE recommendation_service;

-- User preferences (query: get preferences by user_id)
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id bigint,
    preferred_categories set<text>,
    budget_range text,
    preferred_seasons set<text>,
    visited_destinations set<text>,
    updated_at timestamp,
    PRIMARY KEY (user_id)
);

-- Destination activities (query: get activities by destination)
CREATE TABLE IF NOT EXISTS destination_activity (
    destination_name text,
    activity_id uuid,
    activity_name text,
    category text,
    description text,
    avg_cost decimal,
    duration_hours float,
    best_season text,
    PRIMARY KEY (destination_name, activity_id)
);

-- Recommendation history (query: get recommendations by user_id, ordered by time)
CREATE TABLE IF NOT EXISTS recommendation_history (
    user_id bigint,
    recommended_at timestamp,
    recommendation_id uuid,
    destination_name text,
    score float,
    reason text,
    category text,
    was_booked boolean,
    PRIMARY KEY (user_id, recommended_at, recommendation_id)
) WITH CLUSTERING ORDER BY (recommended_at DESC, recommendation_id ASC);

-- Destination popularity (query: get popularity by destination)
CREATE TABLE IF NOT EXISTS destination_popularity (
    destination_name text,
    trip_count counter,
    booking_count counter,
    PRIMARY KEY (destination_name)
);

-- Seed some destination activities
INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Goa Beaches', uuid(), 'Scuba Diving', 'adventure', 'Explore underwater coral reefs and marine life', 3500, 3.0, 'winter');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Goa Beaches', uuid(), 'Beach Party', 'nightlife', 'Experience vibrant beach nightlife', 2000, 5.0, 'winter');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Manali', uuid(), 'Paragliding', 'adventure', 'Soar over the Kullu Valley with Himalayan views', 3000, 1.5, 'summer');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Manali', uuid(), 'Skiing', 'adventure', 'Ski on the slopes of Solang Valley', 2500, 4.0, 'winter');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Jaipur', uuid(), 'Fort Tour', 'heritage', 'Visit Amber Fort, Nahargarh Fort and Jaigarh Fort', 1500, 6.0, 'winter');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Kerala Backwaters', uuid(), 'Houseboat Cruise', 'nature', 'Overnight houseboat cruise through palm-fringed canals', 6000, 24.0, 'winter');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Rishikesh', uuid(), 'White Water Rafting', 'adventure', 'Thrilling rapids on the Ganges River', 2000, 3.0, 'autumn');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Rishikesh', uuid(), 'Bungee Jumping', 'adventure', 'Indias highest bungee jump at Mohanchatti', 3500, 1.0, 'autumn');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Leh Ladakh', uuid(), 'Motorcycle Tour', 'adventure', 'Ride through Khardung La, the highest motorable pass', 5000, 8.0, 'summer');

INSERT INTO destination_activity (destination_name, activity_id, activity_name, category, description, avg_cost, duration_hours, best_season)
VALUES ('Udaipur', uuid(), 'Lake Pichola Boat Ride', 'heritage', 'Scenic boat ride with views of City Palace and Jag Mandir', 1000, 2.0, 'winter');
