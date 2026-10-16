import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Navbar } from "./components/Navbar";
import { Login } from "./components/Login";
import MachineList from "./components/MachineList";
import MachineDetail from "./components/MachineDetail";
import { BackupsList } from "./components/BackupsList";
import { ScheduledTasksList } from "./components/ScheduledTasksList";
import { TransfersList } from "./components/TransfersList";

const listPageStyle = { maxWidth: 1280, margin: "0 auto", padding: "20px" } as const;

function AppLayout() {
  return (
    <div className="app-wrapper">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<AppLayout />}>
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
            <Route
              path="/scheduled-tasks"
              element={
                <ProtectedRoute>
                  <div style={listPageStyle}>
                    <ScheduledTasksList showHeader={true} />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backups"
              element={
                <ProtectedRoute>
                  <div style={listPageStyle}>
                    <BackupsList showHeader={true} />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route
              path="/transfers"
              element={
                <ProtectedRoute>
                  <div style={listPageStyle}>
                    <TransfersList showHeader={true} />
                  </div>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
