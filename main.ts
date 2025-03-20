import * as THREE from "three";
import * as OBC from "@thatopen-platform/components-beta";
import Stats from "stats.js";
import { cameraUpdate } from "./libs/camera-controls.helper";

const SELCTION_MODE = {
  DEFAULT: "DEFAULT",
  FUSTUM: "FUSTUM",
}

let seclectionMode = SELCTION_MODE.DEFAULT

async function main() {
  // Set up scene
  let frustumStartPoint = {clientX: 0, clientY: 0}
  let frustumEndPoint = {clientX: 0, clientY: 0}
  let isStartDrawFrustum = false

  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const container = document.getElementById("container") as HTMLDivElement;
  const pivotPoint = document.getElementById("pivot-point") as HTMLDivElement;

  const world = worlds.create<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  >();

  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, container);
  world.camera = new OBC.SimpleCamera(components);

  components.init();

  world.scene.setup();
  // world.camera.three.far = 10000;

  world.scene.three.add(new THREE.AxesHelper());

  world.camera.three.far = 10000;
  world.camera.three.near = 0.1;
  world.camera.three.frustumCulled = false;

  // Get fragments model

  // prettier-ignore
  const workerUrl = "./worker.mjs";
  const fragments = components.get(OBC.FragmentsManager);
  fragments.init(workerUrl);

  // LOAD MODEL

  async function loadModel(
    url: string,
    id = url,
    transform = new THREE.Vector3()
  ) {
    const fetched = await fetch(url);
    const buffer = await fetched.arrayBuffer();

    const model = await fragments.core.load(buffer, {
      modelId: id,
      camera: world.camera.three,
    });

    model.getClippingPlanesEvent = () => {
      return Array.from(world.renderer!.three.clippingPlanes) || [];
    };

    model.object.position.add(transform);

    world.scene.three.add(model.object);
  }

  loadModel("/medium_test.frag");

  // Scene update

  world.camera.controls.addEventListener("control", () =>
    fragments.core.update()
  );
  
  const stats = new Stats();
  stats.showPanel(2);
  document.body.append(stats.dom);
  stats.dom.style.left = "0px";
  stats.dom.style.zIndex = "unset";
  world.renderer.onBeforeUpdate.add(() => stats.begin());
  world.renderer.onAfterUpdate.add(() => stats.end());

  // Clipping plane system

  const casters = components.get(OBC.Raycasters);
  const caster = casters.get(world)

  const hidePivotPoint = () => {
    pivotPoint.style.display = "none";
  }

  const showPivotPoint = (x: number, y: number) => {
    pivotPoint.style.display = "block";
    pivotPoint.style.left = x + "px";
    pivotPoint.style.top = y + "px";
  }

  world.camera.controls['update'] = cameraUpdate
  world.camera.controls.minDistance = 0.01

  let frustumRectangle = document.getElementById("frustumRectangle") as HTMLDivElement;
  const updateFrustumRectangle = () => {
    if(!isStartDrawFrustum) return
    const x = Math.min(frustumStartPoint.clientX, frustumEndPoint.clientX)
    const y = Math.min(frustumStartPoint.clientY, frustumEndPoint.clientY)
    const width = Math.abs(frustumEndPoint.clientX - frustumStartPoint.clientX)
    const height = Math.abs(frustumEndPoint.clientY - frustumStartPoint.clientY)
    frustumRectangle.style.display = "block"
    frustumRectangle.style.left = x + "px"
    frustumRectangle.style.top = y + "px"
    frustumRectangle.style.width = width + "px"
    frustumRectangle.style.height = height + "px"
  }
  const hideFrustumRectangle = () => {
    frustumRectangle.style.display = "none"
  }

  // Create plane on click
  container.onpointerdown = async (event) => {
    if(event.target && event.target['tagName'] !== "CANVAS") return
    if(seclectionMode == SELCTION_MODE.DEFAULT) {
      const result = await caster.castRay();
      hidePivotPoint()
      if(result && result.point && event.button === 0) {
        const widthHalf = container.clientWidth / 2;
        const heightHalf = container.clientHeight / 2;
  
        world.camera.controls.setOrbitPoint(result.point.x, result.point.y, result.point.z);
        
        const projectPoint = result.point.clone().project(world.camera.three);
        
        let x = projectPoint.x * widthHalf + widthHalf
        let y = - (projectPoint.y * heightHalf) + heightHalf
        showPivotPoint(x, y)
      }
    } else if(seclectionMode == SELCTION_MODE.FUSTUM) {
      isStartDrawFrustum = true
      frustumStartPoint = {clientX: event.clientX, clientY: event.clientY}
    }
  };

  container.onpointermove = (event) => {
    if(seclectionMode == SELCTION_MODE.FUSTUM && isStartDrawFrustum) {
      frustumEndPoint = {clientX: event.clientX, clientY: event.clientY}
      updateFrustumRectangle()
    }
    if(event.target && event.target['tagName'] !== "CANVAS") return
  }

  container.onpointerup = (event) => {
    isStartDrawFrustum = false
    // onChangeMode(SELCTION_MODE.DEFAULT, null)
    hideFrustumRectangle()
    hidePivotPoint()
    if(event.target && event.target['tagName'] !== "CANVAS") return
  }

  container.onwheel = (event) => {
    isStartDrawFrustum = false
    onChangeMode(SELCTION_MODE.DEFAULT, null)
    hidePivotPoint()
    if(event.target && event.target['tagName'] !== "CANVAS") return
  }

  const disableControl = () => {
    world.camera.controls.enabled = false
  }

  const enableControl = () => {
    world.camera.controls.enabled = true
  }

  const fustumModeButton = document.getElementById("frustumMode") as HTMLButtonElement;

  const allSelectionModeButtons = [fustumModeButton]

  const onChangeMode = (newMode, htmlButton) => {
    if(seclectionMode === newMode || newMode === SELCTION_MODE.DEFAULT) {
      seclectionMode = SELCTION_MODE.DEFAULT
      allSelectionModeButtons.forEach(button => {
        button.classList.remove("active")
      })
      enableControl()
      hideFrustumRectangle()
    } else {
      seclectionMode = newMode
      htmlButton?.classList.add("active")
      disableControl()
    }
  }

  //#region Html event
  fustumModeButton.onclick = () => {
    onChangeMode(SELCTION_MODE.FUSTUM, fustumModeButton)
  }
  //#endregion
}

main();
