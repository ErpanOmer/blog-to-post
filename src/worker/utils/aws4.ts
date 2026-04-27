export interface AWS4SignParams {
	method: string;
	url: string;
	accessKeyId: string;
	secretAccessKey: string;
	securityToken?: string;
	region?: string;
	service?: string;
	headers?: Record<string, string>;
	body?: string;
}

export interface AWS4SignResult {
	authorization: string;
	amzDate: string;
	headers: Record<string, string>;
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
	const keyBytes = key instanceof Uint8Array ? key : new Uint8Array(key);
	const keyBuffer = new Uint8Array(keyBytes).buffer as ArrayBuffer;
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyBuffer,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function sha256(message: string): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
	return arrayBufferToHex(hashBuffer);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function formatAmzDate(date: Date): string {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function formatDateStamp(date: Date): string {
	return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function canonicalizeQuery(parsedUrl: URL): string {
	const params: Array<[string, string]> = [];
	parsedUrl.searchParams.forEach((value, key) => {
		params.push([key, value]);
	});
	return params
		.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]))
		.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
		.join("&");
}

export async function signAWS4(params: AWS4SignParams): Promise<AWS4SignResult> {
	const {
		method,
		url,
		accessKeyId,
		secretAccessKey,
		securityToken,
		region = "cn-north-1",
		service = "imagex",
		headers = {},
		body = "",
	} = params;

	const parsedUrl = new URL(url);
	const now = new Date();
	const amzDate = formatAmzDate(now);
	const dateStamp = formatDateStamp(now);

	const signedHeadersObj: Record<string, string> = {
		"x-amz-date": amzDate,
	};

	if (securityToken) {
		signedHeadersObj["x-amz-security-token"] = securityToken;
	}

	Object.assign(signedHeadersObj, headers);

	const signedHeaderNames = Object.keys(signedHeadersObj)
		.map((key) => key.toLowerCase())
		.sort()
		.join(";");

	const canonicalHeaders = Object.entries(signedHeadersObj)
		.map(([key, value]) => `${key.toLowerCase()}:${value.trim()}`)
		.sort()
		.join("\n") + "\n";

	const payloadHash = await sha256(body);
	const canonicalRequest = [
		method.toUpperCase(),
		parsedUrl.pathname || "/",
		canonicalizeQuery(parsedUrl),
		canonicalHeaders,
		signedHeaderNames,
		payloadHash,
	].join("\n");

	const algorithm = "AWS4-HMAC-SHA256";
	const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
	const canonicalRequestHash = await sha256(canonicalRequest);
	const stringToSign = [
		algorithm,
		amzDate,
		credentialScope,
		canonicalRequestHash,
	].join("\n");

	const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
	const kRegion = await hmacSha256(kDate, region);
	const kService = await hmacSha256(kRegion, service);
	const kSigning = await hmacSha256(kService, "aws4_request");
	const signature = arrayBufferToHex(await hmacSha256(kSigning, stringToSign));
	const authorization =
		`${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

	const resultHeaders: Record<string, string> = {
		authorization,
		"x-amz-date": amzDate,
	};

	if (securityToken) {
		resultHeaders["x-amz-security-token"] = securityToken;
	}

	return {
		authorization,
		amzDate,
		headers: resultHeaders,
	};
}

export function crc32(data: Uint8Array): string {
	let crc = 0xffffffff;
	const table = getCRC32Table();

	for (let i = 0; i < data.length; i++) {
		crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
	}

	return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

let crc32Table: Uint32Array | null = null;

function getCRC32Table(): Uint32Array {
	if (crc32Table) return crc32Table;

	crc32Table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let current = i;
		for (let j = 0; j < 8; j++) {
			current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
		}
		crc32Table[i] = current;
	}
	return crc32Table;
}
