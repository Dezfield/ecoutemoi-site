import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { defaultAppUrl } from './content';
import './styles.css';
const base = document.documentElement.dataset.base || '/';
const path = document.documentElement.dataset.route || window.location.pathname.replace(/\/$/, '') || '/';
// Prerendered pages carry the app URL they were rendered with (keeps hydration consistent);
// `vite dev` has no prerender step and may point to a local app via VITE_APP_URL.
const appUrl = document.documentElement.dataset.appUrl || import.meta.env.VITE_APP_URL || defaultAppUrl;
const root = document.getElementById('root')!;
if (root.hasChildNodes()) hydrateRoot(root, <App path={path} base={base} appUrl={appUrl}/>);
else createRoot(root).render(<App path={path} base={base} appUrl={appUrl}/>);
