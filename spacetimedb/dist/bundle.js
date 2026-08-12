import * as _syscalls2_0 from "spacetime:sys@2.0";
import { moduleHooks } from "spacetime:sys@2.0";
import * as _syscalls2_1 from "spacetime:sys@2.1";

//#region node_modules/headers-polyfill/lib/index.mjs
var __create$1 = Object.create;
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __getOwnPropNames$1 = Object.getOwnPropertyNames;
var __getProtoOf$1 = Object.getPrototypeOf;
var __hasOwnProp$1 = Object.prototype.hasOwnProperty;
var __commonJS$1 = (cb, mod) => function __require() {
	return mod || (0, cb[__getOwnPropNames$1(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps$1 = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (let key of __getOwnPropNames$1(from)) if (!__hasOwnProp$1.call(to, key) && key !== except) __defProp$1(to, key, {
			get: () => from[key],
			enumerable: !(desc = __getOwnPropDesc$1(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM$1 = (mod, isNodeMode, target) => (target = mod != null ? __create$1(__getProtoOf$1(mod)) : {}, __copyProps$1(isNodeMode || !mod || !mod.__esModule ? __defProp$1(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var import_set_cookie_parser = __toESM$1(__commonJS$1({ "node_modules/set-cookie-parser/lib/set-cookie.js"(exports, module) {
	"use strict";
	var defaultParseOptions = {
		decodeValues: true,
		map: false,
		silent: false
	};
	function isNonEmptyString(str) {
		return typeof str === "string" && !!str.trim();
	}
	function parseString(setCookieValue, options) {
		var parts = setCookieValue.split(";").filter(isNonEmptyString);
		var parsed = parseNameValuePair(parts.shift());
		var name = parsed.name;
		var value = parsed.value;
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		try {
			value = options.decodeValues ? decodeURIComponent(value) : value;
		} catch (e) {
			console.error("set-cookie-parser encountered an error while decoding a cookie with value '" + value + "'. Set options.decodeValues to false to disable this feature.", e);
		}
		var cookie = {
			name,
			value
		};
		parts.forEach(function(part) {
			var sides = part.split("=");
			var key = sides.shift().trimLeft().toLowerCase();
			var value2 = sides.join("=");
			if (key === "expires") cookie.expires = new Date(value2);
			else if (key === "max-age") cookie.maxAge = parseInt(value2, 10);
			else if (key === "secure") cookie.secure = true;
			else if (key === "httponly") cookie.httpOnly = true;
			else if (key === "samesite") cookie.sameSite = value2;
			else cookie[key] = value2;
		});
		return cookie;
	}
	function parseNameValuePair(nameValuePairStr) {
		var name = "";
		var value = "";
		var nameValueArr = nameValuePairStr.split("=");
		if (nameValueArr.length > 1) {
			name = nameValueArr.shift();
			value = nameValueArr.join("=");
		} else value = nameValuePairStr;
		return {
			name,
			value
		};
	}
	function parse(input, options) {
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		if (!input) if (!options.map) return [];
		else return {};
		if (input.headers) if (typeof input.headers.getSetCookie === "function") input = input.headers.getSetCookie();
		else if (input.headers["set-cookie"]) input = input.headers["set-cookie"];
		else {
			var sch = input.headers[Object.keys(input.headers).find(function(key) {
				return key.toLowerCase() === "set-cookie";
			})];
			if (!sch && input.headers.cookie && !options.silent) console.warn("Warning: set-cookie-parser appears to have been called on a request object. It is designed to parse Set-Cookie headers from responses, not Cookie headers from requests. Set the option {silent: true} to suppress this warning.");
			input = sch;
		}
		if (!Array.isArray(input)) input = [input];
		options = options ? Object.assign({}, defaultParseOptions, options) : defaultParseOptions;
		if (!options.map) return input.filter(isNonEmptyString).map(function(str) {
			return parseString(str, options);
		});
		else return input.filter(isNonEmptyString).reduce(function(cookies2, str) {
			var cookie = parseString(str, options);
			cookies2[cookie.name] = cookie;
			return cookies2;
		}, {});
	}
	function splitCookiesString2(cookiesString) {
		if (Array.isArray(cookiesString)) return cookiesString;
		if (typeof cookiesString !== "string") return [];
		var cookiesStrings = [];
		var pos = 0;
		var start;
		var ch;
		var lastComma;
		var nextStart;
		var cookiesSeparatorFound;
		function skipWhitespace() {
			while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) pos += 1;
			return pos < cookiesString.length;
		}
		function notSpecialChar() {
			ch = cookiesString.charAt(pos);
			return ch !== "=" && ch !== ";" && ch !== ",";
		}
		while (pos < cookiesString.length) {
			start = pos;
			cookiesSeparatorFound = false;
			while (skipWhitespace()) {
				ch = cookiesString.charAt(pos);
				if (ch === ",") {
					lastComma = pos;
					pos += 1;
					skipWhitespace();
					nextStart = pos;
					while (pos < cookiesString.length && notSpecialChar()) pos += 1;
					if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
						cookiesSeparatorFound = true;
						pos = nextStart;
						cookiesStrings.push(cookiesString.substring(start, lastComma));
						start = pos;
					} else pos = lastComma + 1;
				} else pos += 1;
			}
			if (!cookiesSeparatorFound || pos >= cookiesString.length) cookiesStrings.push(cookiesString.substring(start, cookiesString.length));
		}
		return cookiesStrings;
	}
	module.exports = parse;
	module.exports.parse = parse;
	module.exports.parseString = parseString;
	module.exports.splitCookiesString = splitCookiesString2;
} })());
var HEADERS_INVALID_CHARACTERS = /[^a-z0-9\-#$%&'*+.^_`|~]/i;
function normalizeHeaderName(name) {
	if (HEADERS_INVALID_CHARACTERS.test(name) || name.trim() === "") throw new TypeError("Invalid character in header field name");
	return name.trim().toLowerCase();
}
var charCodesToRemove = [
	String.fromCharCode(10),
	String.fromCharCode(13),
	String.fromCharCode(9),
	String.fromCharCode(32)
];
var HEADER_VALUE_REMOVE_REGEXP = new RegExp(`(^[${charCodesToRemove.join("")}]|$[${charCodesToRemove.join("")}])`, "g");
function normalizeHeaderValue(value) {
	return value.replace(HEADER_VALUE_REMOVE_REGEXP, "");
}
function isValidHeaderName(value) {
	if (typeof value !== "string") return false;
	if (value.length === 0) return false;
	for (let i = 0; i < value.length; i++) {
		const character = value.charCodeAt(i);
		if (character > 127 || !isToken(character)) return false;
	}
	return true;
}
function isToken(value) {
	return ![
		127,
		32,
		"(",
		")",
		"<",
		">",
		"@",
		",",
		";",
		":",
		"\\",
		"\"",
		"/",
		"[",
		"]",
		"?",
		"=",
		"{",
		"}"
	].includes(value);
}
function isValidHeaderValue(value) {
	if (typeof value !== "string") return false;
	if (value.trim() !== value) return false;
	for (let i = 0; i < value.length; i++) {
		const character = value.charCodeAt(i);
		if (character === 0 || character === 10 || character === 13) return false;
	}
	return true;
}
var NORMALIZED_HEADERS = Symbol("normalizedHeaders");
var RAW_HEADER_NAMES = Symbol("rawHeaderNames");
var HEADER_VALUE_DELIMITER = ", ";
var _a, _b, _c;
var Headers = class _Headers {
	constructor(init) {
		this[_a] = {};
		this[_b] = /* @__PURE__ */ new Map();
		this[_c] = "Headers";
		if (["Headers", "HeadersPolyfill"].includes(init?.constructor.name) || init instanceof _Headers || typeof globalThis.Headers !== "undefined" && init instanceof globalThis.Headers) init.forEach((value, name) => {
			this.append(name, value);
		}, this);
		else if (Array.isArray(init)) init.forEach(([name, value]) => {
			this.append(name, Array.isArray(value) ? value.join(HEADER_VALUE_DELIMITER) : value);
		});
		else if (init) Object.getOwnPropertyNames(init).forEach((name) => {
			const value = init[name];
			this.append(name, Array.isArray(value) ? value.join(HEADER_VALUE_DELIMITER) : value);
		});
	}
	[(_a = NORMALIZED_HEADERS, _b = RAW_HEADER_NAMES, _c = Symbol.toStringTag, Symbol.iterator)]() {
		return this.entries();
	}
	*keys() {
		for (const [name] of this.entries()) yield name;
	}
	*values() {
		for (const [, value] of this.entries()) yield value;
	}
	*entries() {
		let sortedKeys = Object.keys(this[NORMALIZED_HEADERS]).sort((a, b) => a.localeCompare(b));
		for (const name of sortedKeys) if (name === "set-cookie") for (const value of this.getSetCookie()) yield [name, value];
		else yield [name, this.get(name)];
	}
	/**
	* Returns a boolean stating whether a `Headers` object contains a certain header.
	*/
	has(name) {
		if (!isValidHeaderName(name)) throw new TypeError(`Invalid header name "${name}"`);
		return this[NORMALIZED_HEADERS].hasOwnProperty(normalizeHeaderName(name));
	}
	/**
	* Returns a `ByteString` sequence of all the values of a header with a given name.
	*/
	get(name) {
		if (!isValidHeaderName(name)) throw TypeError(`Invalid header name "${name}"`);
		return this[NORMALIZED_HEADERS][normalizeHeaderName(name)] ?? null;
	}
	/**
	* Sets a new value for an existing header inside a `Headers` object, or adds the header if it does not already exist.
	*/
	set(name, value) {
		if (!isValidHeaderName(name) || !isValidHeaderValue(value)) return;
		const normalizedName = normalizeHeaderName(name);
		const normalizedValue = normalizeHeaderValue(value);
		this[NORMALIZED_HEADERS][normalizedName] = normalizeHeaderValue(normalizedValue);
		this[RAW_HEADER_NAMES].set(normalizedName, name);
	}
	/**
	* Appends a new value onto an existing header inside a `Headers` object, or adds the header if it does not already exist.
	*/
	append(name, value) {
		if (!isValidHeaderName(name) || !isValidHeaderValue(value)) return;
		const normalizedName = normalizeHeaderName(name);
		const normalizedValue = normalizeHeaderValue(value);
		let resolvedValue = this.has(normalizedName) ? `${this.get(normalizedName)}, ${normalizedValue}` : normalizedValue;
		this.set(name, resolvedValue);
	}
	/**
	* Deletes a header from the `Headers` object.
	*/
	delete(name) {
		if (!isValidHeaderName(name)) return;
		if (!this.has(name)) return;
		const normalizedName = normalizeHeaderName(name);
		delete this[NORMALIZED_HEADERS][normalizedName];
		this[RAW_HEADER_NAMES].delete(normalizedName);
	}
	/**
	* Traverses the `Headers` object,
	* calling the given callback for each header.
	*/
	forEach(callback, thisArg) {
		for (const [name, value] of this.entries()) callback.call(thisArg, value, name, this);
	}
	/**
	* Returns an array containing the values
	* of all Set-Cookie headers associated
	* with a response
	*/
	getSetCookie() {
		const setCookieHeader = this.get("set-cookie");
		if (setCookieHeader === null) return [];
		if (setCookieHeader === "") return [""];
		return (0, import_set_cookie_parser.splitCookiesString)(setCookieHeader);
	}
};
function headersToList(headers) {
	const headersList = [];
	headers.forEach((value, name) => {
		const resolvedValue = value.includes(",") ? value.split(",").map((value2) => value2.trim()) : value;
		headersList.push([name, resolvedValue]);
	});
	return headersList;
}

//#endregion
//#region node_modules/spacetimedb/dist/server/index.mjs
typeof globalThis !== "undefined" && (globalThis.global = globalThis.global || globalThis, globalThis.window = globalThis.window || globalThis);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
	return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
	return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
};
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (let key of __getOwnPropNames(from)) if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: () => from[key],
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(__defProp(target, "default", {
	value: mod,
	enumerable: true
}), mod));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var require_base64_js = __commonJS({ "../../node_modules/.pnpm/base64-js@1.5.1/node_modules/base64-js/index.js"(exports) {
	exports.byteLength = byteLength;
	exports.toByteArray = toByteArray;
	exports.fromByteArray = fromByteArray2;
	var lookup = [];
	var revLookup = [];
	var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
	var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	for (i = 0, len = code.length; i < len; ++i) {
		lookup[i] = code[i];
		revLookup[code.charCodeAt(i)] = i;
	}
	var i;
	var len;
	revLookup["-".charCodeAt(0)] = 62;
	revLookup["_".charCodeAt(0)] = 63;
	function getLens(b64) {
		var len2 = b64.length;
		if (len2 % 4 > 0) throw new Error("Invalid string. Length must be a multiple of 4");
		var validLen = b64.indexOf("=");
		if (validLen === -1) validLen = len2;
		var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
		return [validLen, placeHoldersLen];
	}
	function byteLength(b64) {
		var lens = getLens(b64);
		var validLen = lens[0];
		var placeHoldersLen = lens[1];
		return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}
	function _byteLength(b64, validLen, placeHoldersLen) {
		return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
	}
	function toByteArray(b64) {
		var tmp;
		var lens = getLens(b64);
		var validLen = lens[0];
		var placeHoldersLen = lens[1];
		var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));
		var curByte = 0;
		var len2 = placeHoldersLen > 0 ? validLen - 4 : validLen;
		var i2;
		for (i2 = 0; i2 < len2; i2 += 4) {
			tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)];
			arr[curByte++] = tmp >> 16 & 255;
			arr[curByte++] = tmp >> 8 & 255;
			arr[curByte++] = tmp & 255;
		}
		if (placeHoldersLen === 2) {
			tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4;
			arr[curByte++] = tmp & 255;
		}
		if (placeHoldersLen === 1) {
			tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2;
			arr[curByte++] = tmp >> 8 & 255;
			arr[curByte++] = tmp & 255;
		}
		return arr;
	}
	function tripletToBase64(num) {
		return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
	}
	function encodeChunk(uint8, start, end) {
		var tmp;
		var output = [];
		for (var i2 = start; i2 < end; i2 += 3) {
			tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255);
			output.push(tripletToBase64(tmp));
		}
		return output.join("");
	}
	function fromByteArray2(uint8) {
		var tmp;
		var len2 = uint8.length;
		var extraBytes = len2 % 3;
		var parts = [];
		var maxChunkLength = 16383;
		for (var i2 = 0, len22 = len2 - extraBytes; i2 < len22; i2 += maxChunkLength) parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
		if (extraBytes === 1) {
			tmp = uint8[len2 - 1];
			parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==");
		} else if (extraBytes === 2) {
			tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1];
			parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=");
		}
		return parts.join("");
	}
} });
var require_codes = __commonJS({ "../../node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/codes.json"(exports, module) {
	module.exports = {
		"100": "Continue",
		"101": "Switching Protocols",
		"102": "Processing",
		"103": "Early Hints",
		"200": "OK",
		"201": "Created",
		"202": "Accepted",
		"203": "Non-Authoritative Information",
		"204": "No Content",
		"205": "Reset Content",
		"206": "Partial Content",
		"207": "Multi-Status",
		"208": "Already Reported",
		"226": "IM Used",
		"300": "Multiple Choices",
		"301": "Moved Permanently",
		"302": "Found",
		"303": "See Other",
		"304": "Not Modified",
		"305": "Use Proxy",
		"307": "Temporary Redirect",
		"308": "Permanent Redirect",
		"400": "Bad Request",
		"401": "Unauthorized",
		"402": "Payment Required",
		"403": "Forbidden",
		"404": "Not Found",
		"405": "Method Not Allowed",
		"406": "Not Acceptable",
		"407": "Proxy Authentication Required",
		"408": "Request Timeout",
		"409": "Conflict",
		"410": "Gone",
		"411": "Length Required",
		"412": "Precondition Failed",
		"413": "Payload Too Large",
		"414": "URI Too Long",
		"415": "Unsupported Media Type",
		"416": "Range Not Satisfiable",
		"417": "Expectation Failed",
		"418": "I'm a Teapot",
		"421": "Misdirected Request",
		"422": "Unprocessable Entity",
		"423": "Locked",
		"424": "Failed Dependency",
		"425": "Too Early",
		"426": "Upgrade Required",
		"428": "Precondition Required",
		"429": "Too Many Requests",
		"431": "Request Header Fields Too Large",
		"451": "Unavailable For Legal Reasons",
		"500": "Internal Server Error",
		"501": "Not Implemented",
		"502": "Bad Gateway",
		"503": "Service Unavailable",
		"504": "Gateway Timeout",
		"505": "HTTP Version Not Supported",
		"506": "Variant Also Negotiates",
		"507": "Insufficient Storage",
		"508": "Loop Detected",
		"509": "Bandwidth Limit Exceeded",
		"510": "Not Extended",
		"511": "Network Authentication Required"
	};
} });
var require_statuses = __commonJS({ "../../node_modules/.pnpm/statuses@2.0.2/node_modules/statuses/index.js"(exports, module) {
	var codes = require_codes();
	module.exports = status2;
	status2.message = codes;
	status2.code = createMessageToStatusCodeMap(codes);
	status2.codes = createStatusCodeList(codes);
	status2.redirect = {
		300: true,
		301: true,
		302: true,
		303: true,
		305: true,
		307: true,
		308: true
	};
	status2.empty = {
		204: true,
		205: true,
		304: true
	};
	status2.retry = {
		502: true,
		503: true,
		504: true
	};
	function createMessageToStatusCodeMap(codes2) {
		var map = {};
		Object.keys(codes2).forEach(function forEachCode(code) {
			var message = codes2[code];
			var status3 = Number(code);
			map[message.toLowerCase()] = status3;
		});
		return map;
	}
	function createStatusCodeList(codes2) {
		return Object.keys(codes2).map(function mapCode(code) {
			return Number(code);
		});
	}
	function getStatusCode(message) {
		var msg = message.toLowerCase();
		if (!Object.prototype.hasOwnProperty.call(status2.code, msg)) throw new Error("invalid status message: \"" + message + "\"");
		return status2.code[msg];
	}
	function getStatusMessage(code) {
		if (!Object.prototype.hasOwnProperty.call(status2.message, code)) throw new Error("invalid status code: " + code);
		return status2.message[code];
	}
	function status2(code) {
		if (typeof code === "number") return getStatusMessage(code);
		if (typeof code !== "string") throw new TypeError("code must be a number or string");
		var n = parseInt(code, 10);
		if (!isNaN(n)) return getStatusMessage(n);
		return getStatusCode(code);
	}
} });
var util_stub_exports = {};
__export(util_stub_exports, { inspect: () => inspect });
var inspect;
var init_util_stub = __esm({ "src/util-stub.ts"() {
	inspect = {};
} });
var require_util_inspect = __commonJS({ "../../node_modules/.pnpm/object-inspect@1.13.4/node_modules/object-inspect/util.inspect.js"(exports, module) {
	module.exports = (init_util_stub(), __toCommonJS(util_stub_exports)).inspect;
} });
var require_object_inspect = __commonJS({ "../../node_modules/.pnpm/object-inspect@1.13.4/node_modules/object-inspect/index.js"(exports, module) {
	var hasMap = typeof Map === "function" && Map.prototype;
	var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null;
	var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === "function" ? mapSizeDescriptor.get : null;
	var mapForEach = hasMap && Map.prototype.forEach;
	var hasSet = typeof Set === "function" && Set.prototype;
	var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null;
	var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === "function" ? setSizeDescriptor.get : null;
	var setForEach = hasSet && Set.prototype.forEach;
	var weakMapHas = typeof WeakMap === "function" && WeakMap.prototype ? WeakMap.prototype.has : null;
	var weakSetHas = typeof WeakSet === "function" && WeakSet.prototype ? WeakSet.prototype.has : null;
	var weakRefDeref = typeof WeakRef === "function" && WeakRef.prototype ? WeakRef.prototype.deref : null;
	var booleanValueOf = Boolean.prototype.valueOf;
	var objectToString = Object.prototype.toString;
	var functionToString = Function.prototype.toString;
	var $match = String.prototype.match;
	var $slice = String.prototype.slice;
	var $replace = String.prototype.replace;
	var $toUpperCase = String.prototype.toUpperCase;
	var $toLowerCase = String.prototype.toLowerCase;
	var $test = RegExp.prototype.test;
	var $concat = Array.prototype.concat;
	var $join = Array.prototype.join;
	var $arrSlice = Array.prototype.slice;
	var $floor = Math.floor;
	var bigIntValueOf = typeof BigInt === "function" ? BigInt.prototype.valueOf : null;
	var gOPS = Object.getOwnPropertySymbols;
	var symToString = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol.prototype.toString : null;
	var hasShammedSymbols = typeof Symbol === "function" && typeof Symbol.iterator === "object";
	var toStringTag = typeof Symbol === "function" && Symbol.toStringTag && (typeof Symbol.toStringTag === hasShammedSymbols ? "object" : "symbol") ? Symbol.toStringTag : null;
	var isEnumerable = Object.prototype.propertyIsEnumerable;
	var gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function(O) {
		return O.__proto__;
	} : null);
	function addNumericSeparator(num, str) {
		if (num === Infinity || num === -Infinity || num !== num || num && num > -1e3 && num < 1e3 || $test.call(/e/, str)) return str;
		var sepRegex = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
		if (typeof num === "number") {
			var int = num < 0 ? -$floor(-num) : $floor(num);
			if (int !== num) {
				var intStr = String(int);
				var dec = $slice.call(str, intStr.length + 1);
				return $replace.call(intStr, sepRegex, "$&_") + "." + $replace.call($replace.call(dec, /([0-9]{3})/g, "$&_"), /_$/, "");
			}
		}
		return $replace.call(str, sepRegex, "$&_");
	}
	var utilInspect = require_util_inspect();
	var inspectCustom = utilInspect.custom;
	var inspectSymbol = isSymbol(inspectCustom) ? inspectCustom : null;
	var quotes = {
		__proto__: null,
		"double": "\"",
		single: "'"
	};
	var quoteREs = {
		__proto__: null,
		"double": /(["\\])/g,
		single: /(['\\])/g
	};
	module.exports = function inspect_(obj, options, depth, seen) {
		var opts = options || {};
		if (has(opts, "quoteStyle") && !has(quotes, opts.quoteStyle)) throw new TypeError("option \"quoteStyle\" must be \"single\" or \"double\"");
		if (has(opts, "maxStringLength") && (typeof opts.maxStringLength === "number" ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity : opts.maxStringLength !== null)) throw new TypeError("option \"maxStringLength\", if provided, must be a positive integer, Infinity, or `null`");
		var customInspect = has(opts, "customInspect") ? opts.customInspect : true;
		if (typeof customInspect !== "boolean" && customInspect !== "symbol") throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
		if (has(opts, "indent") && opts.indent !== null && opts.indent !== "	" && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)) throw new TypeError("option \"indent\" must be \"\\t\", an integer > 0, or `null`");
		if (has(opts, "numericSeparator") && typeof opts.numericSeparator !== "boolean") throw new TypeError("option \"numericSeparator\", if provided, must be `true` or `false`");
		var numericSeparator = opts.numericSeparator;
		if (typeof obj === "undefined") return "undefined";
		if (obj === null) return "null";
		if (typeof obj === "boolean") return obj ? "true" : "false";
		if (typeof obj === "string") return inspectString(obj, opts);
		if (typeof obj === "number") {
			if (obj === 0) return Infinity / obj > 0 ? "0" : "-0";
			var str = String(obj);
			return numericSeparator ? addNumericSeparator(obj, str) : str;
		}
		if (typeof obj === "bigint") {
			var bigIntStr = String(obj) + "n";
			return numericSeparator ? addNumericSeparator(obj, bigIntStr) : bigIntStr;
		}
		var maxDepth = typeof opts.depth === "undefined" ? 5 : opts.depth;
		if (typeof depth === "undefined") depth = 0;
		if (depth >= maxDepth && maxDepth > 0 && typeof obj === "object") return isArray(obj) ? "[Array]" : "[Object]";
		var indent = getIndent(opts, depth);
		if (typeof seen === "undefined") seen = [];
		else if (indexOf(seen, obj) >= 0) return "[Circular]";
		function inspect3(value, from, noIndent) {
			if (from) {
				seen = $arrSlice.call(seen);
				seen.push(from);
			}
			if (noIndent) {
				var newOpts = { depth: opts.depth };
				if (has(opts, "quoteStyle")) newOpts.quoteStyle = opts.quoteStyle;
				return inspect_(value, newOpts, depth + 1, seen);
			}
			return inspect_(value, opts, depth + 1, seen);
		}
		if (typeof obj === "function" && !isRegExp(obj)) {
			var name = nameOf(obj);
			var keys = arrObjKeys(obj, inspect3);
			return "[Function" + (name ? ": " + name : " (anonymous)") + "]" + (keys.length > 0 ? " { " + $join.call(keys, ", ") + " }" : "");
		}
		if (isSymbol(obj)) {
			var symString = hasShammedSymbols ? $replace.call(String(obj), /^(Symbol\(.*\))_[^)]*$/, "$1") : symToString.call(obj);
			return typeof obj === "object" && !hasShammedSymbols ? markBoxed(symString) : symString;
		}
		if (isElement(obj)) {
			var s = "<" + $toLowerCase.call(String(obj.nodeName));
			var attrs = obj.attributes || [];
			for (var i = 0; i < attrs.length; i++) s += " " + attrs[i].name + "=" + wrapQuotes(quote(attrs[i].value), "double", opts);
			s += ">";
			if (obj.childNodes && obj.childNodes.length) s += "...";
			s += "</" + $toLowerCase.call(String(obj.nodeName)) + ">";
			return s;
		}
		if (isArray(obj)) {
			if (obj.length === 0) return "[]";
			var xs = arrObjKeys(obj, inspect3);
			if (indent && !singleLineValues(xs)) return "[" + indentedJoin(xs, indent) + "]";
			return "[ " + $join.call(xs, ", ") + " ]";
		}
		if (isError(obj)) {
			var parts = arrObjKeys(obj, inspect3);
			if (!("cause" in Error.prototype) && "cause" in obj && !isEnumerable.call(obj, "cause")) return "{ [" + String(obj) + "] " + $join.call($concat.call("[cause]: " + inspect3(obj.cause), parts), ", ") + " }";
			if (parts.length === 0) return "[" + String(obj) + "]";
			return "{ [" + String(obj) + "] " + $join.call(parts, ", ") + " }";
		}
		if (typeof obj === "object" && customInspect) {
			if (inspectSymbol && typeof obj[inspectSymbol] === "function" && utilInspect) return utilInspect(obj, { depth: maxDepth - depth });
			else if (customInspect !== "symbol" && typeof obj.inspect === "function") return obj.inspect();
		}
		if (isMap(obj)) {
			var mapParts = [];
			if (mapForEach) mapForEach.call(obj, function(value, key) {
				mapParts.push(inspect3(key, obj, true) + " => " + inspect3(value, obj));
			});
			return collectionOf("Map", mapSize.call(obj), mapParts, indent);
		}
		if (isSet(obj)) {
			var setParts = [];
			if (setForEach) setForEach.call(obj, function(value) {
				setParts.push(inspect3(value, obj));
			});
			return collectionOf("Set", setSize.call(obj), setParts, indent);
		}
		if (isWeakMap(obj)) return weakCollectionOf("WeakMap");
		if (isWeakSet(obj)) return weakCollectionOf("WeakSet");
		if (isWeakRef(obj)) return weakCollectionOf("WeakRef");
		if (isNumber(obj)) return markBoxed(inspect3(Number(obj)));
		if (isBigInt(obj)) return markBoxed(inspect3(bigIntValueOf.call(obj)));
		if (isBoolean(obj)) return markBoxed(booleanValueOf.call(obj));
		if (isString(obj)) return markBoxed(inspect3(String(obj)));
		if (typeof window !== "undefined" && obj === window) return "{ [object Window] }";
		if (typeof globalThis !== "undefined" && obj === globalThis || typeof global !== "undefined" && obj === global) return "{ [object globalThis] }";
		if (!isDate(obj) && !isRegExp(obj)) {
			var ys = arrObjKeys(obj, inspect3);
			var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
			var protoTag = obj instanceof Object ? "" : "null prototype";
			var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? $slice.call(toStr(obj), 8, -1) : protoTag ? "Object" : "";
			var tag = (isPlainObject || typeof obj.constructor !== "function" ? "" : obj.constructor.name ? obj.constructor.name + " " : "") + (stringTag || protoTag ? "[" + $join.call($concat.call([], stringTag || [], protoTag || []), ": ") + "] " : "");
			if (ys.length === 0) return tag + "{}";
			if (indent) return tag + "{" + indentedJoin(ys, indent) + "}";
			return tag + "{ " + $join.call(ys, ", ") + " }";
		}
		return String(obj);
	};
	function wrapQuotes(s, defaultStyle, opts) {
		var quoteChar = quotes[opts.quoteStyle || defaultStyle];
		return quoteChar + s + quoteChar;
	}
	function quote(s) {
		return $replace.call(String(s), /"/g, "&quot;");
	}
	function canTrustToString(obj) {
		return !toStringTag || !(typeof obj === "object" && (toStringTag in obj || typeof obj[toStringTag] !== "undefined"));
	}
	function isArray(obj) {
		return toStr(obj) === "[object Array]" && canTrustToString(obj);
	}
	function isDate(obj) {
		return toStr(obj) === "[object Date]" && canTrustToString(obj);
	}
	function isRegExp(obj) {
		return toStr(obj) === "[object RegExp]" && canTrustToString(obj);
	}
	function isError(obj) {
		return toStr(obj) === "[object Error]" && canTrustToString(obj);
	}
	function isString(obj) {
		return toStr(obj) === "[object String]" && canTrustToString(obj);
	}
	function isNumber(obj) {
		return toStr(obj) === "[object Number]" && canTrustToString(obj);
	}
	function isBoolean(obj) {
		return toStr(obj) === "[object Boolean]" && canTrustToString(obj);
	}
	function isSymbol(obj) {
		if (hasShammedSymbols) return obj && typeof obj === "object" && obj instanceof Symbol;
		if (typeof obj === "symbol") return true;
		if (!obj || typeof obj !== "object" || !symToString) return false;
		try {
			symToString.call(obj);
			return true;
		} catch (e) {}
		return false;
	}
	function isBigInt(obj) {
		if (!obj || typeof obj !== "object" || !bigIntValueOf) return false;
		try {
			bigIntValueOf.call(obj);
			return true;
		} catch (e) {}
		return false;
	}
	var hasOwn2 = Object.prototype.hasOwnProperty || function(key) {
		return key in this;
	};
	function has(obj, key) {
		return hasOwn2.call(obj, key);
	}
	function toStr(obj) {
		return objectToString.call(obj);
	}
	function nameOf(f) {
		if (f.name) return f.name;
		var m = $match.call(functionToString.call(f), /^function\s*([\w$]+)/);
		if (m) return m[1];
		return null;
	}
	function indexOf(xs, x) {
		if (xs.indexOf) return xs.indexOf(x);
		for (var i = 0, l = xs.length; i < l; i++) if (xs[i] === x) return i;
		return -1;
	}
	function isMap(x) {
		if (!mapSize || !x || typeof x !== "object") return false;
		try {
			mapSize.call(x);
			try {
				setSize.call(x);
			} catch (s) {
				return true;
			}
			return x instanceof Map;
		} catch (e) {}
		return false;
	}
	function isWeakMap(x) {
		if (!weakMapHas || !x || typeof x !== "object") return false;
		try {
			weakMapHas.call(x, weakMapHas);
			try {
				weakSetHas.call(x, weakSetHas);
			} catch (s) {
				return true;
			}
			return x instanceof WeakMap;
		} catch (e) {}
		return false;
	}
	function isWeakRef(x) {
		if (!weakRefDeref || !x || typeof x !== "object") return false;
		try {
			weakRefDeref.call(x);
			return true;
		} catch (e) {}
		return false;
	}
	function isSet(x) {
		if (!setSize || !x || typeof x !== "object") return false;
		try {
			setSize.call(x);
			try {
				mapSize.call(x);
			} catch (m) {
				return true;
			}
			return x instanceof Set;
		} catch (e) {}
		return false;
	}
	function isWeakSet(x) {
		if (!weakSetHas || !x || typeof x !== "object") return false;
		try {
			weakSetHas.call(x, weakSetHas);
			try {
				weakMapHas.call(x, weakMapHas);
			} catch (s) {
				return true;
			}
			return x instanceof WeakSet;
		} catch (e) {}
		return false;
	}
	function isElement(x) {
		if (!x || typeof x !== "object") return false;
		if (typeof HTMLElement !== "undefined" && x instanceof HTMLElement) return true;
		return typeof x.nodeName === "string" && typeof x.getAttribute === "function";
	}
	function inspectString(str, opts) {
		if (str.length > opts.maxStringLength) {
			var remaining = str.length - opts.maxStringLength;
			var trailer = "... " + remaining + " more character" + (remaining > 1 ? "s" : "");
			return inspectString($slice.call(str, 0, opts.maxStringLength), opts) + trailer;
		}
		var quoteRE = quoteREs[opts.quoteStyle || "single"];
		quoteRE.lastIndex = 0;
		return wrapQuotes($replace.call($replace.call(str, quoteRE, "\\$1"), /[\x00-\x1f]/g, lowbyte), "single", opts);
	}
	function lowbyte(c) {
		var n = c.charCodeAt(0);
		var x = {
			8: "b",
			9: "t",
			10: "n",
			12: "f",
			13: "r"
		}[n];
		if (x) return "\\" + x;
		return "\\x" + (n < 16 ? "0" : "") + $toUpperCase.call(n.toString(16));
	}
	function markBoxed(str) {
		return "Object(" + str + ")";
	}
	function weakCollectionOf(type) {
		return type + " { ? }";
	}
	function collectionOf(type, size, entries, indent) {
		var joinedEntries = indent ? indentedJoin(entries, indent) : $join.call(entries, ", ");
		return type + " (" + size + ") {" + joinedEntries + "}";
	}
	function singleLineValues(xs) {
		for (var i = 0; i < xs.length; i++) if (indexOf(xs[i], "\n") >= 0) return false;
		return true;
	}
	function getIndent(opts, depth) {
		var baseIndent;
		if (opts.indent === "	") baseIndent = "	";
		else if (typeof opts.indent === "number" && opts.indent > 0) baseIndent = $join.call(Array(opts.indent + 1), " ");
		else return null;
		return {
			base: baseIndent,
			prev: $join.call(Array(depth + 1), baseIndent)
		};
	}
	function indentedJoin(xs, indent) {
		if (xs.length === 0) return "";
		var lineJoiner = "\n" + indent.prev + indent.base;
		return lineJoiner + $join.call(xs, "," + lineJoiner) + "\n" + indent.prev;
	}
	function arrObjKeys(obj, inspect3) {
		var isArr = isArray(obj);
		var xs = [];
		if (isArr) {
			xs.length = obj.length;
			for (var i = 0; i < obj.length; i++) xs[i] = has(obj, i) ? inspect3(obj[i], obj) : "";
		}
		var syms = typeof gOPS === "function" ? gOPS(obj) : [];
		var symMap;
		if (hasShammedSymbols) {
			symMap = {};
			for (var k = 0; k < syms.length; k++) symMap["$" + syms[k]] = syms[k];
		}
		for (var key in obj) {
			if (!has(obj, key)) continue;
			if (isArr && String(Number(key)) === key && key < obj.length) continue;
			if (hasShammedSymbols && symMap["$" + key] instanceof Symbol) continue;
			else if ($test.call(/[^\w$]/, key)) xs.push(inspect3(key, obj) + ": " + inspect3(obj[key], obj));
			else xs.push(key + ": " + inspect3(obj[key], obj));
		}
		if (typeof gOPS === "function") {
			for (var j = 0; j < syms.length; j++) if (isEnumerable.call(obj, syms[j])) xs.push("[" + inspect3(syms[j]) + "]: " + inspect3(obj[syms[j]], obj));
		}
		return xs;
	}
} });
var BinaryReader = class {
	/**
	* The DataView used to read values from the binary data.
	*
	* Note: The DataView's `byteOffset` is relative to the beginning of the
	* underlying ArrayBuffer, not the start of the provided Uint8Array input.
	* This `BinaryReader`'s `#offset` field is used to track the current read position
	* relative to the start of the provided Uint8Array input.
	*/
	view;
	/**
	* Represents the offset (in bytes) relative to the start of the DataView
	* and provided Uint8Array input.
	*
	* Note: This is *not* the absolute byte offset within the underlying ArrayBuffer.
	*/
	offset = 0;
	constructor(input) {
		this.view = input instanceof DataView ? input : new DataView(input.buffer, input.byteOffset, input.byteLength);
		this.offset = 0;
	}
	reset(input) {
		this.view = input instanceof DataView ? input : new DataView(input.buffer, input.byteOffset, input.byteLength);
		this.offset = 0;
	}
	get remaining() {
		return this.view.byteLength - this.offset;
	}
	/** Ensure we have at least `n` bytes left to read */
	#ensure(n) {
		if (this.offset + n > this.view.byteLength) throw new RangeError(`Tried to read ${n} byte(s) at relative offset ${this.offset}, but only ${this.remaining} byte(s) remain`);
	}
	readUInt8Array() {
		const length = this.readU32();
		this.#ensure(length);
		return this.readBytes(length);
	}
	readBool() {
		const value = this.view.getUint8(this.offset);
		this.offset += 1;
		return value !== 0;
	}
	readByte() {
		const value = this.view.getUint8(this.offset);
		this.offset += 1;
		return value;
	}
	readBytes(length) {
		const array = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, length);
		this.offset += length;
		return array;
	}
	readI8() {
		const value = this.view.getInt8(this.offset);
		this.offset += 1;
		return value;
	}
	readU8() {
		return this.readByte();
	}
	readI16() {
		const value = this.view.getInt16(this.offset, true);
		this.offset += 2;
		return value;
	}
	readU16() {
		const value = this.view.getUint16(this.offset, true);
		this.offset += 2;
		return value;
	}
	readI32() {
		const value = this.view.getInt32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readU32() {
		const value = this.view.getUint32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readI64() {
		const value = this.view.getBigInt64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readU64() {
		const value = this.view.getBigUint64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readU128() {
		const lowerPart = this.view.getBigUint64(this.offset, true);
		const upperPart = this.view.getBigUint64(this.offset + 8, true);
		this.offset += 16;
		return (upperPart << BigInt(64)) + lowerPart;
	}
	readI128() {
		const lowerPart = this.view.getBigUint64(this.offset, true);
		const upperPart = this.view.getBigInt64(this.offset + 8, true);
		this.offset += 16;
		return (upperPart << BigInt(64)) + lowerPart;
	}
	readU256() {
		const p0 = this.view.getBigUint64(this.offset, true);
		const p1 = this.view.getBigUint64(this.offset + 8, true);
		const p2 = this.view.getBigUint64(this.offset + 16, true);
		const p3 = this.view.getBigUint64(this.offset + 24, true);
		this.offset += 32;
		return (p3 << BigInt(192)) + (p2 << BigInt(128)) + (p1 << BigInt(64)) + p0;
	}
	readI256() {
		const p0 = this.view.getBigUint64(this.offset, true);
		const p1 = this.view.getBigUint64(this.offset + 8, true);
		const p2 = this.view.getBigUint64(this.offset + 16, true);
		const p3 = this.view.getBigInt64(this.offset + 24, true);
		this.offset += 32;
		return (p3 << BigInt(192)) + (p2 << BigInt(128)) + (p1 << BigInt(64)) + p0;
	}
	readF32() {
		const value = this.view.getFloat32(this.offset, true);
		this.offset += 4;
		return value;
	}
	readF64() {
		const value = this.view.getFloat64(this.offset, true);
		this.offset += 8;
		return value;
	}
	readString() {
		const uint8Array = this.readUInt8Array();
		return new TextDecoder("utf-8").decode(uint8Array);
	}
};
var import_base64_js = __toESM(require_base64_js());
var ArrayBufferPrototypeTransfer = ArrayBuffer.prototype.transfer ?? function(newByteLength) {
	if (newByteLength === void 0) return this.slice();
	else if (newByteLength <= this.byteLength) return this.slice(0, newByteLength);
	else {
		const copy = new Uint8Array(newByteLength);
		copy.set(new Uint8Array(this));
		return copy.buffer;
	}
};
var ResizableBuffer = class {
	buffer;
	view;
	constructor(init) {
		this.buffer = typeof init === "number" ? new ArrayBuffer(init) : init;
		this.view = new DataView(this.buffer);
	}
	get capacity() {
		return this.buffer.byteLength;
	}
	grow(newSize) {
		if (newSize <= this.buffer.byteLength) return;
		this.buffer = ArrayBufferPrototypeTransfer.call(this.buffer, newSize);
		this.view = new DataView(this.buffer);
	}
};
var BinaryWriter = class {
	buffer;
	offset = 0;
	constructor(init) {
		this.buffer = typeof init === "number" ? new ResizableBuffer(init) : init;
	}
	clear() {
		this.offset = 0;
	}
	reset(buffer) {
		this.buffer = buffer;
		this.offset = 0;
	}
	expandBuffer(additionalCapacity) {
		const minCapacity = this.offset + additionalCapacity + 1;
		if (minCapacity <= this.buffer.capacity) return;
		let newCapacity = this.buffer.capacity * 2;
		if (newCapacity < minCapacity) newCapacity = minCapacity;
		this.buffer.grow(newCapacity);
	}
	toBase64() {
		return (0, import_base64_js.fromByteArray)(this.getBuffer());
	}
	getBuffer() {
		return new Uint8Array(this.buffer.buffer, 0, this.offset);
	}
	get view() {
		return this.buffer.view;
	}
	writeUInt8Array(value) {
		const length = value.length;
		this.expandBuffer(4 + length);
		this.writeU32(length);
		new Uint8Array(this.buffer.buffer, this.offset).set(value);
		this.offset += length;
	}
	writeBool(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value ? 1 : 0);
		this.offset += 1;
	}
	writeByte(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}
	writeBytes(value) {
		this.expandBuffer(value.length);
		new Uint8Array(this.buffer.buffer, this.offset, value.length).set(value);
		this.offset += value.length;
	}
	writeI8(value) {
		this.expandBuffer(1);
		this.view.setInt8(this.offset, value);
		this.offset += 1;
	}
	writeU8(value) {
		this.expandBuffer(1);
		this.view.setUint8(this.offset, value);
		this.offset += 1;
	}
	writeI16(value) {
		this.expandBuffer(2);
		this.view.setInt16(this.offset, value, true);
		this.offset += 2;
	}
	writeU16(value) {
		this.expandBuffer(2);
		this.view.setUint16(this.offset, value, true);
		this.offset += 2;
	}
	writeI32(value) {
		this.expandBuffer(4);
		this.view.setInt32(this.offset, value, true);
		this.offset += 4;
	}
	writeU32(value) {
		this.expandBuffer(4);
		this.view.setUint32(this.offset, value, true);
		this.offset += 4;
	}
	writeI64(value) {
		this.expandBuffer(8);
		this.view.setBigInt64(this.offset, value, true);
		this.offset += 8;
	}
	writeU64(value) {
		this.expandBuffer(8);
		this.view.setBigUint64(this.offset, value, true);
		this.offset += 8;
	}
	writeU128(value) {
		this.expandBuffer(16);
		const lowerPart = value & BigInt("0xFFFFFFFFFFFFFFFF");
		const upperPart = value >> BigInt(64);
		this.view.setBigUint64(this.offset, lowerPart, true);
		this.view.setBigUint64(this.offset + 8, upperPart, true);
		this.offset += 16;
	}
	writeI128(value) {
		this.expandBuffer(16);
		const lowerPart = value & BigInt("0xFFFFFFFFFFFFFFFF");
		const upperPart = value >> BigInt(64);
		this.view.setBigInt64(this.offset, lowerPart, true);
		this.view.setBigInt64(this.offset + 8, upperPart, true);
		this.offset += 16;
	}
	writeU256(value) {
		this.expandBuffer(32);
		const low_64_mask = BigInt("0xFFFFFFFFFFFFFFFF");
		const p0 = value & low_64_mask;
		const p1 = value >> BigInt(64) & low_64_mask;
		const p2 = value >> BigInt(128) & low_64_mask;
		const p3 = value >> BigInt(192);
		this.view.setBigUint64(this.offset + 0, p0, true);
		this.view.setBigUint64(this.offset + 8, p1, true);
		this.view.setBigUint64(this.offset + 16, p2, true);
		this.view.setBigUint64(this.offset + 24, p3, true);
		this.offset += 32;
	}
	writeI256(value) {
		this.expandBuffer(32);
		const low_64_mask = BigInt("0xFFFFFFFFFFFFFFFF");
		const p0 = value & low_64_mask;
		const p1 = value >> BigInt(64) & low_64_mask;
		const p2 = value >> BigInt(128) & low_64_mask;
		const p3 = value >> BigInt(192);
		this.view.setBigUint64(this.offset + 0, p0, true);
		this.view.setBigUint64(this.offset + 8, p1, true);
		this.view.setBigUint64(this.offset + 16, p2, true);
		this.view.setBigInt64(this.offset + 24, p3, true);
		this.offset += 32;
	}
	writeF32(value) {
		this.expandBuffer(4);
		this.view.setFloat32(this.offset, value, true);
		this.offset += 4;
	}
	writeF64(value) {
		this.expandBuffer(8);
		this.view.setFloat64(this.offset, value, true);
		this.offset += 8;
	}
	writeString(value) {
		const encodedString = new TextEncoder().encode(value);
		this.writeUInt8Array(encodedString);
	}
};
function uint8ArrayToHexString(array) {
	return Array.prototype.map.call(array.reverse(), (x) => ("00" + x.toString(16)).slice(-2)).join("");
}
function uint8ArrayToU128(array) {
	if (array.length != 16) throw new Error(`Uint8Array is not 16 bytes long: ${array}`);
	return new BinaryReader(array).readU128();
}
function uint8ArrayToU256(array) {
	if (array.length != 32) throw new Error(`Uint8Array is not 32 bytes long: [${array}]`);
	return new BinaryReader(array).readU256();
}
function hexStringToUint8Array(str) {
	if (str.startsWith("0x")) str = str.slice(2);
	const matches = str.match(/.{1,2}/g) || [];
	return Uint8Array.from(matches.map((byte) => parseInt(byte, 16))).reverse();
}
function hexStringToU128(str) {
	return uint8ArrayToU128(hexStringToUint8Array(str));
}
function hexStringToU256(str) {
	return uint8ArrayToU256(hexStringToUint8Array(str));
}
function u128ToUint8Array(data) {
	const writer = new BinaryWriter(16);
	writer.writeU128(data);
	return writer.getBuffer();
}
function u128ToHexString(data) {
	return uint8ArrayToHexString(u128ToUint8Array(data));
}
function u256ToUint8Array(data) {
	const writer = new BinaryWriter(32);
	writer.writeU256(data);
	return writer.getBuffer();
}
function u256ToHexString(data) {
	return uint8ArrayToHexString(u256ToUint8Array(data));
}
function coerceToBigInt(value, what) {
	if (typeof value === "bigint") return value;
	if (typeof value === "number") return BigInt(value);
	if (typeof value === "string" && value.trim() !== "") return BigInt(value);
	throw new TypeError(`Cannot convert ${typeof value} to ${what}: expected bigint, integer number, or decimal string`);
}
function toPascalCase(s) {
	const str = toCamelCase(s);
	return str.charAt(0).toUpperCase() + str.slice(1);
}
function toCamelCase(s) {
	const str = s.replace(/[-_]+/g, "_").replace(/_([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
	return str.charAt(0).toLowerCase() + str.slice(1);
}
function bsatnBaseSize(typespace, ty) {
	const assumedArrayLength = 4;
	while (ty.tag === "Ref") ty = typespace.types[ty.value];
	if (ty.tag === "Product") {
		let sum = 0;
		for (const { algebraicType: elem } of ty.value.elements) sum += bsatnBaseSize(typespace, elem);
		return sum;
	} else if (ty.tag === "Sum") {
		let min = Infinity;
		for (const { algebraicType: vari } of ty.value.variants) {
			const vSize = bsatnBaseSize(typespace, vari);
			if (vSize < min) min = vSize;
		}
		if (min === Infinity) min = 0;
		return 4 + min;
	} else if (ty.tag == "Array") return 4 + assumedArrayLength * bsatnBaseSize(typespace, ty.value);
	return {
		String: 4 + assumedArrayLength,
		Sum: 1,
		Bool: 1,
		I8: 1,
		U8: 1,
		I16: 2,
		U16: 2,
		I32: 4,
		U32: 4,
		F32: 4,
		I64: 8,
		U64: 8,
		F64: 8,
		I128: 16,
		U128: 16,
		I256: 32,
		U256: 32
	}[ty.tag];
}
var hasOwn = Object.hasOwn;
var TimeDuration = class _TimeDuration {
	__time_duration_micros__;
	static MICROS_PER_MILLIS = 1000n;
	/**
	* Get the algebraic type representation of the {@link TimeDuration} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__time_duration_micros__",
			algebraicType: AlgebraicType.I64
		}] });
	}
	static isTimeDuration(algebraicType) {
		if (algebraicType.tag !== "Product") return false;
		const elements = algebraicType.value.elements;
		if (elements.length !== 1) return false;
		const microsElement = elements[0];
		return microsElement.name === "__time_duration_micros__" && microsElement.algebraicType.tag === "I64";
	}
	get micros() {
		return this.__time_duration_micros__;
	}
	get millis() {
		return Number(this.micros / _TimeDuration.MICROS_PER_MILLIS);
	}
	constructor(micros) {
		this.__time_duration_micros__ = coerceToBigInt(micros, "TimeDuration");
	}
	static fromMillis(millis) {
		return new _TimeDuration(BigInt(millis) * _TimeDuration.MICROS_PER_MILLIS);
	}
	/** This outputs the same string format that we use in the host and in Rust modules */
	toString() {
		const micros = this.micros;
		const sign = micros < 0 ? "-" : "+";
		const pos = micros < 0 ? -micros : micros;
		const secs = pos / 1000000n;
		const micros_remaining = pos % 1000000n;
		return `${sign}${secs}.${String(micros_remaining).padStart(6, "0")}`;
	}
};
var Timestamp = class _Timestamp {
	__timestamp_micros_since_unix_epoch__;
	static MICROS_PER_MILLIS = 1000n;
	get microsSinceUnixEpoch() {
		return this.__timestamp_micros_since_unix_epoch__;
	}
	constructor(micros) {
		this.__timestamp_micros_since_unix_epoch__ = coerceToBigInt(micros, "Timestamp");
	}
	/**
	* Get the algebraic type representation of the {@link Timestamp} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__timestamp_micros_since_unix_epoch__",
			algebraicType: AlgebraicType.I64
		}] });
	}
	static isTimestamp(algebraicType) {
		if (algebraicType.tag !== "Product") return false;
		const elements = algebraicType.value.elements;
		if (elements.length !== 1) return false;
		const microsElement = elements[0];
		return microsElement.name === "__timestamp_micros_since_unix_epoch__" && microsElement.algebraicType.tag === "I64";
	}
	/**
	* The Unix epoch, the midnight at the beginning of January 1, 1970, UTC.
	*/
	static UNIX_EPOCH = new _Timestamp(0n);
	/**
	* Get a `Timestamp` representing the execution environment's belief of the current moment in time.
	*/
	static now() {
		return _Timestamp.fromDate(/* @__PURE__ */ new Date());
	}
	/** Convert to milliseconds since Unix epoch. */
	toMillis() {
		return this.microsSinceUnixEpoch / 1000n;
	}
	/**
	* Get a `Timestamp` representing the same point in time as `date`.
	*/
	static fromDate(date) {
		const millis = date.getTime();
		return new _Timestamp(BigInt(millis) * _Timestamp.MICROS_PER_MILLIS);
	}
	/**
	* Get a `Date` representing approximately the same point in time as `this`.
	*
	* This method truncates to millisecond precision,
	* and throws `RangeError` if the `Timestamp` is outside the range representable as a `Date`.
	*/
	toDate() {
		const millis = this.__timestamp_micros_since_unix_epoch__ / _Timestamp.MICROS_PER_MILLIS;
		if (millis > BigInt(Number.MAX_SAFE_INTEGER) || millis < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Timestamp is outside of the representable range of JS's Date");
		return new Date(Number(millis));
	}
	/**
	* Get an ISO 8601 / RFC 3339 formatted string representation of this timestamp with microsecond precision.
	*
	* This method preserves the full microsecond precision of the timestamp,
	* and throws `RangeError` if the `Timestamp` is outside the range representable in ISO format.
	*
	* @returns ISO 8601 formatted string with microsecond precision (e.g., '2025-02-17T10:30:45.123456Z')
	*/
	toISOString() {
		const micros = this.__timestamp_micros_since_unix_epoch__;
		const millis = micros / _Timestamp.MICROS_PER_MILLIS;
		if (millis > BigInt(Number.MAX_SAFE_INTEGER) || millis < BigInt(Number.MIN_SAFE_INTEGER)) throw new RangeError("Timestamp is outside of the representable range for ISO string formatting");
		const isoBase = new Date(Number(millis)).toISOString();
		const microsRemainder = Math.abs(Number(micros % 1000000n));
		const fractionalPart = String(microsRemainder).padStart(6, "0");
		return isoBase.replace(/\.\d{3}Z$/, `.${fractionalPart}Z`);
	}
	since(other) {
		return new TimeDuration(this.__timestamp_micros_since_unix_epoch__ - other.__timestamp_micros_since_unix_epoch__);
	}
};
var Uuid = class _Uuid {
	__uuid__;
	/**
	* The nil UUID (all zeros).
	*
	* @example
	* ```ts
	* const uuid = Uuid.NIL;
	* console.assert(
	*   uuid.toString() === "00000000-0000-0000-0000-000000000000"
	* );
	* ```
	*/
	static NIL = new _Uuid(0n);
	static MAX_UUID_BIGINT = 340282366920938463463374607431768211455n;
	/**
	* The max UUID (all ones).
	*
	* @example
	* ```ts
	* const uuid = Uuid.MAX;
	* console.assert(
	*   uuid.toString() === "ffffffff-ffff-ffff-ffff-ffffffffffff"
	* );
	* ```
	*/
	static MAX = new _Uuid(_Uuid.MAX_UUID_BIGINT);
	/**
	* Create a UUID from a raw 128-bit value.
	*
	* @param u - Unsigned 128-bit integer
	* @throws {Error} If the value is outside the valid UUID range
	*/
	constructor(u) {
		const v = coerceToBigInt(u, "Uuid");
		if (v < 0n || v > _Uuid.MAX_UUID_BIGINT) throw new Error("Invalid UUID: must be between 0 and `MAX_UUID_BIGINT`");
		this.__uuid__ = v;
	}
	/**
	* Create a UUID `v4` from explicit random bytes.
	*
	* This method assumes the bytes are already sufficiently random.
	* It only sets the appropriate bits for the UUID version and variant.
	*
	* @param bytes - Exactly 16 random bytes
	* @returns A UUID `v4`
	* @throws {Error} If `bytes.length !== 16`
	*
	* @example
	* ```ts
	* const randomBytes = new Uint8Array(16);
	* const uuid = Uuid.fromRandomBytesV4(randomBytes);
	*
	* console.assert(
	*   uuid.toString() === "00000000-0000-4000-8000-000000000000"
	* );
	* ```
	*/
	static fromRandomBytesV4(bytes) {
		if (bytes.length !== 16) throw new Error("UUID v4 requires 16 bytes");
		const arr = new Uint8Array(bytes);
		arr[6] = arr[6] & 15 | 64;
		arr[8] = arr[8] & 63 | 128;
		return new _Uuid(_Uuid.bytesToBigInt(arr));
	}
	/**
	* Generate a UUID `v7` using a monotonic counter from `0` to `2^31 - 1`,
	* a timestamp, and 4 random bytes.
	*
	* The counter wraps around on overflow.
	*
	* The UUID `v7` is structured as follows:
	*
	* ```ascii
	* ┌───────────────────────────────────────────────┬───────────────────┐
	* | B0  | B1  | B2  | B3  | B4  | B5              |         B6        |
	* ├───────────────────────────────────────────────┼───────────────────┤
	* |                 unix_ts_ms                    |      version 7    |
	* └───────────────────────────────────────────────┴───────────────────┘
	* ┌──────────────┬─────────┬──────────────────┬───────────────────────┐
	* | B7           | B8      | B9  | B10 | B11  | B12 | B13 | B14 | B15 |
	* ├──────────────┼─────────┼──────────────────┼───────────────────────┤
	* | counter_high | variant |    counter_low   |        random         |
	* └──────────────┴─────────┴──────────────────┴───────────────────────┘
	* ```
	*
	* @param counter - Mutable monotonic counter (31-bit)
	* @param now - Timestamp since the Unix epoch
	* @param randomBytes - Exactly 4 random bytes
	* @returns A UUID `v7`
	*
	* @throws {Error} If the `counter` is negative
	* @throws {Error} If the `timestamp` is before the Unix epoch
	* @throws {Error} If `randomBytes.length !== 4`
	*
	* @example
	* ```ts
	* const now = Timestamp.fromMillis(1_686_000_000_000n);
	* const counter = { value: 1 };
	* const randomBytes = new Uint8Array(4);
	*
	* const uuid = Uuid.fromCounterV7(counter, now, randomBytes);
	*
	* console.assert(
	*   uuid.toString() === "0000647e-5180-7000-8000-000200000000"
	* );
	* ```
	*/
	static fromCounterV7(counter, now, randomBytes) {
		if (randomBytes.length !== 4) throw new Error("`fromCounterV7` requires `randomBytes.length == 4`");
		if (counter.value < 0) throw new Error("`fromCounterV7` uuid `counter` must be non-negative");
		if (now.__timestamp_micros_since_unix_epoch__ < 0) throw new Error("`fromCounterV7` `timestamp` before unix epoch");
		const counterVal = counter.value;
		counter.value = counterVal + 1 & 2147483647;
		const tsMs = now.toMillis() & 281474976710655n;
		const bytes = new Uint8Array(16);
		bytes[0] = Number(tsMs >> 40n & 255n);
		bytes[1] = Number(tsMs >> 32n & 255n);
		bytes[2] = Number(tsMs >> 24n & 255n);
		bytes[3] = Number(tsMs >> 16n & 255n);
		bytes[4] = Number(tsMs >> 8n & 255n);
		bytes[5] = Number(tsMs & 255n);
		bytes[7] = counterVal >>> 23 & 255;
		bytes[9] = counterVal >>> 15 & 255;
		bytes[10] = counterVal >>> 7 & 255;
		bytes[11] = (counterVal & 127) << 1 & 255;
		bytes[12] |= randomBytes[0] & 127;
		bytes[13] = randomBytes[1];
		bytes[14] = randomBytes[2];
		bytes[15] = randomBytes[3];
		bytes[6] = bytes[6] & 15 | 112;
		bytes[8] = bytes[8] & 63 | 128;
		return new _Uuid(_Uuid.bytesToBigInt(bytes));
	}
	/**
	* Parse a UUID from a string representation.
	*
	* @param s - UUID string
	* @returns Parsed UUID
	* @throws {Error} If the string is not a valid UUID
	*
	* @example
	* ```ts
	* const s = "01888d6e-5c00-7000-8000-000000000000";
	* const uuid = Uuid.parse(s);
	*
	* console.assert(uuid.toString() === s);
	* ```
	*/
	static parse(s) {
		const hex = s.replace(/-/g, "");
		if (hex.length !== 32) throw new Error("Invalid hex UUID");
		let v = 0n;
		for (let i = 0; i < 32; i += 2) v = v << 8n | BigInt(parseInt(hex.slice(i, i + 2), 16));
		return new _Uuid(v);
	}
	/** Convert to hex string without a 0x prefix. */
	toHexString() {
		return u128ToHexString(this.asBigInt());
	}
	/** Convert to string (hyphenated form). */
	toString() {
		const hex = this.toHexString();
		return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
	}
	/** Convert to bigint (u128). */
	asBigInt() {
		return this.__uuid__;
	}
	/** Return a `Uint8Array` of 16 bytes. */
	toBytes() {
		return _Uuid.bigIntToBytes(this.__uuid__);
	}
	static bytesToBigInt(bytes) {
		let result = 0n;
		for (const b of bytes) result = result << 8n | BigInt(b);
		return result;
	}
	static bigIntToBytes(value) {
		const bytes = new Uint8Array(16);
		for (let i = 15; i >= 0; i--) {
			bytes[i] = Number(value & 255n);
			value >>= 8n;
		}
		return bytes;
	}
	/**
	* Returns the version of this UUID.
	*
	* This represents the algorithm used to generate the value.
	*
	* @returns A `UuidVersion`
	* @throws {Error} If the version field is not recognized
	*/
	getVersion() {
		const version = this.toBytes()[6] >> 4 & 15;
		switch (version) {
			case 4: return "V4";
			case 7: return "V7";
			default:
				if (this == _Uuid.NIL) return "Nil";
				if (this == _Uuid.MAX) return "Max";
				throw new Error(`Unsupported UUID version: ${version}`);
		}
	}
	/**
	* Extract the monotonic counter from a UUIDv7.
	*
	* Intended for testing and diagnostics.
	* Behavior is undefined if called on a non-V7 UUID.
	*
	* @returns 31-bit counter value
	*/
	getCounter() {
		const bytes = this.toBytes();
		const high = bytes[7];
		const mid1 = bytes[9];
		const mid2 = bytes[10];
		const low = bytes[11] >>> 1;
		return high << 23 | mid1 << 15 | mid2 << 7 | low | 0;
	}
	compareTo(other) {
		if (this.__uuid__ < other.__uuid__) return -1;
		if (this.__uuid__ > other.__uuid__) return 1;
		return 0;
	}
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__uuid__",
			algebraicType: AlgebraicType.U128
		}] });
	}
};
var ConnectionId = class _ConnectionId {
	__connection_id__;
	/**
	* Creates a new `ConnectionId`.
	*/
	constructor(data) {
		this.__connection_id__ = coerceToBigInt(data, "ConnectionId");
	}
	/**
	* Get the algebraic type representation of the {@link ConnectionId} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__connection_id__",
			algebraicType: AlgebraicType.U128
		}] });
	}
	isZero() {
		return this.__connection_id__ === BigInt(0);
	}
	static nullIfZero(addr) {
		if (addr.isZero()) return null;
		else return addr;
	}
	static random() {
		function randomU8() {
			return Math.floor(Math.random() * 255);
		}
		let result = BigInt(0);
		for (let i = 0; i < 16; i++) result = result << BigInt(8) | BigInt(randomU8());
		return new _ConnectionId(result);
	}
	/**
	* Compare two connection IDs for equality.
	*/
	isEqual(other) {
		return this.__connection_id__ == other.__connection_id__;
	}
	/**
	* Check if two connection IDs are equal.
	*/
	equals(other) {
		return this.isEqual(other);
	}
	/**
	* Print the connection ID as a hexadecimal string.
	*/
	toHexString() {
		return u128ToHexString(this.__connection_id__);
	}
	/**
	* Convert the connection ID to a Uint8Array.
	*/
	toUint8Array() {
		return u128ToUint8Array(this.__connection_id__);
	}
	/**
	* Parse a connection ID from a hexadecimal string.
	*/
	static fromString(str) {
		return new _ConnectionId(hexStringToU128(str));
	}
	static fromStringOrNull(str) {
		const addr = _ConnectionId.fromString(str);
		if (addr.isZero()) return null;
		else return addr;
	}
};
var Identity = class _Identity {
	__identity__;
	/**
	* Creates a new `Identity`.
	*
	* `data` can be a hexadecimal string or a `bigint`.
	*/
	constructor(data) {
		this.__identity__ = typeof data === "string" ? hexStringToU256(data) : coerceToBigInt(data, "Identity");
	}
	/**
	* Get the algebraic type representation of the {@link Identity} type.
	* @returns The algebraic type representation of the type.
	*/
	static getAlgebraicType() {
		return AlgebraicType.Product({ elements: [{
			name: "__identity__",
			algebraicType: AlgebraicType.U256
		}] });
	}
	/**
	* Check if two identities are equal.
	*/
	isEqual(other) {
		return this.toHexString() === other.toHexString();
	}
	/**
	* Check if two identities are equal.
	*/
	equals(other) {
		return this.isEqual(other);
	}
	/**
	* Print the identity as a hexadecimal string.
	*/
	toHexString() {
		return u256ToHexString(this.__identity__);
	}
	/**
	* Convert the address to a Uint8Array.
	*/
	toUint8Array() {
		return u256ToUint8Array(this.__identity__);
	}
	/**
	* Parse an Identity from a hexadecimal string.
	*/
	static fromString(str) {
		return new _Identity(str);
	}
	/**
	* Zero identity (0x0000000000000000000000000000000000000000000000000000000000000000)
	*/
	static zero() {
		return new _Identity(0n);
	}
	toString() {
		return this.toHexString();
	}
};
var SERIALIZERS = /* @__PURE__ */ new Map();
var DESERIALIZERS = /* @__PURE__ */ new Map();
var AlgebraicType = {
	Ref: (value) => ({
		tag: "Ref",
		value
	}),
	Sum: (value) => ({
		tag: "Sum",
		value
	}),
	Product: (value) => ({
		tag: "Product",
		value
	}),
	Array: (value) => ({
		tag: "Array",
		value
	}),
	String: { tag: "String" },
	Bool: { tag: "Bool" },
	I8: { tag: "I8" },
	U8: { tag: "U8" },
	I16: { tag: "I16" },
	U16: { tag: "U16" },
	I32: { tag: "I32" },
	U32: { tag: "U32" },
	I64: { tag: "I64" },
	U64: { tag: "U64" },
	I128: { tag: "I128" },
	U128: { tag: "U128" },
	I256: { tag: "I256" },
	U256: { tag: "U256" },
	F32: { tag: "F32" },
	F64: { tag: "F64" },
	makeSerializer(ty, typespace) {
		if (ty.tag === "Ref") {
			if (!typespace) throw new Error("cannot serialize refs without a typespace");
			while (ty.tag === "Ref") ty = typespace.types[ty.value];
		}
		switch (ty.tag) {
			case "Product": return ProductType.makeSerializer(ty.value, typespace);
			case "Sum": return SumType.makeSerializer(ty.value, typespace);
			case "Array": if (ty.value.tag === "U8") return serializeUint8Array;
			else {
				const serialize = AlgebraicType.makeSerializer(ty.value, typespace);
				return (writer, value) => {
					writer.writeU32(value.length);
					for (const elem of value) serialize(writer, elem);
				};
			}
			default: return primitiveSerializers[ty.tag];
		}
	},
	serializeValue(writer, ty, value, typespace) {
		AlgebraicType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		if (ty.tag === "Ref") {
			if (!typespace) throw new Error("cannot deserialize refs without a typespace");
			while (ty.tag === "Ref") ty = typespace.types[ty.value];
		}
		switch (ty.tag) {
			case "Product": return ProductType.makeDeserializer(ty.value, typespace);
			case "Sum": return SumType.makeDeserializer(ty.value, typespace);
			case "Array": if (ty.value.tag === "U8") return deserializeUint8Array;
			else {
				const deserialize = AlgebraicType.makeDeserializer(ty.value, typespace);
				return (reader) => {
					const length = reader.readU32();
					const result = Array(length);
					for (let i = 0; i < length; i++) result[i] = deserialize(reader);
					return result;
				};
			}
			default: return primitiveDeserializers[ty.tag];
		}
	},
	deserializeValue(reader, ty, typespace) {
		return AlgebraicType.makeDeserializer(ty, typespace)(reader);
	},
	intoMapKey: function(ty, value) {
		switch (ty.tag) {
			case "U8":
			case "U16":
			case "U32":
			case "U64":
			case "U128":
			case "U256":
			case "I8":
			case "I16":
			case "I32":
			case "I64":
			case "I128":
			case "I256":
			case "F32":
			case "F64":
			case "String":
			case "Bool": return value;
			case "Product": return ProductType.intoMapKey(ty.value, value);
			default: {
				const writer = new BinaryWriter(10);
				AlgebraicType.serializeValue(writer, ty, value);
				return writer.toBase64();
			}
		}
	}
};
function bindCall(f) {
	return Function.prototype.call.bind(f);
}
var primitiveSerializers = {
	Bool: bindCall(BinaryWriter.prototype.writeBool),
	I8: bindCall(BinaryWriter.prototype.writeI8),
	U8: bindCall(BinaryWriter.prototype.writeU8),
	I16: bindCall(BinaryWriter.prototype.writeI16),
	U16: bindCall(BinaryWriter.prototype.writeU16),
	I32: bindCall(BinaryWriter.prototype.writeI32),
	U32: bindCall(BinaryWriter.prototype.writeU32),
	I64: bindCall(BinaryWriter.prototype.writeI64),
	U64: bindCall(BinaryWriter.prototype.writeU64),
	I128: bindCall(BinaryWriter.prototype.writeI128),
	U128: bindCall(BinaryWriter.prototype.writeU128),
	I256: bindCall(BinaryWriter.prototype.writeI256),
	U256: bindCall(BinaryWriter.prototype.writeU256),
	F32: bindCall(BinaryWriter.prototype.writeF32),
	F64: bindCall(BinaryWriter.prototype.writeF64),
	String: bindCall(BinaryWriter.prototype.writeString)
};
Object.freeze(primitiveSerializers);
var serializeUint8Array = bindCall(BinaryWriter.prototype.writeUInt8Array);
var primitiveDeserializers = {
	Bool: bindCall(BinaryReader.prototype.readBool),
	I8: bindCall(BinaryReader.prototype.readI8),
	U8: bindCall(BinaryReader.prototype.readU8),
	I16: bindCall(BinaryReader.prototype.readI16),
	U16: bindCall(BinaryReader.prototype.readU16),
	I32: bindCall(BinaryReader.prototype.readI32),
	U32: bindCall(BinaryReader.prototype.readU32),
	I64: bindCall(BinaryReader.prototype.readI64),
	U64: bindCall(BinaryReader.prototype.readU64),
	I128: bindCall(BinaryReader.prototype.readI128),
	U128: bindCall(BinaryReader.prototype.readU128),
	I256: bindCall(BinaryReader.prototype.readI256),
	U256: bindCall(BinaryReader.prototype.readU256),
	F32: bindCall(BinaryReader.prototype.readF32),
	F64: bindCall(BinaryReader.prototype.readF64),
	String: bindCall(BinaryReader.prototype.readString)
};
Object.freeze(primitiveDeserializers);
var deserializeUint8Array = bindCall(BinaryReader.prototype.readUInt8Array);
var primitiveSizes = {
	Bool: 1,
	I8: 1,
	U8: 1,
	I16: 2,
	U16: 2,
	I32: 4,
	U32: 4,
	I64: 8,
	U64: 8,
	I128: 16,
	U128: 16,
	I256: 32,
	U256: 32,
	F32: 4,
	F64: 8
};
var fixedSizePrimitives = new Set(Object.keys(primitiveSizes));
var isFixedSizeProduct = (ty) => ty.elements.every(({ algebraicType }) => fixedSizePrimitives.has(algebraicType.tag));
var productSize = (ty) => ty.elements.reduce((acc, { algebraicType }) => acc + primitiveSizes[algebraicType.tag], 0);
var primitiveJSName = {
	Bool: "Uint8",
	I8: "Int8",
	U8: "Uint8",
	I16: "Int16",
	U16: "Uint16",
	I32: "Int32",
	U32: "Uint32",
	I64: "BigInt64",
	U64: "BigUint64",
	F32: "Float32",
	F64: "Float64"
};
var specialProductDeserializers = {
	__time_duration_micros__: (reader) => new TimeDuration(reader.readI64()),
	__timestamp_micros_since_unix_epoch__: (reader) => new Timestamp(reader.readI64()),
	__identity__: (reader) => new Identity(reader.readU256()),
	__connection_id__: (reader) => new ConnectionId(reader.readU128()),
	__uuid__: (reader) => new Uuid(reader.readU128())
};
Object.freeze(specialProductDeserializers);
var unitDeserializer = () => ({});
var getElementInitializer = (element) => {
	let init;
	switch (element.algebraicType.tag) {
		case "String":
			init = "''";
			break;
		case "Bool":
			init = "false";
			break;
		case "I8":
		case "U8":
		case "I16":
		case "U16":
		case "I32":
		case "U32":
			init = "0";
			break;
		case "I64":
		case "U64":
		case "I128":
		case "U128":
		case "I256":
		case "U256":
			init = "0n";
			break;
		case "F32":
		case "F64":
			init = "0.0";
			break;
		default: init = "undefined";
	}
	return `${element.name}: ${init}`;
};
var ProductType = {
	makeSerializer(ty, typespace) {
		let serializer = SERIALIZERS.get(ty);
		if (serializer != null) return serializer;
		if (isFixedSizeProduct(ty)) {
			const body2 = `"use strict";
writer.expandBuffer(${productSize(ty)});
const view = writer.view;
${ty.elements.map(({ name, algebraicType: { tag } }) => tag in primitiveJSName ? `view.set${primitiveJSName[tag]}(writer.offset, value.${name}, ${primitiveSizes[tag] > 1 ? "true" : ""});
writer.offset += ${primitiveSizes[tag]};` : `writer.write${tag}(value.${name});`).join("\n")}`;
			serializer = Function("writer", "value", body2);
			SERIALIZERS.set(ty, serializer);
			return serializer;
		}
		const serializers = {};
		const body = "\"use strict\";\n" + ty.elements.map((element) => `this.${element.name}(writer, value.${element.name});`).join("\n");
		serializer = Function("writer", "value", body).bind(serializers);
		SERIALIZERS.set(ty, serializer);
		for (const { name, algebraicType } of ty.elements) serializers[name] = AlgebraicType.makeSerializer(algebraicType, typespace);
		Object.freeze(serializers);
		return serializer;
	},
	serializeValue(writer, ty, value, typespace) {
		ProductType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		switch (ty.elements.length) {
			case 0: return unitDeserializer;
			case 1: {
				const fieldName = ty.elements[0].name;
				if (hasOwn(specialProductDeserializers, fieldName)) return specialProductDeserializers[fieldName];
			}
		}
		let deserializer = DESERIALIZERS.get(ty);
		if (deserializer != null) return deserializer;
		if (isFixedSizeProduct(ty)) {
			const body = `"use strict";
const result = { ${ty.elements.map(getElementInitializer).join(", ")} };
const view = reader.view;
${ty.elements.map(({ name, algebraicType: { tag } }) => tag in primitiveJSName ? tag === "Bool" ? `result.${name} = view.getUint8(reader.offset) !== 0;
reader.offset += 1;` : `result.${name} = view.get${primitiveJSName[tag]}(reader.offset, ${primitiveSizes[tag] > 1 ? "true" : ""});
reader.offset += ${primitiveSizes[tag]};` : `result.${name} = reader.read${tag}();`).join("\n")}
return result;`;
			deserializer = Function("reader", body);
			DESERIALIZERS.set(ty, deserializer);
			return deserializer;
		}
		const deserializers = {};
		deserializer = Function("reader", `"use strict";
const result = { ${ty.elements.map(getElementInitializer).join(", ")} };
${ty.elements.map(({ name }) => `result.${name} = this.${name}(reader);`).join("\n")}
return result;`).bind(deserializers);
		DESERIALIZERS.set(ty, deserializer);
		for (const { name, algebraicType } of ty.elements) deserializers[name] = AlgebraicType.makeDeserializer(algebraicType, typespace);
		Object.freeze(deserializers);
		return deserializer;
	},
	deserializeValue(reader, ty, typespace) {
		return ProductType.makeDeserializer(ty, typespace)(reader);
	},
	intoMapKey(ty, value) {
		if (ty.elements.length === 1) {
			const fieldName = ty.elements[0].name;
			if (hasOwn(specialProductDeserializers, fieldName)) return value[fieldName];
		}
		const writer = new BinaryWriter(10);
		AlgebraicType.serializeValue(writer, AlgebraicType.Product(ty), value);
		return writer.toBase64();
	}
};
var SumType = {
	makeSerializer(ty, typespace) {
		if (ty.variants.length == 2 && ty.variants[0].name === "some" && ty.variants[1].name === "none") {
			const serialize = AlgebraicType.makeSerializer(ty.variants[0].algebraicType, typespace);
			return (writer, value) => {
				if (value !== null && value !== void 0) {
					writer.writeByte(0);
					serialize(writer, value);
				} else writer.writeByte(1);
			};
		} else if (ty.variants.length == 2 && ty.variants[0].name === "ok" && ty.variants[1].name === "err") {
			const serializeOk = AlgebraicType.makeSerializer(ty.variants[0].algebraicType, typespace);
			const serializeErr = AlgebraicType.makeSerializer(ty.variants[0].algebraicType, typespace);
			return (writer, value) => {
				if ("ok" in value) {
					writer.writeU8(0);
					serializeOk(writer, value.ok);
				} else if ("err" in value) {
					writer.writeU8(1);
					serializeErr(writer, value.err);
				} else throw new TypeError("could not serialize result: object had neither a `ok` nor an `err` field");
			};
		} else {
			let serializer = SERIALIZERS.get(ty);
			if (serializer != null) return serializer;
			const serializers = {};
			const body = `switch (value.tag) {
${ty.variants.map(({ name }, i) => `  case ${JSON.stringify(name)}:
    writer.writeByte(${i});
    return this.${name}(writer, value.value);`).join("\n")}
  default:
    throw new TypeError(
      \`Could not serialize sum type; unknown tag \${value.tag}\`
    )
}
`;
			serializer = Function("writer", "value", body).bind(serializers);
			SERIALIZERS.set(ty, serializer);
			for (const { name, algebraicType } of ty.variants) serializers[name] = AlgebraicType.makeSerializer(algebraicType, typespace);
			Object.freeze(serializers);
			return serializer;
		}
	},
	serializeValue(writer, ty, value, typespace) {
		SumType.makeSerializer(ty, typespace)(writer, value);
	},
	makeDeserializer(ty, typespace) {
		if (ty.variants.length == 2 && ty.variants[0].name === "some" && ty.variants[1].name === "none") {
			const deserialize = AlgebraicType.makeDeserializer(ty.variants[0].algebraicType, typespace);
			return (reader) => {
				const tag = reader.readU8();
				if (tag === 0) return deserialize(reader);
				else if (tag === 1) return;
				else throw `Can't deserialize an option type, couldn't find ${tag} tag`;
			};
		} else if (ty.variants.length == 2 && ty.variants[0].name === "ok" && ty.variants[1].name === "err") {
			const deserializeOk = AlgebraicType.makeDeserializer(ty.variants[0].algebraicType, typespace);
			const deserializeErr = AlgebraicType.makeDeserializer(ty.variants[1].algebraicType, typespace);
			return (reader) => {
				const tag = reader.readByte();
				if (tag === 0) return { ok: deserializeOk(reader) };
				else if (tag === 1) return { err: deserializeErr(reader) };
				else throw `Can't deserialize a result type, couldn't find ${tag} tag`;
			};
		} else {
			let deserializer = DESERIALIZERS.get(ty);
			if (deserializer != null) return deserializer;
			const deserializers = {};
			deserializer = Function("reader", `switch (reader.readU8()) {
${ty.variants.map(({ name }, i) => `case ${i}: return { tag: ${JSON.stringify(name)}, value: this.${name}(reader) };`).join("\n")} }`).bind(deserializers);
			DESERIALIZERS.set(ty, deserializer);
			for (const { name, algebraicType } of ty.variants) deserializers[name] = AlgebraicType.makeDeserializer(algebraicType, typespace);
			Object.freeze(deserializers);
			return deserializer;
		}
	},
	deserializeValue(reader, ty, typespace) {
		return SumType.makeDeserializer(ty, typespace)(reader);
	}
};
var Option = { getAlgebraicType(innerType) {
	return AlgebraicType.Sum({ variants: [{
		name: "some",
		algebraicType: innerType
	}, {
		name: "none",
		algebraicType: AlgebraicType.Product({ elements: [] })
	}] });
} };
var Result = { getAlgebraicType(okType, errType) {
	return AlgebraicType.Sum({ variants: [{
		name: "ok",
		algebraicType: okType
	}, {
		name: "err",
		algebraicType: errType
	}] });
} };
var ScheduleAt = {
	interval(value) {
		return Interval(value);
	},
	time(value) {
		return Time(value);
	},
	getAlgebraicType() {
		return AlgebraicType.Sum({ variants: [{
			name: "Interval",
			algebraicType: TimeDuration.getAlgebraicType()
		}, {
			name: "Time",
			algebraicType: Timestamp.getAlgebraicType()
		}] });
	},
	isScheduleAt(algebraicType) {
		if (algebraicType.tag !== "Sum") return false;
		const variants = algebraicType.value.variants;
		if (variants.length !== 2) return false;
		const intervalVariant = variants.find((v) => v.name === "Interval");
		const timeVariant = variants.find((v) => v.name === "Time");
		if (!intervalVariant || !timeVariant) return false;
		return TimeDuration.isTimeDuration(intervalVariant.algebraicType) && Timestamp.isTimestamp(timeVariant.algebraicType);
	}
};
var Interval = (micros) => ({
	tag: "Interval",
	value: new TimeDuration(micros)
});
var Time = (microsSinceUnixEpoch) => ({
	tag: "Time",
	value: new Timestamp(microsSinceUnixEpoch)
});
var schedule_at_default = ScheduleAt;
function set(x, t2) {
	return {
		...x,
		...t2
	};
}
var TypeBuilder = class {
	/**
	* The TypeScript phantom type. This is not stored at runtime,
	* but is visible to the compiler
	*/
	type;
	/**
	* The SpacetimeDB algebraic type (run‑time value). In addition to storing
	* the runtime representation of the `AlgebraicType`, it also captures
	* the TypeScript type information of the `AlgebraicType`. That is to say
	* the value is not merely an `AlgebraicType`, but is constructed to be
	* the corresponding concrete `AlgebraicType` for the TypeScript type `Type`.
	*
	* e.g. `string` corresponds to `AlgebraicType.String`
	*/
	algebraicType;
	constructor(algebraicType) {
		this.algebraicType = algebraicType;
	}
	optional() {
		return new OptionBuilder(this);
	}
	serialize(writer, value) {
		(this.serialize = AlgebraicType.makeSerializer(this.algebraicType))(writer, value);
	}
	deserialize(reader) {
		return (this.deserialize = AlgebraicType.makeDeserializer(this.algebraicType))(reader);
	}
};
var U8Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U8);
	}
	index(algorithm = "btree") {
		return new U8ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U8ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U8ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U8ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U16Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U16);
	}
	index(algorithm = "btree") {
		return new U16ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U16ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U16ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U16ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U32);
	}
	index(algorithm = "btree") {
		return new U32ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U32ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U64);
	}
	index(algorithm = "btree") {
		return new U64ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U64ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U128Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U128);
	}
	index(algorithm = "btree") {
		return new U128ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U128ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U128ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U128ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var U256Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.U256);
	}
	index(algorithm = "btree") {
		return new U256ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new U256ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new U256ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new U256ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I8Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I8);
	}
	index(algorithm = "btree") {
		return new I8ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I8ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I8ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I8ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I16Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I16);
	}
	index(algorithm = "btree") {
		return new I16ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I16ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I16ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I16ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I32);
	}
	index(algorithm = "btree") {
		return new I32ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I32ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I64);
	}
	index(algorithm = "btree") {
		return new I64ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I64ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I128Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I128);
	}
	index(algorithm = "btree") {
		return new I128ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I128ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I128ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I128ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var I256Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.I256);
	}
	index(algorithm = "btree") {
		return new I256ColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new I256ColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new I256ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new I256ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var F32Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.F32);
	}
	default(value) {
		return new F32ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new F32ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var F64Builder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.F64);
	}
	default(value) {
		return new F64ColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new F64ColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var BoolBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.Bool);
	}
	index(algorithm = "btree") {
		return new BoolColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new BoolColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new BoolColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new BoolColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new BoolColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var StringBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.String);
	}
	index(algorithm = "btree") {
		return new StringColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new StringColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new StringColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new StringColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new StringColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ArrayBuilder = class extends TypeBuilder {
	element;
	constructor(element) {
		super(AlgebraicType.Array(element.algebraicType));
		this.element = element;
	}
	default(value) {
		return new ArrayColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ArrayColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ByteArrayBuilder = class extends TypeBuilder {
	constructor() {
		super(AlgebraicType.Array(AlgebraicType.U8));
	}
	default(value) {
		return new ByteArrayColumnBuilder(set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ByteArrayColumnBuilder(set(defaultMetadata, { name }));
	}
};
var OptionBuilder = class extends TypeBuilder {
	value;
	constructor(value) {
		super(Option.getAlgebraicType(value.algebraicType));
		this.value = value;
	}
	default(value) {
		return new OptionColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new OptionColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ProductBuilder = class extends TypeBuilder {
	typeName;
	elements;
	constructor(elements, name) {
		function elementsArrayFromElementsObj(obj) {
			return Object.keys(obj).map((key) => ({
				name: key,
				get algebraicType() {
					return obj[key].algebraicType;
				}
			}));
		}
		super(AlgebraicType.Product({ elements: elementsArrayFromElementsObj(elements) }));
		this.typeName = name;
		this.elements = elements;
	}
	default(value) {
		return new ProductColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ProductColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ResultBuilder = class extends TypeBuilder {
	ok;
	err;
	constructor(ok, err) {
		super(Result.getAlgebraicType(ok.algebraicType, err.algebraicType));
		this.ok = ok;
		this.err = err;
	}
	default(value) {
		return new ResultColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
};
var UnitBuilder = class extends TypeBuilder {
	constructor() {
		super({
			tag: "Product",
			value: { elements: [] }
		});
	}
};
var RowBuilder = class extends TypeBuilder {
	row;
	typeName;
	constructor(row, name) {
		const mappedRow = Object.fromEntries(Object.entries(row).map(([colName, builder]) => [colName, builder instanceof ColumnBuilder ? builder : new ColumnBuilder(builder, {})]));
		const elements = Object.keys(mappedRow).map((name2) => ({
			name: name2,
			get algebraicType() {
				return mappedRow[name2].typeBuilder.algebraicType;
			}
		}));
		super(AlgebraicType.Product({ elements }));
		this.row = mappedRow;
		this.typeName = name;
	}
};
var SumBuilderImpl = class extends TypeBuilder {
	variants;
	typeName;
	constructor(variants, name) {
		function variantsArrayFromVariantsObj(variants2) {
			return Object.keys(variants2).map((key) => ({
				name: key,
				get algebraicType() {
					return variants2[key].algebraicType;
				}
			}));
		}
		super(AlgebraicType.Sum({ variants: variantsArrayFromVariantsObj(variants) }));
		this.variants = variants;
		this.typeName = name;
		for (const key of Object.keys(variants)) {
			const desc = Object.getOwnPropertyDescriptor(variants, key);
			const isAccessor = !!desc && (typeof desc.get === "function" || typeof desc.set === "function");
			let isUnit2 = false;
			if (!isAccessor) isUnit2 = variants[key] instanceof UnitBuilder;
			if (isUnit2) {
				const constant = this.create(key);
				Object.defineProperty(this, key, {
					value: constant,
					writable: false,
					enumerable: true,
					configurable: false
				});
			} else {
				const fn = ((value) => this.create(key, value));
				Object.defineProperty(this, key, {
					value: fn,
					writable: false,
					enumerable: true,
					configurable: false
				});
			}
		}
	}
	create(tag, value) {
		return value === void 0 ? { tag } : {
			tag,
			value
		};
	}
	default(value) {
		return new SumColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new SumColumnBuilder(this, set(defaultMetadata, { name }));
	}
	index(algorithm = "btree") {
		return new SumColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new SumColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
};
var SumBuilder = SumBuilderImpl;
var SimpleSumBuilderImpl = class extends SumBuilderImpl {
	index(algorithm = "btree") {
		return new SimpleSumColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new SimpleSumColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
};
var ScheduleAtBuilder = class extends TypeBuilder {
	constructor() {
		super(schedule_at_default.getAlgebraicType());
	}
	default(value) {
		return new ScheduleAtColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ScheduleAtColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var IdentityBuilder = class extends TypeBuilder {
	constructor() {
		super(Identity.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new IdentityColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var ConnectionIdBuilder = class extends TypeBuilder {
	constructor() {
		super(ConnectionId.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new ConnectionIdColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var TimestampBuilder = class extends TypeBuilder {
	constructor() {
		super(Timestamp.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new TimestampColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var TimeDurationBuilder = class extends TypeBuilder {
	constructor() {
		super(TimeDuration.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new TimeDurationColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var UuidBuilder = class extends TypeBuilder {
	constructor() {
		super(Uuid.getAlgebraicType());
	}
	index(algorithm = "btree") {
		return new UuidColumnBuilder(this, set(defaultMetadata, { indexType: algorithm }));
	}
	unique() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new UuidColumnBuilder(this, set(defaultMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new UuidColumnBuilder(this, set(defaultMetadata, { defaultValue: value }));
	}
	name(name) {
		return new UuidColumnBuilder(this, set(defaultMetadata, { name }));
	}
};
var defaultMetadata = {};
var ColumnBuilder = class {
	typeBuilder;
	columnMetadata;
	constructor(typeBuilder, metadata) {
		this.typeBuilder = typeBuilder;
		this.columnMetadata = metadata;
	}
	serialize(writer, value) {
		this.typeBuilder.serialize(writer, value);
	}
	deserialize(reader) {
		return this.typeBuilder.deserialize(reader);
	}
};
var U8ColumnBuilder = class _U8ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U16ColumnBuilder = class _U16ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U32ColumnBuilder = class _U32ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U64ColumnBuilder = class _U64ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U128ColumnBuilder = class _U128ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var U256ColumnBuilder = class _U256ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _U256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I8ColumnBuilder = class _I8ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I8ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I16ColumnBuilder = class _I16ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I16ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I32ColumnBuilder = class _I32ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I64ColumnBuilder = class _I64ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I128ColumnBuilder = class _I128ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I128ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var I256ColumnBuilder = class _I256ColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	autoInc() {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isAutoIncrement: true }));
	}
	default(value) {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _I256ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var F32ColumnBuilder = class _F32ColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _F32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _F32ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var F64ColumnBuilder = class _F64ColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _F64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _F64ColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var BoolColumnBuilder = class _BoolColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _BoolColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var StringColumnBuilder = class _StringColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _StringColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ArrayColumnBuilder = class _ArrayColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ArrayColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ArrayColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ByteArrayColumnBuilder = class _ByteArrayColumnBuilder extends ColumnBuilder {
	constructor(metadata) {
		super(new TypeBuilder(AlgebraicType.Array(AlgebraicType.U8)), metadata);
	}
	default(value) {
		return new _ByteArrayColumnBuilder(set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ByteArrayColumnBuilder(set(this.columnMetadata, { name }));
	}
};
var OptionColumnBuilder = class _OptionColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _OptionColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _OptionColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ResultColumnBuilder = class _ResultColumnBuilder extends ColumnBuilder {
	constructor(typeBuilder, metadata) {
		super(typeBuilder, metadata);
	}
	default(value) {
		return new _ResultColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
};
var ProductColumnBuilder = class _ProductColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ProductColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ProductColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var SumColumnBuilder = class _SumColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
	index(algorithm = "btree") {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new _SumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
};
var SimpleSumColumnBuilder = class _SimpleSumColumnBuilder extends SumColumnBuilder {
	index(algorithm = "btree") {
		return new _SimpleSumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	primaryKey() {
		return new _SimpleSumColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
};
var ScheduleAtColumnBuilder = class _ScheduleAtColumnBuilder extends ColumnBuilder {
	default(value) {
		return new _ScheduleAtColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ScheduleAtColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var IdentityColumnBuilder = class _IdentityColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _IdentityColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var ConnectionIdColumnBuilder = class _ConnectionIdColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _ConnectionIdColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var TimestampColumnBuilder = class _TimestampColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _TimestampColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var TimeDurationColumnBuilder = class _TimeDurationColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _TimeDurationColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var UuidColumnBuilder = class _UuidColumnBuilder extends ColumnBuilder {
	index(algorithm = "btree") {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { indexType: algorithm }));
	}
	unique() {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isUnique: true }));
	}
	primaryKey() {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { isPrimaryKey: true }));
	}
	default(value) {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { defaultValue: value }));
	}
	name(name) {
		return new _UuidColumnBuilder(this.typeBuilder, set(this.columnMetadata, { name }));
	}
};
var RefBuilder = class extends TypeBuilder {
	ref;
	/** The phantom type of the pointee of this ref. */
	__spacetimeType;
	constructor(ref) {
		super(AlgebraicType.Ref(ref));
		this.ref = ref;
	}
};
var enumImpl = ((nameOrObj, maybeObj) => {
	let obj = nameOrObj;
	let name = void 0;
	if (typeof nameOrObj === "string") {
		if (!maybeObj) throw new TypeError("When providing a name, you must also provide the variants object or array.");
		obj = maybeObj;
		name = nameOrObj;
	}
	if (Array.isArray(obj)) {
		const simpleVariantsObj = {};
		for (const variant of obj) simpleVariantsObj[variant] = new UnitBuilder();
		return new SimpleSumBuilderImpl(simpleVariantsObj, name);
	}
	return new SumBuilder(obj, name);
});
var t = {
	bool: () => new BoolBuilder(),
	string: () => new StringBuilder(),
	number: () => new F64Builder(),
	i8: () => new I8Builder(),
	u8: () => new U8Builder(),
	i16: () => new I16Builder(),
	u16: () => new U16Builder(),
	i32: () => new I32Builder(),
	u32: () => new U32Builder(),
	i64: () => new I64Builder(),
	u64: () => new U64Builder(),
	i128: () => new I128Builder(),
	u128: () => new U128Builder(),
	i256: () => new I256Builder(),
	u256: () => new U256Builder(),
	f32: () => new F32Builder(),
	f64: () => new F64Builder(),
	object: ((nameOrObj, maybeObj) => {
		if (typeof nameOrObj === "string") {
			if (!maybeObj) throw new TypeError("When providing a name, you must also provide the object.");
			return new ProductBuilder(maybeObj, nameOrObj);
		}
		return new ProductBuilder(nameOrObj, void 0);
	}),
	row: ((nameOrObj, maybeObj) => {
		const [obj, name] = typeof nameOrObj === "string" ? [maybeObj, nameOrObj] : [nameOrObj, void 0];
		return new RowBuilder(obj, name);
	}),
	array(e) {
		return new ArrayBuilder(e);
	},
	enum: enumImpl,
	unit() {
		return new UnitBuilder();
	},
	lazy(thunk) {
		let cached = null;
		const get = () => cached ??= thunk();
		return new Proxy({}, {
			get(_t, prop, recv) {
				const target = get();
				const val = Reflect.get(target, prop, recv);
				return typeof val === "function" ? val.bind(target) : val;
			},
			set(_t, prop, value, recv) {
				return Reflect.set(get(), prop, value, recv);
			},
			has(_t, prop) {
				return prop in get();
			},
			ownKeys() {
				return Reflect.ownKeys(get());
			},
			getOwnPropertyDescriptor(_t, prop) {
				return Object.getOwnPropertyDescriptor(get(), prop);
			},
			getPrototypeOf() {
				return Object.getPrototypeOf(get());
			}
		});
	},
	scheduleAt: () => {
		return new ScheduleAtBuilder();
	},
	option(value) {
		return new OptionBuilder(value);
	},
	result(ok, err) {
		return new ResultBuilder(ok, err);
	},
	identity: () => {
		return new IdentityBuilder();
	},
	connectionId: () => {
		return new ConnectionIdBuilder();
	},
	timestamp: () => {
		return new TimestampBuilder();
	},
	timeDuration: () => {
		return new TimeDurationBuilder();
	},
	uuid: () => {
		return new UuidBuilder();
	},
	byteArray: () => {
		return new ByteArrayBuilder();
	}
};
var AlgebraicType2 = t.enum("AlgebraicType", {
	Ref: t.u32(),
	get Sum() {
		return SumType2;
	},
	get Product() {
		return ProductType2;
	},
	get Array() {
		return AlgebraicType2;
	},
	String: t.unit(),
	Bool: t.unit(),
	I8: t.unit(),
	U8: t.unit(),
	I16: t.unit(),
	U16: t.unit(),
	I32: t.unit(),
	U32: t.unit(),
	I64: t.unit(),
	U64: t.unit(),
	I128: t.unit(),
	U128: t.unit(),
	I256: t.unit(),
	U256: t.unit(),
	F32: t.unit(),
	F64: t.unit()
});
var CaseConversionPolicy = t.enum("CaseConversionPolicy", {
	None: t.unit(),
	SnakeCase: t.unit()
});
var ExplicitNameEntry = t.enum("ExplicitNameEntry", {
	get Table() {
		return NameMapping;
	},
	get Function() {
		return NameMapping;
	},
	get Index() {
		return NameMapping;
	}
});
var ExplicitNames = t.object("ExplicitNames", { get entries() {
	return t.array(ExplicitNameEntry);
} });
var FunctionVisibility = t.enum("FunctionVisibility", {
	Private: t.unit(),
	ClientCallable: t.unit()
});
var HttpHeaderPair = t.object("HttpHeaderPair", {
	name: t.string(),
	value: t.byteArray()
});
var HttpHeaders = t.object("HttpHeaders", { get entries() {
	return t.array(HttpHeaderPair);
} });
var HttpMethod = t.enum("HttpMethod", {
	Get: t.unit(),
	Head: t.unit(),
	Post: t.unit(),
	Put: t.unit(),
	Delete: t.unit(),
	Connect: t.unit(),
	Options: t.unit(),
	Trace: t.unit(),
	Patch: t.unit(),
	Extension: t.string()
});
var HttpRequest = t.object("HttpRequest", {
	get method() {
		return HttpMethod;
	},
	get headers() {
		return HttpHeaders;
	},
	timeout: t.option(t.timeDuration()),
	uri: t.string(),
	get version() {
		return HttpVersion;
	}
});
var HttpResponse = t.object("HttpResponse", {
	get headers() {
		return HttpHeaders;
	},
	get version() {
		return HttpVersion;
	},
	code: t.u16()
});
var HttpVersion = t.enum("HttpVersion", {
	Http09: t.unit(),
	Http10: t.unit(),
	Http11: t.unit(),
	Http2: t.unit(),
	Http3: t.unit()
});
var IndexType = t.enum("IndexType", {
	BTree: t.unit(),
	Hash: t.unit()
});
var Lifecycle = t.enum("Lifecycle", {
	Init: t.unit(),
	OnConnect: t.unit(),
	OnDisconnect: t.unit()
});
var MethodOrAny = t.enum("MethodOrAny", {
	Any: t.unit(),
	get Method() {
		return HttpMethod;
	}
});
var MiscModuleExport = t.enum("MiscModuleExport", { get TypeAlias() {
	return TypeAlias;
} });
var NameMapping = t.object("NameMapping", {
	sourceName: t.string(),
	canonicalName: t.string()
});
var ProductType2 = t.object("ProductType", { get elements() {
	return t.array(ProductTypeElement);
} });
var ProductTypeElement = t.object("ProductTypeElement", {
	name: t.option(t.string()),
	get algebraicType() {
		return AlgebraicType2;
	}
});
var RawColumnDefV8 = t.object("RawColumnDefV8", {
	colName: t.string(),
	get colType() {
		return AlgebraicType2;
	}
});
var RawColumnDefaultValueV10 = t.object("RawColumnDefaultValueV10", {
	colId: t.u16(),
	value: t.byteArray()
});
var RawColumnDefaultValueV9 = t.object("RawColumnDefaultValueV9", {
	table: t.string(),
	colId: t.u16(),
	value: t.byteArray()
});
var RawConstraintDataV9 = t.enum("RawConstraintDataV9", { get Unique() {
	return RawUniqueConstraintDataV9;
} });
var RawConstraintDefV10 = t.object("RawConstraintDefV10", {
	sourceName: t.option(t.string()),
	get data() {
		return RawConstraintDataV9;
	}
});
var RawConstraintDefV8 = t.object("RawConstraintDefV8", {
	constraintName: t.string(),
	constraints: t.u8(),
	columns: t.array(t.u16())
});
var RawConstraintDefV9 = t.object("RawConstraintDefV9", {
	name: t.option(t.string()),
	get data() {
		return RawConstraintDataV9;
	}
});
var RawHttpHandlerDefV10 = t.object("RawHttpHandlerDefV10", { sourceName: t.string() });
var RawHttpRouteDefV10 = t.object("RawHttpRouteDefV10", {
	handlerFunction: t.string(),
	get method() {
		return MethodOrAny;
	},
	path: t.string()
});
var RawIndexAlgorithm = t.enum("RawIndexAlgorithm", {
	BTree: t.array(t.u16()),
	Hash: t.array(t.u16()),
	Direct: t.u16()
});
var RawIndexDefV10 = t.object("RawIndexDefV10", {
	sourceName: t.option(t.string()),
	accessorName: t.option(t.string()),
	get algorithm() {
		return RawIndexAlgorithm;
	}
});
var RawIndexDefV8 = t.object("RawIndexDefV8", {
	indexName: t.string(),
	isUnique: t.bool(),
	get indexType() {
		return IndexType;
	},
	columns: t.array(t.u16())
});
var RawIndexDefV9 = t.object("RawIndexDefV9", {
	name: t.option(t.string()),
	accessorName: t.option(t.string()),
	get algorithm() {
		return RawIndexAlgorithm;
	}
});
var RawLifeCycleReducerDefV10 = t.object("RawLifeCycleReducerDefV10", {
	get lifecycleSpec() {
		return Lifecycle;
	},
	functionName: t.string()
});
var RawMiscModuleExportV9 = t.enum("RawMiscModuleExportV9", {
	get ColumnDefaultValue() {
		return RawColumnDefaultValueV9;
	},
	get Procedure() {
		return RawProcedureDefV9;
	},
	get View() {
		return RawViewDefV9;
	}
});
var RawModuleDef = t.enum("RawModuleDef", {
	get V8BackCompat() {
		return RawModuleDefV8;
	},
	get V9() {
		return RawModuleDefV9;
	},
	get V10() {
		return RawModuleDefV10;
	}
});
var RawModuleDefV10 = t.object("RawModuleDefV10", { get sections() {
	return t.array(RawModuleDefV10Section);
} });
var RawModuleDefV10Section = t.enum("RawModuleDefV10Section", {
	get Typespace() {
		return Typespace;
	},
	get Types() {
		return t.array(RawTypeDefV10);
	},
	get Tables() {
		return t.array(RawTableDefV10);
	},
	get Reducers() {
		return t.array(RawReducerDefV10);
	},
	get Procedures() {
		return t.array(RawProcedureDefV10);
	},
	get Views() {
		return t.array(RawViewDefV10);
	},
	get Schedules() {
		return t.array(RawScheduleDefV10);
	},
	get LifeCycleReducers() {
		return t.array(RawLifeCycleReducerDefV10);
	},
	get RowLevelSecurity() {
		return t.array(RawRowLevelSecurityDefV9);
	},
	get CaseConversionPolicy() {
		return CaseConversionPolicy;
	},
	get ExplicitNames() {
		return ExplicitNames;
	},
	get HttpHandlers() {
		return t.array(RawHttpHandlerDefV10);
	},
	get HttpRoutes() {
		return t.array(RawHttpRouteDefV10);
	},
	get ViewPrimaryKeys() {
		return t.array(RawViewPrimaryKeyDefV10);
	},
	get Submodules() {
		return t.array(RawSubmoduleV10);
	}
});
var RawModuleDefV8 = t.object("RawModuleDefV8", {
	get typespace() {
		return Typespace;
	},
	get tables() {
		return t.array(TableDesc);
	},
	get reducers() {
		return t.array(ReducerDef);
	},
	get miscExports() {
		return t.array(MiscModuleExport);
	}
});
var RawModuleDefV9 = t.object("RawModuleDefV9", {
	get typespace() {
		return Typespace;
	},
	get tables() {
		return t.array(RawTableDefV9);
	},
	get reducers() {
		return t.array(RawReducerDefV9);
	},
	get types() {
		return t.array(RawTypeDefV9);
	},
	get miscExports() {
		return t.array(RawMiscModuleExportV9);
	},
	get rowLevelSecurity() {
		return t.array(RawRowLevelSecurityDefV9);
	}
});
var RawProcedureDefV10 = t.object("RawProcedureDefV10", {
	sourceName: t.string(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	},
	get visibility() {
		return FunctionVisibility;
	}
});
var RawProcedureDefV9 = t.object("RawProcedureDefV9", {
	name: t.string(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawReducerDefV10 = t.object("RawReducerDefV10", {
	sourceName: t.string(),
	get params() {
		return ProductType2;
	},
	get visibility() {
		return FunctionVisibility;
	},
	get okReturnType() {
		return AlgebraicType2;
	},
	get errReturnType() {
		return AlgebraicType2;
	}
});
var RawReducerDefV9 = t.object("RawReducerDefV9", {
	name: t.string(),
	get params() {
		return ProductType2;
	},
	get lifecycle() {
		return t.option(Lifecycle);
	}
});
var RawRowLevelSecurityDefV9 = t.object("RawRowLevelSecurityDefV9", { sql: t.string() });
var RawScheduleDefV10 = t.object("RawScheduleDefV10", {
	sourceName: t.option(t.string()),
	tableName: t.string(),
	scheduleAtCol: t.u16(),
	functionName: t.string()
});
var RawScheduleDefV9 = t.object("RawScheduleDefV9", {
	name: t.option(t.string()),
	reducerName: t.string(),
	scheduledAtColumn: t.u16()
});
var RawScopedTypeNameV10 = t.object("RawScopedTypeNameV10", {
	scope: t.array(t.string()),
	sourceName: t.string()
});
var RawScopedTypeNameV9 = t.object("RawScopedTypeNameV9", {
	scope: t.array(t.string()),
	name: t.string()
});
var RawSequenceDefV10 = t.object("RawSequenceDefV10", {
	sourceName: t.option(t.string()),
	column: t.u16(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	increment: t.i128()
});
var RawSequenceDefV8 = t.object("RawSequenceDefV8", {
	sequenceName: t.string(),
	colPos: t.u16(),
	increment: t.i128(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	allocated: t.i128()
});
var RawSequenceDefV9 = t.object("RawSequenceDefV9", {
	name: t.option(t.string()),
	column: t.u16(),
	start: t.option(t.i128()),
	minValue: t.option(t.i128()),
	maxValue: t.option(t.i128()),
	increment: t.i128()
});
var RawSubmoduleV10 = t.object("RawSubmoduleV10", {
	namespace: t.string(),
	get module() {
		return RawModuleDefV10;
	}
});
var RawTableDefV10 = t.object("RawTableDefV10", {
	sourceName: t.string(),
	productTypeRef: t.u32(),
	primaryKey: t.array(t.u16()),
	get indexes() {
		return t.array(RawIndexDefV10);
	},
	get constraints() {
		return t.array(RawConstraintDefV10);
	},
	get sequences() {
		return t.array(RawSequenceDefV10);
	},
	get tableType() {
		return TableType;
	},
	get tableAccess() {
		return TableAccess;
	},
	get defaultValues() {
		return t.array(RawColumnDefaultValueV10);
	},
	isEvent: t.bool()
});
var RawTableDefV8 = t.object("RawTableDefV8", {
	tableName: t.string(),
	get columns() {
		return t.array(RawColumnDefV8);
	},
	get indexes() {
		return t.array(RawIndexDefV8);
	},
	get constraints() {
		return t.array(RawConstraintDefV8);
	},
	get sequences() {
		return t.array(RawSequenceDefV8);
	},
	tableType: t.string(),
	tableAccess: t.string(),
	scheduled: t.option(t.string())
});
var RawTableDefV9 = t.object("RawTableDefV9", {
	name: t.string(),
	productTypeRef: t.u32(),
	primaryKey: t.array(t.u16()),
	get indexes() {
		return t.array(RawIndexDefV9);
	},
	get constraints() {
		return t.array(RawConstraintDefV9);
	},
	get sequences() {
		return t.array(RawSequenceDefV9);
	},
	get schedule() {
		return t.option(RawScheduleDefV9);
	},
	get tableType() {
		return TableType;
	},
	get tableAccess() {
		return TableAccess;
	}
});
var RawTypeDefV10 = t.object("RawTypeDefV10", {
	get sourceName() {
		return RawScopedTypeNameV10;
	},
	ty: t.u32(),
	customOrdering: t.bool()
});
var RawTypeDefV9 = t.object("RawTypeDefV9", {
	get name() {
		return RawScopedTypeNameV9;
	},
	ty: t.u32(),
	customOrdering: t.bool()
});
var RawUniqueConstraintDataV9 = t.object("RawUniqueConstraintDataV9", { columns: t.array(t.u16()) });
var RawViewDefV10 = t.object("RawViewDefV10", {
	sourceName: t.string(),
	index: t.u32(),
	isPublic: t.bool(),
	isAnonymous: t.bool(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawViewDefV9 = t.object("RawViewDefV9", {
	name: t.string(),
	index: t.u32(),
	isPublic: t.bool(),
	isAnonymous: t.bool(),
	get params() {
		return ProductType2;
	},
	get returnType() {
		return AlgebraicType2;
	}
});
var RawViewPrimaryKeyDefV10 = t.object("RawViewPrimaryKeyDefV10", {
	viewSourceName: t.string(),
	columns: t.array(t.string())
});
var ReducerDef = t.object("ReducerDef", {
	name: t.string(),
	get args() {
		return t.array(ProductTypeElement);
	}
});
var SumType2 = t.object("SumType", { get variants() {
	return t.array(SumTypeVariant);
} });
var SumTypeVariant = t.object("SumTypeVariant", {
	name: t.option(t.string()),
	get algebraicType() {
		return AlgebraicType2;
	}
});
var TableAccess = t.enum("TableAccess", {
	Public: t.unit(),
	Private: t.unit()
});
var TableDesc = t.object("TableDesc", {
	get schema() {
		return RawTableDefV8;
	},
	data: t.u32()
});
var TableType = t.enum("TableType", {
	System: t.unit(),
	User: t.unit()
});
var TypeAlias = t.object("TypeAlias", {
	name: t.string(),
	ty: t.u32()
});
var Typespace = t.object("Typespace", { get types() {
	return t.array(AlgebraicType2);
} });
var ViewResultHeader = t.enum("ViewResultHeader", {
	RowData: t.unit(),
	RawSql: t.string()
});
function tableToSchema(accName, schema2, tableDef) {
	const getColName = (i) => schema2.rowType.algebraicType.value.elements[i].name;
	const resolvedIndexes = tableDef.indexes.map((idx) => {
		const accessorName = idx.accessorName;
		if (typeof accessorName !== "string" || accessorName.length === 0) throw new TypeError(`Index '${idx.sourceName ?? "<unknown>"}' on table '${tableDef.sourceName}' is missing accessor name`);
		const columnIds = idx.algorithm.tag === "Direct" ? [idx.algorithm.value] : idx.algorithm.value;
		return {
			name: accessorName,
			unique: tableDef.constraints.some((c) => c.data.tag === "Unique" && c.data.value.columns.every((col) => columnIds.includes(col))),
			algorithm: {
				BTree: "btree",
				Hash: "hash",
				Direct: "direct"
			}[idx.algorithm.tag],
			columns: columnIds.map(getColName)
		};
	});
	return {
		sourceName: schema2.tableName || accName,
		accessorName: accName,
		columns: schema2.rowType.row,
		rowType: schema2.rowSpacetimeType,
		indexes: schema2.idxs,
		constraints: tableDef.constraints.map((c) => ({
			name: c.sourceName,
			constraint: "unique",
			columns: c.data.value.columns.map(getColName)
		})),
		resolvedIndexes,
		tableDef,
		...tableDef.isEvent ? { isEvent: true } : {}
	};
}
var ModuleContext = class {
	#compoundTypes = /* @__PURE__ */ new Map();
	/**
	* The global module definition that gets populated by calls to `reducer()` and lifecycle hooks.
	*/
	#moduleDef = {
		typespace: { types: [] },
		tables: [],
		reducers: [],
		types: [],
		rowLevelSecurity: [],
		schedules: [],
		procedures: [],
		views: [],
		viewPrimaryKeys: [],
		lifeCycleReducers: [],
		httpHandlers: [],
		httpRoutes: [],
		caseConversionPolicy: { tag: "SnakeCase" },
		explicitNames: { entries: [] },
		submodules: []
	};
	get moduleDef() {
		return this.#moduleDef;
	}
	rawModuleDefV10() {
		const sections = [];
		const push = (s) => {
			if (s) sections.push(s);
		};
		const module = this.#moduleDef;
		push(module.typespace && {
			tag: "Typespace",
			value: module.typespace
		});
		push(module.types && {
			tag: "Types",
			value: module.types
		});
		push(module.tables && {
			tag: "Tables",
			value: module.tables
		});
		push(module.reducers && {
			tag: "Reducers",
			value: module.reducers
		});
		push(module.procedures && {
			tag: "Procedures",
			value: module.procedures
		});
		push(module.views && {
			tag: "Views",
			value: module.views
		});
		push(module.viewPrimaryKeys && {
			tag: "ViewPrimaryKeys",
			value: module.viewPrimaryKeys
		});
		push(module.schedules && {
			tag: "Schedules",
			value: module.schedules
		});
		push(module.lifeCycleReducers && {
			tag: "LifeCycleReducers",
			value: module.lifeCycleReducers
		});
		push(module.httpHandlers && {
			tag: "HttpHandlers",
			value: module.httpHandlers
		});
		push(module.httpRoutes && {
			tag: "HttpRoutes",
			value: module.httpRoutes
		});
		push(module.rowLevelSecurity && {
			tag: "RowLevelSecurity",
			value: module.rowLevelSecurity
		});
		push(module.explicitNames && {
			tag: "ExplicitNames",
			value: module.explicitNames
		});
		push(module.caseConversionPolicy && {
			tag: "CaseConversionPolicy",
			value: module.caseConversionPolicy
		});
		push(module.submodules && {
			tag: "Submodules",
			value: module.submodules
		});
		return { sections };
	}
	addSubmodule(submodule) {
		this.#moduleDef.submodules.push(submodule);
	}
	/**
	* Set the case conversion policy for this module.
	* Called by the settings mechanism.
	*/
	setCaseConversionPolicy(policy) {
		this.#moduleDef.caseConversionPolicy = policy;
	}
	get typespace() {
		return this.#moduleDef.typespace;
	}
	/**
	* Resolves the actual type of a TypeBuilder by following its references until it reaches a non-ref type.
	* @param typespace The typespace to resolve types against.
	* @param typeBuilder The TypeBuilder to resolve.
	* @returns The resolved algebraic type.
	*/
	resolveType(typeBuilder) {
		let ty = typeBuilder.algebraicType;
		while (ty.tag === "Ref") ty = this.typespace.types[ty.value];
		return ty;
	}
	/**
	* Adds a type to the module definition's typespace as a `Ref` if it is a named compound type (Product or Sum).
	* Otherwise, returns the type as is.
	* @param name
	* @param ty
	* @returns
	*/
	registerTypesRecursively(typeBuilder) {
		if (typeBuilder instanceof ProductBuilder && !isUnit(typeBuilder) || typeBuilder instanceof SumBuilder || typeBuilder instanceof RowBuilder) return this.#registerCompoundTypeRecursively(typeBuilder);
		else if (typeBuilder instanceof OptionBuilder) return new OptionBuilder(this.registerTypesRecursively(typeBuilder.value));
		else if (typeBuilder instanceof ResultBuilder) return new ResultBuilder(this.registerTypesRecursively(typeBuilder.ok), this.registerTypesRecursively(typeBuilder.err));
		else if (typeBuilder instanceof ArrayBuilder) return new ArrayBuilder(this.registerTypesRecursively(typeBuilder.element));
		else return typeBuilder;
	}
	#registerCompoundTypeRecursively(typeBuilder) {
		const ty = typeBuilder.algebraicType;
		const name = typeBuilder.typeName;
		if (name === void 0) throw new Error(`Missing type name for ${typeBuilder.constructor.name ?? "TypeBuilder"} ${JSON.stringify(typeBuilder)}`);
		let r = this.#compoundTypes.get(ty);
		if (r != null) return r;
		const newTy = typeBuilder instanceof RowBuilder || typeBuilder instanceof ProductBuilder ? {
			tag: "Product",
			value: { elements: [] }
		} : {
			tag: "Sum",
			value: { variants: [] }
		};
		r = new RefBuilder(this.#moduleDef.typespace.types.length);
		this.#moduleDef.typespace.types.push(newTy);
		this.#compoundTypes.set(ty, r);
		if (typeBuilder instanceof RowBuilder) for (const [name2, elem] of Object.entries(typeBuilder.row)) newTy.value.elements.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(elem.typeBuilder).algebraicType
		});
		else if (typeBuilder instanceof ProductBuilder) for (const [name2, elem] of Object.entries(typeBuilder.elements)) newTy.value.elements.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(elem).algebraicType
		});
		else if (typeBuilder instanceof SumBuilder) for (const [name2, variant] of Object.entries(typeBuilder.variants)) newTy.value.variants.push({
			name: name2,
			algebraicType: this.registerTypesRecursively(variant).algebraicType
		});
		this.#moduleDef.types.push({
			sourceName: splitName(name),
			ty: r.ref,
			customOrdering: true
		});
		return r;
	}
};
function isUnit(typeBuilder) {
	return typeBuilder.typeName == null && typeBuilder.algebraicType.value.elements.length === 0;
}
function splitName(name) {
	const scope = name.split(".");
	return {
		sourceName: scope.pop(),
		scope
	};
}
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder("utf-8");
function deserializeMethod(method) {
	switch (method.tag) {
		case "Get": return "GET";
		case "Head": return "HEAD";
		case "Post": return "POST";
		case "Put": return "PUT";
		case "Delete": return "DELETE";
		case "Connect": return "CONNECT";
		case "Options": return "OPTIONS";
		case "Trace": return "TRACE";
		case "Patch": return "PATCH";
		case "Extension": return method.value;
	}
}
var methods = /* @__PURE__ */ new Map([
	["GET", { tag: "Get" }],
	["HEAD", { tag: "Head" }],
	["POST", { tag: "Post" }],
	["PUT", { tag: "Put" }],
	["DELETE", { tag: "Delete" }],
	["CONNECT", { tag: "Connect" }],
	["OPTIONS", { tag: "Options" }],
	["TRACE", { tag: "Trace" }],
	["PATCH", { tag: "Patch" }]
]);
function serializeMethod(method) {
	return methods.get(method?.toUpperCase() ?? "GET") ?? {
		tag: "Extension",
		value: method
	};
}
function serializeHeaders(headers) {
	return { entries: headersToList(headers).flatMap(([k, v]) => Array.isArray(v) ? v.map((v2) => [k, v2]) : [[k, v]]).map(([name, value]) => ({
		name,
		value: textEncoder.encode(value)
	})) };
}
function deserializeHeaders(headers) {
	return new Headers(headers.entries.map(({ name, value }) => [name, textDecoder.decode(value)]));
}
var makeResponse = Symbol("makeResponse");
var SyncResponse = class _SyncResponse {
	#body;
	#inner;
	constructor(body, init) {
		if (body == null) this.#body = null;
		else if (typeof body === "string") this.#body = body;
		else this.#body = new Uint8Array(body).buffer;
		this.#inner = {
			headers: new Headers(init?.headers),
			status: init?.status ?? 200,
			statusText: init?.statusText ?? "",
			type: "default",
			url: null,
			aborted: false,
			version: init?.version ?? { tag: "Http11" }
		};
	}
	static [makeResponse](body, inner) {
		const me = new _SyncResponse(body);
		me.#inner = inner;
		return me;
	}
	get headers() {
		return this.#inner.headers;
	}
	get status() {
		return this.#inner.status;
	}
	get statusText() {
		return this.#inner.statusText;
	}
	get ok() {
		return 200 <= this.#inner.status && this.#inner.status <= 299;
	}
	get url() {
		return this.#inner.url ?? "";
	}
	get type() {
		return this.#inner.type;
	}
	get version() {
		return this.#inner.version;
	}
	arrayBuffer() {
		return this.bytes().buffer;
	}
	bytes() {
		if (this.#body == null) return new Uint8Array();
		else if (typeof this.#body === "string") return textEncoder.encode(this.#body);
		else return new Uint8Array(this.#body);
	}
	json() {
		return JSON.parse(this.text());
	}
	text() {
		if (this.#body == null) return "";
		else if (typeof this.#body === "string") return this.#body;
		else return textDecoder.decode(this.#body);
	}
};
var httpHandlerFn = Symbol("SpacetimeDB.httpHandlerFn");
var makeRequest = Symbol("makeRequest");
function coerceRequestBody(body) {
	if (body == null) return null;
	if (typeof body === "string") return body;
	return new Uint8Array(body);
}
function requestBodyToBytes(body) {
	if (body == null) return new Uint8Array();
	if (typeof body === "string") return textEncoder.encode(body);
	return body;
}
function requestBodyToText(body) {
	if (body == null) return "";
	if (typeof body === "string") return body;
	return textDecoder.decode(body);
}
var Request = class _Request {
	#body;
	#inner;
	constructor(url, init = {}) {
		this.#body = coerceRequestBody(init.body);
		this.#inner = {
			headers: new Headers(init.headers),
			method: init.method ?? "GET",
			uri: "" + url,
			version: init.version ?? { tag: "Http11" }
		};
	}
	static [makeRequest](body, inner) {
		const me = new _Request(inner.uri);
		me.#body = coerceRequestBody(body);
		me.#inner = inner;
		return me;
	}
	get headers() {
		return this.#inner.headers;
	}
	get method() {
		return this.#inner.method;
	}
	get uri() {
		return this.#inner.uri;
	}
	get url() {
		return this.#inner.uri;
	}
	get version() {
		return this.#inner.version;
	}
	arrayBuffer() {
		return this.bytes().buffer;
	}
	bytes() {
		return requestBodyToBytes(this.#body);
	}
	json() {
		return JSON.parse(this.text());
	}
	text() {
		return requestBodyToText(this.#body);
	}
};
var exportedHttpHandlerObjects = /* @__PURE__ */ new WeakSet();
function makeHttpHandlerExport(ctx, opts, fn) {
	const handlerExport = Object.assign((...args) => fn(...args), {
		[httpHandlerFn]: fn,
		[exportContext]: ctx,
		[registerExport](ctx2, exportName) {
			if (exportedHttpHandlerObjects.has(handlerExport)) throw new TypeError(`HTTP handler '${exportName}' was exported more than once`);
			exportedHttpHandlerObjects.add(handlerExport);
			registerHttpHandler(ctx2, exportName, fn, opts);
			ctx2.httpHandlerExports.set(handlerExport, exportName);
		}
	});
	return handlerExport;
}
function makeHttpRouterExport(ctx, router) {
	return {
		[exportContext]: ctx,
		[registerExport](ctx2) {
			ctx2.pendingHttpRoutes.push(...router.intoRoutes());
		}
	};
}
function registerHttpHandler(ctx, exportName, fn, opts) {
	ctx.defineHttpHandler(exportName);
	ctx.moduleDef.httpHandlers.push({ sourceName: exportName });
	if (opts?.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	if (!fn.name) Object.defineProperty(fn, "name", {
		value: exportName,
		writable: false
	});
	ctx.httpHandlers.push(fn);
}
var import_statuses = __toESM(require_statuses());
var Range = class {
	#from;
	#to;
	constructor(from, to) {
		this.#from = from ?? { tag: "unbounded" };
		this.#to = to ?? { tag: "unbounded" };
	}
	get from() {
		return this.#from;
	}
	get to() {
		return this.#to;
	}
};
function table(opts, row, ..._) {
	const { name, public: isPublic = false, indexes: userIndexes = [], scheduled, event: isEvent = false } = opts;
	const colIds = /* @__PURE__ */ new Map();
	const colNameList = [];
	if (!(row instanceof RowBuilder)) row = new RowBuilder(row);
	row.algebraicType.value.elements.forEach((elem, i) => {
		colIds.set(elem.name, i);
		colNameList.push(elem.name);
	});
	const pk = [];
	const indexes = [];
	const constraints = [];
	const sequences = [];
	let scheduleAtCol;
	const defaultValues = [];
	for (const [name2, builder] of Object.entries(row.row)) {
		const meta = builder.columnMetadata;
		if (meta.isPrimaryKey) pk.push(colIds.get(name2));
		const isUnique = meta.isUnique || meta.isPrimaryKey;
		if (meta.indexType || isUnique) {
			const algo = meta.indexType ?? "btree";
			const id = colIds.get(name2);
			let algorithm;
			switch (algo) {
				case "btree":
					algorithm = RawIndexAlgorithm.BTree([id]);
					break;
				case "hash":
					algorithm = RawIndexAlgorithm.Hash([id]);
					break;
				case "direct":
					algorithm = RawIndexAlgorithm.Direct(id);
					break;
			}
			indexes.push({
				sourceName: void 0,
				accessorName: name2,
				algorithm
			});
		}
		if (isUnique) constraints.push({
			sourceName: void 0,
			data: {
				tag: "Unique",
				value: { columns: [colIds.get(name2)] }
			}
		});
		if (meta.isAutoIncrement) sequences.push({
			sourceName: void 0,
			start: void 0,
			minValue: void 0,
			maxValue: void 0,
			column: colIds.get(name2),
			increment: 1n
		});
		if (Object.prototype.hasOwnProperty.call(meta, "defaultValue")) {
			const writer = new BinaryWriter(16);
			builder.serialize(writer, meta.defaultValue);
			defaultValues.push({
				colId: colIds.get(name2),
				value: writer.getBuffer()
			});
		}
		const algebraicType = builder.typeBuilder.algebraicType;
		if (schedule_at_default.isScheduleAt(algebraicType)) scheduleAtCol = colIds.get(name2);
	}
	for (const indexOpts of userIndexes ?? []) {
		const accessor = indexOpts.accessor;
		if (typeof accessor !== "string" || accessor.length === 0) {
			const tableLabel = name ?? "<unnamed>";
			const indexLabel = indexOpts.name ?? "<unnamed>";
			throw new TypeError(`Index '${indexLabel}' on table '${tableLabel}' must define a non-empty 'accessor'`);
		}
		let algorithm;
		switch (indexOpts.algorithm) {
			case "btree":
				algorithm = {
					tag: "BTree",
					value: indexOpts.columns.map((c) => colIds.get(c))
				};
				break;
			case "hash":
				algorithm = {
					tag: "Hash",
					value: indexOpts.columns.map((c) => colIds.get(c))
				};
				break;
			case "direct":
				algorithm = {
					tag: "Direct",
					value: colIds.get(indexOpts.column)
				};
				break;
		}
		indexes.push({
			sourceName: void 0,
			accessorName: accessor,
			algorithm,
			canonicalName: indexOpts.name
		});
	}
	for (const constraintOpts of opts.constraints ?? []) if (constraintOpts.constraint === "unique") {
		const data = {
			tag: "Unique",
			value: { columns: constraintOpts.columns.map((c) => colIds.get(c)) }
		};
		constraints.push({
			sourceName: constraintOpts.name,
			data
		});
		continue;
	}
	const productType = row.algebraicType.value;
	return {
		rowType: row,
		tableName: name,
		rowSpacetimeType: productType,
		tableDef: (ctx, accName) => {
			const tableName = name ?? accName;
			if (row.typeName === void 0) row.typeName = toPascalCase(tableName);
			for (const index of indexes) {
				const sourceName = index.sourceName = `${accName}_${(index.algorithm.tag === "Direct" ? [index.algorithm.value] : index.algorithm.value).map((i) => colNameList[i]).join("_")}_idx_${index.algorithm.tag.toLowerCase()}`;
				const { canonicalName } = index;
				if (canonicalName !== void 0) ctx.moduleDef.explicitNames.entries.push(ExplicitNameEntry.Index({
					sourceName,
					canonicalName
				}));
			}
			return {
				sourceName: accName,
				productTypeRef: ctx.registerTypesRecursively(row).ref,
				primaryKey: pk,
				indexes,
				constraints,
				sequences,
				tableType: { tag: "User" },
				tableAccess: { tag: isPublic ? "Public" : "Private" },
				defaultValues,
				isEvent
			};
		},
		idxs: userIndexes,
		constraints,
		scheduleAtCol,
		schedule: scheduled && scheduleAtCol !== void 0 ? {
			scheduleAtCol,
			reducer: scheduled
		} : void 0
	};
}
var QueryBrand = Symbol("QueryBrand");
var isRowTypedQuery = (val) => !!val && typeof val === "object" && QueryBrand in val;
function toSql(q) {
	return q.toSql();
}
var SemijoinImpl = class _SemijoinImpl {
	constructor(sourceQuery, filterQuery, joinCondition) {
		this.sourceQuery = sourceQuery;
		this.filterQuery = filterQuery;
		this.joinCondition = joinCondition;
		if (sourceQuery.table.sourceName === filterQuery.table.sourceName) throw new Error("Cannot semijoin a table to itself");
	}
	[QueryBrand] = true;
	type = "semijoin";
	build() {
		return this;
	}
	where(predicate) {
		return new _SemijoinImpl(this.sourceQuery.where(predicate), this.filterQuery, this.joinCondition);
	}
	toSql() {
		const left = this.filterQuery;
		const right = this.sourceQuery;
		const leftTable = quoteIdentifier(left.table.sourceName);
		const rightTable = quoteIdentifier(right.table.sourceName);
		let sql = `SELECT ${rightTable}.* FROM ${leftTable} JOIN ${rightTable} ON ${booleanExprToSql(this.joinCondition)}`;
		const clauses = [];
		if (left.whereClause) clauses.push(booleanExprToSql(left.whereClause));
		if (right.whereClause) clauses.push(booleanExprToSql(right.whereClause));
		if (clauses.length > 0) {
			const whereSql = clauses.length === 1 ? clauses[0] : clauses.map(wrapInParens).join(" AND ");
			sql += ` WHERE ${whereSql}`;
		}
		return sql;
	}
};
var FromBuilder = class _FromBuilder {
	constructor(table2, whereClause) {
		this.table = table2;
		this.whereClause = whereClause;
	}
	[QueryBrand] = true;
	where(predicate) {
		const newCondition = normalizePredicateExpr(predicate(this.table.cols));
		const nextWhere = this.whereClause ? this.whereClause.and(newCondition) : newCondition;
		return new _FromBuilder(this.table, nextWhere);
	}
	rightSemijoin(right, on) {
		const sourceQuery = new _FromBuilder(right);
		const joinCondition = on(this.table.indexedCols, right.indexedCols);
		return new SemijoinImpl(sourceQuery, this, joinCondition);
	}
	leftSemijoin(right, on) {
		const filterQuery = new _FromBuilder(right);
		const joinCondition = on(this.table.indexedCols, right.indexedCols);
		return new SemijoinImpl(this, filterQuery, joinCondition);
	}
	toSql() {
		return renderSelectSqlWithJoins(this.table, this.whereClause);
	}
	build() {
		return this;
	}
};
var TableRefImpl = class {
	[QueryBrand] = true;
	type = "table";
	sourceName;
	accessorName;
	cols;
	indexedCols;
	tableDef;
	get columns() {
		return this.tableDef.columns;
	}
	get indexes() {
		return this.tableDef.indexes;
	}
	get rowType() {
		return this.tableDef.rowType;
	}
	get constraints() {
		return this.tableDef.constraints;
	}
	constructor(tableDef) {
		this.sourceName = tableDef.sourceName;
		this.accessorName = tableDef.accessorName;
		this.cols = createRowExpr(tableDef);
		this.indexedCols = this.cols;
		this.tableDef = tableDef;
		Object.freeze(this);
	}
	asFrom() {
		return new FromBuilder(this);
	}
	rightSemijoin(other, on) {
		return this.asFrom().rightSemijoin(other, on);
	}
	leftSemijoin(other, on) {
		return this.asFrom().leftSemijoin(other, on);
	}
	build() {
		return this.asFrom().build();
	}
	toSql() {
		return this.asFrom().toSql();
	}
	where(predicate) {
		return this.asFrom().where(predicate);
	}
};
function createTableRefFromDef(tableDef) {
	return new TableRefImpl(tableDef);
}
function makeQueryBuilder(schema2) {
	const qb = /* @__PURE__ */ Object.create(null);
	for (const table2 of Object.values(schema2.tables)) {
		const ref = createTableRefFromDef(table2);
		qb[table2.accessorName] = ref;
	}
	return Object.freeze(qb);
}
function createRowExpr(tableDef) {
	const row = {};
	for (const columnName of Object.keys(tableDef.columns)) {
		const columnBuilder = tableDef.columns[columnName];
		const column = new ColumnExpression(tableDef.sourceName, columnName, columnBuilder.typeBuilder.algebraicType, columnBuilder.columnMetadata.name);
		row[columnName] = Object.freeze(column);
	}
	return Object.freeze(row);
}
function renderSelectSqlWithJoins(table2, where, extraClauses = []) {
	const sql = `SELECT * FROM ${quoteIdentifier(table2.sourceName)}`;
	const clauses = [];
	if (where) clauses.push(booleanExprToSql(where));
	clauses.push(...extraClauses);
	if (clauses.length === 0) return sql;
	return `${sql} WHERE ${clauses.length === 1 ? clauses[0] : clauses.map(wrapInParens).join(" AND ")}`;
}
var ColumnExpression = class {
	type = "column";
	column;
	columnName;
	table;
	tsValueType;
	spacetimeType;
	constructor(table2, column, spacetimeType, columnName) {
		this.table = table2;
		this.column = column;
		this.columnName = columnName || column;
		this.spacetimeType = spacetimeType;
	}
	eq(x) {
		return new BooleanExpr({
			type: "eq",
			left: this,
			right: normalizeValue(x)
		});
	}
	ne(x) {
		return new BooleanExpr({
			type: "ne",
			left: this,
			right: normalizeValue(x)
		});
	}
	lt(x) {
		return new BooleanExpr({
			type: "lt",
			left: this,
			right: normalizeValue(x)
		});
	}
	lte(x) {
		return new BooleanExpr({
			type: "lte",
			left: this,
			right: normalizeValue(x)
		});
	}
	gt(x) {
		return new BooleanExpr({
			type: "gt",
			left: this,
			right: normalizeValue(x)
		});
	}
	gte(x) {
		return new BooleanExpr({
			type: "gte",
			left: this,
			right: normalizeValue(x)
		});
	}
};
function literal(value) {
	return {
		type: "literal",
		value
	};
}
function normalizeValue(val) {
	if (val.type === "literal") return val;
	if (typeof val === "object" && val != null && "type" in val && val.type === "column") return val;
	return literal(val);
}
function normalizePredicateExpr(value) {
	if (value instanceof BooleanExpr) return value;
	if (typeof value === "boolean") return new BooleanExpr({
		type: "eq",
		left: literal(value),
		right: literal(true)
	});
	return new BooleanExpr({
		type: "eq",
		left: value,
		right: literal(true)
	});
}
var BooleanExpr = class _BooleanExpr {
	constructor(data) {
		this.data = data;
	}
	and(other) {
		return new _BooleanExpr({
			type: "and",
			clauses: [this.data, other.data]
		});
	}
	or(other) {
		return new _BooleanExpr({
			type: "or",
			clauses: [this.data, other.data]
		});
	}
	not() {
		return new _BooleanExpr({
			type: "not",
			clause: this.data
		});
	}
};
function booleanExprToSql(expr, tableAlias) {
	const data = expr instanceof BooleanExpr ? expr.data : expr;
	switch (data.type) {
		case "eq": return `${valueExprToSql(data.left)} = ${valueExprToSql(data.right)}`;
		case "ne": return `${valueExprToSql(data.left)} <> ${valueExprToSql(data.right)}`;
		case "gt": return `${valueExprToSql(data.left)} > ${valueExprToSql(data.right)}`;
		case "gte": return `${valueExprToSql(data.left)} >= ${valueExprToSql(data.right)}`;
		case "lt": return `${valueExprToSql(data.left)} < ${valueExprToSql(data.right)}`;
		case "lte": return `${valueExprToSql(data.left)} <= ${valueExprToSql(data.right)}`;
		case "and": return data.clauses.map((c) => booleanExprToSql(c)).map(wrapInParens).join(" AND ");
		case "or": return data.clauses.map((c) => booleanExprToSql(c)).map(wrapInParens).join(" OR ");
		case "not": return `NOT ${wrapInParens(booleanExprToSql(data.clause))}`;
	}
}
function wrapInParens(sql) {
	return `(${sql})`;
}
function valueExprToSql(expr, tableAlias) {
	if (isLiteralExpr(expr)) return literalValueToSql(expr.value);
	const table2 = expr.table;
	return `${quoteIdentifier(table2)}.${quoteIdentifier(expr.columnName)}`;
}
function literalValueToSql(value) {
	if (value === null || value === void 0) return "NULL";
	if (value instanceof Identity || value instanceof ConnectionId || value instanceof Uuid) return `0x${value.toHexString()}`;
	if (value instanceof Timestamp) return `'${value.toISOString()}'`;
	switch (typeof value) {
		case "number":
		case "bigint": return String(value);
		case "boolean": return value ? "TRUE" : "FALSE";
		case "string": return `'${value.replace(/'/g, "''")}'`;
		default: return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
	}
}
function quoteIdentifier(name) {
	return name.split(".").map((part) => `"${part.replace(/"/g, "\"\"")}"`).join(".");
}
function isLiteralExpr(expr) {
	return expr.type === "literal";
}
function makeViewExport(ctx, opts, params, ret, fn) {
	const viewExport = fn.bind();
	viewExport[exportContext] = ctx;
	viewExport[registerExport] = (ctx2, exportName) => {
		registerView(ctx2, opts, exportName, params, ret, fn);
	};
	return viewExport;
}
function makeAnonViewExport(ctx, opts, params, ret, fn) {
	const viewExport = fn.bind();
	viewExport[exportContext] = ctx;
	viewExport[registerExport] = (ctx2, exportName) => {
		registerAnonymousView(ctx2, opts, exportName, params, ret, fn);
	};
	return viewExport;
}
function registerView(ctx, opts, exportName, params, ret, fn) {
	const described = describeView(ctx, opts, exportName, false, params, ret);
	ctx.views.push(buildViewInfo(ctx, described, fn));
}
function registerAnonymousView(ctx, opts, exportName, params, ret, fn) {
	const described = describeView(ctx, opts, exportName, true, params, ret);
	ctx.anonViews.push(buildViewInfo(ctx, described, fn));
}
function describeView(ctx, opts, exportName, anon, params, ret) {
	ctx.defineFunction(exportName);
	const paramsBuilder = new RowBuilder(params, toPascalCase(exportName));
	let returnType = ctx.registerTypesRecursively(ret).algebraicType;
	const { value: paramType } = ctx.resolveType(ctx.registerTypesRecursively(paramsBuilder));
	ctx.moduleDef.views.push({
		sourceName: exportName,
		index: (anon ? ctx.anonViews : ctx.views).length,
		isPublic: opts.public,
		isAnonymous: anon,
		params: paramType,
		returnType
	});
	const primaryKeyColumns = viewPrimaryKeyColumns(ret);
	if (primaryKeyColumns.length > 1) throw new TypeError(`View '${exportName}' can have at most one primaryKey() column on its returned row type; found ${primaryKeyColumns.join(", ")}`);
	if (primaryKeyColumns.length === 1) ctx.moduleDef.viewPrimaryKeys.push({
		viewSourceName: exportName,
		columns: primaryKeyColumns
	});
	if (opts.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	const wrapOption = returnType.tag == "Sum";
	if (returnType.tag == "Sum") returnType = AlgebraicType.Array(returnType.value.variants[0].algebraicType);
	return {
		paramType,
		returnType,
		wrapOption
	};
}
function buildViewInfo(ctx, { paramType, returnType, wrapOption }, fn) {
	const { typespace } = ctx;
	return {
		fn: wrapOption ? ((viewCtx, args) => {
			const ret = fn(viewCtx, args);
			return ret == null ? [] : [ret];
		}) : fn,
		deserializeParams: ProductType.makeDeserializer(paramType, typespace),
		serializeReturn: AlgebraicType.makeSerializer(returnType, typespace),
		returnTypeBaseSize: bsatnBaseSize(typespace, returnType)
	};
}
function viewPrimaryKeyColumns(ret) {
	const row = viewReturnRow(ret);
	if (row == null) return [];
	return Object.entries(row.row).filter((entry) => entry[1].columnMetadata.isPrimaryKey === true).map(([name]) => name);
}
function viewReturnRow(ret) {
	if (ret instanceof ArrayBuilder && ret.element instanceof RowBuilder) return ret.element;
	if (ret instanceof OptionBuilder && ret.value instanceof RowBuilder) return ret.value;
}
var SenderError = class extends Error {
	constructor(message) {
		super(message);
	}
	get name() {
		return "SenderError";
	}
};
var SpacetimeHostError = class extends Error {
	constructor(message) {
		super(message);
	}
	get name() {
		return "SpacetimeHostError";
	}
};
var errorData = {
	HostCallFailure: 1,
	NotInTransaction: 2,
	BsatnDecodeError: 3,
	NoSuchTable: 4,
	NoSuchIndex: 5,
	NoSuchIter: 6,
	NoSuchConsoleTimer: 7,
	NoSuchBytes: 8,
	NoSpace: 9,
	BufferTooSmall: 11,
	UniqueAlreadyExists: 12,
	ScheduleAtDelayTooLong: 13,
	IndexNotUnique: 14,
	NoSuchRow: 15,
	AutoIncOverflow: 16,
	WouldBlockTransaction: 17,
	TransactionNotAnonymous: 18,
	TransactionIsReadOnly: 19,
	TransactionIsMut: 20,
	HttpError: 21
};
function mapEntries(x, f) {
	return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, f(k, v)]));
}
var errnoToClass = /* @__PURE__ */ new Map();
var errors = Object.freeze(mapEntries(errorData, (name, code) => {
	const cls = Object.defineProperty(class extends SpacetimeHostError {
		get name() {
			return name;
		}
	}, "name", {
		value: name,
		writable: false
	});
	errnoToClass.set(code, cls);
	return cls;
}));
function getErrorConstructor(code) {
	return errnoToClass.get(code) ?? SpacetimeHostError;
}
var SBigInt = typeof BigInt !== "undefined" ? BigInt : void 0;
var One = typeof BigInt !== "undefined" ? BigInt(1) : void 0;
var ThirtyTwo = typeof BigInt !== "undefined" ? BigInt(32) : void 0;
var NumValues = typeof BigInt !== "undefined" ? BigInt(4294967296) : void 0;
function unsafeUniformBigIntDistribution(from, to, rng) {
	var diff = to - from + One;
	var FinalNumValues = NumValues;
	var NumIterations = 1;
	while (FinalNumValues < diff) {
		FinalNumValues <<= ThirtyTwo;
		++NumIterations;
	}
	var value = generateNext(NumIterations, rng);
	if (value < diff) return value + from;
	if (value + diff < FinalNumValues) return value % diff + from;
	var MaxAcceptedRandom = FinalNumValues - FinalNumValues % diff;
	while (value >= MaxAcceptedRandom) value = generateNext(NumIterations, rng);
	return value % diff + from;
}
function generateNext(NumIterations, rng) {
	var value = SBigInt(rng.unsafeNext() + 2147483648);
	for (var num = 1; num < NumIterations; ++num) {
		var out = rng.unsafeNext();
		value = (value << ThirtyTwo) + SBigInt(out + 2147483648);
	}
	return value;
}
function unsafeUniformIntDistributionInternal(rangeSize, rng) {
	var MaxAllowed = rangeSize > 2 ? ~~(4294967296 / rangeSize) * rangeSize : 4294967296;
	var deltaV = rng.unsafeNext() + 2147483648;
	while (deltaV >= MaxAllowed) deltaV = rng.unsafeNext() + 2147483648;
	return deltaV % rangeSize;
}
function fromNumberToArrayInt64(out, n) {
	if (n < 0) {
		var posN = -n;
		out.sign = -1;
		out.data[0] = ~~(posN / 4294967296);
		out.data[1] = posN >>> 0;
	} else {
		out.sign = 1;
		out.data[0] = ~~(n / 4294967296);
		out.data[1] = n >>> 0;
	}
	return out;
}
function substractArrayInt64(out, arrayIntA, arrayIntB) {
	var lowA = arrayIntA.data[1];
	var highA = arrayIntA.data[0];
	var signA = arrayIntA.sign;
	var lowB = arrayIntB.data[1];
	var highB = arrayIntB.data[0];
	var signB = arrayIntB.sign;
	out.sign = 1;
	if (signA === 1 && signB === -1) {
		var low_1 = lowA + lowB;
		var high = highA + highB + (low_1 > 4294967295 ? 1 : 0);
		out.data[0] = high >>> 0;
		out.data[1] = low_1 >>> 0;
		return out;
	}
	var lowFirst = lowA;
	var highFirst = highA;
	var lowSecond = lowB;
	var highSecond = highB;
	if (signA === -1) {
		lowFirst = lowB;
		highFirst = highB;
		lowSecond = lowA;
		highSecond = highA;
	}
	var reminderLow = 0;
	var low = lowFirst - lowSecond;
	if (low < 0) {
		reminderLow = 1;
		low = low >>> 0;
	}
	out.data[0] = highFirst - highSecond - reminderLow;
	out.data[1] = low;
	return out;
}
function unsafeUniformArrayIntDistributionInternal(out, rangeSize, rng) {
	var rangeLength = rangeSize.length;
	while (true) {
		for (var index = 0; index !== rangeLength; ++index) out[index] = unsafeUniformIntDistributionInternal(index === 0 ? rangeSize[0] + 1 : 4294967296, rng);
		for (var index = 0; index !== rangeLength; ++index) {
			var current = out[index];
			var currentInRange = rangeSize[index];
			if (current < currentInRange) return out;
			else if (current > currentInRange) break;
		}
	}
}
var safeNumberMaxSafeInteger = Number.MAX_SAFE_INTEGER;
var sharedA = {
	sign: 1,
	data: [0, 0]
};
var sharedB = {
	sign: 1,
	data: [0, 0]
};
var sharedC = {
	sign: 1,
	data: [0, 0]
};
var sharedData = [0, 0];
function uniformLargeIntInternal(from, to, rangeSize, rng) {
	var rangeSizeArrayIntValue = rangeSize <= safeNumberMaxSafeInteger ? fromNumberToArrayInt64(sharedC, rangeSize) : substractArrayInt64(sharedC, fromNumberToArrayInt64(sharedA, to), fromNumberToArrayInt64(sharedB, from));
	if (rangeSizeArrayIntValue.data[1] === 4294967295) {
		rangeSizeArrayIntValue.data[0] += 1;
		rangeSizeArrayIntValue.data[1] = 0;
	} else rangeSizeArrayIntValue.data[1] += 1;
	unsafeUniformArrayIntDistributionInternal(sharedData, rangeSizeArrayIntValue.data, rng);
	return sharedData[0] * 4294967296 + sharedData[1] + from;
}
function unsafeUniformIntDistribution(from, to, rng) {
	var rangeSize = to - from;
	if (rangeSize <= 4294967295) return unsafeUniformIntDistributionInternal(rangeSize + 1, rng) + from;
	return uniformLargeIntInternal(from, to, rangeSize, rng);
}
var XoroShiro128Plus = (function() {
	function XoroShiro128Plus2(s01, s00, s11, s10) {
		this.s01 = s01;
		this.s00 = s00;
		this.s11 = s11;
		this.s10 = s10;
	}
	XoroShiro128Plus2.prototype.clone = function() {
		return new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
	};
	XoroShiro128Plus2.prototype.next = function() {
		var nextRng = new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
		return [nextRng.unsafeNext(), nextRng];
	};
	XoroShiro128Plus2.prototype.unsafeNext = function() {
		var out = this.s00 + this.s10 | 0;
		var a0 = this.s10 ^ this.s00;
		var a1 = this.s11 ^ this.s01;
		var s00 = this.s00;
		var s01 = this.s01;
		this.s00 = s00 << 24 ^ s01 >>> 8 ^ a0 ^ a0 << 16;
		this.s01 = s01 << 24 ^ s00 >>> 8 ^ a1 ^ (a1 << 16 | a0 >>> 16);
		this.s10 = a1 << 5 ^ a0 >>> 27;
		this.s11 = a0 << 5 ^ a1 >>> 27;
		return out;
	};
	XoroShiro128Plus2.prototype.jump = function() {
		var nextRng = new XoroShiro128Plus2(this.s01, this.s00, this.s11, this.s10);
		nextRng.unsafeJump();
		return nextRng;
	};
	XoroShiro128Plus2.prototype.unsafeJump = function() {
		var ns01 = 0;
		var ns00 = 0;
		var ns11 = 0;
		var ns10 = 0;
		var jump = [
			3639956645,
			3750757012,
			1261568508,
			386426335
		];
		for (var i = 0; i !== 4; ++i) for (var mask = 1; mask; mask <<= 1) {
			if (jump[i] & mask) {
				ns01 ^= this.s01;
				ns00 ^= this.s00;
				ns11 ^= this.s11;
				ns10 ^= this.s10;
			}
			this.unsafeNext();
		}
		this.s01 = ns01;
		this.s00 = ns00;
		this.s11 = ns11;
		this.s10 = ns10;
	};
	XoroShiro128Plus2.prototype.getState = function() {
		return [
			this.s01,
			this.s00,
			this.s11,
			this.s10
		];
	};
	return XoroShiro128Plus2;
})();
function fromState(state) {
	if (!(state.length === 4)) throw new Error("The state must have been produced by a xoroshiro128plus RandomGenerator");
	return new XoroShiro128Plus(state[0], state[1], state[2], state[3]);
}
var xoroshiro128plus = Object.assign(function(seed) {
	return new XoroShiro128Plus(-1, ~seed, seed | 0, 0);
}, { fromState });
var { asUintN } = BigInt;
function pcg32(state) {
	state = asUintN(64, state * 6364136223846793005n + 11634580027462260723n);
	const xorshifted = Number(asUintN(32, (state >> 18n ^ state) >> 27n));
	const rot = Number(asUintN(32, state >> 59n));
	return xorshifted >> rot | xorshifted << 32 - rot;
}
function generateFloat64(rng) {
	const g1 = unsafeUniformIntDistribution(0, (1 << 26) - 1, rng);
	const g2 = unsafeUniformIntDistribution(0, (1 << 27) - 1, rng);
	return (g1 * Math.pow(2, 27) + g2) * Math.pow(2, -53);
}
function makeRandom(seed) {
	const rng = xoroshiro128plus(pcg32(seed.microsSinceUnixEpoch));
	const random = () => generateFloat64(rng);
	random.fill = (array) => {
		if (isBigIntArray(array)) {
			const upper = (1n << BigInt(array.BYTES_PER_ELEMENT * 8)) - 1n;
			for (let i = 0; i < array.length; i++) array[i] = unsafeUniformBigIntDistribution(0n, upper, rng);
		} else {
			const upper = Math.pow(2, array.BYTES_PER_ELEMENT * 8) - 1;
			for (let i = 0; i < array.length; i++) array[i] = unsafeUniformIntDistribution(0, upper, rng);
		}
		return array;
	};
	random.uint32 = () => rng.unsafeNext();
	random.integerInRange = (min, max) => unsafeUniformIntDistribution(min, max, rng);
	random.bigintInRange = (min, max) => unsafeUniformBigIntDistribution(min, max, rng);
	return random;
}
function isBigIntArray(array) {
	return array instanceof BigInt64Array || array instanceof BigUint64Array;
}
var { freeze } = Object;
var sys = {
	..._syscalls2_0,
	..._syscalls2_1
};
function requestFromWire(request, body) {
	return Request[makeRequest](body, {
		headers: deserializeHeaders(request.headers),
		method: deserializeMethod(request.method),
		uri: request.uri,
		version: request.version
	});
}
function responseIntoWire(response) {
	return [{
		headers: serializeHeaders(response.headers),
		version: response.version,
		code: response.status
	}, response.bytes()];
}
function parseJsonObject(json) {
	let value;
	try {
		value = JSON.parse(json);
	} catch {
		throw new Error("Invalid JSON: failed to parse string");
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object at the top level");
	return value;
}
var JwtClaimsImpl = class {
	/**
	* Creates a new JwtClaims instance.
	* @param rawPayload The JWT payload as a raw JSON string.
	* @param identity The identity for this JWT. We are only taking this because we don't have a blake3 implementation (which we need to compute it).
	*/
	constructor(rawPayload, identity) {
		this.rawPayload = rawPayload;
		this.fullPayload = parseJsonObject(rawPayload);
		this._identity = identity;
	}
	fullPayload;
	_identity;
	get identity() {
		return this._identity;
	}
	get subject() {
		return this.fullPayload["sub"];
	}
	get issuer() {
		return this.fullPayload["iss"];
	}
	get audience() {
		const aud = this.fullPayload["aud"];
		if (aud == null) return [];
		return typeof aud === "string" ? [aud] : aud;
	}
};
var AuthCtxImpl = class _AuthCtxImpl {
	isInternal;
	_jwtSource;
	_initializedJWT = false;
	_jwtClaims;
	_senderIdentity;
	constructor(opts) {
		this.isInternal = opts.isInternal;
		this._jwtSource = opts.jwtSource;
		this._senderIdentity = opts.senderIdentity;
	}
	_initializeJWT() {
		if (this._initializedJWT) return;
		this._initializedJWT = true;
		const token = this._jwtSource();
		if (!token) this._jwtClaims = null;
		else this._jwtClaims = new JwtClaimsImpl(token, this._senderIdentity);
		Object.freeze(this);
	}
	/** Lazily compute whether a JWT exists and is parseable. */
	get hasJWT() {
		this._initializeJWT();
		return this._jwtClaims !== null;
	}
	/** Lazily parse the JwtClaims only when accessed. */
	get jwt() {
		this._initializeJWT();
		return this._jwtClaims;
	}
	/** Create a context representing internal (non-user) requests. */
	static internal() {
		return new _AuthCtxImpl({
			isInternal: true,
			jwtSource: () => null,
			senderIdentity: Identity.zero()
		});
	}
	/** If there is a connection id, look up the JWT payload from the system tables. */
	static fromSystemTables(connectionId, sender) {
		if (connectionId === null) return new _AuthCtxImpl({
			isInternal: false,
			jwtSource: () => null,
			senderIdentity: sender
		});
		return new _AuthCtxImpl({
			isInternal: false,
			jwtSource: () => {
				const payloadBuf = sys.get_jwt_payload(connectionId.__connection_id__);
				if (payloadBuf.length === 0) return null;
				return new TextDecoder().decode(payloadBuf);
			},
			senderIdentity: sender
		});
	}
};
var ReducerCtxImpl = class ReducerCtx {
	#identity;
	#senderAuth;
	#uuidCounter;
	#random;
	sender;
	timestamp;
	connectionId;
	db;
	as;
	constructor(sender, timestamp, connectionId, dbView, asViews = {}) {
		Object.seal(this);
		this.sender = sender;
		this.timestamp = timestamp;
		this.connectionId = connectionId;
		this.db = dbView;
		this.as = asViews;
	}
	/** Reset the `ReducerCtx` to be used for a new transaction */
	static reset(me, sender, timestamp, connectionId, dbView, asViews) {
		me.sender = sender;
		me.timestamp = timestamp;
		me.connectionId = connectionId;
		me.#uuidCounter = void 0;
		me.#senderAuth = void 0;
		if (dbView !== void 0) me.db = dbView;
		if (asViews !== void 0) me.as = asViews;
	}
	get databaseIdentity() {
		return this.#identity ??= new Identity(sys.identity());
	}
	get identity() {
		return this.databaseIdentity;
	}
	get senderAuth() {
		return this.#senderAuth ??= AuthCtxImpl.fromSystemTables(this.connectionId, this.sender);
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	/**
	* Create a new random {@link Uuid} `v4` using this `ReducerCtx`'s RNG.
	*/
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	/**
	* Create a new sortable {@link Uuid} `v7` using this `ReducerCtx`'s RNG, counter,
	* and timestamp.
	*/
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
var callUserFunction = function __spacetimedb_end_short_backtrace(fn, ...args) {
	return fn(...args);
};
function runWithTx(makeCtx, body) {
	const run = () => {
		const timestamp = sys.procedure_start_mut_tx();
		try {
			return body(makeCtx(new Timestamp(timestamp)));
		} catch (e) {
			sys.procedure_abort_mut_tx();
			throw e;
		}
	};
	let res = run();
	try {
		sys.procedure_commit_mut_tx();
		return res;
	} catch {}
	console.warn("committing anonymous transaction failed");
	res = run();
	try {
		sys.procedure_commit_mut_tx();
		return res;
	} catch (e) {
		throw new Error("transaction retry failed again", { cause: e });
	}
}
function flattenSubmoduleDispatches(dispatches, parentPrefix = "") {
	const result = [];
	for (const d of dispatches) {
		const namePrefix = parentPrefix + d.namespace + ".";
		result.push({
			reducerFns: d.reducerFns,
			reducerDefs: d.reducerDefs,
			procedureFns: d.procedureFns,
			procedureDefs: d.procedureDefs,
			anonViewFns: d.anonViewFns,
			viewFns: d.viewFns,
			tables: d.tables,
			schemaTables: d.schemaTables,
			typespace: d.typespace,
			dbView_: void 0,
			queryBuilder_: void 0,
			namePrefix,
			subDispatches: d.subDispatches
		});
		result.push(...flattenSubmoduleDispatches(d.subDispatches, namePrefix));
	}
	return result;
}
var makeHooks = (schema2) => new ModuleHooksImpl(schema2);
var ModuleHooksImpl = class {
	#schema;
	#dbView_;
	#consumerAs_;
	#reducerArgsDeserializers;
	#consumerReducerCount;
	#consumerProcedureCount;
	#flatSubmodules;
	#consumerAnonViewCount;
	#consumerViewCount;
	/** Cache the `ReducerCtx` object to avoid allocating anew for every reducer call. */
	#reducerCtx_;
	/** Per-submodule alias ctx maps, cached lazily (parallel to #flatSubmodules). */
	#submoduleAsViews_ = [];
	constructor(schema2) {
		this.#schema = schema2;
		this.#consumerReducerCount = schema2.reducers.length;
		this.#consumerProcedureCount = schema2.procedures.length;
		this.#consumerAnonViewCount = schema2.anonViews.length;
		this.#consumerViewCount = schema2.views.length;
		this.#flatSubmodules = flattenSubmoduleDispatches(schema2.submoduleDispatchInfos);
		const consumerDeserializers = schema2.moduleDef.reducers.map(({ params }) => ProductType.makeDeserializer(params, schema2.typespace));
		const submoduleDeserializers = this.#flatSubmodules.flatMap(({ reducerDefs, typespace }) => reducerDefs.map(({ params }) => ProductType.makeDeserializer(params, typespace)));
		this.#reducerArgsDeserializers = [...consumerDeserializers, ...submoduleDeserializers];
	}
	get #dbView() {
		if (this.#dbView_ !== void 0) return this.#dbView_;
		const rootTables = Object.values(this.#schema.schemaType.tables).map((table2) => [table2.accessorName, makeTableView(this.#schema.typespace, table2.tableDef)]);
		const submoduleNs = this.#schema.submoduleDispatchInfos.map((dispatch) => [dispatch.namespace, buildDbViewForDispatch(dispatch, dispatch.namespace + ".")]);
		this.#dbView_ = freeze(Object.fromEntries([...rootTables, ...submoduleNs]));
		return this.#dbView_;
	}
	#getSubmoduleDbView(submoduleIdx) {
		const m = this.#flatSubmodules[submoduleIdx];
		return m.dbView_ ??= freeze(Object.fromEntries(m.tables.map(({ accessorName, tableDef }) => [accessorName, makeTableView(m.typespace, tableDef, m.namePrefix)])));
	}
	#getSubmoduleAsViews(submoduleIdx) {
		return this.#submoduleAsViews_[submoduleIdx] ??= buildAliasCtxMap(this.#reducerCtx, this.#flatSubmodules[submoduleIdx].subDispatches, this.#flatSubmodules[submoduleIdx].namePrefix);
	}
	/** Query builder scoped to the submodule's own tables, with namespace-prefixed
	*  source names so generated SQL targets the mounted table names. */
	#getSubmoduleQueryBuilder(submoduleIdx) {
		const m = this.#flatSubmodules[submoduleIdx];
		return m.queryBuilder_ ??= makeQueryBuilder({ tables: Object.fromEntries(Object.entries(m.schemaTables).map(([key, def]) => [key, {
			...def,
			sourceName: m.namePrefix + def.sourceName
		}])) });
	}
	get #reducerCtx() {
		return this.#reducerCtx_ ??= new ReducerCtxImpl(Identity.zero(), Timestamp.UNIX_EPOCH, null, this.#dbView);
	}
	get #consumerAs() {
		return this.#consumerAs_ ??= buildAliasCtxMap(this.#reducerCtx, this.#schema.submoduleDispatchInfos, "");
	}
	__describe_module__() {
		const writer = new BinaryWriter(128);
		RawModuleDef.serialize(writer, RawModuleDef.V10(this.#schema.rawModuleDefV10()));
		return writer.getBuffer();
	}
	__get_error_constructor__(code) {
		return getErrorConstructor(code);
	}
	get __sender_error_class__() {
		return SenderError;
	}
	__call_reducer__(reducerId, sender, connId, timestamp, argsBuf) {
		const deserializeArgs = this.#reducerArgsDeserializers[reducerId];
		BINARY_READER.reset(argsBuf);
		const args = deserializeArgs(BINARY_READER);
		const senderIdentity = new Identity(sender);
		let fn;
		let dbView;
		let asViews;
		if (reducerId < this.#consumerReducerCount) {
			fn = this.#schema.reducers[reducerId];
			dbView = this.#dbView;
			asViews = this.#consumerAs;
		} else {
			let offset = this.#consumerReducerCount;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (reducerId < offset + m.reducerFns.length) {
					fn = m.reducerFns[reducerId - offset];
					dbView = this.#getSubmoduleDbView(i);
					asViews = this.#getSubmoduleAsViews(i);
					break;
				}
				offset += m.reducerFns.length;
			}
			if (fn === void 0) throw new RangeError(`unknown reducerId ${reducerId}`);
		}
		const ctx = this.#reducerCtx;
		ReducerCtxImpl.reset(ctx, senderIdentity, new Timestamp(timestamp), ConnectionId.nullIfZero(new ConnectionId(connId)), dbView, asViews);
		callUserFunction(fn, ctx, args);
	}
	__call_view__(id, sender, argsBuf) {
		const moduleCtx = this.#schema;
		let viewFns;
		let localId;
		let dbView;
		let from;
		if (id < this.#consumerViewCount) {
			viewFns = moduleCtx.views;
			localId = id;
			dbView = this.#dbView;
			from = makeQueryBuilder(moduleCtx.schemaType);
		} else {
			let offset = this.#consumerViewCount;
			let found = false;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (id < offset + m.viewFns.length) {
					viewFns = m.viewFns;
					localId = id - offset;
					dbView = this.#getSubmoduleDbView(i);
					from = this.#getSubmoduleQueryBuilder(i);
					found = true;
					break;
				}
				offset += m.viewFns.length;
			}
			if (!found) throw new RangeError(`unknown viewId ${id}`);
		}
		const { fn, deserializeParams, serializeReturn, returnTypeBaseSize } = viewFns[localId];
		const ret = callUserFunction(fn, freeze({
			sender: new Identity(sender),
			db: dbView,
			from
		}), deserializeParams(new BinaryReader(argsBuf)));
		const retBuf = new BinaryWriter(returnTypeBaseSize);
		if (isRowTypedQuery(ret)) {
			const query = toSql(ret);
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RawSql(query));
		} else {
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RowData);
			serializeReturn(retBuf, ret);
		}
		return { data: retBuf.getBuffer() };
	}
	__call_view_anon__(id, argsBuf) {
		const moduleCtx = this.#schema;
		let anonViewFns;
		let localId;
		let dbView;
		let from;
		if (id < this.#consumerAnonViewCount) {
			anonViewFns = moduleCtx.anonViews;
			localId = id;
			dbView = this.#dbView;
			from = makeQueryBuilder(moduleCtx.schemaType);
		} else {
			let offset = this.#consumerAnonViewCount;
			let found = false;
			for (let i = 0; i < this.#flatSubmodules.length; i++) {
				const m = this.#flatSubmodules[i];
				if (id < offset + m.anonViewFns.length) {
					anonViewFns = m.anonViewFns;
					localId = id - offset;
					dbView = this.#getSubmoduleDbView(i);
					from = this.#getSubmoduleQueryBuilder(i);
					found = true;
					break;
				}
				offset += m.anonViewFns.length;
			}
			if (!found) throw new RangeError(`unknown anonViewId ${id}`);
		}
		const { fn, deserializeParams, serializeReturn, returnTypeBaseSize } = anonViewFns[localId];
		const ret = callUserFunction(fn, freeze({
			db: dbView,
			from
		}), deserializeParams(new BinaryReader(argsBuf)));
		const retBuf = new BinaryWriter(returnTypeBaseSize);
		if (isRowTypedQuery(ret)) {
			const query = toSql(ret);
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RawSql(query));
		} else {
			ViewResultHeader.serialize(retBuf, ViewResultHeader.RowData);
			serializeReturn(retBuf, ret);
		}
		return { data: retBuf.getBuffer() };
	}
	__call_procedure__(id, sender, connection_id, timestamp, args) {
		const senderIdentity = new Identity(sender);
		const connId = ConnectionId.nullIfZero(new ConnectionId(connection_id));
		const ts = new Timestamp(timestamp);
		if (id < this.#consumerProcedureCount) return callProcedure(this.#schema.procedures, id, senderIdentity, connId, ts, args, () => this.#dbView, this.#schema.submoduleDispatchInfos);
		let offset = this.#consumerProcedureCount;
		for (let i = 0; i < this.#flatSubmodules.length; i++) {
			const m = this.#flatSubmodules[i];
			if (id < offset + m.procedureFns.length) return callProcedure(m.procedureFns, id - offset, senderIdentity, connId, ts, args, () => this.#getSubmoduleDbView(i), m.subDispatches, m.namePrefix);
			offset += m.procedureFns.length;
		}
		throw new RangeError(`unknown procedureId ${id}`);
	}
	__call_http_handler__(id, timestamp, request, body) {
		const moduleCtx = this.#schema;
		const handler = moduleCtx.httpHandlers[id];
		const [responseMetadata, responseBody] = responseIntoWire(callUserFunction(handler, new HandlerContextImpl(new Timestamp(timestamp), () => this.#dbView, this.#schema.submoduleDispatchInfos), requestFromWire(HttpRequest.deserialize(new BinaryReader(request)), body)));
		const responseBuf = new BinaryWriter(bsatnBaseSize(moduleCtx.typespace, HttpResponse.algebraicType));
		HttpResponse.serialize(responseBuf, responseMetadata);
		return [responseBuf.getBuffer(), responseBody];
	}
};
var BINARY_WRITER = new BinaryWriter(0);
var BINARY_READER = new BinaryReader(new Uint8Array());
var HandlerContextImpl = class {
	constructor(timestamp, dbView, dispatches = []) {
		this.timestamp = timestamp;
		this.#dbView = dbView;
		this.#dispatches = dispatches;
	}
	#identity;
	#uuidCounter;
	#random;
	#dbView;
	#dispatches;
	#asViews;
	http = httpClient;
	get identity() {
		return this.#identity ??= new Identity(sys.identity());
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	get as() {
		return this.#asViews ??= buildHandlerAliasCtxMap(this, this.#dispatches, "");
	}
	withTx(body) {
		const dispatches = this.#dispatches;
		return runWithTx((timestamp) => {
			const tx = new ReducerCtxImpl(Identity.zero(), timestamp, null, this.#dbView());
			if (dispatches.length > 0) tx.as = buildAliasCtxMap(tx, dispatches, "");
			return tx;
		}, body);
	}
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
function buildDbViewForDispatch(dispatch, namePrefix) {
	const tableEntries = dispatch.tables.map(({ accessorName, tableDef }) => [accessorName, makeTableView(dispatch.typespace, tableDef, namePrefix)]);
	const subNsEntries = dispatch.subDispatches.map((sub) => [sub.namespace, buildDbViewForDispatch(sub, namePrefix + sub.namespace + ".")]);
	return freeze(Object.fromEntries([...tableEntries, ...subNsEntries]));
}
function buildAliasCtx(parent, dispatch, namePrefix) {
	return {
		get sender() {
			return parent.sender;
		},
		get databaseIdentity() {
			return parent.databaseIdentity;
		},
		get identity() {
			return parent.identity;
		},
		get timestamp() {
			return parent.timestamp;
		},
		get connectionId() {
			return parent.connectionId;
		},
		get senderAuth() {
			return parent.senderAuth;
		},
		get random() {
			return parent.random;
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		},
		db: buildDbViewForDispatch(dispatch, namePrefix),
		as: buildAliasCtxMap(parent, dispatch.subDispatches, namePrefix)
	};
}
function buildAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function buildHandlerAliasCtx(parent, dispatch, namePrefix) {
	let nsDb_;
	return {
		get timestamp() {
			return parent.timestamp;
		},
		get http() {
			return parent.http;
		},
		get identity() {
			return parent.identity;
		},
		get random() {
			return parent.random;
		},
		as: buildHandlerAliasCtxMap(parent, dispatch.subDispatches, namePrefix),
		withTx(body) {
			return runWithTx((ts) => {
				const tx = new ReducerCtxImpl(Identity.zero(), ts, null, nsDb_ ??= buildDbViewForDispatch(dispatch, namePrefix));
				assignTxAliasViews(tx, dispatch.subDispatches, namePrefix);
				return tx;
			}, body);
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		}
	};
}
function buildHandlerAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildHandlerAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function buildProcedureAliasCtx(parent, dispatch, namePrefix) {
	let nsDb_;
	return {
		get sender() {
			return parent.sender;
		},
		get databaseIdentity() {
			return parent.databaseIdentity;
		},
		get identity() {
			return parent.identity;
		},
		get timestamp() {
			return parent.timestamp;
		},
		get connectionId() {
			return parent.connectionId;
		},
		get http() {
			return parent.http;
		},
		get random() {
			return parent.random;
		},
		as: buildProcedureAliasCtxMap(parent, dispatch.subDispatches, namePrefix),
		withTx(body) {
			return runWithTx((ts) => {
				const tx = new ReducerCtxImpl(parent.sender, ts, parent.connectionId, nsDb_ ??= buildDbViewForDispatch(dispatch, namePrefix));
				assignTxAliasViews(tx, dispatch.subDispatches, namePrefix);
				return tx;
			}, body);
		},
		newUuidV4() {
			return parent.newUuidV4();
		},
		newUuidV7() {
			return parent.newUuidV7();
		}
	};
}
function buildProcedureAliasCtxMap(parent, dispatches, parentPrefix) {
	return freeze(Object.fromEntries(dispatches.map((d) => [d.namespace, buildProcedureAliasCtx(parent, d, parentPrefix + d.namespace + ".")])));
}
function assignTxAliasViews(tx, dispatches, parentPrefix = "") {
	if (dispatches.length > 0) tx.as = buildAliasCtxMap(tx, dispatches, parentPrefix);
}
function makeTableView(typespace, table2, namePrefix = "") {
	const table_id = sys.table_id_from_name(namePrefix + table2.sourceName);
	const rowType = typespace.types[table2.productTypeRef];
	if (rowType.tag !== "Product") throw "impossible";
	const serializeRow = AlgebraicType.makeSerializer(rowType, typespace);
	const deserializeRow = AlgebraicType.makeDeserializer(rowType, typespace);
	const sequences = table2.sequences.map((seq) => {
		const col = rowType.value.elements[seq.column];
		const colType = col.algebraicType;
		let sequenceTrigger;
		switch (colType.tag) {
			case "U8":
			case "I8":
			case "U16":
			case "I16":
			case "U32":
			case "I32":
				sequenceTrigger = 0;
				break;
			case "U64":
			case "I64":
			case "U128":
			case "I128":
			case "U256":
			case "I256":
				sequenceTrigger = 0n;
				break;
			default: throw new TypeError("invalid sequence type");
		}
		return {
			colName: col.name,
			sequenceTrigger,
			deserialize: AlgebraicType.makeDeserializer(colType, typespace)
		};
	});
	const hasAutoIncrement = sequences.length > 0;
	const iter = () => tableIterator(sys.datastore_table_scan_bsatn(table_id), deserializeRow);
	const integrateGeneratedColumns = hasAutoIncrement ? (row, ret_buf) => {
		BINARY_READER.reset(ret_buf);
		for (const { colName, deserialize, sequenceTrigger } of sequences) if (row[colName] === sequenceTrigger) row[colName] = deserialize(BINARY_READER);
	} : null;
	const tableMethods = {
		count: () => sys.datastore_table_row_count(table_id),
		iter,
		[Symbol.iterator]: () => iter(),
		insert: (row) => {
			const buf = LEAF_BUF;
			BINARY_WRITER.reset(buf);
			serializeRow(BINARY_WRITER, row);
			sys.datastore_insert_bsatn(table_id, buf.buffer, BINARY_WRITER.offset);
			const ret = { ...row };
			integrateGeneratedColumns?.(ret, buf.view);
			return ret;
		},
		delete: (row) => {
			const buf = LEAF_BUF;
			BINARY_WRITER.reset(buf);
			BINARY_WRITER.writeU32(1);
			serializeRow(BINARY_WRITER, row);
			return sys.datastore_delete_all_by_eq_bsatn(table_id, buf.buffer, BINARY_WRITER.offset) > 0;
		},
		clear: () => sys.datastore_clear(table_id)
	};
	const tableView = Object.assign(/* @__PURE__ */ Object.create(null), tableMethods);
	for (const indexDef of table2.indexes) {
		const accessorName = indexDef.accessorName;
		const index_id = sys.index_id_from_name(namePrefix + indexDef.sourceName);
		let column_ids;
		let isHashIndex = false;
		switch (indexDef.algorithm.tag) {
			case "Hash":
				isHashIndex = true;
				column_ids = indexDef.algorithm.value;
				break;
			case "BTree":
				column_ids = indexDef.algorithm.value;
				break;
			case "Direct":
				column_ids = [indexDef.algorithm.value];
				break;
		}
		const numColumns = column_ids.length;
		const columnSet = new Set(column_ids);
		const isUnique = table2.constraints.filter((x) => x.data.tag === "Unique").some((x) => columnSet.isSubsetOf(new Set(x.data.value.columns)));
		const isPrimaryKey = isUnique && column_ids.length === table2.primaryKey.length && column_ids.every((id, i) => table2.primaryKey[i] === id);
		const indexSerializers = column_ids.map((id) => AlgebraicType.makeSerializer(rowType.value.elements[id].algebraicType, typespace));
		const serializePoint = (buffer, colVal) => {
			BINARY_WRITER.reset(buffer);
			for (let i = 0; i < numColumns; i++) indexSerializers[i](BINARY_WRITER, colVal[i]);
			return BINARY_WRITER.offset;
		};
		const serializeSingleElement = numColumns === 1 ? indexSerializers[0] : null;
		const serializeSinglePoint = serializeSingleElement && ((buffer, colVal) => {
			BINARY_WRITER.reset(buffer);
			serializeSingleElement(BINARY_WRITER, colVal);
			return BINARY_WRITER.offset;
		});
		let index;
		if (isUnique && serializeSinglePoint) {
			const base = {
				find: (colVal) => {
					const buf = LEAF_BUF;
					const point_len = serializeSinglePoint(buf, colVal);
					return tableIterateOne(sys.datastore_index_scan_point_bsatn(index_id, buf.buffer, point_len), deserializeRow);
				},
				delete: (colVal) => {
					const buf = LEAF_BUF;
					const point_len = serializeSinglePoint(buf, colVal);
					return sys.datastore_delete_by_index_scan_point_bsatn(index_id, buf.buffer, point_len) > 0;
				}
			};
			if (isPrimaryKey) base.update = (row) => {
				const buf = LEAF_BUF;
				BINARY_WRITER.reset(buf);
				serializeRow(BINARY_WRITER, row);
				sys.datastore_update_bsatn(table_id, index_id, buf.buffer, BINARY_WRITER.offset);
				integrateGeneratedColumns?.(row, buf.view);
				return row;
			};
			index = base;
		} else if (isUnique) {
			const base = {
				find: (colVal) => {
					if (colVal.length !== numColumns) throw new TypeError("wrong number of elements");
					const buf = LEAF_BUF;
					const point_len = serializePoint(buf, colVal);
					return tableIterateOne(sys.datastore_index_scan_point_bsatn(index_id, buf.buffer, point_len), deserializeRow);
				},
				delete: (colVal) => {
					if (colVal.length !== numColumns) throw new TypeError("wrong number of elements");
					const buf = LEAF_BUF;
					const point_len = serializePoint(buf, colVal);
					return sys.datastore_delete_by_index_scan_point_bsatn(index_id, buf.buffer, point_len) > 0;
				}
			};
			if (isPrimaryKey) base.update = (row) => {
				const buf = LEAF_BUF;
				BINARY_WRITER.reset(buf);
				serializeRow(BINARY_WRITER, row);
				sys.datastore_update_bsatn(table_id, index_id, buf.buffer, BINARY_WRITER.offset);
				integrateGeneratedColumns?.(row, buf.view);
				return row;
			};
			index = base;
		} else if (serializeSinglePoint) {
			const serializeSingleRange = !isHashIndex ? (buffer, range) => {
				BINARY_WRITER.reset(buffer);
				const writer = BINARY_WRITER;
				const writeBound = (bound) => {
					writer.writeU8({
						included: 0,
						excluded: 1,
						unbounded: 2
					}[bound.tag]);
					if (bound.tag !== "unbounded") serializeSingleElement(writer, bound.value);
				};
				writeBound(range.from);
				const rstartLen = writer.offset;
				writeBound(range.to);
				return [
					0,
					0,
					rstartLen,
					writer.offset - rstartLen
				];
			} : null;
			const rawIndex = {
				filter: (range) => {
					const buf = LEAF_BUF;
					if (serializeSingleRange && range instanceof Range) {
						const args = serializeSingleRange(buf, range);
						return tableIterator(sys.datastore_index_scan_range_bsatn(index_id, buf.buffer, ...args), deserializeRow);
					}
					const point_len = serializeSinglePoint(buf, range);
					return tableIterator(sys.datastore_index_scan_point_bsatn(index_id, buf.buffer, point_len), deserializeRow);
				},
				delete: (range) => {
					const buf = LEAF_BUF;
					if (serializeSingleRange && range instanceof Range) {
						const args = serializeSingleRange(buf, range);
						return sys.datastore_delete_by_index_scan_range_bsatn(index_id, buf.buffer, ...args);
					}
					const point_len = serializeSinglePoint(buf, range);
					return sys.datastore_delete_by_index_scan_point_bsatn(index_id, buf.buffer, point_len);
				}
			};
			if (isHashIndex) index = rawIndex;
			else index = rawIndex;
		} else if (isHashIndex) index = {
			filter: (range) => {
				const buf = LEAF_BUF;
				const point_len = serializePoint(buf, range);
				return tableIterator(sys.datastore_index_scan_point_bsatn(index_id, buf.buffer, point_len), deserializeRow);
			},
			delete: (range) => {
				const buf = LEAF_BUF;
				const point_len = serializePoint(buf, range);
				return sys.datastore_delete_by_index_scan_point_bsatn(index_id, buf.buffer, point_len);
			}
		};
		else {
			const isCompleteScalarKey = (range) => {
				return range.length === numColumns && !(range[range.length - 1] instanceof Range);
			};
			const serializeRange = (buffer, range) => {
				if (range.length > numColumns) throw new TypeError("too many elements");
				BINARY_WRITER.reset(buffer);
				const writer = BINARY_WRITER;
				const prefix_elems = range.length - 1;
				for (let i = 0; i < prefix_elems; i++) indexSerializers[i](writer, range[i]);
				const rstartOffset = writer.offset;
				const term = range[range.length - 1];
				const serializeTerm = indexSerializers[range.length - 1];
				if (term instanceof Range) {
					const writeBound = (bound) => {
						writer.writeU8({
							included: 0,
							excluded: 1,
							unbounded: 2
						}[bound.tag]);
						if (bound.tag !== "unbounded") serializeTerm(writer, bound.value);
					};
					writeBound(term.from);
					const rstartLen = writer.offset - rstartOffset;
					writeBound(term.to);
					return [
						rstartOffset,
						prefix_elems,
						rstartLen,
						writer.offset - rstartOffset - rstartLen
					];
				} else {
					writer.writeU8(0);
					serializeTerm(writer, term);
					return [
						rstartOffset,
						prefix_elems,
						writer.offset - rstartOffset,
						0
					];
				}
			};
			index = {
				filter: (range) => {
					if (!Array.isArray(range)) range = [range];
					if (isCompleteScalarKey(range)) {
						const buf = LEAF_BUF;
						const point_len = serializePoint(buf, range);
						return tableIterator(sys.datastore_index_scan_point_bsatn(index_id, buf.buffer, point_len), deserializeRow);
					} else {
						const buf = LEAF_BUF;
						const args = serializeRange(buf, range);
						return tableIterator(sys.datastore_index_scan_range_bsatn(index_id, buf.buffer, ...args), deserializeRow);
					}
				},
				delete: (range) => {
					if (!Array.isArray(range)) range = [range];
					if (isCompleteScalarKey(range)) {
						const buf = LEAF_BUF;
						const point_len = serializePoint(buf, range);
						return sys.datastore_delete_by_index_scan_point_bsatn(index_id, buf.buffer, point_len);
					} else {
						const buf = LEAF_BUF;
						const args = serializeRange(buf, range);
						return sys.datastore_delete_by_index_scan_range_bsatn(index_id, buf.buffer, ...args);
					}
				}
			};
		}
		if (Object.hasOwn(tableView, accessorName)) freeze(Object.assign(tableView[accessorName], index));
		else tableView[accessorName] = freeze(index);
	}
	return freeze(tableView);
}
function* tableIterator(id, deserialize) {
	using iter = new IteratorHandle(id);
	const iterBuf = takeBuf();
	try {
		let amt;
		while (amt = iter.advance(iterBuf)) {
			const reader = new BinaryReader(iterBuf.view);
			while (reader.offset < amt) yield deserialize(reader);
		}
	} finally {
		returnBuf(iterBuf);
	}
}
function tableIterateOne(id, deserialize) {
	const buf = LEAF_BUF;
	if (advanceIterRaw(id, buf) !== 0) {
		BINARY_READER.reset(buf.view);
		return deserialize(BINARY_READER);
	}
	return null;
}
function advanceIterRaw(id, buf) {
	while (true) try {
		return 0 | sys.row_iter_bsatn_advance(id, buf.buffer);
	} catch (e) {
		if (e && typeof e === "object" && hasOwn(e, "__buffer_too_small__")) {
			buf.grow(e.__buffer_too_small__);
			continue;
		}
		throw e;
	}
}
var DEFAULT_BUFFER_CAPACITY = 32 * 1024 * 2;
var ITER_BUFS = [new ResizableBuffer(DEFAULT_BUFFER_CAPACITY)];
var ITER_BUF_COUNT = 1;
function takeBuf() {
	return ITER_BUF_COUNT ? ITER_BUFS[--ITER_BUF_COUNT] : new ResizableBuffer(DEFAULT_BUFFER_CAPACITY);
}
function returnBuf(buf) {
	ITER_BUFS[ITER_BUF_COUNT++] = buf;
}
var LEAF_BUF = new ResizableBuffer(DEFAULT_BUFFER_CAPACITY);
var IteratorHandle = class _IteratorHandle {
	#id;
	static #finalizationRegistry = new FinalizationRegistry(sys.row_iter_bsatn_close);
	constructor(id) {
		this.#id = id;
		_IteratorHandle.#finalizationRegistry.register(this, id, this);
	}
	/** Unregister this object with the finalization registry and return the id */
	#detach() {
		const id = this.#id;
		this.#id = -1;
		_IteratorHandle.#finalizationRegistry.unregister(this);
		return id;
	}
	/** Call `row_iter_bsatn_advance`, returning 0 if this iterator has been exhausted. */
	advance(buf) {
		if (this.#id === -1) return 0;
		const ret = advanceIterRaw(this.#id, buf);
		if (ret <= 0) this.#detach();
		return ret < 0 ? -ret : ret;
	}
	[Symbol.dispose]() {
		if (this.#id >= 0) {
			const id = this.#detach();
			sys.row_iter_bsatn_close(id);
		}
	}
};
var { freeze: freeze2 } = Object;
var requestBaseSize = bsatnBaseSize({ types: [] }, HttpRequest.algebraicType);
function fetch(url, init = {}) {
	const method = serializeMethod(init.method);
	const headers = serializeHeaders(new Headers(init.headers));
	const uri = "" + url;
	const request = freeze2({
		method,
		headers,
		timeout: init.timeout,
		uri,
		version: { tag: "Http11" }
	});
	const requestBuf = new BinaryWriter(requestBaseSize);
	HttpRequest.serialize(requestBuf, request);
	const body = init.body == null ? new Uint8Array() : typeof init.body === "string" ? init.body : new Uint8Array(init.body);
	const [responseBuf, responseBody] = sys.procedure_http_request(requestBuf.getBuffer(), body);
	const response = HttpResponse.deserialize(new BinaryReader(responseBuf));
	return SyncResponse[makeResponse](responseBody, {
		type: "basic",
		url: uri,
		status: response.code,
		statusText: (0, import_statuses.default)(response.code),
		headers: deserializeHeaders(response.headers),
		aborted: false,
		version: response.version
	});
}
freeze2(fetch);
var httpClient = freeze2({ fetch });
function makeProcedureExport(ctx, opts, params, ret, fn) {
	const name = opts?.name;
	const procedureExport = (...args) => fn(...args);
	procedureExport[exportContext] = ctx;
	procedureExport[registerExport] = (ctx2, exportName) => {
		registerProcedure(ctx2, name ?? exportName, params, ret, fn);
		ctx2.functionExports.set(procedureExport, name ?? exportName);
		if (opts?.onSchedule !== void 0) ctx2.pendingSchedules.push({
			table: opts.onSchedule,
			functionName: name ?? exportName
		});
	};
	return procedureExport;
}
var TransactionCtxImpl = class TransactionCtx extends ReducerCtxImpl {};
function registerProcedure(ctx, exportName, params, ret, fn, opts) {
	ctx.defineFunction(exportName);
	const paramsType = { elements: Object.entries(params).map(([n, c]) => ({
		name: n,
		algebraicType: ctx.registerTypesRecursively("typeBuilder" in c ? c.typeBuilder : c).algebraicType
	})) };
	const returnType = ctx.registerTypesRecursively(ret).algebraicType;
	ctx.moduleDef.procedures.push({
		sourceName: exportName,
		params: paramsType,
		returnType,
		visibility: FunctionVisibility.ClientCallable
	});
	const { typespace } = ctx;
	ctx.procedures.push({
		fn,
		deserializeArgs: ProductType.makeDeserializer(paramsType, typespace),
		serializeReturn: AlgebraicType.makeSerializer(returnType, typespace),
		returnTypeBaseSize: bsatnBaseSize(typespace, returnType)
	});
}
function callProcedure(procedures, id, sender, connectionId, timestamp, argsBuf, dbView, dispatches = [], parentPrefix = "") {
	const { fn, deserializeArgs, serializeReturn, returnTypeBaseSize } = procedures[id];
	const args = deserializeArgs(new BinaryReader(argsBuf));
	const ret = callUserFunction(fn, new ProcedureCtxImpl(sender, timestamp, connectionId, dbView, dispatches, parentPrefix), args);
	const retBuf = new BinaryWriter(returnTypeBaseSize);
	serializeReturn(retBuf, ret);
	return retBuf.getBuffer();
}
var ProcedureCtxImpl = class ProcedureCtx {
	constructor(sender, timestamp, connectionId, dbView, dispatches = [], parentPrefix = "") {
		this.sender = sender;
		this.timestamp = timestamp;
		this.connectionId = connectionId;
		this.#dbView = dbView;
		this.#dispatches = dispatches;
		this.#parentPrefix = parentPrefix;
	}
	#identity;
	#uuidCounter;
	#random;
	#dbView;
	#dispatches;
	#parentPrefix;
	#asViews;
	get databaseIdentity() {
		return this.#identity ??= new Identity(sys.identity());
	}
	get identity() {
		return this.databaseIdentity;
	}
	get random() {
		return this.#random ??= makeRandom(this.timestamp);
	}
	get http() {
		return httpClient;
	}
	get as() {
		return this.#asViews ??= buildProcedureAliasCtxMap(this, this.#dispatches, this.#parentPrefix);
	}
	withTx(body) {
		const dispatches = this.#dispatches;
		const parentPrefix = this.#parentPrefix;
		return runWithTx((timestamp) => {
			const tx = new TransactionCtxImpl(this.sender, timestamp, this.connectionId, this.#dbView());
			assignTxAliasViews(tx, dispatches, parentPrefix);
			return tx;
		}, body);
	}
	newUuidV4() {
		const bytes = this.random.fill(new Uint8Array(16));
		return Uuid.fromRandomBytesV4(bytes);
	}
	newUuidV7() {
		const bytes = this.random.fill(new Uint8Array(4));
		const counter = this.#uuidCounter ??= { value: 0 };
		return Uuid.fromCounterV7(counter, this.timestamp, bytes);
	}
};
function makeReducerExport(ctx, opts, params, fn, lifecycle) {
	const reducerExport = (...args) => fn(...args);
	reducerExport[exportContext] = ctx;
	reducerExport[registerExport] = (ctx2, exportName) => {
		registerReducer(ctx2, exportName, params, fn, opts, lifecycle);
		ctx2.functionExports.set(reducerExport, exportName);
		if (opts?.onSchedule !== void 0) ctx2.pendingSchedules.push({
			table: opts.onSchedule,
			functionName: exportName
		});
	};
	return reducerExport;
}
function registerReducer(ctx, exportName, params, fn, opts, lifecycle) {
	ctx.defineFunction(exportName);
	if (!(params instanceof RowBuilder)) params = new RowBuilder(params);
	if (params.typeName === void 0) params.typeName = toPascalCase(exportName);
	const ref = ctx.registerTypesRecursively(params);
	const paramsType = ctx.resolveType(ref).value;
	const isLifecycle = lifecycle != null;
	ctx.moduleDef.reducers.push({
		sourceName: exportName,
		params: paramsType,
		visibility: FunctionVisibility.ClientCallable,
		okReturnType: AlgebraicType.Product({ elements: [] }),
		errReturnType: AlgebraicType.String
	});
	if (opts?.name != null) ctx.moduleDef.explicitNames.entries.push({
		tag: "Function",
		value: {
			sourceName: exportName,
			canonicalName: opts.name
		}
	});
	if (isLifecycle) ctx.moduleDef.lifeCycleReducers.push({
		lifecycleSpec: lifecycle,
		functionName: exportName
	});
	if (!fn.name) Object.defineProperty(fn, "name", {
		value: exportName,
		writable: false
	});
	ctx.reducers.push(fn);
}
var SchemaInner = class extends ModuleContext {
	schemaType;
	exportsRegistered = false;
	schedulesResolved = false;
	existingFunctions = /* @__PURE__ */ new Set();
	existingHttpHandlers = /* @__PURE__ */ new Set();
	reducers = [];
	procedures = [];
	views = [];
	anonViews = [];
	httpHandlers = [];
	/**
	* Maps reducer/procedure export objects to their source names.
	* Used for resolving scheduled table targets.
	*/
	functionExports = /* @__PURE__ */ new Map();
	tableSourceNames = /* @__PURE__ */ new Map();
	httpHandlerExports = /* @__PURE__ */ new Map();
	pendingSchedules = [];
	pendingHttpRoutes = [];
	submoduleDispatchInfos = [];
	constructor(getSchemaType) {
		super();
		this.schemaType = getSchemaType(this);
	}
	defineFunction(name) {
		if (this.existingFunctions.has(name)) throw new TypeError(`There is already a reducer, procedure, or view with the name '${name}'`);
		this.existingFunctions.add(name);
	}
	defineHttpHandler(name) {
		if (this.existingHttpHandlers.has(name)) throw new TypeError(`There is already an HTTP handler with the name '${name}'`);
		this.existingHttpHandlers.add(name);
	}
	resolveSchedules() {
		if (this.schedulesResolved) return;
		this.schedulesResolved = true;
		const scheduledTables = /* @__PURE__ */ new Map();
		for (const { functionName: knownFunctionName, reducer, table: table2, tableName: knownTableName, scheduleAtCol: knownScheduleAtCol } of this.pendingSchedules) {
			let tableName = knownTableName;
			if (tableName === void 0) {
				const tableNames = this.tableSourceNames.get(table2);
				if (tableNames !== void 0 && tableNames.length > 1) throw new TypeError("Schedule target table is registered more than once in this schema. Use a distinct table handle for each scheduled table.");
				tableName = tableNames?.[0];
			}
			if (tableName === void 0) throw new TypeError("Schedule target table is not part of this schema.");
			const scheduleAtCol = knownScheduleAtCol ?? table2.scheduleAtCol;
			if (scheduleAtCol === void 0) throw new TypeError(`Table ${tableName} defines a schedule, but it does not have a ScheduleAt column.`);
			const functionName = knownFunctionName ?? (reducer === void 0 ? void 0 : this.functionExports.get(reducer()));
			if (functionName === void 0) {
				const msg = `Table ${tableName} defines a schedule, but it seems like the associated function was not exported.`;
				throw new TypeError(msg);
			}
			const existingFunctionName = scheduledTables.get(tableName);
			if (existingFunctionName !== void 0) throw new TypeError(`Table ${tableName} defines multiple schedules: ${existingFunctionName} and ${functionName}. A schedule table can only be used by one reducer or procedure.`);
			scheduledTables.set(tableName, functionName);
			this.moduleDef.schedules.push({
				sourceName: void 0,
				tableName,
				scheduleAtCol,
				functionName
			});
		}
	}
	resolveHttpRoutes() {
		for (const route of this.pendingHttpRoutes) {
			const handlerFunction = this.httpHandlerExports.get(route.handler);
			if (handlerFunction === void 0) throw new TypeError(`HTTP route for path '${route.path}' refers to a handler that was not exported.`);
			this.moduleDef.httpRoutes.push({
				handlerFunction,
				method: route.method,
				path: route.path
			});
		}
	}
};
var Schema = class {
	#ctx;
	constructor(ctx) {
		this.#ctx = ctx;
	}
	[moduleHooks](exports) {
		this.buildRawModuleDefV10(exports);
		this.#ctx.resolveHttpRoutes();
		return makeHooks(this.#ctx);
	}
	get schemaType() {
		return this.#ctx.schemaType;
	}
	get moduleDef() {
		return this.#ctx.moduleDef;
	}
	get typespace() {
		return this.#ctx.typespace;
	}
	get submoduleDispatchInfos() {
		return this.#ctx.submoduleDispatchInfos;
	}
	/** Internal: register exports and materialize the RawModuleDefV10 for upload. */
	buildRawModuleDefV10(exports, opts) {
		registerModuleExports(this.#ctx, exports, { ignoreNonModuleExports: opts?.ignoreNonModuleExports ?? false });
		this.#ctx.resolveSchedules();
		return this.#ctx.rawModuleDefV10();
	}
	/**
	* @internal – called by schema() when processing a submodule namespace entry.
	* Registers the library's exports and returns both the serialized module def
	* and the runtime dispatch info needed by ModuleHooksImpl for __call_reducer__.
	*/
	buildSubmoduleDispatch(exports) {
		const rawDef = this.buildRawModuleDefV10(exports, { ignoreNonModuleExports: true });
		this.#ctx.resolveHttpRoutes();
		return {
			rawDef,
			dispatch: {
				namespace: "",
				reducerFns: [...this.#ctx.reducers],
				reducerDefs: [...this.#ctx.moduleDef.reducers],
				procedureFns: [...this.#ctx.procedures],
				procedureDefs: [...this.#ctx.moduleDef.procedures],
				anonViewFns: [...this.#ctx.anonViews],
				viewFns: [...this.#ctx.views],
				typespace: this.#ctx.moduleDef.typespace,
				tables: Object.values(this.#ctx.schemaType.tables).map((t2) => ({
					accessorName: t2.accessorName,
					tableDef: t2.tableDef
				})),
				schemaTables: this.#ctx.schemaType.tables,
				subDispatches: [...this.#ctx.submoduleDispatchInfos]
			}
		};
	}
	reducer(...args) {
		let opts, params = {}, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2: {
				let arg1;
				[arg1, fn] = args;
				if (typeof arg1.name === "string") opts = arg1;
				else params = arg1;
				break;
			}
			case 3:
				[opts, params, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, params, fn);
	}
	init(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.Init);
	}
	clientConnected(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.OnConnect);
	}
	clientDisconnected(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeReducerExport(this.#ctx, opts, {}, fn, Lifecycle.OnDisconnect);
	}
	view(opts, ret, fn, ..._) {
		return makeViewExport(this.#ctx, opts, {}, ret, fn);
	}
	anonymousView(opts, ret, fn, ..._) {
		return makeAnonViewExport(this.#ctx, opts, {}, ret, fn);
	}
	procedure(...args) {
		let opts, params = {}, ret, fn;
		switch (args.length) {
			case 2:
				[ret, fn] = args;
				break;
			case 3: {
				let arg1;
				[arg1, ret, fn] = args;
				if (typeof arg1.name === "string") opts = arg1;
				else params = arg1;
				break;
			}
			case 4:
				[opts, params, ret, fn] = args;
				break;
		}
		return makeProcedureExport(this.#ctx, opts, params, ret, fn);
	}
	httpHandler(...args) {
		let opts, fn;
		switch (args.length) {
			case 1:
				[fn] = args;
				break;
			case 2:
				[opts, fn] = args;
				break;
		}
		return makeHttpHandlerExport(this.#ctx, opts, fn);
	}
	httpRouter(router) {
		return makeHttpRouterExport(this.#ctx, router);
	}
	/**
	* Bundle multiple reducers, procedures, etc into one value to export.
	* The name they will be exported with is their corresponding key in the `exports` argument.
	*/
	exportGroup(exports) {
		return {
			[exportContext]: this.#ctx,
			[registerExport](ctx, _exportName) {
				for (const [exportName, moduleExport] of Object.entries(exports)) {
					checkExportContext(moduleExport, ctx);
					moduleExport[registerExport](ctx, exportName);
				}
			}
		};
	}
	clientVisibilityFilter = { sql: (filter) => ({
		[exportContext]: this.#ctx,
		[registerExport](ctx, _exportName) {
			ctx.moduleDef.rowLevelSecurity.push({ sql: filter });
		}
	}) };
};
var registerExport = Symbol("SpacetimeDB.registerExport");
var exportContext = Symbol("SpacetimeDB.exportContext");
function isModuleExport(x) {
	return (typeof x === "function" || typeof x === "object") && x !== null && registerExport in x;
}
function checkExportContext(exp, schema2) {
	if (exp[exportContext] != null && exp[exportContext] !== schema2) throw new TypeError("multiple schemas are not supported");
}
function isUntypedTableSchema(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "tableDef");
}
function isSubmoduleNamespace(x) {
	return typeof x === "object" && x !== null && hasOwn(x, "default") && x.default instanceof Schema;
}
function registerModuleExports(schema2, exports, opts) {
	if (schema2.exportsRegistered) return;
	schema2.exportsRegistered = true;
	for (const [name, moduleExport] of Object.entries(exports)) {
		if (name === "default") continue;
		if (!isModuleExport(moduleExport)) {
			if (opts?.ignoreNonModuleExports) continue;
			throw new TypeError("exporting something that is not a spacetime export");
		}
		checkExportContext(moduleExport, schema2);
		moduleExport[registerExport](schema2, name);
	}
}
function schema(entries, moduleSettings) {
	return new Schema(new SchemaInner((ctx2) => {
		if (moduleSettings?.CASE_CONVERSION_POLICY != null) ctx2.setCaseConversionPolicy(moduleSettings.CASE_CONVERSION_POLICY);
		const tableSchemas = {};
		for (const [accName, entry] of Object.entries(entries)) {
			if (entry instanceof Schema) throw new TypeError(`schema entry '${accName}' looks like a default import; use \`import * as ${accName} from '...'\` so the submodule can see the library's named reducer exports.`);
			if (isSubmoduleNamespace(entry)) {
				const { rawDef, dispatch } = entry.default.buildSubmoduleDispatch(entry);
				dispatch.namespace = accName;
				ctx2.addSubmodule({
					namespace: accName,
					module: rawDef
				});
				ctx2.submoduleDispatchInfos.push(dispatch);
				continue;
			}
			if (!isUntypedTableSchema(entry)) throw new TypeError(`schema entry '${accName}' must be a table or a submodule namespace object`);
			const table2 = entry;
			const tableDef = table2.tableDef(ctx2, accName);
			tableSchemas[accName] = tableToSchema(accName, table2, tableDef);
			const tableSourceNames = ctx2.tableSourceNames.get(table2);
			if (tableSourceNames === void 0) ctx2.tableSourceNames.set(table2, [tableDef.sourceName]);
			else tableSourceNames.push(tableDef.sourceName);
			ctx2.moduleDef.tables.push(tableDef);
			if (table2.schedule) ctx2.pendingSchedules.push({
				table: table2,
				tableName: tableDef.sourceName,
				scheduleAtCol: table2.schedule.scheduleAtCol,
				reducer: table2.schedule.reducer
			});
			if (table2.tableName) ctx2.moduleDef.explicitNames.entries.push({
				tag: "Table",
				value: {
					sourceName: accName,
					canonicalName: table2.tableName
				}
			});
		}
		return { tables: tableSchemas };
	}));
}
var import_object_inspect = __toESM(require_object_inspect());
var fmtLog = (...data) => data.map((x) => typeof x === "string" ? x : (0, import_object_inspect.default)(x)).join(" ");
var console_level_error = 0;
var console_level_warn = 1;
var console_level_info = 2;
var console_level_debug = 3;
var console_level_trace = 4;
var timerMap = /* @__PURE__ */ new Map();
var console2 = {
	__proto__: {},
	[Symbol.toStringTag]: "console",
	assert: (condition = false, ...data) => {
		if (!condition) sys.console_log(console_level_error, fmtLog(...data));
	},
	clear: () => {},
	debug: (...data) => {
		sys.console_log(console_level_debug, fmtLog(...data));
	},
	error: (...data) => {
		sys.console_log(console_level_error, fmtLog(...data));
	},
	info: (...data) => {
		sys.console_log(console_level_info, fmtLog(...data));
	},
	log: (...data) => {
		sys.console_log(console_level_info, fmtLog(...data));
	},
	table: (tabularData, _properties) => {
		sys.console_log(console_level_info, fmtLog(tabularData));
	},
	trace: (...data) => {
		sys.console_log(console_level_trace, fmtLog(...data));
	},
	warn: (...data) => {
		sys.console_log(console_level_warn, fmtLog(...data));
	},
	dir: (_item, _options) => {},
	dirxml: (..._data) => {},
	count: (_label = "default") => {},
	countReset: (_label = "default") => {},
	group: (..._data) => {},
	groupCollapsed: (..._data) => {},
	groupEnd: () => {},
	time: (label = "default") => {
		if (timerMap.has(label)) {
			sys.console_log(console_level_warn, `Timer '${label}' already exists.`);
			return;
		}
		timerMap.set(label, sys.console_timer_start(label));
	},
	timeLog: (label = "default", ...data) => {
		sys.console_log(console_level_info, fmtLog(label, ...data));
	},
	timeEnd: (label = "default") => {
		const spanId = timerMap.get(label);
		if (spanId === void 0) {
			sys.console_log(console_level_warn, `Timer '${label}' does not exist.`);
			return;
		}
		sys.console_timer_end(spanId);
		timerMap.delete(label);
	},
	timeStamp: () => {},
	profile: () => {},
	profileEnd: () => {}
};
globalThis.console = console2;

//#endregion
//#region src/schema.ts
/**
* SNAP ARENA's schema, ported from the Convex original.
*
* Three rules govern everything below, and they are what makes this a port
* rather than a transcription:
*
* 1. PRIVATE BY DEFAULT, AND PRIVATE MEANS PRIVATE. A Convex query could read a
*    document and return part of it. A SpacetimeDB subscription hands the client
*    the whole row. So anything a player must not see — the songs in play, the
*    aliases that match them, the text of an opponent's guess — lives in a
*    private table, and what the player MAY see is materialised into a separate
*    public table by the reducer that changes it. See `round_reveal`.
*
* 2. ORGANISE BY UPDATE FREQUENCY. A row is the unit of replication: touching one
*    field re-sends the row to every subscriber. Fields written per-guess are
*    kept apart from fields written once per match.
*
* 3. REAL CONSTRAINTS. The Convex schema carried seven fields commented "UNIQUE"
*    and enforced by hand inside mutations, because Convex has no unique
*    constraints. SpacetimeDB does, so those comments become `.unique()` and the
*    hand-rolled checks go away.
*
* Naming: table `name` and the `schema({...})` key are both snake_case and must
* match — the key is the `ctx.db` accessor verbatim.
*/
/**
* `mode`, `status` and `phase` stay STRINGS rather than becoming `t.enum` sum
* types, which is the one place this port knowingly declines the more idiomatic
* option.
*
* Two reasons. Subscriptions filter on them (`match.where(r => r.status.eq(...))`)
* and the query builder's comparison operators are defined over scalars, not over
* tagged unions. And the client compares them as strings in ~40 places
* (`phase === "guessing"`); a sum type would turn every one of those into
* `phase.tag === "guessing"` for no behavioural gain.
*
* Convex stored these as `v.union` of string literals, which is also a string on
* the wire, so this is not a change in representation — only in what the type
* system checks. The engine's own `MatchPhase` union in src/engine/config.ts
* remains the source of truth and still type-checks every write.
*/
/** Damage dealt to one player by one round. */
const RoundDamage = t.object("RoundDamage", {
	userId: t.u64(),
	damage: t.f64(),
	hpAfter: t.f64()
});
/** One player's outcome in one round. */
const RoundPlayerResult = t.object("RoundPlayerResult", {
	userId: t.u64(),
	points: t.f64(),
	elapsedMs: t.option(t.f64()),
	solved: t.bool()
});
/**
* One closed round.
*
* Stored rather than recomputed from guesses, for the reason the Convex schema
* gave: the multiplier, the tie rules and the score curve are all expected to be
* retuned, and a recomputed history would silently rewrite finished matches.
*/
const RoundLogEntry = t.object("RoundLogEntry", {
	roundIndex: t.i32(),
	outcome: t.string(),
	winnerId: t.option(t.u64()),
	timeGapMs: t.option(t.f64()),
	multiplier: t.f64(),
	damage: t.array(RoundDamage),
	results: t.array(RoundPlayerResult)
});
/** One line of the post-match XP breakdown ("Rounds won x3"). */
const XpAward = t.object("XpAward", {
	reason: t.string(),
	amount: t.f64()
});
/** One stored config override: a dotted path into ResolvedConfig, and its value. */
const ConfigOverride = t.object("ConfigOverride", {
	key: t.string(),
	value: t.option(t.f64())
});
/**
* The identity → player mapping. This is the old `by_clerk_id` index.
*
* Kept as its own table rather than an `identity` column on `user` for one
* reason: BOTS ARE ORDINARY USER ROWS (the invariant the Convex schema leaned on
* so every join and match flow works unchanged), and a bot has no connection and
* therefore no Identity. A separate table lets the mapping be total and unique on
* the rows that have one, instead of nullable-unique on the rows that do not.
*
* Private: a client learns its own userId through the `me` view. Publishing the
* whole identity↔player mapping would let anyone enumerate the player base.
*/
const account = table({ name: "account" }, {
	identity: t.identity().primaryKey(),
	userId: t.u64().unique(),
	issuer: t.string(),
	createdAt: t.timestamp()
});
/**
* A player. Public — handles, ratings and levels are shown all over the app.
*
* `avatarUrl` keeps its exact three-form contract from the Convex schema:
*
*   `color:#rrggbb`   a swatch chosen during onboarding, rendered as an initial
*   an https URL      Clerk's picture at sign-up, or this module's own
*                     /route/avatar/:userId for an upload
*   absent            falls back to the initial on ink
*
* The uploaded bytes live in `user_avatar`, not here, so the leaderboard can read
* 500 of these rows without pulling 500 images down the socket.
*/
const user = table({
	name: "user",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	handle: t.string().unique(),
	displayName: t.string(),
	avatarUrl: t.option(t.string()),
	avatarHidden: t.bool(),
	elo: t.i32().index("btree"),
	gamesPlayed: t.i32(),
	placementsRemaining: t.i32(),
	createdAt: t.timestamp(),
	role: t.option(t.string()),
	xp: t.f64(),
	level: t.i32(),
	rankedWins: t.i32(),
	snapGuesses: t.i32(),
	onboardedAt: t.option(t.timestamp()),
	welcomeStep: t.option(t.i32()),
	tutorialCompletedAt: t.option(t.timestamp()),
	bio: t.option(t.string()),
	bioHidden: t.bool(),
	isBot: t.bool().index("btree"),
	botPersonaId: t.option(t.string()),
	lastPracticePersonaId: t.option(t.string()),
	isGuest: t.bool().index("btree"),
	guestClaimedAt: t.option(t.timestamp()),
	guestClaimToken: t.option(t.string())
});
/**
* Player preferences that are read on their own screens and written rarely.
*
* Split out of `user` because `user` is the single most-subscribed table in the
* app — the shell, the queue driver, every VS card and the leaderboard all hold
* rows from it — and a player reordering their favourite genres has no business
* re-sending their row to everyone watching the ladder.
*/
const user_preference = table({
	name: "user_preference",
	public: true
}, {
	userId: t.u64().primaryKey(),
	preferredCategoryIds: t.array(t.u64())
});
/**
* Uploaded avatar bytes. PRIVATE, and served over HTTP instead.
*
* Convex stored a resolved storage URL on the user row so the ladder could render
* 500 avatars without 500 storage lookups. The same pressure applies here for a
* different reason: these rows are ~30KB of webp each, and a public table would
* push all of them over the WebSocket to anyone subscribed. The module's own
* /route/avatar/:userId handler serves them, so the browser caches them like any
* other image and `user.avatarUrl` keeps pointing at a plain URL.
*/
const user_avatar = table({ name: "user_avatar" }, {
	userId: t.u64().primaryKey(),
	mimeType: t.string(),
	data: t.array(t.u8()),
	version: t.i32(),
	uploadedAt: t.timestamp()
});
/** Bio and avatar reports, for manual review. No automated takedown. */
const report = table({ name: "report" }, {
	id: t.u64().primaryKey().autoInc(),
	reportedUserId: t.u64().index("btree"),
	reporterUserId: t.u64(),
	kind: t.string(),
	reason: t.string(),
	createdAt: t.timestamp(),
	resolvedAt: t.option(t.timestamp())
});
/** Awarded badges. One row per player per badge. */
const user_badge = table({
	name: "user_badge",
	public: true,
	indexes: [{
		accessor: "by_user_badge",
		algorithm: "btree",
		columns: ["userId", "badgeId"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	userId: t.u64().index("btree"),
	badgeId: t.string(),
	earnedAt: t.timestamp()
});
/** Per-genre skill, shown on the profile and used to pick a "best category". */
const category_rating = table({
	name: "category_rating",
	public: true,
	indexes: [{
		accessor: "by_user_category",
		algorithm: "btree",
		columns: ["userId", "categoryId"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	userId: t.u64().index("btree"),
	categoryId: t.u64(),
	rating: t.f64(),
	games: t.i32()
});
const category = table({
	name: "category",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	slug: t.string().unique(),
	name: t.string(),
	sortOrder: t.i32()
});
/**
* The song catalogue. PRIVATE — this table IS the answer key.
*
* In the Convex version `matches.state` was careful to omit the current round's
* track until the reveal beat, but the catalogue itself was readable by any
* signed-in caller, because reading it required calling a query that chose what
* to return. Here there is no such choke point: a public table is simply
* downloadable. So nothing outside the module ever sees a row of this.
*
* What players are allowed to hear and then see is copied into `round_reveal` by
* the phase reducers, and the autocomplete list is copied into `track_index`.
*/
const track = table({
	name: "track",
	indexes: [{
		accessor: "by_playable_difficulty",
		algorithm: "btree",
		columns: ["playable", "difficulty"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	itunesTrackId: t.i64().unique(),
	title: t.string(),
	titleNormalized: t.string().index("btree"),
	artist: t.string(),
	artistNormalized: t.string(),
	artworkUrl: t.string(),
	previewUrl: t.string(),
	previewCheckedAt: t.timestamp(),
	categoryIds: t.array(t.u64()),
	difficulty: t.i32(),
	popularity: t.i32(),
	releaseYear: t.i32(),
	playable: t.bool(),
	medianSolveMs: t.option(t.f64()),
	solveSampleCount: t.i32()
});
/** Accepted alternate spellings. PRIVATE for the same reason as `track`. */
const track_alias = table({ name: "track_alias" }, {
	id: t.u64().primaryKey().autoInc(),
	trackId: t.u64().index("btree"),
	aliasNormalized: t.string().index("btree")
});
/**
* The autocomplete title list, precomputed. Exactly one row.
*
* This is now the ONLY autocomplete path. Convex had a full-text search index on
* `tracks` behind a `tracks.autocomplete` query; SpacetimeDB has no full-text
* search and, more to the point, `track` is private now. The client already
* downloaded this list once per session and matched against it locally
* (src/game/track-index.ts + src/engine/autocomplete.ts), so deleting the search
* path costs nothing.
*
* Titles only. The anti-cheat rule the Convex version wrote down still holds: the
* suggestion set is the WHOLE catalogue and carries nothing but the title, so a
* suggestion can never confirm a guess or narrow the round in play.
*/
const track_index = table({
	name: "track_index",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	titles: t.array(t.string()),
	truncated: t.bool(),
	trackCount: t.i32(),
	builtAt: t.timestamp()
});
/**
* A match. Public — but note what is NOT here.
*
* The Convex row carried `trackIds: Id<"tracks">[]`, the whole setlist. That is
* the single most dangerous field in the schema to replicate, so the setlist
* lives in the private `match_track` table and the client learns each song only
* through `round_reveal`, one round at a time.
*/
const match = table({
	name: "match",
	public: true,
	indexes: [{
		accessor: "by_status",
		algorithm: "btree",
		columns: ["status"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	mode: t.string(),
	status: t.string(),
	playerIds: t.array(t.u64()),
	totalRounds: t.i32(),
	bannedCategoryIds: t.array(t.u64()),
	vetoPoolIds: t.array(t.u64()),
	vetoDeadline: t.option(t.timestamp()),
	banOrder: t.array(t.u64()),
	banTurn: t.i32(),
	currentRound: t.i32(),
	roundStartedAt: t.option(t.timestamp()),
	phase: t.string(),
	phaseEndsAt: t.option(t.timestamp()),
	suddenDeath: t.bool(),
	roomId: t.option(t.u64()),
	winnerId: t.option(t.u64()),
	createdAt: t.timestamp(),
	completedAt: t.option(t.timestamp()),
	configVersionId: t.option(t.u64())
});
/**
* The setlist. PRIVATE — this is the answer key for a match in progress.
*
* Split out of `match.trackIds` so that subscribing to a match cannot reveal what
* is coming. The reducers read it; clients never do.
*/
const match_track = table({
	name: "match_track",
	indexes: [{
		accessor: "by_match_round",
		algorithm: "btree",
		columns: ["matchId", "roundIndex"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	matchId: t.u64().index("btree"),
	roundIndex: t.i32(),
	trackId: t.u64()
});
/**
* What the client is allowed to know about a round, and no more. PUBLIC.
*
* This is the load-bearing table of the whole port. The phase reducers write it:
*
*   entering countdown/guessing → previewUrl only. Enough to buffer and play the
*                                 clip, nothing that names it.
*   entering reveal             → title, artist, artwork and category are filled
*                                 in, which is the moment the UI shows them.
*
* A round's row is created when the round is dispatched and updated once when it
* closes, so a client that subscribes mid-match sees revealed rounds in full and
* the round in progress as audio alone.
*
* Convex achieved this by having ONE query remember to omit a field. This achieves
* it by never putting the field in a replicated row until it is public knowledge,
* which is a property of the schema rather than of a code path.
*/
const round_reveal = table({
	name: "round_reveal",
	public: true,
	indexes: [{
		accessor: "by_match_round",
		algorithm: "btree",
		columns: ["matchId", "roundIndex"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	matchId: t.u64().index("btree"),
	roundIndex: t.i32(),
	previewUrl: t.string(),
	title: t.option(t.string()),
	artist: t.option(t.string()),
	artworkUrl: t.option(t.string()),
	categoryName: t.option(t.string()),
	revealedAt: t.option(t.timestamp())
});
/**
* One row per player per match. Public.
*
* Everything here is either written once (the rating and rank snapshots, the
* post-match XP) or a few times per match (hp, readiness). The per-guess churn
* lives in `round_result` instead, so a guess does not re-send a row carrying an
* XP breakdown to everyone watching.
*/
const match_player = table({
	name: "match_player",
	public: true,
	indexes: [{
		accessor: "by_match_user",
		algorithm: "btree",
		columns: ["matchId", "userId"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	matchId: t.u64().index("btree"),
	userId: t.u64().index("btree"),
	totalPoints: t.f64(),
	ratingBefore: t.i32(),
	globalRankAtStart: t.option(t.i32()),
	ratingAfter: t.option(t.i32()),
	ratingDelta: t.option(t.i32()),
	bannedCategoryIds: t.array(t.u64()),
	hasBanned: t.bool(),
	hp: t.f64(),
	lowestHp: t.f64(),
	eliminatedAtRound: t.option(t.i32()),
	readyForRound: t.i32(),
	vsReadyAt: t.option(t.timestamp()),
	passedRound: t.option(t.i32()),
	xpEarned: t.f64(),
	xpBreakdown: t.array(XpAward),
	levelBefore: t.option(t.i32()),
	levelAfter: t.option(t.i32()),
	xpAfter: t.option(t.f64()),
	badgesEarned: t.array(t.string()),
	forfeited: t.bool(),
	mode: t.option(t.string()),
	completedAt: t.option(t.timestamp()),
	outcome: t.option(t.string()),
	opponentId: t.option(t.u64())
});
/**
* Every closed round of a match, one row per round. Public.
*
* The Convex version kept this as a `roundLog` array on the match document, which
* was 71% of a 3.3KB row. As an array it would be rewritten — and re-sent to both
* players — on every round; as rows, closing round 4 sends round 4.
*/
const round_log = table({
	name: "round_log",
	public: true,
	indexes: [{
		accessor: "by_match_round",
		algorithm: "btree",
		columns: ["matchId", "roundIndex"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	matchId: t.u64().index("btree"),
	roundIndex: t.i32(),
	entry: RoundLogEntry
});
/**
* Per-player, per-round scoring state. Public.
*
* This is the high-frequency table: it is written on every accepted guess and
* every pass. It carries points, reaction time and solved-ness — the numbers the
* between-round beats show — and deliberately NOT the guess text, which would
* hand the opponent the answer the instant either player got it right.
*/
const round_result = table({
	name: "round_result",
	public: true,
	indexes: [{
		accessor: "by_match_round_user",
		algorithm: "btree",
		columns: [
			"matchId",
			"roundIndex",
			"userId"
		]
	}, {
		accessor: "by_match_round",
		algorithm: "btree",
		columns: ["matchId", "roundIndex"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	matchId: t.u64().index("btree"),
	roundIndex: t.i32(),
	userId: t.u64(),
	points: t.f64(),
	elapsedMs: t.option(t.f64()),
	solved: t.bool(),
	attempts: t.i32(),
	lockedUntil: t.option(t.timestamp()),
	passed: t.bool()
});
/**
* The raw guess log. PRIVATE.
*
* `rawText` is exactly the answer once somebody is right, so this can never be a
* public table. It is kept for the same reasons Convex kept it — anti-cheat
* forensics and the rejection audit trail — and read only by reducers and by the
* caller's own `my_round_status` view.
*/
const guess = table({
	name: "guess",
	indexes: [{
		accessor: "by_match_round_user",
		algorithm: "btree",
		columns: [
			"matchId",
			"roundIndex",
			"userId"
		]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	matchId: t.u64().index("btree"),
	roundIndex: t.i32(),
	userId: t.u64(),
	rawText: t.string(),
	normalizedText: t.string(),
	correct: t.bool(),
	clientElapsedMs: t.f64(),
	serverReceivedAt: t.timestamp(),
	accepted: t.bool(),
	rejectionReason: t.option(t.string()),
	points: t.f64()
});
/**
* The verdict on a single guess, delivered to the player who made it. EVENT TABLE.
*
* Convex mutations returned a value, so `submitGuess` could answer
* "correct/wrong/rejected, and why" in its own return. Reducers return nothing,
* and the durable tables above deliberately do not carry the answer — so the
* one-shot verdict travels as an event: broadcast on commit, never stored.
*
* Row-level filtering by `userId` is what keeps a wrong guess from telling the
* opponent anything.
*/
const guess_feedback = table({
	name: "guess_feedback",
	public: true,
	event: true
}, {
	matchId: t.u64(),
	roundIndex: t.i32(),
	userId: t.u64().index("btree"),
	outcome: t.string(),
	points: t.f64(),
	rejectionReason: t.option(t.string())
});
const room = table({
	name: "room",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	code: t.string().unique(),
	hostId: t.u64(),
	memberIds: t.array(t.u64()),
	status: t.string(),
	activeMatchId: t.option(t.u64()),
	readyIds: t.array(t.u64()),
	createdAt: t.timestamp()
});
/** The day's setlist. PRIVATE — same answer-key reasoning as `match_track`. */
const daily_challenge = table({ name: "daily_challenge" }, {
	id: t.u64().primaryKey().autoInc(),
	date: t.string().unique(),
	trackIds: t.array(t.u64())
});
const daily_run = table({
	name: "daily_run",
	public: true,
	indexes: [{
		accessor: "by_user_date",
		algorithm: "btree",
		columns: ["userId", "date"]
	}, {
		accessor: "by_date_points",
		algorithm: "btree",
		columns: ["date", "totalPoints"]
	}]
}, {
	id: t.u64().primaryKey().autoInc(),
	userId: t.u64().index("btree"),
	date: t.string().index("btree"),
	totalPoints: t.f64(),
	perRoundMs: t.array(t.f64()),
	perRoundPoints: t.array(t.f64()),
	completedAt: t.timestamp(),
	isGuest: t.bool()
});
/**
* How many runs each day has, as a running total.
*
* Kept from the Convex schema. The reason there was read cost — counting meant a
* `.take` of up to a thousand rows for every visitor with the landing page open.
* The reason here is bandwidth: the landing page is subscribed by signed-out
* visitors too, and one counter row is a great deal less traffic than the day's
* runs.
*/
const daily_count = table({
	name: "daily_count",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	date: t.string().unique(),
	players: t.i32()
});
/**
* The global ladder, one row per ranked player.
*
* REPLACES the Convex `ladderSnapshot`, which held the entire ordering as a single
* ~415KB document. That shape was right for Convex, where the cost was in reading;
* it is wrong here, where the cost is in replicating — a single rank change would
* have re-sent all 5,000 entries to every subscriber.
*
* As rows: the board subscribes to `rank <= ROW_DEPTH`, a player's own position is
* one lookup by `userId`, and a rebuild that moves three people sends three rows.
*
* Freshness is preserved in the way that matters. A five-minute rebuild refreshes
* everyone, but `finalizeMatch` rewrites the finishing players' OWN rows
* immediately — so your number still moves the instant your match ends, which is
* what `positionIn` bought by measuring a live rating against a stale field.
*/
const ladder_entry = table({
	name: "ladder_entry",
	public: true
}, {
	userId: t.u64().primaryKey(),
	rank: t.i32().index("btree"),
	elo: t.i32(),
	handle: t.string(),
	displayName: t.string(),
	avatarUrl: t.option(t.string()),
	gamesPlayed: t.i32(),
	level: t.i32(),
	tierId: t.string().index("btree"),
	approximate: t.bool()
});
/** Board-wide totals, so the leaderboard's header needs no counting. Exactly one row. */
const ladder_status = table({
	name: "ladder_status",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	playerCount: t.i32(),
	truncated: t.bool(),
	builtAt: t.timestamp(),
	checkedAt: t.timestamp()
});
/** Per-tier populations for the leaderboard's band headers. */
const ladder_tier_count = table({
	name: "ladder_tier_count",
	public: true
}, {
	tierId: t.string().primaryKey(),
	count: t.i32()
});
/**
* The ranked matchmaking pool. PRIVATE.
*
* Convex published this because a query could count it without returning it. Here
* a public table means every client holds every waiting player's rating, which is
* both a needless broadcast and a small information leak. The two things clients
* actually need — "am I queued" and "how many humans are waiting" — are the
* `my_queue_entry` and `queue_size` views.
*/
const queue_entry = table({ name: "queue_entry" }, {
	userId: t.u64().primaryKey(),
	elo: t.i32().index("btree"),
	enqueuedAt: t.timestamp(),
	isBot: t.bool().index("btree")
});
/**
* Live connections. PRIVATE.
*
* REPLACES the `presence` table and the 5-second `heartbeat` mutation entirely.
* Convex had no way to observe a socket closing, so liveness had to be inferred
* from a client writing a timestamp on a timer — which the schema notes was "the
* single largest line in the budget". SpacetimeDB calls `clientConnected` and
* `clientDisconnected`, so liveness is now an observed fact rather than a poll.
*
* One Identity can hold several connections (two tabs), so this is keyed by
* connection and a player is present while any row survives.
*/
const connection = table({ name: "connection" }, {
	connectionId: t.connectionId().primaryKey(),
	userId: t.u64().index("btree"),
	connectedAt: t.timestamp()
});
/**
* One saved config, immutable once written. OVERRIDES ONLY, never a whole config.
*
* src/engine/config.ts stays the shipped baseline and these rows carry only the
* differences, which is what lets a constant added to the code later resolve
* correctly for a version row written before it existed. Append-only: a revert
* writes a NEW row holding the old values, because finished matches point at these
* by id and editing one in place would retroactively change the rules they were
* played under.
*/
const config_version = table({
	name: "config_version",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	values: t.array(ConfigOverride),
	createdAt: t.timestamp().index("btree"),
	createdBy: t.option(t.u64()),
	note: t.option(t.string())
});
/**
* Deployment-wide operator state. Exactly one row.
*
* `devFeaturesEnabled` lives here rather than in the environment for the reason
* the Convex version moved it: an operator has to be able to flip it from /admin,
* and a module cannot write its own environment.
*
* `ownerIdentity` is captured in `init`, where `ctx.sender` is the publisher. It
* replaces ADMIN_IMPORT_SECRET: the import and seed scripts now authenticate as
* the module owner instead of sharing a password with the deployment.
*/
const settings = table({
	name: "settings",
	public: true
}, {
	id: t.u64().primaryKey().autoInc(),
	currentVersionId: t.option(t.u64()),
	devFeaturesEnabled: t.bool(),
	updatedAt: t.timestamp(),
	updatedBy: t.option(t.u64())
});
/** Owner identity, captured at publish time. PRIVATE — it is an authorisation key. */
const module_owner = table({ name: "module_owner" }, {
	identity: t.identity().primaryKey(),
	capturedAt: t.timestamp()
});
/** Drives every timed phase transition. The spine of the match clock. */
const phase_advance_schedule = table({
	name: "phase_advance_schedule",
	scheduled: () => advancePhase
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt(),
	matchId: t.u64(),
	expectedPhase: t.string(),
	expectedRound: t.i32()
});
/** The audio-buffer barrier: polls until every human has reported the round. */
const ready_wait_schedule = table({
	name: "ready_wait_schedule",
	scheduled: () => waitForReady
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt(),
	matchId: t.u64(),
	roundIndex: t.i32(),
	startedWaitingAt: t.timestamp()
});
/** Closes a ban draft that nobody is driving. */
const draft_watchdog_schedule = table({
	name: "draft_watchdog_schedule",
	scheduled: () => draftWatchdog
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt(),
	matchId: t.u64()
});
/** One planned bot action: a ban, a guess, or a pass. */
const bot_action_schedule = table({
	name: "bot_action_schedule",
	scheduled: () => runBotAction
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt(),
	matchId: t.u64(),
	userId: t.u64(),
	kind: t.string(),
	roundIndex: t.i32(),
	expectedTurn: t.i32(),
	text: t.string(),
	clientElapsedMs: t.f64()
});
/** Pairs everyone pairable, then re-arms itself while the pool is still matchable. */
const matchmaking_sweep_schedule = table({
	name: "matchmaking_sweep_schedule",
	scheduled: () => sweepMatchmaking
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt()
});
/** Armed when a player's last connection drops mid-ranked-match. */
const forfeit_sweep_schedule = table({
	name: "forfeit_sweep_schedule",
	scheduled: () => sweepForfeits
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt(),
	matchId: t.u64()
});
/** Interval. Expires anonymous guest identities past the retention window. */
const guest_cleanup_schedule = table({
	name: "guest_cleanup_schedule",
	scheduled: () => cleanupGuests
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt()
});
/** Interval. Rebuilds `ladder_entry`, writing only the rows that actually moved. */
const ladder_rebuild_schedule = table({
	name: "ladder_rebuild_schedule",
	scheduled: () => rebuildLadder
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt()
});
/** Interval, DEV ONLY. Keeps the rank bots stocked in the queue. */
const devbot_refill_schedule = table({
	name: "devbot_refill_schedule",
	scheduled: () => refillDevBotQueue
}, {
	scheduled_id: t.u64().primaryKey().autoInc(),
	scheduled_at: t.scheduleAt()
});
const spacetimedb = schema({
	account,
	user,
	user_preference,
	user_avatar,
	report,
	user_badge,
	category_rating,
	category,
	track,
	track_alias,
	track_index,
	match,
	match_track,
	round_reveal,
	match_player,
	round_log,
	round_result,
	guess,
	guess_feedback,
	room,
	daily_challenge,
	daily_run,
	daily_count,
	ladder_entry,
	ladder_status,
	ladder_tier_count,
	queue_entry,
	connection,
	config_version,
	settings,
	module_owner,
	phase_advance_schedule,
	ready_wait_schedule,
	draft_watchdog_schedule,
	bot_action_schedule,
	matchmaking_sweep_schedule,
	forfeit_sweep_schedule,
	guest_cleanup_schedule,
	ladder_rebuild_schedule,
	devbot_refill_schedule
});

//#endregion
//#region src/schedules.ts
/**
* The nine scheduled reducers.
*
* These are the SpacetimeDB replacement for Convex's `ctx.scheduler.runAfter`.
* Each one is a thin dispatcher: the real work lives in the domain modules, and
* everything here is the same guard-on-expectation check the Convex originals
* opened with — a job that fires late, twice, or against a match that has already
* moved on must be a no-op rather than a skipped round.
*
* MODULE ORDER MATTERS. `schema.ts` names these in its `scheduled: (): any => …`
* thunks, so the two files form a cycle. The thunks defer, which is what makes the
* cycle legal, but only if this module finishes evaluating before anything calls
* them — hence `index.ts` imports this file before `./schema`.
*/
const advancePhase = spacetimedb.reducer({ row: phase_advance_schedule.rowType }, (_ctx, { row }) => {});
const waitForReady = spacetimedb.reducer({ row: ready_wait_schedule.rowType }, (_ctx, { row }) => {});
const draftWatchdog = spacetimedb.reducer({ row: draft_watchdog_schedule.rowType }, (_ctx, { row }) => {});
const runBotAction = spacetimedb.reducer({ row: bot_action_schedule.rowType }, (_ctx, { row }) => {});
const sweepMatchmaking = spacetimedb.reducer({ row: matchmaking_sweep_schedule.rowType }, (_ctx, { row }) => {});
const sweepForfeits = spacetimedb.reducer({ row: forfeit_sweep_schedule.rowType }, (_ctx, { row }) => {});
const cleanupGuests = spacetimedb.reducer({ row: guest_cleanup_schedule.rowType }, (_ctx, { row }) => {});
const rebuildLadder = spacetimedb.reducer({ row: ladder_rebuild_schedule.rowType }, (_ctx, { row }) => {});
const refillDevBotQueue = spacetimedb.reducer({ row: devbot_refill_schedule.rowType }, (_ctx, { row }) => {});

//#endregion
export { advancePhase, cleanupGuests, spacetimedb as default, draftWatchdog, rebuildLadder, refillDevBotQueue, runBotAction, sweepForfeits, sweepMatchmaking, waitForReady };
//# debugId=8b3193d9-7130-4185-8434-65f343d7884f
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwibmFtZXMiOlsiX19jcmVhdGUiLCJfX2RlZlByb3AiLCJfX2dldE93blByb3BEZXNjIiwiX19nZXRPd25Qcm9wTmFtZXMiLCJfX2dldFByb3RvT2YiLCJfX2hhc093blByb3AiLCJfX2NvbW1vbkpTIiwiX19jb3B5UHJvcHMiLCJfX3RvRVNNIiwiI2Vuc3VyZSIsIiNtb2R1bGVEZWYiLCIjcmVnaXN0ZXJDb21wb3VuZFR5cGVSZWN1cnNpdmVseSIsIiNjb21wb3VuZFR5cGVzIiwiI2JvZHkiLCIjaW5uZXIiLCIjZnJvbSIsIiN0byIsIiN1dWlkQ291bnRlciIsIiNzZW5kZXJBdXRoIiwiI2lkZW50aXR5IiwiI3JhbmRvbSIsIiNzY2hlbWEiLCIjY29uc3VtZXJSZWR1Y2VyQ291bnQiLCIjY29uc3VtZXJQcm9jZWR1cmVDb3VudCIsIiNjb25zdW1lckFub25WaWV3Q291bnQiLCIjY29uc3VtZXJWaWV3Q291bnQiLCIjZmxhdFN1Ym1vZHVsZXMiLCIjcmVkdWNlckFyZ3NEZXNlcmlhbGl6ZXJzIiwiI2RiVmlldyIsIiNkYlZpZXdfIiwiI3N1Ym1vZHVsZUFzVmlld3NfIiwiI3JlZHVjZXJDdHgiLCIjcmVkdWNlckN0eF8iLCIjY29uc3VtZXJBcyIsIiNjb25zdW1lckFzXyIsIiNnZXRTdWJtb2R1bGVEYlZpZXciLCIjZ2V0U3VibW9kdWxlQXNWaWV3cyIsIiNnZXRTdWJtb2R1bGVRdWVyeUJ1aWxkZXIiLCIjZGlzcGF0Y2hlcyIsIiNhc1ZpZXdzIiwiI2ZpbmFsaXphdGlvblJlZ2lzdHJ5IiwiI2lkIiwiI2RldGFjaCIsIiNwYXJlbnRQcmVmaXgiLCIjY3R4Il0sInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL2hlYWRlcnMtcG9seWZpbGwvbGliL2luZGV4Lm1qcyIsIm5vZGVfbW9kdWxlcy9zcGFjZXRpbWVkYi9kaXN0L3NlcnZlci9pbmRleC5tanMiLCJzcmMvc2NoZW1hLnRzIiwic3JjL3NjaGVkdWxlcy50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJ2YXIgX19jcmVhdGUgPSBPYmplY3QuY3JlYXRlO1xudmFyIF9fZGVmUHJvcCA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eTtcbnZhciBfX2dldE93blByb3BEZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcjtcbnZhciBfX2dldE93blByb3BOYW1lcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzO1xudmFyIF9fZ2V0UHJvdG9PZiA9IE9iamVjdC5nZXRQcm90b3R5cGVPZjtcbnZhciBfX2hhc093blByb3AgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIF9fY29tbW9uSlMgPSAoY2IsIG1vZCkgPT4gZnVuY3Rpb24gX19yZXF1aXJlKCkge1xuICByZXR1cm4gbW9kIHx8ICgwLCBjYltfX2dldE93blByb3BOYW1lcyhjYilbMF1dKSgobW9kID0geyBleHBvcnRzOiB7fSB9KS5leHBvcnRzLCBtb2QpLCBtb2QuZXhwb3J0cztcbn07XG52YXIgX19jb3B5UHJvcHMgPSAodG8sIGZyb20sIGV4Y2VwdCwgZGVzYykgPT4ge1xuICBpZiAoZnJvbSAmJiB0eXBlb2YgZnJvbSA9PT0gXCJvYmplY3RcIiB8fCB0eXBlb2YgZnJvbSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgZm9yIChsZXQga2V5IG9mIF9fZ2V0T3duUHJvcE5hbWVzKGZyb20pKVxuICAgICAgaWYgKCFfX2hhc093blByb3AuY2FsbCh0bywga2V5KSAmJiBrZXkgIT09IGV4Y2VwdClcbiAgICAgICAgX19kZWZQcm9wKHRvLCBrZXksIHsgZ2V0OiAoKSA9PiBmcm9tW2tleV0sIGVudW1lcmFibGU6ICEoZGVzYyA9IF9fZ2V0T3duUHJvcERlc2MoZnJvbSwga2V5KSkgfHwgZGVzYy5lbnVtZXJhYmxlIH0pO1xuICB9XG4gIHJldHVybiB0bztcbn07XG52YXIgX190b0VTTSA9IChtb2QsIGlzTm9kZU1vZGUsIHRhcmdldCkgPT4gKHRhcmdldCA9IG1vZCAhPSBudWxsID8gX19jcmVhdGUoX19nZXRQcm90b09mKG1vZCkpIDoge30sIF9fY29weVByb3BzKFxuICAvLyBJZiB0aGUgaW1wb3J0ZXIgaXMgaW4gbm9kZSBjb21wYXRpYmlsaXR5IG1vZGUgb3IgdGhpcyBpcyBub3QgYW4gRVNNXG4gIC8vIGZpbGUgdGhhdCBoYXMgYmVlbiBjb252ZXJ0ZWQgdG8gYSBDb21tb25KUyBmaWxlIHVzaW5nIGEgQmFiZWwtXG4gIC8vIGNvbXBhdGlibGUgdHJhbnNmb3JtIChpLmUuIFwiX19lc01vZHVsZVwiIGhhcyBub3QgYmVlbiBzZXQpLCB0aGVuIHNldFxuICAvLyBcImRlZmF1bHRcIiB0byB0aGUgQ29tbW9uSlMgXCJtb2R1bGUuZXhwb3J0c1wiIGZvciBub2RlIGNvbXBhdGliaWxpdHkuXG4gIGlzTm9kZU1vZGUgfHwgIW1vZCB8fCAhbW9kLl9fZXNNb2R1bGUgPyBfX2RlZlByb3AodGFyZ2V0LCBcImRlZmF1bHRcIiwgeyB2YWx1ZTogbW9kLCBlbnVtZXJhYmxlOiB0cnVlIH0pIDogdGFyZ2V0LFxuICBtb2RcbikpO1xuXG4vLyBub2RlX21vZHVsZXMvc2V0LWNvb2tpZS1wYXJzZXIvbGliL3NldC1jb29raWUuanNcbnZhciByZXF1aXJlX3NldF9jb29raWUgPSBfX2NvbW1vbkpTKHtcbiAgXCJub2RlX21vZHVsZXMvc2V0LWNvb2tpZS1wYXJzZXIvbGliL3NldC1jb29raWUuanNcIihleHBvcnRzLCBtb2R1bGUpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcbiAgICB2YXIgZGVmYXVsdFBhcnNlT3B0aW9ucyA9IHtcbiAgICAgIGRlY29kZVZhbHVlczogdHJ1ZSxcbiAgICAgIG1hcDogZmFsc2UsXG4gICAgICBzaWxlbnQ6IGZhbHNlXG4gICAgfTtcbiAgICBmdW5jdGlvbiBpc05vbkVtcHR5U3RyaW5nKHN0cikge1xuICAgICAgcmV0dXJuIHR5cGVvZiBzdHIgPT09IFwic3RyaW5nXCIgJiYgISFzdHIudHJpbSgpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBwYXJzZVN0cmluZyhzZXRDb29raWVWYWx1ZSwgb3B0aW9ucykge1xuICAgICAgdmFyIHBhcnRzID0gc2V0Q29va2llVmFsdWUuc3BsaXQoXCI7XCIpLmZpbHRlcihpc05vbkVtcHR5U3RyaW5nKTtcbiAgICAgIHZhciBuYW1lVmFsdWVQYWlyU3RyID0gcGFydHMuc2hpZnQoKTtcbiAgICAgIHZhciBwYXJzZWQgPSBwYXJzZU5hbWVWYWx1ZVBhaXIobmFtZVZhbHVlUGFpclN0cik7XG4gICAgICB2YXIgbmFtZSA9IHBhcnNlZC5uYW1lO1xuICAgICAgdmFyIHZhbHVlID0gcGFyc2VkLnZhbHVlO1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgPyBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0UGFyc2VPcHRpb25zLCBvcHRpb25zKSA6IGRlZmF1bHRQYXJzZU9wdGlvbnM7XG4gICAgICB0cnkge1xuICAgICAgICB2YWx1ZSA9IG9wdGlvbnMuZGVjb2RlVmFsdWVzID8gZGVjb2RlVVJJQ29tcG9uZW50KHZhbHVlKSA6IHZhbHVlO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwic2V0LWNvb2tpZS1wYXJzZXIgZW5jb3VudGVyZWQgYW4gZXJyb3Igd2hpbGUgZGVjb2RpbmcgYSBjb29raWUgd2l0aCB2YWx1ZSAnXCIgKyB2YWx1ZSArIFwiJy4gU2V0IG9wdGlvbnMuZGVjb2RlVmFsdWVzIHRvIGZhbHNlIHRvIGRpc2FibGUgdGhpcyBmZWF0dXJlLlwiLFxuICAgICAgICAgIGVcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHZhciBjb29raWUgPSB7XG4gICAgICAgIG5hbWUsXG4gICAgICAgIHZhbHVlXG4gICAgICB9O1xuICAgICAgcGFydHMuZm9yRWFjaChmdW5jdGlvbihwYXJ0KSB7XG4gICAgICAgIHZhciBzaWRlcyA9IHBhcnQuc3BsaXQoXCI9XCIpO1xuICAgICAgICB2YXIga2V5ID0gc2lkZXMuc2hpZnQoKS50cmltTGVmdCgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIHZhciB2YWx1ZTIgPSBzaWRlcy5qb2luKFwiPVwiKTtcbiAgICAgICAgaWYgKGtleSA9PT0gXCJleHBpcmVzXCIpIHtcbiAgICAgICAgICBjb29raWUuZXhwaXJlcyA9IG5ldyBEYXRlKHZhbHVlMik7XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBcIm1heC1hZ2VcIikge1xuICAgICAgICAgIGNvb2tpZS5tYXhBZ2UgPSBwYXJzZUludCh2YWx1ZTIsIDEwKTtcbiAgICAgICAgfSBlbHNlIGlmIChrZXkgPT09IFwic2VjdXJlXCIpIHtcbiAgICAgICAgICBjb29raWUuc2VjdXJlID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmIChrZXkgPT09IFwiaHR0cG9ubHlcIikge1xuICAgICAgICAgIGNvb2tpZS5odHRwT25seSA9IHRydWU7XG4gICAgICAgIH0gZWxzZSBpZiAoa2V5ID09PSBcInNhbWVzaXRlXCIpIHtcbiAgICAgICAgICBjb29raWUuc2FtZVNpdGUgPSB2YWx1ZTI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29va2llW2tleV0gPSB2YWx1ZTI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGNvb2tpZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcGFyc2VOYW1lVmFsdWVQYWlyKG5hbWVWYWx1ZVBhaXJTdHIpIHtcbiAgICAgIHZhciBuYW1lID0gXCJcIjtcbiAgICAgIHZhciB2YWx1ZSA9IFwiXCI7XG4gICAgICB2YXIgbmFtZVZhbHVlQXJyID0gbmFtZVZhbHVlUGFpclN0ci5zcGxpdChcIj1cIik7XG4gICAgICBpZiAobmFtZVZhbHVlQXJyLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgbmFtZSA9IG5hbWVWYWx1ZUFyci5zaGlmdCgpO1xuICAgICAgICB2YWx1ZSA9IG5hbWVWYWx1ZUFyci5qb2luKFwiPVwiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbHVlID0gbmFtZVZhbHVlUGFpclN0cjtcbiAgICAgIH1cbiAgICAgIHJldHVybiB7IG5hbWUsIHZhbHVlIH07XG4gICAgfVxuICAgIGZ1bmN0aW9uIHBhcnNlKGlucHV0LCBvcHRpb25zKSB7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyA/IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRQYXJzZU9wdGlvbnMsIG9wdGlvbnMpIDogZGVmYXVsdFBhcnNlT3B0aW9ucztcbiAgICAgIGlmICghaW5wdXQpIHtcbiAgICAgICAgaWYgKCFvcHRpb25zLm1hcCkge1xuICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4ge307XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpbnB1dC5oZWFkZXJzKSB7XG4gICAgICAgIGlmICh0eXBlb2YgaW5wdXQuaGVhZGVycy5nZXRTZXRDb29raWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIGlucHV0ID0gaW5wdXQuaGVhZGVycy5nZXRTZXRDb29raWUoKTtcbiAgICAgICAgfSBlbHNlIGlmIChpbnB1dC5oZWFkZXJzW1wic2V0LWNvb2tpZVwiXSkge1xuICAgICAgICAgIGlucHV0ID0gaW5wdXQuaGVhZGVyc1tcInNldC1jb29raWVcIl07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIHNjaCA9IGlucHV0LmhlYWRlcnNbT2JqZWN0LmtleXMoaW5wdXQuaGVhZGVycykuZmluZChmdW5jdGlvbihrZXkpIHtcbiAgICAgICAgICAgIHJldHVybiBrZXkudG9Mb3dlckNhc2UoKSA9PT0gXCJzZXQtY29va2llXCI7XG4gICAgICAgICAgfSldO1xuICAgICAgICAgIGlmICghc2NoICYmIGlucHV0LmhlYWRlcnMuY29va2llICYmICFvcHRpb25zLnNpbGVudCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICBcIldhcm5pbmc6IHNldC1jb29raWUtcGFyc2VyIGFwcGVhcnMgdG8gaGF2ZSBiZWVuIGNhbGxlZCBvbiBhIHJlcXVlc3Qgb2JqZWN0LiBJdCBpcyBkZXNpZ25lZCB0byBwYXJzZSBTZXQtQ29va2llIGhlYWRlcnMgZnJvbSByZXNwb25zZXMsIG5vdCBDb29raWUgaGVhZGVycyBmcm9tIHJlcXVlc3RzLiBTZXQgdGhlIG9wdGlvbiB7c2lsZW50OiB0cnVlfSB0byBzdXBwcmVzcyB0aGlzIHdhcm5pbmcuXCJcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlucHV0ID0gc2NoO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkoaW5wdXQpKSB7XG4gICAgICAgIGlucHV0ID0gW2lucHV0XTtcbiAgICAgIH1cbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zID8gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdFBhcnNlT3B0aW9ucywgb3B0aW9ucykgOiBkZWZhdWx0UGFyc2VPcHRpb25zO1xuICAgICAgaWYgKCFvcHRpb25zLm1hcCkge1xuICAgICAgICByZXR1cm4gaW5wdXQuZmlsdGVyKGlzTm9uRW1wdHlTdHJpbmcpLm1hcChmdW5jdGlvbihzdHIpIHtcbiAgICAgICAgICByZXR1cm4gcGFyc2VTdHJpbmcoc3RyLCBvcHRpb25zKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgY29va2llcyA9IHt9O1xuICAgICAgICByZXR1cm4gaW5wdXQuZmlsdGVyKGlzTm9uRW1wdHlTdHJpbmcpLnJlZHVjZShmdW5jdGlvbihjb29raWVzMiwgc3RyKSB7XG4gICAgICAgICAgdmFyIGNvb2tpZSA9IHBhcnNlU3RyaW5nKHN0ciwgb3B0aW9ucyk7XG4gICAgICAgICAgY29va2llczJbY29va2llLm5hbWVdID0gY29va2llO1xuICAgICAgICAgIHJldHVybiBjb29raWVzMjtcbiAgICAgICAgfSwgY29va2llcyk7XG4gICAgICB9XG4gICAgfVxuICAgIGZ1bmN0aW9uIHNwbGl0Q29va2llc1N0cmluZzIoY29va2llc1N0cmluZykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoY29va2llc1N0cmluZykpIHtcbiAgICAgICAgcmV0dXJuIGNvb2tpZXNTdHJpbmc7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIGNvb2tpZXNTdHJpbmcgIT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgcmV0dXJuIFtdO1xuICAgICAgfVxuICAgICAgdmFyIGNvb2tpZXNTdHJpbmdzID0gW107XG4gICAgICB2YXIgcG9zID0gMDtcbiAgICAgIHZhciBzdGFydDtcbiAgICAgIHZhciBjaDtcbiAgICAgIHZhciBsYXN0Q29tbWE7XG4gICAgICB2YXIgbmV4dFN0YXJ0O1xuICAgICAgdmFyIGNvb2tpZXNTZXBhcmF0b3JGb3VuZDtcbiAgICAgIGZ1bmN0aW9uIHNraXBXaGl0ZXNwYWNlKCkge1xuICAgICAgICB3aGlsZSAocG9zIDwgY29va2llc1N0cmluZy5sZW5ndGggJiYgL1xccy8udGVzdChjb29raWVzU3RyaW5nLmNoYXJBdChwb3MpKSkge1xuICAgICAgICAgIHBvcyArPSAxO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwb3MgPCBjb29raWVzU3RyaW5nLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIG5vdFNwZWNpYWxDaGFyKCkge1xuICAgICAgICBjaCA9IGNvb2tpZXNTdHJpbmcuY2hhckF0KHBvcyk7XG4gICAgICAgIHJldHVybiBjaCAhPT0gXCI9XCIgJiYgY2ggIT09IFwiO1wiICYmIGNoICE9PSBcIixcIjtcbiAgICAgIH1cbiAgICAgIHdoaWxlIChwb3MgPCBjb29raWVzU3RyaW5nLmxlbmd0aCkge1xuICAgICAgICBzdGFydCA9IHBvcztcbiAgICAgICAgY29va2llc1NlcGFyYXRvckZvdW5kID0gZmFsc2U7XG4gICAgICAgIHdoaWxlIChza2lwV2hpdGVzcGFjZSgpKSB7XG4gICAgICAgICAgY2ggPSBjb29raWVzU3RyaW5nLmNoYXJBdChwb3MpO1xuICAgICAgICAgIGlmIChjaCA9PT0gXCIsXCIpIHtcbiAgICAgICAgICAgIGxhc3RDb21tYSA9IHBvcztcbiAgICAgICAgICAgIHBvcyArPSAxO1xuICAgICAgICAgICAgc2tpcFdoaXRlc3BhY2UoKTtcbiAgICAgICAgICAgIG5leHRTdGFydCA9IHBvcztcbiAgICAgICAgICAgIHdoaWxlIChwb3MgPCBjb29raWVzU3RyaW5nLmxlbmd0aCAmJiBub3RTcGVjaWFsQ2hhcigpKSB7XG4gICAgICAgICAgICAgIHBvcyArPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHBvcyA8IGNvb2tpZXNTdHJpbmcubGVuZ3RoICYmIGNvb2tpZXNTdHJpbmcuY2hhckF0KHBvcykgPT09IFwiPVwiKSB7XG4gICAgICAgICAgICAgIGNvb2tpZXNTZXBhcmF0b3JGb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgIHBvcyA9IG5leHRTdGFydDtcbiAgICAgICAgICAgICAgY29va2llc1N0cmluZ3MucHVzaChjb29raWVzU3RyaW5nLnN1YnN0cmluZyhzdGFydCwgbGFzdENvbW1hKSk7XG4gICAgICAgICAgICAgIHN0YXJ0ID0gcG9zO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcG9zID0gbGFzdENvbW1hICsgMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcG9zICs9IDE7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICghY29va2llc1NlcGFyYXRvckZvdW5kIHx8IHBvcyA+PSBjb29raWVzU3RyaW5nLmxlbmd0aCkge1xuICAgICAgICAgIGNvb2tpZXNTdHJpbmdzLnB1c2goY29va2llc1N0cmluZy5zdWJzdHJpbmcoc3RhcnQsIGNvb2tpZXNTdHJpbmcubGVuZ3RoKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBjb29raWVzU3RyaW5ncztcbiAgICB9XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBwYXJzZTtcbiAgICBtb2R1bGUuZXhwb3J0cy5wYXJzZSA9IHBhcnNlO1xuICAgIG1vZHVsZS5leHBvcnRzLnBhcnNlU3RyaW5nID0gcGFyc2VTdHJpbmc7XG4gICAgbW9kdWxlLmV4cG9ydHMuc3BsaXRDb29raWVzU3RyaW5nID0gc3BsaXRDb29raWVzU3RyaW5nMjtcbiAgfVxufSk7XG5cbi8vIHNyYy9IZWFkZXJzLnRzXG52YXIgaW1wb3J0X3NldF9jb29raWVfcGFyc2VyID0gX190b0VTTShyZXF1aXJlX3NldF9jb29raWUoKSk7XG5cbi8vIHNyYy91dGlscy9ub3JtYWxpemVIZWFkZXJOYW1lLnRzXG52YXIgSEVBREVSU19JTlZBTElEX0NIQVJBQ1RFUlMgPSAvW15hLXowLTlcXC0jJCUmJyorLl5fYHx+XS9pO1xuZnVuY3Rpb24gbm9ybWFsaXplSGVhZGVyTmFtZShuYW1lKSB7XG4gIGlmIChIRUFERVJTX0lOVkFMSURfQ0hBUkFDVEVSUy50ZXN0KG5hbWUpIHx8IG5hbWUudHJpbSgpID09PSBcIlwiKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkludmFsaWQgY2hhcmFjdGVyIGluIGhlYWRlciBmaWVsZCBuYW1lXCIpO1xuICB9XG4gIHJldHVybiBuYW1lLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xufVxuXG4vLyBzcmMvdXRpbHMvbm9ybWFsaXplSGVhZGVyVmFsdWUudHNcbnZhciBjaGFyQ29kZXNUb1JlbW92ZSA9IFtcbiAgU3RyaW5nLmZyb21DaGFyQ29kZSgxMCksXG4gIFN0cmluZy5mcm9tQ2hhckNvZGUoMTMpLFxuICBTdHJpbmcuZnJvbUNoYXJDb2RlKDkpLFxuICBTdHJpbmcuZnJvbUNoYXJDb2RlKDMyKVxuXTtcbnZhciBIRUFERVJfVkFMVUVfUkVNT1ZFX1JFR0VYUCA9IG5ldyBSZWdFeHAoXG4gIGAoXlske2NoYXJDb2Rlc1RvUmVtb3ZlLmpvaW4oXCJcIil9XXwkWyR7Y2hhckNvZGVzVG9SZW1vdmUuam9pbihcIlwiKX1dKWAsXG4gIFwiZ1wiXG4pO1xuZnVuY3Rpb24gbm9ybWFsaXplSGVhZGVyVmFsdWUodmFsdWUpIHtcbiAgY29uc3QgbmV4dFZhbHVlID0gdmFsdWUucmVwbGFjZShIRUFERVJfVkFMVUVfUkVNT1ZFX1JFR0VYUCwgXCJcIik7XG4gIHJldHVybiBuZXh0VmFsdWU7XG59XG5cbi8vIHNyYy91dGlscy9pc1ZhbGlkSGVhZGVyTmFtZS50c1xuZnVuY3Rpb24gaXNWYWxpZEhlYWRlck5hbWUodmFsdWUpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICBpZiAodmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyYWN0ZXIgPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuICAgIGlmIChjaGFyYWN0ZXIgPiAxMjcgfHwgIWlzVG9rZW4oY2hhcmFjdGVyKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cbmZ1bmN0aW9uIGlzVG9rZW4odmFsdWUpIHtcbiAgcmV0dXJuICFbXG4gICAgMTI3LFxuICAgIDMyLFxuICAgIFwiKFwiLFxuICAgIFwiKVwiLFxuICAgIFwiPFwiLFxuICAgIFwiPlwiLFxuICAgIFwiQFwiLFxuICAgIFwiLFwiLFxuICAgIFwiO1wiLFxuICAgIFwiOlwiLFxuICAgIFwiXFxcXFwiLFxuICAgICdcIicsXG4gICAgXCIvXCIsXG4gICAgXCJbXCIsXG4gICAgXCJdXCIsXG4gICAgXCI/XCIsXG4gICAgXCI9XCIsXG4gICAgXCJ7XCIsXG4gICAgXCJ9XCJcbiAgXS5pbmNsdWRlcyh2YWx1ZSk7XG59XG5cbi8vIHNyYy91dGlscy9pc1ZhbGlkSGVhZGVyVmFsdWUudHNcbmZ1bmN0aW9uIGlzVmFsaWRIZWFkZXJWYWx1ZSh2YWx1ZSkge1xuICBpZiAodHlwZW9mIHZhbHVlICE9PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGlmICh2YWx1ZS50cmltKCkgIT09IHZhbHVlKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaGFyYWN0ZXIgPSB2YWx1ZS5jaGFyQ29kZUF0KGkpO1xuICAgIGlmIChcbiAgICAgIC8vIE5VTC5cbiAgICAgIGNoYXJhY3RlciA9PT0gMCB8fCAvLyBIVFRQIG5ld2xpbmUgYnl0ZXMuXG4gICAgICBjaGFyYWN0ZXIgPT09IDEwIHx8IGNoYXJhY3RlciA9PT0gMTNcbiAgICApIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8vIHNyYy9IZWFkZXJzLnRzXG52YXIgTk9STUFMSVpFRF9IRUFERVJTID0gU3ltYm9sKFwibm9ybWFsaXplZEhlYWRlcnNcIik7XG52YXIgUkFXX0hFQURFUl9OQU1FUyA9IFN5bWJvbChcInJhd0hlYWRlck5hbWVzXCIpO1xudmFyIEhFQURFUl9WQUxVRV9ERUxJTUlURVIgPSBcIiwgXCI7XG52YXIgX2EsIF9iLCBfYztcbnZhciBIZWFkZXJzID0gY2xhc3MgX0hlYWRlcnMge1xuICBjb25zdHJ1Y3Rvcihpbml0KSB7XG4gICAgLy8gTm9ybWFsaXplZCBoZWFkZXIge1wibmFtZVwiOlwiYSwgYlwifSBzdG9yYWdlLlxuICAgIHRoaXNbX2FdID0ge307XG4gICAgLy8gS2VlcHMgdGhlIG1hcHBpbmcgYmV0d2VlbiB0aGUgcmF3IGhlYWRlciBuYW1lXG4gICAgLy8gYW5kIHRoZSBub3JtYWxpemVkIGhlYWRlciBuYW1lIHRvIGVhc2UgdGhlIGxvb2t1cC5cbiAgICB0aGlzW19iXSA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gICAgdGhpc1tfY10gPSBcIkhlYWRlcnNcIjtcbiAgICBpZiAoW1wiSGVhZGVyc1wiLCBcIkhlYWRlcnNQb2x5ZmlsbFwiXS5pbmNsdWRlcyhpbml0Py5jb25zdHJ1Y3Rvci5uYW1lKSB8fCBpbml0IGluc3RhbmNlb2YgX0hlYWRlcnMgfHwgdHlwZW9mIGdsb2JhbFRoaXMuSGVhZGVycyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBpbml0IGluc3RhbmNlb2YgZ2xvYmFsVGhpcy5IZWFkZXJzKSB7XG4gICAgICBjb25zdCBpbml0aWFsSGVhZGVycyA9IGluaXQ7XG4gICAgICBpbml0aWFsSGVhZGVycy5mb3JFYWNoKCh2YWx1ZSwgbmFtZSkgPT4ge1xuICAgICAgICB0aGlzLmFwcGVuZChuYW1lLCB2YWx1ZSk7XG4gICAgICB9LCB0aGlzKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaW5pdCkpIHtcbiAgICAgIGluaXQuZm9yRWFjaCgoW25hbWUsIHZhbHVlXSkgPT4ge1xuICAgICAgICB0aGlzLmFwcGVuZChcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUuam9pbihIRUFERVJfVkFMVUVfREVMSU1JVEVSKSA6IHZhbHVlXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGluaXQpIHtcbiAgICAgIE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGluaXQpLmZvckVhY2goKG5hbWUpID0+IHtcbiAgICAgICAgY29uc3QgdmFsdWUgPSBpbml0W25hbWVdO1xuICAgICAgICB0aGlzLmFwcGVuZChcbiAgICAgICAgICBuYW1lLFxuICAgICAgICAgIEFycmF5LmlzQXJyYXkodmFsdWUpID8gdmFsdWUuam9pbihIRUFERVJfVkFMVUVfREVMSU1JVEVSKSA6IHZhbHVlXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgWyhfYSA9IE5PUk1BTElaRURfSEVBREVSUywgX2IgPSBSQVdfSEVBREVSX05BTUVTLCBfYyA9IFN5bWJvbC50b1N0cmluZ1RhZywgU3ltYm9sLml0ZXJhdG9yKV0oKSB7XG4gICAgcmV0dXJuIHRoaXMuZW50cmllcygpO1xuICB9XG4gICprZXlzKCkge1xuICAgIGZvciAoY29uc3QgW25hbWVdIG9mIHRoaXMuZW50cmllcygpKSB7XG4gICAgICB5aWVsZCBuYW1lO1xuICAgIH1cbiAgfVxuICAqdmFsdWVzKCkge1xuICAgIGZvciAoY29uc3QgWywgdmFsdWVdIG9mIHRoaXMuZW50cmllcygpKSB7XG4gICAgICB5aWVsZCB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgKmVudHJpZXMoKSB7XG4gICAgbGV0IHNvcnRlZEtleXMgPSBPYmplY3Qua2V5cyh0aGlzW05PUk1BTElaRURfSEVBREVSU10pLnNvcnQoXG4gICAgICAoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpXG4gICAgKTtcbiAgICBmb3IgKGNvbnN0IG5hbWUgb2Ygc29ydGVkS2V5cykge1xuICAgICAgaWYgKG5hbWUgPT09IFwic2V0LWNvb2tpZVwiKSB7XG4gICAgICAgIGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy5nZXRTZXRDb29raWUoKSkge1xuICAgICAgICAgIHlpZWxkIFtuYW1lLCB2YWx1ZV07XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHlpZWxkIFtuYW1lLCB0aGlzLmdldChuYW1lKV07XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgYm9vbGVhbiBzdGF0aW5nIHdoZXRoZXIgYSBgSGVhZGVyc2Agb2JqZWN0IGNvbnRhaW5zIGEgY2VydGFpbiBoZWFkZXIuXG4gICAqL1xuICBoYXMobmFtZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYEludmFsaWQgaGVhZGVyIG5hbWUgXCIke25hbWV9XCJgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXNbTk9STUFMSVpFRF9IRUFERVJTXS5oYXNPd25Qcm9wZXJ0eShub3JtYWxpemVIZWFkZXJOYW1lKG5hbWUpKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJucyBhIGBCeXRlU3RyaW5nYCBzZXF1ZW5jZSBvZiBhbGwgdGhlIHZhbHVlcyBvZiBhIGhlYWRlciB3aXRoIGEgZ2l2ZW4gbmFtZS5cbiAgICovXG4gIGdldChuYW1lKSB7XG4gICAgaWYgKCFpc1ZhbGlkSGVhZGVyTmFtZShuYW1lKSkge1xuICAgICAgdGhyb3cgVHlwZUVycm9yKGBJbnZhbGlkIGhlYWRlciBuYW1lIFwiJHtuYW1lfVwiYCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzW05PUk1BTElaRURfSEVBREVSU11bbm9ybWFsaXplSGVhZGVyTmFtZShuYW1lKV0gPz8gbnVsbDtcbiAgfVxuICAvKipcbiAgICogU2V0cyBhIG5ldyB2YWx1ZSBmb3IgYW4gZXhpc3RpbmcgaGVhZGVyIGluc2lkZSBhIGBIZWFkZXJzYCBvYmplY3QsIG9yIGFkZHMgdGhlIGhlYWRlciBpZiBpdCBkb2VzIG5vdCBhbHJlYWR5IGV4aXN0LlxuICAgKi9cbiAgc2V0KG5hbWUsIHZhbHVlKSB7XG4gICAgaWYgKCFpc1ZhbGlkSGVhZGVyTmFtZShuYW1lKSB8fCAhaXNWYWxpZEhlYWRlclZhbHVlKHZhbHVlKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBub3JtYWxpemVkTmFtZSA9IG5vcm1hbGl6ZUhlYWRlck5hbWUobmFtZSk7XG4gICAgY29uc3Qgbm9ybWFsaXplZFZhbHVlID0gbm9ybWFsaXplSGVhZGVyVmFsdWUodmFsdWUpO1xuICAgIHRoaXNbTk9STUFMSVpFRF9IRUFERVJTXVtub3JtYWxpemVkTmFtZV0gPSBub3JtYWxpemVIZWFkZXJWYWx1ZShub3JtYWxpemVkVmFsdWUpO1xuICAgIHRoaXNbUkFXX0hFQURFUl9OQU1FU10uc2V0KG5vcm1hbGl6ZWROYW1lLCBuYW1lKTtcbiAgfVxuICAvKipcbiAgICogQXBwZW5kcyBhIG5ldyB2YWx1ZSBvbnRvIGFuIGV4aXN0aW5nIGhlYWRlciBpbnNpZGUgYSBgSGVhZGVyc2Agb2JqZWN0LCBvciBhZGRzIHRoZSBoZWFkZXIgaWYgaXQgZG9lcyBub3QgYWxyZWFkeSBleGlzdC5cbiAgICovXG4gIGFwcGVuZChuYW1lLCB2YWx1ZSkge1xuICAgIGlmICghaXNWYWxpZEhlYWRlck5hbWUobmFtZSkgfHwgIWlzVmFsaWRIZWFkZXJWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3Qgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemVIZWFkZXJOYW1lKG5hbWUpO1xuICAgIGNvbnN0IG5vcm1hbGl6ZWRWYWx1ZSA9IG5vcm1hbGl6ZUhlYWRlclZhbHVlKHZhbHVlKTtcbiAgICBsZXQgcmVzb2x2ZWRWYWx1ZSA9IHRoaXMuaGFzKG5vcm1hbGl6ZWROYW1lKSA/IGAke3RoaXMuZ2V0KG5vcm1hbGl6ZWROYW1lKX0sICR7bm9ybWFsaXplZFZhbHVlfWAgOiBub3JtYWxpemVkVmFsdWU7XG4gICAgdGhpcy5zZXQobmFtZSwgcmVzb2x2ZWRWYWx1ZSk7XG4gIH1cbiAgLyoqXG4gICAqIERlbGV0ZXMgYSBoZWFkZXIgZnJvbSB0aGUgYEhlYWRlcnNgIG9iamVjdC5cbiAgICovXG4gIGRlbGV0ZShuYW1lKSB7XG4gICAgaWYgKCFpc1ZhbGlkSGVhZGVyTmFtZShuYW1lKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIXRoaXMuaGFzKG5hbWUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IG5vcm1hbGl6ZWROYW1lID0gbm9ybWFsaXplSGVhZGVyTmFtZShuYW1lKTtcbiAgICBkZWxldGUgdGhpc1tOT1JNQUxJWkVEX0hFQURFUlNdW25vcm1hbGl6ZWROYW1lXTtcbiAgICB0aGlzW1JBV19IRUFERVJfTkFNRVNdLmRlbGV0ZShub3JtYWxpemVkTmFtZSk7XG4gIH1cbiAgLyoqXG4gICAqIFRyYXZlcnNlcyB0aGUgYEhlYWRlcnNgIG9iamVjdCxcbiAgICogY2FsbGluZyB0aGUgZ2l2ZW4gY2FsbGJhY2sgZm9yIGVhY2ggaGVhZGVyLlxuICAgKi9cbiAgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGZvciAoY29uc3QgW25hbWUsIHZhbHVlXSBvZiB0aGlzLmVudHJpZXMoKSkge1xuICAgICAgY2FsbGJhY2suY2FsbCh0aGlzQXJnLCB2YWx1ZSwgbmFtZSwgdGhpcyk7XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIHZhbHVlc1xuICAgKiBvZiBhbGwgU2V0LUNvb2tpZSBoZWFkZXJzIGFzc29jaWF0ZWRcbiAgICogd2l0aCBhIHJlc3BvbnNlXG4gICAqL1xuICBnZXRTZXRDb29raWUoKSB7XG4gICAgY29uc3Qgc2V0Q29va2llSGVhZGVyID0gdGhpcy5nZXQoXCJzZXQtY29va2llXCIpO1xuICAgIGlmIChzZXRDb29raWVIZWFkZXIgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gICAgaWYgKHNldENvb2tpZUhlYWRlciA9PT0gXCJcIikge1xuICAgICAgcmV0dXJuIFtcIlwiXTtcbiAgICB9XG4gICAgcmV0dXJuICgwLCBpbXBvcnRfc2V0X2Nvb2tpZV9wYXJzZXIuc3BsaXRDb29raWVzU3RyaW5nKShzZXRDb29raWVIZWFkZXIpO1xuICB9XG59O1xuXG4vLyBzcmMvZ2V0UmF3SGVhZGVycy50c1xuZnVuY3Rpb24gZ2V0UmF3SGVhZGVycyhoZWFkZXJzKSB7XG4gIGNvbnN0IHJhd0hlYWRlcnMgPSB7fTtcbiAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIGhlYWRlcnMuZW50cmllcygpKSB7XG4gICAgcmF3SGVhZGVyc1toZWFkZXJzW1JBV19IRUFERVJfTkFNRVNdLmdldChuYW1lKV0gPSB2YWx1ZTtcbiAgfVxuICByZXR1cm4gcmF3SGVhZGVycztcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9oZWFkZXJzVG9MaXN0LnRzXG5mdW5jdGlvbiBoZWFkZXJzVG9MaXN0KGhlYWRlcnMpIHtcbiAgY29uc3QgaGVhZGVyc0xpc3QgPSBbXTtcbiAgaGVhZGVycy5mb3JFYWNoKCh2YWx1ZSwgbmFtZSkgPT4ge1xuICAgIGNvbnN0IHJlc29sdmVkVmFsdWUgPSB2YWx1ZS5pbmNsdWRlcyhcIixcIikgPyB2YWx1ZS5zcGxpdChcIixcIikubWFwKCh2YWx1ZTIpID0+IHZhbHVlMi50cmltKCkpIDogdmFsdWU7XG4gICAgaGVhZGVyc0xpc3QucHVzaChbbmFtZSwgcmVzb2x2ZWRWYWx1ZV0pO1xuICB9KTtcbiAgcmV0dXJuIGhlYWRlcnNMaXN0O1xufVxuXG4vLyBzcmMvdHJhbnNmb3JtZXJzL2hlYWRlcnNUb1N0cmluZy50c1xuZnVuY3Rpb24gaGVhZGVyc1RvU3RyaW5nKGhlYWRlcnMpIHtcbiAgY29uc3QgbGlzdCA9IGhlYWRlcnNUb0xpc3QoaGVhZGVycyk7XG4gIGNvbnN0IGxpbmVzID0gbGlzdC5tYXAoKFtuYW1lLCB2YWx1ZV0pID0+IHtcbiAgICBjb25zdCB2YWx1ZXMgPSBbXS5jb25jYXQodmFsdWUpO1xuICAgIHJldHVybiBgJHtuYW1lfTogJHt2YWx1ZXMuam9pbihcIiwgXCIpfWA7XG4gIH0pO1xuICByZXR1cm4gbGluZXMuam9pbihcIlxcclxcblwiKTtcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9oZWFkZXJzVG9PYmplY3QudHNcbnZhciBzaW5nbGVWYWx1ZUhlYWRlcnMgPSBbXCJ1c2VyLWFnZW50XCJdO1xuZnVuY3Rpb24gaGVhZGVyc1RvT2JqZWN0KGhlYWRlcnMpIHtcbiAgY29uc3QgaGVhZGVyc09iamVjdCA9IHt9O1xuICBoZWFkZXJzLmZvckVhY2goKHZhbHVlLCBuYW1lKSA9PiB7XG4gICAgY29uc3QgaXNNdWx0aVZhbHVlID0gIXNpbmdsZVZhbHVlSGVhZGVycy5pbmNsdWRlcyhuYW1lLnRvTG93ZXJDYXNlKCkpICYmIHZhbHVlLmluY2x1ZGVzKFwiLFwiKTtcbiAgICBoZWFkZXJzT2JqZWN0W25hbWVdID0gaXNNdWx0aVZhbHVlID8gdmFsdWUuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpIDogdmFsdWU7XG4gIH0pO1xuICByZXR1cm4gaGVhZGVyc09iamVjdDtcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9zdHJpbmdUb0hlYWRlcnMudHNcbmZ1bmN0aW9uIHN0cmluZ1RvSGVhZGVycyhzdHIpIHtcbiAgY29uc3QgbGluZXMgPSBzdHIudHJpbSgpLnNwbGl0KC9bXFxyXFxuXSsvKTtcbiAgcmV0dXJuIGxpbmVzLnJlZHVjZSgoaGVhZGVycywgbGluZSkgPT4ge1xuICAgIGlmIChsaW5lLnRyaW0oKSA9PT0gXCJcIikge1xuICAgICAgcmV0dXJuIGhlYWRlcnM7XG4gICAgfVxuICAgIGNvbnN0IHBhcnRzID0gbGluZS5zcGxpdChcIjogXCIpO1xuICAgIGNvbnN0IG5hbWUgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIGNvbnN0IHZhbHVlID0gcGFydHMuam9pbihcIjogXCIpO1xuICAgIGhlYWRlcnMuYXBwZW5kKG5hbWUsIHZhbHVlKTtcbiAgICByZXR1cm4gaGVhZGVycztcbiAgfSwgbmV3IEhlYWRlcnMoKSk7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvbGlzdFRvSGVhZGVycy50c1xuZnVuY3Rpb24gbGlzdFRvSGVhZGVycyhsaXN0KSB7XG4gIGNvbnN0IGhlYWRlcnMgPSBuZXcgSGVhZGVycygpO1xuICBsaXN0LmZvckVhY2goKFtuYW1lLCB2YWx1ZV0pID0+IHtcbiAgICBjb25zdCB2YWx1ZXMgPSBbXS5jb25jYXQodmFsdWUpO1xuICAgIHZhbHVlcy5mb3JFYWNoKCh2YWx1ZTIpID0+IHtcbiAgICAgIGhlYWRlcnMuYXBwZW5kKG5hbWUsIHZhbHVlMik7XG4gICAgfSk7XG4gIH0pO1xuICByZXR1cm4gaGVhZGVycztcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9yZWR1Y2VIZWFkZXJzT2JqZWN0LnRzXG5mdW5jdGlvbiByZWR1Y2VIZWFkZXJzT2JqZWN0KGhlYWRlcnMsIHJlZHVjZXIsIGluaXRpYWxTdGF0ZSkge1xuICByZXR1cm4gT2JqZWN0LmtleXMoaGVhZGVycykucmVkdWNlKChuZXh0SGVhZGVycywgbmFtZSkgPT4ge1xuICAgIHJldHVybiByZWR1Y2VyKG5leHRIZWFkZXJzLCBuYW1lLCBoZWFkZXJzW25hbWVdKTtcbiAgfSwgaW5pdGlhbFN0YXRlKTtcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9vYmplY3RUb0hlYWRlcnMudHNcbmZ1bmN0aW9uIG9iamVjdFRvSGVhZGVycyhoZWFkZXJzT2JqZWN0KSB7XG4gIHJldHVybiByZWR1Y2VIZWFkZXJzT2JqZWN0KFxuICAgIGhlYWRlcnNPYmplY3QsXG4gICAgKGhlYWRlcnMsIG5hbWUsIHZhbHVlKSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZXMgPSBbXS5jb25jYXQodmFsdWUpLmZpbHRlcihCb29sZWFuKTtcbiAgICAgIHZhbHVlcy5mb3JFYWNoKCh2YWx1ZTIpID0+IHtcbiAgICAgICAgaGVhZGVycy5hcHBlbmQobmFtZSwgdmFsdWUyKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGhlYWRlcnM7XG4gICAgfSxcbiAgICBuZXcgSGVhZGVycygpXG4gICk7XG59XG5cbi8vIHNyYy90cmFuc2Zvcm1lcnMvZmxhdHRlbkhlYWRlcnNMaXN0LnRzXG5mdW5jdGlvbiBmbGF0dGVuSGVhZGVyc0xpc3QobGlzdCkge1xuICByZXR1cm4gbGlzdC5tYXAoKFtuYW1lLCB2YWx1ZXNdKSA9PiB7XG4gICAgcmV0dXJuIFtuYW1lLCBbXS5jb25jYXQodmFsdWVzKS5qb2luKFwiLCBcIildO1xuICB9KTtcbn1cblxuLy8gc3JjL3RyYW5zZm9ybWVycy9mbGF0dGVuSGVhZGVyc09iamVjdC50c1xuZnVuY3Rpb24gZmxhdHRlbkhlYWRlcnNPYmplY3QoaGVhZGVyc09iamVjdCkge1xuICByZXR1cm4gcmVkdWNlSGVhZGVyc09iamVjdChcbiAgICBoZWFkZXJzT2JqZWN0LFxuICAgIChoZWFkZXJzLCBuYW1lLCB2YWx1ZSkgPT4ge1xuICAgICAgaGVhZGVyc1tuYW1lXSA9IFtdLmNvbmNhdCh2YWx1ZSkuam9pbihcIiwgXCIpO1xuICAgICAgcmV0dXJuIGhlYWRlcnM7XG4gICAgfSxcbiAgICB7fVxuICApO1xufVxuZXhwb3J0IHtcbiAgSGVhZGVycyxcbiAgZmxhdHRlbkhlYWRlcnNMaXN0LFxuICBmbGF0dGVuSGVhZGVyc09iamVjdCxcbiAgZ2V0UmF3SGVhZGVycyxcbiAgaGVhZGVyc1RvTGlzdCxcbiAgaGVhZGVyc1RvT2JqZWN0LFxuICBoZWFkZXJzVG9TdHJpbmcsXG4gIGxpc3RUb0hlYWRlcnMsXG4gIG9iamVjdFRvSGVhZGVycyxcbiAgcmVkdWNlSGVhZGVyc09iamVjdCxcbiAgc3RyaW5nVG9IZWFkZXJzXG59O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXgubWpzLm1hcCIsImltcG9ydCAqIGFzIF9zeXNjYWxsczJfMCBmcm9tICdzcGFjZXRpbWU6c3lzQDIuMCc7XG5pbXBvcnQgeyBtb2R1bGVIb29rcyB9IGZyb20gJ3NwYWNldGltZTpzeXNAMi4wJztcbmltcG9ydCB7IEhlYWRlcnMsIGhlYWRlcnNUb0xpc3QgfSBmcm9tICdoZWFkZXJzLXBvbHlmaWxsJztcbmV4cG9ydCB7IEhlYWRlcnMgfSBmcm9tICdoZWFkZXJzLXBvbHlmaWxsJztcbmltcG9ydCAqIGFzIF9zeXNjYWxsczJfMSBmcm9tICdzcGFjZXRpbWU6c3lzQDIuMSc7XG5cbnR5cGVvZiBnbG9iYWxUaGlzIT09XCJ1bmRlZmluZWRcIiYmKChnbG9iYWxUaGlzLmdsb2JhbD1nbG9iYWxUaGlzLmdsb2JhbHx8Z2xvYmFsVGhpcyksKGdsb2JhbFRoaXMud2luZG93PWdsb2JhbFRoaXMud2luZG93fHxnbG9iYWxUaGlzKSk7XG52YXIgX19jcmVhdGUgPSBPYmplY3QuY3JlYXRlO1xudmFyIF9fZGVmUHJvcCA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eTtcbnZhciBfX2dldE93blByb3BEZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcjtcbnZhciBfX2dldE93blByb3BOYW1lcyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzO1xudmFyIF9fZ2V0UHJvdG9PZiA9IE9iamVjdC5nZXRQcm90b3R5cGVPZjtcbnZhciBfX2hhc093blByb3AgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIF9fZXNtID0gKGZuLCByZXMpID0+IGZ1bmN0aW9uIF9faW5pdCgpIHtcbiAgcmV0dXJuIGZuICYmIChyZXMgPSAoMCwgZm5bX19nZXRPd25Qcm9wTmFtZXMoZm4pWzBdXSkoZm4gPSAwKSksIHJlcztcbn07XG52YXIgX19jb21tb25KUyA9IChjYiwgbW9kKSA9PiBmdW5jdGlvbiBfX3JlcXVpcmUoKSB7XG4gIHJldHVybiBtb2QgfHwgKDAsIGNiW19fZ2V0T3duUHJvcE5hbWVzKGNiKVswXV0pKChtb2QgPSB7IGV4cG9ydHM6IHt9IH0pLmV4cG9ydHMsIG1vZCksIG1vZC5leHBvcnRzO1xufTtcbnZhciBfX2V4cG9ydCA9ICh0YXJnZXQsIGFsbCkgPT4ge1xuICBmb3IgKHZhciBuYW1lIGluIGFsbClcbiAgICBfX2RlZlByb3AodGFyZ2V0LCBuYW1lLCB7IGdldDogYWxsW25hbWVdLCBlbnVtZXJhYmxlOiB0cnVlIH0pO1xufTtcbnZhciBfX2NvcHlQcm9wcyA9ICh0bywgZnJvbSwgZXhjZXB0LCBkZXNjKSA9PiB7XG4gIGlmIChmcm9tICYmIHR5cGVvZiBmcm9tID09PSBcIm9iamVjdFwiIHx8IHR5cGVvZiBmcm9tID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBmb3IgKGxldCBrZXkgb2YgX19nZXRPd25Qcm9wTmFtZXMoZnJvbSkpXG4gICAgICBpZiAoIV9faGFzT3duUHJvcC5jYWxsKHRvLCBrZXkpICYmIGtleSAhPT0gZXhjZXB0KVxuICAgICAgICBfX2RlZlByb3AodG8sIGtleSwgeyBnZXQ6ICgpID0+IGZyb21ba2V5XSwgZW51bWVyYWJsZTogIShkZXNjID0gX19nZXRPd25Qcm9wRGVzYyhmcm9tLCBrZXkpKSB8fCBkZXNjLmVudW1lcmFibGUgfSk7XG4gIH1cbiAgcmV0dXJuIHRvO1xufTtcbnZhciBfX3RvRVNNID0gKG1vZCwgaXNOb2RlTW9kZSwgdGFyZ2V0KSA9PiAodGFyZ2V0ID0gbW9kICE9IG51bGwgPyBfX2NyZWF0ZShfX2dldFByb3RvT2YobW9kKSkgOiB7fSwgX19jb3B5UHJvcHMoXG4gIC8vIElmIHRoZSBpbXBvcnRlciBpcyBpbiBub2RlIGNvbXBhdGliaWxpdHkgbW9kZSBvciB0aGlzIGlzIG5vdCBhbiBFU01cbiAgLy8gZmlsZSB0aGF0IGhhcyBiZWVuIGNvbnZlcnRlZCB0byBhIENvbW1vbkpTIGZpbGUgdXNpbmcgYSBCYWJlbC1cbiAgLy8gY29tcGF0aWJsZSB0cmFuc2Zvcm0gKGkuZS4gXCJfX2VzTW9kdWxlXCIgaGFzIG5vdCBiZWVuIHNldCksIHRoZW4gc2V0XG4gIC8vIFwiZGVmYXVsdFwiIHRvIHRoZSBDb21tb25KUyBcIm1vZHVsZS5leHBvcnRzXCIgZm9yIG5vZGUgY29tcGF0aWJpbGl0eS5cbiAgX19kZWZQcm9wKHRhcmdldCwgXCJkZWZhdWx0XCIsIHsgdmFsdWU6IG1vZCwgZW51bWVyYWJsZTogdHJ1ZSB9KSAsXG4gIG1vZFxuKSk7XG52YXIgX190b0NvbW1vbkpTID0gKG1vZCkgPT4gX19jb3B5UHJvcHMoX19kZWZQcm9wKHt9LCBcIl9fZXNNb2R1bGVcIiwgeyB2YWx1ZTogdHJ1ZSB9KSwgbW9kKTtcblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL2Jhc2U2NC1qc0AxLjUuMS9ub2RlX21vZHVsZXMvYmFzZTY0LWpzL2luZGV4LmpzXG52YXIgcmVxdWlyZV9iYXNlNjRfanMgPSBfX2NvbW1vbkpTKHtcbiAgXCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vYmFzZTY0LWpzQDEuNS4xL25vZGVfbW9kdWxlcy9iYXNlNjQtanMvaW5kZXguanNcIihleHBvcnRzKSB7XG4gICAgZXhwb3J0cy5ieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aDtcbiAgICBleHBvcnRzLnRvQnl0ZUFycmF5ID0gdG9CeXRlQXJyYXk7XG4gICAgZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gZnJvbUJ5dGVBcnJheTI7XG4gICAgdmFyIGxvb2t1cCA9IFtdO1xuICAgIHZhciByZXZMb29rdXAgPSBbXTtcbiAgICB2YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09IFwidW5kZWZpbmVkXCIgPyBVaW50OEFycmF5IDogQXJyYXk7XG4gICAgdmFyIGNvZGUgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Ky9cIjtcbiAgICBmb3IgKGkgPSAwLCBsZW4gPSBjb2RlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgICBsb29rdXBbaV0gPSBjb2RlW2ldO1xuICAgICAgcmV2TG9va3VwW2NvZGUuY2hhckNvZGVBdChpKV0gPSBpO1xuICAgIH1cbiAgICB2YXIgaTtcbiAgICB2YXIgbGVuO1xuICAgIHJldkxvb2t1cFtcIi1cIi5jaGFyQ29kZUF0KDApXSA9IDYyO1xuICAgIHJldkxvb2t1cFtcIl9cIi5jaGFyQ29kZUF0KDApXSA9IDYzO1xuICAgIGZ1bmN0aW9uIGdldExlbnMoYjY0KSB7XG4gICAgICB2YXIgbGVuMiA9IGI2NC5sZW5ndGg7XG4gICAgICBpZiAobGVuMiAlIDQgPiAwKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDRcIik7XG4gICAgICB9XG4gICAgICB2YXIgdmFsaWRMZW4gPSBiNjQuaW5kZXhPZihcIj1cIik7XG4gICAgICBpZiAodmFsaWRMZW4gPT09IC0xKSB2YWxpZExlbiA9IGxlbjI7XG4gICAgICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gdmFsaWRMZW4gPT09IGxlbjIgPyAwIDogNCAtIHZhbGlkTGVuICUgNDtcbiAgICAgIHJldHVybiBbdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbl07XG4gICAgfVxuICAgIGZ1bmN0aW9uIGJ5dGVMZW5ndGgoYjY0KSB7XG4gICAgICB2YXIgbGVucyA9IGdldExlbnMoYjY0KTtcbiAgICAgIHZhciB2YWxpZExlbiA9IGxlbnNbMF07XG4gICAgICB2YXIgcGxhY2VIb2xkZXJzTGVuID0gbGVuc1sxXTtcbiAgICAgIHJldHVybiAodmFsaWRMZW4gKyBwbGFjZUhvbGRlcnNMZW4pICogMyAvIDQgLSBwbGFjZUhvbGRlcnNMZW47XG4gICAgfVxuICAgIGZ1bmN0aW9uIF9ieXRlTGVuZ3RoKGI2NCwgdmFsaWRMZW4sIHBsYWNlSG9sZGVyc0xlbikge1xuICAgICAgcmV0dXJuICh2YWxpZExlbiArIHBsYWNlSG9sZGVyc0xlbikgKiAzIC8gNCAtIHBsYWNlSG9sZGVyc0xlbjtcbiAgICB9XG4gICAgZnVuY3Rpb24gdG9CeXRlQXJyYXkoYjY0KSB7XG4gICAgICB2YXIgdG1wO1xuICAgICAgdmFyIGxlbnMgPSBnZXRMZW5zKGI2NCk7XG4gICAgICB2YXIgdmFsaWRMZW4gPSBsZW5zWzBdO1xuICAgICAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IGxlbnNbMV07XG4gICAgICB2YXIgYXJyID0gbmV3IEFycihfYnl0ZUxlbmd0aChiNjQsIHZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW4pKTtcbiAgICAgIHZhciBjdXJCeXRlID0gMDtcbiAgICAgIHZhciBsZW4yID0gcGxhY2VIb2xkZXJzTGVuID4gMCA/IHZhbGlkTGVuIC0gNCA6IHZhbGlkTGVuO1xuICAgICAgdmFyIGkyO1xuICAgICAgZm9yIChpMiA9IDA7IGkyIDwgbGVuMjsgaTIgKz0gNCkge1xuICAgICAgICB0bXAgPSByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaTIpXSA8PCAxOCB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMiArIDEpXSA8PCAxMiB8IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMiArIDIpXSA8PCA2IHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyICsgMyldO1xuICAgICAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCA+PiAxNiAmIDI1NTtcbiAgICAgICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgPj4gOCAmIDI1NTtcbiAgICAgICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAyNTU7XG4gICAgICB9XG4gICAgICBpZiAocGxhY2VIb2xkZXJzTGVuID09PSAyKSB7XG4gICAgICAgIHRtcCA9IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMildIDw8IDIgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaTIgKyAxKV0gPj4gNDtcbiAgICAgICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAyNTU7XG4gICAgICB9XG4gICAgICBpZiAocGxhY2VIb2xkZXJzTGVuID09PSAxKSB7XG4gICAgICAgIHRtcCA9IHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpMildIDw8IDEwIHwgcmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkyICsgMSldIDw8IDQgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaTIgKyAyKV0gPj4gMjtcbiAgICAgICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgPj4gOCAmIDI1NTtcbiAgICAgICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAyNTU7XG4gICAgICB9XG4gICAgICByZXR1cm4gYXJyO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQobnVtKSB7XG4gICAgICByZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDYzXSArIGxvb2t1cFtudW0gPj4gMTIgJiA2M10gKyBsb29rdXBbbnVtID4+IDYgJiA2M10gKyBsb29rdXBbbnVtICYgNjNdO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlbmNvZGVDaHVuayh1aW50OCwgc3RhcnQsIGVuZCkge1xuICAgICAgdmFyIHRtcDtcbiAgICAgIHZhciBvdXRwdXQgPSBbXTtcbiAgICAgIGZvciAodmFyIGkyID0gc3RhcnQ7IGkyIDwgZW5kOyBpMiArPSAzKSB7XG4gICAgICAgIHRtcCA9ICh1aW50OFtpMl0gPDwgMTYgJiAxNjcxMTY4MCkgKyAodWludDhbaTIgKyAxXSA8PCA4ICYgNjUyODApICsgKHVpbnQ4W2kyICsgMl0gJiAyNTUpO1xuICAgICAgICBvdXRwdXQucHVzaCh0cmlwbGV0VG9CYXNlNjQodG1wKSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gb3V0cHV0LmpvaW4oXCJcIik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGZyb21CeXRlQXJyYXkyKHVpbnQ4KSB7XG4gICAgICB2YXIgdG1wO1xuICAgICAgdmFyIGxlbjIgPSB1aW50OC5sZW5ndGg7XG4gICAgICB2YXIgZXh0cmFCeXRlcyA9IGxlbjIgJSAzO1xuICAgICAgdmFyIHBhcnRzID0gW107XG4gICAgICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MztcbiAgICAgIGZvciAodmFyIGkyID0gMCwgbGVuMjIgPSBsZW4yIC0gZXh0cmFCeXRlczsgaTIgPCBsZW4yMjsgaTIgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICAgICAgcGFydHMucHVzaChlbmNvZGVDaHVuayh1aW50OCwgaTIsIGkyICsgbWF4Q2h1bmtMZW5ndGggPiBsZW4yMiA/IGxlbjIyIDogaTIgKyBtYXhDaHVua0xlbmd0aCkpO1xuICAgICAgfVxuICAgICAgaWYgKGV4dHJhQnl0ZXMgPT09IDEpIHtcbiAgICAgICAgdG1wID0gdWludDhbbGVuMiAtIDFdO1xuICAgICAgICBwYXJ0cy5wdXNoKFxuICAgICAgICAgIGxvb2t1cFt0bXAgPj4gMl0gKyBsb29rdXBbdG1wIDw8IDQgJiA2M10gKyBcIj09XCJcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSBpZiAoZXh0cmFCeXRlcyA9PT0gMikge1xuICAgICAgICB0bXAgPSAodWludDhbbGVuMiAtIDJdIDw8IDgpICsgdWludDhbbGVuMiAtIDFdO1xuICAgICAgICBwYXJ0cy5wdXNoKFxuICAgICAgICAgIGxvb2t1cFt0bXAgPj4gMTBdICsgbG9va3VwW3RtcCA+PiA0ICYgNjNdICsgbG9va3VwW3RtcCA8PCAyICYgNjNdICsgXCI9XCJcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBwYXJ0cy5qb2luKFwiXCIpO1xuICAgIH1cbiAgfVxufSk7XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9zdGF0dXNlc0AyLjAuMi9ub2RlX21vZHVsZXMvc3RhdHVzZXMvY29kZXMuanNvblxudmFyIHJlcXVpcmVfY29kZXMgPSBfX2NvbW1vbkpTKHtcbiAgXCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vc3RhdHVzZXNAMi4wLjIvbm9kZV9tb2R1bGVzL3N0YXR1c2VzL2NvZGVzLmpzb25cIihleHBvcnRzLCBtb2R1bGUpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICAgIFwiMTAwXCI6IFwiQ29udGludWVcIixcbiAgICAgIFwiMTAxXCI6IFwiU3dpdGNoaW5nIFByb3RvY29sc1wiLFxuICAgICAgXCIxMDJcIjogXCJQcm9jZXNzaW5nXCIsXG4gICAgICBcIjEwM1wiOiBcIkVhcmx5IEhpbnRzXCIsXG4gICAgICBcIjIwMFwiOiBcIk9LXCIsXG4gICAgICBcIjIwMVwiOiBcIkNyZWF0ZWRcIixcbiAgICAgIFwiMjAyXCI6IFwiQWNjZXB0ZWRcIixcbiAgICAgIFwiMjAzXCI6IFwiTm9uLUF1dGhvcml0YXRpdmUgSW5mb3JtYXRpb25cIixcbiAgICAgIFwiMjA0XCI6IFwiTm8gQ29udGVudFwiLFxuICAgICAgXCIyMDVcIjogXCJSZXNldCBDb250ZW50XCIsXG4gICAgICBcIjIwNlwiOiBcIlBhcnRpYWwgQ29udGVudFwiLFxuICAgICAgXCIyMDdcIjogXCJNdWx0aS1TdGF0dXNcIixcbiAgICAgIFwiMjA4XCI6IFwiQWxyZWFkeSBSZXBvcnRlZFwiLFxuICAgICAgXCIyMjZcIjogXCJJTSBVc2VkXCIsXG4gICAgICBcIjMwMFwiOiBcIk11bHRpcGxlIENob2ljZXNcIixcbiAgICAgIFwiMzAxXCI6IFwiTW92ZWQgUGVybWFuZW50bHlcIixcbiAgICAgIFwiMzAyXCI6IFwiRm91bmRcIixcbiAgICAgIFwiMzAzXCI6IFwiU2VlIE90aGVyXCIsXG4gICAgICBcIjMwNFwiOiBcIk5vdCBNb2RpZmllZFwiLFxuICAgICAgXCIzMDVcIjogXCJVc2UgUHJveHlcIixcbiAgICAgIFwiMzA3XCI6IFwiVGVtcG9yYXJ5IFJlZGlyZWN0XCIsXG4gICAgICBcIjMwOFwiOiBcIlBlcm1hbmVudCBSZWRpcmVjdFwiLFxuICAgICAgXCI0MDBcIjogXCJCYWQgUmVxdWVzdFwiLFxuICAgICAgXCI0MDFcIjogXCJVbmF1dGhvcml6ZWRcIixcbiAgICAgIFwiNDAyXCI6IFwiUGF5bWVudCBSZXF1aXJlZFwiLFxuICAgICAgXCI0MDNcIjogXCJGb3JiaWRkZW5cIixcbiAgICAgIFwiNDA0XCI6IFwiTm90IEZvdW5kXCIsXG4gICAgICBcIjQwNVwiOiBcIk1ldGhvZCBOb3QgQWxsb3dlZFwiLFxuICAgICAgXCI0MDZcIjogXCJOb3QgQWNjZXB0YWJsZVwiLFxuICAgICAgXCI0MDdcIjogXCJQcm94eSBBdXRoZW50aWNhdGlvbiBSZXF1aXJlZFwiLFxuICAgICAgXCI0MDhcIjogXCJSZXF1ZXN0IFRpbWVvdXRcIixcbiAgICAgIFwiNDA5XCI6IFwiQ29uZmxpY3RcIixcbiAgICAgIFwiNDEwXCI6IFwiR29uZVwiLFxuICAgICAgXCI0MTFcIjogXCJMZW5ndGggUmVxdWlyZWRcIixcbiAgICAgIFwiNDEyXCI6IFwiUHJlY29uZGl0aW9uIEZhaWxlZFwiLFxuICAgICAgXCI0MTNcIjogXCJQYXlsb2FkIFRvbyBMYXJnZVwiLFxuICAgICAgXCI0MTRcIjogXCJVUkkgVG9vIExvbmdcIixcbiAgICAgIFwiNDE1XCI6IFwiVW5zdXBwb3J0ZWQgTWVkaWEgVHlwZVwiLFxuICAgICAgXCI0MTZcIjogXCJSYW5nZSBOb3QgU2F0aXNmaWFibGVcIixcbiAgICAgIFwiNDE3XCI6IFwiRXhwZWN0YXRpb24gRmFpbGVkXCIsXG4gICAgICBcIjQxOFwiOiBcIkknbSBhIFRlYXBvdFwiLFxuICAgICAgXCI0MjFcIjogXCJNaXNkaXJlY3RlZCBSZXF1ZXN0XCIsXG4gICAgICBcIjQyMlwiOiBcIlVucHJvY2Vzc2FibGUgRW50aXR5XCIsXG4gICAgICBcIjQyM1wiOiBcIkxvY2tlZFwiLFxuICAgICAgXCI0MjRcIjogXCJGYWlsZWQgRGVwZW5kZW5jeVwiLFxuICAgICAgXCI0MjVcIjogXCJUb28gRWFybHlcIixcbiAgICAgIFwiNDI2XCI6IFwiVXBncmFkZSBSZXF1aXJlZFwiLFxuICAgICAgXCI0MjhcIjogXCJQcmVjb25kaXRpb24gUmVxdWlyZWRcIixcbiAgICAgIFwiNDI5XCI6IFwiVG9vIE1hbnkgUmVxdWVzdHNcIixcbiAgICAgIFwiNDMxXCI6IFwiUmVxdWVzdCBIZWFkZXIgRmllbGRzIFRvbyBMYXJnZVwiLFxuICAgICAgXCI0NTFcIjogXCJVbmF2YWlsYWJsZSBGb3IgTGVnYWwgUmVhc29uc1wiLFxuICAgICAgXCI1MDBcIjogXCJJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcIixcbiAgICAgIFwiNTAxXCI6IFwiTm90IEltcGxlbWVudGVkXCIsXG4gICAgICBcIjUwMlwiOiBcIkJhZCBHYXRld2F5XCIsXG4gICAgICBcIjUwM1wiOiBcIlNlcnZpY2UgVW5hdmFpbGFibGVcIixcbiAgICAgIFwiNTA0XCI6IFwiR2F0ZXdheSBUaW1lb3V0XCIsXG4gICAgICBcIjUwNVwiOiBcIkhUVFAgVmVyc2lvbiBOb3QgU3VwcG9ydGVkXCIsXG4gICAgICBcIjUwNlwiOiBcIlZhcmlhbnQgQWxzbyBOZWdvdGlhdGVzXCIsXG4gICAgICBcIjUwN1wiOiBcIkluc3VmZmljaWVudCBTdG9yYWdlXCIsXG4gICAgICBcIjUwOFwiOiBcIkxvb3AgRGV0ZWN0ZWRcIixcbiAgICAgIFwiNTA5XCI6IFwiQmFuZHdpZHRoIExpbWl0IEV4Y2VlZGVkXCIsXG4gICAgICBcIjUxMFwiOiBcIk5vdCBFeHRlbmRlZFwiLFxuICAgICAgXCI1MTFcIjogXCJOZXR3b3JrIEF1dGhlbnRpY2F0aW9uIFJlcXVpcmVkXCJcbiAgICB9O1xuICB9XG59KTtcblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3N0YXR1c2VzQDIuMC4yL25vZGVfbW9kdWxlcy9zdGF0dXNlcy9pbmRleC5qc1xudmFyIHJlcXVpcmVfc3RhdHVzZXMgPSBfX2NvbW1vbkpTKHtcbiAgXCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vc3RhdHVzZXNAMi4wLjIvbm9kZV9tb2R1bGVzL3N0YXR1c2VzL2luZGV4LmpzXCIoZXhwb3J0cywgbW9kdWxlKSB7XG4gICAgdmFyIGNvZGVzID0gcmVxdWlyZV9jb2RlcygpO1xuICAgIG1vZHVsZS5leHBvcnRzID0gc3RhdHVzMjtcbiAgICBzdGF0dXMyLm1lc3NhZ2UgPSBjb2RlcztcbiAgICBzdGF0dXMyLmNvZGUgPSBjcmVhdGVNZXNzYWdlVG9TdGF0dXNDb2RlTWFwKGNvZGVzKTtcbiAgICBzdGF0dXMyLmNvZGVzID0gY3JlYXRlU3RhdHVzQ29kZUxpc3QoY29kZXMpO1xuICAgIHN0YXR1czIucmVkaXJlY3QgPSB7XG4gICAgICAzMDA6IHRydWUsXG4gICAgICAzMDE6IHRydWUsXG4gICAgICAzMDI6IHRydWUsXG4gICAgICAzMDM6IHRydWUsXG4gICAgICAzMDU6IHRydWUsXG4gICAgICAzMDc6IHRydWUsXG4gICAgICAzMDg6IHRydWVcbiAgICB9O1xuICAgIHN0YXR1czIuZW1wdHkgPSB7XG4gICAgICAyMDQ6IHRydWUsXG4gICAgICAyMDU6IHRydWUsXG4gICAgICAzMDQ6IHRydWVcbiAgICB9O1xuICAgIHN0YXR1czIucmV0cnkgPSB7XG4gICAgICA1MDI6IHRydWUsXG4gICAgICA1MDM6IHRydWUsXG4gICAgICA1MDQ6IHRydWVcbiAgICB9O1xuICAgIGZ1bmN0aW9uIGNyZWF0ZU1lc3NhZ2VUb1N0YXR1c0NvZGVNYXAoY29kZXMyKSB7XG4gICAgICB2YXIgbWFwID0ge307XG4gICAgICBPYmplY3Qua2V5cyhjb2RlczIpLmZvckVhY2goZnVuY3Rpb24gZm9yRWFjaENvZGUoY29kZSkge1xuICAgICAgICB2YXIgbWVzc2FnZSA9IGNvZGVzMltjb2RlXTtcbiAgICAgICAgdmFyIHN0YXR1czMgPSBOdW1iZXIoY29kZSk7XG4gICAgICAgIG1hcFttZXNzYWdlLnRvTG93ZXJDYXNlKCldID0gc3RhdHVzMztcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG1hcDtcbiAgICB9XG4gICAgZnVuY3Rpb24gY3JlYXRlU3RhdHVzQ29kZUxpc3QoY29kZXMyKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LmtleXMoY29kZXMyKS5tYXAoZnVuY3Rpb24gbWFwQ29kZShjb2RlKSB7XG4gICAgICAgIHJldHVybiBOdW1iZXIoY29kZSk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZ2V0U3RhdHVzQ29kZShtZXNzYWdlKSB7XG4gICAgICB2YXIgbXNnID0gbWVzc2FnZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKCFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc3RhdHVzMi5jb2RlLCBtc2cpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignaW52YWxpZCBzdGF0dXMgbWVzc2FnZTogXCInICsgbWVzc2FnZSArICdcIicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHN0YXR1czIuY29kZVttc2ddO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRTdGF0dXNNZXNzYWdlKGNvZGUpIHtcbiAgICAgIGlmICghT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHN0YXR1czIubWVzc2FnZSwgY29kZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiaW52YWxpZCBzdGF0dXMgY29kZTogXCIgKyBjb2RlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdGF0dXMyLm1lc3NhZ2VbY29kZV07XG4gICAgfVxuICAgIGZ1bmN0aW9uIHN0YXR1czIoY29kZSkge1xuICAgICAgaWYgKHR5cGVvZiBjb2RlID09PSBcIm51bWJlclwiKSB7XG4gICAgICAgIHJldHVybiBnZXRTdGF0dXNNZXNzYWdlKGNvZGUpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBjb2RlICE9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJjb2RlIG11c3QgYmUgYSBudW1iZXIgb3Igc3RyaW5nXCIpO1xuICAgICAgfVxuICAgICAgdmFyIG4gPSBwYXJzZUludChjb2RlLCAxMCk7XG4gICAgICBpZiAoIWlzTmFOKG4pKSB7XG4gICAgICAgIHJldHVybiBnZXRTdGF0dXNNZXNzYWdlKG4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGdldFN0YXR1c0NvZGUoY29kZSk7XG4gICAgfVxuICB9XG59KTtcblxuLy8gc3JjL3V0aWwtc3R1Yi50c1xudmFyIHV0aWxfc3R1Yl9leHBvcnRzID0ge307XG5fX2V4cG9ydCh1dGlsX3N0dWJfZXhwb3J0cywge1xuICBpbnNwZWN0OiAoKSA9PiBpbnNwZWN0XG59KTtcbnZhciBpbnNwZWN0O1xudmFyIGluaXRfdXRpbF9zdHViID0gX19lc20oe1xuICBcInNyYy91dGlsLXN0dWIudHNcIigpIHtcbiAgICBpbnNwZWN0ID0ge307XG4gIH1cbn0pO1xuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vb2JqZWN0LWluc3BlY3RAMS4xMy40L25vZGVfbW9kdWxlcy9vYmplY3QtaW5zcGVjdC91dGlsLmluc3BlY3QuanNcbnZhciByZXF1aXJlX3V0aWxfaW5zcGVjdCA9IF9fY29tbW9uSlMoe1xuICBcIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9vYmplY3QtaW5zcGVjdEAxLjEzLjQvbm9kZV9tb2R1bGVzL29iamVjdC1pbnNwZWN0L3V0aWwuaW5zcGVjdC5qc1wiKGV4cG9ydHMsIG1vZHVsZSkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gKGluaXRfdXRpbF9zdHViKCksIF9fdG9Db21tb25KUyh1dGlsX3N0dWJfZXhwb3J0cykpLmluc3BlY3Q7XG4gIH1cbn0pO1xuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vb2JqZWN0LWluc3BlY3RAMS4xMy40L25vZGVfbW9kdWxlcy9vYmplY3QtaW5zcGVjdC9pbmRleC5qc1xudmFyIHJlcXVpcmVfb2JqZWN0X2luc3BlY3QgPSBfX2NvbW1vbkpTKHtcbiAgXCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vb2JqZWN0LWluc3BlY3RAMS4xMy40L25vZGVfbW9kdWxlcy9vYmplY3QtaW5zcGVjdC9pbmRleC5qc1wiKGV4cG9ydHMsIG1vZHVsZSkge1xuICAgIHZhciBoYXNNYXAgPSB0eXBlb2YgTWFwID09PSBcImZ1bmN0aW9uXCIgJiYgTWFwLnByb3RvdHlwZTtcbiAgICB2YXIgbWFwU2l6ZURlc2NyaXB0b3IgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yICYmIGhhc01hcCA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoTWFwLnByb3RvdHlwZSwgXCJzaXplXCIpIDogbnVsbDtcbiAgICB2YXIgbWFwU2l6ZSA9IGhhc01hcCAmJiBtYXBTaXplRGVzY3JpcHRvciAmJiB0eXBlb2YgbWFwU2l6ZURlc2NyaXB0b3IuZ2V0ID09PSBcImZ1bmN0aW9uXCIgPyBtYXBTaXplRGVzY3JpcHRvci5nZXQgOiBudWxsO1xuICAgIHZhciBtYXBGb3JFYWNoID0gaGFzTWFwICYmIE1hcC5wcm90b3R5cGUuZm9yRWFjaDtcbiAgICB2YXIgaGFzU2V0ID0gdHlwZW9mIFNldCA9PT0gXCJmdW5jdGlvblwiICYmIFNldC5wcm90b3R5cGU7XG4gICAgdmFyIHNldFNpemVEZXNjcmlwdG9yID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvciAmJiBoYXNTZXQgPyBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKFNldC5wcm90b3R5cGUsIFwic2l6ZVwiKSA6IG51bGw7XG4gICAgdmFyIHNldFNpemUgPSBoYXNTZXQgJiYgc2V0U2l6ZURlc2NyaXB0b3IgJiYgdHlwZW9mIHNldFNpemVEZXNjcmlwdG9yLmdldCA9PT0gXCJmdW5jdGlvblwiID8gc2V0U2l6ZURlc2NyaXB0b3IuZ2V0IDogbnVsbDtcbiAgICB2YXIgc2V0Rm9yRWFjaCA9IGhhc1NldCAmJiBTZXQucHJvdG90eXBlLmZvckVhY2g7XG4gICAgdmFyIGhhc1dlYWtNYXAgPSB0eXBlb2YgV2Vha01hcCA9PT0gXCJmdW5jdGlvblwiICYmIFdlYWtNYXAucHJvdG90eXBlO1xuICAgIHZhciB3ZWFrTWFwSGFzID0gaGFzV2Vha01hcCA/IFdlYWtNYXAucHJvdG90eXBlLmhhcyA6IG51bGw7XG4gICAgdmFyIGhhc1dlYWtTZXQgPSB0eXBlb2YgV2Vha1NldCA9PT0gXCJmdW5jdGlvblwiICYmIFdlYWtTZXQucHJvdG90eXBlO1xuICAgIHZhciB3ZWFrU2V0SGFzID0gaGFzV2Vha1NldCA/IFdlYWtTZXQucHJvdG90eXBlLmhhcyA6IG51bGw7XG4gICAgdmFyIGhhc1dlYWtSZWYgPSB0eXBlb2YgV2Vha1JlZiA9PT0gXCJmdW5jdGlvblwiICYmIFdlYWtSZWYucHJvdG90eXBlO1xuICAgIHZhciB3ZWFrUmVmRGVyZWYgPSBoYXNXZWFrUmVmID8gV2Vha1JlZi5wcm90b3R5cGUuZGVyZWYgOiBudWxsO1xuICAgIHZhciBib29sZWFuVmFsdWVPZiA9IEJvb2xlYW4ucHJvdG90eXBlLnZhbHVlT2Y7XG4gICAgdmFyIG9iamVjdFRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcbiAgICB2YXIgZnVuY3Rpb25Ub1N0cmluZyA9IEZ1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZztcbiAgICB2YXIgJG1hdGNoID0gU3RyaW5nLnByb3RvdHlwZS5tYXRjaDtcbiAgICB2YXIgJHNsaWNlID0gU3RyaW5nLnByb3RvdHlwZS5zbGljZTtcbiAgICB2YXIgJHJlcGxhY2UgPSBTdHJpbmcucHJvdG90eXBlLnJlcGxhY2U7XG4gICAgdmFyICR0b1VwcGVyQ2FzZSA9IFN0cmluZy5wcm90b3R5cGUudG9VcHBlckNhc2U7XG4gICAgdmFyICR0b0xvd2VyQ2FzZSA9IFN0cmluZy5wcm90b3R5cGUudG9Mb3dlckNhc2U7XG4gICAgdmFyICR0ZXN0ID0gUmVnRXhwLnByb3RvdHlwZS50ZXN0O1xuICAgIHZhciAkY29uY2F0ID0gQXJyYXkucHJvdG90eXBlLmNvbmNhdDtcbiAgICB2YXIgJGpvaW4gPSBBcnJheS5wcm90b3R5cGUuam9pbjtcbiAgICB2YXIgJGFyclNsaWNlID0gQXJyYXkucHJvdG90eXBlLnNsaWNlO1xuICAgIHZhciAkZmxvb3IgPSBNYXRoLmZsb29yO1xuICAgIHZhciBiaWdJbnRWYWx1ZU9mID0gdHlwZW9mIEJpZ0ludCA9PT0gXCJmdW5jdGlvblwiID8gQmlnSW50LnByb3RvdHlwZS52YWx1ZU9mIDogbnVsbDtcbiAgICB2YXIgZ09QUyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHM7XG4gICAgdmFyIHN5bVRvU3RyaW5nID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBTeW1ib2wucHJvdG90eXBlLnRvU3RyaW5nIDogbnVsbDtcbiAgICB2YXIgaGFzU2hhbW1lZFN5bWJvbHMgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJvYmplY3RcIjtcbiAgICB2YXIgdG9TdHJpbmdUYWcgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgU3ltYm9sLnRvU3RyaW5nVGFnICYmICh0eXBlb2YgU3ltYm9sLnRvU3RyaW5nVGFnID09PSBoYXNTaGFtbWVkU3ltYm9scyA/IFwib2JqZWN0XCIgOiBcInN5bWJvbFwiKSA/IFN5bWJvbC50b1N0cmluZ1RhZyA6IG51bGw7XG4gICAgdmFyIGlzRW51bWVyYWJsZSA9IE9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGU7XG4gICAgdmFyIGdQTyA9ICh0eXBlb2YgUmVmbGVjdCA9PT0gXCJmdW5jdGlvblwiID8gUmVmbGVjdC5nZXRQcm90b3R5cGVPZiA6IE9iamVjdC5nZXRQcm90b3R5cGVPZikgfHwgKFtdLl9fcHJvdG9fXyA9PT0gQXJyYXkucHJvdG90eXBlID8gZnVuY3Rpb24oTykge1xuICAgICAgcmV0dXJuIE8uX19wcm90b19fO1xuICAgIH0gOiBudWxsKTtcbiAgICBmdW5jdGlvbiBhZGROdW1lcmljU2VwYXJhdG9yKG51bSwgc3RyKSB7XG4gICAgICBpZiAobnVtID09PSBJbmZpbml0eSB8fCBudW0gPT09IC1JbmZpbml0eSB8fCBudW0gIT09IG51bSB8fCBudW0gJiYgbnVtID4gLTFlMyAmJiBudW0gPCAxZTMgfHwgJHRlc3QuY2FsbCgvZS8sIHN0cikpIHtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICAgIH1cbiAgICAgIHZhciBzZXBSZWdleCA9IC9bMC05XSg/PSg/OlswLTldezN9KSsoPyFbMC05XSkpL2c7XG4gICAgICBpZiAodHlwZW9mIG51bSA9PT0gXCJudW1iZXJcIikge1xuICAgICAgICB2YXIgaW50ID0gbnVtIDwgMCA/IC0kZmxvb3IoLW51bSkgOiAkZmxvb3IobnVtKTtcbiAgICAgICAgaWYgKGludCAhPT0gbnVtKSB7XG4gICAgICAgICAgdmFyIGludFN0ciA9IFN0cmluZyhpbnQpO1xuICAgICAgICAgIHZhciBkZWMgPSAkc2xpY2UuY2FsbChzdHIsIGludFN0ci5sZW5ndGggKyAxKTtcbiAgICAgICAgICByZXR1cm4gJHJlcGxhY2UuY2FsbChpbnRTdHIsIHNlcFJlZ2V4LCBcIiQmX1wiKSArIFwiLlwiICsgJHJlcGxhY2UuY2FsbCgkcmVwbGFjZS5jYWxsKGRlYywgLyhbMC05XXszfSkvZywgXCIkJl9cIiksIC9fJC8sIFwiXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gJHJlcGxhY2UuY2FsbChzdHIsIHNlcFJlZ2V4LCBcIiQmX1wiKTtcbiAgICB9XG4gICAgdmFyIHV0aWxJbnNwZWN0ID0gcmVxdWlyZV91dGlsX2luc3BlY3QoKTtcbiAgICB2YXIgaW5zcGVjdEN1c3RvbSA9IHV0aWxJbnNwZWN0LmN1c3RvbTtcbiAgICB2YXIgaW5zcGVjdFN5bWJvbCA9IGlzU3ltYm9sKGluc3BlY3RDdXN0b20pID8gaW5zcGVjdEN1c3RvbSA6IG51bGw7XG4gICAgdmFyIHF1b3RlcyA9IHtcbiAgICAgIF9fcHJvdG9fXzogbnVsbCxcbiAgICAgIFwiZG91YmxlXCI6ICdcIicsXG4gICAgICBzaW5nbGU6IFwiJ1wiXG4gICAgfTtcbiAgICB2YXIgcXVvdGVSRXMgPSB7XG4gICAgICBfX3Byb3RvX186IG51bGwsXG4gICAgICBcImRvdWJsZVwiOiAvKFtcIlxcXFxdKS9nLFxuICAgICAgc2luZ2xlOiAvKFsnXFxcXF0pL2dcbiAgICB9O1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5zcGVjdF8ob2JqLCBvcHRpb25zLCBkZXB0aCwgc2Vlbikge1xuICAgICAgdmFyIG9wdHMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgaWYgKGhhcyhvcHRzLCBcInF1b3RlU3R5bGVcIikgJiYgIWhhcyhxdW90ZXMsIG9wdHMucXVvdGVTdHlsZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9uIFwicXVvdGVTdHlsZVwiIG11c3QgYmUgXCJzaW5nbGVcIiBvciBcImRvdWJsZVwiJyk7XG4gICAgICB9XG4gICAgICBpZiAoaGFzKG9wdHMsIFwibWF4U3RyaW5nTGVuZ3RoXCIpICYmICh0eXBlb2Ygb3B0cy5tYXhTdHJpbmdMZW5ndGggPT09IFwibnVtYmVyXCIgPyBvcHRzLm1heFN0cmluZ0xlbmd0aCA8IDAgJiYgb3B0cy5tYXhTdHJpbmdMZW5ndGggIT09IEluZmluaXR5IDogb3B0cy5tYXhTdHJpbmdMZW5ndGggIT09IG51bGwpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ29wdGlvbiBcIm1heFN0cmluZ0xlbmd0aFwiLCBpZiBwcm92aWRlZCwgbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXIsIEluZmluaXR5LCBvciBgbnVsbGAnKTtcbiAgICAgIH1cbiAgICAgIHZhciBjdXN0b21JbnNwZWN0ID0gaGFzKG9wdHMsIFwiY3VzdG9tSW5zcGVjdFwiKSA/IG9wdHMuY3VzdG9tSW5zcGVjdCA6IHRydWU7XG4gICAgICBpZiAodHlwZW9mIGN1c3RvbUluc3BlY3QgIT09IFwiYm9vbGVhblwiICYmIGN1c3RvbUluc3BlY3QgIT09IFwic3ltYm9sXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm9wdGlvbiBcXFwiY3VzdG9tSW5zcGVjdFxcXCIsIGlmIHByb3ZpZGVkLCBtdXN0IGJlIGB0cnVlYCwgYGZhbHNlYCwgb3IgYCdzeW1ib2wnYFwiKTtcbiAgICAgIH1cbiAgICAgIGlmIChoYXMob3B0cywgXCJpbmRlbnRcIikgJiYgb3B0cy5pbmRlbnQgIT09IG51bGwgJiYgb3B0cy5pbmRlbnQgIT09IFwiXHRcIiAmJiAhKHBhcnNlSW50KG9wdHMuaW5kZW50LCAxMCkgPT09IG9wdHMuaW5kZW50ICYmIG9wdHMuaW5kZW50ID4gMCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignb3B0aW9uIFwiaW5kZW50XCIgbXVzdCBiZSBcIlxcXFx0XCIsIGFuIGludGVnZXIgPiAwLCBvciBgbnVsbGAnKTtcbiAgICAgIH1cbiAgICAgIGlmIChoYXMob3B0cywgXCJudW1lcmljU2VwYXJhdG9yXCIpICYmIHR5cGVvZiBvcHRzLm51bWVyaWNTZXBhcmF0b3IgIT09IFwiYm9vbGVhblwiKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ29wdGlvbiBcIm51bWVyaWNTZXBhcmF0b3JcIiwgaWYgcHJvdmlkZWQsIG11c3QgYmUgYHRydWVgIG9yIGBmYWxzZWAnKTtcbiAgICAgIH1cbiAgICAgIHZhciBudW1lcmljU2VwYXJhdG9yID0gb3B0cy5udW1lcmljU2VwYXJhdG9yO1xuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgcmV0dXJuIFwidW5kZWZpbmVkXCI7XG4gICAgICB9XG4gICAgICBpZiAob2JqID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBcIm51bGxcIjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcImJvb2xlYW5cIikge1xuICAgICAgICByZXR1cm4gb2JqID8gXCJ0cnVlXCIgOiBcImZhbHNlXCI7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICByZXR1cm4gaW5zcGVjdFN0cmluZyhvYmosIG9wdHMpO1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBvYmogPT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgaWYgKG9iaiA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBJbmZpbml0eSAvIG9iaiA+IDAgPyBcIjBcIiA6IFwiLTBcIjtcbiAgICAgICAgfVxuICAgICAgICB2YXIgc3RyID0gU3RyaW5nKG9iaik7XG4gICAgICAgIHJldHVybiBudW1lcmljU2VwYXJhdG9yID8gYWRkTnVtZXJpY1NlcGFyYXRvcihvYmosIHN0cikgOiBzdHI7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJiaWdpbnRcIikge1xuICAgICAgICB2YXIgYmlnSW50U3RyID0gU3RyaW5nKG9iaikgKyBcIm5cIjtcbiAgICAgICAgcmV0dXJuIG51bWVyaWNTZXBhcmF0b3IgPyBhZGROdW1lcmljU2VwYXJhdG9yKG9iaiwgYmlnSW50U3RyKSA6IGJpZ0ludFN0cjtcbiAgICAgIH1cbiAgICAgIHZhciBtYXhEZXB0aCA9IHR5cGVvZiBvcHRzLmRlcHRoID09PSBcInVuZGVmaW5lZFwiID8gNSA6IG9wdHMuZGVwdGg7XG4gICAgICBpZiAodHlwZW9mIGRlcHRoID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIGRlcHRoID0gMDtcbiAgICAgIH1cbiAgICAgIGlmIChkZXB0aCA+PSBtYXhEZXB0aCAmJiBtYXhEZXB0aCA+IDAgJiYgdHlwZW9mIG9iaiA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gaXNBcnJheShvYmopID8gXCJbQXJyYXldXCIgOiBcIltPYmplY3RdXCI7XG4gICAgICB9XG4gICAgICB2YXIgaW5kZW50ID0gZ2V0SW5kZW50KG9wdHMsIGRlcHRoKTtcbiAgICAgIGlmICh0eXBlb2Ygc2VlbiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICBzZWVuID0gW107XG4gICAgICB9IGVsc2UgaWYgKGluZGV4T2Yoc2Vlbiwgb2JqKSA+PSAwKSB7XG4gICAgICAgIHJldHVybiBcIltDaXJjdWxhcl1cIjtcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIGluc3BlY3QzKHZhbHVlLCBmcm9tLCBub0luZGVudCkge1xuICAgICAgICBpZiAoZnJvbSkge1xuICAgICAgICAgIHNlZW4gPSAkYXJyU2xpY2UuY2FsbChzZWVuKTtcbiAgICAgICAgICBzZWVuLnB1c2goZnJvbSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vSW5kZW50KSB7XG4gICAgICAgICAgdmFyIG5ld09wdHMgPSB7XG4gICAgICAgICAgICBkZXB0aDogb3B0cy5kZXB0aFxuICAgICAgICAgIH07XG4gICAgICAgICAgaWYgKGhhcyhvcHRzLCBcInF1b3RlU3R5bGVcIikpIHtcbiAgICAgICAgICAgIG5ld09wdHMucXVvdGVTdHlsZSA9IG9wdHMucXVvdGVTdHlsZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGluc3BlY3RfKHZhbHVlLCBuZXdPcHRzLCBkZXB0aCArIDEsIHNlZW4pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbnNwZWN0Xyh2YWx1ZSwgb3B0cywgZGVwdGggKyAxLCBzZWVuKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygb2JqID09PSBcImZ1bmN0aW9uXCIgJiYgIWlzUmVnRXhwKG9iaikpIHtcbiAgICAgICAgdmFyIG5hbWUgPSBuYW1lT2Yob2JqKTtcbiAgICAgICAgdmFyIGtleXMgPSBhcnJPYmpLZXlzKG9iaiwgaW5zcGVjdDMpO1xuICAgICAgICByZXR1cm4gXCJbRnVuY3Rpb25cIiArIChuYW1lID8gXCI6IFwiICsgbmFtZSA6IFwiIChhbm9ueW1vdXMpXCIpICsgXCJdXCIgKyAoa2V5cy5sZW5ndGggPiAwID8gXCIgeyBcIiArICRqb2luLmNhbGwoa2V5cywgXCIsIFwiKSArIFwiIH1cIiA6IFwiXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGlzU3ltYm9sKG9iaikpIHtcbiAgICAgICAgdmFyIHN5bVN0cmluZyA9IGhhc1NoYW1tZWRTeW1ib2xzID8gJHJlcGxhY2UuY2FsbChTdHJpbmcob2JqKSwgL14oU3ltYm9sXFwoLipcXCkpX1teKV0qJC8sIFwiJDFcIikgOiBzeW1Ub1N0cmluZy5jYWxsKG9iaik7XG4gICAgICAgIHJldHVybiB0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmICFoYXNTaGFtbWVkU3ltYm9scyA/IG1hcmtCb3hlZChzeW1TdHJpbmcpIDogc3ltU3RyaW5nO1xuICAgICAgfVxuICAgICAgaWYgKGlzRWxlbWVudChvYmopKSB7XG4gICAgICAgIHZhciBzID0gXCI8XCIgKyAkdG9Mb3dlckNhc2UuY2FsbChTdHJpbmcob2JqLm5vZGVOYW1lKSk7XG4gICAgICAgIHZhciBhdHRycyA9IG9iai5hdHRyaWJ1dGVzIHx8IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgcyArPSBcIiBcIiArIGF0dHJzW2ldLm5hbWUgKyBcIj1cIiArIHdyYXBRdW90ZXMocXVvdGUoYXR0cnNbaV0udmFsdWUpLCBcImRvdWJsZVwiLCBvcHRzKTtcbiAgICAgICAgfVxuICAgICAgICBzICs9IFwiPlwiO1xuICAgICAgICBpZiAob2JqLmNoaWxkTm9kZXMgJiYgb2JqLmNoaWxkTm9kZXMubGVuZ3RoKSB7XG4gICAgICAgICAgcyArPSBcIi4uLlwiO1xuICAgICAgICB9XG4gICAgICAgIHMgKz0gXCI8L1wiICsgJHRvTG93ZXJDYXNlLmNhbGwoU3RyaW5nKG9iai5ub2RlTmFtZSkpICsgXCI+XCI7XG4gICAgICAgIHJldHVybiBzO1xuICAgICAgfVxuICAgICAgaWYgKGlzQXJyYXkob2JqKSkge1xuICAgICAgICBpZiAob2JqLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBcIltdXCI7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHhzID0gYXJyT2JqS2V5cyhvYmosIGluc3BlY3QzKTtcbiAgICAgICAgaWYgKGluZGVudCAmJiAhc2luZ2xlTGluZVZhbHVlcyh4cykpIHtcbiAgICAgICAgICByZXR1cm4gXCJbXCIgKyBpbmRlbnRlZEpvaW4oeHMsIGluZGVudCkgKyBcIl1cIjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gXCJbIFwiICsgJGpvaW4uY2FsbCh4cywgXCIsIFwiKSArIFwiIF1cIjtcbiAgICAgIH1cbiAgICAgIGlmIChpc0Vycm9yKG9iaikpIHtcbiAgICAgICAgdmFyIHBhcnRzID0gYXJyT2JqS2V5cyhvYmosIGluc3BlY3QzKTtcbiAgICAgICAgaWYgKCEoXCJjYXVzZVwiIGluIEVycm9yLnByb3RvdHlwZSkgJiYgXCJjYXVzZVwiIGluIG9iaiAmJiAhaXNFbnVtZXJhYmxlLmNhbGwob2JqLCBcImNhdXNlXCIpKSB7XG4gICAgICAgICAgcmV0dXJuIFwieyBbXCIgKyBTdHJpbmcob2JqKSArIFwiXSBcIiArICRqb2luLmNhbGwoJGNvbmNhdC5jYWxsKFwiW2NhdXNlXTogXCIgKyBpbnNwZWN0MyhvYmouY2F1c2UpLCBwYXJ0cyksIFwiLCBcIikgKyBcIiB9XCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBcIltcIiArIFN0cmluZyhvYmopICsgXCJdXCI7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFwieyBbXCIgKyBTdHJpbmcob2JqKSArIFwiXSBcIiArICRqb2luLmNhbGwocGFydHMsIFwiLCBcIikgKyBcIiB9XCI7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJvYmplY3RcIiAmJiBjdXN0b21JbnNwZWN0KSB7XG4gICAgICAgIGlmIChpbnNwZWN0U3ltYm9sICYmIHR5cGVvZiBvYmpbaW5zcGVjdFN5bWJvbF0gPT09IFwiZnVuY3Rpb25cIiAmJiB1dGlsSW5zcGVjdCkge1xuICAgICAgICAgIHJldHVybiB1dGlsSW5zcGVjdChvYmosIHsgZGVwdGg6IG1heERlcHRoIC0gZGVwdGggfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY3VzdG9tSW5zcGVjdCAhPT0gXCJzeW1ib2xcIiAmJiB0eXBlb2Ygb2JqLmluc3BlY3QgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHJldHVybiBvYmouaW5zcGVjdCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaXNNYXAob2JqKSkge1xuICAgICAgICB2YXIgbWFwUGFydHMgPSBbXTtcbiAgICAgICAgaWYgKG1hcEZvckVhY2gpIHtcbiAgICAgICAgICBtYXBGb3JFYWNoLmNhbGwob2JqLCBmdW5jdGlvbih2YWx1ZSwga2V5KSB7XG4gICAgICAgICAgICBtYXBQYXJ0cy5wdXNoKGluc3BlY3QzKGtleSwgb2JqLCB0cnVlKSArIFwiID0+IFwiICsgaW5zcGVjdDModmFsdWUsIG9iaikpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb2xsZWN0aW9uT2YoXCJNYXBcIiwgbWFwU2l6ZS5jYWxsKG9iaiksIG1hcFBhcnRzLCBpbmRlbnQpO1xuICAgICAgfVxuICAgICAgaWYgKGlzU2V0KG9iaikpIHtcbiAgICAgICAgdmFyIHNldFBhcnRzID0gW107XG4gICAgICAgIGlmIChzZXRGb3JFYWNoKSB7XG4gICAgICAgICAgc2V0Rm9yRWFjaC5jYWxsKG9iaiwgZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgICAgIHNldFBhcnRzLnB1c2goaW5zcGVjdDModmFsdWUsIG9iaikpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjb2xsZWN0aW9uT2YoXCJTZXRcIiwgc2V0U2l6ZS5jYWxsKG9iaiksIHNldFBhcnRzLCBpbmRlbnQpO1xuICAgICAgfVxuICAgICAgaWYgKGlzV2Vha01hcChvYmopKSB7XG4gICAgICAgIHJldHVybiB3ZWFrQ29sbGVjdGlvbk9mKFwiV2Vha01hcFwiKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc1dlYWtTZXQob2JqKSkge1xuICAgICAgICByZXR1cm4gd2Vha0NvbGxlY3Rpb25PZihcIldlYWtTZXRcIik7XG4gICAgICB9XG4gICAgICBpZiAoaXNXZWFrUmVmKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIHdlYWtDb2xsZWN0aW9uT2YoXCJXZWFrUmVmXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGlzTnVtYmVyKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtCb3hlZChpbnNwZWN0MyhOdW1iZXIob2JqKSkpO1xuICAgICAgfVxuICAgICAgaWYgKGlzQmlnSW50KG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hcmtCb3hlZChpbnNwZWN0MyhiaWdJbnRWYWx1ZU9mLmNhbGwob2JqKSkpO1xuICAgICAgfVxuICAgICAgaWYgKGlzQm9vbGVhbihvYmopKSB7XG4gICAgICAgIHJldHVybiBtYXJrQm94ZWQoYm9vbGVhblZhbHVlT2YuY2FsbChvYmopKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc1N0cmluZyhvYmopKSB7XG4gICAgICAgIHJldHVybiBtYXJrQm94ZWQoaW5zcGVjdDMoU3RyaW5nKG9iaikpKTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiICYmIG9iaiA9PT0gd2luZG93KSB7XG4gICAgICAgIHJldHVybiBcInsgW29iamVjdCBXaW5kb3ddIH1cIjtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgZ2xvYmFsVGhpcyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBvYmogPT09IGdsb2JhbFRoaXMgfHwgdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiAmJiBvYmogPT09IGdsb2JhbCkge1xuICAgICAgICByZXR1cm4gXCJ7IFtvYmplY3QgZ2xvYmFsVGhpc10gfVwiO1xuICAgICAgfVxuICAgICAgaWYgKCFpc0RhdGUob2JqKSAmJiAhaXNSZWdFeHAob2JqKSkge1xuICAgICAgICB2YXIgeXMgPSBhcnJPYmpLZXlzKG9iaiwgaW5zcGVjdDMpO1xuICAgICAgICB2YXIgaXNQbGFpbk9iamVjdCA9IGdQTyA/IGdQTyhvYmopID09PSBPYmplY3QucHJvdG90eXBlIDogb2JqIGluc3RhbmNlb2YgT2JqZWN0IHx8IG9iai5jb25zdHJ1Y3RvciA9PT0gT2JqZWN0O1xuICAgICAgICB2YXIgcHJvdG9UYWcgPSBvYmogaW5zdGFuY2VvZiBPYmplY3QgPyBcIlwiIDogXCJudWxsIHByb3RvdHlwZVwiO1xuICAgICAgICB2YXIgc3RyaW5nVGFnID0gIWlzUGxhaW5PYmplY3QgJiYgdG9TdHJpbmdUYWcgJiYgT2JqZWN0KG9iaikgPT09IG9iaiAmJiB0b1N0cmluZ1RhZyBpbiBvYmogPyAkc2xpY2UuY2FsbCh0b1N0cihvYmopLCA4LCAtMSkgOiBwcm90b1RhZyA/IFwiT2JqZWN0XCIgOiBcIlwiO1xuICAgICAgICB2YXIgY29uc3RydWN0b3JUYWcgPSBpc1BsYWluT2JqZWN0IHx8IHR5cGVvZiBvYmouY29uc3RydWN0b3IgIT09IFwiZnVuY3Rpb25cIiA/IFwiXCIgOiBvYmouY29uc3RydWN0b3IubmFtZSA/IG9iai5jb25zdHJ1Y3Rvci5uYW1lICsgXCIgXCIgOiBcIlwiO1xuICAgICAgICB2YXIgdGFnID0gY29uc3RydWN0b3JUYWcgKyAoc3RyaW5nVGFnIHx8IHByb3RvVGFnID8gXCJbXCIgKyAkam9pbi5jYWxsKCRjb25jYXQuY2FsbChbXSwgc3RyaW5nVGFnIHx8IFtdLCBwcm90b1RhZyB8fCBbXSksIFwiOiBcIikgKyBcIl0gXCIgOiBcIlwiKTtcbiAgICAgICAgaWYgKHlzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiB0YWcgKyBcInt9XCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGluZGVudCkge1xuICAgICAgICAgIHJldHVybiB0YWcgKyBcIntcIiArIGluZGVudGVkSm9pbih5cywgaW5kZW50KSArIFwifVwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0YWcgKyBcInsgXCIgKyAkam9pbi5jYWxsKHlzLCBcIiwgXCIpICsgXCIgfVwiO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFN0cmluZyhvYmopO1xuICAgIH07XG4gICAgZnVuY3Rpb24gd3JhcFF1b3RlcyhzLCBkZWZhdWx0U3R5bGUsIG9wdHMpIHtcbiAgICAgIHZhciBzdHlsZSA9IG9wdHMucXVvdGVTdHlsZSB8fCBkZWZhdWx0U3R5bGU7XG4gICAgICB2YXIgcXVvdGVDaGFyID0gcXVvdGVzW3N0eWxlXTtcbiAgICAgIHJldHVybiBxdW90ZUNoYXIgKyBzICsgcXVvdGVDaGFyO1xuICAgIH1cbiAgICBmdW5jdGlvbiBxdW90ZShzKSB7XG4gICAgICByZXR1cm4gJHJlcGxhY2UuY2FsbChTdHJpbmcocyksIC9cIi9nLCBcIiZxdW90O1wiKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gY2FuVHJ1c3RUb1N0cmluZyhvYmopIHtcbiAgICAgIHJldHVybiAhdG9TdHJpbmdUYWcgfHwgISh0eXBlb2Ygb2JqID09PSBcIm9iamVjdFwiICYmICh0b1N0cmluZ1RhZyBpbiBvYmogfHwgdHlwZW9mIG9ialt0b1N0cmluZ1RhZ10gIT09IFwidW5kZWZpbmVkXCIpKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNBcnJheShvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgQXJyYXldXCIgJiYgY2FuVHJ1c3RUb1N0cmluZyhvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc0RhdGUob2JqKSB7XG4gICAgICByZXR1cm4gdG9TdHIob2JqKSA9PT0gXCJbb2JqZWN0IERhdGVdXCIgJiYgY2FuVHJ1c3RUb1N0cmluZyhvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1JlZ0V4cChvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgUmVnRXhwXVwiICYmIGNhblRydXN0VG9TdHJpbmcob2JqKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNFcnJvcihvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgRXJyb3JdXCIgJiYgY2FuVHJ1c3RUb1N0cmluZyhvYmopO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1N0cmluZyhvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgU3RyaW5nXVwiICYmIGNhblRydXN0VG9TdHJpbmcob2JqKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNOdW1iZXIob2JqKSB7XG4gICAgICByZXR1cm4gdG9TdHIob2JqKSA9PT0gXCJbb2JqZWN0IE51bWJlcl1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzQm9vbGVhbihvYmopIHtcbiAgICAgIHJldHVybiB0b1N0cihvYmopID09PSBcIltvYmplY3QgQm9vbGVhbl1cIiAmJiBjYW5UcnVzdFRvU3RyaW5nKG9iaik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzU3ltYm9sKG9iaikge1xuICAgICAgaWYgKGhhc1NoYW1tZWRTeW1ib2xzKSB7XG4gICAgICAgIHJldHVybiBvYmogJiYgdHlwZW9mIG9iaiA9PT0gXCJvYmplY3RcIiAmJiBvYmogaW5zdGFuY2VvZiBTeW1ib2w7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIG9iaiA9PT0gXCJzeW1ib2xcIikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmICghb2JqIHx8IHR5cGVvZiBvYmogIT09IFwib2JqZWN0XCIgfHwgIXN5bVRvU3RyaW5nKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHN5bVRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzQmlnSW50KG9iaikge1xuICAgICAgaWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIiB8fCAhYmlnSW50VmFsdWVPZikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBiaWdJbnRWYWx1ZU9mLmNhbGwob2JqKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHZhciBoYXNPd24yID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eSB8fCBmdW5jdGlvbihrZXkpIHtcbiAgICAgIHJldHVybiBrZXkgaW4gdGhpcztcbiAgICB9O1xuICAgIGZ1bmN0aW9uIGhhcyhvYmosIGtleSkge1xuICAgICAgcmV0dXJuIGhhc093bjIuY2FsbChvYmosIGtleSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHRvU3RyKG9iaikge1xuICAgICAgcmV0dXJuIG9iamVjdFRvU3RyaW5nLmNhbGwob2JqKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbmFtZU9mKGYpIHtcbiAgICAgIGlmIChmLm5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGYubmFtZTtcbiAgICAgIH1cbiAgICAgIHZhciBtID0gJG1hdGNoLmNhbGwoZnVuY3Rpb25Ub1N0cmluZy5jYWxsKGYpLCAvXmZ1bmN0aW9uXFxzKihbXFx3JF0rKS8pO1xuICAgICAgaWYgKG0pIHtcbiAgICAgICAgcmV0dXJuIG1bMV07XG4gICAgICB9XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgZnVuY3Rpb24gaW5kZXhPZih4cywgeCkge1xuICAgICAgaWYgKHhzLmluZGV4T2YpIHtcbiAgICAgICAgcmV0dXJuIHhzLmluZGV4T2YoeCk7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBpZiAoeHNbaV0gPT09IHgpIHtcbiAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIC0xO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc01hcCh4KSB7XG4gICAgICBpZiAoIW1hcFNpemUgfHwgIXggfHwgdHlwZW9mIHggIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgbWFwU2l6ZS5jYWxsKHgpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHNldFNpemUuY2FsbCh4KTtcbiAgICAgICAgfSBjYXRjaCAocykge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4IGluc3RhbmNlb2YgTWFwO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1dlYWtNYXAoeCkge1xuICAgICAgaWYgKCF3ZWFrTWFwSGFzIHx8ICF4IHx8IHR5cGVvZiB4ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHRyeSB7XG4gICAgICAgIHdlYWtNYXBIYXMuY2FsbCh4LCB3ZWFrTWFwSGFzKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB3ZWFrU2V0SGFzLmNhbGwoeCwgd2Vha1NldEhhcyk7XG4gICAgICAgIH0gY2F0Y2ggKHMpIHtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4geCBpbnN0YW5jZW9mIFdlYWtNYXA7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzV2Vha1JlZih4KSB7XG4gICAgICBpZiAoIXdlYWtSZWZEZXJlZiB8fCAheCB8fCB0eXBlb2YgeCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICB3ZWFrUmVmRGVyZWYuY2FsbCh4KTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzU2V0KHgpIHtcbiAgICAgIGlmICghc2V0U2l6ZSB8fCAheCB8fCB0eXBlb2YgeCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICB0cnkge1xuICAgICAgICBzZXRTaXplLmNhbGwoeCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgbWFwU2l6ZS5jYWxsKHgpO1xuICAgICAgICB9IGNhdGNoIChtKSB7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHggaW5zdGFuY2VvZiBTZXQ7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGlzV2Vha1NldCh4KSB7XG4gICAgICBpZiAoIXdlYWtTZXRIYXMgfHwgIXggfHwgdHlwZW9mIHggIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgd2Vha1NldEhhcy5jYWxsKHgsIHdlYWtTZXRIYXMpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHdlYWtNYXBIYXMuY2FsbCh4LCB3ZWFrTWFwSGFzKTtcbiAgICAgICAgfSBjYXRjaCAocykge1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB4IGluc3RhbmNlb2YgV2Vha1NldDtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaXNFbGVtZW50KHgpIHtcbiAgICAgIGlmICgheCB8fCB0eXBlb2YgeCAhPT0gXCJvYmplY3RcIikge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIEhUTUxFbGVtZW50ICE9PSBcInVuZGVmaW5lZFwiICYmIHggaW5zdGFuY2VvZiBIVE1MRWxlbWVudCkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0eXBlb2YgeC5ub2RlTmFtZSA9PT0gXCJzdHJpbmdcIiAmJiB0eXBlb2YgeC5nZXRBdHRyaWJ1dGUgPT09IFwiZnVuY3Rpb25cIjtcbiAgICB9XG4gICAgZnVuY3Rpb24gaW5zcGVjdFN0cmluZyhzdHIsIG9wdHMpIHtcbiAgICAgIGlmIChzdHIubGVuZ3RoID4gb3B0cy5tYXhTdHJpbmdMZW5ndGgpIHtcbiAgICAgICAgdmFyIHJlbWFpbmluZyA9IHN0ci5sZW5ndGggLSBvcHRzLm1heFN0cmluZ0xlbmd0aDtcbiAgICAgICAgdmFyIHRyYWlsZXIgPSBcIi4uLiBcIiArIHJlbWFpbmluZyArIFwiIG1vcmUgY2hhcmFjdGVyXCIgKyAocmVtYWluaW5nID4gMSA/IFwic1wiIDogXCJcIik7XG4gICAgICAgIHJldHVybiBpbnNwZWN0U3RyaW5nKCRzbGljZS5jYWxsKHN0ciwgMCwgb3B0cy5tYXhTdHJpbmdMZW5ndGgpLCBvcHRzKSArIHRyYWlsZXI7XG4gICAgICB9XG4gICAgICB2YXIgcXVvdGVSRSA9IHF1b3RlUkVzW29wdHMucXVvdGVTdHlsZSB8fCBcInNpbmdsZVwiXTtcbiAgICAgIHF1b3RlUkUubGFzdEluZGV4ID0gMDtcbiAgICAgIHZhciBzID0gJHJlcGxhY2UuY2FsbCgkcmVwbGFjZS5jYWxsKHN0ciwgcXVvdGVSRSwgXCJcXFxcJDFcIiksIC9bXFx4MDAtXFx4MWZdL2csIGxvd2J5dGUpO1xuICAgICAgcmV0dXJuIHdyYXBRdW90ZXMocywgXCJzaW5nbGVcIiwgb3B0cyk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGxvd2J5dGUoYykge1xuICAgICAgdmFyIG4gPSBjLmNoYXJDb2RlQXQoMCk7XG4gICAgICB2YXIgeCA9IHtcbiAgICAgICAgODogXCJiXCIsXG4gICAgICAgIDk6IFwidFwiLFxuICAgICAgICAxMDogXCJuXCIsXG4gICAgICAgIDEyOiBcImZcIixcbiAgICAgICAgMTM6IFwiclwiXG4gICAgICB9W25dO1xuICAgICAgaWYgKHgpIHtcbiAgICAgICAgcmV0dXJuIFwiXFxcXFwiICsgeDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBcIlxcXFx4XCIgKyAobiA8IDE2ID8gXCIwXCIgOiBcIlwiKSArICR0b1VwcGVyQ2FzZS5jYWxsKG4udG9TdHJpbmcoMTYpKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbWFya0JveGVkKHN0cikge1xuICAgICAgcmV0dXJuIFwiT2JqZWN0KFwiICsgc3RyICsgXCIpXCI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHdlYWtDb2xsZWN0aW9uT2YodHlwZSkge1xuICAgICAgcmV0dXJuIHR5cGUgKyBcIiB7ID8gfVwiO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjb2xsZWN0aW9uT2YodHlwZSwgc2l6ZSwgZW50cmllcywgaW5kZW50KSB7XG4gICAgICB2YXIgam9pbmVkRW50cmllcyA9IGluZGVudCA/IGluZGVudGVkSm9pbihlbnRyaWVzLCBpbmRlbnQpIDogJGpvaW4uY2FsbChlbnRyaWVzLCBcIiwgXCIpO1xuICAgICAgcmV0dXJuIHR5cGUgKyBcIiAoXCIgKyBzaXplICsgXCIpIHtcIiArIGpvaW5lZEVudHJpZXMgKyBcIn1cIjtcbiAgICB9XG4gICAgZnVuY3Rpb24gc2luZ2xlTGluZVZhbHVlcyh4cykge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoaW5kZXhPZih4c1tpXSwgXCJcXG5cIikgPj0gMCkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldEluZGVudChvcHRzLCBkZXB0aCkge1xuICAgICAgdmFyIGJhc2VJbmRlbnQ7XG4gICAgICBpZiAob3B0cy5pbmRlbnQgPT09IFwiXHRcIikge1xuICAgICAgICBiYXNlSW5kZW50ID0gXCJcdFwiO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygb3B0cy5pbmRlbnQgPT09IFwibnVtYmVyXCIgJiYgb3B0cy5pbmRlbnQgPiAwKSB7XG4gICAgICAgIGJhc2VJbmRlbnQgPSAkam9pbi5jYWxsKEFycmF5KG9wdHMuaW5kZW50ICsgMSksIFwiIFwiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgYmFzZTogYmFzZUluZGVudCxcbiAgICAgICAgcHJldjogJGpvaW4uY2FsbChBcnJheShkZXB0aCArIDEpLCBiYXNlSW5kZW50KVxuICAgICAgfTtcbiAgICB9XG4gICAgZnVuY3Rpb24gaW5kZW50ZWRKb2luKHhzLCBpbmRlbnQpIHtcbiAgICAgIGlmICh4cy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFwiXCI7XG4gICAgICB9XG4gICAgICB2YXIgbGluZUpvaW5lciA9IFwiXFxuXCIgKyBpbmRlbnQucHJldiArIGluZGVudC5iYXNlO1xuICAgICAgcmV0dXJuIGxpbmVKb2luZXIgKyAkam9pbi5jYWxsKHhzLCBcIixcIiArIGxpbmVKb2luZXIpICsgXCJcXG5cIiArIGluZGVudC5wcmV2O1xuICAgIH1cbiAgICBmdW5jdGlvbiBhcnJPYmpLZXlzKG9iaiwgaW5zcGVjdDMpIHtcbiAgICAgIHZhciBpc0FyciA9IGlzQXJyYXkob2JqKTtcbiAgICAgIHZhciB4cyA9IFtdO1xuICAgICAgaWYgKGlzQXJyKSB7XG4gICAgICAgIHhzLmxlbmd0aCA9IG9iai5sZW5ndGg7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2JqLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgeHNbaV0gPSBoYXMob2JqLCBpKSA/IGluc3BlY3QzKG9ialtpXSwgb2JqKSA6IFwiXCI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHZhciBzeW1zID0gdHlwZW9mIGdPUFMgPT09IFwiZnVuY3Rpb25cIiA/IGdPUFMob2JqKSA6IFtdO1xuICAgICAgdmFyIHN5bU1hcDtcbiAgICAgIGlmIChoYXNTaGFtbWVkU3ltYm9scykge1xuICAgICAgICBzeW1NYXAgPSB7fTtcbiAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBzeW1zLmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgc3ltTWFwW1wiJFwiICsgc3ltc1trXV0gPSBzeW1zW2tdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmICghaGFzKG9iaiwga2V5KSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChpc0FyciAmJiBTdHJpbmcoTnVtYmVyKGtleSkpID09PSBrZXkgJiYga2V5IDwgb2JqLmxlbmd0aCkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChoYXNTaGFtbWVkU3ltYm9scyAmJiBzeW1NYXBbXCIkXCIgKyBrZXldIGluc3RhbmNlb2YgU3ltYm9sKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gZWxzZSBpZiAoJHRlc3QuY2FsbCgvW15cXHckXS8sIGtleSkpIHtcbiAgICAgICAgICB4cy5wdXNoKGluc3BlY3QzKGtleSwgb2JqKSArIFwiOiBcIiArIGluc3BlY3QzKG9ialtrZXldLCBvYmopKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB4cy5wdXNoKGtleSArIFwiOiBcIiArIGluc3BlY3QzKG9ialtrZXldLCBvYmopKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiBnT1BTID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPCBzeW1zLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgaWYgKGlzRW51bWVyYWJsZS5jYWxsKG9iaiwgc3ltc1tqXSkpIHtcbiAgICAgICAgICAgIHhzLnB1c2goXCJbXCIgKyBpbnNwZWN0MyhzeW1zW2pdKSArIFwiXTogXCIgKyBpbnNwZWN0MyhvYmpbc3ltc1tqXV0sIG9iaikpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHhzO1xuICAgIH1cbiAgfVxufSk7XG5cbi8vIHNyYy9saWIvYmluYXJ5X3JlYWRlci50c1xudmFyIEJpbmFyeVJlYWRlciA9IGNsYXNzIHtcbiAgLyoqXG4gICAqIFRoZSBEYXRhVmlldyB1c2VkIHRvIHJlYWQgdmFsdWVzIGZyb20gdGhlIGJpbmFyeSBkYXRhLlxuICAgKlxuICAgKiBOb3RlOiBUaGUgRGF0YVZpZXcncyBgYnl0ZU9mZnNldGAgaXMgcmVsYXRpdmUgdG8gdGhlIGJlZ2lubmluZyBvZiB0aGVcbiAgICogdW5kZXJseWluZyBBcnJheUJ1ZmZlciwgbm90IHRoZSBzdGFydCBvZiB0aGUgcHJvdmlkZWQgVWludDhBcnJheSBpbnB1dC5cbiAgICogVGhpcyBgQmluYXJ5UmVhZGVyYCdzIGAjb2Zmc2V0YCBmaWVsZCBpcyB1c2VkIHRvIHRyYWNrIHRoZSBjdXJyZW50IHJlYWQgcG9zaXRpb25cbiAgICogcmVsYXRpdmUgdG8gdGhlIHN0YXJ0IG9mIHRoZSBwcm92aWRlZCBVaW50OEFycmF5IGlucHV0LlxuICAgKi9cbiAgdmlldztcbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgdGhlIG9mZnNldCAoaW4gYnl0ZXMpIHJlbGF0aXZlIHRvIHRoZSBzdGFydCBvZiB0aGUgRGF0YVZpZXdcbiAgICogYW5kIHByb3ZpZGVkIFVpbnQ4QXJyYXkgaW5wdXQuXG4gICAqXG4gICAqIE5vdGU6IFRoaXMgaXMgKm5vdCogdGhlIGFic29sdXRlIGJ5dGUgb2Zmc2V0IHdpdGhpbiB0aGUgdW5kZXJseWluZyBBcnJheUJ1ZmZlci5cbiAgICovXG4gIG9mZnNldCA9IDA7XG4gIGNvbnN0cnVjdG9yKGlucHV0KSB7XG4gICAgdGhpcy52aWV3ID0gaW5wdXQgaW5zdGFuY2VvZiBEYXRhVmlldyA/IGlucHV0IDogbmV3IERhdGFWaWV3KGlucHV0LmJ1ZmZlciwgaW5wdXQuYnl0ZU9mZnNldCwgaW5wdXQuYnl0ZUxlbmd0aCk7XG4gICAgdGhpcy5vZmZzZXQgPSAwO1xuICB9XG4gIHJlc2V0KGlucHV0KSB7XG4gICAgdGhpcy52aWV3ID0gaW5wdXQgaW5zdGFuY2VvZiBEYXRhVmlldyA/IGlucHV0IDogbmV3IERhdGFWaWV3KGlucHV0LmJ1ZmZlciwgaW5wdXQuYnl0ZU9mZnNldCwgaW5wdXQuYnl0ZUxlbmd0aCk7XG4gICAgdGhpcy5vZmZzZXQgPSAwO1xuICB9XG4gIGdldCByZW1haW5pbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMudmlldy5ieXRlTGVuZ3RoIC0gdGhpcy5vZmZzZXQ7XG4gIH1cbiAgLyoqIEVuc3VyZSB3ZSBoYXZlIGF0IGxlYXN0IGBuYCBieXRlcyBsZWZ0IHRvIHJlYWQgKi9cbiAgI2Vuc3VyZShuKSB7XG4gICAgaWYgKHRoaXMub2Zmc2V0ICsgbiA+IHRoaXMudmlldy5ieXRlTGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcbiAgICAgICAgYFRyaWVkIHRvIHJlYWQgJHtufSBieXRlKHMpIGF0IHJlbGF0aXZlIG9mZnNldCAke3RoaXMub2Zmc2V0fSwgYnV0IG9ubHkgJHt0aGlzLnJlbWFpbmluZ30gYnl0ZShzKSByZW1haW5gXG4gICAgICApO1xuICAgIH1cbiAgfVxuICByZWFkVUludDhBcnJheSgpIHtcbiAgICBjb25zdCBsZW5ndGggPSB0aGlzLnJlYWRVMzIoKTtcbiAgICB0aGlzLiNlbnN1cmUobGVuZ3RoKTtcbiAgICByZXR1cm4gdGhpcy5yZWFkQnl0ZXMobGVuZ3RoKTtcbiAgfVxuICByZWFkQm9vbCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRVaW50OCh0aGlzLm9mZnNldCk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTtcbiAgICByZXR1cm4gdmFsdWUgIT09IDA7XG4gIH1cbiAgcmVhZEJ5dGUoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0VWludDgodGhpcy5vZmZzZXQpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRCeXRlcyhsZW5ndGgpIHtcbiAgICBjb25zdCBhcnJheSA9IG5ldyBVaW50OEFycmF5KFxuICAgICAgdGhpcy52aWV3LmJ1ZmZlcixcbiAgICAgIHRoaXMudmlldy5ieXRlT2Zmc2V0ICsgdGhpcy5vZmZzZXQsXG4gICAgICBsZW5ndGhcbiAgICApO1xuICAgIHRoaXMub2Zmc2V0ICs9IGxlbmd0aDtcbiAgICByZXR1cm4gYXJyYXk7XG4gIH1cbiAgcmVhZEk4KCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEludDgodGhpcy5vZmZzZXQpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVOCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQnl0ZSgpO1xuICB9XG4gIHJlYWRJMTYoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0SW50MTYodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDI7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVMTYoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0VWludDE2KHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAyO1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICByZWFkSTMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEludDMyKHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSA0O1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICByZWFkVTMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldFVpbnQzMih0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZEk2NCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZFU2NCgpIHtcbiAgICBjb25zdCB2YWx1ZSA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDg7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRVMTI4KCkge1xuICAgIGNvbnN0IGxvd2VyUGFydCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIGNvbnN0IHVwcGVyUGFydCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxNjtcbiAgICByZXR1cm4gKHVwcGVyUGFydCA8PCBCaWdJbnQoNjQpKSArIGxvd2VyUGFydDtcbiAgfVxuICByZWFkSTEyOCgpIHtcbiAgICBjb25zdCBsb3dlclBhcnQgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0LCB0cnVlKTtcbiAgICBjb25zdCB1cHBlclBhcnQgPSB0aGlzLnZpZXcuZ2V0QmlnSW50NjQodGhpcy5vZmZzZXQgKyA4LCB0cnVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxNjtcbiAgICByZXR1cm4gKHVwcGVyUGFydCA8PCBCaWdJbnQoNjQpKSArIGxvd2VyUGFydDtcbiAgfVxuICByZWFkVTI1NigpIHtcbiAgICBjb25zdCBwMCA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIGNvbnN0IHAxID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDgsIHRydWUpO1xuICAgIGNvbnN0IHAyID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCArIDE2LCB0cnVlKTtcbiAgICBjb25zdCBwMyA9IHRoaXMudmlldy5nZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyAyNCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMzI7XG4gICAgcmV0dXJuIChwMyA8PCBCaWdJbnQoMyAqIDY0KSkgKyAocDIgPDwgQmlnSW50KDIgKiA2NCkpICsgKHAxIDw8IEJpZ0ludCgxICogNjQpKSArIHAwO1xuICB9XG4gIHJlYWRJMjU2KCkge1xuICAgIGNvbnN0IHAwID0gdGhpcy52aWV3LmdldEJpZ1VpbnQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgY29uc3QgcDEgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0ICsgOCwgdHJ1ZSk7XG4gICAgY29uc3QgcDIgPSB0aGlzLnZpZXcuZ2V0QmlnVWludDY0KHRoaXMub2Zmc2V0ICsgMTYsIHRydWUpO1xuICAgIGNvbnN0IHAzID0gdGhpcy52aWV3LmdldEJpZ0ludDY0KHRoaXMub2Zmc2V0ICsgMjQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDMyO1xuICAgIHJldHVybiAocDMgPDwgQmlnSW50KDMgKiA2NCkpICsgKHAyIDw8IEJpZ0ludCgyICogNjQpKSArIChwMSA8PCBCaWdJbnQoMSAqIDY0KSkgKyBwMDtcbiAgfVxuICByZWFkRjMyKCkge1xuICAgIGNvbnN0IHZhbHVlID0gdGhpcy52aWV3LmdldEZsb2F0MzIodGhpcy5vZmZzZXQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDQ7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG4gIHJlYWRGNjQoKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZpZXcuZ2V0RmxvYXQ2NCh0aGlzLm9mZnNldCwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cbiAgcmVhZFN0cmluZygpIHtcbiAgICBjb25zdCB1aW50OEFycmF5ID0gdGhpcy5yZWFkVUludDhBcnJheSgpO1xuICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoXCJ1dGYtOFwiKS5kZWNvZGUodWludDhBcnJheSk7XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvYmluYXJ5X3dyaXRlci50c1xudmFyIGltcG9ydF9iYXNlNjRfanMgPSBfX3RvRVNNKHJlcXVpcmVfYmFzZTY0X2pzKCkpO1xudmFyIEFycmF5QnVmZmVyUHJvdG90eXBlVHJhbnNmZXIgPSBBcnJheUJ1ZmZlci5wcm90b3R5cGUudHJhbnNmZXIgPz8gZnVuY3Rpb24obmV3Qnl0ZUxlbmd0aCkge1xuICBpZiAobmV3Qnl0ZUxlbmd0aCA9PT0gdm9pZCAwKSB7XG4gICAgcmV0dXJuIHRoaXMuc2xpY2UoKTtcbiAgfSBlbHNlIGlmIChuZXdCeXRlTGVuZ3RoIDw9IHRoaXMuYnl0ZUxlbmd0aCkge1xuICAgIHJldHVybiB0aGlzLnNsaWNlKDAsIG5ld0J5dGVMZW5ndGgpO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGNvcHkgPSBuZXcgVWludDhBcnJheShuZXdCeXRlTGVuZ3RoKTtcbiAgICBjb3B5LnNldChuZXcgVWludDhBcnJheSh0aGlzKSk7XG4gICAgcmV0dXJuIGNvcHkuYnVmZmVyO1xuICB9XG59O1xudmFyIFJlc2l6YWJsZUJ1ZmZlciA9IGNsYXNzIHtcbiAgYnVmZmVyO1xuICB2aWV3O1xuICBjb25zdHJ1Y3Rvcihpbml0KSB7XG4gICAgdGhpcy5idWZmZXIgPSB0eXBlb2YgaW5pdCA9PT0gXCJudW1iZXJcIiA/IG5ldyBBcnJheUJ1ZmZlcihpbml0KSA6IGluaXQ7XG4gICAgdGhpcy52aWV3ID0gbmV3IERhdGFWaWV3KHRoaXMuYnVmZmVyKTtcbiAgfVxuICBnZXQgY2FwYWNpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVmZmVyLmJ5dGVMZW5ndGg7XG4gIH1cbiAgZ3JvdyhuZXdTaXplKSB7XG4gICAgaWYgKG5ld1NpemUgPD0gdGhpcy5idWZmZXIuYnl0ZUxlbmd0aCkgcmV0dXJuO1xuICAgIHRoaXMuYnVmZmVyID0gQXJyYXlCdWZmZXJQcm90b3R5cGVUcmFuc2Zlci5jYWxsKHRoaXMuYnVmZmVyLCBuZXdTaXplKTtcbiAgICB0aGlzLnZpZXcgPSBuZXcgRGF0YVZpZXcodGhpcy5idWZmZXIpO1xuICB9XG59O1xudmFyIEJpbmFyeVdyaXRlciA9IGNsYXNzIHtcbiAgYnVmZmVyO1xuICBvZmZzZXQgPSAwO1xuICBjb25zdHJ1Y3Rvcihpbml0KSB7XG4gICAgdGhpcy5idWZmZXIgPSB0eXBlb2YgaW5pdCA9PT0gXCJudW1iZXJcIiA/IG5ldyBSZXNpemFibGVCdWZmZXIoaW5pdCkgOiBpbml0O1xuICB9XG4gIGNsZWFyKCkge1xuICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgfVxuICByZXNldChidWZmZXIpIHtcbiAgICB0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICB0aGlzLm9mZnNldCA9IDA7XG4gIH1cbiAgZXhwYW5kQnVmZmVyKGFkZGl0aW9uYWxDYXBhY2l0eSkge1xuICAgIGNvbnN0IG1pbkNhcGFjaXR5ID0gdGhpcy5vZmZzZXQgKyBhZGRpdGlvbmFsQ2FwYWNpdHkgKyAxO1xuICAgIGlmIChtaW5DYXBhY2l0eSA8PSB0aGlzLmJ1ZmZlci5jYXBhY2l0eSkgcmV0dXJuO1xuICAgIGxldCBuZXdDYXBhY2l0eSA9IHRoaXMuYnVmZmVyLmNhcGFjaXR5ICogMjtcbiAgICBpZiAobmV3Q2FwYWNpdHkgPCBtaW5DYXBhY2l0eSkgbmV3Q2FwYWNpdHkgPSBtaW5DYXBhY2l0eTtcbiAgICB0aGlzLmJ1ZmZlci5ncm93KG5ld0NhcGFjaXR5KTtcbiAgfVxuICB0b0Jhc2U2NCgpIHtcbiAgICByZXR1cm4gKDAsIGltcG9ydF9iYXNlNjRfanMuZnJvbUJ5dGVBcnJheSkodGhpcy5nZXRCdWZmZXIoKSk7XG4gIH1cbiAgZ2V0QnVmZmVyKCkge1xuICAgIHJldHVybiBuZXcgVWludDhBcnJheSh0aGlzLmJ1ZmZlci5idWZmZXIsIDAsIHRoaXMub2Zmc2V0KTtcbiAgfVxuICBnZXQgdmlldygpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXIudmlldztcbiAgfVxuICB3cml0ZVVJbnQ4QXJyYXkodmFsdWUpIHtcbiAgICBjb25zdCBsZW5ndGggPSB2YWx1ZS5sZW5ndGg7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoNCArIGxlbmd0aCk7XG4gICAgdGhpcy53cml0ZVUzMihsZW5ndGgpO1xuICAgIG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmJ1ZmZlciwgdGhpcy5vZmZzZXQpLnNldCh2YWx1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gbGVuZ3RoO1xuICB9XG4gIHdyaXRlQm9vbCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDEpO1xuICAgIHRoaXMudmlldy5zZXRVaW50OCh0aGlzLm9mZnNldCwgdmFsdWUgPyAxIDogMCk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTtcbiAgfVxuICB3cml0ZUJ5dGUodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcigxKTtcbiAgICB0aGlzLnZpZXcuc2V0VWludDgodGhpcy5vZmZzZXQsIHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSAxO1xuICB9XG4gIHdyaXRlQnl0ZXModmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcih2YWx1ZS5sZW5ndGgpO1xuICAgIG5ldyBVaW50OEFycmF5KHRoaXMuYnVmZmVyLmJ1ZmZlciwgdGhpcy5vZmZzZXQsIHZhbHVlLmxlbmd0aCkuc2V0KHZhbHVlKTtcbiAgICB0aGlzLm9mZnNldCArPSB2YWx1ZS5sZW5ndGg7XG4gIH1cbiAgd3JpdGVJOCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDEpO1xuICAgIHRoaXMudmlldy5zZXRJbnQ4KHRoaXMub2Zmc2V0LCB2YWx1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTtcbiAgfVxuICB3cml0ZVU4KHZhbHVlKSB7XG4gICAgdGhpcy5leHBhbmRCdWZmZXIoMSk7XG4gICAgdGhpcy52aWV3LnNldFVpbnQ4KHRoaXMub2Zmc2V0LCB2YWx1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMTtcbiAgfVxuICB3cml0ZUkxNih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDIpO1xuICAgIHRoaXMudmlldy5zZXRJbnQxNih0aGlzLm9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDI7XG4gIH1cbiAgd3JpdGVVMTYodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcigyKTtcbiAgICB0aGlzLnZpZXcuc2V0VWludDE2KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMjtcbiAgfVxuICB3cml0ZUkzMih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDQpO1xuICAgIHRoaXMudmlldy5zZXRJbnQzMih0aGlzLm9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDQ7XG4gIH1cbiAgd3JpdGVVMzIodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig0KTtcbiAgICB0aGlzLnZpZXcuc2V0VWludDMyKHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gNDtcbiAgfVxuICB3cml0ZUk2NCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDgpO1xuICAgIHRoaXMudmlldy5zZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDg7XG4gIH1cbiAgd3JpdGVVNjQodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig4KTtcbiAgICB0aGlzLnZpZXcuc2V0QmlnVWludDY0KHRoaXMub2Zmc2V0LCB2YWx1ZSwgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gODtcbiAgfVxuICB3cml0ZVUxMjgodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcigxNik7XG4gICAgY29uc3QgbG93ZXJQYXJ0ID0gdmFsdWUgJiBCaWdJbnQoXCIweEZGRkZGRkZGRkZGRkZGRkZcIik7XG4gICAgY29uc3QgdXBwZXJQYXJ0ID0gdmFsdWUgPj4gQmlnSW50KDY0KTtcbiAgICB0aGlzLnZpZXcuc2V0QmlnVWludDY0KHRoaXMub2Zmc2V0LCBsb3dlclBhcnQsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4LCB1cHBlclBhcnQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE2O1xuICB9XG4gIHdyaXRlSTEyOCh2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDE2KTtcbiAgICBjb25zdCBsb3dlclBhcnQgPSB2YWx1ZSAmIEJpZ0ludChcIjB4RkZGRkZGRkZGRkZGRkZGRlwiKTtcbiAgICBjb25zdCB1cHBlclBhcnQgPSB2YWx1ZSA+PiBCaWdJbnQoNjQpO1xuICAgIHRoaXMudmlldy5zZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCwgbG93ZXJQYXJ0LCB0cnVlKTtcbiAgICB0aGlzLnZpZXcuc2V0QmlnSW50NjQodGhpcy5vZmZzZXQgKyA4LCB1cHBlclBhcnQsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDE2O1xuICB9XG4gIHdyaXRlVTI1Nih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDMyKTtcbiAgICBjb25zdCBsb3dfNjRfbWFzayA9IEJpZ0ludChcIjB4RkZGRkZGRkZGRkZGRkZGRlwiKTtcbiAgICBjb25zdCBwMCA9IHZhbHVlICYgbG93XzY0X21hc2s7XG4gICAgY29uc3QgcDEgPSB2YWx1ZSA+PiBCaWdJbnQoNjQgKiAxKSAmIGxvd182NF9tYXNrO1xuICAgIGNvbnN0IHAyID0gdmFsdWUgPj4gQmlnSW50KDY0ICogMikgJiBsb3dfNjRfbWFzaztcbiAgICBjb25zdCBwMyA9IHZhbHVlID4+IEJpZ0ludCg2NCAqIDMpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4ICogMCwgcDAsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4ICogMSwgcDEsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4ICogMiwgcDIsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4ICogMywgcDMsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDMyO1xuICB9XG4gIHdyaXRlSTI1Nih2YWx1ZSkge1xuICAgIHRoaXMuZXhwYW5kQnVmZmVyKDMyKTtcbiAgICBjb25zdCBsb3dfNjRfbWFzayA9IEJpZ0ludChcIjB4RkZGRkZGRkZGRkZGRkZGRlwiKTtcbiAgICBjb25zdCBwMCA9IHZhbHVlICYgbG93XzY0X21hc2s7XG4gICAgY29uc3QgcDEgPSB2YWx1ZSA+PiBCaWdJbnQoNjQgKiAxKSAmIGxvd182NF9tYXNrO1xuICAgIGNvbnN0IHAyID0gdmFsdWUgPj4gQmlnSW50KDY0ICogMikgJiBsb3dfNjRfbWFzaztcbiAgICBjb25zdCBwMyA9IHZhbHVlID4+IEJpZ0ludCg2NCAqIDMpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4ICogMCwgcDAsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4ICogMSwgcDEsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdVaW50NjQodGhpcy5vZmZzZXQgKyA4ICogMiwgcDIsIHRydWUpO1xuICAgIHRoaXMudmlldy5zZXRCaWdJbnQ2NCh0aGlzLm9mZnNldCArIDggKiAzLCBwMywgdHJ1ZSk7XG4gICAgdGhpcy5vZmZzZXQgKz0gMzI7XG4gIH1cbiAgd3JpdGVGMzIodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig0KTtcbiAgICB0aGlzLnZpZXcuc2V0RmxvYXQzMih0aGlzLm9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDQ7XG4gIH1cbiAgd3JpdGVGNjQodmFsdWUpIHtcbiAgICB0aGlzLmV4cGFuZEJ1ZmZlcig4KTtcbiAgICB0aGlzLnZpZXcuc2V0RmxvYXQ2NCh0aGlzLm9mZnNldCwgdmFsdWUsIHRydWUpO1xuICAgIHRoaXMub2Zmc2V0ICs9IDg7XG4gIH1cbiAgd3JpdGVTdHJpbmcodmFsdWUpIHtcbiAgICBjb25zdCBlbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG4gICAgY29uc3QgZW5jb2RlZFN0cmluZyA9IGVuY29kZXIuZW5jb2RlKHZhbHVlKTtcbiAgICB0aGlzLndyaXRlVUludDhBcnJheShlbmNvZGVkU3RyaW5nKTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi91dGlsLnRzXG5mdW5jdGlvbiB1aW50OEFycmF5VG9IZXhTdHJpbmcoYXJyYXkpIHtcbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChhcnJheS5yZXZlcnNlKCksICh4KSA9PiAoXCIwMFwiICsgeC50b1N0cmluZygxNikpLnNsaWNlKC0yKSkuam9pbihcIlwiKTtcbn1cbmZ1bmN0aW9uIHVpbnQ4QXJyYXlUb1UxMjgoYXJyYXkpIHtcbiAgaWYgKGFycmF5Lmxlbmd0aCAhPSAxNikge1xuICAgIHRocm93IG5ldyBFcnJvcihgVWludDhBcnJheSBpcyBub3QgMTYgYnl0ZXMgbG9uZzogJHthcnJheX1gKTtcbiAgfVxuICByZXR1cm4gbmV3IEJpbmFyeVJlYWRlcihhcnJheSkucmVhZFUxMjgoKTtcbn1cbmZ1bmN0aW9uIHVpbnQ4QXJyYXlUb1UyNTYoYXJyYXkpIHtcbiAgaWYgKGFycmF5Lmxlbmd0aCAhPSAzMikge1xuICAgIHRocm93IG5ldyBFcnJvcihgVWludDhBcnJheSBpcyBub3QgMzIgYnl0ZXMgbG9uZzogWyR7YXJyYXl9XWApO1xuICB9XG4gIHJldHVybiBuZXcgQmluYXJ5UmVhZGVyKGFycmF5KS5yZWFkVTI1NigpO1xufVxuZnVuY3Rpb24gaGV4U3RyaW5nVG9VaW50OEFycmF5KHN0cikge1xuICBpZiAoc3RyLnN0YXJ0c1dpdGgoXCIweFwiKSkge1xuICAgIHN0ciA9IHN0ci5zbGljZSgyKTtcbiAgfVxuICBjb25zdCBtYXRjaGVzID0gc3RyLm1hdGNoKC8uezEsMn0vZykgfHwgW107XG4gIGNvbnN0IGRhdGEgPSBVaW50OEFycmF5LmZyb20oXG4gICAgbWF0Y2hlcy5tYXAoKGJ5dGUpID0+IHBhcnNlSW50KGJ5dGUsIDE2KSlcbiAgKTtcbiAgcmV0dXJuIGRhdGEucmV2ZXJzZSgpO1xufVxuZnVuY3Rpb24gaGV4U3RyaW5nVG9VMTI4KHN0cikge1xuICByZXR1cm4gdWludDhBcnJheVRvVTEyOChoZXhTdHJpbmdUb1VpbnQ4QXJyYXkoc3RyKSk7XG59XG5mdW5jdGlvbiBoZXhTdHJpbmdUb1UyNTYoc3RyKSB7XG4gIHJldHVybiB1aW50OEFycmF5VG9VMjU2KGhleFN0cmluZ1RvVWludDhBcnJheShzdHIpKTtcbn1cbmZ1bmN0aW9uIHUxMjhUb1VpbnQ4QXJyYXkoZGF0YSkge1xuICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDE2KTtcbiAgd3JpdGVyLndyaXRlVTEyOChkYXRhKTtcbiAgcmV0dXJuIHdyaXRlci5nZXRCdWZmZXIoKTtcbn1cbmZ1bmN0aW9uIHUxMjhUb0hleFN0cmluZyhkYXRhKSB7XG4gIHJldHVybiB1aW50OEFycmF5VG9IZXhTdHJpbmcodTEyOFRvVWludDhBcnJheShkYXRhKSk7XG59XG5mdW5jdGlvbiB1MjU2VG9VaW50OEFycmF5KGRhdGEpIHtcbiAgY29uc3Qgd3JpdGVyID0gbmV3IEJpbmFyeVdyaXRlcigzMik7XG4gIHdyaXRlci53cml0ZVUyNTYoZGF0YSk7XG4gIHJldHVybiB3cml0ZXIuZ2V0QnVmZmVyKCk7XG59XG5mdW5jdGlvbiB1MjU2VG9IZXhTdHJpbmcoZGF0YSkge1xuICByZXR1cm4gdWludDhBcnJheVRvSGV4U3RyaW5nKHUyNTZUb1VpbnQ4QXJyYXkoZGF0YSkpO1xufVxuZnVuY3Rpb24gY29lcmNlVG9CaWdJbnQodmFsdWUsIHdoYXQpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJiaWdpbnRcIikgcmV0dXJuIHZhbHVlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcIm51bWJlclwiKSByZXR1cm4gQmlnSW50KHZhbHVlKTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJzdHJpbmdcIiAmJiB2YWx1ZS50cmltKCkgIT09IFwiXCIpIHJldHVybiBCaWdJbnQodmFsdWUpO1xuICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgIGBDYW5ub3QgY29udmVydCAke3R5cGVvZiB2YWx1ZX0gdG8gJHt3aGF0fTogZXhwZWN0ZWQgYmlnaW50LCBpbnRlZ2VyIG51bWJlciwgb3IgZGVjaW1hbCBzdHJpbmdgXG4gICk7XG59XG5mdW5jdGlvbiB0b1Bhc2NhbENhc2Uocykge1xuICBjb25zdCBzdHIgPSB0b0NhbWVsQ2FzZShzKTtcbiAgcmV0dXJuIHN0ci5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0ci5zbGljZSgxKTtcbn1cbmZ1bmN0aW9uIHRvQ2FtZWxDYXNlKHMpIHtcbiAgY29uc3Qgc3RyID0gcy5yZXBsYWNlKC9bLV9dKy9nLCBcIl9cIikucmVwbGFjZSgvXyhbYS16QS1aMC05XSkvZywgKF8sIGMpID0+IGMudG9VcHBlckNhc2UoKSk7XG4gIHJldHVybiBzdHIuY2hhckF0KDApLnRvTG93ZXJDYXNlKCkgKyBzdHIuc2xpY2UoMSk7XG59XG5mdW5jdGlvbiBic2F0bkJhc2VTaXplKHR5cGVzcGFjZSwgdHkpIHtcbiAgY29uc3QgYXNzdW1lZEFycmF5TGVuZ3RoID0gNDtcbiAgd2hpbGUgKHR5LnRhZyA9PT0gXCJSZWZcIikgdHkgPSB0eXBlc3BhY2UudHlwZXNbdHkudmFsdWVdO1xuICBpZiAodHkudGFnID09PSBcIlByb2R1Y3RcIikge1xuICAgIGxldCBzdW0gPSAwO1xuICAgIGZvciAoY29uc3QgeyBhbGdlYnJhaWNUeXBlOiBlbGVtIH0gb2YgdHkudmFsdWUuZWxlbWVudHMpIHtcbiAgICAgIHN1bSArPSBic2F0bkJhc2VTaXplKHR5cGVzcGFjZSwgZWxlbSk7XG4gICAgfVxuICAgIHJldHVybiBzdW07XG4gIH0gZWxzZSBpZiAodHkudGFnID09PSBcIlN1bVwiKSB7XG4gICAgbGV0IG1pbiA9IEluZmluaXR5O1xuICAgIGZvciAoY29uc3QgeyBhbGdlYnJhaWNUeXBlOiB2YXJpIH0gb2YgdHkudmFsdWUudmFyaWFudHMpIHtcbiAgICAgIGNvbnN0IHZTaXplID0gYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHZhcmkpO1xuICAgICAgaWYgKHZTaXplIDwgbWluKSBtaW4gPSB2U2l6ZTtcbiAgICB9XG4gICAgaWYgKG1pbiA9PT0gSW5maW5pdHkpIG1pbiA9IDA7XG4gICAgcmV0dXJuIDQgKyBtaW47XG4gIH0gZWxzZSBpZiAodHkudGFnID09IFwiQXJyYXlcIikge1xuICAgIHJldHVybiA0ICsgYXNzdW1lZEFycmF5TGVuZ3RoICogYnNhdG5CYXNlU2l6ZSh0eXBlc3BhY2UsIHR5LnZhbHVlKTtcbiAgfVxuICByZXR1cm4ge1xuICAgIFN0cmluZzogNCArIGFzc3VtZWRBcnJheUxlbmd0aCxcbiAgICBTdW06IDEsXG4gICAgQm9vbDogMSxcbiAgICBJODogMSxcbiAgICBVODogMSxcbiAgICBJMTY6IDIsXG4gICAgVTE2OiAyLFxuICAgIEkzMjogNCxcbiAgICBVMzI6IDQsXG4gICAgRjMyOiA0LFxuICAgIEk2NDogOCxcbiAgICBVNjQ6IDgsXG4gICAgRjY0OiA4LFxuICAgIEkxMjg6IDE2LFxuICAgIFUxMjg6IDE2LFxuICAgIEkyNTY6IDMyLFxuICAgIFUyNTY6IDMyXG4gIH1bdHkudGFnXTtcbn1cbnZhciBoYXNPd24gPSBPYmplY3QuaGFzT3duO1xuXG4vLyBzcmMvbGliL3RpbWVfZHVyYXRpb24udHNcbnZhciBUaW1lRHVyYXRpb24gPSBjbGFzcyBfVGltZUR1cmF0aW9uIHtcbiAgX190aW1lX2R1cmF0aW9uX21pY3Jvc19fO1xuICBzdGF0aWMgTUlDUk9TX1BFUl9NSUxMSVMgPSAxMDAwbjtcbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBUaW1lRHVyYXRpb259IHR5cGUuXG4gICAqIEByZXR1cm5zIFRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgdHlwZS5cbiAgICovXG4gIHN0YXRpYyBnZXRBbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFwiX190aW1lX2R1cmF0aW9uX21pY3Jvc19fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5JNjRcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICB9XG4gIHN0YXRpYyBpc1RpbWVEdXJhdGlvbihhbGdlYnJhaWNUeXBlKSB7XG4gICAgaWYgKGFsZ2VicmFpY1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbGVtZW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHM7XG4gICAgaWYgKGVsZW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBtaWNyb3NFbGVtZW50ID0gZWxlbWVudHNbMF07XG4gICAgcmV0dXJuIG1pY3Jvc0VsZW1lbnQubmFtZSA9PT0gXCJfX3RpbWVfZHVyYXRpb25fbWljcm9zX19cIiAmJiBtaWNyb3NFbGVtZW50LmFsZ2VicmFpY1R5cGUudGFnID09PSBcIkk2NFwiO1xuICB9XG4gIGdldCBtaWNyb3MoKSB7XG4gICAgcmV0dXJuIHRoaXMuX190aW1lX2R1cmF0aW9uX21pY3Jvc19fO1xuICB9XG4gIGdldCBtaWxsaXMoKSB7XG4gICAgcmV0dXJuIE51bWJlcih0aGlzLm1pY3JvcyAvIF9UaW1lRHVyYXRpb24uTUlDUk9TX1BFUl9NSUxMSVMpO1xuICB9XG4gIGNvbnN0cnVjdG9yKG1pY3Jvcykge1xuICAgIHRoaXMuX190aW1lX2R1cmF0aW9uX21pY3Jvc19fID0gY29lcmNlVG9CaWdJbnQobWljcm9zLCBcIlRpbWVEdXJhdGlvblwiKTtcbiAgfVxuICBzdGF0aWMgZnJvbU1pbGxpcyhtaWxsaXMpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb24oQmlnSW50KG1pbGxpcykgKiBfVGltZUR1cmF0aW9uLk1JQ1JPU19QRVJfTUlMTElTKTtcbiAgfVxuICAvKiogVGhpcyBvdXRwdXRzIHRoZSBzYW1lIHN0cmluZyBmb3JtYXQgdGhhdCB3ZSB1c2UgaW4gdGhlIGhvc3QgYW5kIGluIFJ1c3QgbW9kdWxlcyAqL1xuICB0b1N0cmluZygpIHtcbiAgICBjb25zdCBtaWNyb3MgPSB0aGlzLm1pY3JvcztcbiAgICBjb25zdCBzaWduID0gbWljcm9zIDwgMCA/IFwiLVwiIDogXCIrXCI7XG4gICAgY29uc3QgcG9zID0gbWljcm9zIDwgMCA/IC1taWNyb3MgOiBtaWNyb3M7XG4gICAgY29uc3Qgc2VjcyA9IHBvcyAvIDEwMDAwMDBuO1xuICAgIGNvbnN0IG1pY3Jvc19yZW1haW5pbmcgPSBwb3MgJSAxMDAwMDAwbjtcbiAgICByZXR1cm4gYCR7c2lnbn0ke3NlY3N9LiR7U3RyaW5nKG1pY3Jvc19yZW1haW5pbmcpLnBhZFN0YXJ0KDYsIFwiMFwiKX1gO1xuICB9XG59O1xuXG4vLyBzcmMvbGliL3RpbWVzdGFtcC50c1xudmFyIFRpbWVzdGFtcCA9IGNsYXNzIF9UaW1lc3RhbXAge1xuICBfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fO1xuICBzdGF0aWMgTUlDUk9TX1BFUl9NSUxMSVMgPSAxMDAwbjtcbiAgZ2V0IG1pY3Jvc1NpbmNlVW5peEVwb2NoKCkge1xuICAgIHJldHVybiB0aGlzLl9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX187XG4gIH1cbiAgY29uc3RydWN0b3IobWljcm9zKSB7XG4gICAgdGhpcy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fID0gY29lcmNlVG9CaWdJbnQoXG4gICAgICBtaWNyb3MsXG4gICAgICBcIlRpbWVzdGFtcFwiXG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogR2V0IHRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUge0BsaW5rIFRpbWVzdGFtcH0gdHlwZS5cbiAgICogQHJldHVybnMgVGhlIGFsZ2VicmFpYyB0eXBlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgc3RhdGljIGdldEFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7XG4gICAgICBlbGVtZW50czogW1xuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5JNjRcbiAgICAgICAgfVxuICAgICAgXVxuICAgIH0pO1xuICB9XG4gIHN0YXRpYyBpc1RpbWVzdGFtcChhbGdlYnJhaWNUeXBlKSB7XG4gICAgaWYgKGFsZ2VicmFpY1R5cGUudGFnICE9PSBcIlByb2R1Y3RcIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBlbGVtZW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHM7XG4gICAgaWYgKGVsZW1lbnRzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBtaWNyb3NFbGVtZW50ID0gZWxlbWVudHNbMF07XG4gICAgcmV0dXJuIG1pY3Jvc0VsZW1lbnQubmFtZSA9PT0gXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCIgJiYgbWljcm9zRWxlbWVudC5hbGdlYnJhaWNUeXBlLnRhZyA9PT0gXCJJNjRcIjtcbiAgfVxuICAvKipcbiAgICogVGhlIFVuaXggZXBvY2gsIHRoZSBtaWRuaWdodCBhdCB0aGUgYmVnaW5uaW5nIG9mIEphbnVhcnkgMSwgMTk3MCwgVVRDLlxuICAgKi9cbiAgc3RhdGljIFVOSVhfRVBPQ0ggPSBuZXcgX1RpbWVzdGFtcCgwbik7XG4gIC8qKlxuICAgKiBHZXQgYSBgVGltZXN0YW1wYCByZXByZXNlbnRpbmcgdGhlIGV4ZWN1dGlvbiBlbnZpcm9ubWVudCdzIGJlbGllZiBvZiB0aGUgY3VycmVudCBtb21lbnQgaW4gdGltZS5cbiAgICovXG4gIHN0YXRpYyBub3coKSB7XG4gICAgcmV0dXJuIF9UaW1lc3RhbXAuZnJvbURhdGUoLyogQF9fUFVSRV9fICovIG5ldyBEYXRlKCkpO1xuICB9XG4gIC8qKiBDb252ZXJ0IHRvIG1pbGxpc2Vjb25kcyBzaW5jZSBVbml4IGVwb2NoLiAqL1xuICB0b01pbGxpcygpIHtcbiAgICByZXR1cm4gdGhpcy5taWNyb3NTaW5jZVVuaXhFcG9jaCAvIDEwMDBuO1xuICB9XG4gIC8qKlxuICAgKiBHZXQgYSBgVGltZXN0YW1wYCByZXByZXNlbnRpbmcgdGhlIHNhbWUgcG9pbnQgaW4gdGltZSBhcyBgZGF0ZWAuXG4gICAqL1xuICBzdGF0aWMgZnJvbURhdGUoZGF0ZSkge1xuICAgIGNvbnN0IG1pbGxpcyA9IGRhdGUuZ2V0VGltZSgpO1xuICAgIGNvbnN0IG1pY3JvcyA9IEJpZ0ludChtaWxsaXMpICogX1RpbWVzdGFtcC5NSUNST1NfUEVSX01JTExJUztcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXAobWljcm9zKTtcbiAgfVxuICAvKipcbiAgICogR2V0IGEgYERhdGVgIHJlcHJlc2VudGluZyBhcHByb3hpbWF0ZWx5IHRoZSBzYW1lIHBvaW50IGluIHRpbWUgYXMgYHRoaXNgLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCB0cnVuY2F0ZXMgdG8gbWlsbGlzZWNvbmQgcHJlY2lzaW9uLFxuICAgKiBhbmQgdGhyb3dzIGBSYW5nZUVycm9yYCBpZiB0aGUgYFRpbWVzdGFtcGAgaXMgb3V0c2lkZSB0aGUgcmFuZ2UgcmVwcmVzZW50YWJsZSBhcyBhIGBEYXRlYC5cbiAgICovXG4gIHRvRGF0ZSgpIHtcbiAgICBjb25zdCBtaWNyb3MgPSB0aGlzLl9fdGltZXN0YW1wX21pY3Jvc19zaW5jZV91bml4X2Vwb2NoX187XG4gICAgY29uc3QgbWlsbGlzID0gbWljcm9zIC8gX1RpbWVzdGFtcC5NSUNST1NfUEVSX01JTExJUztcbiAgICBpZiAobWlsbGlzID4gQmlnSW50KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB8fCBtaWxsaXMgPCBCaWdJbnQoTnVtYmVyLk1JTl9TQUZFX0lOVEVHRVIpKSB7XG4gICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcbiAgICAgICAgXCJUaW1lc3RhbXAgaXMgb3V0c2lkZSBvZiB0aGUgcmVwcmVzZW50YWJsZSByYW5nZSBvZiBKUydzIERhdGVcIlxuICAgICAgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEYXRlKE51bWJlcihtaWxsaXMpKTtcbiAgfVxuICAvKipcbiAgICogR2V0IGFuIElTTyA4NjAxIC8gUkZDIDMzMzkgZm9ybWF0dGVkIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGlzIHRpbWVzdGFtcCB3aXRoIG1pY3Jvc2Vjb25kIHByZWNpc2lvbi5cbiAgICpcbiAgICogVGhpcyBtZXRob2QgcHJlc2VydmVzIHRoZSBmdWxsIG1pY3Jvc2Vjb25kIHByZWNpc2lvbiBvZiB0aGUgdGltZXN0YW1wLFxuICAgKiBhbmQgdGhyb3dzIGBSYW5nZUVycm9yYCBpZiB0aGUgYFRpbWVzdGFtcGAgaXMgb3V0c2lkZSB0aGUgcmFuZ2UgcmVwcmVzZW50YWJsZSBpbiBJU08gZm9ybWF0LlxuICAgKlxuICAgKiBAcmV0dXJucyBJU08gODYwMSBmb3JtYXR0ZWQgc3RyaW5nIHdpdGggbWljcm9zZWNvbmQgcHJlY2lzaW9uIChlLmcuLCAnMjAyNS0wMi0xN1QxMDozMDo0NS4xMjM0NTZaJylcbiAgICovXG4gIHRvSVNPU3RyaW5nKCkge1xuICAgIGNvbnN0IG1pY3JvcyA9IHRoaXMuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXztcbiAgICBjb25zdCBtaWxsaXMgPSBtaWNyb3MgLyBfVGltZXN0YW1wLk1JQ1JPU19QRVJfTUlMTElTO1xuICAgIGlmIChtaWxsaXMgPiBCaWdJbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpIHx8IG1pbGxpcyA8IEJpZ0ludChOdW1iZXIuTUlOX1NBRkVfSU5URUdFUikpIHtcbiAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFxuICAgICAgICBcIlRpbWVzdGFtcCBpcyBvdXRzaWRlIG9mIHRoZSByZXByZXNlbnRhYmxlIHJhbmdlIGZvciBJU08gc3RyaW5nIGZvcm1hdHRpbmdcIlxuICAgICAgKTtcbiAgICB9XG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKE51bWJlcihtaWxsaXMpKTtcbiAgICBjb25zdCBpc29CYXNlID0gZGF0ZS50b0lTT1N0cmluZygpO1xuICAgIGNvbnN0IG1pY3Jvc1JlbWFpbmRlciA9IE1hdGguYWJzKE51bWJlcihtaWNyb3MgJSAxMDAwMDAwbikpO1xuICAgIGNvbnN0IGZyYWN0aW9uYWxQYXJ0ID0gU3RyaW5nKG1pY3Jvc1JlbWFpbmRlcikucGFkU3RhcnQoNiwgXCIwXCIpO1xuICAgIHJldHVybiBpc29CYXNlLnJlcGxhY2UoL1xcLlxcZHszfVokLywgYC4ke2ZyYWN0aW9uYWxQYXJ0fVpgKTtcbiAgfVxuICBzaW5jZShvdGhlcikge1xuICAgIHJldHVybiBuZXcgVGltZUR1cmF0aW9uKFxuICAgICAgdGhpcy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fIC0gb3RoZXIuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfX1xuICAgICk7XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvdXVpZC50c1xudmFyIFV1aWQgPSBjbGFzcyBfVXVpZCB7XG4gIF9fdXVpZF9fO1xuICAvKipcbiAgICogVGhlIG5pbCBVVUlEIChhbGwgemVyb3MpLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBgYGB0c1xuICAgKiBjb25zdCB1dWlkID0gVXVpZC5OSUw7XG4gICAqIGNvbnNvbGUuYXNzZXJ0KFxuICAgKiAgIHV1aWQudG9TdHJpbmcoKSA9PT0gXCIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDBcIlxuICAgKiApO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBOSUwgPSBuZXcgX1V1aWQoMG4pO1xuICBzdGF0aWMgTUFYX1VVSURfQklHSU5UID0gMHhmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZm47XG4gIC8qKlxuICAgKiBUaGUgbWF4IFVVSUQgKGFsbCBvbmVzKS5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgdXVpZCA9IFV1aWQuTUFYO1xuICAgKiBjb25zb2xlLmFzc2VydChcbiAgICogICB1dWlkLnRvU3RyaW5nKCkgPT09IFwiZmZmZmZmZmYtZmZmZi1mZmZmLWZmZmYtZmZmZmZmZmZmZmZmXCJcbiAgICogKTtcbiAgICogYGBgXG4gICAqL1xuICBzdGF0aWMgTUFYID0gbmV3IF9VdWlkKF9VdWlkLk1BWF9VVUlEX0JJR0lOVCk7XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBVVUlEIGZyb20gYSByYXcgMTI4LWJpdCB2YWx1ZS5cbiAgICpcbiAgICogQHBhcmFtIHUgLSBVbnNpZ25lZCAxMjgtYml0IGludGVnZXJcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZSB2YWx1ZSBpcyBvdXRzaWRlIHRoZSB2YWxpZCBVVUlEIHJhbmdlXG4gICAqL1xuICBjb25zdHJ1Y3Rvcih1KSB7XG4gICAgY29uc3QgdiA9IGNvZXJjZVRvQmlnSW50KHUsIFwiVXVpZFwiKTtcbiAgICBpZiAodiA8IDBuIHx8IHYgPiBfVXVpZC5NQVhfVVVJRF9CSUdJTlQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgVVVJRDogbXVzdCBiZSBiZXR3ZWVuIDAgYW5kIGBNQVhfVVVJRF9CSUdJTlRgXCIpO1xuICAgIH1cbiAgICB0aGlzLl9fdXVpZF9fID0gdjtcbiAgfVxuICAvKipcbiAgICogQ3JlYXRlIGEgVVVJRCBgdjRgIGZyb20gZXhwbGljaXQgcmFuZG9tIGJ5dGVzLlxuICAgKlxuICAgKiBUaGlzIG1ldGhvZCBhc3N1bWVzIHRoZSBieXRlcyBhcmUgYWxyZWFkeSBzdWZmaWNpZW50bHkgcmFuZG9tLlxuICAgKiBJdCBvbmx5IHNldHMgdGhlIGFwcHJvcHJpYXRlIGJpdHMgZm9yIHRoZSBVVUlEIHZlcnNpb24gYW5kIHZhcmlhbnQuXG4gICAqXG4gICAqIEBwYXJhbSBieXRlcyAtIEV4YWN0bHkgMTYgcmFuZG9tIGJ5dGVzXG4gICAqIEByZXR1cm5zIEEgVVVJRCBgdjRgXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBJZiBgYnl0ZXMubGVuZ3RoICE9PSAxNmBcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgcmFuZG9tQnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAqIGNvbnN0IHV1aWQgPSBVdWlkLmZyb21SYW5kb21CeXRlc1Y0KHJhbmRvbUJ5dGVzKTtcbiAgICpcbiAgICogY29uc29sZS5hc3NlcnQoXG4gICAqICAgdXVpZC50b1N0cmluZygpID09PSBcIjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMFwiXG4gICAqICk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGZyb21SYW5kb21CeXRlc1Y0KGJ5dGVzKSB7XG4gICAgaWYgKGJ5dGVzLmxlbmd0aCAhPT0gMTYpIHRocm93IG5ldyBFcnJvcihcIlVVSUQgdjQgcmVxdWlyZXMgMTYgYnl0ZXNcIik7XG4gICAgY29uc3QgYXJyID0gbmV3IFVpbnQ4QXJyYXkoYnl0ZXMpO1xuICAgIGFycls2XSA9IGFycls2XSAmIDE1IHwgNjQ7XG4gICAgYXJyWzhdID0gYXJyWzhdICYgNjMgfCAxMjg7XG4gICAgcmV0dXJuIG5ldyBfVXVpZChfVXVpZC5ieXRlc1RvQmlnSW50KGFycikpO1xuICB9XG4gIC8qKlxuICAgKiBHZW5lcmF0ZSBhIFVVSUQgYHY3YCB1c2luZyBhIG1vbm90b25pYyBjb3VudGVyIGZyb20gYDBgIHRvIGAyXjMxIC0gMWAsXG4gICAqIGEgdGltZXN0YW1wLCBhbmQgNCByYW5kb20gYnl0ZXMuXG4gICAqXG4gICAqIFRoZSBjb3VudGVyIHdyYXBzIGFyb3VuZCBvbiBvdmVyZmxvdy5cbiAgICpcbiAgICogVGhlIFVVSUQgYHY3YCBpcyBzdHJ1Y3R1cmVkIGFzIGZvbGxvd3M6XG4gICAqXG4gICAqIGBgYGFzY2lpXG4gICAqIOKUjOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUrOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUkFxuICAgKiB8IEIwICB8IEIxICB8IEIyICB8IEIzICB8IEI0ICB8IEI1ICAgICAgICAgICAgICB8ICAgICAgICAgQjYgICAgICAgIHxcbiAgICog4pSc4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pS84pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSkXG4gICAqIHwgICAgICAgICAgICAgICAgIHVuaXhfdHNfbXMgICAgICAgICAgICAgICAgICAgIHwgICAgICB2ZXJzaW9uIDcgICAgfFxuICAgKiDilJTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLTilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilJhcbiAgICog4pSM4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSs4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSA4pSQXG4gICAqIHwgQjcgICAgICAgICAgIHwgQjggICAgICB8IEI5ICB8IEIxMCB8IEIxMSAgfCBCMTIgfCBCMTMgfCBCMTQgfCBCMTUgfFxuICAgKiDilJzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilLzilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilIDilKRcbiAgICogfCBjb3VudGVyX2hpZ2ggfCB2YXJpYW50IHwgICAgY291bnRlcl9sb3cgICB8ICAgICAgICByYW5kb20gICAgICAgICB8XG4gICAqIOKUlOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUtOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUgOKUmFxuICAgKiBgYGBcbiAgICpcbiAgICogQHBhcmFtIGNvdW50ZXIgLSBNdXRhYmxlIG1vbm90b25pYyBjb3VudGVyICgzMS1iaXQpXG4gICAqIEBwYXJhbSBub3cgLSBUaW1lc3RhbXAgc2luY2UgdGhlIFVuaXggZXBvY2hcbiAgICogQHBhcmFtIHJhbmRvbUJ5dGVzIC0gRXhhY3RseSA0IHJhbmRvbSBieXRlc1xuICAgKiBAcmV0dXJucyBBIFVVSUQgYHY3YFxuICAgKlxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIGBjb3VudGVyYCBpcyBuZWdhdGl2ZVxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgdGhlIGB0aW1lc3RhbXBgIGlzIGJlZm9yZSB0aGUgVW5peCBlcG9jaFxuICAgKiBAdGhyb3dzIHtFcnJvcn0gSWYgYHJhbmRvbUJ5dGVzLmxlbmd0aCAhPT0gNGBcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3Qgbm93ID0gVGltZXN0YW1wLmZyb21NaWxsaXMoMV82ODZfMDAwXzAwMF8wMDBuKTtcbiAgICogY29uc3QgY291bnRlciA9IHsgdmFsdWU6IDEgfTtcbiAgICogY29uc3QgcmFuZG9tQnl0ZXMgPSBuZXcgVWludDhBcnJheSg0KTtcbiAgICpcbiAgICogY29uc3QgdXVpZCA9IFV1aWQuZnJvbUNvdW50ZXJWNyhjb3VudGVyLCBub3csIHJhbmRvbUJ5dGVzKTtcbiAgICpcbiAgICogY29uc29sZS5hc3NlcnQoXG4gICAqICAgdXVpZC50b1N0cmluZygpID09PSBcIjAwMDA2NDdlLTUxODAtNzAwMC04MDAwLTAwMDIwMDAwMDAwMFwiXG4gICAqICk7XG4gICAqIGBgYFxuICAgKi9cbiAgc3RhdGljIGZyb21Db3VudGVyVjcoY291bnRlciwgbm93LCByYW5kb21CeXRlcykge1xuICAgIGlmIChyYW5kb21CeXRlcy5sZW5ndGggIT09IDQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImBmcm9tQ291bnRlclY3YCByZXF1aXJlcyBgcmFuZG9tQnl0ZXMubGVuZ3RoID09IDRgXCIpO1xuICAgIH1cbiAgICBpZiAoY291bnRlci52YWx1ZSA8IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcImBmcm9tQ291bnRlclY3YCB1dWlkIGBjb3VudGVyYCBtdXN0IGJlIG5vbi1uZWdhdGl2ZVwiKTtcbiAgICB9XG4gICAgaWYgKG5vdy5fX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fIDwgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiYGZyb21Db3VudGVyVjdgIGB0aW1lc3RhbXBgIGJlZm9yZSB1bml4IGVwb2NoXCIpO1xuICAgIH1cbiAgICBjb25zdCBjb3VudGVyVmFsID0gY291bnRlci52YWx1ZTtcbiAgICBjb3VudGVyLnZhbHVlID0gY291bnRlclZhbCArIDEgJiAyMTQ3NDgzNjQ3O1xuICAgIGNvbnN0IHRzTXMgPSBub3cudG9NaWxsaXMoKSAmIDB4ZmZmZmZmZmZmZmZmbjtcbiAgICBjb25zdCBieXRlcyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICBieXRlc1swXSA9IE51bWJlcih0c01zID4+IDQwbiAmIDB4ZmZuKTtcbiAgICBieXRlc1sxXSA9IE51bWJlcih0c01zID4+IDMybiAmIDB4ZmZuKTtcbiAgICBieXRlc1syXSA9IE51bWJlcih0c01zID4+IDI0biAmIDB4ZmZuKTtcbiAgICBieXRlc1szXSA9IE51bWJlcih0c01zID4+IDE2biAmIDB4ZmZuKTtcbiAgICBieXRlc1s0XSA9IE51bWJlcih0c01zID4+IDhuICYgMHhmZm4pO1xuICAgIGJ5dGVzWzVdID0gTnVtYmVyKHRzTXMgJiAweGZmbik7XG4gICAgYnl0ZXNbN10gPSBjb3VudGVyVmFsID4+PiAyMyAmIDI1NTtcbiAgICBieXRlc1s5XSA9IGNvdW50ZXJWYWwgPj4+IDE1ICYgMjU1O1xuICAgIGJ5dGVzWzEwXSA9IGNvdW50ZXJWYWwgPj4+IDcgJiAyNTU7XG4gICAgYnl0ZXNbMTFdID0gKGNvdW50ZXJWYWwgJiAxMjcpIDw8IDEgJiAyNTU7XG4gICAgYnl0ZXNbMTJdIHw9IHJhbmRvbUJ5dGVzWzBdICYgMTI3O1xuICAgIGJ5dGVzWzEzXSA9IHJhbmRvbUJ5dGVzWzFdO1xuICAgIGJ5dGVzWzE0XSA9IHJhbmRvbUJ5dGVzWzJdO1xuICAgIGJ5dGVzWzE1XSA9IHJhbmRvbUJ5dGVzWzNdO1xuICAgIGJ5dGVzWzZdID0gYnl0ZXNbNl0gJiAxNSB8IDExMjtcbiAgICBieXRlc1s4XSA9IGJ5dGVzWzhdICYgNjMgfCAxMjg7XG4gICAgcmV0dXJuIG5ldyBfVXVpZChfVXVpZC5ieXRlc1RvQmlnSW50KGJ5dGVzKSk7XG4gIH1cbiAgLyoqXG4gICAqIFBhcnNlIGEgVVVJRCBmcm9tIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0gcyAtIFVVSUQgc3RyaW5nXG4gICAqIEByZXR1cm5zIFBhcnNlZCBVVUlEXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBJZiB0aGUgc3RyaW5nIGlzIG5vdCBhIHZhbGlkIFVVSURcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYGBgdHNcbiAgICogY29uc3QgcyA9IFwiMDE4ODhkNmUtNWMwMC03MDAwLTgwMDAtMDAwMDAwMDAwMDAwXCI7XG4gICAqIGNvbnN0IHV1aWQgPSBVdWlkLnBhcnNlKHMpO1xuICAgKlxuICAgKiBjb25zb2xlLmFzc2VydCh1dWlkLnRvU3RyaW5nKCkgPT09IHMpO1xuICAgKiBgYGBcbiAgICovXG4gIHN0YXRpYyBwYXJzZShzKSB7XG4gICAgY29uc3QgaGV4ID0gcy5yZXBsYWNlKC8tL2csIFwiXCIpO1xuICAgIGlmIChoZXgubGVuZ3RoICE9PSAzMikgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBoZXggVVVJRFwiKTtcbiAgICBsZXQgdiA9IDBuO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMzI7IGkgKz0gMikge1xuICAgICAgdiA9IHYgPDwgOG4gfCBCaWdJbnQocGFyc2VJbnQoaGV4LnNsaWNlKGksIGkgKyAyKSwgMTYpKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBfVXVpZCh2KTtcbiAgfVxuICAvKiogQ29udmVydCB0byBoZXggc3RyaW5nIHdpdGhvdXQgYSAweCBwcmVmaXguICovXG4gIHRvSGV4U3RyaW5nKCkge1xuICAgIHJldHVybiB1MTI4VG9IZXhTdHJpbmcodGhpcy5hc0JpZ0ludCgpKTtcbiAgfVxuICAvKiogQ29udmVydCB0byBzdHJpbmcgKGh5cGhlbmF0ZWQgZm9ybSkuICovXG4gIHRvU3RyaW5nKCkge1xuICAgIGNvbnN0IGhleCA9IHRoaXMudG9IZXhTdHJpbmcoKTtcbiAgICByZXR1cm4gaGV4LnNsaWNlKDAsIDgpICsgXCItXCIgKyBoZXguc2xpY2UoOCwgMTIpICsgXCItXCIgKyBoZXguc2xpY2UoMTIsIDE2KSArIFwiLVwiICsgaGV4LnNsaWNlKDE2LCAyMCkgKyBcIi1cIiArIGhleC5zbGljZSgyMCk7XG4gIH1cbiAgLyoqIENvbnZlcnQgdG8gYmlnaW50ICh1MTI4KS4gKi9cbiAgYXNCaWdJbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX191dWlkX187XG4gIH1cbiAgLyoqIFJldHVybiBhIGBVaW50OEFycmF5YCBvZiAxNiBieXRlcy4gKi9cbiAgdG9CeXRlcygpIHtcbiAgICByZXR1cm4gX1V1aWQuYmlnSW50VG9CeXRlcyh0aGlzLl9fdXVpZF9fKTtcbiAgfVxuICBzdGF0aWMgYnl0ZXNUb0JpZ0ludChieXRlcykge1xuICAgIGxldCByZXN1bHQgPSAwbjtcbiAgICBmb3IgKGNvbnN0IGIgb2YgYnl0ZXMpIHJlc3VsdCA9IHJlc3VsdCA8PCA4biB8IEJpZ0ludChiKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG4gIHN0YXRpYyBiaWdJbnRUb0J5dGVzKHZhbHVlKSB7XG4gICAgY29uc3QgYnl0ZXMgPSBuZXcgVWludDhBcnJheSgxNik7XG4gICAgZm9yIChsZXQgaSA9IDE1OyBpID49IDA7IGktLSkge1xuICAgICAgYnl0ZXNbaV0gPSBOdW1iZXIodmFsdWUgJiAweGZmbik7XG4gICAgICB2YWx1ZSA+Pj0gOG47XG4gICAgfVxuICAgIHJldHVybiBieXRlcztcbiAgfVxuICAvKipcbiAgICogUmV0dXJucyB0aGUgdmVyc2lvbiBvZiB0aGlzIFVVSUQuXG4gICAqXG4gICAqIFRoaXMgcmVwcmVzZW50cyB0aGUgYWxnb3JpdGhtIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHZhbHVlLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGBVdWlkVmVyc2lvbmBcbiAgICogQHRocm93cyB7RXJyb3J9IElmIHRoZSB2ZXJzaW9uIGZpZWxkIGlzIG5vdCByZWNvZ25pemVkXG4gICAqL1xuICBnZXRWZXJzaW9uKCkge1xuICAgIGNvbnN0IHZlcnNpb24gPSB0aGlzLnRvQnl0ZXMoKVs2XSA+PiA0ICYgMTU7XG4gICAgc3dpdGNoICh2ZXJzaW9uKSB7XG4gICAgICBjYXNlIDQ6XG4gICAgICAgIHJldHVybiBcIlY0XCI7XG4gICAgICBjYXNlIDc6XG4gICAgICAgIHJldHVybiBcIlY3XCI7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAodGhpcyA9PSBfVXVpZC5OSUwpIHtcbiAgICAgICAgICByZXR1cm4gXCJOaWxcIjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcyA9PSBfVXVpZC5NQVgpIHtcbiAgICAgICAgICByZXR1cm4gXCJNYXhcIjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIFVVSUQgdmVyc2lvbjogJHt2ZXJzaW9ufWApO1xuICAgIH1cbiAgfVxuICAvKipcbiAgICogRXh0cmFjdCB0aGUgbW9ub3RvbmljIGNvdW50ZXIgZnJvbSBhIFVVSUR2Ny5cbiAgICpcbiAgICogSW50ZW5kZWQgZm9yIHRlc3RpbmcgYW5kIGRpYWdub3N0aWNzLlxuICAgKiBCZWhhdmlvciBpcyB1bmRlZmluZWQgaWYgY2FsbGVkIG9uIGEgbm9uLVY3IFVVSUQuXG4gICAqXG4gICAqIEByZXR1cm5zIDMxLWJpdCBjb3VudGVyIHZhbHVlXG4gICAqL1xuICBnZXRDb3VudGVyKCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy50b0J5dGVzKCk7XG4gICAgY29uc3QgaGlnaCA9IGJ5dGVzWzddO1xuICAgIGNvbnN0IG1pZDEgPSBieXRlc1s5XTtcbiAgICBjb25zdCBtaWQyID0gYnl0ZXNbMTBdO1xuICAgIGNvbnN0IGxvdyA9IGJ5dGVzWzExXSA+Pj4gMTtcbiAgICByZXR1cm4gaGlnaCA8PCAyMyB8IG1pZDEgPDwgMTUgfCBtaWQyIDw8IDcgfCBsb3cgfCAwO1xuICB9XG4gIGNvbXBhcmVUbyhvdGhlcikge1xuICAgIGlmICh0aGlzLl9fdXVpZF9fIDwgb3RoZXIuX191dWlkX18pIHJldHVybiAtMTtcbiAgICBpZiAodGhpcy5fX3V1aWRfXyA+IG90aGVyLl9fdXVpZF9fKSByZXR1cm4gMTtcbiAgICByZXR1cm4gMDtcbiAgfVxuICBzdGF0aWMgZ2V0QWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHtcbiAgICAgIGVsZW1lbnRzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIl9fdXVpZF9fXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5VMTI4XG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9jb25uZWN0aW9uX2lkLnRzXG52YXIgQ29ubmVjdGlvbklkID0gY2xhc3MgX0Nvbm5lY3Rpb25JZCB7XG4gIF9fY29ubmVjdGlvbl9pZF9fO1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgQ29ubmVjdGlvbklkYC5cbiAgICovXG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLl9fY29ubmVjdGlvbl9pZF9fID0gY29lcmNlVG9CaWdJbnQoZGF0YSwgXCJDb25uZWN0aW9uSWRcIik7XG4gIH1cbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBDb25uZWN0aW9uSWR9IHR5cGUuXG4gICAqIEByZXR1cm5zIFRoZSBhbGdlYnJhaWMgdHlwZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgdHlwZS5cbiAgICovXG4gIHN0YXRpYyBnZXRBbGdlYnJhaWNUeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgZWxlbWVudHM6IFtcbiAgICAgICAgeyBuYW1lOiBcIl9fY29ubmVjdGlvbl9pZF9fXCIsIGFsZ2VicmFpY1R5cGU6IEFsZ2VicmFpY1R5cGUuVTEyOCB9XG4gICAgICBdXG4gICAgfSk7XG4gIH1cbiAgaXNaZXJvKCkge1xuICAgIHJldHVybiB0aGlzLl9fY29ubmVjdGlvbl9pZF9fID09PSBCaWdJbnQoMCk7XG4gIH1cbiAgc3RhdGljIG51bGxJZlplcm8oYWRkcikge1xuICAgIGlmIChhZGRyLmlzWmVybygpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGFkZHI7XG4gICAgfVxuICB9XG4gIHN0YXRpYyByYW5kb20oKSB7XG4gICAgZnVuY3Rpb24gcmFuZG9tVTgoKSB7XG4gICAgICByZXR1cm4gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMjU1KTtcbiAgICB9XG4gICAgbGV0IHJlc3VsdCA9IEJpZ0ludCgwKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE2OyBpKyspIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdCA8PCBCaWdJbnQoOCkgfCBCaWdJbnQocmFuZG9tVTgoKSk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZChyZXN1bHQpO1xuICB9XG4gIC8qKlxuICAgKiBDb21wYXJlIHR3byBjb25uZWN0aW9uIElEcyBmb3IgZXF1YWxpdHkuXG4gICAqL1xuICBpc0VxdWFsKG90aGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuX19jb25uZWN0aW9uX2lkX18gPT0gb3RoZXIuX19jb25uZWN0aW9uX2lkX187XG4gIH1cbiAgLyoqXG4gICAqIENoZWNrIGlmIHR3byBjb25uZWN0aW9uIElEcyBhcmUgZXF1YWwuXG4gICAqL1xuICBlcXVhbHMob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pc0VxdWFsKG90aGVyKTtcbiAgfVxuICAvKipcbiAgICogUHJpbnQgdGhlIGNvbm5lY3Rpb24gSUQgYXMgYSBoZXhhZGVjaW1hbCBzdHJpbmcuXG4gICAqL1xuICB0b0hleFN0cmluZygpIHtcbiAgICByZXR1cm4gdTEyOFRvSGV4U3RyaW5nKHRoaXMuX19jb25uZWN0aW9uX2lkX18pO1xuICB9XG4gIC8qKlxuICAgKiBDb252ZXJ0IHRoZSBjb25uZWN0aW9uIElEIHRvIGEgVWludDhBcnJheS5cbiAgICovXG4gIHRvVWludDhBcnJheSgpIHtcbiAgICByZXR1cm4gdTEyOFRvVWludDhBcnJheSh0aGlzLl9fY29ubmVjdGlvbl9pZF9fKTtcbiAgfVxuICAvKipcbiAgICogUGFyc2UgYSBjb25uZWN0aW9uIElEIGZyb20gYSBoZXhhZGVjaW1hbCBzdHJpbmcuXG4gICAqL1xuICBzdGF0aWMgZnJvbVN0cmluZyhzdHIpIHtcbiAgICByZXR1cm4gbmV3IF9Db25uZWN0aW9uSWQoaGV4U3RyaW5nVG9VMTI4KHN0cikpO1xuICB9XG4gIHN0YXRpYyBmcm9tU3RyaW5nT3JOdWxsKHN0cikge1xuICAgIGNvbnN0IGFkZHIgPSBfQ29ubmVjdGlvbklkLmZyb21TdHJpbmcoc3RyKTtcbiAgICBpZiAoYWRkci5pc1plcm8oKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBhZGRyO1xuICAgIH1cbiAgfVxufTtcblxuLy8gc3JjL2xpYi9pZGVudGl0eS50c1xudmFyIElkZW50aXR5ID0gY2xhc3MgX0lkZW50aXR5IHtcbiAgX19pZGVudGl0eV9fO1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSWRlbnRpdHlgLlxuICAgKlxuICAgKiBgZGF0YWAgY2FuIGJlIGEgaGV4YWRlY2ltYWwgc3RyaW5nIG9yIGEgYGJpZ2ludGAuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5fX2lkZW50aXR5X18gPSB0eXBlb2YgZGF0YSA9PT0gXCJzdHJpbmdcIiA/IGhleFN0cmluZ1RvVTI1NihkYXRhKSA6IGNvZXJjZVRvQmlnSW50KGRhdGEsIFwiSWRlbnRpdHlcIik7XG4gIH1cbiAgLyoqXG4gICAqIEdldCB0aGUgYWxnZWJyYWljIHR5cGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIHtAbGluayBJZGVudGl0eX0gdHlwZS5cbiAgICogQHJldHVybnMgVGhlIGFsZ2VicmFpYyB0eXBlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0eXBlLlxuICAgKi9cbiAgc3RhdGljIGdldEFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuUHJvZHVjdCh7XG4gICAgICBlbGVtZW50czogW3sgbmFtZTogXCJfX2lkZW50aXR5X19cIiwgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5VMjU2IH1dXG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIENoZWNrIGlmIHR3byBpZGVudGl0aWVzIGFyZSBlcXVhbC5cbiAgICovXG4gIGlzRXF1YWwob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy50b0hleFN0cmluZygpID09PSBvdGhlci50b0hleFN0cmluZygpO1xuICB9XG4gIC8qKlxuICAgKiBDaGVjayBpZiB0d28gaWRlbnRpdGllcyBhcmUgZXF1YWwuXG4gICAqL1xuICBlcXVhbHMob3RoZXIpIHtcbiAgICByZXR1cm4gdGhpcy5pc0VxdWFsKG90aGVyKTtcbiAgfVxuICAvKipcbiAgICogUHJpbnQgdGhlIGlkZW50aXR5IGFzIGEgaGV4YWRlY2ltYWwgc3RyaW5nLlxuICAgKi9cbiAgdG9IZXhTdHJpbmcoKSB7XG4gICAgcmV0dXJuIHUyNTZUb0hleFN0cmluZyh0aGlzLl9faWRlbnRpdHlfXyk7XG4gIH1cbiAgLyoqXG4gICAqIENvbnZlcnQgdGhlIGFkZHJlc3MgdG8gYSBVaW50OEFycmF5LlxuICAgKi9cbiAgdG9VaW50OEFycmF5KCkge1xuICAgIHJldHVybiB1MjU2VG9VaW50OEFycmF5KHRoaXMuX19pZGVudGl0eV9fKTtcbiAgfVxuICAvKipcbiAgICogUGFyc2UgYW4gSWRlbnRpdHkgZnJvbSBhIGhleGFkZWNpbWFsIHN0cmluZy5cbiAgICovXG4gIHN0YXRpYyBmcm9tU3RyaW5nKHN0cikge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5KHN0cik7XG4gIH1cbiAgLyoqXG4gICAqIFplcm8gaWRlbnRpdHkgKDB4MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMClcbiAgICovXG4gIHN0YXRpYyB6ZXJvKCkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5KDBuKTtcbiAgfVxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy50b0hleFN0cmluZygpO1xuICB9XG59O1xuXG4vLyBzcmMvbGliL2FsZ2VicmFpY190eXBlLnRzXG52YXIgU0VSSUFMSVpFUlMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIERFU0VSSUFMSVpFUlMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIEFsZ2VicmFpY1R5cGUgPSB7XG4gIFJlZjogKHZhbHVlKSA9PiAoeyB0YWc6IFwiUmVmXCIsIHZhbHVlIH0pLFxuICBTdW06ICh2YWx1ZSkgPT4gKHtcbiAgICB0YWc6IFwiU3VtXCIsXG4gICAgdmFsdWVcbiAgfSksXG4gIFByb2R1Y3Q6ICh2YWx1ZSkgPT4gKHtcbiAgICB0YWc6IFwiUHJvZHVjdFwiLFxuICAgIHZhbHVlXG4gIH0pLFxuICBBcnJheTogKHZhbHVlKSA9PiAoe1xuICAgIHRhZzogXCJBcnJheVwiLFxuICAgIHZhbHVlXG4gIH0pLFxuICBTdHJpbmc6IHsgdGFnOiBcIlN0cmluZ1wiIH0sXG4gIEJvb2w6IHsgdGFnOiBcIkJvb2xcIiB9LFxuICBJODogeyB0YWc6IFwiSThcIiB9LFxuICBVODogeyB0YWc6IFwiVThcIiB9LFxuICBJMTY6IHsgdGFnOiBcIkkxNlwiIH0sXG4gIFUxNjogeyB0YWc6IFwiVTE2XCIgfSxcbiAgSTMyOiB7IHRhZzogXCJJMzJcIiB9LFxuICBVMzI6IHsgdGFnOiBcIlUzMlwiIH0sXG4gIEk2NDogeyB0YWc6IFwiSTY0XCIgfSxcbiAgVTY0OiB7IHRhZzogXCJVNjRcIiB9LFxuICBJMTI4OiB7IHRhZzogXCJJMTI4XCIgfSxcbiAgVTEyODogeyB0YWc6IFwiVTEyOFwiIH0sXG4gIEkyNTY6IHsgdGFnOiBcIkkyNTZcIiB9LFxuICBVMjU2OiB7IHRhZzogXCJVMjU2XCIgfSxcbiAgRjMyOiB7IHRhZzogXCJGMzJcIiB9LFxuICBGNjQ6IHsgdGFnOiBcIkY2NFwiIH0sXG4gIG1ha2VTZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpIHtcbiAgICBpZiAodHkudGFnID09PSBcIlJlZlwiKSB7XG4gICAgICBpZiAoIXR5cGVzcGFjZSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2Fubm90IHNlcmlhbGl6ZSByZWZzIHdpdGhvdXQgYSB0eXBlc3BhY2VcIik7XG4gICAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB0eSA9IHR5cGVzcGFjZS50eXBlc1t0eS52YWx1ZV07XG4gICAgfVxuICAgIHN3aXRjaCAodHkudGFnKSB7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUubWFrZVNlcmlhbGl6ZXIodHkudmFsdWUsIHR5cGVzcGFjZSk7XG4gICAgICBjYXNlIFwiU3VtXCI6XG4gICAgICAgIHJldHVybiBTdW1UeXBlLm1ha2VTZXJpYWxpemVyKHR5LnZhbHVlLCB0eXBlc3BhY2UpO1xuICAgICAgY2FzZSBcIkFycmF5XCI6XG4gICAgICAgIGlmICh0eS52YWx1ZS50YWcgPT09IFwiVThcIikge1xuICAgICAgICAgIHJldHVybiBzZXJpYWxpemVVaW50OEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHNlcmlhbGl6ZSA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIodHkudmFsdWUsIHR5cGVzcGFjZSk7XG4gICAgICAgICAgcmV0dXJuICh3cml0ZXIsIHZhbHVlKSA9PiB7XG4gICAgICAgICAgICB3cml0ZXIud3JpdGVVMzIodmFsdWUubGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgZWxlbSBvZiB2YWx1ZSkge1xuICAgICAgICAgICAgICBzZXJpYWxpemUod3JpdGVyLCBlbGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gcHJpbWl0aXZlU2VyaWFsaXplcnNbdHkudGFnXTtcbiAgICB9XG4gIH0sXG4gIC8qKiBAZGVwcmVjYXRlZCBVc2UgYG1ha2VTZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBzZXJpYWxpemVWYWx1ZSh3cml0ZXIsIHR5LCB2YWx1ZSwgdHlwZXNwYWNlKSB7XG4gICAgQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSh3cml0ZXIsIHZhbHVlKTtcbiAgfSxcbiAgbWFrZURlc2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSB7XG4gICAgaWYgKHR5LnRhZyA9PT0gXCJSZWZcIikge1xuICAgICAgaWYgKCF0eXBlc3BhY2UpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBkZXNlcmlhbGl6ZSByZWZzIHdpdGhvdXQgYSB0eXBlc3BhY2VcIik7XG4gICAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB0eSA9IHR5cGVzcGFjZS50eXBlc1t0eS52YWx1ZV07XG4gICAgfVxuICAgIHN3aXRjaCAodHkudGFnKSB7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUubWFrZURlc2VyaWFsaXplcih0eS52YWx1ZSwgdHlwZXNwYWNlKTtcbiAgICAgIGNhc2UgXCJTdW1cIjpcbiAgICAgICAgcmV0dXJuIFN1bVR5cGUubWFrZURlc2VyaWFsaXplcih0eS52YWx1ZSwgdHlwZXNwYWNlKTtcbiAgICAgIGNhc2UgXCJBcnJheVwiOlxuICAgICAgICBpZiAodHkudmFsdWUudGFnID09PSBcIlU4XCIpIHtcbiAgICAgICAgICByZXR1cm4gZGVzZXJpYWxpemVVaW50OEFycmF5O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGRlc2VyaWFsaXplID0gQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKFxuICAgICAgICAgICAgdHkudmFsdWUsXG4gICAgICAgICAgICB0eXBlc3BhY2VcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiAocmVhZGVyKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBsZW5ndGggPSByZWFkZXIucmVhZFUzMigpO1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gQXJyYXkobGVuZ3RoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgcmVzdWx0W2ldID0gZGVzZXJpYWxpemUocmVhZGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHByaW1pdGl2ZURlc2VyaWFsaXplcnNbdHkudGFnXTtcbiAgICB9XG4gIH0sXG4gIC8qKiBAZGVwcmVjYXRlZCBVc2UgYG1ha2VEZXNlcmlhbGl6ZXJgIGluc3RlYWQuICovXG4gIGRlc2VyaWFsaXplVmFsdWUocmVhZGVyLCB0eSwgdHlwZXNwYWNlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKShyZWFkZXIpO1xuICB9LFxuICAvKipcbiAgICogQ29udmVydCBhIHZhbHVlIG9mIHRoZSBhbGdlYnJhaWMgdHlwZSBpbnRvIHNvbWV0aGluZyB0aGF0IGNhbiBiZSB1c2VkIGFzIGEga2V5IGluIGEgbWFwLlxuICAgKiBUaGVyZSBhcmUgbm8gZ3VhcmFudGVlcyBhYm91dCBiZWluZyBhYmxlIHRvIG9yZGVyIGl0LlxuICAgKiBUaGlzIGlzIG9ubHkgZ3VhcmFudGVlZCB0byBiZSBjb21wYXJhYmxlIHRvIG90aGVyIHZhbHVlcyBvZiB0aGUgc2FtZSB0eXBlLlxuICAgKiBAcGFyYW0gdmFsdWUgQSB2YWx1ZSBvZiB0aGUgYWxnZWJyYWljIHR5cGVcbiAgICogQHJldHVybnMgU29tZXRoaW5nIHRoYXQgY2FuIGJlIHVzZWQgYXMgYSBrZXkgaW4gYSBtYXAuXG4gICAqL1xuICBpbnRvTWFwS2V5OiBmdW5jdGlvbih0eSwgdmFsdWUpIHtcbiAgICBzd2l0Y2ggKHR5LnRhZykge1xuICAgICAgY2FzZSBcIlU4XCI6XG4gICAgICBjYXNlIFwiVTE2XCI6XG4gICAgICBjYXNlIFwiVTMyXCI6XG4gICAgICBjYXNlIFwiVTY0XCI6XG4gICAgICBjYXNlIFwiVTEyOFwiOlxuICAgICAgY2FzZSBcIlUyNTZcIjpcbiAgICAgIGNhc2UgXCJJOFwiOlxuICAgICAgY2FzZSBcIkkxNlwiOlxuICAgICAgY2FzZSBcIkkzMlwiOlxuICAgICAgY2FzZSBcIkk2NFwiOlxuICAgICAgY2FzZSBcIkkxMjhcIjpcbiAgICAgIGNhc2UgXCJJMjU2XCI6XG4gICAgICBjYXNlIFwiRjMyXCI6XG4gICAgICBjYXNlIFwiRjY0XCI6XG4gICAgICBjYXNlIFwiU3RyaW5nXCI6XG4gICAgICBjYXNlIFwiQm9vbFwiOlxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICBjYXNlIFwiUHJvZHVjdFwiOlxuICAgICAgICByZXR1cm4gUHJvZHVjdFR5cGUuaW50b01hcEtleSh0eS52YWx1ZSwgdmFsdWUpO1xuICAgICAgZGVmYXVsdDoge1xuICAgICAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEwKTtcbiAgICAgICAgQWxnZWJyYWljVHlwZS5zZXJpYWxpemVWYWx1ZSh3cml0ZXIsIHR5LCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB3cml0ZXIudG9CYXNlNjQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5mdW5jdGlvbiBiaW5kQ2FsbChmKSB7XG4gIHJldHVybiBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbC5iaW5kKGYpO1xufVxudmFyIHByaW1pdGl2ZVNlcmlhbGl6ZXJzID0ge1xuICBCb29sOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlQm9vbCksXG4gIEk4OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTgpLFxuICBVODogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZVU4KSxcbiAgSTE2OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTE2KSxcbiAgVTE2OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTE2KSxcbiAgSTMyOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTMyKSxcbiAgVTMyOiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTMyKSxcbiAgSTY0OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlSTY0KSxcbiAgVTY0OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTY0KSxcbiAgSTEyODogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZUkxMjgpLFxuICBVMTI4OiBiaW5kQ2FsbChCaW5hcnlXcml0ZXIucHJvdG90eXBlLndyaXRlVTEyOCksXG4gIEkyNTY6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVJMjU2KSxcbiAgVTI1NjogYmluZENhbGwoQmluYXJ5V3JpdGVyLnByb3RvdHlwZS53cml0ZVUyNTYpLFxuICBGMzI6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVGMzIpLFxuICBGNjQ6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVGNjQpLFxuICBTdHJpbmc6IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVTdHJpbmcpXG59O1xuT2JqZWN0LmZyZWV6ZShwcmltaXRpdmVTZXJpYWxpemVycyk7XG52YXIgc2VyaWFsaXplVWludDhBcnJheSA9IGJpbmRDYWxsKEJpbmFyeVdyaXRlci5wcm90b3R5cGUud3JpdGVVSW50OEFycmF5KTtcbnZhciBwcmltaXRpdmVEZXNlcmlhbGl6ZXJzID0ge1xuICBCb29sOiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRCb29sKSxcbiAgSTg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZEk4KSxcbiAgVTg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFU4KSxcbiAgSTE2OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJMTYpLFxuICBVMTY6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFUxNiksXG4gIEkzMjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkSTMyKSxcbiAgVTMyOiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRVMzIpLFxuICBJNjQ6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZEk2NCksXG4gIFU2NDogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVTY0KSxcbiAgSTEyODogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkSTEyOCksXG4gIFUxMjg6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFUxMjgpLFxuICBJMjU2OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRJMjU2KSxcbiAgVTI1NjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkVTI1NiksXG4gIEYzMjogYmluZENhbGwoQmluYXJ5UmVhZGVyLnByb3RvdHlwZS5yZWFkRjMyKSxcbiAgRjY0OiBiaW5kQ2FsbChCaW5hcnlSZWFkZXIucHJvdG90eXBlLnJlYWRGNjQpLFxuICBTdHJpbmc6IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFN0cmluZylcbn07XG5PYmplY3QuZnJlZXplKHByaW1pdGl2ZURlc2VyaWFsaXplcnMpO1xudmFyIGRlc2VyaWFsaXplVWludDhBcnJheSA9IGJpbmRDYWxsKEJpbmFyeVJlYWRlci5wcm90b3R5cGUucmVhZFVJbnQ4QXJyYXkpO1xudmFyIHByaW1pdGl2ZVNpemVzID0ge1xuICBCb29sOiAxLFxuICBJODogMSxcbiAgVTg6IDEsXG4gIEkxNjogMixcbiAgVTE2OiAyLFxuICBJMzI6IDQsXG4gIFUzMjogNCxcbiAgSTY0OiA4LFxuICBVNjQ6IDgsXG4gIEkxMjg6IDE2LFxuICBVMTI4OiAxNixcbiAgSTI1NjogMzIsXG4gIFUyNTY6IDMyLFxuICBGMzI6IDQsXG4gIEY2NDogOFxufTtcbnZhciBmaXhlZFNpemVQcmltaXRpdmVzID0gbmV3IFNldChPYmplY3Qua2V5cyhwcmltaXRpdmVTaXplcykpO1xudmFyIGlzRml4ZWRTaXplUHJvZHVjdCA9ICh0eSkgPT4gdHkuZWxlbWVudHMuZXZlcnkoXG4gICh7IGFsZ2VicmFpY1R5cGUgfSkgPT4gZml4ZWRTaXplUHJpbWl0aXZlcy5oYXMoYWxnZWJyYWljVHlwZS50YWcpXG4pO1xudmFyIHByb2R1Y3RTaXplID0gKHR5KSA9PiB0eS5lbGVtZW50cy5yZWR1Y2UoXG4gIChhY2MsIHsgYWxnZWJyYWljVHlwZSB9KSA9PiBhY2MgKyBwcmltaXRpdmVTaXplc1thbGdlYnJhaWNUeXBlLnRhZ10sXG4gIDBcbik7XG52YXIgcHJpbWl0aXZlSlNOYW1lID0ge1xuICBCb29sOiBcIlVpbnQ4XCIsXG4gIEk4OiBcIkludDhcIixcbiAgVTg6IFwiVWludDhcIixcbiAgSTE2OiBcIkludDE2XCIsXG4gIFUxNjogXCJVaW50MTZcIixcbiAgSTMyOiBcIkludDMyXCIsXG4gIFUzMjogXCJVaW50MzJcIixcbiAgSTY0OiBcIkJpZ0ludDY0XCIsXG4gIFU2NDogXCJCaWdVaW50NjRcIixcbiAgRjMyOiBcIkZsb2F0MzJcIixcbiAgRjY0OiBcIkZsb2F0NjRcIlxufTtcbnZhciBzcGVjaWFsUHJvZHVjdERlc2VyaWFsaXplcnMgPSB7XG4gIF9fdGltZV9kdXJhdGlvbl9taWNyb3NfXzogKHJlYWRlcikgPT4gbmV3IFRpbWVEdXJhdGlvbihyZWFkZXIucmVhZEk2NCgpKSxcbiAgX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXzogKHJlYWRlcikgPT4gbmV3IFRpbWVzdGFtcChyZWFkZXIucmVhZEk2NCgpKSxcbiAgX19pZGVudGl0eV9fOiAocmVhZGVyKSA9PiBuZXcgSWRlbnRpdHkocmVhZGVyLnJlYWRVMjU2KCkpLFxuICBfX2Nvbm5lY3Rpb25faWRfXzogKHJlYWRlcikgPT4gbmV3IENvbm5lY3Rpb25JZChyZWFkZXIucmVhZFUxMjgoKSksXG4gIF9fdXVpZF9fOiAocmVhZGVyKSA9PiBuZXcgVXVpZChyZWFkZXIucmVhZFUxMjgoKSlcbn07XG5PYmplY3QuZnJlZXplKHNwZWNpYWxQcm9kdWN0RGVzZXJpYWxpemVycyk7XG52YXIgdW5pdERlc2VyaWFsaXplciA9ICgpID0+ICh7fSk7XG52YXIgZ2V0RWxlbWVudEluaXRpYWxpemVyID0gKGVsZW1lbnQpID0+IHtcbiAgbGV0IGluaXQ7XG4gIHN3aXRjaCAoZWxlbWVudC5hbGdlYnJhaWNUeXBlLnRhZykge1xuICAgIGNhc2UgXCJTdHJpbmdcIjpcbiAgICAgIGluaXQgPSBcIicnXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiQm9vbFwiOlxuICAgICAgaW5pdCA9IFwiZmFsc2VcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJJOFwiOlxuICAgIGNhc2UgXCJVOFwiOlxuICAgIGNhc2UgXCJJMTZcIjpcbiAgICBjYXNlIFwiVTE2XCI6XG4gICAgY2FzZSBcIkkzMlwiOlxuICAgIGNhc2UgXCJVMzJcIjpcbiAgICAgIGluaXQgPSBcIjBcIjtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgXCJJNjRcIjpcbiAgICBjYXNlIFwiVTY0XCI6XG4gICAgY2FzZSBcIkkxMjhcIjpcbiAgICBjYXNlIFwiVTEyOFwiOlxuICAgIGNhc2UgXCJJMjU2XCI6XG4gICAgY2FzZSBcIlUyNTZcIjpcbiAgICAgIGluaXQgPSBcIjBuXCI7XG4gICAgICBicmVhaztcbiAgICBjYXNlIFwiRjMyXCI6XG4gICAgY2FzZSBcIkY2NFwiOlxuICAgICAgaW5pdCA9IFwiMC4wXCI7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgaW5pdCA9IFwidW5kZWZpbmVkXCI7XG4gIH1cbiAgcmV0dXJuIGAke2VsZW1lbnQubmFtZX06ICR7aW5pdH1gO1xufTtcbnZhciBQcm9kdWN0VHlwZSA9IHtcbiAgbWFrZVNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkge1xuICAgIGxldCBzZXJpYWxpemVyID0gU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICBpZiAoc2VyaWFsaXplciAhPSBudWxsKSByZXR1cm4gc2VyaWFsaXplcjtcbiAgICBpZiAoaXNGaXhlZFNpemVQcm9kdWN0KHR5KSkge1xuICAgICAgY29uc3Qgc2l6ZSA9IHByb2R1Y3RTaXplKHR5KTtcbiAgICAgIGNvbnN0IGJvZHkyID0gYFwidXNlIHN0cmljdFwiO1xud3JpdGVyLmV4cGFuZEJ1ZmZlcigke3NpemV9KTtcbmNvbnN0IHZpZXcgPSB3cml0ZXIudmlldztcbiR7dHkuZWxlbWVudHMubWFwKFxuICAgICAgICAoeyBuYW1lLCBhbGdlYnJhaWNUeXBlOiB7IHRhZyB9IH0pID0+IHRhZyBpbiBwcmltaXRpdmVKU05hbWUgPyBgdmlldy5zZXQke3ByaW1pdGl2ZUpTTmFtZVt0YWddfSh3cml0ZXIub2Zmc2V0LCB2YWx1ZS4ke25hbWV9LCAke3ByaW1pdGl2ZVNpemVzW3RhZ10gPiAxID8gXCJ0cnVlXCIgOiBcIlwifSk7XG53cml0ZXIub2Zmc2V0ICs9ICR7cHJpbWl0aXZlU2l6ZXNbdGFnXX07YCA6IGB3cml0ZXIud3JpdGUke3RhZ30odmFsdWUuJHtuYW1lfSk7YFxuICAgICAgKS5qb2luKFwiXFxuXCIpfWA7XG4gICAgICBzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJ3cml0ZXJcIiwgXCJ2YWx1ZVwiLCBib2R5Mik7XG4gICAgICBTRVJJQUxJWkVSUy5zZXQodHksIHNlcmlhbGl6ZXIpO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZXI7XG4gICAgfVxuICAgIGNvbnN0IHNlcmlhbGl6ZXJzID0ge307XG4gICAgY29uc3QgYm9keSA9ICdcInVzZSBzdHJpY3RcIjtcXG4nICsgdHkuZWxlbWVudHMubWFwKFxuICAgICAgKGVsZW1lbnQpID0+IGB0aGlzLiR7ZWxlbWVudC5uYW1lfSh3cml0ZXIsIHZhbHVlLiR7ZWxlbWVudC5uYW1lfSk7YFxuICAgICkuam9pbihcIlxcblwiKTtcbiAgICBzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJ3cml0ZXJcIiwgXCJ2YWx1ZVwiLCBib2R5KS5iaW5kKFxuICAgICAgc2VyaWFsaXplcnNcbiAgICApO1xuICAgIFNFUklBTElaRVJTLnNldCh0eSwgc2VyaWFsaXplcik7XG4gICAgZm9yIChjb25zdCB7IG5hbWUsIGFsZ2VicmFpY1R5cGUgfSBvZiB0eS5lbGVtZW50cykge1xuICAgICAgc2VyaWFsaXplcnNbbmFtZV0gPSBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICBhbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgfVxuICAgIE9iamVjdC5mcmVlemUoc2VyaWFsaXplcnMpO1xuICAgIHJldHVybiBzZXJpYWxpemVyO1xuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlU2VyaWFsaXplcmAgaW5zdGVhZC4gKi9cbiAgc2VyaWFsaXplVmFsdWUod3JpdGVyLCB0eSwgdmFsdWUsIHR5cGVzcGFjZSkge1xuICAgIFByb2R1Y3RUeXBlLm1ha2VTZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpKHdyaXRlciwgdmFsdWUpO1xuICB9LFxuICBtYWtlRGVzZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpIHtcbiAgICBzd2l0Y2ggKHR5LmVsZW1lbnRzLmxlbmd0aCkge1xuICAgICAgY2FzZSAwOlxuICAgICAgICByZXR1cm4gdW5pdERlc2VyaWFsaXplcjtcbiAgICAgIGNhc2UgMToge1xuICAgICAgICBjb25zdCBmaWVsZE5hbWUgPSB0eS5lbGVtZW50c1swXS5uYW1lO1xuICAgICAgICBpZiAoaGFzT3duKHNwZWNpYWxQcm9kdWN0RGVzZXJpYWxpemVycywgZmllbGROYW1lKSlcbiAgICAgICAgICByZXR1cm4gc3BlY2lhbFByb2R1Y3REZXNlcmlhbGl6ZXJzW2ZpZWxkTmFtZV07XG4gICAgICB9XG4gICAgfVxuICAgIGxldCBkZXNlcmlhbGl6ZXIgPSBERVNFUklBTElaRVJTLmdldCh0eSk7XG4gICAgaWYgKGRlc2VyaWFsaXplciAhPSBudWxsKSByZXR1cm4gZGVzZXJpYWxpemVyO1xuICAgIGlmIChpc0ZpeGVkU2l6ZVByb2R1Y3QodHkpKSB7XG4gICAgICBjb25zdCBib2R5ID0gYFwidXNlIHN0cmljdFwiO1xuY29uc3QgcmVzdWx0ID0geyAke3R5LmVsZW1lbnRzLm1hcChnZXRFbGVtZW50SW5pdGlhbGl6ZXIpLmpvaW4oXCIsIFwiKX0gfTtcbmNvbnN0IHZpZXcgPSByZWFkZXIudmlldztcbiR7dHkuZWxlbWVudHMubWFwKFxuICAgICAgICAoeyBuYW1lLCBhbGdlYnJhaWNUeXBlOiB7IHRhZyB9IH0pID0+IHRhZyBpbiBwcmltaXRpdmVKU05hbWUgPyB0YWcgPT09IFwiQm9vbFwiID8gYHJlc3VsdC4ke25hbWV9ID0gdmlldy5nZXRVaW50OChyZWFkZXIub2Zmc2V0KSAhPT0gMDtcbnJlYWRlci5vZmZzZXQgKz0gMTtgIDogYHJlc3VsdC4ke25hbWV9ID0gdmlldy5nZXQke3ByaW1pdGl2ZUpTTmFtZVt0YWddfShyZWFkZXIub2Zmc2V0LCAke3ByaW1pdGl2ZVNpemVzW3RhZ10gPiAxID8gXCJ0cnVlXCIgOiBcIlwifSk7XG5yZWFkZXIub2Zmc2V0ICs9ICR7cHJpbWl0aXZlU2l6ZXNbdGFnXX07YCA6IGByZXN1bHQuJHtuYW1lfSA9IHJlYWRlci5yZWFkJHt0YWd9KCk7YFxuICAgICAgKS5qb2luKFwiXFxuXCIpfVxucmV0dXJuIHJlc3VsdDtgO1xuICAgICAgZGVzZXJpYWxpemVyID0gRnVuY3Rpb24oXCJyZWFkZXJcIiwgYm9keSk7XG4gICAgICBERVNFUklBTElaRVJTLnNldCh0eSwgZGVzZXJpYWxpemVyKTtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZXI7XG4gICAgfVxuICAgIGNvbnN0IGRlc2VyaWFsaXplcnMgPSB7fTtcbiAgICBkZXNlcmlhbGl6ZXIgPSBGdW5jdGlvbihcbiAgICAgIFwicmVhZGVyXCIsXG4gICAgICBgXCJ1c2Ugc3RyaWN0XCI7XG5jb25zdCByZXN1bHQgPSB7ICR7dHkuZWxlbWVudHMubWFwKGdldEVsZW1lbnRJbml0aWFsaXplcikuam9pbihcIiwgXCIpfSB9O1xuJHt0eS5lbGVtZW50cy5tYXAoKHsgbmFtZSB9KSA9PiBgcmVzdWx0LiR7bmFtZX0gPSB0aGlzLiR7bmFtZX0ocmVhZGVyKTtgKS5qb2luKFwiXFxuXCIpfVxucmV0dXJuIHJlc3VsdDtgXG4gICAgKS5iaW5kKGRlc2VyaWFsaXplcnMpO1xuICAgIERFU0VSSUFMSVpFUlMuc2V0KHR5LCBkZXNlcmlhbGl6ZXIpO1xuICAgIGZvciAoY29uc3QgeyBuYW1lLCBhbGdlYnJhaWNUeXBlIH0gb2YgdHkuZWxlbWVudHMpIHtcbiAgICAgIGRlc2VyaWFsaXplcnNbbmFtZV0gPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIGFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICB9XG4gICAgT2JqZWN0LmZyZWV6ZShkZXNlcmlhbGl6ZXJzKTtcbiAgICByZXR1cm4gZGVzZXJpYWxpemVyO1xuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlRGVzZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBkZXNlcmlhbGl6ZVZhbHVlKHJlYWRlciwgdHksIHR5cGVzcGFjZSkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZS5tYWtlRGVzZXJpYWxpemVyKHR5LCB0eXBlc3BhY2UpKHJlYWRlcik7XG4gIH0sXG4gIGludG9NYXBLZXkodHksIHZhbHVlKSB7XG4gICAgaWYgKHR5LmVsZW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgY29uc3QgZmllbGROYW1lID0gdHkuZWxlbWVudHNbMF0ubmFtZTtcbiAgICAgIGlmIChoYXNPd24oc3BlY2lhbFByb2R1Y3REZXNlcmlhbGl6ZXJzLCBmaWVsZE5hbWUpKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZVtmaWVsZE5hbWVdO1xuICAgICAgfVxuICAgIH1cbiAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEwKTtcbiAgICBBbGdlYnJhaWNUeXBlLnNlcmlhbGl6ZVZhbHVlKHdyaXRlciwgQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHR5KSwgdmFsdWUpO1xuICAgIHJldHVybiB3cml0ZXIudG9CYXNlNjQoKTtcbiAgfVxufTtcbnZhciBTdW1UeXBlID0ge1xuICBtYWtlU2VyaWFsaXplcih0eSwgdHlwZXNwYWNlKSB7XG4gICAgaWYgKHR5LnZhcmlhbnRzLmxlbmd0aCA9PSAyICYmIHR5LnZhcmlhbnRzWzBdLm5hbWUgPT09IFwic29tZVwiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwibm9uZVwiKSB7XG4gICAgICBjb25zdCBzZXJpYWxpemUgPSBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICB0eS52YXJpYW50c1swXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgICByZXR1cm4gKHdyaXRlciwgdmFsdWUpID0+IHtcbiAgICAgICAgaWYgKHZhbHVlICE9PSBudWxsICYmIHZhbHVlICE9PSB2b2lkIDApIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVCeXRlKDApO1xuICAgICAgICAgIHNlcmlhbGl6ZSh3cml0ZXIsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVCeXRlKDEpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHkudmFyaWFudHMubGVuZ3RoID09IDIgJiYgdHkudmFyaWFudHNbMF0ubmFtZSA9PT0gXCJva1wiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwiZXJyXCIpIHtcbiAgICAgIGNvbnN0IHNlcmlhbGl6ZU9rID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgICAgdHkudmFyaWFudHNbMF0uYWxnZWJyYWljVHlwZSxcbiAgICAgICAgdHlwZXNwYWNlXG4gICAgICApO1xuICAgICAgY29uc3Qgc2VyaWFsaXplRXJyID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgICAgdHkudmFyaWFudHNbMF0uYWxnZWJyYWljVHlwZSxcbiAgICAgICAgdHlwZXNwYWNlXG4gICAgICApO1xuICAgICAgcmV0dXJuICh3cml0ZXIsIHZhbHVlKSA9PiB7XG4gICAgICAgIGlmIChcIm9rXCIgaW4gdmFsdWUpIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVVOCgwKTtcbiAgICAgICAgICBzZXJpYWxpemVPayh3cml0ZXIsIHZhbHVlLm9rKTtcbiAgICAgICAgfSBlbHNlIGlmIChcImVyclwiIGluIHZhbHVlKSB7XG4gICAgICAgICAgd3JpdGVyLndyaXRlVTgoMSk7XG4gICAgICAgICAgc2VyaWFsaXplRXJyKHdyaXRlciwgdmFsdWUuZXJyKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgICAgXCJjb3VsZCBub3Qgc2VyaWFsaXplIHJlc3VsdDogb2JqZWN0IGhhZCBuZWl0aGVyIGEgYG9rYCBub3IgYW4gYGVycmAgZmllbGRcIlxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBzZXJpYWxpemVyID0gU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICAgIGlmIChzZXJpYWxpemVyICE9IG51bGwpIHJldHVybiBzZXJpYWxpemVyO1xuICAgICAgY29uc3Qgc2VyaWFsaXplcnMgPSB7fTtcbiAgICAgIGNvbnN0IGJvZHkgPSBgc3dpdGNoICh2YWx1ZS50YWcpIHtcbiR7dHkudmFyaWFudHMubWFwKFxuICAgICAgICAoeyBuYW1lIH0sIGkpID0+IGAgIGNhc2UgJHtKU09OLnN0cmluZ2lmeShuYW1lKX06XG4gICAgd3JpdGVyLndyaXRlQnl0ZSgke2l9KTtcbiAgICByZXR1cm4gdGhpcy4ke25hbWV9KHdyaXRlciwgdmFsdWUudmFsdWUpO2BcbiAgICAgICkuam9pbihcIlxcblwiKX1cbiAgZGVmYXVsdDpcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgXFxgQ291bGQgbm90IHNlcmlhbGl6ZSBzdW0gdHlwZTsgdW5rbm93biB0YWcgXFwke3ZhbHVlLnRhZ31cXGBcbiAgICApXG59XG5gO1xuICAgICAgc2VyaWFsaXplciA9IEZ1bmN0aW9uKFwid3JpdGVyXCIsIFwidmFsdWVcIiwgYm9keSkuYmluZChcbiAgICAgICAgc2VyaWFsaXplcnNcbiAgICAgICk7XG4gICAgICBTRVJJQUxJWkVSUy5zZXQodHksIHNlcmlhbGl6ZXIpO1xuICAgICAgZm9yIChjb25zdCB7IG5hbWUsIGFsZ2VicmFpY1R5cGUgfSBvZiB0eS52YXJpYW50cykge1xuICAgICAgICBzZXJpYWxpemVyc1tuYW1lXSA9IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIoXG4gICAgICAgICAgYWxnZWJyYWljVHlwZSxcbiAgICAgICAgICB0eXBlc3BhY2VcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIE9iamVjdC5mcmVlemUoc2VyaWFsaXplcnMpO1xuICAgICAgcmV0dXJuIHNlcmlhbGl6ZXI7XG4gICAgfVxuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlU2VyaWFsaXplcmAgaW5zdGVhZC4gKi9cbiAgc2VyaWFsaXplVmFsdWUod3JpdGVyLCB0eSwgdmFsdWUsIHR5cGVzcGFjZSkge1xuICAgIFN1bVR5cGUubWFrZVNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkod3JpdGVyLCB2YWx1ZSk7XG4gIH0sXG4gIG1ha2VEZXNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkge1xuICAgIGlmICh0eS52YXJpYW50cy5sZW5ndGggPT0gMiAmJiB0eS52YXJpYW50c1swXS5uYW1lID09PSBcInNvbWVcIiAmJiB0eS52YXJpYW50c1sxXS5uYW1lID09PSBcIm5vbmVcIikge1xuICAgICAgY29uc3QgZGVzZXJpYWxpemUgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIHR5LnZhcmlhbnRzWzBdLmFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICAgIHJldHVybiAocmVhZGVyKSA9PiB7XG4gICAgICAgIGNvbnN0IHRhZyA9IHJlYWRlci5yZWFkVTgoKTtcbiAgICAgICAgaWYgKHRhZyA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBkZXNlcmlhbGl6ZShyZWFkZXIpO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZyA9PT0gMSkge1xuICAgICAgICAgIHJldHVybiB2b2lkIDA7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgYENhbid0IGRlc2VyaWFsaXplIGFuIG9wdGlvbiB0eXBlLCBjb3VsZG4ndCBmaW5kICR7dGFnfSB0YWdgO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSBpZiAodHkudmFyaWFudHMubGVuZ3RoID09IDIgJiYgdHkudmFyaWFudHNbMF0ubmFtZSA9PT0gXCJva1wiICYmIHR5LnZhcmlhbnRzWzFdLm5hbWUgPT09IFwiZXJyXCIpIHtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplT2sgPSBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoXG4gICAgICAgIHR5LnZhcmlhbnRzWzBdLmFsZ2VicmFpY1R5cGUsXG4gICAgICAgIHR5cGVzcGFjZVxuICAgICAgKTtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplRXJyID0gQWxnZWJyYWljVHlwZS5tYWtlRGVzZXJpYWxpemVyKFxuICAgICAgICB0eS52YXJpYW50c1sxXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgICk7XG4gICAgICByZXR1cm4gKHJlYWRlcikgPT4ge1xuICAgICAgICBjb25zdCB0YWcgPSByZWFkZXIucmVhZEJ5dGUoKTtcbiAgICAgICAgaWYgKHRhZyA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiB7IG9rOiBkZXNlcmlhbGl6ZU9rKHJlYWRlcikgfTtcbiAgICAgICAgfSBlbHNlIGlmICh0YWcgPT09IDEpIHtcbiAgICAgICAgICByZXR1cm4geyBlcnI6IGRlc2VyaWFsaXplRXJyKHJlYWRlcikgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBgQ2FuJ3QgZGVzZXJpYWxpemUgYSByZXN1bHQgdHlwZSwgY291bGRuJ3QgZmluZCAke3RhZ30gdGFnYDtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGRlc2VyaWFsaXplciA9IERFU0VSSUFMSVpFUlMuZ2V0KHR5KTtcbiAgICAgIGlmIChkZXNlcmlhbGl6ZXIgIT0gbnVsbCkgcmV0dXJuIGRlc2VyaWFsaXplcjtcbiAgICAgIGNvbnN0IGRlc2VyaWFsaXplcnMgPSB7fTtcbiAgICAgIGRlc2VyaWFsaXplciA9IEZ1bmN0aW9uKFxuICAgICAgICBcInJlYWRlclwiLFxuICAgICAgICBgc3dpdGNoIChyZWFkZXIucmVhZFU4KCkpIHtcbiR7dHkudmFyaWFudHMubWFwKFxuICAgICAgICAgICh7IG5hbWUgfSwgaSkgPT4gYGNhc2UgJHtpfTogcmV0dXJuIHsgdGFnOiAke0pTT04uc3RyaW5naWZ5KG5hbWUpfSwgdmFsdWU6IHRoaXMuJHtuYW1lfShyZWFkZXIpIH07YFxuICAgICAgICApLmpvaW4oXCJcXG5cIil9IH1gXG4gICAgICApLmJpbmQoZGVzZXJpYWxpemVycyk7XG4gICAgICBERVNFUklBTElaRVJTLnNldCh0eSwgZGVzZXJpYWxpemVyKTtcbiAgICAgIGZvciAoY29uc3QgeyBuYW1lLCBhbGdlYnJhaWNUeXBlIH0gb2YgdHkudmFyaWFudHMpIHtcbiAgICAgICAgZGVzZXJpYWxpemVyc1tuYW1lXSA9IEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcihcbiAgICAgICAgICBhbGdlYnJhaWNUeXBlLFxuICAgICAgICAgIHR5cGVzcGFjZVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgT2JqZWN0LmZyZWV6ZShkZXNlcmlhbGl6ZXJzKTtcbiAgICAgIHJldHVybiBkZXNlcmlhbGl6ZXI7XG4gICAgfVxuICB9LFxuICAvKiogQGRlcHJlY2F0ZWQgVXNlIGBtYWtlRGVzZXJpYWxpemVyYCBpbnN0ZWFkLiAqL1xuICBkZXNlcmlhbGl6ZVZhbHVlKHJlYWRlciwgdHksIHR5cGVzcGFjZSkge1xuICAgIHJldHVybiBTdW1UeXBlLm1ha2VEZXNlcmlhbGl6ZXIodHksIHR5cGVzcGFjZSkocmVhZGVyKTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9vcHRpb24udHNcbnZhciBPcHRpb24gPSB7XG4gIGdldEFsZ2VicmFpY1R5cGUoaW5uZXJUeXBlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgIHsgbmFtZTogXCJzb21lXCIsIGFsZ2VicmFpY1R5cGU6IGlubmVyVHlwZSB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogXCJub25lXCIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHsgZWxlbWVudHM6IFtdIH0pXG4gICAgICAgIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9yZXN1bHQudHNcbnZhciBSZXN1bHQgPSB7XG4gIGdldEFsZ2VicmFpY1R5cGUob2tUeXBlLCBlcnJUeXBlKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgIHsgbmFtZTogXCJva1wiLCBhbGdlYnJhaWNUeXBlOiBva1R5cGUgfSxcbiAgICAgICAgeyBuYW1lOiBcImVyclwiLCBhbGdlYnJhaWNUeXBlOiBlcnJUeXBlIH1cbiAgICAgIF1cbiAgICB9KTtcbiAgfVxufTtcblxuLy8gc3JjL2xpYi9zY2hlZHVsZV9hdC50c1xudmFyIFNjaGVkdWxlQXQgPSB7XG4gIGludGVydmFsKHZhbHVlKSB7XG4gICAgcmV0dXJuIEludGVydmFsKHZhbHVlKTtcbiAgfSxcbiAgdGltZSh2YWx1ZSkge1xuICAgIHJldHVybiBUaW1lKHZhbHVlKTtcbiAgfSxcbiAgZ2V0QWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZS5TdW0oe1xuICAgICAgdmFyaWFudHM6IFtcbiAgICAgICAge1xuICAgICAgICAgIG5hbWU6IFwiSW50ZXJ2YWxcIixcbiAgICAgICAgICBhbGdlYnJhaWNUeXBlOiBUaW1lRHVyYXRpb24uZ2V0QWxnZWJyYWljVHlwZSgpXG4gICAgICAgIH0sXG4gICAgICAgIHsgbmFtZTogXCJUaW1lXCIsIGFsZ2VicmFpY1R5cGU6IFRpbWVzdGFtcC5nZXRBbGdlYnJhaWNUeXBlKCkgfVxuICAgICAgXVxuICAgIH0pO1xuICB9LFxuICBpc1NjaGVkdWxlQXQoYWxnZWJyYWljVHlwZSkge1xuICAgIGlmIChhbGdlYnJhaWNUeXBlLnRhZyAhPT0gXCJTdW1cIikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCB2YXJpYW50cyA9IGFsZ2VicmFpY1R5cGUudmFsdWUudmFyaWFudHM7XG4gICAgaWYgKHZhcmlhbnRzLmxlbmd0aCAhPT0gMikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBjb25zdCBpbnRlcnZhbFZhcmlhbnQgPSB2YXJpYW50cy5maW5kKCh2KSA9PiB2Lm5hbWUgPT09IFwiSW50ZXJ2YWxcIik7XG4gICAgY29uc3QgdGltZVZhcmlhbnQgPSB2YXJpYW50cy5maW5kKCh2KSA9PiB2Lm5hbWUgPT09IFwiVGltZVwiKTtcbiAgICBpZiAoIWludGVydmFsVmFyaWFudCB8fCAhdGltZVZhcmlhbnQpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIFRpbWVEdXJhdGlvbi5pc1RpbWVEdXJhdGlvbihpbnRlcnZhbFZhcmlhbnQuYWxnZWJyYWljVHlwZSkgJiYgVGltZXN0YW1wLmlzVGltZXN0YW1wKHRpbWVWYXJpYW50LmFsZ2VicmFpY1R5cGUpO1xuICB9XG59O1xudmFyIEludGVydmFsID0gKG1pY3JvcykgPT4gKHtcbiAgdGFnOiBcIkludGVydmFsXCIsXG4gIHZhbHVlOiBuZXcgVGltZUR1cmF0aW9uKG1pY3Jvcylcbn0pO1xudmFyIFRpbWUgPSAobWljcm9zU2luY2VVbml4RXBvY2gpID0+ICh7XG4gIHRhZzogXCJUaW1lXCIsXG4gIHZhbHVlOiBuZXcgVGltZXN0YW1wKG1pY3Jvc1NpbmNlVW5peEVwb2NoKVxufSk7XG52YXIgc2NoZWR1bGVfYXRfZGVmYXVsdCA9IFNjaGVkdWxlQXQ7XG5cbi8vIHNyYy9saWIvdHlwZV91dGlsLnRzXG5mdW5jdGlvbiBzZXQoeCwgdDIpIHtcbiAgcmV0dXJuIHsgLi4ueCwgLi4udDIgfTtcbn1cblxuLy8gc3JjL2xpYi90eXBlX2J1aWxkZXJzLnRzXG52YXIgVHlwZUJ1aWxkZXIgPSBjbGFzcyB7XG4gIC8qKlxuICAgKiBUaGUgVHlwZVNjcmlwdCBwaGFudG9tIHR5cGUuIFRoaXMgaXMgbm90IHN0b3JlZCBhdCBydW50aW1lLFxuICAgKiBidXQgaXMgdmlzaWJsZSB0byB0aGUgY29tcGlsZXJcbiAgICovXG4gIHR5cGU7XG4gIC8qKlxuICAgKiBUaGUgU3BhY2V0aW1lREIgYWxnZWJyYWljIHR5cGUgKHJ1buKAkXRpbWUgdmFsdWUpLiBJbiBhZGRpdGlvbiB0byBzdG9yaW5nXG4gICAqIHRoZSBydW50aW1lIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBgQWxnZWJyYWljVHlwZWAsIGl0IGFsc28gY2FwdHVyZXNcbiAgICogdGhlIFR5cGVTY3JpcHQgdHlwZSBpbmZvcm1hdGlvbiBvZiB0aGUgYEFsZ2VicmFpY1R5cGVgLiBUaGF0IGlzIHRvIHNheVxuICAgKiB0aGUgdmFsdWUgaXMgbm90IG1lcmVseSBhbiBgQWxnZWJyYWljVHlwZWAsIGJ1dCBpcyBjb25zdHJ1Y3RlZCB0byBiZVxuICAgKiB0aGUgY29ycmVzcG9uZGluZyBjb25jcmV0ZSBgQWxnZWJyYWljVHlwZWAgZm9yIHRoZSBUeXBlU2NyaXB0IHR5cGUgYFR5cGVgLlxuICAgKlxuICAgKiBlLmcuIGBzdHJpbmdgIGNvcnJlc3BvbmRzIHRvIGBBbGdlYnJhaWNUeXBlLlN0cmluZ2BcbiAgICovXG4gIGFsZ2VicmFpY1R5cGU7XG4gIGNvbnN0cnVjdG9yKGFsZ2VicmFpY1R5cGUpIHtcbiAgICB0aGlzLmFsZ2VicmFpY1R5cGUgPSBhbGdlYnJhaWNUeXBlO1xuICB9XG4gIG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBuZXcgT3B0aW9uQnVpbGRlcih0aGlzKTtcbiAgfVxuICBzZXJpYWxpemUod3JpdGVyLCB2YWx1ZSkge1xuICAgIGNvbnN0IHNlcmlhbGl6ZSA9IHRoaXMuc2VyaWFsaXplID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihcbiAgICAgIHRoaXMuYWxnZWJyYWljVHlwZVxuICAgICk7XG4gICAgc2VyaWFsaXplKHdyaXRlciwgdmFsdWUpO1xuICB9XG4gIGRlc2VyaWFsaXplKHJlYWRlcikge1xuICAgIGNvbnN0IGRlc2VyaWFsaXplID0gdGhpcy5kZXNlcmlhbGl6ZSA9IEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcihcbiAgICAgIHRoaXMuYWxnZWJyYWljVHlwZVxuICAgICk7XG4gICAgcmV0dXJuIGRlc2VyaWFsaXplKHJlYWRlcik7XG4gIH1cbn07XG52YXIgVThCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTgpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFU4Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBVOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFU4Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFUxNkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VMTYpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTZDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTE2Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFUzMkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VMzIpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVMzJDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTMyQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFU2NEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VNjQpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVNjRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTY0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFUxMjhCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuVTEyOCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBVMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBVMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFUxMjhDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgVTI1NkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5VMjU2KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFUyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFUyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBVMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IFUyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBVMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVTI1NkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBJOEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JOCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgSThDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSkpO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEk4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSThDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTE2QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkkxNik7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEkxNkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KSk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEkxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJMTZDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTMyQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkkzMik7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEkzMkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KSk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEkzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJMzJDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTY0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkk2NCk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEk2NENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KSk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEk2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJNjRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSTEyOEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5JMTI4KTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IEkxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEkxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IEkxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBJMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSTEyOENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBJMjU2QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLkkyNTYpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IEkyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEkyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBJMjU2Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEYzMkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5GMzIpO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IEYzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEYzMkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBGNjRCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuRjY0KTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBGNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBGNjRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgQm9vbEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5Cb29sKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBCb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgQm9vbENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgU3RyaW5nQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLlN0cmluZyk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBTdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFN0cmluZ0NvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBBcnJheUJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgZWxlbWVudDtcbiAgY29uc3RydWN0b3IoZWxlbWVudCkge1xuICAgIHN1cGVyKEFsZ2VicmFpY1R5cGUuQXJyYXkoZWxlbWVudC5hbGdlYnJhaWNUeXBlKSk7XG4gICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBBcnJheUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IEFycmF5Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIEJ5dGVBcnJheUJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5BcnJheShBbGdlYnJhaWNUeXBlLlU4KSk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgQnl0ZUFycmF5Q29sdW1uQnVpbGRlcihcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBCeXRlQXJyYXlDb2x1bW5CdWlsZGVyKHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgT3B0aW9uQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICB2YWx1ZTtcbiAgY29uc3RydWN0b3IodmFsdWUpIHtcbiAgICBzdXBlcihPcHRpb24uZ2V0QWxnZWJyYWljVHlwZSh2YWx1ZS5hbGdlYnJhaWNUeXBlKSk7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IE9wdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IE9wdGlvbkNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBQcm9kdWN0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICB0eXBlTmFtZTtcbiAgZWxlbWVudHM7XG4gIGNvbnN0cnVjdG9yKGVsZW1lbnRzLCBuYW1lKSB7XG4gICAgZnVuY3Rpb24gZWxlbWVudHNBcnJheUZyb21FbGVtZW50c09iaihvYmopIHtcbiAgICAgIHJldHVybiBPYmplY3Qua2V5cyhvYmopLm1hcCgoa2V5KSA9PiAoe1xuICAgICAgICBuYW1lOiBrZXksXG4gICAgICAgIC8vIExhemlseSByZXNvbHZlIHRoZSB1bmRlcmx5aW5nIG9iamVjdCdzIGFsZ2VicmFpY1R5cGUuXG4gICAgICAgIC8vIFRoaXMgd2lsbCBjYWxsIG9ialtrZXldLmFsZ2VicmFpY1R5cGUgb25seSB3aGVuIHNvbWVvbmVcbiAgICAgICAgLy8gYWN0dWFsbHkgcmVhZHMgdGhpcyBwcm9wZXJ0eS5cbiAgICAgICAgZ2V0IGFsZ2VicmFpY1R5cGUoKSB7XG4gICAgICAgICAgcmV0dXJuIG9ialtrZXldLmFsZ2VicmFpY1R5cGU7XG4gICAgICAgIH1cbiAgICAgIH0pKTtcbiAgICB9XG4gICAgc3VwZXIoXG4gICAgICBBbGdlYnJhaWNUeXBlLlByb2R1Y3Qoe1xuICAgICAgICBlbGVtZW50czogZWxlbWVudHNBcnJheUZyb21FbGVtZW50c09iaihlbGVtZW50cylcbiAgICAgIH0pXG4gICAgKTtcbiAgICB0aGlzLnR5cGVOYW1lID0gbmFtZTtcbiAgICB0aGlzLmVsZW1lbnRzID0gZWxlbWVudHM7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgUHJvZHVjdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFByb2R1Y3RDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgUmVzdWx0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBvaztcbiAgZXJyO1xuICBjb25zdHJ1Y3RvcihvaywgZXJyKSB7XG4gICAgc3VwZXIoUmVzdWx0LmdldEFsZ2VicmFpY1R5cGUob2suYWxnZWJyYWljVHlwZSwgZXJyLmFsZ2VicmFpY1R5cGUpKTtcbiAgICB0aGlzLm9rID0gb2s7XG4gICAgdGhpcy5lcnIgPSBlcnI7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgUmVzdWx0Q29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSkpO1xuICB9XG59O1xudmFyIFVuaXRCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKHsgdGFnOiBcIlByb2R1Y3RcIiwgdmFsdWU6IHsgZWxlbWVudHM6IFtdIH0gfSk7XG4gIH1cbn07XG52YXIgUm93QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICByb3c7XG4gIHR5cGVOYW1lO1xuICBjb25zdHJ1Y3Rvcihyb3csIG5hbWUpIHtcbiAgICBjb25zdCBtYXBwZWRSb3cgPSBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICBPYmplY3QuZW50cmllcyhyb3cpLm1hcCgoW2NvbE5hbWUsIGJ1aWxkZXJdKSA9PiBbXG4gICAgICAgIGNvbE5hbWUsXG4gICAgICAgIGJ1aWxkZXIgaW5zdGFuY2VvZiBDb2x1bW5CdWlsZGVyID8gYnVpbGRlciA6IG5ldyBDb2x1bW5CdWlsZGVyKGJ1aWxkZXIsIHt9KVxuICAgICAgXSlcbiAgICApO1xuICAgIGNvbnN0IGVsZW1lbnRzID0gT2JqZWN0LmtleXMobWFwcGVkUm93KS5tYXAoKG5hbWUyKSA9PiAoe1xuICAgICAgbmFtZTogbmFtZTIsXG4gICAgICBnZXQgYWxnZWJyYWljVHlwZSgpIHtcbiAgICAgICAgcmV0dXJuIG1hcHBlZFJvd1tuYW1lMl0udHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZTtcbiAgICAgIH1cbiAgICB9KSk7XG4gICAgc3VwZXIoQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHsgZWxlbWVudHMgfSkpO1xuICAgIHRoaXMucm93ID0gbWFwcGVkUm93O1xuICAgIHRoaXMudHlwZU5hbWUgPSBuYW1lO1xuICB9XG59O1xudmFyIFN1bUJ1aWxkZXJJbXBsID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIHZhcmlhbnRzO1xuICB0eXBlTmFtZTtcbiAgY29uc3RydWN0b3IodmFyaWFudHMsIG5hbWUpIHtcbiAgICBmdW5jdGlvbiB2YXJpYW50c0FycmF5RnJvbVZhcmlhbnRzT2JqKHZhcmlhbnRzMikge1xuICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKHZhcmlhbnRzMikubWFwKChrZXkpID0+ICh7XG4gICAgICAgIG5hbWU6IGtleSxcbiAgICAgICAgLy8gTGF6aWx5IHJlc29sdmUgdGhlIHVuZGVybHlpbmcgb2JqZWN0J3MgYWxnZWJyYWljVHlwZS5cbiAgICAgICAgLy8gVGhpcyB3aWxsIGNhbGwgb2JqW2tleV0uYWxnZWJyYWljVHlwZSBvbmx5IHdoZW4gc29tZW9uZVxuICAgICAgICAvLyBhY3R1YWxseSByZWFkcyB0aGlzIHByb3BlcnR5LlxuICAgICAgICBnZXQgYWxnZWJyYWljVHlwZSgpIHtcbiAgICAgICAgICByZXR1cm4gdmFyaWFudHMyW2tleV0uYWxnZWJyYWljVHlwZTtcbiAgICAgICAgfVxuICAgICAgfSkpO1xuICAgIH1cbiAgICBzdXBlcihcbiAgICAgIEFsZ2VicmFpY1R5cGUuU3VtKHtcbiAgICAgICAgdmFyaWFudHM6IHZhcmlhbnRzQXJyYXlGcm9tVmFyaWFudHNPYmoodmFyaWFudHMpXG4gICAgICB9KVxuICAgICk7XG4gICAgdGhpcy52YXJpYW50cyA9IHZhcmlhbnRzO1xuICAgIHRoaXMudHlwZU5hbWUgPSBuYW1lO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHZhcmlhbnRzKSkge1xuICAgICAgY29uc3QgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodmFyaWFudHMsIGtleSk7XG4gICAgICBjb25zdCBpc0FjY2Vzc29yID0gISFkZXNjICYmICh0eXBlb2YgZGVzYy5nZXQgPT09IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgZGVzYy5zZXQgPT09IFwiZnVuY3Rpb25cIik7XG4gICAgICBsZXQgaXNVbml0MiA9IGZhbHNlO1xuICAgICAgaWYgKCFpc0FjY2Vzc29yKSB7XG4gICAgICAgIGNvbnN0IHZhcmlhbnQgPSB2YXJpYW50c1trZXldO1xuICAgICAgICBpc1VuaXQyID0gdmFyaWFudCBpbnN0YW5jZW9mIFVuaXRCdWlsZGVyO1xuICAgICAgfVxuICAgICAgaWYgKGlzVW5pdDIpIHtcbiAgICAgICAgY29uc3QgY29uc3RhbnQgPSB0aGlzLmNyZWF0ZShrZXkpO1xuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCB7XG4gICAgICAgICAgdmFsdWU6IGNvbnN0YW50LFxuICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICAgIGNvbmZpZ3VyYWJsZTogZmFsc2VcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjb25zdCBmbiA9ICgodmFsdWUpID0+IHRoaXMuY3JlYXRlKGtleSwgdmFsdWUpKTtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIGtleSwge1xuICAgICAgICAgIHZhbHVlOiBmbixcbiAgICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgICBjb25maWd1cmFibGU6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBjcmVhdGUodGFnLCB2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA9PT0gdm9pZCAwID8geyB0YWcgfSA6IHsgdGFnLCB2YWx1ZSB9O1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFN1bUJ1aWxkZXIgPSBTdW1CdWlsZGVySW1wbDtcbnZhciBTaW1wbGVTdW1CdWlsZGVySW1wbCA9IGNsYXNzIGV4dGVuZHMgU3VtQnVpbGRlckltcGwge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IFNpbXBsZVN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFNpbXBsZVN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFNpbXBsZVN1bUJ1aWxkZXIgPSBTaW1wbGVTdW1CdWlsZGVySW1wbDtcbnZhciBTY2hlZHVsZUF0QnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihzY2hlZHVsZV9hdF9kZWZhdWx0LmdldEFsZ2VicmFpY1R5cGUoKSk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgU2NoZWR1bGVBdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IFNjaGVkdWxlQXRDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgSWRlbnRpdHlCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKElkZW50aXR5LmdldEFsZ2VicmFpY1R5cGUoKSk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBJZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IElkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlDb2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgQ29ubmVjdGlvbklkQnVpbGRlciA9IGNsYXNzIGV4dGVuZHMgVHlwZUJ1aWxkZXIge1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihDb25uZWN0aW9uSWQuZ2V0QWxnZWJyYWljVHlwZSgpKTtcbiAgfVxuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIodGhpcywgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBuYW1lIH0pKTtcbiAgfVxufTtcbnZhciBUaW1lc3RhbXBCdWlsZGVyID0gY2xhc3MgZXh0ZW5kcyBUeXBlQnVpbGRlciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFRpbWVzdGFtcC5nZXRBbGdlYnJhaWNUeXBlKCkpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMsXG4gICAgICBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgVGltZXN0YW1wQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIFRpbWVEdXJhdGlvbkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVGltZUR1cmF0aW9uLmdldEFsZ2VicmFpY1R5cGUoKSk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFRpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKHRoaXMsIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgVXVpZEJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoVXVpZC5nZXRBbGdlYnJhaWNUeXBlKCkpO1xuICB9XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IFV1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgVXVpZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLFxuICAgICAgc2V0KGRlZmF1bHRNZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IFV1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcyxcbiAgICAgIHNldChkZWZhdWx0TWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBVdWlkQ29sdW1uQnVpbGRlcih0aGlzLCBzZXQoZGVmYXVsdE1ldGFkYXRhLCB7IG5hbWUgfSkpO1xuICB9XG59O1xudmFyIGRlZmF1bHRNZXRhZGF0YSA9IHt9O1xudmFyIENvbHVtbkJ1aWxkZXIgPSBjbGFzcyB7XG4gIHR5cGVCdWlsZGVyO1xuICBjb2x1bW5NZXRhZGF0YTtcbiAgY29uc3RydWN0b3IodHlwZUJ1aWxkZXIsIG1ldGFkYXRhKSB7XG4gICAgdGhpcy50eXBlQnVpbGRlciA9IHR5cGVCdWlsZGVyO1xuICAgIHRoaXMuY29sdW1uTWV0YWRhdGEgPSBtZXRhZGF0YTtcbiAgfVxuICBzZXJpYWxpemUod3JpdGVyLCB2YWx1ZSkge1xuICAgIHRoaXMudHlwZUJ1aWxkZXIuc2VyaWFsaXplKHdyaXRlciwgdmFsdWUpO1xuICB9XG4gIGRlc2VyaWFsaXplKHJlYWRlcikge1xuICAgIHJldHVybiB0aGlzLnR5cGVCdWlsZGVyLmRlc2VyaWFsaXplKHJlYWRlcik7XG4gIH1cbn07XG52YXIgVThDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1U4Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVThDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9VOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVTE2Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9VMTZDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1UxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1UxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX1UxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfVTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBVMzJDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1UzMkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1UzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFU2NENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVTY0Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9VNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9VNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1U2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1U2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVTEyOENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVTEyOENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9VMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1UxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFUyNTZDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1UyNTZDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1UyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfVTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX1UyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1UyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9VMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJOENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSThDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0k4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJMTZDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0kxNkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0kxNkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTE2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEkzMkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSTMyQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9JMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9JMzJDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzQXV0b0luY3JlbWVudDogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0kzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0kzMkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgSTY0Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9JNjRDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0k2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9JNjRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0k2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBhdXRvSW5jKCkge1xuICAgIHJldHVybiBuZXcgX0k2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSTY0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJMTI4Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9JMTI4Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9JMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0kxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX0kxMjhDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgYXV0b0luYygpIHtcbiAgICByZXR1cm4gbmV3IF9JMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc0F1dG9JbmNyZW1lbnQ6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9JMTI4Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfSTEyOENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgSTI1NkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSTI1NkNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JMjU2Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGF1dG9JbmMoKSB7XG4gICAgcmV0dXJuIG5ldyBfSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNBdXRvSW5jcmVtZW50OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfSTI1NkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0kyNTZDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIEYzMkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfRjMyQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfRjMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfRjMyQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBGNjRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0Y2NENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX0Y2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0Y2NENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgQm9vbENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfQm9vbENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9Cb29sQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgU3RyaW5nQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9TdHJpbmdDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1N0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9TdHJpbmdDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1N0cmluZ0NvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfU3RyaW5nQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwge1xuICAgICAgICBkZWZhdWx0VmFsdWU6IHZhbHVlXG4gICAgICB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfU3RyaW5nQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBBcnJheUNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfQXJyYXlDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9BcnJheUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHtcbiAgICAgICAgZGVmYXVsdFZhbHVlOiB2YWx1ZVxuICAgICAgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0FycmF5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBCeXRlQXJyYXlDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0J5dGVBcnJheUNvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgY29uc3RydWN0b3IobWV0YWRhdGEpIHtcbiAgICBzdXBlcihuZXcgVHlwZUJ1aWxkZXIoQWxnZWJyYWljVHlwZS5BcnJheShBbGdlYnJhaWNUeXBlLlU4KSksIG1ldGFkYXRhKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfQnl0ZUFycmF5Q29sdW1uQnVpbGRlcihcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0J5dGVBcnJheUNvbHVtbkJ1aWxkZXIoc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KSk7XG4gIH1cbn07XG52YXIgT3B0aW9uQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9PcHRpb25Db2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9PcHRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9PcHRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFJlc3VsdENvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfUmVzdWx0Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBjb25zdHJ1Y3Rvcih0eXBlQnVpbGRlciwgbWV0YWRhdGEpIHtcbiAgICBzdXBlcih0eXBlQnVpbGRlciwgbWV0YWRhdGEpO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9SZXN1bHRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZTogdmFsdWVcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBQcm9kdWN0Q29sdW1uQnVpbGRlciA9IGNsYXNzIF9Qcm9kdWN0Q29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfUHJvZHVjdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfUHJvZHVjdENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgU3VtQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9TdW1Db2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9TdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1N1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfU3VtQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9TdW1Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgU2ltcGxlU3VtQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9TaW1wbGVTdW1Db2x1bW5CdWlsZGVyIGV4dGVuZHMgU3VtQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1NpbXBsZVN1bUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfU2ltcGxlU3VtQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFNjaGVkdWxlQXRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX1NjaGVkdWxlQXRDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9TY2hlZHVsZUF0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9TY2hlZHVsZUF0Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBJZGVudGl0eUNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfSWRlbnRpdHlDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9JZGVudGl0eUNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfSWRlbnRpdHlDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0lkZW50aXR5Q29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBDb25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyID0gY2xhc3MgX0Nvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIgZXh0ZW5kcyBDb2x1bW5CdWlsZGVyIHtcbiAgaW5kZXgoYWxnb3JpdGhtID0gXCJidHJlZVwiKSB7XG4gICAgcmV0dXJuIG5ldyBfQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNVbmlxdWU6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIHByaW1hcnlLZXkoKSB7XG4gICAgcmV0dXJuIG5ldyBfQ29ubmVjdGlvbklkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1ByaW1hcnlLZXk6IHRydWUgfSlcbiAgICApO1xuICB9XG4gIGRlZmF1bHQodmFsdWUpIHtcbiAgICByZXR1cm4gbmV3IF9Db25uZWN0aW9uSWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX0Nvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgbmFtZSB9KVxuICAgICk7XG4gIH1cbn07XG52YXIgVGltZXN0YW1wQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9UaW1lc3RhbXBDb2x1bW5CdWlsZGVyIGV4dGVuZHMgQ29sdW1uQnVpbGRlciB7XG4gIGluZGV4KGFsZ29yaXRobSA9IFwiYnRyZWVcIikge1xuICAgIHJldHVybiBuZXcgX1RpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaW5kZXhUeXBlOiBhbGdvcml0aG0gfSlcbiAgICApO1xuICB9XG4gIHVuaXF1ZSgpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1RpbWVzdGFtcENvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgaXNQcmltYXJ5S2V5OiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBkZWZhdWx0KHZhbHVlKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZXN0YW1wQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBkZWZhdWx0VmFsdWU6IHZhbHVlIH0pXG4gICAgKTtcbiAgfVxuICBuYW1lKG5hbWUpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lc3RhbXBDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFRpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIgPSBjbGFzcyBfVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGluZGV4VHlwZTogYWxnb3JpdGhtIH0pXG4gICAgKTtcbiAgfVxuICB1bmlxdWUoKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpc1VuaXF1ZTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgcHJpbWFyeUtleSgpIHtcbiAgICByZXR1cm4gbmV3IF9UaW1lRHVyYXRpb25Db2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1RpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIoXG4gICAgICB0aGlzLnR5cGVCdWlsZGVyLFxuICAgICAgc2V0KHRoaXMuY29sdW1uTWV0YWRhdGEsIHsgZGVmYXVsdFZhbHVlOiB2YWx1ZSB9KVxuICAgICk7XG4gIH1cbiAgbmFtZShuYW1lKSB7XG4gICAgcmV0dXJuIG5ldyBfVGltZUR1cmF0aW9uQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBuYW1lIH0pXG4gICAgKTtcbiAgfVxufTtcbnZhciBVdWlkQ29sdW1uQnVpbGRlciA9IGNsYXNzIF9VdWlkQ29sdW1uQnVpbGRlciBleHRlbmRzIENvbHVtbkJ1aWxkZXIge1xuICBpbmRleChhbGdvcml0aG0gPSBcImJ0cmVlXCIpIHtcbiAgICByZXR1cm4gbmV3IF9VdWlkQ29sdW1uQnVpbGRlcihcbiAgICAgIHRoaXMudHlwZUJ1aWxkZXIsXG4gICAgICBzZXQodGhpcy5jb2x1bW5NZXRhZGF0YSwgeyBpbmRleFR5cGU6IGFsZ29yaXRobSB9KVxuICAgICk7XG4gIH1cbiAgdW5pcXVlKCkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzVW5pcXVlOiB0cnVlIH0pXG4gICAgKTtcbiAgfVxuICBwcmltYXJ5S2V5KCkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGlzUHJpbWFyeUtleTogdHJ1ZSB9KVxuICAgICk7XG4gIH1cbiAgZGVmYXVsdCh2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IGRlZmF1bHRWYWx1ZTogdmFsdWUgfSlcbiAgICApO1xuICB9XG4gIG5hbWUobmFtZSkge1xuICAgIHJldHVybiBuZXcgX1V1aWRDb2x1bW5CdWlsZGVyKFxuICAgICAgdGhpcy50eXBlQnVpbGRlcixcbiAgICAgIHNldCh0aGlzLmNvbHVtbk1ldGFkYXRhLCB7IG5hbWUgfSlcbiAgICApO1xuICB9XG59O1xudmFyIFJlZkJ1aWxkZXIgPSBjbGFzcyBleHRlbmRzIFR5cGVCdWlsZGVyIHtcbiAgcmVmO1xuICAvKiogVGhlIHBoYW50b20gdHlwZSBvZiB0aGUgcG9pbnRlZSBvZiB0aGlzIHJlZi4gKi9cbiAgX19zcGFjZXRpbWVUeXBlO1xuICBjb25zdHJ1Y3RvcihyZWYpIHtcbiAgICBzdXBlcihBbGdlYnJhaWNUeXBlLlJlZihyZWYpKTtcbiAgICB0aGlzLnJlZiA9IHJlZjtcbiAgfVxufTtcbnZhciBlbnVtSW1wbCA9ICgobmFtZU9yT2JqLCBtYXliZU9iaikgPT4ge1xuICBsZXQgb2JqID0gbmFtZU9yT2JqO1xuICBsZXQgbmFtZSA9IHZvaWQgMDtcbiAgaWYgKHR5cGVvZiBuYW1lT3JPYmogPT09IFwic3RyaW5nXCIpIHtcbiAgICBpZiAoIW1heWJlT2JqKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBcIldoZW4gcHJvdmlkaW5nIGEgbmFtZSwgeW91IG11c3QgYWxzbyBwcm92aWRlIHRoZSB2YXJpYW50cyBvYmplY3Qgb3IgYXJyYXkuXCJcbiAgICAgICk7XG4gICAgfVxuICAgIG9iaiA9IG1heWJlT2JqO1xuICAgIG5hbWUgPSBuYW1lT3JPYmo7XG4gIH1cbiAgaWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuICAgIGNvbnN0IHNpbXBsZVZhcmlhbnRzT2JqID0ge307XG4gICAgZm9yIChjb25zdCB2YXJpYW50IG9mIG9iaikge1xuICAgICAgc2ltcGxlVmFyaWFudHNPYmpbdmFyaWFudF0gPSBuZXcgVW5pdEJ1aWxkZXIoKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBTaW1wbGVTdW1CdWlsZGVySW1wbChzaW1wbGVWYXJpYW50c09iaiwgbmFtZSk7XG4gIH1cbiAgcmV0dXJuIG5ldyBTdW1CdWlsZGVyKG9iaiwgbmFtZSk7XG59KTtcbnZhciB0ID0ge1xuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgQm9vbGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYGJvb2xlYW5gIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBCb29sQnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGJvb2w6ICgpID0+IG5ldyBCb29sQnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgU3RyaW5nYCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgc3RyaW5nYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgU3RyaW5nQnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHN0cmluZzogKCkgPT4gbmV3IFN0cmluZ0J1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEY2NGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEY2NEJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBudW1iZXI6ICgpID0+IG5ldyBGNjRCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJOGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEk4QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGk4OiAoKSA9PiBuZXcgSThCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBVOGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFU4QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHU4OiAoKSA9PiBuZXcgVThCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJMTZgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBudW1iZXJgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBJMTZCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgaTE2OiAoKSA9PiBuZXcgSTE2QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgVTE2YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgbnVtYmVyYCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVTE2QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHUxNjogKCkgPT4gbmV3IFUxNkJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEkzMmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEkzMkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBpMzI6ICgpID0+IG5ldyBJMzJCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBVMzJgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBudW1iZXJgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBVMzJCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgdTMyOiAoKSA9PiBuZXcgVTMyQnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSTY0YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgSTY0QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIGk2NDogKCkgPT4gbmV3IEk2NEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFU2NGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYGJpZ2ludGAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFU2NEJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICB1NjQ6ICgpID0+IG5ldyBVNjRCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBJMTI4YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgSTEyOEJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBpMTI4OiAoKSA9PiBuZXcgSTEyOEJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFUxMjhgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBiaWdpbnRgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBVMTI4QnVpbGRlcn0gaW5zdGFuY2VcbiAgICovXG4gIHUxMjg6ICgpID0+IG5ldyBVMTI4QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgSTI1NmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYGJpZ2ludGAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEkyNTZCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgaTI1NjogKCkgPT4gbmV3IEkyNTZCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBVMjU2YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9uc1xuICAgKiBSZXByZXNlbnRlZCBhcyBgYmlnaW50YCBpbiBUeXBlU2NyaXB0LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVTI1NkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICB1MjU2OiAoKSA9PiBuZXcgVTI1NkJ1aWxkZXIoKSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEYzMmAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnNcbiAgICogUmVwcmVzZW50ZWQgYXMgYG51bWJlcmAgaW4gVHlwZVNjcmlwdC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIEYzMkJ1aWxkZXJ9IGluc3RhbmNlXG4gICAqL1xuICBmMzI6ICgpID0+IG5ldyBGMzJCdWlsZGVyKCksXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IGBGNjRgIHtAbGluayBBbGdlYnJhaWNUeXBlfSB0byBiZSB1c2VkIGluIHRhYmxlIGRlZmluaXRpb25zXG4gICAqIFJlcHJlc2VudGVkIGFzIGBudW1iZXJgIGluIFR5cGVTY3JpcHQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBGNjRCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgZjY0OiAoKSA9PiBuZXcgRjY0QnVpbGRlcigpLFxuICAvKipcbiAgICogQ3JlYXRlcyBhIG5ldyBgUHJvZHVjdGAge0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnMuIFByb2R1Y3QgdHlwZXMgaW4gU3BhY2V0aW1lREJcbiAgICogYXJlIGVzc2VudGlhbGx5IHRoZSBzYW1lIGFzIG9iamVjdHMgaW4gSmF2YVNjcmlwdC9UeXBlU2NyaXB0LlxuICAgKiBQcm9wZXJ0aWVzIG9mIHRoZSBvYmplY3QgbXVzdCBhbHNvIGJlIHtAbGluayBUeXBlQnVpbGRlcn1zLlxuICAgKiBSZXByZXNlbnRlZCBhcyBhbiBvYmplY3Qgd2l0aCBzcGVjaWZpYyBwcm9wZXJ0aWVzIGluIFR5cGVTY3JpcHQuXG4gICAqXG4gICAqIEBwYXJhbSBuYW1lIChvcHRpb25hbCkgQSBkaXNwbGF5IG5hbWUgZm9yIHRoZSBwcm9kdWN0IHR5cGUuIElmIG9taXR0ZWQsIGFuIGFub255bW91cyBwcm9kdWN0IHR5cGUgaXMgY3JlYXRlZC5cbiAgICogQHBhcmFtIG9iaiBUaGUgb2JqZWN0IGRlZmluaW5nIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSB0eXBlLCB3aG9zZSBwcm9wZXJ0eVxuICAgKiB2YWx1ZXMgbXVzdCBiZSB7QGxpbmsgVHlwZUJ1aWxkZXJ9cy5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFByb2R1Y3RCdWlsZGVyfSBpbnN0YW5jZS5cbiAgICovXG4gIG9iamVjdDogKChuYW1lT3JPYmosIG1heWJlT2JqKSA9PiB7XG4gICAgaWYgKHR5cGVvZiBuYW1lT3JPYmogPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIGlmICghbWF5YmVPYmopIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBcIldoZW4gcHJvdmlkaW5nIGEgbmFtZSwgeW91IG11c3QgYWxzbyBwcm92aWRlIHRoZSBvYmplY3QuXCJcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBuZXcgUHJvZHVjdEJ1aWxkZXIobWF5YmVPYmosIG5hbWVPck9iaik7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUHJvZHVjdEJ1aWxkZXIobmFtZU9yT2JqLCB2b2lkIDApO1xuICB9KSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYFJvd2Age0BsaW5rIEFsZ2VicmFpY1R5cGV9IHRvIGJlIHVzZWQgaW4gdGFibGUgZGVmaW5pdGlvbnMuIFJvdyB0eXBlcyBpbiBTcGFjZXRpbWVEQlxuICAgKiBhcmUgc2ltaWxhciB0byBgUHJvZHVjdGAgdHlwZXMsIGJ1dCBhcmUgc3BlY2lmaWNhbGx5IHVzZWQgdG8gZGVmaW5lIHRoZSBzY2hlbWEgb2YgYSB0YWJsZSByb3cuXG4gICAqIFByb3BlcnRpZXMgb2YgdGhlIG9iamVjdCBtdXN0IGFsc28gYmUge0BsaW5rIFR5cGVCdWlsZGVyfSBvciB7QGxpbmsgQ29sdW1uQnVpbGRlcn1zLlxuICAgKlxuICAgKiBZb3UgY2FuIHJlcHJlc2VudCBhIGBSb3dgIGFzIGVpdGhlciBhIHtAbGluayBSb3dPYmp9IG9yIGFuIHtAbGluayBSb3dCdWlsZGVyfSB0eXBlIHdoZW5cbiAgICogZGVmaW5pbmcgYSB0YWJsZSBzY2hlbWEuXG4gICAqXG4gICAqIFRoZSB7QGxpbmsgUm93QnVpbGRlcn0gdHlwZSBpcyB1c2VmdWwgd2hlbiB5b3Ugd2FudCB0byBjcmVhdGUgYSB0eXBlIHdoaWNoIGNhbiBiZSB1c2VkIGFueXdoZXJlXG4gICAqIGEge0BsaW5rIFR5cGVCdWlsZGVyfSBpcyBhY2NlcHRlZCwgc3VjaCBhcyBpbiBuZXN0ZWQgb2JqZWN0cyBvciBhcnJheXMsIG9yIGFzIHRoZSBhcmd1bWVudFxuICAgKiB0byBhIHNjaGVkdWxlZCBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIG9iaiBUaGUgb2JqZWN0IGRlZmluaW5nIHRoZSBwcm9wZXJ0aWVzIG9mIHRoZSByb3csIHdob3NlIHByb3BlcnR5XG4gICAqIHZhbHVlcyBtdXN0IGJlIHtAbGluayBUeXBlQnVpbGRlcn1zIG9yIHtAbGluayBDb2x1bW5CdWlsZGVyfXMuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBSb3dCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgcm93OiAoKG5hbWVPck9iaiwgbWF5YmVPYmopID0+IHtcbiAgICBjb25zdCBbb2JqLCBuYW1lXSA9IHR5cGVvZiBuYW1lT3JPYmogPT09IFwic3RyaW5nXCIgPyBbbWF5YmVPYmosIG5hbWVPck9ial0gOiBbbmFtZU9yT2JqLCB2b2lkIDBdO1xuICAgIHJldHVybiBuZXcgUm93QnVpbGRlcihvYmosIG5hbWUpO1xuICB9KSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBuZXcgYEFycmF5YCB7QGxpbmsgQWxnZWJyYWljVHlwZX0gdG8gYmUgdXNlZCBpbiB0YWJsZSBkZWZpbml0aW9ucy5cbiAgICogUmVwcmVzZW50ZWQgYXMgYW4gYXJyYXkgaW4gVHlwZVNjcmlwdC5cbiAgICogQHBhcmFtIGVsZW1lbnQgVGhlIGVsZW1lbnQgdHlwZSBvZiB0aGUgYXJyYXksIHdoaWNoIG11c3QgYmUgYSBgVHlwZUJ1aWxkZXJgLlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgQXJyYXlCdWlsZGVyfSBpbnN0YW5jZVxuICAgKi9cbiAgYXJyYXkoZSkge1xuICAgIHJldHVybiBuZXcgQXJyYXlCdWlsZGVyKGUpO1xuICB9LFxuICBlbnVtOiBlbnVtSW1wbCxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBzcGVjaWFsIGhlbHBlciBmdW5jdGlvbiBmb3IgY29udmVuaWVudGx5IGNyZWF0aW5nIGBQcm9kdWN0YCB0eXBlIGNvbHVtbnMgd2l0aCBubyBmaWVsZHMuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBQcm9kdWN0QnVpbGRlcn0gaW5zdGFuY2Ugd2l0aCBubyBmaWVsZHMuXG4gICAqL1xuICB1bml0KCkge1xuICAgIHJldHVybiBuZXcgVW5pdEJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsYXppbHktZXZhbHVhdGVkIHtAbGluayBUeXBlQnVpbGRlcn0uIFRoaXMgaXMgdXNlZnVsIGZvciBjcmVhdGluZ1xuICAgKiByZWN1cnNpdmUgdHlwZXMsIHN1Y2ggYXMgYSB0cmVlIG9yIGxpbmtlZCBsaXN0LlxuICAgKiBAcGFyYW0gdGh1bmsgQSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYSB7QGxpbmsgVHlwZUJ1aWxkZXJ9LlxuICAgKiBAcmV0dXJucyBBIHByb3h5IHtAbGluayBUeXBlQnVpbGRlcn0gdGhhdCBldmFsdWF0ZXMgdGhlIHRodW5rIG9uIGZpcnN0IGFjY2Vzcy5cbiAgICovXG4gIGxhenkodGh1bmspIHtcbiAgICBsZXQgY2FjaGVkID0gbnVsbDtcbiAgICBjb25zdCBnZXQgPSAoKSA9PiBjYWNoZWQgPz89IHRodW5rKCk7XG4gICAgY29uc3QgcHJveHkgPSBuZXcgUHJveHkoe30sIHtcbiAgICAgIGdldChfdCwgcHJvcCwgcmVjdikge1xuICAgICAgICBjb25zdCB0YXJnZXQgPSBnZXQoKTtcbiAgICAgICAgY29uc3QgdmFsID0gUmVmbGVjdC5nZXQodGFyZ2V0LCBwcm9wLCByZWN2KTtcbiAgICAgICAgcmV0dXJuIHR5cGVvZiB2YWwgPT09IFwiZnVuY3Rpb25cIiA/IHZhbC5iaW5kKHRhcmdldCkgOiB2YWw7XG4gICAgICB9LFxuICAgICAgc2V0KF90LCBwcm9wLCB2YWx1ZSwgcmVjdikge1xuICAgICAgICByZXR1cm4gUmVmbGVjdC5zZXQoZ2V0KCksIHByb3AsIHZhbHVlLCByZWN2KTtcbiAgICAgIH0sXG4gICAgICBoYXMoX3QsIHByb3ApIHtcbiAgICAgICAgcmV0dXJuIHByb3AgaW4gZ2V0KCk7XG4gICAgICB9LFxuICAgICAgb3duS2V5cygpIHtcbiAgICAgICAgcmV0dXJuIFJlZmxlY3Qub3duS2V5cyhnZXQoKSk7XG4gICAgICB9LFxuICAgICAgZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKF90LCBwcm9wKSB7XG4gICAgICAgIHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKGdldCgpLCBwcm9wKTtcbiAgICAgIH0sXG4gICAgICBnZXRQcm90b3R5cGVPZigpIHtcbiAgICAgICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZihnZXQoKSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIHByb3h5O1xuICB9LFxuICAvKipcbiAgICogVGhpcyBpcyBhIHNwZWNpYWwgaGVscGVyIGZ1bmN0aW9uIGZvciBjb252ZW5pZW50bHkgY3JlYXRpbmcge0BsaW5rIFNjaGVkdWxlQXR9IHR5cGUgY29sdW1ucy5cbiAgICogQHJldHVybnMgQSBuZXcgQ29sdW1uQnVpbGRlciBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgU2NoZWR1bGVBdH0gdHlwZS5cbiAgICovXG4gIHNjaGVkdWxlQXQ6ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IFNjaGVkdWxlQXRCdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgT3B0aW9ufSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBlbnVtIHdpdGggYSBgc29tZWAgYW5kIGBub25lYCB2YXJpYW50LlxuICAgKiBAcGFyYW0gdmFsdWUgVGhlIHR5cGUgb2YgdGhlIHZhbHVlIGNvbnRhaW5lZCBpbiB0aGUgYHNvbWVgIHZhcmlhbnQgb2YgdGhlIGBPcHRpb25gLlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgT3B0aW9uQnVpbGRlcn0gaW5zdGFuY2Ugd2l0aCB0aGUge0BsaW5rIE9wdGlvbn0gdHlwZS5cbiAgICovXG4gIG9wdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiBuZXcgT3B0aW9uQnVpbGRlcih2YWx1ZSk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgUmVzdWx0fSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBlbnVtIHdpdGggYW4gYG9rYCBhbmQgYGVycmAgdmFyaWFudC5cbiAgICogQHBhcmFtIG9rIFRoZSB0eXBlIG9mIHRoZSB2YWx1ZSBjb250YWluZWQgaW4gdGhlIGBva2AgdmFyaWFudCBvZiB0aGUgYFJlc3VsdGAuXG4gICAqIEBwYXJhbSBlcnIgVGhlIHR5cGUgb2YgdGhlIHZhbHVlIGNvbnRhaW5lZCBpbiB0aGUgYGVycmAgdmFyaWFudCBvZiB0aGUgYFJlc3VsdGAuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBSZXN1bHRCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgUmVzdWx0fSB0eXBlLlxuICAgKi9cbiAgcmVzdWx0KG9rLCBlcnIpIHtcbiAgICByZXR1cm4gbmV3IFJlc3VsdEJ1aWxkZXIob2ssIGVycik7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgSWRlbnRpdHl9IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGBvYmplY3RgIHdpdGggYSBzaW5nbGUgYF9faWRlbnRpdHlfX2AgZWxlbWVudC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFR5cGVCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgSWRlbnRpdHl9IHR5cGUuXG4gICAqL1xuICBpZGVudGl0eTogKCkgPT4ge1xuICAgIHJldHVybiBuZXcgSWRlbnRpdHlCdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgQ29ubmVjdGlvbklkfSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBgb2JqZWN0YCB3aXRoIGEgc2luZ2xlIGBfX2Nvbm5lY3Rpb25faWRfX2AgZWxlbWVudC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFR5cGVCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgQ29ubmVjdGlvbklkfSB0eXBlLlxuICAgKi9cbiAgY29ubmVjdGlvbklkOiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBDb25uZWN0aW9uSWRCdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgVGltZXN0YW1wfSB0eXBlLlxuICAgKiBZb3UgY2FuIGNyZWF0ZSBhIGNvbHVtbiBvZiB0aGUgc2FtZSB0eXBlIGJ5IGNvbnN0cnVjdGluZyBhbiBgb2JqZWN0YCB3aXRoIGEgc2luZ2xlIGBfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fYCBlbGVtZW50LlxuICAgKiBAcmV0dXJucyBBIG5ldyB7QGxpbmsgVHlwZUJ1aWxkZXJ9IGluc3RhbmNlIHdpdGggdGhlIHtAbGluayBUaW1lc3RhbXB9IHR5cGUuXG4gICAqL1xuICB0aW1lc3RhbXA6ICgpID0+IHtcbiAgICByZXR1cm4gbmV3IFRpbWVzdGFtcEJ1aWxkZXIoKTtcbiAgfSxcbiAgLyoqXG4gICAqIFRoaXMgaXMgYSBjb252ZW5pZW5jZSBtZXRob2QgZm9yIGNyZWF0aW5nIGEgY29sdW1uIHdpdGggdGhlIHtAbGluayBUaW1lRHVyYXRpb259IHR5cGUuXG4gICAqIFlvdSBjYW4gY3JlYXRlIGEgY29sdW1uIG9mIHRoZSBzYW1lIHR5cGUgYnkgY29uc3RydWN0aW5nIGFuIGBvYmplY3RgIHdpdGggYSBzaW5nbGUgYF9fdGltZV9kdXJhdGlvbl9taWNyb3NfX2AgZWxlbWVudC5cbiAgICogQHJldHVybnMgQSBuZXcge0BsaW5rIFR5cGVCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSB7QGxpbmsgVGltZUR1cmF0aW9ufSB0eXBlLlxuICAgKi9cbiAgdGltZUR1cmF0aW9uOiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBUaW1lRHVyYXRpb25CdWlsZGVyKCk7XG4gIH0sXG4gIC8qKlxuICAgKiBUaGlzIGlzIGEgY29udmVuaWVuY2UgbWV0aG9kIGZvciBjcmVhdGluZyBhIGNvbHVtbiB3aXRoIHRoZSB7QGxpbmsgVXVpZH0gdHlwZS5cbiAgICogWW91IGNhbiBjcmVhdGUgYSBjb2x1bW4gb2YgdGhlIHNhbWUgdHlwZSBieSBjb25zdHJ1Y3RpbmcgYW4gYG9iamVjdGAgd2l0aCBhIHNpbmdsZSBgX191dWlkX19gIGVsZW1lbnQuXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBUeXBlQnVpbGRlcn0gaW5zdGFuY2Ugd2l0aCB0aGUge0BsaW5rIFV1aWR9IHR5cGUuXG4gICAqL1xuICB1dWlkOiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBVdWlkQnVpbGRlcigpO1xuICB9LFxuICAvKipcbiAgICogVGhpcyBpcyBhIGNvbnZlbmllbmNlIG1ldGhvZCBmb3IgY3JlYXRpbmcgYSBjb2x1bW4gd2l0aCB0aGUgYEJ5dGVBcnJheWAgdHlwZS5cbiAgICogWW91IGNhbiBjcmVhdGUgYSBjb2x1bW4gb2YgdGhlIHNhbWUgdHlwZSBieSBjb25zdHJ1Y3RpbmcgYW4gYGFycmF5YCBvZiBgdThgLlxuICAgKiBUaGUgVHlwZVNjcmlwdCByZXByZXNlbnRhdGlvbiBpcyB7QGxpbmsgVWludDhBcnJheX0uXG4gICAqIEByZXR1cm5zIEEgbmV3IHtAbGluayBCeXRlQXJyYXlCdWlsZGVyfSBpbnN0YW5jZSB3aXRoIHRoZSBgQnl0ZUFycmF5YCB0eXBlLlxuICAgKi9cbiAgYnl0ZUFycmF5OiAoKSA9PiB7XG4gICAgcmV0dXJuIG5ldyBCeXRlQXJyYXlCdWlsZGVyKCk7XG4gIH1cbn07XG5cbi8vIHNyYy9saWIvYXV0b2dlbi90eXBlcy50c1xudmFyIEFsZ2VicmFpY1R5cGUyID0gdC5lbnVtKFwiQWxnZWJyYWljVHlwZVwiLCB7XG4gIFJlZjogdC51MzIoKSxcbiAgZ2V0IFN1bSgpIHtcbiAgICByZXR1cm4gU3VtVHlwZTI7XG4gIH0sXG4gIGdldCBQcm9kdWN0KCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCBBcnJheSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH0sXG4gIFN0cmluZzogdC51bml0KCksXG4gIEJvb2w6IHQudW5pdCgpLFxuICBJODogdC51bml0KCksXG4gIFU4OiB0LnVuaXQoKSxcbiAgSTE2OiB0LnVuaXQoKSxcbiAgVTE2OiB0LnVuaXQoKSxcbiAgSTMyOiB0LnVuaXQoKSxcbiAgVTMyOiB0LnVuaXQoKSxcbiAgSTY0OiB0LnVuaXQoKSxcbiAgVTY0OiB0LnVuaXQoKSxcbiAgSTEyODogdC51bml0KCksXG4gIFUxMjg6IHQudW5pdCgpLFxuICBJMjU2OiB0LnVuaXQoKSxcbiAgVTI1NjogdC51bml0KCksXG4gIEYzMjogdC51bml0KCksXG4gIEY2NDogdC51bml0KClcbn0pO1xudmFyIENhc2VDb252ZXJzaW9uUG9saWN5ID0gdC5lbnVtKFwiQ2FzZUNvbnZlcnNpb25Qb2xpY3lcIiwge1xuICBOb25lOiB0LnVuaXQoKSxcbiAgU25ha2VDYXNlOiB0LnVuaXQoKVxufSk7XG52YXIgRXhwbGljaXROYW1lRW50cnkgPSB0LmVudW0oXCJFeHBsaWNpdE5hbWVFbnRyeVwiLCB7XG4gIGdldCBUYWJsZSgpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBGdW5jdGlvbigpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH0sXG4gIGdldCBJbmRleCgpIHtcbiAgICByZXR1cm4gTmFtZU1hcHBpbmc7XG4gIH1cbn0pO1xudmFyIEV4cGxpY2l0TmFtZXMgPSB0Lm9iamVjdChcIkV4cGxpY2l0TmFtZXNcIiwge1xuICBnZXQgZW50cmllcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShFeHBsaWNpdE5hbWVFbnRyeSk7XG4gIH1cbn0pO1xudmFyIEZ1bmN0aW9uVmlzaWJpbGl0eSA9IHQuZW51bShcIkZ1bmN0aW9uVmlzaWJpbGl0eVwiLCB7XG4gIFByaXZhdGU6IHQudW5pdCgpLFxuICBDbGllbnRDYWxsYWJsZTogdC51bml0KClcbn0pO1xudmFyIEh0dHBIZWFkZXJQYWlyID0gdC5vYmplY3QoXCJIdHRwSGVhZGVyUGFpclwiLCB7XG4gIG5hbWU6IHQuc3RyaW5nKCksXG4gIHZhbHVlOiB0LmJ5dGVBcnJheSgpXG59KTtcbnZhciBIdHRwSGVhZGVycyA9IHQub2JqZWN0KFwiSHR0cEhlYWRlcnNcIiwge1xuICBnZXQgZW50cmllcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShIdHRwSGVhZGVyUGFpcik7XG4gIH1cbn0pO1xudmFyIEh0dHBNZXRob2QgPSB0LmVudW0oXCJIdHRwTWV0aG9kXCIsIHtcbiAgR2V0OiB0LnVuaXQoKSxcbiAgSGVhZDogdC51bml0KCksXG4gIFBvc3Q6IHQudW5pdCgpLFxuICBQdXQ6IHQudW5pdCgpLFxuICBEZWxldGU6IHQudW5pdCgpLFxuICBDb25uZWN0OiB0LnVuaXQoKSxcbiAgT3B0aW9uczogdC51bml0KCksXG4gIFRyYWNlOiB0LnVuaXQoKSxcbiAgUGF0Y2g6IHQudW5pdCgpLFxuICBFeHRlbnNpb246IHQuc3RyaW5nKClcbn0pO1xudmFyIEh0dHBSZXF1ZXN0ID0gdC5vYmplY3QoXCJIdHRwUmVxdWVzdFwiLCB7XG4gIGdldCBtZXRob2QoKSB7XG4gICAgcmV0dXJuIEh0dHBNZXRob2Q7XG4gIH0sXG4gIGdldCBoZWFkZXJzKCkge1xuICAgIHJldHVybiBIdHRwSGVhZGVycztcbiAgfSxcbiAgdGltZW91dDogdC5vcHRpb24odC50aW1lRHVyYXRpb24oKSksXG4gIHVyaTogdC5zdHJpbmcoKSxcbiAgZ2V0IHZlcnNpb24oKSB7XG4gICAgcmV0dXJuIEh0dHBWZXJzaW9uO1xuICB9XG59KTtcbnZhciBIdHRwUmVzcG9uc2UgPSB0Lm9iamVjdChcIkh0dHBSZXNwb25zZVwiLCB7XG4gIGdldCBoZWFkZXJzKCkge1xuICAgIHJldHVybiBIdHRwSGVhZGVycztcbiAgfSxcbiAgZ2V0IHZlcnNpb24oKSB7XG4gICAgcmV0dXJuIEh0dHBWZXJzaW9uO1xuICB9LFxuICBjb2RlOiB0LnUxNigpXG59KTtcbnZhciBIdHRwVmVyc2lvbiA9IHQuZW51bShcIkh0dHBWZXJzaW9uXCIsIHtcbiAgSHR0cDA5OiB0LnVuaXQoKSxcbiAgSHR0cDEwOiB0LnVuaXQoKSxcbiAgSHR0cDExOiB0LnVuaXQoKSxcbiAgSHR0cDI6IHQudW5pdCgpLFxuICBIdHRwMzogdC51bml0KClcbn0pO1xudmFyIEluZGV4VHlwZSA9IHQuZW51bShcIkluZGV4VHlwZVwiLCB7XG4gIEJUcmVlOiB0LnVuaXQoKSxcbiAgSGFzaDogdC51bml0KClcbn0pO1xudmFyIExpZmVjeWNsZSA9IHQuZW51bShcIkxpZmVjeWNsZVwiLCB7XG4gIEluaXQ6IHQudW5pdCgpLFxuICBPbkNvbm5lY3Q6IHQudW5pdCgpLFxuICBPbkRpc2Nvbm5lY3Q6IHQudW5pdCgpXG59KTtcbnZhciBNZXRob2RPckFueSA9IHQuZW51bShcIk1ldGhvZE9yQW55XCIsIHtcbiAgQW55OiB0LnVuaXQoKSxcbiAgZ2V0IE1ldGhvZCgpIHtcbiAgICByZXR1cm4gSHR0cE1ldGhvZDtcbiAgfVxufSk7XG52YXIgTWlzY01vZHVsZUV4cG9ydCA9IHQuZW51bShcIk1pc2NNb2R1bGVFeHBvcnRcIiwge1xuICBnZXQgVHlwZUFsaWFzKCkge1xuICAgIHJldHVybiBUeXBlQWxpYXM7XG4gIH1cbn0pO1xudmFyIE5hbWVNYXBwaW5nID0gdC5vYmplY3QoXCJOYW1lTWFwcGluZ1wiLCB7XG4gIHNvdXJjZU5hbWU6IHQuc3RyaW5nKCksXG4gIGNhbm9uaWNhbE5hbWU6IHQuc3RyaW5nKClcbn0pO1xudmFyIFByb2R1Y3RUeXBlMiA9IHQub2JqZWN0KFwiUHJvZHVjdFR5cGVcIiwge1xuICBnZXQgZWxlbWVudHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUHJvZHVjdFR5cGVFbGVtZW50KTtcbiAgfVxufSk7XG52YXIgUHJvZHVjdFR5cGVFbGVtZW50ID0gdC5vYmplY3QoXCJQcm9kdWN0VHlwZUVsZW1lbnRcIiwge1xuICBuYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgZ2V0IGFsZ2VicmFpY1R5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9XG59KTtcbnZhciBSYXdDb2x1bW5EZWZWOCA9IHQub2JqZWN0KFwiUmF3Q29sdW1uRGVmVjhcIiwge1xuICBjb2xOYW1lOiB0LnN0cmluZygpLFxuICBnZXQgY29sVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd0NvbHVtbkRlZmF1bHRWYWx1ZVYxMCA9IHQub2JqZWN0KFwiUmF3Q29sdW1uRGVmYXVsdFZhbHVlVjEwXCIsIHtcbiAgY29sSWQ6IHQudTE2KCksXG4gIHZhbHVlOiB0LmJ5dGVBcnJheSgpXG59KTtcbnZhciBSYXdDb2x1bW5EZWZhdWx0VmFsdWVWOSA9IHQub2JqZWN0KFwiUmF3Q29sdW1uRGVmYXVsdFZhbHVlVjlcIiwge1xuICB0YWJsZTogdC5zdHJpbmcoKSxcbiAgY29sSWQ6IHQudTE2KCksXG4gIHZhbHVlOiB0LmJ5dGVBcnJheSgpXG59KTtcbnZhciBSYXdDb25zdHJhaW50RGF0YVY5ID0gdC5lbnVtKFwiUmF3Q29uc3RyYWludERhdGFWOVwiLCB7XG4gIGdldCBVbmlxdWUoKSB7XG4gICAgcmV0dXJuIFJhd1VuaXF1ZUNvbnN0cmFpbnREYXRhVjk7XG4gIH1cbn0pO1xudmFyIFJhd0NvbnN0cmFpbnREZWZWMTAgPSB0Lm9iamVjdChcIlJhd0NvbnN0cmFpbnREZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgZ2V0IGRhdGEoKSB7XG4gICAgcmV0dXJuIFJhd0NvbnN0cmFpbnREYXRhVjk7XG4gIH1cbn0pO1xudmFyIFJhd0NvbnN0cmFpbnREZWZWOCA9IHQub2JqZWN0KFwiUmF3Q29uc3RyYWludERlZlY4XCIsIHtcbiAgY29uc3RyYWludE5hbWU6IHQuc3RyaW5nKCksXG4gIGNvbnN0cmFpbnRzOiB0LnU4KCksXG4gIGNvbHVtbnM6IHQuYXJyYXkodC51MTYoKSlcbn0pO1xudmFyIFJhd0NvbnN0cmFpbnREZWZWOSA9IHQub2JqZWN0KFwiUmF3Q29uc3RyYWludERlZlY5XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBkYXRhKCkge1xuICAgIHJldHVybiBSYXdDb25zdHJhaW50RGF0YVY5O1xuICB9XG59KTtcbnZhciBSYXdIdHRwSGFuZGxlckRlZlYxMCA9IHQub2JqZWN0KFwiUmF3SHR0cEhhbmRsZXJEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpXG59KTtcbnZhciBSYXdIdHRwUm91dGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd0h0dHBSb3V0ZURlZlYxMFwiLCB7XG4gIGhhbmRsZXJGdW5jdGlvbjogdC5zdHJpbmcoKSxcbiAgZ2V0IG1ldGhvZCgpIHtcbiAgICByZXR1cm4gTWV0aG9kT3JBbnk7XG4gIH0sXG4gIHBhdGg6IHQuc3RyaW5nKClcbn0pO1xudmFyIFJhd0luZGV4QWxnb3JpdGhtID0gdC5lbnVtKFwiUmF3SW5kZXhBbGdvcml0aG1cIiwge1xuICBCVHJlZTogdC5hcnJheSh0LnUxNigpKSxcbiAgSGFzaDogdC5hcnJheSh0LnUxNigpKSxcbiAgRGlyZWN0OiB0LnUxNigpXG59KTtcbnZhciBSYXdJbmRleERlZlYxMCA9IHQub2JqZWN0KFwiUmF3SW5kZXhEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgYWNjZXNzb3JOYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgZ2V0IGFsZ29yaXRobSgpIHtcbiAgICByZXR1cm4gUmF3SW5kZXhBbGdvcml0aG07XG4gIH1cbn0pO1xudmFyIFJhd0luZGV4RGVmVjggPSB0Lm9iamVjdChcIlJhd0luZGV4RGVmVjhcIiwge1xuICBpbmRleE5hbWU6IHQuc3RyaW5nKCksXG4gIGlzVW5pcXVlOiB0LmJvb2woKSxcbiAgZ2V0IGluZGV4VHlwZSgpIHtcbiAgICByZXR1cm4gSW5kZXhUeXBlO1xuICB9LFxuICBjb2x1bW5zOiB0LmFycmF5KHQudTE2KCkpXG59KTtcbnZhciBSYXdJbmRleERlZlY5ID0gdC5vYmplY3QoXCJSYXdJbmRleERlZlY5XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGFjY2Vzc29yTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGdldCBhbGdvcml0aG0oKSB7XG4gICAgcmV0dXJuIFJhd0luZGV4QWxnb3JpdGhtO1xuICB9XG59KTtcbnZhciBSYXdMaWZlQ3ljbGVSZWR1Y2VyRGVmVjEwID0gdC5vYmplY3QoXG4gIFwiUmF3TGlmZUN5Y2xlUmVkdWNlckRlZlYxMFwiLFxuICB7XG4gICAgZ2V0IGxpZmVjeWNsZVNwZWMoKSB7XG4gICAgICByZXR1cm4gTGlmZWN5Y2xlO1xuICAgIH0sXG4gICAgZnVuY3Rpb25OYW1lOiB0LnN0cmluZygpXG4gIH1cbik7XG52YXIgUmF3TWlzY01vZHVsZUV4cG9ydFY5ID0gdC5lbnVtKFwiUmF3TWlzY01vZHVsZUV4cG9ydFY5XCIsIHtcbiAgZ2V0IENvbHVtbkRlZmF1bHRWYWx1ZSgpIHtcbiAgICByZXR1cm4gUmF3Q29sdW1uRGVmYXVsdFZhbHVlVjk7XG4gIH0sXG4gIGdldCBQcm9jZWR1cmUoKSB7XG4gICAgcmV0dXJuIFJhd1Byb2NlZHVyZURlZlY5O1xuICB9LFxuICBnZXQgVmlldygpIHtcbiAgICByZXR1cm4gUmF3Vmlld0RlZlY5O1xuICB9XG59KTtcbnZhciBSYXdNb2R1bGVEZWYgPSB0LmVudW0oXCJSYXdNb2R1bGVEZWZcIiwge1xuICBnZXQgVjhCYWNrQ29tcGF0KCkge1xuICAgIHJldHVybiBSYXdNb2R1bGVEZWZWODtcbiAgfSxcbiAgZ2V0IFY5KCkge1xuICAgIHJldHVybiBSYXdNb2R1bGVEZWZWOTtcbiAgfSxcbiAgZ2V0IFYxMCgpIHtcbiAgICByZXR1cm4gUmF3TW9kdWxlRGVmVjEwO1xuICB9XG59KTtcbnZhciBSYXdNb2R1bGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd01vZHVsZURlZlYxMFwiLCB7XG4gIGdldCBzZWN0aW9ucygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdNb2R1bGVEZWZWMTBTZWN0aW9uKTtcbiAgfVxufSk7XG52YXIgUmF3TW9kdWxlRGVmVjEwU2VjdGlvbiA9IHQuZW51bShcIlJhd01vZHVsZURlZlYxMFNlY3Rpb25cIiwge1xuICBnZXQgVHlwZXNwYWNlKCkge1xuICAgIHJldHVybiBUeXBlc3BhY2U7XG4gIH0sXG4gIGdldCBUeXBlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUeXBlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFRhYmxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUYWJsZURlZlYxMCk7XG4gIH0sXG4gIGdldCBSZWR1Y2VycygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdSZWR1Y2VyRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFByb2NlZHVyZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3UHJvY2VkdXJlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IFZpZXdzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1ZpZXdEZWZWMTApO1xuICB9LFxuICBnZXQgU2NoZWR1bGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1NjaGVkdWxlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IExpZmVDeWNsZVJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0xpZmVDeWNsZVJlZHVjZXJEZWZWMTApO1xuICB9LFxuICBnZXQgUm93TGV2ZWxTZWN1cml0eSgpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdSb3dMZXZlbFNlY3VyaXR5RGVmVjkpO1xuICB9LFxuICBnZXQgQ2FzZUNvbnZlcnNpb25Qb2xpY3koKSB7XG4gICAgcmV0dXJuIENhc2VDb252ZXJzaW9uUG9saWN5O1xuICB9LFxuICBnZXQgRXhwbGljaXROYW1lcygpIHtcbiAgICByZXR1cm4gRXhwbGljaXROYW1lcztcbiAgfSxcbiAgZ2V0IEh0dHBIYW5kbGVycygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdIdHRwSGFuZGxlckRlZlYxMCk7XG4gIH0sXG4gIGdldCBIdHRwUm91dGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0h0dHBSb3V0ZURlZlYxMCk7XG4gIH0sXG4gIGdldCBWaWV3UHJpbWFyeUtleXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Vmlld1ByaW1hcnlLZXlEZWZWMTApO1xuICB9LFxuICBnZXQgU3VibW9kdWxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdTdWJtb2R1bGVWMTApO1xuICB9XG59KTtcbnZhciBSYXdNb2R1bGVEZWZWOCA9IHQub2JqZWN0KFwiUmF3TW9kdWxlRGVmVjhcIiwge1xuICBnZXQgdHlwZXNwYWNlKCkge1xuICAgIHJldHVybiBUeXBlc3BhY2U7XG4gIH0sXG4gIGdldCB0YWJsZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoVGFibGVEZXNjKTtcbiAgfSxcbiAgZ2V0IHJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJlZHVjZXJEZWYpO1xuICB9LFxuICBnZXQgbWlzY0V4cG9ydHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoTWlzY01vZHVsZUV4cG9ydCk7XG4gIH1cbn0pO1xudmFyIFJhd01vZHVsZURlZlY5ID0gdC5vYmplY3QoXCJSYXdNb2R1bGVEZWZWOVwiLCB7XG4gIGdldCB0eXBlc3BhY2UoKSB7XG4gICAgcmV0dXJuIFR5cGVzcGFjZTtcbiAgfSxcbiAgZ2V0IHRhYmxlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUYWJsZURlZlY5KTtcbiAgfSxcbiAgZ2V0IHJlZHVjZXJzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1JlZHVjZXJEZWZWOSk7XG4gIH0sXG4gIGdldCB0eXBlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdUeXBlRGVmVjkpO1xuICB9LFxuICBnZXQgbWlzY0V4cG9ydHMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3TWlzY01vZHVsZUV4cG9ydFY5KTtcbiAgfSxcbiAgZ2V0IHJvd0xldmVsU2VjdXJpdHkoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Um93TGV2ZWxTZWN1cml0eURlZlY5KTtcbiAgfVxufSk7XG52YXIgUmF3UHJvY2VkdXJlRGVmVjEwID0gdC5vYmplY3QoXCJSYXdQcm9jZWR1cmVEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBnZXQgcGFyYW1zKCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCByZXR1cm5UeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlMjtcbiAgfSxcbiAgZ2V0IHZpc2liaWxpdHkoKSB7XG4gICAgcmV0dXJuIEZ1bmN0aW9uVmlzaWJpbGl0eTtcbiAgfVxufSk7XG52YXIgUmF3UHJvY2VkdXJlRGVmVjkgPSB0Lm9iamVjdChcIlJhd1Byb2NlZHVyZURlZlY5XCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgcmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd1JlZHVjZXJEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1JlZHVjZXJEZWZWMTBcIiwge1xuICBzb3VyY2VOYW1lOiB0LnN0cmluZygpLFxuICBnZXQgcGFyYW1zKCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCB2aXNpYmlsaXR5KCkge1xuICAgIHJldHVybiBGdW5jdGlvblZpc2liaWxpdHk7XG4gIH0sXG4gIGdldCBva1JldHVyblR5cGUoKSB7XG4gICAgcmV0dXJuIEFsZ2VicmFpY1R5cGUyO1xuICB9LFxuICBnZXQgZXJyUmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd1JlZHVjZXJEZWZWOSA9IHQub2JqZWN0KFwiUmF3UmVkdWNlckRlZlY5XCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgbGlmZWN5Y2xlKCkge1xuICAgIHJldHVybiB0Lm9wdGlvbihMaWZlY3ljbGUpO1xuICB9XG59KTtcbnZhciBSYXdSb3dMZXZlbFNlY3VyaXR5RGVmVjkgPSB0Lm9iamVjdChcIlJhd1Jvd0xldmVsU2VjdXJpdHlEZWZWOVwiLCB7XG4gIHNxbDogdC5zdHJpbmcoKVxufSk7XG52YXIgUmF3U2NoZWR1bGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1NjaGVkdWxlRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIHRhYmxlTmFtZTogdC5zdHJpbmcoKSxcbiAgc2NoZWR1bGVBdENvbDogdC51MTYoKSxcbiAgZnVuY3Rpb25OYW1lOiB0LnN0cmluZygpXG59KTtcbnZhciBSYXdTY2hlZHVsZURlZlY5ID0gdC5vYmplY3QoXCJSYXdTY2hlZHVsZURlZlY5XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIHJlZHVjZXJOYW1lOiB0LnN0cmluZygpLFxuICBzY2hlZHVsZWRBdENvbHVtbjogdC51MTYoKVxufSk7XG52YXIgUmF3U2NvcGVkVHlwZU5hbWVWMTAgPSB0Lm9iamVjdChcIlJhd1Njb3BlZFR5cGVOYW1lVjEwXCIsIHtcbiAgc2NvcGU6IHQuYXJyYXkodC5zdHJpbmcoKSksXG4gIHNvdXJjZU5hbWU6IHQuc3RyaW5nKClcbn0pO1xudmFyIFJhd1Njb3BlZFR5cGVOYW1lVjkgPSB0Lm9iamVjdChcIlJhd1Njb3BlZFR5cGVOYW1lVjlcIiwge1xuICBzY29wZTogdC5hcnJheSh0LnN0cmluZygpKSxcbiAgbmFtZTogdC5zdHJpbmcoKVxufSk7XG52YXIgUmF3U2VxdWVuY2VEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1NlcXVlbmNlRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGNvbHVtbjogdC51MTYoKSxcbiAgc3RhcnQ6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWluVmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWF4VmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgaW5jcmVtZW50OiB0LmkxMjgoKVxufSk7XG52YXIgUmF3U2VxdWVuY2VEZWZWOCA9IHQub2JqZWN0KFwiUmF3U2VxdWVuY2VEZWZWOFwiLCB7XG4gIHNlcXVlbmNlTmFtZTogdC5zdHJpbmcoKSxcbiAgY29sUG9zOiB0LnUxNigpLFxuICBpbmNyZW1lbnQ6IHQuaTEyOCgpLFxuICBzdGFydDogdC5vcHRpb24odC5pMTI4KCkpLFxuICBtaW5WYWx1ZTogdC5vcHRpb24odC5pMTI4KCkpLFxuICBtYXhWYWx1ZTogdC5vcHRpb24odC5pMTI4KCkpLFxuICBhbGxvY2F0ZWQ6IHQuaTEyOCgpXG59KTtcbnZhciBSYXdTZXF1ZW5jZURlZlY5ID0gdC5vYmplY3QoXCJSYXdTZXF1ZW5jZURlZlY5XCIsIHtcbiAgbmFtZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIGNvbHVtbjogdC51MTYoKSxcbiAgc3RhcnQ6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWluVmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgbWF4VmFsdWU6IHQub3B0aW9uKHQuaTEyOCgpKSxcbiAgaW5jcmVtZW50OiB0LmkxMjgoKVxufSk7XG52YXIgUmF3U3VibW9kdWxlVjEwID0gdC5vYmplY3QoXCJSYXdTdWJtb2R1bGVWMTBcIiwge1xuICBuYW1lc3BhY2U6IHQuc3RyaW5nKCksXG4gIGdldCBtb2R1bGUoKSB7XG4gICAgcmV0dXJuIFJhd01vZHVsZURlZlYxMDtcbiAgfVxufSk7XG52YXIgUmF3VGFibGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1RhYmxlRGVmVjEwXCIsIHtcbiAgc291cmNlTmFtZTogdC5zdHJpbmcoKSxcbiAgcHJvZHVjdFR5cGVSZWY6IHQudTMyKCksXG4gIHByaW1hcnlLZXk6IHQuYXJyYXkodC51MTYoKSksXG4gIGdldCBpbmRleGVzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0luZGV4RGVmVjEwKTtcbiAgfSxcbiAgZ2V0IGNvbnN0cmFpbnRzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0NvbnN0cmFpbnREZWZWMTApO1xuICB9LFxuICBnZXQgc2VxdWVuY2VzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1NlcXVlbmNlRGVmVjEwKTtcbiAgfSxcbiAgZ2V0IHRhYmxlVHlwZSgpIHtcbiAgICByZXR1cm4gVGFibGVUeXBlO1xuICB9LFxuICBnZXQgdGFibGVBY2Nlc3MoKSB7XG4gICAgcmV0dXJuIFRhYmxlQWNjZXNzO1xuICB9LFxuICBnZXQgZGVmYXVsdFZhbHVlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdDb2x1bW5EZWZhdWx0VmFsdWVWMTApO1xuICB9LFxuICBpc0V2ZW50OiB0LmJvb2woKVxufSk7XG52YXIgUmF3VGFibGVEZWZWOCA9IHQub2JqZWN0KFwiUmF3VGFibGVEZWZWOFwiLCB7XG4gIHRhYmxlTmFtZTogdC5zdHJpbmcoKSxcbiAgZ2V0IGNvbHVtbnMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3Q29sdW1uRGVmVjgpO1xuICB9LFxuICBnZXQgaW5kZXhlcygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdJbmRleERlZlY4KTtcbiAgfSxcbiAgZ2V0IGNvbnN0cmFpbnRzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd0NvbnN0cmFpbnREZWZWOCk7XG4gIH0sXG4gIGdldCBzZXF1ZW5jZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3U2VxdWVuY2VEZWZWOCk7XG4gIH0sXG4gIHRhYmxlVHlwZTogdC5zdHJpbmcoKSxcbiAgdGFibGVBY2Nlc3M6IHQuc3RyaW5nKCksXG4gIHNjaGVkdWxlZDogdC5vcHRpb24odC5zdHJpbmcoKSlcbn0pO1xudmFyIFJhd1RhYmxlRGVmVjkgPSB0Lm9iamVjdChcIlJhd1RhYmxlRGVmVjlcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICBwcm9kdWN0VHlwZVJlZjogdC51MzIoKSxcbiAgcHJpbWFyeUtleTogdC5hcnJheSh0LnUxNigpKSxcbiAgZ2V0IGluZGV4ZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoUmF3SW5kZXhEZWZWOSk7XG4gIH0sXG4gIGdldCBjb25zdHJhaW50cygpIHtcbiAgICByZXR1cm4gdC5hcnJheShSYXdDb25zdHJhaW50RGVmVjkpO1xuICB9LFxuICBnZXQgc2VxdWVuY2VzKCkge1xuICAgIHJldHVybiB0LmFycmF5KFJhd1NlcXVlbmNlRGVmVjkpO1xuICB9LFxuICBnZXQgc2NoZWR1bGUoKSB7XG4gICAgcmV0dXJuIHQub3B0aW9uKFJhd1NjaGVkdWxlRGVmVjkpO1xuICB9LFxuICBnZXQgdGFibGVUeXBlKCkge1xuICAgIHJldHVybiBUYWJsZVR5cGU7XG4gIH0sXG4gIGdldCB0YWJsZUFjY2VzcygpIHtcbiAgICByZXR1cm4gVGFibGVBY2Nlc3M7XG4gIH1cbn0pO1xudmFyIFJhd1R5cGVEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1R5cGVEZWZWMTBcIiwge1xuICBnZXQgc291cmNlTmFtZSgpIHtcbiAgICByZXR1cm4gUmF3U2NvcGVkVHlwZU5hbWVWMTA7XG4gIH0sXG4gIHR5OiB0LnUzMigpLFxuICBjdXN0b21PcmRlcmluZzogdC5ib29sKClcbn0pO1xudmFyIFJhd1R5cGVEZWZWOSA9IHQub2JqZWN0KFwiUmF3VHlwZURlZlY5XCIsIHtcbiAgZ2V0IG5hbWUoKSB7XG4gICAgcmV0dXJuIFJhd1Njb3BlZFR5cGVOYW1lVjk7XG4gIH0sXG4gIHR5OiB0LnUzMigpLFxuICBjdXN0b21PcmRlcmluZzogdC5ib29sKClcbn0pO1xudmFyIFJhd1VuaXF1ZUNvbnN0cmFpbnREYXRhVjkgPSB0Lm9iamVjdChcbiAgXCJSYXdVbmlxdWVDb25zdHJhaW50RGF0YVY5XCIsXG4gIHtcbiAgICBjb2x1bW5zOiB0LmFycmF5KHQudTE2KCkpXG4gIH1cbik7XG52YXIgUmF3Vmlld0RlZlYxMCA9IHQub2JqZWN0KFwiUmF3Vmlld0RlZlYxMFwiLCB7XG4gIHNvdXJjZU5hbWU6IHQuc3RyaW5nKCksXG4gIGluZGV4OiB0LnUzMigpLFxuICBpc1B1YmxpYzogdC5ib29sKCksXG4gIGlzQW5vbnltb3VzOiB0LmJvb2woKSxcbiAgZ2V0IHBhcmFtcygpIHtcbiAgICByZXR1cm4gUHJvZHVjdFR5cGUyO1xuICB9LFxuICBnZXQgcmV0dXJuVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFJhd1ZpZXdEZWZWOSA9IHQub2JqZWN0KFwiUmF3Vmlld0RlZlY5XCIsIHtcbiAgbmFtZTogdC5zdHJpbmcoKSxcbiAgaW5kZXg6IHQudTMyKCksXG4gIGlzUHVibGljOiB0LmJvb2woKSxcbiAgaXNBbm9ueW1vdXM6IHQuYm9vbCgpLFxuICBnZXQgcGFyYW1zKCkge1xuICAgIHJldHVybiBQcm9kdWN0VHlwZTI7XG4gIH0sXG4gIGdldCByZXR1cm5UeXBlKCkge1xuICAgIHJldHVybiBBbGdlYnJhaWNUeXBlMjtcbiAgfVxufSk7XG52YXIgUmF3Vmlld1ByaW1hcnlLZXlEZWZWMTAgPSB0Lm9iamVjdChcIlJhd1ZpZXdQcmltYXJ5S2V5RGVmVjEwXCIsIHtcbiAgdmlld1NvdXJjZU5hbWU6IHQuc3RyaW5nKCksXG4gIGNvbHVtbnM6IHQuYXJyYXkodC5zdHJpbmcoKSlcbn0pO1xudmFyIFJlZHVjZXJEZWYgPSB0Lm9iamVjdChcIlJlZHVjZXJEZWZcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICBnZXQgYXJncygpIHtcbiAgICByZXR1cm4gdC5hcnJheShQcm9kdWN0VHlwZUVsZW1lbnQpO1xuICB9XG59KTtcbnZhciBTdW1UeXBlMiA9IHQub2JqZWN0KFwiU3VtVHlwZVwiLCB7XG4gIGdldCB2YXJpYW50cygpIHtcbiAgICByZXR1cm4gdC5hcnJheShTdW1UeXBlVmFyaWFudCk7XG4gIH1cbn0pO1xudmFyIFN1bVR5cGVWYXJpYW50ID0gdC5vYmplY3QoXCJTdW1UeXBlVmFyaWFudFwiLCB7XG4gIG5hbWU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICBnZXQgYWxnZWJyYWljVHlwZSgpIHtcbiAgICByZXR1cm4gQWxnZWJyYWljVHlwZTI7XG4gIH1cbn0pO1xudmFyIFRhYmxlQWNjZXNzID0gdC5lbnVtKFwiVGFibGVBY2Nlc3NcIiwge1xuICBQdWJsaWM6IHQudW5pdCgpLFxuICBQcml2YXRlOiB0LnVuaXQoKVxufSk7XG52YXIgVGFibGVEZXNjID0gdC5vYmplY3QoXCJUYWJsZURlc2NcIiwge1xuICBnZXQgc2NoZW1hKCkge1xuICAgIHJldHVybiBSYXdUYWJsZURlZlY4O1xuICB9LFxuICBkYXRhOiB0LnUzMigpXG59KTtcbnZhciBUYWJsZVR5cGUgPSB0LmVudW0oXCJUYWJsZVR5cGVcIiwge1xuICBTeXN0ZW06IHQudW5pdCgpLFxuICBVc2VyOiB0LnVuaXQoKVxufSk7XG52YXIgVHlwZUFsaWFzID0gdC5vYmplY3QoXCJUeXBlQWxpYXNcIiwge1xuICBuYW1lOiB0LnN0cmluZygpLFxuICB0eTogdC51MzIoKVxufSk7XG52YXIgVHlwZXNwYWNlID0gdC5vYmplY3QoXCJUeXBlc3BhY2VcIiwge1xuICBnZXQgdHlwZXMoKSB7XG4gICAgcmV0dXJuIHQuYXJyYXkoQWxnZWJyYWljVHlwZTIpO1xuICB9XG59KTtcbnZhciBWaWV3UmVzdWx0SGVhZGVyID0gdC5lbnVtKFwiVmlld1Jlc3VsdEhlYWRlclwiLCB7XG4gIFJvd0RhdGE6IHQudW5pdCgpLFxuICBSYXdTcWw6IHQuc3RyaW5nKClcbn0pO1xuXG4vLyBzcmMvbGliL3NjaGVtYS50c1xuZnVuY3Rpb24gdGFibGVUb1NjaGVtYShhY2NOYW1lLCBzY2hlbWEyLCB0YWJsZURlZikge1xuICBjb25zdCBnZXRDb2xOYW1lID0gKGkpID0+IHNjaGVtYTIucm93VHlwZS5hbGdlYnJhaWNUeXBlLnZhbHVlLmVsZW1lbnRzW2ldLm5hbWU7XG4gIGNvbnN0IHJlc29sdmVkSW5kZXhlcyA9IHRhYmxlRGVmLmluZGV4ZXMubWFwKFxuICAgIChpZHgpID0+IHtcbiAgICAgIGNvbnN0IGFjY2Vzc29yTmFtZSA9IGlkeC5hY2Nlc3Nvck5hbWU7XG4gICAgICBpZiAodHlwZW9mIGFjY2Vzc29yTmFtZSAhPT0gXCJzdHJpbmdcIiB8fCBhY2Nlc3Nvck5hbWUubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgICAgYEluZGV4ICcke2lkeC5zb3VyY2VOYW1lID8/IFwiPHVua25vd24+XCJ9JyBvbiB0YWJsZSAnJHt0YWJsZURlZi5zb3VyY2VOYW1lfScgaXMgbWlzc2luZyBhY2Nlc3NvciBuYW1lYFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3QgY29sdW1uSWRzID0gaWR4LmFsZ29yaXRobS50YWcgPT09IFwiRGlyZWN0XCIgPyBbaWR4LmFsZ29yaXRobS52YWx1ZV0gOiBpZHguYWxnb3JpdGhtLnZhbHVlO1xuICAgICAgY29uc3QgdW5pcXVlID0gdGFibGVEZWYuY29uc3RyYWludHMuc29tZShcbiAgICAgICAgKGMpID0+IGMuZGF0YS50YWcgPT09IFwiVW5pcXVlXCIgJiYgYy5kYXRhLnZhbHVlLmNvbHVtbnMuZXZlcnkoKGNvbCkgPT4gY29sdW1uSWRzLmluY2x1ZGVzKGNvbCkpXG4gICAgICApO1xuICAgICAgY29uc3QgYWxnb3JpdGhtID0ge1xuICAgICAgICBCVHJlZTogXCJidHJlZVwiLFxuICAgICAgICBIYXNoOiBcImhhc2hcIixcbiAgICAgICAgRGlyZWN0OiBcImRpcmVjdFwiXG4gICAgICB9W2lkeC5hbGdvcml0aG0udGFnXTtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5hbWU6IGFjY2Vzc29yTmFtZSxcbiAgICAgICAgdW5pcXVlLFxuICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgIGNvbHVtbnM6IGNvbHVtbklkcy5tYXAoZ2V0Q29sTmFtZSlcbiAgICAgIH07XG4gICAgfVxuICApO1xuICByZXR1cm4ge1xuICAgIC8vIEZvciBjbGllbnQsYHNjaGFtYS50YWJsZU5hbWVgIHdpbGwgYWx3YXlzIGJlIHRoZXJlIGFzIGNhbm9uaWNhbCBuYW1lLlxuICAgIC8vIEZvciBtb2R1bGUsIGlmIGV4cGxpY2l0IG5hbWUgaXMgbm90IHByb3ZpZGVkIHZpYSBgbmFtZWAsIGFjY2Vzc29yIG5hbWUgd2lsbFxuICAgIC8vIGJlIHVzZWQsIGl0IGlzIHN0b3JlZCBhcyBhbGlhcyBpbiBkYXRhYmFzZSwgaGVuY2Ugd29ya3MgaW4gcXVlcnkgYnVpbGRlci5cbiAgICBzb3VyY2VOYW1lOiBzY2hlbWEyLnRhYmxlTmFtZSB8fCBhY2NOYW1lLFxuICAgIGFjY2Vzc29yTmFtZTogYWNjTmFtZSxcbiAgICBjb2x1bW5zOiBzY2hlbWEyLnJvd1R5cGUucm93LFxuICAgIC8vIHR5cGVkIGFzIFRbaV1bJ3Jvd1R5cGUnXVsncm93J10gdW5kZXIgVGFibGVzVG9TY2hlbWE8VD5cbiAgICByb3dUeXBlOiBzY2hlbWEyLnJvd1NwYWNldGltZVR5cGUsXG4gICAgLy8gS2VlcCBkZWNsYXJhdGl2ZSBpbmRleGVzIGluIHRoZWlyIG9yaWdpbmFsIHNoYXBlIGZvciB0eXBlLWxldmVsIGNvbnN1bWVycy5cbiAgICBpbmRleGVzOiBzY2hlbWEyLmlkeHMsXG4gICAgY29uc3RyYWludHM6IHRhYmxlRGVmLmNvbnN0cmFpbnRzLm1hcCgoYykgPT4gKHtcbiAgICAgIG5hbWU6IGMuc291cmNlTmFtZSxcbiAgICAgIGNvbnN0cmFpbnQ6IFwidW5pcXVlXCIsXG4gICAgICBjb2x1bW5zOiBjLmRhdGEudmFsdWUuY29sdW1ucy5tYXAoZ2V0Q29sTmFtZSlcbiAgICB9KSksXG4gICAgLy8gRXhwb3NlIHJlc29sdmVkIHJ1bnRpbWUgaW5kZXhlcyBzZXBhcmF0ZWx5IHNvIHJ1bnRpbWUgdXNlcnMgZG9uJ3QgaGF2ZSB0b1xuICAgIC8vIHJlaW50ZXJwcmV0IGBpbmRleGVzYCB3aXRoIHVuc2FmZSBjYXN0cy5cbiAgICByZXNvbHZlZEluZGV4ZXMsXG4gICAgdGFibGVEZWYsXG4gICAgLi4udGFibGVEZWYuaXNFdmVudCA/IHsgaXNFdmVudDogdHJ1ZSB9IDoge31cbiAgfTtcbn1cbnZhciBNb2R1bGVDb250ZXh0ID0gY2xhc3Mge1xuICAjY29tcG91bmRUeXBlcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gIC8qKlxuICAgKiBUaGUgZ2xvYmFsIG1vZHVsZSBkZWZpbml0aW9uIHRoYXQgZ2V0cyBwb3B1bGF0ZWQgYnkgY2FsbHMgdG8gYHJlZHVjZXIoKWAgYW5kIGxpZmVjeWNsZSBob29rcy5cbiAgICovXG4gICNtb2R1bGVEZWYgPSB7XG4gICAgdHlwZXNwYWNlOiB7IHR5cGVzOiBbXSB9LFxuICAgIHRhYmxlczogW10sXG4gICAgcmVkdWNlcnM6IFtdLFxuICAgIHR5cGVzOiBbXSxcbiAgICByb3dMZXZlbFNlY3VyaXR5OiBbXSxcbiAgICBzY2hlZHVsZXM6IFtdLFxuICAgIHByb2NlZHVyZXM6IFtdLFxuICAgIHZpZXdzOiBbXSxcbiAgICB2aWV3UHJpbWFyeUtleXM6IFtdLFxuICAgIGxpZmVDeWNsZVJlZHVjZXJzOiBbXSxcbiAgICBodHRwSGFuZGxlcnM6IFtdLFxuICAgIGh0dHBSb3V0ZXM6IFtdLFxuICAgIGNhc2VDb252ZXJzaW9uUG9saWN5OiB7IHRhZzogXCJTbmFrZUNhc2VcIiB9LFxuICAgIGV4cGxpY2l0TmFtZXM6IHtcbiAgICAgIGVudHJpZXM6IFtdXG4gICAgfSxcbiAgICBzdWJtb2R1bGVzOiBbXVxuICB9O1xuICBnZXQgbW9kdWxlRGVmKCkge1xuICAgIHJldHVybiB0aGlzLiNtb2R1bGVEZWY7XG4gIH1cbiAgcmF3TW9kdWxlRGVmVjEwKCkge1xuICAgIGNvbnN0IHNlY3Rpb25zID0gW107XG4gICAgY29uc3QgcHVzaCA9IChzKSA9PiB7XG4gICAgICBpZiAocykgc2VjdGlvbnMucHVzaChzKTtcbiAgICB9O1xuICAgIGNvbnN0IG1vZHVsZSA9IHRoaXMuI21vZHVsZURlZjtcbiAgICBwdXNoKG1vZHVsZS50eXBlc3BhY2UgJiYgeyB0YWc6IFwiVHlwZXNwYWNlXCIsIHZhbHVlOiBtb2R1bGUudHlwZXNwYWNlIH0pO1xuICAgIHB1c2gobW9kdWxlLnR5cGVzICYmIHsgdGFnOiBcIlR5cGVzXCIsIHZhbHVlOiBtb2R1bGUudHlwZXMgfSk7XG4gICAgcHVzaChtb2R1bGUudGFibGVzICYmIHsgdGFnOiBcIlRhYmxlc1wiLCB2YWx1ZTogbW9kdWxlLnRhYmxlcyB9KTtcbiAgICBwdXNoKG1vZHVsZS5yZWR1Y2VycyAmJiB7IHRhZzogXCJSZWR1Y2Vyc1wiLCB2YWx1ZTogbW9kdWxlLnJlZHVjZXJzIH0pO1xuICAgIHB1c2gobW9kdWxlLnByb2NlZHVyZXMgJiYgeyB0YWc6IFwiUHJvY2VkdXJlc1wiLCB2YWx1ZTogbW9kdWxlLnByb2NlZHVyZXMgfSk7XG4gICAgcHVzaChtb2R1bGUudmlld3MgJiYgeyB0YWc6IFwiVmlld3NcIiwgdmFsdWU6IG1vZHVsZS52aWV3cyB9KTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLnZpZXdQcmltYXJ5S2V5cyAmJiB7XG4gICAgICAgIHRhZzogXCJWaWV3UHJpbWFyeUtleXNcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS52aWV3UHJpbWFyeUtleXNcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2gobW9kdWxlLnNjaGVkdWxlcyAmJiB7IHRhZzogXCJTY2hlZHVsZXNcIiwgdmFsdWU6IG1vZHVsZS5zY2hlZHVsZXMgfSk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS5saWZlQ3ljbGVSZWR1Y2VycyAmJiB7XG4gICAgICAgIHRhZzogXCJMaWZlQ3ljbGVSZWR1Y2Vyc1wiLFxuICAgICAgICB2YWx1ZTogbW9kdWxlLmxpZmVDeWNsZVJlZHVjZXJzXG4gICAgICB9XG4gICAgKTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLmh0dHBIYW5kbGVycyAmJiB7XG4gICAgICAgIHRhZzogXCJIdHRwSGFuZGxlcnNcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS5odHRwSGFuZGxlcnNcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2goXG4gICAgICBtb2R1bGUuaHR0cFJvdXRlcyAmJiB7XG4gICAgICAgIHRhZzogXCJIdHRwUm91dGVzXCIsXG4gICAgICAgIHZhbHVlOiBtb2R1bGUuaHR0cFJvdXRlc1xuICAgICAgfVxuICAgICk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS5yb3dMZXZlbFNlY3VyaXR5ICYmIHtcbiAgICAgICAgdGFnOiBcIlJvd0xldmVsU2VjdXJpdHlcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS5yb3dMZXZlbFNlY3VyaXR5XG4gICAgICB9XG4gICAgKTtcbiAgICBwdXNoKFxuICAgICAgbW9kdWxlLmV4cGxpY2l0TmFtZXMgJiYge1xuICAgICAgICB0YWc6IFwiRXhwbGljaXROYW1lc1wiLFxuICAgICAgICB2YWx1ZTogbW9kdWxlLmV4cGxpY2l0TmFtZXNcbiAgICAgIH1cbiAgICApO1xuICAgIHB1c2goXG4gICAgICBtb2R1bGUuY2FzZUNvbnZlcnNpb25Qb2xpY3kgJiYge1xuICAgICAgICB0YWc6IFwiQ2FzZUNvbnZlcnNpb25Qb2xpY3lcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS5jYXNlQ29udmVyc2lvblBvbGljeVxuICAgICAgfVxuICAgICk7XG4gICAgcHVzaChcbiAgICAgIG1vZHVsZS5zdWJtb2R1bGVzICYmIHtcbiAgICAgICAgdGFnOiBcIlN1Ym1vZHVsZXNcIixcbiAgICAgICAgdmFsdWU6IG1vZHVsZS5zdWJtb2R1bGVzXG4gICAgICB9XG4gICAgKTtcbiAgICByZXR1cm4geyBzZWN0aW9ucyB9O1xuICB9XG4gIGFkZFN1Ym1vZHVsZShzdWJtb2R1bGUpIHtcbiAgICB0aGlzLiNtb2R1bGVEZWYuc3VibW9kdWxlcy5wdXNoKHN1Ym1vZHVsZSk7XG4gIH1cbiAgLyoqXG4gICAqIFNldCB0aGUgY2FzZSBjb252ZXJzaW9uIHBvbGljeSBmb3IgdGhpcyBtb2R1bGUuXG4gICAqIENhbGxlZCBieSB0aGUgc2V0dGluZ3MgbWVjaGFuaXNtLlxuICAgKi9cbiAgc2V0Q2FzZUNvbnZlcnNpb25Qb2xpY3kocG9saWN5KSB7XG4gICAgdGhpcy4jbW9kdWxlRGVmLmNhc2VDb252ZXJzaW9uUG9saWN5ID0gcG9saWN5O1xuICB9XG4gIGdldCB0eXBlc3BhY2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuI21vZHVsZURlZi50eXBlc3BhY2U7XG4gIH1cbiAgLyoqXG4gICAqIFJlc29sdmVzIHRoZSBhY3R1YWwgdHlwZSBvZiBhIFR5cGVCdWlsZGVyIGJ5IGZvbGxvd2luZyBpdHMgcmVmZXJlbmNlcyB1bnRpbCBpdCByZWFjaGVzIGEgbm9uLXJlZiB0eXBlLlxuICAgKiBAcGFyYW0gdHlwZXNwYWNlIFRoZSB0eXBlc3BhY2UgdG8gcmVzb2x2ZSB0eXBlcyBhZ2FpbnN0LlxuICAgKiBAcGFyYW0gdHlwZUJ1aWxkZXIgVGhlIFR5cGVCdWlsZGVyIHRvIHJlc29sdmUuXG4gICAqIEByZXR1cm5zIFRoZSByZXNvbHZlZCBhbGdlYnJhaWMgdHlwZS5cbiAgICovXG4gIHJlc29sdmVUeXBlKHR5cGVCdWlsZGVyKSB7XG4gICAgbGV0IHR5ID0gdHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZTtcbiAgICB3aGlsZSAodHkudGFnID09PSBcIlJlZlwiKSB7XG4gICAgICB0eSA9IHRoaXMudHlwZXNwYWNlLnR5cGVzW3R5LnZhbHVlXTtcbiAgICB9XG4gICAgcmV0dXJuIHR5O1xuICB9XG4gIC8qKlxuICAgKiBBZGRzIGEgdHlwZSB0byB0aGUgbW9kdWxlIGRlZmluaXRpb24ncyB0eXBlc3BhY2UgYXMgYSBgUmVmYCBpZiBpdCBpcyBhIG5hbWVkIGNvbXBvdW5kIHR5cGUgKFByb2R1Y3Qgb3IgU3VtKS5cbiAgICogT3RoZXJ3aXNlLCByZXR1cm5zIHRoZSB0eXBlIGFzIGlzLlxuICAgKiBAcGFyYW0gbmFtZVxuICAgKiBAcGFyYW0gdHlcbiAgICogQHJldHVybnNcbiAgICovXG4gIHJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlcikge1xuICAgIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFByb2R1Y3RCdWlsZGVyICYmICFpc1VuaXQodHlwZUJ1aWxkZXIpIHx8IHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgU3VtQnVpbGRlciB8fCB0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFJvd0J1aWxkZXIpIHtcbiAgICAgIHJldHVybiB0aGlzLiNyZWdpc3RlckNvbXBvdW5kVHlwZVJlY3Vyc2l2ZWx5KHR5cGVCdWlsZGVyKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgT3B0aW9uQnVpbGRlcikge1xuICAgICAgcmV0dXJuIG5ldyBPcHRpb25CdWlsZGVyKFxuICAgICAgICB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlci52YWx1ZSlcbiAgICAgICk7XG4gICAgfSBlbHNlIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFJlc3VsdEJ1aWxkZXIpIHtcbiAgICAgIHJldHVybiBuZXcgUmVzdWx0QnVpbGRlcihcbiAgICAgICAgdGhpcy5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkodHlwZUJ1aWxkZXIub2spLFxuICAgICAgICB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlci5lcnIpXG4gICAgICApO1xuICAgIH0gZWxzZSBpZiAodHlwZUJ1aWxkZXIgaW5zdGFuY2VvZiBBcnJheUJ1aWxkZXIpIHtcbiAgICAgIHJldHVybiBuZXcgQXJyYXlCdWlsZGVyKFxuICAgICAgICB0aGlzLnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseSh0eXBlQnVpbGRlci5lbGVtZW50KVxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHR5cGVCdWlsZGVyO1xuICAgIH1cbiAgfVxuICAjcmVnaXN0ZXJDb21wb3VuZFR5cGVSZWN1cnNpdmVseSh0eXBlQnVpbGRlcikge1xuICAgIGNvbnN0IHR5ID0gdHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZTtcbiAgICBjb25zdCBuYW1lID0gdHlwZUJ1aWxkZXIudHlwZU5hbWU7XG4gICAgaWYgKG5hbWUgPT09IHZvaWQgMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICBgTWlzc2luZyB0eXBlIG5hbWUgZm9yICR7dHlwZUJ1aWxkZXIuY29uc3RydWN0b3IubmFtZSA/PyBcIlR5cGVCdWlsZGVyXCJ9ICR7SlNPTi5zdHJpbmdpZnkodHlwZUJ1aWxkZXIpfWBcbiAgICAgICk7XG4gICAgfVxuICAgIGxldCByID0gdGhpcy4jY29tcG91bmRUeXBlcy5nZXQodHkpO1xuICAgIGlmIChyICE9IG51bGwpIHtcbiAgICAgIHJldHVybiByO1xuICAgIH1cbiAgICBjb25zdCBuZXdUeSA9IHR5cGVCdWlsZGVyIGluc3RhbmNlb2YgUm93QnVpbGRlciB8fCB0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFByb2R1Y3RCdWlsZGVyID8ge1xuICAgICAgdGFnOiBcIlByb2R1Y3RcIixcbiAgICAgIHZhbHVlOiB7IGVsZW1lbnRzOiBbXSB9XG4gICAgfSA6IHtcbiAgICAgIHRhZzogXCJTdW1cIixcbiAgICAgIHZhbHVlOiB7IHZhcmlhbnRzOiBbXSB9XG4gICAgfTtcbiAgICByID0gbmV3IFJlZkJ1aWxkZXIodGhpcy4jbW9kdWxlRGVmLnR5cGVzcGFjZS50eXBlcy5sZW5ndGgpO1xuICAgIHRoaXMuI21vZHVsZURlZi50eXBlc3BhY2UudHlwZXMucHVzaChuZXdUeSk7XG4gICAgdGhpcy4jY29tcG91bmRUeXBlcy5zZXQodHksIHIpO1xuICAgIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFJvd0J1aWxkZXIpIHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUyLCBlbGVtXSBvZiBPYmplY3QuZW50cmllcyh0eXBlQnVpbGRlci5yb3cpKSB7XG4gICAgICAgIG5ld1R5LnZhbHVlLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IG5hbWUyLFxuICAgICAgICAgIGFsZ2VicmFpY1R5cGU6IHRoaXMucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KGVsZW0udHlwZUJ1aWxkZXIpLmFsZ2VicmFpY1R5cGVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFByb2R1Y3RCdWlsZGVyKSB7XG4gICAgICBmb3IgKGNvbnN0IFtuYW1lMiwgZWxlbV0gb2YgT2JqZWN0LmVudHJpZXModHlwZUJ1aWxkZXIuZWxlbWVudHMpKSB7XG4gICAgICAgIG5ld1R5LnZhbHVlLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IG5hbWUyLFxuICAgICAgICAgIGFsZ2VicmFpY1R5cGU6IHRoaXMucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KGVsZW0pLmFsZ2VicmFpY1R5cGVcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh0eXBlQnVpbGRlciBpbnN0YW5jZW9mIFN1bUJ1aWxkZXIpIHtcbiAgICAgIGZvciAoY29uc3QgW25hbWUyLCB2YXJpYW50XSBvZiBPYmplY3QuZW50cmllcyh0eXBlQnVpbGRlci52YXJpYW50cykpIHtcbiAgICAgICAgbmV3VHkudmFsdWUudmFyaWFudHMucHVzaCh7XG4gICAgICAgICAgbmFtZTogbmFtZTIsXG4gICAgICAgICAgYWxnZWJyYWljVHlwZTogdGhpcy5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkodmFyaWFudCkuYWxnZWJyYWljVHlwZVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy4jbW9kdWxlRGVmLnR5cGVzLnB1c2goe1xuICAgICAgc291cmNlTmFtZTogc3BsaXROYW1lKG5hbWUpLFxuICAgICAgdHk6IHIucmVmLFxuICAgICAgY3VzdG9tT3JkZXJpbmc6IHRydWVcbiAgICB9KTtcbiAgICByZXR1cm4gcjtcbiAgfVxufTtcbmZ1bmN0aW9uIGlzVW5pdCh0eXBlQnVpbGRlcikge1xuICByZXR1cm4gdHlwZUJ1aWxkZXIudHlwZU5hbWUgPT0gbnVsbCAmJiB0eXBlQnVpbGRlci5hbGdlYnJhaWNUeXBlLnZhbHVlLmVsZW1lbnRzLmxlbmd0aCA9PT0gMDtcbn1cbmZ1bmN0aW9uIHNwbGl0TmFtZShuYW1lKSB7XG4gIGNvbnN0IHNjb3BlID0gbmFtZS5zcGxpdChcIi5cIik7XG4gIHJldHVybiB7IHNvdXJjZU5hbWU6IHNjb3BlLnBvcCgpLCBzY29wZSB9O1xufVxudmFyIHRleHRFbmNvZGVyID0gbmV3IFRleHRFbmNvZGVyKCk7XG52YXIgdGV4dERlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoXCJ1dGYtOFwiKTtcbmZ1bmN0aW9uIGRlc2VyaWFsaXplTWV0aG9kKG1ldGhvZCkge1xuICBzd2l0Y2ggKG1ldGhvZC50YWcpIHtcbiAgICBjYXNlIFwiR2V0XCI6XG4gICAgICByZXR1cm4gXCJHRVRcIjtcbiAgICBjYXNlIFwiSGVhZFwiOlxuICAgICAgcmV0dXJuIFwiSEVBRFwiO1xuICAgIGNhc2UgXCJQb3N0XCI6XG4gICAgICByZXR1cm4gXCJQT1NUXCI7XG4gICAgY2FzZSBcIlB1dFwiOlxuICAgICAgcmV0dXJuIFwiUFVUXCI7XG4gICAgY2FzZSBcIkRlbGV0ZVwiOlxuICAgICAgcmV0dXJuIFwiREVMRVRFXCI7XG4gICAgY2FzZSBcIkNvbm5lY3RcIjpcbiAgICAgIHJldHVybiBcIkNPTk5FQ1RcIjtcbiAgICBjYXNlIFwiT3B0aW9uc1wiOlxuICAgICAgcmV0dXJuIFwiT1BUSU9OU1wiO1xuICAgIGNhc2UgXCJUcmFjZVwiOlxuICAgICAgcmV0dXJuIFwiVFJBQ0VcIjtcbiAgICBjYXNlIFwiUGF0Y2hcIjpcbiAgICAgIHJldHVybiBcIlBBVENIXCI7XG4gICAgY2FzZSBcIkV4dGVuc2lvblwiOlxuICAgICAgcmV0dXJuIG1ldGhvZC52YWx1ZTtcbiAgfVxufVxudmFyIG1ldGhvZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcChbXG4gIFtcIkdFVFwiLCB7IHRhZzogXCJHZXRcIiB9XSxcbiAgW1wiSEVBRFwiLCB7IHRhZzogXCJIZWFkXCIgfV0sXG4gIFtcIlBPU1RcIiwgeyB0YWc6IFwiUG9zdFwiIH1dLFxuICBbXCJQVVRcIiwgeyB0YWc6IFwiUHV0XCIgfV0sXG4gIFtcIkRFTEVURVwiLCB7IHRhZzogXCJEZWxldGVcIiB9XSxcbiAgW1wiQ09OTkVDVFwiLCB7IHRhZzogXCJDb25uZWN0XCIgfV0sXG4gIFtcIk9QVElPTlNcIiwgeyB0YWc6IFwiT3B0aW9uc1wiIH1dLFxuICBbXCJUUkFDRVwiLCB7IHRhZzogXCJUcmFjZVwiIH1dLFxuICBbXCJQQVRDSFwiLCB7IHRhZzogXCJQYXRjaFwiIH1dXG5dKTtcbmZ1bmN0aW9uIHNlcmlhbGl6ZU1ldGhvZChtZXRob2QpIHtcbiAgcmV0dXJuIG1ldGhvZHMuZ2V0KG1ldGhvZD8udG9VcHBlckNhc2UoKSA/PyBcIkdFVFwiKSA/PyB7XG4gICAgdGFnOiBcIkV4dGVuc2lvblwiLFxuICAgIHZhbHVlOiBtZXRob2RcbiAgfTtcbn1cbmZ1bmN0aW9uIHNlcmlhbGl6ZUhlYWRlcnMoaGVhZGVycykge1xuICByZXR1cm4ge1xuICAgIGVudHJpZXM6IGhlYWRlcnNUb0xpc3QoaGVhZGVycykuZmxhdE1hcCgoW2ssIHZdKSA9PiBBcnJheS5pc0FycmF5KHYpID8gdi5tYXAoKHYyKSA9PiBbaywgdjJdKSA6IFtbaywgdl1dKS5tYXAoKFtuYW1lLCB2YWx1ZV0pID0+ICh7IG5hbWUsIHZhbHVlOiB0ZXh0RW5jb2Rlci5lbmNvZGUodmFsdWUpIH0pKVxuICB9O1xufVxuZnVuY3Rpb24gZGVzZXJpYWxpemVIZWFkZXJzKGhlYWRlcnMpIHtcbiAgcmV0dXJuIG5ldyBIZWFkZXJzKFxuICAgIGhlYWRlcnMuZW50cmllcy5tYXAoKHsgbmFtZSwgdmFsdWUgfSkgPT4gW1xuICAgICAgbmFtZSxcbiAgICAgIHRleHREZWNvZGVyLmRlY29kZSh2YWx1ZSlcbiAgICBdKVxuICApO1xufVxudmFyIG1ha2VSZXNwb25zZSA9IFN5bWJvbChcIm1ha2VSZXNwb25zZVwiKTtcbnZhciBTeW5jUmVzcG9uc2UgPSBjbGFzcyBfU3luY1Jlc3BvbnNlIHtcbiAgI2JvZHk7XG4gICNpbm5lcjtcbiAgY29uc3RydWN0b3IoYm9keSwgaW5pdCkge1xuICAgIGlmIChib2R5ID09IG51bGwpIHtcbiAgICAgIHRoaXMuI2JvZHkgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGJvZHkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHRoaXMuI2JvZHkgPSBib2R5O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLiNib2R5ID0gbmV3IFVpbnQ4QXJyYXkoYm9keSkuYnVmZmVyO1xuICAgIH1cbiAgICB0aGlzLiNpbm5lciA9IHtcbiAgICAgIGhlYWRlcnM6IG5ldyBIZWFkZXJzKGluaXQ/LmhlYWRlcnMpLFxuICAgICAgc3RhdHVzOiBpbml0Py5zdGF0dXMgPz8gMjAwLFxuICAgICAgc3RhdHVzVGV4dDogaW5pdD8uc3RhdHVzVGV4dCA/PyBcIlwiLFxuICAgICAgdHlwZTogXCJkZWZhdWx0XCIsXG4gICAgICB1cmw6IG51bGwsXG4gICAgICBhYm9ydGVkOiBmYWxzZSxcbiAgICAgIHZlcnNpb246IGluaXQ/LnZlcnNpb24gPz8geyB0YWc6IFwiSHR0cDExXCIgfVxuICAgIH07XG4gIH1cbiAgc3RhdGljIFttYWtlUmVzcG9uc2VdKGJvZHksIGlubmVyKSB7XG4gICAgY29uc3QgbWUgPSBuZXcgX1N5bmNSZXNwb25zZShib2R5KTtcbiAgICBtZS4jaW5uZXIgPSBpbm5lcjtcbiAgICByZXR1cm4gbWU7XG4gIH1cbiAgZ2V0IGhlYWRlcnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLmhlYWRlcnM7XG4gIH1cbiAgZ2V0IHN0YXR1cygpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIuc3RhdHVzO1xuICB9XG4gIGdldCBzdGF0dXNUZXh0KCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci5zdGF0dXNUZXh0O1xuICB9XG4gIGdldCBvaygpIHtcbiAgICByZXR1cm4gMjAwIDw9IHRoaXMuI2lubmVyLnN0YXR1cyAmJiB0aGlzLiNpbm5lci5zdGF0dXMgPD0gMjk5O1xuICB9XG4gIGdldCB1cmwoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnVybCA/PyBcIlwiO1xuICB9XG4gIGdldCB0eXBlKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci50eXBlO1xuICB9XG4gIGdldCB2ZXJzaW9uKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci52ZXJzaW9uO1xuICB9XG4gIGFycmF5QnVmZmVyKCkge1xuICAgIHJldHVybiB0aGlzLmJ5dGVzKCkuYnVmZmVyO1xuICB9XG4gIGJ5dGVzKCkge1xuICAgIGlmICh0aGlzLiNib2R5ID09IG51bGwpIHtcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSgpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIHRoaXMuI2JvZHkgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgIHJldHVybiB0ZXh0RW5jb2Rlci5lbmNvZGUodGhpcy4jYm9keSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSh0aGlzLiNib2R5KTtcbiAgICB9XG4gIH1cbiAganNvbigpIHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZSh0aGlzLnRleHQoKSk7XG4gIH1cbiAgdGV4dCgpIHtcbiAgICBpZiAodGhpcy4jYm9keSA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gXCJcIjtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB0aGlzLiNib2R5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgICByZXR1cm4gdGhpcy4jYm9keTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRleHREZWNvZGVyLmRlY29kZSh0aGlzLiNib2R5KTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIHNyYy9zZXJ2ZXIvaHR0cF9oYW5kbGVycy50c1xudmFyIGh0dHBIYW5kbGVyRm4gPSBTeW1ib2woXCJTcGFjZXRpbWVEQi5odHRwSGFuZGxlckZuXCIpO1xudmFyIEFDQ0VQVEFCTEVfUk9VVEVfUEFUSF9DSEFSU19IVU1BTl9ERVNDUklQVElPTiA9IFwiQVNDSUkgbG93ZXJjYXNlIGxldHRlcnMsIGRpZ2l0cyBhbmQgYC1ffi9gXCI7XG52YXIgbWFrZVJlcXVlc3QgPSBTeW1ib2woXCJtYWtlUmVxdWVzdFwiKTtcbmZ1bmN0aW9uIGNvZXJjZVJlcXVlc3RCb2R5KGJvZHkpIHtcbiAgaWYgKGJvZHkgPT0gbnVsbCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG4gIGlmICh0eXBlb2YgYm9keSA9PT0gXCJzdHJpbmdcIikge1xuICAgIHJldHVybiBib2R5O1xuICB9XG4gIHJldHVybiBuZXcgVWludDhBcnJheShib2R5KTtcbn1cbmZ1bmN0aW9uIHJlcXVlc3RCb2R5VG9CeXRlcyhib2R5KSB7XG4gIGlmIChib2R5ID09IG51bGwpIHtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoKTtcbiAgfVxuICBpZiAodHlwZW9mIGJvZHkgPT09IFwic3RyaW5nXCIpIHtcbiAgICByZXR1cm4gdGV4dEVuY29kZXIuZW5jb2RlKGJvZHkpO1xuICB9XG4gIHJldHVybiBib2R5O1xufVxuZnVuY3Rpb24gcmVxdWVzdEJvZHlUb1RleHQoYm9keSkge1xuICBpZiAoYm9keSA9PSBudWxsKSB7XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cbiAgaWYgKHR5cGVvZiBib2R5ID09PSBcInN0cmluZ1wiKSB7XG4gICAgcmV0dXJuIGJvZHk7XG4gIH1cbiAgcmV0dXJuIHRleHREZWNvZGVyLmRlY29kZShib2R5KTtcbn1cbmZ1bmN0aW9uIGNoYXJhY3RlcklzQWNjZXB0YWJsZUZvclJvdXRlUGF0aChjKSB7XG4gIHJldHVybiBjID49IFwiYVwiICYmIGMgPD0gXCJ6XCIgfHwgYyA+PSBcIjBcIiAmJiBjIDw9IFwiOVwiIHx8IGMgPT09IFwiLVwiIHx8IGMgPT09IFwiX1wiIHx8IGMgPT09IFwiflwiIHx8IGMgPT09IFwiL1wiO1xufVxuZnVuY3Rpb24gYXNzZXJ0VmFsaWRQYXRoKHBhdGgpIHtcbiAgaWYgKHBhdGggIT09IFwiXCIgJiYgIXBhdGguc3RhcnRzV2l0aChcIi9cIikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBSb3V0ZSBwYXRocyBtdXN0IHN0YXJ0IHdpdGggXFxgL1xcYDogJHtwYXRofWApO1xuICB9XG4gIGlmICghWy4uLnBhdGhdLmV2ZXJ5KGNoYXJhY3RlcklzQWNjZXB0YWJsZUZvclJvdXRlUGF0aCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgYFJvdXRlIHBhdGhzIG1heSBjb250YWluIG9ubHkgJHtBQ0NFUFRBQkxFX1JPVVRFX1BBVEhfQ0hBUlNfSFVNQU5fREVTQ1JJUFRJT059OiAke3BhdGh9YFxuICAgICk7XG4gIH1cbn1cbmZ1bmN0aW9uIHJvdXRlc092ZXJsYXAoYSwgYikge1xuICBjb25zdCBtZXRob2RzTWF0Y2ggPSAobGVmdCwgcmlnaHQpID0+IHtcbiAgICBpZiAobGVmdC50YWcgIT09IHJpZ2h0LnRhZykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAobGVmdC50YWcgPT09IFwiRXh0ZW5zaW9uXCIgJiYgcmlnaHQudGFnID09PSBcIkV4dGVuc2lvblwiKSB7XG4gICAgICByZXR1cm4gbGVmdC52YWx1ZSA9PT0gcmlnaHQudmFsdWU7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuICByZXR1cm4gYS5wYXRoID09PSBiLnBhdGggJiYgKGEubWV0aG9kLnRhZyA9PT0gXCJBbnlcIiB8fCBiLm1ldGhvZC50YWcgPT09IFwiQW55XCIgfHwgYS5tZXRob2QudGFnID09PSBcIk1ldGhvZFwiICYmIGIubWV0aG9kLnRhZyA9PT0gXCJNZXRob2RcIiAmJiBtZXRob2RzTWF0Y2goYS5tZXRob2QudmFsdWUsIGIubWV0aG9kLnZhbHVlKSk7XG59XG5mdW5jdGlvbiBqb2luUGF0aHMocHJlZml4LCBzdWZmaXgpIHtcbiAgaWYgKHByZWZpeCA9PT0gXCIvXCIpIHtcbiAgICByZXR1cm4gc3VmZml4O1xuICB9XG4gIGlmIChzdWZmaXggPT09IFwiL1wiKSB7XG4gICAgcmV0dXJuIHByZWZpeDtcbiAgfVxuICBsZXQgcHJlZml4RW5kID0gcHJlZml4Lmxlbmd0aDtcbiAgd2hpbGUgKHByZWZpeEVuZCA+IDAgJiYgcHJlZml4W3ByZWZpeEVuZCAtIDFdID09PSBcIi9cIikge1xuICAgIHByZWZpeEVuZC0tO1xuICB9XG4gIGxldCBzdWZmaXhTdGFydCA9IDA7XG4gIHdoaWxlIChzdWZmaXhTdGFydCA8IHN1ZmZpeC5sZW5ndGggJiYgc3VmZml4W3N1ZmZpeFN0YXJ0XSA9PT0gXCIvXCIpIHtcbiAgICBzdWZmaXhTdGFydCsrO1xuICB9XG4gIGNvbnN0IGpvaW5lZFByZWZpeCA9IHByZWZpeC5zbGljZSgwLCBwcmVmaXhFbmQpO1xuICBjb25zdCBqb2luZWRTdWZmaXggPSBzdWZmaXguc2xpY2Uoc3VmZml4U3RhcnQpO1xuICByZXR1cm4gYCR7am9pbmVkUHJlZml4fS8ke2pvaW5lZFN1ZmZpeH1gO1xufVxudmFyIFJlcXVlc3QgPSBjbGFzcyBfUmVxdWVzdCB7XG4gICNib2R5O1xuICAjaW5uZXI7XG4gIGNvbnN0cnVjdG9yKHVybCwgaW5pdCA9IHt9KSB7XG4gICAgdGhpcy4jYm9keSA9IGNvZXJjZVJlcXVlc3RCb2R5KGluaXQuYm9keSk7XG4gICAgdGhpcy4jaW5uZXIgPSB7XG4gICAgICBoZWFkZXJzOiBuZXcgSGVhZGVycyhpbml0LmhlYWRlcnMpLFxuICAgICAgbWV0aG9kOiBpbml0Lm1ldGhvZCA/PyBcIkdFVFwiLFxuICAgICAgdXJpOiBcIlwiICsgdXJsLFxuICAgICAgdmVyc2lvbjogaW5pdC52ZXJzaW9uID8/IHsgdGFnOiBcIkh0dHAxMVwiIH1cbiAgICB9O1xuICB9XG4gIHN0YXRpYyBbbWFrZVJlcXVlc3RdKGJvZHksIGlubmVyKSB7XG4gICAgY29uc3QgbWUgPSBuZXcgX1JlcXVlc3QoaW5uZXIudXJpKTtcbiAgICBtZS4jYm9keSA9IGNvZXJjZVJlcXVlc3RCb2R5KGJvZHkpO1xuICAgIG1lLiNpbm5lciA9IGlubmVyO1xuICAgIHJldHVybiBtZTtcbiAgfVxuICBnZXQgaGVhZGVycygpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIuaGVhZGVycztcbiAgfVxuICBnZXQgbWV0aG9kKCkge1xuICAgIHJldHVybiB0aGlzLiNpbm5lci5tZXRob2Q7XG4gIH1cbiAgZ2V0IHVyaSgpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIudXJpO1xuICB9XG4gIGdldCB1cmwoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lubmVyLnVyaTtcbiAgfVxuICBnZXQgdmVyc2lvbigpIHtcbiAgICByZXR1cm4gdGhpcy4jaW5uZXIudmVyc2lvbjtcbiAgfVxuICBhcnJheUJ1ZmZlcigpIHtcbiAgICByZXR1cm4gdGhpcy5ieXRlcygpLmJ1ZmZlcjtcbiAgfVxuICBieXRlcygpIHtcbiAgICByZXR1cm4gcmVxdWVzdEJvZHlUb0J5dGVzKHRoaXMuI2JvZHkpO1xuICB9XG4gIGpzb24oKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UodGhpcy50ZXh0KCkpO1xuICB9XG4gIHRleHQoKSB7XG4gICAgcmV0dXJuIHJlcXVlc3RCb2R5VG9UZXh0KHRoaXMuI2JvZHkpO1xuICB9XG59O1xudmFyIGV4cG9ydGVkSHR0cEhhbmRsZXJPYmplY3RzID0gLyogQF9fUFVSRV9fICovIG5ldyBXZWFrU2V0KCk7XG52YXIgUm91dGVyID0gY2xhc3MgX1JvdXRlciB7XG4gICNyb3V0ZXM7XG4gIGNvbnN0cnVjdG9yKHJvdXRlcyA9IFtdKSB7XG4gICAgdGhpcy4jcm91dGVzID0gcm91dGVzO1xuICB9XG4gIGdldChwYXRoLCBoYW5kbGVyKSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkUm91dGUoXG4gICAgICB7IHRhZzogXCJNZXRob2RcIiwgdmFsdWU6IHsgdGFnOiBcIkdldFwiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBoZWFkKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiSGVhZFwiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBvcHRpb25zKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiT3B0aW9uc1wiIH0gfSxcbiAgICAgIHBhdGgsXG4gICAgICBoYW5kbGVyXG4gICAgKTtcbiAgfVxuICBwdXQocGF0aCwgaGFuZGxlcikge1xuICAgIHJldHVybiB0aGlzLmFkZFJvdXRlKFxuICAgICAgeyB0YWc6IFwiTWV0aG9kXCIsIHZhbHVlOiB7IHRhZzogXCJQdXRcIiB9IH0sXG4gICAgICBwYXRoLFxuICAgICAgaGFuZGxlclxuICAgICk7XG4gIH1cbiAgZGVsZXRlKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiRGVsZXRlXCIgfSB9LFxuICAgICAgcGF0aCxcbiAgICAgIGhhbmRsZXJcbiAgICApO1xuICB9XG4gIHBvc3QocGF0aCwgaGFuZGxlcikge1xuICAgIHJldHVybiB0aGlzLmFkZFJvdXRlKFxuICAgICAgeyB0YWc6IFwiTWV0aG9kXCIsIHZhbHVlOiB7IHRhZzogXCJQb3N0XCIgfSB9LFxuICAgICAgcGF0aCxcbiAgICAgIGhhbmRsZXJcbiAgICApO1xuICB9XG4gIHBhdGNoKHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZShcbiAgICAgIHsgdGFnOiBcIk1ldGhvZFwiLCB2YWx1ZTogeyB0YWc6IFwiUGF0Y2hcIiB9IH0sXG4gICAgICBwYXRoLFxuICAgICAgaGFuZGxlclxuICAgICk7XG4gIH1cbiAgYW55KHBhdGgsIGhhbmRsZXIpIHtcbiAgICByZXR1cm4gdGhpcy5hZGRSb3V0ZSh7IHRhZzogXCJBbnlcIiB9LCBwYXRoLCBoYW5kbGVyKTtcbiAgfVxuICBuZXN0KHBhdGgsIHN1YlJvdXRlcikge1xuICAgIGFzc2VydFZhbGlkUGF0aChwYXRoKTtcbiAgICBpZiAodGhpcy4jcm91dGVzLnNvbWUoKHJvdXRlKSA9PiByb3V0ZS5wYXRoLnN0YXJ0c1dpdGgocGF0aCkpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBgQ2Fubm90IG5lc3Qgcm91dGVyIGF0IFxcYCR7cGF0aH1cXGA7IGV4aXN0aW5nIHJvdXRlcyBvdmVybGFwIHdpdGggbmVzdGVkIHBhdGhgXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgbWVyZ2VkID0gbmV3IF9Sb3V0ZXIodGhpcy4jcm91dGVzKTtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHN1YlJvdXRlci4jcm91dGVzKSB7XG4gICAgICBtZXJnZWQgPSBtZXJnZWQuYWRkUm91dGUoXG4gICAgICAgIHJvdXRlLm1ldGhvZCxcbiAgICAgICAgam9pblBhdGhzKHBhdGgsIHJvdXRlLnBhdGgpLFxuICAgICAgICByb3V0ZS5oYW5kbGVyXG4gICAgICApO1xuICAgIH1cbiAgICByZXR1cm4gbWVyZ2VkO1xuICB9XG4gIG1lcmdlKG90aGVyUm91dGVyKSB7XG4gICAgbGV0IG1lcmdlZCA9IG5ldyBfUm91dGVyKHRoaXMuI3JvdXRlcyk7XG4gICAgZm9yIChjb25zdCByb3V0ZSBvZiBvdGhlclJvdXRlci4jcm91dGVzKSB7XG4gICAgICBtZXJnZWQgPSBtZXJnZWQuYWRkUm91dGUocm91dGUubWV0aG9kLCByb3V0ZS5wYXRoLCByb3V0ZS5oYW5kbGVyKTtcbiAgICB9XG4gICAgcmV0dXJuIG1lcmdlZDtcbiAgfVxuICBpbnRvUm91dGVzKCkge1xuICAgIHJldHVybiB0aGlzLiNyb3V0ZXMuc2xpY2UoKTtcbiAgfVxuICBhZGRSb3V0ZShtZXRob2QsIHBhdGgsIGhhbmRsZXIpIHtcbiAgICBhc3NlcnRWYWxpZFBhdGgocGF0aCk7XG4gICAgY29uc3QgY2FuZGlkYXRlID0geyBtZXRob2QsIHBhdGgsIGhhbmRsZXIgfTtcbiAgICBpZiAodGhpcy4jcm91dGVzLnNvbWUoKHJvdXRlKSA9PiByb3V0ZXNPdmVybGFwKHJvdXRlLCBjYW5kaWRhdGUpKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihgUm91dGUgY29uZmxpY3QgZm9yIFxcYCR7cGF0aH1cXGBgKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBfUm91dGVyKFsuLi50aGlzLiNyb3V0ZXMsIGNhbmRpZGF0ZV0pO1xuICB9XG59O1xuZnVuY3Rpb24gbWFrZUh0dHBIYW5kbGVyRXhwb3J0KGN0eCwgb3B0cywgZm4pIHtcbiAgY29uc3QgaGFuZGxlckV4cG9ydCA9IE9iamVjdC5hc3NpZ24oXG4gICAgKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpLFxuICAgIHtcbiAgICAgIFtodHRwSGFuZGxlckZuXTogZm4sXG4gICAgICBbZXhwb3J0Q29udGV4dF06IGN0eCxcbiAgICAgIFtyZWdpc3RlckV4cG9ydF0oY3R4MiwgZXhwb3J0TmFtZSkge1xuICAgICAgICBpZiAoZXhwb3J0ZWRIdHRwSGFuZGxlck9iamVjdHMuaGFzKGhhbmRsZXJFeHBvcnQpKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIGBIVFRQIGhhbmRsZXIgJyR7ZXhwb3J0TmFtZX0nIHdhcyBleHBvcnRlZCBtb3JlIHRoYW4gb25jZWBcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIGV4cG9ydGVkSHR0cEhhbmRsZXJPYmplY3RzLmFkZChoYW5kbGVyRXhwb3J0KTtcbiAgICAgICAgcmVnaXN0ZXJIdHRwSGFuZGxlcihjdHgyLCBleHBvcnROYW1lLCBmbiwgb3B0cyk7XG4gICAgICAgIGN0eDIuaHR0cEhhbmRsZXJFeHBvcnRzLnNldChcbiAgICAgICAgICBoYW5kbGVyRXhwb3J0LFxuICAgICAgICAgIGV4cG9ydE5hbWVcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICk7XG4gIHJldHVybiBoYW5kbGVyRXhwb3J0O1xufVxuZnVuY3Rpb24gbWFrZUh0dHBSb3V0ZXJFeHBvcnQoY3R4LCByb3V0ZXIpIHtcbiAgcmV0dXJuIHtcbiAgICBbZXhwb3J0Q29udGV4dF06IGN0eCxcbiAgICBbcmVnaXN0ZXJFeHBvcnRdKGN0eDIpIHtcbiAgICAgIGN0eDIucGVuZGluZ0h0dHBSb3V0ZXMucHVzaCguLi5yb3V0ZXIuaW50b1JvdXRlcygpKTtcbiAgICB9XG4gIH07XG59XG5mdW5jdGlvbiByZWdpc3Rlckh0dHBIYW5kbGVyKGN0eCwgZXhwb3J0TmFtZSwgZm4sIG9wdHMpIHtcbiAgY3R4LmRlZmluZUh0dHBIYW5kbGVyKGV4cG9ydE5hbWUpO1xuICBjdHgubW9kdWxlRGVmLmh0dHBIYW5kbGVycy5wdXNoKHsgc291cmNlTmFtZTogZXhwb3J0TmFtZSB9KTtcbiAgaWYgKG9wdHM/Lm5hbWUgIT0gbnVsbCkge1xuICAgIGN0eC5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goe1xuICAgICAgdGFnOiBcIkZ1bmN0aW9uXCIsXG4gICAgICB2YWx1ZToge1xuICAgICAgICBzb3VyY2VOYW1lOiBleHBvcnROYW1lLFxuICAgICAgICBjYW5vbmljYWxOYW1lOiBvcHRzLm5hbWVcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICBpZiAoIWZuLm5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sIFwibmFtZVwiLCB7IHZhbHVlOiBleHBvcnROYW1lLCB3cml0YWJsZTogZmFsc2UgfSk7XG4gIH1cbiAgY3R4Lmh0dHBIYW5kbGVycy5wdXNoKGZuKTtcbn1cblxuLy8gc3JjL3NlcnZlci9odHRwX2ludGVybmFsLnRzXG52YXIgaW1wb3J0X3N0YXR1c2VzID0gX190b0VTTShyZXF1aXJlX3N0YXR1c2VzKCkpO1xuXG4vLyBzcmMvc2VydmVyL3JhbmdlLnRzXG52YXIgUmFuZ2UgPSBjbGFzcyB7XG4gICNmcm9tO1xuICAjdG87XG4gIGNvbnN0cnVjdG9yKGZyb20sIHRvKSB7XG4gICAgdGhpcy4jZnJvbSA9IGZyb20gPz8geyB0YWc6IFwidW5ib3VuZGVkXCIgfTtcbiAgICB0aGlzLiN0byA9IHRvID8/IHsgdGFnOiBcInVuYm91bmRlZFwiIH07XG4gIH1cbiAgZ2V0IGZyb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuI2Zyb207XG4gIH1cbiAgZ2V0IHRvKCkge1xuICAgIHJldHVybiB0aGlzLiN0bztcbiAgfVxufTtcblxuLy8gc3JjL2xpYi90YWJsZS50c1xuZnVuY3Rpb24gdGFibGUob3B0cywgcm93LCAuLi5fKSB7XG4gIGNvbnN0IHtcbiAgICBuYW1lLFxuICAgIHB1YmxpYzogaXNQdWJsaWMgPSBmYWxzZSxcbiAgICBpbmRleGVzOiB1c2VySW5kZXhlcyA9IFtdLFxuICAgIHNjaGVkdWxlZCxcbiAgICBldmVudDogaXNFdmVudCA9IGZhbHNlXG4gIH0gPSBvcHRzO1xuICBjb25zdCBjb2xJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBjb25zdCBjb2xOYW1lTGlzdCA9IFtdO1xuICBpZiAoIShyb3cgaW5zdGFuY2VvZiBSb3dCdWlsZGVyKSkge1xuICAgIHJvdyA9IG5ldyBSb3dCdWlsZGVyKHJvdyk7XG4gIH1cbiAgcm93LmFsZ2VicmFpY1R5cGUudmFsdWUuZWxlbWVudHMuZm9yRWFjaCgoZWxlbSwgaSkgPT4ge1xuICAgIGNvbElkcy5zZXQoZWxlbS5uYW1lLCBpKTtcbiAgICBjb2xOYW1lTGlzdC5wdXNoKGVsZW0ubmFtZSk7XG4gIH0pO1xuICBjb25zdCBwayA9IFtdO1xuICBjb25zdCBpbmRleGVzID0gW107XG4gIGNvbnN0IGNvbnN0cmFpbnRzID0gW107XG4gIGNvbnN0IHNlcXVlbmNlcyA9IFtdO1xuICBsZXQgc2NoZWR1bGVBdENvbDtcbiAgY29uc3QgZGVmYXVsdFZhbHVlcyA9IFtdO1xuICBmb3IgKGNvbnN0IFtuYW1lMiwgYnVpbGRlcl0gb2YgT2JqZWN0LmVudHJpZXMocm93LnJvdykpIHtcbiAgICBjb25zdCBtZXRhID0gYnVpbGRlci5jb2x1bW5NZXRhZGF0YTtcbiAgICBpZiAobWV0YS5pc1ByaW1hcnlLZXkpIHtcbiAgICAgIHBrLnB1c2goY29sSWRzLmdldChuYW1lMikpO1xuICAgIH1cbiAgICBjb25zdCBpc1VuaXF1ZSA9IG1ldGEuaXNVbmlxdWUgfHwgbWV0YS5pc1ByaW1hcnlLZXk7XG4gICAgaWYgKG1ldGEuaW5kZXhUeXBlIHx8IGlzVW5pcXVlKSB7XG4gICAgICBjb25zdCBhbGdvID0gbWV0YS5pbmRleFR5cGUgPz8gXCJidHJlZVwiO1xuICAgICAgY29uc3QgaWQgPSBjb2xJZHMuZ2V0KG5hbWUyKTtcbiAgICAgIGxldCBhbGdvcml0aG07XG4gICAgICBzd2l0Y2ggKGFsZ28pIHtcbiAgICAgICAgY2FzZSBcImJ0cmVlXCI6XG4gICAgICAgICAgYWxnb3JpdGhtID0gUmF3SW5kZXhBbGdvcml0aG0uQlRyZWUoW2lkXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJoYXNoXCI6XG4gICAgICAgICAgYWxnb3JpdGhtID0gUmF3SW5kZXhBbGdvcml0aG0uSGFzaChbaWRdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcImRpcmVjdFwiOlxuICAgICAgICAgIGFsZ29yaXRobSA9IFJhd0luZGV4QWxnb3JpdGhtLkRpcmVjdChpZCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpbmRleGVzLnB1c2goe1xuICAgICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICAgIC8vIFVubmFtZWQgaW5kZXhlcyB3aWxsIGJlIGFzc2lnbmVkIGEgZ2xvYmFsbHkgdW5pcXVlIG5hbWVcbiAgICAgICAgYWNjZXNzb3JOYW1lOiBuYW1lMixcbiAgICAgICAgYWxnb3JpdGhtXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKGlzVW5pcXVlKSB7XG4gICAgICBjb25zdHJhaW50cy5wdXNoKHtcbiAgICAgICAgc291cmNlTmFtZTogdm9pZCAwLFxuICAgICAgICBkYXRhOiB7IHRhZzogXCJVbmlxdWVcIiwgdmFsdWU6IHsgY29sdW1uczogW2NvbElkcy5nZXQobmFtZTIpXSB9IH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAobWV0YS5pc0F1dG9JbmNyZW1lbnQpIHtcbiAgICAgIHNlcXVlbmNlcy5wdXNoKHtcbiAgICAgICAgc291cmNlTmFtZTogdm9pZCAwLFxuICAgICAgICBzdGFydDogdm9pZCAwLFxuICAgICAgICBtaW5WYWx1ZTogdm9pZCAwLFxuICAgICAgICBtYXhWYWx1ZTogdm9pZCAwLFxuICAgICAgICBjb2x1bW46IGNvbElkcy5nZXQobmFtZTIpLFxuICAgICAgICBpbmNyZW1lbnQ6IDFuXG4gICAgICB9KTtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtZXRhLCBcImRlZmF1bHRWYWx1ZVwiKSkge1xuICAgICAgY29uc3Qgd3JpdGVyID0gbmV3IEJpbmFyeVdyaXRlcigxNik7XG4gICAgICBidWlsZGVyLnNlcmlhbGl6ZSh3cml0ZXIsIG1ldGEuZGVmYXVsdFZhbHVlKTtcbiAgICAgIGRlZmF1bHRWYWx1ZXMucHVzaCh7XG4gICAgICAgIGNvbElkOiBjb2xJZHMuZ2V0KG5hbWUyKSxcbiAgICAgICAgdmFsdWU6IHdyaXRlci5nZXRCdWZmZXIoKVxuICAgICAgfSk7XG4gICAgfVxuICAgIGNvbnN0IGFsZ2VicmFpY1R5cGUgPSBidWlsZGVyLnR5cGVCdWlsZGVyLmFsZ2VicmFpY1R5cGU7XG4gICAgaWYgKHNjaGVkdWxlX2F0X2RlZmF1bHQuaXNTY2hlZHVsZUF0KGFsZ2VicmFpY1R5cGUpKSB7XG4gICAgICBzY2hlZHVsZUF0Q29sID0gY29sSWRzLmdldChuYW1lMik7XG4gICAgfVxuICB9XG4gIGZvciAoY29uc3QgaW5kZXhPcHRzIG9mIHVzZXJJbmRleGVzID8/IFtdKSB7XG4gICAgY29uc3QgYWNjZXNzb3IgPSBpbmRleE9wdHMuYWNjZXNzb3I7XG4gICAgaWYgKHR5cGVvZiBhY2Nlc3NvciAhPT0gXCJzdHJpbmdcIiB8fCBhY2Nlc3Nvci5sZW5ndGggPT09IDApIHtcbiAgICAgIGNvbnN0IHRhYmxlTGFiZWwgPSBuYW1lID8/IFwiPHVubmFtZWQ+XCI7XG4gICAgICBjb25zdCBpbmRleExhYmVsID0gaW5kZXhPcHRzLm5hbWUgPz8gXCI8dW5uYW1lZD5cIjtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIGBJbmRleCAnJHtpbmRleExhYmVsfScgb24gdGFibGUgJyR7dGFibGVMYWJlbH0nIG11c3QgZGVmaW5lIGEgbm9uLWVtcHR5ICdhY2Nlc3NvcidgXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgYWxnb3JpdGhtO1xuICAgIHN3aXRjaCAoaW5kZXhPcHRzLmFsZ29yaXRobSkge1xuICAgICAgY2FzZSBcImJ0cmVlXCI6XG4gICAgICAgIGFsZ29yaXRobSA9IHtcbiAgICAgICAgICB0YWc6IFwiQlRyZWVcIixcbiAgICAgICAgICB2YWx1ZTogaW5kZXhPcHRzLmNvbHVtbnMubWFwKChjKSA9PiBjb2xJZHMuZ2V0KGMpKVxuICAgICAgICB9O1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJoYXNoXCI6XG4gICAgICAgIGFsZ29yaXRobSA9IHtcbiAgICAgICAgICB0YWc6IFwiSGFzaFwiLFxuICAgICAgICAgIHZhbHVlOiBpbmRleE9wdHMuY29sdW1ucy5tYXAoKGMpID0+IGNvbElkcy5nZXQoYykpXG4gICAgICAgIH07XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImRpcmVjdFwiOlxuICAgICAgICBhbGdvcml0aG0gPSB7IHRhZzogXCJEaXJlY3RcIiwgdmFsdWU6IGNvbElkcy5nZXQoaW5kZXhPcHRzLmNvbHVtbikgfTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGluZGV4ZXMucHVzaCh7XG4gICAgICBzb3VyY2VOYW1lOiB2b2lkIDAsXG4gICAgICBhY2Nlc3Nvck5hbWU6IGFjY2Vzc29yLFxuICAgICAgYWxnb3JpdGhtLFxuICAgICAgY2Fub25pY2FsTmFtZTogaW5kZXhPcHRzLm5hbWVcbiAgICB9KTtcbiAgfVxuICBmb3IgKGNvbnN0IGNvbnN0cmFpbnRPcHRzIG9mIG9wdHMuY29uc3RyYWludHMgPz8gW10pIHtcbiAgICBpZiAoY29uc3RyYWludE9wdHMuY29uc3RyYWludCA9PT0gXCJ1bmlxdWVcIikge1xuICAgICAgY29uc3QgZGF0YSA9IHtcbiAgICAgICAgdGFnOiBcIlVuaXF1ZVwiLFxuICAgICAgICB2YWx1ZTogeyBjb2x1bW5zOiBjb25zdHJhaW50T3B0cy5jb2x1bW5zLm1hcCgoYykgPT4gY29sSWRzLmdldChjKSkgfVxuICAgICAgfTtcbiAgICAgIGNvbnN0cmFpbnRzLnB1c2goeyBzb3VyY2VOYW1lOiBjb25zdHJhaW50T3B0cy5uYW1lLCBkYXRhIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICB9XG4gIGNvbnN0IHByb2R1Y3RUeXBlID0gcm93LmFsZ2VicmFpY1R5cGUudmFsdWU7XG4gIGNvbnN0IHNjaGVkdWxlID0gc2NoZWR1bGVkICYmIHNjaGVkdWxlQXRDb2wgIT09IHZvaWQgMCA/IHsgc2NoZWR1bGVBdENvbCwgcmVkdWNlcjogc2NoZWR1bGVkIH0gOiB2b2lkIDA7XG4gIHJldHVybiB7XG4gICAgcm93VHlwZTogcm93LFxuICAgIHRhYmxlTmFtZTogbmFtZSxcbiAgICByb3dTcGFjZXRpbWVUeXBlOiBwcm9kdWN0VHlwZSxcbiAgICB0YWJsZURlZjogKGN0eCwgYWNjTmFtZSkgPT4ge1xuICAgICAgY29uc3QgdGFibGVOYW1lID0gbmFtZSA/PyBhY2NOYW1lO1xuICAgICAgaWYgKHJvdy50eXBlTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHJvdy50eXBlTmFtZSA9IHRvUGFzY2FsQ2FzZSh0YWJsZU5hbWUpO1xuICAgICAgfVxuICAgICAgZm9yIChjb25zdCBpbmRleCBvZiBpbmRleGVzKSB7XG4gICAgICAgIGNvbnN0IGNvbHMgPSBpbmRleC5hbGdvcml0aG0udGFnID09PSBcIkRpcmVjdFwiID8gW2luZGV4LmFsZ29yaXRobS52YWx1ZV0gOiBpbmRleC5hbGdvcml0aG0udmFsdWU7XG4gICAgICAgIGNvbnN0IGNvbFMgPSBjb2xzLm1hcCgoaSkgPT4gY29sTmFtZUxpc3RbaV0pLmpvaW4oXCJfXCIpO1xuICAgICAgICBjb25zdCBzb3VyY2VOYW1lID0gaW5kZXguc291cmNlTmFtZSA9IGAke2FjY05hbWV9XyR7Y29sU31faWR4XyR7aW5kZXguYWxnb3JpdGhtLnRhZy50b0xvd2VyQ2FzZSgpfWA7XG4gICAgICAgIGNvbnN0IHsgY2Fub25pY2FsTmFtZSB9ID0gaW5kZXg7XG4gICAgICAgIGlmIChjYW5vbmljYWxOYW1lICE9PSB2b2lkIDApIHtcbiAgICAgICAgICBjdHgubW9kdWxlRGVmLmV4cGxpY2l0TmFtZXMuZW50cmllcy5wdXNoKFxuICAgICAgICAgICAgRXhwbGljaXROYW1lRW50cnkuSW5kZXgoeyBzb3VyY2VOYW1lLCBjYW5vbmljYWxOYW1lIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc291cmNlTmFtZTogYWNjTmFtZSxcbiAgICAgICAgcHJvZHVjdFR5cGVSZWY6IGN0eC5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkocm93KS5yZWYsXG4gICAgICAgIHByaW1hcnlLZXk6IHBrLFxuICAgICAgICBpbmRleGVzLFxuICAgICAgICBjb25zdHJhaW50cyxcbiAgICAgICAgc2VxdWVuY2VzLFxuICAgICAgICB0YWJsZVR5cGU6IHsgdGFnOiBcIlVzZXJcIiB9LFxuICAgICAgICB0YWJsZUFjY2VzczogeyB0YWc6IGlzUHVibGljID8gXCJQdWJsaWNcIiA6IFwiUHJpdmF0ZVwiIH0sXG4gICAgICAgIGRlZmF1bHRWYWx1ZXMsXG4gICAgICAgIGlzRXZlbnRcbiAgICAgIH07XG4gICAgfSxcbiAgICAvLyBQcmVzZXJ2ZSB0aGUgZGVjbGFyZWQgaW5kZXggb3B0aW9ucyBhcyBydW50aW1lIGRhdGEgc28gYHRhYmxlVG9TY2hlbWFgXG4gICAgLy8gY2FuIGV4cG9zZSB0aGVtIHdpdGhvdXQgdHlwZS1zbXVnZ2xpbmcuXG4gICAgaWR4czogdXNlckluZGV4ZXMsXG4gICAgY29uc3RyYWludHMsXG4gICAgc2NoZWR1bGVBdENvbCxcbiAgICBzY2hlZHVsZVxuICB9O1xufVxuXG4vLyBzcmMvbGliL3F1ZXJ5LnRzXG52YXIgUXVlcnlCcmFuZCA9IFN5bWJvbChcIlF1ZXJ5QnJhbmRcIik7XG52YXIgaXNSb3dUeXBlZFF1ZXJ5ID0gKHZhbCkgPT4gISF2YWwgJiYgdHlwZW9mIHZhbCA9PT0gXCJvYmplY3RcIiAmJiBRdWVyeUJyYW5kIGluIHZhbDtcbnZhciBpc1R5cGVkUXVlcnkgPSAodmFsKSA9PiAhIXZhbCAmJiB0eXBlb2YgdmFsID09PSBcIm9iamVjdFwiICYmIFF1ZXJ5QnJhbmQgaW4gdmFsO1xuZnVuY3Rpb24gdG9TcWwocSkge1xuICByZXR1cm4gcS50b1NxbCgpO1xufVxudmFyIFNlbWlqb2luSW1wbCA9IGNsYXNzIF9TZW1pam9pbkltcGwge1xuICBjb25zdHJ1Y3Rvcihzb3VyY2VRdWVyeSwgZmlsdGVyUXVlcnksIGpvaW5Db25kaXRpb24pIHtcbiAgICB0aGlzLnNvdXJjZVF1ZXJ5ID0gc291cmNlUXVlcnk7XG4gICAgdGhpcy5maWx0ZXJRdWVyeSA9IGZpbHRlclF1ZXJ5O1xuICAgIHRoaXMuam9pbkNvbmRpdGlvbiA9IGpvaW5Db25kaXRpb247XG4gICAgaWYgKHNvdXJjZVF1ZXJ5LnRhYmxlLnNvdXJjZU5hbWUgPT09IGZpbHRlclF1ZXJ5LnRhYmxlLnNvdXJjZU5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBzZW1pam9pbiBhIHRhYmxlIHRvIGl0c2VsZlwiKTtcbiAgICB9XG4gIH1cbiAgW1F1ZXJ5QnJhbmRdID0gdHJ1ZTtcbiAgdHlwZSA9IFwic2VtaWpvaW5cIjtcbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbiAgd2hlcmUocHJlZGljYXRlKSB7XG4gICAgY29uc3QgbmV4dFNvdXJjZVF1ZXJ5ID0gdGhpcy5zb3VyY2VRdWVyeS53aGVyZShwcmVkaWNhdGUpO1xuICAgIHJldHVybiBuZXcgX1NlbWlqb2luSW1wbChcbiAgICAgIG5leHRTb3VyY2VRdWVyeSxcbiAgICAgIHRoaXMuZmlsdGVyUXVlcnksXG4gICAgICB0aGlzLmpvaW5Db25kaXRpb25cbiAgICApO1xuICB9XG4gIHRvU3FsKCkge1xuICAgIGNvbnN0IGxlZnQgPSB0aGlzLmZpbHRlclF1ZXJ5O1xuICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy5zb3VyY2VRdWVyeTtcbiAgICBjb25zdCBsZWZ0VGFibGUgPSBxdW90ZUlkZW50aWZpZXIobGVmdC50YWJsZS5zb3VyY2VOYW1lKTtcbiAgICBjb25zdCByaWdodFRhYmxlID0gcXVvdGVJZGVudGlmaWVyKHJpZ2h0LnRhYmxlLnNvdXJjZU5hbWUpO1xuICAgIGxldCBzcWwgPSBgU0VMRUNUICR7cmlnaHRUYWJsZX0uKiBGUk9NICR7bGVmdFRhYmxlfSBKT0lOICR7cmlnaHRUYWJsZX0gT04gJHtib29sZWFuRXhwclRvU3FsKHRoaXMuam9pbkNvbmRpdGlvbil9YDtcbiAgICBjb25zdCBjbGF1c2VzID0gW107XG4gICAgaWYgKGxlZnQud2hlcmVDbGF1c2UpIHtcbiAgICAgIGNsYXVzZXMucHVzaChib29sZWFuRXhwclRvU3FsKGxlZnQud2hlcmVDbGF1c2UpKTtcbiAgICB9XG4gICAgaWYgKHJpZ2h0LndoZXJlQ2xhdXNlKSB7XG4gICAgICBjbGF1c2VzLnB1c2goYm9vbGVhbkV4cHJUb1NxbChyaWdodC53aGVyZUNsYXVzZSkpO1xuICAgIH1cbiAgICBpZiAoY2xhdXNlcy5sZW5ndGggPiAwKSB7XG4gICAgICBjb25zdCB3aGVyZVNxbCA9IGNsYXVzZXMubGVuZ3RoID09PSAxID8gY2xhdXNlc1swXSA6IGNsYXVzZXMubWFwKHdyYXBJblBhcmVucykuam9pbihcIiBBTkQgXCIpO1xuICAgICAgc3FsICs9IGAgV0hFUkUgJHt3aGVyZVNxbH1gO1xuICAgIH1cbiAgICByZXR1cm4gc3FsO1xuICB9XG59O1xudmFyIEZyb21CdWlsZGVyID0gY2xhc3MgX0Zyb21CdWlsZGVyIHtcbiAgY29uc3RydWN0b3IodGFibGUyLCB3aGVyZUNsYXVzZSkge1xuICAgIHRoaXMudGFibGUgPSB0YWJsZTI7XG4gICAgdGhpcy53aGVyZUNsYXVzZSA9IHdoZXJlQ2xhdXNlO1xuICB9XG4gIFtRdWVyeUJyYW5kXSA9IHRydWU7XG4gIHdoZXJlKHByZWRpY2F0ZSkge1xuICAgIGNvbnN0IG5ld0NvbmRpdGlvbiA9IG5vcm1hbGl6ZVByZWRpY2F0ZUV4cHIocHJlZGljYXRlKHRoaXMudGFibGUuY29scykpO1xuICAgIGNvbnN0IG5leHRXaGVyZSA9IHRoaXMud2hlcmVDbGF1c2UgPyB0aGlzLndoZXJlQ2xhdXNlLmFuZChuZXdDb25kaXRpb24pIDogbmV3Q29uZGl0aW9uO1xuICAgIHJldHVybiBuZXcgX0Zyb21CdWlsZGVyKHRoaXMudGFibGUsIG5leHRXaGVyZSk7XG4gIH1cbiAgcmlnaHRTZW1pam9pbihyaWdodCwgb24pIHtcbiAgICBjb25zdCBzb3VyY2VRdWVyeSA9IG5ldyBfRnJvbUJ1aWxkZXIocmlnaHQpO1xuICAgIGNvbnN0IGpvaW5Db25kaXRpb24gPSBvbihcbiAgICAgIHRoaXMudGFibGUuaW5kZXhlZENvbHMsXG4gICAgICByaWdodC5pbmRleGVkQ29sc1xuICAgICk7XG4gICAgcmV0dXJuIG5ldyBTZW1pam9pbkltcGwoc291cmNlUXVlcnksIHRoaXMsIGpvaW5Db25kaXRpb24pO1xuICB9XG4gIGxlZnRTZW1pam9pbihyaWdodCwgb24pIHtcbiAgICBjb25zdCBmaWx0ZXJRdWVyeSA9IG5ldyBfRnJvbUJ1aWxkZXIocmlnaHQpO1xuICAgIGNvbnN0IGpvaW5Db25kaXRpb24gPSBvbihcbiAgICAgIHRoaXMudGFibGUuaW5kZXhlZENvbHMsXG4gICAgICByaWdodC5pbmRleGVkQ29sc1xuICAgICk7XG4gICAgcmV0dXJuIG5ldyBTZW1pam9pbkltcGwodGhpcywgZmlsdGVyUXVlcnksIGpvaW5Db25kaXRpb24pO1xuICB9XG4gIHRvU3FsKCkge1xuICAgIHJldHVybiByZW5kZXJTZWxlY3RTcWxXaXRoSm9pbnModGhpcy50YWJsZSwgdGhpcy53aGVyZUNsYXVzZSk7XG4gIH1cbiAgYnVpbGQoKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn07XG52YXIgVGFibGVSZWZJbXBsID0gY2xhc3Mge1xuICBbUXVlcnlCcmFuZF0gPSB0cnVlO1xuICB0eXBlID0gXCJ0YWJsZVwiO1xuICBzb3VyY2VOYW1lO1xuICBhY2Nlc3Nvck5hbWU7XG4gIGNvbHM7XG4gIGluZGV4ZWRDb2xzO1xuICB0YWJsZURlZjtcbiAgLy8gRGVsZWdhdGUgVW50eXBlZFRhYmxlRGVmIHByb3BlcnRpZXMgZnJvbSB0YWJsZURlZiBzbyB0aGlzIGNhbiBiZSB1c2VkIGFzIGEgdGFibGUgZGVmLlxuICBnZXQgY29sdW1ucygpIHtcbiAgICByZXR1cm4gdGhpcy50YWJsZURlZi5jb2x1bW5zO1xuICB9XG4gIGdldCBpbmRleGVzKCkge1xuICAgIHJldHVybiB0aGlzLnRhYmxlRGVmLmluZGV4ZXM7XG4gIH1cbiAgZ2V0IHJvd1R5cGUoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVEZWYucm93VHlwZTtcbiAgfVxuICBnZXQgY29uc3RyYWludHMoKSB7XG4gICAgcmV0dXJuIHRoaXMudGFibGVEZWYuY29uc3RyYWludHM7XG4gIH1cbiAgY29uc3RydWN0b3IodGFibGVEZWYpIHtcbiAgICB0aGlzLnNvdXJjZU5hbWUgPSB0YWJsZURlZi5zb3VyY2VOYW1lO1xuICAgIHRoaXMuYWNjZXNzb3JOYW1lID0gdGFibGVEZWYuYWNjZXNzb3JOYW1lO1xuICAgIHRoaXMuY29scyA9IGNyZWF0ZVJvd0V4cHIodGFibGVEZWYpO1xuICAgIHRoaXMuaW5kZXhlZENvbHMgPSB0aGlzLmNvbHM7XG4gICAgdGhpcy50YWJsZURlZiA9IHRhYmxlRGVmO1xuICAgIE9iamVjdC5mcmVlemUodGhpcyk7XG4gIH1cbiAgYXNGcm9tKCkge1xuICAgIHJldHVybiBuZXcgRnJvbUJ1aWxkZXIodGhpcyk7XG4gIH1cbiAgcmlnaHRTZW1pam9pbihvdGhlciwgb24pIHtcbiAgICByZXR1cm4gdGhpcy5hc0Zyb20oKS5yaWdodFNlbWlqb2luKG90aGVyLCBvbik7XG4gIH1cbiAgbGVmdFNlbWlqb2luKG90aGVyLCBvbikge1xuICAgIHJldHVybiB0aGlzLmFzRnJvbSgpLmxlZnRTZW1pam9pbihvdGhlciwgb24pO1xuICB9XG4gIGJ1aWxkKCkge1xuICAgIHJldHVybiB0aGlzLmFzRnJvbSgpLmJ1aWxkKCk7XG4gIH1cbiAgdG9TcWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYXNGcm9tKCkudG9TcWwoKTtcbiAgfVxuICB3aGVyZShwcmVkaWNhdGUpIHtcbiAgICByZXR1cm4gdGhpcy5hc0Zyb20oKS53aGVyZShwcmVkaWNhdGUpO1xuICB9XG59O1xuZnVuY3Rpb24gY3JlYXRlVGFibGVSZWZGcm9tRGVmKHRhYmxlRGVmKSB7XG4gIHJldHVybiBuZXcgVGFibGVSZWZJbXBsKHRhYmxlRGVmKTtcbn1cbmZ1bmN0aW9uIG1ha2VRdWVyeUJ1aWxkZXIoc2NoZW1hMikge1xuICBjb25zdCBxYiA9IC8qIEBfX1BVUkVfXyAqLyBPYmplY3QuY3JlYXRlKG51bGwpO1xuICBmb3IgKGNvbnN0IHRhYmxlMiBvZiBPYmplY3QudmFsdWVzKHNjaGVtYTIudGFibGVzKSkge1xuICAgIGNvbnN0IHJlZiA9IGNyZWF0ZVRhYmxlUmVmRnJvbURlZihcbiAgICAgIHRhYmxlMlxuICAgICk7XG4gICAgcWJbdGFibGUyLmFjY2Vzc29yTmFtZV0gPSByZWY7XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUocWIpO1xufVxuZnVuY3Rpb24gbWFrZUZyb21CdWlsZGVyKHRhYmxlcykge1xuICBjb25zdCByZXN1bHQgPSAvKiBAX19QVVJFX18gKi8gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgY29uc3QgbmFtZXNwYWNlcyA9IC8qIEBfX1BVUkVfXyAqLyBPYmplY3QuY3JlYXRlKFxuICAgIG51bGxcbiAgKTtcbiAgZm9yIChjb25zdCB0YWJsZTIgb2YgT2JqZWN0LnZhbHVlcyh0YWJsZXMpKSB7XG4gICAgY29uc3QgZG90SWR4ID0gdGFibGUyLnNvdXJjZU5hbWUuaW5kZXhPZihcIi5cIik7XG4gICAgaWYgKGRvdElkeCA9PT0gLTEpIHtcbiAgICAgIHJlc3VsdFt0YWJsZTIuYWNjZXNzb3JOYW1lXSA9IGNyZWF0ZVRhYmxlUmVmRnJvbURlZih0YWJsZTIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBucyA9IHRhYmxlMi5zb3VyY2VOYW1lLnNsaWNlKDAsIGRvdElkeCk7XG4gICAgICBjb25zdCBrZXkgPSB0YWJsZTIuc291cmNlTmFtZS5zbGljZShkb3RJZHggKyAxKTtcbiAgICAgIChuYW1lc3BhY2VzW25zXSA/Pz0gLyogQF9fUFVSRV9fICovIE9iamVjdC5jcmVhdGUobnVsbCkpW2tleV0gPSBjcmVhdGVUYWJsZVJlZkZyb21EZWYoXG4gICAgICAgIHRhYmxlMlxuICAgICAgKTtcbiAgICB9XG4gIH1cbiAgZm9yIChjb25zdCBbbnMsIG5zVGFibGVzXSBvZiBPYmplY3QuZW50cmllcyhuYW1lc3BhY2VzKSkge1xuICAgIHJlc3VsdFtuc10gPSBPYmplY3QuZnJlZXplKG5zVGFibGVzKTtcbiAgfVxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShyZXN1bHQpO1xufVxuZnVuY3Rpb24gY3JlYXRlUm93RXhwcih0YWJsZURlZikge1xuICBjb25zdCByb3cgPSB7fTtcbiAgZm9yIChjb25zdCBjb2x1bW5OYW1lIG9mIE9iamVjdC5rZXlzKHRhYmxlRGVmLmNvbHVtbnMpKSB7XG4gICAgY29uc3QgY29sdW1uQnVpbGRlciA9IHRhYmxlRGVmLmNvbHVtbnNbY29sdW1uTmFtZV07XG4gICAgY29uc3QgY29sdW1uID0gbmV3IENvbHVtbkV4cHJlc3Npb24oXG4gICAgICB0YWJsZURlZi5zb3VyY2VOYW1lLFxuICAgICAgY29sdW1uTmFtZSxcbiAgICAgIGNvbHVtbkJ1aWxkZXIudHlwZUJ1aWxkZXIuYWxnZWJyYWljVHlwZSxcbiAgICAgIGNvbHVtbkJ1aWxkZXIuY29sdW1uTWV0YWRhdGEubmFtZVxuICAgICk7XG4gICAgcm93W2NvbHVtbk5hbWVdID0gT2JqZWN0LmZyZWV6ZShjb2x1bW4pO1xuICB9XG4gIHJldHVybiBPYmplY3QuZnJlZXplKHJvdyk7XG59XG5mdW5jdGlvbiByZW5kZXJTZWxlY3RTcWxXaXRoSm9pbnModGFibGUyLCB3aGVyZSwgZXh0cmFDbGF1c2VzID0gW10pIHtcbiAgY29uc3QgcXVvdGVkVGFibGUgPSBxdW90ZUlkZW50aWZpZXIodGFibGUyLnNvdXJjZU5hbWUpO1xuICBjb25zdCBzcWwgPSBgU0VMRUNUICogRlJPTSAke3F1b3RlZFRhYmxlfWA7XG4gIGNvbnN0IGNsYXVzZXMgPSBbXTtcbiAgaWYgKHdoZXJlKSBjbGF1c2VzLnB1c2goYm9vbGVhbkV4cHJUb1NxbCh3aGVyZSkpO1xuICBjbGF1c2VzLnB1c2goLi4uZXh0cmFDbGF1c2VzKTtcbiAgaWYgKGNsYXVzZXMubGVuZ3RoID09PSAwKSByZXR1cm4gc3FsO1xuICBjb25zdCB3aGVyZVNxbCA9IGNsYXVzZXMubGVuZ3RoID09PSAxID8gY2xhdXNlc1swXSA6IGNsYXVzZXMubWFwKHdyYXBJblBhcmVucykuam9pbihcIiBBTkQgXCIpO1xuICByZXR1cm4gYCR7c3FsfSBXSEVSRSAke3doZXJlU3FsfWA7XG59XG52YXIgQ29sdW1uRXhwcmVzc2lvbiA9IGNsYXNzIHtcbiAgdHlwZSA9IFwiY29sdW1uXCI7XG4gIC8vIFRoaXMgaXMgdGhlIGNvbHVtbiBhY2Nlc3NvclxuICBjb2x1bW47XG4gIC8vIFRoZSBuYW1lIG9mIHRoZSBjb2x1bW4gaW4gdGhlIGRhdGFiYXNlLlxuICBjb2x1bW5OYW1lO1xuICB0YWJsZTtcbiAgLy8gcGhhbnRvbTogYWN0dWFsIHJ1bnRpbWUgdmFsdWUgaXMgdW5kZWZpbmVkXG4gIHRzVmFsdWVUeXBlO1xuICBzcGFjZXRpbWVUeXBlO1xuICBjb25zdHJ1Y3Rvcih0YWJsZTIsIGNvbHVtbiwgc3BhY2V0aW1lVHlwZSwgY29sdW1uTmFtZSkge1xuICAgIHRoaXMudGFibGUgPSB0YWJsZTI7XG4gICAgdGhpcy5jb2x1bW4gPSBjb2x1bW47XG4gICAgdGhpcy5jb2x1bW5OYW1lID0gY29sdW1uTmFtZSB8fCBjb2x1bW47XG4gICAgdGhpcy5zcGFjZXRpbWVUeXBlID0gc3BhY2V0aW1lVHlwZTtcbiAgfVxuICBlcSh4KSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcImVxXCIsXG4gICAgICBsZWZ0OiB0aGlzLFxuICAgICAgcmlnaHQ6IG5vcm1hbGl6ZVZhbHVlKHgpXG4gICAgfSk7XG4gIH1cbiAgbmUoeCkge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJuZVwiLFxuICAgICAgbGVmdDogdGhpcyxcbiAgICAgIHJpZ2h0OiBub3JtYWxpemVWYWx1ZSh4KVxuICAgIH0pO1xuICB9XG4gIGx0KHgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwibHRcIixcbiAgICAgIGxlZnQ6IHRoaXMsXG4gICAgICByaWdodDogbm9ybWFsaXplVmFsdWUoeClcbiAgICB9KTtcbiAgfVxuICBsdGUoeCkge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJsdGVcIixcbiAgICAgIGxlZnQ6IHRoaXMsXG4gICAgICByaWdodDogbm9ybWFsaXplVmFsdWUoeClcbiAgICB9KTtcbiAgfVxuICBndCh4KSB7XG4gICAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7XG4gICAgICB0eXBlOiBcImd0XCIsXG4gICAgICBsZWZ0OiB0aGlzLFxuICAgICAgcmlnaHQ6IG5vcm1hbGl6ZVZhbHVlKHgpXG4gICAgfSk7XG4gIH1cbiAgZ3RlKHgpIHtcbiAgICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwiZ3RlXCIsXG4gICAgICBsZWZ0OiB0aGlzLFxuICAgICAgcmlnaHQ6IG5vcm1hbGl6ZVZhbHVlKHgpXG4gICAgfSk7XG4gIH1cbn07XG5mdW5jdGlvbiBsaXRlcmFsKHZhbHVlKSB7XG4gIHJldHVybiB7IHR5cGU6IFwibGl0ZXJhbFwiLCB2YWx1ZSB9O1xufVxuZnVuY3Rpb24gbm9ybWFsaXplVmFsdWUodmFsKSB7XG4gIGlmICh2YWwudHlwZSA9PT0gXCJsaXRlcmFsXCIpXG4gICAgcmV0dXJuIHZhbDtcbiAgaWYgKHR5cGVvZiB2YWwgPT09IFwib2JqZWN0XCIgJiYgdmFsICE9IG51bGwgJiYgXCJ0eXBlXCIgaW4gdmFsICYmIHZhbC50eXBlID09PSBcImNvbHVtblwiKSB7XG4gICAgcmV0dXJuIHZhbDtcbiAgfVxuICByZXR1cm4gbGl0ZXJhbCh2YWwpO1xufVxuZnVuY3Rpb24gbm9ybWFsaXplUHJlZGljYXRlRXhwcih2YWx1ZSkge1xuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBCb29sZWFuRXhwcikgcmV0dXJuIHZhbHVlO1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcImJvb2xlYW5cIikge1xuICAgIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJlcVwiLFxuICAgICAgbGVmdDogbGl0ZXJhbCh2YWx1ZSksXG4gICAgICByaWdodDogbGl0ZXJhbCh0cnVlKVxuICAgIH0pO1xuICB9XG4gIHJldHVybiBuZXcgQm9vbGVhbkV4cHIoe1xuICAgIHR5cGU6IFwiZXFcIixcbiAgICBsZWZ0OiB2YWx1ZSxcbiAgICByaWdodDogbGl0ZXJhbCh0cnVlKVxuICB9KTtcbn1cbnZhciBCb29sZWFuRXhwciA9IGNsYXNzIF9Cb29sZWFuRXhwciB7XG4gIGNvbnN0cnVjdG9yKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICB9XG4gIGFuZChvdGhlcikge1xuICAgIHJldHVybiBuZXcgX0Jvb2xlYW5FeHByKHtcbiAgICAgIHR5cGU6IFwiYW5kXCIsXG4gICAgICBjbGF1c2VzOiBbdGhpcy5kYXRhLCBvdGhlci5kYXRhXVxuICAgIH0pO1xuICB9XG4gIG9yKG90aGVyKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbGVhbkV4cHIoe1xuICAgICAgdHlwZTogXCJvclwiLFxuICAgICAgY2xhdXNlczogW3RoaXMuZGF0YSwgb3RoZXIuZGF0YV1cbiAgICB9KTtcbiAgfVxuICBub3QoKSB7XG4gICAgcmV0dXJuIG5ldyBfQm9vbGVhbkV4cHIoeyB0eXBlOiBcIm5vdFwiLCBjbGF1c2U6IHRoaXMuZGF0YSB9KTtcbiAgfVxufTtcbmZ1bmN0aW9uIG5vdChjbGF1c2UpIHtcbiAgcmV0dXJuIG5ldyBCb29sZWFuRXhwcih7IHR5cGU6IFwibm90XCIsIGNsYXVzZTogY2xhdXNlLmRhdGEgfSk7XG59XG5mdW5jdGlvbiBhbmQoZmlyc3QsIHNlY29uZCwgLi4ucmVzdCkge1xuICBjb25zdCBjbGF1c2VzID0gW2ZpcnN0LCBzZWNvbmQsIC4uLnJlc3RdO1xuICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICB0eXBlOiBcImFuZFwiLFxuICAgIGNsYXVzZXM6IGNsYXVzZXMubWFwKChjKSA9PiBjLmRhdGEpXG4gIH0pO1xufVxuZnVuY3Rpb24gb3IoZmlyc3QsIHNlY29uZCwgLi4ucmVzdCkge1xuICBjb25zdCBjbGF1c2VzID0gW2ZpcnN0LCBzZWNvbmQsIC4uLnJlc3RdO1xuICByZXR1cm4gbmV3IEJvb2xlYW5FeHByKHtcbiAgICB0eXBlOiBcIm9yXCIsXG4gICAgY2xhdXNlczogY2xhdXNlcy5tYXAoKGMpID0+IGMuZGF0YSlcbiAgfSk7XG59XG5mdW5jdGlvbiBib29sZWFuRXhwclRvU3FsKGV4cHIsIHRhYmxlQWxpYXMpIHtcbiAgY29uc3QgZGF0YSA9IGV4cHIgaW5zdGFuY2VvZiBCb29sZWFuRXhwciA/IGV4cHIuZGF0YSA6IGV4cHI7XG4gIHN3aXRjaCAoZGF0YS50eXBlKSB7XG4gICAgY2FzZSBcImVxXCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPSAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcIm5lXCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPD4gJHt2YWx1ZUV4cHJUb1NxbChkYXRhLnJpZ2h0KX1gO1xuICAgIGNhc2UgXCJndFwiOlxuICAgICAgcmV0dXJuIGAke3ZhbHVlRXhwclRvU3FsKGRhdGEubGVmdCl9ID4gJHt2YWx1ZUV4cHJUb1NxbChkYXRhLnJpZ2h0KX1gO1xuICAgIGNhc2UgXCJndGVcIjpcbiAgICAgIHJldHVybiBgJHt2YWx1ZUV4cHJUb1NxbChkYXRhLmxlZnQpfSA+PSAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcImx0XCI6XG4gICAgICByZXR1cm4gYCR7dmFsdWVFeHByVG9TcWwoZGF0YS5sZWZ0KX0gPCAke3ZhbHVlRXhwclRvU3FsKGRhdGEucmlnaHQpfWA7XG4gICAgY2FzZSBcImx0ZVwiOlxuICAgICAgcmV0dXJuIGAke3ZhbHVlRXhwclRvU3FsKGRhdGEubGVmdCl9IDw9ICR7dmFsdWVFeHByVG9TcWwoZGF0YS5yaWdodCl9YDtcbiAgICBjYXNlIFwiYW5kXCI6XG4gICAgICByZXR1cm4gZGF0YS5jbGF1c2VzLm1hcCgoYykgPT4gYm9vbGVhbkV4cHJUb1NxbChjKSkubWFwKHdyYXBJblBhcmVucykuam9pbihcIiBBTkQgXCIpO1xuICAgIGNhc2UgXCJvclwiOlxuICAgICAgcmV0dXJuIGRhdGEuY2xhdXNlcy5tYXAoKGMpID0+IGJvb2xlYW5FeHByVG9TcWwoYykpLm1hcCh3cmFwSW5QYXJlbnMpLmpvaW4oXCIgT1IgXCIpO1xuICAgIGNhc2UgXCJub3RcIjpcbiAgICAgIHJldHVybiBgTk9UICR7d3JhcEluUGFyZW5zKGJvb2xlYW5FeHByVG9TcWwoZGF0YS5jbGF1c2UpKX1gO1xuICB9XG59XG5mdW5jdGlvbiB3cmFwSW5QYXJlbnMoc3FsKSB7XG4gIHJldHVybiBgKCR7c3FsfSlgO1xufVxuZnVuY3Rpb24gdmFsdWVFeHByVG9TcWwoZXhwciwgdGFibGVBbGlhcykge1xuICBpZiAoaXNMaXRlcmFsRXhwcihleHByKSkge1xuICAgIHJldHVybiBsaXRlcmFsVmFsdWVUb1NxbChleHByLnZhbHVlKTtcbiAgfVxuICBjb25zdCB0YWJsZTIgPSBleHByLnRhYmxlO1xuICByZXR1cm4gYCR7cXVvdGVJZGVudGlmaWVyKHRhYmxlMil9LiR7cXVvdGVJZGVudGlmaWVyKGV4cHIuY29sdW1uTmFtZSl9YDtcbn1cbmZ1bmN0aW9uIGxpdGVyYWxWYWx1ZVRvU3FsKHZhbHVlKSB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdm9pZCAwKSB7XG4gICAgcmV0dXJuIFwiTlVMTFwiO1xuICB9XG4gIGlmICh2YWx1ZSBpbnN0YW5jZW9mIElkZW50aXR5IHx8IHZhbHVlIGluc3RhbmNlb2YgQ29ubmVjdGlvbklkIHx8IHZhbHVlIGluc3RhbmNlb2YgVXVpZCkge1xuICAgIHJldHVybiBgMHgke3ZhbHVlLnRvSGV4U3RyaW5nKCl9YDtcbiAgfVxuICBpZiAodmFsdWUgaW5zdGFuY2VvZiBUaW1lc3RhbXApIHtcbiAgICByZXR1cm4gYCcke3ZhbHVlLnRvSVNPU3RyaW5nKCl9J2A7XG4gIH1cbiAgc3dpdGNoICh0eXBlb2YgdmFsdWUpIHtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgY2FzZSBcImJpZ2ludFwiOlxuICAgICAgcmV0dXJuIFN0cmluZyh2YWx1ZSk7XG4gICAgY2FzZSBcImJvb2xlYW5cIjpcbiAgICAgIHJldHVybiB2YWx1ZSA/IFwiVFJVRVwiIDogXCJGQUxTRVwiO1xuICAgIGNhc2UgXCJzdHJpbmdcIjpcbiAgICAgIHJldHVybiBgJyR7dmFsdWUucmVwbGFjZSgvJy9nLCBcIicnXCIpfSdgO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gYCcke0pTT04uc3RyaW5naWZ5KHZhbHVlKS5yZXBsYWNlKC8nL2csIFwiJydcIil9J2A7XG4gIH1cbn1cbmZ1bmN0aW9uIHF1b3RlSWRlbnRpZmllcihuYW1lKSB7XG4gIHJldHVybiBuYW1lLnNwbGl0KFwiLlwiKS5tYXAoKHBhcnQpID0+IGBcIiR7cGFydC5yZXBsYWNlKC9cIi9nLCAnXCJcIicpfVwiYCkuam9pbihcIi5cIik7XG59XG5mdW5jdGlvbiBpc0xpdGVyYWxFeHByKGV4cHIpIHtcbiAgcmV0dXJuIGV4cHIudHlwZSA9PT0gXCJsaXRlcmFsXCI7XG59XG5mdW5jdGlvbiBldmFsdWF0ZUJvb2xlYW5FeHByKGV4cHIsIHJvdykge1xuICByZXR1cm4gZXZhbHVhdGVEYXRhKGV4cHIuZGF0YSwgcm93KTtcbn1cbmZ1bmN0aW9uIGV2YWx1YXRlRGF0YShkYXRhLCByb3cpIHtcbiAgc3dpdGNoIChkYXRhLnR5cGUpIHtcbiAgICBjYXNlIFwiZXFcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpID09PSByZXNvbHZlVmFsdWUoZGF0YS5yaWdodCwgcm93KTtcbiAgICBjYXNlIFwibmVcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpICE9PSByZXNvbHZlVmFsdWUoZGF0YS5yaWdodCwgcm93KTtcbiAgICBjYXNlIFwiZ3RcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpID4gcmVzb2x2ZVZhbHVlKGRhdGEucmlnaHQsIHJvdyk7XG4gICAgY2FzZSBcImd0ZVwiOlxuICAgICAgcmV0dXJuIHJlc29sdmVWYWx1ZShkYXRhLmxlZnQsIHJvdykgPj0gcmVzb2x2ZVZhbHVlKGRhdGEucmlnaHQsIHJvdyk7XG4gICAgY2FzZSBcImx0XCI6XG4gICAgICByZXR1cm4gcmVzb2x2ZVZhbHVlKGRhdGEubGVmdCwgcm93KSA8IHJlc29sdmVWYWx1ZShkYXRhLnJpZ2h0LCByb3cpO1xuICAgIGNhc2UgXCJsdGVcIjpcbiAgICAgIHJldHVybiByZXNvbHZlVmFsdWUoZGF0YS5sZWZ0LCByb3cpIDw9IHJlc29sdmVWYWx1ZShkYXRhLnJpZ2h0LCByb3cpO1xuICAgIGNhc2UgXCJhbmRcIjpcbiAgICAgIHJldHVybiBkYXRhLmNsYXVzZXMuZXZlcnkoKGMpID0+IGV2YWx1YXRlRGF0YShjLCByb3cpKTtcbiAgICBjYXNlIFwib3JcIjpcbiAgICAgIHJldHVybiBkYXRhLmNsYXVzZXMuc29tZSgoYykgPT4gZXZhbHVhdGVEYXRhKGMsIHJvdykpO1xuICAgIGNhc2UgXCJub3RcIjpcbiAgICAgIHJldHVybiAhZXZhbHVhdGVEYXRhKGRhdGEuY2xhdXNlLCByb3cpO1xuICB9XG59XG5mdW5jdGlvbiByZXNvbHZlVmFsdWUoZXhwciwgcm93KSB7XG4gIGlmIChpc0xpdGVyYWxFeHByKGV4cHIpKSB7XG4gICAgcmV0dXJuIHRvQ29tcGFyYWJsZVZhbHVlKGV4cHIudmFsdWUpO1xuICB9XG4gIHJldHVybiB0b0NvbXBhcmFibGVWYWx1ZShyb3dbZXhwci5jb2x1bW5dKTtcbn1cbmZ1bmN0aW9uIGlzSGV4U2VyaWFsaXphYmxlTGlrZSh2YWx1ZSkge1xuICByZXR1cm4gISF2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHZhbHVlLnRvSGV4U3RyaW5nID09PSBcImZ1bmN0aW9uXCI7XG59XG5mdW5jdGlvbiBpc1RpbWVzdGFtcExpa2UodmFsdWUpIHtcbiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIpIHJldHVybiBmYWxzZTtcbiAgaWYgKHZhbHVlIGluc3RhbmNlb2YgVGltZXN0YW1wKSByZXR1cm4gdHJ1ZTtcbiAgY29uc3QgbWljcm9zID0gdmFsdWVbXCJfX3RpbWVzdGFtcF9taWNyb3Nfc2luY2VfdW5peF9lcG9jaF9fXCJdO1xuICByZXR1cm4gdHlwZW9mIG1pY3JvcyA9PT0gXCJiaWdpbnRcIjtcbn1cbmZ1bmN0aW9uIHRvQ29tcGFyYWJsZVZhbHVlKHZhbHVlKSB7XG4gIGlmIChpc0hleFNlcmlhbGl6YWJsZUxpa2UodmFsdWUpKSB7XG4gICAgcmV0dXJuIHZhbHVlLnRvSGV4U3RyaW5nKCk7XG4gIH1cbiAgaWYgKGlzVGltZXN0YW1wTGlrZSh2YWx1ZSkpIHtcbiAgICByZXR1cm4gdmFsdWUuX190aW1lc3RhbXBfbWljcm9zX3NpbmNlX3VuaXhfZXBvY2hfXztcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5mdW5jdGlvbiBnZXRRdWVyeVRhYmxlTmFtZShxdWVyeSkge1xuICBpZiAocXVlcnkudGFibGUpIHJldHVybiBxdWVyeS50YWJsZS5uYW1lO1xuICBpZiAocXVlcnkubmFtZSkgcmV0dXJuIHF1ZXJ5Lm5hbWU7XG4gIGlmIChxdWVyeS5zb3VyY2VRdWVyeSkgcmV0dXJuIHF1ZXJ5LnNvdXJjZVF1ZXJ5LnRhYmxlLm5hbWU7XG4gIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBleHRyYWN0IHRhYmxlIG5hbWUgZnJvbSBxdWVyeVwiKTtcbn1cbmZ1bmN0aW9uIGdldFF1ZXJ5QWNjZXNzb3JOYW1lKHF1ZXJ5KSB7XG4gIGlmIChxdWVyeS50YWJsZSkgcmV0dXJuIHF1ZXJ5LnRhYmxlLmFjY2Vzc29yTmFtZTtcbiAgaWYgKHF1ZXJ5LmFjY2Vzc29yTmFtZSkgcmV0dXJuIHF1ZXJ5LmFjY2Vzc29yTmFtZTtcbiAgaWYgKHF1ZXJ5LnNvdXJjZVF1ZXJ5KSByZXR1cm4gcXVlcnkuc291cmNlUXVlcnkudGFibGUuYWNjZXNzb3JOYW1lO1xuICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZXh0cmFjdCBhY2Nlc3NvciBuYW1lIGZyb20gcXVlcnlcIik7XG59XG5mdW5jdGlvbiBnZXRRdWVyeVdoZXJlQ2xhdXNlKHF1ZXJ5KSB7XG4gIGlmIChxdWVyeS53aGVyZUNsYXVzZSkgcmV0dXJuIHF1ZXJ5LndoZXJlQ2xhdXNlO1xuICByZXR1cm4gdm9pZCAwO1xufVxuXG4vLyBzcmMvc2VydmVyL3ZpZXdzLnRzXG5mdW5jdGlvbiBtYWtlVmlld0V4cG9ydChjdHgsIG9wdHMsIHBhcmFtcywgcmV0LCBmbikge1xuICBjb25zdCB2aWV3RXhwb3J0ID0gKFxuICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgdHlwZXNjcmlwdCBpbmNvcnJlY3RseSBzYXlzIEZ1bmN0aW9uI2JpbmQgcmVxdWlyZXMgYW4gYXJndW1lbnQuXG4gICAgZm4uYmluZCgpXG4gICk7XG4gIHZpZXdFeHBvcnRbZXhwb3J0Q29udGV4dF0gPSBjdHg7XG4gIHZpZXdFeHBvcnRbcmVnaXN0ZXJFeHBvcnRdID0gKGN0eDIsIGV4cG9ydE5hbWUpID0+IHtcbiAgICByZWdpc3RlclZpZXcoY3R4Miwgb3B0cywgZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuKTtcbiAgfTtcbiAgcmV0dXJuIHZpZXdFeHBvcnQ7XG59XG5mdW5jdGlvbiBtYWtlQW5vblZpZXdFeHBvcnQoY3R4LCBvcHRzLCBwYXJhbXMsIHJldCwgZm4pIHtcbiAgY29uc3Qgdmlld0V4cG9ydCA9IChcbiAgICAvLyBAdHMtZXhwZWN0LWVycm9yIHR5cGVzY3JpcHQgaW5jb3JyZWN0bHkgc2F5cyBGdW5jdGlvbiNiaW5kIHJlcXVpcmVzIGFuIGFyZ3VtZW50LlxuICAgIGZuLmJpbmQoKVxuICApO1xuICB2aWV3RXhwb3J0W2V4cG9ydENvbnRleHRdID0gY3R4O1xuICB2aWV3RXhwb3J0W3JlZ2lzdGVyRXhwb3J0XSA9IChjdHgyLCBleHBvcnROYW1lKSA9PiB7XG4gICAgcmVnaXN0ZXJBbm9ueW1vdXNWaWV3KGN0eDIsIG9wdHMsIGV4cG9ydE5hbWUsIHBhcmFtcywgcmV0LCBmbik7XG4gIH07XG4gIHJldHVybiB2aWV3RXhwb3J0O1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJWaWV3KGN0eCwgb3B0cywgZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuKSB7XG4gIGNvbnN0IGRlc2NyaWJlZCA9IGRlc2NyaWJlVmlldyhjdHgsIG9wdHMsIGV4cG9ydE5hbWUsIGZhbHNlLCBwYXJhbXMsIHJldCk7XG4gIGN0eC52aWV3cy5wdXNoKGJ1aWxkVmlld0luZm8oY3R4LCBkZXNjcmliZWQsIGZuKSk7XG59XG5mdW5jdGlvbiByZWdpc3RlckFub255bW91c1ZpZXcoY3R4LCBvcHRzLCBleHBvcnROYW1lLCBwYXJhbXMsIHJldCwgZm4pIHtcbiAgY29uc3QgZGVzY3JpYmVkID0gZGVzY3JpYmVWaWV3KGN0eCwgb3B0cywgZXhwb3J0TmFtZSwgdHJ1ZSwgcGFyYW1zLCByZXQpO1xuICBjdHguYW5vblZpZXdzLnB1c2goYnVpbGRWaWV3SW5mbyhjdHgsIGRlc2NyaWJlZCwgZm4pKTtcbn1cbmZ1bmN0aW9uIGRlc2NyaWJlVmlldyhjdHgsIG9wdHMsIGV4cG9ydE5hbWUsIGFub24sIHBhcmFtcywgcmV0KSB7XG4gIGN0eC5kZWZpbmVGdW5jdGlvbihleHBvcnROYW1lKTtcbiAgY29uc3QgcGFyYW1zQnVpbGRlciA9IG5ldyBSb3dCdWlsZGVyKHBhcmFtcywgdG9QYXNjYWxDYXNlKGV4cG9ydE5hbWUpKTtcbiAgbGV0IHJldHVyblR5cGUgPSBjdHgucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHJldCkuYWxnZWJyYWljVHlwZTtcbiAgY29uc3QgeyB2YWx1ZTogcGFyYW1UeXBlIH0gPSBjdHgucmVzb2x2ZVR5cGUoXG4gICAgY3R4LnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseShwYXJhbXNCdWlsZGVyKVxuICApO1xuICBjdHgubW9kdWxlRGVmLnZpZXdzLnB1c2goe1xuICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgaW5kZXg6IChhbm9uID8gY3R4LmFub25WaWV3cyA6IGN0eC52aWV3cykubGVuZ3RoLFxuICAgIGlzUHVibGljOiBvcHRzLnB1YmxpYyxcbiAgICBpc0Fub255bW91czogYW5vbixcbiAgICBwYXJhbXM6IHBhcmFtVHlwZSxcbiAgICByZXR1cm5UeXBlXG4gIH0pO1xuICBjb25zdCBwcmltYXJ5S2V5Q29sdW1ucyA9IHZpZXdQcmltYXJ5S2V5Q29sdW1ucyhyZXQpO1xuICBpZiAocHJpbWFyeUtleUNvbHVtbnMubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICBgVmlldyAnJHtleHBvcnROYW1lfScgY2FuIGhhdmUgYXQgbW9zdCBvbmUgcHJpbWFyeUtleSgpIGNvbHVtbiBvbiBpdHMgcmV0dXJuZWQgcm93IHR5cGU7IGZvdW5kICR7cHJpbWFyeUtleUNvbHVtbnMuam9pbihcIiwgXCIpfWBcbiAgICApO1xuICB9XG4gIGlmIChwcmltYXJ5S2V5Q29sdW1ucy5sZW5ndGggPT09IDEpIHtcbiAgICBjdHgubW9kdWxlRGVmLnZpZXdQcmltYXJ5S2V5cy5wdXNoKHtcbiAgICAgIHZpZXdTb3VyY2VOYW1lOiBleHBvcnROYW1lLFxuICAgICAgY29sdW1uczogcHJpbWFyeUtleUNvbHVtbnNcbiAgICB9KTtcbiAgfVxuICBpZiAob3B0cy5uYW1lICE9IG51bGwpIHtcbiAgICBjdHgubW9kdWxlRGVmLmV4cGxpY2l0TmFtZXMuZW50cmllcy5wdXNoKHtcbiAgICAgIHRhZzogXCJGdW5jdGlvblwiLFxuICAgICAgdmFsdWU6IHtcbiAgICAgICAgc291cmNlTmFtZTogZXhwb3J0TmFtZSxcbiAgICAgICAgY2Fub25pY2FsTmFtZTogb3B0cy5uYW1lXG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgY29uc3Qgd3JhcE9wdGlvbiA9IHJldHVyblR5cGUudGFnID09IFwiU3VtXCI7XG4gIGlmIChyZXR1cm5UeXBlLnRhZyA9PSBcIlN1bVwiKSB7XG4gICAgcmV0dXJuVHlwZSA9IEFsZ2VicmFpY1R5cGUuQXJyYXkoXG4gICAgICByZXR1cm5UeXBlLnZhbHVlLnZhcmlhbnRzWzBdLmFsZ2VicmFpY1R5cGVcbiAgICApO1xuICB9XG4gIHJldHVybiB7IHBhcmFtVHlwZSwgcmV0dXJuVHlwZSwgd3JhcE9wdGlvbiB9O1xufVxuZnVuY3Rpb24gYnVpbGRWaWV3SW5mbyhjdHgsIHsgcGFyYW1UeXBlLCByZXR1cm5UeXBlLCB3cmFwT3B0aW9uIH0sIGZuKSB7XG4gIGNvbnN0IHsgdHlwZXNwYWNlIH0gPSBjdHg7XG4gIHJldHVybiB7XG4gICAgZm46IHdyYXBPcHRpb24gPyAoKHZpZXdDdHgsIGFyZ3MpID0+IHtcbiAgICAgIGNvbnN0IHJldCA9IGZuKHZpZXdDdHgsIGFyZ3MpO1xuICAgICAgcmV0dXJuIHJldCA9PSBudWxsID8gW10gOiBbcmV0XTtcbiAgICB9KSA6IGZuLFxuICAgIGRlc2VyaWFsaXplUGFyYW1zOiBQcm9kdWN0VHlwZS5tYWtlRGVzZXJpYWxpemVyKHBhcmFtVHlwZSwgdHlwZXNwYWNlKSxcbiAgICBzZXJpYWxpemVSZXR1cm46IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIocmV0dXJuVHlwZSwgdHlwZXNwYWNlKSxcbiAgICByZXR1cm5UeXBlQmFzZVNpemU6IGJzYXRuQmFzZVNpemUodHlwZXNwYWNlLCByZXR1cm5UeXBlKVxuICB9O1xufVxuZnVuY3Rpb24gdmlld1ByaW1hcnlLZXlDb2x1bW5zKHJldCkge1xuICBjb25zdCByb3cgPSB2aWV3UmV0dXJuUm93KHJldCk7XG4gIGlmIChyb3cgPT0gbnVsbCkge1xuICAgIHJldHVybiBbXTtcbiAgfVxuICByZXR1cm4gT2JqZWN0LmVudHJpZXMocm93LnJvdykuZmlsdGVyKFxuICAgIChlbnRyeSkgPT4gZW50cnlbMV0uY29sdW1uTWV0YWRhdGEuaXNQcmltYXJ5S2V5ID09PSB0cnVlXG4gICkubWFwKChbbmFtZV0pID0+IG5hbWUpO1xufVxuZnVuY3Rpb24gdmlld1JldHVyblJvdyhyZXQpIHtcbiAgaWYgKHJldCBpbnN0YW5jZW9mIEFycmF5QnVpbGRlciAmJiByZXQuZWxlbWVudCBpbnN0YW5jZW9mIFJvd0J1aWxkZXIpIHtcbiAgICByZXR1cm4gcmV0LmVsZW1lbnQ7XG4gIH1cbiAgaWYgKHJldCBpbnN0YW5jZW9mIE9wdGlvbkJ1aWxkZXIgJiYgcmV0LnZhbHVlIGluc3RhbmNlb2YgUm93QnVpbGRlcikge1xuICAgIHJldHVybiByZXQudmFsdWU7XG4gIH1cbiAgcmV0dXJuIHZvaWQgMDtcbn1cblxuLy8gc3JjL2xpYi9lcnJvcnMudHNcbnZhciBTZW5kZXJFcnJvciA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gIH1cbiAgZ2V0IG5hbWUoKSB7XG4gICAgcmV0dXJuIFwiU2VuZGVyRXJyb3JcIjtcbiAgfVxufTtcblxuLy8gc3JjL3NlcnZlci9lcnJvcnMudHNcbnZhciBTcGFjZXRpbWVIb3N0RXJyb3IgPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZSkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICB9XG4gIGdldCBuYW1lKCkge1xuICAgIHJldHVybiBcIlNwYWNldGltZUhvc3RFcnJvclwiO1xuICB9XG59O1xudmFyIGVycm9yRGF0YSA9IHtcbiAgLyoqXG4gICAqIEEgZ2VuZXJpYyBlcnJvciBjbGFzcyBmb3IgdW5rbm93biBlcnJvciBjb2Rlcy5cbiAgICovXG4gIEhvc3RDYWxsRmFpbHVyZTogMSxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhbiBBQkkgY2FsbCB3YXMgbWFkZSBvdXRzaWRlIG9mIGEgdHJhbnNhY3Rpb24uXG4gICAqL1xuICBOb3RJblRyYW5zYWN0aW9uOiAyLFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IEJTQVROIGRlY29kaW5nIGZhaWxlZC5cbiAgICogVGhpcyB0eXBpY2FsbHkgbWVhbnMgdGhhdCB0aGUgZGF0YSBjb3VsZCBub3QgYmUgZGVjb2RlZCB0byB0aGUgZXhwZWN0ZWQgdHlwZS5cbiAgICovXG4gIEJzYXRuRGVjb2RlRXJyb3I6IDMsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYSBzcGVjaWZpZWQgdGFibGUgZG9lcyBub3QgZXhpc3QuXG4gICAqL1xuICBOb1N1Y2hUYWJsZTogNCxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhIHNwZWNpZmllZCBpbmRleCBkb2VzIG5vdCBleGlzdC5cbiAgICovXG4gIE5vU3VjaEluZGV4OiA1LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGEgc3BlY2lmaWVkIHJvdyBpdGVyYXRvciBpcyBub3QgdmFsaWQuXG4gICAqL1xuICBOb1N1Y2hJdGVyOiA2LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGEgc3BlY2lmaWVkIGNvbnNvbGUgdGltZXIgZG9lcyBub3QgZXhpc3QuXG4gICAqL1xuICBOb1N1Y2hDb25zb2xlVGltZXI6IDcsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYSBzcGVjaWZpZWQgYnl0ZXMgc291cmNlIG9yIHNpbmsgaXMgbm90IHZhbGlkLlxuICAgKi9cbiAgTm9TdWNoQnl0ZXM6IDgsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgYSBwcm92aWRlZCBzaW5rIGhhcyBubyBtb3JlIHNwYWNlIGxlZnQuXG4gICAqL1xuICBOb1NwYWNlOiA5LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IHRoZXJlIGlzIG5vIG1vcmUgc3BhY2UgaW4gdGhlIGRhdGFiYXNlLlxuICAgKi9cbiAgQnVmZmVyVG9vU21hbGw6IDExLFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGEgdmFsdWUgd2l0aCBhIGdpdmVuIHVuaXF1ZSBpZGVudGlmaWVyIGFscmVhZHkgZXhpc3RzLlxuICAgKi9cbiAgVW5pcXVlQWxyZWFkeUV4aXN0czogMTIsXG4gIC8qKlxuICAgKiBFcnJvciBpbmRpY2F0aW5nIHRoYXQgdGhlIHNwZWNpZmllZCBkZWxheSBpbiBzY2hlZHVsaW5nIGEgcm93IHdhcyB0b28gbG9uZy5cbiAgICovXG4gIFNjaGVkdWxlQXREZWxheVRvb0xvbmc6IDEzLFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGFuIGluZGV4IHdhcyBub3QgdW5pcXVlIHdoZW4gaXQgd2FzIGV4cGVjdGVkIHRvIGJlLlxuICAgKi9cbiAgSW5kZXhOb3RVbmlxdWU6IDE0LFxuICAvKipcbiAgICogRXJyb3IgaW5kaWNhdGluZyB0aGF0IGFuIGluZGV4IHdhcyBub3QgdW5pcXVlIHdoZW4gaXQgd2FzIGV4cGVjdGVkIHRvIGJlLlxuICAgKi9cbiAgTm9TdWNoUm93OiAxNSxcbiAgLyoqXG4gICAqIEVycm9yIGluZGljYXRpbmcgdGhhdCBhbiBhdXRvLWluY3JlbWVudCBzZXF1ZW5jZSBoYXMgb3ZlcmZsb3dlZC5cbiAgICovXG4gIEF1dG9JbmNPdmVyZmxvdzogMTYsXG4gIFdvdWxkQmxvY2tUcmFuc2FjdGlvbjogMTcsXG4gIFRyYW5zYWN0aW9uTm90QW5vbnltb3VzOiAxOCxcbiAgVHJhbnNhY3Rpb25Jc1JlYWRPbmx5OiAxOSxcbiAgVHJhbnNhY3Rpb25Jc011dDogMjAsXG4gIEh0dHBFcnJvcjogMjFcbn07XG5mdW5jdGlvbiBtYXBFbnRyaWVzKHgsIGYpIHtcbiAgcmV0dXJuIE9iamVjdC5mcm9tRW50cmllcyhcbiAgICBPYmplY3QuZW50cmllcyh4KS5tYXAoKFtrLCB2XSkgPT4gW2ssIGYoaywgdildKVxuICApO1xufVxudmFyIGVycm5vVG9DbGFzcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG52YXIgZXJyb3JzID0gT2JqZWN0LmZyZWV6ZShcbiAgbWFwRW50cmllcyhlcnJvckRhdGEsIChuYW1lLCBjb2RlKSA9PiB7XG4gICAgY29uc3QgY2xzID0gT2JqZWN0LmRlZmluZVByb3BlcnR5KFxuICAgICAgY2xhc3MgZXh0ZW5kcyBTcGFjZXRpbWVIb3N0RXJyb3Ige1xuICAgICAgICBnZXQgbmFtZSgpIHtcbiAgICAgICAgICByZXR1cm4gbmFtZTtcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIFwibmFtZVwiLFxuICAgICAgeyB2YWx1ZTogbmFtZSwgd3JpdGFibGU6IGZhbHNlIH1cbiAgICApO1xuICAgIGVycm5vVG9DbGFzcy5zZXQoY29kZSwgY2xzKTtcbiAgICByZXR1cm4gY2xzO1xuICB9KVxuKTtcbmZ1bmN0aW9uIGdldEVycm9yQ29uc3RydWN0b3IoY29kZSkge1xuICByZXR1cm4gZXJybm9Ub0NsYXNzLmdldChjb2RlKSA/PyBTcGFjZXRpbWVIb3N0RXJyb3I7XG59XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9wdXJlLXJhbmRANy4wLjEvbm9kZV9tb2R1bGVzL3B1cmUtcmFuZC9saWIvZXNtL2Rpc3RyaWJ1dGlvbi9VbnNhZmVVbmlmb3JtQmlnSW50RGlzdHJpYnV0aW9uLmpzXG52YXIgU0JpZ0ludCA9IHR5cGVvZiBCaWdJbnQgIT09IFwidW5kZWZpbmVkXCIgPyBCaWdJbnQgOiB2b2lkIDA7XG52YXIgT25lID0gdHlwZW9mIEJpZ0ludCAhPT0gXCJ1bmRlZmluZWRcIiA/IEJpZ0ludCgxKSA6IHZvaWQgMDtcbnZhciBUaGlydHlUd28gPSB0eXBlb2YgQmlnSW50ICE9PSBcInVuZGVmaW5lZFwiID8gQmlnSW50KDMyKSA6IHZvaWQgMDtcbnZhciBOdW1WYWx1ZXMgPSB0eXBlb2YgQmlnSW50ICE9PSBcInVuZGVmaW5lZFwiID8gQmlnSW50KDQyOTQ5NjcyOTYpIDogdm9pZCAwO1xuZnVuY3Rpb24gdW5zYWZlVW5pZm9ybUJpZ0ludERpc3RyaWJ1dGlvbihmcm9tLCB0bywgcm5nKSB7XG4gIHZhciBkaWZmID0gdG8gLSBmcm9tICsgT25lO1xuICB2YXIgRmluYWxOdW1WYWx1ZXMgPSBOdW1WYWx1ZXM7XG4gIHZhciBOdW1JdGVyYXRpb25zID0gMTtcbiAgd2hpbGUgKEZpbmFsTnVtVmFsdWVzIDwgZGlmZikge1xuICAgIEZpbmFsTnVtVmFsdWVzIDw8PSBUaGlydHlUd287XG4gICAgKytOdW1JdGVyYXRpb25zO1xuICB9XG4gIHZhciB2YWx1ZSA9IGdlbmVyYXRlTmV4dChOdW1JdGVyYXRpb25zLCBybmcpO1xuICBpZiAodmFsdWUgPCBkaWZmKSB7XG4gICAgcmV0dXJuIHZhbHVlICsgZnJvbTtcbiAgfVxuICBpZiAodmFsdWUgKyBkaWZmIDwgRmluYWxOdW1WYWx1ZXMpIHtcbiAgICByZXR1cm4gdmFsdWUgJSBkaWZmICsgZnJvbTtcbiAgfVxuICB2YXIgTWF4QWNjZXB0ZWRSYW5kb20gPSBGaW5hbE51bVZhbHVlcyAtIEZpbmFsTnVtVmFsdWVzICUgZGlmZjtcbiAgd2hpbGUgKHZhbHVlID49IE1heEFjY2VwdGVkUmFuZG9tKSB7XG4gICAgdmFsdWUgPSBnZW5lcmF0ZU5leHQoTnVtSXRlcmF0aW9ucywgcm5nKTtcbiAgfVxuICByZXR1cm4gdmFsdWUgJSBkaWZmICsgZnJvbTtcbn1cbmZ1bmN0aW9uIGdlbmVyYXRlTmV4dChOdW1JdGVyYXRpb25zLCBybmcpIHtcbiAgdmFyIHZhbHVlID0gU0JpZ0ludChybmcudW5zYWZlTmV4dCgpICsgMjE0NzQ4MzY0OCk7XG4gIGZvciAodmFyIG51bSA9IDE7IG51bSA8IE51bUl0ZXJhdGlvbnM7ICsrbnVtKSB7XG4gICAgdmFyIG91dCA9IHJuZy51bnNhZmVOZXh0KCk7XG4gICAgdmFsdWUgPSAodmFsdWUgPDwgVGhpcnR5VHdvKSArIFNCaWdJbnQob3V0ICsgMjE0NzQ4MzY0OCk7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vcHVyZS1yYW5kQDcuMC4xL25vZGVfbW9kdWxlcy9wdXJlLXJhbmQvbGliL2VzbS9kaXN0cmlidXRpb24vaW50ZXJuYWxzL1Vuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb25JbnRlcm5hbC5qc1xuZnVuY3Rpb24gdW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbkludGVybmFsKHJhbmdlU2l6ZSwgcm5nKSB7XG4gIHZhciBNYXhBbGxvd2VkID0gcmFuZ2VTaXplID4gMiA/IH5+KDQyOTQ5NjcyOTYgLyByYW5nZVNpemUpICogcmFuZ2VTaXplIDogNDI5NDk2NzI5NjtcbiAgdmFyIGRlbHRhViA9IHJuZy51bnNhZmVOZXh0KCkgKyAyMTQ3NDgzNjQ4O1xuICB3aGlsZSAoZGVsdGFWID49IE1heEFsbG93ZWQpIHtcbiAgICBkZWx0YVYgPSBybmcudW5zYWZlTmV4dCgpICsgMjE0NzQ4MzY0ODtcbiAgfVxuICByZXR1cm4gZGVsdGFWICUgcmFuZ2VTaXplO1xufVxuXG4vLyAuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vcHVyZS1yYW5kQDcuMC4xL25vZGVfbW9kdWxlcy9wdXJlLXJhbmQvbGliL2VzbS9kaXN0cmlidXRpb24vaW50ZXJuYWxzL0FycmF5SW50NjQuanNcbmZ1bmN0aW9uIGZyb21OdW1iZXJUb0FycmF5SW50NjQob3V0LCBuKSB7XG4gIGlmIChuIDwgMCkge1xuICAgIHZhciBwb3NOID0gLW47XG4gICAgb3V0LnNpZ24gPSAtMTtcbiAgICBvdXQuZGF0YVswXSA9IH5+KHBvc04gLyA0Mjk0OTY3Mjk2KTtcbiAgICBvdXQuZGF0YVsxXSA9IHBvc04gPj4+IDA7XG4gIH0gZWxzZSB7XG4gICAgb3V0LnNpZ24gPSAxO1xuICAgIG91dC5kYXRhWzBdID0gfn4obiAvIDQyOTQ5NjcyOTYpO1xuICAgIG91dC5kYXRhWzFdID0gbiA+Pj4gMDtcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuZnVuY3Rpb24gc3Vic3RyYWN0QXJyYXlJbnQ2NChvdXQsIGFycmF5SW50QSwgYXJyYXlJbnRCKSB7XG4gIHZhciBsb3dBID0gYXJyYXlJbnRBLmRhdGFbMV07XG4gIHZhciBoaWdoQSA9IGFycmF5SW50QS5kYXRhWzBdO1xuICB2YXIgc2lnbkEgPSBhcnJheUludEEuc2lnbjtcbiAgdmFyIGxvd0IgPSBhcnJheUludEIuZGF0YVsxXTtcbiAgdmFyIGhpZ2hCID0gYXJyYXlJbnRCLmRhdGFbMF07XG4gIHZhciBzaWduQiA9IGFycmF5SW50Qi5zaWduO1xuICBvdXQuc2lnbiA9IDE7XG4gIGlmIChzaWduQSA9PT0gMSAmJiBzaWduQiA9PT0gLTEpIHtcbiAgICB2YXIgbG93XzEgPSBsb3dBICsgbG93QjtcbiAgICB2YXIgaGlnaCA9IGhpZ2hBICsgaGlnaEIgKyAobG93XzEgPiA0Mjk0OTY3Mjk1ID8gMSA6IDApO1xuICAgIG91dC5kYXRhWzBdID0gaGlnaCA+Pj4gMDtcbiAgICBvdXQuZGF0YVsxXSA9IGxvd18xID4+PiAwO1xuICAgIHJldHVybiBvdXQ7XG4gIH1cbiAgdmFyIGxvd0ZpcnN0ID0gbG93QTtcbiAgdmFyIGhpZ2hGaXJzdCA9IGhpZ2hBO1xuICB2YXIgbG93U2Vjb25kID0gbG93QjtcbiAgdmFyIGhpZ2hTZWNvbmQgPSBoaWdoQjtcbiAgaWYgKHNpZ25BID09PSAtMSkge1xuICAgIGxvd0ZpcnN0ID0gbG93QjtcbiAgICBoaWdoRmlyc3QgPSBoaWdoQjtcbiAgICBsb3dTZWNvbmQgPSBsb3dBO1xuICAgIGhpZ2hTZWNvbmQgPSBoaWdoQTtcbiAgfVxuICB2YXIgcmVtaW5kZXJMb3cgPSAwO1xuICB2YXIgbG93ID0gbG93Rmlyc3QgLSBsb3dTZWNvbmQ7XG4gIGlmIChsb3cgPCAwKSB7XG4gICAgcmVtaW5kZXJMb3cgPSAxO1xuICAgIGxvdyA9IGxvdyA+Pj4gMDtcbiAgfVxuICBvdXQuZGF0YVswXSA9IGhpZ2hGaXJzdCAtIGhpZ2hTZWNvbmQgLSByZW1pbmRlckxvdztcbiAgb3V0LmRhdGFbMV0gPSBsb3c7XG4gIHJldHVybiBvdXQ7XG59XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9wdXJlLXJhbmRANy4wLjEvbm9kZV9tb2R1bGVzL3B1cmUtcmFuZC9saWIvZXNtL2Rpc3RyaWJ1dGlvbi9pbnRlcm5hbHMvVW5zYWZlVW5pZm9ybUFycmF5SW50RGlzdHJpYnV0aW9uSW50ZXJuYWwuanNcbmZ1bmN0aW9uIHVuc2FmZVVuaWZvcm1BcnJheUludERpc3RyaWJ1dGlvbkludGVybmFsKG91dCwgcmFuZ2VTaXplLCBybmcpIHtcbiAgdmFyIHJhbmdlTGVuZ3RoID0gcmFuZ2VTaXplLmxlbmd0aDtcbiAgd2hpbGUgKHRydWUpIHtcbiAgICBmb3IgKHZhciBpbmRleCA9IDA7IGluZGV4ICE9PSByYW5nZUxlbmd0aDsgKytpbmRleCkge1xuICAgICAgdmFyIGluZGV4UmFuZ2VTaXplID0gaW5kZXggPT09IDAgPyByYW5nZVNpemVbMF0gKyAxIDogNDI5NDk2NzI5NjtcbiAgICAgIHZhciBnID0gdW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbkludGVybmFsKGluZGV4UmFuZ2VTaXplLCBybmcpO1xuICAgICAgb3V0W2luZGV4XSA9IGc7XG4gICAgfVxuICAgIGZvciAodmFyIGluZGV4ID0gMDsgaW5kZXggIT09IHJhbmdlTGVuZ3RoOyArK2luZGV4KSB7XG4gICAgICB2YXIgY3VycmVudCA9IG91dFtpbmRleF07XG4gICAgICB2YXIgY3VycmVudEluUmFuZ2UgPSByYW5nZVNpemVbaW5kZXhdO1xuICAgICAgaWYgKGN1cnJlbnQgPCBjdXJyZW50SW5SYW5nZSkge1xuICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgfSBlbHNlIGlmIChjdXJyZW50ID4gY3VycmVudEluUmFuZ2UpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8vIC4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9wdXJlLXJhbmRANy4wLjEvbm9kZV9tb2R1bGVzL3B1cmUtcmFuZC9saWIvZXNtL2Rpc3RyaWJ1dGlvbi9VbnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uLmpzXG52YXIgc2FmZU51bWJlck1heFNhZmVJbnRlZ2VyID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVI7XG52YXIgc2hhcmVkQSA9IHsgc2lnbjogMSwgZGF0YTogWzAsIDBdIH07XG52YXIgc2hhcmVkQiA9IHsgc2lnbjogMSwgZGF0YTogWzAsIDBdIH07XG52YXIgc2hhcmVkQyA9IHsgc2lnbjogMSwgZGF0YTogWzAsIDBdIH07XG52YXIgc2hhcmVkRGF0YSA9IFswLCAwXTtcbmZ1bmN0aW9uIHVuaWZvcm1MYXJnZUludEludGVybmFsKGZyb20sIHRvLCByYW5nZVNpemUsIHJuZykge1xuICB2YXIgcmFuZ2VTaXplQXJyYXlJbnRWYWx1ZSA9IHJhbmdlU2l6ZSA8PSBzYWZlTnVtYmVyTWF4U2FmZUludGVnZXIgPyBmcm9tTnVtYmVyVG9BcnJheUludDY0KHNoYXJlZEMsIHJhbmdlU2l6ZSkgOiBzdWJzdHJhY3RBcnJheUludDY0KHNoYXJlZEMsIGZyb21OdW1iZXJUb0FycmF5SW50NjQoc2hhcmVkQSwgdG8pLCBmcm9tTnVtYmVyVG9BcnJheUludDY0KHNoYXJlZEIsIGZyb20pKTtcbiAgaWYgKHJhbmdlU2l6ZUFycmF5SW50VmFsdWUuZGF0YVsxXSA9PT0gNDI5NDk2NzI5NSkge1xuICAgIHJhbmdlU2l6ZUFycmF5SW50VmFsdWUuZGF0YVswXSArPSAxO1xuICAgIHJhbmdlU2l6ZUFycmF5SW50VmFsdWUuZGF0YVsxXSA9IDA7XG4gIH0gZWxzZSB7XG4gICAgcmFuZ2VTaXplQXJyYXlJbnRWYWx1ZS5kYXRhWzFdICs9IDE7XG4gIH1cbiAgdW5zYWZlVW5pZm9ybUFycmF5SW50RGlzdHJpYnV0aW9uSW50ZXJuYWwoc2hhcmVkRGF0YSwgcmFuZ2VTaXplQXJyYXlJbnRWYWx1ZS5kYXRhLCBybmcpO1xuICByZXR1cm4gc2hhcmVkRGF0YVswXSAqIDQyOTQ5NjcyOTYgKyBzaGFyZWREYXRhWzFdICsgZnJvbTtcbn1cbmZ1bmN0aW9uIHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb24oZnJvbSwgdG8sIHJuZykge1xuICB2YXIgcmFuZ2VTaXplID0gdG8gLSBmcm9tO1xuICBpZiAocmFuZ2VTaXplIDw9IDQyOTQ5NjcyOTUpIHtcbiAgICB2YXIgZyA9IHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb25JbnRlcm5hbChyYW5nZVNpemUgKyAxLCBybmcpO1xuICAgIHJldHVybiBnICsgZnJvbTtcbiAgfVxuICByZXR1cm4gdW5pZm9ybUxhcmdlSW50SW50ZXJuYWwoZnJvbSwgdG8sIHJhbmdlU2l6ZSwgcm5nKTtcbn1cblxuLy8gLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3B1cmUtcmFuZEA3LjAuMS9ub2RlX21vZHVsZXMvcHVyZS1yYW5kL2xpYi9lc20vZ2VuZXJhdG9yL1hvcm9TaGlyby5qc1xudmFyIFhvcm9TaGlybzEyOFBsdXMgPSAoZnVuY3Rpb24oKSB7XG4gIGZ1bmN0aW9uIFhvcm9TaGlybzEyOFBsdXMyKHMwMSwgczAwLCBzMTEsIHMxMCkge1xuICAgIHRoaXMuczAxID0gczAxO1xuICAgIHRoaXMuczAwID0gczAwO1xuICAgIHRoaXMuczExID0gczExO1xuICAgIHRoaXMuczEwID0gczEwO1xuICB9XG4gIFhvcm9TaGlybzEyOFBsdXMyLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBuZXcgWG9yb1NoaXJvMTI4UGx1czIodGhpcy5zMDEsIHRoaXMuczAwLCB0aGlzLnMxMSwgdGhpcy5zMTApO1xuICB9O1xuICBYb3JvU2hpcm8xMjhQbHVzMi5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBuZXh0Um5nID0gbmV3IFhvcm9TaGlybzEyOFBsdXMyKHRoaXMuczAxLCB0aGlzLnMwMCwgdGhpcy5zMTEsIHRoaXMuczEwKTtcbiAgICB2YXIgb3V0ID0gbmV4dFJuZy51bnNhZmVOZXh0KCk7XG4gICAgcmV0dXJuIFtvdXQsIG5leHRSbmddO1xuICB9O1xuICBYb3JvU2hpcm8xMjhQbHVzMi5wcm90b3R5cGUudW5zYWZlTmV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvdXQgPSB0aGlzLnMwMCArIHRoaXMuczEwIHwgMDtcbiAgICB2YXIgYTAgPSB0aGlzLnMxMCBeIHRoaXMuczAwO1xuICAgIHZhciBhMSA9IHRoaXMuczExIF4gdGhpcy5zMDE7XG4gICAgdmFyIHMwMCA9IHRoaXMuczAwO1xuICAgIHZhciBzMDEgPSB0aGlzLnMwMTtcbiAgICB0aGlzLnMwMCA9IHMwMCA8PCAyNCBeIHMwMSA+Pj4gOCBeIGEwIF4gYTAgPDwgMTY7XG4gICAgdGhpcy5zMDEgPSBzMDEgPDwgMjQgXiBzMDAgPj4+IDggXiBhMSBeIChhMSA8PCAxNiB8IGEwID4+PiAxNik7XG4gICAgdGhpcy5zMTAgPSBhMSA8PCA1IF4gYTAgPj4+IDI3O1xuICAgIHRoaXMuczExID0gYTAgPDwgNSBeIGExID4+PiAyNztcbiAgICByZXR1cm4gb3V0O1xuICB9O1xuICBYb3JvU2hpcm8xMjhQbHVzMi5wcm90b3R5cGUuanVtcCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBuZXh0Um5nID0gbmV3IFhvcm9TaGlybzEyOFBsdXMyKHRoaXMuczAxLCB0aGlzLnMwMCwgdGhpcy5zMTEsIHRoaXMuczEwKTtcbiAgICBuZXh0Um5nLnVuc2FmZUp1bXAoKTtcbiAgICByZXR1cm4gbmV4dFJuZztcbiAgfTtcbiAgWG9yb1NoaXJvMTI4UGx1czIucHJvdG90eXBlLnVuc2FmZUp1bXAgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgbnMwMSA9IDA7XG4gICAgdmFyIG5zMDAgPSAwO1xuICAgIHZhciBuczExID0gMDtcbiAgICB2YXIgbnMxMCA9IDA7XG4gICAgdmFyIGp1bXAgPSBbMzYzOTk1NjY0NSwgMzc1MDc1NzAxMiwgMTI2MTU2ODUwOCwgMzg2NDI2MzM1XTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSAhPT0gNDsgKytpKSB7XG4gICAgICBmb3IgKHZhciBtYXNrID0gMTsgbWFzazsgbWFzayA8PD0gMSkge1xuICAgICAgICBpZiAoanVtcFtpXSAmIG1hc2spIHtcbiAgICAgICAgICBuczAxIF49IHRoaXMuczAxO1xuICAgICAgICAgIG5zMDAgXj0gdGhpcy5zMDA7XG4gICAgICAgICAgbnMxMSBePSB0aGlzLnMxMTtcbiAgICAgICAgICBuczEwIF49IHRoaXMuczEwO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMudW5zYWZlTmV4dCgpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnMwMSA9IG5zMDE7XG4gICAgdGhpcy5zMDAgPSBuczAwO1xuICAgIHRoaXMuczExID0gbnMxMTtcbiAgICB0aGlzLnMxMCA9IG5zMTA7XG4gIH07XG4gIFhvcm9TaGlybzEyOFBsdXMyLnByb3RvdHlwZS5nZXRTdGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiBbdGhpcy5zMDEsIHRoaXMuczAwLCB0aGlzLnMxMSwgdGhpcy5zMTBdO1xuICB9O1xuICByZXR1cm4gWG9yb1NoaXJvMTI4UGx1czI7XG59KSgpO1xuZnVuY3Rpb24gZnJvbVN0YXRlKHN0YXRlKSB7XG4gIHZhciB2YWxpZCA9IHN0YXRlLmxlbmd0aCA9PT0gNDtcbiAgaWYgKCF2YWxpZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBzdGF0ZSBtdXN0IGhhdmUgYmVlbiBwcm9kdWNlZCBieSBhIHhvcm9zaGlybzEyOHBsdXMgUmFuZG9tR2VuZXJhdG9yXCIpO1xuICB9XG4gIHJldHVybiBuZXcgWG9yb1NoaXJvMTI4UGx1cyhzdGF0ZVswXSwgc3RhdGVbMV0sIHN0YXRlWzJdLCBzdGF0ZVszXSk7XG59XG52YXIgeG9yb3NoaXJvMTI4cGx1cyA9IE9iamVjdC5hc3NpZ24oZnVuY3Rpb24oc2VlZCkge1xuICByZXR1cm4gbmV3IFhvcm9TaGlybzEyOFBsdXMoLTEsIH5zZWVkLCBzZWVkIHwgMCwgMCk7XG59LCB7IGZyb21TdGF0ZSB9KTtcblxuLy8gc3JjL3NlcnZlci9ybmcudHNcbnZhciB7IGFzVWludE4gfSA9IEJpZ0ludDtcbmZ1bmN0aW9uIHBjZzMyKHN0YXRlKSB7XG4gIGNvbnN0IE1VTCA9IDYzNjQxMzYyMjM4NDY3OTMwMDVuO1xuICBjb25zdCBJTkMgPSAxMTYzNDU4MDAyNzQ2MjI2MDcyM247XG4gIHN0YXRlID0gYXNVaW50Tig2NCwgc3RhdGUgKiBNVUwgKyBJTkMpO1xuICBjb25zdCB4b3JzaGlmdGVkID0gTnVtYmVyKGFzVWludE4oMzIsIChzdGF0ZSA+PiAxOG4gXiBzdGF0ZSkgPj4gMjduKSk7XG4gIGNvbnN0IHJvdCA9IE51bWJlcihhc1VpbnROKDMyLCBzdGF0ZSA+PiA1OW4pKTtcbiAgcmV0dXJuIHhvcnNoaWZ0ZWQgPj4gcm90IHwgeG9yc2hpZnRlZCA8PCAzMiAtIHJvdDtcbn1cbmZ1bmN0aW9uIGdlbmVyYXRlRmxvYXQ2NChybmcpIHtcbiAgY29uc3QgZzEgPSB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uKDAsICgxIDw8IDI2KSAtIDEsIHJuZyk7XG4gIGNvbnN0IGcyID0gdW5zYWZlVW5pZm9ybUludERpc3RyaWJ1dGlvbigwLCAoMSA8PCAyNykgLSAxLCBybmcpO1xuICBjb25zdCB2YWx1ZSA9IChnMSAqIE1hdGgucG93KDIsIDI3KSArIGcyKSAqIE1hdGgucG93KDIsIC01Myk7XG4gIHJldHVybiB2YWx1ZTtcbn1cbmZ1bmN0aW9uIG1ha2VSYW5kb20oc2VlZCkge1xuICBjb25zdCBybmcgPSB4b3Jvc2hpcm8xMjhwbHVzKHBjZzMyKHNlZWQubWljcm9zU2luY2VVbml4RXBvY2gpKTtcbiAgY29uc3QgcmFuZG9tID0gKCkgPT4gZ2VuZXJhdGVGbG9hdDY0KHJuZyk7XG4gIHJhbmRvbS5maWxsID0gKGFycmF5KSA9PiB7XG4gICAgaWYgKGlzQmlnSW50QXJyYXkoYXJyYXkpKSB7XG4gICAgICBjb25zdCB1cHBlciA9ICgxbiA8PCBCaWdJbnQoYXJyYXkuQllURVNfUEVSX0VMRU1FTlQgKiA4KSkgLSAxbjtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0gPSB1bnNhZmVVbmlmb3JtQmlnSW50RGlzdHJpYnV0aW9uKDBuLCB1cHBlciwgcm5nKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgdXBwZXIgPSBNYXRoLnBvdygyLCBhcnJheS5CWVRFU19QRVJfRUxFTUVOVCAqIDgpIC0gMTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYXJyYXlbaV0gPSB1bnNhZmVVbmlmb3JtSW50RGlzdHJpYnV0aW9uKDAsIHVwcGVyLCBybmcpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXk7XG4gIH07XG4gIHJhbmRvbS51aW50MzIgPSAoKSA9PiBybmcudW5zYWZlTmV4dCgpO1xuICByYW5kb20uaW50ZWdlckluUmFuZ2UgPSAobWluLCBtYXgpID0+IHVuc2FmZVVuaWZvcm1JbnREaXN0cmlidXRpb24obWluLCBtYXgsIHJuZyk7XG4gIHJhbmRvbS5iaWdpbnRJblJhbmdlID0gKG1pbiwgbWF4KSA9PiB1bnNhZmVVbmlmb3JtQmlnSW50RGlzdHJpYnV0aW9uKG1pbiwgbWF4LCBybmcpO1xuICByZXR1cm4gcmFuZG9tO1xufVxuZnVuY3Rpb24gaXNCaWdJbnRBcnJheShhcnJheSkge1xuICByZXR1cm4gYXJyYXkgaW5zdGFuY2VvZiBCaWdJbnQ2NEFycmF5IHx8IGFycmF5IGluc3RhbmNlb2YgQmlnVWludDY0QXJyYXk7XG59XG5cbi8vIHNyYy9zZXJ2ZXIvcnVudGltZS50c1xudmFyIHsgZnJlZXplIH0gPSBPYmplY3Q7XG52YXIgc3lzID0geyAuLi5fc3lzY2FsbHMyXzAsIC4uLl9zeXNjYWxsczJfMSB9O1xuZnVuY3Rpb24gcmVxdWVzdEZyb21XaXJlKHJlcXVlc3QsIGJvZHkpIHtcbiAgcmV0dXJuIFJlcXVlc3RbbWFrZVJlcXVlc3RdKGJvZHksIHtcbiAgICBoZWFkZXJzOiBkZXNlcmlhbGl6ZUhlYWRlcnMocmVxdWVzdC5oZWFkZXJzKSxcbiAgICBtZXRob2Q6IGRlc2VyaWFsaXplTWV0aG9kKHJlcXVlc3QubWV0aG9kKSxcbiAgICB1cmk6IHJlcXVlc3QudXJpLFxuICAgIHZlcnNpb246IHJlcXVlc3QudmVyc2lvblxuICB9KTtcbn1cbmZ1bmN0aW9uIHJlc3BvbnNlSW50b1dpcmUocmVzcG9uc2UpIHtcbiAgcmV0dXJuIFtcbiAgICB7XG4gICAgICBoZWFkZXJzOiBzZXJpYWxpemVIZWFkZXJzKHJlc3BvbnNlLmhlYWRlcnMpLFxuICAgICAgdmVyc2lvbjogcmVzcG9uc2UudmVyc2lvbixcbiAgICAgIGNvZGU6IHJlc3BvbnNlLnN0YXR1c1xuICAgIH0sXG4gICAgcmVzcG9uc2UuYnl0ZXMoKVxuICBdO1xufVxuZnVuY3Rpb24gcGFyc2VKc29uT2JqZWN0KGpzb24pIHtcbiAgbGV0IHZhbHVlO1xuICB0cnkge1xuICAgIHZhbHVlID0gSlNPTi5wYXJzZShqc29uKTtcbiAgfSBjYXRjaCB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiSW52YWxpZCBKU09OOiBmYWlsZWQgdG8gcGFyc2Ugc3RyaW5nXCIpO1xuICB9XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB0eXBlb2YgdmFsdWUgIT09IFwib2JqZWN0XCIgfHwgQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBhIEpTT04gb2JqZWN0IGF0IHRoZSB0b3AgbGV2ZWxcIik7XG4gIH1cbiAgcmV0dXJuIHZhbHVlO1xufVxudmFyIEp3dENsYWltc0ltcGwgPSBjbGFzcyB7XG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbmV3IEp3dENsYWltcyBpbnN0YW5jZS5cbiAgICogQHBhcmFtIHJhd1BheWxvYWQgVGhlIEpXVCBwYXlsb2FkIGFzIGEgcmF3IEpTT04gc3RyaW5nLlxuICAgKiBAcGFyYW0gaWRlbnRpdHkgVGhlIGlkZW50aXR5IGZvciB0aGlzIEpXVC4gV2UgYXJlIG9ubHkgdGFraW5nIHRoaXMgYmVjYXVzZSB3ZSBkb24ndCBoYXZlIGEgYmxha2UzIGltcGxlbWVudGF0aW9uICh3aGljaCB3ZSBuZWVkIHRvIGNvbXB1dGUgaXQpLlxuICAgKi9cbiAgY29uc3RydWN0b3IocmF3UGF5bG9hZCwgaWRlbnRpdHkpIHtcbiAgICB0aGlzLnJhd1BheWxvYWQgPSByYXdQYXlsb2FkO1xuICAgIHRoaXMuZnVsbFBheWxvYWQgPSBwYXJzZUpzb25PYmplY3QocmF3UGF5bG9hZCk7XG4gICAgdGhpcy5faWRlbnRpdHkgPSBpZGVudGl0eTtcbiAgfVxuICBmdWxsUGF5bG9hZDtcbiAgX2lkZW50aXR5O1xuICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2lkZW50aXR5O1xuICB9XG4gIGdldCBzdWJqZWN0KCkge1xuICAgIHJldHVybiB0aGlzLmZ1bGxQYXlsb2FkW1wic3ViXCJdO1xuICB9XG4gIGdldCBpc3N1ZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMuZnVsbFBheWxvYWRbXCJpc3NcIl07XG4gIH1cbiAgZ2V0IGF1ZGllbmNlKCkge1xuICAgIGNvbnN0IGF1ZCA9IHRoaXMuZnVsbFBheWxvYWRbXCJhdWRcIl07XG4gICAgaWYgKGF1ZCA9PSBudWxsKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHJldHVybiB0eXBlb2YgYXVkID09PSBcInN0cmluZ1wiID8gW2F1ZF0gOiBhdWQ7XG4gIH1cbn07XG52YXIgQXV0aEN0eEltcGwgPSBjbGFzcyBfQXV0aEN0eEltcGwge1xuICBpc0ludGVybmFsO1xuICAvLyBTb3VyY2Ugb2YgdGhlIEpXVCBwYXlsb2FkIHN0cmluZywgaWYgdGhlcmUgaXMgb25lLlxuICBfand0U291cmNlO1xuICAvLyBXaGV0aGVyIHdlIGhhdmUgaW5pdGlhbGl6ZWQgdGhlIEpXVCBjbGFpbXMuXG4gIF9pbml0aWFsaXplZEpXVCA9IGZhbHNlO1xuICBfand0Q2xhaW1zO1xuICBfc2VuZGVySWRlbnRpdHk7XG4gIGNvbnN0cnVjdG9yKG9wdHMpIHtcbiAgICB0aGlzLmlzSW50ZXJuYWwgPSBvcHRzLmlzSW50ZXJuYWw7XG4gICAgdGhpcy5fand0U291cmNlID0gb3B0cy5qd3RTb3VyY2U7XG4gICAgdGhpcy5fc2VuZGVySWRlbnRpdHkgPSBvcHRzLnNlbmRlcklkZW50aXR5O1xuICB9XG4gIF9pbml0aWFsaXplSldUKCkge1xuICAgIGlmICh0aGlzLl9pbml0aWFsaXplZEpXVCkgcmV0dXJuO1xuICAgIHRoaXMuX2luaXRpYWxpemVkSldUID0gdHJ1ZTtcbiAgICBjb25zdCB0b2tlbiA9IHRoaXMuX2p3dFNvdXJjZSgpO1xuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIHRoaXMuX2p3dENsYWltcyA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2p3dENsYWltcyA9IG5ldyBKd3RDbGFpbXNJbXBsKHRva2VuLCB0aGlzLl9zZW5kZXJJZGVudGl0eSk7XG4gICAgfVxuICAgIE9iamVjdC5mcmVlemUodGhpcyk7XG4gIH1cbiAgLyoqIExhemlseSBjb21wdXRlIHdoZXRoZXIgYSBKV1QgZXhpc3RzIGFuZCBpcyBwYXJzZWFibGUuICovXG4gIGdldCBoYXNKV1QoKSB7XG4gICAgdGhpcy5faW5pdGlhbGl6ZUpXVCgpO1xuICAgIHJldHVybiB0aGlzLl9qd3RDbGFpbXMgIT09IG51bGw7XG4gIH1cbiAgLyoqIExhemlseSBwYXJzZSB0aGUgSnd0Q2xhaW1zIG9ubHkgd2hlbiBhY2Nlc3NlZC4gKi9cbiAgZ2V0IGp3dCgpIHtcbiAgICB0aGlzLl9pbml0aWFsaXplSldUKCk7XG4gICAgcmV0dXJuIHRoaXMuX2p3dENsYWltcztcbiAgfVxuICAvKiogQ3JlYXRlIGEgY29udGV4dCByZXByZXNlbnRpbmcgaW50ZXJuYWwgKG5vbi11c2VyKSByZXF1ZXN0cy4gKi9cbiAgc3RhdGljIGludGVybmFsKCkge1xuICAgIHJldHVybiBuZXcgX0F1dGhDdHhJbXBsKHtcbiAgICAgIGlzSW50ZXJuYWw6IHRydWUsXG4gICAgICBqd3RTb3VyY2U6ICgpID0+IG51bGwsXG4gICAgICBzZW5kZXJJZGVudGl0eTogSWRlbnRpdHkuemVybygpXG4gICAgfSk7XG4gIH1cbiAgLyoqIElmIHRoZXJlIGlzIGEgY29ubmVjdGlvbiBpZCwgbG9vayB1cCB0aGUgSldUIHBheWxvYWQgZnJvbSB0aGUgc3lzdGVtIHRhYmxlcy4gKi9cbiAgc3RhdGljIGZyb21TeXN0ZW1UYWJsZXMoY29ubmVjdGlvbklkLCBzZW5kZXIpIHtcbiAgICBpZiAoY29ubmVjdGlvbklkID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbmV3IF9BdXRoQ3R4SW1wbCh7XG4gICAgICAgIGlzSW50ZXJuYWw6IGZhbHNlLFxuICAgICAgICBqd3RTb3VyY2U6ICgpID0+IG51bGwsXG4gICAgICAgIHNlbmRlcklkZW50aXR5OiBzZW5kZXJcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IF9BdXRoQ3R4SW1wbCh7XG4gICAgICBpc0ludGVybmFsOiBmYWxzZSxcbiAgICAgIGp3dFNvdXJjZTogKCkgPT4ge1xuICAgICAgICBjb25zdCBwYXlsb2FkQnVmID0gc3lzLmdldF9qd3RfcGF5bG9hZChjb25uZWN0aW9uSWQuX19jb25uZWN0aW9uX2lkX18pO1xuICAgICAgICBpZiAocGF5bG9hZEJ1Zi5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICAgICAgICBjb25zdCBwYXlsb2FkU3RyID0gbmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKHBheWxvYWRCdWYpO1xuICAgICAgICByZXR1cm4gcGF5bG9hZFN0cjtcbiAgICAgIH0sXG4gICAgICBzZW5kZXJJZGVudGl0eTogc2VuZGVyXG4gICAgfSk7XG4gIH1cbn07XG52YXIgUmVkdWNlckN0eEltcGwgPSBjbGFzcyBSZWR1Y2VyQ3R4IHtcbiAgI2lkZW50aXR5O1xuICAjc2VuZGVyQXV0aDtcbiAgI3V1aWRDb3VudGVyO1xuICAjcmFuZG9tO1xuICBzZW5kZXI7XG4gIHRpbWVzdGFtcDtcbiAgY29ubmVjdGlvbklkO1xuICBkYjtcbiAgYXM7XG4gIGNvbnN0cnVjdG9yKHNlbmRlciwgdGltZXN0YW1wLCBjb25uZWN0aW9uSWQsIGRiVmlldywgYXNWaWV3cyA9IHt9KSB7XG4gICAgT2JqZWN0LnNlYWwodGhpcyk7XG4gICAgdGhpcy5zZW5kZXIgPSBzZW5kZXI7XG4gICAgdGhpcy50aW1lc3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgdGhpcy5jb25uZWN0aW9uSWQgPSBjb25uZWN0aW9uSWQ7XG4gICAgdGhpcy5kYiA9IGRiVmlldztcbiAgICB0aGlzLmFzID0gYXNWaWV3cztcbiAgfVxuICAvKiogUmVzZXQgdGhlIGBSZWR1Y2VyQ3R4YCB0byBiZSB1c2VkIGZvciBhIG5ldyB0cmFuc2FjdGlvbiAqL1xuICBzdGF0aWMgcmVzZXQobWUsIHNlbmRlciwgdGltZXN0YW1wLCBjb25uZWN0aW9uSWQsIGRiVmlldywgYXNWaWV3cykge1xuICAgIG1lLnNlbmRlciA9IHNlbmRlcjtcbiAgICBtZS50aW1lc3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgbWUuY29ubmVjdGlvbklkID0gY29ubmVjdGlvbklkO1xuICAgIG1lLiN1dWlkQ291bnRlciA9IHZvaWQgMDtcbiAgICBtZS4jc2VuZGVyQXV0aCA9IHZvaWQgMDtcbiAgICBpZiAoZGJWaWV3ICE9PSB2b2lkIDApIHtcbiAgICAgIG1lLmRiID0gZGJWaWV3O1xuICAgIH1cbiAgICBpZiAoYXNWaWV3cyAhPT0gdm9pZCAwKSB7XG4gICAgICBtZS5hcyA9IGFzVmlld3M7XG4gICAgfVxuICB9XG4gIGdldCBkYXRhYmFzZUlkZW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLiNpZGVudGl0eSA/Pz0gbmV3IElkZW50aXR5KHN5cy5pZGVudGl0eSgpKTtcbiAgfVxuICBnZXQgaWRlbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YWJhc2VJZGVudGl0eTtcbiAgfVxuICBnZXQgc2VuZGVyQXV0aCgpIHtcbiAgICByZXR1cm4gdGhpcy4jc2VuZGVyQXV0aCA/Pz0gQXV0aEN0eEltcGwuZnJvbVN5c3RlbVRhYmxlcyhcbiAgICAgIHRoaXMuY29ubmVjdGlvbklkLFxuICAgICAgdGhpcy5zZW5kZXJcbiAgICApO1xuICB9XG4gIGdldCByYW5kb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuI3JhbmRvbSA/Pz0gbWFrZVJhbmRvbSh0aGlzLnRpbWVzdGFtcCk7XG4gIH1cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyByYW5kb20ge0BsaW5rIFV1aWR9IGB2NGAgdXNpbmcgdGhpcyBgUmVkdWNlckN0eGAncyBSTkcuXG4gICAqL1xuICBuZXdVdWlkVjQoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDE2KSk7XG4gICAgcmV0dXJuIFV1aWQuZnJvbVJhbmRvbUJ5dGVzVjQoYnl0ZXMpO1xuICB9XG4gIC8qKlxuICAgKiBDcmVhdGUgYSBuZXcgc29ydGFibGUge0BsaW5rIFV1aWR9IGB2N2AgdXNpbmcgdGhpcyBgUmVkdWNlckN0eGAncyBSTkcsIGNvdW50ZXIsXG4gICAqIGFuZCB0aW1lc3RhbXAuXG4gICAqL1xuICBuZXdVdWlkVjcoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDQpKTtcbiAgICBjb25zdCBjb3VudGVyID0gdGhpcy4jdXVpZENvdW50ZXIgPz89IHsgdmFsdWU6IDAgfTtcbiAgICByZXR1cm4gVXVpZC5mcm9tQ291bnRlclY3KGNvdW50ZXIsIHRoaXMudGltZXN0YW1wLCBieXRlcyk7XG4gIH1cbn07XG52YXIgY2FsbFVzZXJGdW5jdGlvbiA9IGZ1bmN0aW9uIF9fc3BhY2V0aW1lZGJfZW5kX3Nob3J0X2JhY2t0cmFjZShmbiwgLi4uYXJncykge1xuICByZXR1cm4gZm4oLi4uYXJncyk7XG59O1xuZnVuY3Rpb24gcnVuV2l0aFR4KG1ha2VDdHgsIGJvZHkpIHtcbiAgY29uc3QgcnVuID0gKCkgPT4ge1xuICAgIGNvbnN0IHRpbWVzdGFtcCA9IHN5cy5wcm9jZWR1cmVfc3RhcnRfbXV0X3R4KCk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBib2R5KG1ha2VDdHgobmV3IFRpbWVzdGFtcCh0aW1lc3RhbXApKSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgc3lzLnByb2NlZHVyZV9hYm9ydF9tdXRfdHgoKTtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9O1xuICBsZXQgcmVzID0gcnVuKCk7XG4gIHRyeSB7XG4gICAgc3lzLnByb2NlZHVyZV9jb21taXRfbXV0X3R4KCk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSBjYXRjaCB7XG4gIH1cbiAgY29uc29sZS53YXJuKFwiY29tbWl0dGluZyBhbm9ueW1vdXMgdHJhbnNhY3Rpb24gZmFpbGVkXCIpO1xuICByZXMgPSBydW4oKTtcbiAgdHJ5IHtcbiAgICBzeXMucHJvY2VkdXJlX2NvbW1pdF9tdXRfdHgoKTtcbiAgICByZXR1cm4gcmVzO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwidHJhbnNhY3Rpb24gcmV0cnkgZmFpbGVkIGFnYWluXCIsIHsgY2F1c2U6IGUgfSk7XG4gIH1cbn1cbmZ1bmN0aW9uIGZsYXR0ZW5TdWJtb2R1bGVEaXNwYXRjaGVzKGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCA9IFwiXCIpIHtcbiAgY29uc3QgcmVzdWx0ID0gW107XG4gIGZvciAoY29uc3QgZCBvZiBkaXNwYXRjaGVzKSB7XG4gICAgY29uc3QgbmFtZVByZWZpeCA9IHBhcmVudFByZWZpeCArIGQubmFtZXNwYWNlICsgXCIuXCI7XG4gICAgcmVzdWx0LnB1c2goe1xuICAgICAgcmVkdWNlckZuczogZC5yZWR1Y2VyRm5zLFxuICAgICAgcmVkdWNlckRlZnM6IGQucmVkdWNlckRlZnMsXG4gICAgICBwcm9jZWR1cmVGbnM6IGQucHJvY2VkdXJlRm5zLFxuICAgICAgcHJvY2VkdXJlRGVmczogZC5wcm9jZWR1cmVEZWZzLFxuICAgICAgYW5vblZpZXdGbnM6IGQuYW5vblZpZXdGbnMsXG4gICAgICB2aWV3Rm5zOiBkLnZpZXdGbnMsXG4gICAgICB0YWJsZXM6IGQudGFibGVzLFxuICAgICAgc2NoZW1hVGFibGVzOiBkLnNjaGVtYVRhYmxlcyxcbiAgICAgIHR5cGVzcGFjZTogZC50eXBlc3BhY2UsXG4gICAgICBkYlZpZXdfOiB2b2lkIDAsXG4gICAgICBxdWVyeUJ1aWxkZXJfOiB2b2lkIDAsXG4gICAgICBuYW1lUHJlZml4LFxuICAgICAgc3ViRGlzcGF0Y2hlczogZC5zdWJEaXNwYXRjaGVzXG4gICAgfSk7XG4gICAgcmVzdWx0LnB1c2goLi4uZmxhdHRlblN1Ym1vZHVsZURpc3BhdGNoZXMoZC5zdWJEaXNwYXRjaGVzLCBuYW1lUHJlZml4KSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbnZhciBtYWtlSG9va3MgPSAoc2NoZW1hMikgPT4gbmV3IE1vZHVsZUhvb2tzSW1wbChzY2hlbWEyKTtcbnZhciBNb2R1bGVIb29rc0ltcGwgPSBjbGFzcyB7XG4gICNzY2hlbWE7XG4gICNkYlZpZXdfO1xuICAjY29uc3VtZXJBc187XG4gICNyZWR1Y2VyQXJnc0Rlc2VyaWFsaXplcnM7XG4gICNjb25zdW1lclJlZHVjZXJDb3VudDtcbiAgI2NvbnN1bWVyUHJvY2VkdXJlQ291bnQ7XG4gICNmbGF0U3VibW9kdWxlcztcbiAgI2NvbnN1bWVyQW5vblZpZXdDb3VudDtcbiAgI2NvbnN1bWVyVmlld0NvdW50O1xuICAvKiogQ2FjaGUgdGhlIGBSZWR1Y2VyQ3R4YCBvYmplY3QgdG8gYXZvaWQgYWxsb2NhdGluZyBhbmV3IGZvciBldmVyeSByZWR1Y2VyIGNhbGwuICovXG4gICNyZWR1Y2VyQ3R4XztcbiAgLyoqIFBlci1zdWJtb2R1bGUgYWxpYXMgY3R4IG1hcHMsIGNhY2hlZCBsYXppbHkgKHBhcmFsbGVsIHRvICNmbGF0U3VibW9kdWxlcykuICovXG4gICNzdWJtb2R1bGVBc1ZpZXdzXyA9IFtdO1xuICBjb25zdHJ1Y3RvcihzY2hlbWEyKSB7XG4gICAgdGhpcy4jc2NoZW1hID0gc2NoZW1hMjtcbiAgICB0aGlzLiNjb25zdW1lclJlZHVjZXJDb3VudCA9IHNjaGVtYTIucmVkdWNlcnMubGVuZ3RoO1xuICAgIHRoaXMuI2NvbnN1bWVyUHJvY2VkdXJlQ291bnQgPSBzY2hlbWEyLnByb2NlZHVyZXMubGVuZ3RoO1xuICAgIHRoaXMuI2NvbnN1bWVyQW5vblZpZXdDb3VudCA9IHNjaGVtYTIuYW5vblZpZXdzLmxlbmd0aDtcbiAgICB0aGlzLiNjb25zdW1lclZpZXdDb3VudCA9IHNjaGVtYTIudmlld3MubGVuZ3RoO1xuICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzID0gZmxhdHRlblN1Ym1vZHVsZURpc3BhdGNoZXMoXG4gICAgICBzY2hlbWEyLnN1Ym1vZHVsZURpc3BhdGNoSW5mb3NcbiAgICApO1xuICAgIGNvbnN0IGNvbnN1bWVyRGVzZXJpYWxpemVycyA9IHNjaGVtYTIubW9kdWxlRGVmLnJlZHVjZXJzLm1hcChcbiAgICAgICh7IHBhcmFtcyB9KSA9PiBQcm9kdWN0VHlwZS5tYWtlRGVzZXJpYWxpemVyKHBhcmFtcywgc2NoZW1hMi50eXBlc3BhY2UpXG4gICAgKTtcbiAgICBjb25zdCBzdWJtb2R1bGVEZXNlcmlhbGl6ZXJzID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXMuZmxhdE1hcChcbiAgICAgICh7IHJlZHVjZXJEZWZzLCB0eXBlc3BhY2UgfSkgPT4gcmVkdWNlckRlZnMubWFwKFxuICAgICAgICAoeyBwYXJhbXMgfSkgPT4gUHJvZHVjdFR5cGUubWFrZURlc2VyaWFsaXplcihwYXJhbXMsIHR5cGVzcGFjZSlcbiAgICAgIClcbiAgICApO1xuICAgIHRoaXMuI3JlZHVjZXJBcmdzRGVzZXJpYWxpemVycyA9IFtcbiAgICAgIC4uLmNvbnN1bWVyRGVzZXJpYWxpemVycyxcbiAgICAgIC4uLnN1Ym1vZHVsZURlc2VyaWFsaXplcnNcbiAgICBdO1xuICB9XG4gIGdldCAjZGJWaWV3KCkge1xuICAgIGlmICh0aGlzLiNkYlZpZXdfICE9PSB2b2lkIDApIHJldHVybiB0aGlzLiNkYlZpZXdfO1xuICAgIGNvbnN0IHJvb3RUYWJsZXMgPSBPYmplY3QudmFsdWVzKHRoaXMuI3NjaGVtYS5zY2hlbWFUeXBlLnRhYmxlcykubWFwKFxuICAgICAgKHRhYmxlMikgPT4gW1xuICAgICAgICB0YWJsZTIuYWNjZXNzb3JOYW1lLFxuICAgICAgICBtYWtlVGFibGVWaWV3KHRoaXMuI3NjaGVtYS50eXBlc3BhY2UsIHRhYmxlMi50YWJsZURlZilcbiAgICAgIF1cbiAgICApO1xuICAgIGNvbnN0IHN1Ym1vZHVsZU5zID0gdGhpcy4jc2NoZW1hLnN1Ym1vZHVsZURpc3BhdGNoSW5mb3MubWFwKChkaXNwYXRjaCkgPT4gW1xuICAgICAgZGlzcGF0Y2gubmFtZXNwYWNlLFxuICAgICAgYnVpbGREYlZpZXdGb3JEaXNwYXRjaChkaXNwYXRjaCwgZGlzcGF0Y2gubmFtZXNwYWNlICsgXCIuXCIpXG4gICAgXSk7XG4gICAgdGhpcy4jZGJWaWV3XyA9IGZyZWV6ZShcbiAgICAgIE9iamVjdC5mcm9tRW50cmllcyhbLi4ucm9vdFRhYmxlcywgLi4uc3VibW9kdWxlTnNdKVxuICAgICk7XG4gICAgcmV0dXJuIHRoaXMuI2RiVmlld187XG4gIH1cbiAgI2dldFN1Ym1vZHVsZURiVmlldyhzdWJtb2R1bGVJZHgpIHtcbiAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbc3VibW9kdWxlSWR4XTtcbiAgICByZXR1cm4gbS5kYlZpZXdfID8/PSBmcmVlemUoXG4gICAgICBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICAgIG0udGFibGVzLm1hcCgoeyBhY2Nlc3Nvck5hbWUsIHRhYmxlRGVmIH0pID0+IFtcbiAgICAgICAgICBhY2Nlc3Nvck5hbWUsXG4gICAgICAgICAgbWFrZVRhYmxlVmlldyhtLnR5cGVzcGFjZSwgdGFibGVEZWYsIG0ubmFtZVByZWZpeClcbiAgICAgICAgXSlcbiAgICAgIClcbiAgICApO1xuICB9XG4gICNnZXRTdWJtb2R1bGVBc1ZpZXdzKHN1Ym1vZHVsZUlkeCkge1xuICAgIHJldHVybiB0aGlzLiNzdWJtb2R1bGVBc1ZpZXdzX1tzdWJtb2R1bGVJZHhdID8/PSBidWlsZEFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcy4jcmVkdWNlckN0eCxcbiAgICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzW3N1Ym1vZHVsZUlkeF0uc3ViRGlzcGF0Y2hlcyxcbiAgICAgIHRoaXMuI2ZsYXRTdWJtb2R1bGVzW3N1Ym1vZHVsZUlkeF0ubmFtZVByZWZpeFxuICAgICk7XG4gIH1cbiAgLyoqIFF1ZXJ5IGJ1aWxkZXIgc2NvcGVkIHRvIHRoZSBzdWJtb2R1bGUncyBvd24gdGFibGVzLCB3aXRoIG5hbWVzcGFjZS1wcmVmaXhlZFxuICAgKiAgc291cmNlIG5hbWVzIHNvIGdlbmVyYXRlZCBTUUwgdGFyZ2V0cyB0aGUgbW91bnRlZCB0YWJsZSBuYW1lcy4gKi9cbiAgI2dldFN1Ym1vZHVsZVF1ZXJ5QnVpbGRlcihzdWJtb2R1bGVJZHgpIHtcbiAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbc3VibW9kdWxlSWR4XTtcbiAgICByZXR1cm4gbS5xdWVyeUJ1aWxkZXJfID8/PSBtYWtlUXVlcnlCdWlsZGVyKHtcbiAgICAgIHRhYmxlczogT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgICBPYmplY3QuZW50cmllcyhtLnNjaGVtYVRhYmxlcykubWFwKChba2V5LCBkZWZdKSA9PiBbXG4gICAgICAgICAga2V5LFxuICAgICAgICAgIHsgLi4uZGVmLCBzb3VyY2VOYW1lOiBtLm5hbWVQcmVmaXggKyBkZWYuc291cmNlTmFtZSB9XG4gICAgICAgIF0pXG4gICAgICApXG4gICAgfSk7XG4gIH1cbiAgZ2V0ICNyZWR1Y2VyQ3R4KCkge1xuICAgIHJldHVybiB0aGlzLiNyZWR1Y2VyQ3R4XyA/Pz0gbmV3IFJlZHVjZXJDdHhJbXBsKFxuICAgICAgSWRlbnRpdHkuemVybygpLFxuICAgICAgVGltZXN0YW1wLlVOSVhfRVBPQ0gsXG4gICAgICBudWxsLFxuICAgICAgdGhpcy4jZGJWaWV3XG4gICAgKTtcbiAgfVxuICBnZXQgI2NvbnN1bWVyQXMoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2NvbnN1bWVyQXNfID8/PSBidWlsZEFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcy4jcmVkdWNlckN0eCxcbiAgICAgIHRoaXMuI3NjaGVtYS5zdWJtb2R1bGVEaXNwYXRjaEluZm9zLFxuICAgICAgXCJcIlxuICAgICk7XG4gIH1cbiAgX19kZXNjcmliZV9tb2R1bGVfXygpIHtcbiAgICBjb25zdCB3cml0ZXIgPSBuZXcgQmluYXJ5V3JpdGVyKDEyOCk7XG4gICAgUmF3TW9kdWxlRGVmLnNlcmlhbGl6ZShcbiAgICAgIHdyaXRlcixcbiAgICAgIFJhd01vZHVsZURlZi5WMTAodGhpcy4jc2NoZW1hLnJhd01vZHVsZURlZlYxMCgpKVxuICAgICk7XG4gICAgcmV0dXJuIHdyaXRlci5nZXRCdWZmZXIoKTtcbiAgfVxuICBfX2dldF9lcnJvcl9jb25zdHJ1Y3Rvcl9fKGNvZGUpIHtcbiAgICByZXR1cm4gZ2V0RXJyb3JDb25zdHJ1Y3Rvcihjb2RlKTtcbiAgfVxuICBnZXQgX19zZW5kZXJfZXJyb3JfY2xhc3NfXygpIHtcbiAgICByZXR1cm4gU2VuZGVyRXJyb3I7XG4gIH1cbiAgX19jYWxsX3JlZHVjZXJfXyhyZWR1Y2VySWQsIHNlbmRlciwgY29ubklkLCB0aW1lc3RhbXAsIGFyZ3NCdWYpIHtcbiAgICBjb25zdCBkZXNlcmlhbGl6ZUFyZ3MgPSB0aGlzLiNyZWR1Y2VyQXJnc0Rlc2VyaWFsaXplcnNbcmVkdWNlcklkXTtcbiAgICBCSU5BUllfUkVBREVSLnJlc2V0KGFyZ3NCdWYpO1xuICAgIGNvbnN0IGFyZ3MgPSBkZXNlcmlhbGl6ZUFyZ3MoQklOQVJZX1JFQURFUik7XG4gICAgY29uc3Qgc2VuZGVySWRlbnRpdHkgPSBuZXcgSWRlbnRpdHkoc2VuZGVyKTtcbiAgICBsZXQgZm47XG4gICAgbGV0IGRiVmlldztcbiAgICBsZXQgYXNWaWV3cztcbiAgICBpZiAocmVkdWNlcklkIDwgdGhpcy4jY29uc3VtZXJSZWR1Y2VyQ291bnQpIHtcbiAgICAgIGZuID0gdGhpcy4jc2NoZW1hLnJlZHVjZXJzW3JlZHVjZXJJZF07XG4gICAgICBkYlZpZXcgPSB0aGlzLiNkYlZpZXc7XG4gICAgICBhc1ZpZXdzID0gdGhpcy4jY29uc3VtZXJBcztcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG9mZnNldCA9IHRoaXMuI2NvbnN1bWVyUmVkdWNlckNvdW50O1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLiNmbGF0U3VibW9kdWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICAgIGlmIChyZWR1Y2VySWQgPCBvZmZzZXQgKyBtLnJlZHVjZXJGbnMubGVuZ3RoKSB7XG4gICAgICAgICAgZm4gPSBtLnJlZHVjZXJGbnNbcmVkdWNlcklkIC0gb2Zmc2V0XTtcbiAgICAgICAgICBkYlZpZXcgPSB0aGlzLiNnZXRTdWJtb2R1bGVEYlZpZXcoaSk7XG4gICAgICAgICAgYXNWaWV3cyA9IHRoaXMuI2dldFN1Ym1vZHVsZUFzVmlld3MoaSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgb2Zmc2V0ICs9IG0ucmVkdWNlckZucy5sZW5ndGg7XG4gICAgICB9XG4gICAgICBpZiAoZm4gPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihgdW5rbm93biByZWR1Y2VySWQgJHtyZWR1Y2VySWR9YCk7XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGN0eCA9IHRoaXMuI3JlZHVjZXJDdHg7XG4gICAgUmVkdWNlckN0eEltcGwucmVzZXQoXG4gICAgICBjdHgsXG4gICAgICBzZW5kZXJJZGVudGl0eSxcbiAgICAgIG5ldyBUaW1lc3RhbXAodGltZXN0YW1wKSxcbiAgICAgIENvbm5lY3Rpb25JZC5udWxsSWZaZXJvKG5ldyBDb25uZWN0aW9uSWQoY29ubklkKSksXG4gICAgICBkYlZpZXcsXG4gICAgICBhc1ZpZXdzXG4gICAgKTtcbiAgICBjYWxsVXNlckZ1bmN0aW9uKGZuLCBjdHgsIGFyZ3MpO1xuICB9XG4gIF9fY2FsbF92aWV3X18oaWQsIHNlbmRlciwgYXJnc0J1Zikge1xuICAgIGNvbnN0IG1vZHVsZUN0eCA9IHRoaXMuI3NjaGVtYTtcbiAgICBsZXQgdmlld0ZucztcbiAgICBsZXQgbG9jYWxJZDtcbiAgICBsZXQgZGJWaWV3O1xuICAgIGxldCBmcm9tO1xuICAgIGlmIChpZCA8IHRoaXMuI2NvbnN1bWVyVmlld0NvdW50KSB7XG4gICAgICB2aWV3Rm5zID0gbW9kdWxlQ3R4LnZpZXdzO1xuICAgICAgbG9jYWxJZCA9IGlkO1xuICAgICAgZGJWaWV3ID0gdGhpcy4jZGJWaWV3O1xuICAgICAgZnJvbSA9IG1ha2VRdWVyeUJ1aWxkZXIobW9kdWxlQ3R4LnNjaGVtYVR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgb2Zmc2V0ID0gdGhpcy4jY29uc3VtZXJWaWV3Q291bnQ7XG4gICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy4jZmxhdFN1Ym1vZHVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuI2ZsYXRTdWJtb2R1bGVzW2ldO1xuICAgICAgICBpZiAoaWQgPCBvZmZzZXQgKyBtLnZpZXdGbnMubGVuZ3RoKSB7XG4gICAgICAgICAgdmlld0ZucyA9IG0udmlld0ZucztcbiAgICAgICAgICBsb2NhbElkID0gaWQgLSBvZmZzZXQ7XG4gICAgICAgICAgZGJWaWV3ID0gdGhpcy4jZ2V0U3VibW9kdWxlRGJWaWV3KGkpO1xuICAgICAgICAgIGZyb20gPSB0aGlzLiNnZXRTdWJtb2R1bGVRdWVyeUJ1aWxkZXIoaSk7XG4gICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIG9mZnNldCArPSBtLnZpZXdGbnMubGVuZ3RoO1xuICAgICAgfVxuICAgICAgaWYgKCFmb3VuZCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoYHVua25vd24gdmlld0lkICR7aWR9YCk7XG4gICAgfVxuICAgIGNvbnN0IHsgZm4sIGRlc2VyaWFsaXplUGFyYW1zLCBzZXJpYWxpemVSZXR1cm4sIHJldHVyblR5cGVCYXNlU2l6ZSB9ID0gdmlld0Zuc1tsb2NhbElkXTtcbiAgICBjb25zdCBjdHggPSBmcmVlemUoe1xuICAgICAgc2VuZGVyOiBuZXcgSWRlbnRpdHkoc2VuZGVyKSxcbiAgICAgIGRiOiBkYlZpZXcsXG4gICAgICBmcm9tXG4gICAgfSk7XG4gICAgY29uc3QgYXJncyA9IGRlc2VyaWFsaXplUGFyYW1zKG5ldyBCaW5hcnlSZWFkZXIoYXJnc0J1ZikpO1xuICAgIGNvbnN0IHJldCA9IGNhbGxVc2VyRnVuY3Rpb24oZm4sIGN0eCwgYXJncyk7XG4gICAgY29uc3QgcmV0QnVmID0gbmV3IEJpbmFyeVdyaXRlcihyZXR1cm5UeXBlQmFzZVNpemUpO1xuICAgIGlmIChpc1Jvd1R5cGVkUXVlcnkocmV0KSkge1xuICAgICAgY29uc3QgcXVlcnkgPSB0b1NxbChyZXQpO1xuICAgICAgVmlld1Jlc3VsdEhlYWRlci5zZXJpYWxpemUocmV0QnVmLCBWaWV3UmVzdWx0SGVhZGVyLlJhd1NxbChxdWVyeSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBWaWV3UmVzdWx0SGVhZGVyLnNlcmlhbGl6ZShyZXRCdWYsIFZpZXdSZXN1bHRIZWFkZXIuUm93RGF0YSk7XG4gICAgICBzZXJpYWxpemVSZXR1cm4ocmV0QnVmLCByZXQpO1xuICAgIH1cbiAgICByZXR1cm4geyBkYXRhOiByZXRCdWYuZ2V0QnVmZmVyKCkgfTtcbiAgfVxuICBfX2NhbGxfdmlld19hbm9uX18oaWQsIGFyZ3NCdWYpIHtcbiAgICBjb25zdCBtb2R1bGVDdHggPSB0aGlzLiNzY2hlbWE7XG4gICAgbGV0IGFub25WaWV3Rm5zO1xuICAgIGxldCBsb2NhbElkO1xuICAgIGxldCBkYlZpZXc7XG4gICAgbGV0IGZyb207XG4gICAgaWYgKGlkIDwgdGhpcy4jY29uc3VtZXJBbm9uVmlld0NvdW50KSB7XG4gICAgICBhbm9uVmlld0ZucyA9IG1vZHVsZUN0eC5hbm9uVmlld3M7XG4gICAgICBsb2NhbElkID0gaWQ7XG4gICAgICBkYlZpZXcgPSB0aGlzLiNkYlZpZXc7XG4gICAgICBmcm9tID0gbWFrZVF1ZXJ5QnVpbGRlcihtb2R1bGVDdHguc2NoZW1hVHlwZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBvZmZzZXQgPSB0aGlzLiNjb25zdW1lckFub25WaWV3Q291bnQ7XG4gICAgICBsZXQgZm91bmQgPSBmYWxzZTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy4jZmxhdFN1Ym1vZHVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgY29uc3QgbSA9IHRoaXMuI2ZsYXRTdWJtb2R1bGVzW2ldO1xuICAgICAgICBpZiAoaWQgPCBvZmZzZXQgKyBtLmFub25WaWV3Rm5zLmxlbmd0aCkge1xuICAgICAgICAgIGFub25WaWV3Rm5zID0gbS5hbm9uVmlld0ZucztcbiAgICAgICAgICBsb2NhbElkID0gaWQgLSBvZmZzZXQ7XG4gICAgICAgICAgZGJWaWV3ID0gdGhpcy4jZ2V0U3VibW9kdWxlRGJWaWV3KGkpO1xuICAgICAgICAgIGZyb20gPSB0aGlzLiNnZXRTdWJtb2R1bGVRdWVyeUJ1aWxkZXIoaSk7XG4gICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIG9mZnNldCArPSBtLmFub25WaWV3Rm5zLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIGlmICghZm91bmQpIHRocm93IG5ldyBSYW5nZUVycm9yKGB1bmtub3duIGFub25WaWV3SWQgJHtpZH1gKTtcbiAgICB9XG4gICAgY29uc3QgeyBmbiwgZGVzZXJpYWxpemVQYXJhbXMsIHNlcmlhbGl6ZVJldHVybiwgcmV0dXJuVHlwZUJhc2VTaXplIH0gPSBhbm9uVmlld0Zuc1tsb2NhbElkXTtcbiAgICBjb25zdCBjdHggPSBmcmVlemUoe1xuICAgICAgZGI6IGRiVmlldyxcbiAgICAgIGZyb21cbiAgICB9KTtcbiAgICBjb25zdCBhcmdzID0gZGVzZXJpYWxpemVQYXJhbXMobmV3IEJpbmFyeVJlYWRlcihhcmdzQnVmKSk7XG4gICAgY29uc3QgcmV0ID0gY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgICBjb25zdCByZXRCdWYgPSBuZXcgQmluYXJ5V3JpdGVyKHJldHVyblR5cGVCYXNlU2l6ZSk7XG4gICAgaWYgKGlzUm93VHlwZWRRdWVyeShyZXQpKSB7XG4gICAgICBjb25zdCBxdWVyeSA9IHRvU3FsKHJldCk7XG4gICAgICBWaWV3UmVzdWx0SGVhZGVyLnNlcmlhbGl6ZShyZXRCdWYsIFZpZXdSZXN1bHRIZWFkZXIuUmF3U3FsKHF1ZXJ5KSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIFZpZXdSZXN1bHRIZWFkZXIuc2VyaWFsaXplKHJldEJ1ZiwgVmlld1Jlc3VsdEhlYWRlci5Sb3dEYXRhKTtcbiAgICAgIHNlcmlhbGl6ZVJldHVybihyZXRCdWYsIHJldCk7XG4gICAgfVxuICAgIHJldHVybiB7IGRhdGE6IHJldEJ1Zi5nZXRCdWZmZXIoKSB9O1xuICB9XG4gIF9fY2FsbF9wcm9jZWR1cmVfXyhpZCwgc2VuZGVyLCBjb25uZWN0aW9uX2lkLCB0aW1lc3RhbXAsIGFyZ3MpIHtcbiAgICBjb25zdCBzZW5kZXJJZGVudGl0eSA9IG5ldyBJZGVudGl0eShzZW5kZXIpO1xuICAgIGNvbnN0IGNvbm5JZCA9IENvbm5lY3Rpb25JZC5udWxsSWZaZXJvKG5ldyBDb25uZWN0aW9uSWQoY29ubmVjdGlvbl9pZCkpO1xuICAgIGNvbnN0IHRzID0gbmV3IFRpbWVzdGFtcCh0aW1lc3RhbXApO1xuICAgIGlmIChpZCA8IHRoaXMuI2NvbnN1bWVyUHJvY2VkdXJlQ291bnQpIHtcbiAgICAgIHJldHVybiBjYWxsUHJvY2VkdXJlKFxuICAgICAgICB0aGlzLiNzY2hlbWEucHJvY2VkdXJlcyxcbiAgICAgICAgaWQsXG4gICAgICAgIHNlbmRlcklkZW50aXR5LFxuICAgICAgICBjb25uSWQsXG4gICAgICAgIHRzLFxuICAgICAgICBhcmdzLFxuICAgICAgICAoKSA9PiB0aGlzLiNkYlZpZXcsXG4gICAgICAgIHRoaXMuI3NjaGVtYS5zdWJtb2R1bGVEaXNwYXRjaEluZm9zXG4gICAgICApO1xuICAgIH1cbiAgICBsZXQgb2Zmc2V0ID0gdGhpcy4jY29uc3VtZXJQcm9jZWR1cmVDb3VudDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuI2ZsYXRTdWJtb2R1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBtID0gdGhpcy4jZmxhdFN1Ym1vZHVsZXNbaV07XG4gICAgICBpZiAoaWQgPCBvZmZzZXQgKyBtLnByb2NlZHVyZUZucy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxQcm9jZWR1cmUoXG4gICAgICAgICAgbS5wcm9jZWR1cmVGbnMsXG4gICAgICAgICAgaWQgLSBvZmZzZXQsXG4gICAgICAgICAgc2VuZGVySWRlbnRpdHksXG4gICAgICAgICAgY29ubklkLFxuICAgICAgICAgIHRzLFxuICAgICAgICAgIGFyZ3MsXG4gICAgICAgICAgKCkgPT4gdGhpcy4jZ2V0U3VibW9kdWxlRGJWaWV3KGkpLFxuICAgICAgICAgIG0uc3ViRGlzcGF0Y2hlcyxcbiAgICAgICAgICBtLm5hbWVQcmVmaXhcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIG9mZnNldCArPSBtLnByb2NlZHVyZUZucy5sZW5ndGg7XG4gICAgfVxuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGB1bmtub3duIHByb2NlZHVyZUlkICR7aWR9YCk7XG4gIH1cbiAgX19jYWxsX2h0dHBfaGFuZGxlcl9fKGlkLCB0aW1lc3RhbXAsIHJlcXVlc3QsIGJvZHkpIHtcbiAgICBjb25zdCBtb2R1bGVDdHggPSB0aGlzLiNzY2hlbWE7XG4gICAgY29uc3QgaGFuZGxlciA9IG1vZHVsZUN0eC5odHRwSGFuZGxlcnNbaWRdO1xuICAgIGNvbnN0IGN0eCA9IG5ldyBIYW5kbGVyQ29udGV4dEltcGwoXG4gICAgICBuZXcgVGltZXN0YW1wKHRpbWVzdGFtcCksXG4gICAgICAoKSA9PiB0aGlzLiNkYlZpZXcsXG4gICAgICB0aGlzLiNzY2hlbWEuc3VibW9kdWxlRGlzcGF0Y2hJbmZvc1xuICAgICk7XG4gICAgY29uc3QgcmVxdWVzdE1ldGFkYXRhID0gSHR0cFJlcXVlc3QuZGVzZXJpYWxpemUobmV3IEJpbmFyeVJlYWRlcihyZXF1ZXN0KSk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBjYWxsVXNlckZ1bmN0aW9uKFxuICAgICAgaGFuZGxlcixcbiAgICAgIGN0eCxcbiAgICAgIHJlcXVlc3RGcm9tV2lyZShyZXF1ZXN0TWV0YWRhdGEsIGJvZHkpXG4gICAgKTtcbiAgICBjb25zdCBbcmVzcG9uc2VNZXRhZGF0YSwgcmVzcG9uc2VCb2R5XSA9IHJlc3BvbnNlSW50b1dpcmUocmVzcG9uc2UpO1xuICAgIGNvbnN0IHJlc3BvbnNlQnVmID0gbmV3IEJpbmFyeVdyaXRlcihcbiAgICAgIGJzYXRuQmFzZVNpemUobW9kdWxlQ3R4LnR5cGVzcGFjZSwgSHR0cFJlc3BvbnNlLmFsZ2VicmFpY1R5cGUpXG4gICAgKTtcbiAgICBIdHRwUmVzcG9uc2Uuc2VyaWFsaXplKHJlc3BvbnNlQnVmLCByZXNwb25zZU1ldGFkYXRhKTtcbiAgICByZXR1cm4gW3Jlc3BvbnNlQnVmLmdldEJ1ZmZlcigpLCByZXNwb25zZUJvZHldO1xuICB9XG59O1xudmFyIEJJTkFSWV9XUklURVIgPSBuZXcgQmluYXJ5V3JpdGVyKDApO1xudmFyIEJJTkFSWV9SRUFERVIgPSBuZXcgQmluYXJ5UmVhZGVyKG5ldyBVaW50OEFycmF5KCkpO1xudmFyIEhhbmRsZXJDb250ZXh0SW1wbCA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IodGltZXN0YW1wLCBkYlZpZXcsIGRpc3BhdGNoZXMgPSBbXSkge1xuICAgIHRoaXMudGltZXN0YW1wID0gdGltZXN0YW1wO1xuICAgIHRoaXMuI2RiVmlldyA9IGRiVmlldztcbiAgICB0aGlzLiNkaXNwYXRjaGVzID0gZGlzcGF0Y2hlcztcbiAgfVxuICAjaWRlbnRpdHk7XG4gICN1dWlkQ291bnRlcjtcbiAgI3JhbmRvbTtcbiAgI2RiVmlldztcbiAgI2Rpc3BhdGNoZXM7XG4gICNhc1ZpZXdzO1xuICBodHRwID0gaHR0cENsaWVudDtcbiAgZ2V0IGlkZW50aXR5KCkge1xuICAgIHJldHVybiB0aGlzLiNpZGVudGl0eSA/Pz0gbmV3IElkZW50aXR5KHN5cy5pZGVudGl0eSgpKTtcbiAgfVxuICBnZXQgcmFuZG9tKCkge1xuICAgIHJldHVybiB0aGlzLiNyYW5kb20gPz89IG1ha2VSYW5kb20odGhpcy50aW1lc3RhbXApO1xuICB9XG4gIGdldCBhcygpIHtcbiAgICByZXR1cm4gdGhpcy4jYXNWaWV3cyA/Pz0gYnVpbGRIYW5kbGVyQWxpYXNDdHhNYXAoXG4gICAgICB0aGlzLFxuICAgICAgdGhpcy4jZGlzcGF0Y2hlcyxcbiAgICAgIFwiXCJcbiAgICApO1xuICB9XG4gIHdpdGhUeChib2R5KSB7XG4gICAgY29uc3QgZGlzcGF0Y2hlcyA9IHRoaXMuI2Rpc3BhdGNoZXM7XG4gICAgcmV0dXJuIHJ1bldpdGhUeCgodGltZXN0YW1wKSA9PiB7XG4gICAgICBjb25zdCB0eCA9IG5ldyBSZWR1Y2VyQ3R4SW1wbChcbiAgICAgICAgSWRlbnRpdHkuemVybygpLFxuICAgICAgICB0aW1lc3RhbXAsXG4gICAgICAgIG51bGwsXG4gICAgICAgIHRoaXMuI2RiVmlldygpXG4gICAgICApO1xuICAgICAgaWYgKGRpc3BhdGNoZXMubGVuZ3RoID4gMCkge1xuICAgICAgICB0eC5hcyA9IGJ1aWxkQWxpYXNDdHhNYXAodHgsIGRpc3BhdGNoZXMsIFwiXCIpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHR4O1xuICAgIH0sIGJvZHkpO1xuICB9XG4gIG5ld1V1aWRWNCgpIHtcbiAgICBjb25zdCBieXRlcyA9IHRoaXMucmFuZG9tLmZpbGwobmV3IFVpbnQ4QXJyYXkoMTYpKTtcbiAgICByZXR1cm4gVXVpZC5mcm9tUmFuZG9tQnl0ZXNWNChieXRlcyk7XG4gIH1cbiAgbmV3VXVpZFY3KCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy5yYW5kb20uZmlsbChuZXcgVWludDhBcnJheSg0KSk7XG4gICAgY29uc3QgY291bnRlciA9IHRoaXMuI3V1aWRDb3VudGVyID8/PSB7IHZhbHVlOiAwIH07XG4gICAgcmV0dXJuIFV1aWQuZnJvbUNvdW50ZXJWNyhjb3VudGVyLCB0aGlzLnRpbWVzdGFtcCwgYnl0ZXMpO1xuICB9XG59O1xuZnVuY3Rpb24gYnVpbGREYlZpZXdGb3JEaXNwYXRjaChkaXNwYXRjaCwgbmFtZVByZWZpeCkge1xuICBjb25zdCB0YWJsZUVudHJpZXMgPSBkaXNwYXRjaC50YWJsZXMubWFwKCh7IGFjY2Vzc29yTmFtZSwgdGFibGVEZWYgfSkgPT4gW1xuICAgIGFjY2Vzc29yTmFtZSxcbiAgICBtYWtlVGFibGVWaWV3KGRpc3BhdGNoLnR5cGVzcGFjZSwgdGFibGVEZWYsIG5hbWVQcmVmaXgpXG4gIF0pO1xuICBjb25zdCBzdWJOc0VudHJpZXMgPSBkaXNwYXRjaC5zdWJEaXNwYXRjaGVzLm1hcCgoc3ViKSA9PiBbXG4gICAgc3ViLm5hbWVzcGFjZSxcbiAgICBidWlsZERiVmlld0ZvckRpc3BhdGNoKHN1YiwgbmFtZVByZWZpeCArIHN1Yi5uYW1lc3BhY2UgKyBcIi5cIilcbiAgXSk7XG4gIHJldHVybiBmcmVlemUoT2JqZWN0LmZyb21FbnRyaWVzKFsuLi50YWJsZUVudHJpZXMsIC4uLnN1Yk5zRW50cmllc10pKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkQWxpYXNDdHgocGFyZW50LCBkaXNwYXRjaCwgbmFtZVByZWZpeCkge1xuICBjb25zdCBuc0RiID0gYnVpbGREYlZpZXdGb3JEaXNwYXRjaChkaXNwYXRjaCwgbmFtZVByZWZpeCk7XG4gIGNvbnN0IHN1YkFzID0gYnVpbGRBbGlhc0N0eE1hcChwYXJlbnQsIGRpc3BhdGNoLnN1YkRpc3BhdGNoZXMsIG5hbWVQcmVmaXgpO1xuICByZXR1cm4ge1xuICAgIGdldCBzZW5kZXIoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnNlbmRlcjtcbiAgICB9LFxuICAgIGdldCBkYXRhYmFzZUlkZW50aXR5KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5kYXRhYmFzZUlkZW50aXR5O1xuICAgIH0sXG4gICAgZ2V0IGlkZW50aXR5KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5pZGVudGl0eTtcbiAgICB9LFxuICAgIGdldCB0aW1lc3RhbXAoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnRpbWVzdGFtcDtcbiAgICB9LFxuICAgIGdldCBjb25uZWN0aW9uSWQoKSB7XG4gICAgICByZXR1cm4gcGFyZW50LmNvbm5lY3Rpb25JZDtcbiAgICB9LFxuICAgIGdldCBzZW5kZXJBdXRoKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5zZW5kZXJBdXRoO1xuICAgIH0sXG4gICAgZ2V0IHJhbmRvbSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQucmFuZG9tO1xuICAgIH0sXG4gICAgbmV3VXVpZFY0KCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5uZXdVdWlkVjQoKTtcbiAgICB9LFxuICAgIG5ld1V1aWRWNygpIHtcbiAgICAgIHJldHVybiBwYXJlbnQubmV3VXVpZFY3KCk7XG4gICAgfSxcbiAgICBkYjogbnNEYixcbiAgICBhczogc3ViQXNcbiAgfTtcbn1cbmZ1bmN0aW9uIGJ1aWxkQWxpYXNDdHhNYXAocGFyZW50LCBkaXNwYXRjaGVzLCBwYXJlbnRQcmVmaXgpIHtcbiAgcmV0dXJuIGZyZWV6ZShcbiAgICBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICBkaXNwYXRjaGVzLm1hcCgoZCkgPT4gW1xuICAgICAgICBkLm5hbWVzcGFjZSxcbiAgICAgICAgYnVpbGRBbGlhc0N0eChwYXJlbnQsIGQsIHBhcmVudFByZWZpeCArIGQubmFtZXNwYWNlICsgXCIuXCIpXG4gICAgICBdKVxuICAgIClcbiAgKTtcbn1cbmZ1bmN0aW9uIGJ1aWxkSGFuZGxlckFsaWFzQ3R4KHBhcmVudCwgZGlzcGF0Y2gsIG5hbWVQcmVmaXgpIHtcbiAgbGV0IG5zRGJfO1xuICBjb25zdCBzdWJBcyA9IGJ1aWxkSGFuZGxlckFsaWFzQ3R4TWFwKFxuICAgIHBhcmVudCxcbiAgICBkaXNwYXRjaC5zdWJEaXNwYXRjaGVzLFxuICAgIG5hbWVQcmVmaXhcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBnZXQgdGltZXN0YW1wKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC50aW1lc3RhbXA7XG4gICAgfSxcbiAgICBnZXQgaHR0cCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuaHR0cDtcbiAgICB9LFxuICAgIGdldCBpZGVudGl0eSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuaWRlbnRpdHk7XG4gICAgfSxcbiAgICBnZXQgcmFuZG9tKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5yYW5kb207XG4gICAgfSxcbiAgICBhczogc3ViQXMsXG4gICAgd2l0aFR4KGJvZHkpIHtcbiAgICAgIHJldHVybiBydW5XaXRoVHgoKHRzKSA9PiB7XG4gICAgICAgIGNvbnN0IHR4ID0gbmV3IFJlZHVjZXJDdHhJbXBsKFxuICAgICAgICAgIElkZW50aXR5Lnplcm8oKSxcbiAgICAgICAgICB0cyxcbiAgICAgICAgICBudWxsLFxuICAgICAgICAgIG5zRGJfID8/PSBidWlsZERiVmlld0ZvckRpc3BhdGNoKFxuICAgICAgICAgICAgZGlzcGF0Y2gsXG4gICAgICAgICAgICBuYW1lUHJlZml4XG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgICBhc3NpZ25UeEFsaWFzVmlld3ModHgsIGRpc3BhdGNoLnN1YkRpc3BhdGNoZXMsIG5hbWVQcmVmaXgpO1xuICAgICAgICByZXR1cm4gdHg7XG4gICAgICB9LCBib2R5KTtcbiAgICB9LFxuICAgIG5ld1V1aWRWNCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQubmV3VXVpZFY0KCk7XG4gICAgfSxcbiAgICBuZXdVdWlkVjcoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lm5ld1V1aWRWNygpO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGJ1aWxkSGFuZGxlckFsaWFzQ3R4TWFwKHBhcmVudCwgZGlzcGF0Y2hlcywgcGFyZW50UHJlZml4KSB7XG4gIHJldHVybiBmcmVlemUoXG4gICAgT2JqZWN0LmZyb21FbnRyaWVzKFxuICAgICAgZGlzcGF0Y2hlcy5tYXAoKGQpID0+IFtcbiAgICAgICAgZC5uYW1lc3BhY2UsXG4gICAgICAgIGJ1aWxkSGFuZGxlckFsaWFzQ3R4KHBhcmVudCwgZCwgcGFyZW50UHJlZml4ICsgZC5uYW1lc3BhY2UgKyBcIi5cIilcbiAgICAgIF0pXG4gICAgKVxuICApO1xufVxuZnVuY3Rpb24gYnVpbGRQcm9jZWR1cmVBbGlhc0N0eChwYXJlbnQsIGRpc3BhdGNoLCBuYW1lUHJlZml4KSB7XG4gIGxldCBuc0RiXztcbiAgY29uc3Qgc3ViQXMgPSBidWlsZFByb2NlZHVyZUFsaWFzQ3R4TWFwKFxuICAgIHBhcmVudCxcbiAgICBkaXNwYXRjaC5zdWJEaXNwYXRjaGVzLFxuICAgIG5hbWVQcmVmaXhcbiAgKTtcbiAgcmV0dXJuIHtcbiAgICBnZXQgc2VuZGVyKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5zZW5kZXI7XG4gICAgfSxcbiAgICBnZXQgZGF0YWJhc2VJZGVudGl0eSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuZGF0YWJhc2VJZGVudGl0eTtcbiAgICB9LFxuICAgIGdldCBpZGVudGl0eSgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuaWRlbnRpdHk7XG4gICAgfSxcbiAgICBnZXQgdGltZXN0YW1wKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC50aW1lc3RhbXA7XG4gICAgfSxcbiAgICBnZXQgY29ubmVjdGlvbklkKCkge1xuICAgICAgcmV0dXJuIHBhcmVudC5jb25uZWN0aW9uSWQ7XG4gICAgfSxcbiAgICBnZXQgaHR0cCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQuaHR0cDtcbiAgICB9LFxuICAgIGdldCByYW5kb20oKSB7XG4gICAgICByZXR1cm4gcGFyZW50LnJhbmRvbTtcbiAgICB9LFxuICAgIGFzOiBzdWJBcyxcbiAgICB3aXRoVHgoYm9keSkge1xuICAgICAgcmV0dXJuIHJ1bldpdGhUeCgodHMpID0+IHtcbiAgICAgICAgY29uc3QgdHggPSBuZXcgUmVkdWNlckN0eEltcGwoXG4gICAgICAgICAgcGFyZW50LnNlbmRlcixcbiAgICAgICAgICB0cyxcbiAgICAgICAgICBwYXJlbnQuY29ubmVjdGlvbklkLFxuICAgICAgICAgIG5zRGJfID8/PSBidWlsZERiVmlld0ZvckRpc3BhdGNoKFxuICAgICAgICAgICAgZGlzcGF0Y2gsXG4gICAgICAgICAgICBuYW1lUHJlZml4XG4gICAgICAgICAgKVxuICAgICAgICApO1xuICAgICAgICBhc3NpZ25UeEFsaWFzVmlld3ModHgsIGRpc3BhdGNoLnN1YkRpc3BhdGNoZXMsIG5hbWVQcmVmaXgpO1xuICAgICAgICByZXR1cm4gdHg7XG4gICAgICB9LCBib2R5KTtcbiAgICB9LFxuICAgIG5ld1V1aWRWNCgpIHtcbiAgICAgIHJldHVybiBwYXJlbnQubmV3VXVpZFY0KCk7XG4gICAgfSxcbiAgICBuZXdVdWlkVjcoKSB7XG4gICAgICByZXR1cm4gcGFyZW50Lm5ld1V1aWRWNygpO1xuICAgIH1cbiAgfTtcbn1cbmZ1bmN0aW9uIGJ1aWxkUHJvY2VkdXJlQWxpYXNDdHhNYXAocGFyZW50LCBkaXNwYXRjaGVzLCBwYXJlbnRQcmVmaXgpIHtcbiAgcmV0dXJuIGZyZWV6ZShcbiAgICBPYmplY3QuZnJvbUVudHJpZXMoXG4gICAgICBkaXNwYXRjaGVzLm1hcCgoZCkgPT4gW1xuICAgICAgICBkLm5hbWVzcGFjZSxcbiAgICAgICAgYnVpbGRQcm9jZWR1cmVBbGlhc0N0eChwYXJlbnQsIGQsIHBhcmVudFByZWZpeCArIGQubmFtZXNwYWNlICsgXCIuXCIpXG4gICAgICBdKVxuICAgIClcbiAgKTtcbn1cbmZ1bmN0aW9uIGFzc2lnblR4QWxpYXNWaWV3cyh0eCwgZGlzcGF0Y2hlcywgcGFyZW50UHJlZml4ID0gXCJcIikge1xuICBpZiAoZGlzcGF0Y2hlcy5sZW5ndGggPiAwKSB7XG4gICAgdHguYXMgPSBidWlsZEFsaWFzQ3R4TWFwKHR4LCBkaXNwYXRjaGVzLCBwYXJlbnRQcmVmaXgpO1xuICB9XG59XG5mdW5jdGlvbiBtYWtlVGFibGVWaWV3KHR5cGVzcGFjZSwgdGFibGUyLCBuYW1lUHJlZml4ID0gXCJcIikge1xuICBjb25zdCB0YWJsZV9pZCA9IHN5cy50YWJsZV9pZF9mcm9tX25hbWUobmFtZVByZWZpeCArIHRhYmxlMi5zb3VyY2VOYW1lKTtcbiAgY29uc3Qgcm93VHlwZSA9IHR5cGVzcGFjZS50eXBlc1t0YWJsZTIucHJvZHVjdFR5cGVSZWZdO1xuICBpZiAocm93VHlwZS50YWcgIT09IFwiUHJvZHVjdFwiKSB7XG4gICAgdGhyb3cgXCJpbXBvc3NpYmxlXCI7XG4gIH1cbiAgY29uc3Qgc2VyaWFsaXplUm93ID0gQWxnZWJyYWljVHlwZS5tYWtlU2VyaWFsaXplcihyb3dUeXBlLCB0eXBlc3BhY2UpO1xuICBjb25zdCBkZXNlcmlhbGl6ZVJvdyA9IEFsZ2VicmFpY1R5cGUubWFrZURlc2VyaWFsaXplcihyb3dUeXBlLCB0eXBlc3BhY2UpO1xuICBjb25zdCBzZXF1ZW5jZXMgPSB0YWJsZTIuc2VxdWVuY2VzLm1hcCgoc2VxKSA9PiB7XG4gICAgY29uc3QgY29sID0gcm93VHlwZS52YWx1ZS5lbGVtZW50c1tzZXEuY29sdW1uXTtcbiAgICBjb25zdCBjb2xUeXBlID0gY29sLmFsZ2VicmFpY1R5cGU7XG4gICAgbGV0IHNlcXVlbmNlVHJpZ2dlcjtcbiAgICBzd2l0Y2ggKGNvbFR5cGUudGFnKSB7XG4gICAgICBjYXNlIFwiVThcIjpcbiAgICAgIGNhc2UgXCJJOFwiOlxuICAgICAgY2FzZSBcIlUxNlwiOlxuICAgICAgY2FzZSBcIkkxNlwiOlxuICAgICAgY2FzZSBcIlUzMlwiOlxuICAgICAgY2FzZSBcIkkzMlwiOlxuICAgICAgICBzZXF1ZW5jZVRyaWdnZXIgPSAwO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJVNjRcIjpcbiAgICAgIGNhc2UgXCJJNjRcIjpcbiAgICAgIGNhc2UgXCJVMTI4XCI6XG4gICAgICBjYXNlIFwiSTEyOFwiOlxuICAgICAgY2FzZSBcIlUyNTZcIjpcbiAgICAgIGNhc2UgXCJJMjU2XCI6XG4gICAgICAgIHNlcXVlbmNlVHJpZ2dlciA9IDBuO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJpbnZhbGlkIHNlcXVlbmNlIHR5cGVcIik7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBjb2xOYW1lOiBjb2wubmFtZSxcbiAgICAgIHNlcXVlbmNlVHJpZ2dlcixcbiAgICAgIGRlc2VyaWFsaXplOiBBbGdlYnJhaWNUeXBlLm1ha2VEZXNlcmlhbGl6ZXIoY29sVHlwZSwgdHlwZXNwYWNlKVxuICAgIH07XG4gIH0pO1xuICBjb25zdCBoYXNBdXRvSW5jcmVtZW50ID0gc2VxdWVuY2VzLmxlbmd0aCA+IDA7XG4gIGNvbnN0IGl0ZXIgPSAoKSA9PiB0YWJsZUl0ZXJhdG9yKHN5cy5kYXRhc3RvcmVfdGFibGVfc2Nhbl9ic2F0bih0YWJsZV9pZCksIGRlc2VyaWFsaXplUm93KTtcbiAgY29uc3QgaW50ZWdyYXRlR2VuZXJhdGVkQ29sdW1ucyA9IGhhc0F1dG9JbmNyZW1lbnQgPyAocm93LCByZXRfYnVmKSA9PiB7XG4gICAgQklOQVJZX1JFQURFUi5yZXNldChyZXRfYnVmKTtcbiAgICBmb3IgKGNvbnN0IHsgY29sTmFtZSwgZGVzZXJpYWxpemUsIHNlcXVlbmNlVHJpZ2dlciB9IG9mIHNlcXVlbmNlcykge1xuICAgICAgaWYgKHJvd1tjb2xOYW1lXSA9PT0gc2VxdWVuY2VUcmlnZ2VyKSB7XG4gICAgICAgIHJvd1tjb2xOYW1lXSA9IGRlc2VyaWFsaXplKEJJTkFSWV9SRUFERVIpO1xuICAgICAgfVxuICAgIH1cbiAgfSA6IG51bGw7XG4gIGNvbnN0IHRhYmxlTWV0aG9kcyA9IHtcbiAgICBjb3VudDogKCkgPT4gc3lzLmRhdGFzdG9yZV90YWJsZV9yb3dfY291bnQodGFibGVfaWQpLFxuICAgIGl0ZXIsXG4gICAgW1N5bWJvbC5pdGVyYXRvcl06ICgpID0+IGl0ZXIoKSxcbiAgICBpbnNlcnQ6IChyb3cpID0+IHtcbiAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgQklOQVJZX1dSSVRFUi5yZXNldChidWYpO1xuICAgICAgc2VyaWFsaXplUm93KEJJTkFSWV9XUklURVIsIHJvdyk7XG4gICAgICBzeXMuZGF0YXN0b3JlX2luc2VydF9ic2F0bih0YWJsZV9pZCwgYnVmLmJ1ZmZlciwgQklOQVJZX1dSSVRFUi5vZmZzZXQpO1xuICAgICAgY29uc3QgcmV0ID0geyAuLi5yb3cgfTtcbiAgICAgIGludGVncmF0ZUdlbmVyYXRlZENvbHVtbnM/LihyZXQsIGJ1Zi52aWV3KTtcbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSxcbiAgICBkZWxldGU6IChyb3cpID0+IHtcbiAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgQklOQVJZX1dSSVRFUi5yZXNldChidWYpO1xuICAgICAgQklOQVJZX1dSSVRFUi53cml0ZVUzMigxKTtcbiAgICAgIHNlcmlhbGl6ZVJvdyhCSU5BUllfV1JJVEVSLCByb3cpO1xuICAgICAgY29uc3QgY291bnQgPSBzeXMuZGF0YXN0b3JlX2RlbGV0ZV9hbGxfYnlfZXFfYnNhdG4oXG4gICAgICAgIHRhYmxlX2lkLFxuICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICBCSU5BUllfV1JJVEVSLm9mZnNldFxuICAgICAgKTtcbiAgICAgIHJldHVybiBjb3VudCA+IDA7XG4gICAgfSxcbiAgICBjbGVhcjogKCkgPT4gc3lzLmRhdGFzdG9yZV9jbGVhcih0YWJsZV9pZClcbiAgfTtcbiAgY29uc3QgdGFibGVWaWV3ID0gT2JqZWN0LmFzc2lnbihcbiAgICAvKiBAX19QVVJFX18gKi8gT2JqZWN0LmNyZWF0ZShudWxsKSxcbiAgICB0YWJsZU1ldGhvZHNcbiAgKTtcbiAgZm9yIChjb25zdCBpbmRleERlZiBvZiB0YWJsZTIuaW5kZXhlcykge1xuICAgIGNvbnN0IGFjY2Vzc29yTmFtZSA9IGluZGV4RGVmLmFjY2Vzc29yTmFtZTtcbiAgICBjb25zdCBpbmRleF9pZCA9IHN5cy5pbmRleF9pZF9mcm9tX25hbWUobmFtZVByZWZpeCArIGluZGV4RGVmLnNvdXJjZU5hbWUpO1xuICAgIGxldCBjb2x1bW5faWRzO1xuICAgIGxldCBpc0hhc2hJbmRleCA9IGZhbHNlO1xuICAgIHN3aXRjaCAoaW5kZXhEZWYuYWxnb3JpdGhtLnRhZykge1xuICAgICAgY2FzZSBcIkhhc2hcIjpcbiAgICAgICAgaXNIYXNoSW5kZXggPSB0cnVlO1xuICAgICAgICBjb2x1bW5faWRzID0gaW5kZXhEZWYuYWxnb3JpdGhtLnZhbHVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJCVHJlZVwiOlxuICAgICAgICBjb2x1bW5faWRzID0gaW5kZXhEZWYuYWxnb3JpdGhtLnZhbHVlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJEaXJlY3RcIjpcbiAgICAgICAgY29sdW1uX2lkcyA9IFtpbmRleERlZi5hbGdvcml0aG0udmFsdWVdO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgY29uc3QgbnVtQ29sdW1ucyA9IGNvbHVtbl9pZHMubGVuZ3RoO1xuICAgIGNvbnN0IGNvbHVtblNldCA9IG5ldyBTZXQoY29sdW1uX2lkcyk7XG4gICAgY29uc3QgaXNVbmlxdWUgPSB0YWJsZTIuY29uc3RyYWludHMuZmlsdGVyKCh4KSA9PiB4LmRhdGEudGFnID09PSBcIlVuaXF1ZVwiKS5zb21lKCh4KSA9PiBjb2x1bW5TZXQuaXNTdWJzZXRPZihuZXcgU2V0KHguZGF0YS52YWx1ZS5jb2x1bW5zKSkpO1xuICAgIGNvbnN0IGlzUHJpbWFyeUtleSA9IGlzVW5pcXVlICYmIGNvbHVtbl9pZHMubGVuZ3RoID09PSB0YWJsZTIucHJpbWFyeUtleS5sZW5ndGggJiYgY29sdW1uX2lkcy5ldmVyeSgoaWQsIGkpID0+IHRhYmxlMi5wcmltYXJ5S2V5W2ldID09PSBpZCk7XG4gICAgY29uc3QgaW5kZXhTZXJpYWxpemVycyA9IGNvbHVtbl9pZHMubWFwKFxuICAgICAgKGlkKSA9PiBBbGdlYnJhaWNUeXBlLm1ha2VTZXJpYWxpemVyKFxuICAgICAgICByb3dUeXBlLnZhbHVlLmVsZW1lbnRzW2lkXS5hbGdlYnJhaWNUeXBlLFxuICAgICAgICB0eXBlc3BhY2VcbiAgICAgIClcbiAgICApO1xuICAgIGNvbnN0IHNlcmlhbGl6ZVBvaW50ID0gKGJ1ZmZlciwgY29sVmFsKSA9PiB7XG4gICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG51bUNvbHVtbnM7IGkrKykge1xuICAgICAgICBpbmRleFNlcmlhbGl6ZXJzW2ldKEJJTkFSWV9XUklURVIsIGNvbFZhbFtpXSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gQklOQVJZX1dSSVRFUi5vZmZzZXQ7XG4gICAgfTtcbiAgICBjb25zdCBzZXJpYWxpemVTaW5nbGVFbGVtZW50ID0gbnVtQ29sdW1ucyA9PT0gMSA/IGluZGV4U2VyaWFsaXplcnNbMF0gOiBudWxsO1xuICAgIGNvbnN0IHNlcmlhbGl6ZVNpbmdsZVBvaW50ID0gc2VyaWFsaXplU2luZ2xlRWxlbWVudCAmJiAoKGJ1ZmZlciwgY29sVmFsKSA9PiB7XG4gICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICBzZXJpYWxpemVTaW5nbGVFbGVtZW50KEJJTkFSWV9XUklURVIsIGNvbFZhbCk7XG4gICAgICByZXR1cm4gQklOQVJZX1dSSVRFUi5vZmZzZXQ7XG4gICAgfSk7XG4gICAgbGV0IGluZGV4O1xuICAgIGlmIChpc1VuaXF1ZSAmJiBzZXJpYWxpemVTaW5nbGVQb2ludCkge1xuICAgICAgY29uc3QgYmFzZSA9IHtcbiAgICAgICAgZmluZDogKGNvbFZhbCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVNpbmdsZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBpdGVyX2lkID0gc3lzLmRhdGFzdG9yZV9pbmRleF9zY2FuX3BvaW50X2JzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRlT25lKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93KTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplU2luZ2xlUG9pbnQoYnVmLCBjb2xWYWwpO1xuICAgICAgICAgIGNvbnN0IG51bSA9IHN5cy5kYXRhc3RvcmVfZGVsZXRlX2J5X2luZGV4X3NjYW5fcG9pbnRfYnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiBudW0gPiAwO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGlzUHJpbWFyeUtleSkge1xuICAgICAgICBiYXNlLnVwZGF0ZSA9IChyb3cpID0+IHtcbiAgICAgICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1Zik7XG4gICAgICAgICAgc2VyaWFsaXplUm93KEJJTkFSWV9XUklURVIsIHJvdyk7XG4gICAgICAgICAgc3lzLmRhdGFzdG9yZV91cGRhdGVfYnNhdG4oXG4gICAgICAgICAgICB0YWJsZV9pZCxcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIEJJTkFSWV9XUklURVIub2Zmc2V0XG4gICAgICAgICAgKTtcbiAgICAgICAgICBpbnRlZ3JhdGVHZW5lcmF0ZWRDb2x1bW5zPy4ocm93LCBidWYudmlldyk7XG4gICAgICAgICAgcmV0dXJuIHJvdztcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGluZGV4ID0gYmFzZTtcbiAgICB9IGVsc2UgaWYgKGlzVW5pcXVlKSB7XG4gICAgICBjb25zdCBiYXNlID0ge1xuICAgICAgICBmaW5kOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbFZhbC5sZW5ndGggIT09IG51bUNvbHVtbnMpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJ3cm9uZyBudW1iZXIgb2YgZWxlbWVudHNcIik7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBpdGVyX2lkID0gc3lzLmRhdGFzdG9yZV9pbmRleF9zY2FuX3BvaW50X2JzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRlT25lKGl0ZXJfaWQsIGRlc2VyaWFsaXplUm93KTtcbiAgICAgICAgfSxcbiAgICAgICAgZGVsZXRlOiAoY29sVmFsKSA9PiB7XG4gICAgICAgICAgaWYgKGNvbFZhbC5sZW5ndGggIT09IG51bUNvbHVtbnMpXG4gICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwid3JvbmcgbnVtYmVyIG9mIGVsZW1lbnRzXCIpO1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVBvaW50KGJ1ZiwgY29sVmFsKTtcbiAgICAgICAgICBjb25zdCBudW0gPSBzeXMuZGF0YXN0b3JlX2RlbGV0ZV9ieV9pbmRleF9zY2FuX3BvaW50X2JzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gbnVtID4gMDtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChpc1ByaW1hcnlLZXkpIHtcbiAgICAgICAgYmFzZS51cGRhdGUgPSAocm93KSA9PiB7XG4gICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgQklOQVJZX1dSSVRFUi5yZXNldChidWYpO1xuICAgICAgICAgIHNlcmlhbGl6ZVJvdyhCSU5BUllfV1JJVEVSLCByb3cpO1xuICAgICAgICAgIHN5cy5kYXRhc3RvcmVfdXBkYXRlX2JzYXRuKFxuICAgICAgICAgICAgdGFibGVfaWQsXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBCSU5BUllfV1JJVEVSLm9mZnNldFxuICAgICAgICAgICk7XG4gICAgICAgICAgaW50ZWdyYXRlR2VuZXJhdGVkQ29sdW1ucz8uKHJvdywgYnVmLnZpZXcpO1xuICAgICAgICAgIHJldHVybiByb3c7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpbmRleCA9IGJhc2U7XG4gICAgfSBlbHNlIGlmIChzZXJpYWxpemVTaW5nbGVQb2ludCkge1xuICAgICAgY29uc3Qgc2VyaWFsaXplU2luZ2xlUmFuZ2UgPSAhaXNIYXNoSW5kZXggPyAoYnVmZmVyLCByYW5nZSkgPT4ge1xuICAgICAgICBCSU5BUllfV1JJVEVSLnJlc2V0KGJ1ZmZlcik7XG4gICAgICAgIGNvbnN0IHdyaXRlciA9IEJJTkFSWV9XUklURVI7XG4gICAgICAgIGNvbnN0IHdyaXRlQm91bmQgPSAoYm91bmQpID0+IHtcbiAgICAgICAgICBjb25zdCB0YWdzID0geyBpbmNsdWRlZDogMCwgZXhjbHVkZWQ6IDEsIHVuYm91bmRlZDogMiB9O1xuICAgICAgICAgIHdyaXRlci53cml0ZVU4KHRhZ3NbYm91bmQudGFnXSk7XG4gICAgICAgICAgaWYgKGJvdW5kLnRhZyAhPT0gXCJ1bmJvdW5kZWRcIilcbiAgICAgICAgICAgIHNlcmlhbGl6ZVNpbmdsZUVsZW1lbnQod3JpdGVyLCBib3VuZC52YWx1ZSk7XG4gICAgICAgIH07XG4gICAgICAgIHdyaXRlQm91bmQocmFuZ2UuZnJvbSk7XG4gICAgICAgIGNvbnN0IHJzdGFydExlbiA9IHdyaXRlci5vZmZzZXQ7XG4gICAgICAgIHdyaXRlQm91bmQocmFuZ2UudG8pO1xuICAgICAgICBjb25zdCByZW5kTGVuID0gd3JpdGVyLm9mZnNldCAtIHJzdGFydExlbjtcbiAgICAgICAgcmV0dXJuIFswLCAwLCByc3RhcnRMZW4sIHJlbmRMZW5dO1xuICAgICAgfSA6IG51bGw7XG4gICAgICBjb25zdCByYXdJbmRleCA9IHtcbiAgICAgICAgZmlsdGVyOiAocmFuZ2UpID0+IHtcbiAgICAgICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgICAgICBpZiAoc2VyaWFsaXplU2luZ2xlUmFuZ2UgJiYgcmFuZ2UgaW5zdGFuY2VvZiBSYW5nZSkge1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVNpbmdsZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgY29uc3QgaXRlcl9pZDIgPSBzeXMuZGF0YXN0b3JlX2luZGV4X3NjYW5fcmFuZ2VfYnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICAuLi5hcmdzXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgcmV0dXJuIHRhYmxlSXRlcmF0b3IoaXRlcl9pZDIsIGRlc2VyaWFsaXplUm93KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplU2luZ2xlUG9pbnQoYnVmLCByYW5nZSk7XG4gICAgICAgICAgY29uc3QgaXRlcl9pZCA9IHN5cy5kYXRhc3RvcmVfaW5kZXhfc2Nhbl9wb2ludF9ic2F0bihcbiAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgYnVmLmJ1ZmZlcixcbiAgICAgICAgICAgIHBvaW50X2xlblxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIHRhYmxlSXRlcmF0b3IoaXRlcl9pZCwgZGVzZXJpYWxpemVSb3cpO1xuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgIGlmIChzZXJpYWxpemVTaW5nbGVSYW5nZSAmJiByYW5nZSBpbnN0YW5jZW9mIFJhbmdlKSB7XG4gICAgICAgICAgICBjb25zdCBhcmdzID0gc2VyaWFsaXplU2luZ2xlUmFuZ2UoYnVmLCByYW5nZSk7XG4gICAgICAgICAgICByZXR1cm4gc3lzLmRhdGFzdG9yZV9kZWxldGVfYnlfaW5kZXhfc2Nhbl9yYW5nZV9ic2F0bihcbiAgICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICAgIC4uLmFyZ3NcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGNvbnN0IHBvaW50X2xlbiA9IHNlcmlhbGl6ZVNpbmdsZVBvaW50KGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgIHJldHVybiBzeXMuZGF0YXN0b3JlX2RlbGV0ZV9ieV9pbmRleF9zY2FuX3BvaW50X2JzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGlmIChpc0hhc2hJbmRleCkge1xuICAgICAgICBpbmRleCA9IHJhd0luZGV4O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5kZXggPSByYXdJbmRleDtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzSGFzaEluZGV4KSB7XG4gICAgICBpbmRleCA9IHtcbiAgICAgICAgZmlsdGVyOiAocmFuZ2UpID0+IHtcbiAgICAgICAgICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICBjb25zdCBpdGVyX2lkID0gc3lzLmRhdGFzdG9yZV9pbmRleF9zY2FuX3BvaW50X2JzYXRuKFxuICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgcG9pbnRfbGVuXG4gICAgICAgICAgKTtcbiAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRvcihpdGVyX2lkLCBkZXNlcmlhbGl6ZVJvdyk7XG4gICAgICAgIH0sXG4gICAgICAgIGRlbGV0ZTogKHJhbmdlKSA9PiB7XG4gICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplUG9pbnQoYnVmLCByYW5nZSk7XG4gICAgICAgICAgcmV0dXJuIHN5cy5kYXRhc3RvcmVfZGVsZXRlX2J5X2luZGV4X3NjYW5fcG9pbnRfYnNhdG4oXG4gICAgICAgICAgICBpbmRleF9pZCxcbiAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBpc0NvbXBsZXRlU2NhbGFyS2V5ID0gKHJhbmdlKSA9PiB7XG4gICAgICAgIHJldHVybiByYW5nZS5sZW5ndGggPT09IG51bUNvbHVtbnMgJiYgIShyYW5nZVtyYW5nZS5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIFJhbmdlKTtcbiAgICAgIH07XG4gICAgICBjb25zdCBzZXJpYWxpemVSYW5nZSA9IChidWZmZXIsIHJhbmdlKSA9PiB7XG4gICAgICAgIGlmIChyYW5nZS5sZW5ndGggPiBudW1Db2x1bW5zKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwidG9vIG1hbnkgZWxlbWVudHNcIik7XG4gICAgICAgIEJJTkFSWV9XUklURVIucmVzZXQoYnVmZmVyKTtcbiAgICAgICAgY29uc3Qgd3JpdGVyID0gQklOQVJZX1dSSVRFUjtcbiAgICAgICAgY29uc3QgcHJlZml4X2VsZW1zID0gcmFuZ2UubGVuZ3RoIC0gMTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwcmVmaXhfZWxlbXM7IGkrKykge1xuICAgICAgICAgIGluZGV4U2VyaWFsaXplcnNbaV0od3JpdGVyLCByYW5nZVtpXSk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgcnN0YXJ0T2Zmc2V0ID0gd3JpdGVyLm9mZnNldDtcbiAgICAgICAgY29uc3QgdGVybSA9IHJhbmdlW3JhbmdlLmxlbmd0aCAtIDFdO1xuICAgICAgICBjb25zdCBzZXJpYWxpemVUZXJtID0gaW5kZXhTZXJpYWxpemVyc1tyYW5nZS5sZW5ndGggLSAxXTtcbiAgICAgICAgaWYgKHRlcm0gaW5zdGFuY2VvZiBSYW5nZSkge1xuICAgICAgICAgIGNvbnN0IHdyaXRlQm91bmQgPSAoYm91bmQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRhZ3MgPSB7IGluY2x1ZGVkOiAwLCBleGNsdWRlZDogMSwgdW5ib3VuZGVkOiAyIH07XG4gICAgICAgICAgICB3cml0ZXIud3JpdGVVOCh0YWdzW2JvdW5kLnRhZ10pO1xuICAgICAgICAgICAgaWYgKGJvdW5kLnRhZyAhPT0gXCJ1bmJvdW5kZWRcIikgc2VyaWFsaXplVGVybSh3cml0ZXIsIGJvdW5kLnZhbHVlKTtcbiAgICAgICAgICB9O1xuICAgICAgICAgIHdyaXRlQm91bmQodGVybS5mcm9tKTtcbiAgICAgICAgICBjb25zdCByc3RhcnRMZW4gPSB3cml0ZXIub2Zmc2V0IC0gcnN0YXJ0T2Zmc2V0O1xuICAgICAgICAgIHdyaXRlQm91bmQodGVybS50byk7XG4gICAgICAgICAgY29uc3QgcmVuZExlbiA9IHdyaXRlci5vZmZzZXQgLSByc3RhcnRPZmZzZXQgLSByc3RhcnRMZW47XG4gICAgICAgICAgcmV0dXJuIFtyc3RhcnRPZmZzZXQsIHByZWZpeF9lbGVtcywgcnN0YXJ0TGVuLCByZW5kTGVuXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB3cml0ZXIud3JpdGVVOCgwKTtcbiAgICAgICAgICBzZXJpYWxpemVUZXJtKHdyaXRlciwgdGVybSk7XG4gICAgICAgICAgY29uc3QgcnN0YXJ0TGVuID0gd3JpdGVyLm9mZnNldCAtIHJzdGFydE9mZnNldDtcbiAgICAgICAgICBjb25zdCByZW5kTGVuID0gMDtcbiAgICAgICAgICByZXR1cm4gW3JzdGFydE9mZnNldCwgcHJlZml4X2VsZW1zLCByc3RhcnRMZW4sIHJlbmRMZW5dO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaW5kZXggPSB7XG4gICAgICAgIGZpbHRlcjogKHJhbmdlKSA9PiB7XG4gICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHJhbmdlKSkgcmFuZ2UgPSBbcmFuZ2VdO1xuICAgICAgICAgIGlmIChpc0NvbXBsZXRlU2NhbGFyS2V5KHJhbmdlKSkge1xuICAgICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgICBjb25zdCBwb2ludF9sZW4gPSBzZXJpYWxpemVQb2ludChidWYsIHJhbmdlKTtcbiAgICAgICAgICAgIGNvbnN0IGl0ZXJfaWQgPSBzeXMuZGF0YXN0b3JlX2luZGV4X3NjYW5fcG9pbnRfYnNhdG4oXG4gICAgICAgICAgICAgIGluZGV4X2lkLFxuICAgICAgICAgICAgICBidWYuYnVmZmVyLFxuICAgICAgICAgICAgICBwb2ludF9sZW5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRvcihpdGVyX2lkLCBkZXNlcmlhbGl6ZVJvdyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgYXJncyA9IHNlcmlhbGl6ZVJhbmdlKGJ1ZiwgcmFuZ2UpO1xuICAgICAgICAgICAgY29uc3QgaXRlcl9pZCA9IHN5cy5kYXRhc3RvcmVfaW5kZXhfc2Nhbl9yYW5nZV9ic2F0bihcbiAgICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICAgIC4uLmFyZ3NcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICByZXR1cm4gdGFibGVJdGVyYXRvcihpdGVyX2lkLCBkZXNlcmlhbGl6ZVJvdyk7XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBkZWxldGU6IChyYW5nZSkgPT4ge1xuICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShyYW5nZSkpIHJhbmdlID0gW3JhbmdlXTtcbiAgICAgICAgICBpZiAoaXNDb21wbGV0ZVNjYWxhcktleShyYW5nZSkpIHtcbiAgICAgICAgICAgIGNvbnN0IGJ1ZiA9IExFQUZfQlVGO1xuICAgICAgICAgICAgY29uc3QgcG9pbnRfbGVuID0gc2VyaWFsaXplUG9pbnQoYnVmLCByYW5nZSk7XG4gICAgICAgICAgICByZXR1cm4gc3lzLmRhdGFzdG9yZV9kZWxldGVfYnlfaW5kZXhfc2Nhbl9wb2ludF9ic2F0bihcbiAgICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICAgIHBvaW50X2xlblxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgYnVmID0gTEVBRl9CVUY7XG4gICAgICAgICAgICBjb25zdCBhcmdzID0gc2VyaWFsaXplUmFuZ2UoYnVmLCByYW5nZSk7XG4gICAgICAgICAgICByZXR1cm4gc3lzLmRhdGFzdG9yZV9kZWxldGVfYnlfaW5kZXhfc2Nhbl9yYW5nZV9ic2F0bihcbiAgICAgICAgICAgICAgaW5kZXhfaWQsXG4gICAgICAgICAgICAgIGJ1Zi5idWZmZXIsXG4gICAgICAgICAgICAgIC4uLmFyZ3NcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuICAgIH1cbiAgICBpZiAoT2JqZWN0Lmhhc093bih0YWJsZVZpZXcsIGFjY2Vzc29yTmFtZSkpIHtcbiAgICAgIGZyZWV6ZShPYmplY3QuYXNzaWduKHRhYmxlVmlld1thY2Nlc3Nvck5hbWVdLCBpbmRleCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YWJsZVZpZXdbYWNjZXNzb3JOYW1lXSA9IGZyZWV6ZShpbmRleCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBmcmVlemUodGFibGVWaWV3KTtcbn1cbmZ1bmN0aW9uKiB0YWJsZUl0ZXJhdG9yKGlkLCBkZXNlcmlhbGl6ZSkge1xuICB1c2luZyBpdGVyID0gbmV3IEl0ZXJhdG9ySGFuZGxlKGlkKTtcbiAgY29uc3QgaXRlckJ1ZiA9IHRha2VCdWYoKTtcbiAgdHJ5IHtcbiAgICBsZXQgYW10O1xuICAgIHdoaWxlIChhbXQgPSBpdGVyLmFkdmFuY2UoaXRlckJ1ZikpIHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBCaW5hcnlSZWFkZXIoaXRlckJ1Zi52aWV3KTtcbiAgICAgIHdoaWxlIChyZWFkZXIub2Zmc2V0IDwgYW10KSB7XG4gICAgICAgIHlpZWxkIGRlc2VyaWFsaXplKHJlYWRlcik7XG4gICAgICB9XG4gICAgfVxuICB9IGZpbmFsbHkge1xuICAgIHJldHVybkJ1ZihpdGVyQnVmKTtcbiAgfVxufVxuZnVuY3Rpb24gdGFibGVJdGVyYXRlT25lKGlkLCBkZXNlcmlhbGl6ZSkge1xuICBjb25zdCBidWYgPSBMRUFGX0JVRjtcbiAgY29uc3QgcmV0ID0gYWR2YW5jZUl0ZXJSYXcoaWQsIGJ1Zik7XG4gIGlmIChyZXQgIT09IDApIHtcbiAgICBCSU5BUllfUkVBREVSLnJlc2V0KGJ1Zi52aWV3KTtcbiAgICByZXR1cm4gZGVzZXJpYWxpemUoQklOQVJZX1JFQURFUik7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5mdW5jdGlvbiBhZHZhbmNlSXRlclJhdyhpZCwgYnVmKSB7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiAwIHwgc3lzLnJvd19pdGVyX2JzYXRuX2FkdmFuY2UoaWQsIGJ1Zi5idWZmZXIpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlICYmIHR5cGVvZiBlID09PSBcIm9iamVjdFwiICYmIGhhc093bihlLCBcIl9fYnVmZmVyX3Rvb19zbWFsbF9fXCIpKSB7XG4gICAgICAgIGJ1Zi5ncm93KGUuX19idWZmZXJfdG9vX3NtYWxsX18pO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9XG59XG52YXIgREVGQVVMVF9CVUZGRVJfQ0FQQUNJVFkgPSAzMiAqIDEwMjQgKiAyO1xudmFyIElURVJfQlVGUyA9IFtcbiAgbmV3IFJlc2l6YWJsZUJ1ZmZlcihERUZBVUxUX0JVRkZFUl9DQVBBQ0lUWSlcbl07XG52YXIgSVRFUl9CVUZfQ09VTlQgPSAxO1xuZnVuY3Rpb24gdGFrZUJ1ZigpIHtcbiAgcmV0dXJuIElURVJfQlVGX0NPVU5UID8gSVRFUl9CVUZTWy0tSVRFUl9CVUZfQ09VTlRdIDogbmV3IFJlc2l6YWJsZUJ1ZmZlcihERUZBVUxUX0JVRkZFUl9DQVBBQ0lUWSk7XG59XG5mdW5jdGlvbiByZXR1cm5CdWYoYnVmKSB7XG4gIElURVJfQlVGU1tJVEVSX0JVRl9DT1VOVCsrXSA9IGJ1Zjtcbn1cbnZhciBMRUFGX0JVRiA9IG5ldyBSZXNpemFibGVCdWZmZXIoREVGQVVMVF9CVUZGRVJfQ0FQQUNJVFkpO1xudmFyIEl0ZXJhdG9ySGFuZGxlID0gY2xhc3MgX0l0ZXJhdG9ySGFuZGxlIHtcbiAgI2lkO1xuICBzdGF0aWMgI2ZpbmFsaXphdGlvblJlZ2lzdHJ5ID0gbmV3IEZpbmFsaXphdGlvblJlZ2lzdHJ5KFxuICAgIHN5cy5yb3dfaXRlcl9ic2F0bl9jbG9zZVxuICApO1xuICBjb25zdHJ1Y3RvcihpZCkge1xuICAgIHRoaXMuI2lkID0gaWQ7XG4gICAgX0l0ZXJhdG9ySGFuZGxlLiNmaW5hbGl6YXRpb25SZWdpc3RyeS5yZWdpc3Rlcih0aGlzLCBpZCwgdGhpcyk7XG4gIH1cbiAgLyoqIFVucmVnaXN0ZXIgdGhpcyBvYmplY3Qgd2l0aCB0aGUgZmluYWxpemF0aW9uIHJlZ2lzdHJ5IGFuZCByZXR1cm4gdGhlIGlkICovXG4gICNkZXRhY2goKSB7XG4gICAgY29uc3QgaWQgPSB0aGlzLiNpZDtcbiAgICB0aGlzLiNpZCA9IC0xO1xuICAgIF9JdGVyYXRvckhhbmRsZS4jZmluYWxpemF0aW9uUmVnaXN0cnkudW5yZWdpc3Rlcih0aGlzKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqIENhbGwgYHJvd19pdGVyX2JzYXRuX2FkdmFuY2VgLCByZXR1cm5pbmcgMCBpZiB0aGlzIGl0ZXJhdG9yIGhhcyBiZWVuIGV4aGF1c3RlZC4gKi9cbiAgYWR2YW5jZShidWYpIHtcbiAgICBpZiAodGhpcy4jaWQgPT09IC0xKSByZXR1cm4gMDtcbiAgICBjb25zdCByZXQgPSBhZHZhbmNlSXRlclJhdyh0aGlzLiNpZCwgYnVmKTtcbiAgICBpZiAocmV0IDw9IDApIHRoaXMuI2RldGFjaCgpO1xuICAgIHJldHVybiByZXQgPCAwID8gLXJldCA6IHJldDtcbiAgfVxuICBbU3ltYm9sLmRpc3Bvc2VdKCkge1xuICAgIGlmICh0aGlzLiNpZCA+PSAwKSB7XG4gICAgICBjb25zdCBpZCA9IHRoaXMuI2RldGFjaCgpO1xuICAgICAgc3lzLnJvd19pdGVyX2JzYXRuX2Nsb3NlKGlkKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIHNyYy9zZXJ2ZXIvaHR0cF9pbnRlcm5hbC50c1xudmFyIHsgZnJlZXplOiBmcmVlemUyIH0gPSBPYmplY3Q7XG52YXIgcmVxdWVzdEJhc2VTaXplID0gYnNhdG5CYXNlU2l6ZSh7IHR5cGVzOiBbXSB9LCBIdHRwUmVxdWVzdC5hbGdlYnJhaWNUeXBlKTtcbmZ1bmN0aW9uIGZldGNoKHVybCwgaW5pdCA9IHt9KSB7XG4gIGNvbnN0IG1ldGhvZCA9IHNlcmlhbGl6ZU1ldGhvZChpbml0Lm1ldGhvZCk7XG4gIGNvbnN0IGhlYWRlcnMgPSBzZXJpYWxpemVIZWFkZXJzKG5ldyBIZWFkZXJzKGluaXQuaGVhZGVycykpO1xuICBjb25zdCB1cmkgPSBcIlwiICsgdXJsO1xuICBjb25zdCByZXF1ZXN0ID0gZnJlZXplMih7XG4gICAgbWV0aG9kLFxuICAgIGhlYWRlcnMsXG4gICAgdGltZW91dDogaW5pdC50aW1lb3V0LFxuICAgIHVyaSxcbiAgICB2ZXJzaW9uOiB7IHRhZzogXCJIdHRwMTFcIiB9XG4gIH0pO1xuICBjb25zdCByZXF1ZXN0QnVmID0gbmV3IEJpbmFyeVdyaXRlcihyZXF1ZXN0QmFzZVNpemUpO1xuICBIdHRwUmVxdWVzdC5zZXJpYWxpemUocmVxdWVzdEJ1ZiwgcmVxdWVzdCk7XG4gIGNvbnN0IGJvZHkgPSBpbml0LmJvZHkgPT0gbnVsbCA/IG5ldyBVaW50OEFycmF5KCkgOiB0eXBlb2YgaW5pdC5ib2R5ID09PSBcInN0cmluZ1wiID8gaW5pdC5ib2R5IDogbmV3IFVpbnQ4QXJyYXkoaW5pdC5ib2R5KTtcbiAgY29uc3QgW3Jlc3BvbnNlQnVmLCByZXNwb25zZUJvZHldID0gc3lzLnByb2NlZHVyZV9odHRwX3JlcXVlc3QoXG4gICAgcmVxdWVzdEJ1Zi5nZXRCdWZmZXIoKSxcbiAgICBib2R5XG4gICk7XG4gIGNvbnN0IHJlc3BvbnNlID0gSHR0cFJlc3BvbnNlLmRlc2VyaWFsaXplKG5ldyBCaW5hcnlSZWFkZXIocmVzcG9uc2VCdWYpKTtcbiAgcmV0dXJuIFN5bmNSZXNwb25zZVttYWtlUmVzcG9uc2VdKHJlc3BvbnNlQm9keSwge1xuICAgIHR5cGU6IFwiYmFzaWNcIixcbiAgICB1cmw6IHVyaSxcbiAgICBzdGF0dXM6IHJlc3BvbnNlLmNvZGUsXG4gICAgc3RhdHVzVGV4dDogKDAsIGltcG9ydF9zdGF0dXNlcy5kZWZhdWx0KShyZXNwb25zZS5jb2RlKSxcbiAgICBoZWFkZXJzOiBkZXNlcmlhbGl6ZUhlYWRlcnMocmVzcG9uc2UuaGVhZGVycyksXG4gICAgYWJvcnRlZDogZmFsc2UsXG4gICAgdmVyc2lvbjogcmVzcG9uc2UudmVyc2lvblxuICB9KTtcbn1cbmZyZWV6ZTIoZmV0Y2gpO1xudmFyIGh0dHBDbGllbnQgPSBmcmVlemUyKHsgZmV0Y2ggfSk7XG5cbi8vIHNyYy9zZXJ2ZXIvcHJvY2VkdXJlcy50c1xuZnVuY3Rpb24gbWFrZVByb2NlZHVyZUV4cG9ydChjdHgsIG9wdHMsIHBhcmFtcywgcmV0LCBmbikge1xuICBjb25zdCBuYW1lID0gb3B0cz8ubmFtZTtcbiAgY29uc3QgcHJvY2VkdXJlRXhwb3J0ID0gKC4uLmFyZ3MpID0+IGZuKC4uLmFyZ3MpO1xuICBwcm9jZWR1cmVFeHBvcnRbZXhwb3J0Q29udGV4dF0gPSBjdHg7XG4gIHByb2NlZHVyZUV4cG9ydFtyZWdpc3RlckV4cG9ydF0gPSAoY3R4MiwgZXhwb3J0TmFtZSkgPT4ge1xuICAgIHJlZ2lzdGVyUHJvY2VkdXJlKGN0eDIsIG5hbWUgPz8gZXhwb3J0TmFtZSwgcGFyYW1zLCByZXQsIGZuKTtcbiAgICBjdHgyLmZ1bmN0aW9uRXhwb3J0cy5zZXQoXG4gICAgICBwcm9jZWR1cmVFeHBvcnQsXG4gICAgICBuYW1lID8/IGV4cG9ydE5hbWVcbiAgICApO1xuICAgIGlmIChvcHRzPy5vblNjaGVkdWxlICE9PSB2b2lkIDApIHtcbiAgICAgIGN0eDIucGVuZGluZ1NjaGVkdWxlcy5wdXNoKHtcbiAgICAgICAgdGFibGU6IG9wdHMub25TY2hlZHVsZSxcbiAgICAgICAgZnVuY3Rpb25OYW1lOiBuYW1lID8/IGV4cG9ydE5hbWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIHByb2NlZHVyZUV4cG9ydDtcbn1cbnZhciBUcmFuc2FjdGlvbkN0eEltcGwgPSBjbGFzcyBUcmFuc2FjdGlvbkN0eCBleHRlbmRzIFJlZHVjZXJDdHhJbXBsIHtcbn07XG5mdW5jdGlvbiByZWdpc3RlclByb2NlZHVyZShjdHgsIGV4cG9ydE5hbWUsIHBhcmFtcywgcmV0LCBmbiwgb3B0cykge1xuICBjdHguZGVmaW5lRnVuY3Rpb24oZXhwb3J0TmFtZSk7XG4gIGNvbnN0IHBhcmFtc1R5cGUgPSB7XG4gICAgZWxlbWVudHM6IE9iamVjdC5lbnRyaWVzKHBhcmFtcykubWFwKChbbiwgY10pID0+ICh7XG4gICAgICBuYW1lOiBuLFxuICAgICAgYWxnZWJyYWljVHlwZTogY3R4LnJlZ2lzdGVyVHlwZXNSZWN1cnNpdmVseShcbiAgICAgICAgXCJ0eXBlQnVpbGRlclwiIGluIGMgPyBjLnR5cGVCdWlsZGVyIDogY1xuICAgICAgKS5hbGdlYnJhaWNUeXBlXG4gICAgfSkpXG4gIH07XG4gIGNvbnN0IHJldHVyblR5cGUgPSBjdHgucmVnaXN0ZXJUeXBlc1JlY3Vyc2l2ZWx5KHJldCkuYWxnZWJyYWljVHlwZTtcbiAgY3R4Lm1vZHVsZURlZi5wcm9jZWR1cmVzLnB1c2goe1xuICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgcGFyYW1zOiBwYXJhbXNUeXBlLFxuICAgIHJldHVyblR5cGUsXG4gICAgdmlzaWJpbGl0eTogRnVuY3Rpb25WaXNpYmlsaXR5LkNsaWVudENhbGxhYmxlXG4gIH0pO1xuICBjb25zdCB7IHR5cGVzcGFjZSB9ID0gY3R4O1xuICBjdHgucHJvY2VkdXJlcy5wdXNoKHtcbiAgICBmbixcbiAgICBkZXNlcmlhbGl6ZUFyZ3M6IFByb2R1Y3RUeXBlLm1ha2VEZXNlcmlhbGl6ZXIocGFyYW1zVHlwZSwgdHlwZXNwYWNlKSxcbiAgICBzZXJpYWxpemVSZXR1cm46IEFsZ2VicmFpY1R5cGUubWFrZVNlcmlhbGl6ZXIocmV0dXJuVHlwZSwgdHlwZXNwYWNlKSxcbiAgICByZXR1cm5UeXBlQmFzZVNpemU6IGJzYXRuQmFzZVNpemUodHlwZXNwYWNlLCByZXR1cm5UeXBlKVxuICB9KTtcbn1cbmZ1bmN0aW9uIGNhbGxQcm9jZWR1cmUocHJvY2VkdXJlcywgaWQsIHNlbmRlciwgY29ubmVjdGlvbklkLCB0aW1lc3RhbXAsIGFyZ3NCdWYsIGRiVmlldywgZGlzcGF0Y2hlcyA9IFtdLCBwYXJlbnRQcmVmaXggPSBcIlwiKSB7XG4gIGNvbnN0IHsgZm4sIGRlc2VyaWFsaXplQXJncywgc2VyaWFsaXplUmV0dXJuLCByZXR1cm5UeXBlQmFzZVNpemUgfSA9IHByb2NlZHVyZXNbaWRdO1xuICBjb25zdCBhcmdzID0gZGVzZXJpYWxpemVBcmdzKG5ldyBCaW5hcnlSZWFkZXIoYXJnc0J1ZikpO1xuICBjb25zdCBjdHggPSBuZXcgUHJvY2VkdXJlQ3R4SW1wbChcbiAgICBzZW5kZXIsXG4gICAgdGltZXN0YW1wLFxuICAgIGNvbm5lY3Rpb25JZCxcbiAgICBkYlZpZXcsXG4gICAgZGlzcGF0Y2hlcyxcbiAgICBwYXJlbnRQcmVmaXhcbiAgKTtcbiAgY29uc3QgcmV0ID0gY2FsbFVzZXJGdW5jdGlvbihmbiwgY3R4LCBhcmdzKTtcbiAgY29uc3QgcmV0QnVmID0gbmV3IEJpbmFyeVdyaXRlcihyZXR1cm5UeXBlQmFzZVNpemUpO1xuICBzZXJpYWxpemVSZXR1cm4ocmV0QnVmLCByZXQpO1xuICByZXR1cm4gcmV0QnVmLmdldEJ1ZmZlcigpO1xufVxudmFyIFByb2NlZHVyZUN0eEltcGwgPSBjbGFzcyBQcm9jZWR1cmVDdHgge1xuICBjb25zdHJ1Y3RvcihzZW5kZXIsIHRpbWVzdGFtcCwgY29ubmVjdGlvbklkLCBkYlZpZXcsIGRpc3BhdGNoZXMgPSBbXSwgcGFyZW50UHJlZml4ID0gXCJcIikge1xuICAgIHRoaXMuc2VuZGVyID0gc2VuZGVyO1xuICAgIHRoaXMudGltZXN0YW1wID0gdGltZXN0YW1wO1xuICAgIHRoaXMuY29ubmVjdGlvbklkID0gY29ubmVjdGlvbklkO1xuICAgIHRoaXMuI2RiVmlldyA9IGRiVmlldztcbiAgICB0aGlzLiNkaXNwYXRjaGVzID0gZGlzcGF0Y2hlcztcbiAgICB0aGlzLiNwYXJlbnRQcmVmaXggPSBwYXJlbnRQcmVmaXg7XG4gIH1cbiAgI2lkZW50aXR5O1xuICAjdXVpZENvdW50ZXI7XG4gICNyYW5kb207XG4gICNkYlZpZXc7XG4gICNkaXNwYXRjaGVzO1xuICAjcGFyZW50UHJlZml4O1xuICAjYXNWaWV3cztcbiAgZ2V0IGRhdGFiYXNlSWRlbnRpdHkoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2lkZW50aXR5ID8/PSBuZXcgSWRlbnRpdHkoc3lzLmlkZW50aXR5KCkpO1xuICB9XG4gIGdldCBpZGVudGl0eSgpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhYmFzZUlkZW50aXR5O1xuICB9XG4gIGdldCByYW5kb20oKSB7XG4gICAgcmV0dXJuIHRoaXMuI3JhbmRvbSA/Pz0gbWFrZVJhbmRvbSh0aGlzLnRpbWVzdGFtcCk7XG4gIH1cbiAgZ2V0IGh0dHAoKSB7XG4gICAgcmV0dXJuIGh0dHBDbGllbnQ7XG4gIH1cbiAgZ2V0IGFzKCkge1xuICAgIHJldHVybiB0aGlzLiNhc1ZpZXdzID8/PSBidWlsZFByb2NlZHVyZUFsaWFzQ3R4TWFwKFxuICAgICAgdGhpcyxcbiAgICAgIHRoaXMuI2Rpc3BhdGNoZXMsXG4gICAgICB0aGlzLiNwYXJlbnRQcmVmaXhcbiAgICApO1xuICB9XG4gIHdpdGhUeChib2R5KSB7XG4gICAgY29uc3QgZGlzcGF0Y2hlcyA9IHRoaXMuI2Rpc3BhdGNoZXM7XG4gICAgY29uc3QgcGFyZW50UHJlZml4ID0gdGhpcy4jcGFyZW50UHJlZml4O1xuICAgIHJldHVybiBydW5XaXRoVHgoKHRpbWVzdGFtcCkgPT4ge1xuICAgICAgY29uc3QgdHggPSBuZXcgVHJhbnNhY3Rpb25DdHhJbXBsKFxuICAgICAgICB0aGlzLnNlbmRlcixcbiAgICAgICAgdGltZXN0YW1wLFxuICAgICAgICB0aGlzLmNvbm5lY3Rpb25JZCxcbiAgICAgICAgdGhpcy4jZGJWaWV3KClcbiAgICAgICk7XG4gICAgICBhc3NpZ25UeEFsaWFzVmlld3ModHgsIGRpc3BhdGNoZXMsIHBhcmVudFByZWZpeCk7XG4gICAgICByZXR1cm4gdHg7XG4gICAgfSwgYm9keSk7XG4gIH1cbiAgbmV3VXVpZFY0KCkge1xuICAgIGNvbnN0IGJ5dGVzID0gdGhpcy5yYW5kb20uZmlsbChuZXcgVWludDhBcnJheSgxNikpO1xuICAgIHJldHVybiBVdWlkLmZyb21SYW5kb21CeXRlc1Y0KGJ5dGVzKTtcbiAgfVxuICBuZXdVdWlkVjcoKSB7XG4gICAgY29uc3QgYnl0ZXMgPSB0aGlzLnJhbmRvbS5maWxsKG5ldyBVaW50OEFycmF5KDQpKTtcbiAgICBjb25zdCBjb3VudGVyID0gdGhpcy4jdXVpZENvdW50ZXIgPz89IHsgdmFsdWU6IDAgfTtcbiAgICByZXR1cm4gVXVpZC5mcm9tQ291bnRlclY3KGNvdW50ZXIsIHRoaXMudGltZXN0YW1wLCBieXRlcyk7XG4gIH1cbn07XG5cbi8vIHNyYy9zZXJ2ZXIvcmVkdWNlcnMudHNcbmZ1bmN0aW9uIG1ha2VSZWR1Y2VyRXhwb3J0KGN0eCwgb3B0cywgcGFyYW1zLCBmbiwgbGlmZWN5Y2xlKSB7XG4gIGNvbnN0IHJlZHVjZXJFeHBvcnQgPSAoLi4uYXJncykgPT4gZm4oLi4uYXJncyk7XG4gIHJlZHVjZXJFeHBvcnRbZXhwb3J0Q29udGV4dF0gPSBjdHg7XG4gIHJlZHVjZXJFeHBvcnRbcmVnaXN0ZXJFeHBvcnRdID0gKGN0eDIsIGV4cG9ydE5hbWUpID0+IHtcbiAgICByZWdpc3RlclJlZHVjZXIoY3R4MiwgZXhwb3J0TmFtZSwgcGFyYW1zLCBmbiwgb3B0cywgbGlmZWN5Y2xlKTtcbiAgICBjdHgyLmZ1bmN0aW9uRXhwb3J0cy5zZXQoXG4gICAgICByZWR1Y2VyRXhwb3J0LFxuICAgICAgZXhwb3J0TmFtZVxuICAgICk7XG4gICAgaWYgKG9wdHM/Lm9uU2NoZWR1bGUgIT09IHZvaWQgMCkge1xuICAgICAgY3R4Mi5wZW5kaW5nU2NoZWR1bGVzLnB1c2goe1xuICAgICAgICB0YWJsZTogb3B0cy5vblNjaGVkdWxlLFxuICAgICAgICBmdW5jdGlvbk5hbWU6IGV4cG9ydE5hbWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbiAgcmV0dXJuIHJlZHVjZXJFeHBvcnQ7XG59XG5mdW5jdGlvbiByZWdpc3RlclJlZHVjZXIoY3R4LCBleHBvcnROYW1lLCBwYXJhbXMsIGZuLCBvcHRzLCBsaWZlY3ljbGUpIHtcbiAgY3R4LmRlZmluZUZ1bmN0aW9uKGV4cG9ydE5hbWUpO1xuICBpZiAoIShwYXJhbXMgaW5zdGFuY2VvZiBSb3dCdWlsZGVyKSkge1xuICAgIHBhcmFtcyA9IG5ldyBSb3dCdWlsZGVyKHBhcmFtcyk7XG4gIH1cbiAgaWYgKHBhcmFtcy50eXBlTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgcGFyYW1zLnR5cGVOYW1lID0gdG9QYXNjYWxDYXNlKGV4cG9ydE5hbWUpO1xuICB9XG4gIGNvbnN0IHJlZiA9IGN0eC5yZWdpc3RlclR5cGVzUmVjdXJzaXZlbHkocGFyYW1zKTtcbiAgY29uc3QgcGFyYW1zVHlwZSA9IGN0eC5yZXNvbHZlVHlwZShyZWYpLnZhbHVlO1xuICBjb25zdCBpc0xpZmVjeWNsZSA9IGxpZmVjeWNsZSAhPSBudWxsO1xuICBjdHgubW9kdWxlRGVmLnJlZHVjZXJzLnB1c2goe1xuICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgcGFyYW1zOiBwYXJhbXNUeXBlLFxuICAgIC8vTW9kdWxlRGVmIHZhbGlkYXRpb24gY29kZSBpcyByZXNwb25zaWJsZSB0byBtYXJrIHByaXZhdGUgcmVkdWNlcnNcbiAgICB2aXNpYmlsaXR5OiBGdW5jdGlvblZpc2liaWxpdHkuQ2xpZW50Q2FsbGFibGUsXG4gICAgLy9IYXJkY29kZWQgZm9yIG5vdyAtIHJlZHVjZXJzIGRvIG5vdCByZXR1cm4gdmFsdWVzIHlldFxuICAgIG9rUmV0dXJuVHlwZTogQWxnZWJyYWljVHlwZS5Qcm9kdWN0KHsgZWxlbWVudHM6IFtdIH0pLFxuICAgIGVyclJldHVyblR5cGU6IEFsZ2VicmFpY1R5cGUuU3RyaW5nXG4gIH0pO1xuICBpZiAob3B0cz8ubmFtZSAhPSBudWxsKSB7XG4gICAgY3R4Lm1vZHVsZURlZi5leHBsaWNpdE5hbWVzLmVudHJpZXMucHVzaCh7XG4gICAgICB0YWc6IFwiRnVuY3Rpb25cIixcbiAgICAgIHZhbHVlOiB7XG4gICAgICAgIHNvdXJjZU5hbWU6IGV4cG9ydE5hbWUsXG4gICAgICAgIGNhbm9uaWNhbE5hbWU6IG9wdHMubmFtZVxuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIGlmIChpc0xpZmVjeWNsZSkge1xuICAgIGN0eC5tb2R1bGVEZWYubGlmZUN5Y2xlUmVkdWNlcnMucHVzaCh7XG4gICAgICBsaWZlY3ljbGVTcGVjOiBsaWZlY3ljbGUsXG4gICAgICBmdW5jdGlvbk5hbWU6IGV4cG9ydE5hbWVcbiAgICB9KTtcbiAgfVxuICBpZiAoIWZuLm5hbWUpIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoZm4sIFwibmFtZVwiLCB7IHZhbHVlOiBleHBvcnROYW1lLCB3cml0YWJsZTogZmFsc2UgfSk7XG4gIH1cbiAgY3R4LnJlZHVjZXJzLnB1c2goZm4pO1xufVxuXG4vLyBzcmMvc2VydmVyL3NjaGVtYS50c1xudmFyIFNjaGVtYUlubmVyID0gY2xhc3MgZXh0ZW5kcyBNb2R1bGVDb250ZXh0IHtcbiAgc2NoZW1hVHlwZTtcbiAgZXhwb3J0c1JlZ2lzdGVyZWQgPSBmYWxzZTtcbiAgc2NoZWR1bGVzUmVzb2x2ZWQgPSBmYWxzZTtcbiAgZXhpc3RpbmdGdW5jdGlvbnMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBleGlzdGluZ0h0dHBIYW5kbGVycyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIHJlZHVjZXJzID0gW107XG4gIHByb2NlZHVyZXMgPSBbXTtcbiAgdmlld3MgPSBbXTtcbiAgYW5vblZpZXdzID0gW107XG4gIGh0dHBIYW5kbGVycyA9IFtdO1xuICAvKipcbiAgICogTWFwcyByZWR1Y2VyL3Byb2NlZHVyZSBleHBvcnQgb2JqZWN0cyB0byB0aGVpciBzb3VyY2UgbmFtZXMuXG4gICAqIFVzZWQgZm9yIHJlc29sdmluZyBzY2hlZHVsZWQgdGFibGUgdGFyZ2V0cy5cbiAgICovXG4gIGZ1bmN0aW9uRXhwb3J0cyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgTWFwKCk7XG4gIHRhYmxlU291cmNlTmFtZXMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBodHRwSGFuZGxlckV4cG9ydHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xuICBwZW5kaW5nU2NoZWR1bGVzID0gW107XG4gIHBlbmRpbmdIdHRwUm91dGVzID0gW107XG4gIHN1Ym1vZHVsZURpc3BhdGNoSW5mb3MgPSBbXTtcbiAgY29uc3RydWN0b3IoZ2V0U2NoZW1hVHlwZSkge1xuICAgIHN1cGVyKCk7XG4gICAgdGhpcy5zY2hlbWFUeXBlID0gZ2V0U2NoZW1hVHlwZSh0aGlzKTtcbiAgfVxuICBkZWZpbmVGdW5jdGlvbihuYW1lKSB7XG4gICAgaWYgKHRoaXMuZXhpc3RpbmdGdW5jdGlvbnMuaGFzKG5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICBgVGhlcmUgaXMgYWxyZWFkeSBhIHJlZHVjZXIsIHByb2NlZHVyZSwgb3IgdmlldyB3aXRoIHRoZSBuYW1lICcke25hbWV9J2BcbiAgICAgICk7XG4gICAgfVxuICAgIHRoaXMuZXhpc3RpbmdGdW5jdGlvbnMuYWRkKG5hbWUpO1xuICB9XG4gIGRlZmluZUh0dHBIYW5kbGVyKG5hbWUpIHtcbiAgICBpZiAodGhpcy5leGlzdGluZ0h0dHBIYW5kbGVycy5oYXMobmFtZSkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAgIGBUaGVyZSBpcyBhbHJlYWR5IGFuIEhUVFAgaGFuZGxlciB3aXRoIHRoZSBuYW1lICcke25hbWV9J2BcbiAgICAgICk7XG4gICAgfVxuICAgIHRoaXMuZXhpc3RpbmdIdHRwSGFuZGxlcnMuYWRkKG5hbWUpO1xuICB9XG4gIHJlc29sdmVTY2hlZHVsZXMoKSB7XG4gICAgaWYgKHRoaXMuc2NoZWR1bGVzUmVzb2x2ZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGhpcy5zY2hlZHVsZXNSZXNvbHZlZCA9IHRydWU7XG4gICAgY29uc3Qgc2NoZWR1bGVkVGFibGVzID0gLyogQF9fUFVSRV9fICovIG5ldyBNYXAoKTtcbiAgICBmb3IgKGNvbnN0IHtcbiAgICAgIGZ1bmN0aW9uTmFtZToga25vd25GdW5jdGlvbk5hbWUsXG4gICAgICByZWR1Y2VyLFxuICAgICAgdGFibGU6IHRhYmxlMixcbiAgICAgIHRhYmxlTmFtZToga25vd25UYWJsZU5hbWUsXG4gICAgICBzY2hlZHVsZUF0Q29sOiBrbm93blNjaGVkdWxlQXRDb2xcbiAgICB9IG9mIHRoaXMucGVuZGluZ1NjaGVkdWxlcykge1xuICAgICAgbGV0IHRhYmxlTmFtZSA9IGtub3duVGFibGVOYW1lO1xuICAgICAgaWYgKHRhYmxlTmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgIGNvbnN0IHRhYmxlTmFtZXMgPSB0aGlzLnRhYmxlU291cmNlTmFtZXMuZ2V0KHRhYmxlMik7XG4gICAgICAgIGlmICh0YWJsZU5hbWVzICE9PSB2b2lkIDAgJiYgdGFibGVOYW1lcy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICAgIFwiU2NoZWR1bGUgdGFyZ2V0IHRhYmxlIGlzIHJlZ2lzdGVyZWQgbW9yZSB0aGFuIG9uY2UgaW4gdGhpcyBzY2hlbWEuIFVzZSBhIGRpc3RpbmN0IHRhYmxlIGhhbmRsZSBmb3IgZWFjaCBzY2hlZHVsZWQgdGFibGUuXCJcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIHRhYmxlTmFtZSA9IHRhYmxlTmFtZXM/LlswXTtcbiAgICAgIH1cbiAgICAgIGlmICh0YWJsZU5hbWUgPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIFwiU2NoZWR1bGUgdGFyZ2V0IHRhYmxlIGlzIG5vdCBwYXJ0IG9mIHRoaXMgc2NoZW1hLlwiXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb25zdCBzY2hlZHVsZUF0Q29sID0ga25vd25TY2hlZHVsZUF0Q29sID8/IHRhYmxlMi5zY2hlZHVsZUF0Q29sO1xuICAgICAgaWYgKHNjaGVkdWxlQXRDb2wgPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBUYWJsZSAke3RhYmxlTmFtZX0gZGVmaW5lcyBhIHNjaGVkdWxlLCBidXQgaXQgZG9lcyBub3QgaGF2ZSBhIFNjaGVkdWxlQXQgY29sdW1uLmBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGZ1bmN0aW9uTmFtZSA9IGtub3duRnVuY3Rpb25OYW1lID8/IChyZWR1Y2VyID09PSB2b2lkIDAgPyB2b2lkIDAgOiB0aGlzLmZ1bmN0aW9uRXhwb3J0cy5nZXQocmVkdWNlcigpKSk7XG4gICAgICBpZiAoZnVuY3Rpb25OYW1lID09PSB2b2lkIDApIHtcbiAgICAgICAgY29uc3QgbXNnID0gYFRhYmxlICR7dGFibGVOYW1lfSBkZWZpbmVzIGEgc2NoZWR1bGUsIGJ1dCBpdCBzZWVtcyBsaWtlIHRoZSBhc3NvY2lhdGVkIGZ1bmN0aW9uIHdhcyBub3QgZXhwb3J0ZWQuYDtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgY29uc3QgZXhpc3RpbmdGdW5jdGlvbk5hbWUgPSBzY2hlZHVsZWRUYWJsZXMuZ2V0KHRhYmxlTmFtZSk7XG4gICAgICBpZiAoZXhpc3RpbmdGdW5jdGlvbk5hbWUgIT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBUYWJsZSAke3RhYmxlTmFtZX0gZGVmaW5lcyBtdWx0aXBsZSBzY2hlZHVsZXM6ICR7ZXhpc3RpbmdGdW5jdGlvbk5hbWV9IGFuZCAke2Z1bmN0aW9uTmFtZX0uIEEgc2NoZWR1bGUgdGFibGUgY2FuIG9ubHkgYmUgdXNlZCBieSBvbmUgcmVkdWNlciBvciBwcm9jZWR1cmUuYFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgc2NoZWR1bGVkVGFibGVzLnNldCh0YWJsZU5hbWUsIGZ1bmN0aW9uTmFtZSk7XG4gICAgICB0aGlzLm1vZHVsZURlZi5zY2hlZHVsZXMucHVzaCh7XG4gICAgICAgIHNvdXJjZU5hbWU6IHZvaWQgMCxcbiAgICAgICAgdGFibGVOYW1lLFxuICAgICAgICBzY2hlZHVsZUF0Q29sLFxuICAgICAgICBmdW5jdGlvbk5hbWVcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICByZXNvbHZlSHR0cFJvdXRlcygpIHtcbiAgICBmb3IgKGNvbnN0IHJvdXRlIG9mIHRoaXMucGVuZGluZ0h0dHBSb3V0ZXMpIHtcbiAgICAgIGNvbnN0IGhhbmRsZXJGdW5jdGlvbiA9IHRoaXMuaHR0cEhhbmRsZXJFeHBvcnRzLmdldChyb3V0ZS5oYW5kbGVyKTtcbiAgICAgIGlmIChoYW5kbGVyRnVuY3Rpb24gPT09IHZvaWQgMCkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBIVFRQIHJvdXRlIGZvciBwYXRoICcke3JvdXRlLnBhdGh9JyByZWZlcnMgdG8gYSBoYW5kbGVyIHRoYXQgd2FzIG5vdCBleHBvcnRlZC5gXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICB0aGlzLm1vZHVsZURlZi5odHRwUm91dGVzLnB1c2goe1xuICAgICAgICBoYW5kbGVyRnVuY3Rpb24sXG4gICAgICAgIG1ldGhvZDogcm91dGUubWV0aG9kLFxuICAgICAgICBwYXRoOiByb3V0ZS5wYXRoXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn07XG52YXIgU2NoZW1hID0gY2xhc3Mge1xuICAjY3R4O1xuICBjb25zdHJ1Y3RvcihjdHgpIHtcbiAgICB0aGlzLiNjdHggPSBjdHg7XG4gIH1cbiAgW21vZHVsZUhvb2tzXShleHBvcnRzKSB7XG4gICAgdGhpcy5idWlsZFJhd01vZHVsZURlZlYxMChleHBvcnRzKTtcbiAgICB0aGlzLiNjdHgucmVzb2x2ZUh0dHBSb3V0ZXMoKTtcbiAgICByZXR1cm4gbWFrZUhvb2tzKHRoaXMuI2N0eCk7XG4gIH1cbiAgZ2V0IHNjaGVtYVR5cGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N0eC5zY2hlbWFUeXBlO1xuICB9XG4gIGdldCBtb2R1bGVEZWYoKSB7XG4gICAgcmV0dXJuIHRoaXMuI2N0eC5tb2R1bGVEZWY7XG4gIH1cbiAgZ2V0IHR5cGVzcGFjZSgpIHtcbiAgICByZXR1cm4gdGhpcy4jY3R4LnR5cGVzcGFjZTtcbiAgfVxuICBnZXQgc3VibW9kdWxlRGlzcGF0Y2hJbmZvcygpIHtcbiAgICByZXR1cm4gdGhpcy4jY3R4LnN1Ym1vZHVsZURpc3BhdGNoSW5mb3M7XG4gIH1cbiAgLyoqIEludGVybmFsOiByZWdpc3RlciBleHBvcnRzIGFuZCBtYXRlcmlhbGl6ZSB0aGUgUmF3TW9kdWxlRGVmVjEwIGZvciB1cGxvYWQuICovXG4gIGJ1aWxkUmF3TW9kdWxlRGVmVjEwKGV4cG9ydHMsIG9wdHMpIHtcbiAgICByZWdpc3Rlck1vZHVsZUV4cG9ydHModGhpcy4jY3R4LCBleHBvcnRzLCB7XG4gICAgICBpZ25vcmVOb25Nb2R1bGVFeHBvcnRzOiBvcHRzPy5pZ25vcmVOb25Nb2R1bGVFeHBvcnRzID8/IGZhbHNlXG4gICAgfSk7XG4gICAgdGhpcy4jY3R4LnJlc29sdmVTY2hlZHVsZXMoKTtcbiAgICByZXR1cm4gdGhpcy4jY3R4LnJhd01vZHVsZURlZlYxMCgpO1xuICB9XG4gIC8qKlxuICAgKiBAaW50ZXJuYWwg4oCTIGNhbGxlZCBieSBzY2hlbWEoKSB3aGVuIHByb2Nlc3NpbmcgYSBzdWJtb2R1bGUgbmFtZXNwYWNlIGVudHJ5LlxuICAgKiBSZWdpc3RlcnMgdGhlIGxpYnJhcnkncyBleHBvcnRzIGFuZCByZXR1cm5zIGJvdGggdGhlIHNlcmlhbGl6ZWQgbW9kdWxlIGRlZlxuICAgKiBhbmQgdGhlIHJ1bnRpbWUgZGlzcGF0Y2ggaW5mbyBuZWVkZWQgYnkgTW9kdWxlSG9va3NJbXBsIGZvciBfX2NhbGxfcmVkdWNlcl9fLlxuICAgKi9cbiAgYnVpbGRTdWJtb2R1bGVEaXNwYXRjaChleHBvcnRzKSB7XG4gICAgY29uc3QgcmF3RGVmID0gdGhpcy5idWlsZFJhd01vZHVsZURlZlYxMChleHBvcnRzLCB7XG4gICAgICBpZ25vcmVOb25Nb2R1bGVFeHBvcnRzOiB0cnVlXG4gICAgfSk7XG4gICAgdGhpcy4jY3R4LnJlc29sdmVIdHRwUm91dGVzKCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHJhd0RlZixcbiAgICAgIGRpc3BhdGNoOiB7XG4gICAgICAgIG5hbWVzcGFjZTogXCJcIixcbiAgICAgICAgcmVkdWNlckZuczogWy4uLnRoaXMuI2N0eC5yZWR1Y2Vyc10sXG4gICAgICAgIHJlZHVjZXJEZWZzOiBbLi4udGhpcy4jY3R4Lm1vZHVsZURlZi5yZWR1Y2Vyc10sXG4gICAgICAgIHByb2NlZHVyZUZuczogWy4uLnRoaXMuI2N0eC5wcm9jZWR1cmVzXSxcbiAgICAgICAgcHJvY2VkdXJlRGVmczogWy4uLnRoaXMuI2N0eC5tb2R1bGVEZWYucHJvY2VkdXJlc10sXG4gICAgICAgIGFub25WaWV3Rm5zOiBbLi4udGhpcy4jY3R4LmFub25WaWV3c10sXG4gICAgICAgIHZpZXdGbnM6IFsuLi50aGlzLiNjdHgudmlld3NdLFxuICAgICAgICB0eXBlc3BhY2U6IHRoaXMuI2N0eC5tb2R1bGVEZWYudHlwZXNwYWNlLFxuICAgICAgICB0YWJsZXM6IE9iamVjdC52YWx1ZXModGhpcy4jY3R4LnNjaGVtYVR5cGUudGFibGVzKS5tYXAoKHQyKSA9PiAoe1xuICAgICAgICAgIGFjY2Vzc29yTmFtZTogdDIuYWNjZXNzb3JOYW1lLFxuICAgICAgICAgIHRhYmxlRGVmOiB0Mi50YWJsZURlZlxuICAgICAgICB9KSksXG4gICAgICAgIHNjaGVtYVRhYmxlczogdGhpcy4jY3R4LnNjaGVtYVR5cGUudGFibGVzLFxuICAgICAgICBzdWJEaXNwYXRjaGVzOiBbLi4udGhpcy4jY3R4LnN1Ym1vZHVsZURpc3BhdGNoSW5mb3NdXG4gICAgICB9XG4gICAgfTtcbiAgfVxuICByZWR1Y2VyKC4uLmFyZ3MpIHtcbiAgICBsZXQgb3B0cywgcGFyYW1zID0ge30sIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgW2ZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOiB7XG4gICAgICAgIGxldCBhcmcxO1xuICAgICAgICBbYXJnMSwgZm5dID0gYXJncztcbiAgICAgICAgaWYgKHR5cGVvZiBhcmcxLm5hbWUgPT09IFwic3RyaW5nXCIpXG4gICAgICAgICAgb3B0cyA9IGFyZzE7XG4gICAgICAgIGVsc2UgcGFyYW1zID0gYXJnMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIDM6XG4gICAgICAgIFtvcHRzLCBwYXJhbXMsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gbWFrZVJlZHVjZXJFeHBvcnQodGhpcy4jY3R4LCBvcHRzLCBwYXJhbXMsIGZuKTtcbiAgfVxuICBpbml0KC4uLmFyZ3MpIHtcbiAgICBsZXQgb3B0cywgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAxOlxuICAgICAgICBbZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIFtvcHRzLCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIG1ha2VSZWR1Y2VyRXhwb3J0KHRoaXMuI2N0eCwgb3B0cywge30sIGZuLCBMaWZlY3ljbGUuSW5pdCk7XG4gIH1cbiAgY2xpZW50Q29ubmVjdGVkKC4uLmFyZ3MpIHtcbiAgICBsZXQgb3B0cywgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAxOlxuICAgICAgICBbZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIFtvcHRzLCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgcmV0dXJuIG1ha2VSZWR1Y2VyRXhwb3J0KHRoaXMuI2N0eCwgb3B0cywge30sIGZuLCBMaWZlY3ljbGUuT25Db25uZWN0KTtcbiAgfVxuICBjbGllbnREaXNjb25uZWN0ZWQoLi4uYXJncykge1xuICAgIGxldCBvcHRzLCBmbjtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIFtmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgW29wdHMsIGZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICByZXR1cm4gbWFrZVJlZHVjZXJFeHBvcnQodGhpcy4jY3R4LCBvcHRzLCB7fSwgZm4sIExpZmVjeWNsZS5PbkRpc2Nvbm5lY3QpO1xuICB9XG4gIHZpZXcob3B0cywgcmV0LCBmbiwgLi4uXykge1xuICAgIHJldHVybiBtYWtlVmlld0V4cG9ydCh0aGlzLiNjdHgsIG9wdHMsIHt9LCByZXQsIGZuKTtcbiAgfVxuICAvLyBUT0RPOiByZS1lbmFibGUgb25jZSBwYXJhbWV0ZXJpemVkIHZpZXdzIGFyZSBzdXBwb3J0ZWQgaW4gU1FMXG4gIC8vIHZpZXc8UmV0IGV4dGVuZHMgVmlld1JldHVyblR5cGVCdWlsZGVyPihcbiAgLy8gICBvcHRzOiBWaWV3T3B0cyxcbiAgLy8gICByZXQ6IFJldCxcbiAgLy8gICBmbjogVmlld0ZuPFMsIHt9LCBSZXQ+XG4gIC8vICk6IHZvaWQ7XG4gIC8vIHZpZXc8UGFyYW1zIGV4dGVuZHMgUGFyYW1zT2JqLCBSZXQgZXh0ZW5kcyBWaWV3UmV0dXJuVHlwZUJ1aWxkZXI+KFxuICAvLyAgIG9wdHM6IFZpZXdPcHRzLFxuICAvLyAgIHBhcmFtczogUGFyYW1zLFxuICAvLyAgIHJldDogUmV0LFxuICAvLyAgIGZuOiBWaWV3Rm48Uywge30sIFJldD5cbiAgLy8gKTogdm9pZDtcbiAgLy8gdmlldzxQYXJhbXMgZXh0ZW5kcyBQYXJhbXNPYmosIFJldCBleHRlbmRzIFZpZXdSZXR1cm5UeXBlQnVpbGRlcj4oXG4gIC8vICAgb3B0czogVmlld09wdHMsXG4gIC8vICAgcGFyYW1zT3JSZXQ6IFJldCB8IFBhcmFtcyxcbiAgLy8gICByZXRPckZuOiBWaWV3Rm48Uywge30sIFJldD4gfCBSZXQsXG4gIC8vICAgbWF5YmVGbj86IFZpZXdGbjxTLCBQYXJhbXMsIFJldD5cbiAgLy8gKTogdm9pZCB7XG4gIC8vICAgaWYgKHR5cGVvZiByZXRPckZuID09PSAnZnVuY3Rpb24nKSB7XG4gIC8vICAgICBkZWZpbmVWaWV3KG5hbWUsIGZhbHNlLCB7fSwgcGFyYW1zT3JSZXQgYXMgUmV0LCByZXRPckZuKTtcbiAgLy8gICB9IGVsc2Uge1xuICAvLyAgICAgZGVmaW5lVmlldyhuYW1lLCBmYWxzZSwgcGFyYW1zT3JSZXQgYXMgUGFyYW1zLCByZXRPckZuLCBtYXliZUZuISk7XG4gIC8vICAgfVxuICAvLyB9XG4gIGFub255bW91c1ZpZXcob3B0cywgcmV0LCBmbiwgLi4uXykge1xuICAgIHJldHVybiBtYWtlQW5vblZpZXdFeHBvcnQodGhpcy4jY3R4LCBvcHRzLCB7fSwgcmV0LCBmbik7XG4gIH1cbiAgcHJvY2VkdXJlKC4uLmFyZ3MpIHtcbiAgICBsZXQgb3B0cywgcGFyYW1zID0ge30sIHJldCwgZm47XG4gICAgc3dpdGNoIChhcmdzLmxlbmd0aCkge1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbcmV0LCBmbl0gPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzoge1xuICAgICAgICBsZXQgYXJnMTtcbiAgICAgICAgW2FyZzEsIHJldCwgZm5dID0gYXJncztcbiAgICAgICAgaWYgKHR5cGVvZiBhcmcxLm5hbWUgPT09IFwic3RyaW5nXCIpXG4gICAgICAgICAgb3B0cyA9IGFyZzE7XG4gICAgICAgIGVsc2UgcGFyYW1zID0gYXJnMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlIDQ6XG4gICAgICAgIFtvcHRzLCBwYXJhbXMsIHJldCwgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlUHJvY2VkdXJlRXhwb3J0KHRoaXMuI2N0eCwgb3B0cywgcGFyYW1zLCByZXQsIGZuKTtcbiAgfVxuICBodHRwSGFuZGxlciguLi5hcmdzKSB7XG4gICAgbGV0IG9wdHMsIGZuO1xuICAgIHN3aXRjaCAoYXJncy5sZW5ndGgpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgW2ZuXSA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBbb3B0cywgZm5dID0gYXJncztcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIHJldHVybiBtYWtlSHR0cEhhbmRsZXJFeHBvcnQodGhpcy4jY3R4LCBvcHRzLCBmbik7XG4gIH1cbiAgaHR0cFJvdXRlcihyb3V0ZXIpIHtcbiAgICByZXR1cm4gbWFrZUh0dHBSb3V0ZXJFeHBvcnQodGhpcy4jY3R4LCByb3V0ZXIpO1xuICB9XG4gIC8qKlxuICAgKiBCdW5kbGUgbXVsdGlwbGUgcmVkdWNlcnMsIHByb2NlZHVyZXMsIGV0YyBpbnRvIG9uZSB2YWx1ZSB0byBleHBvcnQuXG4gICAqIFRoZSBuYW1lIHRoZXkgd2lsbCBiZSBleHBvcnRlZCB3aXRoIGlzIHRoZWlyIGNvcnJlc3BvbmRpbmcga2V5IGluIHRoZSBgZXhwb3J0c2AgYXJndW1lbnQuXG4gICAqL1xuICBleHBvcnRHcm91cChleHBvcnRzKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIFtleHBvcnRDb250ZXh0XTogdGhpcy4jY3R4LFxuICAgICAgW3JlZ2lzdGVyRXhwb3J0XShjdHgsIF9leHBvcnROYW1lKSB7XG4gICAgICAgIGZvciAoY29uc3QgW2V4cG9ydE5hbWUsIG1vZHVsZUV4cG9ydF0gb2YgT2JqZWN0LmVudHJpZXMoZXhwb3J0cykpIHtcbiAgICAgICAgICBjaGVja0V4cG9ydENvbnRleHQobW9kdWxlRXhwb3J0LCBjdHgpO1xuICAgICAgICAgIG1vZHVsZUV4cG9ydFtyZWdpc3RlckV4cG9ydF0oY3R4LCBleHBvcnROYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH07XG4gIH1cbiAgY2xpZW50VmlzaWJpbGl0eUZpbHRlciA9IHtcbiAgICBzcWw6IChmaWx0ZXIpID0+ICh7XG4gICAgICBbZXhwb3J0Q29udGV4dF06IHRoaXMuI2N0eCxcbiAgICAgIFtyZWdpc3RlckV4cG9ydF0oY3R4LCBfZXhwb3J0TmFtZSkge1xuICAgICAgICBjdHgubW9kdWxlRGVmLnJvd0xldmVsU2VjdXJpdHkucHVzaCh7IHNxbDogZmlsdGVyIH0pO1xuICAgICAgfVxuICAgIH0pXG4gIH07XG59O1xudmFyIHJlZ2lzdGVyRXhwb3J0ID0gU3ltYm9sKFwiU3BhY2V0aW1lREIucmVnaXN0ZXJFeHBvcnRcIik7XG52YXIgZXhwb3J0Q29udGV4dCA9IFN5bWJvbChcIlNwYWNldGltZURCLmV4cG9ydENvbnRleHRcIik7XG5mdW5jdGlvbiBpc01vZHVsZUV4cG9ydCh4KSB7XG4gIHJldHVybiAodHlwZW9mIHggPT09IFwiZnVuY3Rpb25cIiB8fCB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIikgJiYgeCAhPT0gbnVsbCAmJiByZWdpc3RlckV4cG9ydCBpbiB4O1xufVxuZnVuY3Rpb24gY2hlY2tFeHBvcnRDb250ZXh0KGV4cCwgc2NoZW1hMikge1xuICBpZiAoZXhwW2V4cG9ydENvbnRleHRdICE9IG51bGwgJiYgZXhwW2V4cG9ydENvbnRleHRdICE9PSBzY2hlbWEyKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcIm11bHRpcGxlIHNjaGVtYXMgYXJlIG5vdCBzdXBwb3J0ZWRcIik7XG4gIH1cbn1cbmZ1bmN0aW9uIGlzVW50eXBlZFRhYmxlU2NoZW1hKHgpIHtcbiAgcmV0dXJuIHR5cGVvZiB4ID09PSBcIm9iamVjdFwiICYmIHggIT09IG51bGwgJiYgaGFzT3duKHgsIFwidGFibGVEZWZcIik7XG59XG5mdW5jdGlvbiBpc1N1Ym1vZHVsZU5hbWVzcGFjZSh4KSB7XG4gIHJldHVybiB0eXBlb2YgeCA9PT0gXCJvYmplY3RcIiAmJiB4ICE9PSBudWxsICYmIGhhc093bih4LCBcImRlZmF1bHRcIikgJiYgeC5kZWZhdWx0IGluc3RhbmNlb2YgU2NoZW1hO1xufVxuZnVuY3Rpb24gcmVnaXN0ZXJNb2R1bGVFeHBvcnRzKHNjaGVtYTIsIGV4cG9ydHMsIG9wdHMpIHtcbiAgaWYgKHNjaGVtYTIuZXhwb3J0c1JlZ2lzdGVyZWQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2NoZW1hMi5leHBvcnRzUmVnaXN0ZXJlZCA9IHRydWU7XG4gIGZvciAoY29uc3QgW25hbWUsIG1vZHVsZUV4cG9ydF0gb2YgT2JqZWN0LmVudHJpZXMoZXhwb3J0cykpIHtcbiAgICBpZiAobmFtZSA9PT0gXCJkZWZhdWx0XCIpIGNvbnRpbnVlO1xuICAgIGlmICghaXNNb2R1bGVFeHBvcnQobW9kdWxlRXhwb3J0KSkge1xuICAgICAgaWYgKG9wdHM/Lmlnbm9yZU5vbk1vZHVsZUV4cG9ydHMpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwiZXhwb3J0aW5nIHNvbWV0aGluZyB0aGF0IGlzIG5vdCBhIHNwYWNldGltZSBleHBvcnRcIik7XG4gICAgfVxuICAgIGNoZWNrRXhwb3J0Q29udGV4dChtb2R1bGVFeHBvcnQsIHNjaGVtYTIpO1xuICAgIG1vZHVsZUV4cG9ydFtyZWdpc3RlckV4cG9ydF0oc2NoZW1hMiwgbmFtZSk7XG4gIH1cbn1cbmZ1bmN0aW9uIHNjaGVtYShlbnRyaWVzLCBtb2R1bGVTZXR0aW5ncykge1xuICBjb25zdCBjdHggPSBuZXcgU2NoZW1hSW5uZXIoKGN0eDIpID0+IHtcbiAgICBpZiAobW9kdWxlU2V0dGluZ3M/LkNBU0VfQ09OVkVSU0lPTl9QT0xJQ1kgIT0gbnVsbCkge1xuICAgICAgY3R4Mi5zZXRDYXNlQ29udmVyc2lvblBvbGljeShtb2R1bGVTZXR0aW5ncy5DQVNFX0NPTlZFUlNJT05fUE9MSUNZKTtcbiAgICB9XG4gICAgY29uc3QgdGFibGVTY2hlbWFzID0ge307XG4gICAgZm9yIChjb25zdCBbYWNjTmFtZSwgZW50cnldIG9mIE9iamVjdC5lbnRyaWVzKGVudHJpZXMpKSB7XG4gICAgICBpZiAoZW50cnkgaW5zdGFuY2VvZiBTY2hlbWEpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgICBgc2NoZW1hIGVudHJ5ICcke2FjY05hbWV9JyBsb29rcyBsaWtlIGEgZGVmYXVsdCBpbXBvcnQ7IHVzZSBcXGBpbXBvcnQgKiBhcyAke2FjY05hbWV9IGZyb20gJy4uLidcXGAgc28gdGhlIHN1Ym1vZHVsZSBjYW4gc2VlIHRoZSBsaWJyYXJ5J3MgbmFtZWQgcmVkdWNlciBleHBvcnRzLmBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc1N1Ym1vZHVsZU5hbWVzcGFjZShlbnRyeSkpIHtcbiAgICAgICAgY29uc3QgeyByYXdEZWYsIGRpc3BhdGNoIH0gPSBlbnRyeS5kZWZhdWx0LmJ1aWxkU3VibW9kdWxlRGlzcGF0Y2goZW50cnkpO1xuICAgICAgICBkaXNwYXRjaC5uYW1lc3BhY2UgPSBhY2NOYW1lO1xuICAgICAgICBjdHgyLmFkZFN1Ym1vZHVsZSh7IG5hbWVzcGFjZTogYWNjTmFtZSwgbW9kdWxlOiByYXdEZWYgfSk7XG4gICAgICAgIGN0eDIuc3VibW9kdWxlRGlzcGF0Y2hJbmZvcy5wdXNoKGRpc3BhdGNoKTtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICBpZiAoIWlzVW50eXBlZFRhYmxlU2NoZW1hKGVudHJ5KSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAgIGBzY2hlbWEgZW50cnkgJyR7YWNjTmFtZX0nIG11c3QgYmUgYSB0YWJsZSBvciBhIHN1Ym1vZHVsZSBuYW1lc3BhY2Ugb2JqZWN0YFxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgY29uc3QgdGFibGUyID0gZW50cnk7XG4gICAgICBjb25zdCB0YWJsZURlZiA9IHRhYmxlMi50YWJsZURlZihjdHgyLCBhY2NOYW1lKTtcbiAgICAgIHRhYmxlU2NoZW1hc1thY2NOYW1lXSA9IHRhYmxlVG9TY2hlbWEoYWNjTmFtZSwgdGFibGUyLCB0YWJsZURlZik7XG4gICAgICBjb25zdCB0YWJsZVNvdXJjZU5hbWVzID0gY3R4Mi50YWJsZVNvdXJjZU5hbWVzLmdldCh0YWJsZTIpO1xuICAgICAgaWYgKHRhYmxlU291cmNlTmFtZXMgPT09IHZvaWQgMCkge1xuICAgICAgICBjdHgyLnRhYmxlU291cmNlTmFtZXMuc2V0KHRhYmxlMiwgW3RhYmxlRGVmLnNvdXJjZU5hbWVdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhYmxlU291cmNlTmFtZXMucHVzaCh0YWJsZURlZi5zb3VyY2VOYW1lKTtcbiAgICAgIH1cbiAgICAgIGN0eDIubW9kdWxlRGVmLnRhYmxlcy5wdXNoKHRhYmxlRGVmKTtcbiAgICAgIGlmICh0YWJsZTIuc2NoZWR1bGUpIHtcbiAgICAgICAgY3R4Mi5wZW5kaW5nU2NoZWR1bGVzLnB1c2goe1xuICAgICAgICAgIHRhYmxlOiB0YWJsZTIsXG4gICAgICAgICAgdGFibGVOYW1lOiB0YWJsZURlZi5zb3VyY2VOYW1lLFxuICAgICAgICAgIHNjaGVkdWxlQXRDb2w6IHRhYmxlMi5zY2hlZHVsZS5zY2hlZHVsZUF0Q29sLFxuICAgICAgICAgIHJlZHVjZXI6IHRhYmxlMi5zY2hlZHVsZS5yZWR1Y2VyXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgaWYgKHRhYmxlMi50YWJsZU5hbWUpIHtcbiAgICAgICAgY3R4Mi5tb2R1bGVEZWYuZXhwbGljaXROYW1lcy5lbnRyaWVzLnB1c2goe1xuICAgICAgICAgIHRhZzogXCJUYWJsZVwiLFxuICAgICAgICAgIHZhbHVlOiB7XG4gICAgICAgICAgICBzb3VyY2VOYW1lOiBhY2NOYW1lLFxuICAgICAgICAgICAgY2Fub25pY2FsTmFtZTogdGFibGUyLnRhYmxlTmFtZVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHRhYmxlczogdGFibGVTY2hlbWFzIH07XG4gIH0pO1xuICByZXR1cm4gbmV3IFNjaGVtYShjdHgpO1xufVxuXG4vLyBzcmMvc2VydmVyL2NvbnNvbGUudHNcbnZhciBpbXBvcnRfb2JqZWN0X2luc3BlY3QgPSBfX3RvRVNNKHJlcXVpcmVfb2JqZWN0X2luc3BlY3QoKSk7XG52YXIgZm10TG9nID0gKC4uLmRhdGEpID0+IGRhdGEubWFwKCh4KSA9PiB0eXBlb2YgeCA9PT0gXCJzdHJpbmdcIiA/IHggOiAoMCwgaW1wb3J0X29iamVjdF9pbnNwZWN0LmRlZmF1bHQpKHgpKS5qb2luKFwiIFwiKTtcbnZhciBjb25zb2xlX2xldmVsX2Vycm9yID0gMDtcbnZhciBjb25zb2xlX2xldmVsX3dhcm4gPSAxO1xudmFyIGNvbnNvbGVfbGV2ZWxfaW5mbyA9IDI7XG52YXIgY29uc29sZV9sZXZlbF9kZWJ1ZyA9IDM7XG52YXIgY29uc29sZV9sZXZlbF90cmFjZSA9IDQ7XG52YXIgdGltZXJNYXAgPSAvKiBAX19QVVJFX18gKi8gbmV3IE1hcCgpO1xudmFyIGNvbnNvbGUyID0ge1xuICAvLyBAdHMtZXhwZWN0LWVycm9yIHdlIHdhbnQgYSBibGFuayBwcm90b3R5cGUsIGJ1dCB0eXBlc2NyaXB0IGNvbXBsYWluc1xuICBfX3Byb3RvX186IHt9LFxuICBbU3ltYm9sLnRvU3RyaW5nVGFnXTogXCJjb25zb2xlXCIsXG4gIGFzc2VydDogKGNvbmRpdGlvbiA9IGZhbHNlLCAuLi5kYXRhKSA9PiB7XG4gICAgaWYgKCFjb25kaXRpb24pIHtcbiAgICAgIHN5cy5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2Vycm9yLCBmbXRMb2coLi4uZGF0YSkpO1xuICAgIH1cbiAgfSxcbiAgY2xlYXI6ICgpID0+IHtcbiAgfSxcbiAgZGVidWc6ICguLi5kYXRhKSA9PiB7XG4gICAgc3lzLmNvbnNvbGVfbG9nKGNvbnNvbGVfbGV2ZWxfZGVidWcsIGZtdExvZyguLi5kYXRhKSk7XG4gIH0sXG4gIGVycm9yOiAoLi4uZGF0YSkgPT4ge1xuICAgIHN5cy5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2Vycm9yLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICBpbmZvOiAoLi4uZGF0YSkgPT4ge1xuICAgIHN5cy5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2luZm8sIGZtdExvZyguLi5kYXRhKSk7XG4gIH0sXG4gIGxvZzogKC4uLmRhdGEpID0+IHtcbiAgICBzeXMuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF9pbmZvLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICB0YWJsZTogKHRhYnVsYXJEYXRhLCBfcHJvcGVydGllcykgPT4ge1xuICAgIHN5cy5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2luZm8sIGZtdExvZyh0YWJ1bGFyRGF0YSkpO1xuICB9LFxuICB0cmFjZTogKC4uLmRhdGEpID0+IHtcbiAgICBzeXMuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF90cmFjZSwgZm10TG9nKC4uLmRhdGEpKTtcbiAgfSxcbiAgd2FybjogKC4uLmRhdGEpID0+IHtcbiAgICBzeXMuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF93YXJuLCBmbXRMb2coLi4uZGF0YSkpO1xuICB9LFxuICBkaXI6IChfaXRlbSwgX29wdGlvbnMpID0+IHtcbiAgfSxcbiAgZGlyeG1sOiAoLi4uX2RhdGEpID0+IHtcbiAgfSxcbiAgLy8gQ291bnRpbmdcbiAgY291bnQ6IChfbGFiZWwgPSBcImRlZmF1bHRcIikgPT4ge1xuICB9LFxuICBjb3VudFJlc2V0OiAoX2xhYmVsID0gXCJkZWZhdWx0XCIpID0+IHtcbiAgfSxcbiAgLy8gR3JvdXBpbmdcbiAgZ3JvdXA6ICguLi5fZGF0YSkgPT4ge1xuICB9LFxuICBncm91cENvbGxhcHNlZDogKC4uLl9kYXRhKSA9PiB7XG4gIH0sXG4gIGdyb3VwRW5kOiAoKSA9PiB7XG4gIH0sXG4gIC8vIFRpbWluZ1xuICB0aW1lOiAobGFiZWwgPSBcImRlZmF1bHRcIikgPT4ge1xuICAgIGlmICh0aW1lck1hcC5oYXMobGFiZWwpKSB7XG4gICAgICBzeXMuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF93YXJuLCBgVGltZXIgJyR7bGFiZWx9JyBhbHJlYWR5IGV4aXN0cy5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdGltZXJNYXAuc2V0KGxhYmVsLCBzeXMuY29uc29sZV90aW1lcl9zdGFydChsYWJlbCkpO1xuICB9LFxuICB0aW1lTG9nOiAobGFiZWwgPSBcImRlZmF1bHRcIiwgLi4uZGF0YSkgPT4ge1xuICAgIHN5cy5jb25zb2xlX2xvZyhjb25zb2xlX2xldmVsX2luZm8sIGZtdExvZyhsYWJlbCwgLi4uZGF0YSkpO1xuICB9LFxuICB0aW1lRW5kOiAobGFiZWwgPSBcImRlZmF1bHRcIikgPT4ge1xuICAgIGNvbnN0IHNwYW5JZCA9IHRpbWVyTWFwLmdldChsYWJlbCk7XG4gICAgaWYgKHNwYW5JZCA9PT0gdm9pZCAwKSB7XG4gICAgICBzeXMuY29uc29sZV9sb2coY29uc29sZV9sZXZlbF93YXJuLCBgVGltZXIgJyR7bGFiZWx9JyBkb2VzIG5vdCBleGlzdC5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgc3lzLmNvbnNvbGVfdGltZXJfZW5kKHNwYW5JZCk7XG4gICAgdGltZXJNYXAuZGVsZXRlKGxhYmVsKTtcbiAgfSxcbiAgLy8gQWRkaXRpb25hbCBjb25zb2xlIG1ldGhvZHMgdG8gc2F0aXNmeSB0aGUgQ29uc29sZSBpbnRlcmZhY2VcbiAgdGltZVN0YW1wOiAoKSA9PiB7XG4gIH0sXG4gIHByb2ZpbGU6ICgpID0+IHtcbiAgfSxcbiAgcHJvZmlsZUVuZDogKCkgPT4ge1xuICB9XG59O1xuXG4vLyBzcmMvc2VydmVyL3BvbHlmaWxscy50c1xuZ2xvYmFsVGhpcy5jb25zb2xlID0gY29uc29sZTI7XG4vKiEgQnVuZGxlZCBsaWNlbnNlIGluZm9ybWF0aW9uOlxuXG5zdGF0dXNlcy9pbmRleC5qczpcbiAgKCohXG4gICAqIHN0YXR1c2VzXG4gICAqIENvcHlyaWdodChjKSAyMDE0IEpvbmF0aGFuIE9uZ1xuICAgKiBDb3B5cmlnaHQoYykgMjAxNiBEb3VnbGFzIENocmlzdG9waGVyIFdpbHNvblxuICAgKiBNSVQgTGljZW5zZWRcbiAgICopXG4qL1xuXG5leHBvcnQgeyBBcnJheUJ1aWxkZXIsIEFycmF5Q29sdW1uQnVpbGRlciwgQm9vbEJ1aWxkZXIsIEJvb2xDb2x1bW5CdWlsZGVyLCBCb29sZWFuRXhwciwgQnl0ZUFycmF5QnVpbGRlciwgQnl0ZUFycmF5Q29sdW1uQnVpbGRlciwgQ2FzZUNvbnZlcnNpb25Qb2xpY3ksIENvbHVtbkJ1aWxkZXIsIENvbHVtbkV4cHJlc3Npb24sIENvbm5lY3Rpb25JZEJ1aWxkZXIsIENvbm5lY3Rpb25JZENvbHVtbkJ1aWxkZXIsIEYzMkJ1aWxkZXIsIEYzMkNvbHVtbkJ1aWxkZXIsIEY2NEJ1aWxkZXIsIEY2NENvbHVtbkJ1aWxkZXIsIEkxMjhCdWlsZGVyLCBJMTI4Q29sdW1uQnVpbGRlciwgSTE2QnVpbGRlciwgSTE2Q29sdW1uQnVpbGRlciwgSTI1NkJ1aWxkZXIsIEkyNTZDb2x1bW5CdWlsZGVyLCBJMzJCdWlsZGVyLCBJMzJDb2x1bW5CdWlsZGVyLCBJNjRCdWlsZGVyLCBJNjRDb2x1bW5CdWlsZGVyLCBJOEJ1aWxkZXIsIEk4Q29sdW1uQnVpbGRlciwgSWRlbnRpdHlCdWlsZGVyLCBJZGVudGl0eUNvbHVtbkJ1aWxkZXIsIE9wdGlvbkJ1aWxkZXIsIE9wdGlvbkNvbHVtbkJ1aWxkZXIsIFByb2R1Y3RCdWlsZGVyLCBQcm9kdWN0Q29sdW1uQnVpbGRlciwgUmFuZ2UsIFJlZkJ1aWxkZXIsIFJlcXVlc3QsIFJlc3VsdEJ1aWxkZXIsIFJlc3VsdENvbHVtbkJ1aWxkZXIsIFJvdXRlciwgUm93QnVpbGRlciwgU2NoZWR1bGVBdCwgU2NoZWR1bGVBdEJ1aWxkZXIsIFNjaGVkdWxlQXRDb2x1bW5CdWlsZGVyLCBTZW5kZXJFcnJvciwgU2ltcGxlU3VtQnVpbGRlciwgU2ltcGxlU3VtQ29sdW1uQnVpbGRlciwgU3BhY2V0aW1lSG9zdEVycm9yLCBTdHJpbmdCdWlsZGVyLCBTdHJpbmdDb2x1bW5CdWlsZGVyLCBTdW1CdWlsZGVyLCBTdW1Db2x1bW5CdWlsZGVyLCBTeW5jUmVzcG9uc2UsIFRpbWVEdXJhdGlvbkJ1aWxkZXIsIFRpbWVEdXJhdGlvbkNvbHVtbkJ1aWxkZXIsIFRpbWVzdGFtcEJ1aWxkZXIsIFRpbWVzdGFtcENvbHVtbkJ1aWxkZXIsIFR5cGVCdWlsZGVyLCBVMTI4QnVpbGRlciwgVTEyOENvbHVtbkJ1aWxkZXIsIFUxNkJ1aWxkZXIsIFUxNkNvbHVtbkJ1aWxkZXIsIFUyNTZCdWlsZGVyLCBVMjU2Q29sdW1uQnVpbGRlciwgVTMyQnVpbGRlciwgVTMyQ29sdW1uQnVpbGRlciwgVTY0QnVpbGRlciwgVTY0Q29sdW1uQnVpbGRlciwgVThCdWlsZGVyLCBVOENvbHVtbkJ1aWxkZXIsIFV1aWRCdWlsZGVyLCBVdWlkQ29sdW1uQnVpbGRlciwgYW5kLCBjcmVhdGVUYWJsZVJlZkZyb21EZWYsIGVycm9ycywgZXZhbHVhdGVCb29sZWFuRXhwciwgZ2V0UXVlcnlBY2Nlc3Nvck5hbWUsIGdldFF1ZXJ5VGFibGVOYW1lLCBnZXRRdWVyeVdoZXJlQ2xhdXNlLCBpc1Jvd1R5cGVkUXVlcnksIGlzVHlwZWRRdWVyeSwgbGl0ZXJhbCwgbWFrZUZyb21CdWlsZGVyLCBtYWtlUXVlcnlCdWlsZGVyLCBub3QsIG9yLCBzY2hlbWEsIHQsIHRhYmxlLCB0b0NhbWVsQ2FzZSwgdG9Db21wYXJhYmxlVmFsdWUsIHRvU3FsIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5tanMubWFwXG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5tanMubWFwIiwiaW1wb3J0IHsgc2NoZW1hLCB0YWJsZSwgdCB9IGZyb20gXCJzcGFjZXRpbWVkYi9zZXJ2ZXJcIjtcblxuLyoqXG4gKiBTTkFQIEFSRU5BJ3Mgc2NoZW1hLCBwb3J0ZWQgZnJvbSB0aGUgQ29udmV4IG9yaWdpbmFsLlxuICpcbiAqIFRocmVlIHJ1bGVzIGdvdmVybiBldmVyeXRoaW5nIGJlbG93LCBhbmQgdGhleSBhcmUgd2hhdCBtYWtlcyB0aGlzIGEgcG9ydFxuICogcmF0aGVyIHRoYW4gYSB0cmFuc2NyaXB0aW9uOlxuICpcbiAqIDEuIFBSSVZBVEUgQlkgREVGQVVMVCwgQU5EIFBSSVZBVEUgTUVBTlMgUFJJVkFURS4gQSBDb252ZXggcXVlcnkgY291bGQgcmVhZCBhXG4gKiAgICBkb2N1bWVudCBhbmQgcmV0dXJuIHBhcnQgb2YgaXQuIEEgU3BhY2V0aW1lREIgc3Vic2NyaXB0aW9uIGhhbmRzIHRoZSBjbGllbnRcbiAqICAgIHRoZSB3aG9sZSByb3cuIFNvIGFueXRoaW5nIGEgcGxheWVyIG11c3Qgbm90IHNlZSDigJQgdGhlIHNvbmdzIGluIHBsYXksIHRoZVxuICogICAgYWxpYXNlcyB0aGF0IG1hdGNoIHRoZW0sIHRoZSB0ZXh0IG9mIGFuIG9wcG9uZW50J3MgZ3Vlc3Mg4oCUIGxpdmVzIGluIGFcbiAqICAgIHByaXZhdGUgdGFibGUsIGFuZCB3aGF0IHRoZSBwbGF5ZXIgTUFZIHNlZSBpcyBtYXRlcmlhbGlzZWQgaW50byBhIHNlcGFyYXRlXG4gKiAgICBwdWJsaWMgdGFibGUgYnkgdGhlIHJlZHVjZXIgdGhhdCBjaGFuZ2VzIGl0LiBTZWUgYHJvdW5kX3JldmVhbGAuXG4gKlxuICogMi4gT1JHQU5JU0UgQlkgVVBEQVRFIEZSRVFVRU5DWS4gQSByb3cgaXMgdGhlIHVuaXQgb2YgcmVwbGljYXRpb246IHRvdWNoaW5nIG9uZVxuICogICAgZmllbGQgcmUtc2VuZHMgdGhlIHJvdyB0byBldmVyeSBzdWJzY3JpYmVyLiBGaWVsZHMgd3JpdHRlbiBwZXItZ3Vlc3MgYXJlXG4gKiAgICBrZXB0IGFwYXJ0IGZyb20gZmllbGRzIHdyaXR0ZW4gb25jZSBwZXIgbWF0Y2guXG4gKlxuICogMy4gUkVBTCBDT05TVFJBSU5UUy4gVGhlIENvbnZleCBzY2hlbWEgY2FycmllZCBzZXZlbiBmaWVsZHMgY29tbWVudGVkIFwiVU5JUVVFXCJcbiAqICAgIGFuZCBlbmZvcmNlZCBieSBoYW5kIGluc2lkZSBtdXRhdGlvbnMsIGJlY2F1c2UgQ29udmV4IGhhcyBubyB1bmlxdWVcbiAqICAgIGNvbnN0cmFpbnRzLiBTcGFjZXRpbWVEQiBkb2VzLCBzbyB0aG9zZSBjb21tZW50cyBiZWNvbWUgYC51bmlxdWUoKWAgYW5kIHRoZVxuICogICAgaGFuZC1yb2xsZWQgY2hlY2tzIGdvIGF3YXkuXG4gKlxuICogTmFtaW5nOiB0YWJsZSBgbmFtZWAgYW5kIHRoZSBgc2NoZW1hKHsuLi59KWAga2V5IGFyZSBib3RoIHNuYWtlX2Nhc2UgYW5kIG11c3RcbiAqIG1hdGNoIOKAlCB0aGUga2V5IGlzIHRoZSBgY3R4LmRiYCBhY2Nlc3NvciB2ZXJiYXRpbS5cbiAqL1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFNoYXJlZCBjb2x1bW4gc2hhcGVzXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBgbW9kZWAsIGBzdGF0dXNgIGFuZCBgcGhhc2VgIHN0YXkgU1RSSU5HUyByYXRoZXIgdGhhbiBiZWNvbWluZyBgdC5lbnVtYCBzdW1cbiAqIHR5cGVzLCB3aGljaCBpcyB0aGUgb25lIHBsYWNlIHRoaXMgcG9ydCBrbm93aW5nbHkgZGVjbGluZXMgdGhlIG1vcmUgaWRpb21hdGljXG4gKiBvcHRpb24uXG4gKlxuICogVHdvIHJlYXNvbnMuIFN1YnNjcmlwdGlvbnMgZmlsdGVyIG9uIHRoZW0gKGBtYXRjaC53aGVyZShyID0+IHIuc3RhdHVzLmVxKC4uLikpYClcbiAqIGFuZCB0aGUgcXVlcnkgYnVpbGRlcidzIGNvbXBhcmlzb24gb3BlcmF0b3JzIGFyZSBkZWZpbmVkIG92ZXIgc2NhbGFycywgbm90IG92ZXJcbiAqIHRhZ2dlZCB1bmlvbnMuIEFuZCB0aGUgY2xpZW50IGNvbXBhcmVzIHRoZW0gYXMgc3RyaW5ncyBpbiB+NDAgcGxhY2VzXG4gKiAoYHBoYXNlID09PSBcImd1ZXNzaW5nXCJgKTsgYSBzdW0gdHlwZSB3b3VsZCB0dXJuIGV2ZXJ5IG9uZSBvZiB0aG9zZSBpbnRvXG4gKiBgcGhhc2UudGFnID09PSBcImd1ZXNzaW5nXCJgIGZvciBubyBiZWhhdmlvdXJhbCBnYWluLlxuICpcbiAqIENvbnZleCBzdG9yZWQgdGhlc2UgYXMgYHYudW5pb25gIG9mIHN0cmluZyBsaXRlcmFscywgd2hpY2ggaXMgYWxzbyBhIHN0cmluZyBvblxuICogdGhlIHdpcmUsIHNvIHRoaXMgaXMgbm90IGEgY2hhbmdlIGluIHJlcHJlc2VudGF0aW9uIOKAlCBvbmx5IGluIHdoYXQgdGhlIHR5cGVcbiAqIHN5c3RlbSBjaGVja3MuIFRoZSBlbmdpbmUncyBvd24gYE1hdGNoUGhhc2VgIHVuaW9uIGluIHNyYy9lbmdpbmUvY29uZmlnLnRzXG4gKiByZW1haW5zIHRoZSBzb3VyY2Ugb2YgdHJ1dGggYW5kIHN0aWxsIHR5cGUtY2hlY2tzIGV2ZXJ5IHdyaXRlLlxuICovXG5cbi8qKiBEYW1hZ2UgZGVhbHQgdG8gb25lIHBsYXllciBieSBvbmUgcm91bmQuICovXG5jb25zdCBSb3VuZERhbWFnZSA9IHQub2JqZWN0KFwiUm91bmREYW1hZ2VcIiwge1xuICB1c2VySWQ6IHQudTY0KCksXG4gIGRhbWFnZTogdC5mNjQoKSxcbiAgaHBBZnRlcjogdC5mNjQoKSxcbn0pO1xuXG4vKiogT25lIHBsYXllcidzIG91dGNvbWUgaW4gb25lIHJvdW5kLiAqL1xuY29uc3QgUm91bmRQbGF5ZXJSZXN1bHQgPSB0Lm9iamVjdChcIlJvdW5kUGxheWVyUmVzdWx0XCIsIHtcbiAgdXNlcklkOiB0LnU2NCgpLFxuICBwb2ludHM6IHQuZjY0KCksXG4gIC8qKiBBYnNlbnQgd2hlbiB0aGUgcGxheWVyIGRpZCBub3Qgc29sdmUuICovXG4gIGVsYXBzZWRNczogdC5vcHRpb24odC5mNjQoKSksXG4gIHNvbHZlZDogdC5ib29sKCksXG59KTtcblxuLyoqXG4gKiBPbmUgY2xvc2VkIHJvdW5kLlxuICpcbiAqIFN0b3JlZCByYXRoZXIgdGhhbiByZWNvbXB1dGVkIGZyb20gZ3Vlc3NlcywgZm9yIHRoZSByZWFzb24gdGhlIENvbnZleCBzY2hlbWFcbiAqIGdhdmU6IHRoZSBtdWx0aXBsaWVyLCB0aGUgdGllIHJ1bGVzIGFuZCB0aGUgc2NvcmUgY3VydmUgYXJlIGFsbCBleHBlY3RlZCB0byBiZVxuICogcmV0dW5lZCwgYW5kIGEgcmVjb21wdXRlZCBoaXN0b3J5IHdvdWxkIHNpbGVudGx5IHJld3JpdGUgZmluaXNoZWQgbWF0Y2hlcy5cbiAqL1xuY29uc3QgUm91bmRMb2dFbnRyeSA9IHQub2JqZWN0KFwiUm91bmRMb2dFbnRyeVwiLCB7XG4gIHJvdW5kSW5kZXg6IHQuaTMyKCksXG4gIC8qKiBcInRpZXJcIiB8IFwidGltZVwiIHwgXCJzb25nXCIg4oCUIHdoeSB0aGUgcm91bmQgd2VudCB0aGUgd2F5IGl0IGRpZC4gKi9cbiAgb3V0Y29tZTogdC5zdHJpbmcoKSxcbiAgd2lubmVySWQ6IHQub3B0aW9uKHQudTY0KCkpLFxuICAvKiogUHJlc2VudCBvbmx5IHdoZW4gdGhlIHJvdW5kIHdhcyBzZXR0bGVkIG9uIHJlYWN0aW9uIHRpbWUuICovXG4gIHRpbWVHYXBNczogdC5vcHRpb24odC5mNjQoKSksXG4gIG11bHRpcGxpZXI6IHQuZjY0KCksXG4gIGRhbWFnZTogdC5hcnJheShSb3VuZERhbWFnZSksXG4gIHJlc3VsdHM6IHQuYXJyYXkoUm91bmRQbGF5ZXJSZXN1bHQpLFxufSk7XG5cbi8qKiBPbmUgbGluZSBvZiB0aGUgcG9zdC1tYXRjaCBYUCBicmVha2Rvd24gKFwiUm91bmRzIHdvbiB4M1wiKS4gKi9cbmNvbnN0IFhwQXdhcmQgPSB0Lm9iamVjdChcIlhwQXdhcmRcIiwge1xuICByZWFzb246IHQuc3RyaW5nKCksXG4gIGFtb3VudDogdC5mNjQoKSxcbn0pO1xuXG4vKiogT25lIHN0b3JlZCBjb25maWcgb3ZlcnJpZGU6IGEgZG90dGVkIHBhdGggaW50byBSZXNvbHZlZENvbmZpZywgYW5kIGl0cyB2YWx1ZS4gKi9cbmNvbnN0IENvbmZpZ092ZXJyaWRlID0gdC5vYmplY3QoXCJDb25maWdPdmVycmlkZVwiLCB7XG4gIC8qKiBlLmcuIFwiRFVFTF9TVEFSVElOR19IUFwiIG9yIFwiWFBfQVdBUkRTLnJhbmtlZFdpblwiLiAqL1xuICBrZXk6IHQuc3RyaW5nKCksXG4gIC8qKiBOdWxsIG9ubHkgd2hlcmUgdGhlIHJlZ2lzdHJ5IG1hcmtzIHRoZSBlbnRyeSBudWxsYWJsZS4gKi9cbiAgdmFsdWU6IHQub3B0aW9uKHQuZjY0KCkpLFxufSk7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gSWRlbnRpdHkgYW5kIHBsYXllcnNcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIFRoZSBpZGVudGl0eSDihpIgcGxheWVyIG1hcHBpbmcuIFRoaXMgaXMgdGhlIG9sZCBgYnlfY2xlcmtfaWRgIGluZGV4LlxuICpcbiAqIEtlcHQgYXMgaXRzIG93biB0YWJsZSByYXRoZXIgdGhhbiBhbiBgaWRlbnRpdHlgIGNvbHVtbiBvbiBgdXNlcmAgZm9yIG9uZVxuICogcmVhc29uOiBCT1RTIEFSRSBPUkRJTkFSWSBVU0VSIFJPV1MgKHRoZSBpbnZhcmlhbnQgdGhlIENvbnZleCBzY2hlbWEgbGVhbmVkIG9uXG4gKiBzbyBldmVyeSBqb2luIGFuZCBtYXRjaCBmbG93IHdvcmtzIHVuY2hhbmdlZCksIGFuZCBhIGJvdCBoYXMgbm8gY29ubmVjdGlvbiBhbmRcbiAqIHRoZXJlZm9yZSBubyBJZGVudGl0eS4gQSBzZXBhcmF0ZSB0YWJsZSBsZXRzIHRoZSBtYXBwaW5nIGJlIHRvdGFsIGFuZCB1bmlxdWUgb25cbiAqIHRoZSByb3dzIHRoYXQgaGF2ZSBvbmUsIGluc3RlYWQgb2YgbnVsbGFibGUtdW5pcXVlIG9uIHRoZSByb3dzIHRoYXQgZG8gbm90LlxuICpcbiAqIFByaXZhdGU6IGEgY2xpZW50IGxlYXJucyBpdHMgb3duIHVzZXJJZCB0aHJvdWdoIHRoZSBgbWVgIHZpZXcuIFB1Ymxpc2hpbmcgdGhlXG4gKiB3aG9sZSBpZGVudGl0eeKGlHBsYXllciBtYXBwaW5nIHdvdWxkIGxldCBhbnlvbmUgZW51bWVyYXRlIHRoZSBwbGF5ZXIgYmFzZS5cbiAqL1xuY29uc3QgYWNjb3VudCA9IHRhYmxlKFxuICB7IG5hbWU6IFwiYWNjb3VudFwiIH0sXG4gIHtcbiAgICBpZGVudGl0eTogdC5pZGVudGl0eSgpLnByaW1hcnlLZXkoKSxcbiAgICB1c2VySWQ6IHQudTY0KCkudW5pcXVlKCksXG4gICAgLyoqIFdoaWNoIE9JREMgaXNzdWVyIG1pbnRlZCB0aGlzIGlkZW50aXR5LCBmb3IgdGhlIGF1ZGl0IHRyYWlsLiAqL1xuICAgIGlzc3VlcjogdC5zdHJpbmcoKSxcbiAgICBjcmVhdGVkQXQ6IHQudGltZXN0YW1wKCksXG4gIH0sXG4pO1xuXG4vKipcbiAqIEEgcGxheWVyLiBQdWJsaWMg4oCUIGhhbmRsZXMsIHJhdGluZ3MgYW5kIGxldmVscyBhcmUgc2hvd24gYWxsIG92ZXIgdGhlIGFwcC5cbiAqXG4gKiBgYXZhdGFyVXJsYCBrZWVwcyBpdHMgZXhhY3QgdGhyZWUtZm9ybSBjb250cmFjdCBmcm9tIHRoZSBDb252ZXggc2NoZW1hOlxuICpcbiAqICAgYGNvbG9yOiNycmdnYmJgICAgYSBzd2F0Y2ggY2hvc2VuIGR1cmluZyBvbmJvYXJkaW5nLCByZW5kZXJlZCBhcyBhbiBpbml0aWFsXG4gKiAgIGFuIGh0dHBzIFVSTCAgICAgIENsZXJrJ3MgcGljdHVyZSBhdCBzaWduLXVwLCBvciB0aGlzIG1vZHVsZSdzIG93blxuICogICAgICAgICAgICAgICAgICAgICAvcm91dGUvYXZhdGFyLzp1c2VySWQgZm9yIGFuIHVwbG9hZFxuICogICBhYnNlbnQgICAgICAgICAgICBmYWxscyBiYWNrIHRvIHRoZSBpbml0aWFsIG9uIGlua1xuICpcbiAqIFRoZSB1cGxvYWRlZCBieXRlcyBsaXZlIGluIGB1c2VyX2F2YXRhcmAsIG5vdCBoZXJlLCBzbyB0aGUgbGVhZGVyYm9hcmQgY2FuIHJlYWRcbiAqIDUwMCBvZiB0aGVzZSByb3dzIHdpdGhvdXQgcHVsbGluZyA1MDAgaW1hZ2VzIGRvd24gdGhlIHNvY2tldC5cbiAqL1xuY29uc3QgdXNlciA9IHRhYmxlKFxuICB7IG5hbWU6IFwidXNlclwiLCBwdWJsaWM6IHRydWUgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgLyoqIFVOSVFVRS4gTG93ZXJjYXNlZDsgdGhlIGRpc3BsYXkgZm9ybSBpcyBgZGlzcGxheU5hbWVgLiAqL1xuICAgIGhhbmRsZTogdC5zdHJpbmcoKS51bmlxdWUoKSxcbiAgICBkaXNwbGF5TmFtZTogdC5zdHJpbmcoKSxcbiAgICBhdmF0YXJVcmw6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICAgIC8qKiBIaWRkZW4gcGVuZGluZyByZXZpZXcgYWZ0ZXIgcmVwb3J0cy4gTWlycm9ycyBgYmlvSGlkZGVuYC4gKi9cbiAgICBhdmF0YXJIaWRkZW46IHQuYm9vbCgpLFxuXG4gICAgZWxvOiB0LmkzMigpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgZ2FtZXNQbGF5ZWQ6IHQuaTMyKCksXG4gICAgcGxhY2VtZW50c1JlbWFpbmluZzogdC5pMzIoKSxcbiAgICAvKipcbiAgICAgKiBFeHBsaWNpdCwgYmVjYXVzZSBTcGFjZXRpbWVEQiBoYXMgbm8gYF9jcmVhdGlvblRpbWVgLiBUaGUgbGFkZGVyJ3NcbiAgICAgKiB0aWUtYnJlYWsgaXMgKGVsbyBkZXNjLCBjcmVhdGVkQXQgZGVzYykgYW5kIGl0IGlzIGxvYWQtYmVhcmluZzogRWxvIGlzIGFuXG4gICAgICogaW50ZWdlciBvdmVyIGEgbmFycm93IHJhbmdlIHdpdGggYSBsYXJnZSBjb2hvcnQgcGFya2VkIGF0IFNUQVJUSU5HX0VMTywgc29cbiAgICAgKiB0aWVzIGFyZSB0aGUgY29tbW9uIGNhc2UgcmF0aGVyIHRoYW4gdGhlIHRhaWwuXG4gICAgICovXG4gICAgY3JlYXRlZEF0OiB0LnRpbWVzdGFtcCgpLFxuXG4gICAgLyoqIFwiYWRtaW5cIiwgb3IgYWJzZW50IGZvciB0aGUgb3ZlcndoZWxtaW5nIG1ham9yaXR5LiAqL1xuICAgIHJvbGU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuXG4gICAgLyoqIExpZmV0aW1lIFhQLiBOZXZlciBkZWNyZWFzZXMsIHNvIGEgbG9zdCBtYXRjaCBzdGlsbCBhZHZhbmNlcyB0aGUgYmFyLiAqL1xuICAgIHhwOiB0LmY2NCgpLFxuICAgIC8qKiBEZW5vcm1hbGlzZWQgZnJvbSB4cCBzbyBib2FyZHMgYW5kIFZTIGNhcmRzIHNraXAgcmVjb21wdXRpbmcgdGhlIGN1cnZlLiAqL1xuICAgIGxldmVsOiB0LmkzMigpLFxuICAgIHJhbmtlZFdpbnM6IHQuaTMyKCksXG4gICAgc25hcEd1ZXNzZXM6IHQuaTMyKCksXG5cbiAgICAvLyAtLS0gcHJvZmlsZSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBtb21lbnQgYSB1c2VybmFtZSBpcyBjb21taXR0ZWQsIHdoaWNoIGlzIHRoZSBGSVJTVCBzdGVwIG9mIHRoZVxuICAgICAqIHdlbGNvbWUgZmxvdyByYXRoZXIgdGhhbiB0aGUgbGFzdC5cbiAgICAgKlxuICAgICAqIENvbnZleCBuZWVkZWQgdGhhdCBvcmRlcmluZyBiZWNhdXNlIGl0IGhhZCBubyB1bmlxdWUgY29uc3RyYWludHMsIHNvIHRoZVxuICAgICAqIG9ubHkgd2F5IHRvIGhvbGQgYSBuYW1lIHdhcyB0byB3cml0ZSBpdC4gU3BhY2V0aW1lREIgZG9lcyBoYXZlIHRoZW0sIHNvIGFcbiAgICAgKiBsYXRlIGNvbW1pdCB3b3VsZCBub3cgYmUgc2FmZSDigJQgYnV0IHRoZSBvcmRlcmluZyBpcyBrZXB0LCBiZWNhdXNlIHRoZVxuICAgICAqIGJlaGF2aW91ciBwbGF5ZXJzIHNlZSAoeW91ciBuYW1lIGlzIHlvdXJzIGZyb20gdGhlIGZpcnN0IHNjcmVlbikgaXMgcGFydCBvZlxuICAgICAqIHdoYXQgbXVzdCBub3QgY2hhbmdlLlxuICAgICAqL1xuICAgIG9uYm9hcmRlZEF0OiB0Lm9wdGlvbih0LnRpbWVzdGFtcCgpKSxcbiAgICAvKiogSG93IGZhciB0aHJvdWdoIHRoZSB3ZWxjb21lIGZsb3cgdGhpcyBwbGF5ZXIgZ290LCBzbyBhIHJlZnJlc2ggcmVzdW1lcy4gKi9cbiAgICB3ZWxjb21lU3RlcDogdC5vcHRpb24odC5pMzIoKSksXG4gICAgLyoqIFNldCB3aGVuIHRoZSBjb2FjaGVkIHJvdW5kcyB3ZXJlIHBsYXllZCB0aHJvdWdoIHJhdGhlciB0aGFuIHNraXBwZWQuICovXG4gICAgdHV0b3JpYWxDb21wbGV0ZWRBdDogdC5vcHRpb24odC50aW1lc3RhbXAoKSksXG4gICAgYmlvOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgICAvKiogSGlkZGVuIHBlbmRpbmcgcmV2aWV3IGFmdGVyIGEgcmVwb3J0LiAqL1xuICAgIGJpb0hpZGRlbjogdC5ib29sKCksXG5cbiAgICAvLyAtLS0gYm90cyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgaXNCb3Q6IHQuYm9vbCgpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgYm90UGVyc29uYUlkOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgICAvKiogV2hvZXZlciB0aGlzIHBsYXllciBmYWNlZCBpbiB0aGVpciBsYXN0IHByYWN0aWNlIG1hdGNoLCBzbyB0aGUgXCJyYW5kb21cIiBwaWNrIHJvdGF0ZXMuICovXG4gICAgbGFzdFByYWN0aWNlUGVyc29uYUlkOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcblxuICAgIC8vIC0tLSBndWVzdHMgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvKipcbiAgICAgKiBBbm9ueW1vdXMgZGFpbHkgcGxheWVycy5cbiAgICAgKlxuICAgICAqIFRoZSBDb252ZXggdmVyc2lvbiBtaW50ZWQgYGNsZXJrSWQ6IFwiZ3Vlc3Q6PHV1aWQ+XCJgIGZyb20gYSB0b2tlbiB0aGUgY2xpZW50XG4gICAgICoga2VwdCBpbiBsb2NhbFN0b3JhZ2UuIFNwYWNldGltZURCIGdpdmVzIGV2ZXJ5IGFub255bW91cyBjb25uZWN0aW9uIGEgcmVhbFxuICAgICAqIElkZW50aXR5IHBsdXMgYSB0b2tlbiB0aGUgU0RLIHBlcnNpc3RzLCBzbyBhIGd1ZXN0IGlzIG5vdyBqdXN0IGFuIGBhY2NvdW50YFxuICAgICAqIHJvdyB3aG9zZSBwbGF5ZXIgaXMgZmxhZ2dlZCBoZXJlLiBzcmMvYXBwL2d1ZXN0LnRzIGlzIGRlbGV0ZWQuXG4gICAgICovXG4gICAgaXNHdWVzdDogdC5ib29sKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICAvKiogU2V0IG9uY2UgYSBndWVzdCdzIHJ1biBoYXMgYmVlbiBjbGFpbWVkIGJ5IGEgcmVhbCBhY2NvdW50LiAqL1xuICAgIGd1ZXN0Q2xhaW1lZEF0OiB0Lm9wdGlvbih0LnRpbWVzdGFtcCgpKSxcbiAgICAvKipcbiAgICAgKiBQcm9vZi1vZi1vd25lcnNoaXAgZm9yIHRoZSBjbGFpbSBhdCBzaWduLWluLlxuICAgICAqXG4gICAgICogU2lnbmluZyBpbiBwcm9kdWNlcyBhIERJRkZFUkVOVCBJZGVudGl0eSAoQ2xlcmsncywgbm90IHRoZSBhbm9ueW1vdXMgb25lKSxcbiAgICAgKiBzbyB0aGUgY2xhaW0gY2Fubm90IGJlIGF1dGhvcmlzZWQgYnkgYGN0eC5zZW5kZXJgIGFsb25lLiBUaGUgZ3Vlc3QgY2xpZW50IGlzXG4gICAgICogdGhlIG9ubHkgcGFydHkgZXZlciB0b2xkIHRoaXMgdmFsdWUsIGFuZCBpdCBpcyBjbGVhcmVkIG9uIGNsYWltLlxuICAgICAqL1xuICAgIGd1ZXN0Q2xhaW1Ub2tlbjogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gIH0sXG4pO1xuXG4vKipcbiAqIFBsYXllciBwcmVmZXJlbmNlcyB0aGF0IGFyZSByZWFkIG9uIHRoZWlyIG93biBzY3JlZW5zIGFuZCB3cml0dGVuIHJhcmVseS5cbiAqXG4gKiBTcGxpdCBvdXQgb2YgYHVzZXJgIGJlY2F1c2UgYHVzZXJgIGlzIHRoZSBzaW5nbGUgbW9zdC1zdWJzY3JpYmVkIHRhYmxlIGluIHRoZVxuICogYXBwIOKAlCB0aGUgc2hlbGwsIHRoZSBxdWV1ZSBkcml2ZXIsIGV2ZXJ5IFZTIGNhcmQgYW5kIHRoZSBsZWFkZXJib2FyZCBhbGwgaG9sZFxuICogcm93cyBmcm9tIGl0IOKAlCBhbmQgYSBwbGF5ZXIgcmVvcmRlcmluZyB0aGVpciBmYXZvdXJpdGUgZ2VucmVzIGhhcyBubyBidXNpbmVzc1xuICogcmUtc2VuZGluZyB0aGVpciByb3cgdG8gZXZlcnlvbmUgd2F0Y2hpbmcgdGhlIGxhZGRlci5cbiAqL1xuY29uc3QgdXNlcl9wcmVmZXJlbmNlID0gdGFibGUoXG4gIHsgbmFtZTogXCJ1c2VyX3ByZWZlcmVuY2VcIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICB1c2VySWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLFxuICAgIHByZWZlcnJlZENhdGVnb3J5SWRzOiB0LmFycmF5KHQudTY0KCkpLFxuICB9LFxuKTtcblxuLyoqXG4gKiBVcGxvYWRlZCBhdmF0YXIgYnl0ZXMuIFBSSVZBVEUsIGFuZCBzZXJ2ZWQgb3ZlciBIVFRQIGluc3RlYWQuXG4gKlxuICogQ29udmV4IHN0b3JlZCBhIHJlc29sdmVkIHN0b3JhZ2UgVVJMIG9uIHRoZSB1c2VyIHJvdyBzbyB0aGUgbGFkZGVyIGNvdWxkIHJlbmRlclxuICogNTAwIGF2YXRhcnMgd2l0aG91dCA1MDAgc3RvcmFnZSBsb29rdXBzLiBUaGUgc2FtZSBwcmVzc3VyZSBhcHBsaWVzIGhlcmUgZm9yIGFcbiAqIGRpZmZlcmVudCByZWFzb246IHRoZXNlIHJvd3MgYXJlIH4zMEtCIG9mIHdlYnAgZWFjaCwgYW5kIGEgcHVibGljIHRhYmxlIHdvdWxkXG4gKiBwdXNoIGFsbCBvZiB0aGVtIG92ZXIgdGhlIFdlYlNvY2tldCB0byBhbnlvbmUgc3Vic2NyaWJlZC4gVGhlIG1vZHVsZSdzIG93blxuICogL3JvdXRlL2F2YXRhci86dXNlcklkIGhhbmRsZXIgc2VydmVzIHRoZW0sIHNvIHRoZSBicm93c2VyIGNhY2hlcyB0aGVtIGxpa2UgYW55XG4gKiBvdGhlciBpbWFnZSBhbmQgYHVzZXIuYXZhdGFyVXJsYCBrZWVwcyBwb2ludGluZyBhdCBhIHBsYWluIFVSTC5cbiAqL1xuY29uc3QgdXNlcl9hdmF0YXIgPSB0YWJsZShcbiAgeyBuYW1lOiBcInVzZXJfYXZhdGFyXCIgfSxcbiAge1xuICAgIHVzZXJJZDogdC51NjQoKS5wcmltYXJ5S2V5KCksXG4gICAgbWltZVR5cGU6IHQuc3RyaW5nKCksXG4gICAgZGF0YTogdC5hcnJheSh0LnU4KCkpLFxuICAgIC8qKiBCdW1wZWQgb24gZXZlcnkgcmVwbGFjZW1lbnQgc28gdGhlIFVSTCBidXN0cyB0aGUgYnJvd3NlciBjYWNoZS4gKi9cbiAgICB2ZXJzaW9uOiB0LmkzMigpLFxuICAgIHVwbG9hZGVkQXQ6IHQudGltZXN0YW1wKCksXG4gIH0sXG4pO1xuXG4vKiogQmlvIGFuZCBhdmF0YXIgcmVwb3J0cywgZm9yIG1hbnVhbCByZXZpZXcuIE5vIGF1dG9tYXRlZCB0YWtlZG93bi4gKi9cbmNvbnN0IHJlcG9ydCA9IHRhYmxlKFxuICB7IG5hbWU6IFwicmVwb3J0XCIgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgcmVwb3J0ZWRVc2VySWQ6IHQudTY0KCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICByZXBvcnRlclVzZXJJZDogdC51NjQoKSxcbiAgICAvKiogXCJiaW9cIiB8IFwiYXZhdGFyXCIg4oCUIHNlcGFyYXRlIHRocmVzaG9sZHMsIHNvIGEgYmFkIHRhZ2xpbmUgY2Fubm90IHB1bGwgYSBwaWN0dXJlLiAqL1xuICAgIGtpbmQ6IHQuc3RyaW5nKCksXG4gICAgcmVhc29uOiB0LnN0cmluZygpLFxuICAgIGNyZWF0ZWRBdDogdC50aW1lc3RhbXAoKSxcbiAgICByZXNvbHZlZEF0OiB0Lm9wdGlvbih0LnRpbWVzdGFtcCgpKSxcbiAgfSxcbik7XG5cbi8qKiBBd2FyZGVkIGJhZGdlcy4gT25lIHJvdyBwZXIgcGxheWVyIHBlciBiYWRnZS4gKi9cbmNvbnN0IHVzZXJfYmFkZ2UgPSB0YWJsZShcbiAge1xuICAgIG5hbWU6IFwidXNlcl9iYWRnZVwiLFxuICAgIHB1YmxpYzogdHJ1ZSxcbiAgICBpbmRleGVzOiBbXG4gICAgICB7IGFjY2Vzc29yOiBcImJ5X3VzZXJfYmFkZ2VcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcInVzZXJJZFwiLCBcImJhZGdlSWRcIl0gfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICB1c2VySWQ6IHQudTY0KCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICBiYWRnZUlkOiB0LnN0cmluZygpLFxuICAgIGVhcm5lZEF0OiB0LnRpbWVzdGFtcCgpLFxuICB9LFxuKTtcblxuLyoqIFBlci1nZW5yZSBza2lsbCwgc2hvd24gb24gdGhlIHByb2ZpbGUgYW5kIHVzZWQgdG8gcGljayBhIFwiYmVzdCBjYXRlZ29yeVwiLiAqL1xuY29uc3QgY2F0ZWdvcnlfcmF0aW5nID0gdGFibGUoXG4gIHtcbiAgICBuYW1lOiBcImNhdGVnb3J5X3JhdGluZ1wiLFxuICAgIHB1YmxpYzogdHJ1ZSxcbiAgICBpbmRleGVzOiBbXG4gICAgICB7IGFjY2Vzc29yOiBcImJ5X3VzZXJfY2F0ZWdvcnlcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcInVzZXJJZFwiLCBcImNhdGVnb3J5SWRcIl0gfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICB1c2VySWQ6IHQudTY0KCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICBjYXRlZ29yeUlkOiB0LnU2NCgpLFxuICAgIHJhdGluZzogdC5mNjQoKSxcbiAgICBnYW1lczogdC5pMzIoKSxcbiAgfSxcbik7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQ2F0YWxvZ3VlXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuY29uc3QgY2F0ZWdvcnkgPSB0YWJsZShcbiAgeyBuYW1lOiBcImNhdGVnb3J5XCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBzbHVnOiB0LnN0cmluZygpLnVuaXF1ZSgpLFxuICAgIG5hbWU6IHQuc3RyaW5nKCksXG4gICAgc29ydE9yZGVyOiB0LmkzMigpLFxuICB9LFxuKTtcblxuLyoqXG4gKiBUaGUgc29uZyBjYXRhbG9ndWUuIFBSSVZBVEUg4oCUIHRoaXMgdGFibGUgSVMgdGhlIGFuc3dlciBrZXkuXG4gKlxuICogSW4gdGhlIENvbnZleCB2ZXJzaW9uIGBtYXRjaGVzLnN0YXRlYCB3YXMgY2FyZWZ1bCB0byBvbWl0IHRoZSBjdXJyZW50IHJvdW5kJ3NcbiAqIHRyYWNrIHVudGlsIHRoZSByZXZlYWwgYmVhdCwgYnV0IHRoZSBjYXRhbG9ndWUgaXRzZWxmIHdhcyByZWFkYWJsZSBieSBhbnlcbiAqIHNpZ25lZC1pbiBjYWxsZXIsIGJlY2F1c2UgcmVhZGluZyBpdCByZXF1aXJlZCBjYWxsaW5nIGEgcXVlcnkgdGhhdCBjaG9zZSB3aGF0XG4gKiB0byByZXR1cm4uIEhlcmUgdGhlcmUgaXMgbm8gc3VjaCBjaG9rZSBwb2ludDogYSBwdWJsaWMgdGFibGUgaXMgc2ltcGx5XG4gKiBkb3dubG9hZGFibGUuIFNvIG5vdGhpbmcgb3V0c2lkZSB0aGUgbW9kdWxlIGV2ZXIgc2VlcyBhIHJvdyBvZiB0aGlzLlxuICpcbiAqIFdoYXQgcGxheWVycyBhcmUgYWxsb3dlZCB0byBoZWFyIGFuZCB0aGVuIHNlZSBpcyBjb3BpZWQgaW50byBgcm91bmRfcmV2ZWFsYCBieVxuICogdGhlIHBoYXNlIHJlZHVjZXJzLCBhbmQgdGhlIGF1dG9jb21wbGV0ZSBsaXN0IGlzIGNvcGllZCBpbnRvIGB0cmFja19pbmRleGAuXG4gKi9cbmNvbnN0IHRyYWNrID0gdGFibGUoXG4gIHtcbiAgICBuYW1lOiBcInRyYWNrXCIsXG4gICAgaW5kZXhlczogW1xuICAgICAge1xuICAgICAgICBhY2Nlc3NvcjogXCJieV9wbGF5YWJsZV9kaWZmaWN1bHR5XCIsXG4gICAgICAgIGFsZ29yaXRobTogXCJidHJlZVwiLFxuICAgICAgICBjb2x1bW5zOiBbXCJwbGF5YWJsZVwiLCBcImRpZmZpY3VsdHlcIl0sXG4gICAgICB9LFxuICAgIF0sXG4gIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIGl0dW5lc1RyYWNrSWQ6IHQuaTY0KCkudW5pcXVlKCksXG4gICAgdGl0bGU6IHQuc3RyaW5nKCksXG4gICAgdGl0bGVOb3JtYWxpemVkOiB0LnN0cmluZygpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgYXJ0aXN0OiB0LnN0cmluZygpLFxuICAgIGFydGlzdE5vcm1hbGl6ZWQ6IHQuc3RyaW5nKCksXG4gICAgYXJ0d29ya1VybDogdC5zdHJpbmcoKSxcbiAgICBwcmV2aWV3VXJsOiB0LnN0cmluZygpLFxuICAgIHByZXZpZXdDaGVja2VkQXQ6IHQudGltZXN0YW1wKCksXG4gICAgY2F0ZWdvcnlJZHM6IHQuYXJyYXkodC51NjQoKSksXG4gICAgLyoqIDEgKGVhc2llc3QpIC4uIDUgKGhhcmRlc3QpLiBTZWVkZWQgZnJvbSBwb3B1bGFyaXR5LCBjb3JyZWN0ZWQgZnJvbSBwbGF5IGRhdGEuICovXG4gICAgZGlmZmljdWx0eTogdC5pMzIoKSxcbiAgICBwb3B1bGFyaXR5OiB0LmkzMigpLFxuICAgIHJlbGVhc2VZZWFyOiB0LmkzMigpLFxuICAgIC8qKiBGYWxzZSBmb3IgYWx0ZXJuYXRlIGN1dHMgYW5kIGFueXRoaW5nIGhlbGQgb3V0IG9mIHRoZSBwbGF5YWJsZSBwb29sLiAqL1xuICAgIHBsYXlhYmxlOiB0LmJvb2woKSxcbiAgICAvKiogUm9sbGluZyBtZWRpYW4gc29sdmUgdGltZSwgdXNlZCB0byByZS10aWVyIGRpZmZpY3VsdHkuIE5vbmUgdW50aWwgZW5vdWdoIGRhdGEuICovXG4gICAgbWVkaWFuU29sdmVNczogdC5vcHRpb24odC5mNjQoKSksXG4gICAgc29sdmVTYW1wbGVDb3VudDogdC5pMzIoKSxcbiAgfSxcbik7XG5cbi8qKiBBY2NlcHRlZCBhbHRlcm5hdGUgc3BlbGxpbmdzLiBQUklWQVRFIGZvciB0aGUgc2FtZSByZWFzb24gYXMgYHRyYWNrYC4gKi9cbmNvbnN0IHRyYWNrX2FsaWFzID0gdGFibGUoXG4gIHsgbmFtZTogXCJ0cmFja19hbGlhc1wiIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHRyYWNrSWQ6IHQudTY0KCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICBhbGlhc05vcm1hbGl6ZWQ6IHQuc3RyaW5nKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgfSxcbik7XG5cbi8qKlxuICogVGhlIGF1dG9jb21wbGV0ZSB0aXRsZSBsaXN0LCBwcmVjb21wdXRlZC4gRXhhY3RseSBvbmUgcm93LlxuICpcbiAqIFRoaXMgaXMgbm93IHRoZSBPTkxZIGF1dG9jb21wbGV0ZSBwYXRoLiBDb252ZXggaGFkIGEgZnVsbC10ZXh0IHNlYXJjaCBpbmRleCBvblxuICogYHRyYWNrc2AgYmVoaW5kIGEgYHRyYWNrcy5hdXRvY29tcGxldGVgIHF1ZXJ5OyBTcGFjZXRpbWVEQiBoYXMgbm8gZnVsbC10ZXh0XG4gKiBzZWFyY2ggYW5kLCBtb3JlIHRvIHRoZSBwb2ludCwgYHRyYWNrYCBpcyBwcml2YXRlIG5vdy4gVGhlIGNsaWVudCBhbHJlYWR5XG4gKiBkb3dubG9hZGVkIHRoaXMgbGlzdCBvbmNlIHBlciBzZXNzaW9uIGFuZCBtYXRjaGVkIGFnYWluc3QgaXQgbG9jYWxseVxuICogKHNyYy9nYW1lL3RyYWNrLWluZGV4LnRzICsgc3JjL2VuZ2luZS9hdXRvY29tcGxldGUudHMpLCBzbyBkZWxldGluZyB0aGUgc2VhcmNoXG4gKiBwYXRoIGNvc3RzIG5vdGhpbmcuXG4gKlxuICogVGl0bGVzIG9ubHkuIFRoZSBhbnRpLWNoZWF0IHJ1bGUgdGhlIENvbnZleCB2ZXJzaW9uIHdyb3RlIGRvd24gc3RpbGwgaG9sZHM6IHRoZVxuICogc3VnZ2VzdGlvbiBzZXQgaXMgdGhlIFdIT0xFIGNhdGFsb2d1ZSBhbmQgY2FycmllcyBub3RoaW5nIGJ1dCB0aGUgdGl0bGUsIHNvIGFcbiAqIHN1Z2dlc3Rpb24gY2FuIG5ldmVyIGNvbmZpcm0gYSBndWVzcyBvciBuYXJyb3cgdGhlIHJvdW5kIGluIHBsYXkuXG4gKi9cbmNvbnN0IHRyYWNrX2luZGV4ID0gdGFibGUoXG4gIHsgbmFtZTogXCJ0cmFja19pbmRleFwiLCBwdWJsaWM6IHRydWUgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgLyoqIERlZHVwbGljYXRlZCBieSBub3JtYWxpemVkIHRpdGxlLCBtb3N0IHBvcHVsYXIgZmlyc3QuICovXG4gICAgdGl0bGVzOiB0LmFycmF5KHQuc3RyaW5nKCkpLFxuICAgIC8qKiBUcnVlIHdoZW4gdGhlIGJ1aWxkIGhpdCBpdHMgY2VpbGluZyBhbmQgdGhlIHRhaWwgaXMgbWlzc2luZy4gKi9cbiAgICB0cnVuY2F0ZWQ6IHQuYm9vbCgpLFxuICAgIC8qKiBSb3dzIHNjYW5uZWQgdG8gYnVpbGQgdGhpcywgZm9yIHRoZSBzdGFsZW5lc3MgcmVhZG91dCBpbiAvYWRtaW4uICovXG4gICAgdHJhY2tDb3VudDogdC5pMzIoKSxcbiAgICBidWlsdEF0OiB0LnRpbWVzdGFtcCgpLFxuICB9LFxuKTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBNYXRjaGVzXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuLyoqXG4gKiBBIG1hdGNoLiBQdWJsaWMg4oCUIGJ1dCBub3RlIHdoYXQgaXMgTk9UIGhlcmUuXG4gKlxuICogVGhlIENvbnZleCByb3cgY2FycmllZCBgdHJhY2tJZHM6IElkPFwidHJhY2tzXCI+W11gLCB0aGUgd2hvbGUgc2V0bGlzdC4gVGhhdCBpc1xuICogdGhlIHNpbmdsZSBtb3N0IGRhbmdlcm91cyBmaWVsZCBpbiB0aGUgc2NoZW1hIHRvIHJlcGxpY2F0ZSwgc28gdGhlIHNldGxpc3RcbiAqIGxpdmVzIGluIHRoZSBwcml2YXRlIGBtYXRjaF90cmFja2AgdGFibGUgYW5kIHRoZSBjbGllbnQgbGVhcm5zIGVhY2ggc29uZyBvbmx5XG4gKiB0aHJvdWdoIGByb3VuZF9yZXZlYWxgLCBvbmUgcm91bmQgYXQgYSB0aW1lLlxuICovXG5jb25zdCBtYXRjaCA9IHRhYmxlKFxuICB7XG4gICAgbmFtZTogXCJtYXRjaFwiLFxuICAgIHB1YmxpYzogdHJ1ZSxcbiAgICBpbmRleGVzOiBbeyBhY2Nlc3NvcjogXCJieV9zdGF0dXNcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcInN0YXR1c1wiXSB9XSxcbiAgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgLyoqIFwicmFua2VkXCIgfCBcInJvb21cIiB8IFwiZGFpbHlcIiB8IFwicHJhY3RpY2VcIi4gKi9cbiAgICBtb2RlOiB0LnN0cmluZygpLFxuICAgIC8qKiBcInZldG9cIiB8IFwiYWN0aXZlXCIgfCBcImNvbXBsZXRlXCIgfCBcImFiYW5kb25lZFwiLiBDb2Fyc2UgbGlmZWN5Y2xlLiAqL1xuICAgIHN0YXR1czogdC5zdHJpbmcoKSxcbiAgICBwbGF5ZXJJZHM6IHQuYXJyYXkodC51NjQoKSksXG4gICAgLyoqIEhvdyBtYW55IHNvbmdzIHRoaXMgbWF0Y2ggaGFzLiBUaGUgc29uZ3MgdGhlbXNlbHZlcyBhcmUgaW4gYG1hdGNoX3RyYWNrYC4gKi9cbiAgICB0b3RhbFJvdW5kczogdC5pMzIoKSxcbiAgICAvKiogVW5pb24gb2YgYm90aCBwbGF5ZXJzJyBiYW5zLCBwb3B1bGF0ZWQgd2hlbiB0aGUgdmV0byBwaGFzZSBjbG9zZXMuICovXG4gICAgYmFubmVkQ2F0ZWdvcnlJZHM6IHQuYXJyYXkodC51NjQoKSksXG4gICAgLyoqIENhdGVnb3JpZXMgb2ZmZXJlZCBkdXJpbmcgdGhlIGJhbiBwaGFzZS4gUmFua2VkIG9ubHkuICovXG4gICAgdmV0b1Bvb2xJZHM6IHQuYXJyYXkodC51NjQoKSksXG4gICAgLyoqIFdhbGwtY2xvY2sgYWZ0ZXIgd2hpY2ggdGhlIHZldG8gcGhhc2UgYXV0by1jbG9zZXMgd2l0aCB3aGF0ZXZlciB3YXMgYmFubmVkLiAqL1xuICAgIHZldG9EZWFkbGluZTogdC5vcHRpb24odC50aW1lc3RhbXAoKSksXG4gICAgLyoqIEJhbiBvcmRlciwgbG93ZXItcmF0ZWQgcGxheWVyIGZpcnN0OyBpbmRleCBOIGlzIHdob3NlIHR1cm4gaXQgaXMuICovXG4gICAgYmFuT3JkZXI6IHQuYXJyYXkodC51NjQoKSksXG4gICAgLyoqIEhvdyBtYW55IGJhbnMgaGF2ZSBiZWVuIHBsYWNlZDsgaW5kZXhlcyBpbnRvIGJhbk9yZGVyLiAqL1xuICAgIGJhblR1cm46IHQuaTMyKCksXG5cbiAgICBjdXJyZW50Um91bmQ6IHQuaTMyKCksXG4gICAgLyoqIFNlcnZlciB3YWxsLWNsb2NrIGF0IHdoaWNoIHRoZSBjdXJyZW50IHJvdW5kIHdhcyBkaXNwYXRjaGVkLiAqL1xuICAgIHJvdW5kU3RhcnRlZEF0OiB0Lm9wdGlvbih0LnRpbWVzdGFtcCgpKSxcblxuICAgIC8vIC0tLSBwaGFzZSBtYWNoaW5lIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAvKiogV2hhdCB0aGUgY2xpZW50IHJlbmRlcnMgcmlnaHQgbm93LiBBZHZhbmNlZCBieSBzY2hlZHVsZWQgcmVkdWNlcnMsIG5ldmVyIGJ5IGEgY2xpZW50LiAqL1xuICAgIHBoYXNlOiB0LnN0cmluZygpLFxuICAgIC8qKiBXYWxsLWNsb2NrIHRoZSBjdXJyZW50IHBoYXNlIGVuZHMgYXQ7IGRyaXZlcyBldmVyeSBjb3VudGRvd24gcmluZyBpbiB0aGUgVUkuICovXG4gICAgcGhhc2VFbmRzQXQ6IHQub3B0aW9uKHQudGltZXN0YW1wKCkpLFxuICAgIC8qKiBUcnVlIG9uY2UgdGhlIG1hdGNoIGhhcyBmYWxsZW4gdGhyb3VnaCB0byBhIHNpbmdsZSBzdWRkZW4tZGVhdGggc29uZy4gKi9cbiAgICBzdWRkZW5EZWF0aDogdC5ib29sKCksXG5cbiAgICByb29tSWQ6IHQub3B0aW9uKHQudTY0KCkpLFxuICAgIHdpbm5lcklkOiB0Lm9wdGlvbih0LnU2NCgpKSxcbiAgICBjcmVhdGVkQXQ6IHQudGltZXN0YW1wKCksXG4gICAgY29tcGxldGVkQXQ6IHQub3B0aW9uKHQudGltZXN0YW1wKCkpLFxuICAgIC8qKlxuICAgICAqIFRoZSBjb25maWcgdGhpcyBtYXRjaCBpcyBwbGF5ZWQgdW5kZXIsIGZyb3plbiBhdCBjcmVhdGlvbiwgc28gc2F2aW5nIGEgbmV3XG4gICAgICogY29uZmlnIG1pZC1kdWVsIGNhbm5vdCBtb3ZlIHRoZSBzY29yZSBjdXJ2ZSB1bmRlciB0d28gcGxheWVycyB3aG8gYXJlXG4gICAgICogaGFsZndheSB0aHJvdWdoIGEgcm91bmQuIE5vbmUgbWVhbnMgXCJ0aGUgc2hpcHBlZCBkZWZhdWx0c1wiLlxuICAgICAqL1xuICAgIGNvbmZpZ1ZlcnNpb25JZDogdC5vcHRpb24odC51NjQoKSksXG4gIH0sXG4pO1xuXG4vKipcbiAqIFRoZSBzZXRsaXN0LiBQUklWQVRFIOKAlCB0aGlzIGlzIHRoZSBhbnN3ZXIga2V5IGZvciBhIG1hdGNoIGluIHByb2dyZXNzLlxuICpcbiAqIFNwbGl0IG91dCBvZiBgbWF0Y2gudHJhY2tJZHNgIHNvIHRoYXQgc3Vic2NyaWJpbmcgdG8gYSBtYXRjaCBjYW5ub3QgcmV2ZWFsIHdoYXRcbiAqIGlzIGNvbWluZy4gVGhlIHJlZHVjZXJzIHJlYWQgaXQ7IGNsaWVudHMgbmV2ZXIgZG8uXG4gKi9cbmNvbnN0IG1hdGNoX3RyYWNrID0gdGFibGUoXG4gIHtcbiAgICBuYW1lOiBcIm1hdGNoX3RyYWNrXCIsXG4gICAgaW5kZXhlczogW1xuICAgICAgeyBhY2Nlc3NvcjogXCJieV9tYXRjaF9yb3VuZFwiLCBhbGdvcml0aG06IFwiYnRyZWVcIiwgY29sdW1uczogW1wibWF0Y2hJZFwiLCBcInJvdW5kSW5kZXhcIl0gfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBtYXRjaElkOiB0LnU2NCgpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgcm91bmRJbmRleDogdC5pMzIoKSxcbiAgICB0cmFja0lkOiB0LnU2NCgpLFxuICB9LFxuKTtcblxuLyoqXG4gKiBXaGF0IHRoZSBjbGllbnQgaXMgYWxsb3dlZCB0byBrbm93IGFib3V0IGEgcm91bmQsIGFuZCBubyBtb3JlLiBQVUJMSUMuXG4gKlxuICogVGhpcyBpcyB0aGUgbG9hZC1iZWFyaW5nIHRhYmxlIG9mIHRoZSB3aG9sZSBwb3J0LiBUaGUgcGhhc2UgcmVkdWNlcnMgd3JpdGUgaXQ6XG4gKlxuICogICBlbnRlcmluZyBjb3VudGRvd24vZ3Vlc3Npbmcg4oaSIHByZXZpZXdVcmwgb25seS4gRW5vdWdoIHRvIGJ1ZmZlciBhbmQgcGxheSB0aGVcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpcCwgbm90aGluZyB0aGF0IG5hbWVzIGl0LlxuICogICBlbnRlcmluZyByZXZlYWwgICAgICAgICAgICAg4oaSIHRpdGxlLCBhcnRpc3QsIGFydHdvcmsgYW5kIGNhdGVnb3J5IGFyZSBmaWxsZWRcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW4sIHdoaWNoIGlzIHRoZSBtb21lbnQgdGhlIFVJIHNob3dzIHRoZW0uXG4gKlxuICogQSByb3VuZCdzIHJvdyBpcyBjcmVhdGVkIHdoZW4gdGhlIHJvdW5kIGlzIGRpc3BhdGNoZWQgYW5kIHVwZGF0ZWQgb25jZSB3aGVuIGl0XG4gKiBjbG9zZXMsIHNvIGEgY2xpZW50IHRoYXQgc3Vic2NyaWJlcyBtaWQtbWF0Y2ggc2VlcyByZXZlYWxlZCByb3VuZHMgaW4gZnVsbCBhbmRcbiAqIHRoZSByb3VuZCBpbiBwcm9ncmVzcyBhcyBhdWRpbyBhbG9uZS5cbiAqXG4gKiBDb252ZXggYWNoaWV2ZWQgdGhpcyBieSBoYXZpbmcgT05FIHF1ZXJ5IHJlbWVtYmVyIHRvIG9taXQgYSBmaWVsZC4gVGhpcyBhY2hpZXZlc1xuICogaXQgYnkgbmV2ZXIgcHV0dGluZyB0aGUgZmllbGQgaW4gYSByZXBsaWNhdGVkIHJvdyB1bnRpbCBpdCBpcyBwdWJsaWMga25vd2xlZGdlLFxuICogd2hpY2ggaXMgYSBwcm9wZXJ0eSBvZiB0aGUgc2NoZW1hIHJhdGhlciB0aGFuIG9mIGEgY29kZSBwYXRoLlxuICovXG5jb25zdCByb3VuZF9yZXZlYWwgPSB0YWJsZShcbiAge1xuICAgIG5hbWU6IFwicm91bmRfcmV2ZWFsXCIsXG4gICAgcHVibGljOiB0cnVlLFxuICAgIGluZGV4ZXM6IFtcbiAgICAgIHsgYWNjZXNzb3I6IFwiYnlfbWF0Y2hfcm91bmRcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcIm1hdGNoSWRcIiwgXCJyb3VuZEluZGV4XCJdIH0sXG4gICAgXSxcbiAgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgbWF0Y2hJZDogdC51NjQoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIHJvdW5kSW5kZXg6IHQuaTMyKCksXG4gICAgLyoqIEFsd2F5cyBwcmVzZW50IOKAlCB0aGUgY2xpcCBoYXMgdG8gYmUgZmV0Y2hhYmxlIGJlZm9yZSBhbnlvbmUgY2FuIGd1ZXNzIGl0LiAqL1xuICAgIHByZXZpZXdVcmw6IHQuc3RyaW5nKCksXG4gICAgLyoqIEFsbCBOb25lIHVudGlsIHRoZSByb3VuZCBjbG9zZXMuICovXG4gICAgdGl0bGU6IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICAgIGFydGlzdDogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gICAgYXJ0d29ya1VybDogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gICAgY2F0ZWdvcnlOYW1lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgICByZXZlYWxlZEF0OiB0Lm9wdGlvbih0LnRpbWVzdGFtcCgpKSxcbiAgfSxcbik7XG5cbi8qKlxuICogT25lIHJvdyBwZXIgcGxheWVyIHBlciBtYXRjaC4gUHVibGljLlxuICpcbiAqIEV2ZXJ5dGhpbmcgaGVyZSBpcyBlaXRoZXIgd3JpdHRlbiBvbmNlICh0aGUgcmF0aW5nIGFuZCByYW5rIHNuYXBzaG90cywgdGhlXG4gKiBwb3N0LW1hdGNoIFhQKSBvciBhIGZldyB0aW1lcyBwZXIgbWF0Y2ggKGhwLCByZWFkaW5lc3MpLiBUaGUgcGVyLWd1ZXNzIGNodXJuXG4gKiBsaXZlcyBpbiBgcm91bmRfcmVzdWx0YCBpbnN0ZWFkLCBzbyBhIGd1ZXNzIGRvZXMgbm90IHJlLXNlbmQgYSByb3cgY2FycnlpbmcgYW5cbiAqIFhQIGJyZWFrZG93biB0byBldmVyeW9uZSB3YXRjaGluZy5cbiAqL1xuY29uc3QgbWF0Y2hfcGxheWVyID0gdGFibGUoXG4gIHtcbiAgICBuYW1lOiBcIm1hdGNoX3BsYXllclwiLFxuICAgIHB1YmxpYzogdHJ1ZSxcbiAgICBpbmRleGVzOiBbXG4gICAgICB7IGFjY2Vzc29yOiBcImJ5X21hdGNoX3VzZXJcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcIm1hdGNoSWRcIiwgXCJ1c2VySWRcIl0gfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBtYXRjaElkOiB0LnU2NCgpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgdXNlcklkOiB0LnU2NCgpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgdG90YWxQb2ludHM6IHQuZjY0KCksXG5cbiAgICAvKiogUmF0aW5nIHNuYXBzaG90IHRha2VuIGF0IG1hdGNoIHN0YXJ0LCBzbyByZXN1bHRzIGFyZSByZXByb2R1Y2libGUuICovXG4gICAgcmF0aW5nQmVmb3JlOiB0LmkzMigpLFxuICAgIC8qKlxuICAgICAqIExhZGRlciBwb3NpdGlvbiBhdCBtYXRjaCBzdGFydCwgZnJvemVuLlxuICAgICAqXG4gICAgICogVGhlIENvbnZleCByZWFzb24gd2FzIHJlYWQgY29zdDogcmVzb2x2aW5nIGl0IGxpdmUgaW5zaWRlIGEgc3Vic2NyaWJlZCBxdWVyeVxuICAgICAqIG1hZGUgaW52YWxpZGF0aW9ucyBncm93IHdpdGggdGhlIHNxdWFyZSBvZiBjb25jdXJyZW50IHBsYXllcnMuIFRoYXQgc3BlY2lmaWNcbiAgICAgKiBwcmVzc3VyZSBpcyBnb25lLCBidXQgdGhlIGZpZWxkIHN0YXlzLCBiZWNhdXNlIHRoZSBiZWhhdmlvdXIgaXQgcHJvZHVjZXMgaXNcbiAgICAgKiB0aGUgb25lIHBsYXllcnMgZXhwZWN0IOKAlCB0aGUgVlMgc2NyZWVuIHNob3dzIGEgcmFuayBvbmNlLCBiZWZvcmUgcm91bmQgb25lLFxuICAgICAqIGFuZCBub2JvZHkgZXhwZWN0cyB0aGVpciBvcHBvbmVudCdzIHJhbmsgdG8gbW92ZSBtaWQtZHVlbC5cbiAgICAgKi9cbiAgICBnbG9iYWxSYW5rQXRTdGFydDogdC5vcHRpb24odC5pMzIoKSksXG4gICAgcmF0aW5nQWZ0ZXI6IHQub3B0aW9uKHQuaTMyKCkpLFxuICAgIHJhdGluZ0RlbHRhOiB0Lm9wdGlvbih0LmkzMigpKSxcbiAgICAvKiogVGhpcyBwbGF5ZXIncyB2ZXRvIGJhbnMuIEVtcHR5IG1lYW5zIHRoZXkgaGF2ZSBub3QgYmFubmVkIHlldC4gKi9cbiAgICBiYW5uZWRDYXRlZ29yeUlkczogdC5hcnJheSh0LnU2NCgpKSxcbiAgICBoYXNCYW5uZWQ6IHQuYm9vbCgpLFxuXG4gICAgLy8gLS0tIGhlYWx0aCBkdWVsIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIGhwOiB0LmY2NCgpLFxuICAgIC8qKiBMb3ctd2F0ZXIgbWFyayBhY3Jvc3MgdGhlIG1hdGNoLCBmb3IgdGhlIGNvbWViYWNrIGJhZGdlLiAqL1xuICAgIGxvd2VzdEhwOiB0LmY2NCgpLFxuICAgIC8qKiBSb3VuZCBhdCB3aGljaCBIUCBoaXQgemVybzsgTm9uZSB3aGlsZSBhbGl2ZS4gKi9cbiAgICBlbGltaW5hdGVkQXRSb3VuZDogdC5vcHRpb24odC5pMzIoKSksXG4gICAgLyoqXG4gICAgICogSGlnaGVzdCByb3VuZCBpbmRleCB0aGlzIGNsaWVudCBoYXMgZnVsbHkgYnVmZmVyZWQuIFRoZSBndWVzc2luZyBjbG9jayBkb2VzXG4gICAgICogbm90IHN0YXJ0IHVudGlsIGV2ZXJ5IHBsYXllciBoYXMgcmVwb3J0ZWQgdGhlIGN1cnJlbnQgcm91bmQsIHdoaWNoIGlzIHdoYXRcbiAgICAgKiBzdG9wcyBhIHNsb3cgY29ubmVjdGlvbiBwcm9kdWNpbmcgYSB0cnVuY2F0ZWQgc29uZy5cbiAgICAgKi9cbiAgICByZWFkeUZvclJvdW5kOiB0LmkzMigpLFxuICAgIC8qKlxuICAgICAqIFdoZW4gdGhpcyBwbGF5ZXIgcHJlc3NlZCBSZWFkeSBvbiB0aGUgb3Bwb25lbnQgcmV2ZWFsLiBEZWxpYmVyYXRlbHkgc2VwYXJhdGVcbiAgICAgKiBmcm9tIGByZWFkeUZvclJvdW5kYDogdGhhdCBvbmUgaXMgXCJoYXMgeW91ciBicm93c2VyIGJ1ZmZlcmVkIHRoZSBjbGlwXCIsIHRoaXNcbiAgICAgKiBvbmUgaXMgXCJJIGhhdmUgcmVhZCB0aGlzIGFuZCBJIHdhbnQgdG8gc3RhcnRcIi5cbiAgICAgKi9cbiAgICB2c1JlYWR5QXQ6IHQub3B0aW9uKHQudGltZXN0YW1wKCkpLFxuICAgIC8qKiBTZXQgd2hlbiB0aGUgcGxheWVyIHBhc3NlczsgdGhlIHJvdW5kIGNhbiBlbmQgb25jZSBldmVyeW9uZSBpcyBkb25lLiAqL1xuICAgIHBhc3NlZFJvdW5kOiB0Lm9wdGlvbih0LmkzMigpKSxcblxuICAgIC8vIC0tLSByZXN1bHRzIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICB4cEVhcm5lZDogdC5mNjQoKSxcbiAgICAvKiogSXRlbWlzZWQsIGFuZCBwZXJzaXN0ZWQgcmF0aGVyIHRoYW4gcmVjb21wdXRlZCwgYmVjYXVzZSBhd2FyZHMgZ2V0IHJldHVuZWQuICovXG4gICAgeHBCcmVha2Rvd246IHQuYXJyYXkoWHBBd2FyZCksXG4gICAgLyoqIExldmVsIGVpdGhlciBzaWRlLCBzbyB0aGUgcmVzdWx0cyBzY3JlZW4gY2FuIGFuaW1hdGUgcmVhbCBwcm9ncmVzcy4gKi9cbiAgICBsZXZlbEJlZm9yZTogdC5vcHRpb24odC5pMzIoKSksXG4gICAgbGV2ZWxBZnRlcjogdC5vcHRpb24odC5pMzIoKSksXG4gICAgeHBBZnRlcjogdC5vcHRpb24odC5mNjQoKSksXG4gICAgYmFkZ2VzRWFybmVkOiB0LmFycmF5KHQuc3RyaW5nKCkpLFxuICAgIGZvcmZlaXRlZDogdC5ib29sKCksXG5cbiAgICAvKipcbiAgICAgKiBNb2RlIGFuZCByZXN1bHQsIGNvcGllZCBvbiB3aGVuIHRoZSBtYXRjaCBpcyBmaW5hbGlzZWQgc28gYSBoaXN0b3J5IHJvdyBjYW5cbiAgICAgKiBiZSByZW5kZXJlZCB3aXRob3V0IG9wZW5pbmcgdGhlIG1hdGNoLiBXcml0dGVuIG9uY2UsIGJ5IGZpbmFsaXplTWF0Y2guXG4gICAgICovXG4gICAgbW9kZTogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gICAgY29tcGxldGVkQXQ6IHQub3B0aW9uKHQudGltZXN0YW1wKCkpLFxuICAgIC8qKiBcIndpblwiIHwgXCJsb3NzXCIgfCBcImRyYXdcIiBmcm9tIFRISVMgcm93J3MgcG9pbnQgb2Ygdmlldy4gKi9cbiAgICBvdXRjb21lOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgICAvKiogVGhlIG90aGVyIHBsYXllci4gTm9uZSBpbiBhIHJvb20gKG1vcmUgdGhhbiBvbmUpIGFuZCBpbiB0aGUgZGFpbHkgKG5vbmUpLiAqL1xuICAgIG9wcG9uZW50SWQ6IHQub3B0aW9uKHQudTY0KCkpLFxuICB9LFxuKTtcblxuLyoqXG4gKiBFdmVyeSBjbG9zZWQgcm91bmQgb2YgYSBtYXRjaCwgb25lIHJvdyBwZXIgcm91bmQuIFB1YmxpYy5cbiAqXG4gKiBUaGUgQ29udmV4IHZlcnNpb24ga2VwdCB0aGlzIGFzIGEgYHJvdW5kTG9nYCBhcnJheSBvbiB0aGUgbWF0Y2ggZG9jdW1lbnQsIHdoaWNoXG4gKiB3YXMgNzElIG9mIGEgMy4zS0Igcm93LiBBcyBhbiBhcnJheSBpdCB3b3VsZCBiZSByZXdyaXR0ZW4g4oCUIGFuZCByZS1zZW50IHRvIGJvdGhcbiAqIHBsYXllcnMg4oCUIG9uIGV2ZXJ5IHJvdW5kOyBhcyByb3dzLCBjbG9zaW5nIHJvdW5kIDQgc2VuZHMgcm91bmQgNC5cbiAqL1xuY29uc3Qgcm91bmRfbG9nID0gdGFibGUoXG4gIHtcbiAgICBuYW1lOiBcInJvdW5kX2xvZ1wiLFxuICAgIHB1YmxpYzogdHJ1ZSxcbiAgICBpbmRleGVzOiBbXG4gICAgICB7IGFjY2Vzc29yOiBcImJ5X21hdGNoX3JvdW5kXCIsIGFsZ29yaXRobTogXCJidHJlZVwiLCBjb2x1bW5zOiBbXCJtYXRjaElkXCIsIFwicm91bmRJbmRleFwiXSB9LFxuICAgIF0sXG4gIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIG1hdGNoSWQ6IHQudTY0KCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICAvKipcbiAgICAgKiBMaWZ0ZWQgb3V0IG9mIGBlbnRyeWAgc28gaXQgY2FuIGJlIGluZGV4ZWQgYW5kIG9yZGVyZWQgb24uIFRoZSBjb3B5IGluc2lkZVxuICAgICAqIGBlbnRyeWAgaXMga2VwdCBiZWNhdXNlIHRoYXQgb2JqZWN0IGlzIHdoYXQgdGhlIGVuZ2luZSdzIGR1ZWwgY29kZSBhbHJlYWR5XG4gICAgICogY29uc3VtZXMsIGFuZCBrZWVwaW5nIGl0cyBzaGFwZSBtZWFucyBubyBhZGFwdGVyIGF0IHRoZSBjYWxsIHNpdGUuXG4gICAgICovXG4gICAgcm91bmRJbmRleDogdC5pMzIoKSxcbiAgICBlbnRyeTogUm91bmRMb2dFbnRyeSxcbiAgfSxcbik7XG5cbi8qKlxuICogUGVyLXBsYXllciwgcGVyLXJvdW5kIHNjb3Jpbmcgc3RhdGUuIFB1YmxpYy5cbiAqXG4gKiBUaGlzIGlzIHRoZSBoaWdoLWZyZXF1ZW5jeSB0YWJsZTogaXQgaXMgd3JpdHRlbiBvbiBldmVyeSBhY2NlcHRlZCBndWVzcyBhbmRcbiAqIGV2ZXJ5IHBhc3MuIEl0IGNhcnJpZXMgcG9pbnRzLCByZWFjdGlvbiB0aW1lIGFuZCBzb2x2ZWQtbmVzcyDigJQgdGhlIG51bWJlcnMgdGhlXG4gKiBiZXR3ZWVuLXJvdW5kIGJlYXRzIHNob3cg4oCUIGFuZCBkZWxpYmVyYXRlbHkgTk9UIHRoZSBndWVzcyB0ZXh0LCB3aGljaCB3b3VsZFxuICogaGFuZCB0aGUgb3Bwb25lbnQgdGhlIGFuc3dlciB0aGUgaW5zdGFudCBlaXRoZXIgcGxheWVyIGdvdCBpdCByaWdodC5cbiAqL1xuY29uc3Qgcm91bmRfcmVzdWx0ID0gdGFibGUoXG4gIHtcbiAgICBuYW1lOiBcInJvdW5kX3Jlc3VsdFwiLFxuICAgIHB1YmxpYzogdHJ1ZSxcbiAgICBpbmRleGVzOiBbXG4gICAgICB7XG4gICAgICAgIGFjY2Vzc29yOiBcImJ5X21hdGNoX3JvdW5kX3VzZXJcIixcbiAgICAgICAgYWxnb3JpdGhtOiBcImJ0cmVlXCIsXG4gICAgICAgIGNvbHVtbnM6IFtcIm1hdGNoSWRcIiwgXCJyb3VuZEluZGV4XCIsIFwidXNlcklkXCJdLFxuICAgICAgfSxcbiAgICAgIHsgYWNjZXNzb3I6IFwiYnlfbWF0Y2hfcm91bmRcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcIm1hdGNoSWRcIiwgXCJyb3VuZEluZGV4XCJdIH0sXG4gICAgXSxcbiAgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgbWF0Y2hJZDogdC51NjQoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIHJvdW5kSW5kZXg6IHQuaTMyKCksXG4gICAgdXNlcklkOiB0LnU2NCgpLFxuICAgIHBvaW50czogdC5mNjQoKSxcbiAgICBlbGFwc2VkTXM6IHQub3B0aW9uKHQuZjY0KCkpLFxuICAgIHNvbHZlZDogdC5ib29sKCksXG4gICAgLyoqIFdyb25nIGd1ZXNzZXMgc28gZmFyIHRoaXMgcm91bmQsIGZvciB0aGUgYXR0ZW1wdCBjYXAgYW5kIHRoZSBsb2Nrb3V0LiAqL1xuICAgIGF0dGVtcHRzOiB0LmkzMigpLFxuICAgIC8qKiBXYWxsLWNsb2NrIHVudGlsIHdoaWNoIHRoaXMgcGxheWVyIGlzIGxvY2tlZCBvdXQgYWZ0ZXIgYSB3cm9uZyBndWVzcy4gKi9cbiAgICBsb2NrZWRVbnRpbDogdC5vcHRpb24odC50aW1lc3RhbXAoKSksXG4gICAgcGFzc2VkOiB0LmJvb2woKSxcbiAgfSxcbik7XG5cbi8qKlxuICogVGhlIHJhdyBndWVzcyBsb2cuIFBSSVZBVEUuXG4gKlxuICogYHJhd1RleHRgIGlzIGV4YWN0bHkgdGhlIGFuc3dlciBvbmNlIHNvbWVib2R5IGlzIHJpZ2h0LCBzbyB0aGlzIGNhbiBuZXZlciBiZSBhXG4gKiBwdWJsaWMgdGFibGUuIEl0IGlzIGtlcHQgZm9yIHRoZSBzYW1lIHJlYXNvbnMgQ29udmV4IGtlcHQgaXQg4oCUIGFudGktY2hlYXRcbiAqIGZvcmVuc2ljcyBhbmQgdGhlIHJlamVjdGlvbiBhdWRpdCB0cmFpbCDigJQgYW5kIHJlYWQgb25seSBieSByZWR1Y2VycyBhbmQgYnkgdGhlXG4gKiBjYWxsZXIncyBvd24gYG15X3JvdW5kX3N0YXR1c2Agdmlldy5cbiAqL1xuY29uc3QgZ3Vlc3MgPSB0YWJsZShcbiAge1xuICAgIG5hbWU6IFwiZ3Vlc3NcIixcbiAgICBpbmRleGVzOiBbXG4gICAgICB7XG4gICAgICAgIGFjY2Vzc29yOiBcImJ5X21hdGNoX3JvdW5kX3VzZXJcIixcbiAgICAgICAgYWxnb3JpdGhtOiBcImJ0cmVlXCIsXG4gICAgICAgIGNvbHVtbnM6IFtcIm1hdGNoSWRcIiwgXCJyb3VuZEluZGV4XCIsIFwidXNlcklkXCJdLFxuICAgICAgfSxcbiAgICBdLFxuICB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBtYXRjaElkOiB0LnU2NCgpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgcm91bmRJbmRleDogdC5pMzIoKSxcbiAgICB1c2VySWQ6IHQudTY0KCksXG4gICAgcmF3VGV4dDogdC5zdHJpbmcoKSxcbiAgICBub3JtYWxpemVkVGV4dDogdC5zdHJpbmcoKSxcbiAgICBjb3JyZWN0OiB0LmJvb2woKSxcbiAgICAvKiogQ2xpZW50LW1lYXN1cmVkIHJlYWN0aW9uIHRpbWUsIGFscmVhZHkgdmFsaWRhdGVkIHdoZW4gYGFjY2VwdGVkYCBpcyB0cnVlLiAqL1xuICAgIGNsaWVudEVsYXBzZWRNczogdC5mNjQoKSxcbiAgICBzZXJ2ZXJSZWNlaXZlZEF0OiB0LnRpbWVzdGFtcCgpLFxuICAgIGFjY2VwdGVkOiB0LmJvb2woKSxcbiAgICByZWplY3Rpb25SZWFzb246IHQub3B0aW9uKHQuc3RyaW5nKCkpLFxuICAgIHBvaW50czogdC5mNjQoKSxcbiAgfSxcbik7XG5cbi8qKlxuICogVGhlIHZlcmRpY3Qgb24gYSBzaW5nbGUgZ3Vlc3MsIGRlbGl2ZXJlZCB0byB0aGUgcGxheWVyIHdobyBtYWRlIGl0LiBFVkVOVCBUQUJMRS5cbiAqXG4gKiBDb252ZXggbXV0YXRpb25zIHJldHVybmVkIGEgdmFsdWUsIHNvIGBzdWJtaXRHdWVzc2AgY291bGQgYW5zd2VyXG4gKiBcImNvcnJlY3Qvd3JvbmcvcmVqZWN0ZWQsIGFuZCB3aHlcIiBpbiBpdHMgb3duIHJldHVybi4gUmVkdWNlcnMgcmV0dXJuIG5vdGhpbmcsXG4gKiBhbmQgdGhlIGR1cmFibGUgdGFibGVzIGFib3ZlIGRlbGliZXJhdGVseSBkbyBub3QgY2FycnkgdGhlIGFuc3dlciDigJQgc28gdGhlXG4gKiBvbmUtc2hvdCB2ZXJkaWN0IHRyYXZlbHMgYXMgYW4gZXZlbnQ6IGJyb2FkY2FzdCBvbiBjb21taXQsIG5ldmVyIHN0b3JlZC5cbiAqXG4gKiBSb3ctbGV2ZWwgZmlsdGVyaW5nIGJ5IGB1c2VySWRgIGlzIHdoYXQga2VlcHMgYSB3cm9uZyBndWVzcyBmcm9tIHRlbGxpbmcgdGhlXG4gKiBvcHBvbmVudCBhbnl0aGluZy5cbiAqL1xuY29uc3QgZ3Vlc3NfZmVlZGJhY2sgPSB0YWJsZShcbiAgeyBuYW1lOiBcImd1ZXNzX2ZlZWRiYWNrXCIsIHB1YmxpYzogdHJ1ZSwgZXZlbnQ6IHRydWUgfSxcbiAge1xuICAgIG1hdGNoSWQ6IHQudTY0KCksXG4gICAgcm91bmRJbmRleDogdC5pMzIoKSxcbiAgICB1c2VySWQ6IHQudTY0KCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICAvKiogXCJjb3JyZWN0XCIgfCBcIndyb25nXCIgfCBcInJlamVjdGVkXCIuICovXG4gICAgb3V0Y29tZTogdC5zdHJpbmcoKSxcbiAgICBwb2ludHM6IHQuZjY0KCksXG4gICAgcmVqZWN0aW9uUmVhc29uOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgfSxcbik7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gUm9vbXNcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCByb29tID0gdGFibGUoXG4gIHsgbmFtZTogXCJyb29tXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICAvKiogNSBjaGFycywgYWxwaGFiZXQgZXhjbHVkZXMgTy8wL0kvMS9MLiAqL1xuICAgIGNvZGU6IHQuc3RyaW5nKCkudW5pcXVlKCksXG4gICAgaG9zdElkOiB0LnU2NCgpLFxuICAgIG1lbWJlcklkczogdC5hcnJheSh0LnU2NCgpKSxcbiAgICAvKiogXCJsb2JieVwiIHwgXCJpbl9tYXRjaFwiIHwgXCJjbG9zZWRcIi4gKi9cbiAgICBzdGF0dXM6IHQuc3RyaW5nKCksXG4gICAgYWN0aXZlTWF0Y2hJZDogdC5vcHRpb24odC51NjQoKSksXG4gICAgLyoqXG4gICAgICogTWVtYmVycyByZWFkeSBmb3IgdGhlIG5leHQgc3RhcnQuIEFkdmlzb3J5LCBuZXZlciBhIGdhdGUg4oCUIGEgaGFyZCBnYXRlIGhhbmRzXG4gICAgICogb25lIHBsYXllciB3aG8gd2FuZGVyZWQgb2ZmIGEgdmV0byBvdmVyIHNldmVuIG90aGVycywgYW5kIHRoZXJlIGlzIG5vIGtpY2suXG4gICAgICogQ2xlYXJlZCBvbiBqb2luLCBsZWF2ZSwgc3RhcnQgYW5kIHJldHVyblRvTG9iYnkuXG4gICAgICovXG4gICAgcmVhZHlJZHM6IHQuYXJyYXkodC51NjQoKSksXG4gICAgY3JlYXRlZEF0OiB0LnRpbWVzdGFtcCgpLFxuICB9LFxuKTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBEYWlseSBjaGFsbGVuZ2Vcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKiogVGhlIGRheSdzIHNldGxpc3QuIFBSSVZBVEUg4oCUIHNhbWUgYW5zd2VyLWtleSByZWFzb25pbmcgYXMgYG1hdGNoX3RyYWNrYC4gKi9cbmNvbnN0IGRhaWx5X2NoYWxsZW5nZSA9IHRhYmxlKFxuICB7IG5hbWU6IFwiZGFpbHlfY2hhbGxlbmdlXCIgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgLyoqIElTTyBkYXRlLCBVVEMuICovXG4gICAgZGF0ZTogdC5zdHJpbmcoKS51bmlxdWUoKSxcbiAgICB0cmFja0lkczogdC5hcnJheSh0LnU2NCgpKSxcbiAgfSxcbik7XG5cbmNvbnN0IGRhaWx5X3J1biA9IHRhYmxlKFxuICB7XG4gICAgbmFtZTogXCJkYWlseV9ydW5cIixcbiAgICBwdWJsaWM6IHRydWUsXG4gICAgaW5kZXhlczogW1xuICAgICAgeyBhY2Nlc3NvcjogXCJieV91c2VyX2RhdGVcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcInVzZXJJZFwiLCBcImRhdGVcIl0gfSxcbiAgICAgIHsgYWNjZXNzb3I6IFwiYnlfZGF0ZV9wb2ludHNcIiwgYWxnb3JpdGhtOiBcImJ0cmVlXCIsIGNvbHVtbnM6IFtcImRhdGVcIiwgXCJ0b3RhbFBvaW50c1wiXSB9LFxuICAgIF0sXG4gIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHVzZXJJZDogdC51NjQoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIGRhdGU6IHQuc3RyaW5nKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICB0b3RhbFBvaW50czogdC5mNjQoKSxcbiAgICBwZXJSb3VuZE1zOiB0LmFycmF5KHQuZjY0KCkpLFxuICAgIHBlclJvdW5kUG9pbnRzOiB0LmFycmF5KHQuZjY0KCkpLFxuICAgIGNvbXBsZXRlZEF0OiB0LnRpbWVzdGFtcCgpLFxuICAgIC8qKiBEZW5vcm1hbGlzZWQgc28gdGhlIGJvYXJkIGNhbiBleGNsdWRlIGd1ZXN0cyB3aXRob3V0IGEgbG9va3VwIHBlciBydW4uICovXG4gICAgaXNHdWVzdDogdC5ib29sKCksXG4gIH0sXG4pO1xuXG4vKipcbiAqIEhvdyBtYW55IHJ1bnMgZWFjaCBkYXkgaGFzLCBhcyBhIHJ1bm5pbmcgdG90YWwuXG4gKlxuICogS2VwdCBmcm9tIHRoZSBDb252ZXggc2NoZW1hLiBUaGUgcmVhc29uIHRoZXJlIHdhcyByZWFkIGNvc3Qg4oCUIGNvdW50aW5nIG1lYW50IGFcbiAqIGAudGFrZWAgb2YgdXAgdG8gYSB0aG91c2FuZCByb3dzIGZvciBldmVyeSB2aXNpdG9yIHdpdGggdGhlIGxhbmRpbmcgcGFnZSBvcGVuLlxuICogVGhlIHJlYXNvbiBoZXJlIGlzIGJhbmR3aWR0aDogdGhlIGxhbmRpbmcgcGFnZSBpcyBzdWJzY3JpYmVkIGJ5IHNpZ25lZC1vdXRcbiAqIHZpc2l0b3JzIHRvbywgYW5kIG9uZSBjb3VudGVyIHJvdyBpcyBhIGdyZWF0IGRlYWwgbGVzcyB0cmFmZmljIHRoYW4gdGhlIGRheSdzXG4gKiBydW5zLlxuICovXG5jb25zdCBkYWlseV9jb3VudCA9IHRhYmxlKFxuICB7IG5hbWU6IFwiZGFpbHlfY291bnRcIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIGRhdGU6IHQuc3RyaW5nKCkudW5pcXVlKCksXG4gICAgcGxheWVyczogdC5pMzIoKSxcbiAgfSxcbik7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gTGFkZGVyIGFuZCBtYXRjaG1ha2luZ1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKlxuICogVGhlIGdsb2JhbCBsYWRkZXIsIG9uZSByb3cgcGVyIHJhbmtlZCBwbGF5ZXIuXG4gKlxuICogUkVQTEFDRVMgdGhlIENvbnZleCBgbGFkZGVyU25hcHNob3RgLCB3aGljaCBoZWxkIHRoZSBlbnRpcmUgb3JkZXJpbmcgYXMgYSBzaW5nbGVcbiAqIH40MTVLQiBkb2N1bWVudC4gVGhhdCBzaGFwZSB3YXMgcmlnaHQgZm9yIENvbnZleCwgd2hlcmUgdGhlIGNvc3Qgd2FzIGluIHJlYWRpbmc7XG4gKiBpdCBpcyB3cm9uZyBoZXJlLCB3aGVyZSB0aGUgY29zdCBpcyBpbiByZXBsaWNhdGluZyDigJQgYSBzaW5nbGUgcmFuayBjaGFuZ2Ugd291bGRcbiAqIGhhdmUgcmUtc2VudCBhbGwgNSwwMDAgZW50cmllcyB0byBldmVyeSBzdWJzY3JpYmVyLlxuICpcbiAqIEFzIHJvd3M6IHRoZSBib2FyZCBzdWJzY3JpYmVzIHRvIGByYW5rIDw9IFJPV19ERVBUSGAsIGEgcGxheWVyJ3Mgb3duIHBvc2l0aW9uIGlzXG4gKiBvbmUgbG9va3VwIGJ5IGB1c2VySWRgLCBhbmQgYSByZWJ1aWxkIHRoYXQgbW92ZXMgdGhyZWUgcGVvcGxlIHNlbmRzIHRocmVlIHJvd3MuXG4gKlxuICogRnJlc2huZXNzIGlzIHByZXNlcnZlZCBpbiB0aGUgd2F5IHRoYXQgbWF0dGVycy4gQSBmaXZlLW1pbnV0ZSByZWJ1aWxkIHJlZnJlc2hlc1xuICogZXZlcnlvbmUsIGJ1dCBgZmluYWxpemVNYXRjaGAgcmV3cml0ZXMgdGhlIGZpbmlzaGluZyBwbGF5ZXJzJyBPV04gcm93c1xuICogaW1tZWRpYXRlbHkg4oCUIHNvIHlvdXIgbnVtYmVyIHN0aWxsIG1vdmVzIHRoZSBpbnN0YW50IHlvdXIgbWF0Y2ggZW5kcywgd2hpY2ggaXNcbiAqIHdoYXQgYHBvc2l0aW9uSW5gIGJvdWdodCBieSBtZWFzdXJpbmcgYSBsaXZlIHJhdGluZyBhZ2FpbnN0IGEgc3RhbGUgZmllbGQuXG4gKi9cbmNvbnN0IGxhZGRlcl9lbnRyeSA9IHRhYmxlKFxuICB7IG5hbWU6IFwibGFkZGVyX2VudHJ5XCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgdXNlcklkOiB0LnU2NCgpLnByaW1hcnlLZXkoKSxcbiAgICByYW5rOiB0LmkzMigpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgZWxvOiB0LmkzMigpLFxuICAgIC8qKiBEZW5vcm1hbGlzZWQgZm9yIHRoZSBib2FyZCwgc28gcmVuZGVyaW5nIDUwMCByb3dzIG5lZWRzIG5vIGpvaW4uICovXG4gICAgaGFuZGxlOiB0LnN0cmluZygpLFxuICAgIGRpc3BsYXlOYW1lOiB0LnN0cmluZygpLFxuICAgIGF2YXRhclVybDogdC5vcHRpb24odC5zdHJpbmcoKSksXG4gICAgZ2FtZXNQbGF5ZWQ6IHQuaTMyKCksXG4gICAgbGV2ZWw6IHQuaTMyKCksXG4gICAgdGllcklkOiB0LnN0cmluZygpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgLyoqIFRydWUgd2hlbiB0aGlzIHJvdyBpcyBhIGZsb29yIHJhdGhlciB0aGFuIGFuIGV4YWN0IHBvc2l0aW9uLiAqL1xuICAgIGFwcHJveGltYXRlOiB0LmJvb2woKSxcbiAgfSxcbik7XG5cbi8qKiBCb2FyZC13aWRlIHRvdGFscywgc28gdGhlIGxlYWRlcmJvYXJkJ3MgaGVhZGVyIG5lZWRzIG5vIGNvdW50aW5nLiBFeGFjdGx5IG9uZSByb3cuICovXG5jb25zdCBsYWRkZXJfc3RhdHVzID0gdGFibGUoXG4gIHsgbmFtZTogXCJsYWRkZXJfc3RhdHVzXCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBwbGF5ZXJDb3VudDogdC5pMzIoKSxcbiAgICB0cnVuY2F0ZWQ6IHQuYm9vbCgpLFxuICAgIC8qKiBXaGVuIHRoZSBvcmRlcmluZyBsYXN0IENIQU5HRUQg4oCUIHdoYXQgXCJ1cGRhdGVkIDJtIGFnb1wiIG1lYW5zLiAqL1xuICAgIGJ1aWx0QXQ6IHQudGltZXN0YW1wKCksXG4gICAgLyoqIFdoZW4gdGhlIHJlYnVpbGQgbGFzdCByYW4sIGNoYW5nZWQgb3Igbm90LiAqL1xuICAgIGNoZWNrZWRBdDogdC50aW1lc3RhbXAoKSxcbiAgfSxcbik7XG5cbi8qKiBQZXItdGllciBwb3B1bGF0aW9ucyBmb3IgdGhlIGxlYWRlcmJvYXJkJ3MgYmFuZCBoZWFkZXJzLiAqL1xuY29uc3QgbGFkZGVyX3RpZXJfY291bnQgPSB0YWJsZShcbiAgeyBuYW1lOiBcImxhZGRlcl90aWVyX2NvdW50XCIsIHB1YmxpYzogdHJ1ZSB9LFxuICB7XG4gICAgdGllcklkOiB0LnN0cmluZygpLnByaW1hcnlLZXkoKSxcbiAgICBjb3VudDogdC5pMzIoKSxcbiAgfSxcbik7XG5cbi8qKlxuICogVGhlIHJhbmtlZCBtYXRjaG1ha2luZyBwb29sLiBQUklWQVRFLlxuICpcbiAqIENvbnZleCBwdWJsaXNoZWQgdGhpcyBiZWNhdXNlIGEgcXVlcnkgY291bGQgY291bnQgaXQgd2l0aG91dCByZXR1cm5pbmcgaXQuIEhlcmVcbiAqIGEgcHVibGljIHRhYmxlIG1lYW5zIGV2ZXJ5IGNsaWVudCBob2xkcyBldmVyeSB3YWl0aW5nIHBsYXllcidzIHJhdGluZywgd2hpY2ggaXNcbiAqIGJvdGggYSBuZWVkbGVzcyBicm9hZGNhc3QgYW5kIGEgc21hbGwgaW5mb3JtYXRpb24gbGVhay4gVGhlIHR3byB0aGluZ3MgY2xpZW50c1xuICogYWN0dWFsbHkgbmVlZCDigJQgXCJhbSBJIHF1ZXVlZFwiIGFuZCBcImhvdyBtYW55IGh1bWFucyBhcmUgd2FpdGluZ1wiIOKAlCBhcmUgdGhlXG4gKiBgbXlfcXVldWVfZW50cnlgIGFuZCBgcXVldWVfc2l6ZWAgdmlld3MuXG4gKi9cbmNvbnN0IHF1ZXVlX2VudHJ5ID0gdGFibGUoXG4gIHsgbmFtZTogXCJxdWV1ZV9lbnRyeVwiIH0sXG4gIHtcbiAgICB1c2VySWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLFxuICAgIGVsbzogdC5pMzIoKS5pbmRleChcImJ0cmVlXCIpLFxuICAgIGVucXVldWVkQXQ6IHQudGltZXN0YW1wKCksXG4gICAgLyoqIERlbm9ybWFsaXNlZCBzbyB0aGUgd2FpdGluZyBjb3VudCBjYW4gZXhjbHVkZSBib3RzIHdpdGhvdXQgYSBsb29rdXAgcGVyIHJvdy4gKi9cbiAgICBpc0JvdDogdC5ib29sKCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgfSxcbik7XG5cbi8qKlxuICogTGl2ZSBjb25uZWN0aW9ucy4gUFJJVkFURS5cbiAqXG4gKiBSRVBMQUNFUyB0aGUgYHByZXNlbmNlYCB0YWJsZSBhbmQgdGhlIDUtc2Vjb25kIGBoZWFydGJlYXRgIG11dGF0aW9uIGVudGlyZWx5LlxuICogQ29udmV4IGhhZCBubyB3YXkgdG8gb2JzZXJ2ZSBhIHNvY2tldCBjbG9zaW5nLCBzbyBsaXZlbmVzcyBoYWQgdG8gYmUgaW5mZXJyZWRcbiAqIGZyb20gYSBjbGllbnQgd3JpdGluZyBhIHRpbWVzdGFtcCBvbiBhIHRpbWVyIOKAlCB3aGljaCB0aGUgc2NoZW1hIG5vdGVzIHdhcyBcInRoZVxuICogc2luZ2xlIGxhcmdlc3QgbGluZSBpbiB0aGUgYnVkZ2V0XCIuIFNwYWNldGltZURCIGNhbGxzIGBjbGllbnRDb25uZWN0ZWRgIGFuZFxuICogYGNsaWVudERpc2Nvbm5lY3RlZGAsIHNvIGxpdmVuZXNzIGlzIG5vdyBhbiBvYnNlcnZlZCBmYWN0IHJhdGhlciB0aGFuIGEgcG9sbC5cbiAqXG4gKiBPbmUgSWRlbnRpdHkgY2FuIGhvbGQgc2V2ZXJhbCBjb25uZWN0aW9ucyAodHdvIHRhYnMpLCBzbyB0aGlzIGlzIGtleWVkIGJ5XG4gKiBjb25uZWN0aW9uIGFuZCBhIHBsYXllciBpcyBwcmVzZW50IHdoaWxlIGFueSByb3cgc3Vydml2ZXMuXG4gKi9cbmNvbnN0IGNvbm5lY3Rpb24gPSB0YWJsZShcbiAgeyBuYW1lOiBcImNvbm5lY3Rpb25cIiB9LFxuICB7XG4gICAgY29ubmVjdGlvbklkOiB0LmNvbm5lY3Rpb25JZCgpLnByaW1hcnlLZXkoKSxcbiAgICB1c2VySWQ6IHQudTY0KCkuaW5kZXgoXCJidHJlZVwiKSxcbiAgICBjb25uZWN0ZWRBdDogdC50aW1lc3RhbXAoKSxcbiAgfSxcbik7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gT3BlcmF0b3Igc3RhdGVcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG4vKipcbiAqIE9uZSBzYXZlZCBjb25maWcsIGltbXV0YWJsZSBvbmNlIHdyaXR0ZW4uIE9WRVJSSURFUyBPTkxZLCBuZXZlciBhIHdob2xlIGNvbmZpZy5cbiAqXG4gKiBzcmMvZW5naW5lL2NvbmZpZy50cyBzdGF5cyB0aGUgc2hpcHBlZCBiYXNlbGluZSBhbmQgdGhlc2Ugcm93cyBjYXJyeSBvbmx5IHRoZVxuICogZGlmZmVyZW5jZXMsIHdoaWNoIGlzIHdoYXQgbGV0cyBhIGNvbnN0YW50IGFkZGVkIHRvIHRoZSBjb2RlIGxhdGVyIHJlc29sdmVcbiAqIGNvcnJlY3RseSBmb3IgYSB2ZXJzaW9uIHJvdyB3cml0dGVuIGJlZm9yZSBpdCBleGlzdGVkLiBBcHBlbmQtb25seTogYSByZXZlcnRcbiAqIHdyaXRlcyBhIE5FVyByb3cgaG9sZGluZyB0aGUgb2xkIHZhbHVlcywgYmVjYXVzZSBmaW5pc2hlZCBtYXRjaGVzIHBvaW50IGF0IHRoZXNlXG4gKiBieSBpZCBhbmQgZWRpdGluZyBvbmUgaW4gcGxhY2Ugd291bGQgcmV0cm9hY3RpdmVseSBjaGFuZ2UgdGhlIHJ1bGVzIHRoZXkgd2VyZVxuICogcGxheWVkIHVuZGVyLlxuICovXG5jb25zdCBjb25maWdfdmVyc2lvbiA9IHRhYmxlKFxuICB7IG5hbWU6IFwiY29uZmlnX3ZlcnNpb25cIiwgcHVibGljOiB0cnVlIH0sXG4gIHtcbiAgICBpZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHZhbHVlczogdC5hcnJheShDb25maWdPdmVycmlkZSksXG4gICAgY3JlYXRlZEF0OiB0LnRpbWVzdGFtcCgpLmluZGV4KFwiYnRyZWVcIiksXG4gICAgLyoqIE5vbmUgZm9yIHRoZSBzZWVkZWQgYmFzZWxpbmUsIHdob3NlIGF1dGhvciBpcyBcInRoZSBjb2RlXCIuICovXG4gICAgY3JlYXRlZEJ5OiB0Lm9wdGlvbih0LnU2NCgpKSxcbiAgICBub3RlOiB0Lm9wdGlvbih0LnN0cmluZygpKSxcbiAgfSxcbik7XG5cbi8qKlxuICogRGVwbG95bWVudC13aWRlIG9wZXJhdG9yIHN0YXRlLiBFeGFjdGx5IG9uZSByb3cuXG4gKlxuICogYGRldkZlYXR1cmVzRW5hYmxlZGAgbGl2ZXMgaGVyZSByYXRoZXIgdGhhbiBpbiB0aGUgZW52aXJvbm1lbnQgZm9yIHRoZSByZWFzb25cbiAqIHRoZSBDb252ZXggdmVyc2lvbiBtb3ZlZCBpdDogYW4gb3BlcmF0b3IgaGFzIHRvIGJlIGFibGUgdG8gZmxpcCBpdCBmcm9tIC9hZG1pbixcbiAqIGFuZCBhIG1vZHVsZSBjYW5ub3Qgd3JpdGUgaXRzIG93biBlbnZpcm9ubWVudC5cbiAqXG4gKiBgb3duZXJJZGVudGl0eWAgaXMgY2FwdHVyZWQgaW4gYGluaXRgLCB3aGVyZSBgY3R4LnNlbmRlcmAgaXMgdGhlIHB1Ymxpc2hlci4gSXRcbiAqIHJlcGxhY2VzIEFETUlOX0lNUE9SVF9TRUNSRVQ6IHRoZSBpbXBvcnQgYW5kIHNlZWQgc2NyaXB0cyBub3cgYXV0aGVudGljYXRlIGFzXG4gKiB0aGUgbW9kdWxlIG93bmVyIGluc3RlYWQgb2Ygc2hhcmluZyBhIHBhc3N3b3JkIHdpdGggdGhlIGRlcGxveW1lbnQuXG4gKi9cbmNvbnN0IHNldHRpbmdzID0gdGFibGUoXG4gIHsgbmFtZTogXCJzZXR0aW5nc1wiLCBwdWJsaWM6IHRydWUgfSxcbiAge1xuICAgIGlkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgLyoqIE5vbmUgdW50aWwgdGhlIGZpcnN0IHNhdmU7IHJlc29sdmVzIHRvIHRoZSBjb2RlIGRlZmF1bHRzLiAqL1xuICAgIGN1cnJlbnRWZXJzaW9uSWQ6IHQub3B0aW9uKHQudTY0KCkpLFxuICAgIGRldkZlYXR1cmVzRW5hYmxlZDogdC5ib29sKCksXG4gICAgdXBkYXRlZEF0OiB0LnRpbWVzdGFtcCgpLFxuICAgIHVwZGF0ZWRCeTogdC5vcHRpb24odC51NjQoKSksXG4gIH0sXG4pO1xuXG4vKiogT3duZXIgaWRlbnRpdHksIGNhcHR1cmVkIGF0IHB1Ymxpc2ggdGltZS4gUFJJVkFURSDigJQgaXQgaXMgYW4gYXV0aG9yaXNhdGlvbiBrZXkuICovXG5jb25zdCBtb2R1bGVfb3duZXIgPSB0YWJsZShcbiAgeyBuYW1lOiBcIm1vZHVsZV9vd25lclwiIH0sXG4gIHtcbiAgICBpZGVudGl0eTogdC5pZGVudGl0eSgpLnByaW1hcnlLZXkoKSxcbiAgICBjYXB0dXJlZEF0OiB0LnRpbWVzdGFtcCgpLFxuICB9LFxuKTtcblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBTY2hlZHVsZXNcbi8vXG4vLyBFdmVyeSBgY3R4LnNjaGVkdWxlci5ydW5BZnRlcihtcywgZm4sIGFyZ3MpYCBpbiB0aGUgQ29udmV4IGJhY2tlbmQgYmVjb21lcyBhIHJvd1xuLy8gaW4gb25lIG9mIHRoZXNlLiBUaGUgZ3VhcmQtb24tZXhwZWN0YXRpb24gZGlzY2lwbGluZSBpcyBjYXJyaWVkIG92ZXIgdmVyYmF0aW06XG4vLyBlYWNoIHJvdyByZWNvcmRzIHRoZSBzdGF0ZSBpdCBleHBlY3RzIHRvIGFjdCBvbiwgYW5kIGEgcmVkdWNlciB0aGF0IGZpcmVzIGxhdGUsXG4vLyB0d2ljZSwgb3IgYWdhaW5zdCBhIG1hdGNoIHRoYXQgaGFzIG1vdmVkIG9uIGlzIGEgbm8tb3AgcmF0aGVyIHRoYW4gYSBza2lwcGVkXG4vLyByb3VuZC4gT25lLXNob3Qgcm93cyBhcmUgZGVsZXRlZCBieSBTcGFjZXRpbWVEQiBhZnRlciB0aGUgcmVkdWNlciByZXR1cm5zLlxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbi8qKiBEcml2ZXMgZXZlcnkgdGltZWQgcGhhc2UgdHJhbnNpdGlvbi4gVGhlIHNwaW5lIG9mIHRoZSBtYXRjaCBjbG9jay4gKi9cbmNvbnN0IHBoYXNlX2FkdmFuY2Vfc2NoZWR1bGUgPSB0YWJsZShcbiAgeyBuYW1lOiBcInBoYXNlX2FkdmFuY2Vfc2NoZWR1bGVcIiwgc2NoZWR1bGVkOiAoKTogYW55ID0+IGFkdmFuY2VQaGFzZSB9LFxuICB7XG4gICAgc2NoZWR1bGVkX2lkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgc2NoZWR1bGVkX2F0OiB0LnNjaGVkdWxlQXQoKSxcbiAgICBtYXRjaElkOiB0LnU2NCgpLFxuICAgIGV4cGVjdGVkUGhhc2U6IHQuc3RyaW5nKCksXG4gICAgZXhwZWN0ZWRSb3VuZDogdC5pMzIoKSxcbiAgfSxcbik7XG5cbi8qKiBUaGUgYXVkaW8tYnVmZmVyIGJhcnJpZXI6IHBvbGxzIHVudGlsIGV2ZXJ5IGh1bWFuIGhhcyByZXBvcnRlZCB0aGUgcm91bmQuICovXG5jb25zdCByZWFkeV93YWl0X3NjaGVkdWxlID0gdGFibGUoXG4gIHsgbmFtZTogXCJyZWFkeV93YWl0X3NjaGVkdWxlXCIsIHNjaGVkdWxlZDogKCk6IGFueSA9PiB3YWl0Rm9yUmVhZHkgfSxcbiAge1xuICAgIHNjaGVkdWxlZF9pZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHNjaGVkdWxlZF9hdDogdC5zY2hlZHVsZUF0KCksXG4gICAgbWF0Y2hJZDogdC51NjQoKSxcbiAgICByb3VuZEluZGV4OiB0LmkzMigpLFxuICAgIHN0YXJ0ZWRXYWl0aW5nQXQ6IHQudGltZXN0YW1wKCksXG4gIH0sXG4pO1xuXG4vKiogQ2xvc2VzIGEgYmFuIGRyYWZ0IHRoYXQgbm9ib2R5IGlzIGRyaXZpbmcuICovXG5jb25zdCBkcmFmdF93YXRjaGRvZ19zY2hlZHVsZSA9IHRhYmxlKFxuICB7IG5hbWU6IFwiZHJhZnRfd2F0Y2hkb2dfc2NoZWR1bGVcIiwgc2NoZWR1bGVkOiAoKTogYW55ID0+IGRyYWZ0V2F0Y2hkb2cgfSxcbiAge1xuICAgIHNjaGVkdWxlZF9pZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHNjaGVkdWxlZF9hdDogdC5zY2hlZHVsZUF0KCksXG4gICAgbWF0Y2hJZDogdC51NjQoKSxcbiAgfSxcbik7XG5cbi8qKiBPbmUgcGxhbm5lZCBib3QgYWN0aW9uOiBhIGJhbiwgYSBndWVzcywgb3IgYSBwYXNzLiAqL1xuY29uc3QgYm90X2FjdGlvbl9zY2hlZHVsZSA9IHRhYmxlKFxuICB7IG5hbWU6IFwiYm90X2FjdGlvbl9zY2hlZHVsZVwiLCBzY2hlZHVsZWQ6ICgpOiBhbnkgPT4gcnVuQm90QWN0aW9uIH0sXG4gIHtcbiAgICBzY2hlZHVsZWRfaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBzY2hlZHVsZWRfYXQ6IHQuc2NoZWR1bGVBdCgpLFxuICAgIG1hdGNoSWQ6IHQudTY0KCksXG4gICAgdXNlcklkOiB0LnU2NCgpLFxuICAgIC8qKiBcImJhblwiIHwgXCJndWVzc1wiIHwgXCJwYXNzXCIgfCBcImRyYWZ0X3R1cm5cIi4gKi9cbiAgICBraW5kOiB0LnN0cmluZygpLFxuICAgIHJvdW5kSW5kZXg6IHQuaTMyKCksXG4gICAgZXhwZWN0ZWRUdXJuOiB0LmkzMigpLFxuICAgIC8qKiBUaGUgZ3Vlc3MgdGV4dCBmb3IgYSBcImd1ZXNzXCIgYWN0aW9uLiAqL1xuICAgIHRleHQ6IHQuc3RyaW5nKCksXG4gICAgY2xpZW50RWxhcHNlZE1zOiB0LmY2NCgpLFxuICB9LFxuKTtcblxuLyoqIFBhaXJzIGV2ZXJ5b25lIHBhaXJhYmxlLCB0aGVuIHJlLWFybXMgaXRzZWxmIHdoaWxlIHRoZSBwb29sIGlzIHN0aWxsIG1hdGNoYWJsZS4gKi9cbmNvbnN0IG1hdGNobWFraW5nX3N3ZWVwX3NjaGVkdWxlID0gdGFibGUoXG4gIHsgbmFtZTogXCJtYXRjaG1ha2luZ19zd2VlcF9zY2hlZHVsZVwiLCBzY2hlZHVsZWQ6ICgpOiBhbnkgPT4gc3dlZXBNYXRjaG1ha2luZyB9LFxuICB7XG4gICAgc2NoZWR1bGVkX2lkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgc2NoZWR1bGVkX2F0OiB0LnNjaGVkdWxlQXQoKSxcbiAgfSxcbik7XG5cbi8qKiBBcm1lZCB3aGVuIGEgcGxheWVyJ3MgbGFzdCBjb25uZWN0aW9uIGRyb3BzIG1pZC1yYW5rZWQtbWF0Y2guICovXG5jb25zdCBmb3JmZWl0X3N3ZWVwX3NjaGVkdWxlID0gdGFibGUoXG4gIHsgbmFtZTogXCJmb3JmZWl0X3N3ZWVwX3NjaGVkdWxlXCIsIHNjaGVkdWxlZDogKCk6IGFueSA9PiBzd2VlcEZvcmZlaXRzIH0sXG4gIHtcbiAgICBzY2hlZHVsZWRfaWQ6IHQudTY0KCkucHJpbWFyeUtleSgpLmF1dG9JbmMoKSxcbiAgICBzY2hlZHVsZWRfYXQ6IHQuc2NoZWR1bGVBdCgpLFxuICAgIG1hdGNoSWQ6IHQudTY0KCksXG4gIH0sXG4pO1xuXG4vKiogSW50ZXJ2YWwuIEV4cGlyZXMgYW5vbnltb3VzIGd1ZXN0IGlkZW50aXRpZXMgcGFzdCB0aGUgcmV0ZW50aW9uIHdpbmRvdy4gKi9cbmNvbnN0IGd1ZXN0X2NsZWFudXBfc2NoZWR1bGUgPSB0YWJsZShcbiAgeyBuYW1lOiBcImd1ZXN0X2NsZWFudXBfc2NoZWR1bGVcIiwgc2NoZWR1bGVkOiAoKTogYW55ID0+IGNsZWFudXBHdWVzdHMgfSxcbiAge1xuICAgIHNjaGVkdWxlZF9pZDogdC51NjQoKS5wcmltYXJ5S2V5KCkuYXV0b0luYygpLFxuICAgIHNjaGVkdWxlZF9hdDogdC5zY2hlZHVsZUF0KCksXG4gIH0sXG4pO1xuXG4vKiogSW50ZXJ2YWwuIFJlYnVpbGRzIGBsYWRkZXJfZW50cnlgLCB3cml0aW5nIG9ubHkgdGhlIHJvd3MgdGhhdCBhY3R1YWxseSBtb3ZlZC4gKi9cbmNvbnN0IGxhZGRlcl9yZWJ1aWxkX3NjaGVkdWxlID0gdGFibGUoXG4gIHsgbmFtZTogXCJsYWRkZXJfcmVidWlsZF9zY2hlZHVsZVwiLCBzY2hlZHVsZWQ6ICgpOiBhbnkgPT4gcmVidWlsZExhZGRlciB9LFxuICB7XG4gICAgc2NoZWR1bGVkX2lkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgc2NoZWR1bGVkX2F0OiB0LnNjaGVkdWxlQXQoKSxcbiAgfSxcbik7XG5cbi8qKiBJbnRlcnZhbCwgREVWIE9OTFkuIEtlZXBzIHRoZSByYW5rIGJvdHMgc3RvY2tlZCBpbiB0aGUgcXVldWUuICovXG5jb25zdCBkZXZib3RfcmVmaWxsX3NjaGVkdWxlID0gdGFibGUoXG4gIHsgbmFtZTogXCJkZXZib3RfcmVmaWxsX3NjaGVkdWxlXCIsIHNjaGVkdWxlZDogKCk6IGFueSA9PiByZWZpbGxEZXZCb3RRdWV1ZSB9LFxuICB7XG4gICAgc2NoZWR1bGVkX2lkOiB0LnU2NCgpLnByaW1hcnlLZXkoKS5hdXRvSW5jKCksXG4gICAgc2NoZWR1bGVkX2F0OiB0LnNjaGVkdWxlQXQoKSxcbiAgfSxcbik7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5leHBvcnQgY29uc3Qgc3BhY2V0aW1lZGIgPSBzY2hlbWEoe1xuICBhY2NvdW50LFxuICB1c2VyLFxuICB1c2VyX3ByZWZlcmVuY2UsXG4gIHVzZXJfYXZhdGFyLFxuICByZXBvcnQsXG4gIHVzZXJfYmFkZ2UsXG4gIGNhdGVnb3J5X3JhdGluZyxcblxuICBjYXRlZ29yeSxcbiAgdHJhY2ssXG4gIHRyYWNrX2FsaWFzLFxuICB0cmFja19pbmRleCxcblxuICBtYXRjaCxcbiAgbWF0Y2hfdHJhY2ssXG4gIHJvdW5kX3JldmVhbCxcbiAgbWF0Y2hfcGxheWVyLFxuICByb3VuZF9sb2csXG4gIHJvdW5kX3Jlc3VsdCxcbiAgZ3Vlc3MsXG4gIGd1ZXNzX2ZlZWRiYWNrLFxuXG4gIHJvb20sXG5cbiAgZGFpbHlfY2hhbGxlbmdlLFxuICBkYWlseV9ydW4sXG4gIGRhaWx5X2NvdW50LFxuXG4gIGxhZGRlcl9lbnRyeSxcbiAgbGFkZGVyX3N0YXR1cyxcbiAgbGFkZGVyX3RpZXJfY291bnQsXG4gIHF1ZXVlX2VudHJ5LFxuICBjb25uZWN0aW9uLFxuXG4gIGNvbmZpZ192ZXJzaW9uLFxuICBzZXR0aW5ncyxcbiAgbW9kdWxlX293bmVyLFxuXG4gIHBoYXNlX2FkdmFuY2Vfc2NoZWR1bGUsXG4gIHJlYWR5X3dhaXRfc2NoZWR1bGUsXG4gIGRyYWZ0X3dhdGNoZG9nX3NjaGVkdWxlLFxuICBib3RfYWN0aW9uX3NjaGVkdWxlLFxuICBtYXRjaG1ha2luZ19zd2VlcF9zY2hlZHVsZSxcbiAgZm9yZmVpdF9zd2VlcF9zY2hlZHVsZSxcbiAgZ3Vlc3RfY2xlYW51cF9zY2hlZHVsZSxcbiAgbGFkZGVyX3JlYnVpbGRfc2NoZWR1bGUsXG4gIGRldmJvdF9yZWZpbGxfc2NoZWR1bGUsXG59KTtcblxuZXhwb3J0IGRlZmF1bHQgc3BhY2V0aW1lZGI7XG5cbmV4cG9ydCB7XG4gIFJvdW5kRGFtYWdlLFxuICBSb3VuZFBsYXllclJlc3VsdCxcbiAgUm91bmRMb2dFbnRyeSxcbiAgWHBBd2FyZCxcbiAgQ29uZmlnT3ZlcnJpZGUsXG4gIG1hdGNoLFxuICBtYXRjaF9wbGF5ZXIsXG4gIHJvdW5kX2xvZyxcbiAgcm91bmRfcmVzdWx0LFxuICByb3VuZF9yZXZlYWwsXG4gIHVzZXIsXG4gIGxhZGRlcl9lbnRyeSxcbiAgY29uZmlnX3ZlcnNpb24sXG4gIHBoYXNlX2FkdmFuY2Vfc2NoZWR1bGUsXG4gIHJlYWR5X3dhaXRfc2NoZWR1bGUsXG4gIGRyYWZ0X3dhdGNoZG9nX3NjaGVkdWxlLFxuICBib3RfYWN0aW9uX3NjaGVkdWxlLFxuICBtYXRjaG1ha2luZ19zd2VlcF9zY2hlZHVsZSxcbiAgZm9yZmVpdF9zd2VlcF9zY2hlZHVsZSxcbiAgZ3Vlc3RfY2xlYW51cF9zY2hlZHVsZSxcbiAgbGFkZGVyX3JlYnVpbGRfc2NoZWR1bGUsXG4gIGRldmJvdF9yZWZpbGxfc2NoZWR1bGUsXG59O1xuXG4vLyBGb3J3YXJkIGRlY2xhcmF0aW9ucyByZXNvbHZlZCBhdCBydW50aW1lIGJ5IHRoZSBgKCk6IGFueSA9PmAgdGh1bmtzIGFib3ZlLlxuLy8gRGVmaW5lZCBpbiB0aGUgcmVkdWNlciBtb2R1bGVzOyBpbXBvcnRlZCBoZXJlIG9ubHkgdG8gY2xvc2UgdGhlIGN5Y2xlLlxuaW1wb3J0IHtcbiAgYWR2YW5jZVBoYXNlLFxuICB3YWl0Rm9yUmVhZHksXG4gIGRyYWZ0V2F0Y2hkb2csXG4gIHJ1bkJvdEFjdGlvbixcbiAgc3dlZXBNYXRjaG1ha2luZyxcbiAgc3dlZXBGb3JmZWl0cyxcbiAgY2xlYW51cEd1ZXN0cyxcbiAgcmVidWlsZExhZGRlcixcbiAgcmVmaWxsRGV2Qm90UXVldWUsXG59IGZyb20gXCIuL3NjaGVkdWxlc1wiO1xuIiwiLyoqXG4gKiBUaGUgbmluZSBzY2hlZHVsZWQgcmVkdWNlcnMuXG4gKlxuICogVGhlc2UgYXJlIHRoZSBTcGFjZXRpbWVEQiByZXBsYWNlbWVudCBmb3IgQ29udmV4J3MgYGN0eC5zY2hlZHVsZXIucnVuQWZ0ZXJgLlxuICogRWFjaCBvbmUgaXMgYSB0aGluIGRpc3BhdGNoZXI6IHRoZSByZWFsIHdvcmsgbGl2ZXMgaW4gdGhlIGRvbWFpbiBtb2R1bGVzLCBhbmRcbiAqIGV2ZXJ5dGhpbmcgaGVyZSBpcyB0aGUgc2FtZSBndWFyZC1vbi1leHBlY3RhdGlvbiBjaGVjayB0aGUgQ29udmV4IG9yaWdpbmFsc1xuICogb3BlbmVkIHdpdGgg4oCUIGEgam9iIHRoYXQgZmlyZXMgbGF0ZSwgdHdpY2UsIG9yIGFnYWluc3QgYSBtYXRjaCB0aGF0IGhhcyBhbHJlYWR5XG4gKiBtb3ZlZCBvbiBtdXN0IGJlIGEgbm8tb3AgcmF0aGVyIHRoYW4gYSBza2lwcGVkIHJvdW5kLlxuICpcbiAqIE1PRFVMRSBPUkRFUiBNQVRURVJTLiBgc2NoZW1hLnRzYCBuYW1lcyB0aGVzZSBpbiBpdHMgYHNjaGVkdWxlZDogKCk6IGFueSA9PiDigKZgXG4gKiB0aHVua3MsIHNvIHRoZSB0d28gZmlsZXMgZm9ybSBhIGN5Y2xlLiBUaGUgdGh1bmtzIGRlZmVyLCB3aGljaCBpcyB3aGF0IG1ha2VzIHRoZVxuICogY3ljbGUgbGVnYWwsIGJ1dCBvbmx5IGlmIHRoaXMgbW9kdWxlIGZpbmlzaGVzIGV2YWx1YXRpbmcgYmVmb3JlIGFueXRoaW5nIGNhbGxzXG4gKiB0aGVtIOKAlCBoZW5jZSBgaW5kZXgudHNgIGltcG9ydHMgdGhpcyBmaWxlIGJlZm9yZSBgLi9zY2hlbWFgLlxuICovXG5pbXBvcnQgeyBzcGFjZXRpbWVkYiwgcGhhc2VfYWR2YW5jZV9zY2hlZHVsZSwgcmVhZHlfd2FpdF9zY2hlZHVsZSwgZHJhZnRfd2F0Y2hkb2dfc2NoZWR1bGUsIGJvdF9hY3Rpb25fc2NoZWR1bGUsIG1hdGNobWFraW5nX3N3ZWVwX3NjaGVkdWxlLCBmb3JmZWl0X3N3ZWVwX3NjaGVkdWxlLCBndWVzdF9jbGVhbnVwX3NjaGVkdWxlLCBsYWRkZXJfcmVidWlsZF9zY2hlZHVsZSwgZGV2Ym90X3JlZmlsbF9zY2hlZHVsZSB9IGZyb20gXCIuL3NjaGVtYVwiO1xuXG5leHBvcnQgY29uc3QgYWR2YW5jZVBoYXNlID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAgeyByb3c6IHBoYXNlX2FkdmFuY2Vfc2NoZWR1bGUucm93VHlwZSB9LFxuICAoX2N0eCwgeyByb3cgfSkgPT4ge1xuICAgIHZvaWQgcm93O1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHdhaXRGb3JSZWFkeSA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHsgcm93OiByZWFkeV93YWl0X3NjaGVkdWxlLnJvd1R5cGUgfSxcbiAgKF9jdHgsIHsgcm93IH0pID0+IHtcbiAgICB2b2lkIHJvdztcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBkcmFmdFdhdGNoZG9nID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAgeyByb3c6IGRyYWZ0X3dhdGNoZG9nX3NjaGVkdWxlLnJvd1R5cGUgfSxcbiAgKF9jdHgsIHsgcm93IH0pID0+IHtcbiAgICB2b2lkIHJvdztcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBydW5Cb3RBY3Rpb24gPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKFxuICB7IHJvdzogYm90X2FjdGlvbl9zY2hlZHVsZS5yb3dUeXBlIH0sXG4gIChfY3R4LCB7IHJvdyB9KSA9PiB7XG4gICAgdm9pZCByb3c7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3Qgc3dlZXBNYXRjaG1ha2luZyA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHsgcm93OiBtYXRjaG1ha2luZ19zd2VlcF9zY2hlZHVsZS5yb3dUeXBlIH0sXG4gIChfY3R4LCB7IHJvdyB9KSA9PiB7XG4gICAgdm9pZCByb3c7XG4gIH0sXG4pO1xuXG5leHBvcnQgY29uc3Qgc3dlZXBGb3JmZWl0cyA9IHNwYWNldGltZWRiLnJlZHVjZXIoXG4gIHsgcm93OiBmb3JmZWl0X3N3ZWVwX3NjaGVkdWxlLnJvd1R5cGUgfSxcbiAgKF9jdHgsIHsgcm93IH0pID0+IHtcbiAgICB2b2lkIHJvdztcbiAgfSxcbik7XG5cbmV4cG9ydCBjb25zdCBjbGVhbnVwR3Vlc3RzID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAgeyByb3c6IGd1ZXN0X2NsZWFudXBfc2NoZWR1bGUucm93VHlwZSB9LFxuICAoX2N0eCwgeyByb3cgfSkgPT4ge1xuICAgIHZvaWQgcm93O1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHJlYnVpbGRMYWRkZXIgPSBzcGFjZXRpbWVkYi5yZWR1Y2VyKFxuICB7IHJvdzogbGFkZGVyX3JlYnVpbGRfc2NoZWR1bGUucm93VHlwZSB9LFxuICAoX2N0eCwgeyByb3cgfSkgPT4ge1xuICAgIHZvaWQgcm93O1xuICB9LFxuKTtcblxuZXhwb3J0IGNvbnN0IHJlZmlsbERldkJvdFF1ZXVlID0gc3BhY2V0aW1lZGIucmVkdWNlcihcbiAgeyByb3c6IGRldmJvdF9yZWZpbGxfc2NoZWR1bGUucm93VHlwZSB9LFxuICAoX2N0eCwgeyByb3cgfSkgPT4ge1xuICAgIHZvaWQgcm93O1xuICB9LFxuKTtcbiJdLCJtYXBwaW5n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