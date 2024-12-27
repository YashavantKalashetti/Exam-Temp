import React, { useRef, useState, useEffect } from "react";
import * as faceapi from "face-api.js";

const ExamMonitoring = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [alert, setAlert] = useState(false);
  const [audioAlert, setAudioAlert] = useState(false);

  useEffect(() => {
    // const loadModels = async () => {
    //   try {
    //     console.log("Loading models...");
    //     await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
    //     await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
    //     await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
    //     await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
    //     console.log("Models loaded successfully.");
    //     startVideo();
    //   } catch (error) {
    //     console.error("Error loading models:", error);
    //   }
    // };

    const loadModels = async () => {
        try {
          console.log("Loading Tiny Face Detector model...");
          await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
          console.log("Tiny Face Detector model loaded successfully.");
      
          console.log("Loading Face Landmark model...");
          await faceapi.nets.faceLandmark68Net.loadFromUri("/models");
          console.log("Face Landmark model loaded successfully.");
      
          console.log("Loading Face Recognition model...1");
          await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
          console.log("Face Recognition model loaded successfully.");
      
          console.log("Loading SSD Mobilenetv1 model...2");
          await faceapi.nets.ssdMobilenetv1.loadFromUri("/models");
          console.log("SSD Mobilenetv1 model loaded successfully.");
        } catch (error) {
          console.error("Error loading models:", error.message);
        }
      };
      

    const startVideo = () => {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          videoRef.current.srcObject = stream;
          monitorAudio(stream);
        })
        .catch((err) => console.error("Error accessing camera:", err));
    };

    const monitorAudio = (stream) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkLoudness = () => {
        analyser.getByteFrequencyData(dataArray);
        const avgVolume = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioAlert(avgVolume > 100); // Adjust threshold as necessary
      };

      setInterval(checkLoudness, 500);
    };

    loadModels();
  }, []);

  const handleVideoPlay = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    setInterval(async () => {
      try {
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        if (!detections || detections.length === 0) {
          setAlert(true); // No faces detected
          return;
        }

        const multipleFaces = detections.length > 1;
        setAlert(multipleFaces);

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
      } catch (error) {
        console.error("Error during face detection:", error);
      }
    }, 100);
  };

  return (
    <div>
      <div
        style={{
          border: `5px solid ${alert || audioAlert ? "red" : "green"}`,
          display: "inline-block",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          width="640"
          height="480"
          onPlay={handleVideoPlay}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
          }}
          width="640"
          height="480"
        />
      </div>
      {audioAlert && <p style={{ color: "red" }}>Loud noise detected!</p>}
      {alert && <p style={{ color: "red" }}>Suspicious activity detected!</p>}
    </div>
  );
};

export default ExamMonitoring;
