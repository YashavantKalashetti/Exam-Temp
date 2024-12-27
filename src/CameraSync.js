import React, { useState, useRef, useEffect } from 'react';
import { io } from 'socket.io-client';

const VideoShare = () => {
  const [roomId, setRoomId] = useState('');
  const [deviceType, setDeviceType] = useState('laptop');
  const [status, setStatus] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const socketRef = useRef();
  const peerRef = useRef();
  const streamRef = useRef();

  const initializePeerConnection = () => {
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
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return peer;
  };

  const startStream = async () => {
    try {
      const constraints = {
        video: {
          facingMode: deviceType === 'phone' ? 'environment' : 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      localVideoRef.current.srcObject = stream;
      return stream;
    } catch (error) {
      setStatus(`Camera error: ${error.message}`);
      throw error;
    }
  };

  const handleConnect = async () => {
    if (!roomId) {
      setStatus('Enter room ID');
      return;
    }

    try {
      const stream = await startStream();
      socketRef.current = io('https://exam-temp-backend.onrender.com');
      peerRef.current = initializePeerConnection();

      stream.getTracks().forEach(track => {
        peerRef.current.addTrack(track, stream);
      });

      socketRef.current.emit('join', { roomId, deviceType });

      socketRef.current.on('start-connection', async ({ deviceType: initiatorType }) => {
        if (deviceType === 'laptop') {
          const offer = await peerRef.current.createOffer();
          await peerRef.current.setLocalDescription(offer);
          socketRef.current.emit('offer', { roomId, offer });
        }
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
        try {
          await peerRef.current.addIceCandidate(candidate);
        } catch (error) {
          console.error('Ice candidate error:', error);
        }
      });

      socketRef.current.on('device-disconnected', (disconnectedDevice) => {
        setStatus(`${disconnectedDevice} disconnected`);
        setIsConnected(false);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });

      setIsConnected(true);
      setStatus('Connected');
    } catch (error) {
      setStatus(`Connection failed: ${error.message}`);
    }
  };

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
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
          placeholder="Room ID"
          className="border p-2 mr-2"
          disabled={isConnected}
        />
        <select
          value={deviceType}
          onChange={(e) => setDeviceType(e.target.value)}
          className="border p-2 mr-2"
          disabled={isConnected}
        >
          <option value="laptop">Laptop Screen</option>
          <option value="phone">Phone Screen</option>
        </select>
        <button
          onClick={handleConnect}
          disabled={isConnected}
          className="bg-blue-500 text-white p-2 rounded"
        >
          {isConnected ? 'Connected' : 'Connect'}
        </button>
      </div>

      <div className="text-sm mb-4">{status}</div>

      <div className="flex gap-4">
        <div>
          <h3>{deviceType === 'laptop' ? 'Laptop Screen' : 'Phone Screen'}</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-[400px] h-[300px] border"
          />
        </div>
        <div>
          <h3>{deviceType === 'laptop' ? 'Phone Screen' : 'Laptop Screen'}</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-[400px] h-[300px] border"
          />
        </div>
      </div>
    </div>
  );
};

export default VideoShare;