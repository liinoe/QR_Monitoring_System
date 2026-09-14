import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/admin interface/Dashboard";
import StudentLogs from "./pages/admin interface/studentLogs";
import Registrations from "./pages/admin interface/Registrations";
import GuestLogs from "./pages/admin interface/GuestLogs";
import Analytics from "./pages/admin interface/Analytics";
import Scanner from "./pages/scan interface/Scanner";
import Settings from "./pages/admin interface/Settings";
import Guest from "./pages/guest interface/Guest";
import Login from "./pages/admin interface/Login";
import Bootstrap from "./pages/admin interface/Bootstrap";
import ManageStudents from "./pages/admin interface/ManageStudents";
import { ProtectedRoute, SuperAdminRoute } from "./components/ProtectedRoute";
import GuestLanding from "./pages/guest interface/Guest_landing";
import GuestLogout from "./pages/guest interface/Guest_logout";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public / unauthenticated routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/bootstrap" element={<Bootstrap />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/guest" element={<Guest />} />
        <Route path="/guest-landing" element={<GuestLanding />} /> 
        <Route path="/guest-logout" element={<GuestLogout />} />


        {/* Any logged-in admin/staff */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/registrations" element={<ProtectedRoute><Registrations /></ProtectedRoute>} />
        <Route path="/student-logs" element={<ProtectedRoute><StudentLogs /></ProtectedRoute>} />
        <Route path="/guest-logs" element={<ProtectedRoute><GuestLogs /></ProtectedRoute>} />
        <Route path="/manage-students" element={<ProtectedRoute><ManageStudents /></ProtectedRoute>} />

        {/* Super admin only  */}
        <Route path="/analytics" element={<SuperAdminRoute><Analytics /></SuperAdminRoute>} />
        <Route path="/settings" element={<SuperAdminRoute><Settings /></SuperAdminRoute>} />
      </Routes>
    </Router>
  );
}

export default App;