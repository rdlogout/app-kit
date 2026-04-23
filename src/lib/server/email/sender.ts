import type { CreateEmailSenderOptions, EmailSender } from "./types.js";

export function createEmailSender<TData = never, TOutput = void, TBinding extends SendEmail = SendEmail>(
	options: CreateEmailSenderOptions<TData, TOutput, TBinding>,
): EmailSender<TData, TOutput> {
	return async (input) => {
		const binding = options.binding();

		return options.handle({
			input,
			binding,
			send: (message) => {
				const from = message.from ?? options.from;
				if (!from) throw new Error("[app-kit/email] Missing sender address.");
				return binding.send({ ...message, from });
			},
		});
	};
}
