import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const DEFAULT_SPEED = 2.6; // 1 unit = 10 km, so ~26 km/h

export class Player {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;

    this.model = new THREE.Group();
    this.model.name = 'player';
    this.model.position.set(0, world.getSurfaceHeight() + 0.02, 0);

    this.speed = DEFAULT_SPEED;
    this.cameraOffset = new THREE.Vector3(0, 11, -12);
    this.lookOffset = new THREE.Vector3(0, 1.4, 0);
    this.movement = { forward: false, backward: false, left: false, right: false };
    this.moveDirection = new THREE.Vector2();

    this.#buildAvatar();
    this.scene.add(this.model);

    this.#handleKeyDown = this.#handleKeyDown.bind(this);
    this.#handleKeyUp = this.#handleKeyUp.bind(this);
    window.addEventListener('keydown', this.#handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.#handleKeyUp, { passive: false });
  }

  setPosition(x, z) {
    const clamped = this.world.clampToBounds(x, z);
    this.model.position.set(clamped.x, this.world.getSurfaceHeight() + 0.02, clamped.z);
    this.#updateCamera(true);
  }

  update(delta) {
    const dt = Math.min(delta, 0.1);

    this.moveDirection.set(0, 0);
    if (this.movement.forward) {
      this.moveDirection.y += 1;
    }
    if (this.movement.backward) {
      this.moveDirection.y -= 1;
    }
    if (this.movement.left) {
      this.moveDirection.x -= 1;
    }
    if (this.movement.right) {
      this.moveDirection.x += 1;
    }

    if (this.moveDirection.lengthSq() > 0) {
      this.moveDirection.normalize();
      this.#applyMovement(dt);
      const angle = Math.atan2(this.moveDirection.x, this.moveDirection.y);
      this.model.rotation.y = angle;
    }

    this.model.position.y = this.world.getSurfaceHeight() + 0.02;
    this.#updateCamera();
  }

  get position() {
    return this.model.position;
  }

  dispose() {
    window.removeEventListener('keydown', this.#handleKeyDown);
    window.removeEventListener('keyup', this.#handleKeyUp);
    this.scene.remove(this.model);
  }

  #applyMovement(delta) {
    const moveX = this.moveDirection.x * this.speed * delta;
    const moveZ = this.moveDirection.y * this.speed * delta;

    const desiredX = this.model.position.x + moveX;
    const desiredZ = this.model.position.z + moveZ;

    const clamped = this.world.clampToBounds(desiredX, desiredZ);
    let nextX = clamped.x;
    let nextZ = clamped.z;

    if (this.world.isWalkable(nextX, nextZ)) {
      this.model.position.x = nextX;
      this.model.position.z = nextZ;
      return;
    }

    if (moveX !== 0 && this.world.isWalkable(this.model.position.x + moveX, this.model.position.z)) {
      this.model.position.x += moveX;
    }
    if (moveZ !== 0 && this.world.isWalkable(this.model.position.x, this.model.position.z + moveZ)) {
      this.model.position.z += moveZ;
    }
  }

  #updateCamera(immediate = false) {
    const target = new THREE.Vector3().copy(this.model.position).add(this.cameraOffset);
    if (immediate) {
      this.camera.position.copy(target);
    } else {
      this.camera.position.lerp(target, 0.12);
    }
    const lookAt = new THREE.Vector3().copy(this.model.position).add(this.lookOffset);
    this.camera.lookAt(lookAt);
  }

  #buildAvatar() {
    const bodyGeometry = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc66, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.6;
    body.castShadow = true;

    const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffe0bd, roughness: 0.4 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.3;
    head.castShadow = true;

    const indicatorGeometry = new THREE.RingGeometry(0.15, 0.25, 32);
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    indicator.rotation.x = -Math.PI / 2;
    indicator.position.y = 0.01;

    this.model.add(body, head, indicator);
  }

  #handleKeyDown(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.movement.forward = true;
        event.preventDefault();
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.movement.backward = true;
        event.preventDefault();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.movement.left = true;
        event.preventDefault();
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.movement.right = true;
        event.preventDefault();
        break;
      default:
        break;
    }
  }

  #handleKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.movement.forward = false;
        event.preventDefault();
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.movement.backward = false;
        event.preventDefault();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.movement.left = false;
        event.preventDefault();
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.movement.right = false;
        event.preventDefault();
        break;
      default:
        break;
    }
  }
}
