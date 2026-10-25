# WindScope | Day-Ahead Analytics

## Files and directories

```text
.
├── backend/
│   ├── app/
│   │   ├── analytics/       # Forecast selection, alignment, metrics
│   │   ├── api/             # FastAPI routes
│   │   ├── core/            # Backend settings and storage setup
│   │   ├── services/        # Elexon API, CSV, and data providers
│   │   ├── main.py          # FastAPI application
│   │   └── schemas.py       # API response schemas
│   ├── data/                # Local cache and CSV import directories
│   ├── tests/               # Backend unit and API tests
│   ├── Dockerfile
│   ├── pytest.ini
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # Typed backend client
│   │   ├── components/      # Charts, tables, and shared UI
│   │   ├── hooks/           # API loading and error state
│   │   ├── test/            # Frontend test setup
│   │   ├── App.tsx           # App layout and dashboard pages
│   │   └── types.ts          # Frontend data types
│   ├── Dockerfile
│   ├── package.json
│   ├── vercel.json
│   └── vite.config.ts
├── docs/
│   ├── architecture.md      # Architecture notes
│   ├── demo-script.md       # Customer and technical demo outline
│   └── methodology.md       # Data selection and metric definitions
├── docker-compose.yml       # Local container setup
├── render.yaml              # Optional Render Blueprint configuration
└── .env.example             # Example environment variables
```

## Start the application locally

Run these commands from the repository root in **two separate terminals**. Python 3.12 is recommended for the backend dependencies.

### Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
DATA_MODE=demo python -m uvicorn app.main:app --reload --port 8000
```

The backend API is at [http://localhost:8000](http://localhost:8000), with interactive API docs at [http://localhost:8000/docs](http://localhost:8000/docs). `DATA_MODE=demo` starts with clearly labeled synthetic data. For official Elexon data, replace it with `DATA_MODE=elexon`.

### Frontend

```bash
cd frontend
npm install
VITE_DEFAULT_SOURCE=demo npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies API requests to the backend on port 8000. To use official data from the start, set `VITE_DEFAULT_SOURCE=elexon` instead.

## Application links

- **Deployed frontend:** [https://gridbricks-zeta.vercel.app](https://gridbricks-zeta.vercel.app)
- **GitHub repository:** [https://github.com/HitanshuDev/gridbricks](https://github.com/HitanshuDev/gridbricks)
- **Backend deployment:** [https://gridbricks-homv.onrender.com](https://gridbricks-homv.onrender.com)
