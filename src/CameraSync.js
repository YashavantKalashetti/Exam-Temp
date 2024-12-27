import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://exam-temp-backend.onrender.com"); // Backend signaling server

const CameraSync = ({ role }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    const initWebRTC = () => {
      if (peerConnection) return; // Avoid multiple PeerConnection instances

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("candidate", event.candidate);
        }
      };

      setPeerConnection(pc);
      return pc;
    };

    const startLocalCamera = async (pc) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (role === "mobile") {
          // Add local stream tracks to PeerConnection for mobile role
          stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        }
      } catch (error) {
        console.error("Error accessing local camera:", error);
      }
    };

    const pc = initWebRTC();
    startLocalCamera(pc);

    return () => {
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }
    };
  }, [peerConnection, role]);

  useEffect(() => {
    if (!peerConnection) return;

    if (role === "laptop") {
      socket.on("offer", async (data) => {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit("answer", answer);
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      });
    } else if (role === "mobile") {
      const createAndSendOffer = async () => {
        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.emit("offer", offer);
        } catch (error) {
          console.error("Error creating and sending offer:", error);
        }
      };
      createAndSendOffer();
    }

    socket.on("answer", async (data) => {
      if (role === "mobile") {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
        } catch (error) {
          console.error("Error handling answer:", error);
        }
      }
    });

    socket.on("candidate", async (data) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });
  }, [peerConnection, role]);

  return (
    <div>
      <h2>Camera Sync ({role === "laptop" ? "Laptop" : "Mobile"})</h2>
      <div style={{ display: "flex", gap: "20px" }}>
        <div>
          <h3>Local Camera</h3>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            style={{ width: "300px", height: "auto", border: "1px solid #ccc" }}
          />
        </div>
        <div>
          <h3>Remote Camera</h3>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{ width: "300px", height: "auto", border: "1px solid #ccc" }}
          />
        </div>
      </div>
    </div>
  );
};

export default CameraSync;
