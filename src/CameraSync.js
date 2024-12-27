import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:8888';

const CameraSync = () => {
  const [examId, setExamId] = useState('');
  const [role, setRole] = useState('laptop');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState('');
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // Initialize WebRTC peer connection
  const createPeerConnection = useCallback(() => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('iceCandidate', {
          candidate: event.candidate,
          examId,
          targetRole: role === 'laptop' ? 'mobile' : 'laptop'
        });
      }
    };

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return peerConnection;
  }, [examId, role]);

  // Start local camera stream
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (err) {
      setError('Failed to access camera. Please check permissions.');
      console.error('Error accessing media devices:', err);
    }
  }, []);

  // Initialize connection
  const initializeConnection = useCallback(async () => {
    if (!examId || !role) return;

    try {
      // Start local stream
      const stream = await startLocalStream();
      if (!stream) return;

      // Create and store peer connection
      const peerConnection = createPeerConnection();
      peerConnectionRef.current = peerConnection;

      // Add local stream tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Connect to signaling server
      socketRef.current = io(SERVER_URL);
      
      // Join room
      socketRef.current.emit('joinRoom', { examId, role });
      
      // Handle connection ready
      socketRef.current.on('ready', async () => {
        if (role === 'laptop') {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socketRef.current.emit('offer', {
            offer,
            examId,
            targetRole: 'mobile'
          });
        }
      });

      // Handle offer
      socketRef.current.on('offer', async ({ offer }) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socketRef.current.emit('answer', {
          answer,
          examId,
          targetRole: role === 'laptop' ? 'mobile' : 'laptop'
        });
      });

      // Handle answer
      socketRef.current.on('answer', async ({ answer }) => {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      });

      // Handle ICE candidates
      socketRef.current.on('iceCandidate', async ({ candidate }) => {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      });

      // Handle peer disconnection
      socketRef.current.on('peerDisconnected', () => {
        setIsConnected(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      setIsConnected(true);
    } catch (err) {
      setError('Failed to initialize connection');
      console.error('Connection error:', err);
    }
  }, [examId, role, createPeerConnection, startLocalStream]);

  // Cleanup function
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnectionRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  const handleConnect = () => {
    if (!examId) {
      setError('Please enter an exam ID');
      return;
    }
    setError('');
    initializeConnection();
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Camera Sync</h2>
      
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Enter Exam ID"
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          className="border p-2 rounded"
          disabled={isConnected}
        />
        
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border p-2 rounded"
          disabled={isConnected}
        >
          <option value="laptop">Laptop</option>
          <option value="mobile">Mobile</option>
        </select>
        
        <button
          onClick={handleConnect}
          disabled={isConnected}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isConnected ? 'Connected' : 'Connect'}
        </button>
      </div>

      {error && (
        <div className="text-red-500 mb-4">{error}</div>
      )}

      <div className="flex gap-4">
        <div>
          <h3 className="font-bold mb-2">Local Camera</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-[400px] h-[300px] border rounded bg-gray-100"
          />
        </div>
        
        <div>
          <h3 className="font-bold mb-2">Remote Camera</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-[400px] h-[300px] border rounded bg-gray-100"
          />
        </div>
      </div>
    </div>
  );
};

export default CameraSync;