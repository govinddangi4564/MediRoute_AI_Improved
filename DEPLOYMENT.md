# MediRoute AI Deployment

Deploy the backend first on Render, then deploy the frontend on Vercel.

## 1. Backend on Render

Use the repository root when creating the Render Blueprint. Render will read `render.yaml` and use `backend/` as the service root.

Render settings:

- Service type: Web Service
- Runtime: Node
- Root directory: `backend`
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/health`

Environment variables:

```env
NODE_ENV=production
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
ALLOW_VERCEL_PREVIEWS=true
MONGODB_URI=your_mongodb_atlas_uri
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

After deploy, test:

```text
https://your-render-service.onrender.com/health
https://your-render-service.onrender.com/api/health
```

## 2. Frontend on Vercel

In Vercel, import the same repo and set the project root directory to:

```text
frontend
```

Vercel will use `frontend/vercel.json`.

Environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-render-service.onrender.com/api
```

Deploy the frontend. After Vercel gives you the production URL, return to Render and set:

```env
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app
```

If you use a custom domain later, add it to `FRONTEND_ORIGIN`. Multiple origins can be comma-separated:

```env
FRONTEND_ORIGIN=https://your-vercel-app.vercel.app,https://www.yourdomain.com
```

## Local Development

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Local frontend env:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
```

Local backend env:

```env
PORT=5000
FRONTEND_ORIGIN=http://localhost:3000
ALLOW_VERCEL_PREVIEWS=true
MONGODB_URI=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
GOOGLE_MAPS_API_KEY=
```
