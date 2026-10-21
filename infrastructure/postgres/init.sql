-- PostgreSQL init script
-- Creates separate databases for Trip and Booking services

-- Trip Service Database
CREATE DATABASE trip_service_db;

-- Booking Service Database  
CREATE DATABASE booking_service_db;

-- Connect to trip_service_db and create schema
\c trip_service_db;

CREATE TABLE IF NOT EXISTS destinations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    state VARCHAR(255),
    category VARCHAR(100) NOT NULL,
    description TEXT,
    image_url VARCHAR(500),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    avg_daily_cost DECIMAL(10, 2),
    best_season VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    budget DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'PLANNED',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_destinations (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    destination_id INTEGER NOT NULL REFERENCES destinations(id),
    day_number INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(trip_id, destination_id)
);

CREATE TABLE IF NOT EXISTS itineraries (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    title VARCHAR(255),
    description TEXT,
    destination_id INTEGER REFERENCES destinations(id),
    activity_type VARCHAR(100),
    start_time TIME,
    end_time TIME,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trip_reservations (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    booking_id VARCHAR(255) NOT NULL UNIQUE,
    saga_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'RESERVED',
    reserved_at TIMESTAMP DEFAULT NOW(),
    released_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed destinations (30+ realistic destinations)
INSERT INTO destinations (name, country, state, category, description, image_url, latitude, longitude, avg_daily_cost, best_season) VALUES
('Goa Beaches', 'India', 'Goa', 'beach', 'Stunning beaches with vibrant nightlife and Portuguese heritage architecture along the Arabian Sea coastline.', 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800', 15.2993, 74.1240, 3500.00, 'winter'),
('Taj Mahal, Agra', 'India', 'Uttar Pradesh', 'heritage', 'One of the Seven Wonders of the World, a magnificent white marble mausoleum built by Emperor Shah Jahan.', 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800', 27.1751, 78.0421, 2500.00, 'winter'),
('Manali', 'India', 'Himachal Pradesh', 'adventure', 'A breathtaking hill station in the Himalayas, perfect for trekking, skiing, and paragliding adventures.', 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800', 32.2396, 77.1887, 3000.00, 'summer'),
('Jaipur', 'India', 'Rajasthan', 'heritage', 'The Pink City with magnificent forts, palaces, and vibrant bazaars showcasing Rajasthani culture.', 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800', 26.9124, 75.7873, 2800.00, 'winter'),
('Kerala Backwaters', 'India', 'Kerala', 'nature', 'Serene houseboat cruises through palm-fringed canals, lagoons, and lakes of Gods Own Country.', 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800', 9.4981, 76.3388, 4000.00, 'winter'),
('Varanasi', 'India', 'Uttar Pradesh', 'heritage', 'One of the oldest continuously inhabited cities, famous for its ghats along the sacred Ganges River.', 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800', 25.3176, 83.0168, 2000.00, 'winter'),
('Rishikesh', 'India', 'Uttarakhand', 'adventure', 'The Yoga Capital of the World, also famous for white-water rafting and bungee jumping on the Ganges.', 'https://images.unsplash.com/photo-1592385862836-52da7fe2c4da?w=800', 30.0869, 78.2676, 2200.00, 'autumn'),
('Udaipur', 'India', 'Rajasthan', 'heritage', 'The City of Lakes with stunning palatial architecture, boat rides, and romantic sunset views.', 'https://images.unsplash.com/photo-1602301100442-3f0a0bfb7c8c?w=800', 24.5854, 73.7125, 3200.00, 'winter'),
('Andaman Islands', 'India', 'Andaman & Nicobar', 'beach', 'Pristine tropical islands with crystal-clear turquoise waters, coral reefs, and white sandy beaches.', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', 11.7401, 92.6586, 5000.00, 'winter'),
('Leh Ladakh', 'India', 'Ladakh', 'adventure', 'High-altitude desert with dramatic landscapes, ancient monasteries, and thrilling motorcycle routes.', 'https://images.unsplash.com/photo-1626621341518-80813a7b2e08?w=800', 34.1526, 77.5771, 4500.00, 'summer'),
('Munnar', 'India', 'Kerala', 'nature', 'Rolling tea plantations, misty mountains, and diverse wildlife in the Western Ghats hill station.', 'https://images.unsplash.com/photo-1597218868981-1b68e15f0065?w=800', 10.0889, 77.0595, 2800.00, 'winter'),
('Hampi', 'India', 'Karnataka', 'heritage', 'UNESCO World Heritage Site with spectacular ruins of the Vijayanagara Empire amid giant boulders.', 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?w=800', 15.3350, 76.4600, 1800.00, 'winter'),
('Darjeeling', 'India', 'West Bengal', 'nature', 'The Queen of the Hills with panoramic Himalayan views, tea gardens, and the historic toy train.', 'https://images.unsplash.com/photo-1622308644420-1a4945174943?w=800', 27.0360, 88.2627, 2500.00, 'autumn'),
('Jodhpur', 'India', 'Rajasthan', 'heritage', 'The Blue City dominated by the mighty Mehrangarh Fort and surrounded by blue-painted houses.', 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800', 26.2389, 73.0243, 2600.00, 'winter'),
('Coorg', 'India', 'Karnataka', 'nature', 'The Scotland of India with misty coffee plantations, waterfalls, and lush green landscapes.', 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800', 12.3375, 75.8069, 3000.00, 'winter'),
('Delhi', 'India', 'Delhi', 'city', 'The capital city blending Mughal heritage with modern urban culture, street food, and vibrant markets.', 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800', 28.7041, 77.1025, 3500.00, 'winter'),
('Mumbai', 'India', 'Maharashtra', 'city', 'The City of Dreams with Bollywood, colonial architecture, street food, and a buzzing nightlife scene.', 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800', 19.0760, 72.8777, 4000.00, 'winter'),
('Bangalore', 'India', 'Karnataka', 'city', 'The Silicon Valley of India with pleasant climate, gardens, craft beer culture, and tech innovation.', 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800', 12.9716, 77.5946, 3500.00, 'autumn'),
('Shimla', 'India', 'Himachal Pradesh', 'nature', 'The former summer capital of British India with colonial architecture and scenic mountain views.', 'https://images.unsplash.com/photo-1597074866923-dc0589150458?w=800', 31.1048, 77.1734, 2800.00, 'summer'),
('Pushkar', 'India', 'Rajasthan', 'heritage', 'A sacred town with the only Brahma temple in the world, surrounded by desert and a holy lake.', 'https://images.unsplash.com/photo-1602508453067-cc5720d4f3c9?w=800', 26.4899, 74.5512, 1500.00, 'winter'),
('Auroville', 'India', 'Tamil Nadu', 'nature', 'An experimental township dedicated to human unity with unique architecture and sustainable living.', 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800', 12.0055, 79.8083, 2200.00, 'winter'),
('Ahmedabad', 'India', 'Gujarat', 'heritage', 'UNESCO World Heritage City with stunning Indo-Islamic architecture, Sabarmati Ashram, and vibrant textiles.', 'https://images.unsplash.com/photo-1569154941061-e231b4725ef1?w=800', 23.0225, 72.5714, 2000.00, 'winter'),
('Ooty', 'India', 'Tamil Nadu', 'nature', 'The Queen of Hill Stations with botanical gardens, tea factories, and scenic Nilgiri Mountain Railway.', 'https://images.unsplash.com/photo-1585409677983-0f6c41128c2d?w=800', 11.4102, 76.6950, 2500.00, 'summer'),
('Kolkata', 'India', 'West Bengal', 'city', 'The City of Joy with colonial grandeur, literary heritage, artistic culture, and legendary street food.', 'https://images.unsplash.com/photo-1558431382-27e303142255?w=800', 22.5726, 88.3639, 2500.00, 'winter'),
('Rann of Kutch', 'India', 'Gujarat', 'nature', 'The vast white salt desert that transforms into a magical landscape under the full moon during Rann Utsav.', 'https://images.unsplash.com/photo-1588096344356-9b4cffd33e3c?w=800', 23.7337, 69.8597, 3500.00, 'winter'),
('Mysore', 'India', 'Karnataka', 'heritage', 'The City of Palaces with the illuminated Mysore Palace, sandalwood, silk, and Dasara celebrations.', 'https://images.unsplash.com/photo-1600112356661-d3e0e5a1f2e5?w=800', 12.2958, 76.6394, 2200.00, 'autumn'),
('Spiti Valley', 'India', 'Himachal Pradesh', 'adventure', 'A cold desert mountain valley with ancient monasteries, fossil-rich landscapes, and stargazing.', 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800', 32.2460, 78.0349, 3500.00, 'summer'),
('Alleppey', 'India', 'Kerala', 'beach', 'The Venice of the East with palm-lined backwaters, houseboat stays, and serene beach experiences.', 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800', 9.4981, 76.3388, 3500.00, 'winter'),
('Amritsar', 'India', 'Punjab', 'heritage', 'Home to the magnificent Golden Temple, the Wagah Border ceremony, and legendary Punjabi cuisine.', 'https://images.unsplash.com/photo-1587899897387-091ebd01a5c2?w=800', 31.6340, 74.8723, 2000.00, 'winter'),
('Jim Corbett', 'India', 'Uttarakhand', 'adventure', 'Indias oldest national park, famous for Bengal tiger safaris and diverse wildlife in the Himalayan foothills.', 'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800', 29.5300, 78.7747, 4000.00, 'winter'),
('Pondicherry', 'India', 'Tamil Nadu', 'beach', 'A charming French colonial town with colorful streets, serene beaches, and vibrant cafes.', 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800', 11.9416, 79.8083, 2500.00, 'winter'),
('Kaziranga', 'India', 'Assam', 'adventure', 'UNESCO World Heritage Site, home to two-thirds of the worlds one-horned rhinoceros population.', 'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800', 26.5775, 93.1711, 3500.00, 'winter');


-- Connect to booking_service_db and create schema
\c booking_service_db;

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    trip_id INTEGER,
    booking_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING',
    total_price DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_items (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER DEFAULT 1,
    check_in DATE,
    check_out DATE,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_status (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    reason TEXT,
    changed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'SIMULATED',
    transaction_id VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saga_instances (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    status VARCHAR(50) NOT NULL DEFAULT 'STARTED',
    current_step VARCHAR(100),
    payload JSONB,
    retry_count INTEGER DEFAULT 0,
    timeout_at TIMESTAMP,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saga_steps (
    id SERIAL PRIMARY KEY,
    saga_id VARCHAR(255) NOT NULL REFERENCES saga_instances(id),
    step_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    attempt INTEGER DEFAULT 0,
    error TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    routing_key VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    saga_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT NOW(),
    sent_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processed_messages (
    message_id VARCHAR(255) PRIMARY KEY,
    processed_at TIMESTAMP DEFAULT NOW()
);
