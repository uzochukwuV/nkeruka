import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import TestRunner from './components/TestRunner';
import './App.css';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TestRunner />} />
      </Routes>
    </Router>
  );
}
