export type CronHandler = () => void | Promise<void>;

export type CronHandlers = Record<string, CronHandler>;

export type ConfigureCronResult<TExpression extends string = string> = {
	expressions: TExpression[];
	scheduled: (controller: ScheduledController, env?: unknown, ctx?: unknown) => Promise<void>;
};

export function configureCron<const THandlers extends CronHandlers>(
	handlers: THandlers,
): ConfigureCronResult<Extract<keyof THandlers, string>> {
	const expressions = Object.keys(handlers) as Extract<keyof THandlers, string>[];

	async function scheduled(controller: ScheduledController): Promise<void> {
		const handler = handlers[controller.cron];
		if (!handler) return;
		await handler();
	}

	return { expressions, scheduled };
}
