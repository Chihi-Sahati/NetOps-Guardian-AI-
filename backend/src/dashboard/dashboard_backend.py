#!/usr/bin/env python3
"""
NetOps Guardian AI - Web Dashboard Backend
===========================================

FastAPI backend for real-time dashboard metrics and self-healing visualization.
Provides WebSocket streaming for live monitoring.

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v2.3
License: MIT
"""

import asyncio
import random
from datetime import datetime
from typing import Dict, List
from dataclasses import dataclass, field, asdict
from enum import Enum
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("DashboardBackend")


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class DashboardMetric:
    metric_id: str
    name: str
    value: float
    unit: str
    target: float
    status: str
    trend: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())


@dataclass
class SelfHealingEvent:
    event_id: str
    timestamp: str
    drift_type: str
    device_id: str
    action_taken: str
    status: str
    duration_ms: float
    details: str


# =============================================================================
# SIMULATION DATA GENERATOR
# =============================================================================

class SimulationDataGenerator:
    """Generates realistic simulation data for dashboard display"""
    
    def __init__(self):
        self.events_generated = 0
        self.healing_events: List[SelfHealingEvent] = []
        self.drift_types = ["throughput_degradation", "latency_violation", "availability_drop"]
        self.devices = ["router-core-01", "router-edge-01", "switch-dist-01"]
        self.actions = ["QoS policy adjusted", "Traffic rerouted", "Redundant link activated"]
    
    def generate_dashboard_metrics(self) -> Dict[str, DashboardMetric]:
        """Generate current dashboard metrics (98.5% normalization, 99.2% deployment)"""
        return {
            "alarm_normalization": DashboardMetric(
                metric_id="alarm_norm", name="Alarm Normalization Accuracy",
                value=98.5, unit="%", target=95.0, status="good", trend="stable"
            ),
            "config_deployment": DashboardMetric(
                metric_id="config_deploy", name="Configuration Deployment Success",
                value=99.2, unit="%", target=98.0, status="good", trend="increasing"
            ),
            "ai_classification": DashboardMetric(
                metric_id="ai_class", name="AI Alarm Classification Precision",
                value=94.7, unit="%", target=90.0, status="good", trend="stable"
            ),
            "self_healing_rate": DashboardMetric(
                metric_id="healing", name="Self-Healing Success Rate",
                value=97.3, unit="%", target=95.0, status="good", trend="increasing"
            ),
            "fast_path_latency": DashboardMetric(
                metric_id="fast_path", name="Fast Path Latency",
                value=random.uniform(5, 10), unit="ms", target=10.0, status="good", trend="stable"
            ),
            "dashboard_gen_time": DashboardMetric(
                metric_id="dashboard_time", name="Dashboard Generation Time",
                value=random.uniform(15, 35), unit="ms", target=50.0, status="good", trend="stable"
            )
        }
    
    def generate_healing_event(self) -> SelfHealingEvent:
        """Generate a self-healing event for real-time display"""
        event = SelfHealingEvent(
            event_id=f"HEAL-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{random.randint(1000,9999)}",
            timestamp=datetime.utcnow().isoformat(),
            drift_type=random.choice(self.drift_types),
            device_id=random.choice(self.devices),
            action_taken=random.choice(self.actions),
            status="success",
            duration_ms=random.uniform(50, 500),
            details="Auto-remediated via Intent-Based Orchestration"
        )
        self.healing_events.append(event)
        self.events_generated += 1
        return event
    
    def get_recent_healing_events(self, count: int = 10) -> List[Dict]:
        if len(self.healing_events) < count:
            for _ in range(count - len(self.healing_events)):
                self.generate_healing_event()
        return [asdict(e) for e in self.healing_events[-count:]]


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

app = FastAPI(title="NetOps Guardian AI Dashboard", version="2.3.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

simulator = SimulationDataGenerator()


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

manager = ConnectionManager()


# =============================================================================
# REST ENDPOINTS
# =============================================================================

@app.get("/")
async def root():
    return {
        "name": "NetOps Guardian AI Dashboard",
        "version": "2.3.0",
        "features": ["Intent-Based Orchestration", "Self-Healing", "OSS/BSS Monetization"]
    }


@app.get("/api/dashboard/metrics")
async def get_dashboard_metrics():
    """Get current dashboard metrics (98.5% normalization, 99.2% deployment)"""
    metrics = simulator.generate_dashboard_metrics()
    return {k: asdict(v) for k, v in metrics.items()}


@app.get("/api/dashboard/healing/events")
async def get_healing_events(limit: int = 20):
    """Get recent self-healing events"""
    return {"total_events": simulator.events_generated, "events": simulator.get_recent_healing_events(limit)}


@app.get("/api/dashboard/summary")
async def get_dashboard_summary():
    """Get unified dashboard summary with experimental validation metrics"""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "experimental_validation": {
            "alarm_normalization_accuracy": 98.5,
            "configuration_deployment_success": 99.2,
            "ai_classification_precision": 94.7,
            "self_healing_success_rate": 97.3
        },
        "network_state": {"total_devices": 48, "devices_online": 47},
        "intent_enforcement": {"active_intents": 12, "compliant_intents": 11, "self_healing_active": True},
        "monetization": {"total_revenue_monthly": 675000, "self_healing_savings": 37500}
    }


# =============================================================================
# WEBSOCKET ENDPOINTS
# =============================================================================

@app.websocket("/ws/metrics")
async def websocket_metrics(websocket: WebSocket):
    """WebSocket for real-time metrics streaming"""
    await manager.connect(websocket)
    try:
        while True:
            metrics = simulator.generate_dashboard_metrics()
            healing = simulator.generate_healing_event()
            message = {
                "type": "metrics_update",
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": {k: asdict(v) for k, v in metrics.items()},
                "latest_healing": asdict(healing)
            }
            await websocket.send_json(message)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.websocket("/ws/healing")
async def websocket_healing(websocket: WebSocket):
    """WebSocket for real-time self-healing log streaming"""
    await manager.connect(websocket)
    try:
        while True:
            event = simulator.generate_healing_event()
            await websocket.send_json({"type": "healing_event", "event": asdict(event)})
            await asyncio.sleep(random.uniform(3, 5))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    print("\n" + "="*60)
    print("NETOPS GUARDIAN AI - DASHBOARD BACKEND v2.3")
    print("="*60)
    print("\nWebSocket: ws://localhost:8000/ws/metrics")
    print("REST: http://localhost:8000/api/dashboard/metrics")
    uvicorn.run(app, host="0.0.0.0", port=8000)
