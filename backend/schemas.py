from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class EntityBase(BaseModel):
    entity_id: str
    entity_name: str
    sector: str
    size_band: str
    peer_group: str
    reporting_period: str

class EntityCreate(EntityBase):
    pass

class EntityOut(EntityBase):
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AlertBase(BaseModel):
    alert_id: str
    entity_id: str
    asset_id: Optional[str] = None
    alert_category: str
    source_control: str
    severity: str
    disposition: str
    created_at: datetime
    closed_at: Optional[datetime] = None

class AlertOut(AlertBase):
    class Config:
        from_attributes = True

class IsolationForestRequest(BaseModel):
    features: List[List[float]] = Field(..., description="Array of feature vectors [alert_count, crit_count, closed_ratio, case_ratio]")
    contamination: float = Field(0.1, ge=0.01, le=0.5)

class IsolationForestResponse(BaseModel):
    anomaly_scores: List[float]
    predictions: List[int]
    anomalies_detected: int
