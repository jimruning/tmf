# TMF DOCUMENT MANAGEMENT SYSTEM

**Generated:** 2025-03-24
**Stack:** React 19 + Express + SQLite

## OVERVIEW
Trial Master File (TMF) document management system following TMF Reference Model V3.3.1. Supports 11 zones, 251 folder entries with RBAC, file upload/download, soft delete, and audit logging.

## STRUCTURE
```
tmf/
├── backend/          # Express API server (port 3001)
├── frontend/         # React SPA (port 3000)
├── fodes.txt         # TMF folder structure data (251 entries)
└── *.pdf             # TMF Reference Model documentation
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Add API endpoint | `backend/routes/*.js` | Follow Express router pattern |
| Add React page | `frontend/src/pages/` | Use Ant Design components |
| Add React component | `frontend/src/components/` | Export from index if shared |
| Database schema | `backend/config/database.js` | SQLite with better-sqlite3 |
| Auth middleware | `backend/middleware/auth.js` | JWT verification |
| TMF zones/sections | `fodes.txt` | Pipe-delimited: zone|section|artifact |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| server.js | Entry | backend/ | Express app setup, routes mount |
| authMiddleware | Middleware | backend/middleware/auth.js | JWT token verification |
| db | Database | backend/config/database.js | SQLite connection (better-sqlite3) |
| LoginPage | Page | frontend/src/pages/ | User authentication UI |
| DashboardPage | Page | frontend/src/pages/ | Main file browser UI |
| FolderTree | Component | frontend/src/components/ | TMF zone/section/artifact tree |
| FileList | Component | frontend/src/components/ | File table with actions |

## CONVENTIONS

### Backend (Express)
- Chinese comments and error messages
- Response format: `{ success: boolean, data?: any, error?: { code, message } }`
- JWT in Authorization header, user injected via authMiddleware
- Soft delete pattern: `is_deleted = 1` instead of DELETE

### Frontend (React)
- Ant Design 5.x components
- ConfigProvider with zh_CN locale
- Token/user stored in localStorage
- Mock data patterns in useEffect (replace with API calls)

### API Endpoints
```
POST /api/auth/login     → { token, user }
POST /api/auth/register  → { user }
GET  /api/folders/tree   → Folder tree structure
GET  /api/files?folder_id=X
POST /api/files/upload   → Multer single file
GET  /api/files/:id/download
DELETE /api/files/:id    → Soft delete
GET  /api/search?q=X
```

## ANTI-PATTERNS
- DO NOT delete files from disk (soft delete only)
- DO NOT skip authMiddleware on protected routes
- DO NOT use default JWT secret in production
- DO NOT modify fodes.txt structure (breaks TMF compliance)

## DUAL MODE
- **TMF Mode**: 11 zones, 251 folders (clinical trial standard)
- **Category Mode**: Custom user-defined categories (hierarchical)
- Files can belong to either TMF folder OR custom category

## COMMANDS
```bash
# Backend
cd backend && npm install
npm run init-db          # Initialize SQLite + default admin
npm start                # Run on port 3001
npm run dev              # Nodemon with auto-reload

# Frontend
cd frontend && npm install
npm start                # Run on port 3000

# Default credentials
# Username: admin | Password: admin123
```

## NOTES
- SQLite database: `backend/tmf.db` (auto-created)
- Uploads stored in `backend/uploads/`
- TMF structure: Zone → Section → Artifact (3-level hierarchy)
- Roles: admin, user (extendable: CRC, CRA, DM, PM, PI, sPI)
- File size limit: 100MB (configurable via MAX_FILE_SIZE env)
