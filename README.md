# NetOps Guardian AI v3.0
**AI-Driven Resource and Services Automation in Multi-Vendor ISP Networks: A Multi-Agent Intelligent Operations Platform**

**Author:** Hussein A. Al-Sahati (Military Academy for Security and Strategic Sciences, Benghazi, Libya)  
**Supervisor:** Dr. Houda Chihi (Higher School of Communication of Tunis (Sup'Com), University of Carthage, Tunisia)

---

## 📖 Abstract
This repository contains the source code and implementation framework for **NetOps Guardian AI v3.0**, a comprehensive multi-agent intelligent operations platform for multi-vendor ISP networks. 

The platform introduces a novel **Multi-Agent System (MAS)** comprising five specialized AI agents—**Alarm Management, Log Analysis, Provisioning, Security, and Orchestrator**—that operate within a **MAPE-K autonomic control loop** to achieve autonomous network operations. Built on a modern technology stack (Next.js 16, React 19, TypeScript, Python 3.11+), the platform monitors 10 telecom services across equipment from six major vendors (**Cisco, Huawei, Nokia, Juniper, Ericsson, and TP-LINK**) through standardized vendor adapters (Connector Economy).

The architecture is built upon a rigorous formal mathematical framework (26 equations), including MAS coordination models, intent-to-configuration translation functions, queuing-theoretic analysis of a **Dual-Path Correlation Engine (M/M/1 and M/M/c models)**, and a trust-score-based **Zero Trust** authorization model with isolated Execution Sandboxing. 

Experimental validation demonstrates:
- **Alarm normalization accuracy:** > 98.5%
- **Configuration deployment success rates:** 99.2%
- **MTTR reduction:** > 95% 
- **OPEX reduction:** 63.3% compared to traditional manual operations.

---

## 🏗️ Core Architecture (v3.0 Features)
- **Multi-Agent System (MAS):** 5 AI Agents collaborating under a BDI model.
- **MAPE-K Control Loop:** Autonomic monitoring, analysis, planning, and execution.
- **Intent-Based Automation:** TMForum IG1228 compliant intent-to-configuration translation pipeline.
- **Dual-Path Correlation Engine:** Semantic Caching (Memory Agent) fast-path (<50ms) and LLM slow-path (<500ms) guided by Queuing Theory.
- **Connector Economy:** Dynamic plugin injection abstraction layer for seamless Multi-Vendor configuration without core code modification.
- **Execution Isolation (Sandbox):** Ephemeral Docker/Subprocess environments enforcing strict Zero Trust principles when executing AI-generated provisioning code.

---

## ⚙️ Installation and Setup

### 1. Prerequisites
- **Frontend / Fullstack:** Bun (v1.0+) or Node.js (v20+ LTS)
- **Backend Environment:** Python 3.11+ (with `scikit-learn` and `docker`)
- **Isolation/Sandboxing:** Docker Desktop (Recommended for pure execution isolation)

### 2. Initialization & Execution
Execute the following commands to initialize the full platform:

**Frontend Ecosystem:**
```bash
# Install dependencies
bun install

# Generate Schema & Push to Database
bunx prisma generate
bunx prisma db push

# Launch the Application Dashboard
bun run dev
```

**Backend Ecosystem (AI & Connectors):**
```bash
# Navigate to the backend directory
cd backend

# Install dependencies (Wait for installation to finish)
pip install -r requirements.txt

# Run the test simulation for Sandbox & Connectors
python test_sandbox_connectors.py
```
*The main GUI will be accessible via: `http://localhost:3000`*

---

## 📜 License and Citation
This framework is developed as an academic master's thesis/research project at **InnovCOM Lab, Sup'COM Tunisia**, under the supervision of **Dr. Houda Chihi** for submission to the IEEE.

If you utilize this software in your research, please use the following citation:

```bibtex
@article{netops_guardian_ai_v3_2026,
  title={AI-Driven Resource and Services Automation in Multi-Vendor ISP Networks: A Multi-Agent Intelligent Operations Platform},
  author={Al-Sahati, Hussein A. and Chihi, Houda},
  journal={IEEE Network / IEEE Transactions on Network and Service Management},
  year={2026},
  note={Submitted for publication}
}
```
**Version 3.0 - March 2026**
