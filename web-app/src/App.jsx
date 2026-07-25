import { BrowserRouter as Router, Routes, Route } from "react-router-dom"; 
import Dashboard from "./pages/admin interface/Dashboard";
import StudentLogs from "./pages/admin interface/studentLogs";
import Registrations from "./pages/admin interface/Registrations";
import GuestLogs from "./pages/admin interface/GuestLogs";
import Analytics from "./pages/admin interface/Analytics";
import Scanner from "./pages/scan interface/Scanner";
import Settings from "./pages/admin interface/Settings"; 
import Guest from "./pages/guest interface/Guest";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registrations" element={<Registrations />} />
        <Route path="/student-logs" element={<StudentLogs />} />
        <Route path="/guest-logs" element={<GuestLogs />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/guest" element={<Guest />} />
      </Routes>
    </Router>
  );
}

export default App;