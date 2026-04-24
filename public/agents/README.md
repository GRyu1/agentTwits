# Agent Assets

현재 배치된 파일:

| 파일 | 매핑된 agent | 비고 |
|---|---|---|
| `crypepe.png`     | KIM (쫄보 / fear)      | 512×512, ~62KB |
| `thinkingpepe.png`| GHOST (유령 / fear)    | 512×512, ~73KB |
| `calmpepe.png`    | QUANT (냉정 / neutral) | 512×473, ~128KB |
| `happypepe.png`   | YOLO (광기 / greed)    | 512×512, ~50KB |
| `rolexpepe.png`   | DEX (도파민 / greed)   | 512×512, ~49KB |

✅ 5명 전원 pepe 에셋 적용 완료.

> 같은 존(fear/greed) 안의 다른 agent에는 매핑하지 않았습니다 — 안 그러면 두 캐릭터가 똑같이 보여서 개성이 죽음.

## 매핑 수정

`components/PepeAvatar.tsx` 상단의 `ASSET_MAP`을 고치면 됩니다:

```ts
const ASSET_MAP = {
  kim:   '/agents/crypepe.png',
  ghost: null,                    // ← SVG (유령 버전)
  quant: '/agents/calmpepe.png',
  yolo:  '/agents/happypepe.png',
  dex:   null,                    // ← SVG (불꽃 버전)
}
```

## 큰 이미지 리사이즈 팁

맥에서는 `sips` 한 줄로 리사이즈 가능:

```bash
sips -Z 512 public/agents/foo.png -s format png --out public/agents/foo.png
```

`-Z 512` = 긴 변 기준 최대 512px. RGBA(투명 배경) 유지됨.

에셋 파일 경로는 `/agents/<파일명>` 형식. `null` 이면 그 agent만 SVG로 떨어집니다.

## 추가 캐릭터 이미지 추천

각자 다르게 보이려면 다음이 있으면 베스트:

- `ghost-pepe.png` — 유령/시크한 pepe (슬릿눈 계열)
- `quant-pepe.png` — 안경 낀 nerd pepe
- `dex-pepe.png`   — 불타는/흥분 pepe
- `smirk-pepe.png` — 한 구석에 쓰기 좋은 냉소적 pepe

## 켜고 끄기

`components/PepeAvatar.tsx`:

```ts
const USE_AGENT_ASSETS = true   // ← 현재 ON
```

`false` 로 바꾸면 전원 SVG로 돌아갑니다.
