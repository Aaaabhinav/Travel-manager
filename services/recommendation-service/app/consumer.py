import json
import logging
import time
import threading
import pika
from app.config import settings
from app.services import recommendation_engine

logger = logging.getLogger("recommendation-service.consumer")

def start_rabbitmq_consumer():
    def _run():
        max_retries = 20
        for attempt in range(1, max_retries + 1):
            try:
                logger.info(f"Connecting RabbitMQ consumer to {settings.RABBITMQ_HOST}:{settings.RABBITMQ_PORT} (Attempt {attempt}/{max_retries})...")
                credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
                parameters = pika.ConnectionParameters(
                    host=settings.RABBITMQ_HOST,
                    port=settings.RABBITMQ_PORT,
                    credentials=credentials,
                    heartbeat=60
                )
                connection = pika.BlockingConnection(parameters)
                channel = connection.channel()

                # Declare topic exchange
                channel.exchange_declare(exchange="travel.events", exchange_type="topic", durable=True)

                # Queue declaration
                result = channel.queue_declare(queue="recommendation_queue", durable=True)
                queue_name = result.method.queue

                channel.queue_bind(exchange="travel.events", queue=queue_name, routing_key="event.#")
                channel.queue_bind(exchange="travel.events", queue=queue_name, routing_key="booking.#")

                logger.info("RabbitMQ consumer connected and listening on travel.events!")

                def callback(ch, method, properties, body):
                    try:
                        data = json.loads(body.decode("utf-8"))
                        event_type = data.get("eventType") or method.routing_key
                        payload = data.get("payload", {})

                        logger.info(f"Received event: {event_type}")

                        if event_type in ["TripCreated", "event.TripCreated"]:
                            user_id = payload.get("user_id") or payload.get("userId")
                            category = payload.get("category", "heritage")
                            if user_id:
                                recommendation_engine.update_user_preferences(int(user_id), category)

                        elif event_type in ["BookingConfirmed", "event.BookingConfirmed"]:
                            dest_id = payload.get("destination_id", 1)
                            user_id = payload.get("user_id")
                            recommendation_engine.increment_popularity(int(dest_id), "Destination", "general", 1)
                            if user_id:
                                recommendation_engine.update_user_preferences(int(user_id), "travel")

                        elif event_type in ["BookingCancelled", "BookingFailed", "event.BookingCancelled", "event.BookingFailed"]:
                            dest_id = payload.get("destination_id", 1)
                            recommendation_engine.increment_popularity(int(dest_id), "Destination", "general", -1)

                        ch.basic_ack(delivery_tag=method.delivery_tag)
                    except Exception as e:
                        logger.error(f"Error handling event: {e}")
                        ch.basic_ack(delivery_tag=method.delivery_tag)

                channel.basic_qos(prefetch_count=1)
                channel.basic_consume(queue=queue_name, on_message_callback=callback)
                channel.start_consuming()
            except Exception as e:
                logger.warning(f"RabbitMQ consumer connection attempt {attempt} failed: {e}")
                if attempt == max_retries:
                    logger.error("RabbitMQ consumer stopped after max retries.")
                    break
                time.sleep(5)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
