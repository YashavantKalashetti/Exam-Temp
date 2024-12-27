import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("https://exam-temp-backend.onrender.com"); // Backend signaling server

const CameraSync = ({ role, examId }) => {
  const laptopVideoRef = useRef(null); // Ref for laptop camera
  const mobileVideoRef = useRef(null); // Ref for mobile camera

  const [peerConnection, setPeerConnection] = useState(null);

  useEffect(() => {
    if (!examId) {
      console.error("Exam ID is required");
      return;
    }

    // Join the signaling room with the Exam ID
    socket.emit("joinRoom", { examId });

    // WebRTC Peer Connection setup
    const initWebRTC = () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.ontrack = (event) => {
        if (mobileVideoRef.current && event.streams[0]) {
          mobileVideoRef.current.srcObject = event.streams[0];
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("candidate", { candidate: event.candidate, examId });
        }
      };

      setPeerConnection(pc);
      return pc;
    };

    const startLocalCamera = async (pc) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (laptopVideoRef.current) {
          laptopVideoRef.current.srcObject = stream;
        }
        // Add the stream from laptop camera to the peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      } catch (error) {
        console.error("Error accessing laptop camera:", error);
      }
    };

    const pc = initWebRTC();
    startLocalCamera(pc);

    return () => {
      if (peerConnection) {
        peerConnection.close();
      }
      socket.emit("leaveRoom", { examId });
    };
  }, [examId]);

  useEffect(() => {
    if (!peerConnection) return;

    // Laptop is the offerer
    if (role === "laptop") {
      socket.on("offer", async ({ offer }) => {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          socket.emit("answer", { answer, examId });
        } catch (error) {
          console.error("Error handling offer:", error);
        }
      });
    }

    // Mobile is the offer receiver and will send the offer
    if (role === "mobile") {
      const createAndSendOffer = async () => {
        try {
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          socket.emit("offer", { offer, examId });
        } catch (error) {
          console.error("Error creating and sending offer:", error);
        }
      };
      createAndSendOffer();
    }

    // Handle the answer from the laptop
    socket.on("answer", async ({ answer }) => {
      if (role === "mobile") {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error("Error handling answer:", error);
        }
      }
    });

    // Handle ICE candidates
    socket.on("candidate", async ({ candidate }) => {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });
  }, [peerConnection, role, examId]);

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      <div>
        <h3>Laptop Camera</h3>
        <video
          ref={laptopVideoRef}
          autoPlay
          playsInline
          style={{ width: "300px", height: "auto", border: "1px solid #ccc" }}
        />
      </div>
      <div>
        <h3>Mobile Camera</h3>
        <video
          ref={mobileVideoRef}
          autoPlay
          playsInline
          style={{ width: "300px", height: "auto", border: "1px solid #ccc" }}
        />
      </div>
    </div>
  );
};

export default CameraSync;
