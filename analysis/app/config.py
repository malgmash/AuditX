"""Settings, read from the environment or analysis/.env."""

from __future__ import annotations

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # The same variable the web service uses, so both services read one database.
    database_url: str = "postgresql://auditx:auditx@localhost:5432/auditx?schema=public"
    # Shared secret the web service sends to the internal endpoints.
    internal_token: str = "dev-internal-token"
    org_id: str = "org_auditx_demo"

    s3_endpoint: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str = "auditx"
    s3_secret_key: str = "auditx-dev-secret"
    s3_bucket: str = "receipts"

    @property
    def sqlalchemy_url(self) -> str:
        """Prisma URLs carry a ?schema= parameter and a bare postgresql:// scheme. SQLAlchemy needs
        the driver named and rejects the parameter."""
        parts = urlsplit(self.database_url)
        query = [(k, v) for k, v in parse_qsl(parts.query) if k != "schema"]
        scheme = "postgresql+psycopg" if parts.scheme in ("postgresql", "postgres") else parts.scheme
        return urlunsplit((scheme, parts.netloc, parts.path, urlencode(query), ""))


settings = Settings()
