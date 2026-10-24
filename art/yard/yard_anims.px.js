// 부지 장면 위에 게임이 얹어 돌리는 애니 (yard.px.js 의 _ripple · _fire 는 "_" 부품이라 pxl이 안 내보냄 → 같은 프레임 그대로 이름만 바꿔 내보냄)
include("./yard.px.js")
anim("yard_ripple", { w: 40, h: 224, frames: 4, fps: 3 }, (c) => c.stamp("_ripple", 0, 0, { frame: c.frame }))
anim("yard_fire", { w: 16, h: 16, frames: 6, fps: 8 }, (c) => c.stamp("_fire", 0, 0, { frame: c.frame }))
