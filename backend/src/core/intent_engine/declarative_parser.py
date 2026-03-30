#!/usr/bin/env python3
"""
NetOps Guardian AI - Declarative Intent Parser
===============================================

Translates declarative YAML/JSON intents into vendor-specific configurations.
Supports Intent-Based Network Automation (IBNA) paradigm.

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v2.3 - IBNA Implementation
License: MIT
"""

import yaml
import json
import re
import logging
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("DeclarativeParser")


class IntentType(Enum):
    SERVICE_PROVISIONING = "service_provisioning"
    QOS_GUARANTEE = "qos_guarantee"
    SECURITY_POLICY = "security_policy"
    CONNECTIVITY = "connectivity"
    CAPACITY = "capacity"
    RESILIENCE = "resilience"


class IntentStatus(Enum):
    PENDING = "pending"
    TRANSLATING = "translating"
    VALIDATED = "validated"
    DEPLOYED = "deployed"
    ENFORCING = "enforcing"
    DEGRADED = "degraded"
    FAILED = "failed"


@dataclass
class DeclarativeIntent:
    """Represents a declarative intent definition"""
    intent_id: str
    name: str
    intent_type: IntentType
    desired_state: Dict[str, Any]
    target_services: List[str]
    target_devices: List[str]
    constraints: Dict[str, Any] = field(default_factory=dict)
    priority: int = 5
    created_at: datetime = field(default_factory=datetime.utcnow)
    status: IntentStatus = IntentStatus.PENDING
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TranslatedConfig:
    """Vendor-specific translated configuration"""
    device_id: str
    vendor: str
    config_lines: List[str]
    validation_result: Dict[str, Any]
    rollback_config: Optional[List[str]] = None
    translated_at: datetime = field(default_factory=datetime.utcnow)


class DeclarativeParser:
    """
    Parses declarative YAML/JSON intents into vendor-specific configurations.
    
    Example Intent:
        name: "Ensure 10Gbps throughput for Premium Service X"
        desired_state:
          throughput_gbps: 10
          availability: 99.99
          latency_ms: 5
        target_services: ["premium-service-x"]
        constraints:
          max_cost: 1000
          priority: high
    """
    
    def __init__(self):
        self.intent_registry: Dict[str, DeclarativeIntent] = {}
        self.vendor_translators = {
            "cisco": self._translate_cisco,
            "huawei": self._translate_huawei,
            "nokia": self._translate_nokia,
            "juniper": self._translate_juniper,
            "ericsson": self._translate_ericsson
        }
        self.intent_patterns = self._load_intent_patterns()
        
    def _load_intent_patterns(self) -> Dict[str, Any]:
        """Load patterns for intent recognition"""
        return {
            "throughput": {
                "keywords": ["throughput", "bandwidth", "speed", "rate"],
                "units": ["gbps", "mbps", "kbps"],
                "default_unit": "gbps"
            },
            "availability": {
                "keywords": ["availability", "uptime", "sla"],
                "units": ["percent", "%"],
                "default_unit": "percent"
            },
            "latency": {
                "keywords": ["latency", "delay", "response_time"],
                "units": ["ms", "us", "s"],
                "default_unit": "ms"
            },
            "resilience": {
                "keywords": ["resilience", "redundancy", "failover"],
                "units": ["instances", "paths"],
                "default_unit": "instances"
            }
        }
    
    def parse_yaml_intent(self, yaml_content: str) -> DeclarativeIntent:
        """Parse YAML-formatted intent definition"""
        try:
            data = yaml.safe_load(yaml_content)
            return self._create_intent_from_dict(data)
        except yaml.YAMLError as e:
            logger.error(f"YAML parsing error: {e}")
            raise ValueError(f"Invalid YAML format: {e}")
    
    def parse_json_intent(self, json_content: str) -> DeclarativeIntent:
        """Parse JSON-formatted intent definition"""
        try:
            data = json.loads(json_content)
            return self._create_intent_from_dict(data)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error: {e}")
            raise ValueError(f"Invalid JSON format: {e}")
    
    def _create_intent_from_dict(self, data: Dict[str, Any]) -> DeclarativeIntent:
        """Create DeclarativeIntent from dictionary"""
        intent_type = IntentType(data.get("type", "service_provisioning"))
        
        intent = DeclarativeIntent(
            intent_id=data.get("intent_id", f"INT-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"),
            name=data.get("name", "Unnamed Intent"),
            intent_type=intent_type,
            desired_state=data.get("desired_state", {}),
            target_services=data.get("target_services", []),
            target_devices=data.get("target_devices", []),
            constraints=data.get("constraints", {}),
            priority=data.get("priority", 5),
            metadata=data.get("metadata", {})
        )
        
        self.intent_registry[intent.intent_id] = intent
        logger.info(f"Parsed intent: {intent.intent_id} - {intent.name}")
        return intent
    
    def translate_intent(self, intent: DeclarativeIntent, device_configs: Dict[str, Dict]) -> List[TranslatedConfig]:
        """Translate intent to vendor-specific configurations"""
        translations = []
        
        for device_id, device_info in device_configs.items():
            if device_id not in intent.target_devices:
                continue
                
            vendor = device_info.get("vendor", "cisco").lower()
            translator = self.vendor_translators.get(vendor)
            
            if not translator:
                logger.warning(f"No translator for vendor: {vendor}")
                continue
            
            config_lines = translator(intent, device_info)
            
            translation = TranslatedConfig(
                device_id=device_id,
                vendor=vendor,
                config_lines=config_lines,
                validation_result={"status": "pending"},
                rollback_config=self._generate_rollback(config_lines, vendor)
            )
            translations.append(translation)
            
        logger.info(f"Translated intent {intent.intent_id} to {len(translations)} device configs")
        return translations
    
    def _translate_cisco(self, intent: DeclarativeIntent, device_info: Dict) -> List[str]:
        """Translate to Cisco IOS-XR configuration"""
        lines = []
        desired = intent.desired_state
        
        if "throughput_gbps" in desired:
            throughput = desired["throughput_gbps"]
            lines.append(f"! Intent: Ensure {throughput}Gbps throughput")
            lines.append("policy-map THROUGHPUT-POLICY")
            lines.append(f" class class-default")
            lines.append(f"  bandwidth remaining percent 100")
        
        if "qos_profile" in desired:
            qos = desired["qos_profile"]
            lines.append(f"class-map match-all {qos.get('class_name', 'PREMIUM')}")
            lines.append(f" match dscp {qos.get('dscp', 'ef')}")
        
        if "latency_ms" in desired:
            latency = desired["latency_ms"]
            lines.append(f"! Target latency: {latency}ms")
            lines.append("interface Tunnel0")
            lines.append(" qos pre-classify")
        
        return lines
    
    def _translate_huawei(self, intent: DeclarativeIntent, device_info: Dict) -> List[str]:
        """Translate to Huawei VRP configuration"""
        lines = []
        desired = intent.desired_state
        
        if "throughput_gbps" in desired:
            throughput = desired["throughput_gbps"]
            lines.append(f"# Intent: Ensure {throughput}Gbps throughput")
            lines.append("traffic classifier THROUGHPUT")
            lines.append(" if-match any")
        
        return lines
    
    def _translate_nokia(self, intent: DeclarativeIntent, device_info: Dict) -> List[str]:
        """Translate to Nokia SR-OS configuration"""
        lines = []
        desired = intent.desired_state
        lines.append("# Nokia SR-OS Intent Configuration")
        return lines
    
    def _translate_juniper(self, intent: DeclarativeIntent, device_info: Dict) -> List[str]:
        """Translate to Juniper JunOS configuration"""
        lines = []
        desired = intent.desired_state
        if "throughput_gbps" in desired:
            lines.append(f"/* Intent: Ensure {desired['throughput_gbps']}Gbps */")
        return lines
    
    def _translate_ericsson(self, intent: DeclarativeIntent, device_info: Dict) -> List[str]:
        """Translate to Ericsson configuration"""
        lines = []
        desired = intent.desired_state
        lines.append(f"// Ericsson Intent Configuration")
        return lines
    
    def _generate_rollback(self, config_lines: List[str], vendor: str) -> List[str]:
        """Generate rollback configuration"""
        rollback = []
        for line in reversed(config_lines):
            if not line.startswith("!") and not line.startswith("#"):
                rollback.append(f"no {line}")
        return rollback
    
    def validate_intent_syntax(self, intent: DeclarativeIntent) -> Dict[str, Any]:
        """Validate intent syntax and constraints"""
        result = {"valid": True, "errors": [], "warnings": []}
        
        if not intent.name:
            result["errors"].append("Intent name is required")
            result["valid"] = False
        
        if not intent.desired_state:
            result["errors"].append("Desired state is required")
            result["valid"] = False
        
        return result


# Example Usage
if __name__ == "__main__":
    parser = DeclarativeParser()
    
    yaml_intent = """
name: "Ensure Premium Service SLA"
type: "qos_guarantee"
desired_state:
  throughput_gbps: 10
  availability: 99.99
  latency_ms: 5
target_services:
  - premium-service-x
target_devices:
  - router-core-01
"""
    
    intent = parser.parse_yaml_intent(yaml_intent)
    print(f"Parsed Intent: {intent.intent_id} - {intent.name}")
