from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import random
import json
import asyncio
import uuid
from typing import Dict, List
import redis.asyncio as redis

app = FastAPI()

# Redis connection for message queue and temporary storage
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

# CORS setup for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for active users and WebSocket connections
active_connections: Dict[str, WebSocket] = {}


# Mock user store
users_db = {"alice": "password123", "bob": "password456"}

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/login")
async def login(request:LoginRequest):
    username = request.username
    password = request.password
    if username in users_db and users_db[username] == password:
        active_connections[username] = None  # Placeholder until WebSocket connects
        return {"message": "Login successful", "username": username}
    return {"message": "Invalid credentials"}, 401

@app.get("/users")
async def get_online_users():
    return {"online_users": [user for user, ws in active_connections.items() if ws is not None]}


@app.websocket("/ws/chat/{username}")
async def websocket_chat(websocket: WebSocket, username: str):
    await websocket.accept()
    active_connections[username] = websocket

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            message_id = message.get("message_id", str(uuid.uuid4()))
            recipient = message["recipient"]

            # Simulate 50% message drop
            if random.random() < 0.5:
                print(f"Simulated drop of message {message_id}")
                await store_pending_message(recipient, message)
                continue

            await send_message(recipient, message)

            # Acknowledge sender
            await websocket.send_json({"ack": message_id})

    except WebSocketDisconnect:
        active_connections[username] = None
        print(f"{username} disconnected")

# Store undelivered message in Redis
async def store_pending_message(recipient, message):
    await redis_client.rpush(f"pending:{recipient}", json.dumps(message))

# Deliver pending messages when user reconnects
async def deliver_pending_messages(username):
    pending_key = f"pending:{username}"
    while await redis_client.llen(pending_key):
        msg_data = await redis_client.lpop(pending_key)
        message = json.loads(msg_data)
        await send_message(username, message)

# Function to send a message ensuring de-duplication
async def send_message(recipient, message):
    if recipient in active_connections and active_connections[recipient]:
        await active_connections[recipient].send_json({
            "message": message["content"],
            "sender": message["sender"],
            "message_id": message["message_id"],
            "timestamp": message["timestamp"]
        })


@app.websocket("/ws/signaling/{username}")
async def websocket_signaling(websocket: WebSocket, username: str):
    await websocket.accept()
    active_connections[username] = websocket
    await deliver_pending_messages(username)

    try:
        while True:
            data = await websocket.receive_text()
            signal = json.loads(data)
            target_user = signal["target"]

            # Forward signaling data (SDP/ICE) to target user if online
            if target_user in active_connections and active_connections[target_user]:
                await active_connections[target_user].send_json({
                    "from": username,
                    "type": signal["type"],
                    "data": signal["data"]
                })

    except WebSocketDisconnect:
        active_connections[username] = None
        print(f"{username} disconnected")
