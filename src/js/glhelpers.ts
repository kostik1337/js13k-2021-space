declare var DEBUG_DATA: boolean;

export type TexFb = { tex: WebGLTexture, fb: WebGLFramebuffer }

export type Size = number[]

export function createPostprocTexFb(
    gl: WebGL2RenderingContext,
    size?: Size,
    filter: GLenum = gl.LINEAR
): TexFb {
    let tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (size)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size[0], size[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    let fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    return { tex, fb }
}

export function createBuffer(gl: WebGL2RenderingContext, data: number[], usage: GLenum): WebGLBuffer {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
    return buffer;
}

function initScreenQuadBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
    const positions = [
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0
    ];
    return createBuffer(gl, positions, gl.STATIC_DRAW)
}

export let loadShaderSource = (name: string): string => require(`../glsl/${name}`).default;

export class ShaderProgram {
    program: WebGLProgram;

    private loadShader(gl: WebGL2RenderingContext, type: GLenum, source: string, prefix: string): WebGLShader {
        const shader = gl.createShader(type);

        let mergedSource = "#version 300 es\n";
        mergedSource += "precision mediump float;\n";
        if (prefix) {
            mergedSource += `${prefix}\n`
        }
        mergedSource += source;
        gl.shaderSource(shader, mergedSource);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            let errorInfo = `An error occurred compiling ${type == gl.VERTEX_SHADER ? "vertex" : "fragment"} shader: ${gl.getShaderInfoLog(shader)}`;
            gl.deleteShader(shader);
            throw new Error(errorInfo)
        }

        return shader;
    }

    attrLoc(name: string) { return this.gl.getAttribLocation(this.program, name) }

    uniformLoc(name: string) { return this.gl.getUniformLocation(this.program, name); }

    constructor(
        private gl: WebGL2RenderingContext,
        vsSource: string,
        fsSource: string,
        prefix?: string,
        transformFeedbackVaryings?: string[]
    ) {
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource, prefix);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource, prefix);

        const program = gl.createProgram();
        this.program = program;
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        if (transformFeedbackVaryings) {
                gl.transformFeedbackVaryings(
                program, transformFeedbackVaryings, gl.INTERLEAVED_ATTRIBS
            )
        }
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            let errorInfo = `Unable to link the shader program: ${gl.getProgramInfoLog(program)}`;
            gl.deleteProgram(program)
            throw new Error(errorInfo)
        }
    }
}

interface RenderTarget {
    init(gl: WebGL2RenderingContext): void
    resize(gl: WebGL2RenderingContext, size: Size): void
    swap(): void
    getReadTex(): WebGLTexture
    getWriteFb(): WebGLFramebuffer
    getSize(size: Size): Size
}

export class ScreenRenderTarget implements RenderTarget {
    init(gl: WebGL2RenderingContext) { }
    resize(gl: WebGL2RenderingContext, size: Size) { }
    swap() { }
    getReadTex(): WebGLTexture {
        throw new Error("Can't getReadTex on ScreenRenderBuffer")
    }
    getWriteFb(): WebGLFramebuffer {
        return null
    }
    getSize(size: Size): Size {
        return size
    }
}

export class SingleTextureRenderTarget implements RenderTarget {
    texFb: TexFb;

    constructor(private div: number = 1) { }

    init(gl: WebGL2RenderingContext) {
        this.texFb = createPostprocTexFb(gl)
    }

    resize(gl: WebGL2RenderingContext, size: Size) {
        gl.bindTexture(gl.TEXTURE_2D, this.texFb.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            size[0] / this.div, size[1] / this.div,
            0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    swap() {}

    getSize(size: Size) {
        return [size[0] / this.div, size[1] / this.div]
    }

    getReadTex() { return this.texFb.tex }
    getWriteFb() { return this.texFb.fb }
}

export function generateMips(gl: WebGL2RenderingContext, target: RenderTarget) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target.getReadTex());
    gl.generateMipmap(gl.TEXTURE_2D);

}

export class DoubleTextureRenderTarget implements RenderTarget {
    read: TexFb;
    write: TexFb;

    constructor(private div: number = 1) { }

    init(gl: WebGL2RenderingContext) {
        this.read = createPostprocTexFb(gl)
        this.write = createPostprocTexFb(gl)
    }

    resize(gl: WebGL2RenderingContext, size: Size) {
        for (let texFb of [this.read, this.write]) {
            gl.bindTexture(gl.TEXTURE_2D, texFb.tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
                size[0] / this.div, size[1] / this.div,
                0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
    }

    swap() {
        [this.read, this.write] = [this.write, this.read]
    }

    getSize(size: Size) {
        return [size[0] / this.div, size[1] / this.div]
    }

    getReadTex() { return this.read.tex }
    getWriteFb() { return this.write.fb }
}

export type PassIndex = string;

export type PassSpec = {
    program: ShaderProgram,
    output: RenderTarget,
    inputs?: RenderTarget[],
}

export class RenderHelper {
    buffer: WebGLBuffer;
    size: Size;

    constructor(
        private gl: WebGL2RenderingContext,
        public renderTargets: { [index in PassIndex]: RenderTarget },
        public passSpecs: { [index in PassIndex]: PassSpec }
    ) {
        this.buffer = initScreenQuadBuffer(gl)
        for (let target of Object.values(renderTargets)) {
            target.init(gl)
        }
    }

    resize(w: number, h: number) {
        this.size = [w, h]

        const gl = this.gl
        for (let target of Object.values(this.renderTargets)) {
            target.resize(gl, this.size)
        }
    }

    bindOutput(output: RenderTarget, swapOutput: Boolean = true) {
        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, output.getWriteFb())
        const outputSize = output.getSize(this.size)
        gl.viewport(0, 0, outputSize[0], outputSize[1])
        if(swapOutput) output.swap()
        return outputSize
    }

    renderPassBegin(index: PassIndex): { program: ShaderProgram, size: Size } {
        const gl = this.gl
        const { program, output, inputs } = this.passSpecs[index]
        const outputSize = this.bindOutput(output, false)

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)

        const attrPosition = program.attrLoc("i_pos");
        gl.vertexAttribPointer(attrPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attrPosition);

        gl.useProgram(program.program)

        if (inputs) inputs.forEach((input, i) => {
            gl.activeTexture(gl.TEXTURE0 + i)
            gl.bindTexture(gl.TEXTURE_2D, input.getReadTex())
        })
        output.swap()

        return { program, size: outputSize }
    }

    renderPassCommit() {
        const gl = this.gl
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
}
