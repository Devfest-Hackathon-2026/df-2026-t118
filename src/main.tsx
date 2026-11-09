import React from 'react';
import ReactDOM from 'react-dom/client';
import * as THREE from 'three';
import { installCharacterModelLoader } from './infrastructure/three/characterModels';
import { App } from './presentation/App';
import './presentation/styles/styles.css';

(window as unknown as { THREE: typeof THREE }).THREE = THREE;
// GLB のキャラクター（モフ）は島の描画から window 経由で読み込む
installCharacterModelLoader();

async function bootstrap() {
  await import('./vendor/island.js');

  const rootEl = document.getElementById('root');
  if (rootEl) {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  }
}

void bootstrap();
