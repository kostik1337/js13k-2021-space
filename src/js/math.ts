export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
export const mix = (a: number, b: number, t: number) => a * (1 - t) + b * t
export const mixFactor = (dt: number, dampingLog: number) => Math.exp(dt * 60 * dampingLog)

export class V3 {
    constructor(
        public x: number,
        public y: number,
        public z: number
    ) { }

    static zero(): V3 { return new V3(0, 0, 0) }

    public static RIGHT: V3 = new V3(1, 0, 0)
    public static UP: V3 = new V3(0, 1, 0)
    public static FORWARD: V3 = new V3(0, 0, 1)

    add(v: V3): V3 {
        return new V3(this.x + v.x, this.y + v.y, this.z + v.z)
    }

    sub(v: V3): V3 {
        return new V3(this.x - v.x, this.y - v.y, this.z - v.z)
    }

    dot(v: V3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    cross(v: V3): V3 {
        return new V3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x
        )
    }

    scale(s: number) {
        return new V3(this.x * s, this.y * s, this.z * s)
    }

    lenSq(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }

    len(): number { return Math.sqrt(this.lenSq()) }

    mix(other: V3, factor: number): V3 {
        return this.scale(1 - factor).add(other.scale(factor))
    }

    normalize() {
        let lenInv = 1. / this.len()
        this.x *= lenInv
        this.y *= lenInv
        this.z *= lenInv
    }

    toString() {
        return `[${this.x.toFixed(2)}, ${this.y.toFixed(2)}, ${this.z.toFixed(2)}]`;
    }

    clone() { return new V3(this.x, this.y, this.z) }
}

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

    static translate(x: number, y: number, z: number): Matrix4 {
        return new Matrix4([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ])
    }

    at(row: number, col: number): number {
        return this.values[col * 4 + row]
    }

    set(row: number, col: number, v: number) {
        this.values[col * 4 + row] = v
    }

    mul(m: Matrix4): Matrix4 {
        const mulRowCol = (row: number, col: number): number =>
            this.at(row, 0) * m.at(0, col) +
            this.at(row, 1) * m.at(1, col) +
            this.at(row, 2) * m.at(2, col) +
            this.at(row, 3) * m.at(3, col)

        return new Matrix4([...Array(16)].map((v, i) => mulRowCol(i % 4, Math.floor(i / 4))))
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