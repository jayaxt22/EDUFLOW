# EduFlow ERP

EduFlow is a modern, full-stack multi-institution school ERP SaaS platform featuring a database-per-tenant isolation architecture, built with a Next.js / React (JSX) frontend and a Django REST Framework (DRF) backend.

---

## Architecture Overview

- **Multi-Tenant Model**: Database-per-tenant boundary isolation. No shared tenant tables. Every tenant request is routed to its isolated database through middleware and dynamic database routing.
- **Backend**: Python 3.10+, Django 5.x, Django REST Framework, SimpleJWT (HttpOnly Cookies), Argon2 Password Hashing, PostgreSQL / SQLite.
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons.
- **Roles**: Exactly 4 roles — `ADMIN`, `TEACHER`, `STUDENT`, `STAFF` (Finance, Reception, Library, Other).

---

## Directory Structure

```text
├── backend/                   # Django REST Framework API
│   ├── apps/
│   │   ├── core/              # Base models, auth cookies, permissions, exception envelope
│   │   ├── tenants/           # Multi-tenant routing and registry
│   │   ├── identity/          # Users, memberships, profiles (Admin/Teacher/Student/Staff)
│   │   ├── academics/         # Academic years, classes, sections, allocations, promotions
│   │   ├── attendance/        # Classroom and staff self check-in
│   │   ├── examinations/      # Exams, grading, immutable mark entry
│   │   ├── fees/              # Structures, invoices, payments, refunds
│   │   └── announcements/     # Bulletin board and class forwarding
│   ├── config/                # Django settings, WSGI, ASGI, URLs
│   ├── tests/                 # Automated test suite (157+ test cases)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── manage.py
├── frontend/                  # React + Vite Single Page Application
│   ├── src/
│   │   ├── components/        # Reusable UI components (Select, UserForm, ProfilePage, etc.)
│   │   ├── context/           # AuthContext, ThemeContext
│   │   ├── services/          # Centralized API service layer
│   │   └── App.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/                      # Architectural specifications & planning
├── docker-compose.yml         # Containerized production stack
├── Procfile                   # Cloud PaaS deployment configuration
├── .gitignore                 # Production-grade gitignore
└── README.md
```

---

## Quick Start (Local Development)

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (local default and demo tenant)
python manage.py migrate --database=default
python manage.py migrate --database=tenant_demo

# (Optional) Seed demo development data
python manage.py seed_dev

# Start Django development server
python manage.py runserver 8000
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The application will be accessible at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api/v1/`

---

## Running the Automated Test Suite

EduFlow maintains 100% test pass compliance across all modules.

```bash
# Run full backend test suite
python -m pytest -c backend/pytest.ini
```

---

## Deployment Instructions

### Option 1: Docker Compose (Recommended)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Adjust environment variables (`DJANGO_SECRET_KEY`, `POSTGRES_PASSWORD`, etc.).
3. Start the entire container stack:
   ```bash
   docker-compose up -d --build
   ```

### Option 2: PaaS (Render / Railway / Fly.io / Heroku)

1. **Backend**:
   - Build Command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - Start Command: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`
   - Set environment variables as defined in `backend/.env.example`.
2. **Frontend**:
   - Build Command: `npm install && npm run build`
   - Output Directory: `dist`
   - Environment Variable: `VITE_API_URL=https://your-api-domain.com`

---

## Git Push Setup

```bash
# 1. Initialize git repository (if not already initialized)
git init -b main

# 2. Add files
git add .

# 3. Check staged files to verify secrets and build artifacts are ignored
git status

# 4. Commit changes
git commit -m "feat: complete EduFlow ERP with multi-tenant architecture, UI components, and deployment setup"

# 5. Connect to remote repository
git remote add origin <your-git-remote-url>

# 6. Push to GitHub / GitLab
git push -u origin main
```
