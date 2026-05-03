import { BrowserRouter as Router, Routes, Route } from "react-router-dom";  
import Dashboard from "./pages/Dashboard";
import StudentLogs from "./pages/studentLogs";
import Registrations from "./pages/Registrations";
import GuestLogs from "./pages/GuestLogs";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registrations" element={<Registrations />} />
        <Route path="/student-logs" element={<StudentLogs />} />
        <Route path="/guest-logs" element={<GuestLogs />} />
      </Routes>
    </Router>
  );
}
 
export default App; 