import { config } from './config';
import { createPostprocTexFb, DoubleTextureRenderTarget, generateMips, loadShaderSource, RenderHelper as RenderHelper, ScreenRenderTarget, ShaderProgram, SingleTextureRenderTarget, Size } from './glhelpers'
import { GameInput } from './input';
import { Matrix4, mix, V3 } from './math';
import { ParticleSystem } from './particles';
import { debugLog } from './utils';

// from webpack define plugin
declare var DEBUG_DATA: boolean;

export type Context = {
    canvasGL: HTMLCanvasElement;
    gl: WebGL2RenderingContext;
    canvas2d: HTMLCanvasElement;
    context2d: CanvasRenderingContext2D;
    time: number;
    lastDate: number;
    dtSmoothed: number; // FIXME
    input: GameInput;
    renderHelper: RenderHelper;
    canvasTex: WebGLTexture;
}

export let debugInfo = {
    fps: 0,
    frames: 0,
    lastTimeCheck: 0,

    update(timeMillis: number) {
        this.frames++;
        if (timeMillis - this.lastTimeCheck > 1000) {
            this.lastTimeCheck = timeMillis;
            this.fps = this.frames;
            debugLog("FPS", this.fps)
            this.frames = 0;
        }
    }
}

class GameState {
    particleSystems: ParticleSystem[] = []
    rotation: [number, number] = [0, 0]
    position: V3 = V3.zero()
    viewRotationMatrix: Matrix4

    constructor(gl: WebGL2RenderingContext) {
        this.particleSystems.push(new ParticleSystem(gl))
        this.position.z = -5
        this.initViewMat()
    }

    private initViewMat() {
        const xRot = Matrix4.rotation(this.rotation[0], 0, 2)
        const yRot = Matrix4.rotation(this.rotation[1], 1, 2)
        this.viewRotationMatrix = Matrix4.id()
            .mul(xRot)
            .mul(yRot)
    }

    update(ctx: Context) {
        const m = this.viewRotationMatrix
        // const forward = new V3(m.at(0, 2), m.at(1, 2), m.at(2, 2))
        const forward = new V3(m.at(2, 0), m.at(2, 1), m.at(2, 2))
        this.position = this.position.add(forward.scale(1. * ctx.dtSmoothed))
    }

    render(ctx: Context, size: Size) {
        const projection = Matrix4.perspective(Math.PI / 2, size[0] / size[1], 0.01, 50)
        const trans = Matrix4.translate(this.position.x, this.position.y, this.position.z)
        const view = this.viewRotationMatrix.mul(trans)
        this.particleSystems.forEach(ps => {
            let minDist = ps.hitTest(ctx, this.position)
            debugLog("map value", minDist)
            debugLog("hit", minDist < config.hitDistance)
            ps.updateAndRender(ctx, projection, view)
        })
    }

    onMouseMove(dx: number, dy: number) {
        this.rotation[0] += dx
        this.rotation[1] -= dy
        this.initViewMat()
    }
}

class Main {
    ctx: Context;
    gameState: GameState;

    initRenderHelper(gl: WebGL2RenderingContext): RenderHelper {
        const particlesTarget = new SingleTextureRenderTarget()
        const bufferTarget = new DoubleTextureRenderTarget()
        const outputTarget = new ScreenRenderTarget()

        const renderHelper = new RenderHelper(gl,
            {
                particlesTarget,
                bufferTarget,
                outputTarget
            },
            {
                "pass1": {
                    program: new ShaderProgram(gl,
                        loadShaderSource("simple.vert.glsl"),
                        loadShaderSource("main.frag.glsl")
                    ),
                    inputs: [particlesTarget, bufferTarget],
                    output: bufferTarget
                },
                "render": {
                    program: new ShaderProgram(gl,
                        loadShaderSource("simple.vert.glsl"),
                        loadShaderSource("bypass.frag.glsl")
                    ),
                    inputs: [bufferTarget],
                    // inputs: [particlesTarget],
                    output: outputTarget
                },
            })

        return renderHelper
    }

    constructor() {
        const canvasGL = document.getElementById("canvasgl") as HTMLCanvasElement;
        const canvas2d = document.getElementById("canvas2d") as HTMLCanvasElement;
        const gl = canvasGL.getContext('webgl2');
        const context2d = canvas2d.getContext("2d")
        if (!gl) {
            console.log('Unable to initialize WebGL');
            return;
        }
        if (!context2d) {
            console.log('Unable to initialize 2d context');
            return;
        }

        canvas2d.width = 800
        canvas2d.height = 480
        const canvasTex = createPostprocTexFb(gl, [canvas2d.width, canvas2d.height], gl.NEAREST)

        this.gameState = new GameState(gl)
        const renderHelper = this.initRenderHelper(gl)
        this.ctx = {
            canvasGL,
            canvas2d,
            gl,
            context2d,
            time: 0,
            dtSmoothed: 0.016,
            lastDate: Date.now(),
            input: new GameInput(canvasGL,
                (dx, dy) => { this.gameState.onMouseMove(dx, dy) },
                (down, left) => { }
            ),
            renderHelper: renderHelper,
            canvasTex
        }

        window.addEventListener('resize', () => this.handleResize());
        this.handleResize()

        this.loop();
    }

    render() {
        const gl = this.ctx.gl
        const rh = this.ctx.renderHelper

        {
            const size = rh.bindOutput(rh.renderTargets["particlesTarget"])
            gl.clearColor(0, 0, 0, 1)
            gl.clear(gl.COLOR_BUFFER_BIT)
            this.gameState.render(this.ctx, size)
        }

        {
            const { program, size } = rh.renderPassBegin("pass1")
            gl.uniform1i(program.uniformLoc("newTex"), 0)
            gl.uniform1i(program.uniformLoc("prevTex"), 1)
            gl.uniform1f(program.uniformLoc("t"), this.ctx.time)
            gl.uniform1f(program.uniformLoc("dt"), this.ctx.dtSmoothed)
            gl.uniform2f(program.uniformLoc("res"), size[0], size[1])
            rh.renderPassCommit()
            generateMips(gl, rh.renderTargets["bufferTarget"]);
        }

        {
            const { program, size } = rh.renderPassBegin("render")
            gl.uniform1i(program.uniformLoc("tex"), 0)
            // gl.uniform1f(program.uniformLoc("t"), this.ctx.time)
            gl.uniform2f(program.uniformLoc("res"), size[0], size[1])
            rh.renderPassCommit()
        }

        // gl.disable(gl.BLEND)
        // this.currentScreen().preRenderGL(this.ctx)

        // {
        //     const { locations, w, h } = rg.renderPassBegin<MainProgramData>("render")

        //     gl.uniform1f(locations.timeLoc, this.ctx.time)
        //     gl.uniform2f(locations.resLoc, w, h)

        //     let renderData = this.ctx.renderData
        //     if (renderData.ship) {
        //         gl.uniformMatrix3fv(locations.shipRotationLoc, false, renderData.ship.rotation.toMatrix().values)
        //         let pos = renderData.ship.position
        //         gl.uniform3f(locations.shipPosLoc, pos.x, pos.y, pos.z)
        //     } else {
        //         gl.uniform3f(locations.shipPosLoc, 500,0,0)
        //         gl.uniformMatrix3fv(locations.shipRotationLoc, false, math.Matrix3.id().values)
        //     }

        //     gl.uniformMatrix3fv(locations.viewRotationLoc, false, renderData.view.rotation.toMatrix().values)
        //     let vpos = renderData.view.position
        //     gl.uniform3f(locations.viewPosLoc, vpos.x, vpos.y, vpos.z)

        //     let tbPos = renderData.timeBonusPos
        //     if (tbPos)
        //         gl.uniform4f(locations.timeBonusPosLoc, tbPos.x, tbPos.y, tbPos.z, config.timeBonusRadius)
        //     else gl.uniform4f(locations.timeBonusPosLoc, 0, 0, 0, -1)

        //     let sbPos = renderData.speedBonusPos
        //     if (sbPos)
        //         gl.uniform4f(locations.speedBonusPosLoc, sbPos.x, sbPos.y, sbPos.z, config.speedBonusRadius)
        //     else gl.uniform4f(locations.speedBonusPosLoc, 0, 0, 0, -1)

        //     rg.renderPassCommit()
        // }

        // {
        //     const { locations, w, h } = rg.renderPassBegin<PostprocProgramData>("fxaa")
        //     gl.uniform2f(locations.resLoc, w, h)
        //     gl.uniform1i(locations.texPosLoc, 0)
        //     rg.renderPassCommit()
        // }

        // gl.enable(gl.BLEND)
        // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        // {
        //     gl.activeTexture(gl.TEXTURE1)
        //     gl.bindTexture(gl.TEXTURE_2D, this.canvasTex)
        //     gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.ctx.canvas2d);

        //     const { locations, w, h } = rg.renderPassBegin<UiProgramData>("ui")
        //     gl.uniform2f(locations.resLoc, w, h)
        //     gl.uniform1i(locations.texPosLoc, 1)
        //     gl.uniform2f(locations.texSizeLoc, this.ctx.canvas2d.width, this.ctx.canvas2d.height)
        //     const uiOff = this.ctx.renderData.uiOffset;
        //     gl.uniform3f(locations.offsetLoc, uiOff.x, uiOff.y, uiOff.z)
        //     rg.renderPassCommit()
        // }
    }

    loop() {
        const ctx = this.ctx
        let date = Date.now()
        let dt = (date - ctx.lastDate) / 1000
        ctx.time += dt
        ctx.lastDate = date
        debugInfo.update(date)

        ctx.dtSmoothed = mix(ctx.dtSmoothed, dt, 0.1); // FIXME: without smoothing everything trembles

        // const screen = this.currentScreen();
        // screen.update(ctx, ctx.dtSmoothed)
        // screen.renderCanvas(ctx, dt)
        this.gameState.update(this.ctx)
        this.render()
        ctx.input.update() // Update input post screen update because whole architecture is shit

        window.requestAnimationFrame(() => this.loop());
    }

    handleResize() {
        const [w, h] = [window.innerWidth, window.innerHeight];
        [this.ctx.canvasGL].forEach(canvas => {
            canvas.width = w
            canvas.height = h
        })
        this.ctx.renderHelper.resize(w, h)
    }
}

let canvas = document.getElementById("canvasgl")
canvas.onclick = () => { canvas.onclick = null; new Main(); }