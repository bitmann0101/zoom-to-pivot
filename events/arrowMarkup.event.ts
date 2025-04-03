import * as OBC from "@thatopen-platform/components-beta";
import * as THREE from "three";
import { HELPER_RENDER_ORDER, MARKUP_RENDER_ORDER } from "../constants";
import { v4 } from "uuid";

interface ArrowMarkup {
    startPoint: THREE.Vector3
    endPoint: THREE.Vector3
    id: string
}

export default class ArrowMarkupEvent {
    world: OBC.SimpleWorld
    container: HTMLDivElement
    caster: OBC.SimpleRaycaster

    _handleMouseDown: (event: MouseEvent) => void
    _handleMouseMove: (event: MouseEvent) => void
    _handleMouseUp: (event: MouseEvent) => void
    _handleMouseWheel: (event: WheelEvent) => void
    _handleControlUpdateEnd: () => void

    isActive = false
    mouseStatus = {
        down: false,
        move: false,
    }

    arrowMarkupContainer: THREE.Group = new THREE.Group()
    arrowMarkupGroup: THREE.Group = new THREE.Group()
    arrowMarkupPickupHelper: THREE.Group = new THREE.Group()
    arrowMarkupLineHelper: THREE.Group = new THREE.Group()

    helperLineInfo: {
        start: null | THREE.Vector3,
        end : null | THREE.Vector3
    } = {
        start: null,
        end: null,
    }
    helperPlane: THREE.Plane | null = null
    raycaster: THREE.Raycaster = new THREE.Raycaster()

    mouse: THREE.Vector2 = new THREE.Vector2()
    
    _arrowMarkups: ArrowMarkup[] = []
    public get arrowMarkups() {
        return this._arrowMarkups
    }

    public set arrowMarkups(value) {
        this._arrowMarkups = value

        this.renderArrowMarkups()
    }

    coneGeometry = this.createConeGeometry(); 
    cylinderGeometry = this.createCylinderGeometry()
    cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x6528d7, depthTest: false, depthWrite: false, side: THREE.DoubleSide })

    cylinderPickupLineMesh = this.createPickupLineMesh()
    conePickupMesh = new THREE.Mesh(this.coneGeometry, this.cylinderMaterial)

    constructor(world: OBC.SimpleWorld, container: HTMLDivElement, caster: OBC.SimpleRaycaster) {
        this.container = container
        this.world = world
        this.caster = caster

        this._handleMouseDown = this.handleMouseDown.bind(this)
        this._handleMouseMove = this.handleMouseMove.bind(this)
        this._handleMouseUp = this.handleMouseUp.bind(this)
        this._handleMouseWheel = this.handleMouseWheel.bind(this)
        this._handleControlUpdateEnd = this.onControlUpdateEnd.bind(this)

        this.init()
    }

    init() {
        this.initMarkupPickupHelper()

        this.cylinderPickupLineMesh.renderOrder = HELPER_RENDER_ORDER
        this.conePickupMesh.renderOrder = HELPER_RENDER_ORDER
        this.arrowMarkupLineHelper.add(this.cylinderPickupLineMesh)
        this.arrowMarkupLineHelper.add(this.conePickupMesh)
        this.arrowMarkupLineHelper.visible = false

        this.arrowMarkupContainer.add(this.arrowMarkupLineHelper)
        this.arrowMarkupContainer.add(this.arrowMarkupPickupHelper)
        this.arrowMarkupContainer.add(this.arrowMarkupGroup)

        this.world.scene!.three.add(this.arrowMarkupContainer)
    }

    createPickupLineMesh() {
        // Create a geometry from the curve points
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)]);
    
        // Create a material for the curve
        const material = new THREE.LineBasicMaterial({ color: 0x6528d7, linewidth: 5, depthTest: false, depthWrite: false });
    
        // Create a line object from the geometry and material
        const line = new THREE.Line(geometry, material);
    
        // Add the line to the cloud markup group
        return line
    }

    createCylinderGeometry() {
        const geo = new THREE.CylinderGeometry(0.1, 0.1, 1, 32)
        geo.translate(0, 0.5, 0)
        geo.rotateX(Math.PI / 2)
        return geo
    }

    createConeGeometry() {
        const geo = new THREE.ConeGeometry(0.3, 1, 32)
        geo.translate(0, -0.5, 0)
        geo.rotateX(-Math.PI / 2)
        return geo
    }

    initMarkupPickupHelper() {
        const geometry = new THREE.RingGeometry(4, 5, 32)
        geometry.rotateX(-Math.PI / 2)
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        const ring = new THREE.Mesh(geometry, material)
        ring.renderOrder = HELPER_RENDER_ORDER
        this.arrowMarkupPickupHelper.add(ring)

        const circleGeometry = new THREE.CircleGeometry(1, 32)
        circleGeometry.rotateX(-Math.PI / 2)
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        const circle = new THREE.Mesh(circleGeometry, circleMaterial)
        circle.renderOrder = HELPER_RENDER_ORDER
        this.arrowMarkupPickupHelper.add(circle)

        this.arrowMarkupPickupHelper.visible = false
    }

    addEvents() {
        this.isActive = true
        this.container.addEventListener("mousedown", this._handleMouseDown)
        this.container.addEventListener("mousemove", this._handleMouseMove)
        this.container.addEventListener("mouseup", this._handleMouseUp)
        this.container.addEventListener("wheel", this._handleMouseWheel)
        this.world.camera.controls!.addEventListener("controlend", this._handleControlUpdateEnd)
    }

    removeEvents() {
        this.isActive = false
        this.container.removeEventListener("mousedown", this._handleMouseDown)
        this.container.removeEventListener("mousemove", this._handleMouseMove)
        this.container.removeEventListener("mouseup", this._handleMouseUp)
        this.container.removeEventListener("wheel", this._handleMouseWheel)
        this.world.camera.controls!.removeEventListener("controlend", this._handleControlUpdateEnd)
        this.hideArrowMarkupHelper()
    }

    handleMouseDown(event: MouseEvent) {
        this.mouseStatus.down = true
        this.mouseStatus.move = false
    }

    hideArrowMarkupHelper() {
        this.helperLineInfo.start = null
        this.helperLineInfo.end = null
        this.arrowMarkupPickupHelper.visible = false
        this.arrowMarkupLineHelper.visible = false
    }
    updateArrowMarkupPickupHelper(result) {
        if(result && result.point && !this.helperLineInfo.start && !this.helperLineInfo.end) {
            this.arrowMarkupPickupHelper.visible = this.isActive
            this.arrowMarkupPickupHelper.position.copy(result.point)

            // Align the helper to the normal
            const normal = result.normal.clone().normalize(); // Ensure the normal is normalized
            const up = new THREE.Vector3(0, 1, 0); // Default "up" vector
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);

            const scale = result.distance / 100
            this.arrowMarkupPickupHelper.scale.set(scale, scale, scale)
            this.arrowMarkupPickupHelper.quaternion.copy(quaternion);
        } else {
            this.arrowMarkupPickupHelper.visible = false
        }
    }

    updateArrowMarkupLineHelper() {
        if(this.helperLineInfo.start && this.helperLineInfo.end) {
            const direction = this.helperLineInfo.end.clone().sub(this.helperLineInfo.start)
            const length = direction.length()
            if(length - 1 > 0) {
                const scale = new THREE.Vector3(1, 1, (length - 1))
                this.cylinderPickupLineMesh.scale.copy(scale)
                this.cylinderPickupLineMesh.position.set(0, 0, 1)
                this.cylinderPickupLineMesh.visible = true
            } else {
                this.cylinderPickupLineMesh.visible = false
            }

            this.arrowMarkupLineHelper.position.copy(this.helperLineInfo.start)
            this.arrowMarkupLineHelper.lookAt(this.helperLineInfo.end)
            this.arrowMarkupLineHelper.visible = this.isActive
        } else {
            this.arrowMarkupLineHelper.visible = false
        }
    }

    async handleMouseMove(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        this.mouseStatus.move = true
        const result = await this.caster.castRay();
        if(this.helperLineInfo.start !== null && this.helperPlane){
            this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.world.camera.three)
            const intersectPoint = new THREE.Vector3()
            this.raycaster.ray.intersectPlane(this.helperPlane, intersectPoint)
            if(intersectPoint) {
                this.helperLineInfo.end = intersectPoint.clone()
            }
        }
        this.updateArrowMarkupLineHelper()
        this.updateArrowMarkupPickupHelper(result)
    }

    async handleMouseWheel(event: WheelEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        const result = await this.caster.castRay();
        this.updateArrowMarkupPickupHelper(result)
    }

    async onControlUpdateEnd() {
        const result = await this.caster.castRay();
        this.updateArrowMarkupPickupHelper(result)
    }

    async handleMouseUp(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        if(this.mouseStatus.down && !this.mouseStatus.move) {
            const result = await this.caster.castRay();
            // this.addArrowMarkup(result)

            if(result?.point != null && this.helperLineInfo.start === null) {
                this.helperLineInfo.start = result.point.clone()

                const cameraDir = this.world.camera.three.getWorldDirection(new THREE.Vector3())
                this.helperPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, result.point.clone())
            } else if(this.helperLineInfo.start !== null && this.helperPlane) {
                this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
                this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
                this.raycaster.setFromCamera(this.mouse, this.world.camera.three)
                const intersectPoint = new THREE.Vector3()
                this.raycaster.ray.intersectPlane(this.helperPlane, intersectPoint)
                if(intersectPoint) {
                    this.helperLineInfo.end = intersectPoint.clone()
                }
                if(this.helperLineInfo.start && this.helperLineInfo.end ) {
                    //Add new
                    this.arrowMarkups = [
                        ...this.arrowMarkups, {
                            startPoint: this.helperLineInfo.start.clone(),
                            endPoint: this.helperLineInfo.end.clone(),
                            id: v4()
                        }
                    ]

                    this.helperLineInfo.start = null
                    this.helperLineInfo.end = null
                }
                
            }
            
        }
        this.mouseStatus.down = false
        this.mouseStatus.move = false
    }

    renderArrowMarkups() {
        this.arrowMarkupGroup.clear()
        this.arrowMarkups.forEach(arrowMarkup => {
            const direction = arrowMarkup.endPoint.clone().sub(arrowMarkup.startPoint)
            const length = direction.length()
            const group = new THREE.Group()
            group.position.copy(arrowMarkup.startPoint)
            group.lookAt(arrowMarkup.endPoint)

            if(length - 1 > 0) {
                const cylinder = this.createPickupLineMesh()
                cylinder.scale.set(1, 1, (length - 1))
                cylinder.position.set(0, 0, 1)
                cylinder.renderOrder = MARKUP_RENDER_ORDER
                group.add(cylinder)
            }

            const cone = new THREE.Mesh(this.coneGeometry, this.cylinderMaterial)
            cone.position.set(0, 0, 0)
            cone.renderOrder = MARKUP_RENDER_ORDER
            group.add(cone)

            this.arrowMarkupGroup.add(group)
        })
    }
}