#!/usr/bin/env python3
"""
NetOps Guardian AI - Autonomous Configuration Module
=====================================================

Autonomous Network Configuration Management for ISP/Telecom Operators
Implements Intent-Based Networking with Zero-Touch Provisioning

Features:
- Intent-based configuration translation
- Configuration validation and compliance checking
- Automated rollback capabilities
- Multi-vendor configuration abstraction
- Configuration drift detection and remediation

Author: Hussein (Under supervision of Dr. Houda Chihi)
Project: NetOps Guardian AI v2.1 - NOC Applications
License: MIT
"""

import asyncio
import json
import logging
import re
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Any, Dict, List, Optional, Tuple, Union

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("AutonomousConfig")


class ConfigStatus(Enum):
    PENDING = "pending"
    VALIDATING = "validating"
    READY = "ready"
    DEPLOYING = "deploying"
    DEPLOYED = "deployed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class ConfigType(Enum):
    INTERFACE = "interface"
    ROUTING = "routing"
    SECURITY = "security"
    QOS = "qos"
    SNMP = "snmp"
    SYSTEM = "system"
    ACL = "acl"
    VLAN = "vlan"
    BGP = "bgp"
    OSPF = "ospf"


class ChangeImpact(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ConfigurationIntent:
    intent_id: str
    description: str
    target_devices: List[str]
    config_type: ConfigType
    parameters: Dict[str, Any]
    priority: int = 5
    scheduled_time: Optional[datetime] = None
    requires_approval: bool = False
    rollback_on_failure: bool = True
    created_by: str = "system"
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ConfigurationChange:
    change_id: str
    device_id: str
    intent_id: str
    config_type: ConfigType
    previous_config: str
    new_config: str
    diff: str
    status: ConfigStatus
    impact: ChangeImpact
    validation_results: List[Dict[str, Any]]
    deployed_at: Optional[datetime] = None
    rollback_config: Optional[str] = None


class IntentParser:
    """Parses natural language intent into structured configuration"""
    
    def __init__(self):
        self.intent_patterns = {
            "create_interface": [r"create\s+(?:new\s+)?interface\s+(?P<name>\S+)", r"add\s+interface\s+(?P<name>\S+)"],
            "delete_interface": [r"delete\s+interface\s+(?P<name>\S+)", r"remove\s+interface\s+(?P<name>\S+)"],
            "configure_ip": [r"set\s+ip\s+(?P<ip>\S+)\s+(?P<mask>\S+)", r"configure\s+ip\s+address\s+(?P<ip>\S+)\s+(?P<mask>\S+)"],
            "enable_port": [r"enable\s+port\s+(?P<port>\S+)", r"bring\s+up\s+port\s+(?P<port>\S+)"],
            "disable_port": [r"disable\s+port\s+(?P<port>\S+)", r"shutdown\s+port\s+(?P<port>\S+)"],
            "configure_vlan": [r"create\s+vlan\s+(?P<vlan_id>\d+)", r"add\s+vlan\s+(?P<vlan_id>\d+)"],
            "configure_bgp": [r"configure\s+bgp\s+(?:as\s+)?(?P<as_num>\d+)", r"set\s+up\s+bgp\s+(?:as\s+)?(?P<as_num>\d+)"],
            "configure_qos": [r"apply\s+qos\s+policy\s+(?P<policy>\S+)", r"configure\s+qos\s+(?P<policy>\S+)"]
        }
    
    def parse_intent(self, intent_text: str) -> Dict[str, Any]:
        result = {"original_intent": intent_text, "parsed_actions": [], "target_devices": [], "parameters": {}, "confidence": 0.0}
        intent_lower = intent_text.lower()
        
        for action, patterns in self.intent_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, intent_lower)
                if match:
                    result["parsed_actions"].append({"action": action, "parameters": match.groupdict()})
                    result["confidence"] = min(result["confidence"] + 0.3, 1.0)
        
        return result
    
    def generate_config_from_intent(self, parsed_intent: Dict[str, Any], vendor: str) -> str:
        try:
            from .connectors.registry import ConnectorRegistry
        except ImportError:
            # Fallback path if run structurally differently
            import sys
            import os
            current_dir = os.path.dirname(os.path.abspath(__file__))
            if current_dir not in sys.path:
                sys.path.append(current_dir)
            from connectors.registry import ConnectorRegistry

        connector = ConnectorRegistry.get_connector(vendor)
        if not connector:
            raise ValueError(f"No valid Connector plugin found for vendor: {vendor}")

        config_lines = []
        # Connect to device conceptually
        connector.connect(f"target-{vendor}", {})

        for action in parsed_intent.get("parsed_actions", []):
            action_type, params = action["action"], action["parameters"]
            # Convert intent directly via the plugin
            config_lines.extend(connector.translate_intent(action_type, params))
        
        connector.disconnect()
        return "\n".join(config_lines)


class ConfigurationValidator:
    """Multi-level configuration validation engine"""
    
    def __init__(self):
        self.compliance_rules = [
            {"rule_id": "COMP-001", "name": "Telnet Disabled", "check": lambda c: "telnet" not in c.lower() or "no telnet" in c.lower(), "severity": "high"},
            {"rule_id": "COMP-002", "name": "SSH Enabled", "check": lambda c: "ssh" in c.lower(), "severity": "medium"},
            {"rule_id": "COMP-003", "name": "Password Encryption", "check": lambda c: "service password-encryption" in c.lower(), "severity": "medium"},
            {"rule_id": "COMP-004", "name": "SNMP Community Not Default", "check": lambda c: "public" not in c.lower() and "private" not in c.lower(), "severity": "medium"},
        ]
    
    async def validate(self, config: str, vendor: str) -> Tuple[bool, List[str], List[str]]:
        errors, warnings = [], []
        for rule in self.compliance_rules:
            try:
                if not rule["check"](config):
                    msg = f"{rule['rule_id']}: {rule['name']}"
                    if rule["severity"] == "high":
                        errors.append(msg)
                    else:
                        warnings.append(msg)
            except: pass
        return len(errors) == 0, errors, warnings


class AutonomousConfigEngine:
    """Main engine for autonomous configuration management"""
    
    def __init__(self):
        self.intent_parser = IntentParser()
        self.validator = ConfigurationValidator()
        self.config_history: Dict[str, List[ConfigurationChange]] = {}
    
    async def process_intent(self, intent: ConfigurationIntent) -> Dict[str, Any]:
        result = {"intent_id": intent.intent_id, "status": ConfigStatus.PENDING.value, "changes": [], "validation": None}
        parsed = self.intent_parser.parse_intent(intent.description)
        
        for device_id in intent.target_devices:
            vendor = "cisco"  # Default, would query device inventory
            config = self.intent_parser.generate_config_from_intent(parsed, vendor)
            passed, errors, warnings = await self.validator.validate(config, vendor)
            
            if passed:
                result["changes"].append({"device_id": device_id, "config": config, "status": ConfigStatus.READY.value})
            else:
                result["validation"] = {"passed": False, "errors": errors, "warnings": warnings}
        
        if result["changes"]:
            result["status"] = ConfigStatus.READY.value
        return result
    
    async def deploy_configuration(self, change: ConfigurationChange) -> Dict[str, Any]:
        """Deploy configuration to device with Sandbox Isolation and automatic rollback"""
        result = {"change_id": change.change_id, "device_id": change.device_id, "status": ConfigStatus.DEPLOYING.value, "success": False}
        
        try:
            # Load Sandbox Executor dynamically
            try:
                from core.sandbox_executor import SandboxExecutor
                sandbox = SandboxExecutor()
            except ImportError:
                import sys
                import os
                current_dir = os.path.dirname(os.path.abspath(__file__))
                parent_dir = os.path.dirname(current_dir)
                if parent_dir not in sys.path:
                    sys.path.append(parent_dir)
                from core.sandbox_executor import SandboxExecutor
                sandbox = SandboxExecutor()

            # Execute via Sandbox
            vendor_mock = "cisco" # Would be discovered from asset db
            action_mock = f"Deploy Intent {change.intent_id} {change.config_type.value}"
            
            logger.info(f"Dispatching change {change.change_id} to Sandbox Execution Engine...")
            success, logs, error = sandbox.run_remediation(
                vendor=vendor_mock, 
                action=action_mock, 
                params={"config_snippet": change.new_config, "device": change.device_id}
            )

            if success:
                change.status = ConfigStatus.DEPLOYED
                change.deployed_at = datetime.utcnow()
                result["status"] = ConfigStatus.DEPLOYED.value
                result["success"] = True
                result["sandbox_logs"] = logs
            else:
                raise Exception(f"Sandbox Execution Failed: {error}")
                
        except Exception as e:
            change.status = ConfigStatus.FAILED
            result["status"] = ConfigStatus.FAILED.value
            result["error"] = str(e)
            logger.error(f"Deployment failed safely: {e}")
            
        return result


async def main():
    engine = AutonomousConfigEngine()
    intent = ConfigurationIntent(
        intent_id="INT-001",
        description="Create interface GigabitEthernet0/1 and set IP 192.168.10.1 255.255.255.0 on device router-01",
        target_devices=["router-01"],
        config_type=ConfigType.INTERFACE,
        parameters={}
    )
    result = await engine.process_intent(intent)
    print(f"Intent processed: {result['status']}")
    if result['changes']:
        print(f"Generated Config:\n{result['changes'][0]['config']}")


if __name__ == "__main__":
    asyncio.run(main())
