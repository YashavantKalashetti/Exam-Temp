import React, { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import io from "socket.io-client";
import "./App.css";

const socket = io.connect("https://exam-backend-demo.onrender.com");

function App() {
  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);
  const [name, setName] = useState("");

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (myVideo.current) myVideo.current.srcObject = currentStream;
    });

    socket.on("me", (id) => setMe(id));
    socket.on("callUser", ({ from, name, signal }) => {
      setReceivingCall(true);
      setCaller(from);
      setName(name);
      setCallerSignal(signal);
    });
  }, []);

  const callUser = (id) => {
    const peer = new Peer({ initiator: true, trickle: false, stream });
    peer.on("signal", (data) => {
      socket.emit("callUser", { userToCall: id, signalData: data, from: me, name });
    });
    peer.on("stream", (currentStream) => {
      if (userVideo.current) userVideo.current.srcObject = currentStream;
    });
    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({ initiator: false, trickle: false, stream });
    peer.on("signal", (data) => socket.emit("answerCall", { signal: data, to: caller }));
    peer.on("stream", (currentStream) => {
      if (userVideo.current) userVideo.current.srcObject = currentStream;
    });
    peer.signal(callerSignal);

    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    connectionRef.current?.destroy();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(me);
    alert("Copied to clipboard!");
  };

  return (
    <div style={{ textAlign: "center", color: "#fff" }}>
      <h1>Exam Monitoring System</h1>
      <div className="container">
        <div className="video-container">
          <div className="video">
            {stream && <video playsInline muted ref={myVideo} autoPlay style={{ width: "300px" }} />}
          </div>
          <div className="video">
            {callAccepted && !callEnded && (
              <video playsInline ref={userVideo} autoPlay style={{ width: "300px" }} />
            )}
          </div>
        </div>
        <div className="myId">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: "20px", padding: "10px", width: "200px" }}
          />
          <button
            onClick={copyToClipboard}
            style={{
              marginBottom: "20px",
              padding: "10px",
              cursor: "pointer",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "5px",
            }}
          >
            Copy ID
          </button>
          <input
            type="text"
            placeholder="ID to Call"
            value={idToCall}
            onChange={(e) => setIdToCall(e.target.value)}
            style={{ marginBottom: "20px", padding: "10px", width: "200px" }}
          />
          <div>
            {callAccepted && !callEnded ? (
              <button
                onClick={leaveCall}
                style={{
                  padding: "10px",
                  cursor: "pointer",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                }}
              >
                End Call
              </button>
            ) : (
              <button
                onClick={() => callUser(idToCall)}
                style={{
                  padding: "10px",
                  cursor: "pointer",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                }}
              >
                Call
              </button>
            )}
          </div>
        </div>
        {receivingCall && !callAccepted && (
          <div className="caller">
            <h2>{name} is calling...</h2>
            <button
              onClick={answerCall}
              style={{
                padding: "10px",
                cursor: "pointer",
                backgroundColor: "#28a745",
                color: "white",
                border: "none",
                borderRadius: "5px",
              }}
            >
              Answer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
