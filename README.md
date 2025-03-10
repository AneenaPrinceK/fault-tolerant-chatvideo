# fault-tolerant-chatvideo
## Prerequisites
Before you begin, make sure you have the following installed:

Python 3.9+ (for FastAPI backend)
Node.js 16+ & npm (for React frontend via Vite.js)
Git (to clone the repository)

## Backend (FastAPI) Setup
1. Navigate to backend directory:
    cd backend 
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
2. FastAPI backend will be running on: http://127.0.0.1:8000

## Frontend (React + Vite.js) Setup
1. Navigate to frontend directory:
  cd frontend
  npm install
  npm run dev
2. Frontend will be running on: http://127.0.0.1:5173

## Usage Flow
1. Open frontend app in browser: http://127.0.0.1:5173
2. Login using a username and password (basic mock login).
    See online users listed.
    Start Chat or Start Video Call:
    Chat: Real-time messages with fault-tolerant delivery (auto-resend, deduplication, ordering).
    Video: Peer-to-peer video call with toggle functionality using WebRTC.
