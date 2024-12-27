import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://exam-temp-backend.onrender.com'); // Backend URL

const CameraSync = () => {
  const laptopVideoRef = useRef(null);
  const mobileVideoRef = useRef(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [examId, setExamId] = useState('');
  const [role, setRole] = useState('laptop'); // Role can be 'laptop' or 'mobile'
  const [stream, setStream] = useState(null);

  useEffect(() => {
    // Function to start the camera stream
    const startCamera = async (role) => {
      try {
        const userStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(userStream);

        if (role === 'laptop') {
          laptopVideoRef.current.srcObject = userStream;
        } else {
          mobileVideoRef.current.srcObject = userStream;
        }

        return userStream;
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    // Function to initialize WebRTC connection
    const initWebRTC = (stream) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (role === 'laptop') {
          mobileVideoRef.current.srcObject = event.streams[0];
        } else {
          laptopVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('candidate', { candidate: event.candidate, examId });
        }
      };

      setPeerConnection(pc);
    };

    // Join a room with examId and role
    const joinRoom = async (examId, role) => {
      socket.emit('joinRoom', { examId, role });
      const userStream = await startCamera(role);
      initWebRTC(userStream);
    };

    if (examId && role) {
      joinRoom(examId, role);
    }

    return () => {
      if (peerConnection) peerConnection.close();
    };
  }, [examId, role]);

  useEffect(() => {
    if (!peerConnection) return;

    socket.on('startVideoSync', ({ role }) => {
      if (role === 'laptop') {
        socket.emit('offer', { offer: peerConnection.localDescription, examId });
      } else {
        socket.emit('offer', { offer: peerConnection.localDescription, examId });
      }
    });

    socket.on('offer', async (data) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', { answer, examId });
    });

    socket.on('answer', async (data) => {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    socket.on('candidate', async (data) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });
  }, [peerConnection, examId]);

  const handleExamIdChange = (e) => {
    setExamId(e.target.value);
  };

  const handleRoleChange = (e) => {
    setRole(e.target.value);
  };

  return (
    <div>
      <h2>Camera Sync</h2>
      <input
        type="text"
        placeholder="Enter Exam ID"
        value={examId}
        onChange={handleExamIdChange}
      />
      <select onChange={handleRoleChange} value={role}>
        <option value="laptop">Laptop</option>
        <option value="mobile">Mobile</option>
      </select>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div>
          <h3>{role === 'laptop' ? 'Laptop Camera' : 'Mobile Camera'}</h3>
          <video
            ref={laptopVideoRef}
            autoPlay
            playsInline
            style={{ width: '300px', border: '1px solid #ccc' }}
          />
        </div>
        <div>
          <h3>{role === 'laptop' ? 'Mobile Camera' : 'Laptop Camera'}</h3>
          <video
            ref={mobileVideoRef}
            autoPlay
            playsInline
            style={{ width: '300px', border: '1px solid #ccc' }}
          />
        </div>
      </div>
    </div>
  );
};

export default CameraSync;
