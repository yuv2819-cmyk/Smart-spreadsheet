# Smart Spreadsheet SaaS MVP

An AI-powered spreadsheet application built with Next.js and FastAPI.

## Features

✨ **Dynamic Spreadsheet** - Upload and view CSV files  
🤖 **AI Data Analyst** - Get instant insights powered by OpenAI  
📊 **Interactive Charts** - Visualize data with charts  
📈 **Real-time Metrics** - Automatic statistics  
🎨 **Modern UI** - Beautiful, premium design  
☁️ **Cloud Ready** - Deploy to Vercel + Railway

## Project Structure

- `frontend/`: Next.js application (React + Tailwind CSS)
- `backend/`: FastAPI application (Python)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+ / Anaconda
- OpenAI API key (for AI features)

### One-Click Start (Windows)

Run `index.bat` from the project root to:
- start backend on `http://localhost:8000` (if not already running)
- start frontend on `http://localhost:3000` (if not already running)
- open the app in your browser automatically

For local development on your machine, this is the easiest option.

### Running with Docker (Recommended)

1. Navigate to the project directory:
   ```bash
   cd c:\Users\Yuvra\OneDrive\Desktop\smart-spreadsheet
   ```

2. Build and start the services:
   ```bash
   docker-compose up --build
   ```

3. Access the application:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000](http://localhost:8000)
   - API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Local Development

#### Backend

1. Navigate to `backend/`:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

4. Initialize database:
   ```bash
   python init_db.py
   python seed_data.py  # Optional sample data
   ```

5. Run the server:
   ```bash
   python -m uvicorn app.main:app --reload
   ```

#### Frontend

1. Navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

### Frontend (`.env.local`)
```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### Backend (`.env`)
```bash
DATABASE_URL=sqlite+aiosqlite:///./smart_spreadsheet.db
OPENAI_API_KEY=your-openai-api-key-here
ENVIRONMENT=development
```

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete deployment instructions to:
- ✅ **Vercel** (Frontend)  
- ✅ **Railway** (Backend - Recommended)  
- 📦 Alternative: Render, Fly.io

The application is **deployment-ready** with:
- Environment-based API configuration
- CORS configured for Vercel
- Production build tested and working
- PostgreSQL support for production

## Application Features

- **Grid Interface**: Spreadsheet-like data entry and viewing
- **AI Integration**: Ask questions in natural language
- **CSV Upload**: Import your own data
- **Multi-tenancy**: Secure data isolation
- **Analytics Dashboard**: Real-time metrics and charts
- **Data Visualization**: Bar charts and line graphs

## API Documentation

API docs available at: [http://localhost:8000/docs](http://localhost:8000/docs)

## Build for Production

```bash
cd frontend
npm run build
npm start
```

Build tested and working! ✅

---

**Built with ❤️ using Next.js, FastAPI, and OpenAI**
