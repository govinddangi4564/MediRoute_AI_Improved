# LifeLine AI - Patient Side Module

Production-ready patient experience for AI-assisted emergency triage and hospital routing.

## Tech

- Frontend: Next.js, Tailwind CSS, shadcn/ui patterns, Framer Motion
- Backend: Node.js, Express.js
- DB: MongoDB Atlas
- AI: Gemini API
- Maps: Google Maps + Places APIs

## Project Structure

- `frontend/` - Patient-facing Next.js app
- `backend/` - Express APIs for AI analysis + hospital recommendation

## Quick Start

1. Configure environment files:
   - `frontend/.env.local`
   - `backend/.env`
2. Install deps:
   - `cd frontend && npm install`
   - `cd ../backend && npm install`
3. Run backend:
   - `npm run dev`
4. Run frontend:
   - `cd ../frontend && npm run dev`

## Deployment

- Backend: Render
- Frontend: Vercel

See `DEPLOYMENT.md` for the full setup, required environment variables, and deploy order.

## Core Patient Pages

- `/` Landing
- `/symptoms` Symptom + voice input
- `/upload` Report upload
- `/analysis` AI triage result
- `/hospitals` Hospital recommendations + map
