#!/usr/bin/env python3
"""
NetOps Guardian AI - Intent State Enforcer
===========================================

Closed-loop continuous state enforcement and self-healing module.
Monitors network state against declarative intent and triggers remediation.

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v2.3 - IBNA Implementation
License: MIT
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Callable
from collections import deque

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("StateEnforcer")


class DriftType(Enum):
    THROUGHPUT_DEGRADATION = "throughput_degradation"
    LATENCY_VIOLATION = "latency_violation"
    AVAILABILITY_DROP = "availability_drop"
    CONFIGURATION_DRIFT = "configuration_drift"
    SECURITY_POLICY_VIOLATION = "security_policy_violation"
    CAPACITY_THRESHOLD = "capacity_threshold"


class RemediationStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    SUCCESS = "success"
    FAILED = "failed"
    ESCALATED = "escalated"


@dataclass
class StateDrift:
    """Represents detected drift from desired state"""
    drift_id: str
    drift_type: DriftType
    intent_id: str
    device_id: str
    expected_value: Any
    actual_value: Any
    deviation_percent: float
    detected_at: datetime
    severity: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RemediationAction:
    """Represents a self-healing remediation action"""
    action_id: str
    drift: StateDrift
    action_type: str
    config_changes: List[str]
    status: RemediationStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    retry_count: int = 0


class FastPathAnalyzer:
    """Fast Path Analyzer for deterministic drift detection (<10ms)"""
    
    def __init__(self):
        self.thresholds = {
            "throughput_tolerance_percent": 5.0,
            "latency_tolerance_percent": 10.0,
            "availability_tolerance_percent": 0.1,
            "capacity_warning_threshold": 80.0,
            "capacity_critical_threshold": 95.0
        }
    
    def detect_drift(
        self,
        target_intent: Dict[str, Any],
        current_state: Dict[str, Any]
    ) -> List[StateDrift]:
        """Detect drift between target intent and current state"""
        drifts = []
        desired = target_intent.get("desired_state", {})
        
        # Throughput drift detection
        if "throughput_gbps" in desired:
            expected = desired["throughput_gbps"]
            actual = current_state.get("throughput_gbps", 0)
            if actual < expected * (1 - self.thresholds["throughput_tolerance_percent"] / 100):
                deviation = ((expected - actual) / expected) * 100 if expected > 0 else 0
                drifts.append(StateDrift(
                    drift_id=f"DRIFT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-THR",
                    drift_type=DriftType.THROUGHPUT_DEGRADATION,
                    intent_id=target_intent.get("intent_id", "unknown"),
                    device_id=current_state.get("device_id", "unknown"),
                    expected_value=expected,
                    actual_value=actual,
                    deviation_percent=deviation,
                    detected_at=datetime.utcnow(),
                    severity="high" if deviation > 20 else "medium"
                ))
        
        # Latency drift detection
        if "latency_ms" in desired:
            expected = desired["latency_ms"]
            actual = current_state.get("latency_ms", float('inf'))
            tolerance = expected * self.thresholds["latency_tolerance_percent"] / 100
            if actual > expected + tolerance:
                deviation = ((actual - expected) / expected) * 100 if expected > 0 else 0
                drifts.append(StateDrift(
                    drift_id=f"DRIFT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-LAT",
                    drift_type=DriftType.LATENCY_VIOLATION,
                    intent_id=target_intent.get("intent_id", "unknown"),
                    device_id=current_state.get("device_id", "unknown"),
                    expected_value=expected,
                    actual_value=actual,
                    deviation_percent=deviation,
                    detected_at=datetime.utcnow(),
                    severity="critical" if deviation > 50 else "high"
                ))
        
        return drifts


class IntentEnforcer:
    """
    Core Intent Enforcer implementing closed-loop state management.
    Functions as a central service orchestrator for IBNA.
    """
    
    def __init__(
        self,
        target_intent: Dict[str, Any],
        network_interface: Optional[Any] = None
    ):
        self.target_intent = target_intent
        self.net_interface = network_interface
        self.analyzer = FastPathAnalyzer()
        
        # State tracking
        self.current_state: Dict[str, Any] = {}
        self.drift_history: deque = deque(maxlen=1000)
        self.remediation_history: List[RemediationAction] = []
        
        # Enforcement configuration
        self.monitoring_interval = 5
        self.auto_remediation_enabled = True
        self.max_retry_count = 3
        
        # Callbacks
        self.on_drift_detected: Optional[Callable] = None
        self.on_remediation_triggered: Optional[Callable] = None
        
        # Running state
        self._running = False
        self._last_check: Optional[datetime] = None
    
    def update_target_intent(self, new_intent: Dict[str, Any]):
        """Update the target declarative intent"""
        self.target_intent = new_intent
        logger.info(f"Updated target intent: {new_intent.get('intent_id', 'unknown')}")
    
    def update_current_state(self, telemetry: Dict[str, Any]):
        """Update current network state from telemetry"""
        self.current_state = telemetry
        self._last_check = datetime.utcnow()
    
    async def closed_loop_monitor(self):
        """Main closed-loop monitoring cycle"""
        self._running = True
        
        while self._running:
            try:
                # Detect drift using Fast Path Analyzer (<10ms)
                start_time = time.perf_counter()
                deviations = self.analyzer.detect_drift(self.target_intent, self.current_state)
                detection_time = (time.perf_counter() - start_time) * 1000
                
                if deviations:
                    logger.warning(f"Detected {len(deviations)} drift(s) in {detection_time:.2f}ms")
                    
                    for drift in deviations:
                        self.drift_history.append(drift)
                        
                        if self.on_drift_detected:
                            await self._safe_callback(self.on_drift_detected, drift)
                        
                        if self.auto_remediation_enabled:
                            await self.trigger_self_healing(drift)
                
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                logger.error(f"Monitoring cycle error: {e}")
                await asyncio.sleep(self.monitoring_interval)
    
    async def trigger_self_healing(self, drift: StateDrift):
        """Trigger automated remediation (self-healing)"""
        action_id = f"REM-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        remediation_payload = self._generate_correction(drift)
        
        action = RemediationAction(
            action_id=action_id,
            drift=drift,
            action_type=self._determine_action_type(drift),
            config_changes=remediation_payload,
            status=RemediationStatus.IN_PROGRESS,
            started_at=datetime.utcnow()
        )
        
        logger.info(f"Triggering self-healing: {action_id} for {drift.drift_type.value}")
        
        if self.on_remediation_triggered:
            await self._safe_callback(self.on_remediation_triggered, action)
        
        try:
            success = await self._simulate_remediation(drift)
            action.status = RemediationStatus.SUCCESS if success else RemediationStatus.FAILED
            action.completed_at = datetime.utcnow()
            
        except Exception as e:
            action.status = RemediationStatus.FAILED
            action.result = {"error": str(e)}
        
        self.remediation_history.append(action)
        return action
    
    def _generate_correction(self, drift: StateDrift) -> List[str]:
        """Generate configuration correction for drift"""
        corrections = []
        
        if drift.drift_type == DriftType.THROUGHPUT_DEGRADATION:
            corrections.extend([
                f"! Auto-remediation for throughput degradation",
                "policy-map THROUGHPUT-CORRECTION",
                " class class-default",
                f"  bandwidth percent 100"
            ])
        
        elif drift.drift_type == DriftType.LATENCY_VIOLATION:
            corrections.extend([
                f"! Auto-remediation for latency violation",
                "policy-map QOS-CORRECTION",
                " class LOW-LATENCY",
                "  priority level 1"
            ])
        
        return corrections
    
    def _determine_action_type(self, drift: StateDrift) -> str:
        """Determine remediation action type"""
        mapping = {
            DriftType.THROUGHPUT_DEGRADATION: "qos_adjustment",
            DriftType.LATENCY_VIOLATION: "priority_elevation",
            DriftType.AVAILABILITY_DROP: "redundancy_activation",
        }
        return mapping.get(drift.drift_type, "generic_remediation")
    
    async def _simulate_remediation(self, drift: StateDrift) -> bool:
        """Simulate remediation for testing"""
        await asyncio.sleep(0.05)
        return True
    
    async def _safe_callback(self, callback: Callable, *args):
        """Safely execute callback"""
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(*args)
            else:
                callback(*args)
        except Exception as e:
            logger.error(f"Callback error: {e}")
    
    def stop(self):
        """Stop the monitoring loop"""
        self._running = False
    
    def get_status(self) -> Dict[str, Any]:
        """Get current enforcer status"""
        return {
            "intent_id": self.target_intent.get("intent_id", "unknown"),
            "running": self._running,
            "total_drifts": len(self.drift_history),
            "total_remediations": len(self.remediation_history),
            "auto_remediation_enabled": self.auto_remediation_enabled
        }


# Example Usage
async def main():
    target_intent = {
        "intent_id": "INT-001",
        "name": "Premium Service SLA",
        "desired_state": {
            "throughput_gbps": 10,
            "latency_ms": 5,
            "availability": 99.99
        }
    }
    
    enforcer = IntentEnforcer(target_intent)
    
    current_state = {
        "device_id": "router-core-01",
        "throughput_gbps": 8.5,
        "latency_ms": 8,
    }
    
    enforcer.update_current_state(current_state)
    deviations = enforcer.analyzer.detect_drift(target_intent, current_state)
    
    print(f"Detected {len(deviations)} drift(s)")
    for d in deviations:
        print(f"  - {d.drift_type.value}: expected={d.expected_value}, actual={d.actual_value}")


if __name__ == "__main__":
    asyncio.run(main())
