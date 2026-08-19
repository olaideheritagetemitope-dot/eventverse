import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import EventVerseApp from './EventVerse.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <EventVerseApp />
  </React.StrictMode>,
);
