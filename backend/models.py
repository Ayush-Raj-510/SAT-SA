import sqlalchemy as sa
from sqlalchemy.sql import func
from .database import Base

class Entity(Base):
    __tablename__ = "entities"

    entity_id = sa.Column(sa.String(64), primary_key=True, index=True)
    entity_name = sa.Column(sa.String(255), nullable=False)
    sector = sa.Column(sa.String(100), nullable=False)
    size_band = sa.Column(sa.String(50), nullable=False)
    peer_group = sa.Column(sa.String(100), nullable=False)
    reporting_period = sa.Column(sa.String(32), nullable=False)
    created_at = sa.Column(sa.DateTime(timezone=True), server_default=func.now())

class Asset(Base):
    __tablename__ = "assets"

    asset_id = sa.Column(sa.String(64), primary_key=True, index=True)
    entity_id = sa.Column(sa.String(64), sa.ForeignKey("entities.entity_id", ondelete="CASCADE"), index=True)
    asset_name_hash = sa.Column(sa.String(128), nullable=False)
    asset_type = sa.Column(sa.String(100), nullable=False)
    criticality = sa.Column(sa.String(32), nullable=False)
    environment = sa.Column(sa.String(32), nullable=False)
    active_from = sa.Column(sa.DateTime(timezone=True), nullable=False)

class Alert(Base):
    __tablename__ = "alerts"

    alert_id = sa.Column(sa.String(64), primary_key=True, index=True)
    entity_id = sa.Column(sa.String(64), sa.ForeignKey("entities.entity_id", ondelete="CASCADE"), index=True)
    asset_id = sa.Column(sa.String(64), sa.ForeignKey("assets.asset_id", ondelete="SET NULL"), index=True)
    alert_category = sa.Column(sa.String(150), nullable=False)
    source_control = sa.Column(sa.String(100), nullable=False)
    severity = sa.Column(sa.String(32), nullable=False)
    disposition = sa.Column(sa.String(50), nullable=False)
    created_at = sa.Column(sa.DateTime(timezone=True), nullable=False)
    closed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

class Case(Base):
    __tablename__ = "cases"

    case_id = sa.Column(sa.String(64), primary_key=True, index=True)
    entity_id = sa.Column(sa.String(64), sa.ForeignKey("entities.entity_id", ondelete="CASCADE"), index=True)
    alert_id = sa.Column(sa.String(64), sa.ForeignKey("alerts.alert_id", ondelete="CASCADE"), index=True)
    impact = sa.Column(sa.String(32), nullable=False)
    investigation_started_at = sa.Column(sa.DateTime(timezone=True), nullable=False)
    investigation_completed_at = sa.Column(sa.DateTime(timezone=True), nullable=True)

class Finding(Base):
    __tablename__ = "findings"

    finding_id = sa.Column(sa.String(64), primary_key=True, index=True)
    entity_id = sa.Column(sa.String(64), sa.ForeignKey("entities.entity_id", ondelete="CASCADE"), index=True)
    finding_class = sa.Column(sa.String(50), nullable=False)
    title = sa.Column(sa.Text, nullable=False)
    severity = sa.Column(sa.String(32), nullable=False)
    score = sa.Column(sa.Integer, nullable=False)
    rule_id = sa.Column(sa.String(64), nullable=False)
    review_status = sa.Column(sa.String(50), default="Pending")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = sa.Column(sa.String(64), primary_key=True, index=True)
    timestamp = sa.Column(sa.DateTime(timezone=True), server_default=func.now())
    actor = sa.Column(sa.String(100), nullable=False)
    action = sa.Column(sa.String(100), nullable=False)
    details = sa.Column(sa.Text, nullable=False)
    hash_signature = sa.Column(sa.String(128), nullable=False)
