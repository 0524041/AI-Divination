# AGENTS.md - AI-Divination Development Guide

This guide is for AI coding agents working in the AI-Divination codebase.

## Project Overview

**AI-Divination** (玄覺空間) is a full-stack web application combining traditional divination (I Ching/Liu Yao, Tarot) with AI interpretation.

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend:** FastAPI + Python 3.10+ + SQLite + SQLAlchemy
- **AI:** Google Gemini + Local LLMs (OpenAI-compatible)
- **Version:** Frontend v1.2.0, Backend v6.1.0

---

## Build/Lint/Test Commands

### Master Control Script (start.sh)
```bash
./start.sh              # Production: build + start both services
./start.sh --dev        # Development: hot-reload enabled
./start.sh --stop       # Stop all services
./start.sh --restart    # Restart services
./start.sh --status     # Check running processes
./start.sh --logs -f    # View logs (tail)
./start.sh --build      # Force rebuild frontend
./start.sh --install    # Install dependencies only
./start.sh --reset      # Reset database (DESTRUCTIVE)
```

### Frontend Commands (from frontend/)
```bash
npm run dev             # Development mode (hot-reload)
npm run build           # Production build
npm start               # Start production server
npm run lint            # ESLint (Next.js built-in)
npm test                # Run Vitest tests (watch mode)
npm run test:run        # Run tests once (CI mode)

# Run a single test file
npx vitest src/components/ui/__tests__/Button.test.tsx

# Run tests matching a pattern
npx vitest --grep "Button"
```

### Backend Commands (from backend/)
```bash
# Start server manually
uvicorn app.main:app --host 0.0.0.0 --port 8000

# With hot-reload
uvicorn app.main:app --reload

# Install dependencies
uv sync                 # Install from pyproject.toml
uv pip install -r requirements.txt

# Database optimization
python app/core/optimize_db.py
```

---

## Code Style Guidelines

### Frontend (TypeScript/React)

#### Import Order
```typescript
// 1. 'use client' directive for client components (if needed)
'use client';

// 2. React and Next.js imports
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 3. Third-party libraries
import { Sparkles } from 'lucide-react';

// 4. Local imports using @/ alias
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/api-client';

// 5. Type imports
import type { User } from '@/types';
```

#### Naming Conventions
- **Components:** PascalCase (`Button`, `Navbar`, `CoinTossing`)
- **Files:** Match component name (`Button.tsx`, `Navbar.tsx`)
- **Utilities/Hooks:** camelCase (`cn`, `apiGet`, `useApiClient`)
- **Types/Interfaces:** PascalCase (`ButtonProps`, `AuthContextType`)
- **CSS Variables:** kebab-case with `var()` (`var(--gold)`)

#### Component Structure
```typescript
'use client';

import { useState } from 'react';

export interface ComponentProps {
  variant?: 'gold' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Component({ 
  variant = 'gold',
  size = 'md',
  className 
}: ComponentProps) {
  const [state, setState] = useState<string>('');
  
  return (
    <div className={cn('base-classes', className)}>
      {/* Content */}
    </div>
  );
}
```

#### Styling
- **Use Tailwind CSS utilities only** (no inline styles)
- **Use `cn()` utility** for conditional classes
- **Custom CSS variables** defined in `globals.css`
- **Mobile-first responsive design**
- **Glass morphism pattern** available via `.glass-card`

#### Error Handling
```typescript
try {
  const response = await apiPost('/api/endpoint', data);
  // Handle success
} catch (error) {
  console.error('Error:', error);
  // Show user-friendly error message
}
```

#### Testing
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Component } from '../Component';

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component>Test</Component>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
  
  it('handles user interaction', async () => {
    const user = userEvent.setup();
    render(<Component />);
    await user.click(screen.getByRole('button'));
    // Assert behavior
  });
});
```

### Backend (Python/FastAPI)

#### Import Order
```python
"""Module description"""

# 1. Standard library
from datetime import datetime
from pathlib import Path
from typing import Optional

# 2. Third-party libraries
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

# 3. Local imports
from app.core.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user
```

#### Naming Conventions
- **Files/Modules:** snake_case (`liuyao.py`, `api_client.py`)
- **Classes:** PascalCase (`User`, `AIConfig`, `LiuYaoRequest`)
- **Functions/Variables:** snake_case (`get_current_user`, `perform_divination`)
- **Constants:** UPPER_SNAKE_CASE (`TIANGAN`, `BAGUA`, `SYSTEM_PROMPT_PATH`)
- **Private members:** prefix with `_` (`_ensure_keys`, `_decrypt_data`)

#### API Endpoint Pattern
```python
router = APIRouter(
    prefix="/api/endpoint",
    tags=["Tag Name"],
    redirect_slashes=False
)

@router.post("/action")
async def action_name(
    data: RequestModel,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint description
    
    Args:
        data: Request payload
        db: Database session
        current_user: Authenticated user
        
    Returns:
        Response with status and data
    """
    # Implementation
    return {"status": "success", "data": result}
```

#### Database Model Pattern
```python
class User(Base):
    """User account model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    histories = relationship("History", back_populates="user")
```

#### Error Handling
```python
from fastapi import HTTPException

# Use appropriate status codes
raise HTTPException(status_code=400, detail="Invalid input")
raise HTTPException(status_code=401, detail="未授權")
raise HTTPException(status_code=404, detail="Resource not found")
raise HTTPException(status_code=500, detail="Internal server error")
```

---

## Project Organization

### Frontend Structure
```
frontend/src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home page
│   ├── login/              # Login page
│   └── [feature]/          # Feature pages
├── components/
│   ├── ui/                 # Reusable UI (Button, Card, Modal)
│   ├── features/           # Feature-specific (AISelector, MarkdownRenderer)
│   └── layout/             # Layout (Navbar, Footer)
├── contexts/               # React contexts (AuthContext)
├── hooks/                  # Custom hooks (useApiClient)
├── lib/                    # Utilities (api-client, utils)
└── test/                   # Test setup
```

### Backend Structure
```
backend/app/
├── main.py                 # FastAPI app entry
├── api/                    # API routes
├── core/                   # Config, database
├── models/                 # SQLAlchemy models
├── services/               # Business logic
├── utils/                  # Utilities
└── middleware/             # Middleware
```

---

## Key Patterns

### API Communication
- API paths are proxied through Next.js: `/api/*` → `http://localhost:8000/api/*`
- Use relative paths: `apiPost('/api/auth/login', data)`
- JWT tokens stored in `localStorage`
- Bearer token authentication

### State Management
- React Context for global state (`AuthContext`)
- Local state with `useState`
- No external state library (Redux, Zustand)

### Internationalization
- **Chinese language throughout** (Traditional Chinese)
- Comments may be in Chinese
- User-facing text in Chinese

---

## Important Notes

1. **Always use path alias `@/` in frontend imports**
2. **TypeScript strict mode is enabled** - handle all type errors
3. **Never commit sensitive data** (API keys, passwords)
4. **Run tests before committing** (`npm run test:run`)
5. **Follow existing patterns** - consistency is critical
6. **Database is SQLite** - be aware of limitations
7. **AI prompts are in `backend/prompts/*.md`** - modify with care
