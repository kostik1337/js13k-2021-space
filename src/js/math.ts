export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t
export const mixFactor = (dt: number, dampingLog: number) => Math.exp(dt * 60 * dampingLog)
// Not so smooth step
export const sstep = (min: number, max: number, t: number) => clamp((t - min) / (max - min), 0, 1)

export type V2 = [number, number]
export type V3 = [number, number, number]
export type V4 = [number, number, number, number]

export const vadd = <T extends number[]>(v1: T, v2: T): T => v1.map((v, i) => v + v2[i]) as T
export const vscale = <T extends number[]>(v1: T, s: number): T => v1.map(v => v * s) as T
export const vpow = <T extends number[]>(v1: T, p: number): T => v1.map(v => Math.pow(v, p)) as T
export const vmix = <T extends number[]>(v1: T, v2: T, t: number): T => v1.map((v, i) => mix(v, v2[i], t)) as T
export const vclamp = <T extends number[]>(v1: T, min: T, max: T): T => v1.map((v, i) => clamp(v, min[i], max[i])) as T

export class Matrix4 {
    constructor(public values: number[]) { }

    static id(): Matrix4 {
        return new Matrix4([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ])
    }

    static rotation(angle: number, coord1: number, coord2: number): Matrix4 {
        const mat = this.id()
        let [c, s] = [Math.cos(angle), Math.sin(angle)]
        mat.set(coord1, coord1, c)
        mat.set(coord1, coord2, s)
        mat.set(coord2, coord1, -s)
        mat.set(coord2, coord2, c)
        return mat
    }

    static perspective(fov: number, aspect: number, near: number, far: number): Matrix4 {
        var f = 1 / Math.tan(fov / 2);
        var rangeInv = 1 / (near - far);
        return new Matrix4([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0
        ]);
    }

    static translate(v: V3): Matrix4 {
        return new Matrix4([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            v[0], v[1], v[2], 1
        ])
    }

    at(row: number, col: number): number {
        return this.values[col * 4 + row]
    }

    set(row: number, col: number, v: number) {
        this.values[col * 4 + row] = v
    }

    mulVec(v: V4): V4 {
        return v.map((val, i) =>
            this.at(i, 0) * v[0] +
            this.at(i, 1) * v[1] +
            this.at(i, 2) * v[2] +
            this.at(i, 3) * v[3]
        ) as V4
    }

    mul(m: Matrix4): Matrix4 {
        const mulRowCol = (row: number, col: number): number =>
            this.at(row, 0) * m.at(0, col) +
            this.at(row, 1) * m.at(1, col) +
            this.at(row, 2) * m.at(2, col) +
            this.at(row, 3) * m.at(3, col)

        return new Matrix4([...Array(16)].map((v, i) => mulRowCol(i % 4, Math.floor(i / 4))))
    }

    invert(): Matrix4 {
        let res = [];

        let [n11, n21, n31, n41,
            n12, n22, n32, n42,
            n13, n23, n33, n43,
            n14, n24, n34, n44] = this.values

        res[0] = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
        res[4] = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
        res[8] = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
        res[12] = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
        res[1] = n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44;
        res[5] = n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44;
        res[9] = n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44;
        res[13] = n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34;
        res[2] = n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44;
        res[6] = n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44;
        res[10] = n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44;
        res[14] = n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34;
        res[3] = n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43;
        res[7] = n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43;
        res[11] = n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43;
        res[15] = n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33;

        let determinant = n11 * res[0] + n21 * res[4] + n31 * res[8] + n41 * res[12];

        if (determinant === 0) {
            throw new Error("Can't invert matrix, determinant is 0");
        }

        for (let i = 0; i < res.length; i++) {
            res[i] /= determinant;
        }

        return new Matrix4(res);
    }
}

// // Most of this stuff taken from https://github.com/infusion/Quaternion.js/
// export class Quat {
//     constructor(
//         public w: number,
//         public x: number,
//         public y: number,
//         public z: number,
//     ) { }

//     // Get quaternion from rotation around axis. Axis should be normalized
//     static fromAxisRotation(angle: number, axis: V3): Quat {
//         let [c, s] = [Math.cos(angle / 2), Math.sin(angle / 2)]
//         return new Quat(c, axis.x * s, axis.y * s, axis.z * s)
//     }

//     static idRotation(): Quat {
//         return this.fromAxisRotation(0, new V3(1, 0, 0));
//     }

//     lenSq(): number { return this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z; }

//     normalize() {
//         let lenInv = 1. / Math.sqrt(this.lenSq())
//         this.w *= lenInv
//         this.x *= lenInv
//         this.y *= lenInv
//         this.z *= lenInv
//     }

//     // Multiply this quaternion with another, this*q
//     mul(q: Quat): Quat {
//         const [w1, x1, y1, z1] = [this.w, this.x, this.y, this.z]
//         const [w2, x2, y2, z2] = [q.w, q.x, q.y, q.z]

//         return new Quat(
//             w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
//             w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
//             w1 * y2 + y1 * w2 + z1 * x2 - x1 * z2,
//             w1 * z2 + z1 * w2 + x1 * y2 - y1 * x2);
//     }

//     // Conjugate of quaternion
//     conj(): Quat {
//         return new Quat(this.w, -this.x, -this.y, -this.z)
//     }

//     // Rotate vector with this quaternion
//     rotateVector(v: V3): V3 {
//         let vq = new Quat(0, v.x, v.y, v.z);
//         vq = this.conj().mul(vq).mul(this)
//         return new V3(vq.x, vq.y, vq.z)
//     }

//     toMatrix(): Matrix4 {
//         const [w, x, y, z] = [this.w, this.x, this.y, this.z]

//         let n = w * w + x * x + y * y + z * z;
//         let s = n === 0 ? 0 : 2 / n;
//         let wx = s * w * x, wy = s * w * y, wz = s * w * z;
//         let xx = s * x * x, xy = s * x * y, xz = s * x * z;
//         let yy = s * y * y, yz = s * y * z, zz = s * z * z;

//         return new Matrix4([
//             1 - (yy + zz), xy - wz, xz + wy, 0,
//             xy + wz, 1 - (xx + zz), yz - wx, 0,
//             xz - wy, yz + wx, 1 - (xx + yy), 0,
//             0, 0, 0, 1
//         ]);
//     }

//     slerp(q: Quat, pct: number) {
//         let [w1, x1, y1, z1] = [this.w, this.x, this.y, this.z];
//         let [w2, x2, y2, z2] = [q.w, q.x, q.y, q.z];

//         let cosTheta0 = w1 * w2 + x1 * x2 + y1 * y2 + z1 * z2;

//         if (cosTheta0 < 0) {
//             w1 = -w1;
//             x1 = -x1;
//             y1 = -y1;
//             z1 = -z1;
//             cosTheta0 = -cosTheta0;
//         }

//         if (cosTheta0 > 0.9995) { // DOT_THRESHOLD
//             const res = new Quat(
//                 w1 + pct * (w2 - w1),
//                 x1 + pct * (x2 - x1),
//                 y1 + pct * (y2 - y1),
//                 z1 + pct * (z2 - z1))
//             res.normalize()
//             return res;
//         }

//         let Theta0 = Math.acos(cosTheta0);
//         let sinTheta0 = Math.sin(Theta0);

//         let Theta = Theta0 * pct;
//         let [sinTheta, cosTheta] = [Math.sin(Theta), Math.cos(Theta)];

//         let [s0, s1] = [cosTheta - cosTheta0 * sinTheta / sinTheta0, sinTheta / sinTheta0];

//         return new Quat(
//             s0 * w1 + s1 * w2,
//             s0 * x1 + s1 * x2,
//             s0 * y1 + s1 * y2,
//             s0 * z1 + s1 * z2);
//     }

//     toString() {
//         return `scalar = ${this.w.toFixed(2)}, v = [${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.z.toFixed(2)}]`;
//     }
// }