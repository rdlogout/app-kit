import type { Address, Attachment, Email } from "postal-mime";

export type ParsedEmailAddress = Address;
export type ParsedEmailAttachment = Attachment;
export type ParsedEmail = Email;

export type EmailHeaderMap = Record<string, string>;

export type EmailHandlerInput = {
	raw: ForwardableEmailMessage;
	from: string;
	to: string;
	subject?: string;
	messageId?: string;
	headers: EmailHeaderMap;
	rawBytes: Uint8Array;
	rawText: string;
	rawBase64: string;
	parsed: ParsedEmail;
	text?: string;
	html?: string;
	attachments: ParsedEmailAttachment[];
	fromAddress?: ParsedEmailAddress;
	toAddresses?: ParsedEmailAddress[];
	ccAddresses?: ParsedEmailAddress[];
	bccAddresses?: ParsedEmailAddress[];
	replyToAddresses?: ParsedEmailAddress[];
	forward: (recipient: string, headers?: Headers) => Promise<EmailSendResult>;
	reject: (reason: string) => void;
	reply: (message: EmailMessage) => Promise<EmailSendResult>;
};

export type CreateEmailHandler = (message: ForwardableEmailMessage) => Promise<void>;
export type CreateEmailHandlerCallback = (input: EmailHandlerInput) => Promise<void> | void;

export type SendEmailOptions<TData = never> = {
	to: string | string[];
	subject: string;
	text?: string;
	from?: string;
	replyTo?: string;
	cc?: string | string[];
	bcc?: string | string[];
	headers?: Record<string, string>;
	attachments?: EmailAttachment[];
} & ([TData] extends [never] ? object : TData);

export type EmailTransportMessage = {
	to: string | string[];
	subject: string;
	replyTo?: string | EmailAddress;
	cc?: string | string[];
	bcc?: string | string[];
	headers?: Record<string, string>;
	text?: string;
	html?: string;
	attachments?: EmailAttachment[];
	from?: string | EmailAddress;
};

export type EmailSenderHandleArgs<TData = never, TBinding extends SendEmail = SendEmail> = {
	input: SendEmailOptions<TData>;
	send: (message: EmailTransportMessage) => Promise<EmailSendResult>;
	binding: TBinding;
};

export type CreateEmailSenderOptions<TData = never, TOutput = void, TBinding extends SendEmail = SendEmail> = {
	binding: () => TBinding;
	from?: string | EmailAddress;
	handle: (args: EmailSenderHandleArgs<TData, TBinding>) => Promise<TOutput> | TOutput;
};

export type EmailSender<TData = never, TOutput = void> = (input: SendEmailOptions<TData>) => Promise<TOutput>;
