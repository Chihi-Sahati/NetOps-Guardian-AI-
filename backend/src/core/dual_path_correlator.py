#!/usr/bin/env python3
"""
NetOps Guardian AI - Dual Path Correlation Engine
=================================================

Fast/Slow Event Processing Architecture
- Fast Path: <10ms for known patterns (FSM-based)
- Slow Path: <500ms for AI/ML analysis

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v1.0 - NOC/SOC Convergence
License: MIT

Architecture:
    ┌─────────────────────────────────────────────────────────────────┐
    │                    Event Ingress                                 │
    └─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                  Token Bucket Rate Limiter                      │
    │                  (Load Shedding Protection)                     │
    └─────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
    ┌───────────────────────────┐   ┌───────────────────────────┐
    │       FAST PATH           │   │       SLOW PATH           │
    │       (<10ms)             │   │       (<500ms)            │
    ├───────────────────────────┤   ├───────────────────────────┤
    │ • FSM Pattern Matching    │   │ • AI/ML Analysis          │
    │ • Rule-based Correlation  │   │ • Anomaly Detection       │
    │ • Pre-defined Templates   │   │ • Predictive Analysis     │
    │ • Cached Decisions        │   │ • Deep Pattern Discovery  │
    └───────────────────────────┘   └───────────────────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                 Unified Decision Matrix                         │
    │                 (NOC/SOC Convergence)                           │
    └─────────────────────────────────────────────────────────────────┘
"""

import asyncio
import hashlib
import json
import logging
import math
import random
import time
from abc import ABC, abstractmethod
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
from functools import wraps
import redis.asyncio as redis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("DualPathCorrelator")


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class EventSeverity(Enum):
    """Event severity levels"""
    DEBUG = 0
    INFO = 1
    WARNING = 2
    ERROR = 3
    CRITICAL = 4


class EventCategory(Enum):
    """Event categories for routing"""
    NETWORK_ALARM = "network_alarm"
    SECURITY_EVENT = "security_event"
    PERFORMANCE = "performance"
    CONFIGURATION = "configuration"
    SYSLOG = "syslog"
    FLOW = "flow"
    UNKNOWN = "unknown"


class PathType(Enum):
    """Processing path types"""
    FAST = "fast"
    SLOW = "slow"
    BOTH = "both"


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject all
    HALF_OPEN = "half_open"  # Testing recovery


class CorrelationResult(Enum):
    """Correlation outcome"""
    CORRELATED = "correlated"
    INCIDENT_CREATED = "incident_created"
    ESCALATED = "escalated"
    SUPPRESSED = "suppressed"
    DEFERRED = "deferred"
    REJECTED = "rejected"


# Time targets
FAST_PATH_TARGET_MS = 10
SLOW_PATH_TARGET_MS = 500


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class Event:
    """Network/Security event"""
    event_id: str
    timestamp: datetime
    category: EventCategory
    severity: EventSeverity

    # Source
    source_device_id: str
    source_device_name: str
    source_vendor: str
    source_ip: str
    source_site: str

    # Event details
    event_type: str
    event_code: str
    message: str
    raw_data: Dict[str, Any] = field(default_factory=dict)

    # Context
    related_events: List[str] = field(default_factory=list)
    correlation_id: Optional[str] = None
    incident_id: Optional[str] = None

    # Metadata
    processed: bool = False
    processing_path: Optional[PathType] = None
    processing_time_ms: float = 0.0


@dataclass
class CorrelationOutput:
    """Output from correlation engine"""
    event_id: str
    result: CorrelationResult
    confidence: float  # 0.0 to 1.0

    # Correlation details
    correlated_with: List[str] = field(default_factory=list)
    incident_id: Optional[str] = None
    recommended_actions: List[str] = field(default_factory=list)

    # Analysis
    root_cause: Optional[str] = None
    impact_assessment: Optional[str] = None
    risk_score: float = 0.0

    # Timing
    processing_path: PathType = PathType.FAST
    processing_time_ms: float = 0.0
    within_sla: bool = True


@dataclass
class TokenBucket:
    """Token bucket for rate limiting"""
    capacity: float
    tokens: float
    refill_rate: float  # tokens per second
    last_refill: float

    def consume(self, tokens: float = 1.0) -> bool:
        """Try to consume tokens"""
        now = time.time()

        # Refill tokens
        elapsed = now - self.last_refill
        self.tokens = min(
            self.capacity,
            self.tokens + elapsed * self.refill_rate
        )
        self.last_refill = now

        # Try to consume
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False


@dataclass
class CircuitBreaker:
    """Circuit breaker for fault tolerance"""
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    success_count: int = 0
    last_failure_time: float = 0.0

    # Thresholds
    failure_threshold: int = 5
    success_threshold: int = 3
    timeout_seconds: float = 30.0

    def record_success(self):
        """Record successful operation"""
        self.success_count += 1
        self.failure_count = 0

        if self.state == CircuitState.HALF_OPEN:
            if self.success_count >= self.success_threshold:
                self.state = CircuitState.CLOSED
                self.success_count = 0
                logger.info("Circuit breaker CLOSED - recovered")

    def record_failure(self):
        """Record failed operation"""
        self.failure_count += 1
        self.success_count = 0
        self.last_failure_time = time.time()

        if self.state == CircuitState.HALF_OPEN:
            self.state = CircuitState.OPEN
            logger.warning("Circuit breaker OPEN - failed in half-open")

        elif self.failure_count >= self.failure_threshold:
            self.state = CircuitState.OPEN
            logger.warning(f"Circuit breaker OPEN - {self.failure_count} failures")

    def is_available(self) -> bool:
        """Check if circuit allows requests"""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if timeout passed
            if time.time() - self.last_failure_time >= self.timeout_seconds:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                logger.info("Circuit breaker HALF_OPEN - testing")
                return True
            return False

        # HALF_OPEN
        return True


# =============================================================================
# FAST PATH - FSM BASED CORRELATION
# =============================================================================

class FastPathState(Enum):
    """FSM states for fast path"""
    IDLE = auto()
    ALARM_RECEIVED = auto()
    CORRELATION_CHECK = auto()
    PATTERN_MATCH = auto()
    DECISION = auto()
    OUTPUT = auto()


class FastPathEngine:
    """
    Fast Path Correlation Engine

    Uses Finite State Machine for pattern matching
    Target: <10ms processing time
    """

    def __init__(self, cache: Optional[redis.Redis] = None):
        self.cache = cache
        self.state = FastPathState.IDLE

        # Pattern library (pre-defined correlation rules)
        self.patterns = self._load_patterns()

        # Event windows for correlation
        self.event_windows: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=100)
        )

        # FSM transitions
        self.transitions = {
            FastPathState.IDLE: FastPathState.ALARM_RECEIVED,
            FastPathState.ALARM_RECEIVED: FastPathState.CORRELATION_CHECK,
            FastPathState.CORRELATION_CHECK: FastPathState.PATTERN_MATCH,
            FastPathState.PATTERN_MATCH: FastPathState.DECISION,
            FastPathState.DECISION: FastPathState.OUTPUT,
            FastPathState.OUTPUT: FastPathState.IDLE,
        }

        # Metrics
        self.metrics = {
            'events_processed': 0,
            'patterns_matched': 0,
            'avg_duration_ms': 0.0,
            'within_sla': 0,
            'total_duration_ms': 0.0,
        }

    def _load_patterns(self) -> Dict[str, Dict]:
        """Load pre-defined correlation patterns"""
        return {
            # Interface down cascade pattern
            'interface_down_cascade': {
                'trigger': ['link_down', 'interface_down'],
                'followed_by': ['bfd_down', 'ospf_neighbor_down', 'bgp_peer_down'],
                'within_seconds': 60,
                'action': 'create_incident',
                'priority': 'critical',
                'root_cause': 'physical_link_failure',
            },

            # BGP route flapping
            'bgp_flap': {
                'trigger': ['bgp_peer_down'],
                'count_threshold': 3,
                'within_seconds': 300,
                'action': 'suppress_alerts',
                'priority': 'warning',
                'root_cause': 'route_instability',
            },

            # CPU spike pattern
            'cpu_spike': {
                'trigger': ['high_cpu'],
                'threshold': 80,
                'followed_by': ['process_restart', 'service_degradation'],
                'within_seconds': 120,
                'action': 'escalate',
                'priority': 'major',
            },

            # Security incident pattern
            'security_breach_attempt': {
                'trigger': ['auth_failure', 'invalid_access'],
                'count_threshold': 5,
                'within_seconds': 60,
                'action': 'create_security_incident',
                'priority': 'critical',
                'category': 'security',
            },

            # Power supply failure
            'power_failure': {
                'trigger': ['power_supply_fail'],
                'followed_by': ['fan_fail', 'temp_high'],
                'within_seconds': 180,
                'action': 'create_incident',
                'priority': 'major',
                'root_cause': 'hardware_failure',
            },

            # MPLS LSP failure
            'mpls_lsp_failure': {
                'trigger': ['lsp_down'],
                'followed_by': ['vc_down', 'vpls_down'],
                'within_seconds': 30,
                'action': 'create_incident',
                'priority': 'major',
                'root_cause': 'mpls_control_plane',
            },

            # Device unreachable cascade
            'device_unreachable': {
                'trigger': ['device_unreachable'],
                'followed_by': ['snmp_timeout', 'icmp_timeout'],
                'within_seconds': 30,
                'action': 'create_incident',
                'priority': 'critical',
                'root_cause': 'network_connectivity',
            },
        }

    async def process(self, event: Event) -> CorrelationOutput:
        """
        Process event through FSM

        Target: <10ms
        """
        start_time = time.perf_counter()
        output = CorrelationOutput(
            event_id=event.event_id,
            result=CorrelationResult.DEFERRED,
            confidence=0.0,
            processing_path=PathType.FAST,
        )

        try:
            # Check cache for existing correlation
            if self.cache:
                cache_key = f"fast_correlation:{event.event_id}"
                cached = await self.cache.get(cache_key)
                if cached:
                    cached_data = json.loads(cached)
                    output.result = CorrelationResult(cached_data['result'])
                    output.confidence = cached_data['confidence']
                    output.correlated_with = cached_data.get('correlated_with', [])
                    output.processing_time_ms = (time.perf_counter() - start_time) * 1000
                    return output

            # FSM Processing
            self.state = FastPathState.ALARM_RECEIVED

            # State: CORRELATION_CHECK
            self.state = FastPathState.CORRELATION_CHECK
            window_key = f"{event.source_device_id}:{event.event_type}"
            self.event_windows[window_key].append(event)

            # Check for pattern match
            self.state = FastPathState.PATTERN_MATCH
            matched_pattern, correlated_events = await self._match_pattern(event)

            # Make decision
            self.state = FastPathState.DECISION
            if matched_pattern:
                pattern_config = self.patterns[matched_pattern]
                output.result = CorrelationResult.CORRELATED
                output.confidence = 0.85
                output.correlated_with = [e.event_id for e in correlated_events]
                output.root_cause = pattern_config.get('root_cause')
                output.recommended_actions = [pattern_config.get('action', 'review')]

                if pattern_config.get('action') == 'create_incident':
                    output.result = CorrelationResult.INCIDENT_CREATED

            else:
                # No pattern match - defer to slow path
                output.result = CorrelationResult.DEFERRED
                output.confidence = 0.5

            # Output state
            self.state = FastPathState.OUTPUT

            # Cache result
            if self.cache and output.result != CorrelationResult.DEFERRED:
                await self.cache.setex(
                    f"fast_correlation:{event.event_id}",
                    300,  # 5 minutes
                    json.dumps({
                        'result': output.result.value,
                        'confidence': output.confidence,
                        'correlated_with': output.correlated_with,
                    })
                )

        except Exception as e:
            logger.error(f"Fast path error: {e}")
            output.result = CorrelationResult.DEFERRED

        finally:
            # Reset to IDLE
            self.state = FastPathState.IDLE
            output.processing_time_ms = (time.perf_counter() - start_time) * 1000
            output.within_sla = output.processing_time_ms <= FAST_PATH_TARGET_MS

            # Update metrics
            self.metrics['events_processed'] += 1
            self.metrics['total_duration_ms'] += output.processing_time_ms
            self.metrics['avg_duration_ms'] = (
                self.metrics['total_duration_ms'] / self.metrics['events_processed']
            )
            if output.within_sla:
                self.metrics['within_sla'] += 1

        return output

    async def _match_pattern(self, event: Event) -> Tuple[Optional[str], List[Event]]:
        """
        Match event against known patterns

        Returns: (pattern_name, correlated_events) or (None, [])
        """
        for pattern_name, pattern_config in self.patterns.items():
            triggers = pattern_config.get('trigger', [])

            if event.event_type in triggers or event.event_code in triggers:
                # Check for followed_by events
                followed_by = pattern_config.get('followed_by', [])
                within_seconds = pattern_config.get('within_seconds', 60)
                count_threshold = pattern_config.get('count_threshold', 1)

                correlated = []
                window_key = f"{event.source_device_id}:{event.event_type}"
                window = self.event_windows[window_key]

                # Check recent events
                cutoff_time = datetime.utcnow() - timedelta(seconds=within_seconds)

                for recent_event in window:
                    if recent_event.timestamp >= cutoff_time:
                        if recent_event.event_id != event.event_id:
                            if (recent_event.event_type in followed_by or
                                recent_event.event_code in followed_by):
                                correlated.append(recent_event)

                # Check count threshold
                if count_threshold > 1:
                    recent_count = sum(
                        1 for e in window
                        if e.timestamp >= cutoff_time and
                        e.event_type in triggers
                    )
                    if recent_count >= count_threshold:
                        self.metrics['patterns_matched'] += 1
                        return pattern_name, list(window)[-count_threshold:]

                elif correlated:
                    self.metrics['patterns_matched'] += 1
                    return pattern_name, correlated

                # Single trigger match
                if not followed_by and count_threshold <= 1:
                    self.metrics['patterns_matched'] += 1
                    return pattern_name, []

        return None, []


# =============================================================================
# SLOW PATH - AI/ML BASED CORRELATION
# =============================================================================

class SlowPathEngine:
    """
    Slow Path Correlation Engine

    Uses AI/ML for advanced pattern discovery
    Target: <500ms processing time
    """

    def __init__(self, cache: Optional[redis.Redis] = None):
        self.cache = cache

        # Anomaly detection parameters
        self.baseline_window = 3600  # 1 hour baseline
        self.anomaly_threshold = 2.0  # standard deviations

        # Event history for ML
        self.event_history: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=10000)
        )

        # Feature extractors
        self.feature_extractors = {
            'temporal': self._extract_temporal_features,
            'spatial': self._extract_spatial_features,
            'structural': self._extract_structural_features,
        }

        # Memory Agent for Semantic Caching
        try:
            # Handle potential path issues by dynamically importing or adding to path
            import sys
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            if current_dir not in sys.path:
                sys.path.append(current_dir)
            
            from intent_engine.memory_agent import MemoryAgent
            self.memory_agent = MemoryAgent()
            logger.info("Memory Agent (Semantic Cache) enabled in Slow Path.")
        except ImportError as e:
            logger.warning(f"Failed to import MemoryAgent: {e}. Semantic Caching disabled.")
            self.memory_agent = None

        # Metrics
        self.metrics = {
            'events_processed': 0,
            'anomalies_detected': 0,
            'incidents_created': 0,
            'avg_duration_ms': 0.0,
            'within_sla': 0,
            'total_duration_ms': 0.0,
        }

    async def process(self, event: Event) -> CorrelationOutput:
        """
        Process event through AI/ML pipeline

        Target: <500ms
        """
        start_time = time.perf_counter()
        output = CorrelationOutput(
            event_id=event.event_id,
            result=CorrelationResult.DEFERRED,
            confidence=0.0,
            processing_path=PathType.SLOW,
        )

        try:
            # 1. Check Semantic Cache first (Sub-100ms Smart Path)
            if getattr(self, 'memory_agent', None):
                device_type = getattr(event, 'source_device_type', 'Unknown Device')
                context_str = f"Vendor: {event.source_vendor}, Type: {device_type}, " \
                              f"Event: {event.event_type} {event.event_code}, " \
                              f"Message: {event.message}"
                
                cached_remediation = self.memory_agent.retrieve_experience(context_str)
                if cached_remediation:
                    # Cache Hit!
                    output.result = CorrelationResult.INCIDENT_CREATED
                    output.confidence = cached_remediation['similarity']
                    output.recommended_actions = [cached_remediation['remediation']]
                    output.root_cause = cached_remediation['root_cause']
                    output.impact_assessment = "Resolved via Semantic Cache (Memory Agent)"
                    
                    # Log metrics and exit early
                    output.processing_time_ms = (time.perf_counter() - start_time) * 1000
                    output.within_sla = True
                    self.metrics['incidents_created'] += 1
                    return output

            # 2. Cache Miss - Proceed to full evaluation
            # Extract features
            features = await self._extract_features(event)

            # Anomaly detection
            anomaly_score = await self._detect_anomaly(event, features)

            # Correlation analysis
            correlated_events = await self._find_correlations(event, features)

            # Impact assessment
            impact = await self._assess_impact(event, features, anomaly_score)

            # Determine action
            if anomaly_score > 0.8:
                output.result = CorrelationResult.INCIDENT_CREATED
                output.confidence = anomaly_score
                output.risk_score = anomaly_score
                self.metrics['incidents_created'] += 1
                self.metrics['anomalies_detected'] += 1

            elif correlated_events:
                output.result = CorrelationResult.CORRELATED
                output.confidence = 0.75
                output.correlated_with = [e.event_id for e in correlated_events]
                output.risk_score = anomaly_score

            elif anomaly_score > 0.5:
                output.result = CorrelationResult.ESCALATED
                output.confidence = anomaly_score
                output.risk_score = anomaly_score
                self.metrics['anomalies_detected'] += 1

            else:
                output.result = CorrelationResult.SUPPRESSED
                output.confidence = 1.0 - anomaly_score
                output.risk_score = anomaly_score

            # Set analysis results
            output.impact_assessment = impact.get('description')
            output.root_cause = await self._predict_root_cause(event, features)

        except Exception as e:
            logger.error(f"Slow path error: {e}")
            output.result = CorrelationResult.DEFERRED

        finally:
            output.processing_time_ms = (time.perf_counter() - start_time) * 1000
            output.within_sla = output.processing_time_ms <= SLOW_PATH_TARGET_MS

            # Update metrics
            self.metrics['events_processed'] += 1
            self.metrics['total_duration_ms'] += output.processing_time_ms
            self.metrics['avg_duration_ms'] = (
                self.metrics['total_duration_ms'] / self.metrics['events_processed']
            )
            if output.within_sla:
                self.metrics['within_sla'] += 1

        return output

    async def _extract_features(self, event: Event) -> Dict[str, Any]:
        """Extract features for ML analysis"""
        features = {}

        for name, extractor in self.feature_extractors.items():
            features[name] = await extractor(event)

        return features

    async def _extract_temporal_features(self, event: Event) -> Dict[str, Any]:
        """Extract time-based features"""
        now = datetime.utcnow()
        hour = now.hour
        day_of_week = now.weekday()

        # Business hours check
        is_business_hours = 8 <= hour < 18 and day_of_week < 5

        # Event frequency in recent window
        device_key = f"{event.source_device_id}:{event.event_type}"
        recent_events = [
            e for e in self.event_history[device_key]
            if (now - e.timestamp).total_seconds() < 300  # 5 minutes
        ]
        event_frequency = len(recent_events)

        return {
            'hour': hour,
            'day_of_week': day_of_week,
            'is_business_hours': is_business_hours,
            'event_frequency_5m': event_frequency,
            'is_after_hours': not is_business_hours,
        }

    async def _extract_spatial_features(self, event: Event) -> Dict[str, Any]:
        """Extract location/network features"""
        # Check for events in same site/region
        site_events = sum(
            1 for events in self.event_history.values()
            for e in events
            if e.source_site == event.source_site and
            (datetime.utcnow() - e.timestamp).total_seconds() < 300
        )

        return {
            'site': event.source_site,
            'source_ip_class': self._classify_ip(event.source_ip),
            'events_in_site_5m': site_events,
        }

    async def _extract_structural_features(self, event: Event) -> Dict[str, Any]:
        """Extract network topology features"""
        return {
            'vendor': event.source_vendor,
            'category': event.category.value,
            'severity': event.severity.value,
            'has_related_events': len(event.related_events) > 0,
        }

    def _classify_ip(self, ip: str) -> str:
        """Classify IP address"""
        if ip.startswith('10.'):
            return 'private_class_a'
        elif ip.startswith('172.'):
            return 'private_class_b'
        elif ip.startswith('192.168.'):
            return 'private_class_c'
        else:
            return 'public'

    async def _detect_anomaly(self, event: Event, features: Dict) -> float:
        """
        Detect anomalies using statistical analysis

        Returns: anomaly score 0.0 to 1.0
        """
        device_key = f"{event.source_device_id}:{event.event_type}"

        # Get historical baseline
        history = list(self.event_history[device_key])
        if len(history) < 10:
            # Not enough history
            self.event_history[device_key].append(event)
            return 0.3

        # Calculate baseline statistics
        temporal = features.get('temporal', {})
        current_frequency = temporal.get('event_frequency_5m', 0)

        # Historical frequency distribution
        historical_freq = []
        for i in range(0, len(history) - 5, 5):
            window = history[i:i+5]
            freq = len([e for e in window if
                       (datetime.utcnow() - e.timestamp).total_seconds() < 300])
            historical_freq.append(freq)

        if historical_freq:
            mean_freq = sum(historical_freq) / len(historical_freq)
            std_freq = (sum((f - mean_freq) ** 2 for f in historical_freq) /
                       len(historical_freq)) ** 0.5

            if std_freq > 0:
                z_score = abs(current_frequency - mean_freq) / std_freq
                anomaly_score = min(1.0, z_score / self.anomaly_threshold)
            else:
                anomaly_score = 0.5 if current_frequency > mean_freq else 0.0
        else:
            anomaly_score = 0.0

        # Update history
        self.event_history[device_key].append(event)

        return anomaly_score

    async def _find_correlations(self, event: Event, features: Dict) -> List[Event]:
        """Find correlated events using similarity analysis"""
        correlated = []
        now = datetime.utcnow()
        window = timedelta(minutes=5)

        for key, history in self.event_history.items():
            if event.source_device_id in key:
                continue  # Skip same device

            for recent_event in history:
                if now - recent_event.timestamp > window:
                    continue

                # Check similarity
                similarity = self._calculate_similarity(event, recent_event)
                if similarity > 0.7:
                    correlated.append(recent_event)

        return correlated[:10]  # Limit to top 10

    def _calculate_similarity(self, event1: Event, event2: Event) -> float:
        """Calculate similarity between two events"""
        score = 0.0

        # Same event type
        if event1.event_type == event2.event_type:
            score += 0.3

        # Same severity
        if event1.severity == event2.severity:
            score += 0.2

        # Same site
        if event1.source_site == event2.source_site:
            score += 0.2

        # Same vendor
        if event1.source_vendor == event2.source_vendor:
            score += 0.1

        # Time proximity
        time_diff = abs((event1.timestamp - event2.timestamp).total_seconds())
        if time_diff < 60:
            score += 0.2
        elif time_diff < 300:
            score += 0.1

        return min(1.0, score)

    async def _assess_impact(self, event: Event, features: Dict,
                            anomaly_score: float) -> Dict[str, Any]:
        """Assess business impact"""
        severity_weights = {
            EventSeverity.DEBUG: 0.1,
            EventSeverity.INFO: 0.2,
            EventSeverity.WARNING: 0.4,
            EventSeverity.ERROR: 0.7,
            EventSeverity.CRITICAL: 0.9,
        }

        impact_score = severity_weights.get(event.severity, 0.5) * (1 + anomaly_score)

        if impact_score > 0.8:
            impact_level = "critical"
            description = "High business impact - immediate attention required"
        elif impact_score > 0.6:
            impact_level = "major"
            description = "Significant impact - action needed within 15 minutes"
        elif impact_score > 0.4:
            impact_level = "moderate"
            description = "Moderate impact - monitor closely"
        else:
            impact_level = "low"
            description = "Low impact - routine handling"

        return {
            'level': impact_level,
            'score': impact_score,
            'description': description,
        }

    async def _predict_root_cause(self, event: Event, features: Dict) -> str:
        """Predict root cause using pattern analysis"""
        # Simple rule-based prediction
        event_type = event.event_type.lower()

        if 'link' in event_type or 'interface' in event_type:
            if 'down' in event_type:
                return "physical_link_failure"
            elif 'flap' in event_type:
                return "unstable_connection"

        elif 'bgp' in event_type or 'ospf' in event_type:
            return "routing_protocol_issue"

        elif 'cpu' in event_type or 'memory' in event_type:
            return "resource_constraint"

        elif 'power' in event_type or 'fan' in event_type or 'temp' in event_type:
            return "hardware_failure"

        elif 'auth' in event_type or 'access' in event_type:
            return "security_incident"

        return "unknown"


# =============================================================================
# DUAL PATH CORRELATOR - MAIN CLASS
# =============================================================================

class DualPathCorrelator:
    """
    Dual Path Correlation Engine

    Combines Fast and Slow path processing with:
    - Token Bucket load shedding
    - Circuit Breaker fault tolerance
    - Unified decision matrix
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client: Optional[redis.Redis] = None

        # Initialize engines
        self.fast_engine = FastPathEngine()
        self.slow_engine = SlowPathEngine()

        # Token buckets for rate limiting
        self.fast_path_bucket = TokenBucket(
            capacity=10000,  # Max 10000 tokens
            tokens=10000,
            refill_rate=5000,  # 5000 tokens/second
            last_refill=time.time(),
        )

        self.slow_path_bucket = TokenBucket(
            capacity=500,  # Max 500 tokens
            tokens=500,
            refill_rate=100,  # 100 tokens/second
            last_refill=time.time(),
        )

        # Circuit breakers
        self.fast_circuit = CircuitBreaker(
            failure_threshold=5,
            success_threshold=3,
            timeout_seconds=10,
        )

        self.slow_circuit = CircuitBreaker(
            failure_threshold=3,
            success_threshold=2,
            timeout_seconds=30,
        )

        # Event queue for slow path
        self.slow_path_queue: asyncio.Queue = asyncio.Queue(maxsize=10000)

        # Metrics
        self.metrics = {
            'total_events': 0,
            'fast_path_processed': 0,
            'slow_path_processed': 0,
            'both_path_processed': 0,
            'fast_path_rejected': 0,
            'slow_path_rejected': 0,
            'avg_total_duration_ms': 0.0,
        }

        # Background task
        self._slow_path_worker_task: Optional[asyncio.Task] = None

    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            self.fast_engine.cache = self.redis_client
            self.slow_engine.cache = self.redis_client
            logger.info("Connected to Redis cache")

            # Start slow path worker
            self._slow_path_worker_task = asyncio.create_task(
                self._slow_path_worker()
            )

        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")

    async def disconnect(self):
        """Disconnect from Redis"""
        if self._slow_path_worker_task:
            self._slow_path_worker_task.cancel()
            try:
                await self._slow_path_worker_task
            except asyncio.CancelledError:
                pass

        if self.redis_client:
            await self.redis_client.close()

    def _determine_path(self, event: Event) -> PathType:
        """Determine which path(s) to use for event"""
        # Security events always go through both paths
        if event.category == EventCategory.SECURITY_EVENT:
            return PathType.BOTH

        # Critical events go through both paths
        if event.severity == EventSeverity.CRITICAL:
            return PathType.BOTH

        # Check if event matches known pattern (fast path candidate)
        for pattern_config in self.fast_engine.patterns.values():
            triggers = pattern_config.get('trigger', [])
            if event.event_type in triggers or event.event_code in triggers:
                return PathType.FAST

        # Default to both paths for comprehensive analysis
        return PathType.BOTH

    async def process(self, event: Event) -> CorrelationOutput:
        """
        Process event through dual path engine

        Returns combined result from fast and/or slow path
        """
        start_time = time.perf_counter()
        self.metrics['total_events'] += 1

        # Determine processing path
        path = self._determine_path(event)

        # Check load shedding
        fast_available = self.fast_circuit.is_available() and self.fast_path_bucket.consume()
        slow_available = self.slow_circuit.is_available()

        results = []

        # Fast path processing
        if path in [PathType.FAST, PathType.BOTH] and fast_available:
            try:
                fast_result = await self.fast_engine.process(event)
                results.append(('fast', fast_result))
                self.fast_circuit.record_success()
                self.metrics['fast_path_processed'] += 1
            except Exception as e:
                logger.error(f"Fast path failed: {e}")
                self.fast_circuit.record_failure()
        else:
            self.metrics['fast_path_rejected'] += 1

        # Slow path processing
        if path in [PathType.SLOW, PathType.BOTH]:
            if slow_available and self.slow_path_bucket.consume():
                try:
                    slow_result = await self.slow_engine.process(event)
                    results.append(('slow', slow_result))
                    self.slow_circuit.record_success()
                    self.metrics['slow_path_processed'] += 1
                except Exception as e:
                    logger.error(f"Slow path failed: {e}")
                    self.slow_circuit.record_failure()
            else:
                # Queue for later processing
                try:
                    await asyncio.wait_for(
                        self.slow_path_queue.put(event),
                        timeout=0.1
                    )
                except asyncio.TimeoutError:
                    logger.warning("Slow path queue full - event dropped")
                self.metrics['slow_path_rejected'] += 1

        # Combine results
        final_result = self._combine_results(event.event_id, results)
        final_result.processing_time_ms = (time.perf_counter() - start_time) * 1000

        return final_result

    def _combine_results(self, event_id: str,
                        results: List[Tuple[str, CorrelationOutput]]) -> CorrelationOutput:
        """Combine results from multiple paths"""
        if not results:
            return CorrelationOutput(
                event_id=event_id,
                result=CorrelationResult.REJECTED,
                confidence=0.0,
                processing_path=PathType.FAST,
            )

        if len(results) == 1:
            return results[0][1]

        # Both paths - combine confidence and take best result
        fast_result = next((r for p, r in results if p == 'fast'), None)
        slow_result = next((r for p, r in results if p == 'slow'), None)

        output = CorrelationOutput(
            event_id=event_id,
            processing_path=PathType.BOTH,
        )

        # Combine correlations
        all_correlated = []
        if fast_result:
            all_correlated.extend(fast_result.correlated_with)
            output.confidence = max(output.confidence, fast_result.confidence)
        if slow_result:
            all_correlated.extend(slow_result.correlated_with)
            output.confidence = max(output.confidence, slow_result.confidence)

        output.correlated_with = list(set(all_correlated))

        # Take higher risk score
        if fast_result:
            output.risk_score = max(output.risk_score, fast_result.risk_score)
        if slow_result:
            output.risk_score = max(output.risk_score, slow_result.risk_score)

        # Determine final result
        result_priority = {
            CorrelationResult.INCIDENT_CREATED: 5,
            CorrelationResult.ESCALATED: 4,
            CorrelationResult.CORRELATED: 3,
            CorrelationResult.SUPPRESSED: 2,
            CorrelationResult.DEFERRED: 1,
            CorrelationResult.REJECTED: 0,
        }

        best_result = CorrelationResult.DEFERRED
        for _, result in results:
            if result_priority.get(result.result, 0) > result_priority.get(best_result, 0):
                best_result = result.result

        output.result = best_result

        # Combine root causes and recommendations
        root_causes = []
        recommendations = []
        if fast_result and fast_result.root_cause:
            root_causes.append(fast_result.root_cause)
        if slow_result and slow_result.root_cause:
            root_causes.append(slow_result.root_cause)
        if fast_result:
            recommendations.extend(fast_result.recommended_actions)
        if slow_result:
            recommendations.extend(slow_result.recommended_actions)

        output.root_cause = root_causes[0] if root_causes else None
        output.recommended_actions = list(set(recommendations))

        if fast_result and fast_result.impact_assessment:
            output.impact_assessment = fast_result.impact_assessment
        elif slow_result and slow_result.impact_assessment:
            output.impact_assessment = slow_result.impact_assessment

        self.metrics['both_path_processed'] += 1

        return output

    async def _slow_path_worker(self):
        """Background worker for slow path queue"""
        while True:
            try:
                event = await asyncio.wait_for(
                    self.slow_path_queue.get(),
                    timeout=1.0
                )

                if self.slow_circuit.is_available() and self.slow_path_bucket.consume():
                    try:
                        result = await self.slow_engine.process(event)
                        self.slow_circuit.record_success()
                        logger.debug(f"Slow path processed queued event: {event.event_id}")
                    except Exception as e:
                        logger.error(f"Slow path worker error: {e}")
                        self.slow_circuit.record_failure()

            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Slow path worker unexpected error: {e}")

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        return {
            **self.metrics,
            'fast_path': self.fast_engine.metrics,
            'slow_path': self.slow_engine.metrics,
            'fast_circuit': {
                'state': self.fast_circuit.state.value,
                'failure_count': self.fast_circuit.failure_count,
            },
            'slow_circuit': {
                'state': self.slow_circuit.state.value,
                'failure_count': self.slow_circuit.failure_count,
            },
            'queue_size': self.slow_path_queue.qsize(),
        }


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

async def main():
    """Example usage of Dual Path Correlator"""
    # Initialize correlator
    correlator = DualPathCorrelator()
    await correlator.connect()

    # Create test event
    event = Event(
        event_id="evt-001",
        timestamp=datetime.utcnow(),
        category=EventCategory.NETWORK_ALARM,
        severity=EventSeverity.CRITICAL,

        source_device_id="router-core-01",
        source_device_name="Core-Router-01",
        source_vendor="Cisco",
        source_ip="10.0.1.1",
        source_site="DC-East",

        event_type="link_down",
        event_code="LINK_DOWN_001",
        message="Interface GigabitEthernet0/0/0/1 is down",
    )

    # Process event
    result = await correlator.process(event)

    print("\n" + "="*60)
    print("CORRELATION RESULT")
    print("="*60)
    print(f"Event ID: {result.event_id}")
    print(f"Result: {result.result.value}")
    print(f"Confidence: {result.confidence:.2f}")
    print(f"Risk Score: {result.risk_score:.2f}")
    print(f"Processing Path: {result.processing_path.value}")
    print(f"Duration: {result.processing_time_ms:.2f}ms")
    print(f"Within SLA: {result.within_sla}")

    if result.correlated_with:
        print(f"\nCorrelated Events: {result.correlated_with}")

    if result.root_cause:
        print(f"Root Cause: {result.root_cause}")

    if result.recommended_actions:
        print(f"Recommended Actions: {result.recommended_actions}")

    # Metrics
    print("\n" + "="*60)
    print("ENGINE METRICS")
    print("="*60)
    metrics = correlator.get_metrics()
    for key, value in metrics.items():
        if isinstance(value, dict):
            print(f"\n{key}:")
            for k, v in value.items():
                print(f"  {k}: {v}")
        else:
            print(f"{key}: {value}")

    await correlator.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
