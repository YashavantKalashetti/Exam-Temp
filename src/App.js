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

  return (
    <div>
      {!startSync ? (
        <div style={{ margin: "20px" }}>
          <h2>Enter Exam ID and Role</h2>
          <input
            type="text"
            placeholder="Exam ID"
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            style={{ margin: "10px", padding: "5px", width: "200px" }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} style={{ margin: "10px", padding: "5px" }}>
            <option value="">Select Role</option>
            <option value="laptop">Laptop</option>
            <option value="mobile">Mobile</option>
          </select>
          <button onClick={handleStart} style={{ padding: "5px 10px" }}>
            Start Syncing
          </button>
        </div>
      ) : (
        <CameraSync role={role} examId={examId} />
      )}
    </div>
  );
}

export default App;
