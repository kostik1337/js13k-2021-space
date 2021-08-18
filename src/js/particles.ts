import { createBuffer, loadShaderSource, ShaderProgram } from "./glhelpers";

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

export class ParticleSystem {
    private read: BufferWithVAO
    private write: BufferWithVAO
    private numParticles = 8;

    private static computeProgram: ShaderProgram
    private static renderProgram: ShaderProgram

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

    private createBufferWithArray(gl: WebGL2RenderingContext): BufferWithVAO {
        const bufferData = []
        for (let i = 0; i < this.numParticles; ++i) {
            bufferData.push(
                Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, // pos
                Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1, // speed
            )
        }
        const buffer = createBuffer(gl, bufferData, gl.STREAM_DRAW)
        const computeVAO = this.createVertexArray(
            gl,
            ParticleSystem.computeProgram,
            buffer,
            4 * 6,
            [
                { name: "i_position", numComponents: 3 },
                { name: "i_speed", numComponents: 3 },
            ]
        )
        const renderVAO = this.createVertexArray(
            gl,
            ParticleSystem.computeProgram,
            buffer,
            4 * 6,
            [
                { name: "i_position", numComponents: 3 },
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
        if (!ParticleSystem.computeProgram) ParticleSystem.computeProgram =
            new ShaderProgram(gl,
                loadShaderSource("particle_comp.vert.glsl"),
                loadShaderSource("discard.frag.glsl"),
                null, ["v_position", "v_speed"]
            )
        if (!ParticleSystem.renderProgram) ParticleSystem.renderProgram =
            new ShaderProgram(gl,
                loadShaderSource("particle_render.vert.glsl"),
                loadShaderSource("particle_render.frag.glsl")
            )
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

    updateAndRender() {
        const gl = this.gl
        gl.useProgram(ParticleSystem.computeProgram.program);
        gl.bindVertexArray(this.read.computeVAO);
        // gl.uniform2f(updatePositionPrgLocs.canvasDimensions, gl.canvas.width, gl.canvas.height);
        // gl.uniform1f(updatePositionPrgLocs.deltaTime, deltaTime);

        gl.enable(gl.RASTERIZER_DISCARD);

        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.write.tf);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, this.numParticles);
        gl.endTransformFeedback();
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

        // turn on using fragment shaders again
        gl.disable(gl.RASTERIZER_DISCARD);

        gl.useProgram(ParticleSystem.renderProgram.program);
        gl.bindVertexArray(this.write.renderVAO);
        // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // gl.uniformMatrix4fv(
        //     drawParticlesProgLocs.matrix,
        //     false,
        //     m4.orthographic(0, gl.canvas.width, 0, gl.canvas.height, -1, 1));
        gl.drawArrays(gl.POINTS, 0, this.numParticles);

        [this.read, this.write] = [this.write, this.read]
    }
}