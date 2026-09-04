---
tags: [svg-animation-expert/use-cases]
summary: Request patterns and trigger keywords that indicate when to apply the svg-animation-expert skill for building animation anchor point locator tools.
---

# When to Use This Skill

<request-patterns>
  <pattern type="engine-placement">
    <triggers>engine, thrust, exhaust, flame, ship</triggers>
    <action>Create locator tool to mark engine positions on ship sprites</action>
  </pattern>

  <pattern type="particle-emitters">
    <triggers>particle, emitter, effect, spawn point</triggers>
    <action>Create locator tool to mark particle emission points</action>
  </pattern>

  <pattern type="attachment-points">
    <triggers>attachment, anchor, mount, weapon, turret</triggers>
    <action>Create locator tool to mark attachment coordinates</action>
  </pattern>

  <pattern type="coordinate-debugging">
    <triggers>offset, wrong position, misaligned, coordinates broken</triggers>
    <action>Check for letterboxing, box-sizing, or normalization errors</action>
  </pattern>
</request-patterns>
