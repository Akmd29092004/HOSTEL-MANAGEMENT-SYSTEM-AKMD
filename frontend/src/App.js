import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import Rooms from "./pages/Rooms";
import StaffPage from "./pages/Staff";
import Fees from "./pages/Fees";
import Attendance from "./pages/Attendance";
import Complaints from "./pages/Complaints";
import Food from "./pages/Food";
import MyProfile from "./pages/MyProfile";
import MyRoom from "./pages/MyRoom";
import MyFees from "./pages/MyFees";
import MyAttendance from "./pages/MyAttendance";

const ADMIN_ROLES = ["admin"];
const STAFF_ROLES = ["staff"];
const STUDENT_ROLES = ["student"];


function RoleHome() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={`/${user.role}`} replace />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleHome />} />
          <Route path="/login" element={<Login />} />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="fees" element={<Fees />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="food" element={<Food />} />
          </Route>

          {/* Staff */}
          <Route
            path="/staff"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="attendance" element={<Attendance />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="food" element={<Food />} />
          </Route>

          {/* Student */}
          <Route
            path="/student"
            element={
              <ProtectedRoute roles={STUDENT_ROLES}>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="profile" element={<MyProfile />} />
            <Route path="room" element={<MyRoom />} />
            <Route path="fees" element={<MyFees />} />
            <Route path="attendance" element={<MyAttendance />} />
            <Route path="complaints" element={<Complaints />} />
            <Route path="food" element={<Food />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="bottom-right" duration={2500} />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
