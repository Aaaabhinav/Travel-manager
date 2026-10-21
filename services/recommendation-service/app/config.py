import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PORT: int = int(os.getenv("PORT", 8084))
    CASSANDRA_HOST: str = os.getenv("CASSANDRA_HOST", "cassandra")
    CASSANDRA_PORT: int = int(os.getenv("CASSANDRA_PORT", 9042))
    CASSANDRA_KEYSPACE: str = os.getenv("CASSANDRA_KEYSPACE", "travel_recommendations")
    CASSANDRA_DC: str = os.getenv("CASSANDRA_DC", "datacenter1")
    RABBITMQ_HOST: str = os.getenv("RABBITMQ_HOST", "rabbitmq")
    RABBITMQ_PORT: int = int(os.getenv("RABBITMQ_PORT", 5672))
    RABBITMQ_USER: str = os.getenv("RABBITMQ_USER", "guest")
    RABBITMQ_PASSWORD: str = os.getenv("RABBITMQ_PASSWORD", "guest")

settings = Settings()
