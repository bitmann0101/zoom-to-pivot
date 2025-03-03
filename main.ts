import * as THREE from "three";
import * as OBC from "@thatopen-platform/components-beta";
import Stats from "stats.js";

async function main() {
  // Set up scene

  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const container = document.getElementById("container") as HTMLDivElement;

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

  // Create plane on click
  container.ondblclick = async () => {
    const result = await caster.castRay();
    console.log(result)
  };
  
}

main();
