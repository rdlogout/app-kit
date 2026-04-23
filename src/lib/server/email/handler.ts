import PostalMime from "postal-mime";
import type { CreateEmailHandler, CreateEmailHandlerCallback, EmailHeaderMap } from "./types.js";

function encodeBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;

	for (let index = 0; index < bytes.length; index += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
	}

	return btoa(binary);
}

function toHeaderMap(headers: Headers): EmailHeaderMap {
	const values: EmailHeaderMap = {};
	headers.forEach((value, key) => {
		values[key] = value;
	});
	return values;
}

export function createEmailHandler(handler: CreateEmailHandlerCallback): CreateEmailHandler {
	return async (message) => {
		const rawBuffer = await new Response(message.raw).arrayBuffer();
		const rawBytes = new Uint8Array(rawBuffer);
		const parsed = await PostalMime.parse(rawBuffer, { attachmentEncoding: "arraybuffer" });
		const headers = toHeaderMap(message.headers);

		await handler({
			raw: message,
			from: message.from,
			to: message.to,
			subject: parsed.subject ?? headers.subject,
			messageId: parsed.messageId ?? headers["message-id"],
			headers,
			rawBytes,
			rawText: new TextDecoder().decode(rawBytes),
			rawBase64: encodeBase64(rawBytes),
			parsed,
			text: parsed.text,
			html: parsed.html,
			attachments: parsed.attachments,
			fromAddress: parsed.from,
			toAddresses: parsed.to,
			ccAddresses: parsed.cc,
			bccAddresses: parsed.bcc,
			replyToAddresses: parsed.replyTo,
			forward: (recipient, extraHeaders) => message.forward(recipient, extraHeaders),
			reject: (reason) => message.setReject(reason),
			reply: (replyMessage) => message.reply(replyMessage),
		});
	};
}
