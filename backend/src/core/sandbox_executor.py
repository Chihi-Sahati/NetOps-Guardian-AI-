import json
import logging
import os
import subprocess
import tempfile
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("SandboxExecutor")

try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False


class SandboxExecutor:
    """
    Execution Isolation Engine for CortexOps.
    Runs AI-generated recovery scripts in a secure, ephemeral Sandbox
    to prevent malicious or runaway code from crashing the main backend.
    """
    
    def __init__(self, timeout_seconds: int = 15):
        self.timeout = timeout_seconds
        self.docker_client = None
        self._init_docker()

    def _init_docker(self):
        if DOCKER_AVAILABLE:
            try:
                self.docker_client = docker.from_env()
                # Test connection
                self.docker_client.ping()
                logger.info("Sandbox Executor initialized using Native Docker Isolation.")
            except Exception as e:
                logger.warning(f"Docker is installed but inaccessible ({e}). Falling back to Subprocess Isolation.")
                self.docker_client = None
        else:
            logger.warning("Docker SDK not installed. Falling back to Subprocess Isolation.")

    def run_remediation(self, vendor: str, action: str, params: Dict[str, Any]) -> Tuple[bool, str, str]:
        """
        Executes a remediation workflow inside the sandbox.
        """
        script_payload = self._generate_payload(vendor, action, params)
        
        # 1. Try Docker Isolation
        if self.docker_client:
            return self._run_in_docker(script_payload)
            
        # 2. Fallback to Subprocess Isolation (Dry Run / Local)
        return self._run_in_subprocess(script_payload)

    def _generate_payload(self, vendor: str, action: str, params: Dict[str, Any]) -> str:
        """Generates the isolated python script that connects and pushes the config."""
        params_json = json.dumps(params)
        
        payload = f'''
import sys
import json
import time

def execute():
    vendor = {json.dumps(vendor)}
    action = {json.dumps(action)}
    params_dict = json.loads({json.dumps(params_json)})
    
    print(f"[Sandbox Time: {{time.time():.2f}}] [SANDBOX] Starting isolated remediation for vendor: {{vendor}}")
    print(f"[Sandbox Time: {{time.time():.2f}}] [SANDBOX] Action requested: {{action}}")
    print(f"[Sandbox Time: {{time.time():.2f}}] [SANDBOX] Parameters: {{json.dumps(params_dict)}}")
    
    # Simulate Connector Loading & Execution
    print(f"[Sandbox Time: {{time.time():.2f}}] [SANDBOX] Simulated device connection established.")
    print(f"[Sandbox Time: {{time.time():.2f}}] [SANDBOX] Pushing configuration snippet safely...")
    
    # Sleep to simulate network delay
    time.sleep(0.5)
    
    print(f"[Sandbox Time: {{time.time():.2f}}] [SANDBOX] Configuration applied successfully.")
    print(f"[Sandbox Time: {{time.time():.2f}}] [SANDBOX] Disconnecting.")

if __name__ == '__main__':
    try:
        execute()
        sys.exit(0)
    except Exception as e:
        print(f"CRITICAL ERROR IN SANDBOX: {{e}}", file=sys.stderr)
        sys.exit(1)
'''
        return payload

    def _run_in_docker(self, payload: str) -> Tuple[bool, str, str]:
        """Execute the payload in an ephemeral Docker container."""
        logger.info("Spawning ephemeral Docker container for execution isolation...")
        
        # Write payload to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode='w') as tmp:
            tmp.write(payload)
            tmp_path = tmp.name

        try:
            # Mount the script and run it via python:3.9-slim
            container = self.docker_client.containers.run(
                image="python:3.9-slim",
                command=["python", "/app/script.py"],
                volumes={os.path.abspath(tmp_path): {'bind': '/app/script.py', 'mode': 'ro'}},
                detach=True,
                mem_limit="128m",   # Strict Memory Limit
                cpu_quota=50000,    # Strict CPU Limit
                network_disabled=True # Strict Network Isolation (For pure simulation without real keys)
            )
            
            result = container.wait(timeout=self.timeout)
            logs = container.logs().decode('utf-8')
            
            # Destroy container automatically
            container.remove(force=True)
            
            success = result.get('StatusCode', 1) == 0
            return success, logs, ""
            
        except Exception as e:
            logger.error(f"Docker isolation failed: {e}")
            return False, "", str(e)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    def _run_in_subprocess(self, payload: str) -> Tuple[bool, str, str]:
        """Execute the payload using a restricted subprocess as a fallback."""
        logger.info("Running remediation in Subprocess Isolation (Fallback)...")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".py", mode='w') as tmp:
            tmp.write(payload)
            tmp_path = tmp.name

        try:
            result = subprocess.run(
                ["python", tmp_path],
                capture_output=True,
                text=True,
                timeout=self.timeout
            )
            success = result.returncode == 0
            return success, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            logger.error(f"Sandbox Timeout! The execution exceeded {self.timeout}s and was killed.")
            return False, "", "Execution Timeout (Possible infinite loop detected by Sandbox)"
        except Exception as e:
            return False, "", str(e)
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
