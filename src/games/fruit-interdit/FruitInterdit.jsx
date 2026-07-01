import { Routes, Route } from 'react-router-dom';
import Entry from './Entry.jsx';
import SessionView from './SessionView.jsx';

// Sub-router for the Fruit Interdit game (mounted at /fruit-interdit/*).
export default function FruitInterdit() {
  return (
    <Routes>
      <Route index element={<Entry />} />
      <Route path=":pin" element={<SessionView />} />
    </Routes>
  );
}
