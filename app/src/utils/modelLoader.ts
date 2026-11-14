import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

let sharedLoader: GLTFLoader | null = null;

export function getSharedGLTFLoader(): GLTFLoader {
  if (!sharedLoader) {
    sharedLoader = new GLTFLoader();
    sharedLoader.setMeshoptDecoder(MeshoptDecoder);
  }
  return sharedLoader;
}

/**
 * Configure any GLTFLoader instance with MeshoptDecoder
 */
export function configureLoader(loader: GLTFLoader): void {
  loader.setMeshoptDecoder(MeshoptDecoder);
}
