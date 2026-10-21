import logging
import time
from cassandra import ProtocolVersion, DriverException, InvalidRequest
from cassandra.cluster import Cluster, NoHostAvailable, ExecutionProfile, EXEC_PROFILE_DEFAULT
from cassandra.policies import DCAwareRoundRobinPolicy
from app.config import settings

logger = logging.getLogger("recommendation-service.db")

session = None
cluster = None

def get_cassandra_session():
    global session, cluster
    if session is not None:
        return session

    max_retries = 15
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Connecting to Cassandra at {settings.CASSANDRA_HOST}:{settings.CASSANDRA_PORT} (Attempt {attempt}/{max_retries})...")
            
            profile = ExecutionProfile(
                load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=settings.CASSANDRA_DC)
            )
            
            cluster = Cluster(
                [settings.CASSANDRA_HOST],
                port=settings.CASSANDRA_PORT,
                execution_profiles={EXEC_PROFILE_DEFAULT: profile}
            )
            temp_session = cluster.connect()

            # Create keyspace
            temp_session.execute(f"""
                CREATE KEYSPACE IF NOT EXISTS {settings.CASSANDRA_KEYSPACE}
                WITH replication = {{'class': 'SimpleStrategy', 'replication_factor': 1}};
            """)
            temp_session.shutdown()

            session = cluster.connect(settings.CASSANDRA_KEYSPACE)
            init_tables(session)
            logger.info("Successfully connected to Cassandra and initialized tables!")
            return session
        except InvalidRequest as e:
            logger.error(f"Cassandra schema query failure: {e}. Aborting retries due to CQL error.")
            return None
        except (NoHostAvailable, DriverException, Exception) as e:
            logger.warning(f"Cassandra connection attempt {attempt}/{max_retries} failed: {e}")
            if attempt == max_retries:
                logger.error("Could not connect to Cassandra after max retries. Fallback in-memory mode enabled.")
                return None
            time.sleep(3)

def init_tables(sess):
    sess.execute("""
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id bigint,
            preferred_categories set<text>,
            avg_budget double,
            updated_at timestamp,
            PRIMARY KEY (user_id)
        );
    """)

    # Counter table MUST NOT mix counter and non-counter non-primary key columns
    sess.execute("""
        CREATE TABLE IF NOT EXISTS destination_popularity (
            destination_id int,
            booking_count counter,
            PRIMARY KEY (destination_id)
        );
    """)

    sess.execute("""
        CREATE TABLE IF NOT EXISTS destination_metadata (
            destination_id int,
            destination_name text,
            category text,
            PRIMARY KEY (destination_id)
        );
    """)

    sess.execute("""
        CREATE TABLE IF NOT EXISTS recommendation_history (
            user_id bigint,
            recommended_at timestamp,
            destination_name text,
            score double,
            reason text,
            PRIMARY KEY (user_id, recommended_at)
        ) WITH CLUSTERING ORDER BY (recommended_at DESC);
    """)
