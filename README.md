# 🎯 CruizControl — by JCRUIZ

> **Effortless productivity. Total control.**  
> A smart, AI-powered Todo application built with pure HTML, CSS, and JavaScript.

![CruizControl Banner](https://img.shields.io/badge/CruizControl-by%20JCRUIZ-ff5c35?style=for-the-badge&logo=target&logoColor=white)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![No Framework](https://img.shields.io/badge/No%20Framework-Zero%20Dependencies-22d3a5?style=flat-square)

---

## 📸 Overview

CruizControl is a premium, multi-page task management SPA (Single Page Application) with a built-in AI productivity copilot — **CruizBot**. It runs entirely in the browser with no backend, no frameworks, and no external dependencies. User authentication and task data are persisted via `localStorage`.

---

## ✨ Features

### 🔐 Authentication (No Backend Required)
- User **Sign Up** and **Sign In** flows
- Passwords stored securely as hashed values in `localStorage`
- Session persistence — stay logged in across page refreshes
- Per-user task isolation — each account has its own task data

### ⚡ Dashboard
- Animated SVG progress ring showing task completion percentage
- Live stats — total tasks, completed, high priority, remaining
- Recent task preview with priority indicators
- Quick-add task panel directly from the dashboard
- Daily rotating productivity tip
- Live clock and smart greeting (Good Morning / Afternoon / Evening)

### ✅ My Tasks
- Add tasks with priority levels — 🔴 High, 🟡 Medium, 🟢 Low
- Live search to filter tasks by keyword
- Filter tabs — All, Active, High, Medium, Low, Done
- Mark tasks complete with a checkbox (strikethrough effect)
- Delete tasks with a smooth slide-out animation
- Colour-coded left border per priority on every task card
- 🤖 **"Ask AI"** button on each task — sends it directly to CruizBot for analysis

### 🤖 AI Copilot — CruizBot
- Refines vague tasks (e.g. `"study"` → `"Study JavaScript for 1 focused hour"`)
- Breaks down large tasks (e.g. `"build my project"` → 5 actionable steps)
- Suggests task priorities using urgency × impact logic
- Provides smart reminder strategies
- Delivers motivational responses when you're stuck
- Helps with weekly planning and prioritisation
- **"Add to Task List"** chip on every response — inject tasks directly without switching views
- Typing indicator for a realistic conversation feel

### 🎨 Design System
- Dark editorial aesthetic — deep navy-black with coral-to-amber brand gradient
- `Fraunces` serif for headings + `Plus Jakarta Sans` for UI + `JetBrains Mono` for code labels
- Noise grain texture overlay for depth
- Animated radial glow backgrounds
- Staggered entry animations and hover micro-interactions
- Toast notification system for feedback
- Sidebar navigation with profile card

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `> 900px` | Full sidebar + main content side by side |
| `600px – 900px` | Collapsed icon-only sidebar |
| `< 600px` | Hidden sidebar + sticky bottom navigation bar |

---

## 🚀 Getting Started

### Option 1 — Open directly in browser
No build step needed. Just download and open:

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/cruizcontrol.git

# Open in browser
open cruiz-control.html
# or double-click the file in your file explorer
```


---

## 🗂 Project Structure

```
cruizcontrol/
│
├── cruiz-control.html     # Complete app — HTML + CSS + JS in one file
└── README.md              # You are here
```

> Everything lives in a single `.html` file by design — making it trivially easy to deploy, share, and open without any build tooling.

---

## 🧠 How CruizBot Works

CruizBot is a rule-based AI assistant built entirely in JavaScript — no API keys, no external AI service required.

It operates through a layered intent detection system:

1. **Greeting detection** — responds to hi, hello, hey, etc.
2. **Vague task refinement** — maps common vague words (`study`, `work`, `exercise`, `email`…) to specific, actionable versions
3. **Big task breakdown** — detects large task keywords (`build`, `launch`, `learn`, `create`…) and returns a 5-step breakdown
4. **Priority adviser** — analyzes your current task list and recommends what to tackle first
5. **Motivator** — responds to words like `stuck`, `unmotivated`, `struggling` with actionable encouragement
6. **Reminder strategist** — gives time-blocking and calendar strategies
7. **Weekly planner** — provides a structured weekly planning framework

---

## 💾 Data Storage

All data is stored in the browser's `localStorage` — no server, no database, no account required beyond your own browser.

| Key | Content |
|---|---|
| `cc_users` | Registered user accounts (name, email, hashed password) |
| `cc_session` | Current logged-in user session |
| `cc_tasks_[email]` | Task list scoped to each user account |

> **Note:** Data is local to the browser and device. Clearing browser storage will reset the app.

---

## 🛠 Tech Stack

| Technology | Usage |
|---|---|
| HTML5 | App structure and semantic markup |
| CSS3 | Styling, animations, responsive layout, CSS variables |
| Vanilla JavaScript | DOM manipulation, routing, auth logic, CruizBot engine |
| localStorage API | Client-side data persistence and auth |
| Google Fonts | Fraunces, Plus Jakarta Sans, JetBrains Mono |

Zero npm packages. Zero frameworks. Zero build step.

---

## 🔮 Roadmap

- [ ] Cloud sync via Firebase or Supabase (optional backend upgrade)
- [ ] Drag-and-drop task reordering
- [ ] Due dates and calendar integration
- [ ] Dark / light theme toggle
- [ ] Export tasks as CSV or PDF
- [ ] Push notification reminders
- [ ] PWA support (install as mobile app)

---

## 👤 Author

**Odumneka Jerry (Jerrie)**  
Entrepreneur & Full-Stack Developer  
Founder, JCRUIZ & Co Ltd — Abuja, Nigeria

[![GitHub](https://img.shields.io/badge/GitHub-@jcruiz-181717?style=flat-square&logo=github)](https://github.com/YOUR_USERNAME)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

> *"Cruise through your tasks. Stay in control."*  
> — CruizControl by JCRUIZ
