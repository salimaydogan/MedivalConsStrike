export function approach(value, target, rate, dt) {
  return value + Math.sign(target - value) * Math.min(Math.abs(target - value), rate * dt);
}

export function turnToward(angle, target, rate, dt) {
  const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return angle + delta * (1 - Math.exp(-rate * dt));
}

export function horseMotion(speed, steering, forward, side, sprint, dt) {
  const target = forward > 0 ? (sprint ? 13 : 7) : forward < 0 ? (speed > .1 ? 0 : -2.2) : 0;
  const braking = !forward || speed * forward < 0;
  const nextSpeed = approach(speed, target, braking ? 10 : 4.5, dt);
  const nextSteering = approach(steering, side, 5, dt);
  const turnRate = 1.85 / (1 + Math.abs(nextSpeed) * .1);
  return { speed: nextSpeed, steering: nextSteering,
    turn: -nextSteering * turnRate * Math.min(Math.abs(nextSpeed) / 1.2, 1) * Math.sign(nextSpeed) * dt };
}
