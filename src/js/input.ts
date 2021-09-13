import { config } from "./config";

export class GameInput {
    constructor(
        canvas: HTMLCanvasElement,
        mouseMove: (x: number, y: number) => void,
        keyListener: (key: string) => void
    ) {
        canvas.requestPointerLock();
        canvas.onclick = () => {
            canvas.requestPointerLock();
        }

        const updatePosition = (e: MouseEvent) => {
            mouseMove(e.movementX * config.mouseSens, e.movementY * config.mouseSens)
        }

        // const mouseListener = (e: MouseEvent, down: boolean) => {
        //     mouseClick(down, e.buttons == 1)
        // }
        // const mouseDownListener = (e: MouseEvent) => mouseListener(e, true)
        // const mouseUpListener = (e: MouseEvent) => mouseListener(e, false)

        const lockChangeAlert = () => {
            if (document.pointerLockElement === canvas) {
                document.addEventListener("mousemove", updatePosition);
                // document.addEventListener("mousedown", mouseDownListener);
                // document.addEventListener("mouseup", mouseUpListener);
            } else {
                document.removeEventListener("mousemove", updatePosition);
                // document.removeEventListener("mousedown", mouseDownListener);
                // document.removeEventListener("mouseup", mouseUpListener);
            }
        }
        document.addEventListener('pointerlockchange', lockChangeAlert);
        document.addEventListener('mozpointerlockchange', lockChangeAlert);

        document.addEventListener('keydown', (e: KeyboardEvent) => keyListener(e.key));
    }
}