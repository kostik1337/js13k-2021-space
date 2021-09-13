declare var DEBUG_DATA: boolean;

export type TexFb = { tex: WebGLTexture, fb: WebGLFramebuffer }

export type Size = [number, number]

export function createPostprocTexFb(
    gl: WebGL2RenderingContext,
    size: Size,
    minFilter: GLenum = gl.LINEAR
): TexFb {
    let tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size[0], size[1], 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

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

export class ShaderProgram {
    program: WebGLProgram;

    private loadShader(gl: WebGL2RenderingContext, type: GLenum, source: string, name: string, prefix: string): WebGLShader {
        const shader = gl.createShader(type);

        let mergedSource = "#version 300 es\n";
        mergedSource += "precision mediump float;\n";
        mergedSource += `${prefix}\n`
        mergedSource += source;
        gl.shaderSource(shader, mergedSource);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            let errorInfo = `An error occurred compiling ${name}: ${gl.getShaderInfoLog(shader)}`;
            gl.deleteShader(shader);
            throw new Error(errorInfo)
        }

        return shader;
    }

    attrLoc(name: string) { return this.gl.getAttribLocation(this.program, name) }

    uniformLoc(name: string) { return this.gl.getUniformLocation(this.program, name); }

    constructor(
        private gl: WebGL2RenderingContext,
        vsFile: string,
        fsFile: string,
        prefix?: string,
        transformFeedbackVaryings?: string[]
    ) {
        const loadShaderSource = (name: string): string => require(`../glsl/${name}`).default;
        if (prefix == null) prefix = ""
        prefix += "\n" + loadShaderSource("common.glsl")
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, loadShaderSource(vsFile), vsFile, prefix);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, loadShaderSource(fsFile), fsFile, prefix);

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

export interface RenderTarget {
    init(gl: WebGL2RenderingContext, size: Size): void
    resize(gl: WebGL2RenderingContext, size: Size): void
    swap(): void
    getReadTex(): WebGLTexture
    getWriteFb(): WebGLFramebuffer
    getSize(size: Size): Size
}

export class ScreenRenderTarget implements RenderTarget {
    init(gl: WebGL2RenderingContext, size: Size) { }
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

    constructor(public div: number = 1, private filter: GLenum = null) { }

    init(gl: WebGL2RenderingContext, size: Size) {
        this.texFb = createPostprocTexFb(gl, size, this.filter ?? gl.LINEAR)
    }

    resize(gl: WebGL2RenderingContext, size: Size) {
        gl.bindTexture(gl.TEXTURE_2D, this.texFb.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
            size[0] / this.div, size[1] / this.div,
            0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    swap() { }

    getSize(size: Size): Size {
        return [size[0] / this.div, size[1] / this.div]
    }

    getReadTex() { return this.texFb.tex }
    getWriteFb() { return this.texFb.fb }
}

export function generateMips(gl: WebGL2RenderingContext, tex: WebGLTexture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
}

export class DoubleTextureRenderTarget implements RenderTarget {
    read: TexFb;
    write: TexFb;

    constructor(public div: number = 1, private filter: GLenum = null) { }

    init(gl: WebGL2RenderingContext, size: Size) {
        this.read = createPostprocTexFb(gl, size, this.filter ?? gl.LINEAR)
        this.write = createPostprocTexFb(gl, size, this.filter ?? gl.LINEAR)
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

    getSize(size: Size): Size {
        return [size[0] / this.div, size[1] / this.div]
    }

    getReadTex() { return this.read.tex }
    getWriteTex() { return this.write.tex }
    getWriteFb() { return this.write.fb }
}

type RenderTargets = { [index in string]: RenderTarget }
type Programs = { [index in string]: ShaderProgram }

export class RenderHelper<RT extends RenderTargets, PR extends Programs> {
    buffer: WebGLBuffer;

    constructor(
        private gl: WebGL2RenderingContext,
        public renderTargets: RT,
        public programs: PR,
        private size: Size
    ) {
        this.buffer = initScreenQuadBuffer(gl)
        for (let target of Object.values(renderTargets)) {
            target.init(gl, size)
        }
    }

    resize(size?: Size) {
        if (size) this.size = size

        for (let target of Object.values(this.renderTargets)) {
            target.resize(this.gl, this.size)
        }
    }

    bindOutput(output: RenderTarget, swapOutput: Boolean = true) {
        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, output.getWriteFb())
        const outputSize = output.getSize(this.size)
        gl.viewport(0, 0, outputSize[0], outputSize[1])
        if (swapOutput) output.swap()
        return outputSize
    }

    renderPassBegin(inputs: RenderTarget[] | null, output: RenderTarget, program: ShaderProgram): { program: ShaderProgram, size: Size } {
        const gl = this.gl
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
