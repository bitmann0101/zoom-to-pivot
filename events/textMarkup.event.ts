import * as OBC from "@thatopen-platform/components-beta";
import * as THREE from "three";
import { HELPER_RENDER_ORDER, MARKUP_RENDER_ORDER } from "../constants";
import { v4 } from "uuid";
import { CSS2DObject } from "three/examples/jsm/Addons.js";

interface TextMarkup {
    startPoint: THREE.Vector3
    endPoint: THREE.Vector3
    text: string
    id: string
}

export default class TextMarkupEvent {
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

    textMarkupContainer: THREE.Group = new THREE.Group()
    textMarkupGroup: THREE.Group = new THREE.Group()
    textMarkupPickupHelper: THREE.Group = new THREE.Group()
    textMarkupLineHelper: THREE.Group = new THREE.Group()

    helperLineInfo: {
        start: null | THREE.Vector3,
        end : null | THREE.Vector3
    } = {
        start: null,
        end: null,
    }
    helperPlane: THREE.Plane | null = null
    raycater: THREE.Raycaster = new THREE.Raycaster()

    mouse: THREE.Vector2 = new THREE.Vector2()
    renderTimeout: any = null
    
    _textMarkups: TextMarkup[] = []
    public get textMarkups() {
        return this._textMarkups
    }
    public set textMarkups(value) {
        this._textMarkups = value

        this.renderTextMarkups()
    }

    _selectedTextMarkupId: string | null = null
    public get selectedTextMarkupId() {
        return this._selectedTextMarkupId
    }
    public set selectedTextMarkupId(value) {
        this._selectedTextMarkupId = value

        this.renderTextMarkups()
    }

    cylinderGeometry = this.createCylinderGeometry()
    cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0xCC00CC, depthTest: false, depthWrite: false, side: THREE.DoubleSide })

    cylinderPickupLineMesh = new THREE.Mesh(this.cylinderGeometry, this.cylinderMaterial)
    textMarkupPickupTextHelper: CSS2DObject;

    onCancelEvent: () => void = () => {}

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
        this.initTextMarkupPickupTextHelper()

        this.cylinderPickupLineMesh.renderOrder = HELPER_RENDER_ORDER
        this.textMarkupLineHelper.add(this.cylinderPickupLineMesh)
        this.textMarkupLineHelper.add(this.textMarkupPickupTextHelper)
        this.textMarkupLineHelper.visible = false

        this.textMarkupContainer.add(this.textMarkupLineHelper)
        this.textMarkupContainer.add(this.textMarkupPickupHelper)
        this.textMarkupContainer.add(this.textMarkupGroup)

        this.world.scene!.three.add(this.textMarkupContainer)
    }

    initTextMarkupPickupTextHelper() {
        const div = document.createElement("div");
        div.classList.add("text-markup_text")
        div.innerText = "Insert text";

        const container = document.createElement("div");
        container.appendChild(div);
        this.textMarkupPickupTextHelper = new CSS2DObject(container);
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
        this.textMarkupPickupHelper.add(ring)

        const circleGeometry = new THREE.CircleGeometry(1, 32)
        circleGeometry.rotateX(-Math.PI / 2)
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        const circle = new THREE.Mesh(circleGeometry, circleMaterial)
        circle.renderOrder = HELPER_RENDER_ORDER
        this.textMarkupPickupHelper.add(circle)

        this.textMarkupPickupHelper.visible = false
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
        this.hideTextMarkupHelper()
    }

    handleMouseDown(event: MouseEvent) {
        this.mouseStatus.down = true
        this.mouseStatus.move = false
    }

    hideTextMarkupHelper() {
        this.helperLineInfo.start = null
        this.helperLineInfo.end = null
        this.textMarkupPickupHelper.visible = false
        this.textMarkupLineHelper.visible = false
    }
    updateTextMarkupPickupHelper(result) {
        if(result && result.point && !this.helperLineInfo.start && !this.helperLineInfo.end) {
            this.textMarkupPickupHelper.visible = this.isActive
            this.textMarkupPickupHelper.position.copy(result.point)

            // Align the helper to the normal
            const normal = result.normal.clone().normalize(); // Ensure the normal is normalized
            const up = new THREE.Vector3(0, 1, 0); // Default "up" vector
            const quaternion = new THREE.Quaternion().setFromUnitVectors(up, normal);

            const scale = result.distance / 100
            this.textMarkupPickupHelper.scale.set(scale, scale, scale)
            this.textMarkupPickupHelper.quaternion.copy(quaternion);
        } else {
            this.textMarkupPickupHelper.visible = false
        }
    }

    updateTextMarkupLineHelper() {
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

            this.textMarkupPickupTextHelper.position.set(0, 0, length)

            this.textMarkupLineHelper.position.copy(this.helperLineInfo.start)
            this.textMarkupLineHelper.lookAt(this.helperLineInfo.end)
            this.textMarkupLineHelper.visible = this.isActive
        } else {
            this.textMarkupLineHelper.visible = false
        }
    }

    async handleMouseMove(event: MouseEvent) {
        // if(event.target && event.target['tagName'] !== "CANVAS") return
        this.mouseStatus.move = true
        const result = await this.caster.castRay();
        if(this.helperLineInfo.start !== null && this.helperPlane){
            this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
            this.raycater.setFromCamera(this.mouse, this.world.camera.three)
            const intersectPoint = new THREE.Vector3()
            this.raycater.ray.intersectPlane(this.helperPlane, intersectPoint)
            if(intersectPoint) {
                this.helperLineInfo.end = intersectPoint.clone()
            }
        }
        this.updateTextMarkupLineHelper()
        this.updateTextMarkupPickupHelper(result)
    }

    async handleMouseWheel(event: WheelEvent) {
        if(event.target && event.target['tagName'] !== "CANVAS") return
        const result = await this.caster.castRay();
        this.updateTextMarkupPickupHelper(result)
    }

    async onControlUpdateEnd() {
        const result = await this.caster.castRay();
        this.updateTextMarkupPickupHelper(result)
    }

    async handleMouseUp(event: MouseEvent) {
        // if(event.target && event.target['tagName'] !== "CANVAS") return
        if(this.mouseStatus.down && !this.mouseStatus.move) {
            const result = await this.caster.castRay();
            // this.addTextMarkup(result)

            if(result?.point != null && this.helperLineInfo.start === null) {
                this.helperLineInfo.start = result.point.clone()

                const cameraDir = this.world.camera.three.getWorldDirection(new THREE.Vector3())
                this.helperPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(cameraDir, result.point.clone())
            } else if(this.helperLineInfo.start !== null && this.helperPlane) {
                this.mouse.x = (event.clientX / this.container.clientWidth) * 2 - 1;
                this.mouse.y = -(event.clientY / this.container.clientHeight) * 2 + 1;
                this.raycater.setFromCamera(this.mouse, this.world.camera.three)
                const intersectPoint = new THREE.Vector3()
                this.raycater.ray.intersectPlane(this.helperPlane, intersectPoint)
                if(intersectPoint) {
                    this.helperLineInfo.end = intersectPoint.clone()
                }
                if(this.helperLineInfo.start && this.helperLineInfo.end ) {
                    const newId = v4()
                    //Add new
                    this.textMarkups = [
                        ...this.textMarkups, 
                        {
                            startPoint: this.helperLineInfo.start.clone(),
                            endPoint: this.helperLineInfo.end.clone(),
                            text: "Insert text",
                            id: newId
                        }
                    ]
                    this.selectedTextMarkupId = newId

                    this.helperLineInfo.start = null
                    this.helperLineInfo.end = null

                    this.updateTextMarkupLineHelper()

                    this.onCancelEvent()
                }
                
            }
            
        }
        this.mouseStatus.down = false
        this.mouseStatus.move = false
    }

    renderTextMarkups() {
        if(this.renderTimeout) {
            clearTimeout(this.renderTimeout)
        }
        this.renderTimeout = setTimeout(() => {
            this.textMarkupGroup.traverse((child: any) => {
                if(child.isCSS2DObject) {
                    child.parent.remove(child)
                }
            })
            this.textMarkupGroup.clear()
            
            this.textMarkups.forEach(textMarkup => {
                const direction = textMarkup.endPoint.clone().sub(textMarkup.startPoint)
                const length = direction.length()
                const group = new THREE.Group()
                group.position.copy(textMarkup.startPoint)
                group.lookAt(textMarkup.endPoint)
    
                if(length - 1 > 0) {
                    const cylinder = new THREE.Mesh(this.cylinderGeometry, this.cylinderMaterial)
                    cylinder.scale.set(1, 1, (length - 1))
                    cylinder.position.set(0, 0, 1)
                    cylinder.renderOrder = MARKUP_RENDER_ORDER
                    group.add(cylinder)
                }
                const text = this.createTextMarkupPickupText(textMarkup)
                text.position.set(0, 0, length)
                group.add(text)
    
                this.textMarkupGroup.add(group)
            })
    
            this.world.renderer?.update()
            const inputs = this.container.querySelectorAll(".text-markup_input")
            if(inputs.length > 0) {
                ;(inputs[0] as HTMLInputElement).focus()
                ;(inputs[0] as HTMLInputElement).select()
            }
        }, 50)
    }

    setSelectedMarkupText(id: string | null) {
        this.selectedTextMarkupId = id
    }

    createTextMarkupPickupText(markup: TextMarkup) {
        if(this.selectedTextMarkupId == markup.id) {
            const input = document.createElement("input");
            input.classList.add("text-markup_input")
            input.value = markup.text;
            const onExitUpdate = () => {
                this.textMarkups = this.textMarkups.map(textMarkup => {
                    if(textMarkup.id === markup.id) {
                        return {
                            ...textMarkup,
                            text: input.value
                        }
                    }
                    return textMarkup
                })
                this.setSelectedMarkupText(null)
            }
            input.addEventListener("blur", () => {
                onExitUpdate()
            })
            input.addEventListener("keydown", (event) => {
                if(event.key === "Enter") {
                    onExitUpdate()
                }
            })
            input.autofocus = true

            const container = document.createElement("div");
            container.appendChild(input);
            return new CSS2DObject(container);
        } else {
            const div = document.createElement("div");
            div.classList.add("text-markup_text")
            div.innerText = markup.text;
            div.addEventListener("dblclick", () => {
                this.setSelectedMarkupText(markup.id)
            })
            const container = document.createElement("div");
            container.appendChild(div);
            return new CSS2DObject(container);
        }
    }
}