// GLB で作ったキャラクター（#43 モフ）を読み込み、島の上に立つ大きさ・位置にそろえる。
// 島の描画（src/vendor/island.js）は window.THREE を使う素の JS なので、
// ローダーはこちらで持ち、window.IslandCharacterModels.load(kind) として渡す（ADR-006）。
import * as THREE from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// 既存キャラ（ぽこ 約0.66）と並べて違和感のない高さ。モフは横に広いので少し低めにする
export const CHARACTER_MODEL_HEIGHT = 0.5;

export const CHARACTER_MODEL_URLS: Record<string, string> = {
  mofu: '/models/mofu.glb',
};

// three 0.128 に同梱のデコーダを public/draco/ から配る（ADR-006）
const DRACO_DECODER_PATH = '/draco/';

export interface Bounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

// 足元を y=0、水平方向の中心を原点に置き、高さを targetHeight にそろえる倍率と移動量
export function computeModelFit(
  bounds: Bounds,
  targetHeight: number
): { scale: number; offset: { x: number; y: number; z: number } } {
  const height = bounds.max.y - bounds.min.y;
  if (!(height > 0)) throw new Error('モデルの高さが 0 です');
  const scale = targetHeight / height;
  return {
    scale,
    offset: {
      x: (-(bounds.min.x + bounds.max.x) / 2) * scale,
      y: -bounds.min.y * scale,
      z: (-(bounds.min.z + bounds.max.z) / 2) * scale,
    },
  };
}

let loader: GLTFLoader | null = null;
function getLoader(): GLTFLoader {
  if (!loader) {
    const draco = new DRACOLoader();
    draco.setDecoderPath(DRACO_DECODER_PATH);
    loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
  }
  return loader;
}

// 島は状態が変わるたびに作り直されるので、読み込みは1回だけにして毎回 clone を返す
const cache = new Map<string, Promise<THREE.Object3D>>();

function loadFitted(kind: string): Promise<THREE.Object3D> {
  const url = CHARACTER_MODEL_URLS[kind];
  if (!url) return Promise.reject(new Error(`未登録のキャラクター: ${kind}`));
  let p = cache.get(kind);
  if (!p) {
    p = getLoader()
      .loadAsync(url)
      .then((gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const fit = computeModelFit(box, CHARACTER_MODEL_HEIGHT);
        model.scale.setScalar(fit.scale);
        model.position.set(fit.offset.x, fit.offset.y, fit.offset.z);
        model.traverse((ob) => {
          if ((ob as THREE.Mesh).isMesh) ob.castShadow = true;
        });
        const holder = new THREE.Group();
        holder.add(model);
        return holder;
      });
    // 失敗はキャッシュしない（次の作り直しで再挑戦できるように）
    p.catch(() => cache.delete(kind));
    cache.set(kind, p);
  }
  return p.then((holder) => holder.clone(true));
}

export function installCharacterModelLoader(): void {
  (window as unknown as { IslandCharacterModels: { load: typeof loadFitted } }).IslandCharacterModels =
    { load: loadFitted };
}
