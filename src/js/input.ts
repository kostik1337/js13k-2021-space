import { config } from "./config";

export class GameInput {
    // mouseState: {
    //     leftButtonDown?: boolean,
    //     rightButtonDown?: boolean,
    // } = {}

    // movement: number[] = [0, 0]
    // speedDiff: number = 0

    constructor(
        canvas: HTMLCanvasElement,
        mouseMove: (x: number, y: number) => void,
        mouseClick: (down: boolean, left: boolean) => void
    ) {
        canvas.requestPointerLock();
        canvas.onclick = () => {
            canvas.requestPointerLock();
        }

        const updatePosition = (e: MouseEvent) => {
            mouseMove(e.movementX * config.mouseSens, e.movementY * config.mouseSens)
            //this.movement = [e.movementX * config.mouseSens, e.movementY * config.mouseSens]
        }

        const mouseListener = (e: MouseEvent, down: boolean) => {
            mouseClick(down, e.buttons == 1)
            // if (!down) this.mouseState.leftButtonDown = this.mouseState.rightButtonDown = false
            // else {
            //     if (e.buttons == 1) this.mouseState.leftButtonDown = true
            //     else if (e.buttons == 2) this.mouseState.rightButtonDown = true
            // }
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

        // const kbMapping = (key: string) => {
        //     switch (key) {
        //         case "w":
        //         case "arrowup":
        //             return KeyboardButton.UP
        //         case "s":
        //         case "arrowdown":
        //             return KeyboardButton.DOWN
        //         case "a":
        //         case "arrowleft":
        //             return KeyboardButton.LEFT
        //         case "d":
        //         case "arrowright":
        //             return KeyboardButton.RIGHT
        //         case "z": return KeyboardButton.SPEEDUP
        //         case "x": return KeyboardButton.SLOWDOWN
        //         case "enter": return KeyboardButton.PROCEED
        //     }
        // }

        // const keyListener = (key: string, isDown: boolean) => {
        //     this.keyboardState[kbMapping(key.toLowerCase())] = isDown
        // }
        // document.addEventListener('keydown', (e: KeyboardEvent) => keyListener(e.key, true));
        // document.addEventListener('keyup', (e: KeyboardEvent) => keyListener(e.key, false));
    }
}