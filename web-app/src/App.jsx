import { BrowserRouter as Router, Routes, Route } from "react-router-dom";  
import Dashboard from "./pages/Dashboard";
import StudentLogs from "./pages/studentLogs";
import Registrations from "./pages/Registrations";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/registrations" element={<Registrations />} />
        <Route path="/student-logs" element={<StudentLogs />} />
      </Routes>
    </Router>
  );
}
 
export default App; 