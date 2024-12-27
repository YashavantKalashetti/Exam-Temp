import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const CameraSync = () => {
  const [roomId, setRoomId] = useState('');
  const [deviceType, setDeviceType] = useState('laptop');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const createPeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('iceCandidate', {
          roomId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = (event) => {
      console.log('Connection state:', pc.connectionState);
    };

    return pc;
  };

  const startLocalStream = async () => {
    try {
      const constraints = {
        video: {
          facingMode: deviceType === 'phone' ? 'environment' : 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
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
      socketRef.current = io('http://localhost:8888/', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      const stream = await startLocalStream();
      peerConnectionRef.current = createPeerConnection();

      stream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      socketRef.current.on('connect', () => {
        console.log('Socket connected');
        socketRef.current.emit('joinRoom', { roomId, deviceType });
      });

      socketRef.current.on('roomReady', async () => {
        if (deviceType === 'laptop') {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          socketRef.current.emit('offer', { roomId, offer });
        }
      });

      socketRef.current.on('offer', async (offer) => {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socketRef.current.emit('answer', { roomId, answer });
      });

      socketRef.current.on('answer', async (answer) => {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socketRef.current.on('iceCandidate', async (candidate) => {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      });

      socketRef.current.on('participantLeft', ({ deviceType }) => {
        setStatus(`${deviceType} disconnected`);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        setConnected(false);
      });

      socketRef.current.on('connect_error', (error) => {
        setStatus('Connection error: ' + error.message);
      });

      setConnected(true);
      setStatus('Connected to room');
    } catch (error) {
      setStatus('Failed to connect: ' + error.message);
      console.error('Connection error:', error);
    }
  };

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
      peerConnectionRef.current?.close();
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
        <select
          value={deviceType}
          onChange={(e) => setDeviceType(e.target.value)}
          className="border p-2 mr-2"
          disabled={connected}
        >
          <option value="laptop">Laptop Screen</option>
          <option value="phone">Phone Screen</option>
        </select>
        <button
          onClick={handleConnect}
          disabled={connected}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {connected ? 'Connected' : 'Connect'}
        </button>
      </div>

      {status && (
        <div className="mb-4 text-sm text-gray-600">{status}</div>
      )}

      <div className="flex gap-4">
        <div>
          <h3 className="font-bold mb-2">Local Video</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-[400px] h-[300px] bg-gray-100 border"
          />
        </div>
        <div>
          <h3 className="font-bold mb-2">Remote Video</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-[400px] h-[300px] bg-gray-100 border"
          />
        </div>
      </div>
    </div>
  );
};

export default CameraSync;