export const config = {
    mouseSens: 0.001,
    maxMovement: .04,
    hitPathDistance: 0.2,
    hitObstDistance: 0.2,
    hitFinalDistance: 0.2,
    camParams: [Math.PI / 3, .1, 15.],

    baseFloatingSpeed: 0.2,
    floatingParticleCount: 100,
    obsctacleParticleCount: 50000,
    finalDist: 1000,
    maxSpeed: 6,
    movementDampingLog: Math.log(0.02),
    movementPower: 1,

    energySpeedHitPath: 0.3,
    energySpeedHitObst: -10,
    energySpeedNone: -0.1,
    invincibleTime: 3,
    deathPosDrop: 50,

    floatingColor: "ffffff",
    pathColor: "7374FF",
    obstacleColor: "FF9A61",
    finalColor: "ffffff",
}