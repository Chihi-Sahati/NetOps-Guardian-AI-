import asyncio
import logging
import os
import sys

# Setup Paths for testing
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, 'src')
if src_dir not in sys.path:
    sys.path.append(current_dir)

# Now we can import the refactored code safely
from src.noc.autonomous_config import AutonomousConfigEngine, ConfigurationIntent, ConfigType, ConfigurationChange, ConfigStatus

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TestSandboxConnectors")

async def run_simulation():
    print("=" * 80)
    print("NETOPS GUARDIAN AI: Enterprise Architecture Integration Test")
    print("Phase 1: Connector Economy (Modular Plugins)")
    print("Phase 2: Execution Isolation (Sandbox)")
    print("=" * 80)
    print()

    engine = AutonomousConfigEngine()
    
    # 1. Test Connector Economy (Dynamic Translation)
    print(">> [PHASE 1] Initializing Network Intent...")
    intent = ConfigurationIntent(
        intent_id="INTENT-SEC-099",
        description="configure ip address 10.50.1.1 255.255.255.0 on device edge-rt-01",
        target_devices=["edge-rt-01"],
        config_type=ConfigType.INTERFACE,
        parameters={}
    )
    
    print(f"   Intent Context: '{intent.description}' -> Target: edge-rt-01")
    
    # Processing the intent triggers the IntentParser -> ConnectorRegistry -> CiscoIOSConnector
    result = await engine.process_intent(intent)
    
    if result.get("status") == ConfigStatus.READY.value and result.get("changes"):
        generated_config = result["changes"][0]["config"]
        print("\n>> [PHASE 1 SUCCESS] Dynamic translation via Connector Plugin successful!")
        print("   Generated Config from Plugin:")
        print("-" * 40)
        print(generated_config)
        print("-" * 40)
        
        # 2. Test Execution Isolation (Sandbox)
        print("\n>> [PHASE 2] Simulating deployment to Sandbox Execution Engine...")
        change = ConfigurationChange(
            change_id="CHG-99912",
            device_id="edge-rt-01",
            intent_id="INTENT-SEC-099",
            config_type=ConfigType.INTERFACE,
            previous_config="",
            new_config=generated_config,
            diff="+ ip address 10.50.1.1 255.255.255.0",
            status=ConfigStatus.READY,
            impact="medium",
            validation_results=[]
        )
        
        deployment_result = await engine.deploy_configuration(change)
        
        if deployment_result.get("success"):
            print("\n>> [PHASE 2 SUCCESS] Config deployed successfully within isolated Sandbox.")
            print("\n   [SANDBOX OUTPUT LOGS]:")
            print("-" * 40)
            print(deployment_result.get("sandbox_logs", "No logs returned."))
            print("-" * 40)
        else:
            print("\n>> [PHASE 2 ERROR] Sandbox execution failed!")
            print(deployment_result.get("error"))
    else:
        print("\n>> [PHASE 1 ERROR] Failed to process intent.")
        print(result.get("validation", "Unknown error."))

    print("\n" + "=" * 80)
    print("Simulation Complete.")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_simulation())
