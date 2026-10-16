import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LabErrorBoundary } from './components/LabErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <LabErrorBoundary>
    <App />
  </LabErrorBoundary>
);
