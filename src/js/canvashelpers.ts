export function fillTextMultiline(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number): number {
    let spl = text.split("\n")
    for (let i = 0; i < spl.length; ++i) {
        ctx.fillText(spl[i], x, y + h * i)
    }
    return h * spl.length;
}