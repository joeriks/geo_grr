import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';

const KM_PER_DEGREE_LAT = 111.32;
const WATER_MARGIN = 5;

function kmPerDegreeLon(latDegrees) {
  return Math.cos(THREE.MathUtils.degToRad(latDegrees)) * KM_PER_DEGREE_LAT;
}

function pointInRing(pointX, pointZ, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x;
    const zi = ring[i].z;
    const xj = ring[j].x;
    const zj = ring[j].z;

    const intersect =
      (zi > pointZ) !== (zj > pointZ) &&
      pointX < ((xj - xi) * (pointZ - zi)) / ((zj - zi) || 1e-9) + xi;

    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.kmPerUnit = 10; // 1 world unit ≈ 10 km
    this.landHeight = 0.4;
    this.landPolygons = [];
    this.countryMarkers = [];
    this.markerGroup = new THREE.Group();
    this.scene.add(this.markerGroup);

    this.minX = Infinity;
    this.maxX = -Infinity;
    this.minZ = Infinity;
    this.maxZ = -Infinity;

    this.referenceLat = 0;
    this.referenceLon = 0;
    this.kmPerDegreeLat = KM_PER_DEGREE_LAT;
    this.kmPerDegreeLon = KM_PER_DEGREE_LAT;
  }

  async load() {
    const geoResponse = await fetch('./data/europe.geojson');
    const geojson = await geoResponse.json();
    this.#computeGeoBounds(geojson.features);

    this.kmPerDegreeLon = kmPerDegreeLon(this.referenceLat);

    const landMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f9a6f,
      roughness: 0.6,
      metalness: 0.1,
    });
    landMaterial.side = THREE.DoubleSide;

    const extrudeSettings = {
      depth: this.landHeight,
      bevelEnabled: false,
      steps: 1,
    };

    this.landGroup = new THREE.Group();
    this.landGroup.name = 'land';

    for (const feature of geojson.features) {
      this.#buildFeature(feature, landMaterial, extrudeSettings);
    }

    this.scene.add(this.landGroup);

    this.mapWidth = this.maxX - this.minX;
    this.mapHeight = this.maxZ - this.minZ;

    this.#buildWater();

    await this.#loadMarkers();
  }

  getMarkers() {
    return this.countryMarkers;
  }

  getSurfaceHeight() {
    return this.landHeight;
  }

  getSpawnPoint() {
    if (this.countryMarkers.length) {
      const first = this.countryMarkers.find((marker) => marker.isAccessible);
      if (first) {
        return { x: first.group.position.x, z: first.group.position.z };
      }
    }
    const snapped = this.snapToLand(0, 0);
    return { x: snapped.x, z: snapped.z };
  }

  clampToBounds(x, z) {
    const margin = 1.5;
    const clampedX = Math.min(Math.max(x, this.minX - margin), this.maxX + margin);
    const clampedZ = Math.min(Math.max(z, this.minZ - margin), this.maxZ + margin);
    return { x: clampedX, z: clampedZ };
  }

  isWalkable(x, z) {
    if (x < this.minX || x > this.maxX || z < this.minZ || z > this.maxZ) {
      return false;
    }
    return this.#isLand(x, z);
  }

  snapToLand(x, z) {
    if (this.isWalkable(x, z)) {
      return { x, z, found: true };
    }
    const maxRadius = 8;
    const step = 0.25;
    for (let radius = step; radius <= maxRadius; radius += step) {
      const samples = Math.ceil((Math.PI * 2 * radius) / step);
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        const nx = x + Math.cos(angle) * radius;
        const nz = z + Math.sin(angle) * radius;
        if (this.isWalkable(nx, nz)) {
          return { x: nx, z: nz, found: true };
        }
      }
    }
    return { x, z, found: false };
  }

  lonLatToXZ(lon, lat, trackExtents = true) {
    const deltaLon = lon - this.referenceLon;
    const deltaLat = lat - this.referenceLat;

    const x = (deltaLon * this.kmPerDegreeLon) / this.kmPerUnit;
    const z = (deltaLat * this.kmPerDegreeLat) / this.kmPerUnit;

    if (trackExtents) {
      this.minX = Math.min(this.minX, x);
      this.maxX = Math.max(this.maxX, x);
      this.minZ = Math.min(this.minZ, z);
      this.maxZ = Math.max(this.maxZ, z);
    }

    return new THREE.Vector2(x, z);
  }

  #computeGeoBounds(features) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    const register = (lon, lat) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return;
      }
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    };

    const processGeometry = (geometry) => {
      if (!geometry) {
        return;
      }
      if (geometry.type === 'Polygon') {
        for (const ring of geometry.coordinates) {
          for (const [lon, lat] of ring) {
            register(lon, lat);
          }
        }
      } else if (geometry.type === 'MultiPolygon') {
        for (const polygon of geometry.coordinates) {
          for (const ring of polygon) {
            for (const [lon, lat] of ring) {
              register(lon, lat);
            }
          }
        }
      }
    };

    for (const feature of features) {
      processGeometry(feature.geometry);
    }

    this.referenceLat = (minLat + maxLat) / 2;
    this.referenceLon = (minLon + maxLon) / 2;
  }

  #buildFeature(feature, landMaterial, extrudeSettings) {
    const geometry = feature.geometry;
    if (!geometry) {
      return;
    }

    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) {
      if (!polygon || !polygon.length) {
        continue;
      }
      const shape = new THREE.Shape();
      const outerRing = polygon[0];
      if (!outerRing || outerRing.length < 3) {
        continue;
      }

      const outerPoints = outerRing.map(([lon, lat]) => this.lonLatToXZ(lon, lat));
      shape.moveTo(outerPoints[0].x, outerPoints[0].y);
      for (let i = 1; i < outerPoints.length; i++) {
        shape.lineTo(outerPoints[i].x, outerPoints[i].y);
      }

      const holes = [];
      for (let i = 1; i < polygon.length; i++) {
        const ring = polygon[i];
        if (!ring || ring.length < 3) {
          continue;
        }
        const holePoints = ring.map(([lon, lat]) => this.lonLatToXZ(lon, lat));
        const path = new THREE.Path();
        path.moveTo(holePoints[0].x, holePoints[0].y);
        for (let j = 1; j < holePoints.length; j++) {
          path.lineTo(holePoints[j].x, holePoints[j].y);
        }
        shape.holes.push(path);
        holes.push(holePoints.map((p) => ({ x: p.x, z: p.y })));
      }

      const polygonData = {
        outer: outerPoints.map((p) => ({ x: p.x, z: p.y })),
        holes,
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
      };
      for (const point of polygonData.outer) {
        polygonData.minX = Math.min(polygonData.minX, point.x);
        polygonData.maxX = Math.max(polygonData.maxX, point.x);
        polygonData.minZ = Math.min(polygonData.minZ, point.z);
        polygonData.maxZ = Math.max(polygonData.maxZ, point.z);
      }

      const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, extrudeSettings), landMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      this.landGroup.add(mesh);
      this.landPolygons.push(polygonData);
    }
  }

  #buildWater() {
    const width = this.mapWidth + WATER_MARGIN * 2;
    const height = this.mapHeight + WATER_MARGIN * 2;
    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    const material = new THREE.MeshPhongMaterial({
      color: 0x4a7abf,
      shininess: 60,
      transparent: true,
      opacity: 0.9,
    });
    const water = new THREE.Mesh(geometry, material);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0;
    water.receiveShadow = true;
    this.scene.add(water);
    this.water = water;
  }

  async #loadMarkers() {
    const response = await fetch('./data/capitals.json');
    const capitals = await response.json();

    for (const entry of capitals) {
      const position2d = this.lonLatToXZ(entry.lon, entry.lat, false);
      const snapped = this.snapToLand(position2d.x, position2d.y);
      const markerPosition = new THREE.Vector3(snapped.x, this.landHeight, snapped.z);

      const markerGroup = new THREE.Group();
      markerGroup.position.copy(markerPosition);

      const { group: flagGroup, material: flagMaterial } = this.#createFlagPole(entry.flag);
      flagGroup.position.set(0.2, 0, 0);
      markerGroup.add(flagGroup);

      const { mesh: signMesh, material: signMaterial } = this.#createCitySign(entry.capital, entry.country);
      signMesh.position.set(0, 0.2, -1.2);
      markerGroup.add(signMesh);

      markerGroup.userData = { country: entry.country, capital: entry.capital };

      this.markerGroup.add(markerGroup);

      this.countryMarkers.push({
        country: entry.country,
        capital: entry.capital,
        flag: entry.flag,
        group: markerGroup,
        position: markerPosition,
        flagMaterial,
        signMaterial,
        discoverRadius: 1.5,
        isAccessible: snapped.found,
        countryDiscovered: false,
        capitalDiscovered: false,
      });
    }
  }

  #createFlagPole(flagEmoji) {
    const group = new THREE.Group();
    const poleHeight = 2.2;

    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, poleHeight, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.3, roughness: 0.6 });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);
    pole.position.y = poleHeight / 2;
    pole.castShadow = true;
    group.add(pole);

    const { mesh: flagMesh, material } = this.#createFlag(flagEmoji);
    flagMesh.position.set(0.35, poleHeight - 0.6, 0);
    group.add(flagMesh);

    return { group, material };
  }

  #createFlag(flagEmoji) {
    const width = 256;
    const height = 170;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#000000';
    context.font = '120px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(flagEmoji, width / 2, height / 2 + 10);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      color: 0xaaaaaa,
      toneMapped: false,
    });

    const aspect = width / height;
    const flagWidth = 1.2;
    const flagHeight = flagWidth / aspect;
    const geometry = new THREE.PlaneGeometry(flagWidth, flagHeight);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;

    return { mesh, material };
  }

  #createCitySign(capital, country) {
    const width = 512;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    context.fillStyle = 'rgba(30, 30, 30, 0.85)';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.font = 'bold 60px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillText(capital, width / 2, 60);
    context.font = '36px sans-serif';
    context.textBaseline = 'bottom';
    context.fillText(country, width / 2, height - 60);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      color: 0x999999,
      toneMapped: false,
    });

    const aspect = width / height;
    const signWidth = 1.6;
    const signHeight = signWidth / aspect;
    const geometry = new THREE.PlaneGeometry(signWidth, signHeight);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;

    return { mesh, material };
  }

  #isLand(x, z) {
    for (const polygon of this.landPolygons) {
      if (x < polygon.minX || x > polygon.maxX || z < polygon.minZ || z > polygon.maxZ) {
        continue;
      }
      if (!pointInRing(x, z, polygon.outer)) {
        continue;
      }
      let insideHole = false;
      for (const hole of polygon.holes) {
        if (pointInRing(x, z, hole)) {
          insideHole = true;
          break;
        }
      }
      if (!insideHole) {
        return true;
      }
    }
    return false;
  }
}
