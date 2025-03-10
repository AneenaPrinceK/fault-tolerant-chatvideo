// App.js
import React, { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);

  const chatSocket = useRef(null);
  const signalingSocket = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerConnection = useRef(null);

  const login = async () => {
    const res = await fetch('http://localhost:8000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.username) {
      setIsLoggedIn(true);
      connectWebSocket(data.username);
      fetchOnlineUsers();
    }
  };

  const fetchOnlineUsers = async () => {
    const res = await fetch('http://localhost:8000/users');
    const data = await res.json();
    setOnlineUsers(data.online_users);
  };

  const connectWebSocket = (user) => {
    chatSocket.current = new WebSocket(`ws://localhost:8000/ws/chat/${user}`);
    signalingSocket.current = new WebSocket(`ws://localhost:8000/ws/signaling/${user}`);

    chatSocket.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.message) setMessages((prev) => [...prev, `${data.sender}: ${data.message}`]);
    };

    signalingSocket.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'offer') handleOffer(data);
      if (data.type === 'answer') handleAnswer(data);
      if (data.type === 'ice') handleIce(data);
    };
  };

  const sendMessage = () => {
    const msg = { sender: username, content: message, recipient, timestamp: Date.now(), message_id: uuidv4() };
    chatSocket.current.send(JSON.stringify(msg));
    setMessages((prev) => [...prev, `Me: ${message}`]);
    setMessage('');
  };

  const startVideoCall = async (target) => {
    peerConnection.current = new RTCPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));

    peerConnection.current.ontrack = (event) => setRemoteStream(event.streams[0]);
    peerConnection.current.onicecandidate = (event) => event.candidate && signalingSocket.current.send(JSON.stringify({ type: 'ice', data: event.candidate, target }));

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    signalingSocket.current.send(JSON.stringify({ type: 'offer', data: offer, target }));
  };

  const handleOffer = async (data) => {
    peerConnection.current = new RTCPeerConnection();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));

    peerConnection.current.ontrack = (event) => setRemoteStream(event.streams[0]);
    peerConnection.current.onicecandidate = (event) => event.candidate && signalingSocket.current.send(JSON.stringify({ type: 'ice', data: event.candidate, target: data.from }));

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.data));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    signalingSocket.current.send(JSON.stringify({ type: 'answer', data: answer, target: data.from }));
  };

  const handleAnswer = async (data) => await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.data));
  const handleIce = async (data) => await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.data));

  return (
    <div className="p-4">
      {!isLoggedIn ? (
        <div>
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button onClick={login}>Login</button>
        </div>
      ) : (
        <div>
          <h2>Welcome, {username}</h2>
          <h3>Online Users:</h3>
          <ul>
            {onlineUsers.map((user) => (
              <li key={user}>
                {user}
                <button onClick={() => setRecipient(user)}>Chat</button>
                <button onClick={() => startVideoCall(user)}>Video Call</button>
              </li>
            ))}
          </ul>

          <div>
            <h3>Chatting with: {recipient}</h3>
            <div className="border h-40 overflow-auto">{messages.map((msg, idx) => (<div key={idx}>{msg}</div>))}</div>
            <input placeholder="Type message..." value={message} onChange={(e) => setMessage(e.target.value)} />
            <button onClick={sendMessage}>Send</button>
          </div>

          <div className="mt-4">
            <h3>Video Call</h3>
            <div className="flex">
              {localStream && <video autoPlay muted ref={(ref) => ref && (ref.srcObject = localStream)} className="w-1/2" />}
              {remoteStream && <video autoPlay ref={(ref) => ref && (ref.srcObject = remoteStream)} className="w-1/2" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
