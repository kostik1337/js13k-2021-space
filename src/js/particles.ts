import { createBuffer, loadShaderSource, ShaderProgram, Size } from "./glhelpers";
import { Context } from "./index";
import { Matrix4 } from "./math";

type AttribData = {
    name: string,
    numComponents: number
}

type BufferWithVAO = {
    buffer: WebGLBuffer,
    computeVAO: WebGLVertexArrayObject,
    renderVAO: WebGLVertexArrayObject,
    tf: WebGLTransformFeedback
}

enum ProgramType {
    COMPUTE, RENDER
}

class ProgramContainer {
    private static programs: ShaderProgram[] = []

    static getProgram(gl: WebGL2RenderingContext, type: ProgramType): ShaderProgram {
        let typeNum = type as number
        let prog = this.programs[typeNum]
        if (prog == null) {
            let data: string[] = []
            switch (type) {
                case ProgramType.COMPUTE:
                    data = ["particle_comp.vert.glsl", "discard.frag.glsl", "v_position", "v_speed"]
                    break
                case ProgramType.RENDER:
                    data = ["particle_render.vert.glsl", "particle_render.frag.glsl"]
                    break
            }
            prog = new ShaderProgram(gl,
                loadShaderSource(data[0]),
                loadShaderSource(data[1]),
                null, data.slice(2)
            )
            this.programs[typeNum] = prog
        }
        return prog
    }
}

export class ParticleSystem {
    private read: BufferWithVAO
    private write: BufferWithVAO
    private numParticles = 40000;
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
        const bufferData = []
        for (let i = 0; i < this.numParticles; ++i) {
            bufferData.push(
                Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, // pos
                // 0, 0, 0,
                Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, // speed
            )
        }
        return bufferData
    }

    private createBufferWithArray(gl: WebGL2RenderingContext): BufferWithVAO {
        const buffer = createBuffer(gl, this.generateInitData(), gl.STREAM_DRAW)
        const computeVAO = this.createVertexArray(
            gl,
            this.computeProgram,
            buffer,
            4 * 6,
            [
                { name: "i_position", numComponents: 3 },
                { name: "i_speed", numComponents: 3 },
            ]
        )
        const renderVAO = this.createVertexArray(
            gl,
            this.renderProgram,
            buffer,
            4 * 6,
            [
                { name: "i_position", numComponents: 3 },
                { name: "i_speed", numComponents: 3 },
            ]
        )
        return {
            buffer,
            computeVAO,
            renderVAO,
            tf: this.makeTransformFeedback(gl, buffer)
        }
    }

    constructor(private gl: WebGL2RenderingContext) {
        this.computeProgram = ProgramContainer.getProgram(gl, ProgramType.COMPUTE)
        this.renderProgram = ProgramContainer.getProgram(gl, ProgramType.RENDER)
        this.read = this.createBufferWithArray(gl)
        this.write = this.createBufferWithArray(gl)

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER, null);
    }

    delete() {
        [this.read, this.write].forEach(it => {
            this.gl.deleteBuffer(it.buffer)
            this.gl.deleteVertexArray(it.computeVAO)
            this.gl.deleteVertexArray(it.renderVAO)
            this.gl.deleteTransformFeedback(it.tf)
        })
    }

    updateAndRender(ctx: Context, projection: Matrix4, view: Matrix4) {
        const gl = this.gl

        // Update
        let prog = this.computeProgram
        gl.useProgram(prog.program);
        gl.bindVertexArray(this.read.computeVAO);
        gl.uniform1f(prog.uniformLoc("time"), ctx.time);
        gl.uniform1f(prog.uniformLoc("dt"), ctx.dtSmoothed);
        gl.uniform1i(prog.uniformLoc("figure"), this.figure);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.write.tf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.numParticles);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // turn on using fragment shaders again
        gl.disable(gl.RASTERIZER_DISCARD);

        // gl.bindBuffer(gl.ARRAY_BUFFER, this.write.buffer)
        // var arrBuffer = new Float32Array(this.numParticles * 6.);
        // gl.getBufferSubData(gl.ARRAY_BUFFER, 0, arrBuffer)
        // console.log(arrBuffer)
        // gl.bindBuffer(gl.ARRAY_BUFFER, null)

        // Render
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)
        prog = this.renderProgram;
        gl.useProgram(prog.program);
        gl.bindVertexArray(this.write.renderVAO);
        // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.uniform1f(prog.uniformLoc("power"), 14 / Math.sqrt(this.numParticles))
        gl.uniformMatrix4fv(
            prog.uniformLoc("u_model"),
            false,
            Matrix4.id().values);
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