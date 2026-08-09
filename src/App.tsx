import { BrowserRouter, Routes, Route } from "react-router-dom";
import MachineList from "./components/MachineList";
import MachineDetail from "./components/MachineDetail";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <header className="app-header">
          <h1>InfoClusMonitor</h1>
          <span className="text-muted">Machine Management System</span>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<MachineList />} />
            <Route path="/machines/:id" element={<MachineDetail />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
