#!/usr/bin/env python3
"""효과음 합성기 — SOUND_SUNO_1024.md §2 목록을 전부 코드로 만든다 (CC0 걱정 없음, 칩튠+폴리 질감).
사용: python3 scripts/sfx_synth.py [out_dir]   → WAV 44.1k 16bit mono. 이후 ffmpeg로 mp3/ogg 변환은 scripts/sfx_build.sh
"""
import sys, os, math, random
import numpy as np
from scipy.io import wavfile
from scipy import signal

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "art/raw/audio/sfx"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def t(sec): return np.arange(int(SR * sec)) / SR
def env(n, a=0.002, d=0.1, s=0.0, r=0.05, hold=0.0):
    """ADSR (초 단위)"""
    A, D, H, R = [int(SR * x) for x in (a, d, hold, r)]
    S = max(n - A - D - H - R, 0)
    e = np.concatenate([np.linspace(0, 1, A), np.linspace(1, s, D), np.full(H, s), np.full(S, s), np.linspace(s, 0, R)])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))
def noise(sec): return rng.uniform(-1, 1, int(SR * sec))
def sine(f, sec, phase=0): return np.sin(2 * np.pi * f * t(sec) + phase)
def square(f, sec, duty=0.5): return np.where((t(sec) * f) % 1 < duty, 1.0, -1.0)
def tri(f, sec): return 2 * np.abs(2 * ((t(sec) * f) % 1) - 1) - 1
def sweep(f0, f1, sec, kind="exp"):
    tt = t(sec)
    f = f0 * (f1 / f0) ** (tt / sec) if kind == "exp" else f0 + (f1 - f0) * tt / sec
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def lp(x, fc, order=2): b, a = signal.butter(order, fc / (SR / 2), "low"); return signal.lfilter(b, a, x)
def hp(x, fc, order=2): b, a = signal.butter(order, fc / (SR / 2), "high"); return signal.lfilter(b, a, x)
def bp(x, lo, hi): b, a = signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band"); return signal.lfilter(b, a, x)
def mix(*parts):
    n = max(len(p) for p in parts); out = np.zeros(n)
    for p in parts: out[:len(p)] += p
    return out
def seq(*parts, gap=0.0):
    """gap<0이면 겹침"""
    out = np.array([]); step = int(SR * gap)
    for p in parts:
        if step >= 0 or len(out) == 0: out = np.concatenate([out, p, np.zeros(max(step, 0))])
        else:
            ov = min(-step, len(out)); head = out[:len(out) - ov]; tail = out[len(out) - ov:]
            m = np.zeros(max(len(tail), len(p))); m[:len(tail)] += tail; m[:len(p)] += p; out = np.concatenate([head, m])
    return out
def pad(x, sec): return np.concatenate([np.zeros(int(SR * sec)), x])
def bits(x, depth=10):  # 살짝 거친 칩튠 질감
    q = 2 ** depth; return np.round(x * q) / q
def save(name, x, gain=0.8):
    x = np.asarray(x, dtype=np.float64)
    if x.size == 0: return
    x = x / (np.max(np.abs(x)) + 1e-9) * gain
    wavfile.write(os.path.join(OUT, name + ".wav"), SR, (x * 32767).astype(np.int16))
    print("  ", name, f"{len(x)/SR:.2f}s")

# ---------------------------------------------------------------- 곡괭이
def pick_dirt(seed):
    rng2 = np.random.default_rng(seed); n = noise(0.18)
    thud = lp(n, 300) * env(len(n), 0.001, 0.08, 0, 0.08)
    crunch = bp(n, 800, 3000) * env(len(n), 0.001, 0.03, 0, 0.05) * 0.5
    return mix(thud * 1.2, crunch, sine(90, 0.12) * env(int(SR * 0.12), 0.001, 0.06))
def pick_rock(seed):
    n = noise(0.25); clank = bp(n, 1800, 6000) * env(len(n), 0.0005, 0.04, 0, 0.12)
    ring = mix(sine(2400, 0.25), sine(3150, 0.25) * 0.6) * env(int(SR * 0.25), 0.001, 0.15, 0, 0.08) * 0.4
    return mix(clank, ring, lp(n, 400) * env(len(n), 0.001, 0.05) * 0.8)
def pick_ore(seed):
    base = pick_rock(seed)
    spark = mix(sine(4200, 0.3), sine(5600, 0.3) * 0.5, sine(7000, 0.3) * 0.3) * env(int(SR * 0.3), 0.001, 0.2, 0, 0.1) * 0.35
    return mix(base, pad(spark, 0.02))
for i in range(1, 4): save(f"sfx_pick_dirt_{i}", pick_dirt(i)); save(f"sfx_pick_rock_{i}", pick_rock(i))
for i in range(1, 3): save(f"sfx_pick_ore_{i}", pick_ore(i))

# ---------------------------------------------------------------- 종·반짝·대박
def bell(f, sec, gain=1.0):
    partials = [(1, 1), (2.76, 0.5), (5.4, 0.25), (8.9, 0.12)]
    return sum(sine(f * r, sec) * g * env(int(SR * sec), 0.001, sec * 0.6, 0.2, sec * 0.3) for r, g in partials) * gain
save("sfx_vein_found", mix(bell(1320, 0.6), pad(bell(1760, 0.5, 0.7), 0.08), pad(sweep(3000, 6000, 0.25) * env(int(SR * 0.25), 0.001, 0.2) * 0.3, 0.05)))
save("sfx_jackpot", mix(bell(880, 1.4), pad(bell(1109, 1.2), 0.12), pad(bell(1319, 1.1), 0.24), pad(bell(1760, 1.6, 0.8), 0.36),
                        pad(sweep(2000, 8000, 0.6) * env(int(SR * 0.6), 0.01, 0.5) * 0.25, 0.3)))
save("sfx_surge", mix(sweep(600, 2400, 0.35) * env(int(SR * 0.35), 0.005, 0.3, 0, 0.05), pad(bell(2400, 0.4, 0.5), 0.3)))

# ---------------------------------------------------------------- 광차·광석
def cart_roll():
    sec = 2.0; n = noise(sec); rumble = lp(n, 180) * 0.8
    click = np.zeros(int(SR * sec))
    for k in np.arange(0, sec, 0.21): i = int(k * SR); click[i:i + 600] += bp(noise(600 / SR), 1500, 4000)[:600] * np.linspace(1, 0, 600) * 0.5
    x = mix(rumble, click); fade = int(SR * 0.05); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade); return x
save("sfx_cart_roll", cart_roll())
def gravel(sec=0.5, count=40, lo=1200, hi=5000):
    x = np.zeros(int(SR * sec))
    for _ in range(count):
        i = int(rng.uniform(0, sec * 0.8) * SR); g = bp(noise(0.03), lo, hi) * env(int(SR * 0.03), 0.001, 0.02); x[i:i + len(g)] += g * rng.uniform(0.3, 1)
    return x
save("sfx_cart_dump", mix(gravel(0.6, 60), lp(noise(0.5), 250) * env(int(SR * 0.5), 0.01, 0.3) * 0.6))
save("sfx_collapse", mix(lp(noise(1.2), 120) * env(int(SR * 1.2), 0.05, 0.9, 0, 0.2) * 1.5, gravel(1.0, 80, 600, 3000) * 0.8))

# ---------------------------------------------------------------- 금화
def coin(f=2200, sec=0.25, gain=1): return mix(sine(f, sec), sine(f * 1.5, sec) * 0.4, sine(f * 2.01, sec) * 0.3) * env(int(SR * sec), 0.001, sec * 0.7, 0, sec * 0.2) * gain
save("sfx_coin_1", seq(coin(2200, 0.18), coin(2900, 0.22), gap=-0.1))
save("sfx_coin_2", seq(coin(2500, 0.15), coin(2000, 0.15), coin(3100, 0.25), gap=-0.08))
save("sfx_coin_big", mix(seq(*[coin(rng.choice([2000, 2400, 2900, 3300]), 0.14, 0.6) for _ in range(9)], gap=-0.07), pad(bell(1047, 1.0, 0.9), 0.5)))

# ---------------------------------------------------------------- 경매
save("sfx_gavel", mix(lp(noise(0.2), 600) * env(int(SR * 0.2), 0.0005, 0.06, 0, 0.1) * 1.5, sine(180, 0.15) * env(int(SR * 0.15), 0.001, 0.1), bp(noise(0.05), 2000, 6000) * env(int(SR * 0.05), 0.0005, 0.03) * 0.5))
save("sfx_stamp", mix(lp(noise(0.25), 350) * env(int(SR * 0.25), 0.001, 0.12, 0, 0.1) * 1.4, sine(120, 0.2) * env(int(SR * 0.2), 0.001, 0.12)))
for i, f in enumerate([520, 660, 820], 1):   # 길드별 피치
    save(f"sfx_bid_{i}", mix(sine(f, 0.12) * env(int(SR * 0.12), 0.001, 0.08), bp(noise(0.06), 1500, 4000) * env(int(SR * 0.06), 0.0005, 0.03) * 0.5))
save("sfx_pass", mix(sweep(900, 500, 0.25) * env(int(SR * 0.25), 0.01, 0.2) * 0.5, bp(noise(0.3), 300, 900) * env(int(SR * 0.3), 0.01, 0.25) * 0.4))

# ---------------------------------------------------------------- 낙하·기절·사건
save("sfx_fall", sweep(1200, 300, 0.4) * env(int(SR * 0.4), 0.01, 0.35) * 0.7)
save("sfx_land", mix(lp(noise(0.3), 250) * env(int(SR * 0.3), 0.001, 0.15, 0, 0.1) * 1.3, gravel(0.3, 20, 800, 3000) * 0.5))
save("sfx_stun", mix(*[pad(square(f, 0.12, 0.3) * env(int(SR * 0.12), 0.001, 0.1) * 0.3, k * 0.1) for k, f in enumerate([1200, 1500, 1800, 1500, 1200, 1500])]))
def water_loop(sec=2.0):
    n = noise(sec); x = bp(n, 300, 1500) * (0.6 + 0.4 * np.sin(2 * np.pi * 2.3 * t(sec))) + bp(n, 1500, 4000) * 0.3
    fade = int(SR * 0.1); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade); return x
save("sfx_water", water_loop())
save("sfx_pump", seq(*[mix(lp(noise(0.12), 500) * env(int(SR * 0.12), 0.001, 0.05, 0, 0.05), sine(200 if k % 2 else 150, 0.1) * env(int(SR * 0.1), 0.001, 0.08)) for k in range(8)], gap=0.25))
save("sfx_gas", (lambda x: (x.__setitem__(slice(0, 2205), x[:2205] * np.linspace(0, 1, 2205)), x)[1])(hp(noise(2.0), 2500) * (0.7 + 0.3 * np.sin(2 * np.pi * 0.7 * t(2.0))) * 0.6))
save("sfx_boom", mix(lp(noise(1.0), 150) * env(int(SR * 1.0), 0.001, 0.6, 0, 0.3) * 2, sweep(200, 40, 0.6) * env(int(SR * 0.6), 0.001, 0.5), gravel(0.8, 50, 500, 2500) * 0.6))
save("sfx_bat", seq(*[bp(noise(0.06), 400, 1500) * env(int(SR * 0.06), 0.005, 0.04) for _ in range(10)], gap=0.03))
save("sfx_slime", mix(sweep(400, 150, 0.3) * env(int(SR * 0.3), 0.01, 0.25) * 0.6, lp(noise(0.3), 800) * env(int(SR * 0.3), 0.02, 0.2) * 0.4))
save("sfx_mole_sniff_1", seq(*[hp(noise(0.07), 1200) * env(int(SR * 0.07), 0.005, 0.05) for _ in range(3)], gap=0.06))
save("sfx_mole_sniff_2", seq(*[hp(noise(0.05), 1500) * env(int(SR * 0.05), 0.005, 0.04) for _ in range(4)], gap=0.05))

# ---------------------------------------------------------------- UI·편지·건설
save("sfx_ui_tap", mix(tri(900, 0.06) * env(int(SR * 0.06), 0.001, 0.05), bp(noise(0.03), 2000, 5000) * env(int(SR * 0.03), 0.0005, 0.02) * 0.4))
save("sfx_ui_open", seq(tri(700, 0.07) * env(int(SR * 0.07), 0.001, 0.06), tri(1050, 0.09) * env(int(SR * 0.09), 0.001, 0.08), gap=-0.02))
save("sfx_ui_close", seq(tri(1050, 0.07) * env(int(SR * 0.07), 0.001, 0.06), tri(700, 0.09) * env(int(SR * 0.09), 0.001, 0.08), gap=-0.02))
save("sfx_ui_error", seq(square(300, 0.1, 0.4) * env(int(SR * 0.1), 0.001, 0.09), square(250, 0.14, 0.4) * env(int(SR * 0.14), 0.001, 0.12), gap=0.02))
save("sfx_letter", mix(bp(noise(0.25), 2000, 6000) * env(int(SR * 0.25), 0.01, 0.2) * 0.4, pad(bell(2093, 0.5, 0.6), 0.15)))
save("sfx_build", mix(seq(*[mix(lp(noise(0.1), 700) * env(int(SR * 0.1), 0.001, 0.05), sine(220, 0.08) * env(int(SR * 0.08), 0.001, 0.06)) for _ in range(3)], gap=0.18), pad(bell(1568, 0.6, 0.7), 0.75)))
_up = seq(tri(660, 0.1), tri(880, 0.1), tri(1320, 0.2), gap=-0.02)
save("sfx_upgrade", mix(_up * env(len(_up), 0.001, 0.3, 0.3, 0.05), pad(bell(2637, 0.4, 0.4), 0.2)))
save("sfx_talent", mix(bp(noise(0.2), 1000, 4000) * env(int(SR * 0.2), 0.02, 0.15) * 0.4, pad(bell(1760, 0.5, 0.6), 0.12)))
save("sfx_welcome", mix(lp(noise(0.3), 500) * env(int(SR * 0.3), 0.01, 0.2) * 0.5, pad(bell(1047, 0.8), 0.25), pad(bell(1319, 0.7, 0.7), 0.4)))

# ---------------------------------------------------------------- 앰비언스 (30초 루프)
def amb_mine():
    sec = 30; x = lp(noise(sec), 120) * 0.25 * (0.8 + 0.2 * np.sin(2 * np.pi * 0.05 * t(sec)))   # 바람
    for _ in range(26):   # 물방울
        i = int(rng.uniform(0, sec - 0.5) * SR); f = rng.uniform(1500, 3200)
        d = sweep(f, f * 0.6, 0.12) * env(int(SR * 0.12), 0.001, 0.1) * rng.uniform(0.2, 0.5); x[i:i + len(d)] += d
    return x
def amb_yard(night):
    sec = 30; x = lp(noise(sec), 400) * 0.15
    if night:
        for k in np.arange(0, sec, 0.6):   # 귀뚜라미
            i = int(k * SR); c = sine(4200, 0.08) * env(int(SR * 0.08), 0.005, 0.06) * 0.25 * (1 if int(k / 0.6) % 7 else 0); x[i:i + len(c)] += c
        x += lp(noise(sec), 300) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 1.7 * t(sec)))) * 0.15   # 모닥불
    else:
        for _ in range(18):   # 새
            i = int(rng.uniform(0, sec - 0.5) * SR); f = rng.uniform(2000, 3500)
            b = seq(sweep(f, f * 1.3, 0.08), sweep(f * 1.2, f * 0.9, 0.1), gap=0.03) * 0.2; b *= env(len(b), 0.005, len(b) / SR * 0.8); x[i:i + len(b)] += b
    fade = int(SR * 0.5); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade); return x
save("amb_mine", amb_mine(), 0.6); save("amb_yard_day", amb_yard(False), 0.6); save("amb_yard_night", amb_yard(True), 0.6)
print("done ->", OUT)
