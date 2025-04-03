import * as OBC from "@thatopen-platform/components-beta";
import * as THREE from "three";
import { HELPER_RENDER_ORDER, MARKUP_RENDER_ORDER } from "../constants";
import { v4 } from "uuid";

interface LineMarkup {
    startPoint: THREE.Vector3
    endPoint: THREE.Vector3
    id: string
}

export default class LineMarkupEvent {
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

    lineMarkupContainer: THREE.Group = new THREE.Group()
    lineMarkupGroup: THREE.Group = new THREE.Group()
    lineMarkupPickupHelper: THREE.Group = new THREE.Group()
    lineMarkupLineHelper: THREE.Group = new THREE.Group()

    helperLineInfo: {
        start: null | THREE.Vector3,
        end : null | THREE.Vector3
    } = {
        start: null,
        end: null,
    }
    raycater: THREE.Raycaster = new THREE.Raycaster()

    mouse: THREE.Vector2 = new THREE.Vector2()
    
    _lineMarkups: LineMarkup[] = []
    public get lineMarkups() {
        return this._lineMarkups
    }

    public set lineMarkups(value) {
        this._lineMarkups = value

        this.renderLineMarkups()
    }

    cylinderGeometry = this.createCylinderGeometry()
    cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x6528d7, depthTest: false, depthWrite: false, side: THREE.DoubleSide })

    cylinderPickupLineMesh = new THREE.Mesh(this.cylinderGeometry, this.cylinderMaterial)

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
        this.lineMarkupLineHelper.add(this.cylinderPickupLineMesh)
        this.lineMarkupLineHelper.visible = false

        this.lineMarkupContainer.add(this.lineMarkupLineHelper)
        this.lineMarkupContainer.add(this.lineMarkupPickupHelper)
        this.lineMarkupContainer.add(this.lineMarkupGroup)

        this.world.scene!.three.add(this.lineMarkupContainer)
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
        this.lineMarkupPickupHelper.add(ring)

        const circleGeometry = new THREE.CircleGeometry(1, 32)
        circleGeometry.rotateX(-Math.PI / 2)
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        const circle = new THREE.Mesh(circleGeometry, circleMaterial)
        circle.renderOrder = HELPER_RENDER_ORDER
        this.lineMarkupPickupHelper.add(circle)

        this.lineMarkupPickupHelper.visible = false
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
        this.hideLineMarkupHelper()
    }

    handleMouseDown(event: MouseEvent) {
        this.mouseStatus.down = true
        this.mouseStatus.move = false
    }

    hideLineMarkupHelper() {
        this.helperLineInfo.start = null
        this.helperLineInfo.end = null
        this.lineMarkupPickupHelper.visible = false
        this.lineMarkupLineHelper.visible = false
    }
    updateLineMarkupPickupHelper(result) {
        if(result && result.point) {
            this.lineMarkupPickupHelper.visible = this.isActive
            this.lineMarkupPickupHelper.position.copy(result.point)

            // Align the helper to the normal
            const normal = result.normal.clone().normalize(); // Ensure the normal is normalized
            const up = new THREE.Vector3(0, 1, 0); // Default "up" vector
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);

            const scale = result.distance / 100
            this.lineMarkupPickupHelper.scale.set(scale, scale, scale)
            this.lineMarkupPickupHelper.quaternion.copy(quaternion);
        } else {
            this.lineMarkupPickupHelper.visible = false
        }
    }

    updateLineMarkupLineHelper() {
        if(this.helperLineInfo.start && this.helperLineInfo.end) {
            const direction = this.helperLineInfo.end.clone().sub(this.helperLineInfo.start)
            const length = direction.length()
            if(length > 0) {
                const scale = new THREE.Vector3(1, 1, length)
                this.cylinderPickupLineMesh.scale.copy(scale)
                this.cylinderPickupLineMesh.position.set(0, 0, 0)
                this.cylinderPickupLineMesh.visible = true
            } else {
                this.cylinderPickupLineMesh.visible = false
            }

            this.lineMarkupLineHelper.position.copy(this.helperLineInfo.start)
            this.lineMarkupLineHelper.lookAt(this.helperLineInfo.end)
            this.lineMarkupLineHelper.visible = this.isActive
        } else {
            this.lineMarkupLineHelper.visible = false
        }
    }

    async handleMouseMove(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        this.mouseStatus.move = true
        const result = await this.caster.castRay();
        if(this.helperLineInfo.start !== null && result?.point != null) {
            this.helperLineInfo.end = result.point.clone()
        }
        this.updateLineMarkupLineHelper()
        this.updateLineMarkupPickupHelper(result)
    }

    async handleMouseWheel(event: WheelEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        const result = await this.caster.castRay();
        this.updateLineMarkupPickupHelper(result)
    }

    async onControlUpdateEnd() {
        const result = await this.caster.castRay();
        this.updateLineMarkupPickupHelper(result)
    }

    async handleMouseUp(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        if(this.mouseStatus.down && !this.mouseStatus.move) {
            const result = await this.caster.castRay();
            if(result?.point != null) {
                if(this.helperLineInfo.start === null) {
                    this.helperLineInfo.start = result.point.clone()
                } else if(this.helperLineInfo.start !== null) {
                    this.helperLineInfo.end = result.point.clone()
                    if(this.helperLineInfo.start && this.helperLineInfo.end ) {
                        //Add new
                        this.lineMarkups = [
                            ...this.lineMarkups, {
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
        }
        this.mouseStatus.down = false
        this.mouseStatus.move = false
    }

    renderLineMarkups() {
        this.lineMarkupGroup.clear()
        this.lineMarkups.forEach(lineMarkup => {
            const direction = lineMarkup.endPoint.clone().sub(lineMarkup.startPoint)
            const length = direction.length()
            const group = new THREE.Group()
            group.position.copy(lineMarkup.startPoint)
            group.lookAt(lineMarkup.endPoint)

            if(length > 0) {
                const cylinder = new THREE.Mesh(this.cylinderGeometry, this.cylinderMaterial)
                cylinder.scale.set(1, 1, length)
                cylinder.position.set(0, 0, 0)
                cylinder.renderOrder = MARKUP_RENDER_ORDER
                group.add(cylinder)
            }

            this.lineMarkupGroup.add(group)
        })
    }
}