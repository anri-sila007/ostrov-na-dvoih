const K = 'sb_publishable_Wgw3zEVYG34kbdBAgmvRqA_SxE20v1A';
const ON_PAGES = location.hostname.endsWith('github.io');
const TURN = ON_PAGES ? 'https://ostrov.metered.live/api/v1/turn/credentials?apiKey=b238e6eca0ff443a68ac7a160a0e97976021' : './turn';
const list = document.getElementById('list');
document.getElementById('ua').textContent = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC · ' + navigator.userAgent;
const row = (name) => { const r = document.createElement('div'); r.className = 'row'; r.innerHTML = '<span class="st">⏳</span><span class="nm"></span><span class="ms"></span>'; r.querySelector('.nm').textContent = name; list.append(r); return (ok, note) => { r.querySelector('.st').textContent = ok ? '✅' : '❌'; r.querySelector('.ms').textContent = note; return ok; }; };
const timed = async (fn) => { const t0 = performance.now(); try { const v = await fn(); return [true, Math.round(performance.now() - t0) + ' мс', v]; } catch (e) { return [false, (e.name === 'AbortError' ? 'нет ответа 12 с' : e.message).slice(0, 60)]; } };
const get = (url, opt = {}) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), 12000); return fetch(url, { ...opt, signal: c.signal, cache: 'no-store' }).then(async (r) => { clearTimeout(t); if (!r.ok) throw new Error('код ' + r.status); return r.json().catch(() => null); }); };
const rpc = { method: 'POST', headers: { apikey: K, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_id: '00000000-0000-4000-8000-000000000000', p_key: 'x' }) };
(async () => {
  const res = {};
  let ok, note;
  if (!ON_PAGES) { [ok, note] = await timed(() => get('./sb/rest/v1/rpc/load_island', rpc)); res.proxy = row('Сервер островов через сайт')(ok, note); }
  [ok, note] = await timed(() => get('https://ukpdhvxncbudtcztspjm.supabase.co/rest/v1/rpc/load_island', rpc)); res.direct = row('Сервер островов напрямую')(ok, note);
  let turn = null;
  [ok, note, turn] = await timed(() => get(TURN)); res.turn = row('Пароли ретранслятора')(ok, note);
  // WebRTC: адреса ретранслятора и соединение только через ретранслятор
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }, ...((Array.isArray(turn) && turn) || [])];
  const mk = row('Адреса для соединения');
  const types = {};
  try {
    const pc = new RTCPeerConnection({ iceServers: servers });
    pc.createDataChannel('t');
    await new Promise(async (resolve) => { pc.onicecandidate = (e) => { if (!e.candidate) return resolve(); const m = e.candidate.candidate.match(/typ (\w+)/); if (m) types[m[1]] = (types[m[1]] || 0) + 1; }; await pc.setLocalDescription(await pc.createOffer()); setTimeout(resolve, 9000); });
    pc.close();
    res.relayCand = mk(!!types.relay, Object.entries(types).map(([k, v]) => k + ':' + v).join(' ') || 'нет');
  } catch (e) { res.relayCand = mk(false, e.message); }
  const rl = row('Связь через ретранслятор');
  if (Array.isArray(turn)) {
    const cfg = { iceServers: turn, iceTransportPolicy: 'relay' };
    [ok, note] = await timed(async () => {
      const a = new RTCPeerConnection(cfg), b = new RTCPeerConnection(cfg);
      a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
      b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);
      const ch = a.createDataChannel('g');
      await a.setLocalDescription(await a.createOffer()); await b.setRemoteDescription(a.localDescription);
      await b.setLocalDescription(await b.createAnswer()); await a.setRemoteDescription(b.localDescription);
      await new Promise((r, j) => { ch.onopen = r; setTimeout(() => j(new Error('не соединилось за 15 с')), 15000); });
      a.close(); b.close();
    });
    res.relay = rl(ok, note);
  } else res.relay = rl(false, 'нет паролей');
  const s = document.getElementById('sum');
  const server = ON_PAGES ? res.direct : res.proxy;
  if (server && res.relay) s.textContent = '✅ Всё в порядке: игра должна работать.';
  else if (!server) s.textContent = '❌ Сервер островов недоступен из вашей сети.';
  else if (!res.relay) s.textContent = '❌ Ретранслятор недоступен из вашей сети — соединиться с партнёром не получится.';
  else s.textContent = '⚠️ Есть проблемы — пришлите скриншот.';
})();
