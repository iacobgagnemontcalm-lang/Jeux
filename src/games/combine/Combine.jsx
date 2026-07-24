import { Routes, Route } from 'react-router-dom';
import Entry from './Entry.jsx';
import SessionView from './SessionView.jsx';

// Sub-router for Combine (mounted at /combine/*). The .combine wrapper applies
// the field/turf theme.
export default function Combine() {
  return (
    <div className="combine">
      <Routes>
        <Route index element={<Entry />} />
        <Route path=":pin" element={<SessionView />} />
      </Routes>
    </div>
  );
}
