import * as OBC from "@thatopen-platform/components-beta";
import * as THREE from "three";
import { HELPER_RENDER_ORDER, MARKUP_RENDER_ORDER } from "../constants";
import { v4 } from "uuid";

interface DrawMarkup {
    points: THREE.Vector3[]
    id: string
}

export default class DrawMarkupEvent {
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

    drawMarkupContainer: THREE.Group = new THREE.Group()
    drawMarkupGroup: THREE.Group = new THREE.Group()
    drawMarkupDrawHelper: THREE.Group = new THREE.Group()

    helperDrawInfo: THREE.Vector3[] = []
    raycater: THREE.Raycaster = new THREE.Raycaster()
    mouse: THREE.Vector2 = new THREE.Vector2()
    helperPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)

    lineMaterial = new THREE.LineBasicMaterial({color: 0xff0000, depthTest: false, depthWrite: false, side: THREE.DoubleSide})
    
    _drawMarkups: DrawMarkup[] = []
    public get drawMarkups() {
        return this._drawMarkups
    }

    public set drawMarkups(value) {
        this._drawMarkups = value

        this.renderDrawMarkups()
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

        this.init()
    }

    init() {
        this.drawMarkupContainer.add(this.drawMarkupDrawHelper)
        this.drawMarkupContainer.add(this.drawMarkupGroup)

        this.world.scene!.three.add(this.drawMarkupContainer)
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

    disableControl() {
        this.world!.camera!.controls!.enabled = false
    }
    
    enableControl() {
        this.world!.camera!.controls!.enabled = true
    }

    addEvents() {
        this.disableControl()
        this.isActive = true
        this.container.addEventListener("mousedown", this._handleMouseDown)
        this.container.addEventListener("mousemove", this._handleMouseMove)
        this.container.addEventListener("mouseup", this._handleMouseUp)
        this.container.addEventListener("wheel", this._handleMouseWheel)
        this.world.camera.controls!.addEventListener("controlend", this._handleControlUpdateEnd)
    }

    removeEvents() {
        this.enableControl()
        this.isActive = false
        this.container.removeEventListener("mousedown", this._handleMouseDown)
        this.container.removeEventListener("mousemove", this._handleMouseMove)
        this.container.removeEventListener("mouseup", this._handleMouseUp)
        this.container.removeEventListener("wheel", this._handleMouseWheel)
        this.world.camera.controls!.removeEventListener("controlend", this._handleControlUpdateEnd)
        this.hideDrawMarkupHelper()
    }

    async handleMouseDown(event: MouseEvent) {
        this.mouseStatus.down = event.button === 0
        this.mouseStatus.move = false

        const result = await this.caster.castRay()
        if(result?.point != null && result.normal) {
            this.helperDrawInfo.push(result.point.clone())
            this.helperPlane.setFromNormalAndCoplanarPoint(result.normal, result.point)
        }
    }

    hideDrawMarkupHelper() {
        this.helperDrawInfo = []
        this.drawMarkupDrawHelper.visible = false
    }
    updateDrawMarkupHelper() {
        if(this.helperDrawInfo.length > 1) {
            this.drawMarkupDrawHelper.clear()
            const points = this.helperDrawInfo.map(point => point.clone())
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.lineMaterial)
            line.renderOrder = HELPER_RENDER_ORDER
            this.drawMarkupDrawHelper.add(line)
            this.drawMarkupDrawHelper.visible = this.isActive
        } else {
            this.drawMarkupDrawHelper.visible = false
        }
    }

    async handleMouseMove(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        if(this.helperDrawInfo.length === 0) return
        this.mouseStatus.move = true
        this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
        this.raycater.setFromCamera(this.mouse, this.world.camera.three)
        const intersectPoint = new THREE.Vector3()
        this.raycater.ray.intersectPlane(this.helperPlane, intersectPoint)
        if(intersectPoint) {
            this.helperDrawInfo.push(intersectPoint.clone())
        }
        this.updateDrawMarkupHelper()
    }

    async handleMouseWheel(event: WheelEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        this.updateDrawMarkupHelper()
    }

    async onControlUpdateEnd() {
        this.updateDrawMarkupHelper()
    }

    async handleMouseUp(event: MouseEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        if(this.helperDrawInfo.length > 1) {
            this.drawMarkups = [
                ...this.drawMarkups,
                {
                    id: v4(),
                    points: this.helperDrawInfo
                }
            ]
        }
        this.helperDrawInfo = []
        this.updateDrawMarkupHelper()
        this.mouseStatus.down = false
        this.mouseStatus.move = false
    }

    renderDrawMarkups() {
        this.drawMarkupGroup.clear()
        this.drawMarkups.forEach(drawMarkup => {
            const points = drawMarkup.points.map(point => point.clone())
            const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), this.lineMaterial)
            line.renderOrder = HELPER_RENDER_ORDER
            this.drawMarkupGroup.add(line)
        })
    }
}