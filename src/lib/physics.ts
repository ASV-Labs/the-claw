function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export type Body = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  target: { x: number; y: number } | null;
  lift: number;
  phase: "piled" | "launching" | "seeking";
  fromX: number;
  fromY: number;
  startAt: number;
  rise: number;
  slide: number;
  drift: number;
  asleep: boolean;
  restFrames: number;
  prevX: number;
  prevY: number;
};

export class HeapPhysics {
  radius: number;
  bodies: Body[] = [];
  width = 0;
  height = 0;
  floor = 0;
  left = 0;
  right = 0;
  disturbedAt = 0;
  frozen = false;

  constructor(radius: number) {
    this.radius = radius;
  }

  setBounds(width: number, height: number, floorPad: number, count: number) {
    this.width = width;
    this.height = height;
    this.floor = height - floorPad;
    const span = 2 * this.radius;
    const pile = Math.min(Math.max((count * span) / 4, 12 * span), width - 80);
    this.left = (width - pile) / 2;
    this.right = this.left + pile;
    this.wakeAll();
  }

  seed(ids: string[]) {
    this.disturbedAt = performance.now();
    this.frozen = false;
    const width = this.right - this.left;
    this.bodies = ids.map((id, index) => {
      const t = (index + 0.5) / Math.max(1, ids.length);
      const jitter = (Math.random() - 0.5) * 0.06;
      return {
        id,
        x: this.left + this.radius + Math.min(1, Math.max(0, t + jitter)) * Math.max(1, width - 2 * this.radius),
        y: -(2 * this.radius) - Math.random() * this.height * 0.7,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 2 * Math.random(),
        r: this.radius,
        target: null,
        lift: 0,
        phase: "piled" as const,
        fromX: 0,
        fromY: 0,
        startAt: 0,
        rise: 950,
        slide: 1050,
        drift: 0,
        asleep: false,
        restFrames: 0,
        prevX: 0,
        prevY: 0,
      };
    });
  }

  wakeAll(now = performance.now()) {
    this.disturbedAt = now;
    this.frozen = false;
    for (const body of this.bodies) {
      body.asleep = false;
      body.restFrames = 0;
    }
  }

  setTargets(targets: Map<string, { x: number; y: number }>, now: number) {
    const changed = this.bodies.some((body) => Boolean(body.target) !== targets.has(body.id));
    if (changed) {
      this.disturbedAt = now;
      this.frozen = false;
    }
    for (const body of this.bodies) {
      const target = targets.get(body.id);
      if (target) {
        if (!body.target || body.target.x !== target.x || body.target.y !== target.y) {
          body.fromX = body.x;
          body.fromY = body.y;
          body.startAt = now + (body.target ? 0 : 700 * Math.random());
          const scale = 1 + (2 * Math.random() - 1) * 0.45;
          body.rise = 950 * scale;
          body.slide = 1050 * scale;
          body.drift = (2 * Math.random() - 1) * 26;
          body.phase = "launching";
          body.asleep = false;
          body.restFrames = 0;
          body.vx = 0;
          body.vy = 0;
        }
        body.target = target;
      } else if (body.target) {
        body.target = null;
        body.phase = "piled";
        body.asleep = false;
        body.restFrames = 0;
        body.vx += (Math.random() - 0.5) * 2.5;
        body.vy = Math.max(body.vy, 0.5);
      }
    }
  }

  step(now: number) {
    const { left, right, floor } = this;
    for (const body of this.bodies) {
      body.prevX = body.x;
      body.prevY = body.y;
    }
    for (const body of this.bodies) {
      if (body.target) {
        const elapsed = now - body.startAt;
        if (elapsed < 0) {
          body.lift = Math.min(1, body.lift + 0.05);
          continue;
        }
        const riseT = ease(Math.min(1, elapsed / body.rise));
        const slideT = ease(Math.min(1, Math.max(0, elapsed - 340) / body.slide));
        const drift = body.drift * Math.sin(Math.PI * Math.min(1, slideT));
        body.x = body.fromX + (body.target.x - body.fromX) * slideT + drift;
        body.y = body.fromY + (body.target.y - body.fromY) * riseT;
        body.phase = elapsed >= 340 + body.slide ? "seeking" : "launching";
        body.lift = Math.min(1, body.lift + 0.045);
        continue;
      }
      body.lift = Math.max(0, body.lift - 0.1);
      if (body.asleep) continue;
      body.vy += 0.62;
      body.vx *= 0.986;
      body.vy *= 0.986;
      body.x += body.vx;
      body.y += body.vy;
      if (body.y + body.r > floor) {
        body.y = floor - body.r;
        body.vy *= -0.24;
        body.vx *= 0.9;
        if (Math.abs(body.vy) < 0.6) body.vy = 0;
      }
      if (body.x - body.r < left) {
        body.x = left + body.r;
        body.vx *= -0.42;
      }
      if (body.x + body.r > right) {
        body.x = right - body.r;
        body.vx *= -0.42;
      }
    }
    this.resolveCollisions();
    this.settleSleepers();
    if (!this.frozen) {
      const elapsed = now - this.disturbedAt;
      const piled = this.bodies.filter((body) => !body.target);
      const asleep = piled.filter((body) => body.asleep).length;
      const mostlyAsleep = piled.length > 0 && asleep / piled.length >= 0.75;
      if ((elapsed > 2600 && mostlyAsleep) || elapsed > 5000) {
        for (const body of piled) {
          body.asleep = true;
          body.vx = 0;
          body.vy = 0;
        }
        this.frozen = true;
      }
    }
  }

  settleSleepers() {
    for (const body of this.bodies) {
      if (body.target || body.asleep) continue;
      if (Math.abs(body.x - body.prevX) + Math.abs(body.y - body.prevY) < 0.2) {
        if (++body.restFrames > 10) {
          body.asleep = true;
          body.vx = 0;
          body.vy = 0;
        }
      } else body.restFrames = 0;
    }
  }

  resolveCollisions() {
    const bodies = this.bodies;
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.phase === "launching" || a.phase === "seeking") continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.phase === "launching" || b.phase === "seeking") continue;
          if (a.asleep && b.asleep) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r;
          if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
          const dist2 = dx * dx + dy * dy;
          if (dist2 >= min * min || dist2 === 0) continue;
          const dist = Math.sqrt(dist2);
          const push = (min - dist) / dist;
          const ox = dx * push * 0.5;
          const oy = dy * push * 0.5;
          const moved = Math.abs(ox) + Math.abs(oy);
          if (oy > 0) {
            if (a.vy > 0) a.vy = 0;
          } else if (oy < 0 && b.vy > 0) b.vy = 0;
          if (a.asleep) {
            if (!this.frozen && moved > 0.5) {
              a.asleep = false;
              a.restFrames = 0;
            }
            b.x += 2 * ox;
            b.y += 2 * oy;
            b.vx *= 0.97;
          } else if (b.asleep) {
            if (!this.frozen && moved > 0.5) {
              b.asleep = false;
              b.restFrames = 0;
            }
            a.x -= 2 * ox;
            a.y -= 2 * oy;
            a.vx *= 0.97;
          } else {
            a.x -= ox;
            a.y -= oy;
            b.x += ox;
            b.y += oy;
            a.vx *= 0.97;
            b.vx *= 0.97;
          }
        }
      }
    }
    for (const body of this.bodies) {
      if (body.target || body.asleep) continue;
      if (body.y + body.r > this.floor) body.y = this.floor - body.r;
      if (body.x - body.r < this.left) body.x = this.left + body.r;
      if (body.x + body.r > this.right) body.x = this.right - body.r;
    }
  }
}
