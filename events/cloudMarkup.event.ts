import * as OBC from "@thatopen-platform/components-beta";
import * as THREE from "three";
import { HELPER_RENDER_ORDER, MARKUP_RENDER_ORDER } from "../constants";
import { v4 } from "uuid";
import { exampleCloudPoints } from "../data";
import _ from "lodash";
import { SELCTION_MODE } from "../constant";
import { CSS2DObject } from "three/examples/jsm/Addons.js";

interface CloudMarkup {
    position: THREE.Vector3
    normal: THREE.Vector3
    id: string
    scale: THREE.Vector3
    selected?: boolean
    width: number
    height: number
}

const DEFAULT_WIDTH = 3.5626986835160417
const DEFAULT_HEIGHT = 2.8659940817233327
export default class CloudMarkupEvent {
    world: OBC.SimpleWorld
    container: HTMLDivElement
    caster: OBC.SimpleRaycaster

    _handleMouseDown: (event: MouseEvent) => void
    _handleDragControl: (event: MouseEvent) => void
    _handleMouseMove: (event: MouseEvent) => void
    _handleMouseUp: (event: MouseEvent) => void
    _handleMouseWheel: (event: WheelEvent) => void
    _handleControlUpdateEnd: () => void

    cloudMarkupContainer: THREE.Group = new THREE.Group()
    cloudMarkupGroup: THREE.Group = new THREE.Group()
    cloudControlGroup: THREE.Group = new THREE.Group()
    cloudMarkupHelper: THREE.Group = new THREE.Group()

    defaultCloundMarkupMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    highlightCloundMarkupMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false, side: THREE.DoubleSide })

    mouseStatus = {
        down: false,
        move: false,
    }

    _cloudMarkups: CloudMarkup[] = []
    isActive = false

    // Define points for the cloud outline
    cloudPoints = exampleCloudPoints.map((point) => new THREE.Vector3(point[0] - 2.4849082190026044, point[1] -2.5969894912216667, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    defaultCloudObject: THREE.Line = this.createCloudOutline(this.cloudPoints)
    defaultCloudShape: THREE.Mesh = this.createCloudShape(this.cloudPoints)
    defaultCornerPoints: THREE.Vector3[] = this.getCornerInfo(this.cloudPoints)

    selectedControlInfo: { id?: string; type?: string; center?: THREE.Vector3 } = {}

    raycaster: THREE.Raycaster = new THREE.Raycaster()
    helperPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    mouse: THREE.Vector2 = new THREE.Vector2()

    renderTimeout: any = null

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
        this._handleDragControl = this.handleDragControl.bind(this)

        this.init()
        this.initEvents()
    }

    init() {
        this.initCloudMarkupHelper()
        this.cloudMarkupContainer.add(this.cloudMarkupHelper)
        this.cloudMarkupContainer.add(this.cloudMarkupGroup)
        this.cloudMarkupContainer.add(this.cloudControlGroup)

        this.world.scene!.three.add(this.cloudMarkupContainer)
    }

    selectMarkupById(id) {
        this.cloudMarkups = this.cloudMarkups.map((markup) => {
            if(markup.id === id) {
                markup.selected = true
            } else {
                markup.selected = false
            }
            return markup
        })
    }

    createCloudOutline(points: THREE.Vector3[]) {
        // Generate points along the curve
        const curvePoints = points; // Adjust the number of points for smoothness
    
        // Create a geometry from the curve points
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
    
        // Create a material for the curve
        const material = new THREE.LineBasicMaterial({ color: 0x6528d7, linewidth: 5, depthTest: false, depthWrite: false });
    
        // Create a line object from the geometry and material
        const line = new THREE.Line(geometry, material);
    
        // Add the line to the cloud markup group
       return line
    }

    createCloudShape(points: THREE.Vector3[]) {
        // Generate points along the curve
        const curvePoints = points; // Adjust the number of points for smoothness

        const shape = new THREE.Shape(curvePoints.map((point) => new THREE.Vector2(point.x, point.y)));
        const shapeGeometry = new THREE.ShapeGeometry(shape, 1);
        const material = new THREE.MeshBasicMaterial({ color: 0x6528d7, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide });

        // Add the line to the cloud markup group
        return new THREE.Mesh(shapeGeometry, material);
    }

    getCornerInfo(points: THREE.Vector3[]) {
        const maxX = Math.max(...points.map(point => point.x));
        const minX = Math.min(...points.map(point => point.x));
        const maxY = Math.max(...points.map(point => point.y));
        const minY = Math.min(...points.map(point => point.y));

        return [
            new THREE.Vector3(minX, minY, 0),
            new THREE.Vector3(maxX, minY, 0),
            new THREE.Vector3(maxX, maxY, 0),
            new THREE.Vector3(minX, maxY, 0),

            new THREE.Vector3(minX, (maxY + minY) / 2, 0),
            new THREE.Vector3(maxX, (maxY + minY) / 2, 0),
            new THREE.Vector3((maxX + minX) / 2, minY, 0),
            new THREE.Vector3((maxX + minX) / 2, maxY, 0),

            new THREE.Vector3((maxX + minX) / 2, (maxY + minY) / 2, 0),
        ];
    }

    initCloudMarkupHelper() {
        const geometry = new THREE.RingGeometry(4, 5, 32)
        geometry.rotateX(-Math.PI / 2)
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        const ring = new THREE.Mesh(geometry, material)
        ring.renderOrder = HELPER_RENDER_ORDER
        this.cloudMarkupHelper.add(ring)

        const circleGeometry = new THREE.CircleGeometry(1, 32)
        circleGeometry.rotateX(-Math.PI / 2)
        const circleMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
        const circle = new THREE.Mesh(circleGeometry, circleMaterial)
        circle.renderOrder = HELPER_RENDER_ORDER
        this.cloudMarkupHelper.add(circle)

        this.cloudMarkupHelper.visible = false
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
            this.cloudMarkupHelper.visible = this.isActive
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
                    scale: new THREE.Vector3(1, 1, 1),
                    id: v4(),
                    width: 3.5626986835160417,
                    height: 2.8659940817233327,
                }
            ]
        }
    }
    initEvents() {
        document.addEventListener("pointerup", (e) => {
            this.selectedControlInfo = {}
            document.removeEventListener("pointermove", this._handleDragControl)
        })
    }
    handleUpdateCloudMarkup(id, position, scale) {
        // this.cloudMarkups = this.cloudMarkups.map((markup) => {
        //     if(markup.id === id) {
        //         markup.position = position
        //         markup.scale = scale
        //     }
        //     return markup
        // })
        const objects = this.cloudMarkupGroup.children.filter((object) => object.userData.id === id)
        objects.forEach((object) => {
            object.position.copy(position);
            object.scale.set(scale.x, scale.y, scale.z);
        })

        if(objects.length === 0) return
        const object = objects[0]
        object.updateMatrixWorld(true)
        const worldMatrix = object.matrixWorld.clone()

        this.defaultCornerPoints.forEach((point, index) => {
            const p = point.clone().applyMatrix4(worldMatrix)
            const control = this.cloudControlGroup.children[index]
            if(control) {
                control.position.copy(p)
            }
        })
    }
    handleDragControl(e) {
        if(!this.selectedControlInfo || !this.selectedControlInfo.id) return
        const { id, type } = this.selectedControlInfo
        const selectedMarkup = this.cloudMarkups.find((markup) => markup.id === id)
        this.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1)
        this.raycaster.setFromCamera(this.mouse, this.world.camera.three)
        const intersectPoint = new THREE.Vector3()
        const planeNormal = new THREE.Vector3(selectedMarkup!.normal.x, selectedMarkup!.normal.y, selectedMarkup!.normal.z)
        const planePosition = new THREE.Vector3(selectedMarkup!.position.x, selectedMarkup!.position.y, selectedMarkup!.position.z)
        this.helperPlane.setFromNormalAndCoplanarPoint(
            planeNormal, 
            planePosition
        ) 
        this.raycaster.ray.intersectPlane(this.helperPlane, intersectPoint)
        if(intersectPoint) {
            if(type === 'move') {
                if (selectedMarkup) {
                    selectedMarkup.position = intersectPoint;
                }
                this.handleUpdateCloudMarkup(id, intersectPoint, selectedMarkup!.scale)
            } else if(type === 'side-resize') {
                if (selectedMarkup) {
                    selectedMarkup.scale.x = planePosition.distanceTo(intersectPoint) * 2 / DEFAULT_WIDTH;
                }
                this.handleUpdateCloudMarkup(id, selectedMarkup!.position, selectedMarkup!.scale)
            } else if(type === 'top-resize') {
                if (selectedMarkup) {
                    selectedMarkup.scale.y = planePosition.distanceTo(intersectPoint) * 2 / DEFAULT_HEIGHT;
                }
                this.handleUpdateCloudMarkup(id, selectedMarkup!.position, selectedMarkup!.scale)
            } else if(type === 'corner') {
                const up = new THREE.Vector3(0, 1, 0);
                if(planeNormal.angleTo(up) < 0.05) {
                    up.set(0, 0, -1);
                }
                const sizeVector = new THREE.Vector3().crossVectors(planeNormal, up).normalize()
                const upVector = new THREE.Vector3().crossVectors(sizeVector, planeNormal).normalize()
                const movement = intersectPoint.clone().sub(planePosition)

                const newWidth = movement.clone().projectOnVector(sizeVector).length() * 2
                const newHeight = movement.clone().projectOnVector(upVector).length() * 2
                if (selectedMarkup) {
                    selectedMarkup.scale.x = newWidth / DEFAULT_WIDTH;
                    selectedMarkup.scale.y = newHeight / DEFAULT_HEIGHT;
                }
                this.handleUpdateCloudMarkup(id, selectedMarkup!.position, selectedMarkup!.scale)
            }
        }
        
    }
    createCornerControls(id, center: THREE.Vector3, position: THREE.Vector3, type = 'resize') {
        const div = document.createElement("div")
        div.className = "corner-control"
        div.draggable = true

        div.onmousedown = (e) => {
            e.stopPropagation()
            this.selectedControlInfo = { id, type, center: center.clone() }

            document.addEventListener("pointermove", this._handleDragControl)
        }

        const object = new CSS2DObject(div)
        object.position.copy(position)
        this.cloudControlGroup.add(object)
    }
    renderCloudMarkups() {
        this.cloudMarkupGroup.clear()
        this.cloudControlGroup.clear()

        // Iterate over the cloud markups and create a visual representation for each
        this.cloudMarkups.forEach((markup) => {
            const cloud = this.defaultCloudObject.clone()
            cloud.renderOrder = MARKUP_RENDER_ORDER;

            // Align the cloud to the normal
            const normal = markup.normal.clone().normalize();
            const up = new THREE.Vector3(0, 1, 0);

            const position = new THREE.Vector3(markup.position.x, markup.position.y, markup.position.z);

            if(normal.angleTo(up) < 0.05) {
                up.set(0, 0, -1);
            }
            const matrix = new THREE.Matrix4().lookAt(position.clone(), position.clone().addScaledVector(normal, 1), up);
            const quaternion = new THREE.Quaternion().setFromRotationMatrix(matrix);
            cloud.applyQuaternion(quaternion);
            cloud.userData = { id: markup.id, type: SELCTION_MODE.CLOUND_MARKUP }

            // Position the cloud at the markup's position
            cloud.position.copy(position.clone());
            cloud.scale.set(markup.scale.x, markup.scale.y, markup.scale.z);

            const cloudShape = this.defaultCloudShape.clone()
            cloudShape.renderOrder = MARKUP_RENDER_ORDER;
            cloudShape.applyQuaternion(quaternion);
            cloudShape.position.copy(position.clone());
            cloudShape.scale.set(markup.scale.x, markup.scale.y, markup.scale.z);
            cloudShape.userData = { id: markup.id, type: SELCTION_MODE.CLOUND_MARKUP }

            if(markup.selected && cloudShape.material instanceof THREE.MeshBasicMaterial) {
                cloudShape.material = cloudShape.material.clone()
                cloudShape.material.opacity = 0.5
                cloudShape.updateMatrixWorld(true)

                this.defaultCornerPoints.forEach((point, index) => {
                    const p = point.clone().applyMatrix4(cloudShape.matrixWorld)

                    let type = 'move'
                    switch(index) {
                        case 0:
                        case 1:
                        case 2:
                        case 3:
                            type = 'corner'
                            break
                        case 4:
                        case 5:
                            type = 'side-resize'
                            break
                        case 6:
                        case 7:
                            type = 'top-resize'
                            break
                        default:
                            type = 'move'
                            break
                    }

                    this.createCornerControls(
                        markup.id,
                        this.defaultCornerPoints[8].clone().applyMatrix4(cloudShape.matrixWorld),
                        p, 
                        type
                    )
                })
            }

            // Add the cloud to the cloud markup group
            this.cloudMarkupGroup.add(cloud, cloudShape);
        });
    }
}