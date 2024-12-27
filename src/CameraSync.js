import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const CameraSync = () => {
  const [roomId, setRoomId] = useState('');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('');
  
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();
  const localStreamRef = useRef();

  const createPeerConnection = () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', {
          roomId,
          candidate: event.candidate
        });
      }
    };

    peer.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    return peer;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: false 
      });
      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;
      return stream;
    } catch (error) {
      setStatus('Camera access denied');
      throw error;
    }
  };

  const handleConnect = async () => {
    if (!roomId) {
      setStatus('Please enter a room ID');
      return;
    }

    try {
      const stream = await startCamera();
      
      socketRef.current = io('https://exam-temp-backend.onrender.com');
      peerRef.current = createPeerConnection();
      
      stream.getTracks().forEach(track => {
        peerRef.current.addTrack(track, stream);
      });

      socketRef.current.emit('join', { roomId });

      socketRef.current.on('ready', async () => {
        const offer = await peerRef.current.createOffer();
        await peerRef.current.setLocalDescription(offer);
        socketRef.current.emit('offer', { roomId, offer });
      });

      socketRef.current.on('offer', async (offer) => {
        await peerRef.current.setRemoteDescription(offer);
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        socketRef.current.emit('answer', { roomId, answer });
      });

      socketRef.current.on('answer', async (answer) => {
        await peerRef.current.setRemoteDescription(answer);
      });

      socketRef.current.on('ice-candidate', async (candidate) => {
        await peerRef.current.addIceCandidate(candidate);
      });

      socketRef.current.on('peer-disconnected', () => {
        setConnected(false);
        setStatus('Peer disconnected');
        remoteVideoRef.current.srcObject = null;
      });

      setConnected(true);
      setStatus('Connected');
    } catch (error) {
      setStatus('Connection failed: ' + error.message);
    }
  };

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerRef.current?.close();
      socketRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="p-4">
      <div className="mb-4">
        <input
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          placeholder="Enter Room ID"
          className="border p-2 mr-2"
          disabled={connected}
        />
        <button
          onClick={handleConnect}
          disabled={connected}
          className="bg-blue-500 text-white p-2 rounded"
        >
          {connected ? 'Connected' : 'Connect'}
        </button>
      </div>
      
      {status && <div className="mb-4 text-sm">{status}</div>}
      
      <div className="flex gap-4">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-[300px] h-[225px] border"
        />
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-[300px] h-[225px] border"
        />
      </div>
    </div>
  );
};

export default CameraSync;