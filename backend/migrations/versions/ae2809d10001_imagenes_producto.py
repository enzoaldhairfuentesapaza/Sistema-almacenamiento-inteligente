"""Imágenes del catálogo.
Revision ID: ae2809d10001
Revises: 405f2d303ba0
"""
from alembic import op
import sqlalchemy as sa
revision = "ae2809d10001"
down_revision = "405f2d303ba0"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("productos", sa.Column("imagen", sa.String(80), nullable=True))

def downgrade():
    op.drop_column("productos", "imagen")
