import { config } from './config';
import { createPostprocTexFb, DoubleTextureRenderTarget, generateMips, RenderHelper as RenderHelper, RenderTarget, ScreenRenderTarget, ShaderProgram, SingleTextureRenderTarget, Size } from './glhelpers'
import { GameInput } from './input';
import { clamp, Matrix4, mix, mixFactor, sstep, V2, V3, vadd, vclamp, vmix, vscale } from './math';
import { FloatingParticleSystem, CollisionParticleSystem, ParticleSystem } from './particles';
import { debugLog } from './utils';

// from webpack define plugin
declare var DEBUG_DATA: boolean;

type RenderTargets = {
    particlesTarget: RenderTarget,
    bufferTarget: DoubleTextureRenderTarget,
    outputTarget: RenderTarget
}

type ShaderPrograms = {
    pass1: ShaderProgram,
    screen: ShaderProgram,
}

type MyRenderHelper = RenderHelper<RenderTargets, ShaderPrograms>

export type Context = {
    canvasGL: HTMLCanvasElement;
    gl: WebGL2RenderingContext;
    canvas2d: HTMLCanvasElement;
    context2d: CanvasRenderingContext2D;
    time: number;
    lastDate: number;
    dt: number; // FIXME
    input: GameInput;
    renderHelper: MyRenderHelper;
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

type InterpData = {
    val: number,
    init: number,
    target: number,
    rateLog: number,
    setFn: (x: number) => void,
    end?: () => void
}

const InterpHelper = {
    data: null as InterpData,

    start(init: number, target: number, rate: number, setFn: (x: number) => void, end?: () => void) {
        this.data = { val: init, init, target, rateLog: Math.log(rate), setFn, end }
    },

    update(dt: number) {
        const data: InterpData = this.data
        if (!data) return
        data.val = mix(data.val, data.target, mixFactor(dt, data.rateLog))
        if (Math.abs(data.val - data.target) < Math.abs(data.init - data.target) * 0.01) {
            data.val = data.target
            if (data.end) data.end()
            this.data = null
        }
        data.setFn(data.val)
    }
}

enum FinishedState {
    PLAYING,
    JUST_FINISHED,
    FINISHED
}

class GameState {
    floatingParticles: FloatingParticleSystem
    pathParticles: CollisionParticleSystem
    obstacleParticles: CollisionParticleSystem
    finalParticles: CollisionParticleSystem
    mouseMovement: V2 = [0, 0]
    dampedMovement: V2 = [0, 0]
    rotation: V2 = [0, 0]
    position: V3 = [0, 0, 0]
    energy = 1
    projection: Matrix4
    blackoutFactor = 1
    // finished state
    finishState: FinishedState = FinishedState.PLAYING

    constructor(private gl: WebGL2RenderingContext) {
        this.floatingParticles = new FloatingParticleSystem(gl)
        this.pathParticles = new CollisionParticleSystem(gl, config.pathColor)
        this.obstacleParticles = new CollisionParticleSystem(gl, config.obstacleColor)
        this.obstacleParticles.figure = 1
        this.position[2] = 1
        InterpHelper.start(-1, 1, 0.05, x => this.blackoutFactor = x)
    }

    resize(size: Size) {
        this.projection = Matrix4.perspective(config.camParams[0], size[0] / size[1], config.camParams[1], config.camParams[2])
    }

    getProgress() { return -this.position[2] / config.finalDist; }

    updateAndRender(ctx: Context, size: Size) {
        if (this.finishState != FinishedState.PLAYING) return
        // update
        this.dampedMovement = vmix(this.dampedMovement, this.mouseMovement,
            mixFactor(ctx.dt, Math.log(0.04)))
        this.mouseMovement = [0, 0]
        const dm = this.dampedMovement
        this.rotation = this.rotation.map((v, i) => {
            let boundsReduction = dm[i] > 0 != v > 0 ? 1 : (1 - sstep(Math.PI / 6, Math.PI / 4, Math.abs(v)))
            return v + dm[i] * 1 * boundsReduction
        }) as V2

        // view rotation matrix
        const vrMat = Matrix4.id()
            .mul(Matrix4.rotation(this.rotation[0], 0, 2))
            .mul(Matrix4.rotation(this.rotation[1], 1, 2))
        const forward: V3 = [vrMat.at(2, 0), vrMat.at(2, 1), vrMat.at(2, 2)]
        const speed = Math.sqrt(this.energy) * 4
        this.position = vadd(this.position, vscale(forward, -speed * ctx.dt))
        debugLog("pos", this.position.map(v => v.toFixed(2)))
        if (-this.position[2] > config.finalDist - config.camParams[2] - 2 && this.finalParticles == null) {
            this.finalParticles = new CollisionParticleSystem(this.gl, config.finalColor)
            this.finalParticles.figure = 20
        }

        const trans = Matrix4.translate(vscale(this.position, -1))
        const view = vrMat.mul(trans)
        const vpData = {
            proj: this.projection,
            view,
            invProjView: this.projection.mul(view).invert()
        }
        let particles = [
            this.floatingParticles,
            this.pathParticles,
            this.obstacleParticles
        ]

        let hitFinal = false
        if (this.finalParticles) {
            particles.push(this.finalParticles)
            const l = this.finalParticles.hitTest(ctx, this.position)
            debugLog("final", l)
            hitFinal = l < config.hitFinalDistance
        }
        particles.forEach(it => it.updateAndRender(ctx, vpData, size[1]))
        const hitPath = this.pathParticles.hitTest(ctx, this.position) < config.hitPathDistance
        this.energy += (hitPath ? 0.3 : -0.05) * ctx.dt
        this.energy = clamp(this.energy, 0, 1)
        if (hitFinal && this.finishState == FinishedState.PLAYING) {
            InterpHelper.start(1, 0, 0.1, x => this.blackoutFactor = x,
                () => {
                    console.log("finishhhh")
                    this.finishState = FinishedState.JUST_FINISHED
                })
        }
        debugLog("energy", this.energy)
    }

    onMouseMove(dx: number, dy: number) {
        this.mouseMovement = [dx, -dy]
    }
}

class Main {
    ctx: Context;
    gameState: GameState;


    initRenderHelper(gl: WebGL2RenderingContext, size: Size): MyRenderHelper {
        const renderHelper = new RenderHelper<RenderTargets, ShaderPrograms>(gl,
            {
                particlesTarget: new SingleTextureRenderTarget(1, gl.LINEAR_MIPMAP_LINEAR),
                bufferTarget: new DoubleTextureRenderTarget(1),
                outputTarget: new ScreenRenderTarget(),
            },
            {
                pass1: new ShaderProgram(gl, "simple.vert.glsl", "pass1.frag.glsl"),
                screen: new ShaderProgram(gl, "simple.vert.glsl", "screen.frag.glsl"),
            },
            size
        )

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

        ParticleSystem.init(gl)
        this.gameState = new GameState(gl)
        const renderHelper = this.initRenderHelper(gl, this.getSize())
        this.ctx = {
            canvasGL,
            canvas2d,
            gl,
            context2d,
            time: 0,
            dt: 0.016,
            lastDate: Date.now(),
            input: new GameInput(canvas2d,
                (dx, dy) => { this.gameState.onMouseMove(dx, dy) },
                (down, left) => { }
            ),
            renderHelper: renderHelper
        }

        window.addEventListener('resize', () => this.handleResize());
        this.handleResize()

        this.loop();
    }

    render() {
        const gl = this.ctx.gl
        const rh = this.ctx.renderHelper

        {
            const size = rh.bindOutput(rh.renderTargets.particlesTarget)
            gl.clearColor(0, 0, 0, 1)
            gl.clear(gl.COLOR_BUFFER_BIT)
            this.gameState.updateAndRender(this.ctx, size)
        }

        generateMips(gl, rh.renderTargets.particlesTarget.getReadTex());
        {
            const { program, size } = rh.renderPassBegin(
                [rh.renderTargets.particlesTarget, rh.renderTargets.bufferTarget],
                rh.renderTargets.bufferTarget,
                rh.programs.pass1
            )
            gl.uniform1i(program.uniformLoc("newTex"), 0)
            gl.uniform1i(program.uniformLoc("prevTex"), 1)
            gl.uniform1f(program.uniformLoc("t"), this.ctx.time)
            gl.uniform1f(program.uniformLoc("dt"), this.ctx.dt)
            gl.uniform2f(program.uniformLoc("res"), size[0], size[1])
            rh.renderPassCommit()
        }

        {
            const { program, size } = rh.renderPassBegin(
                [rh.renderTargets.bufferTarget],
                rh.renderTargets.outputTarget,
                rh.programs.screen
            )
            gl.uniform1i(program.uniformLoc("tex"), 0)
            // gl.uniform1f(program.uniformLoc("t"), this.ctx.time)
            gl.uniform2f(program.uniformLoc("res"), size[0], size[1])
            gl.uniform1f(program.uniformLoc("energy"), this.gameState.energy)
            gl.uniform1f(program.uniformLoc("progress"), this.gameState.getProgress())
            gl.uniform1f(program.uniformLoc("blackout"), this.gameState.blackoutFactor)
            rh.renderPassCommit()
        }
    }

    loop() {
        const ctx = this.ctx
        let date = Date.now()
        let dt = (date - ctx.lastDate) / 1000
        ctx.time += dt
        ctx.lastDate = date
        debugInfo.update(date)

        ctx.dt = mix(ctx.dt, dt, 0.1); // FIXME: without smoothing everything trembles

        if (this.gameState.finishState == FinishedState.JUST_FINISHED) {
            const c = ctx.context2d
            c.font = 'bold 30px monospace'
            c.fillStyle = '#fff'
            c.shadowColor = '#ffffffb'
            c.shadowBlur = 20
            c.fillText("You win!", 50, 100)
        }
        InterpHelper.update(dt)
        this.render()

        window.requestAnimationFrame(() => this.loop());
    }

    getSize(): Size { return [window.innerWidth, window.innerHeight] }

    handleResize() {
        const size = this.getSize();
        [this.ctx.canvasGL, this.ctx.canvas2d].forEach(canvas => {
            canvas.width = size[0]
            canvas.height = size[1]
        })
        this.ctx.renderHelper.resize(size)
        this.gameState.resize(size)
    }
}

let canvas = document.getElementById("canvas2d")
canvas.onclick = () => { canvas.onclick = null; new Main(); }