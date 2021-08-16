declare var DEBUG_DATA: boolean;

export type TexFb = { tex: WebGLTexture, fb: WebGLFramebuffer }

export type Size = number[]

export function createPostprocTexFb(
    gl: WebGLRenderingContext,
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

export function initScreenQuadBuffer(gl: WebGLRenderingContext): WebGLBuffer {
    const positionBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positions = [
        1.0, 1.0,
        -1.0, 1.0,
        1.0, -1.0,
        -1.0, -1.0
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    return positionBuffer;
}

export class ShaderProgram {
    program: WebGLProgram;

    private loadShader(gl: WebGLRenderingContext, type: GLenum, source: string, prefix: string): WebGLShader {
        const shader = gl.createShader(type);

        let mergedSource = "precision mediump float;\n";
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
        private gl: WebGLRenderingContext,
        vsSource: string,
        fsSource: string,
        prefix?: string
    ) {
        const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource, prefix);
        const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource, prefix);

        const shaderProgram = gl.createProgram();
        this.program = shaderProgram;
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);

        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            let errorInfo = `Unable to link the shader program: ${gl.getProgramInfoLog(shaderProgram)}`;
            gl.deleteProgram(shaderProgram)
            throw new Error(errorInfo)
        }
    }
}

interface RenderTarget {
    init(gl: WebGLRenderingContext): void
    resize(gl: WebGLRenderingContext, size: Size): void
    swap(): void
    getReadTex(): WebGLTexture
    getWriteFb(): WebGLFramebuffer
    getSize(size: Size): Size
}

export class ScreenRenderTarget implements RenderTarget {
    init(gl: WebGLRenderingContext) { }
    resize(gl: WebGLRenderingContext, size: Size) { }
    swap() { }
    getReadTex(): WebGLTexture {
        throw "Can't getReadTex on ScreenRenderBuffer"
    }
    getWriteFb(): WebGLFramebuffer {
        return null
    }
    getSize(size: Size): Size {
        return size
    }
}

export class DoubleTextureRenderTarget implements RenderTarget {
    read: TexFb;
    write: TexFb;

    constructor(private div: number = 1) { }

    init(gl: WebGLRenderingContext) {
        this.read = createPostprocTexFb(gl)
        this.write = createPostprocTexFb(gl)
    }

    resize(gl: WebGLRenderingContext, size: Size) {
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

export class RenderPipeline {
    buffer: WebGLBuffer;
    size: Size;

    constructor(
        private gl: WebGLRenderingContext,
        private renderTargets: RenderTarget[],
        private passSpecs: { [index in PassIndex]: PassSpec }
    ) {
        this.buffer = initScreenQuadBuffer(gl)
        renderTargets.forEach(target => target.init(gl))
    }

    resize(w: number, h: number) {
        this.size = [w, h]

        const gl = this.gl
        this.renderTargets.forEach(target => target.resize(gl, this.size))
    }

    renderPassBegin(index: PassIndex): { program: ShaderProgram, size: Size } {
        const gl = this.gl
        const passSpec = this.passSpecs[index]
        const { program, output } = passSpec
        output.swap()
        gl.bindFramebuffer(gl.FRAMEBUFFER, output.getWriteFb())

        const attrPosition = program.attrLoc("aPos");
        gl.vertexAttribPointer(attrPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(attrPosition);

        gl.useProgram(program.program)

        if (passSpec.inputs) passSpec.inputs.forEach((input, i) => {
            gl.activeTexture(gl.TEXTURE0 + i)
            gl.bindTexture(gl.TEXTURE_2D, input.getReadTex())
        })

        const outputSize = output.getSize(this.size)
        gl.viewport(0, 0, outputSize[0], outputSize[1])

        return { program, size: outputSize }
    }

    renderPassCommit() {
        const gl = this.gl
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
}
