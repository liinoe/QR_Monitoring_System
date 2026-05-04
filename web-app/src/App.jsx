import { BrowserRouter as Router, Routes, Route } from "react-router-dom";  
import Dashboard from "./pages/admin interface/Dashboard";
import StudentLogs from "./pages/admin interface/studentLogs";
import Registrations from "./pages/admin interface/Registrations";
import GuestLogs from "./pages/admin interface/GuestLogs";
import Scanner from "./pages/scan interface/Scanner";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registrations" element={<Registrations />} />
        <Route path="/student-logs" element={<StudentLogs />} />
        <Route path="/guest-logs" element={<GuestLogs />} />
        <Route path="/scanner" element={<Scanner />} />
      </Routes>
    </Router>
  );
}
 
export default App; 