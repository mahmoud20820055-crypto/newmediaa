import numpy as np, wave, sys
SR = 44100
T = 35.0
N = int(SR * T)
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)
BPM = 100; beat = 60 / BPM
bar = beat * 4

def midi(m): return 440 * 2 ** ((m - 69) / 12)

def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N: return
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    n = min(len(sig), N - i0)
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + n] += sig[:n] * gain * l * 1.414
    R[i0:i0 + n] += sig[:n] * gain * r * 1.414

def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    # vectorised one-pole via lfilter-like loop in chunks
    out = np.empty_like(x)
    for i in range(len(x)):
        s = (1 - a) * x[i] + a * s; out[i] = s
    return out

def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    A = int(a * SR); D = int(d * SR); Rn = int(r * SR)
    A = min(A, n); e[:A] = np.linspace(0, 1, A)
    if A + D < n: e[A:A + D] = np.linspace(1, s, D)
    if Rn > 0: e[-Rn:] *= np.linspace(1, 0, Rn)
    return e

# progression (Am key, luxurious): Fmaj7, G6, Em7, Am9  — one chord per bar
prog = [
    [53, 57, 60, 64],   # Fmaj7
    [55, 59, 62, 64],   # G6
    [52, 55, 59, 62],   # Em7
    [57, 60, 64, 71],   # Am(add9)
]
roots = [41, 43, 40, 45]

# ---------- pad ----------
t_bar = np.arange(int(bar * SR)) / SR
nbars = int(np.ceil(T / bar)) + 1
pad = np.zeros(N + int(bar * SR * 2))
for b in range(nbars):
    ch = prog[b % 4]; seg = np.zeros(len(t_bar) + int(1.2 * SR))
    tt = np.arange(len(seg)) / SR
    for m in ch:
        f = midi(m + 12)
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            seg += 0.5 * np.sin(2 * np.pi * ff * tt) + 0.18 * np.sin(2 * np.pi * 2 * ff * tt + 1) + 0.07 * np.sin(2 * np.pi * 3 * ff * tt)
    e = env_adsr(len(seg), 0.7, 0.5, 0.85, 1.2)
    i0 = int(b * bar * SR)
    pad[i0:i0 + len(seg)] += seg * e
pad = pad[:N] / 12
add(pad, 0, 0.55, -0.15); add(pad * 0.9, 0.013, 0.45, 0.25)

# ---------- bell / pluck arpeggio (8ths) ----------
def bell(f, dur=1.4):
    n = int(dur * SR); tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2.0 * f * tt) * np.exp(-tt * 6)
         + 0.2 * np.sin(2 * np.pi * 3.01 * f * tt) * np.exp(-tt * 9) + 0.08 * np.sin(2 * np.pi * 4.2 * f * tt) * np.exp(-tt * 14))
    e = np.exp(-tt * 3.2); e[:200] *= np.linspace(0, 1, 200)
    return s * e

arp_pattern = [0, 2, 1, 3, 2, 1, 3, 2]
step = beat / 2
k = 0
t = 0.0
while t < T - 1.0:
    b = int(t // bar); ch = prog[b % 4]
    idx = arp_pattern[k % 8]
    note = ch[idx] + 24
    g = 0.16 if t < 2.4 else 0.13
    if 15.8 <= t < 19.6: g = 0.07   # duck under laser section
    add(bell(midi(note)), t, g, 0.35 if k % 2 else -0.35)
    k += 1; t += step

# ---------- bass ----------
for b in range(nbars):
    t0 = b * bar
    if t0 < 2.4 or t0 > T - 1: continue
    f = midi(roots[b % 4] - 12 + 12)
    for hit in (0, 1.5 * beat, 2.5 * beat):
        n = int(beat * 1.2 * SR); tt = np.arange(n) / SR
        s = np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)
        e = env_adsr(n, 0.01, 0.3, 0.6, 0.15)
        add(s * e, t0 + hit, 0.22)

# ---------- drums ----------
def kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 45 + 110 * np.exp(-tt * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 7) + 0.3 * rng.standard_normal(n) * np.exp(-tt * 120)
def snap():
    n = int(0.3 * SR); tt = np.arange(n) / SR
    no = rng.standard_normal(n); no = no - np.concatenate([[0], no[:-1]]) * 0.6
    return no * (np.exp(-tt * 22) + 0.6 * np.exp(-((tt - 0.012) * 300) ** 2)) * 0.5
def hat():
    n = int(0.08 * SR); tt = np.arange(n) / SR
    no = rng.standard_normal(n); no = np.diff(np.concatenate([[0], no]))
    return no * np.exp(-tt * 60)
K, SN, H = kick(), snap(), hat()
b0 = 2.4
nb = int((T - b0) / beat)
for i in range(nb):
    tb = b0 + i * beat
    if tb > 33.0: break
    sec7 = 15.8 <= tb < 19.6
    if not sec7 or i % 2 == 0:
        add(K, tb, 0.55)
    if tb > 5.6 and i % 2 == 1 and not sec7:
        add(SN, tb, 0.28, 0.1)
    if tb > 8.3:
        for j in range(2):
            add(H, tb + j * beat / 2, 0.06 if j else 0.035, -0.4 + 0.8 * (i % 2))

# ---------- transitions: whoosh + impact ----------
def whoosh(dur=0.7):
    n = int(dur * SR); tt = np.arange(n) / SR
    no = rng.standard_normal(n)
    # band-ish sweep: lowpass with rising cutoff approximated by blending
    lp1 = lowpass(no, 600); lp2 = lowpass(no, 4000)
    mix = np.linspace(0, 1, n) ** 2
    s = lp1 * (1 - mix) + lp2 * mix
    e = np.sin(np.pi * np.clip(tt / dur, 0, 1)) ** 2
    return s * e
W = whoosh()
def impact():
    n = int(1.6 * SR); tt = np.arange(n) / SR
    f = 38 + 60 * np.exp(-tt * 10)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.5) + 0.25 * lowpass(rng.standard_normal(n), 900) * np.exp(-tt * 5)
IM = impact()
def shimmer(dur=1.6):
    n = int(dur * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for i, m in enumerate([88, 91, 95, 100, 103]):
        st = int(i * 0.07 * SR); tt2 = tt[: n - st]
        s[st:] += np.sin(2 * np.pi * midi(m) * tt2) * np.exp(-tt2 * 3)
    return s * 0.25
SH = shimmer()

scenes = [0, 2.5, 5.7, 8.3, 10.9, 13.7, 15.8, 19.6, 22.5, 25.2, 28.1, 30.8]
for i, s in enumerate(scenes[1:]):
    add(W, s - 0.45, 0.22, -0.6 if i % 2 else 0.6)
add(SH, 0.15, 0.5); add(SH, 30.9, 0.45)
add(IM, 2.5, 0.55); add(IM, 30.8, 0.5); add(IM, 15.8, 0.35)

# laser zaps for wavelengths
def zap():
    n = int(0.5 * SR); tt = np.arange(n) / SR
    f = 2400 * np.exp(-tt * 9) + 180
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 6) * 0.6
Z = zap(); d = (19.6 - 15.8) / 3
for i in range(3): add(Z, 15.8 + i * d, 0.22, (-0.3, 0, 0.3)[i])
# counter ticks / pops for number counters
for t0 in (6.45, 8.7): add(SH, t0, 0.25)

# ---------- reverb (FFT convolution) ----------
def reverb(x, sec=2.2, wet=0.28):
    n = int(sec * SR); tt = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-tt * 3.0); ir[:int(0.02 * SR)] = 0; ir /= np.sqrt((ir ** 2).sum())
    M = len(x) + n; F = 1 << int(np.ceil(np.log2(M)))
    y = np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[:len(x)]
    return x * (1 - wet) + y * wet * 1.0
L = reverb(L); R = reverb(R * 1.0)

# master: fade in/out, soft clip, normalize
fade_in = int(0.05 * SR); fade_out = int(2.0 * SR)
for ch in (L, R):
    ch[:fade_in] *= np.linspace(0, 1, fade_in)
    ch[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
st = np.stack([L, R], 1)
st /= np.max(np.abs(st)) + 1e-9
st = np.tanh(st * 1.4) / np.tanh(1.4)
st *= 0.89
out = (st * 32767).astype(np.int16)
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok', out.shape)
