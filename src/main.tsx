import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
const base = document.documentElement.dataset.base || '/';
const path = document.documentElement.dataset.route || window.location.pathname.replace(/\/$/, '') || '/';
const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, <App path={path} base={base}/>);
else createRoot(root).render(<App path={path} base={base}/>);
