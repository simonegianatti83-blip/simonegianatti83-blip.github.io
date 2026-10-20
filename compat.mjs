/* Compatibilità per il lettore PDF su iPhone/iPad e browser meno recenti.
   Aggiunge solo ciò che manca; se il browser ha già la funzione, usa la sua. */
const def = (obj, name, fn) => { if (obj && typeof obj[name] !== "function")
  Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); };

def(Promise, "withResolvers", function () {
  let resolve, reject; const promise = new this((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
});
def(Promise, "try", function (fn, ...args) { return new this(r => r(fn(...args))); });

for (const M of [Map, WeakMap]) {
  def(M.prototype, "getOrInsert", function (k, v) { if (!this.has(k)) this.set(k, v); return this.get(k); });
  def(M.prototype, "getOrInsertComputed", function (k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k); });
}
def(Math, "sumPrecise", function (it) { let s = 0; for (const x of it) s += x; return s; });

def(Uint8Array.prototype, "toBase64", function () {
  let s = ""; for (let i = 0; i < this.length; i += 0x8000) s += String.fromCharCode.apply(null, this.subarray(i, i + 0x8000));
  return btoa(s);
});
def(Uint8Array, "fromBase64", function (b64) {
  const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u;
});
if (typeof Response !== "undefined")
  def(Response.prototype, "bytes", async function () { return new Uint8Array(await this.arrayBuffer()); });

if (typeof globalThis.Iterator === "undefined") {
  const IterProto = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
  function Iterator() {} Iterator.prototype = IterProto; globalThis.Iterator = Iterator;
}
