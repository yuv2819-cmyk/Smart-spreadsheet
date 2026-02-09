# Smart Spreadsheet SaaS MVP

An AI-powered spreadsheet application built with Next.js and FastAPI.

## Project Structure

- `frontend/`: Next.js application (React + Tailwind CSS)
- `backend/`: FastAPI application (Python)
- `docker-compose.yml`: Orchestrates the services

## Getting Started

### Prerequisites

- Docker Desktop installed and running.
- Node.js (optional, for local frontend development).
- Python (optional, for local backend development).

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

2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Run the server:
   ```bash
   uvicorn app.main:app --reload
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

## Features

- **Grid Interface**: Spreadsheet-like data entry.
- **AI Integration**: Ask questions in natural language.
- **Multi-tenancy**: Secure data isolation.
