import React from "react";
import CameraSync from "./CameraSync";

function App() {
  const role = new URLSearchParams(window.location.search).get("role");

  if (!role) {
    return <h3>Please specify a role: laptop or mobile (e.g., ?role=laptop)</h3>;
  }

  return (
    <div>
      <CameraSync role={role} />
    </div>
  );
}

export default App;