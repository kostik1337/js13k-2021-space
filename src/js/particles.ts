import { config } from "./config";
import { createBuffer, ShaderProgram } from "./glhelpers";
import { Context } from "./index";
import { Matrix4, V3, vpow, vscale } from "./math";

type AttribData = {
    name: string,
    numComponents: number
}

type BufferWithVAO = {
    buffer: WebGLBuffer,
    computeVAO: WebGLVertexArrayObject,
    renderVAO: WebGLVertexArrayObject,
    tf: WebGLTransformFeedback,
    collisionBuffer: WebGLBuffer,
    computeCollisionVAO: WebGLVertexArrayObject
    collisionTf: WebGLTransformFeedback,
}

export type ViewProjectionData = {
    view: Matrix4,
    proj: Matrix4,
    invProjView: Matrix4,
}

const createColor = (color: string, power: number): V3 => {
    let v: V3 = [
        parseInt(color.substr(0, 2), 16) / 255,
        parseInt(color.substr(2, 2), 16) / 255,
        parseInt(color.substr(4, 2), 16) / 255,
    ]
    v = vscale(vpow(v, 2), power)
    return v
}

export abstract class ParticleSystem {
    protected static COLLISION_BUFFER_SIZE = 64


    static computeProgram: ShaderProgram
    static computeFloatingProgram: ShaderProgram
    static renderProgram: ShaderProgram

    static init(gl: WebGL2RenderingContext) {
        const loadProgram = (gl: WebGL2RenderingContext, data: string[], prefix?: string): ShaderProgram => {
            return new ShaderProgram(gl, data[0], data[1], prefix, data.slice(2))
        }
        const args = ["discard.frag.glsl", "v_position", "v_speed"]
        this.computeProgram = loadProgram(gl, ["particle_comp.vert.glsl", ...args], `#define FINAL_DIST ${config.finalDist.toFixed(1)}`)
        this.computeFloatingProgram = loadProgram(gl, ["particle_comp_floating.vert.glsl", ...args])
        this.renderProgram = loadProgram(gl, ["particle_render.vert.glsl", "particle_render.frag.glsl"])
    }

    protected read: BufferWithVAO
    protected write: BufferWithVAO

    protected numParticles: number;
    protected computeProgram: ShaderProgram
    protected renderProgram: ShaderProgram
    protected particleColor: V3
    protected particleSize: number

    abstract initialGenerator(): number[]

    private createVertexArray(
        gl: WebGL2RenderingContext,
        program: ShaderProgram,
        buffer: WebGLBuffer,
        stride: number,
        attribs: AttribData[]
    ): WebGLVertexArrayObject {
        const va = gl.createVertexArray();
        gl.bindVertexArray(va);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        let offset = 0;
        for (const { name, numComponents } of attribs) {
            const loc = program.attrLoc(name)
            if (loc < 0) continue
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(
                loc,
                numComponents,
                gl.FLOAT,
                false,
                stride,
                offset,
            );
            offset += numComponents * 4; // gl.FLOAT size
        }
        return va;
    }

    private makeTransformFeedback(gl: WebGL2RenderingContext, buffer: WebGLBuffer): WebGLTransformFeedback {
        const tf = gl.createTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, buffer);
        return tf;
    }

    private generateInitData(): number[] {
        const bufferData = []
        for (let i = 0; i < this.numParticles; ++i) {
            bufferData.push(...this.initialGenerator())
        }
        return bufferData
    }

    private createBufferWithArray(gl: WebGL2RenderingContext): BufferWithVAO {
        const buffer = createBuffer(gl, this.generateInitData(), gl.STREAM_DRAW)
        const collisionBuffer = createBuffer(gl, Array(ParticleSystem.COLLISION_BUFFER_SIZE * 6).fill(0), gl.STREAM_DRAW)

        const attribs = [
            { name: "i_position", numComponents: 3 },
            { name: "i_speed", numComponents: 3 },
        ]
        const stride = 4 * 6
        const computeVAO = this.createVertexArray(
            gl,
            this.computeProgram,
            buffer,
            stride,
            attribs
        )
        const renderVAO = this.createVertexArray(
            gl,
            this.renderProgram,
            buffer,
            stride,
            attribs
        )
        const computeCollisionVAO = this.createVertexArray(
            gl,
            this.computeProgram,
            collisionBuffer,
            stride,
            attribs
        )
        return {
            buffer,
            computeVAO,
            renderVAO,
            collisionBuffer,
            computeCollisionVAO,
            tf: this.makeTransformFeedback(gl, buffer),
            collisionTf: this.makeTransformFeedback(gl, collisionBuffer),
        }
    }

    constructor(protected gl: WebGL2RenderingContext) { }

    protected init() {
        const gl = this.gl
        this.renderProgram = ParticleSystem.renderProgram
        this.read = this.createBufferWithArray(gl)
        this.write = this.createBufferWithArray(gl)

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    }

    delete() {
        [this.read, this.write].forEach(it => {
            this.gl.deleteBuffer(it.buffer)
            this.gl.deleteBuffer(it.collisionBuffer)
            this.gl.deleteVertexArray(it.computeVAO)
            this.gl.deleteVertexArray(it.renderVAO)
            this.gl.deleteVertexArray(it.computeCollisionVAO)
            this.gl.deleteTransformFeedback(it.tf)
            this.gl.deleteTransformFeedback(it.collisionTf)
        })
    }

    protected setupComputeProgram(ctx: Context, gl: WebGL2RenderingContext, computeCollision: boolean, vpData?: ViewProjectionData) {
        let prog = this.computeProgram
        gl.useProgram(prog.program);
        gl.uniform1f(prog.uniformLoc("time"), ctx.time);
        gl.uniform1f(prog.uniformLoc("dt"), ctx.dt);
        gl.uniform1i(prog.uniformLoc("compute_collision"), computeCollision ? 1 : 0);
        if (vpData) {
            gl.uniformMatrix4fv(prog.uniformLoc("u_proj"), false, vpData.proj.values);
            gl.uniformMatrix4fv(prog.uniformLoc("u_view"), false, vpData.view.values);
            gl.uniformMatrix4fv(prog.uniformLoc("u_invprojview"), false, vpData.invProjView.values);
        }
    }

    updateAndRender(ctx: Context, vpData: ViewProjectionData, sizeMultiplier: number) {
        const gl = this.gl

        // Update
        this.setupComputeProgram(ctx, gl, false, vpData)
        gl.bindVertexArray(this.read.computeVAO);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.write.tf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.numParticles);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.disable(gl.RASTERIZER_DISCARD);

        
        // gl.bindBuffer(gl.ARRAY_BUFFER, this.write.buffer)
        // var arrBuffer = new Float32Array(this.numParticles * 6.);
        // gl.getBufferSubData(gl.ARRAY_BUFFER, 0, arrBuffer)
        // gl.bindBuffer(gl.ARRAY_BUFFER, null)

        // Render
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
        let prog = this.renderProgram;
        gl.useProgram(prog.program);
        gl.bindVertexArray(this.write.renderVAO);
        const col = this.particleColor
        gl.uniform3f(prog.uniformLoc("color"), col[0], col[1], col[2])
        gl.uniform1f(prog.uniformLoc("size"), this.particleSize * sizeMultiplier)
        gl.uniformMatrix4fv(
            prog.uniformLoc("u_view"),
            false,
            vpData.view.values);
        gl.uniformMatrix4fv(
            prog.uniformLoc("u_proj"),
            false,
            vpData.proj.values);
        gl.drawArrays(gl.POINTS, 0, this.numParticles);
        gl.disable(gl.BLEND);

        [this.read, this.write] = [this.write, this.read]
    }
}

export class FloatingParticleSystem extends ParticleSystem {
    constructor(gl: WebGL2RenderingContext) {
        super(gl)
        this.particleColor = createColor(config.floatingColor, .15)
        this.particleSize = 0.08
        this.numParticles = config.floatingParticleCount
        this.computeProgram = ParticleSystem.computeFloatingProgram
        this.init()
    }

    initialGenerator(): number[] {
        const randRange = () => Math.random() * 2 - 1;
        const fspeed = config.baseFloatingSpeed
        return [
            0, 0, 500, // position out of frustum
            // randRange(), randRange(), randRange(), 
            fspeed * randRange(), fspeed * randRange(), fspeed * randRange(), // speed
        ]
    }

}

export class CollisionParticleSystem extends ParticleSystem {
    figure = 0;

    constructor(gl: WebGL2RenderingContext, color: string) {
        super(gl)
        this.particleColor = createColor(color, .3)
        this.particleSize = 0.03
        this.numParticles = config.obsctacleParticleCount
        this.computeProgram = ParticleSystem.computeProgram
        this.init()
    }

    hitTest(ctx: Context, pos: V3): number {
        const gl = this.gl
        gl.bindBuffer(gl.ARRAY_BUFFER, this.read.collisionBuffer)
        const array = []
        for (let i = 0; i < ParticleSystem.COLLISION_BUFFER_SIZE; ++i) {
            array.push(
                pos[0], pos[1], pos[2],
                0, 0, 0
            )
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STREAM_DRAW)
        this.setupComputeProgram(ctx, gl, true)

        gl.bindVertexArray(this.read.computeCollisionVAO);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.write.collisionTf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, ParticleSystem.COLLISION_BUFFER_SIZE);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        gl.disable(gl.RASTERIZER_DISCARD);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.write.collisionBuffer)
        var arrBuffer = new Float32Array(ParticleSystem.COLLISION_BUFFER_SIZE * 6.);
        gl.getBufferSubData(gl.ARRAY_BUFFER, 0, arrBuffer)
        gl.bindBuffer(gl.ARRAY_BUFFER, null)

        let minDist = Number.MAX_VALUE
        for (let i = 0; i < arrBuffer.length; i += 6) {
            minDist = Math.min(minDist, arrBuffer[i])
        }
        return minDist
    }

    initialGenerator(): number[] {
        const randRange = () => Math.random() * 2 - 1;
        const speed = 1
        return [
            0, 0, 100, // position out of frustum
            speed * randRange(), speed * randRange(), speed * randRange(),// speed
        ]
    }

    setupComputeProgram(ctx: Context, gl: WebGL2RenderingContext, computeCollision: boolean, vpData?: ViewProjectionData) {
        super.setupComputeProgram(ctx, gl, computeCollision, vpData)
        let prog = this.computeProgram
        gl.uniform1i(prog.uniformLoc("figure"), this.figure);
    }

}