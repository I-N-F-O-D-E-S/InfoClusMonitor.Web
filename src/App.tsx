import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import { Login } from "./components/Login";
import MachineList from "./components/MachineList";
import MachineDetail from "./components/MachineDetail";
import { BackupsList } from "./components/BackupsList";
import { ScheduledTasksList } from "./components/ScheduledTasksList";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-wrapper">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MachineList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/machines/:id"
                element={
                  <ProtectedRoute>
                    <MachineDetail />
                  </ProtectedRoute>
                }
              />
              <Route path="/transfers" element={<Navigate to="/backups" replace />} />
              <Route
                path="/scheduled-tasks"
                element={
                  <ProtectedRoute>
                    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px" }}>
                      <ScheduledTasksList showHeader={true} />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/backups"
                element={
                  <ProtectedRoute>
                    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px" }}>
                      <BackupsList showHeader={true} />
                    </div>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
