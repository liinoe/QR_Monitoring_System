import { BrowserRouter as Router, Routes, Route } from "react-router-dom";  
import Dashboard from "./pages/Dashboard";
import StudentLogs from "./pages/studentLogs";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/student-logs" element={<StudentLogs />} />
      </Routes>
    </Router>
  );
}
 
export default App; 