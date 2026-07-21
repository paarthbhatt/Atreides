# Responsive QA

Atreides was checked against representative viewport classes before the final hackathon push.

## Viewports covered

| Class | Size | Result |
| --- | ---: | --- |
| Small phone | 360 × 740 | No horizontal overflow |
| Phone | 390 × 844 | No horizontal overflow |
| Tablet | 768 × 1024 | No horizontal overflow |
| Small laptop | 1024 × 768 | No horizontal overflow |
| Desktop | 1440 × 1150 | No horizontal overflow |

## Interaction checks

- The animated workflow renders all 7 policy steps at every tested size.
- Mobile hero actions keep the primary button and secondary link touch-friendly.
- The 3D policy prism scales down on small screens without creating layout overflow.
- Replay, proof, lab, architecture, console, and receipt sections collapse into single-column flows where needed.
- Reduced-motion users keep the same content path without forced animation.

## Verification commands

```bash
npm run typecheck --workspace=@atreides/web
npm run lint --workspace=@atreides/web
npm run build --workspace=@atreides/web
```
