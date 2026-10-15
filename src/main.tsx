import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/700.css';
import '@fontsource/silkscreen/400.css';
import '@fontsource/stix-two-text/400.css';
import '@fontsource/stix-two-text/400-italic.css';
import './styles/tokens.css';
import './styles/global.css';
import './styles/workspace.css';
import './styles/tools.css';
import App from './App';
import { IconSheet } from './dev/IconSheet';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.DEV && location.search.includes('icons') ? <IconSheet /> : <App />}
  </StrictMode>,
);
