import { Routes, Route } from 'react-router-dom';
import Entry from './Entry.jsx';
import SessionView from './SessionView.jsx';

// Sub-router for Spin the Wheel (mounted at /spin-the-wheel/*).
// The .stw wrapper applies the NFL theme (navy / red / white / silver).
export default function SpinTheWheel() {
  return (
    <div className="stw">
      <Routes>
        <Route index element={<Entry />} />
        <Route path=":pin" element={<SessionView />} />
      </Routes>
    </div>
  );
}
