#!/usr/bin/env python3
"""
NetOps Guardian AI - OSS/BSS Monetization Router
=================================================

FastAPI-based monetization API for exposing autonomous operations metrics.
Enables dynamic pricing and billing integration with BSS platforms.

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v2.3 - OSS/BSS Integration
License: MIT
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum
from dataclasses import dataclass, field
import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("MonetizationRouter")


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class SliceType(Enum):
    EMBB = "emmb"
    URLLC = "urllc"
    MMTC = "mmtc"
    ENTERPRISE = "enterprise"
    PREMIUM = "premium"


class BillingModel(Enum):
    FLAT_RATE = "flat_rate"
    USAGE_BASED = "usage_based"
    DYNAMIC = "dynamic"
    SLA_GUARANTEED = "sla_guaranteed"


# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class SliceMonetizationMetrics(BaseModel):
    """Metrics for network slice monetization"""
    slice_id: str = Field(..., description="Network slice identifier")
    slice_type: SliceType = Field(default=SliceType.ENTERPRISE)
    guaranteed_qos_met: float = Field(..., ge=0, le=100, description="QoS achievement percentage")
    self_healing_events_prevented: int = Field(default=0)
    availability_actual: float = Field(default=99.99)
    latency_avg_ms: float = Field(default=0)
    throughput_avg_gbps: float = Field(default=0)
    dynamic_billing_rate: float = Field(default=0)
    billing_model: BillingModel = Field(default=BillingModel.DYNAMIC)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MonetizationDashboard(BaseModel):
    """Aggregated monetization dashboard data"""
    total_revenue: float
    total_self_healing_savings: float
    active_slices: int
    services_monetized: int
    avg_qos_achievement: float


class DynamicPriceAdjustment(BaseModel):
    """Dynamic pricing adjustment"""
    slice_id: str
    qos_baseline: float
    qos_actual: float
    price_adjustment_percent: float
    reason: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# =============================================================================
# DATA STORE
# =============================================================================

class MonetizationDataStore:
    """In-memory data store for monetization metrics"""
    
    def __init__(self):
        self.slice_metrics: Dict[str, SliceMonetizationMetrics] = {}
        self.price_adjustments: List[DynamicPriceAdjustment] = []
        self._initialize_mock_data()
    
    def _initialize_mock_data(self):
        """Initialize with sample data"""
        slices = [
            ("SLICE-PREMIUM-001", SliceType.PREMIUM, 99.99, 15, 5.2),
            ("SLICE-URLLC-001", SliceType.URLLC, 99.999, 8, 1.2),
            ("SLICE-EMBB-001", SliceType.EMBB, 99.95, 22, 8.5),
            ("SLICE-ENT-001", SliceType.ENTERPRISE, 99.97, 5, 4.8),
        ]
        
        for slice_id, slice_type, qos, healing, latency in slices:
            rate = self._calculate_dynamic_rate(qos, healing)
            self.slice_metrics[slice_id] = SliceMonetizationMetrics(
                slice_id=slice_id,
                slice_type=slice_type,
                guaranteed_qos_met=qos,
                self_healing_events_prevented=healing,
                latency_avg_ms=latency,
                dynamic_billing_rate=rate
            )
    
    def _calculate_dynamic_rate(self, qos: float, healing_events: int) -> float:
        """Calculate dynamic billing rate"""
        base_rate = 100.0
        qos_bonus = (qos - 99.0) * 10 if qos > 99.0 else 0
        healing_bonus = healing_events * 2.5
        return base_rate + qos_bonus + healing_bonus


data_store = MonetizationDataStore()


# =============================================================================
# FASTAPI ROUTER
# =============================================================================

router = APIRouter(
    prefix="/api/v1/bss",
    tags=["Monetization", "OSS/BSS"],
)


@router.get("/metrics/{slice_id}", response_model=SliceMonetizationMetrics)
async def get_slice_monetization_data(slice_id: str):
    """Get monetization metrics for a specific network slice"""
    metrics = data_store.slice_metrics.get(slice_id)
    if not metrics:
        raise HTTPException(status_code=404, detail=f"Slice {slice_id} not found")
    return metrics


@router.get("/metrics", response_model=List[SliceMonetizationMetrics])
async def get_all_slice_metrics(
    slice_type: Optional[SliceType] = Query(None),
    min_qos: Optional[float] = Query(None, ge=0, le=100)
):
    """Get monetization metrics for all network slices"""
    metrics = list(data_store.slice_metrics.values())
    if slice_type:
        metrics = [m for m in metrics if m.slice_type == slice_type]
    if min_qos is not None:
        metrics = [m for m in metrics if m.guaranteed_qos_met >= min_qos]
    return metrics


@router.get("/dashboard", response_model=MonetizationDashboard)
async def get_monetization_dashboard():
    """Get aggregated monetization dashboard data"""
    slices = list(data_store.slice_metrics.values())
    total_healing = sum(s.self_healing_events_prevented for s in slices)
    avg_qos = sum(s.guaranteed_qos_met for s in slices) / len(slices) if slices else 0
    healing_savings = total_healing * 500  # $500 per prevented incident
    
    return MonetizationDashboard(
        total_revenue=675000,
        total_self_healing_savings=healing_savings,
        active_slices=len(slices),
        services_monetized=3,
        avg_qos_achievement=avg_qos
    )


@router.post("/pricing/adjust", response_model=DynamicPriceAdjustment)
async def adjust_dynamic_pricing(
    slice_id: str,
    qos_actual: float = Query(..., ge=0, le=100),
    qos_baseline: float = Query(default=99.99, ge=0, le=100)
):
    """Calculate and apply dynamic pricing adjustment"""
    qos_diff = qos_actual - qos_baseline
    adjustment_percent = qos_diff * 10 if qos_diff != 0 else 0
    
    reason = "QoS above baseline - premium charge" if qos_diff > 0 else \
             "QoS below baseline - credit applied" if qos_diff < 0 else \
             "QoS at baseline - standard rate"
    
    adjustment = DynamicPriceAdjustment(
        slice_id=slice_id,
        qos_baseline=qos_baseline,
        qos_actual=qos_actual,
        price_adjustment_percent=adjustment_percent,
        reason=reason
    )
    
    data_store.price_adjustments.append(adjustment)
    return adjustment


@router.get("/healing/savings")
async def get_self_healing_savings(days: int = Query(default=30, ge=1, le=365)):
    """Calculate savings from self-healing"""
    total_events = sum(s.self_healing_events_prevented for s in data_store.slice_metrics.values())
    avg_incident_cost = 250
    
    return {
        "period_days": days,
        "total_healing_events": total_events * (days / 30),
        "cost_per_manual_incident": avg_incident_cost,
        "total_cost_savings": total_events * avg_incident_cost * (days / 30),
        "mttr_improvement_percent": 95.8
    }


# Helper functions
def query_active_slice_metrics(slice_id: str) -> Optional[SliceMonetizationMetrics]:
    return data_store.slice_metrics.get(slice_id)


def calculate_dynamic_rate(qos: float, healing_events: int) -> float:
    return data_store._calculate_dynamic_rate(qos, healing_events)
