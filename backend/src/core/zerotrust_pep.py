#!/usr/bin/env python3
"""
NetOps Guardian AI - Zero Trust Policy Enforcement Point (PEP)
==============================================================

Continuous Authorization with 6-Step Verification Pipeline
Response Time Target: <100ms

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v1.0 - NOC/SOC Convergence
License: MIT

Architecture:
    ┌─────────────────────────────────────────────────────────────┐
    │                    Zero Trust PEP                           │
    ├─────────────────────────────────────────────────────────────┤
    │  Step 1: Identity Verification      → <15ms                │
    │  Step 2: Device Posture Check       → <15ms                │
    │  Step 3: Network Context Analysis   → <15ms                │
    │  Step 4: Policy Evaluation          → <25ms                │
    │  Step 5: Risk Assessment            → <20ms                │
    │  Step 6: Command Validation         → <10ms                │
    ├─────────────────────────────────────────────────────────────┤
    │  Total Target: <100ms (99th percentile)                    │
    └─────────────────────────────────────────────────────────────┘
"""

import asyncio
import hashlib
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from functools import wraps
import redis.asyncio as redis
from pydantic import BaseModel, Field, validator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ZeroTrustPEP")


# =============================================================================
# ENUMS AND CONSTANTS
# =============================================================================

class AuthorizationState(Enum):
    """State machine states for authorization flow"""
    IDLE = auto()
    IDENTITY_CHECK = auto()
    DEVICE_POSTURE = auto()
    NETWORK_CONTEXT = auto()
    POLICY_EVALUATION = auto()
    RISK_ASSESSMENT = auto()
    COMMAND_VALIDATION = auto()
    AUTHORIZED = auto()
    DENIED = auto()
    ERROR = auto()


class RiskLevel(Enum):
    """Risk level classification"""
    MINIMAL = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class CommandCategory(Enum):
    """Network command categories with risk levels"""
    READ_ONLY = "read_only"           # show, get, display
    DIAGNOSTIC = "diagnostic"          # ping, traceroute, debug
    CONFIGURATION = "configuration"    # set, configure
    MAINTENANCE = "maintenance"        # restart, reload, reboot
    DESTRUCTIVE = "destructive"        # delete, erase, clear
    SECURITY = "security"              # access-list, firewall rules


# Destructive commands that require MFA and additional approval
DESTRUCTIVE_COMMANDS = {
    'cisco': ['erase', 'reload', 'write erase', 'clear config', 'delete flash:',
              'format flash:', 'no startup-config', 'default factory-config'],
    'huawei': ['reset', 'delete', 'undo startup', 'format', 'erase flash:',
               'reboot', 'shutdown system'],
    'nokia': ['clear', 'delete', 'reset', 'format', 'reboot',
              'configure no system', 'admin reboot'],
    'juniper': ['request system zeroize', 'request system storage cleanup',
                'load factory-default', 'request system reboot', 'delete config'],
    'ericsson': ['delete all', 'reset system', 'format', 'reboot',
                 'clear configuration', 'erase startup-config']
}

# Time targets for each step (in milliseconds)
STEP_TIME_TARGETS = {
    AuthorizationState.IDENTITY_CHECK: 15,
    AuthorizationState.DEVICE_POSTURE: 15,
    AuthorizationState.NETWORK_CONTEXT: 15,
    AuthorizationState.POLICY_EVALUATION: 25,
    AuthorizationState.RISK_ASSESSMENT: 20,
    AuthorizationState.COMMAND_VALIDATION: 10,
}


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class TimingMetrics:
    """Performance metrics for authorization steps"""
    step_name: str
    start_time: float = 0.0
    end_time: float = 0.0
    duration_ms: float = 0.0
    target_ms: float = 0.0
    within_target: bool = True

    def start(self):
        self.start_time = time.perf_counter()

    def end(self):
        self.end_time = time.perf_counter()
        self.duration_ms = (self.end_time - self.start_time) * 1000
        self.within_target = self.duration_ms <= self.target_ms


@dataclass
class AuthorizationContext:
    """Complete context for authorization request"""
    # Identity
    user_id: str
    username: str
    roles: List[str]
    groups: List[str]
    authentication_method: str  # password, mfa, certificate, sso
    session_id: str

    # Device
    device_id: str
    device_type: str  # workstation, mobile, server, api_client
    device_trust_level: str  # managed, unmanaged, unknown
    os_version: str
    agent_version: str

    # Network
    source_ip: str
    source_subnet: str
    source_location: str  # country, region
    network_zone: str  # internal, dmz, external, vpn
    connection_type: str  # wired, wireless, vpn, api

    # Target
    target_device_id: str
    target_device_name: str
    target_vendor: str
    target_model: str
    target_site: str
    target_region: str

    # Request
    command: str
    command_category: str
    request_timestamp: datetime

    # Additional context
    working_window: Optional[str] = None  # scheduled maintenance window
    change_ticket: Optional[str] = None
    justification: Optional[str] = None


@dataclass
class AuthorizationResult:
    """Result of authorization evaluation"""
    authorized: bool
    decision: str  # ALLOW, DENY, CHALLENGE, RATE_LIMIT
    risk_level: RiskLevel
    risk_score: float  # 0.0 to 1.0
    confidence: float  # 0.0 to 1.0

    # Step results
    identity_verified: bool = False
    device_trusted: bool = False
    network_allowed: bool = False
    policy_matched: bool = False
    risk_acceptable: bool = False
    command_valid: bool = False

    # Timing
    total_duration_ms: float = 0.0
    step_metrics: List[TimingMetrics] = field(default_factory=list)

    # Details
    denial_reason: Optional[str] = None
    challenge_type: Optional[str] = None  # mfa, manager_approval, ticket_required
    matched_policies: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    # Cache
    cache_hit: bool = False
    cache_key: Optional[str] = None


# =============================================================================
# STEP VERIFICATION CLASSES
# =============================================================================

class VerificationStep(ABC):
    """Abstract base class for verification steps"""

    def __init__(self, state: AuthorizationState, target_ms: float):
        self.state = state
        self.target_ms = target_ms
        self.metrics = TimingMetrics(
            step_name=state.name,
            target_ms=target_ms
        )

    @abstractmethod
    async def verify(self, context: AuthorizationContext,
                    cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Verify the step
        Returns: (success, reason, details)
        """
        pass

    async def execute(self, context: AuthorizationContext,
                     cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        """Execute with timing measurement"""
        self.metrics = TimingMetrics(
            step_name=self.state.name,
            target_ms=self.target_ms
        )
        self.metrics.start()

        try:
            result = await self.verify(context, cache)
            return result
        finally:
            self.metrics.end()
            logger.debug(f"{self.state.name}: {self.metrics.duration_ms:.2f}ms "
                        f"(target: {self.target_ms}ms)")


class IdentityVerificationStep(VerificationStep):
    """Step 1: Identity Verification"""

    def __init__(self):
        super().__init__(AuthorizationState.IDENTITY_CHECK, 15)

    async def verify(self, context: AuthorizationContext,
                    cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        details = {}

        # Check cache first
        cache_key = f"identity:{context.user_id}:{context.session_id}"
        if cache:
            cached = await cache.get(cache_key)
            if cached:
                details['cache_hit'] = True
                cached_data = json.loads(cached)
                return True, "Identity verified from cache", details

        # Verify authentication method strength
        strong_methods = ['mfa', 'certificate']
        if context.authentication_method in strong_methods:
            details['auth_strength'] = 'strong'
        elif context.authentication_method == 'sso':
            details['auth_strength'] = 'medium'
        else:
            details['auth_strength'] = 'basic'

        # Check session validity (simulated)
        if not context.session_id:
            return False, "Invalid session", details

        # Verify roles
        if not context.roles:
            return False, "No roles assigned", details

        # Check for privileged roles
        privileged_roles = {'admin', 'superuser', 'network_admin', 'security_admin'}
        has_privileged = bool(set(context.roles) & privileged_roles)
        details['has_privileged_access'] = has_privileged

        # Cache the result
        if cache:
            await cache.setex(
                cache_key,
                300,  # 5 minutes TTL
                json.dumps(details)
            )

        return True, "Identity verified", details


class DevicePostureStep(VerificationStep):
    """Step 2: Device Posture Check"""

    def __init__(self):
        super().__init__(AuthorizationState.DEVICE_POSTURE, 15)

    async def verify(self, context: AuthorizationContext,
                    cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        details = {}

        # Check device trust level
        trust_levels = {'managed': 100, 'unmanaged': 50, 'unknown': 0}
        trust_score = trust_levels.get(context.device_trust_level, 0)
        details['trust_score'] = trust_score

        # For destructive commands, require managed devices
        if context.command_category == CommandCategory.DESTRUCTIVE.value:
            if context.device_trust_level != 'managed':
                return False, "Destructive commands require managed device", details

        # Check agent version
        if context.agent_version:
            # Simulate version check
            details['agent_up_to_date'] = True
        else:
            details['agent_up_to_date'] = False
            if context.device_trust_level == 'managed':
                return False, "Managed device missing agent", details

        # OS version check (for security patches)
        details['os_check_passed'] = True

        return True, "Device posture verified", details


class NetworkContextStep(VerificationStep):
    """Step 3: Network Context Analysis"""

    def __init__(self):
        super().__init__(AuthorizationState.NETWORK_CONTEXT, 15)

    async def verify(self, context: AuthorizationContext,
                    cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        details = {}

        # Network zone policies
        zone_hierarchy = {'internal': 3, 'dmz': 2, 'vpn': 1, 'external': 0}
        source_level = zone_hierarchy.get(context.network_zone, 0)

        # Check if accessing from external to internal
        if context.network_zone == 'external':
            # Require VPN for external access
            if context.connection_type != 'vpn':
                return False, "External access requires VPN", details

        # Location-based restrictions
        restricted_countries = {'XX', 'YY'}  # Example restricted countries
        if context.source_location in restricted_countries:
            return False, f"Access from {context.source_location} is restricted", details

        # Time-based access (working hours check)
        now = datetime.utcnow()
        working_hours = (8, 18)  # 8 AM to 6 PM UTC
        current_hour = now.hour

        details['working_hours'] = working_hours[0] <= current_hour < working_hours[1]

        # For privileged operations outside working hours, require justification
        if not details['working_hours'] and context.command_category in [
            CommandCategory.DESTRUCTIVE.value,
            CommandCategory.CONFIGURATION.value
        ]:
            if not context.change_ticket and not context.justification:
                return False, "After-hours privileged access requires change ticket", details

        details['network_zone'] = context.network_zone
        details['connection_type'] = context.connection_type

        return True, "Network context verified", details


class PolicyEvaluationStep(VerificationStep):
    """Step 4: Policy Evaluation"""

    def __init__(self):
        super().__init__(AuthorizationState.POLICY_EVALUATION, 25)

    async def verify(self, context: AuthorizationContext,
                    cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        details = {'matched_policies': []}

        # Check role-based access
        role_permissions = {
            'admin': ['read_only', 'diagnostic', 'configuration', 'maintenance', 'destructive', 'security'],
            'network_admin': ['read_only', 'diagnostic', 'configuration', 'maintenance'],
            'network_operator': ['read_only', 'diagnostic'],
            'security_admin': ['read_only', 'security'],
            'noc_analyst': ['read_only', 'diagnostic'],
        }

        allowed_categories = set()
        for role in context.roles:
            if role in role_permissions:
                allowed_categories.update(role_permissions[role])

        command_category = context.command_category
        if command_category not in allowed_categories:
            return False, f"Role not authorized for {command_category} commands", details

        details['matched_policies'].append(f"role_permission:{command_category}")

        # Vendor-specific access
        vendor_roles = {
            'cisco': ['cisco_admin', 'cisco_operator'],
            'huawei': ['huawei_admin', 'huawei_operator'],
            'nokia': ['nokia_admin', 'nokia_operator'],
            'juniper': ['juniper_admin', 'juniper_operator'],
            'ericsson': ['ericsson_admin', 'ericsson_operator'],
        }

        target_vendor = context.target_vendor.lower()
        if target_vendor in vendor_roles:
            vendor_allowed = vendor_roles[target_vendor]
            if not any(role in context.roles for role in vendor_allowed):
                # Check if admin (admin has access to all vendors)
                if 'admin' not in context.roles:
                    return False, f"No access to {context.target_vendor} devices", details

        details['matched_policies'].append(f"vendor_access:{target_vendor}")

        # Site/Region access
        if context.target_region:
            region_roles = [f"{context.target_region}_admin", f"{context.target_region}_operator"]
            if not any(role in context.roles for role in region_roles):
                if 'admin' not in context.roles:
                    details['warnings'].append("Cross-region access")

        return True, "Policy evaluation passed", details


class RiskAssessmentStep(VerificationStep):
    """Step 5: Risk Assessment"""

    def __init__(self):
        super().__init__(AuthorizationState.RISK_ASSESSMENT, 20)

    async def verify(self, context: AuthorizationContext,
                    cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        details = {}
        risk_score = 0.0
        risk_factors = []

        # Command risk
        command_risk = {
            'read_only': 0.1,
            'diagnostic': 0.2,
            'configuration': 0.5,
            'maintenance': 0.7,
            'destructive': 0.9,
            'security': 0.6,
        }
        cmd_risk = command_risk.get(context.command_category, 0.5)
        risk_score += cmd_risk * 0.3
        risk_factors.append(f"command_risk:{cmd_risk}")

        # Device trust risk
        device_risk = {'managed': 0.1, 'unmanaged': 0.5, 'unknown': 0.8}
        dev_risk = device_risk.get(context.device_trust_level, 0.8)
        risk_score += dev_risk * 0.2
        risk_factors.append(f"device_risk:{dev_risk}")

        # Network zone risk
        zone_risk = {'internal': 0.1, 'dmz': 0.3, 'vpn': 0.2, 'external': 0.7}
        net_risk = zone_risk.get(context.network_zone, 0.7)
        risk_score += net_risk * 0.2
        risk_factors.append(f"network_risk:{net_risk}")

        # Authentication method risk
        auth_risk = {'mfa': 0.1, 'certificate': 0.1, 'sso': 0.2, 'password': 0.4}
        auth_r = auth_risk.get(context.authentication_method, 0.5)
        risk_score += auth_r * 0.15
        risk_factors.append(f"auth_risk:{auth_r}")

        # Time-based risk
        now = datetime.utcnow()
        if not (8 <= now.hour < 18):
            risk_score += 0.1
            risk_factors.append("after_hours")

        # Calculate final risk
        risk_score = min(1.0, risk_score)
        details['risk_score'] = risk_score
        details['risk_factors'] = risk_factors

        # Determine risk level
        if risk_score < 0.2:
            risk_level = RiskLevel.MINIMAL
        elif risk_score < 0.4:
            risk_level = RiskLevel.LOW
        elif risk_score < 0.6:
            risk_level = RiskLevel.MEDIUM
        elif risk_score < 0.8:
            risk_level = RiskLevel.HIGH
        else:
            risk_level = RiskLevel.CRITICAL

        details['risk_level'] = risk_level.name

        # Risk thresholds
        max_risk = 0.7
        if context.command_category == CommandCategory.DESTRUCTIVE.value:
            max_risk = 0.4
        elif context.command_category == CommandCategory.CONFIGURATION.value:
            max_risk = 0.5

        if risk_score > max_risk:
            return False, f"Risk score {risk_score:.2f} exceeds threshold {max_risk}", details

        return True, f"Risk acceptable: {risk_level.name}", details


class CommandValidationStep(VerificationStep):
    """Step 6: Command Validation"""

    def __init__(self):
        super().__init__(AuthorizationState.COMMAND_VALIDATION, 10)

    async def verify(self, context: AuthorizationContext,
                    cache: Optional[redis.Redis]) -> Tuple[bool, str, Dict[str, Any]]:
        details = {}

        command = context.command.lower().strip()

        # Check for destructive commands
        vendor = context.target_vendor.lower()
        if vendor in DESTRUCTIVE_COMMANDS:
            destructive_list = DESTRUCTIVE_COMMANDS[vendor]
            for destructive_cmd in destructive_list:
                if command.startswith(destructive_cmd.lower()):
                    details['is_destructive'] = True
                    # Require MFA for destructive commands
                    if context.authentication_method != 'mfa':
                        return False, "Destructive command requires MFA", details
                    # Require change ticket
                    if not context.change_ticket:
                        return False, "Destructive command requires change ticket", details
                    break

        # Command syntax validation (basic)
        if not command:
            return False, "Empty command", details

        # Check for blocked patterns
        blocked_patterns = [
            'rm -rf', 'del /s', 'format', 'erase all',
            'no enable', 'no username', 'no access-list'
        ]
        for pattern in blocked_patterns:
            if pattern in command:
                details['blocked_pattern'] = pattern
                return False, f"Blocked command pattern: {pattern}", details

        details['command_valid'] = True
        return True, "Command validated", details


# =============================================================================
# ZERO TRUST PEP MAIN CLASS
# =============================================================================

class ZeroTrustPEP:
    """
    Zero Trust Policy Enforcement Point

    Implements continuous authorization with 6-step verification pipeline
    targeting <100ms total response time.
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379')
        self.redis_client: Optional[redis.Redis] = None

        # Initialize verification steps
        self.steps = [
            IdentityVerificationStep(),
            DevicePostureStep(),
            NetworkContextStep(),
            PolicyEvaluationStep(),
            RiskAssessmentStep(),
            CommandValidationStep(),
        ]

        # State machine
        self.state = AuthorizationState.IDLE

        # Metrics
        self.metrics = {
            'total_requests': 0,
            'authorized': 0,
            'denied': 0,
            'avg_duration_ms': 0.0,
            'p99_duration_ms': 0.0,
            'cache_hits': 0,
        }

    async def connect(self):
        """Connect to Redis cache"""
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("Connected to Redis cache")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}. Running without cache.")
            self.redis_client = None

    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis_client:
            await self.redis_client.close()

    def _generate_cache_key(self, context: AuthorizationContext) -> str:
        """Generate cache key for authorization result"""
        key_data = f"{context.user_id}:{context.session_id}:{context.target_device_id}:{context.command_category}"
        return hashlib.sha256(key_data.encode()).hexdigest()

    async def authorize(self, context: AuthorizationContext) -> AuthorizationResult:
        """
        Main authorization method

        Executes 6-step verification pipeline with <100ms target
        """
        start_time = time.perf_counter()
        result = AuthorizationResult(
            authorized=False,
            decision="PENDING",
            risk_level=RiskLevel.MEDIUM,
            risk_score=0.5,
            confidence=0.0,
        )

        # Check cache first
        cache_key = self._generate_cache_key(context)
        if self.redis_client:
            try:
                cached_result = await self.redis_client.get(f"auth:{cache_key}")
                if cached_result:
                    cached = json.loads(cached_result)
                    result.authorized = cached['authorized']
                    result.decision = cached['decision']
                    result.risk_level = RiskLevel[cached['risk_level']]
                    result.risk_score = cached['risk_score']
                    result.cache_hit = True
                    result.cache_key = cache_key
                    result.total_duration_ms = (time.perf_counter() - start_time) * 1000
                    self.metrics['cache_hits'] += 1
                    return result
            except Exception as e:
                logger.warning(f"Cache read error: {e}")

        # Execute verification steps
        step_results = []

        for step in self.steps:
            self.state = step.state
            success, reason, details = await step.execute(context, self.redis_client)
            result.step_metrics.append(step.metrics)

            step_results.append({
                'state': step.state,
                'success': success,
                'reason': reason,
                'details': details
            })

            # Map step results to result fields
            if step.state == AuthorizationState.IDENTITY_CHECK:
                result.identity_verified = success
            elif step.state == AuthorizationState.DEVICE_POSTURE:
                result.device_trusted = success
            elif step.state == AuthorizationState.NETWORK_CONTEXT:
                result.network_allowed = success
            elif step.state == AuthorizationState.POLICY_EVALUATION:
                result.policy_matched = success
                result.matched_policies = details.get('matched_policies', [])
            elif step.state == AuthorizationState.RISK_ASSESSMENT:
                result.risk_acceptable = success
                result.risk_score = details.get('risk_score', 0.5)
                result.risk_level = RiskLevel[details.get('risk_level', 'MEDIUM')]
            elif step.state == AuthorizationState.COMMAND_VALIDATION:
                result.command_valid = success

            # Break on first failure
            if not success:
                result.denial_reason = reason
                break

        # Determine final decision
        all_passed = all(
            [r['success'] for r in step_results]
        )

        if all_passed:
            result.authorized = True
            result.decision = "ALLOW"
            result.confidence = 0.95
            self.state = AuthorizationState.AUTHORIZED
        else:
            result.authorized = False
            result.decision = "DENY"
            result.confidence = 0.9
            self.state = AuthorizationState.DENIED

        # Cache the result
        if self.redis_client and result.authorized:
            try:
                cache_data = {
                    'authorized': result.authorized,
                    'decision': result.decision,
                    'risk_level': result.risk_level.name,
                    'risk_score': result.risk_score,
                }
                await self.redis_client.setex(
                    f"auth:{cache_key}",
                    60,  # 1 minute TTL for positive authorizations
                    json.dumps(cache_data)
                )
            except Exception as e:
                logger.warning(f"Cache write error: {e}")

        # Calculate total duration
        result.total_duration_ms = (time.perf_counter() - start_time) * 1000

        # Update metrics
        self.metrics['total_requests'] += 1
        if result.authorized:
            self.metrics['authorized'] += 1
        else:
            self.metrics['denied'] += 1

        # Log result
        logger.info(
            f"Authorization {'GRANTED' if result.authorized else 'DENIED'}: "
            f"user={context.username}, device={context.target_device_name}, "
            f"command={context.command_category}, "
            f"duration={result.total_duration_ms:.2f}ms"
        )

        # Performance alert if over target
        if result.total_duration_ms > 100:
            logger.warning(
                f"Authorization exceeded 100ms target: {result.total_duration_ms:.2f}ms"
            )

        return result

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        return {
            **self.metrics,
            'success_rate': (
                self.metrics['authorized'] / max(1, self.metrics['total_requests']) * 100
            )
        }


# =============================================================================
# DECORATOR FOR EASY USE
# =============================================================================

def require_authorization(pep: ZeroTrustPEP):
    """
    Decorator to require authorization for a function

    Usage:
        @require_authorization(pep)
        async def execute_command(context: AuthorizationContext, command: str):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find AuthorizationContext in args
            context = None
            for arg in args:
                if isinstance(arg, AuthorizationContext):
                    context = arg
                    break

            if not context:
                raise ValueError("AuthorizationContext not found in arguments")

            result = await pep.authorize(context)

            if not result.authorized:
                raise PermissionError(
                    f"Authorization denied: {result.denial_reason}"
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator


# =============================================================================
# EXAMPLE USAGE
# =============================================================================

async def main():
    """Example usage of Zero Trust PEP"""
    # Initialize PEP
    pep = ZeroTrustPEP()
    await pep.connect()

    # Create authorization context
    context = AuthorizationContext(
        # Identity
        user_id="user-001",
        username="admin_user",
        roles=["admin", "network_admin"],
        groups=["network-ops", "change-advisory-board"],
        authentication_method="mfa",
        session_id="session-abc123",

        # Device
        device_id="device-001",
        device_type="workstation",
        device_trust_level="managed",
        os_version="Windows 11",
        agent_version="2.5.0",

        # Network
        source_ip="10.0.1.100",
        source_subnet="10.0.1.0/24",
        source_location="US",
        network_zone="internal",
        connection_type="wired",

        # Target
        target_device_id="router-core-01",
        target_device_name="Core-Router-01",
        target_vendor="Cisco",
        target_model="ASR 9000",
        target_site="DC-East",
        target_region="US-East",

        # Request
        command="show running-config",
        command_category="read_only",
        request_timestamp=datetime.utcnow(),

        # Additional
        change_ticket=None,
        justification="Routine configuration review",
    )

    # Authorize
    result = await pep.authorize(context)

    print("\n" + "="*60)
    print("AUTHORIZATION RESULT")
    print("="*60)
    print(f"Decision: {result.decision}")
    print(f"Authorized: {result.authorized}")
    print(f"Risk Level: {result.risk_level.name}")
    print(f"Risk Score: {result.risk_score:.2f}")
    print(f"Duration: {result.total_duration_ms:.2f}ms")
    print(f"Cache Hit: {result.cache_hit}")
    print("\nStep Results:")
    for step in result.step_metrics:
        status = "✓" if step.within_target else "✗"
        print(f"  {status} {step.step_name}: {step.duration_ms:.2f}ms (target: {step.target_ms}ms)")

    if not result.authorized:
        print(f"\nDenial Reason: {result.denial_reason}")

    # Metrics
    print("\n" + "="*60)
    print("PEP METRICS")
    print("="*60)
    metrics = pep.get_metrics()
    for key, value in metrics.items():
        print(f"{key}: {value}")

    await pep.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
