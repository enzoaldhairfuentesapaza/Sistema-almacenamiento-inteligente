from sqlalchemy import URL, create_engine, event
from sqlalchemy.orm import Session

from app.core.config import settings

database_url = settings.database_url or URL.create(
    "postgresql+psycopg",
    username=settings.db_user,
    password=settings.db_password.get_secret_value(),
    host=settings.db_host,
    port=settings.db_port,
    database=settings.db_name,
)
engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False}
    if str(database_url).startswith("sqlite")
    else {"connect_timeout": 5},
)
if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def sqlite_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


def get_db():
    with Session(engine) as session:
        yield session
