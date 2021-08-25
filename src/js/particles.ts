import { config } from "./config";
import { createBuffer, loadShaderSource, ShaderProgram } from "./glhelpers";
import { Context } from "./index";
import { Matrix4, V3 } from "./math";

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

export enum ParticleSystemType {
    FLOATING, OBSTACLE
}

export class ParticleSystem {
    private static COLLISION_BUFFER_SIZE = 64

    private static loadProgram(gl: WebGL2RenderingContext, data: string[]): ShaderProgram {
        return new ShaderProgram(gl,
            loadShaderSource(data[0]),
            loadShaderSource(data[1]),
            null, data.slice(2)
        )
    }

    static computeProgram: ShaderProgram
    static computeFloatingProgram: ShaderProgram
    static renderProgram: ShaderProgram

    static init(gl: WebGL2RenderingContext) {
        const args = ["discard.frag.glsl", "v_position", "v_speed"]
        this.computeProgram = this.loadProgram(gl, ["particle_comp.vert.glsl", ...args])
        this.computeFloatingProgram = this.loadProgram(gl, ["particle_comp_floating.vert.glsl", ...args])
        this.renderProgram = this.loadProgram(gl, ["particle_render.vert.glsl", "particle_render.frag.glsl"])
    }

    private read: BufferWithVAO
    private write: BufferWithVAO
    private numParticles: number;
    figure = 0;

    private computeProgram: ShaderProgram
    private renderProgram: ShaderProgram

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
        const randRange = () => Math.random() * 2 - 1;
        const bufferData = []
        const fspeed = config.baseFloatingSpeed
        const generator: () => number[] =
            this.type == ParticleSystemType.OBSTACLE ? () => [
                randRange(), randRange(), randRange(),// pos
                randRange(), randRange(), randRange(),// speed
            ] : () => [
                0,0, 500,
                fspeed * randRange(), fspeed * randRange(), fspeed * randRange(),// speed
            ]
        for (let i = 0; i < this.numParticles; ++i) {
            bufferData.push(...generator())
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
        const computeVAO = this.createVertexArray(
            gl,
            this.computeProgram,
            buffer,
            4 * 6,
            attribs
        )
        const renderVAO = this.createVertexArray(
            gl,
            this.renderProgram,
            buffer,
            4 * 6,
            attribs
        )
        const computeCollisionVAO = this.createVertexArray(
            gl,
            this.computeProgram,
            collisionBuffer,
            4 * 6,
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

    constructor(private gl: WebGL2RenderingContext, private type: ParticleSystemType) {
        this.numParticles =
            type == ParticleSystemType.OBSTACLE ? config.obsctacleParticleCount
                : config.floatingParticleCount
        this.computeProgram =
            type == ParticleSystemType.OBSTACLE ? ParticleSystem.computeProgram :
                ParticleSystem.computeFloatingProgram
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

    private setupComputeProgram(ctx: Context, gl: WebGL2RenderingContext, computeCollision: boolean, projection?: Matrix4, view?: Matrix4) {
        let prog = this.computeProgram
        gl.useProgram(prog.program);
        gl.uniform1f(prog.uniformLoc("time"), ctx.time);
        gl.uniform1f(prog.uniformLoc("dt"), ctx.dtSmoothed);
        gl.uniform1i(prog.uniformLoc("compute_collision"), computeCollision ? 1 : 0);
        if (!computeCollision) {
            gl.uniformMatrix4fv(prog.uniformLoc("u_proj"), false, projection.values);
            gl.uniformMatrix4fv(prog.uniformLoc("u_view"), false, view.values);
            gl.uniformMatrix4fv(prog.uniformLoc("u_invprojview"), false, projection.mul(view).invert().values);
        }
        if (this.type == ParticleSystemType.OBSTACLE) {
            gl.uniform1i(prog.uniformLoc("figure"), this.figure);
        }
    }

    hitTest(ctx: Context, pos: V3): number {
        const gl = this.gl
        gl.bindBuffer(gl.ARRAY_BUFFER, this.read.collisionBuffer)
        const array = []
        for (let i = 0; i < ParticleSystem.COLLISION_BUFFER_SIZE; ++i) {
            array.push(
                pos.x, pos.y, pos.z,
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
        // turn on using fragment shaders again
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

    updateAndRender(ctx: Context, projection: Matrix4, view: Matrix4) {
        const gl = this.gl

        // Update
        this.setupComputeProgram(ctx, gl, false, projection, view)
        // let prog = this.computeProgram
        // gl.useProgram(prog.program);
        // gl.uniform1f(prog.uniformLoc("time"), ctx.time);
        // gl.uniform1f(prog.uniformLoc("dt"), ctx.dtSmoothed);
        // gl.uniform1i(prog.uniformLoc("figure"), this.figure);
        gl.bindVertexArray(this.read.computeVAO);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.write.tf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.numParticles);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // turn on using fragment shaders again
        gl.disable(gl.RASTERIZER_DISCARD);

        // 
        // gl.bindBuffer(gl.ARRAY_BUFFER, this.write.buffer)
        // var arrBuffer = new Float32Array(ParticleSystem.COLLISION_BUFFER_SIZE * 6.);
        // gl.getBufferSubData(gl.ARRAY_BUFFER, 0, arrBuffer)
        // gl.bindBuffer(gl.ARRAY_BUFFER, null)
        // 

        // Render
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
        let prog = this.renderProgram;
        gl.useProgram(prog.program);
        gl.bindVertexArray(this.write.renderVAO);
        gl.uniform1f(prog.uniformLoc("power"), this.type == ParticleSystemType.FLOATING ? 2. : 0.1)
        gl.uniform1f(prog.uniformLoc("size"), this.type == ParticleSystemType.FLOATING ? 30 : 10)
        gl.uniformMatrix4fv(
            prog.uniformLoc("u_view"),
            false,
            view.values);
        gl.uniformMatrix4fv(
            prog.uniformLoc("u_proj"),
            false,
            projection.values);
        gl.drawArrays(gl.POINTS, 0, this.numParticles);
        gl.disable(gl.BLEND);

        [this.read, this.write] = [this.write, this.read]
    }
}