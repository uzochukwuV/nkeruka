import { MemoryRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import TestRunner from './components/TestRunner';
import Scheduler from './components/Scheduler';
import './App.css';

function Navigation() {
  const location = useLocation();

  return (
    <nav className="main-nav">
      <Link
        to="/"
        className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
      >
        Manual Testing
      </Link>
      <Link
        to="/scheduler"
        className={`nav-link ${location.pathname === '/scheduler' ? 'active' : ''}`}
      >
        Automated Scheduler
      </Link>
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Navigation />
        <div className="content">
          <Routes>
            <Route path="/" element={<TestRunner />} />
            <Route path="/scheduler" element={<Scheduler />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
