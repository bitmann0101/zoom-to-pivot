import * as THREE from "three";
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
const EPSILON = 1e-5;
function approxZero(number, error = EPSILON) {
  return Math.abs(number) < error;
}
let _v3A = new THREE.Vector3();
let _v3B = new THREE.Vector3();
let _v3C = new THREE.Vector3();
let _cameraDirection = new THREE.Vector3();
let _xColumn = new THREE.Vector3();
let _yColumn = new THREE.Vector3();
let _zColumn = new THREE.Vector3();
let _deltaTarget = new THREE.Vector3();
let _deltaOffset = new THREE.Vector3();
function smoothDamp(
  current,
  target,
  currentVelocityRef,
  smoothTime,
  maxSpeed = Infinity,
  deltaTime
) {
  // Based on Game Programming Gems 4 Chapter 1.10
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const originalTo = target;
  // Clamp maximum speed
  const maxChange = maxSpeed * smoothTime;
  change = clamp(change, -maxChange, maxChange);
  target = current - change;
  const temp = (currentVelocityRef.value + omega * change) * deltaTime;
  currentVelocityRef.value = (currentVelocityRef.value - omega * temp) * exp;
  let output = target + (change + temp) * exp;
  // Prevent overshooting
  if (originalTo - current > 0.0 === output > originalTo) {
    output = originalTo;
    currentVelocityRef.value = (output - originalTo) / deltaTime;
  }
  return output;
}

function smoothDampVec3(
  current,
  target,
  currentVelocityRef,
  smoothTime,
  maxSpeed = Infinity,
  deltaTime,
  out
) {
  // Based on Game Programming Gems 4 Chapter 1.10
  smoothTime = Math.max(0.0001, smoothTime);
  const omega = 2 / smoothTime;
  const x = omega * deltaTime;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let targetX = target.x;
  let targetY = target.y;
  let targetZ = target.z;
  let changeX = current.x - targetX;
  let changeY = current.y - targetY;
  let changeZ = current.z - targetZ;
  const originalToX = targetX;
  const originalToY = targetY;
  const originalToZ = targetZ;
  // Clamp maximum speed
  const maxChange = maxSpeed * smoothTime;
  const maxChangeSq = maxChange * maxChange;
  const magnitudeSq = changeX * changeX + changeY * changeY + changeZ * changeZ;
  if (magnitudeSq > maxChangeSq) {
    const magnitude = Math.sqrt(magnitudeSq);
    changeX = (changeX / magnitude) * maxChange;
    changeY = (changeY / magnitude) * maxChange;
    changeZ = (changeZ / magnitude) * maxChange;
  }
  targetX = current.x - changeX;
  targetY = current.y - changeY;
  targetZ = current.z - changeZ;
  const tempX = (currentVelocityRef.x + omega * changeX) * deltaTime;
  const tempY = (currentVelocityRef.y + omega * changeY) * deltaTime;
  const tempZ = (currentVelocityRef.z + omega * changeZ) * deltaTime;
  currentVelocityRef.x = (currentVelocityRef.x - omega * tempX) * exp;
  currentVelocityRef.y = (currentVelocityRef.y - omega * tempY) * exp;
  currentVelocityRef.z = (currentVelocityRef.z - omega * tempZ) * exp;
  out.x = targetX + (changeX + tempX) * exp;
  out.y = targetY + (changeY + tempY) * exp;
  out.z = targetZ + (changeZ + tempZ) * exp;
  // Prevent overshooting
  const origMinusCurrentX = originalToX - current.x;
  const origMinusCurrentY = originalToY - current.y;
  const origMinusCurrentZ = originalToZ - current.z;
  const outMinusOrigX = out.x - originalToX;
  const outMinusOrigY = out.y - originalToY;
  const outMinusOrigZ = out.z - originalToZ;
  if (
    origMinusCurrentX * outMinusOrigX +
      origMinusCurrentY * outMinusOrigY +
      origMinusCurrentZ * outMinusOrigZ >
    0
  ) {
    out.x = originalToX;
    out.y = originalToY;
    out.z = originalToZ;
    currentVelocityRef.x = (out.x - originalToX) / deltaTime;
    currentVelocityRef.y = (out.y - originalToY) / deltaTime;
    currentVelocityRef.z = (out.z - originalToZ) / deltaTime;
  }
  return out;
}

function isPerspectiveCamera(camera) {
  return camera.isPerspectiveCamera;
}
function isOrthographicCamera(camera) {
  return camera.isOrthographicCamera;
}

const DOLLY_DIRECTION = {
  NONE: 0,
  IN: 1,
  OUT: -1,
};
const DEG2RAD = Math.PI / 180;

export const cameraUpdate = function (delta) {
  const deltaTheta = this._sphericalEnd.theta - this._spherical.theta;
  const deltaPhi = this._sphericalEnd.phi - this._spherical.phi;
  const deltaRadius = this._sphericalEnd.radius - this._spherical.radius;
  const deltaTarget = _deltaTarget.subVectors(this._targetEnd, this._target);
  const deltaOffset = _deltaOffset.subVectors(
    this._focalOffsetEnd,
    this._focalOffset
  );
  const deltaZoom = this._zoomEnd - this._zoom;
  // update theta
  if (approxZero(deltaTheta)) {
    this._thetaVelocity.value = 0;
    this._spherical.theta = this._sphericalEnd.theta;
  } else {
    const smoothTime = this._isUserControllingRotate
      ? this.draggingSmoothTime
      : this.smoothTime;
    this._spherical.theta = smoothDamp(
      this._spherical.theta,
      this._sphericalEnd.theta,
      this._thetaVelocity,
      smoothTime,
      Infinity,
      delta
    );
    this._needsUpdate = true;
  }
  // update phi
  if (approxZero(deltaPhi)) {
    this._phiVelocity.value = 0;
    this._spherical.phi = this._sphericalEnd.phi;
  } else {
    const smoothTime = this._isUserControllingRotate
      ? this.draggingSmoothTime
      : this.smoothTime;
    this._spherical.phi = smoothDamp(
      this._spherical.phi,
      this._sphericalEnd.phi,
      this._phiVelocity,
      smoothTime,
      Infinity,
      delta
    );
    this._needsUpdate = true;
  }
  // update distance
  if (approxZero(deltaRadius)) {
    this._radiusVelocity.value = 0;
    this._spherical.radius = this._sphericalEnd.radius;
  } else {
    const smoothTime = this._isUserControllingDolly
      ? this.draggingSmoothTime
      : this.smoothTime;
    this._spherical.radius = smoothDamp(
      this._spherical.radius,
      this._sphericalEnd.radius,
      this._radiusVelocity,
      smoothTime,
      this.maxSpeed,
      delta
    );
    this._needsUpdate = true;
  }
  // update target position
  if (
    approxZero(deltaTarget.x) &&
    approxZero(deltaTarget.y) &&
    approxZero(deltaTarget.z)
  ) {
    this._targetVelocity.set(0, 0, 0);
    this._target.copy(this._targetEnd);
  } else {
    const smoothTime = this._isUserControllingTruck
      ? this.draggingSmoothTime
      : this.smoothTime;
    smoothDampVec3(
      this._target,
      this._targetEnd,
      this._targetVelocity,
      smoothTime,
      this.maxSpeed,
      delta,
      this._target
    );
    this._needsUpdate = true;
  }
  // update focalOffset
  if (
    approxZero(deltaOffset.x) &&
    approxZero(deltaOffset.y) &&
    approxZero(deltaOffset.z)
  ) {
    this._focalOffsetVelocity.set(0, 0, 0);
    this._focalOffset.copy(this._focalOffsetEnd);
  } else {
    const smoothTime = this._isUserControllingOffset
      ? this.draggingSmoothTime
      : this.smoothTime;
    smoothDampVec3(
      this._focalOffset,
      this._focalOffsetEnd,
      this._focalOffsetVelocity,
      smoothTime,
      this.maxSpeed,
      delta,
      this._focalOffset
    );
    this._needsUpdate = true;
  }
  // update zoom
  if (approxZero(deltaZoom)) {
    this._zoomVelocity.value = 0;
    this._zoom = this._zoomEnd;
  } else {
    const smoothTime = this._isUserControllingZoom
      ? this.draggingSmoothTime
      : this.smoothTime;
    this._zoom = smoothDamp(
      this._zoom,
      this._zoomEnd,
      this._zoomVelocity,
      smoothTime,
      Infinity,
      delta
    );
  }
  if (this.dollyToCursor) {
    if (isPerspectiveCamera(this._camera) && this._changedDolly !== 0) {
      const dollyControlAmount = this._spherical.radius - this._lastDistance;
      const camera = this._camera;
      const cameraDirection = this._getCameraDirection(_cameraDirection);
      const planeX = _v3A.copy(cameraDirection).cross(camera.up).normalize();
      if (planeX.lengthSq() === 0) planeX.x = 1.0;
      const planeY = _v3B.crossVectors(planeX, cameraDirection);
      const worldToScreen =
        this._sphericalEnd.radius *
        Math.tan(camera.getEffectiveFOV() * DEG2RAD * 0.5);
      const prevRadius = this._sphericalEnd.radius - dollyControlAmount;
      const lerpRatio =
        (prevRadius - this._sphericalEnd.radius) / this._sphericalEnd.radius;
      const cursor = _v3C
        .copy(this._targetEnd)
        .add(
          planeX.multiplyScalar(
            this._dollyControlCoord.x * worldToScreen * camera.aspect
          )
        )
        .add(planeY.multiplyScalar(this._dollyControlCoord.y * worldToScreen));
      const newTargetEnd = _v3A.copy(this._targetEnd).lerp(cursor, lerpRatio);
      const isMin =
        this._lastDollyDirection === DOLLY_DIRECTION.IN &&
        this._spherical.radius <= this.minDistance;
      const isMax =
        this._lastDollyDirection === DOLLY_DIRECTION.OUT &&
        this.maxDistance <= this._spherical.radius;
      if (this.infinityDolly && (isMin || isMax)) {
        this._sphericalEnd.radius -= dollyControlAmount;
        this._spherical.radius -= dollyControlAmount;
        const dollyAmount = _v3B
          .copy(cameraDirection)
          .multiplyScalar(-dollyControlAmount);
        newTargetEnd.add(dollyAmount);
      }
      // target position may be moved beyond boundary.
      this._boundary.clampPoint(newTargetEnd, newTargetEnd);
      const targetEndDiff = _v3B.subVectors(newTargetEnd, this._targetEnd);
      this._targetEnd.copy(newTargetEnd);
      this._target.add(targetEndDiff);
      this._changedDolly -= dollyControlAmount;
      if (approxZero(this._changedDolly)) this._changedDolly = 0;
    } else if (isOrthographicCamera(this._camera) && this._changedZoom !== 0) {
      const dollyControlAmount = this._zoom - this._lastZoom;
      const camera = this._camera;
      const worldCursorPosition = _v3A
        .set(
          this._dollyControlCoord.x,
          this._dollyControlCoord.y,
          (camera.near + camera.far) / (camera.near - camera.far)
        )
        .unproject(camera);
      const quaternion = _v3B.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const cursor = _v3C
        .copy(worldCursorPosition)
        .add(quaternion.multiplyScalar(-worldCursorPosition.dot(camera.up)));
      const prevZoom = this._zoom - dollyControlAmount;
      const lerpRatio = -(prevZoom - this._zoom) / this._zoom;
      // find the "distance" (aka plane constant in three.js) of Plane
      // from a given position (this._targetEnd) and normal vector (cameraDirection)
      // https://www.maplesoft.com/support/help/maple/view.aspx?path=MathApps%2FEquationOfAPlaneNormal#bkmrk0
      const cameraDirection = this._getCameraDirection(_cameraDirection);
      const prevPlaneConstant = this._targetEnd.dot(cameraDirection);
      const newTargetEnd = _v3A.copy(this._targetEnd).lerp(cursor, lerpRatio);
      const newPlaneConstant = newTargetEnd.dot(cameraDirection);
      // Pull back the camera depth that has moved, to be the camera stationary as zoom
      const pullBack = cameraDirection.multiplyScalar(
        newPlaneConstant - prevPlaneConstant
      );
      newTargetEnd.sub(pullBack);
      // target position may be moved beyond boundary.
      this._boundary.clampPoint(newTargetEnd, newTargetEnd);
      const targetEndDiff = _v3B.subVectors(newTargetEnd, this._targetEnd);
      this._targetEnd.copy(newTargetEnd);
      this._target.add(targetEndDiff);
      // this._target.copy( this._targetEnd );
      this._changedZoom -= dollyControlAmount;
      if (approxZero(this._changedZoom)) this._changedZoom = 0;
    }
  }
  if (this._camera.zoom !== this._zoom) {
    this._camera.zoom = this._zoom;
    this._camera.updateProjectionMatrix();
    this._updateNearPlaneCorners();
    this._needsUpdate = true;
  }
  this._dragNeedsUpdate = true;
  // collision detection
  const maxDistance = this._collisionTest();
  this._spherical.radius = Math.min(this._spherical.radius, maxDistance);
  // decompose spherical to the camera position
  this._spherical.makeSafe();
  this._camera.position
    .setFromSpherical(this._spherical)
    .applyQuaternion(this._yAxisUpSpaceInverse)
    .add(this._target);
  this._camera.lookAt(this._target);
  // set offset after the orbit movement
  const affectOffset =
    !approxZero(this._focalOffset.x) ||
    !approxZero(this._focalOffset.y) ||
    !approxZero(this._focalOffset.z);
  if (affectOffset) {
    this._camera.updateMatrixWorld();
    _xColumn.setFromMatrixColumn(this._camera.matrix, 0);
    _yColumn.setFromMatrixColumn(this._camera.matrix, 1);
    _zColumn.setFromMatrixColumn(this._camera.matrix, 2);
    _xColumn.multiplyScalar(this._focalOffset.x);
    _yColumn.multiplyScalar(-this._focalOffset.y);
    _zColumn.multiplyScalar(this._focalOffset.z); // notice: z-offset will not affect in Orthographic.
    _v3A.copy(_xColumn).add(_yColumn).add(_zColumn);
    this._camera.position.add(_v3A);
  }
  if (this._boundaryEnclosesCamera) {
    this._encloseToBoundary(
      this._camera.position.copy(this._target),
      _v3A
        .setFromSpherical(this._spherical)
        .applyQuaternion(this._yAxisUpSpaceInverse),
      1.0
    );
  }
  const updated = this._needsUpdate;
  if (updated && !this._updatedLastTime) {
    this._hasRested = false;
    this.dispatchEvent({ type: "wake" });
    this.dispatchEvent({ type: "update" });
  } else if (updated) {
    this.dispatchEvent({ type: "update" });
    if (
      approxZero(deltaTheta, this.restThreshold) &&
      approxZero(deltaPhi, this.restThreshold) &&
      approxZero(deltaRadius, this.restThreshold) &&
      approxZero(deltaTarget.x, this.restThreshold) &&
      approxZero(deltaTarget.y, this.restThreshold) &&
      approxZero(deltaTarget.z, this.restThreshold) &&
      approxZero(deltaOffset.x, this.restThreshold) &&
      approxZero(deltaOffset.y, this.restThreshold) &&
      approxZero(deltaOffset.z, this.restThreshold) &&
      approxZero(deltaZoom, this.restThreshold) &&
      !this._hasRested
    ) {
      this._hasRested = true;
      this.dispatchEvent({ type: "rest" });
    }
  } else if (!updated && this._updatedLastTime) {
    this.dispatchEvent({ type: "sleep" });
  }
  this._lastDistance = this._spherical.radius;
  this._lastZoom = this._zoom;
  this._updatedLastTime = updated;
  this._needsUpdate = false;
  return updated;
};
