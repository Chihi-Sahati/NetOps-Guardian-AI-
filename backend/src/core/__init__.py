#!/usr/bin/env python3
"""
NetOps Guardian AI - Core Module
================================

This module contains the core components for the NOC AI Agent:

- ZeroTrustPEP: Policy Enforcement Point with 6-step continuous authorization
- DualPathCorrelator: Fast/Slow event correlation engine

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v1.0 - NOC/SOC Convergence
"""

from .zerotrust_pep import (
    ZeroTrustPEP,
    AuthorizationContext,
    AuthorizationResult,
    AuthorizationState,
    RiskLevel,
    CommandCategory,
    require_authorization,
)

from .dual_path_correlator import (
    DualPathCorrelator,
    Event,
    EventCategory,
    EventSeverity,
    CorrelationOutput,
    CorrelationResult,
    PathType,
    CircuitState,
)

__all__ = [
    # Zero Trust PEP
    'ZeroTrustPEP',
    'AuthorizationContext',
    'AuthorizationResult',
    'AuthorizationState',
    'RiskLevel',
    'CommandCategory',
    'require_authorization',

    # Dual Path Correlator
    'DualPathCorrelator',
    'Event',
    'EventCategory',
    'EventSeverity',
    'CorrelationOutput',
    'CorrelationResult',
    'PathType',
    'CircuitState',
]

__version__ = '1.0.0'
__author__ = 'Hussein'
__supervisor__ = 'Dr. Houda Chihi'
