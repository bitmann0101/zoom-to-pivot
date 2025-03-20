import * as OBC from "@thatopen-platform/components-beta";
import * as THREE from "three";
import { HELPER_RENDER_ORDER, MARKUP_RENDER_ORDER } from "../constants";
import { v4 } from "uuid";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

interface CloudMarkup {
    position: THREE.Vector3
    normal: THREE.Vector3
    id: string
    scale: number
    selected?: boolean
}

export default class CloundMarkupEvent {
    world: OBC.SimpleWorld
    container: HTMLDivElement
    caster: OBC.SimpleRaycaster

    _handleMouseDown: (event: MouseEvent) => void
    _handleMouseMove: (event: MouseEvent) => void
    _handleMouseUp: (event: MouseEvent) => void
    _handleMouseWheel: (event: WheelEvent) => void
    _handleControlUpdateEnd: () => void

    cloudMarkupContainer: THREE.Group = new THREE.Group()
    cloudMarkupGroup: THREE.Group = new THREE.Group()
    cloudMarkupHelper: THREE.Group = new THREE.Group()

    defaultCloundMarkupMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    highlightCloundMarkupMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, side: THREE.DoubleSide })

    mouseStatus = {
        down: false,
        move: false,
    }

    _cloudMarkups: CloudMarkup[] = []

    public get cloudMarkups() {
        return this._cloudMarkups
    }

    public set cloudMarkups(value) {
        this._cloudMarkups = value

        this.renderCloudMarkups()
    }

    constructor(world: OBC.SimpleWorld, container: HTMLDivElement, caster: OBC.SimpleRaycaster) {
        this.container = container
        this.world = world
        this.caster = caster

        this._handleMouseDown = this.handleMouseDown.bind(this)
        this._handleMouseMove = this.handleMouseMove.bind(this)
        this._handleMouseUp = this.handleMouseUp.bind(this)
        this._handleMouseWheel = this.handleMouseWheel.bind(this)
        this._handleControlUpdateEnd = this.onControlUpdateEnd.bind(this)

        // new GLTFLoader().load("/cloud.glb", (gltf) => {
        //     const model = gltf.scene
        //     console.log('model', model)
        // })

        this.init()
    }

    init() {
        this.initCloudMarkupHelper()
        this.cloudMarkupContainer.add(this.cloudMarkupHelper)
        this.cloudMarkupContainer.add(this.cloudMarkupGroup)

        this.world.scene!.three.add(this.cloudMarkupContainer)
    }

    initCloudMarkupHelper() {
        const geometry = new THREE.RingGeometry(4, 5, 32)
        geometry.rotateX(-Math.PI / 2)
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false })
        const ring = new THREE.Mesh(geometry, material)
        ring.renderOrder = HELPER_RENDER_ORDER
        this.cloudMarkupHelper.add(ring)

        const circleGeometry = new THREE.CircleGeometry(1, 32)
        circleGeometry.rotateX(-Math.PI / 2)
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, depthTest: false, depthWrite: false })
        const circle = new THREE.Mesh(circleGeometry, circleMaterial)
        circle.renderOrder = HELPER_RENDER_ORDER
        this.cloudMarkupHelper.add(circle)

        this.cloudMarkupHelper.visible = false
    }

    addEvents() {
        this.container.addEventListener("mousedown", this._handleMouseDown)
        this.container.addEventListener("mousemove", this._handleMouseMove)
        this.container.addEventListener("mouseup", this._handleMouseUp)
        this.container.addEventListener("wheel", this._handleMouseWheel)
        this.world.camera.controls!.addEventListener("controlend", this._handleControlUpdateEnd)
    }

    removeEvents() {
        this.container.removeEventListener("mousedown", this._handleMouseDown)
        this.container.removeEventListener("mousemove", this._handleMouseMove)
        this.container.removeEventListener("mouseup", this._handleMouseUp)
        this.container.removeEventListener("wheel", this._handleMouseWheel)
        this.world.camera.controls!.removeEventListener("controlend", this._handleControlUpdateEnd)
        this.hideCloudMarkupHelper()
    }

    disableControl() {
        this.world!.camera!.controls!.enabled = false
    }
    
    enableControl() {
        this.world!.camera!.controls!.enabled = true
    }

    handleMouseDown(event: MouseEvent) {
        this.mouseStatus.down = true
        this.mouseStatus.move = false
    }
    hideCloudMarkupHelper() {
        this.cloudMarkupHelper.visible = false
    }
    updateCloudMarkupHelper(result) {
        if(result && result.point) {
            this.cloudMarkupHelper.visible = true
            this.cloudMarkupHelper.position.copy(result.point)

            // Align the helper to the normal
            const normal = result.normal.clone().normalize(); // Ensure the normal is normalized
            const up = new THREE.Vector3(0, 1, 0); // Default "up" vector
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);

            const scale = result.distance / 100
            this.cloudMarkupHelper.scale.set(scale, scale, scale)
            this.cloudMarkupHelper.quaternion.copy(quaternion);
        } else {
            this.cloudMarkupHelper.visible = false
        }
    }
    async handleMouseMove(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        this.mouseStatus.move = true
        const result = await this.caster.castRay();
        this.updateCloudMarkupHelper(result)
    }
    async handleMouseWheel(event: WheelEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        const result = await this.caster.castRay();
        this.updateCloudMarkupHelper(result)
    }
    async onControlUpdateEnd() {
        const result = await this.caster.castRay();
        this.updateCloudMarkupHelper(result)
    }
    async handleMouseUp(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        if(this.mouseStatus.down && !this.mouseStatus.move) {
            const result = await this.caster.castRay();
            this.addCloudMarkup(result)
        }
        this.mouseStatus.down = false
        this.mouseStatus.move = false
    }

    addCloudMarkup(result) {
        if(result && result.point) {
            this.cloudMarkups = [
                ...this.cloudMarkups,
                {
                    position: result.point,
                    normal: result.normal,
                    scale: result.distance / 50,
                    id: v4()
                }
            ]
        }
    }
    renderCloudMarkups() {
        this.cloudMarkupGroup.clear()

        console.log(this.cloudMarkups)

        // Iterate over the cloud markups and create a visual representation for each
        this.cloudMarkups.forEach((markup) => {
            // Create a sphere to represent the cloud point
            const geometry = new THREE.RingGeometry(4, 5, 32)
            geometry.rotateX(-Math.PI / 2)
            const material = markup.selected
                ? this.highlightCloundMarkupMaterial
                : this.defaultCloundMarkupMaterial;
            const sphere = new THREE.Mesh(geometry, material);
            sphere.renderOrder = MARKUP_RENDER_ORDER;

            // Position the sphere at the markup's position
            sphere.position.copy(markup.position);
            sphere.scale.set(markup.scale, markup.scale, markup.scale);

            // Align the sphere to the normal
            const normal = markup.normal.clone().normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);
            sphere.quaternion.copy(quaternion);

            // Add the sphere to the cloud markup group
            this.cloudMarkupGroup.add(sphere);
        });
    }
}