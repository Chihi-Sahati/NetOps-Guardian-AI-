import os
import sys
import time

# Add src to path
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, 'src')
if src_dir not in sys.path:
    sys.path.append(current_dir)

try:
    from src.core.intent_engine.memory_agent import MemoryAgent
except ImportError as e:
    print(f"Error importing MemoryAgent: {e}")
    sys.exit(1)

def run_simulation():
    print("=" * 60)
    print("NETOPS GUARDIAN AI: Memory Agent (Semantic Caching) Test")
    print("=" * 60)

    # 1. Initialize Memory Agent
    print("\n[+] Initializing Memory Agent...")
    agent = MemoryAgent(persistence_file="test_memory.json")
    
    # Context 1: BGP Session Down
    event_context_1 = "Vendor: Cisco, Type: Router, Event: BGP_PEER bgp_down, Message: BGP neighbor 10.0.0.1 is down, MTU mismatch detected"
    
    # 2. Test Cache Miss
    print("\n[!] Event 1 Occurs (First Time): BGP Peer Down due to MTU")
    print(f"    Context: {event_context_1}")
    
    t0 = time.perf_counter()
    result = agent.retrieve_experience(event_context_1)
    t1 = time.perf_counter()
    
    if result is None:
        print(f"    -> [CACHE MISS] No semantic match found. Processing time: {(t1 - t0) * 1000:.2f} ms")
        print("    -> Proceeding to Slow Path (LLM/AI Engine) for deep correlation... (Simulated >500ms)")
        
        # Simulate LLM generating a fix
        suggested_remediation = "interface gigabitethernet 0/1\n mtu 9000\n router bgp 65000\n neighbor 10.0.0.1 clear"
        root_cause = "MTU configuration mismatch on peering interface"
        
        print("\n[+] LLM resolved the issue. Storing pattern in Semantic Memory...")
        agent.add_experience(event_context_1, suggested_remediation, root_cause)
    
    # Context 2: Similar BGP issue, but slightly different text
    event_context_2 = "Vendor: Cisco, Type: EdgeRouter, Event: BGP_STATE_CHANGE bgp_neighbor_down, Message: BGP peering to 10.0.0.1 lost, MTU size error"
    
    # 3. Test Cache Hit
    print("\n[!] Event 2 Occurs (Similar Issue): BGP Peering Lost MTU error")
    print(f"    Context: {event_context_2}")
    
    t0 = time.perf_counter()
    result2 = agent.retrieve_experience(event_context_2)
    t1 = time.perf_counter()
    
    if result2:
        print(f"    -> [CACHE HIT!] Semantic match found in {(t1 - t0) * 1000:.2f} ms")
        print(f"    -> Similarity Score: {result2['similarity'] * 100:.1f}%")
        print(f"    -> Root Cause: {result2['root_cause']}")
        print(f"    -> Bypassing LLM. Applying Action:\n{result2['remediation']}")
    else:
        print(f"    -> [CACHE MISS] Similarity was too low.")

    print("\n" + "=" * 60)
    print("Simulation Complete.")
    print("=" * 60)

if __name__ == "__main__":
    run_simulation()
