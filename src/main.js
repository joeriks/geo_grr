import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { World } from './world.js';
import { Player } from './player.js';
import { UIManager } from './ui.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.domElement.id = 'game-canvas';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 200);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 15, -20);
camera.lookAt(0, 0, 0);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(-120, 160, -120);
sunLight.castShadow = true;
sunLight.shadow.bias = -0.0002;
sunLight.shadow.mapSize.set(2048, 2048);
const range = 320;
sunLight.shadow.camera.left = -range;
sunLight.shadow.camera.right = range;
sunLight.shadow.camera.top = range;
sunLight.shadow.camera.bottom = -range;
sunLight.shadow.camera.near = 5;
sunLight.shadow.camera.far = 500;
sunLight.target.position.set(0, 0, 0);
scene.add(sunLight);
scene.add(sunLight.target);

const world = new World(scene);
const ui = new UIManager();

const discovered = {
  countries: new Set(),
  capitals: new Set(),
};
let pendingUiUpdate = true;

const loadingElement = document.getElementById('loading');

async function init() {
  try {
    await world.load();
    const markers = world.getMarkers();
    ui.setTotals(markers.length, markers.length);

    const player = new Player(scene, camera, world);
    const spawn = world.getSpawnPoint();
    player.setPosition(spawn.x, spawn.z);

    if (loadingElement) {
      loadingElement.remove();
    }

    window.addEventListener('resize', () => onWindowResize(camera));

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      player.update(delta);
      if (updateDiscovery(player, markers)) {
        pendingUiUpdate = true;
      }
      if (pendingUiUpdate) {
        ui.update(discovered);
        pendingUiUpdate = false;
      }
      renderer.render(scene, camera);
    }

    animate();
  } catch (error) {
    console.error('Kunde inte ladda världen', error);
    if (loadingElement) {
      loadingElement.textContent = 'Kunde inte ladda världen.';
    }
  }
}

function updateDiscovery(player, markers) {
  let changed = false;
  const px = player.position.x;
  const pz = player.position.z;

  for (const marker of markers) {
    const dx = marker.group.position.x - px;
    const dz = marker.group.position.z - pz;
    const distance = Math.hypot(dx, dz);
    if (distance <= marker.discoverRadius) {
      if (!marker.countryDiscovered) {
        marker.countryDiscovered = true;
        marker.flagMaterial.color.setHex(0xffffff);
        discovered.countries.add(`${marker.flag} ${marker.country}`);
        changed = true;
      }
      if (!marker.capitalDiscovered) {
        marker.capitalDiscovered = true;
        marker.signMaterial.color.setHex(0xffffff);
        discovered.capitals.add(`${marker.capital} (${marker.country})`);
        changed = true;
      }
    }
  }

  return changed;
}

function onWindowResize(activeCamera) {
  activeCamera.aspect = window.innerWidth / window.innerHeight;
  activeCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
