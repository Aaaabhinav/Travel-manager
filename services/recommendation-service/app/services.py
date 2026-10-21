import logging
from datetime import datetime
from app.db import get_cassandra_session

logger = logging.getLogger("recommendation-service.services")

# Seed catalog of destinations to generate recommendations from
# Seed catalog of destinations matching PostgreSQL database exactly
DESTINATIONS_CATALOG = [
    {"id": 1, "name": "Goa Beaches", "category": "beach", "country": "India", "daily_cost": 120.0, "description": "Stunning beaches with vibrant nightlife and Portuguese heritage architecture along the Arabian Sea."},
    {"id": 2, "name": "Taj Mahal, Agra", "category": "heritage", "country": "India", "daily_cost": 85.0, "description": "One of the Seven Wonders of the World, a magnificent white marble mausoleum."},
    {"id": 3, "name": "Manali", "category": "adventure", "country": "India", "daily_cost": 95.0, "description": "A breathtaking hill station in the Himalayas, perfect for trekking, skiing, and paragliding."},
    {"id": 4, "name": "Jaipur", "category": "heritage", "country": "India", "daily_cost": 90.0, "description": "The Pink City with magnificent forts, palaces, and vibrant bazaars."},
    {"id": 5, "name": "Kerala Backwaters", "category": "nature", "country": "India", "daily_cost": 110.0, "description": "Serene houseboat cruises through palm-fringed canals, lagoons, and lakes."},
    {"id": 6, "name": "Varanasi", "category": "heritage", "country": "India", "daily_cost": 70.0, "description": "One of the oldest continuously inhabited cities, famous for sacred Ganges ghats."},
    {"id": 7, "name": "Rishikesh", "category": "adventure", "country": "India", "daily_cost": 65.0, "description": "The Yoga Capital with thrilling river rafting, bungee jumping, and ashrams."},
    {"id": 8, "name": "Udaipur", "category": "heritage", "country": "India", "daily_cost": 115.0, "description": "The City of Lakes with stunning palatial architecture and royal heritage."},
    {"id": 9, "name": "Andaman Islands", "category": "beach", "country": "India", "daily_cost": 150.0, "description": "Pristine tropical islands with turquoise waters, coral reefs, and white sandy beaches."},
    {"id": 10, "name": "Leh Ladakh", "category": "adventure", "country": "India", "daily_cost": 140.0, "description": "High-altitude desert with dramatic landscapes, monasteries, and motorcycle routes."},
    {"id": 11, "name": "Munnar", "category": "nature", "country": "India", "daily_cost": 90.0, "description": "Rolling tea plantations, misty mountains, and diverse wildlife in the Western Ghats."},
    {"id": 12, "name": "Hampi", "category": "heritage", "country": "India", "daily_cost": 60.0, "description": "UNESCO World Heritage Site with spectacular ruins of the Vijayanagara Empire."},
    {"id": 13, "name": "Darjeeling", "category": "nature", "country": "India", "daily_cost": 85.0, "description": "The Queen of the Hills with panoramic Himalayan views and historic toy train."},
    {"id": 14, "name": "Jodhpur", "category": "heritage", "country": "India", "daily_cost": 85.0, "description": "The Blue City dominated by the mighty Mehrangarh Fort."},
    {"id": 15, "name": "Coorg", "category": "nature", "country": "India", "daily_cost": 95.0, "description": "Misty coffee plantations, waterfalls, and lush green landscapes."},
    {"id": 16, "name": "Delhi", "category": "city", "country": "India", "daily_cost": 100.0, "description": "Historic monuments, street food culture, and modern cosmopolitan life."},
    {"id": 17, "name": "Mumbai", "category": "city", "country": "India", "daily_cost": 120.0, "description": "The City of Dreams with vibrant nightlife, marine drive, and Bollywood."},
    {"id": 18, "name": "Bangalore", "category": "city", "country": "India", "daily_cost": 95.0, "description": "Silicon Valley of India with pleasant climate, gardens, and craft cafes."},
    {"id": 19, "name": "Shimla", "category": "nature", "country": "India", "daily_cost": 90.0, "description": "Former summer capital with colonial architecture and scenic mountain ridges."},
    {"id": 20, "name": "Pushkar", "category": "heritage", "country": "India", "daily_cost": 50.0, "description": "Sacred town with Brahma temple, desert camel fair, and tranquil lake."},
    {"id": 21, "name": "Auroville", "category": "nature", "country": "India", "daily_cost": 75.0, "description": "Experimental township dedicated to human unity with unique architecture."},
    {"id": 22, "name": "Ahmedabad", "category": "heritage", "country": "India", "daily_cost": 70.0, "description": "UNESCO World Heritage City with Indo-Islamic architecture and Sabarmati Ashram."},
    {"id": 23, "name": "Ooty", "category": "nature", "country": "India", "daily_cost": 85.0, "description": "Queen of Hill Stations with botanical gardens and Nilgiri Mountain Railway."},
    {"id": 24, "name": "Kolkata", "category": "city", "country": "India", "daily_cost": 80.0, "description": "The City of Joy with literary heritage, artistic culture, and legendary cuisine."},
    {"id": 25, "name": "Rann of Kutch", "category": "nature", "country": "India", "daily_cost": 110.0, "description": "Vast white salt desert transforming magically under the full moon."},
    {"id": 26, "name": "Mysore", "category": "heritage", "country": "India", "daily_cost": 75.0, "description": "City of Palaces with illuminated Mysore Palace, sandalwood, and silk."},
    {"id": 27, "name": "Spiti Valley", "category": "adventure", "country": "India", "daily_cost": 110.0, "description": "Cold desert mountain valley with ancient monasteries and stargazing."},
    {"id": 28, "name": "Alleppey", "category": "beach", "country": "India", "daily_cost": 105.0, "description": "Venice of the East with palm-lined backwaters and serene beaches."},
    {"id": 29, "name": "Amritsar", "category": "heritage", "country": "India", "daily_cost": 70.0, "description": "Home to the Golden Temple, Wagah Border, and rich Punjabi culture."},
    {"id": 30, "name": "Jim Corbett", "category": "adventure", "country": "India", "daily_cost": 125.0, "description": "Oldest national park, famous for Bengal tiger safaris in the Himalayan foothills."},
    {"id": 31, "name": "Pondicherry", "category": "beach", "country": "India", "daily_cost": 85.0, "description": "Charming French colonial town with colorful quarters and serene seaside promenade."},
    {"id": 32, "name": "Kaziranga", "category": "adventure", "country": "India", "daily_cost": 115.0, "description": "UNESCO World Heritage Site with one-horned rhinoceros and lush grasslands."}
]

class RecommendationEngine:
    def increment_popularity(self, destination_id: int, dest_name: str, category: str, delta: int = 1):
        sess = get_cassandra_session()
        if sess:
            try:
                if delta > 0:
                    sess.execute(
                        "UPDATE destination_popularity SET booking_count = booking_count + %s WHERE destination_id = %s",
                        (delta, destination_id)
                    )
                else:
                    sess.execute(
                        "UPDATE destination_popularity SET booking_count = booking_count - %s WHERE destination_id = %s",
                        (abs(delta), destination_id)
                    )
            except Exception as e:
                logger.error(f"Error updating Cassandra destination_popularity: {e}")

    def update_user_preferences(self, user_id: int, category: str):
        sess = get_cassandra_session()
        if sess:
            try:
                sess.execute(
                    "UPDATE user_preferences SET preferred_categories = preferred_categories + {%s}, updated_at = %s WHERE user_id = %s",
                    (category, datetime.utcnow(), user_id)
                )
            except Exception as e:
                logger.error(f"Error updating Cassandra user_preferences: {e}")

    def get_recommendations_for_user(self, user_id: int):
        sess = get_cassandra_session()
        preferred_categories = set()
        if sess:
            try:
                row = sess.execute("SELECT preferred_categories FROM user_preferences WHERE user_id = %s", (user_id,)).one()
                if row and row.preferred_categories:
                    preferred_categories = set(row.preferred_categories)
            except Exception as e:
                logger.error(f"Error fetching user preferences: {e}")

        results = []
        for dest in DESTINATIONS_CATALOG:
            score = 75.0
            reasons = ["Popular destination"]

            if dest["category"] in preferred_categories:
                score += 20.0
                reasons.append(f"Matches your preference for {dest['category']}")

            if dest["daily_cost"] <= 100.0:
                score += 5.0
                reasons.append("Fits budget-friendly preference")

            results.append({
                "destination_id": dest["id"],
                "destination_name": dest["name"],
                "category": dest["category"],
                "country": dest["country"],
                "daily_cost": dest["daily_cost"],
                "score": min(score, 99.0),
                "reason": " • ".join(reasons),
                "description": dest["description"]
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results

recommendation_engine = RecommendationEngine()
