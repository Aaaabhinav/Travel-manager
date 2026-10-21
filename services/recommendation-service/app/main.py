import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

from app.config import settings
from app.db import get_cassandra_session
from app.services import recommendation_engine, DESTINATIONS_CATALOG
from app.consumer import start_rabbitmq_consumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("recommendation-service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Recommendation Service...")
    get_cassandra_session()
    start_rabbitmq_consumer()
    yield

app = FastAPI(
    title="Recommendation Service",
    description="Python FastAPI Recommendation Service with Cassandra and RabbitMQ",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PreferenceUpdateRequest(BaseModel):
    user_id: int
    category: str

@app.get("/health")
def health_check():
    sess = get_cassandra_session()
    return {
        "status": "UP",
        "service": "recommendation-service",
        "cassandra": "connected" if sess is not None else "fallback_mode"
    }

@app.get("/destinations")
@app.get("/recommendations/destinations")
@app.get("/api/recommendations/destinations")
def get_destination_catalog():
    return {
        "destinations": DESTINATIONS_CATALOG
    }

@app.post("/")
@app.post("/recommendations")
@app.post("/api/recommendations")
def add_user_preference(req: PreferenceUpdateRequest):
    recommendation_engine.update_user_preferences(req.user_id, req.category)
    return {
        "message": "Preference updated",
        "user_id": req.user_id,
        "category": req.category
    }

@app.get("/{user_id}")
@app.get("/recommendations/{user_id}")
@app.get("/api/recommendations/{user_id}")
def get_user_recommendations(user_id: int, x_user_id: Optional[str] = Header(None)):
    recs = recommendation_engine.get_recommendations_for_user(user_id)
    return {
        "user_id": user_id,
        "recommendations": recs
    }
