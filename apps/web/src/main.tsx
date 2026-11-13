import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SessionProvider } from './auth/Session';
import './styles.css';
import './workbench.css';

createRoot(document.getElementById('root')!).render(<StrictMode><SessionProvider><App /></SessionProvider></StrictMode>);
