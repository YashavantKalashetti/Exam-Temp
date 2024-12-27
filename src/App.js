import React, { useState } from "react";
import CameraSync from "./CameraSync";

function App() {
  const [examId, setExamId] = useState("");
  const [role, setRole] = useState("");
  const [startSync, setStartSync] = useState(false);

  const handleStart = () => {
    if (examId && role) {
      setStartSync(true);
    } else {
      alert("Please enter Exam ID and Role");
    }
  };

  return <CameraSync />
}

export default App;
