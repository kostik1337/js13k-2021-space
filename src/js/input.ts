import { config } from "./config";

export enum KeyboardButton {
    UP, DOWN, LEFT, RIGHT,
    SPEEDUP, SLOWDOWN,
    PROCEED
}

export class GameInput {
    keyboardState: { [k in KeyboardButton]?: boolean } = {}
    mouseState: {
        leftButtonDown?: boolean,
        rightButtonDown?: boolean,
    } = {}

    movement: number[] = [0, 0]
    speedDiff: number = 0

    constructor(canvas: HTMLCanvasElement) {
        canvas.requestPointerLock();

        const updatePosition = (e: MouseEvent) => {
            this.movement = [e.movementX * config.mouseSens, e.movementY * config.mouseSens]
        }

        const mouseListener = (e: MouseEvent, down: boolean) => {
            if (!down) this.mouseState.leftButtonDown = this.mouseState.rightButtonDown = false
            else {
                if (e.buttons == 1) this.mouseState.leftButtonDown = true
                else if (e.buttons == 2) this.mouseState.rightButtonDown = true
            }
        }
        const mouseDownListener = (e: MouseEvent) => mouseListener(e, true)
        const mouseUpListener = (e: MouseEvent) => mouseListener(e, false)

        const lockChangeAlert = () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener("mousemove", updatePosition);
                document.addEventListener("mousedown", mouseDownListener);
                document.addEventListener("mouseup", mouseUpListener);
            } else {
                document.removeEventListener("mousemove", updatePosition);
                document.removeEventListener("mousedown", mouseDownListener);
                document.removeEventListener("mouseup", mouseUpListener);
            }
        }
        document.addEventListener('pointerlockchange', lockChangeAlert);
        document.addEventListener('mozpointerlockchange', lockChangeAlert);

        const kbMapping = (key: string) => {
            switch (key) {
                case "w":
                case "arrowup":
                    return KeyboardButton.UP
                case "s":
                case "arrowdown":
                    return KeyboardButton.DOWN
                case "a":
                case "arrowleft":
                    return KeyboardButton.LEFT
                case "d":
                case "arrowright":
                    return KeyboardButton.RIGHT
                case "z": return KeyboardButton.SPEEDUP
                case "x": return KeyboardButton.SLOWDOWN
                case "enter": return KeyboardButton.PROCEED
            }
        }

        const keyListener = (key: string, isDown: boolean) => {
            this.keyboardState[kbMapping(key.toLowerCase())] = isDown
        }
        document.addEventListener('keydown', (e: KeyboardEvent) => keyListener(e.key, true));
        document.addEventListener('keyup', (e: KeyboardEvent) => keyListener(e.key, false));
    }

    update() {
        let kbState = this.keyboardState
        let x = kbState[KeyboardButton.LEFT] ? -1 : kbState[KeyboardButton.RIGHT] ? 1 : 0
        let y = kbState[KeyboardButton.DOWN] ? 1 : kbState[KeyboardButton.UP] ? -1 : 0
        this.movement = [x, y]

        if (this.mouseState.leftButtonDown || this.keyboardState[KeyboardButton.SPEEDUP])
            this.speedDiff = 1
        else if (this.mouseState.rightButtonDown || this.keyboardState[KeyboardButton.SLOWDOWN])
            this.speedDiff = -1
        else
            this.speedDiff = 0
    }
}