# 🚀 Quick Start Guide - Windows 11

## Net's AI Security Agent

---

## ⚡ Quick Installation (5 Minutes)

### 1️⃣ Install Bun (PowerShell as Administrator)

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

> **IMPORTANT:** Close and reopen PowerShell after installation!

### 2️⃣ Extract Project

Right-click `nets-ai-security-agent-trained.zip` → Extract All → Choose destination

### 3️⃣ Open Terminal in Project Folder

```powershell
cd C:\path\to\nets-ai-security-agent
```

### 4️⃣ Install & Run

```powershell
bun install
bunx prisma generate
bun run dev
```

### 5️⃣ Open Browser

```
http://localhost:3000
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| `bun not found` | Restart PowerShell |
| `Port 3000 in use` | `bun run dev -- -p 3001` |
| `Database error` | `bunx prisma db push` |

---

## 📊 Pre-Loaded Data

- **500** Network Elements (Cisco, Huawei, Nokia, Juniper, Ericsson)
- **10,000+** Alarms (All severities)
- **50,000+** Logs
- **5,000+** Security Events
- **50** Users

---

## 🔑 Default Login

The system comes with pre-seeded data. No login required for demo mode.

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `.env` | Environment configuration |
| `db/custom.db` | SQLite database |
| `README.md` | Full documentation |
| `REQUIREMENTS.txt` | Dependencies list |

---

## 🌐 Features

- ✅ Real-time Dashboard
- ✅ Alarm Management
- ✅ Log Centralization
- ✅ Network Element Monitoring
- ✅ Provisioning Tasks
- ✅ Zero Trust Security
- ✅ AI-powered Analysis

---

**Need help? Check README.md for full documentation.**
