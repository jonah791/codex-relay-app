const http = require('http');
const https = require('https');
const { randomUUID } = require('crypto');

function start(port, upstream, apiKey, modelMap) {
  if (!upstream || !upstream.startsWith('http')) throw new Error('Invalid upstream URL');

  const reverseMap = {};
  for (const [k, v] of Object.entries(modelMap)) {
    if (!reverseMap[v]) reverseMap[v] = k;
  }

  const upUrl = new URL(upstream);
  const upTransport = upUrl.protocol === 'https:' ? https : http;
  const fallUrl = new URL('https://api.openai.com/v1');
  const fallTransport = fallUrl.protocol === 'https:' ? https : http;

  function mapUp(m) { return modelMap[m] || m; }
  function mapDown(m) { return reverseMap[m] || m; }

  function reqUp(method, path, headers, body, authKey) {
    const url = authKey ? upUrl : fallUrl;
    const t = authKey ? upTransport : fallTransport;
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}),
          ...headers,
        },
      };
      const r = t.request(opts, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on('error', reject);
      });
      r.on('error', reject);
      if (body) {
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        if (!r.write(payload)) r.once('drain', () => r.end());
        else r.end();
      } else r.end();
    });
  }

  function responsesToChat(req) {
    const messages = [];
    const system = req.instructions || req.system;
    if (system) messages.push({ role: 'system', content: system });
    if (typeof req.input === 'string') {
      messages.push({ role: 'user', content: req.input });
    } else if (Array.isArray(req.input)) {
      let i = 0;
      while (i < req.input.length) {
        const item = req.input[i];
        const type = item.type || '';
        if (type === 'function_call') {
          const tcs = [];
          while (i < req.input.length && req.input[i].type === 'function_call') {
            const c = req.input[i];
            tcs.push({
              id: c.call_id || '', type: 'function',
              function: { name: c.name || '', arguments: c.arguments || '{}' }
            });
            i++;
          }
          messages.push({ role: 'assistant', tool_calls: tcs });
        } else if (type === 'function_call_output') {
          messages.push({ role: 'tool', content: item.output || '', tool_call_id: item.call_id || '' });
          i++;
        } else {
          const role = (item.role === 'developer' || item.role === 'system') ? 'system' : (item.role || 'user');
          let content = '';
          if (typeof item.content === 'string') content = item.content;
          else if (Array.isArray(item.content)) content = item.content.map(c => c.text || '').join('');
          messages.push({ role, content });
          i++;
        }
      }
    }
    const tools = (req.tools || [])
      .filter(t => t.type === 'function')
      .map(t => t.function ? t : { type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } });
    return {
      model: mapUp(req.model),
      messages,
      ...(tools.length ? { tools } : {}),
      ...(req.temperature != null ? { temperature: req.temperature } : {}),
      ...(req.max_output_tokens != null ? { max_tokens: req.max_output_tokens } : {}),
      stream: !!req.stream,
    };
  }

  function chatToResponse(id, model, cr) {
    const choice = (cr.choices || [])[0] || { message: { role: 'assistant', content: '' } };
    const msg = choice.message || {};
    const usage = cr.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const output = [];

    // text content
    output.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: msg.content || '' }] });

    // tool calls
    if (msg.tool_calls && msg.tool_calls.length) {
      for (const tc of msg.tool_calls) {
        output.push({
          type: 'function_call', id: tc.id, call_id: tc.id,
          name: tc.function?.name || '', arguments: tc.function?.arguments || '{}',
          status: 'completed',
        });
      }
    }

    return {
      id, object: 'response', model: mapDown(model),
      output,
      usage: { input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0, total_tokens: usage.total_tokens || 0 },
    };
  }

  function sseEncoder() {
    let rid, oi = 0, ci = 0, started = false, tcAcc = new Map();
    let buf = ''; // accumulate partial lines across chunks

    function line(ev, data) { return (ev ? `event: ${ev}\r\n` : '') + `data: ${JSON.stringify(data)}\r\n\r\n`; }

    function* process(chunkText) {
      buf += chunkText;
      const lines = buf.split('\n');
      buf = lines.pop(); // keep incomplete last line in buffer

      for (const ln of lines) {
        if (!ln.startsWith('data: ')) continue;
        const ds = ln.substring(6).trim();
        if (ds === '[DONE]') {
          if (started) {
            yield line('', { type: 'response.content_part.done', output_index: oi, item_id: rid + '_msg', content_index: ci, part: { type: 'output_text', text: '' } });
            yield line('', { type: 'response.output_item.done', output_index: oi, item: { id: rid + '_msg', type: 'message', role: 'assistant', status: 'completed' } });
            yield line('', { type: 'response.completed', response: { id: rid, object: 'response', status: 'completed' } });
          }
          continue;
        }
        let obj; try { obj = JSON.parse(ds); } catch { continue; }
        const choice = (obj.choices || [])[0]; if (!choice) continue;
        const delta = choice.delta || {};
        if (!started) {
          rid = 'resp_' + randomUUID().replace(/-/g, '').substring(0, 32);
          started = true;
          const mdl = mapDown(obj.model || '');
          yield line('', { type: 'response.created', response: { id: rid, object: 'response', model: mdl, status: 'in_progress' } });
          yield line('', { type: 'response.output_item.added', output_index: oi, item: { id: rid + '_msg', type: 'message', role: 'assistant', status: 'in_progress', content: [] } });
          yield line('', { type: 'response.content_part.added', output_index: oi, item_id: rid + '_msg', content_index: ci, part: { type: 'output_text', text: '' } });
        }
        if (delta.content) {
          yield line('', { type: 'response.output_text.delta', output_index: oi, content_index: ci, delta: delta.content });
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!tcAcc.has(idx)) tcAcc.set(idx, { id: tc.id || '', name: tc.function?.name || '', args: '' });
            const acc = tcAcc.get(idx);
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (tc.function?.arguments) acc.args += tc.function.arguments;
          }
        }
        if (choice.finish_reason === 'tool_calls' && tcAcc.size) {
          for (const [idx, acc] of tcAcc) {
            const iid = rid + '_tool_' + idx;
            yield line('', { type: 'response.output_item.added', output_index: idx, item: { id: iid, type: 'function_call', name: acc.name, arguments: acc.args, status: 'in_progress' } });
            yield line('', { type: 'response.function_call_arguments.done', output_index: idx, arguments: acc.args });
            yield line('', { type: 'response.output_item.done', output_index: idx, item: { id: iid, type: 'function_call', name: acc.name, arguments: acc.args, status: 'completed' } });
          }
          yield line('', { type: 'response.completed', response: { id: rid, object: 'response', status: 'completed' } });
        }
      }
    }
    return { process };
  }

  function streamUp(method, path, headers, body, authKey, onChunk, onEnd, onError) {
    const url = authKey ? upUrl : fallUrl;
    const t = authKey ? upTransport : fallTransport;
    const opts = {
      hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + path, method,
      headers: { 'Content-Type': 'application/json', ...(authKey ? { Authorization: `Bearer ${authKey}` } : {}), ...headers },
    };
    let ended = false;
    const r = t.request(opts, (res) => {
      res.on('data', onChunk);
      res.on('end', () => { if (!ended) { ended = true; onEnd(); } });
    });
    r.on('error', (e) => { if (!ended) { ended = true; onError(e); } });
    r.write(JSON.stringify(body));
    r.end();
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/v1/models') {
        const r = await reqUp('GET', '/models', {}, null, apiKey);
        try {
          const j = JSON.parse(r.body.toString());
          if (j.data) {
            j.data = j.data.map(m => ({ ...m, id: mapDown(m.id) }));
            for (const [cm] of Object.entries(modelMap))
              if (!j.data.find(m => m.id === cm)) j.data.push({ id: cm, object: 'model', created: 1, owned_by: 'opencode' });
          }
          res.writeHead(r.status, { 'content-type': 'application/json' });
          res.end(JSON.stringify(j));
        } catch {
          res.writeHead(r.status, { 'content-type': 'application/json' });
          res.end(r.body);
        }
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/responses') {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', async () => {
          try {
            const rj = JSON.parse(body);
            const cr = responsesToChat(rj);
            if (rj.stream) {
              res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
              const enc = sseEncoder();
              streamUp('POST', '/chat/completions', { Accept: 'text/event-stream' }, cr, apiKey,
                d => { for (const l of enc.process(d.toString())) res.write(l); },
                () => { if (!res.writableEnded) res.end(); },
                e => { if (!res.writableEnded) { res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`); res.end(); } }
              );
            } else {
              const r = await reqUp('POST', '/chat/completions', {}, cr, apiKey);
              try {
                const cResp = JSON.parse(r.body.toString());
                const result = chatToResponse('resp_' + randomUUID().replace(/-/g, '').substring(0, 32), cr.model, cResp);
                res.writeHead(r.status, { 'content-type': 'application/json' });
                res.end(JSON.stringify(result));
              } catch { res.writeHead(r.status, { 'content-type': 'application/json' }); res.end(r.body); }
            }
          } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
        });
        return;
      }
      const ea = req.headers.authorization;
      const r = await reqUp(req.method, req.url.replace('/v1', ''), ea ? { authorization: ea } : {}, null, null);
      res.writeHead(r.status, r.headers);
      res.end(r.body);
    } catch (e) { res.writeHead(502); res.end(JSON.stringify({ error: e.message })); }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

module.exports = { start };
